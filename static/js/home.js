// ----------------------
// Back to Top Button
// ----------------------
const backToTop = document.getElementById('back-to-top');

window.addEventListener('scroll', () => {
    const scrollY = window.scrollY || document.documentElement.scrollTop;

    // Show button after scrolling 200px
    if (scrollY > 200) {
        backToTop.classList.add('show');
    } else {
        backToTop.classList.remove('show');
    }

    // Adaptive color based on scroll
    const startColor = [19, 56, 128]; // rgb(19,56,128)
    const endColor = [0, 0, 0];       // rgb(0,0,0)
    const maxScroll = 1000;

    const factor = Math.min(scrollY / maxScroll, 1);

    const r = Math.round(startColor[0] + factor * (endColor[0] - startColor[0]));
    const g = Math.round(startColor[1] + factor * (endColor[1] - startColor[1]));
    const b = Math.round(startColor[2] + factor * (endColor[2] - startColor[2]));

    backToTop.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.15)`;
    backToTop.style.color = `rgb(${r}, ${g}, ${b})`;
});

// Scroll smoothly to top on click
backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ----------------------
// Mobile Menu & Dropdown
// ----------------------
document.addEventListener("DOMContentLoaded", function() {
    const menuToggle = document.querySelector(".menu-toggle");
    const mobileNav = document.getElementById("mobileNav");
    const mobileDropdownToggle = document.getElementById("mobileDropdownToggle");
    const mobileDropdown = document.getElementById("mobileDropdown");
    let lastFocused = null;
    let trapListener = null;

    function getFocusable(container) {
        if (!container) return [];
        return Array.from(
            container.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')
        ).filter(el => el.offsetParent !== null);
    }

    function trapFocus(container) {
        if (!container) return;
        const focusable = getFocusable(container);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        trapListener = (event) => {
            if (event.key === "Tab") {
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
            if (event.key === "Escape") {
                closeMobileNav();
            }
        };
        document.addEventListener("keydown", trapListener);
        first.focus();
    }

    function releaseFocus() {
        if (trapListener) {
            document.removeEventListener("keydown", trapListener);
            trapListener = null;
        }
        if (lastFocused) lastFocused.focus();
    }

    function openMobileNav() {
        if (!mobileNav) return;
        lastFocused = document.activeElement;
        mobileNav.classList.add("show");
        menuToggle.classList.add("active");
        menuToggle.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";
        mobileNav.setAttribute("aria-hidden", "false");
        mobileNav.removeAttribute("inert");
        document.body.classList.add("mobile-nav-open");
        trapFocus(mobileNav);
    }

    function closeMobileNav() {
        if (!mobileNav) return;
        mobileNav.classList.remove("show");
        menuToggle.classList.remove("active");
        menuToggle.setAttribute("aria-expanded", "false");
        if (mobileDropdown) {
            mobileDropdown.classList.remove("show");
            mobileDropdown.setAttribute("aria-hidden", "true");
            mobileDropdown.setAttribute("inert", "");
        }
        if (mobileDropdownToggle) mobileDropdownToggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
        mobileNav.setAttribute("aria-hidden", "true");
        mobileNav.setAttribute("inert", "");
        document.body.classList.remove("mobile-nav-open");
        releaseFocus();
    }

    // Mobile menu toggle
    if (menuToggle) {
        menuToggle.addEventListener("click", function() {
            if (mobileNav && mobileNav.classList.contains("show")) {
                closeMobileNav();
            } else {
                openMobileNav();
            }
        });
    }

    // Mobile products dropdown toggle
    if (mobileDropdownToggle && mobileDropdown) {
        mobileDropdownToggle.addEventListener("click", function(e) {
            e.preventDefault();
            e.stopPropagation();
            mobileDropdown.classList.toggle("show");
            const expanded = this.getAttribute("aria-expanded") === "true";
            this.setAttribute("aria-expanded", (!expanded).toString());
            mobileDropdown.setAttribute("aria-hidden", expanded ? "true" : "false");
            if (expanded) {
                mobileDropdown.setAttribute("inert", "");
            } else {
                mobileDropdown.removeAttribute("inert");
            }
        });
    }

    // Smooth scroll for hash links and close mobile nav
    document.querySelectorAll('a[href^="#"], a[href^="/#"]').forEach(anchor => {
        anchor.addEventListener("click", function(e) {
            const href = this.getAttribute("href") || "";
            const isRootHash = href.startsWith("/#");
            const isHash = href.startsWith("#");
            const isMobileLink = mobileNav && mobileNav.contains(this);

            if (isRootHash && window.location.pathname !== "/") {
                if (isMobileLink) closeMobileNav();
                return;
            }

            if (isHash || isRootHash) {
                const targetId = href.replace(/^\/?#/, "");
                if (targetId === "") {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                } else {
                    const targetElement = document.getElementById(targetId);
                    if (targetElement) {
                        e.preventDefault();
                        const headerOffset = 60;
                        const elementPosition = targetElement.getBoundingClientRect().top;
                        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                        window.scrollTo({ top: offsetPosition, behavior: "smooth" });
                    }
                }
            }

            if (isMobileLink) closeMobileNav();
        });
    });

    // Close mobile menu on any mobile nav link click
    if (mobileNav) {
        mobileNav.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", () => {
                closeMobileNav();
            });
        });
    }

    // Close dropdown if clicking outside
    document.addEventListener("click", function(e) {
        if (mobileDropdown && !mobileDropdown.contains(e.target) && e.target !== mobileDropdownToggle) {
            mobileDropdown.classList.remove("show");
            if (mobileDropdownToggle) mobileDropdownToggle.setAttribute("aria-expanded", "false");
        }
    });

    // Reset on resize
    window.addEventListener("resize", function() {
        if (window.innerWidth > 768) {
            closeMobileNav();
        }
    });
});

// ----------------------
// Hide/Show Header on Scroll
// ----------------------
document.addEventListener("DOMContentLoaded", () => {
    const header = document.querySelector(".home-header");
    let lastScrollY = window.scrollY;
    let ticking = false;

    window.addEventListener("scroll", () => {
        const currentScrollY = window.scrollY;

        if (!ticking) {
            window.requestAnimationFrame(() => {
                if (currentScrollY > lastScrollY && currentScrollY > 100) {
                    header.style.transform = "translateY(-100%)";
                } else {
                    header.style.transform = "translateY(0)";
                }
                lastScrollY = currentScrollY;
                ticking = false;
            });
            ticking = true;
        }
    });
});

// ----------------------
// ERP Login Status (Welcome + Name)
// ----------------------
// Login UI is handled globally in auth_ui.js
