(() => {
  const reportRange = document.getElementById("analyticsRange");
  const customDateFields = document.querySelector(".custom-date-fields");
  if (reportRange && customDateFields) {
    const updateCustomDates = () => {
      customDateFields.hidden = reportRange.value !== "custom";
    };
    reportRange.addEventListener("change", updateCustomDates);
    updateCustomDates();
  }

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

  document.querySelectorAll("[data-severity-dropdown]").forEach((dropdown) => {
    const trigger = dropdown.querySelector(".severity-dropdown-trigger");
    const menu = dropdown.querySelector(".severity-dropdown-menu");
    const input = dropdown.querySelector("[data-severity-input]");
    const label = dropdown.querySelector("[data-severity-label]");
    const options = Array.from(dropdown.querySelectorAll("[data-severity-option]"));
    if (!trigger || !menu || !input || !label || !options.length) return;

    const setOpen = (open, { focusOption = false } = {}) => {
      trigger.setAttribute("aria-expanded", String(open));
      menu.hidden = !open;
      if (open && focusOption) {
        (options.find((option) => option.getAttribute("aria-selected") === "true") || options[0]).focus();
      }
    };

    trigger.addEventListener("click", () => {
      setOpen(trigger.getAttribute("aria-expanded") !== "true", { focusOption: true });
    });

    trigger.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      setOpen(true);
      (event.key === "ArrowDown" ? options[0] : options[options.length - 1]).focus();
    });

    options.forEach((option) => {
      option.addEventListener("click", () => {
        input.value = option.dataset.value;
        label.textContent = option.textContent.trim();
        options.forEach((item) => item.setAttribute("aria-selected", String(item === option)));
        setOpen(false);
        trigger.focus();
      });
    });

    menu.addEventListener("keydown", (event) => {
      const currentIndex = options.indexOf(document.activeElement);
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.focus();
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        options[(currentIndex + direction + options.length) % options.length].focus();
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        options[event.key === "Home" ? 0 : options.length - 1].focus();
      }
    });

    document.addEventListener("click", (event) => {
      if (!dropdown.contains(event.target)) setOpen(false);
    });
  });

  const printButton = document.querySelector(".print-report-button");
  if (!printButton) return;

  printButton.addEventListener("click", () => {
    window.print();
  });
})();
