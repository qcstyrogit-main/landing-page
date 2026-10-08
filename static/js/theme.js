(() => {
  "use strict";

  const storageKey = "qcmc-theme";
  const root = document.documentElement;

  const readTheme = () => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved === "light" || saved === "dark" ? saved : "light";
    } catch (error) {
      return "light";
    }
  };

  const updateButtons = (theme) => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-label", `Switch to ${nextTheme} theme`);
      button.setAttribute("title", `Switch to ${nextTheme} theme`);
      button.setAttribute("aria-pressed", String(theme === "light"));
      const icon = button.querySelector(".theme-toggle-icon");
      if (icon) icon.textContent = theme === "dark" ? "☼" : "☾";
    });
  };

  const applyTheme = (theme, persist = false) => {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    if (persist) {
      try {
        window.localStorage.setItem(storageKey, theme);
      } catch (error) {
        // The theme still works when private browsing blocks storage.
      }
    }
    updateButtons(theme);
    window.dispatchEvent(new CustomEvent("qcmc:themechange", { detail: { theme } }));
  };

  applyTheme(readTheme());

  document.addEventListener("DOMContentLoaded", () => {
    updateButtons(root.dataset.theme || "light");
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        applyTheme(root.dataset.theme === "light" ? "dark" : "light", true);
        button.blur();
      });
    });
  });
})();
