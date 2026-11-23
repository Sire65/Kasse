// KC Kasse – neue Programmversion vom Kassen-PC übernehmen (Selbst-Update, 23.11.2026).
// Der Kassen-PC holt beim Start neue Dateien. Die Tablets merken das hier (alle 2 Minuten kurze Abfrage
// /kc-kassen-start/programm-version, ein paar Byte) und laden NUR in einer Ruhepause neu:
//   - kein Artikel im Bon, kein Fenster/Dialog offen, 2 Minuten niemand am Bildschirm.
// Kassieren wird nie unterbrochen. Buchungen liegen ohnehin sicher im Speicher des Tablets.
(function (global) {
  'use strict';
  if (global.KCProgrammVersion) return;
  const ABFRAGE_MS = 2 * 60 * 1000, RUHE_MS = 2 * 60 * 1000, PRUEF_MS = 15 * 1000;
  let geladen = null, neu = null, letzteBedienung = Date.now(), laeuft = false;

  ['pointerdown', 'keydown', 'touchstart'].forEach((t) => global.addEventListener(t, () => { letzteBedienung = Date.now(); }, { capture: true, passive: true }));

  function bonLeer() {
    try { return typeof state === 'undefined' || !state || !Array.isArray(state.cart) || state.cart.length === 0; } // eslint-disable-line no-undef
    catch (e) { return false; }
  }
  function fensterOffen() {
    return !!document.querySelector('dialog[open], .modal.open, .modal.is-open, [aria-modal="true"]:not([hidden])');
  }
  function ruhig() { return bonLeer() && !fensterOffen() && Date.now() - letzteBedienung >= RUHE_MS && !document.hidden; }

  async function abfragen() {
    try {
      const a = await fetch('/kc-kassen-start/programm-version', { cache: 'no-store' });
      if (!a.ok) return;
      const v = (await a.json()).version;
      if (!v) return;
      if (!geladen) geladen = v;
      else if (v !== geladen) neu = v;
    } catch (e) { /* PC gerade nicht erreichbar */ }
  }

  async function uebernehmen() {
    if (!neu || laeuft || !ruhig()) return;
    laeuft = true;
    try {
      // Neuen Service-Worker holen (er lädt die geänderten Dateien), dann neu laden.
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg) { await reg.update().catch(() => {}); await new Promise((r) => setTimeout(r, 8000)); }
      if (!ruhig()) { laeuft = false; return; }
      try { sessionStorage.setItem('kc_programm_neu_geladen', neu); } catch (e) { /* */ }
      global.location.reload();
    } catch (e) { laeuft = false; }
  }

  global.KCProgrammVersion = { abfragen, uebernehmen, status: () => ({ geladen, neu, ruhig: ruhig() }) };
  const los = () => { abfragen(); setInterval(abfragen, ABFRAGE_MS); setInterval(uebernehmen, PRUEF_MS); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', los); else los();
})(window);
