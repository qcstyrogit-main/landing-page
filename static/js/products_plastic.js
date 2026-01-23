document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("searchInput");
    const categoryFilter = document.getElementById("categoryFilter");
    const productsGrid = document.getElementById("productsGrid");
    const products = Array.from(productsGrid.querySelectorAll(".product-card"));
    const header = document.querySelector(".plastic-header");

    const itemsPerPage = 15;
    let currentPage = 1;
    let filteredProducts = products;

    // --- Read URL parameters ---
    const urlParams = new URLSearchParams(window.location.search);
    const urlPage = parseInt(urlParams.get("page")) || 1;
    const urlSearch = urlParams.get("search") || "";
    const urlCategory = urlParams.get("category") || "all";

    // Apply URL values into inputs
    searchInput.value = urlSearch;
    categoryFilter.value = urlCategory !== "" ? urlCategory : "all";
    currentPage = urlPage;

    // Create pagination container
    const pagination = document.createElement("div");
    pagination.id = "pagination";
    pagination.classList.add("pagination");
    productsGrid.parentNode.insertBefore(pagination, productsGrid.nextSibling);

    // --- URL & scroll helpers ---
    function updateURL() {
        const params = new URLSearchParams();
        if (searchInput.value.trim() !== "") params.set("search", searchInput.value.trim());
        if (categoryFilter.value !== "all") params.set("category", categoryFilter.value);
        params.set("page", currentPage);
        history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    }

    function scrollToGridTop() {
        const headerHeight = header.offsetHeight;
        const gridPosition = productsGrid.getBoundingClientRect().top + window.scrollY;
        const offsetPosition = gridPosition - headerHeight - 20;
        window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    }

    // --- Display & Pagination ---
    function displayProducts() {
        products.forEach(p => (p.style.display = "none"));
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        filteredProducts.slice(start, end).forEach(p => (p.style.display = "block"));
        renderPagination();
        updateURL();
        scrollToGridTop();
    }

    function renderPagination() {
        pagination.innerHTML = "";
        const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
        if (totalPages <= 1) return;

        const createBtn = (text, disabled, onClick, active = false) => {
            const btn = document.createElement("button");
            btn.textContent = text;
            btn.disabled = disabled;
            if (active) btn.classList.add("active");
            btn.addEventListener("click", onClick);
            return btn;
        };

        // Prev
        pagination.appendChild(createBtn("Prev", currentPage === 1, () => { currentPage--; displayProducts(); }));

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            pagination.appendChild(createBtn(i, false, () => { currentPage = i; displayProducts(); }, i === currentPage));
        }

        // Next
        pagination.appendChild(createBtn("Next", currentPage === totalPages, () => { currentPage++; displayProducts(); }));
    }

    // --- Filtering ---
    function filterProducts() {
        const searchText = searchInput.value.toLowerCase().trim();
        const keywords = searchText.split(/\s+/);
        const category = categoryFilter.value;

        filteredProducts = products.filter(product => {
            const name = product.dataset.name.toLowerCase();
            const code = (product.dataset.code || "").toLowerCase();
            const prodCategory = product.dataset.category;
            const matchesCategory = category === "all" || prodCategory === category;
            const matchesSearch = keywords.every(kw => name.includes(kw) || code.includes(kw));
            return matchesCategory && matchesSearch;
        });

        currentPage = 1;
        displayProducts();
    }

    searchInput.addEventListener("input", filterProducts);
    categoryFilter.addEventListener("change", filterProducts);

    filterProducts();
    currentPage = urlPage;
    displayProducts();
});

document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.getElementById("productSidebar");
    const overlay = document.getElementById("sidebarOverlay");
    const sidebarImage = document.getElementById("sidebarImage");
    const sidebarName = document.getElementById("sidebarName");
    const sidebarCode = document.getElementById("sidebarCode");
    const closeBtn = document.getElementById("sidebarClose");
    const cards = document.querySelectorAll(".product-card");

    const inquireBtn = document.getElementById("sidebarInquireBtn");
    const productView = document.getElementById("productView");
    const inquiryForm = document.getElementById("inquiryForm");
    const inqProduct = document.getElementById("inqProduct");
    const inquiryFormEl = document.getElementById("productInquiryForm");

    const submitBtn = inquiryFormEl.querySelector(".submit-btn");
    const successPopup = document.getElementById("inquirySuccessPopup");
    const successPopupMessage = document.getElementById("inquiryPopupMessage");
    const successPopupClose = successPopup.querySelector(".popup-close");

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

    successPopupClose.addEventListener("click", closeSuccessPopup);
    successPopup.addEventListener("click", (event) => {
        if (event.target === successPopup) {
            closeSuccessPopup();
        }
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && successPopup.classList.contains("show")) {
            closeSuccessPopup();
        }
    });

    // --- Open sidebar on card click ---
    cards.forEach(card => {
        card.addEventListener("click", () => {
            sidebarImage.src = card.querySelector("img").src;
            sidebarName.innerText = card.dataset.name || "No Name";
            sidebarCode.innerText = "Code: " + (card.dataset.code || "N/A");

            // Reset view
            productView.style.display = "block";
            inquiryForm.style.display = "none";

            sidebar.classList.add("open");
            overlay.classList.add("show");
        });
    });

    // --- Click Inquire button to show form ---
    inquireBtn.addEventListener("click", () => {
        productView.style.display = "none";
        inquiryForm.style.display = "block";

        // Auto-fill product name
        inqProduct.value = sidebarName.innerText;

        // Make submit sticky on mobile
        if (window.innerWidth <= 768) {
            submitBtn.style.position = "sticky";
            submitBtn.style.bottom = "10px";
            submitBtn.style.zIndex = "999";
        }
    });

   inquiryFormEl.addEventListener("submit", (e) => {
    e.preventDefault();

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";

    const inqName = document.getElementById("inqName");
    const inqEmail = document.getElementById("inqEmail");
    const inqContact = document.getElementById("inqContact");
    const inqMessage = document.getElementById("inqMessage");
    const inqHp = document.getElementById("inqHp");


    const headers = window.withCsrf
        ? window.withCsrf({ "Content-Type": "application/x-www-form-urlencoded" })
        : { "Content-Type": "application/x-www-form-urlencoded" };

    fetch("/api/send-inquiry-mc", {
        method: "POST",
        headers,
        body: new URLSearchParams({
            name: inqName.value.trim(),
            email: inqEmail.value.trim(),
            contact: inqContact.value.trim(),
            product: inqProduct.value.trim(),
            message: inqMessage.value.trim(),
            hp: inqHp.value
        })
    })


    .then(res => res.json())
    .then(data => {
        const successMessage = data?.message?.message || data?.message || "Inquiry submitted successfully!";
        openSuccessPopup(successMessage);
        inquiryFormEl.reset();
        inquiryForm.style.display = "none";
        productView.style.display = "block";
    })
    .catch(err => {
        console.error(err);
        alert("Failed to submit inquiry. Please try again.");
    })
    .finally(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Inquiry";
    });
});

    // --- Close sidebar ---
    function closeSidebar() {
        sidebar.classList.remove("open");
        overlay.classList.remove("show");
    }

    closeBtn.addEventListener("click", closeSidebar);
    overlay.addEventListener("click", closeSidebar);
});
