(() => {
  const printButton = document.querySelector(".print-report-button");
  if (!printButton) return;

  printButton.addEventListener("click", () => {
    window.print();
  });
})();
