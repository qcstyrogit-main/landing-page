document.addEventListener("DOMContentLoaded", () => {
    const quoteEl = document.getElementById("testimonialQuote");
    const section = document.getElementById("testimonial");
    const fullscreenBtn = document.getElementById("testimonialFullscreen");
    const modal = document.getElementById("testimonialModal");
    const modalImg = document.getElementById("testimonialModalImage");
    const modalClose = document.getElementById("testimonialModalClose");

    if (!quoteEl) return;

    let testimonials = [];
    let index = 0;

    function render(direction = "next") {
        const item = testimonials[index];
        if (!item) return;
        quoteEl.classList.remove("is-fade-in", "is-fade-in-prev");
        const img = document.createElement("img");
        const base = section ? section.getAttribute("data-api-base") : "";
        const url = item.image && item.image.startsWith("/") && base
            ? `${base.replace(/\/$/, "")}${item.image}`
            : item.image;
        const currentImg = quoteEl.querySelector("img");
        if (currentImg && currentImg.src === url) {
            quoteEl.classList.add(direction === "prev" ? "is-fade-in-prev" : "is-fade-in");
            return;
        }
        img.src = url;
        img.alt = "Testimonial image";
        img.loading = "lazy";
        img.className = "testimonial-image";
        const applyImage = () => {
            quoteEl.replaceChildren(img);
            quoteEl.classList.add(direction === "prev" ? "is-fade-in-prev" : "is-fade-in");
        };
        if (img.complete) {
            applyImage();
        } else {
            img.addEventListener("load", applyImage, { once: true });
        }
        img.addEventListener("error", () => {
            if (!quoteEl.querySelector("img")) {
                quoteEl.textContent = "Image unavailable.";
            }
        });
    }

    function next() {
        index = (index + 1) % testimonials.length;
        render("next");
    }

    function startLoop() {
        stopLoop();
        loopTimer = setInterval(() => {
            if (!isPaused && testimonials.length > 1) {
                next();
            }
        }, 4000);
    }

    function stopLoop() {
        if (loopTimer) {
            clearInterval(loopTimer);
            loopTimer = null;
        }
    }

    function togglePause(state) {
        isPaused = state;
    }

    async function loadTestimonials() {
        try {
            const res = await fetch("/api/testimonials", { credentials: "include" });
            if (!res.ok) return;
            const payload = await res.json();
            const data = payload && payload.message ? payload.message : payload;
            const items = data.items || [];
            testimonials = items
                .map((item) => ({
                    image: item.testimonial_image || ""
                }))
                .filter((item) => item.image);
            if (!testimonials.length) return;
            index = 0;
            render("next");
            startLoop();
        } catch (err) {
            // silent fail
        }
    }

    let loopTimer = null;
    let isPaused = false;

    quoteEl.addEventListener("mouseenter", () => togglePause(true));
    quoteEl.addEventListener("mouseleave", () => togglePause(false));
    quoteEl.addEventListener("click", () => {
        if (!testimonials.length) return;
        next();
    });

    function openModal() {
        if (!modal || !modalImg) return;
        const img = quoteEl.querySelector("img");
        if (!img) return;
        modalImg.src = img.src;
        modal.classList.add("show");
        modal.setAttribute("aria-hidden", "false");
        modal.removeAttribute("inert");
        document.body.classList.add("modal-open");
    }

    function closeModal() {
        if (!modal) return;
        modal.classList.remove("show");
        modal.setAttribute("aria-hidden", "true");
        modal.setAttribute("inert", "");
        document.body.classList.remove("modal-open");
    }

    if (fullscreenBtn) {
        fullscreenBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            openModal();
        });
    }

    if (modalClose) modalClose.addEventListener("click", closeModal);
    if (modal) {
        modal.addEventListener("click", (event) => {
            if (event.target === modal) closeModal();
        });
    }
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && modal && modal.classList.contains("show")) {
            closeModal();
        }
    });

    loadTestimonials();
});
