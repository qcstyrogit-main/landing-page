(() => {
  const tabs = Array.from(document.querySelectorAll("[data-analytics-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-analytics-panel]"));
  const validTabs = new Set(tabs.map((tab) => tab.dataset.analyticsTab));
  let activeTab = "overview";

  const activateTab = (name, { focus = false, updateUrl = true } = {}) => {
    if (!validTabs.has(name)) name = "overview";
    activeTab = name;

    tabs.forEach((tab) => {
      const selected = tab.dataset.analyticsTab === name;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      tab.classList.toggle("is-active", selected);
      if (selected && focus) tab.focus();
    });

    panels.forEach((panel) => {
      const selected = panel.dataset.analyticsPanel === name;
      panel.hidden = !selected;
      panel.classList.toggle("is-active", selected);
    });

    if (updateUrl) {
      history.replaceState(null, "", `${location.pathname}${location.search}#${name}`);
    }
  };

  if (tabs.length && panels.length) {
    document.documentElement.classList.add("analytics-tabs-ready");
    const requestedTab = location.hash.slice(1);
    activateTab(validTabs.has(requestedTab) ? requestedTab : "overview", {
      updateUrl: Boolean(requestedTab),
    });

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activateTab(tab.dataset.analyticsTab));
      tab.addEventListener("keydown", (event) => {
        let nextIndex = index;
        if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
        else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = tabs.length - 1;
        else return;

        event.preventDefault();
        activateTab(tabs[nextIndex].dataset.analyticsTab, { focus: true });
      });
    });

    window.addEventListener("hashchange", () => {
      const requested = location.hash.slice(1);
      if (validTabs.has(requested)) activateTab(requested, { updateUrl: false });
    });

    window.addEventListener("beforeprint", () => {
      panels.forEach((panel) => {
        panel.hidden = false;
      });
    });
    window.addEventListener("afterprint", () => {
      activateTab(activeTab, { updateUrl: false });
    });
  }

  let countryNames = null;
  try {
    countryNames = new Intl.DisplayNames([document.documentElement.lang || "en"], {
      type: "region"
    });
  } catch (_error) {
    // Older browsers can display the ISO country code instead.
  }

  document.querySelectorAll("[data-country-code]").forEach((element) => {
    const code = element.dataset.countryCode;
    if (!code) {
      element.textContent = "Unknown";
      return;
    }
    try {
      element.textContent = countryNames?.of(code) || code;
    } catch (_error) {
      element.textContent = code;
    }
  });

  const printButton = document.querySelector(".print-report-button");
  if (!printButton) return;

  printButton.addEventListener("click", () => {
    window.print();
  });
})();
