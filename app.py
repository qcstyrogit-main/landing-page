from dotenv import load_dotenv
import os
from flask import Flask, render_template, request
import requests

app = Flask(__name__)

# Load default .env (from Git)
load_dotenv(".env")

# Override with local if exists
if os.path.exists(".env.local"):
    load_dotenv(".env.local", override=True)

API_BASE_URL = os.getenv("API_BASE_URL")

@app.route("/")
def home():
    return render_template("home.html", API_BASE_URL=API_BASE_URL)

@app.route("/products_plastic")
def products_plastic():
    return render_template("products_plastic.html")

@app.route("/products_styro")
def products_styro():
    return render_template("products_styro.html")

@app.route("/api/send-inquiry-mc", methods=["POST"])
def send_inquiry_mc():
    res = requests.post(
        f"{API_BASE_URL}/api/method/qcmc_logic.api.send_inquiry.send_inquiry_mc",
        data=request.form
    )
    return res.json()

@app.route("/api/send-inquiry-qc", methods=["POST"])
def send_inquiry_qc():
    res = requests.post(
        f"{API_BASE_URL}/api/method/qcmc_logic.api.send_inquiry.send_inquiry_qc",
        data=request.form
    )
    return res.json()

@app.route("/api/contact-us", methods=["POST"])
def contact_us():
    res = requests.post(
        f"{API_BASE_URL}/api/method/qcmc_logic.api.contact_us.send_contact_inquiry",
        data=request.form
    )
    return res.json()


if __name__ == "__main__":
    app.run(debug=True)
