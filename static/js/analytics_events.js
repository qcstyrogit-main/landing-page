(() => {
  if (navigator.doNotTrack === "1") return;

  const sentOnce = new Set();

  function track(event, label = "", onceKey = "") {
    if (onceKey && sentOnce.has(onceKey)) return;
    if (onceKey) sentOnce.add(onceKey);

    const headers = window.withCsrf
      ? window.withCsrf({ "Content-Type": "application/json" })
      : { "Content-Type": "application/json" };

    fetch("/api/analytics/event", {
      method: "POST",
      headers,
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({
        event,
        label: String(label || "").slice(0, 120),
        path: window.location.pathname
      })
    }).catch(() => {
      // Analytics must never interrupt a visitor's action.
    });
  }

  let lastActivityAt = Date.now();
  let lastTickAt = performance.now();
  let pendingSeconds = 0;
  let mediaPlaying = false;

  const markActive = () => {
    lastActivityAt = Date.now();
  };

  ["pointerdown", "keydown", "scroll", "touchstart"].forEach((name) => {
    window.addEventListener(name, markActive, { passive: true });
  });
  window.addEventListener("focus", markActive);
  document.addEventListener("play", () => {
    mediaPlaying = true;
    markActive();
  }, true);
  document.addEventListener("pause", () => {
    mediaPlaying = false;
  }, true);
  document.addEventListener("ended", () => {
    mediaPlaying = false;
  }, true);

  function flushEngagement() {
    const seconds = Math.floor(pendingSeconds);
    if (seconds < 1) return;
    pendingSeconds -= seconds;

    const headers = window.withCsrf
      ? window.withCsrf({ "Content-Type": "application/json" })
      : { "Content-Type": "application/json" };

    fetch("/api/analytics/engagement", {
      method: "POST",
      headers,
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({
        seconds,
        path: window.location.pathname
      })
    }).catch(() => {
      // Losing an analytics heartbeat must never affect the page.
    });
  }

  function engagementTick(flush = false) {
    const now = performance.now();
    const elapsed = Math.min(15, Math.max(0, (now - lastTickAt) / 1000));
    lastTickAt = now;
    const recentlyActive = Date.now() - lastActivityAt <= 60_000;
    if (document.visibilityState === "visible" && (recentlyActive || mediaPlaying)) {
      pendingSeconds += elapsed;
    }
    if (flush || pendingSeconds >= 10) flushEngagement();
  }

  window.setInterval(() => engagementTick(), 10_000);
  document.addEventListener("visibilitychange", () => {
    engagementTick(document.visibilityState === "hidden");
  });
  window.addEventListener("pagehide", () => engagementTick(true));

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const productCard = target.closest(".product-card");
    if (productCard && !target.closest("button, a, input, select, textarea")) {
      track("product_view", productCard.dataset.name || productCard.dataset.code || "Product");
      return;
    }

    if (target.closest("#sidebarInquireBtn, [data-inquiry-product]")) {
      const productName =
        document.getElementById("sidebarName")?.textContent ||
        target.closest(".product-card")?.dataset.name ||
        "Product";
      track("inquiry_open", productName);
      return;
    }

    if (target.closest("[data-contact-modal-trigger]")) {
      track("contact_open", "", "contact-open");
      return;
    }

    if (target.closest("#chat-bubble")) {
      track("chat_open", "", "chat-open");
      return;
    }

    if (target.closest(".view-jobs-btn, a[href^='/view_jobs']")) {
      track("view_jobs", "", "view-jobs");
    }
  }, true);

  window.addEventListener("catalog:inquire", (event) => {
    const products = Array.isArray(event.detail?.products) ? event.detail.products : [];
    track("inquiry_open", products.join(", ") || "Selected products");
  });
})();
