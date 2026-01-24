from dotenv import load_dotenv
import os
import json
import re
import secrets
from time import time
from datetime import date
from urllib.parse import urlparse
from collections import deque
from html import unescape
from flask import Flask, render_template, request, jsonify, Response, url_for as flask_url_for, session as flask_session, g
import requests
from flask_caching import Cache

def load_env():
    """
    Local: load .env + .env.local
    Production (cPanel): use real environment variables only
    """
    env = os.getenv("FLASK_ENV", "").lower()

    # If running in production (cPanel), do NOT load dotenv
    if env == "production":
        return

    try:
        from dotenv import load_dotenv
        load_dotenv(".env")
        if os.path.exists(".env.local"):
            load_dotenv(".env.local", override=True)
    except Exception:
        pass


load_env()

API_BASE_URL = os.environ.get("API_BASE_URL")
if not API_BASE_URL:
    raise RuntimeError("API_BASE_URL is not set")

# --------------------------------------------------
# APP INIT
# --------------------------------------------------
app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY") or os.getenv("FLASK_SECRET_KEY")
if not app.config["SECRET_KEY"]:
    app.logger.warning("SECRET_KEY not set; using ephemeral key")
    app.config["SECRET_KEY"] = secrets.token_urlsafe(32)
ASSET_VERSION = os.getenv("ASSET_VERSION", "1")
EVENTS_DATA_PATH = os.path.join(app.root_path, "static", "data", "events.json")
CACHE_BUST_TOKEN = os.getenv("CACHE_BUST_TOKEN", "")
CANONICAL_BASE_URL = os.getenv("CANONICAL_BASE_URL", "").rstrip("/")
HREFLANGS = [lang.strip() for lang in os.getenv("HREFLANGS", "en").split(",") if lang.strip()]

PRODUCT_CATEGORY_URLS = {
    "products_plastic": [
        "egg-tray",
        "ice-cream-cups",
        "kubyertos",
        "lids",
        "microwavable-tray",
        "pet-cups",
        "plastic-tray",
        "pp-bowl",
        "salad-trays-cover",
        "sauce-cups",
        "traditional-cups",
    ],
    "products_styro": [
        "cooler",
        "eps-psp-bowl",
        "hamburger-box",
        "hotdog-box",
        "industrial",
        "lunch-packs",
        "noodle-cup",
        "plates",
        "spaghetti-box",
        "styro-cup",
        "tray",
    ],
}


OG_IMAGE_REGEX = re.compile(
    r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE
)
OG_TITLE_REGEX = re.compile(
    r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE
)

def fetch_events_from_erpnext(limit=9):
    cache_key = f"website_events:{limit}"
    cached = cache.get(cache_key)
    if cached is not None:
        app.logger.info("Events cache hit: %s items", len(cached))
        return cached
    try:
        res = http_session.get(
            f"{API_BASE_URL}/api/method/qcmc_logic.api.website_event.get_website_events",
            params={"limit": limit},
            timeout=8
        )
        res.raise_for_status()
        payload = res.json()
        items = payload.get("message") or payload.get("data") or []
        if not isinstance(items, list):
            app.logger.warning("Events API returned non-list payload")
            return []
        app.logger.info("Events API returned %s items", len(items))
        cleaned = []
        seen = set()
        for item in items:
            if not isinstance(item, dict):
                continue
            title = (item.get("title") or item.get("event_title") or item.get("name") or "").strip()
            url = (item.get("url") or item.get("link") or "").strip()
            thumbnail = (item.get("thumbnail") or item.get("image") or item.get("image_url") or "").strip()
            if not title:
                continue
            if not url:
                url = "#"
            dedupe_key = f"{title.lower()}::{url}"
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            cleaned.append({
                "title": title,
                "url": url,
                "thumbnail": thumbnail,
                "alt": (item.get("alt") or title).strip()
            })
        cache.set(cache_key, cleaned, timeout=30)
        return cleaned
    except Exception:
        app.logger.exception("Events API fetch failed")
        cache.set(cache_key, [], timeout=30)
        return []

def clear_event_caches():
    # Clear homepage cache and event lists
    try:
        cache.delete_memoized(home)
    except Exception:
        pass
    for limit in (3, 6, 9, 12, 15):
        cache.delete(f"website_events:{limit}")

