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

    // Mobile menu toggle
    if (menuToggle) {
        menuToggle.addEventListener("click", function() {
            this.classList.toggle("active");
            if (mobileNav) {
                const isShown = mobileNav.classList.toggle("show");
                // Prevent page scrolling when mobile menu is open
                if (isShown) {
                    document.body.style.overflow = 'hidden';
                    mobileNav.setAttribute('aria-hidden', 'false');
                    document.body.classList.add('mobile-nav-open');
                } else {
                    document.body.style.overflow = '';
                    mobileNav.setAttribute('aria-hidden', 'true');
                    document.body.classList.remove('mobile-nav-open');
                }
            }
        });
    }

    // Mobile products dropdown toggle
    if (mobileDropdownToggle && mobileDropdown) {
        mobileDropdownToggle.addEventListener("click", function(e) {
            e.preventDefault(); // prevent default anchor behavior
            e.stopPropagation(); // stop bubbling to smooth scroll handler
            mobileDropdown.classList.toggle("show");
            const expanded = this.getAttribute("aria-expanded") === "true";
            this.setAttribute("aria-expanded", (!expanded).toString());
        });
    }

    // Smooth scroll for anchor links (skip mobile dropdown toggle)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        if (anchor.id === "mobileDropdownToggle") return; // skip dropdown toggle
        anchor.addEventListener("click", function(e) {
            const href = this.getAttribute("href");

            if (href === "#" || href === "/#") {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                if(targetElement) {
                    e.preventDefault();
                    const headerOffset = 60;
                    const elementPosition = targetElement.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                    window.scrollTo({ top: offsetPosition, behavior: "smooth" });
                }
            }

            // Close mobile menu after click
            mobileNav.classList.remove("show");
            menuToggle.classList.remove("active");
            if (mobileDropdown) mobileDropdown.classList.remove("show");
            if (mobileDropdownToggle) mobileDropdownToggle.setAttribute("aria-expanded", "false");
            document.body.style.overflow = '';
        });
    });

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
            if (mobileNav) mobileNav.classList.remove("show");
            if (menuToggle) menuToggle.classList.remove("active");
            if (mobileDropdown) mobileDropdown.classList.remove("show");
            if (mobileDropdownToggle) mobileDropdownToggle.setAttribute("aria-expanded", "false");
            document.body.style.overflow = '';
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
