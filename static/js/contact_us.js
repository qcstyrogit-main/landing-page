document.addEventListener("DOMContentLoaded", function() {

    /* ------------------------------
       AREA FILTER (Luzon/Visayas/Mindanao/Plant/All)
    --------------------------------*/
    const areaSelect = document.getElementById("area");
    const offices = document.querySelectorAll(".contact_row");

    function filterOffices() {
        const selectedArea = areaSelect.value; 

        offices.forEach(office => {
            const officeArea = office.dataset.area; 

            // Show if "all" or matches selected area
            if (selectedArea === "all" || officeArea === selectedArea) {
                office.style.display = "flex";
            } else {
                office.style.display = "none";
            }
        });
    }

    // Trigger filter when dropdown changes
    areaSelect.addEventListener("change", filterOffices);

    // Initial load
    filterOffices();


    /* ------------------------------
       AUTO TEXT COLOR BASED ON BG
    --------------------------------*/
    const textElements = document.querySelectorAll(
        '.contact_us-section, .contact_text, .contact-header, .area-filter label'
    );

    textElements.forEach(el => {
        const bg = window.getComputedStyle(el).backgroundColor;
        if (bg) {
            const rgb = bg.match(/\d+/g);
            if (rgb) {
                const brightness = Math.round(((parseInt(rgb[0]) * 299) +
                                               (parseInt(rgb[1]) * 587) +
                                               (parseInt(rgb[2]) * 114)) / 1000);
                el.style.color = (brightness > 150) ? '#000' : '#fff';
            }
        }
    });

});


/* ------------------------------
   OPEN VIBER FUNCTION
--------------------------------*/
function openViber() {
    const viberURL = "viber://chat?number=+639178143250";
    const fallbackURL = "https://www.viber.com/download";

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
        window.location.href = viberURL;
        setTimeout(() => {
            window.location.href = fallbackURL;
        }, 1500);
    } else {
        alert("Viber app cannot be opened directly on desktop. Please install Viber.");
        window.open(fallbackURL, "_blank");
    }
}

/* ------------------------------
    CONTACT FORM SUBMISSION
--------------------------------*/

document.addEventListener("DOMContentLoaded", () => {
    const contactFormEl = document.getElementById("contactForm");
    if (!contactFormEl) return;

    const submitBtn = contactFormEl.querySelector(".submit-btn");

    contactFormEl.addEventListener("submit", (e) => {
        e.preventDefault();

        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";

        const name = document.getElementById("contactName");
        const company = document.getElementById("contactCompany");
        const contactNo = document.getElementById("contactNo");
        const email = document.getElementById("contactEmail");
        const topic = document.getElementById("contactTopic");
        const inquiry = document.getElementById("contactInquiry");
        const hp = document.getElementById("contactHp");

        fetch("/api/contact-us", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                name: name.value.trim(),
                company: company.value.trim(),
                contact_no: contactNo.value.trim(),
                email: email.value.trim(),
                topic: topic.value.trim(),
                inquiry: inquiry.value.trim(),
                hp: hp.value
            })
        })
        .then(res => res.json())
        .then(data => {
            alert(
                data.message?.message ||
                data.message ||
                "Your inquiry has been sent successfully!"
            );

            contactFormEl.reset();
        })
        .catch(err => {
            console.error("Contact inquiry error:", err);
            alert("Failed to send inquiry. Please try again.");
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = "Send Message";
        });
    });
});


document.addEventListener("DOMContentLoaded", () => {
    const openBtn = document.getElementById("openContactPopup");
    const closeBtn = document.getElementById("closeContactPopup");
    const popup = document.getElementById("contactPopup");
    const overlay = document.getElementById("contactOverlay");

    function openPopup() {
        popup.style.display = "block";
        overlay.style.display = "block";
    }

    function closePopup() {
        popup.style.display = "none";
        overlay.style.display = "none";
    }

    openBtn.addEventListener("click", openPopup);
    closeBtn.addEventListener("click", closePopup);
    overlay.addEventListener("click", closePopup);
});


