document.addEventListener('DOMContentLoaded', () => {
    const overlay      = document.getElementById('oaOverlay');
    if (!overlay) return;

    const openBtn      = document.getElementById('openApplicationBtn');
    const closeBtn     = document.getElementById('oaCloseBtn');
    const cancelBtn    = document.getElementById('oaCancelBtn');
    const form         = document.getElementById('oaForm');
    const dropZone     = document.getElementById('oaDropZone');
    const fileInput    = document.getElementById('oaFileInput');
    const filePreview  = document.getElementById('oaFilePreview');
    const fileNameSpan = document.getElementById('oaFileName');
    const removeBtn    = document.getElementById('oaRemoveFile');
    const chooseBtn    = document.getElementById('oaChooseFile');
    const dzContent    = document.getElementById('oaDropZoneContent');
    const submitBtn    = document.getElementById('oaSubmitBtn');
    const successView  = document.getElementById('oaSuccess');
    const formView     = document.getElementById('oaFormView');

    let selectedFile = null;

    // ── Modal open / close ──────────────────────────────────────
    const openModal = () => {
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        document.getElementById('oaName')?.focus();
    };

    const closeModal = () => {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
        setTimeout(() => {
            form?.reset();
            selectedFile = null;
            if (fileInput)    fileInput.value = '';
            if (filePreview)  filePreview.style.display = 'none';
            if (dzContent)    dzContent.style.display = 'flex';
            if (successView)  successView.style.display = 'none';
            if (formView)     formView.style.display = 'block';
            if (submitBtn) {
                submitBtn.disabled    = false;
                submitBtn.textContent = 'Submit Application';
            }
        }, 300);
    };

    openBtn?.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
    });

    // ── File handling ───────────────────────────────────────────
    const ALLOWED_TYPES = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    const handleFile = (file) => {
        if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(pdf|doc|docx)$/i)) {
            alert('Please upload a PDF or Word document.');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            alert('File size must be under 10 MB.');
            return;
        }
        selectedFile = file;
        fileNameSpan.textContent = file.name;
        dzContent.style.display    = 'none';
        filePreview.style.display  = 'flex';
    };

    // Click anywhere on drop zone (except buttons inside) → open file picker
    dropZone?.addEventListener('click', (e) => {
        if (chooseBtn && (e.target === chooseBtn || chooseBtn.contains(e.target))) return;
        if (!selectedFile) fileInput.click();
    });
    chooseBtn?.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });

    ['dragover', 'dragleave', 'drop'].forEach(ev => {
        dropZone?.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); });
    });
    dropZone?.addEventListener('dragover',  () => dropZone.classList.add('drag-over'));
    dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone?.addEventListener('drop', (e) => {
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });

    fileInput?.addEventListener('change', () => {
        if (fileInput.files.length) handleFile(fileInput.files[0]);
    });

    removeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedFile = null;
        if (fileInput) fileInput.value = '';
        filePreview.style.display = 'none';
        dzContent.style.display   = 'flex';
    });

    // ── Address Autocomplete (PSGC) ────────────────────────────
    const oaAddressInput       = document.getElementById('oaAddress');
    const oaAddressSuggestions = document.getElementById('oaAddressSuggestions');

    if (oaAddressInput && oaAddressSuggestions) {
        let oaDebounce    = null;
        let oaPsgcCache   = null;
        let oaBrgyCache   = null;

        const oaClose = () => {
            oaAddressSuggestions.innerHTML = '';
            oaAddressSuggestions.style.display = 'none';
            oaAddressInput.setAttribute('aria-expanded', 'false');
        };

        const oaStatus = (msg) => {
            oaAddressSuggestions.innerHTML = `<div class="oa-address-status">${msg}</div>`;
            oaAddressSuggestions.style.display = 'block';
            oaAddressInput.setAttribute('aria-expanded', 'true');
        };

        const oaLoadPsgc = async () => {
            if (oaPsgcCache) return oaPsgcCache;
            const [rRes, pRes, cRes] = await Promise.all([
                fetch('https://psgc.gitlab.io/api/regions/'),
                fetch('https://psgc.gitlab.io/api/provinces/'),
                fetch('https://psgc.gitlab.io/api/cities-municipalities/')
            ]);
            const regions   = await rRes.json();
            const provinces = await pRes.json();
            const cities    = await cRes.json();
            oaPsgcCache = {
                regions, provinces, cities,
                regionMap:   new Map(regions.map(r   => [r.code, r.name || r.regionName])),
                provinceMap: new Map(provinces.map(p => [p.code, p.name])),
                cityMap:     new Map(cities.map(c    => [c.code, { name: c.name, provinceCode: c.provinceCode, regionCode: c.regionCode }]))
            };
            return oaPsgcCache;
        };

        const oaLoadBrgy = async () => {
            if (oaBrgyCache) return oaBrgyCache;
            const r = await fetch('https://psgc.gitlab.io/api/barangays/');
            const d = await r.json();
            oaBrgyCache = Array.isArray(d) ? d : [];
            return oaBrgyCache;
        };

        const oaRender = (items) => {
            oaAddressSuggestions.innerHTML = '';
            if (!items.length) { oaStatus('No matches found.'); return; }
            items.slice(0, 8).forEach(item => {
                if (!item.label) return;
                const btn = document.createElement('button');
                btn.type        = 'button';
                btn.textContent = item.label;
                btn.addEventListener('click', () => {
                    oaAddressInput.value = item.label;
                    oaClose();
                });
                oaAddressSuggestions.appendChild(btn);
            });
            if (oaAddressSuggestions.children.length) {
                oaAddressSuggestions.style.display = 'block';
                oaAddressInput.setAttribute('aria-expanded', 'true');
            } else {
                oaStatus('No matches found.');
            }
        };

        const oaFetch = async (query) => {
            try {
                oaStatus('Loading suggestions…');
                const data = await oaLoadPsgc();
                const q    = query.toLowerCase();

                const cityMatches = data.cities
                    .filter(c => (c.name || '').toLowerCase().includes(q))
                    .map(c => {
                        const prov = data.provinceMap.get(c.provinceCode);
                        const reg  = data.regionMap.get(c.regionCode);
                        const sfx  = [prov, reg].filter(Boolean).join(', ');
                        return { label: sfx ? `${c.name} (${sfx})` : c.name };
                    });

                const provMatches = data.provinces
                    .filter(p => (p.name || '').toLowerCase().includes(q))
                    .map(p => {
                        const reg = data.regionMap.get(p.regionCode);
                        return { label: reg ? `${p.name} (${reg})` : p.name };
                    });

                const regMatches = data.regions
                    .filter(r => ((r.name || r.regionName || '')).toLowerCase().includes(q))
                    .map(r => ({ label: r.name || r.regionName }));

                const baseItems = [...cityMatches, ...provMatches, ...regMatches];
                oaRender(baseItems);

                if (query.length >= 4) {
                    const snap = query;
                    oaLoadBrgy().then(barangays => {
                        if (oaAddressInput.value.trim() !== snap) return;
                        const brgyMatches = barangays
                            .filter(b => (b.name || '').toLowerCase().includes(q))
                            .map(b => {
                                const cityCode = b.cityCode || b.municipalityCode || b.cityMunicipalityCode;
                                const city     = cityCode ? data.cityMap.get(cityCode) : null;
                                const cityName = city ? city.name : null;
                                const prov     = city?.provinceCode ? data.provinceMap.get(city.provinceCode) : data.provinceMap.get(b.provinceCode);
                                const reg      = city?.regionCode   ? data.regionMap.get(city.regionCode)   : data.regionMap.get(b.regionCode);
                                const sfx      = [cityName, prov, reg].filter(Boolean).join(', ');
                                return { label: sfx ? `${b.name} (${sfx})` : b.name };
                            });
                        oaRender([...brgyMatches, ...baseItems]);
                    }).catch(() => oaRender(baseItems));
                }
            } catch (err) {
                oaClose();
            }
        };

        oaAddressInput.addEventListener('input', () => {
            const q = oaAddressInput.value.trim();
            if (q.length < 3) { oaClose(); return; }
            if (oaDebounce) clearTimeout(oaDebounce);
            oaDebounce = setTimeout(() => oaFetch(q), 300);
        });

        oaAddressInput.addEventListener('blur', () => {
            setTimeout(oaClose, 150);
        });
    }

    // ── Form submission ─────────────────────────────────────────
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!selectedFile) {
            alert('Please attach your resume or portfolio.');
            return;
        }

        // Altcha verification
        const altchaToken = form.querySelector('input[name="altcha"]')?.value?.trim() || '';
        if (!altchaToken) {
            alert('Please complete the human verification before submitting.');
            return;
        }

        const csrfToken = document.getElementById('oaCsrfToken')?.value || '';
        const headers   = {};
        if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

        // Verify altcha first
        try {
            const verifyRes    = await fetch('/api/altcha/verify', {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ altcha: altchaToken, csrf_token: csrfToken })
            });
            const verifyResult = await verifyRes.json();
            if (!verifyResult?.verified) {
                alert('Human verification failed. Please try again.');
                return;
            }
        } catch (err) {
            console.error('Altcha verify error:', err);
            alert('Verification error. Please try again.');
            return;
        }

        const data = new FormData();
        data.append('oa_name',    document.getElementById('oaName').value.trim());
        data.append('oa_email',   document.getElementById('oaEmail').value.trim());
        data.append('oa_address', document.getElementById('oaAddress').value.trim());
        data.append('oa_contact', document.getElementById('oaContact').value.trim());
        data.append('oa_pitch',   document.getElementById('oaPitch').value.trim());
        data.append('oa_file',    selectedFile);
        data.append('csrf_token', csrfToken);

        submitBtn.disabled    = true;
        submitBtn.textContent = 'Submitting…';

        try {
            const res    = await fetch('/api/open-application', { method: 'POST', headers, body: data });
            const result = await res.json();
            const msg    = result?.message;
            const ok     = msg === 'Sent' || msg?.message === 'Sent';

            if (res.ok && ok) {
                formView.style.display    = 'none';
                successView.style.display = 'block';
                setTimeout(closeModal, 3500);
            } else {
                alert('Error: ' + (result.error || 'Submission failed. Please try again.'));
                submitBtn.disabled    = false;
                submitBtn.textContent = 'Submit Application';
            }
        } catch (err) {
            console.error('Open application error:', err);
            alert('Connection error. Please try again.');
            submitBtn.disabled    = false;
            submitBtn.textContent = 'Submit Application';
        }
    });
});
