const modalPrivacy = document.getElementById("privacyModal");
const modalTerms = document.getElementById("termofuseModal");
const openPrivacy = document.getElementById("privacyLink");
const openTerms = document.getElementById("termofuseLink");
const closePrivacy = modalPrivacy ? modalPrivacy.querySelector(".close") : null;
const closeTerms = modalTerms ? modalTerms.querySelector(".close") : null;

let lastFocused = null;
let trapHandler = null;

function getFocusable(container) {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
  ).filter(el => el.offsetParent !== null);
}

function trapFocus(modal) {
  const focusable = getFocusable(modal);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  trapHandler = (event) => {
    if (event.key === "Tab") {
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    if (event.key === "Escape") {
      closeModal(modal);
    }
  };
  document.addEventListener("keydown", trapHandler);
  first.focus();
}

function releaseFocus() {
  if (trapHandler) {
    document.removeEventListener("keydown", trapHandler);
    trapHandler = null;
  }
  if (lastFocused) lastFocused.focus();
  lastFocused = null;
}

function openModal(modal, trigger) {
  if (!modal) return;
  lastFocused = trigger || document.activeElement;
  modal.style.display = "block";
  modal.setAttribute("aria-hidden", "false");
  modal.removeAttribute("inert");
  document.body.classList.add("modal-open");
  trapFocus(modal);
}

function closeModal(modal) {
  if (!modal) return;
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  modal.setAttribute("inert", "");
  document.body.classList.remove("modal-open");
  releaseFocus();
}

if (openPrivacy) {
  openPrivacy.addEventListener("click", () => openModal(modalPrivacy, openPrivacy));
}
if (closePrivacy) {
  closePrivacy.addEventListener("click", () => closeModal(modalPrivacy));
}

if (openTerms) {
  openTerms.addEventListener("click", () => openModal(modalTerms, openTerms));
}
if (closeTerms) {
  closeTerms.addEventListener("click", () => closeModal(modalTerms));
}

window.addEventListener("click", (event) => {
  if (event.target === modalTerms) closeModal(modalTerms);
  if (event.target === modalPrivacy) closeModal(modalPrivacy);
});
