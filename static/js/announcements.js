document.addEventListener("DOMContentLoaded", () => {
    const tabs = document.querySelectorAll(".announcements-tab");
    const panels = document.querySelectorAll(".announcements-panel");
    if (!tabs.length || !panels.length) return;

    function setActive(targetId) {
        tabs.forEach((tab) => {
            const isActive = tab.getAttribute("aria-controls") === targetId;
            tab.classList.toggle("is-active", isActive);
            tab.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        panels.forEach((panel) => {
            panel.classList.toggle("is-active", panel.id === targetId);
        });
    }

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            const targetId = tab.getAttribute("aria-controls");
            if (targetId) setActive(targetId);
        });
    });
});
