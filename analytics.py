import csv
import hashlib
import ipaddress
import io
import os
import re
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from functools import wraps
from time import time
from urllib.parse import urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import requests
from flask import Response, abort, jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash


KNOWN_BOT_PATTERN = re.compile(
    r"googlebot|bingbot|bingpreview|duckduckbot|yandexbot|baiduspider|"
    r"slurp|facebookexternalhit|twitterbot|linkedinbot|applebot|uptimerobot",
    re.IGNORECASE,
)
AUTOMATION_PATTERN = re.compile(
    r"bot|crawler|spider|headless|lighthouse|curl/|wget/|python-requests|"
    r"python-urllib|go-http-client|httpclient|postmanruntime|scrapy|selenium|playwright",
    re.IGNORECASE,
)
BOT_PATTERN = re.compile(
    rf"(?:{KNOWN_BOT_PATTERN.pattern})|(?:{AUTOMATION_PATTERN.pattern})",
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
    "application_start",
    "chat_open",
    "contact_open",
    "inquiry_open",
    "job_view",
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
    "/api/support-chat/create": ("support_concern_created", ""),
}
EVENT_LABELS = {
    "application_start": "Job application started",
    "chat_open": "Chat opened",
    "contact_open": "Contact form opened",
    "contact_submit": "Contact form submitted",
    "inquiry_open": "Product inquiry opened",
    "job_view": "Job viewed",
    "job_application_submit": "Job application submitted",
    "product_inquiry_submit": "Product inquiry submitted",
    "product_view": "Product viewed",
    "support_concern_created": "Support concern created",
    "view_jobs": "Jobs page opened",
}
PUBLIC_PAGE_ENDPOINTS = {
    "home",
    "products",
    "products_plastic",
    "products_styro",
    "view_jobs",
    "apply_now",
    "announcements",
}
REPORTABLE_PATHS = (
    "/",
    "/products",
    "/products_plastic",
    "/products_styro",
    "/view_jobs",
    "/apply_now.html",
    "/announcements",
)
CANONICAL_PATH_ALIASES = {
    "/plastic-products": "/products_plastic",
    "/plastic-products/": "/products_plastic",
    "/products-plastic": "/products_plastic",
    "/styro-products": "/products_styro",
    "/styro-products/": "/products_styro",
    "/products-styro": "/products_styro",
    "/view_jobs/": "/view_jobs",
    "/apply_now": "/apply_now.html",
}
COUNTRY_HEADERS = (
    "CF-IPCountry",
    "CloudFront-Viewer-Country",
    "X-Vercel-IP-Country",
    "X-Country-Code",
)
COUNTRY_CODE_PATTERN = re.compile(r"^[A-Z]{2}$")
SECURITY_PATH_PATTERN = re.compile(
    r"(?:^|/)(?:"
    r"\.env(?:\.|/|$)|\.git(?:/|$)|\.aws(?:/|$)|"
    r"wp-admin(?:/|$)|wp-login\.php$|xmlrpc\.php$|wp-content(?:/|$)|"
    r"phpmyadmin(?:/|$)|pma(?:/|$)|vendor/phpunit(?:/|$)|"
    r"cgi-bin(?:/|$)|server-status$|actuator(?:/|$)|"
    r"boaform(?:/|$)|HNAP1(?:/|$)|autodiscover/autodiscover\.xml$|"
    r"[^\s/]+\.php$"
    r")",
    re.IGNORECASE,
)
SECURITY_TRACKING_EXCLUSIONS = (
    "/static/",
    "/files/",
    "/private/",
    "/api/analytics/",
)


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

    def bounded_setting(name, default, minimum, maximum):
        try:
            value = int(os.getenv(name, str(default)))
        except (TypeError, ValueError):
            value = default
        return min(maximum, max(minimum, value))

    login_max_attempts = bounded_setting("ANALYTICS_LOGIN_MAX_ATTEMPTS", 5, 3, 20)
    login_window_seconds = bounded_setting("ANALYTICS_LOGIN_WINDOW_SECONDS", 900, 60, 86400)
    login_lock_seconds = bounded_setting("ANALYTICS_LOGIN_LOCK_SECONDS", 900, 60, 86400)
    retention_days = bounded_setting("ANALYTICS_RETENTION_DAYS", 365, 30, 3650)
    security_spike_threshold = bounded_setting(
        "ANALYTICS_SECURITY_SPIKE_THRESHOLD", 30, 5, 10000
    )
    internal_networks = []
    for configured_network in os.getenv("ANALYTICS_INTERNAL_IPS", "").split(","):
        configured_network = configured_network.strip()
        if not configured_network:
            continue
        try:
            internal_networks.append(ipaddress.ip_network(configured_network, strict=False))
        except ValueError:
            app.logger.warning("Ignoring invalid ANALYTICS_INTERNAL_IPS value: %s", configured_network)

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
                browser TEXT NOT NULL,
                is_valid INTEGER NOT NULL DEFAULT 1
            )
            """
        )
        page_view_columns = {
            row["name"] for row in database.execute("PRAGMA table_info(page_views)").fetchall()
        }
        if "is_valid" not in page_view_columns:
            database.execute(
                "ALTER TABLE page_views ADD COLUMN is_valid INTEGER NOT NULL DEFAULT 1"
            )
        for alias, canonical in CANONICAL_PATH_ALIASES.items():
            database.execute(
                "UPDATE page_views SET path = ? WHERE path = ?",
                (canonical, alias),
            )
        reportable_placeholders = ", ".join("?" for _ in REPORTABLE_PATHS)
        database.execute(
            f"""
            UPDATE page_views
            SET is_valid = CASE WHEN path IN ({reportable_placeholders}) THEN 1 ELSE 0 END
            """,
            REPORTABLE_PATHS,
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
                engaged_seconds INTEGER NOT NULL DEFAULT 0,
                country_code TEXT NOT NULL DEFAULT '',
                is_valid INTEGER NOT NULL DEFAULT 1
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
        if "country_code" not in visit_columns:
            database.execute(
                "ALTER TABLE visits ADD COLUMN country_code TEXT NOT NULL DEFAULT ''"
            )
        if "is_valid" not in visit_columns:
            database.execute(
                "ALTER TABLE visits ADD COLUMN is_valid INTEGER NOT NULL DEFAULT 1"
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
        database.execute(
            """
            CREATE TABLE IF NOT EXISTS security_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                minute_bucket TEXT NOT NULL,
                observed_at TEXT NOT NULL,
                path TEXT NOT NULL,
                method TEXT NOT NULL,
                status_code INTEGER NOT NULL,
                actor_hash TEXT NOT NULL,
                country_code TEXT NOT NULL DEFAULT '',
                actor_type TEXT NOT NULL DEFAULT '',
                severity TEXT NOT NULL DEFAULT 'info',
                reason TEXT NOT NULL DEFAULT '',
                bot_requests INTEGER NOT NULL DEFAULT 0,
                known_bot_requests INTEGER NOT NULL DEFAULT 0,
                suspected_bot_requests INTEGER NOT NULL DEFAULT 0,
                suspicious_requests INTEGER NOT NULL DEFAULT 0,
                blocked_requests INTEGER NOT NULL DEFAULT 0,
                rate_limited_requests INTEGER NOT NULL DEFAULT 0,
                request_count INTEGER NOT NULL DEFAULT 1,
                UNIQUE(minute_bucket, path, method, status_code, actor_hash)
            )
            """
        )
        security_columns = {
            row["name"] for row in database.execute("PRAGMA table_info(security_requests)").fetchall()
        }
        security_column_migrations = {
            "actor_type": "TEXT NOT NULL DEFAULT ''",
            "severity": "TEXT NOT NULL DEFAULT 'info'",
            "reason": "TEXT NOT NULL DEFAULT ''",
            "known_bot_requests": "INTEGER NOT NULL DEFAULT 0",
            "suspected_bot_requests": "INTEGER NOT NULL DEFAULT 0",
        }
        for column, declaration in security_column_migrations.items():
            if column not in security_columns:
                database.execute(
                    f"ALTER TABLE security_requests ADD COLUMN {column} {declaration}"
                )
        database.execute(
            """
            UPDATE security_requests
            SET known_bot_requests = bot_requests,
                actor_type = CASE WHEN bot_requests > 0 THEN 'known_bot' ELSE actor_type END
            WHERE bot_requests > 0
              AND known_bot_requests = 0
              AND suspected_bot_requests = 0
            """
        )
        database.execute(
            "CREATE INDEX IF NOT EXISTS idx_security_observed ON security_requests(observed_at)"
        )
        database.execute(
            "CREATE INDEX IF NOT EXISTS idx_security_path ON security_requests(path)"
        )
        database.execute(
            """
            CREATE TABLE IF NOT EXISTS analytics_login_attempts (
                actor_hash TEXT PRIMARY KEY,
                window_started INTEGER NOT NULL,
                failures INTEGER NOT NULL DEFAULT 0,
                locked_until INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        database.execute(
            """
            CREATE TABLE IF NOT EXISTS analytics_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
            """
        )
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
        database.execute(
            """
            UPDATE visits
            SET is_valid = CASE
                WHEN EXISTS (
                    SELECT 1 FROM page_views
                    WHERE page_views.session_id = visits.session_id
                      AND page_views.is_valid = 1
                )
                OR EXISTS (
                    SELECT 1 FROM analytics_events
                    WHERE analytics_events.session_id = visits.session_id
                )
                THEN 1 ELSE 0
            END
            """
        )
        retention_cutoff = (
            datetime.now(analytics_timezone) - timedelta(days=retention_days)
        ).isoformat(timespec="seconds")
        for table, timestamp_column in (
            ("page_views", "viewed_at"),
            ("visits", "started_at"),
            ("analytics_events", "occurred_at"),
            ("security_requests", "observed_at"),
        ):
            database.execute(
                f"DELETE FROM {table} WHERE {timestamp_column} < ?",
                (retention_cutoff,),
            )
        database.execute(
            """
            INSERT INTO analytics_meta (key, value) VALUES ('last_retention_cleanup', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (datetime.now(analytics_timezone).isoformat(timespec="seconds"),),
        )

    def client_ip():
        remote_address = request.remote_addr or "unknown"
        proxy_hops = app.config.get("TRUSTED_PROXY_HOPS", 0)
        if not proxy_hops:
            return remote_address

        forwarded_addresses = [
            value.strip()
            for value in request.headers.get("X-Forwarded-For", "").split(",")
            if value.strip()
        ]
        if len(forwarded_addresses) < proxy_hops:
            return remote_address

        candidate = forwarded_addresses[-proxy_hops]
        try:
            return ipaddress.ip_address(candidate).compressed
        except ValueError:
            return remote_address

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

    def classify_actor():
        if (
            request.cookies.get("analytics_internal") == "1"
            or session.get("analytics_authenticated")
        ):
            return "internal"
        try:
            address = ipaddress.ip_address(client_ip())
            if any(address in network for network in internal_networks):
                return "internal"
        except ValueError:
            pass
        if request.headers.get("DNT") == "1":
            return "privacy_opt_out"
        user_agent = request.headers.get("User-Agent", "")
        if KNOWN_BOT_PATTERN.search(user_agent):
            return "known_bot"
        if not user_agent.strip() or AUTOMATION_PATTERN.search(user_agent):
            return "suspected_bot"
        return "human"

    def actor_is_excluded():
        return classify_actor() != "human"

    def clean_label(value):
        value = re.sub(r"[\x00-\x1f\x7f]+", " ", str(value or ""))
        return re.sub(r"\s+", " ", value).strip()[:120]

    def clean_path(value):
        value = str(value or "").split("?", 1)[0].split("#", 1)[0]
        if not value.startswith("/") or value.startswith("//"):
            return "/"
        value = re.sub(r"/{2,}", "/", value)[:300]
        value = CANONICAL_PATH_ALIASES.get(value, value)
        if value != "/" and value.endswith("/"):
            value = value.rstrip("/")
        return value or "/"

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
            session.pop("_analytics_country", None)
            session.pop("_analytics_country_checked", None)
        session["_analytics_last_seen"] = current_timestamp
        return visitor_hash, analytics_session

    def record_visit(database, visitor_hash, analytics_session, occurred_at, path):
        user_agent = request.headers.get("User-Agent", "")
        device, browser = classify_user_agent(user_agent)
        country_code = session.get("_analytics_country", "")
        database.execute(
            """
            INSERT INTO visits
            (session_id, visitor_hash, started_at, last_seen_at, entry_path, referrer_domain,
             device, browser, country_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                last_seen_at = excluded.last_seen_at,
                is_valid = 1,
                country_code = CASE
                    WHEN visits.country_code = '' THEN excluded.country_code
                    ELSE visits.country_code
                END
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
                country_code,
            ),
        )

    def valid_country_code(value):
        code = str(value or "").strip().upper()
        return code if COUNTRY_CODE_PATTERN.fullmatch(code) and code not in {"T1", "XX"} else ""

    def resolve_country_code():
        for header in COUNTRY_HEADERS:
            code = valid_country_code(request.headers.get(header))
            if code:
                return code

        lookup_url = os.getenv(
            "ANALYTICS_COUNTRY_LOOKUP_URL",
            "https://api.country.is/{ip}",
        ).strip()
        if not lookup_url:
            return ""
        try:
            address = ipaddress.ip_address(client_ip())
            if not address.is_global:
                return ""
            response = requests.get(
                lookup_url.format(ip=address.compressed),
                timeout=2,
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            payload = response.json()
            return valid_country_code(payload.get("country") if isinstance(payload, dict) else "")
        except (ValueError, KeyError, requests.RequestException):
            return ""

    def trusted_country_code():
        for header in COUNTRY_HEADERS:
            code = valid_country_code(request.headers.get(header))
            if code:
                return code
        return ""

    def security_actor_hash():
        salt = os.getenv("ANALYTICS_HASH_SALT") or str(app.config["SECRET_KEY"])
        user_agent = request.headers.get("User-Agent", "")
        return hashlib.sha256(
            f"security|{salt}|{client_ip()}|{user_agent}".encode()
        ).hexdigest()

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
        if not request.endpoint or request.endpoint not in PUBLIC_PAGE_ENDPOINTS:
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
                canonical_path = clean_path(request.path)
                record_visit(database, visitor_hash, analytics_session, occurred_at, canonical_path)
                database.execute(
                    """
                    INSERT INTO page_views
                    (viewed_at, path, visitor_hash, session_id, referrer_domain, device, browser)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        occurred_at,
                        canonical_path,
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
        if response.status_code < 200 or response.status_code >= 300:
            return False
        payload = response.get_json(silent=True)
        return not isinstance(payload, dict) or not (
            payload.get("error")
            or payload.get("exc")
            or payload.get("exception")
            or payload.get("_server_messages") and not payload.get("message")
        )

    def request_value(field):
        if not field:
            return ""
        if request.form:
            return request.form.get(field, "")
        payload = request.get_json(silent=True)
        return payload.get(field, "") if isinstance(payload, dict) else ""

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
                label = request_value(label_field)
                source_path = request.referrer and urlparse(request.referrer).path or "/"
                record_event(event_name, source_path, label)
            except Exception:
                app.logger.exception("Unable to record analytics conversion")
        return response

    @app.after_request
    def protect_analytics_responses(response):
        if request.path.startswith("/analytics"):
            response.headers["Cache-Control"] = "no-store, private"
            response.headers["Pragma"] = "no-cache"
        return response

    @app.after_request
    def record_security_signal(response):
        if any(request.path.startswith(prefix) for prefix in SECURITY_TRACKING_EXCLUSIONS):
            return response

        actor_type = classify_actor()
        is_known_bot = actor_type == "known_bot"
        is_suspected_bot = actor_type == "suspected_bot"
        is_bot = is_known_bot or is_suspected_bot
        is_suspicious_path = bool(SECURITY_PATH_PATTERN.search(request.path))
        is_rate_limited = response.status_code == 429
        is_blocked = response.status_code in {401, 403}
        if not (is_bot or is_suspicious_path or is_rate_limited or is_blocked):
            return response

        try:
            observed_at = datetime.now(analytics_timezone).isoformat(timespec="seconds")
            minute_bucket = observed_at[:16]
            reasons = []
            if is_rate_limited:
                reasons.append("Rate limit exceeded")
            if is_blocked:
                reasons.append(f"Access rejected with HTTP {response.status_code}")
            if is_suspicious_path:
                reasons.append("Common scanner target requested")
            if is_known_bot:
                reasons.append("Recognized crawler user agent")
            if is_suspected_bot:
                reasons.append("Automated or missing user agent")
            severity = (
                "critical"
                if is_rate_limited or (is_suspicious_path and is_blocked)
                else "warning"
                if is_suspicious_path or is_blocked or is_suspected_bot
                else "info"
            )
            with connect() as database:
                database.execute(
                    """
                    INSERT INTO security_requests
                    (minute_bucket, observed_at, path, method, status_code, actor_hash,
                     country_code, actor_type, severity, reason, bot_requests,
                     known_bot_requests, suspected_bot_requests, suspicious_requests,
                     blocked_requests, rate_limited_requests, request_count)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                    ON CONFLICT(minute_bucket, path, method, status_code, actor_hash)
                    DO UPDATE SET
                        observed_at = excluded.observed_at,
                        country_code = CASE
                            WHEN security_requests.country_code = '' THEN excluded.country_code
                            ELSE security_requests.country_code
                        END,
                        actor_type = excluded.actor_type,
                        severity = CASE
                            WHEN security_requests.severity = 'critical'
                              OR excluded.severity = 'critical' THEN 'critical'
                            WHEN security_requests.severity = 'warning'
                              OR excluded.severity = 'warning' THEN 'warning'
                            ELSE 'info'
                        END,
                        reason = excluded.reason,
                        bot_requests = security_requests.bot_requests + excluded.bot_requests,
                        known_bot_requests = security_requests.known_bot_requests + excluded.known_bot_requests,
                        suspected_bot_requests = security_requests.suspected_bot_requests + excluded.suspected_bot_requests,
                        suspicious_requests = security_requests.suspicious_requests + excluded.suspicious_requests,
                        blocked_requests = security_requests.blocked_requests + excluded.blocked_requests,
                        rate_limited_requests = security_requests.rate_limited_requests + excluded.rate_limited_requests,
                        request_count = security_requests.request_count + 1
                    """,
                    (
                        minute_bucket,
                        observed_at,
                        clean_path(request.path),
                        request.method[:10],
                        response.status_code,
                        security_actor_hash(),
                        trusted_country_code(),
                        actor_type,
                        severity,
                        "; ".join(reasons),
                        int(is_bot),
                        int(is_known_bot),
                        int(is_suspected_bot),
                        int(is_suspicious_path),
                        int(is_blocked),
                        int(is_rate_limited),
                    ),
                )
                flagged_volume = database.execute(
                    """
                    SELECT COALESCE(SUM(request_count), 0)
                    FROM security_requests
                    WHERE minute_bucket = ? AND actor_hash = ?
                    """,
                    (minute_bucket, security_actor_hash()),
                ).fetchone()[0]
                if flagged_volume >= security_spike_threshold:
                    database.execute(
                        """
                        UPDATE security_requests
                        SET severity = 'critical',
                            reason = CASE
                                WHEN instr(reason, 'High-volume flagged traffic') > 0 THEN reason
                                WHEN reason = '' THEN 'High-volume flagged traffic'
                                ELSE reason || '; High-volume flagged traffic'
                            END
                        WHERE minute_bucket = ? AND actor_hash = ?
                        """,
                        (minute_bucket, security_actor_hash()),
                    )
        except Exception:
            app.logger.exception("Unable to record analytics security signal")
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

    @app.route("/api/analytics/country", methods=["POST"])
    def analytics_country():
        if actor_is_excluded() or session.get("_analytics_country_checked"):
            return "", 204
        try:
            _, analytics_session = analytics_identity()
            country_code = resolve_country_code()
            session["_analytics_country_checked"] = True
            if country_code:
                session["_analytics_country"] = country_code
                with connect() as database:
                    database.execute(
                        """
                        UPDATE visits SET country_code = ?
                        WHERE session_id = ? AND country_code = ''
                        """,
                        (country_code, analytics_session),
                    )
        except Exception:
            app.logger.warning("Unable to resolve analytics country")
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

    def login_lock_status(actor_hash, current_timestamp):
        with connect() as database:
            row = database.execute(
                """
                SELECT window_started, failures, locked_until
                FROM analytics_login_attempts
                WHERE actor_hash = ?
                """,
                (actor_hash,),
            ).fetchone()
        if not row:
            return False
        return row["locked_until"] > current_timestamp

    def record_login_failure(actor_hash, current_timestamp):
        with connect() as database:
            row = database.execute(
                """
                SELECT window_started, failures
                FROM analytics_login_attempts
                WHERE actor_hash = ?
                """,
                (actor_hash,),
            ).fetchone()
            if not row or current_timestamp - row["window_started"] >= login_window_seconds:
                window_started = current_timestamp
                failures = 1
            else:
                window_started = row["window_started"]
                failures = row["failures"] + 1
            locked_until = (
                current_timestamp + login_lock_seconds
                if failures >= login_max_attempts
                else 0
            )
            database.execute(
                """
                INSERT INTO analytics_login_attempts
                (actor_hash, window_started, failures, locked_until)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(actor_hash) DO UPDATE SET
                    window_started = excluded.window_started,
                    failures = excluded.failures,
                    locked_until = excluded.locked_until
                """,
                (actor_hash, window_started, failures, locked_until),
            )
        return locked_until > current_timestamp

    def clear_login_failures(actor_hash):
        with connect() as database:
            database.execute(
                "DELETE FROM analytics_login_attempts WHERE actor_hash = ?",
                (actor_hash,),
            )

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
        response_status = 200
        if request.method == "POST":
            csrf = request.form.get("csrf_token", "")
            expected = session.get("csrf_token", "")
            username = request.form.get("username", "").strip()
            expected_username = os.getenv("ANALYTICS_ADMIN_USERNAME", "admin")
            if not csrf or not secrets.compare_digest(csrf, expected):
                abort(400)

            actor_hash = security_actor_hash()
            current_timestamp = int(time())
            if login_lock_status(actor_hash, current_timestamp):
                error = "Too many sign-in attempts. Please wait before trying again."
                response_status = 429
            else:
                username_valid = secrets.compare_digest(username, expected_username)
                password_valid = verify_password(request.form.get("password", ""))
                if username_valid and password_valid:
                    clear_login_failures(actor_hash)
                    csrf_token = session.get("csrf_token") or secrets.token_urlsafe(32)
                    session.clear()
                    session["csrf_token"] = csrf_token
                    session["analytics_authenticated"] = True
                    session.permanent = False
                    response = redirect(url_for("analytics_dashboard"))
                    response.set_cookie(
                        "analytics_internal",
                        "1",
                        max_age=315360000,
                        secure=bool(app.config.get("SESSION_COOKIE_SECURE")),
                        httponly=True,
                        samesite="Lax",
                    )
                    return response

                newly_locked = record_login_failure(actor_hash, current_timestamp)
                error = (
                    "Too many sign-in attempts. Please wait before trying again."
                    if newly_locked
                    else "Invalid analytics username or password."
                )
                response_status = 429 if newly_locked else 200
        return render_template(
            "analytics_login.html",
            error=error,
            configured=credentials_configured(),
        ), response_status

    def report_window():
        today = datetime.now(analytics_timezone).date()
        preset = request.args.get("range", "30").strip().lower()
        labels = {
            "1": "Today",
            "7": "Last 7 days",
            "30": "Last 30 days",
            "90": "Last 90 days",
            "month": "This month",
            "custom": "Custom range",
        }
        if preset == "month":
            start = today.replace(day=1)
            end = today
        elif preset == "custom":
            try:
                start = datetime.strptime(request.args.get("start", ""), "%Y-%m-%d").date()
                end = datetime.strptime(request.args.get("end", ""), "%Y-%m-%d").date()
            except ValueError:
                preset = "30"
                start = today - timedelta(days=29)
                end = today
            if start > end:
                start, end = end, start
            if end > today:
                end = today
            if (end - start).days > 365:
                start = end - timedelta(days=365)
        else:
            if preset not in {"1", "7", "30", "90"}:
                preset = "30"
            days = int(preset)
            end = today
            start = today - timedelta(days=days - 1)

        day_count = (end - start).days + 1
        previous_end = start - timedelta(days=1)
        previous_start = previous_end - timedelta(days=day_count - 1)
        return {
            "preset": preset,
            "label": labels[preset],
            "start": start,
            "end": end,
            "previous_start": previous_start,
            "previous_end": previous_end,
            "days": day_count,
        }

    def comparison(current, previous):
        current = current or 0
        previous = previous or 0
        if previous == 0:
            return {
                "value": None if current else 0,
                "direction": "up" if current else "same",
                "label": "New" if current else "No change",
            }
        change = round((current - previous) / previous * 100, 1)
        return {
            "value": abs(change),
            "direction": "up" if change > 0 else "down" if change < 0 else "same",
            "label": f"{abs(change):g}% {'increase' if change > 0 else 'decrease' if change < 0 else 'change'}",
        }

    @app.route("/analytics")
    @authenticated
    def analytics_dashboard():
        now = datetime.now(analytics_timezone)
        today = now.date().isoformat()
        window = report_window()
        period_start = window["start"].isoformat()
        period_end = window["end"].isoformat()
        previous_start = window["previous_start"].isoformat()
        previous_end = window["previous_end"].isoformat()
        trend_start = window["start"]

        with connect() as database:
            totals = database.execute(
                """
                SELECT
                    COUNT(*) AS all_views,
                    COUNT(DISTINCT visitor_hash) AS all_visitors,
                    SUM(CASE WHEN substr(viewed_at, 1, 10) = ? THEN 1 ELSE 0 END) AS today_views,
                    COUNT(DISTINCT CASE WHEN substr(viewed_at, 1, 10) = ? THEN visitor_hash END) AS today_visitors,
                    SUM(CASE WHEN substr(viewed_at, 1, 10) BETWEEN ? AND ? THEN 1 ELSE 0 END) AS period_views,
                    COUNT(DISTINCT CASE WHEN substr(viewed_at, 1, 10) BETWEEN ? AND ? THEN visitor_hash END) AS period_visitors
                FROM page_views
                WHERE is_valid = 1
                """,
                (today, today, period_start, period_end, period_start, period_end),
            ).fetchone()
            visit_totals = database.execute(
                """
                SELECT
                    COUNT(*) AS all_visits,
                    SUM(CASE WHEN substr(started_at, 1, 10) = ? THEN 1 ELSE 0 END) AS today_visits,
                    SUM(CASE WHEN substr(started_at, 1, 10) BETWEEN ? AND ? THEN 1 ELSE 0 END) AS period_visits
                FROM visits
                WHERE is_valid = 1
                """,
                (today, period_start, period_end),
            ).fetchone()
            previous_totals = database.execute(
                """
                SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors
                FROM page_views
                WHERE is_valid = 1
                  AND substr(viewed_at, 1, 10) BETWEEN ? AND ?
                """,
                (previous_start, previous_end),
            ).fetchone()
            previous_visits = database.execute(
                """
                SELECT COUNT(*) AS visits FROM visits
                WHERE is_valid = 1
                  AND substr(started_at, 1, 10) BETWEEN ? AND ?
                """,
                (previous_start, previous_end),
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
                    FROM page_views WHERE is_valid = 1 GROUP BY session_id
                ) p ON p.session_id = v.session_id
                LEFT JOIN (
                    SELECT session_id, COUNT(*) AS event_count
                    FROM analytics_events GROUP BY session_id
                ) e ON e.session_id = v.session_id
                WHERE v.is_valid = 1
                  AND substr(v.started_at, 1, 10) BETWEEN ? AND ?
                """,
                (period_start, period_end),
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
                WHERE substr(occurred_at, 1, 10) BETWEEN ? AND ?
                  AND event_name IN ('contact_submit', 'product_inquiry_submit', 'job_application_submit')
                """,
                (period_start, period_end),
            ).fetchone()
            previous_conversions = database.execute(
                """
                SELECT COUNT(*) AS conversions, COUNT(DISTINCT session_id) AS converting_visits
                FROM analytics_events
                WHERE substr(occurred_at, 1, 10) BETWEEN ? AND ?
                  AND event_name IN ('contact_submit', 'product_inquiry_submit', 'job_application_submit')
                """,
                (previous_start, previous_end),
            ).fetchone()
            event_rows = database.execute(
                """
                SELECT event_name, COUNT(*) AS events, COUNT(DISTINCT session_id) AS visits
                FROM analytics_events
                WHERE substr(occurred_at, 1, 10) BETWEEN ? AND ?
                GROUP BY event_name ORDER BY events DESC
                """,
                (period_start, period_end),
            ).fetchall()
            funnel_rows = database.execute(
                """
                SELECT
                    COUNT(DISTINCT CASE WHEN event_name = 'product_view' THEN session_id END) AS product_views,
                    COUNT(DISTINCT CASE WHEN event_name = 'inquiry_open' THEN session_id END) AS inquiry_opens,
                    COUNT(DISTINCT CASE WHEN event_name IN ('contact_submit', 'product_inquiry_submit') THEN session_id END) AS lead_submits,
                    COUNT(DISTINCT CASE WHEN event_name = 'job_view' THEN session_id END) AS job_views,
                    COUNT(DISTINCT CASE WHEN event_name = 'application_start' THEN session_id END) AS application_starts,
                    COUNT(DISTINCT CASE WHEN event_name = 'job_application_submit' THEN session_id END) AS job_applications
                FROM analytics_events WHERE substr(occurred_at, 1, 10) BETWEEN ? AND ?
                """,
                (period_start, period_end),
            ).fetchone()
            top_pages = database.execute(
                """
                SELECT path, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors
                FROM page_views
                WHERE is_valid = 1
                  AND substr(viewed_at, 1, 10) BETWEEN ? AND ?
                GROUP BY path ORDER BY views DESC LIMIT 10
                """,
                (period_start, period_end),
            ).fetchall()
            devices = database.execute(
                """
                SELECT device AS label, COUNT(DISTINCT visitor_hash) AS value FROM page_views
                WHERE is_valid = 1
                  AND substr(viewed_at, 1, 10) BETWEEN ? AND ? GROUP BY device ORDER BY value DESC
                """,
                (period_start, period_end),
            ).fetchall()
            browsers = database.execute(
                """
                SELECT browser AS label, COUNT(DISTINCT visitor_hash) AS value FROM page_views
                WHERE is_valid = 1
                  AND substr(viewed_at, 1, 10) BETWEEN ? AND ? GROUP BY browser ORDER BY value DESC
                """,
                (period_start, period_end),
            ).fetchall()
            referrers = database.execute(
                """
                SELECT CASE WHEN referrer_domain = '' THEN 'Direct / internal' ELSE referrer_domain END AS label,
                       COUNT(*) AS value
                FROM page_views
                WHERE is_valid = 1
                  AND substr(viewed_at, 1, 10) BETWEEN ? AND ?
                GROUP BY referrer_domain ORDER BY value DESC LIMIT 8
                """,
                (period_start, period_end),
            ).fetchall()
            country_rows = database.execute(
                """
                SELECT country_code, COUNT(*) AS visits,
                       COUNT(DISTINCT visitor_hash) AS visitors
                FROM visits
                WHERE is_valid = 1
                  AND substr(started_at, 1, 10) BETWEEN ? AND ?
                GROUP BY country_code
                ORDER BY visits DESC, country_code
                """,
                (period_start, period_end),
            ).fetchall()
            security_totals = database.execute(
                """
                SELECT
                    COALESCE(SUM(request_count), 0) AS requests,
                    COUNT(DISTINCT actor_hash) AS sources,
                    COALESCE(SUM(bot_requests), 0) AS bots,
                    COALESCE(SUM(known_bot_requests), 0) AS known_bots,
                    COALESCE(SUM(suspected_bot_requests), 0) AS suspected_bots,
                    COALESCE(SUM(suspicious_requests), 0) AS suspicious_paths,
                    COALESCE(SUM(blocked_requests), 0) AS blocked,
                    COALESCE(SUM(rate_limited_requests), 0) AS rate_limited,
                    COALESCE(SUM(CASE WHEN severity = 'critical' THEN request_count ELSE 0 END), 0) AS critical,
                    COALESCE(SUM(CASE WHEN severity = 'warning' THEN request_count ELSE 0 END), 0) AS warnings
                FROM security_requests
                WHERE substr(observed_at, 1, 10) BETWEEN ? AND ?
                """,
                (period_start, period_end),
            ).fetchone()
            security_paths = database.execute(
                """
                SELECT path, SUM(request_count) AS requests,
                       COUNT(DISTINCT actor_hash) AS sources,
                       MAX(observed_at) AS last_seen
                FROM security_requests
                WHERE substr(observed_at, 1, 10) BETWEEN ? AND ?
                GROUP BY path
                ORDER BY requests DESC, last_seen DESC
                LIMIT 10
                """,
                (period_start, period_end),
            ).fetchall()
            security_countries = database.execute(
                """
                SELECT country_code, SUM(request_count) AS requests
                FROM security_requests
                WHERE substr(observed_at, 1, 10) BETWEEN ? AND ?
                GROUP BY country_code
                ORDER BY requests DESC, country_code
                LIMIT 10
                """,
                (period_start, period_end),
            ).fetchall()
            recent_security = database.execute(
                """
                SELECT observed_at, path, method, status_code, request_count,
                       actor_type, severity, reason,
                       bot_requests, suspicious_requests, blocked_requests,
                       rate_limited_requests
                FROM security_requests
                WHERE substr(observed_at, 1, 10) BETWEEN ? AND ?
                ORDER BY observed_at DESC
                LIMIT 12
                """,
                (period_start, period_end),
            ).fetchall()
            trend_rows = database.execute(
                """
                SELECT substr(viewed_at, 1, 10) AS day, COUNT(*) AS views,
                       COUNT(DISTINCT visitor_hash) AS visitors
                FROM page_views
                WHERE is_valid = 1
                  AND substr(viewed_at, 1, 10) BETWEEN ? AND ?
                GROUP BY day ORDER BY day
                """,
                (period_start, period_end),
            ).fetchall()
            visit_trend_rows = database.execute(
                """
                SELECT substr(started_at, 1, 10) AS day, COUNT(*) AS visits
                FROM visits
                WHERE is_valid = 1
                  AND substr(started_at, 1, 10) BETWEEN ? AND ?
                GROUP BY day ORDER BY day
                """,
                (period_start, period_end),
            ).fetchall()

        trend_lookup = {row["day"]: row for row in trend_rows}
        visit_trend_lookup = {row["day"]: row["visits"] for row in visit_trend_rows}
        trend = []
        for offset in range(window["days"]):
            day = trend_start + timedelta(days=offset)
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
            {"label": "Job-viewing visits", "value": funnel_rows["job_views"] or 0},
            {"label": "Application-starting visits", "value": funnel_rows["application_starts"] or 0},
            {"label": "Job-application visits", "value": funnel_rows["job_applications"] or 0},
        ]
        comparisons = {
            "views": comparison(totals["period_views"], previous_totals["views"]),
            "visits": comparison(period_visits, previous_visits["visits"]),
            "visitors": comparison(totals["period_visitors"], previous_totals["visitors"]),
            "conversions": comparison(
                conversion_totals["conversions"],
                previous_conversions["conversions"],
            ),
        }
        countries = [
            {
                "code": row["country_code"] or "",
                "visits": row["visits"],
                "visitors": row["visitors"],
                "share": round(row["visits"] / period_visits * 100, 1) if period_visits else 0,
            }
            for row in country_rows
        ]
        recent_security_signals = []
        for row in recent_security:
            labels = []
            if row["rate_limited_requests"]:
                labels.append("Rate limited")
            if row["blocked_requests"]:
                labels.append("Blocked")
            if row["suspicious_requests"]:
                labels.append("Suspicious path")
            if row["actor_type"] == "known_bot":
                labels.append("Known bot")
            elif row["actor_type"] == "suspected_bot":
                labels.append("Suspected automation")
            recent_security_signals.append(
                {
                    "observed_at": datetime.fromisoformat(row["observed_at"]),
                    "path": row["path"],
                    "method": row["method"],
                    "status_code": row["status_code"],
                    "requests": row["request_count"],
                    "severity": row["severity"] or "info",
                    "reason": row["reason"] or "Automated security rule matched",
                    "actor_type": row["actor_type"] or "",
                    "signal": " / ".join(labels),
                }
            )
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
            countries=countries,
            security_totals=security_totals,
            security_paths=security_paths,
            security_countries=security_countries,
            recent_security=recent_security_signals,
            trend=trend,
            max_trend=max_trend,
            report_window=window,
            comparisons=comparisons,
            retention_days=retention_days,
            generated_at=now,
        )

    @app.route("/analytics/export.csv")
    @authenticated
    def analytics_export_csv():
        window = report_window()
        period_start = window["start"].isoformat()
        period_end = window["end"].isoformat()
        with connect() as database:
            summary = database.execute(
                """
                SELECT
                    (SELECT COUNT(*) FROM page_views
                     WHERE is_valid = 1
                       AND substr(viewed_at, 1, 10) BETWEEN ? AND ?) AS views,
                    (SELECT COUNT(DISTINCT visitor_hash) FROM page_views
                     WHERE is_valid = 1
                       AND substr(viewed_at, 1, 10) BETWEEN ? AND ?) AS visitors,
                    (SELECT COUNT(*) FROM visits
                     WHERE is_valid = 1
                       AND substr(started_at, 1, 10) BETWEEN ? AND ?) AS visits,
                    (SELECT COUNT(*) FROM analytics_events
                     WHERE substr(occurred_at, 1, 10) BETWEEN ? AND ?
                       AND event_name IN ('contact_submit', 'product_inquiry_submit',
                                          'job_application_submit')) AS conversions
                """,
                (
                    period_start, period_end,
                    period_start, period_end,
                    period_start, period_end,
                    period_start, period_end,
                ),
            ).fetchone()
            pages = database.execute(
                """
                SELECT path, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors
                FROM page_views
                WHERE is_valid = 1
                  AND substr(viewed_at, 1, 10) BETWEEN ? AND ?
                GROUP BY path ORDER BY views DESC
                """,
                (period_start, period_end),
            ).fetchall()
            events = database.execute(
                """
                SELECT event_name, COUNT(*) AS events, COUNT(DISTINCT session_id) AS visits
                FROM analytics_events
                WHERE substr(occurred_at, 1, 10) BETWEEN ? AND ?
                GROUP BY event_name ORDER BY events DESC
                """,
                (period_start, period_end),
            ).fetchall()
            countries = database.execute(
                """
                SELECT country_code, COUNT(*) AS visits,
                       COUNT(DISTINCT visitor_hash) AS visitors
                FROM visits
                WHERE is_valid = 1
                  AND substr(started_at, 1, 10) BETWEEN ? AND ?
                GROUP BY country_code ORDER BY visits DESC
                """,
                (period_start, period_end),
            ).fetchall()
            security = database.execute(
                """
                SELECT severity, path, SUM(request_count) AS requests,
                       COUNT(DISTINCT actor_hash) AS sources, MAX(reason) AS reason
                FROM security_requests
                WHERE substr(observed_at, 1, 10) BETWEEN ? AND ?
                GROUP BY severity, path ORDER BY requests DESC
                """,
                (period_start, period_end),
            ).fetchall()

        def safe_cell(value):
            text = str(value if value is not None else "")
            return f"'{text}" if text.startswith(("=", "+", "-", "@")) else text

        output = io.StringIO(newline="")
        writer = csv.writer(output)
        writer.writerow(["QC & MC Website Analytics"])
        writer.writerow(["Report period", period_start, period_end])
        writer.writerow([])
        writer.writerow(["SUMMARY", "VALUE"])
        for label, value in (
            ("Views", summary["views"]),
            ("Visits", summary["visits"]),
            ("Unique visitors", summary["visitors"]),
            ("Verified conversions", summary["conversions"]),
        ):
            writer.writerow([label, value or 0])
        writer.writerow([])
        writer.writerow(["TOP PAGES", "VIEWS", "UNIQUE VISITORS"])
        for row in pages:
            writer.writerow([safe_cell(row["path"]), row["views"], row["visitors"]])
        writer.writerow([])
        writer.writerow(["ACTIONS", "EVENTS", "VISITS"])
        for row in events:
            writer.writerow([
                safe_cell(EVENT_LABELS.get(row["event_name"], row["event_name"])),
                row["events"],
                row["visits"],
            ])
        writer.writerow([])
        writer.writerow(["COUNTRIES", "VISITS", "UNIQUE VISITORS"])
        for row in countries:
            writer.writerow([row["country_code"] or "Unknown", row["visits"], row["visitors"]])
        writer.writerow([])
        writer.writerow(["SECURITY", "PATH", "REQUESTS", "SOURCES", "REASON"])
        for row in security:
            writer.writerow([
                row["severity"].title(),
                safe_cell(row["path"]),
                row["requests"],
                row["sources"],
                safe_cell(row["reason"]),
            ])

        filename = f"qcmc-analytics-{period_start}-to-{period_end}.csv"
        return Response(
            "\ufeff" + output.getvalue(),
            mimetype="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "X-Content-Type-Options": "nosniff",
            },
        )

    @app.route("/analytics/logout", methods=["POST"])
    @authenticated
    def analytics_logout():
        csrf = request.form.get("csrf_token", "")
        if not csrf or not secrets.compare_digest(csrf, session.get("csrf_token", "")):
            abort(400)
        session.pop("analytics_authenticated", None)
        return redirect(url_for("analytics_login"))
