document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('applicationForm');
    const jobIdDisplay = document.getElementById('jobIdDisplay');
    const addressInput = document.getElementById('address');
    const addressSuggestions = document.getElementById('addressSuggestions');
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

    // Address autocomplete (PSGC)
    if (addressInput && addressSuggestions) {
        let debounceTimer = null;
        let activeRequest = null;
        let psgcCache = null;
        let barangayCache = null;

        const closeSuggestions = () => {
            addressSuggestions.innerHTML = '';
            addressSuggestions.style.display = 'none';
            addressInput.setAttribute('aria-expanded', 'false');
        };

        const showStatus = (message) => {
            addressSuggestions.innerHTML = '';
            const status = document.createElement('div');
            status.className = 'address-status';
            status.textContent = message;
            addressSuggestions.appendChild(status);
            addressSuggestions.style.display = 'block';
            addressInput.setAttribute('aria-expanded', 'true');
        };

        const loadPsgcData = async () => {
            if (psgcCache) return psgcCache;
            const [regionsRes, provincesRes, citiesRes] = await Promise.all([
                fetch("https://psgc.gitlab.io/api/regions/"),
                fetch("https://psgc.gitlab.io/api/provinces/"),
                fetch("https://psgc.gitlab.io/api/cities-municipalities/")
            ]);

            const regions = await regionsRes.json();
            const provinces = await provincesRes.json();
            const cities = await citiesRes.json();

            const regionMap = new Map(regions.map((r) => [r.code, r.name || r.regionName]));
            const provinceMap = new Map(provinces.map((p) => [p.code, p.name]));
            const cityMap = new Map(cities.map((c) => [
                c.code,
                {
                    name: c.name,
                    provinceCode: c.provinceCode,
                    regionCode: c.regionCode
                }
            ]));

            psgcCache = {
                regions,
                provinces,
                cities,
                regionMap,
                provinceMap,
                cityMap
            };

            return psgcCache;
        };

        const loadBarangays = async () => {
            if (barangayCache) return barangayCache;
            const response = await fetch("https://psgc.gitlab.io/api/barangays/");
            const data = await response.json();
            barangayCache = Array.isArray(data) ? data : [];
            return barangayCache;
        };

        const renderSuggestions = (items) => {
            addressSuggestions.innerHTML = '';
            if (!items.length) {
                showStatus('No matches found.');
                return;
            }

            items.slice(0, 8).forEach((item) => {
                const label = item.label;
                if (!label) return;
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = label;
                button.addEventListener('click', () => {
                    addressInput.value = label;
                    closeSuggestions();
                });
                addressSuggestions.appendChild(button);
            });

            if (addressSuggestions.children.length) {
                addressSuggestions.style.display = 'block';
                addressInput.setAttribute('aria-expanded', 'true');
            } else {
                showStatus('No matches found.');
            }
        };

        const fetchSuggestions = async (query) => {
            if (activeRequest && typeof activeRequest.abort === 'function') {
                activeRequest.abort();
            }
            const controller = new AbortController();
            activeRequest = controller;

            try {
                showStatus('Loading suggestions...');
                const data = await loadPsgcData();
                const q = query.toLowerCase();

                const cityMatches = data.cities
                    .filter((c) => (c.name || "").toLowerCase().includes(q))
                    .map((c) => {
                        const province = data.provinceMap.get(c.provinceCode);
                        const region = data.regionMap.get(c.regionCode);
                        const suffix = [province, region].filter(Boolean).join(", ");
                        return {
                            label: suffix ? `${c.name} (${suffix})` : c.name
                        };
                    });

                const provinceMatches = data.provinces
                    .filter((p) => (p.name || "").toLowerCase().includes(q))
                    .map((p) => {
                        const region = data.regionMap.get(p.regionCode);
                        const suffix = region ? `(${region})` : "";
                        return {
                            label: suffix ? `${p.name} ${suffix}` : p.name
                        };
                    });

                const regionMatches = data.regions
                    .filter((r) => ((r.name || r.regionName || "")).toLowerCase().includes(q))
                    .map((r) => ({
                        label: r.name || r.regionName
                    }));

                const baseItems = [...cityMatches, ...provinceMatches, ...regionMatches];
                renderSuggestions(baseItems);

                if (query.length >= 4) {
                    const currentQuery = query;
                    loadBarangays().then((barangays) => {
                        if (addressInput.value.trim() !== currentQuery) return;
                        const barangayMatches = barangays
                            .filter((b) => (b.name || "").toLowerCase().includes(q))
                            .map((b) => {
                                const cityCode = b.cityCode || b.municipalityCode || b.cityMunicipalityCode;
                                const city = cityCode ? data.cityMap.get(cityCode) : null;
                                const cityName = city ? city.name : null;
                                const province = city && city.provinceCode
                                    ? data.provinceMap.get(city.provinceCode)
                                    : data.provinceMap.get(b.provinceCode);
                                const region = city && city.regionCode
                                    ? data.regionMap.get(city.regionCode)
                                    : data.regionMap.get(b.regionCode);
                                const suffix = [cityName, province, region].filter(Boolean).join(", ");
                                return {
                                    label: suffix ? `${b.name} (${suffix})` : b.name
                                };
                            });

                        const items = [...barangayMatches, ...baseItems];
                        renderSuggestions(items);
                    }).catch(() => {
                        if (addressInput.value.trim() !== currentQuery) return;
                        renderSuggestions(baseItems);
                    });
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    closeSuggestions();
                }
            }
        };

        addressInput.addEventListener('input', () => {
            const query = addressInput.value.trim();
            if (query.length < 3) {
                closeSuggestions();
                return;
            }

            if (debounceTimer) window.clearTimeout(debounceTimer);
            debounceTimer = window.setTimeout(() => {
                fetchSuggestions(query);
            }, 300);
        });

        addressInput.addEventListener('blur', () => {
            window.setTimeout(() => {
                closeSuggestions();
            }, 150);
        });
    }

    // Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!document.getElementById('privacy-check').checked) {
            alert("Please agree to the Data Privacy Statement.");
            return;
        }

        const altchaToken = form.querySelector('input[name="altcha"]')?.value?.trim() || "";
        if (!altchaToken) {
            alert("Please complete the human verification before saving.");
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
            const csrfToken = form.querySelector('input[name="csrf_token"]')?.value || "";
            const headers = window.withCsrf
                ? window.withCsrf({ "Content-Type": "application/json" })
                : { "Content-Type": "application/json" };
            if (csrfToken && !headers["X-CSRF-Token"]) {
                headers["X-CSRF-Token"] = csrfToken;
            }

            const verifyResponse = await fetch("/api/altcha/verify", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    altcha: altchaToken,
                    csrf_token: csrfToken
                })
            });
            const verifyResult = await verifyResponse.json();
            if (!verifyResult?.verified) {
                alert("Human verification failed. Please try again.");
                return;
            }

            const response = await fetch("/api/submit-job-applicant", {
                method: "POST",
                headers,
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