def fetch_og_meta(url):
    if not url:
        return {"image": "", "title": ""}
    cache_key = f"og_image:{url}"
    cached = cache.get(cache_key)
    if cached:
        return cached
    try:
        res = http_session.get(
            url,
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=8
        )
        if not res.ok:
            cache.set(cache_key, {"image": "", "title": ""}, timeout=300)
            return {"image": "", "title": ""}
        html = res.text or ""
        image_match = OG_IMAGE_REGEX.search(html)
        title_match = OG_TITLE_REGEX.search(html)
        image_url = unescape(image_match.group(1).strip()) if image_match else ""
        title = unescape(title_match.group(1).strip()) if title_match else ""
        payload = {"image": image_url, "title": title}
        if image_url or title:
            cache.set(cache_key, payload, timeout=3600)
        else:
            cache.set(cache_key, payload, timeout=300)
        return payload
    except Exception:
        cache.set(cache_key, {"image": "", "title": ""}, timeout=300)
        return {"image": "", "title": ""}

def load_event_posts():
    remote_events = fetch_events_from_erpnext()
    if remote_events:
        cleaned = []
        for item in remote_events:
            title = (item.get("title") or "").strip()
            url = (item.get("url") or "").strip()
            thumbnail = (item.get("thumbnail") or "").strip()
            if not (title and url):
                continue
            if ("facebook.com" in url) and (not thumbnail):
                meta = fetch_og_meta(url)
                if not thumbnail:
                    thumbnail = meta.get("image", "")
                if not title:
                    title = meta.get("title", "").strip()
            if thumbnail.startswith("/files/"):
                thumbnail = f"{API_BASE_URL.rstrip('/')}{thumbnail}"
            if not thumbnail:
                continue
            cleaned.append({
                "title": title,
                "url": url,
                "thumbnail": thumbnail,
                "alt": (item.get("alt") or title).strip()
            })
        if cleaned:
            return cleaned
    return []

def cache_busted_url_for(endpoint, **values):
    if endpoint == "static":
        values.setdefault("v", ASSET_VERSION)
    return flask_url_for(endpoint, **values)

app.jinja_env.globals["url_for"] = cache_busted_url_for

# --------------------------------------------------
# CACHE CONFIG (SAFE FOR RENDER)
# --------------------------------------------------
cache = Cache(app, config={
    "CACHE_TYPE": "simple",
    "CACHE_DEFAULT_TIMEOUT": 300
})

# Cache static files for 1 year
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 31536000

# --------------------------------------------------
# ENV LOADING
# --------------------------------------------------
if os.getenv("RENDER") is None:
    load_dotenv(".env")
    if os.path.exists(".env.local"):
        load_dotenv(".env.local", override=True)

API_BASE_URL = os.getenv("API_BASE_URL")
if not API_BASE_URL:
    raise RuntimeError("API_BASE_URL is not set")

# --------------------------------------------------
# HTTP SESSION (REUSE CONNECTIONS)
# --------------------------------------------------
http_session = requests.Session()
http_session.headers.update({
    "Accept": "application/json"
})

def get_csrf_token():
    token = flask_session.get("csrf_token")
    if not token:
        token = secrets.token_urlsafe(32)
        flask_session["csrf_token"] = token
    return token

@app.context_processor
def inject_globals():
    return dict(
        API_BASE_URL=API_BASE_URL,
        csrf_token=get_csrf_token,
        csp_nonce=getattr(g, "csp_nonce", ""),
        canonical_base_url=CANONICAL_BASE_URL
    )

def get_base_url():
    return CANONICAL_BASE_URL or request.url_root.rstrip("/")

def is_internal_url(url, base_url):
    if not url:
        return False
    if url.startswith("/"):
        return True
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return False
    base = urlparse(base_url)
    return parsed.netloc == base.netloc

def normalize_url(url, base_url):
    if not url:
        return ""
    if url.startswith("/"):
        return f"{base_url}{url}"
    return url

# --------------------------------------------------
# SECURITY: RATE LIMITS + CSRF
# --------------------------------------------------
RATE_LIMITS = {
    "/api/send-inquiry-mc": (20, 300),
    "/api/send-inquiry-qc": (20, 300),
    "/api/contact-us": (15, 300),
    "/api/submit-job-applicant": (10, 600),
    "/api/clefincode/create": (30, 300),
    "/api/clefincode/send": (60, 300),
}
RATE_STATE = {}

