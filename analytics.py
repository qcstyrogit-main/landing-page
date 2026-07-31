import hashlib
import os
import re
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from functools import wraps
from time import time
from urllib.parse import urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from flask import abort, jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash


BOT_PATTERN = re.compile(
    r"bot|crawler|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|uptimerobot",
    re.IGNORECASE,
)
TRACKING_EXCLUSIONS = (
    "/analytics",
    "/api/",
    "/static/",
    "/files/",
    "/private/",
)
SESSION_TIMEOUT_SECONDS = 30 * 60
CLIENT_EVENTS = {
    "chat_open",
    "contact_open",
    "inquiry_open",
    "product_view",
    "view_jobs",
}
CONVERSION_EVENTS = {
    "contact_submit",
    "job_application_submit",
    "product_inquiry_submit",
}
SERVER_CONVERSION_PATHS = {
    "/api/contact-us": ("contact_submit", ""),
    "/api/send-inquiry-mc": ("product_inquiry_submit", "product"),
    "/api/send-inquiry-qc": ("product_inquiry_submit", "product"),
    "/api/submit-job-applicant": ("job_application_submit", "job_opening"),
    "/api/open-application": ("job_application_submit", ""),
}
EVENT_LABELS = {
    "chat_open": "Chat opened",
    "contact_open": "Contact form opened",
    "contact_submit": "Contact form submitted",
    "inquiry_open": "Product inquiry opened",
    "job_application_submit": "Job application submitted",
    "product_inquiry_submit": "Product inquiry submitted",
    "product_view": "Product viewed",
    "view_jobs": "Jobs page opened",
}


