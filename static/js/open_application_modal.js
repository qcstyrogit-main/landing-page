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

    // ── Form submission ─────────────────────────────────────────
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!selectedFile) {
            alert('Please attach your resume or portfolio.');
            return;
        }

        const csrfToken = document.getElementById('oaCsrfToken')?.value || '';
        const headers   = {};
        if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

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

            if (res.ok && result.message === 'Sent') {
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
