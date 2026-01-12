from dotenv import load_dotenv
import os
from flask import Flask, render_template, request, jsonify
import requests

# --------------------------------------------------
# APP INIT
# --------------------------------------------------
app = Flask(__name__)

# --------------------------------------------------
# ENV LOADING (SAFE FOR RENDER)
# --------------------------------------------------
# Render sets RENDER=true automatically
if os.getenv("RENDER") is None:
    load_dotenv(".env")
    if os.path.exists(".env.local"):
        load_dotenv(".env.local", override=True)

API_BASE_URL = os.getenv("API_BASE_URL")

if not API_BASE_URL:
    raise RuntimeError("API_BASE_URL is not set in environment variables")

# --------------------------------------------------
# ROUTES (PAGES)
# --------------------------------------------------
@app.route("/")
def home():
    return render_template("home.html", API_BASE_URL=API_BASE_URL)

@app.route("/products_plastic")
def products_plastic():
    return render_template("products_plastic.html")

@app.route("/products_styro")
def products_styro():
    return render_template("products_styro.html")

@app.route("/view_jobs")
def view_jobs():
    return render_template("view_jobs.html")

@app.route("/apply_now.html")
def apply_now():
    return render_template("apply_now.html")

# --------------------------------------------------
# API ROUTES (PROXY TO ERPNEXT)
# --------------------------------------------------
@app.route("/api/send-inquiry-mc", methods=["POST"])
def send_inquiry_mc():
    try:
        res = requests.post(
            f"{API_BASE_URL}/api/method/qcmc_logic.api.send_inquiry.send_inquiry_mc",
            data=request.form,
            timeout=15
        )
        return res.json()
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/send-inquiry-qc", methods=["POST"])
def send_inquiry_qc():
    try:
        res = requests.post(
            f"{API_BASE_URL}/api/method/qcmc_logic.api.send_inquiry.send_inquiry_qc",
            data=request.form,
            timeout=15
        )
        return res.json()
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/contact-us", methods=["POST"])
def contact_us():
    try:
        res = requests.post(
            f"{API_BASE_URL}/api/method/qcmc_logic.api.contact_us.send_contact_inquiry",
            data=request.form,
            timeout=15
        )
        return res.json()
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/jobs", methods=["GET"])
def get_jobs():
    try:
        res = requests.get(
            f"{API_BASE_URL}/api/method/qcmc_logic.api.job_openings.get_job_openings",
            timeout=15
        )
        res.raise_for_status()
        return jsonify(res.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/job-applicant-counts", methods=["GET"])
def get_job_applicant_counts():
    try:
        res = requests.get(
            f"{API_BASE_URL}/api/method/qcmc_logic.api.job_openings.get_job_applicant_counts",
            timeout=15
        )
        res.raise_for_status()
        return jsonify(res.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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

        res = requests.post(
            f"{API_BASE_URL}/api/method/qcmc_logic.api.job_openings.submit_job_applicant_custom",
            json=erp_payload,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            timeout=20
        )

        return res.json()

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --------------------------------------------------
# RUN (LOCAL ONLY – GUNICORN HANDLES PROD)
# --------------------------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
