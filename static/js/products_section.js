document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const slider = document.querySelector(".products-slider");
    const slides = Array.from(document.querySelectorAll(".products-slide"));
    const tabs = Array.from(document.querySelectorAll(".products-pagination-tab"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!slider || !slides.length) return;

    let currentSlide = 0;
    let transitionTimer = 0;
    let autoplayTimer = 0;
    let pointerStart = null;

    const finishTransition = () => {
        window.clearTimeout(transitionTimer);
        slides.forEach((slide, index) => {
            slide.classList.remove(
                "is-entering",
                "is-entering-next",
                "is-entering-prev",
                "is-leaving",
                "is-leaving-next",
                "is-leaving-prev"
            );
            slide.classList.toggle("active", index === currentSlide);
            slide.setAttribute("aria-hidden", String(index !== currentSlide));
        });
        slider.classList.remove("is-transitioning");
    };

    const showSlide = (index, requestedDirection) => {
        const nextIndex = (index + slides.length) % slides.length;
        if (nextIndex === currentSlide) return;

        finishTransition();
        const previousIndex = currentSlide;
        const direction = requestedDirection || (nextIndex > previousIndex ? "next" : "prev");
        const previousSlide = slides[previousIndex];
        const nextSlide = slides[nextIndex];

        previousSlide.classList.remove("active");
        previousSlide.classList.add("is-leaving", `is-leaving-${direction}`);
        previousSlide.setAttribute("aria-hidden", "true");

        nextSlide.classList.add("active", "is-entering", `is-entering-${direction}`);
        nextSlide.setAttribute("aria-hidden", "false");
        tabs.forEach((tab, tabIndex) => {
            const isSelected = tabIndex === nextIndex;
            tab.classList.toggle("active", isSelected);
            tab.setAttribute("aria-pressed", String(isSelected));
        });

        currentSlide = nextIndex;
        slider.classList.add("is-transitioning");

        if (reducedMotion.matches) {
            finishTransition();
        } else {
            transitionTimer = window.setTimeout(finishTransition, 860);
        }
    };

    const move = (direction) => {
        showSlide(
            currentSlide + (direction === "next" ? 1 : -1),
            direction
        );
    };

    const stopAutoplay = () => {
        window.clearInterval(autoplayTimer);
        autoplayTimer = 0;
    };

    const startAutoplay = () => {
        stopAutoplay();
        if (document.hidden || reducedMotion.matches) return;
        autoplayTimer = window.setInterval(() => move("next"), 6000);
    };

    tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => {
            showSlide(index);
            startAutoplay();
        });
    });

    slider.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
        stopAutoplay();
    });

    slider.addEventListener("pointerup", (event) => {
        if (!pointerStart || pointerStart.id !== event.pointerId) return;
        const deltaX = event.clientX - pointerStart.x;
        const deltaY = event.clientY - pointerStart.y;
        pointerStart = null;

        if (Math.abs(deltaX) >= 44 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
            move(deltaX < 0 ? "next" : "prev");
        }
        startAutoplay();
    });

    slider.addEventListener("pointercancel", () => {
        pointerStart = null;
        startAutoplay();
    });
    slider.addEventListener("mouseenter", stopAutoplay);
    slider.addEventListener("mouseleave", startAutoplay);
    slider.addEventListener("focusin", stopAutoplay);
    slider.addEventListener("focusout", startAutoplay);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) stopAutoplay();
        else startAutoplay();
    });
    reducedMotion.addEventListener("change", () => {
        finishTransition();
        startAutoplay();
    });

    slides.forEach((slide, index) => {
        const isSelected = index === currentSlide;
        slide.classList.toggle("active", isSelected);
        slide.setAttribute("aria-hidden", String(!isSelected));
    });
    tabs.forEach((tab, index) => {
        const isSelected = index === currentSlide;
        tab.classList.toggle("active", isSelected);
        tab.setAttribute("aria-pressed", String(isSelected));
    });
    startAutoplay();
});
