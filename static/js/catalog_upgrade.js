document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const grid = document.getElementById("productsGrid");
    const cards = Array.from(grid?.querySelectorAll(".product-card") || []);
    if (!grid || !cards.length) return;

    const isPlastic = document.body.classList.contains("plastic-catalog-page");
    const categorySelect = document.getElementById("categoryFilter");
    const sidebarCode = document.getElementById("sidebarCode");
    const storageKey = "qcmc-catalog-selections";
    const materialLabel = isPlastic ? "Plasticware / PET & PP lines" : "Styroware / EPS & PSP lines";

    const applicationFor = category => {
        if (isPlastic) {
            if (["kubyertos", "pet-cups", "pp-bowl", "sauce-cups", "traditional-cups", "ice-cream-cups"].includes(category)) {
                return "Dinnerware";
            }
            if (["lids"].includes(category)) return "Packaging component";
            return "Food & industrial packaging";
        }
        if (["industrial", "cooler"].includes(category)) return "Industrial & transport";
        if (["eps-psp-bowl", "noodle-cup", "plates", "styrocup"].includes(category)) return "Dinnerware";
        return "Food packaging";
    };

    const categoryLabel = category => {
        const option = Array.from(categorySelect?.options || []).find(item => item.value === category);
        return option?.textContent?.trim() || category.replaceAll("-", " ");
    };

    const productFromCard = card => ({
        id: `${isPlastic ? "plastic" : "styro"}:${card.dataset.name || ""}:${card.dataset.code || ""}`,
        name: card.dataset.name || "Product",
        code: card.dataset.code || "N/A",
        category: categoryLabel(card.dataset.category || ""),
        application: applicationFor(card.dataset.category || ""),
        material: materialLabel,
        image: card.querySelector("img")?.currentSrc || card.querySelector("img")?.src || ""
    });

    let state = { compare: [], inquiry: [] };
    try {
        state = { ...state, ...JSON.parse(sessionStorage.getItem(storageKey) || "{}") };
    } catch (_error) {
        state = { compare: [], inquiry: [] };
    }
    state.compare = Array.isArray(state.compare) ? state.compare.slice(0, 3) : [];
    state.inquiry = Array.isArray(state.inquiry) ? state.inquiry.slice(0, 8) : [];

    const dock = document.createElement("aside");
    dock.className = "catalog-selection-dock";
    dock.setAttribute("aria-label", "Selected products");
    dock.innerHTML = `
        <div class="catalog-selection-summary">
            <span class="catalog-selection-kicker">Product workspace</span>
            <strong id="catalogSelectionCount">No products selected</strong>
            <span id="catalogSelectionNotice" class="catalog-selection-notice" aria-live="polite"></span>
        </div>
        <div class="catalog-selection-actions">
            <button type="button" id="catalogCompareButton">Compare <span>0</span></button>
            <button type="button" id="catalogInquiryButton">Inquiry list <span>0</span></button>
            <button type="button" id="catalogClearButton" class="catalog-clear-button">Clear</button>
        </div>
    `;
    document.body.appendChild(dock);

    const compareModal = document.createElement("div");
    compareModal.className = "catalog-compare-modal";
    compareModal.setAttribute("aria-hidden", "true");
    compareModal.setAttribute("inert", "");
    compareModal.innerHTML = `
        <section class="catalog-compare-dialog" role="dialog" aria-modal="true" aria-labelledby="catalogCompareTitle">
            <header>
                <div>
                    <span class="site-eyebrow">Product comparison</span>
                    <h2 id="catalogCompareTitle">Compare selected products</h2>
                </div>
                <button type="button" class="catalog-compare-close" aria-label="Close comparison">&times;</button>
            </header>
            <div id="catalogCompareGrid" class="catalog-compare-grid"></div>
        </section>
    `;
    document.body.appendChild(compareModal);

    const compareButton = dock.querySelector("#catalogCompareButton");
    const inquiryButton = dock.querySelector("#catalogInquiryButton");
    const clearButton = dock.querySelector("#catalogClearButton");
    const count = dock.querySelector("#catalogSelectionCount");
    const notice = dock.querySelector("#catalogSelectionNotice");
    const compareGrid = compareModal.querySelector("#catalogCompareGrid");
    const compareClose = compareModal.querySelector(".catalog-compare-close");

    const save = () => sessionStorage.setItem(storageKey, JSON.stringify(state));
    const contains = (list, id) => list.some(item => item.id === id);

    const announce = message => {
        notice.textContent = message;
        window.clearTimeout(announce.timer);
        announce.timer = window.setTimeout(() => {
            notice.textContent = "";
        }, 2200);
    };

    const syncCardButtons = () => {
        cards.forEach(card => {
            const product = productFromCard(card);
            const compare = card.querySelector(".catalog-card-compare");
            const inquiry = card.querySelector(".catalog-card-inquiry");
            compare?.classList.toggle("is-selected", contains(state.compare, product.id));
            compare?.setAttribute("aria-pressed", String(contains(state.compare, product.id)));
            inquiry?.classList.toggle("is-selected", contains(state.inquiry, product.id));
            inquiry?.setAttribute("aria-pressed", String(contains(state.inquiry, product.id)));
        });
    };

    const renderDock = () => {
        const unique = new Set([...state.compare, ...state.inquiry].map(item => item.id)).size;
        count.textContent = unique
            ? `${unique} product${unique === 1 ? "" : "s"} selected`
            : "No products selected";
        compareButton.querySelector("span").textContent = state.compare.length;
        inquiryButton.querySelector("span").textContent = state.inquiry.length;
        compareButton.disabled = state.compare.length < 2;
        inquiryButton.disabled = state.inquiry.length < 1;
        dock.classList.toggle("is-visible", unique > 0);
        syncCardButtons();
        save();
    };

    const toggleProduct = (key, product, maximum) => {
        const list = state[key];
        const existing = list.findIndex(item => item.id === product.id);
        if (existing >= 0) {
            list.splice(existing, 1);
            announce(`${product.name} removed.`);
        } else if (list.length >= maximum) {
            announce(`Choose up to ${maximum} products.`);
        } else {
            list.push(product);
            announce(`${product.name} added.`);
        }
        renderDock();
    };

    cards.forEach(card => {
        const product = productFromCard(card);
        card.dataset.application = product.application;
        card.dataset.material = product.material;

        const meta = card.querySelector(".product-card-meta");
        if (meta && !meta.querySelector(".product-card-facts")) {
            const facts = document.createElement("div");
            facts.className = "product-card-facts";
            facts.innerHTML = `<span>${product.application}</span><span>${product.material.split(" / ")[0]}</span>`;
            meta.appendChild(facts);

            const actions = document.createElement("div");
            actions.className = "catalog-card-actions";
            const details = document.createElement("button");
            details.type = "button";
            details.className = "catalog-card-details";
            details.textContent = "Details";
            const compare = document.createElement("button");
            compare.type = "button";
            compare.className = "catalog-card-compare";
            compare.textContent = "Compare";
            compare.setAttribute("aria-pressed", "false");
            const inquiry = document.createElement("button");
            inquiry.type = "button";
            inquiry.className = "catalog-card-inquiry";
            inquiry.textContent = "Add to inquiry";
            inquiry.setAttribute("aria-pressed", "false");
            actions.append(details, compare, inquiry);
            meta.appendChild(actions);

            details.addEventListener("click", event => {
                event.stopPropagation();
                card.click();
            });
            compare.addEventListener("click", event => {
                event.stopPropagation();
                toggleProduct("compare", productFromCard(card), 3);
            });
            inquiry.addEventListener("click", event => {
                event.stopPropagation();
                toggleProduct("inquiry", productFromCard(card), 8);
            });
        }

        card.addEventListener("click", () => {
            let facts = document.getElementById("sidebarFacts");
            if (!facts) {
                facts = document.createElement("dl");
                facts.id = "sidebarFacts";
                facts.className = "sidebar-product-facts";
                sidebarCode?.insertAdjacentElement("afterend", facts);
            }
            facts.replaceChildren();
            [
                ["Category", product.category],
                ["Application", product.application],
                ["Material", product.material]
            ].forEach(([label, value]) => {
                const term = document.createElement("dt");
                const description = document.createElement("dd");
                term.textContent = label;
                description.textContent = value;
                facts.append(term, description);
            });
        });
    });

    const closeComparison = () => {
        compareModal.classList.remove("show");
        compareModal.setAttribute("aria-hidden", "true");
        compareModal.setAttribute("inert", "");
        document.body.classList.remove("catalog-compare-open");
        compareButton.focus({ preventScroll: true });
    };

    const openComparison = () => {
        compareGrid.replaceChildren();
        state.compare.forEach(product => {
            const article = document.createElement("article");
            const image = document.createElement("img");
            image.src = product.image;
            image.alt = product.name;
            const title = document.createElement("h3");
            title.textContent = product.name;
            const details = document.createElement("dl");
            [
                ["Code", product.code],
                ["Category", product.category],
                ["Application", product.application],
                ["Material", product.material]
            ].forEach(([label, value]) => {
                const term = document.createElement("dt");
                const description = document.createElement("dd");
                term.textContent = label;
                description.textContent = value;
                details.append(term, description);
            });
            article.append(image, title, details);
            compareGrid.appendChild(article);
        });
        compareModal.classList.add("show");
        compareModal.setAttribute("aria-hidden", "false");
        compareModal.removeAttribute("inert");
        document.body.classList.add("catalog-compare-open");
        compareClose.focus({ preventScroll: true });
    };

    compareButton.addEventListener("click", openComparison);
    inquiryButton.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("catalog:inquire", {
            detail: { products: state.inquiry.map(item => item.name) }
        }));
    });
    clearButton.addEventListener("click", () => {
        state.compare = [];
        state.inquiry = [];
        renderDock();
    });
    compareClose.addEventListener("click", closeComparison);
    compareModal.addEventListener("click", event => {
        if (event.target === compareModal) closeComparison();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && compareModal.classList.contains("show")) closeComparison();
    });

    renderDock();
});
