document.addEventListener("DOMContentLoaded", () => {
    const slide = document.querySelector(".events-slide");
    const nextBtn = document.querySelector(".events-btn.next");
    const prevBtn = document.querySelector(".events-btn.prev");

    if (slide) {
        function rotateNext() {
            const items = slide.querySelectorAll(".event-item");
            if (items.length <= 1) return;
            slide.appendChild(items[0]);
        }

        function rotatePrev() {
            const items = slide.querySelectorAll(".event-item");
            if (items.length <= 1) return;
            slide.prepend(items[items.length - 1]);
        }

        nextBtn?.addEventListener("click", rotateNext);
        prevBtn?.addEventListener("click", rotatePrev);
    }

    const aboutCards = document.querySelectorAll(".about-us-cards .about-card");
    aboutCards.forEach((card) => {
        const cta = card.querySelector(".card-cta");
        if (!cta) return;

        const arrow = cta.querySelector("span");
        const baseLabel = cta.getAttribute("data-label") || "Read more";
        const expandedLabel = cta.getAttribute("data-expanded-label") || "Read less";

        cta.setAttribute("aria-expanded", "false");

        cta.addEventListener("click", (event) => {
            event.preventDefault();
            const isExpanded = card.classList.toggle("expanded");
            cta.setAttribute("aria-expanded", isExpanded ? "true" : "false");
            cta.innerHTML = `${isExpanded ? expandedLabel : baseLabel}${arrow ? " " + arrow.outerHTML : ""}`;
        });
    });
});
