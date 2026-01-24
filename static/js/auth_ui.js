document.addEventListener("DOMContentLoaded", async () => {
    const currentPath = window.location.pathname;
    const isAnnouncementPage = currentPath === "/announcements";
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
                btn.textContent = `Welcome, ${displayName}`;
                btn.setAttribute("aria-label", `Welcome, ${displayName}`);
                btn.classList.add("is-logged-in");
            });
            setAnnouncementVisibility(true);
            if (!isAnnouncementPage) {
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
