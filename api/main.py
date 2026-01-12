import json
import os
import requests

# Path to shared templates
TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "../templates")

API_BASE_URL = os.getenv("API_BASE_URL") or "https://example.com"  # fallback

def handler(request):
    method = request.method
    path = request.path

    # --------------------
    # GET requests (pages & APIs)
    # --------------------
    if method == "GET":
        if path == "/" or path.endswith(".html"):
            page = "home.html" if path == "/" else path.strip("/")
            file_path = os.path.join(TEMPLATE_DIR, page)
            try:
                with open(file_path, "r") as f:
                    html_content = f.read()
                return {
                    "statusCode": 200,
                    "headers": {"Content-Type": "text/html"},
                    "body": html_content
                }
            except FileNotFoundError:
                return {"statusCode": 404, "body": "Page not found"}

        # API GET endpoints
        elif path.startswith("/api/"):
            try:
                if path == "/api/jobs":
                    res = requests.get(f"{API_BASE_URL}/api/method/qcmc_logic.api.job_openings.get_job_openings")
                    return {"statusCode": 200, "body": json.dumps(res.json())}

                elif path == "/api/job-applicant-counts":
                    res = requests.get(f"{API_BASE_URL}/api/method/qcmc_logic.api.job_openings.get_job_applicant_counts")
                    return {"statusCode": 200, "body": json.dumps(res.json())}
            except Exception as e:
                return {"statusCode": 500, "body": json.dumps({"error": str(e)})}

        return {"statusCode": 404, "body": "Not Found"}

    # --------------------
    # POST requests (API endpoints)
    # --------------------
    elif method == "POST":
        # Parse JSON body
        try:
            form_data = json.loads(request.body) if request.body else {}
        except Exception:
            form_data = {}

        try:
            if path == "/api/send-inquiry-mc":
                res = requests.post(
                    f"{API_BASE_URL}/api/method/qcmc_logic.api.send_inquiry.send_inquiry_mc",
                    data=form_data
                )
                return {"statusCode": 200, "body": json.dumps(res.json())}

            elif path == "/api/send-inquiry-qc":
                res = requests.post(
                    f"{API_BASE_URL}/api/method/qcmc_logic.api.send_inquiry.send_inquiry_qc",
                    data=form_data
                )
                return {"statusCode": 200, "body": json.dumps(res.json())}

            elif path == "/api/contact-us":
                res = requests.post(
                    f"{API_BASE_URL}/api/method/qcmc_logic.api.contact_us.send_contact_inquiry",
                    data=form_data
                )
                return {"statusCode": 200, "body": json.dumps(res.json())}

            elif path == "/api/submit-job-applicant":
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
                    )
                }
                res = requests.post(
                    f"{API_BASE_URL}/api/method/qcmc_logic.api.job_openings.submit_job_applicant_custom",
                    json=erp_payload,
                    headers={"Content-Type": "application/json", "Accept": "application/json"}
                )
                return {"statusCode": 200, "body": json.dumps(res.json())}

        except Exception as e:
            return {"statusCode": 500, "body": json.dumps({"error": str(e)})}

    return {"statusCode": 405, "body": "Method Not Allowed"}
