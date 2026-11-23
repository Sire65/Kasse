// KC Kasse – Störungen des Stand-PCs auf dem Tablet anzeigen (KS-05).                               Build 1.1.0
// Am Stand ist der Bildschirm des Mini-PCs oft der Fernseher (Präsentation) – das schwarze Fenster
// mit den Meldungen sieht dann niemand. Darum zeigt die Kasse die Meldung des PCs an.
// 23.11.2026 (Wunsch Betreiber „die Zeile unten stört – packe sie oben in die Meldungszeile“): nicht mehr als
// Streifen unten, sondern in der Meldungszeile oben (dort, wo auch „Normalpreise aktiv“ steht):
//   „⚠ Am PC: <was> – antippen für die Lösung“. Antippen der Meldungszeile öffnet Ursache und Lösungsschritte.
// Gemeldet wird beim Auftreten/Ändern, bei leerem Bon alle 5 Minuten zur Erinnerung, und einmal „✓ wieder in Ordnung“.
// Kassieren wird nie blockiert. Quelle: /kc-kassen-start/stand-meldungen auf dem PC (nur Titel/Ursache/Lösung).
(function (global) {
  'use strict';
  if (global.KCStandMeldungen) return;
  const ERINNERN_MS = 5 * 60 * 1000;
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let letzterSchluessel = '', zuletztGemeldet = 0;

  function melden(text, art) {
    try {
      if (global.KCMessageCore && global.KCMessageCore.add) { global.KCMessageCore.add(text, art); return; }
      if (typeof global.setSystemHint === 'function') { global.setSystemHint(text, art === 'warning' ? 'warn' : art); return; }
    } catch (e) { /* */ }
    const n = document.getElementById('notificationBar'); if (n) n.textContent = text;
  }
  function bonLeer() {
    try { return typeof state === 'undefined' || !state || !Array.isArray(state.cart) || state.cart.length === 0; } // eslint-disable-line no-undef
    catch (e) { return true; }
  }
  function kurztext(m) {
    const weitere = m.length > 1 ? ` (+${m.length - 1} weitere)` : '';
    return `⚠ Am PC: ${m[0].titel}${weitere} – antippen für die Lösung`;
  }

  function zeichne(meldungen) {
    const m = meldungen || [];
    const schluessel = m.map((x) => x.titel).join('|');
    if (!m.length) {
      if (letzterSchluessel) melden('✓ Am PC ist wieder alles in Ordnung', 'success');
      letzterSchluessel = ''; return;
    }
    const neu = schluessel !== letzterSchluessel;
    if (neu || (bonLeer() && Date.now() - zuletztGemeldet > ERINNERN_MS)) {
      melden(kurztext(m), 'warning');
      zuletztGemeldet = Date.now();
    }
    letzterSchluessel = schluessel;
  }

  // Einzelheiten: Antippen der Meldungszeile, solange dort eine PC-Meldung steht
  function einzelheiten() {
    const m = global.KCStandMeldungen.letzte || [];
    if (!m.length) return;
    zu();
    const w = document.createElement('div');
    w.id = 'kcStandMeldungen'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true');
    w.style.cssText = 'position:fixed;inset:0;z-index:99980;background:rgba(7,17,31,.55);display:flex;align-items:center;justify-content:center;padding:16px';
    w.innerHTML = `<div style="background:#fff4e5;color:#7c2d12;border:2px solid #f5a524;border-radius:14px;max-width:560px;width:100%;max-height:85vh;overflow:auto;padding:16px 18px;font:600 15px/1.4 system-ui,Segoe UI,Arial,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.35)">`
      + m.map((x) => `<div style="margin-bottom:10px">⚠ <strong>Am PC: ${esc(x.titel)}</strong><div style="font-weight:400">Ursache: ${esc(x.ursache)}</div><ol style="margin:2px 0 0 20px;font-weight:400">${(x.loesung || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>`).join('')
      + '<div style="text-align:right"><button type="button" data-kc-sm-zu="1" style="font:inherit;padding:8px 16px;min-height:44px;border-radius:10px;border:0;background:#7c2d12;color:#fff">Schließen</button></div></div>';
    w.addEventListener('click', (e) => { if (e.target === w || (e.target.dataset && e.target.dataset.kcSmZu)) zu(); });
    document.body.appendChild(w);
  }
  function zu() { const w = document.getElementById('kcStandMeldungen'); if (w) w.remove(); }
  function zeileAnbinden() {
    const n = document.getElementById('notificationBar');
    if (!n || n.dataset.kcSm) return;
    n.dataset.kcSm = '1';
    n.addEventListener('click', () => { if (/Am PC:/.test(n.textContent || '') && (global.KCStandMeldungen.letzte || []).length) einzelheiten(); });
  }

  async function pruefen() {
    zeileAnbinden();
    try {
      const a = await fetch('/kc-kassen-start/stand-meldungen', { cache: 'no-store' });
      if (!a.ok) return; // anderer Webserver (z. B. Vorführung) - nichts anzeigen
      const d = await a.json();
      global.KCStandMeldungen.letzte = d.meldungen || [];
      zeichne(global.KCStandMeldungen.letzte);
      if (!global.KCStandMeldungen.letzte.length) zu();
    } catch (e) { /* PC nicht erreichbar - das meldet bereits die Startprüfung der Kasse */ }
  }

  // Routinehinweise („Normalpreise aktiv“) überschreiben die Zeile – solange die Störung besteht und der Bon leer ist,
  // kommt die PC-Meldung nach 15 s wieder (ohne den Meldungsverlauf zu füllen). Verkaufsmeldungen haben Vorrang.
  let zeileGeaendert = 0;
  function wiederZeigen() {
    const m = global.KCStandMeldungen.letzte || [], n = document.getElementById('notificationBar');
    if (!m.length || !n || /Am PC:/.test(n.textContent || '') || !bonLeer() || Date.now() - zeileGeaendert < 15000) return;
    n.textContent = kurztext(m);
    n.className = 'notification-bar cart-notification warning visible';
  }
  function zeileBeobachten() {
    const n = document.getElementById('notificationBar'); if (!n || n.dataset.kcSmBeob) return;
    n.dataset.kcSmBeob = '1';
    try { new MutationObserver(() => { if (!/Am PC:/.test(n.textContent || '')) zeileGeaendert = Date.now(); }).observe(n, { childList: true, characterData: true, subtree: true }); } catch (e) { /* */ }
  }

  global.KCStandMeldungen = { letzte: [], pruefen, einzelheiten, version: '1.1.0' };
  const los = () => { zeileBeobachten(); pruefen(); setInterval(pruefen, 30000); setInterval(wiederZeigen, 5000); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', los); else los();
})(window);
