from dotenv import load_dotenv
import os
from flask import Flask, render_template, request, jsonify, Response, url_for as flask_url_for
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
ASSET_VERSION = os.getenv("ASSET_VERSION", "1")

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
session = requests.Session()
session.headers.update({
    "Accept": "application/json"
})

@app.context_processor
def inject_api_url():
    return dict(API_BASE_URL=API_BASE_URL)


# --------------------------------------------------
# ROUTES (PAGES)
# --------------------------------------------------
@app.route("/")
@cache.cached(timeout=300)
def home():
    return render_template("home.html", API_BASE_URL=API_BASE_URL)

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

@app.route("/sitemap.xml")
def sitemap():
    pages = [
        ("home", "weekly", "1.0"),
        ("products_plastic", "weekly", "0.9"),
        ("products_styro", "weekly", "0.9"),
        ("view_jobs", "daily", "0.7"),
    ]

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ]
    for endpoint, changefreq, priority in pages:
        lines.append("  <url>")
        lines.append(f"    <loc>{flask_url_for(endpoint, _external=True)}</loc>")
        lines.append(f"    <changefreq>{changefreq}</changefreq>")
        lines.append(f"    <priority>{priority}</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")

    return Response("\n".join(lines), mimetype="application/xml")

@app.route("/robots.txt")
def robots():
    content = [
        "User-agent: *",
        "Allow: /",
        f"Sitemap: {flask_url_for('sitemap', _external=True)}",
    ]
    return Response("\n".join(content), mimetype="text/plain")

# --------------------------------------------------
# API ROUTES (PROXY TO ERPNEXT)
# --------------------------------------------------
@app.route("/api/send-inquiry-mc", methods=["POST"])
def send_inquiry_mc():
    try:
        res = session.post(
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
        res = session.post(
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
        res = session.post(
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
        res = session.get(
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
        res = session.get(
            f"{API_BASE_URL}/api/method/qcmc_logic.api.job_openings.get_job_applicant_counts",
            timeout=8
        )
        res.raise_for_status()
        return jsonify(res.json())
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

        res = session.post(
            f"{API_BASE_URL}/api/method/qcmc_logic.api.job_openings.submit_job_applicant_custom",
            json=erp_payload,
            headers={"Content-Type": "application/json"},
            timeout=15
        )

        return res.json()

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --------------------------------------------------
# SECURITY & CACHE HEADERS
# --------------------------------------------------
@app.after_request
def add_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    if request.path.startswith("/static/"):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    else:
        response.headers["Cache-Control"] = "public, max-age=300"
    return response


# --------------------------------------------------
# LOCAL RUN ONLY (PROD USES GUNICORN)
# --------------------------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
