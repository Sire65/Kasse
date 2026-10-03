// KC MarktKasse - Ameisenrahmen: Wachstumsrichtung der aktiven Kachel (03.10.2026)
// Aktive Kachel ist 5 % groesser. Am Rand der sichtbaren Artikelflaeche waechst sie nach innen.
// Beobachtet NUR childList des Rasters - eigene Klassenwechsel loesen keinen neuen Durchlauf aus.
(function () {
  'use strict';
  var KLASSEN = ['lo','lm','lu','mo','mm','mu','ro','rm','ru'].map(function (k) { return 'kc-ur-' + k; });
  var geplant = false;
  function richte() {
    geplant = false;
    var grid = document.getElementById('productGrid');
    if (!grid) return;
    var w = grid.querySelector('.product-tile-wrap.last-selected');
    if (!w) return;
    var g = grid.getBoundingClientRect(), r = w.getBoundingClientRect();
    if (!r.width) return;
    var rand = r.width * 0.025 + 1; // so weit ragt die 5-%-Vergroesserung je Seite hinaus
    var x = (r.left - g.left < rand) ? 'l' : (g.right - r.right < rand ? 'r' : 'm');
    var y = (r.top - g.top < rand) ? 'o' : (g.bottom - r.bottom < rand ? 'u' : 'm');
    var neu = 'kc-ur-' + x + y;
    if (w.classList.contains(neu)) return;
    KLASSEN.forEach(function (k) { w.classList.remove(k); });
    w.classList.add(neu);
  }
  function planen() {
    if (geplant) return;
    geplant = true;
    if (window.requestAnimationFrame) window.requestAnimationFrame(richte); else setTimeout(richte, 16);
  }
  function start() {
    var grid = document.getElementById('productGrid');
    if (!grid) return setTimeout(start, 300);
    if (window.MutationObserver) new MutationObserver(planen).observe(grid, { childList: true });
    grid.addEventListener('scroll', planen, { passive: true });
    window.addEventListener('resize', planen);
    window.addEventListener('adaptive-layout-change', planen);
    planen();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
