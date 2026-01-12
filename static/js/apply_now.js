document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('applicationForm');
    const jobIdDisplay = document.getElementById('jobIdDisplay');
    const urlParams = new URLSearchParams(window.location.search);
    const jobId = urlParams.get('id');
    const jobTitle = urlParams.get('job');

    // Display Job Title + ID
    if (jobIdDisplay && jobId) {
        const decodedId = decodeURIComponent(jobId);
        const decodedTitle = jobTitle ? decodeURIComponent(jobTitle) : "";
        jobIdDisplay.value = decodedTitle ? `${decodedTitle} (${decodedId})` : decodedId;
    }

    // Load Currencies Dropdown
    loadCurrencies();

    // Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!document.getElementById('privacy-check').checked) {
            alert("Please agree to the Data Privacy Statement.");
            return;
        }

        const formData = {
            job_opening: jobId,
            applicant_name: document.getElementById('applicantName').value,
            address: document.getElementById('address').value,
            email_address: document.getElementById('emailAddress').value,
            phone_number: document.getElementById('phoneNumber').value,
            referrer: document.getElementById('referrer').value,
            cover_letter: document.getElementById('coverLetter').value,
            resume_link: document.getElementById('resumeLink').value,
            currency: document.getElementById('salaryCurrency').value,
            lower_range: document.getElementById('salaryLower').value,
            upper_range: document.getElementById('salaryUpper').value,
            custom_i_agree_to_the_data_privacy_statement: document.getElementById('privacy-check').checked ? 1 : 0
        };


        try {
            const response = await fetch("/api/submit-job-applicant", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok) {
                // Hide form + header
                form.style.display = 'none';
                document.querySelector('.header-row').style.display = 'none';
                document.querySelector('hr').style.display = 'none';

                // Show success message
                const successMsg = document.getElementById('successMessage');
                successMsg.style.display = 'flex';

                // Countdown redirect
                let timeLeft = 3;
                const countdownElem = document.getElementById('countdown');
                const timer = setInterval(() => {
                    timeLeft--;
                    countdownElem.textContent = timeLeft;
                    if (timeLeft <= 0) {
                        clearInterval(timer);
                        window.location.href = `/view_jobs#job-${jobId}`;
                    }
                }, 1000);

            } else {
                alert("Error: " + (result.error || "Submission failed"));
            }
        } catch (error) {
            console.error("Submission error:", error);
            alert("An error occurred while connecting to the server.");
        }
    });

    // Discard button
    const discardBtn = document.querySelector('.btn-discard');
    if (discardBtn) {
        discardBtn.addEventListener('click', () => {
            if (jobId) window.location.href = `/view_jobs#job-${jobId}`;
            else window.location.href = "/view_jobs";
        });
    }
});

// Load currency dropdown dynamically
async function loadCurrencies() {
    const currencySelect = document.getElementById('salaryCurrency');
    const apiURL = "https://open.er-api.com/v6/latest/USD"; // Base currency can be anything

    try {
        const response = await fetch(apiURL);
        const data = await response.json();

        if (data && data.rates) {
            currencySelect.innerHTML = '';

            Object.keys(data.rates).forEach(symbol => {
                const option = document.createElement('option');
                option.value = symbol;
                option.textContent = symbol;
                if (symbol === "PHP") option.selected = true;
                currencySelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Currency API error:", error);
        currencySelect.innerHTML = '<option value="PHP">PHP</option><option value="USD">USD</option>';
    }
}