def is_rate_limited(ip, key, limit, window_seconds):
    now = time()
    bucket = RATE_STATE.get((ip, key))
    if bucket is None:
        bucket = deque()
        RATE_STATE[(ip, key)] = bucket
    cutoff = now - window_seconds
    while bucket and bucket[0] < cutoff:
        bucket.popleft()
    if len(bucket) >= limit:
        return True
    bucket.append(now)
    return False

@app.before_request
def security_before_request():
    g.csp_nonce = secrets.token_urlsafe(16)

    if request.method in ("POST", "PUT", "PATCH", "DELETE") and request.path.startswith("/api/"):
        if request.path == "/api/cache/events/refresh":
            return None
        limit_cfg = RATE_LIMITS.get(request.path)
        if limit_cfg:
            ip = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
            limit, window_seconds = limit_cfg
            if is_rate_limited(ip, request.path, limit, window_seconds):
                return jsonify({"error": "rate_limited"}), 429

        token = request.headers.get("X-CSRF-Token") or request.form.get("csrf_token")
        if not token and request.is_json:
            payload = request.get_json(silent=True) or {}
            token = payload.get("csrf_token")
        if not token or token != flask_session.get("csrf_token"):
            return jsonify({"error": "csrf_failed"}), 403


# --------------------------------------------------
# ROUTES (PAGES)
# --------------------------------------------------
@app.route("/")
@cache.cached(timeout=60)
def home():
    return render_template("home.html", API_BASE_URL=API_BASE_URL, events=load_event_posts())

@app.route("/products_plastic")
@cache.cached(timeout=600)
def products_plastic():
    return render_template("products_plastic.html")

@app.route("/products_styro")
@cache.cached(timeout=600)
def products_styro():
    return render_template("products_styro.html")

@app.route("/view_jobs")
@cache.cached(timeout=300)
def view_jobs():
    return render_template("view_jobs.html")

@app.route("/apply_now.html")
@cache.cached(timeout=300)
def apply_now():
    return render_template("apply_now.html")

@app.route("/announcements")
@cache.cached(timeout=300)
def announcements():
    return render_template("announcements.html")

@app.route("/sitemap.xml")
def sitemap():
    base_url = get_base_url()
    today = date.today().isoformat()
    pages = [
        ("home", "weekly", "1.0"),
        ("products_plastic", "weekly", "0.9"),
        ("products_styro", "weekly", "0.9"),
        ("view_jobs", "daily", "0.7"),
    ]

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        'xmlns:xhtml="http://www.w3.org/1999/xhtml">'
    ]
    for endpoint, changefreq, priority in pages:
        lines.append("  <url>")
        loc = f"{base_url}{flask_url_for(endpoint)}"
        lines.append(f"    <loc>{loc}</loc>")
        if HREFLANGS:
            for lang in HREFLANGS:
                lines.append(
                    f'    <xhtml:link rel="alternate" hreflang="{lang}" href="{loc}" />'
                )
            lines.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{loc}" />')
        lines.append(f"    <lastmod>{today}</lastmod>")
        lines.append(f"    <changefreq>{changefreq}</changefreq>")
        lines.append(f"    <priority>{priority}</priority>")
        lines.append("  </url>")

    # Optional category URLs (query-based, crawlable)
    for endpoint, categories in PRODUCT_CATEGORY_URLS.items():
        for category in categories:
            loc = f"{base_url}{flask_url_for(endpoint)}?category={category}"
            lines.append("  <url>")
            lines.append(f"    <loc>{loc}</loc>")
            if HREFLANGS:
                for lang in HREFLANGS:
                    lines.append(
                        f'    <xhtml:link rel="alternate" hreflang="{lang}" href="{loc}" />'
                    )
                lines.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{loc}" />')
            lines.append(f"    <lastmod>{today}</lastmod>")
            lines.append("    <changefreq>weekly</changefreq>")
            lines.append("    <priority>0.6</priority>")
            lines.append("  </url>")
    lines.append("</urlset>")

    return Response("\n".join(lines), mimetype="application/xml")

