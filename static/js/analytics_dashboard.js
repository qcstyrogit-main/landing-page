(() => {
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
