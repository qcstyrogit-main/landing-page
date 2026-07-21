document.addEventListener("DOMContentLoaded", async () => {
    const currentPath = window.location.pathname;
    const isAnnouncementPage = currentPath === "/announcements";
    const isHomePage = currentPath === "/" || currentPath === "/index.html";
    const erpBase = (document.body?.dataset.erpBase || "").replace(/\/$/, "");
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

    async function fetchJson(url) {
        const response = await fetch(url, {
            credentials: "include",
            cache: "no-store"
        });
        if (!response.ok) return null;
        return response.json();
    }

    async function getErpAuthState() {
        const directUrl = erpBase
            ? `${erpBase}/api/method/qcmc_logic.api.auth.check_log_user`
            : "";
        if (directUrl) {
            try {
                const directPayload = await fetchJson(directUrl);
                if (directPayload) return directPayload;
            } catch (error) {
                // Cross-origin ERP checks can fail if ERP CORS is not enabled.
            }
        }
        return fetchJson("/api/erp/whoami");
    }

    function normalizeAuthPayload(payload) {
        const message = payload && payload.message ? payload.message : payload;
        const loggedIn = Boolean(
            message && (
                message.logged_in === true ||
                message.logged_in === "true" ||
                message.user ||
                message.full_name ||
                message.fullName
            )
        );
        const fullName = message && (message.full_name || message.fullName);
        const user = message && message.user;
        const displayName = (fullName || user || (loggedIn ? "ERP User" : "") || "").trim();
        return { loggedIn, displayName };
    }

    try {
        const payload = await getErpAuthState();
        const { loggedIn, displayName } = normalizeAuthPayload(payload);

        if (loggedIn) {
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
            document.dispatchEvent(new CustomEvent("erp:authenticated", { detail: { displayName } }));
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

            if (isHomePage && !isAnnouncementPage) {
                window.location.href = "/announcements";
            }
        } else {
            setAnnouncementVisibility(false);
            document.dispatchEvent(new CustomEvent("erp:unauthenticated"));
            if (authRequired) window.location.href = "/";
        }
    } catch (err) {
        setAnnouncementVisibility(false);
        document.dispatchEvent(new CustomEvent("erp:unauthenticated"));
        if (authRequired) window.location.href = "/";
    }
});
