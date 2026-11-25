document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const sidebar = document.getElementById("productSidebar");
  const grid = document.getElementById("productsGrid");
  const previous = document.getElementById("detailPrev");
  const next = document.getElementById("detailNext");
  const progress = document.getElementById("detailViewProgress");
  const close = document.getElementById("sidebarClose");
  if (!sidebar || !grid || !previous || !next || !progress) return;

  let activeCard = null;
  const visibleCards = () => [...grid.querySelectorAll(".product-card")].filter(card => {
    const style = getComputedStyle(card);
    return card.style.display !== "none" && style.display !== "none" && style.visibility !== "hidden";
  });
  const syncNavigation = () => {
    const cards = visibleCards();
    const index = cards.indexOf(activeCard);
    const valid = index >= 0;
    progress.textContent = valid ? "Product " + (index + 1) + " of " + cards.length : "";
    previous.disabled = !valid || index === 0;
    next.disabled = !valid || index === cards.length - 1;
  };
  // Reuse the established product card click handling, which already opens the
  // original drawer and synchronizes the selected product and its facts.
  grid.addEventListener("click", event => {
    const card = event.target.closest(".product-card");
    if (!card || !grid.contains(card)) return;
    activeCard = card;
    syncNavigation();
  });
  const change = step => {
    const cards = visibleCards();
    const index = cards.indexOf(activeCard);
    const target = cards[index + step];
    if (!target || index < 0) return;
    target.click();
    document.getElementById('productView').scrollTop = 0;
    if (step > 0) next.focus({preventScroll:true});
    else previous.focus({preventScroll:true});
  };
  previous.addEventListener("click", () => change(-1));
  next.addEventListener("click", () => change(1));
  document.addEventListener("keydown", event => {
    if (!sidebar.classList.contains("open") || document.getElementById("inquiryModal")?.classList.contains("show")) return;
    if (event.target.closest("input,textarea,select,[contenteditable='true']")) return;
    if (event.key === "ArrowLeft") {event.preventDefault();change(-1);}
    if (event.key === "ArrowRight") {event.preventDefault();change(1);}
  });
  close?.addEventListener("click", () => {
    activeCard = null;
    progress.textContent = "";
  });
});
