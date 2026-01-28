document.addEventListener("DOMContentLoaded", () => {
    const section = document.getElementById("testimonial");
    const track = document.getElementById("testimonialTrack");
    const prevBtn = document.getElementById("testimonialPrev");
    const nextBtn = document.getElementById("testimonialNext");
    const indicatorsEl = document.getElementById("testimonialIndicators");
    const card = document.querySelector(".testimonial-card");

    if (!track) return;

    let testimonials = [];
    let index = 0;
    let loopTimer = null;
    let isPaused = false;
    let isSyncing = false;
    const prefetchCache = new Map();
    const items = [];
    const indicators = [];

    function normalizeImageUrl(image) {
        const base = section ? section.getAttribute("data-api-base") : "";
        if (image && image.startsWith("/private/files/")) {
            return image;
        }
        if (image && image.startsWith("/api/method/frappe.utils.file_manager.download_file")) {
            return image;
        }
        if (image && image.startsWith("/") && base) {
            return `${base.replace(/\/$/, "")}${image}`;
        }
        return image;
    }

    function prefetchAt(idx) {
        const item = testimonials[idx];
        if (!item || prefetchCache.has(item.image)) return;
        const img = new Image();
        img.src = normalizeImageUrl(item.image);
        prefetchCache.set(item.image, img);
    }

    function prefetchNeighbors() {
        if (testimonials.length <= 1) return;
        prefetchAt((index + 1) % testimonials.length);
        prefetchAt((index - 1 + testimonials.length) % testimonials.length);
    }

    function scrollItemIntoCenter(target) {
        if (!target) return;
        const trackRect = track.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const currentScroll = track.scrollLeft;
        const targetCenter = targetRect.left + targetRect.width / 2;
        const trackCenter = trackRect.left + trackRect.width / 2;
        const delta = targetCenter - trackCenter;
        track.scrollTo({
            left: currentScroll + delta,
            behavior: "smooth"
        });
    }

    function setActive(nextIndex, { scroll = true } = {}) {
        if (!items.length) return;
        index = nextIndex;
        items.forEach((itemEl, idx) => {
            itemEl.classList.toggle("is-active", idx === index);
            itemEl.setAttribute("aria-current", idx === index ? "true" : "false");
        });
        indicators.forEach((dot, idx) => {
            dot.classList.toggle("is-active", idx === index);
            dot.setAttribute("aria-selected", idx === index ? "true" : "false");
            dot.tabIndex = idx === index ? 0 : -1;
        });
        prefetchNeighbors();
        if (scroll) {
            const target = items[index];
            if (target) {
                isSyncing = true;
                scrollItemIntoCenter(target);
                window.setTimeout(() => {
                    isSyncing = false;
                }, 300);
            }
        }
    }

    function findNearestIndex() {
        if (!items.length) return 0;
        const rect = track.getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        let closest = 0;
        let closestDistance = Number.POSITIVE_INFINITY;
        items.forEach((itemEl, idx) => {
            const itemRect = itemEl.getBoundingClientRect();
            const itemCenter = itemRect.left + itemRect.width / 2;
            const distance = Math.abs(center - itemCenter);
            if (distance < closestDistance) {
                closestDistance = distance;
                closest = idx;
            }
        });
        return closest;
    }

    function handleScroll() {
        if (isSyncing) return;
        const nextIndex = findNearestIndex();
        if (nextIndex !== index) {
            setActive(nextIndex, { scroll: false });
        }
    }

    function goNext() {
        if (!testimonials.length) return;
        setActive((index + 1) % testimonials.length);
    }

    function goPrev() {
        if (!testimonials.length) return;
        setActive((index - 1 + testimonials.length) % testimonials.length);
    }

    function startLoop() {
        stopLoop();
        loopTimer = setInterval(() => {
            if (!isPaused && testimonials.length > 1) {
                goNext();
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

    function buildItems() {
        track.innerHTML = "";
        items.length = 0;
        indicators.length = 0;
        if (indicatorsEl) {
            indicatorsEl.innerHTML = "";
        }
        testimonials.forEach((item, idx) => {
            const wrapper = document.createElement("article");
            wrapper.className = "testimonial-item";
            wrapper.setAttribute("role", "listitem");
            wrapper.setAttribute("data-index", String(idx));

            const frame = document.createElement("div");
            frame.className = "testimonial-frame";

            const img = document.createElement("img");
            img.src = normalizeImageUrl(item.image);
            img.alt = item.alt || "Testimonial image";
            img.loading = "lazy";
            frame.appendChild(img);

            wrapper.appendChild(frame);
            track.appendChild(wrapper);
            items.push(wrapper);

            if (indicatorsEl) {
                const dot = document.createElement("button");
                dot.type = "button";
                dot.className = "testimonial-indicator";
                dot.setAttribute("data-index", String(idx));
                dot.setAttribute("role", "tab");
                dot.setAttribute("aria-label", `Go to testimonial ${idx + 1}`);
                indicatorsEl.appendChild(dot);
                indicators.push(dot);
            }
        });
    }

    async function loadTestimonials() {
        try {
            const res = await fetch("/api/testimonials", { credentials: "include" });
            if (!res.ok) return;
            const payload = await res.json();
            const data = payload && payload.message ? payload.message : payload;
            const itemsData = data.items || [];
            testimonials = itemsData
                .map((item) => ({
                    image: item.testimonial_image || "",
                    label: (item.testimonial_caption || item.caption || item.title || item.name || item.testimonial_name || "").trim(),
                    alt: (item.testimonial_alt || item.alt || item.title || "Testimonial image").trim()
                }))
                .filter((item) => item.image);
            if (!testimonials.length) return;

            buildItems();
            if (card) {
                card.classList.toggle("is-single", testimonials.length <= 1);
            }
            setActive(0);
            startLoop();
        } catch (err) {
            // silent fail
        }
    }

    prevBtn?.addEventListener("click", (event) => {
        event.preventDefault();
        goPrev();
    });

    nextBtn?.addEventListener("click", (event) => {
        event.preventDefault();
        goNext();
    });

    indicatorsEl?.addEventListener("click", (event) => {
        const button = event.target.closest(".testimonial-indicator");
        if (!button) return;
        const nextIndex = Number(button.getAttribute("data-index"));
        if (Number.isNaN(nextIndex)) return;
        setActive(nextIndex);
    });


    track.addEventListener("scroll", () => {
        window.requestAnimationFrame(handleScroll);
    });

    card?.addEventListener("mouseenter", () => togglePause(true));
    card?.addEventListener("mouseleave", () => togglePause(false));

    document.addEventListener("keydown", (event) => {
        if (event.key === "ArrowRight") {
            goNext();
        }
        if (event.key === "ArrowLeft") {
            goPrev();
        }
    });

    document.addEventListener("visibilitychange", () => {
        togglePause(document.hidden);
    });

    loadTestimonials();
});