def init_analytics(app):
    database_path = os.getenv(
        "ANALYTICS_DB_PATH",
        os.path.join(app.instance_path, "website_analytics.sqlite3"),
    )
    os.makedirs(os.path.dirname(os.path.abspath(database_path)), exist_ok=True)
    try:
        analytics_timezone = ZoneInfo(os.getenv("ANALYTICS_TIMEZONE", "Asia/Manila"))
    except ZoneInfoNotFoundError:
        # Windows Python installations may not include the IANA time-zone
        # database. Philippine time does not observe daylight saving time.
        analytics_timezone = timezone(timedelta(hours=8), "PHT")

    def connect():
        connection = sqlite3.connect(database_path, timeout=5)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA busy_timeout=5000")
        return connection

    with connect() as database:
        database.execute(
            """
            CREATE TABLE IF NOT EXISTS page_views (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                viewed_at TEXT NOT NULL,
                path TEXT NOT NULL,
                visitor_hash TEXT NOT NULL,
                session_id TEXT NOT NULL,
                referrer_domain TEXT NOT NULL DEFAULT '',
                device TEXT NOT NULL,
                browser TEXT NOT NULL
            )
            """
        )
        database.execute("CREATE INDEX IF NOT EXISTS idx_page_views_date ON page_views(viewed_at)")
        database.execute("CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path)")
        database.execute("CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON page_views(visitor_hash)")
        database.execute(
            """
            CREATE TABLE IF NOT EXISTS visits (
                session_id TEXT PRIMARY KEY,
                visitor_hash TEXT NOT NULL,
                started_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL,
                entry_path TEXT NOT NULL,
                referrer_domain TEXT NOT NULL DEFAULT '',
                device TEXT NOT NULL,
                browser TEXT NOT NULL,
                engaged_seconds INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        visit_columns = {
            row["name"] for row in database.execute("PRAGMA table_info(visits)").fetchall()
        }
        if "engaged_seconds" not in visit_columns:
            database.execute(
                "ALTER TABLE visits ADD COLUMN engaged_seconds INTEGER NOT NULL DEFAULT 0"
            )
        database.execute("CREATE INDEX IF NOT EXISTS idx_visits_started ON visits(started_at)")
        database.execute("CREATE INDEX IF NOT EXISTS idx_visits_visitor ON visits(visitor_hash)")
        database.execute(
            """
            CREATE TABLE IF NOT EXISTS analytics_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                occurred_at TEXT NOT NULL,
                event_name TEXT NOT NULL,
                path TEXT NOT NULL,
                label TEXT NOT NULL DEFAULT '',
                visitor_hash TEXT NOT NULL,
                session_id TEXT NOT NULL
            )
            """
        )
        database.execute("CREATE INDEX IF NOT EXISTS idx_events_date ON analytics_events(occurred_at)")
        database.execute("CREATE INDEX IF NOT EXISTS idx_events_name ON analytics_events(event_name)")
        database.execute("CREATE INDEX IF NOT EXISTS idx_events_session ON analytics_events(session_id)")
        # Preserve the usefulness of page views recorded before visit tracking
        # was introduced. New visits use the 30-minute inactivity rule below.
        database.execute(
            """
            INSERT OR IGNORE INTO visits
            (session_id, visitor_hash, started_at, last_seen_at, entry_path, referrer_domain, device, browser)
            SELECT session_id, visitor_hash, MIN(viewed_at), MAX(viewed_at), MIN(path),
                   MIN(referrer_domain), MIN(device), MIN(browser)
            FROM page_views GROUP BY session_id
            """
        )

    def client_ip():
        forwarded = request.headers.get("X-Forwarded-For", "")
        return (forwarded.split(",", 1)[0].strip() if forwarded else request.remote_addr) or "unknown"

    def classify_user_agent(user_agent):
        value = (user_agent or "").lower()
        device = "Mobile" if re.search(r"android|iphone|ipod|mobile", value) else "Tablet" if re.search(r"ipad|tablet", value) else "Desktop"
        if "edg/" in value:
            browser = "Edge"
        elif "firefox/" in value:
            browser = "Firefox"
        elif "chrome/" in value and "edg/" not in value:
            browser = "Chrome"
        elif "safari/" in value and "chrome/" not in value:
            browser = "Safari"
        else:
            browser = "Other"
        return device, browser

    def actor_is_excluded():
        return (
            request.headers.get("DNT") == "1"
            or bool(BOT_PATTERN.search(request.headers.get("User-Agent", "")))
        )

    def clean_label(value):
        value = re.sub(r"[\x00-\x1f\x7f]+", " ", str(value or ""))
        return re.sub(r"\s+", " ", value).strip()[:120]

    def clean_path(value):
        value = str(value or "")
        return value[:300] if value.startswith("/") and not value.startswith("//") else "/"

    def request_referrer_domain():
        referrer = urlparse(request.referrer or "")
        domain = referrer.netloc.lower()
        return "" if domain == request.host.lower() else domain[:200]

    def analytics_identity():
        user_agent = request.headers.get("User-Agent", "")
        salt = os.getenv("ANALYTICS_HASH_SALT") or str(app.config["SECRET_KEY"])
        visitor_hash = hashlib.sha256(f"{salt}|{client_ip()}|{user_agent}".encode()).hexdigest()
        current_timestamp = int(time())
        last_seen = session.get("_analytics_last_seen", 0)
        analytics_session = session.get("_analytics_sid")
        if not analytics_session or current_timestamp - int(last_seen or 0) > SESSION_TIMEOUT_SECONDS:
            analytics_session = secrets.token_urlsafe(18)
            session["_analytics_sid"] = analytics_session
        session["_analytics_last_seen"] = current_timestamp
        return visitor_hash, analytics_session

    def record_visit(database, visitor_hash, analytics_session, occurred_at, path):
        user_agent = request.headers.get("User-Agent", "")
        device, browser = classify_user_agent(user_agent)
        database.execute(
            """
            INSERT INTO visits
            (session_id, visitor_hash, started_at, last_seen_at, entry_path, referrer_domain, device, browser)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET last_seen_at = excluded.last_seen_at
            """,
            (
                analytics_session,
                visitor_hash,
                occurred_at,
                occurred_at,
                path,
                request_referrer_domain(),
                device,
                browser,
            ),
        )

    def record_event(event_name, path, label=""):
        occurred_at = datetime.now(analytics_timezone).isoformat(timespec="seconds")
        visitor_hash, analytics_session = analytics_identity()
        with connect() as database:
            record_visit(database, visitor_hash, analytics_session, occurred_at, path)
            database.execute(
                """
                INSERT INTO analytics_events
                (occurred_at, event_name, path, label, visitor_hash, session_id)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    occurred_at,
                    event_name,
                    clean_path(path),
                    clean_label(label),
                    visitor_hash,
                    analytics_session,
                ),
            )

    def should_track(response):
        if request.method != "GET" or response.status_code >= 400:
            return False
        if response.mimetype != "text/html" or actor_is_excluded():
            return False
        if any(request.path.startswith(prefix) for prefix in TRACKING_EXCLUSIONS):
            return False
        return True

    @app.after_request
    def record_page_view(response):
        if not should_track(response):
            return response
        try:
            occurred_at = datetime.now(analytics_timezone).isoformat(timespec="seconds")
            visitor_hash, analytics_session = analytics_identity()
            user_agent = request.headers.get("User-Agent", "")
            device, browser = classify_user_agent(user_agent)
            with connect() as database:
                record_visit(database, visitor_hash, analytics_session, occurred_at, request.path)
                database.execute(
                    """
                    INSERT INTO page_views
                    (viewed_at, path, visitor_hash, session_id, referrer_domain, device, browser)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        occurred_at,
                        request.path[:300],
                        visitor_hash,
                        analytics_session,
                        request_referrer_domain(),
                        device,
                        browser,
                    ),
                )
        except Exception:
            app.logger.exception("Unable to record analytics page view")
        return response

    def response_is_successful(response):
        if response.status_code >= 400:
            return False
        payload = response.get_json(silent=True)
        return not isinstance(payload, dict) or not (payload.get("error") or payload.get("exc"))

    @app.after_request
    def record_successful_conversion(response):
        conversion = SERVER_CONVERSION_PATHS.get(request.path)
        if (
            request.method == "POST"
            and conversion
            and response_is_successful(response)
            and not actor_is_excluded()
        ):
            try:
                event_name, label_field = conversion
                label = request.form.get(label_field, "") if label_field else ""
                record_event(event_name, request.referrer and urlparse(request.referrer).path or "/", label)
            except Exception:
                app.logger.exception("Unable to record analytics conversion")
        return response

    @app.after_request
    def protect_analytics_responses(response):
        if request.path.startswith("/analytics"):
            response.headers["Cache-Control"] = "no-store, private"
            response.headers["Pragma"] = "no-cache"
        return response

    @app.route("/api/analytics/event", methods=["POST"])
    def analytics_event():
        if actor_is_excluded():
            return "", 204
        payload = request.get_json(silent=True) or {}
        event_name = clean_label(payload.get("event"))
        if event_name not in CLIENT_EVENTS:
            return jsonify({"error": "invalid_event"}), 400
        try:
            record_event(event_name, clean_path(payload.get("path")), payload.get("label", ""))
        except Exception:
            app.logger.exception("Unable to record analytics event")
            return jsonify({"error": "analytics_unavailable"}), 503
        return "", 204

    @app.route("/api/analytics/engagement", methods=["POST"])
    def analytics_engagement():
        if actor_is_excluded():
            return "", 204
        payload = request.get_json(silent=True) or {}
        try:
            duration = float(payload.get("seconds", 0))
            if duration <= 0 or duration != duration:
                raise ValueError
            seconds = max(1, min(60, int(round(duration))))
        except (TypeError, ValueError, OverflowError):
            return jsonify({"error": "invalid_duration"}), 400
        path = clean_path(payload.get("path"))
        occurred_at = datetime.now(analytics_timezone).isoformat(timespec="seconds")
        try:
            visitor_hash, analytics_session = analytics_identity()
            with connect() as database:
                record_visit(database, visitor_hash, analytics_session, occurred_at, path)
                database.execute(
                    """
                    UPDATE visits
                    SET engaged_seconds = engaged_seconds + ?
                    WHERE session_id = ?
                    """,
                    (seconds, analytics_session),
                )
        except Exception:
            app.logger.exception("Unable to record analytics engagement")
            return jsonify({"error": "analytics_unavailable"}), 503
        return "", 204

    def credentials_configured():
        return bool(os.getenv("ANALYTICS_ADMIN_PASSWORD") or os.getenv("ANALYTICS_ADMIN_PASSWORD_HASH"))

    def verify_password(value):
        password_hash = os.getenv("ANALYTICS_ADMIN_PASSWORD_HASH", "")
        password = os.getenv("ANALYTICS_ADMIN_PASSWORD", "")
        if password_hash:
            try:
                return check_password_hash(password_hash, value)
            except ValueError:
                return False
        return bool(password) and secrets.compare_digest(value, password)

    def authenticated(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if not session.get("analytics_authenticated"):
                return redirect(url_for("analytics_login", next=request.path))
            return view(*args, **kwargs)
        return wrapped

    @app.route("/analytics/login", methods=["GET", "POST"])
    def analytics_login():
        error = ""
        if request.method == "POST":
            csrf = request.form.get("csrf_token", "")
            expected = session.get("csrf_token", "")
            username = request.form.get("username", "").strip()
            expected_username = os.getenv("ANALYTICS_ADMIN_USERNAME", "admin")
            if not csrf or not secrets.compare_digest(csrf, expected):
                abort(400)
            if username == expected_username and verify_password(request.form.get("password", "")):
                session["analytics_authenticated"] = True
                session.permanent = False
                return redirect(url_for("analytics_dashboard"))
            error = "Invalid analytics username or password."
        return render_template(
            "analytics_login.html",
            error=error,
            configured=credentials_configured(),
        )

    @app.route("/analytics")
    @authenticated
    def analytics_dashboard():
        now = datetime.now(analytics_timezone)
        today = now.date().isoformat()
        thirty_days = (now - timedelta(days=29)).date().isoformat()
        fourteen_days = (now - timedelta(days=13)).date()

        with connect() as database:
            totals = database.execute(
                """
                SELECT
                    COUNT(*) AS all_views,
                    COUNT(DISTINCT visitor_hash) AS all_visitors,
                    SUM(CASE WHEN substr(viewed_at, 1, 10) = ? THEN 1 ELSE 0 END) AS today_views,
                    COUNT(DISTINCT CASE WHEN substr(viewed_at, 1, 10) = ? THEN visitor_hash END) AS today_visitors,
                    SUM(CASE WHEN substr(viewed_at, 1, 10) >= ? THEN 1 ELSE 0 END) AS period_views,
                    COUNT(DISTINCT CASE WHEN substr(viewed_at, 1, 10) >= ? THEN visitor_hash END) AS period_visitors
                FROM page_views
                """,
                (today, today, thirty_days, thirty_days),
            ).fetchone()
            visit_totals = database.execute(
                """
                SELECT
                    COUNT(*) AS all_visits,
                    SUM(CASE WHEN substr(started_at, 1, 10) = ? THEN 1 ELSE 0 END) AS today_visits,
                    SUM(CASE WHEN substr(started_at, 1, 10) >= ? THEN 1 ELSE 0 END) AS period_visits
                FROM visits
                """,
                (today, thirty_days),
            ).fetchone()
            engagement_totals = database.execute(
                """
                SELECT
                    COALESCE(AVG(v.engaged_seconds), 0) AS average_seconds,
                    COUNT(*) AS total_visits,
                    SUM(
                        CASE
                            WHEN COALESCE(p.page_count, 0) <= 1
                             AND v.engaged_seconds < 10
                             AND COALESCE(e.event_count, 0) = 0
                            THEN 1 ELSE 0
                        END
                    ) AS bounced_visits
                FROM visits v
                LEFT JOIN (
                    SELECT session_id, COUNT(*) AS page_count
                    FROM page_views GROUP BY session_id
                ) p ON p.session_id = v.session_id
                LEFT JOIN (
                    SELECT session_id, COUNT(*) AS event_count
                    FROM analytics_events GROUP BY session_id
                ) e ON e.session_id = v.session_id
                WHERE substr(v.started_at, 1, 10) >= ?
                """,
                (thirty_days,),
            ).fetchone()
            conversion_totals = database.execute(
                """
                SELECT
                    COUNT(*) AS conversions,
                    COUNT(DISTINCT session_id) AS converting_visits,
                    SUM(CASE WHEN event_name = 'contact_submit' THEN 1 ELSE 0 END) AS contacts,
                    SUM(CASE WHEN event_name = 'product_inquiry_submit' THEN 1 ELSE 0 END) AS inquiries,
                    SUM(CASE WHEN event_name = 'job_application_submit' THEN 1 ELSE 0 END) AS applications
                FROM analytics_events
                WHERE substr(occurred_at, 1, 10) >= ?
                  AND event_name IN ('contact_submit', 'product_inquiry_submit', 'job_application_submit')
                """,
                (thirty_days,),
            ).fetchone()
            event_rows = database.execute(
                """
                SELECT event_name, COUNT(*) AS events, COUNT(DISTINCT session_id) AS visits
                FROM analytics_events
                WHERE substr(occurred_at, 1, 10) >= ?
                GROUP BY event_name ORDER BY events DESC
                """,
                (thirty_days,),
            ).fetchall()
            funnel_rows = database.execute(
                """
                SELECT
                    COUNT(DISTINCT CASE WHEN event_name = 'product_view' THEN session_id END) AS product_views,
                    COUNT(DISTINCT CASE WHEN event_name = 'inquiry_open' THEN session_id END) AS inquiry_opens,
                    COUNT(DISTINCT CASE WHEN event_name IN ('contact_submit', 'product_inquiry_submit') THEN session_id END) AS lead_submits,
                    COUNT(DISTINCT CASE WHEN event_name = 'job_application_submit' THEN session_id END) AS job_applications
                FROM analytics_events WHERE substr(occurred_at, 1, 10) >= ?
                """,
                (thirty_days,),
            ).fetchone()
            top_pages = database.execute(
                """
                SELECT path, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors
                FROM page_views WHERE substr(viewed_at, 1, 10) >= ?
                GROUP BY path ORDER BY views DESC LIMIT 10
                """,
                (thirty_days,),
            ).fetchall()
            devices = database.execute(
                """
                SELECT device AS label, COUNT(DISTINCT visitor_hash) AS value FROM page_views
                WHERE substr(viewed_at, 1, 10) >= ? GROUP BY device ORDER BY value DESC
                """,
                (thirty_days,),
            ).fetchall()
            browsers = database.execute(
                """
                SELECT browser AS label, COUNT(DISTINCT visitor_hash) AS value FROM page_views
                WHERE substr(viewed_at, 1, 10) >= ? GROUP BY browser ORDER BY value DESC
                """,
                (thirty_days,),
            ).fetchall()
            referrers = database.execute(
                """
                SELECT CASE WHEN referrer_domain = '' THEN 'Direct / internal' ELSE referrer_domain END AS label,
                       COUNT(*) AS value
                FROM page_views WHERE substr(viewed_at, 1, 10) >= ?
                GROUP BY referrer_domain ORDER BY value DESC LIMIT 8
                """,
                (thirty_days,),
            ).fetchall()
            trend_rows = database.execute(
                """
                SELECT substr(viewed_at, 1, 10) AS day, COUNT(*) AS views,
                       COUNT(DISTINCT visitor_hash) AS visitors
                FROM page_views WHERE substr(viewed_at, 1, 10) >= ?
                GROUP BY day ORDER BY day
                """,
                (fourteen_days.isoformat(),),
            ).fetchall()
            visit_trend_rows = database.execute(
                """
                SELECT substr(started_at, 1, 10) AS day, COUNT(*) AS visits
                FROM visits WHERE substr(started_at, 1, 10) >= ?
                GROUP BY day ORDER BY day
                """,
                (fourteen_days.isoformat(),),
            ).fetchall()

        trend_lookup = {row["day"]: row for row in trend_rows}
        visit_trend_lookup = {row["day"]: row["visits"] for row in visit_trend_rows}
        trend = []
        for offset in range(14):
            day = fourteen_days + timedelta(days=offset)
            row = trend_lookup.get(day.isoformat())
            trend.append({
                "label": day.strftime("%b %d"),
                "views": row["views"] if row else 0,
                "visitors": row["visitors"] if row else 0,
                "visits": visit_trend_lookup.get(day.isoformat(), 0),
            })
        max_trend = max((item["views"] for item in trend), default=1) or 1
        period_visits = visit_totals["period_visits"] or 0
        conversion_rate = (
            round((conversion_totals["converting_visits"] or 0) / period_visits * 100, 1)
            if period_visits else 0
        )
        pages_per_visit = (
            round((totals["period_views"] or 0) / period_visits, 1)
            if period_visits else 0
        )
        average_seconds = int(round(engagement_totals["average_seconds"] or 0))
        average_visit_duration = (
            f"{average_seconds // 3600}h {(average_seconds % 3600) // 60}m"
            if average_seconds >= 3600
            else f"{average_seconds // 60}m {average_seconds % 60}s"
            if average_seconds >= 60
            else f"{average_seconds}s"
        )
        bounce_rate = (
            round(
                (engagement_totals["bounced_visits"] or 0)
                / engagement_totals["total_visits"]
                * 100,
                1,
            )
            if engagement_totals["total_visits"] else 0
        )
        event_summary = [
            {
                "label": EVENT_LABELS.get(row["event_name"], row["event_name"].replace("_", " ").title()),
                "events": row["events"],
                "visits": row["visits"],
            }
            for row in event_rows
        ]
        funnel = [
            {"label": "Website visits", "value": period_visits},
            {"label": "Product-viewing visits", "value": funnel_rows["product_views"] or 0},
            {"label": "Inquiry-form visits", "value": funnel_rows["inquiry_opens"] or 0},
            {"label": "Lead-submitting visits", "value": funnel_rows["lead_submits"] or 0},
            {"label": "Job-application visits", "value": funnel_rows["job_applications"] or 0},
        ]
        return render_template(
            "analytics_dashboard.html",
            totals=totals,
            visit_totals=visit_totals,
            conversion_totals=conversion_totals,
            conversion_rate=conversion_rate,
            pages_per_visit=pages_per_visit,
            average_visit_duration=average_visit_duration,
            bounce_rate=bounce_rate,
            event_summary=event_summary,
            funnel=funnel,
            top_pages=top_pages,
            devices=devices,
            browsers=browsers,
            referrers=referrers,
            trend=trend,
            max_trend=max_trend,
            generated_at=now,
        )

    @app.route("/analytics/logout", methods=["POST"])
    @authenticated
    def analytics_logout():
        csrf = request.form.get("csrf_token", "")
        if not csrf or not secrets.compare_digest(csrf, session.get("csrf_token", "")):
            abort(400)
        session.pop("analytics_authenticated", None)
        return redirect(url_for("analytics_login"))
