(() => {
    "use strict";

    const root = document.documentElement;
    const page = document.querySelector(".custom-home-page");
    const progressIndicator = document.querySelector(".scroll-depth-indicator");
    const progressTrack = document.querySelector(".scroll-depth-track");
    const progressLabel = document.querySelector(".scroll-depth-current");
    const progressWaveBase = document.querySelector(".scroll-depth-wave-base");
    const progressWave = document.querySelector(".scroll-depth-wave-progress");
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (!page) return;

    const sections = Array.from(page.querySelectorAll(":scope > section"));
    if (!sections.length) return;

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const padNumber = (value) => String(value).padStart(2, "0");
    const transformableSections = sections.filter((section) => section.id !== "contact-us");
    const bendStart = 26;
    const bendTravel = 108;

    sections.forEach((section, index) => {
        section.classList.add("depth-scene");
        section.dataset.sceneNumber = padNumber(index + 1);

        if (!section.querySelector(":scope > .depth-scene-number")) {
            const number = document.createElement("span");
            number.className = "depth-scene-number";
            number.setAttribute("aria-hidden", "true");
            number.textContent = padNumber(index + 1);
            section.prepend(number);
        }

        if (!section.classList.contains("intro-section") && !section.querySelector(":scope > .depth-section-line")) {
            const line = document.createElement("span");
            line.className = "depth-section-line";
            line.setAttribute("aria-hidden", "true");
            section.prepend(line);
        }

        if (!transformableSections.includes(section)) return;

        Array.from(section.children)
            .filter((child) => child.tagName === "DIV")
            .forEach((plane) => plane.classList.add("scene-plane"));
    });

    const revealSelector = [
        "h1",
        "h2",
        ".about-card h3",
        ".intro-kicker",
        ".intro-description",
        ".about-us-eyebrow",
        ".about-us-lede",
        ".standard-text > p",
        ".iso-header > p",
        ".manufacturing-process li",
        ".iso-proof-item"
    ].join(", ");
    const revealTargets = [];
    const revealSections = [];

    sections.forEach((section) => {
        const sectionTargets = Array.from(section.querySelectorAll(revealSelector));

        sectionTargets.forEach((target, index) => {
            if (target.closest("[role='dialog']")) return;

            target.classList.add("text-scroll-reveal");
            if (/^H[1-3]$/.test(target.tagName)) {
                target.classList.add("text-scroll-heading");
            }
            target.style.setProperty("--text-reveal-delay", `${Math.min(index * 85, 255)}ms`);
            revealTargets.push(target);
        });

        if (section.querySelector(".text-scroll-reveal")) {
            revealSections.push(section);
        }
    });

    if ("IntersectionObserver" in window && !prefersReducedMotion.matches) {
        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.querySelectorAll(".text-scroll-reveal").forEach((target) => {
                    target.classList.add("is-text-visible");
                });
                observer.unobserve(entry.target);
            });
        }, {
            threshold: 0.08,
            rootMargin: "0px 0px -10% 0px"
        });

        revealSections.forEach((section) => revealObserver.observe(section));
    } else {
        revealTargets.forEach((target) => target.classList.add("is-text-visible"));
    }

    const motionRevealGroups = [
        {
            selector: ".standard-media, .products-slider, .sustainability-slider, .jobs-hero-media",
            className: "motion-media-reveal"
        },
        {
            selector: ".events-carousel",
            className: "motion-bento-reveal"
        },
        {
            selector: ".iso-images",
            className: "motion-sequence-reveal"
        }
    ];
    const motionRevealTargets = [];

    motionRevealGroups.forEach(({ selector, className }) => {
        page.querySelectorAll(selector).forEach((target) => {
            target.classList.add(className);
            motionRevealTargets.push(target);
        });
    });

    page.classList.add("motion-scroll-ready");

    if ("IntersectionObserver" in window && !prefersReducedMotion.matches) {
        const motionObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-motion-visible");
                observer.unobserve(entry.target);
            });
        }, {
            threshold: 0.14,
            rootMargin: "0px 0px -7% 0px"
        });

        motionRevealTargets.forEach((target) => motionObserver.observe(target));
    } else {
        motionRevealTargets.forEach((target) => target.classList.add("is-motion-visible"));
    }

    const manufacturingProcess = page.querySelector(".manufacturing-process");
    const manufacturingSteps = manufacturingProcess
        ? Array.from(manufacturingProcess.querySelectorAll(":scope > li"))
        : [];
    const standardSection = manufacturingProcess?.closest(".standard-section") || null;

    let frameRequested = false;
    let indicatorHideTimer = 0;
    let liquidProgress = 0;
    let liquidProgressInitialized = false;
    let indicatorDragging = false;
    let previousScrollBehavior = "";

    const showProgressIndicator = () => {
        if (!progressIndicator) return;

        progressIndicator.classList.add("is-visible");
        window.clearTimeout(indicatorHideTimer);
        indicatorHideTimer = window.setTimeout(() => {
            if (indicatorDragging) return;
            progressIndicator.classList.remove("is-visible");
        }, 1100);
    };

    const scrollToProgress = (progress, behavior = "auto") => {
        const viewportHeight = Math.max(window.innerHeight, 1);
        const scrollable = Math.max(root.scrollHeight - viewportHeight, 0);
        const nextProgress = clamp(progress, 0, 1);

        liquidProgress = nextProgress;
        liquidProgressInitialized = true;
        window.scrollTo({
            top: scrollable * nextProgress,
            behavior
        });
        requestRender();
    };

    const progressFromPointer = (event) => {
        if (!progressTrack) return 0;

        const bounds = progressTrack.getBoundingClientRect();
        const pointerY = clamp(event.clientY - bounds.top, 0, bounds.height);
        const viewBoxY = (pointerY / Math.max(bounds.height, 1)) * 160;
        return clamp((viewBoxY - bendStart) / bendTravel, 0, 1);
    };

    if (progressIndicator && progressTrack && progressLabel) {
        const finishDrag = (event) => {
            if (!indicatorDragging) return;

            indicatorDragging = false;
            progressIndicator.classList.remove("is-dragging");
            root.style.scrollBehavior = previousScrollBehavior;

            if (progressLabel.hasPointerCapture?.(event.pointerId)) {
                progressLabel.releasePointerCapture(event.pointerId);
            }
            showProgressIndicator();
        };

        progressLabel.addEventListener("pointerdown", (event) => {
            if (event.pointerType === "mouse" && event.button !== 0) return;

            event.preventDefault();
            indicatorDragging = true;
            previousScrollBehavior = root.style.scrollBehavior;
            root.style.scrollBehavior = "auto";
            progressIndicator.classList.add("is-dragging", "is-visible");
            window.clearTimeout(indicatorHideTimer);
            progressLabel.setPointerCapture?.(event.pointerId);
            scrollToProgress(progressFromPointer(event));
        });

        progressLabel.addEventListener("pointermove", (event) => {
            if (!indicatorDragging) return;
            event.preventDefault();
            scrollToProgress(progressFromPointer(event));
        });

        progressLabel.addEventListener("pointerup", finishDrag);
        progressLabel.addEventListener("pointercancel", finishDrag);

        progressLabel.addEventListener("keydown", (event) => {
            const currentScrollable = Math.max(root.scrollHeight - window.innerHeight, 1);
            const currentProgress = clamp(window.scrollY / currentScrollable, 0, 1);
            const sectionStep = 1 / Math.max(sections.length - 1, 1);
            let nextProgress = currentProgress;

            if (event.key === "ArrowDown" || event.key === "ArrowRight" || event.key === "PageDown") {
                nextProgress += sectionStep;
            } else if (event.key === "ArrowUp" || event.key === "ArrowLeft" || event.key === "PageUp") {
                nextProgress -= sectionStep;
            } else if (event.key === "Home") {
                nextProgress = 0;
            } else if (event.key === "End") {
                nextProgress = 1;
            } else {
                return;
            }

            event.preventDefault();
            showProgressIndicator();
            scrollToProgress(nextProgress, prefersReducedMotion.matches ? "auto" : "smooth");
        });
    }

    const render = () => {
        const viewportHeight = Math.max(window.innerHeight, 1);
        const viewportCenter = viewportHeight / 2;
        const activeProbe = viewportHeight * 0.38;
        const scrollable = Math.max(root.scrollHeight - viewportHeight, 1);
        const scrollProgress = clamp(window.scrollY / scrollable, 0, 1);
        let activeIndex = 0;
        let activeDistance = Number.POSITIVE_INFINITY;
        let activeSectionFound = false;

        if (!liquidProgressInitialized || prefersReducedMotion.matches) {
            liquidProgress = scrollProgress;
            liquidProgressInitialized = true;
        } else {
            liquidProgress += (scrollProgress - liquidProgress) * 0.16;
        }

        const liquidDistance = scrollProgress - liquidProgress;
        const liquidEnergy = clamp(Math.abs(liquidDistance) * 24, 0, 1);
        page.style.setProperty("--depth-progress", scrollProgress.toFixed(4));
        page.style.setProperty("--atmosphere-y", `${(scrollProgress * 520).toFixed(1)}px`);
        page.style.setProperty("--atmosphere-turn", `${(scrollProgress * 34).toFixed(1)}deg`);

        if (progressIndicator && progressWave && progressWaveBase) {
            const bendCenter = bendStart + liquidProgress * bendTravel;
            const bendRadius = 22 + liquidEnergy * 4;
            const bendTop = bendCenter - bendRadius;
            const bendBottom = bendCenter + bendRadius;
            const outerX = 4.5 - liquidEnergy * 0.75;
            const shoulderX = 10.5 - liquidEnergy * 0.5;
            const coloredPath = [
                "M16 0",
                `L16 ${bendTop.toFixed(2)}`,
                `C16 ${(bendTop + 8).toFixed(2)} 15 ${(bendTop + 12).toFixed(2)} ${shoulderX.toFixed(2)} ${(bendCenter - 15).toFixed(2)}`,
                `C7 ${(bendCenter - 10).toFixed(2)} ${outerX.toFixed(2)} ${(bendCenter - 6).toFixed(2)} ${outerX.toFixed(2)} ${bendCenter.toFixed(2)}`
            ].join(" ");
            const bendPath = [
                coloredPath,
                `C${outerX.toFixed(2)} ${(bendCenter + 6).toFixed(2)} 7 ${(bendCenter + 10).toFixed(2)} ${shoulderX.toFixed(2)} ${(bendCenter + 15).toFixed(2)}`,
                `C15 ${(bendBottom - 12).toFixed(2)} 16 ${(bendBottom - 8).toFixed(2)} 16 ${bendBottom.toFixed(2)}`,
                "L16 160"
            ].join(" ");

            progressWaveBase.setAttribute("d", bendPath);
            progressWave.setAttribute("d", coloredPath);
            progressIndicator.style.setProperty("--depth-wave-left", `${((outerX / 32) * 100).toFixed(2)}%`);
            progressIndicator.style.setProperty("--depth-wave-top", `${((bendCenter / 160) * 100).toFixed(2)}%`);
            progressIndicator.style.setProperty("--depth-liquid-energy", liquidEnergy.toFixed(3));
        }

        if (manufacturingProcess && standardSection && manufacturingSteps.length) {
            const standardBounds = standardSection.getBoundingClientRect();
            const processProgress = prefersReducedMotion.matches
                ? 1
                : clamp(
                    ((viewportHeight * 0.82) - standardBounds.top)
                    / Math.max(standardBounds.height + viewportHeight * 0.42, 1),
                    0,
                    1
                );
            const activeProgress = clamp(processProgress * 1.14, 0, 1);
            const activeStepIndex = Math.min(
                Math.floor(activeProgress * manufacturingSteps.length),
                manufacturingSteps.length - 1
            );

            manufacturingProcess.style.setProperty("--process-progress", activeProgress.toFixed(4));
            manufacturingSteps.forEach((step, index) => {
                const threshold = index / manufacturingSteps.length;
                const isActive = activeProgress >= threshold && activeProgress > 0.015;
                step.classList.toggle("is-process-active", isActive);

                if (isActive && index === activeStepIndex) {
                    step.setAttribute("aria-current", "step");
                } else {
                    step.removeAttribute("aria-current");
                }
            });
        }

        sections.forEach((section, index) => {
            const bounds = section.getBoundingClientRect();
            const center = bounds.top + bounds.height / 2;
            const distance = Math.abs(center - viewportCenter);

            if (bounds.top <= activeProbe && bounds.bottom > activeProbe) {
                activeIndex = index;
                activeSectionFound = true;
            } else if (!activeSectionFound && distance < activeDistance) {
                activeDistance = distance;
                activeIndex = index;
            }
            if (!transformableSections.includes(section) || prefersReducedMotion.matches) return;

            const normalized = clamp((center - viewportCenter) / viewportHeight, -1.25, 1.25);
            const edge = Math.abs(normalized);
            const visibility = clamp(1 - edge * 0.22, 0.76, 1);
            const direction = index % 2 === 0 ? 1 : -1;

            section.classList.toggle("is-depth-near", bounds.bottom > -viewportHeight * 0.25 && bounds.top < viewportHeight * 1.25);
            section.style.setProperty("--scene-x", `${(normalized * direction * 10).toFixed(2)}px`);
            section.style.setProperty("--scene-y", `${(-normalized * 22).toFixed(2)}px`);
            section.style.setProperty("--scene-z", `${(-edge * 88).toFixed(2)}px`);
            section.style.setProperty("--scene-opacity", visibility.toFixed(3));
        });

        if (progressLabel) {
            const currentSection = activeIndex + 1;
            progressLabel.textContent = padNumber(currentSection);
            progressLabel.setAttribute("aria-valuemax", String(sections.length));
            progressLabel.setAttribute("aria-valuenow", String(currentSection));
            progressLabel.setAttribute(
                "aria-valuetext",
                `Section ${padNumber(currentSection)} of ${padNumber(sections.length)}`
            );
        }
        frameRequested = false;

        if (!prefersReducedMotion.matches && Math.abs(scrollProgress - liquidProgress) > 0.0001) {
            requestRender();
        }
    };

    const requestRender = () => {
        if (frameRequested) return;
        frameRequested = true;
        window.requestAnimationFrame(render);
    };

    window.addEventListener("scroll", () => {
        requestRender();
        showProgressIndicator();
    }, { passive: true });
    window.addEventListener("resize", requestRender);
    prefersReducedMotion.addEventListener("change", (event) => {
        if (event.matches) {
            motionRevealTargets.forEach((target) => target.classList.add("is-motion-visible"));
        }
        requestRender();
    });

    page.classList.add("motion-3d-ready");
    render();
})();
