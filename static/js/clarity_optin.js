/* Microsoft Clarity: opt-in only, public pages only. */
(function () {
  "use strict";
  if (document.body.classList.contains("application-page") ||
      /^\/(?:login|analytics|forgot_password|apply_now)(?:\/|$)/i.test(location.pathname)) return;
  var key = "qc_clarity_analytics_consent_v1";
  var consent;
  try { consent = localStorage.getItem(key); } catch (_) { consent = null; }

  function activate() {
    if (window.__qcClarityLoaded) return;
    window.__qcClarityLoaded = true;
    (function (c,l,a,r,i,t,y) {
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r); t.async=1; t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t,y);
    })(window,document,"clarity","script","zbqlklbvlv");
  }
  if (consent === "granted") { activate(); return; }
  if (consent === "denied") return;

  var banner=document.createElement("aside");
  banner.className="clarity-consent";
  banner.setAttribute("aria-label","Optional website analytics");
  banner.innerHTML='<p>May we use optional Microsoft Clarity analytics to understand how visitors use this website? This may record clicks and scrolling. You can decline and still use the site.</p><div class="clarity-consent-actions"><button type="button" data-consent="denied">Decline</button><button type="button" data-consent="granted">Allow analytics</button></div>';
  banner.addEventListener("click",function(e){
    var button=e.target.closest("button[data-consent]");
    if (!button) return;
    var choice=button.getAttribute("data-consent");
    try { localStorage.setItem(key,choice); } catch (_) {}
    banner.remove();
    if(choice==="granted") activate();
  });
  document.body.appendChild(banner);
})();