@app.route("/sitemap-events.xml")
def sitemap_events():
    base_url = get_base_url()
    today = date.today().isoformat()
    events = load_event_posts()
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        'xmlns:xhtml="http://www.w3.org/1999/xhtml">'
    ]
    for event in events:
        url = normalize_url((event or {}).get("url", "").strip(), base_url)
        if not is_internal_url(url, base_url):
            continue
        lines.append("  <url>")
        lines.append(f"    <loc>{url}</loc>")
        if HREFLANGS:
            for lang in HREFLANGS:
                lines.append(
                    f'    <xhtml:link rel="alternate" hreflang="{lang}" href="{url}" />'
                )
            lines.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{url}" />')
        lines.append(f"    <lastmod>{today}</lastmod>")
        lines.append("    <changefreq>weekly</changefreq>")
        lines.append("    <priority>0.6</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")
    return Response("\n".join(lines), mimetype="application/xml")

@app.route("/robots.txt")
def robots():
    content = [
        "User-agent: *",
        "Allow: /",
        f"Sitemap: {flask_url_for('sitemap', _external=True)}",
        f"Sitemap: {flask_url_for('sitemap_events', _external=True)}",
    ]
    return Response("\n".join(content), mimetype="text/plain")

# --------------------------------------------------
# API ROUTES (PROXY TO ERPNEXT)
# --------------------------------------------------
@app.route("/api/send-inquiry-mc", methods=["POST"])
def send_inquiry_mc():
    try:
        res = http_session.post(
            f"{API_BASE_URL}/api/method/qcmc_logic.api.send_inquiry.send_inquiry_mc",
            data=request.form,
            timeout=10
        )
        return res.json()
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/send-inquiry-qc", methods=["POST"])
def send_inquiry_qc():
    try:
        res = http_session.post(
            f"{API_BASE_URL}/api/method/qcmc_logic.api.send_inquiry.send_inquiry_qc",
            data=request.form,
            timeout=10
        )
        return res.json()
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/contact-us", methods=["POST"])
def contact_us():
    try:
        res = http_session.post(
            f"{API_BASE_URL}/api/method/qcmc_logic.api.contact_us.send_contact_inquiry",
            data=request.form,
            timeout=10
        )
        return res.json()
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ------------------ CACHED GET APIs ----------------
@app.route("/api/jobs", methods=["GET"])
@cache.cached(timeout=120)
def get_jobs():
    try:
        res = http_session.get(
            f"{API_BASE_URL}/api/method/qcmc_logic.api.job_openings.get_job_openings",
            timeout=8
        )
        res.raise_for_status()
        return jsonify(res.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/job-applicant-counts", methods=["GET"])
@cache.cached(timeout=120)
def get_job_applicant_counts():
    try:
        res = http_session.get(
            f"{API_BASE_URL}/api/method/qcmc_logic.api.job_openings.get_job_applicant_counts",
            timeout=8
        )
        res.raise_for_status()
        return jsonify(res.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ------------------ POST (NO CACHE) ----------------
@app.route("/api/erp/whoami", methods=["GET"])
def erp_whoami():
    try:
        headers = {}
        cookie = request.headers.get("Cookie")
        if cookie:
            headers["Cookie"] = cookie
        auth = request.headers.get("Authorization")
        if auth:
            headers["Authorization"] = auth
        res = http_session.get(
            f"{API_BASE_URL}/api/method/qcmc_logic.api.auth.check_log_user",
            headers=headers,
            timeout=8
        )
        return Response(res.content, status=res.status_code, mimetype=res.headers.get("Content-Type", "application/json"))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ------------------ POST (NO CACHE) ----------------
@app.route("/api/submit-job-applicant", methods=["POST"])
def submit_job_applicant():
    try:
        form_data = request.json or {}

        erp_payload = {
            "doctype": "Job Applicant",
            "web_form_name": "job-application-form",
            "job_title": form_data.get("job_opening"),
            "applicant_name": form_data.get("applicant_name"),
            "address": form_data.get("address"),
            "email_id": form_data.get("email_address"),
            "phone_number": form_data.get("phone_number"),
            "custom_referrer": form_data.get("referrer"),
            "cover_letter": form_data.get("cover_letter") or "",
            "resume_link": form_data.get("resume_link") or "",
            "currency": form_data.get("currency"),
            "lower_range": float(form_data.get("lower_range") or 0),
            "upper_range": float(form_data.get("upper_range") or 0),
            "custom_i_agree_to_the_data_privacy_statement": int(
                form_data.get("custom_i_agree_to_the_data_privacy_statement")
                or form_data.get("privacy_check")
                or 1
            ),
        }

        res = http_session.post(
            f"{API_BASE_URL}/api/method/qcmc_logic.api.job_openings.submit_job_applicant_custom",
            json=erp_payload,
            headers={"Content-Type": "application/json"},
            timeout=15
        )

        return res.json()

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ------------------ CLEFINCODE CHAT PROXY ----------------
@app.route("/api/clefincode/create", methods=["POST"])
def clefincode_create():
    try:
        res = http_session.post(
            f"{API_BASE_URL}/api/method/clefincode_chat.api.api_1_0_1.chat_portal.create_guest_profile_and_channel",
            json=request.json or {},
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        return jsonify(res.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/clefincode/send", methods=["POST"])
def clefincode_send():
    try:
        res = http_session.post(
            f"{API_BASE_URL}/api/method/clefincode_chat.api.api_1_0_1.chat_portal.send",
            json=request.json or {},
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        return jsonify(res.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/clefincode/messages", methods=["GET"])
def clefincode_messages():
    try:
        room = request.args.get("room")
        if not room:
            return jsonify({"error": "room is required"}), 400
        res = http_session.get(
            f"{API_BASE_URL}/api/method/clefincode_chat.api.api_1_0_1.chat_portal.get_messages",
            params={"room": room},
            timeout=15
        )
        return jsonify(res.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/clefincode/settings", methods=["GET"])
def clefincode_settings():
    try:
        token = request.args.get("token")
        if not token:
            return jsonify({"error": "token is required"}), 400
        res = http_session.get(
            f"{API_BASE_URL}/api/method/clefincode_chat.api.api_1_3_1.api.get_settings",
            params={"token": token},
            timeout=15
        )
        return jsonify(res.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/clefincode/bot-topics", methods=["GET"])
def clefincode_bot_topics():
    try:
        res = http_session.get(
            f"{API_BASE_URL}/api/method/qcmc_logic.api.chatbot.get_bot_topics",
            timeout=15
        )
        data = res.json()
        message = data.get("message", {}) if isinstance(data, dict) else {}
        payload = {
            "greeting": message.get("greetings") or message.get("greeting") or "",
            "topics": message.get("topics") or []
        }
        return jsonify(payload)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ------------------ CACHE BUST (WEBHOOK) ----------------
@app.route("/api/cache/events/refresh", methods=["POST"])
def refresh_events_cache():
    token = request.headers.get("X-Cache-Token") or request.args.get("token")
    if not CACHE_BUST_TOKEN or token != CACHE_BUST_TOKEN:
        return jsonify({"error": "unauthorized"}), 403
    clear_event_caches()
    return jsonify({"status": "ok"})


# --------------------------------------------------
# SECURITY & CACHE HEADERS
# --------------------------------------------------
@app.after_request
def add_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"

    nonce = getattr(g, "csp_nonce", "")
    if response.mimetype == "text/html":
        try:
            body = response.get_data(as_text=True)
            match = re.search(r'nonce="([^"]+)"', body)
            if match:
                nonce = match.group(1)
        except Exception:
            pass
    api_origin = ""
    try:
        parsed_api = urlparse(API_BASE_URL)
        if parsed_api.scheme and parsed_api.netloc:
            api_origin = f"{parsed_api.scheme}://{parsed_api.netloc}"
    except Exception:
        api_origin = ""

    img_src = "img-src 'self' data: https:"
    if api_origin and api_origin.startswith("http://"):
        img_src += f" {api_origin}"
    elif api_origin and api_origin.startswith("https://"):
        img_src += f" {api_origin}"

    csp = [
        "default-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        f"script-src 'self' 'nonce-{nonce}' 'sha256-j9UDKlBdU2OvJLCxxVGF011MFoS+SFn/EamE8+cU4VQ=' https://cdnjs.cloudflare.com https://img1.wsimg.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
        img_src,
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self' https://psgc.gitlab.io https://open.er-api.com https://csp.secureserver.net",
        "frame-src https://www.google.com https://maps.google.com",
        "media-src 'self'",
    ]
    response.headers["Content-Security-Policy"] = "; ".join(csp)

    if request.path.startswith("/api/clefincode/"):
        response.headers["Cache-Control"] = "no-store"
    elif request.path.startswith("/static/"):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    else:
        response.headers["Cache-Control"] = "public, max-age=300"

    response.set_cookie(
        "csrf_token",
        get_csrf_token(),
        secure=request.is_secure,
        httponly=False,
        samesite="Lax"
    )
    return response


# --------------------------------------------------
# LOCAL RUN ONLY (PROD USES GUNICORN)
# --------------------------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
