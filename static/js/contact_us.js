document.addEventListener("DOMContentLoaded", function() {

    /* ------------------------------
       AREA FILTER (Luzon/Visayas/Mindanao/Plant/All)
    --------------------------------*/
    const areaSelect = document.getElementById("area");
    const offices = document.querySelectorAll(".contact_card");
    const markersContainer = document.getElementById("contactMapMarkers");
    const panelTitle = document.getElementById("contactPanelTitle");
    const panelTag = document.getElementById("contactPanelTag");
    const panelBody = document.getElementById("contactPanelBody");
    const panelLink = document.getElementById("contactPanelLink");
    const panelMap = document.getElementById("contactPanelMap");

    const geoBounds = {
        minLon: 116.927573,
        maxLon: 126.606549,
        minLat: 4.640292,
        maxLat: 20.834769
    };

    const mapLocations = [
        {
            id: "head-office",
            name: "Head Office",
            tag: "Luzon",
            area: "luzon",
            lat: 14.6760,
            lon: 121.0437,
            address: "1200-H EDSA corner Seminary Road, Quezon City, Philippines",
            phone: "(632) 8-928-5002 to 09<br>8-928-0352<br>8-928-5015<br>8-928-5016<br>8-928-5017<br>8-928-5019",
            fax: "(632) 3-454-6151<br>3-458-7695",
            email: "sales_qcsc@qcstyro.com (GMA)<br>sales_mcmanila@qcstyro.com (GMA)<br>sales_mcluzon@qcstyro.com (North & South Luzon)<br>sales_multi@qcstyro.com (Visayas & Mindanao)",
            map: "https://www.google.com/maps?q=MCY+Building,+1200-H+Epifanio+de+los+Santos+Ave,+Project+8,+Quezon+City,+1106+Metro+Manila"
        },
        {
            id: "la-union",
            name: "La Union Office",
            tag: "Luzon",
            area: "luzon",
            lat: 16.6159,
            lon: 120.3166,
            address: "# 265 P. Burgos St., Brgy. Tanqui, City of San Fernando, La Union",
            phone: "09209008954<br>(632) 8 072-6078957",
            map: "https://www.google.com/maps?q=J88F+97H,+San+Fernando+City,+La+Union"
        },
        {
            id: "laguna",
            name: "Laguna Office",
            tag: "Luzon",
            area: "luzon",
            lat: 14.2117,
            lon: 121.1653,
            address: "Blk 4A Lot 1A ELFYU Compound Brgy. Batino Calamba Laguna",
            phone: "09209107834",
            map: "https://www.google.com/maps?q=54XH+P93,+Calamba,+4027+Laguna"
        },
        {
            id: "pampanga",
            name: "Pampanga Office",
            tag: "Luzon",
            area: "luzon",
            lat: 15.0341,
            lon: 120.6845,
            address: "BLK 5, 3rd St. Dolores Homesite Subd., Dolores, City of San Fernando, Pampanga (near Springfield Resident)",
            phone: "09209107836<br>(632) 8 963-66-29",
            map: "https://www.google.com/maps?q=BLK+5,+3rd+St.+Dolores+Homesite+Subd.,+Dolores,+City+of+San+Fernando,+Pampanga"
        },
        {
            id: "quezon",
            name: "Quezon Office",
            tag: "Luzon",
            area: "luzon",
            lat: 13.9411,
            lon: 121.6220,
            address: "Ylang Ylang St., Zaballero Subd., Brgy. Gulang Gulang, Lucena City, Quezon",
            phone: "09209062734",
            map: "https://www.google.com/maps?q=Ylang+Ylang+St.,+Zaballero+Subd.,+Brgy.+Gulang+Gulang,+Lucena+City,+Quezon"
        },
        {
            id: "bacolod",
            name: "Bacolod Office",
            tag: "Visayas",
            area: "visayas",
            lat: 10.6765,
            lon: 122.9510,
            address: "NEW BACOLOD JL BLDG., Napoleon D. Gonzaga corner Lopez Jaena St., Bacolod City, Negros Occidental 6100",
            phone: "09189442673<br>(632) 8 034-433-6571",
            map: "https://www.google.com/maps?q=Napoleon+D.+Gonzaga+St+%26+Lopez+Jaena+St,+Bacolod+City,+Negros+Occidental"
        },
        {
            id: "cebu",
            name: "Cebu Office",
            tag: "Visayas",
            area: "visayas",
            lat: 10.3230,
            lon: 123.9220,
            address: "B27 J. King & Sons Warehouse Complex, Brgy. Cambaro, Mandaue City, Cebu",
            phone: "(632) 8 0920-911-4866",
            fax: "(632) 8 032-344-4192<br>(632) 8 032-505-0590",
            map: "https://www.google.com/maps?q=B27+J.+King+%26+Sons+Warehouse+Complex,+Brgy.+Cambaro,+Mandaue+City,+Cebu"
        },
        {
            id: "iloilo",
            name: "Iloilo Office",
            tag: "Visayas",
            area: "visayas",
            lat: 10.7202,
            lon: 122.5621,
            address: "CARDC Compound Door B-8, Alliance Warehouse, Brgy. Baldoza, La Paz, Iloilo City",
            phone: "09189442931",
            map: "https://www.google.com/maps?q=CARDC+Compound+Door+B-8,+Alliance+Warehouse,+Brgy.+Baldoza,+La+Paz,+Iloilo+City"
        },
        {
            id: "cdo",
            name: "Cagayan de Oro Office",
            tag: "Mindanao",
            area: "mindanao",
            lat: 8.4542,
            lon: 124.6319,
            address: "Door #8, Misco Compound, Cugman, Cagayan de Oro City",
            phone: "09209114861<br>(632) 8 088-327-1969",
            map: "https://www.google.com/maps?q=Door+%238,+Misco+Compound,+Cugman,+Cagayan+de+Oro+City"
        },
        {
            id: "davao",
            name: "Davao Office",
            tag: "Mindanao",
            area: "mindanao",
            lat: 7.1907,
            lon: 125.4553,
            address: "GRI Bldg., Door 4-B Mintrade Drive, Brgy. Centro R. Castillo, Agdao, Davao City",
            phone: "09209114867",
            map: "https://www.google.com/maps?q=GRI+Bldg.,+Door+4-B+Mintrade+Drive,+Brgy.+Centro+R.+Castillo,+Agdao,+Davao+City"
        },
        {
            id: "zamboanga",
            name: "Zamboanga Office",
            tag: "Mindanao",
            area: "mindanao",
            lat: 6.9214,
            lon: 122.0790,
            address: "Fronting Old Servitek, beside BGS Hardware, Don Alfaro St., Tetuan, Zamboanga City",
            phone: "(632) 8 0918-944-2671<br>(632) 8 992-0138",
            map: "https://www.google.com/maps?q=Fronting+Old+Servitek,+beside+BGS+Hardware,+Don+Alfaro+St.,+Tetuan,+Zamboanga+City"
        },
        {
            id: "guyong-plant",
            name: "Guyong Plant",
            tag: "Plant",
            area: "plant",
            lat: 14.8245,
            lon: 120.9637,
            address: "Km. 35 Bgy. Guyong, Sta. Maria, Bulacan, Philippines",
            phone: "(632) 8-928-5002 to 09 Trunkline<br>(632) 8-924-3796<br>(632) 3-454-6151",
            email: "sales_qcsc@qcstyro.com (GMA)",
            map: "https://www.google.com/maps?q=Km+35+Bgy+Guyong,+Sta+Maria,+Bulacan,+Philippines"
        },
        {
            id: "sta-clara-plant",
            name: "Sta Clara Plant",
            tag: "Plant",
            area: "plant",
            lat: 14.7066,
            lon: 120.9839,
            address: "#25 Sitio Malinis, Lawang Bato, Valenzuela City, Philippines",
            phone: "(632) 8-928-5002 to 09 Trunkline<br>(632) 8-924-3796<br>(632) 3-454-6151",
            email: "sales_qcsc@qcstyro.com (GMA)",
            map: "https://www.google.com/maps?q=25+Sitio+Malinis,+Lawang+Bato,+Valenzuela+City,+Philippines"
        },
        {
            id: "valenzuela-plant",
            name: "Valenzuela Plant",
            tag: "Plant",
            area: "plant",
            lat: 14.7066,
            lon: 120.9839,
            address: "#25 Sitio Malinis, Lawang Bato, Valenzuela City, Philippines",
            phone: "(02) 928-5002 to 09 Trunkline<br>(632) 8-924-3796<br>(632) 8-454-6151",
            email: "sales_qcsc@qcstyro.com (GMA)",
            map: "https://www.google.com/maps?q=25+Sitio+Malinis,+Lawang+Bato,+Valenzuela+City,+Philippines"
        }
    ];

    let activeMarker = null;

    function toEmbedUrl(url) {
        if (!url) return "";
        if (url.includes("output=embed")) return url;
        const joiner = url.includes("?") ? "&" : "?";
        return `${url}${joiner}output=embed`;
    }

    function clearPanel() {
        if (panelTitle) panelTitle.textContent = "Select a location";
        if (panelTag) panelTag.textContent = "-";
        if (panelBody) panelBody.innerHTML = "<p>Click a marker on the map to view office details.</p>";
        if (panelLink) {
            panelLink.href = "#";
            panelLink.style.display = "none";
        }
        if (panelMap) {
            panelMap.src = "https://www.google.com/maps?q=Philippines&output=embed";
        }
        if (activeMarker) {
            activeMarker.classList.remove("is-active");
            activeMarker = null;
        }
    }

    function setPanel(location, markerEl) {
        if (!panelTitle || !panelTag || !panelBody || !panelLink) return;

        if (activeMarker) activeMarker.classList.remove("is-active");
        if (markerEl) {
            markerEl.classList.add("is-active");
            activeMarker = markerEl;
        }

        panelTitle.textContent = location.name;
        panelTag.textContent = location.tag;

        const lines = [];
        if (location.address) {
            lines.push(`<p><svg class="icon" aria-hidden="true"><use href="#icon-location"></use></svg> ${location.address}</p>`);
        }
        if (location.phone) {
            lines.push(`<p><svg class="icon" aria-hidden="true"><use href="#icon-phone"></use></svg> ${location.phone}</p>`);
        }
        if (location.fax) {
            lines.push(`<p><svg class="icon" aria-hidden="true"><use href="#icon-fax"></use></svg> ${location.fax}</p>`);
        }
        if (location.email) {
            lines.push(`<p><svg class="icon" aria-hidden="true"><use href="#icon-mail"></use></svg> ${location.email}</p>`);
        }

        panelBody.innerHTML = lines.join("");
        if (location.map) {
            panelLink.href = location.map;
            panelLink.style.display = "inline-flex";
            if (panelMap) {
                panelMap.src = toEmbedUrl(location.map);
            }
        } else {
            panelLink.href = "#";
            panelLink.style.display = "none";
            if (panelMap) {
                panelMap.src = "https://www.google.com/maps?q=Philippines&output=embed";
            }
        }
    }

    function renderMarkers() {
        if (!markersContainer) return;

        const toPercent = (value, min, max) => ((value - min) / (max - min)) * 100;

        markersContainer.innerHTML = "";
        mapLocations.forEach((location) => {
            let left = 50;
            let top = 50;

            if (typeof location.lon === "number" && typeof location.lat === "number") {
                left = toPercent(location.lon, geoBounds.minLon, geoBounds.maxLon);
                top = toPercent(geoBounds.maxLat - location.lat, 0, geoBounds.maxLat - geoBounds.minLat);
            } else if (typeof location.x === "number" && typeof location.y === "number") {
                left = location.x;
                top = location.y;
            }

            const marker = document.createElement("button");
            marker.type = "button";
            marker.className = "map_marker";
            marker.dataset.area = location.area;
            marker.dataset.id = location.id;
            marker.dataset.name = location.name;
            marker.style.left = `${left}%`;
            marker.style.top = `${top}%`;
            marker.setAttribute("aria-label", `${location.name} marker`);
            marker.innerHTML = "<span class=\"map_marker-dot\"></span>";

            marker.addEventListener("click", () => setPanel(location, marker));
            markersContainer.appendChild(marker);
        });
    }

    function filterMarkers(selectedArea) {
        if (!markersContainer) return;
        const markers = markersContainer.querySelectorAll(".map_marker");
        markers.forEach((marker) => {
            const markerArea = marker.dataset.area;
            if (selectedArea === "all" || markerArea === selectedArea) {
                marker.style.display = "block";
            } else {
                marker.style.display = "none";
            }
        });

        if (activeMarker && selectedArea !== "all" && activeMarker.dataset.area !== selectedArea) {
            clearPanel();
        }
    }

    function filterOffices() {
        const selectedArea = areaSelect.value; 

        offices.forEach(office => {
            const officeArea = office.dataset.area; 

            // Show if "all" or matches selected area
            if (selectedArea === "all" || officeArea === selectedArea) {
                office.style.display = "block";
            } else {
                office.removeAttribute("open");
                office.style.display = "none";
            }
        });

        filterMarkers(selectedArea);
    }

    // Trigger filter when dropdown changes
    areaSelect.addEventListener("change", filterOffices);

    // Initial load
    renderMarkers();
    clearPanel();
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

    const viberLink = document.getElementById("viberLink");
    if (viberLink) {
        viberLink.addEventListener("click", (event) => {
            event.preventDefault();
            openViber();
        });
    }

    const submitBtn = contactFormEl.querySelector(".submit-btn");
    const successPopup = document.getElementById("contactSuccessPopup");
    const successPopupMessage = document.getElementById("contactSuccessMessage");
    const successPopupClose = document.querySelector(".contact-success-close");

    function openSuccessPopup(message) {
        successPopupMessage.textContent = message;
        successPopup.classList.add("show");
        successPopup.setAttribute("aria-hidden", "false");
        successPopup.removeAttribute("inert");
    }

    function closeSuccessPopup() {
        successPopup.classList.remove("show");
        successPopup.setAttribute("aria-hidden", "true");
        successPopup.setAttribute("inert", "");
    }

    if (successPopupClose) {
        successPopupClose.addEventListener("click", closeSuccessPopup);
    }
    if (successPopup) {
        successPopup.addEventListener("click", (event) => {
            if (event.target === successPopup) {
                closeSuccessPopup();
            }
        });
    }
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && successPopup.classList.contains("show")) {
            closeSuccessPopup();
        }
    });

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

        const headers = window.withCsrf
            ? window.withCsrf({ "Content-Type": "application/x-www-form-urlencoded" })
            : { "Content-Type": "application/x-www-form-urlencoded" };

        fetch("/api/contact-us", {
            method: "POST",
            headers,
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
            const successMessage =
                data?.message?.message ||
                data?.message ||
                "Your inquiry has been sent successfully!";
            openSuccessPopup(successMessage);

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
    let lastFocused = null;
    let trapHandler = null;

    function getFocusable(container) {
        if (!container) return [];
        return Array.from(
            container.querySelectorAll('input, select, textarea, button:not([disabled]), [tabindex]:not([tabindex="-1"])')
        ).filter(el => el.offsetParent !== null);
    }

    function trapFocus() {
        const focusable = getFocusable(popup);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        trapHandler = (event) => {
            if (event.key === "Tab") {
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
            if (event.key === "Escape") {
                closePopup();
            }
        };
        document.addEventListener("keydown", trapHandler);
        first.focus();
    }

    function releaseFocus() {
        if (trapHandler) {
            document.removeEventListener("keydown", trapHandler);
            trapHandler = null;
        }
        if (lastFocused) lastFocused.focus();
        lastFocused = null;
    }

    // Function to open popup
    function openPopup() {
        lastFocused = document.activeElement;
        popup.style.display = "block";
        overlay.style.display = "block";
        popup.setAttribute("aria-hidden", "false");
        overlay.setAttribute("aria-hidden", "false");
        popup.removeAttribute("inert");

        // Optional: add slide-up animation
        popup.style.animation = "slideUp 0.4s ease forwards";
        trapFocus();
    }

    // Function to close popup
    function closePopup() {
        popup.style.display = "none";
        overlay.style.display = "none";
        popup.setAttribute("aria-hidden", "true");
        overlay.setAttribute("aria-hidden", "true");
        popup.setAttribute("inert", "");
        releaseFocus();
    }

    // Click handlers
    if (openBtn) openBtn.addEventListener("click", openPopup);
    if (closeBtn) closeBtn.addEventListener("click", closePopup);
    if (overlay) overlay.addEventListener("click", closePopup);
});



