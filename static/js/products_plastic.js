document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("searchInput");
    const categoryFilter = document.getElementById("categoryFilter");
    const productsGrid = document.getElementById("productsGrid");
    const products = Array.from(productsGrid.querySelectorAll(".product-card"));
    const header = document.querySelector(".plastic-header");
    const resultsCount = document.getElementById("resultsCount");
    const activeFilters = document.getElementById("activeFilters");

    products.forEach(product => {
        if (product.querySelector(".product-card-meta")) return;

        const meta = document.createElement("div");
        meta.className = "product-card-meta";

        const name = document.createElement("h3");
        name.textContent = product.dataset.name || "Product";
        meta.appendChild(name);

        if (product.dataset.code) {
            const code = document.createElement("span");
            code.className = "product-card-code";
            code.textContent = product.dataset.code;
            meta.appendChild(code);
        }

        product.appendChild(meta);
    });

    const itemsPerPage = 16;
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

    function createCatalogDropdown(select) {
        const container = select.closest(".filter-select");
        const label = container?.querySelector("label");
        if (!container || container.classList.contains("custom-ready")) return;

        const trigger = document.createElement("button");
        const value = document.createElement("span");
        const chevron = document.createElement("span");
        const menu = document.createElement("div");

        trigger.type = "button";
        trigger.id = `${select.id}Trigger`;
        trigger.className = "catalog-select-trigger";
        trigger.setAttribute("aria-haspopup", "listbox");
        trigger.setAttribute("aria-expanded", "false");

        value.className = "catalog-select-value";
        value.textContent = select.options[select.selectedIndex]?.text || "All";
        chevron.className = "catalog-select-chevron";
        chevron.setAttribute("aria-hidden", "true");
        trigger.append(value, chevron);

        menu.className = "catalog-select-menu";
        menu.setAttribute("role", "listbox");
        menu.hidden = true;

        Array.from(select.options).forEach(option => {
            const item = document.createElement("button");
            item.type = "button";
            item.className = "catalog-select-option";
            item.dataset.value = option.value;
            item.textContent = option.text;
            item.setAttribute("role", "option");
            item.setAttribute("aria-selected", String(option.selected));
            item.addEventListener("click", () => {
                select.value = option.value;
                select.dispatchEvent(new Event("change", { bubbles: true }));
                closeMenu();
                trigger.focus();
            });
            menu.appendChild(item);
        });

        function syncSelection() {
            value.textContent = select.options[select.selectedIndex]?.text || "All";
            menu.querySelectorAll(".catalog-select-option").forEach(item => {
                item.setAttribute("aria-selected", String(item.dataset.value === select.value));
            });
        }

        function openMenu() {
            const rect = trigger.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom - 12;
            const spaceAbove = rect.top - 12;
            const openAbove = spaceBelow < 220 && spaceAbove > spaceBelow;

            menu.style.left = `${rect.left}px`;
            menu.style.width = `${rect.width}px`;
            menu.style.maxHeight = `${Math.max(160, Math.min(420, openAbove ? spaceAbove : spaceBelow))}px`;
            menu.style.top = openAbove ? "auto" : `${rect.bottom + 7}px`;
            menu.style.bottom = openAbove ? `${window.innerHeight - rect.top + 7}px` : "auto";
            menu.hidden = false;
            trigger.setAttribute("aria-expanded", "true");
            container.classList.add("is-open");
            const selected = menu.querySelector('[aria-selected="true"]');
            selected?.focus({ preventScroll: true });
        }

        function closeMenu() {
            menu.hidden = true;
            trigger.setAttribute("aria-expanded", "false");
            container.classList.remove("is-open");
        }

        trigger.addEventListener("click", () => {
            if (menu.hidden) openMenu();
            else closeMenu();
        });
        trigger.addEventListener("keydown", event => {
            if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key) && menu.hidden) {
                event.preventDefault();
                openMenu();
            }
        });
        menu.addEventListener("keydown", event => {
            const items = Array.from(menu.querySelectorAll(".catalog-select-option"));
            const index = items.indexOf(document.activeElement);
            if (event.key === "Escape") {
                event.preventDefault();
                closeMenu();
                trigger.focus();
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const direction = event.key === "ArrowDown" ? 1 : -1;
                items[(index + direction + items.length) % items.length]?.focus();
            }
        });
        document.addEventListener("click", event => {
            if (!container.contains(event.target) && !menu.contains(event.target)) closeMenu();
        });
        window.addEventListener("resize", closeMenu);
        window.addEventListener("scroll", event => {
            if (!menu.contains(event.target)) closeMenu();
        }, true);
        select.addEventListener("change", syncSelection);

        if (label) label.htmlFor = trigger.id;
        container.appendChild(trigger);
        document.body.appendChild(menu);
        container.classList.add("custom-ready");
        syncSelection();
    }

    createCatalogDropdown(categoryFilter);

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

        if (resultsCount && activeFilters) {
            const filters = [];
            if (category !== "all") {
                const selectedCategory = categoryFilter.options[categoryFilter.selectedIndex]?.text || category;
                filters.push(selectedCategory);
            }
            if (searchText) {
                filters.push(`"${searchInput.value.trim()}"`);
            }
            activeFilters.textContent = filters.length ? `Filters: ${filters.join(" • ")}` : "Filters: All";
            resultsCount.textContent = `Showing ${filteredProducts.length} product${filteredProducts.length === 1 ? "" : "s"}`;
        }

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
    const inquiryModal = document.getElementById("inquiryModal");
    const inquiryModalClose = document.getElementById("inquiryModalClose");
    const inquiryDialog = inquiryModal.querySelector(".product-inquiry-dialog");
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

            sidebar.classList.add("open");
            overlay.classList.add("show");
            document.body.classList.add("product-drawer-open");
            document.body.style.overflow = "hidden";
            sidebar.scrollTop = 0;
        });
    });

    function openInquiryModal(productName = sidebarName.innerText) {
        inqProduct.value = productName;
        closeSidebar();
        inquiryModal.classList.add("show");
        inquiryModal.setAttribute("aria-hidden", "false");
        inquiryModal.removeAttribute("inert");
        document.body.classList.add("product-inquiry-open");
        document.body.style.overflow = "hidden";
        inquiryDialog.scrollTop = 0;
        document.getElementById("inqName")?.focus({ preventScroll: true });
    }

    function closeInquiryModal() {
        inquiryModal.classList.remove("show");
        inquiryModal.setAttribute("aria-hidden", "true");
        inquiryModal.setAttribute("inert", "");
        document.body.classList.remove("product-inquiry-open");
        document.body.style.overflow = "";
    }

    // --- Click Inquire button to open the form modal ---
    inquireBtn.addEventListener("click", () => {
        openInquiryModal();
    });
    window.addEventListener("catalog:inquire", (event) => {
        const products = Array.isArray(event.detail?.products) ? event.detail.products : [];
        if (products.length) openInquiryModal(products.join(", "));
    });
    inquiryModalClose.addEventListener("click", closeInquiryModal);
    inquiryModal.addEventListener("click", (event) => {
        if (event.target === inquiryModal) {
            closeInquiryModal();
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
    const csrfToken = inquiryFormEl.querySelector('input[name="csrf_token"]')?.value || "";
    const altchaToken = inquiryFormEl.querySelector('input[name="altcha"]')?.value?.trim() || "";

    if (!altchaToken) {
        alert("Please complete the human verification before sending.");
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Inquiry";
        return;
    }

    const verifyHeaders = window.withCsrf
        ? window.withCsrf({ "Content-Type": "application/json" })
        : { "Content-Type": "application/json" };
    if (csrfToken && !verifyHeaders["X-CSRF-Token"]) {
        verifyHeaders["X-CSRF-Token"] = csrfToken;
    }

    const formHeaders = window.withCsrf
        ? window.withCsrf({ "Content-Type": "application/x-www-form-urlencoded" })
        : { "Content-Type": "application/x-www-form-urlencoded" };
    if (csrfToken && !formHeaders["X-CSRF-Token"]) {
        formHeaders["X-CSRF-Token"] = csrfToken;
    }

    fetch("/api/altcha/verify", {
        method: "POST",
        headers: verifyHeaders,
        body: JSON.stringify({
            altcha: altchaToken,
            csrf_token: csrfToken
        })
    })
    .then(res => res.json())
    .then(result => {
        if (!result?.verified) {
            throw new Error("ALTCHA verification failed.");
        }
        return fetch("/api/send-inquiry-qc", {
            method: "POST",
            headers: formHeaders,
            body: new URLSearchParams({
                name: inqName.value.trim(),
                email: inqEmail.value.trim(),
                contact: inqContact.value.trim(),
                product: inqProduct.value.trim(),
                message: inqMessage.value.trim(),
                hp: inqHp.value
            })
        });
    })
    .then(res => res.json())
    .then(data => {
        const successMessage = data?.message?.message || data?.message || "Inquiry submitted successfully!";
        closeInquiryModal();
        openSuccessPopup(successMessage);
        inquiryFormEl.reset();
    })
    .catch(err => {
        console.error(err);
        alert("Failed to submit inquiry. Please verify and try again.");
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
        document.body.classList.remove("product-drawer-open");
        document.body.style.overflow = "";
    }

    closeBtn.addEventListener("click", closeSidebar);
    overlay.addEventListener("click", closeSidebar);
    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || successPopup.classList.contains("show")) {
            return;
        }
        if (inquiryModal.classList.contains("show")) {
            closeInquiryModal();
        } else if (sidebar.classList.contains("open")) {
            closeSidebar();
        }
    });
});
