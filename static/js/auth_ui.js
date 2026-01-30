document.addEventListener("DOMContentLoaded", async () => {
    const currentPath = window.location.pathname;
    const isAnnouncementPage = currentPath === "/announcements";
    const isHomePage = currentPath === "/" || currentPath === "/index.html";
    const redirectKey = "announcements_redirected";
    const userMenus = document.querySelectorAll("[data-erp-user-menu]");
    const loginButtons = document.querySelectorAll("[data-erp-login]");
    const announcementLinks = document.querySelectorAll("[data-erp-announcement]");
    const authRequired = document.querySelector("[data-auth-required]");
    if (!loginButtons.length && !announcementLinks.length && !authRequired) return;

    function setAnnouncementVisibility(isVisible) {
        announcementLinks.forEach((link) => {
            link.classList.toggle("is-visible", isVisible);
            link.setAttribute("aria-hidden", isVisible ? "false" : "true");
        });
    }

    try {
        const response = await fetch("/api/erp/whoami", { credentials: "include" });
        if (!response.ok) {
            if (authRequired) window.location.href = "/";
            setAnnouncementVisibility(false);
            return;
        }
        const payload = await response.json();
        const message = payload && payload.message ? payload.message : payload;
        const fullName = message && (message.full_name || message.fullName);
        const user = message && message.user;
        const displayName = (fullName || user || "").trim();

        if (displayName) {
            loginButtons.forEach((btn) => {
                const isMobile = btn.dataset.erpLogin === "mobile";
                if (isMobile) {
                    btn.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#icon-user"></use></svg><span>Go to ERP</span>`;
                    btn.setAttribute("aria-label", "Go to ERP");
                } else {
                    btn.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#icon-user"></use></svg>`;
                    btn.setAttribute("aria-label", `Account: ${displayName}`);
                }
                btn.classList.add("is-logged-in");
            });
            setAnnouncementVisibility(true);
            userMenus.forEach((menu) => {
                const trigger = menu.querySelector("[data-erp-login]");
                const dropdown = menu.querySelector(".user-menu-dropdown");
                if (!trigger || !dropdown) return;

                trigger.addEventListener("click", (event) => {
                    event.preventDefault();
                    dropdown.classList.toggle("show");
                    dropdown.setAttribute(
                        "aria-hidden",
                        dropdown.classList.contains("show") ? "false" : "true"
                    );
                });
            });

            document.addEventListener("click", (event) => {
                userMenus.forEach((menu) => {
                    if (!menu.contains(event.target)) {
                        const dropdown = menu.querySelector(".user-menu-dropdown");
                        if (dropdown) {
                            dropdown.classList.remove("show");
                            dropdown.setAttribute("aria-hidden", "true");
                        }
                    }
                });
            });

            if (isHomePage && !isAnnouncementPage && !sessionStorage.getItem(redirectKey)) {
                sessionStorage.setItem(redirectKey, "1");
                window.location.href = "/announcements";
            }
        } else {
            setAnnouncementVisibility(false);
            if (authRequired) window.location.href = "/";
        }
    } catch (err) {
        setAnnouncementVisibility(false);
        if (authRequired) window.location.href = "/";
    }
});
