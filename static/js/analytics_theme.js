(() => {
  "use strict";

  const storageKey = "qcmc-analytics-theme";
  const root = document.documentElement;

  function readTheme() {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved === "light" || saved === "dark" ? saved : "dark";
    } catch (error) {
      return "dark";
    }
  }

  function updateButtons(theme) {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-label", `Switch to ${nextTheme} theme`);
      button.setAttribute("title", `Switch to ${nextTheme} theme`);
      button.setAttribute("aria-pressed", String(theme === "light"));
      const icon = button.querySelector(".theme-toggle-icon");
      if (icon) icon.textContent = theme === "dark" ? "\u263c" : "\u263e";
    });
  }

  function applyTheme(theme, persist = false) {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    if (persist) {
      try {
        window.localStorage.setItem(storageKey, theme);
      } catch (error) {
        // The theme remains usable if storage is unavailable.
      }
    }
    updateButtons(theme);
  }

  applyTheme(readTheme());

  document.addEventListener("DOMContentLoaded", () => {
    updateButtons(root.dataset.theme || "dark");
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        applyTheme(root.dataset.theme === "light" ? "dark" : "light", true);
        button.blur();
      });
    });
  });
})();
