/* AdaptiveLayoutCore V1.0.1 Architecture Candidate
 * Framework service core: detects viewport/input profiles and applies layout classes.
 * It never changes business data or sales logic.
 *
 * 11.09.2026 - Altgeraete-Haertung (Tablet-Kompatibilitaet SM-T535/Android 5.0.2):
 * bewusst in ES5-Syntax umgeschrieben (kein Optional Chaining, kein Template-String,
 * keine Arrow-Functions/Destructuring) - auf sehr alten Android-Browsern liess eine
 * einzige nicht verstandene Syntaxstelle die GANZE Datei stumm scheitern, wodurch die
 * Kasse nie in die kompakte tablet-fit-Ansicht wechselte (Layout blieb "verschoben und
 * zusammengedrueckt"). Verhalten fuer moderne Browser bleibt unveraendert.
 */
(function () {
  "use strict";
  var VERSION = "1.0.1";
  var scheduled = false, lastProfile = "";

  function mq(q) {
    try {
      return !!(window.matchMedia && window.matchMedia(q).matches);
    } catch (e) { return false; }
  }

  function viewport() {
    var vv = window.visualViewport;
    var vvWidth = vv && typeof vv.width === "number" ? vv.width : null;
    var vvHeight = vv && typeof vv.height === "number" ? vv.height : null;
    var width = Math.round(vvWidth || window.innerWidth || document.documentElement.clientWidth || 0);
    var height = Math.round(vvHeight || window.innerHeight || document.documentElement.clientHeight || 0);
    return {
      width: width,
      height: height,
      orientation: width >= height ? "landscape" : "portrait",
      ratio: height ? width / height : 1
    };
  }

  function detect() {
    var vp = viewport();
    var coarse = mq("(pointer: coarse)") || Number(navigator.maxTouchPoints || 0) > 0;
    var touch = coarse || ("ontouchstart" in window);
    var profile = "desktop";
    if (touch && vp.orientation === "landscape" && vp.width >= 900 && vp.width <= 1440 && vp.height <= 1050) {
      profile = "tablet-landscape";
    } else if (touch && vp.orientation === "portrait" && vp.width <= 1024) {
      profile = "tablet-portrait";
    } else if (vp.width < 1100 || vp.height < 760) {
      profile = "desktop-compact";
    }
    var density = vp.height < 720 ? "very-compact" : (vp.height < 900 ? "compact" : "comfortable");
    return {
      width: vp.width, height: vp.height, orientation: vp.orientation, ratio: vp.ratio,
      touch: touch, coarse: coarse, profile: profile, density: density
    };
  }

  function setCssVar(el, name, value) {
    /* alte Browser ohne CSS-Variablen-Unterstuetzung ignorieren setProperty auf
       "--namen" nicht kaputt - sie tun einfach nichts. Kein try/catch noetig, aber
       schadet nicht als zusaetzliche Absicherung. */
    try { el.style.setProperty(name, value); } catch (e) {}
  }

  function applyNow() {
    scheduled = false;
    var p = detect();
    var body = document.body, html = document.documentElement;
    if (!body) return p;
    setCssVar(html, "--app-height", p.height + "px");
    setCssVar(html, "--app-width", p.width + "px");
    /* Zusaetzlich als direkte Pixelhoehe auf .app-shell - unabhaengig davon, ob der
       Browser var()/dvh ueberhaupt versteht (Altgeraete-Sicherheitsnetz). */
    var shell = document.querySelector(".app-shell");
    if (shell) { try { shell.style.height = p.height + "px"; } catch (e) {} }

    var remove = ["tablet-fit", "tablet-portrait", "adaptive-desktop-compact", "adaptive-compact", "adaptive-very-compact"];
    for (var i = 0; i < remove.length; i++) {
      if (body.classList) { body.classList.remove(remove[i]); }
      else { body.className = body.className.replace(new RegExp("(^|\\s)" + remove[i] + "(\\s|$)", "g"), " "); }
    }
    function addClass(c) {
      if (body.classList) { body.classList.add(c); }
      else if ((" " + body.className + " ").indexOf(" " + c + " ") === -1) { body.className += " " + c; }
    }
    if (p.profile === "tablet-landscape") addClass("tablet-fit");
    if (p.profile === "tablet-portrait") addClass("tablet-portrait");
    if (p.profile === "desktop-compact") addClass("adaptive-desktop-compact");
    if (p.density === "compact") addClass("adaptive-compact");
    if (p.density === "very-compact") addClass("adaptive-very-compact");

    if (body.dataset) {
      body.dataset.layoutProfile = p.profile;
      body.dataset.layoutDensity = p.density;
    } else {
      body.setAttribute("data-layout-profile", p.profile);
      body.setAttribute("data-layout-density", p.density);
    }
    lastProfile = p.profile + ":" + p.density + ":" + p.width + "x" + p.height;
    try {
      var evt;
      if (typeof CustomEvent === "function") { evt = new CustomEvent("adaptive-layout-change", { detail: p }); }
      else { evt = document.createEvent("CustomEvent"); evt.initCustomEvent("adaptive-layout-change", true, true, p); }
      window.dispatchEvent(evt);
    } catch (e) {}
    return p;
  }

  function recalculate() {
    if (scheduled) return;
    scheduled = true;
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(function () { requestAnimationFrame(applyNow); });
    } else {
      setTimeout(applyNow, 32);
    }
  }

  function init() {
    applyNow();
    window.addEventListener("resize", recalculate, { passive: true });
    if (window.visualViewport && window.visualViewport.addEventListener) {
      window.visualViewport.addEventListener("resize", recalculate, { passive: true });
    }
    window.addEventListener("orientationchange", recalculate, { passive: true });
    document.addEventListener("fullscreenchange", recalculate);
  }

  window.AdaptiveLayoutCore = {
    version: VERSION,
    init: init,
    detect: detect,
    viewport: viewport,
    recalculate: recalculate,
    profile: function () { return detect().profile; },
    lastProfile: function () { return lastProfile; }
  };
})();
