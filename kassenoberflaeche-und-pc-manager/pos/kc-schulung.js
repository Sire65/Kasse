/* KC SCHULUNG - beliebig viele Uebungstablets ueber einen QR.                          08.09.2026
 * Aufruf: pos/index.html?schulung=1 (Schulungs-QR aus der Markttag-Uebersicht).
 * - eigene Kennung je Tablet (SCHULUNG-nn, vom Webserver vergeben, danach gemerkt)
 * - Trainingsmodus fest an und nicht abschaltbar: alle Bons in der T-Liste, nie im Umsatz
 * - keine Kopplung an einen Kassendienst (Kassenkonflikt-Sperre bleibt fuer Kasse 1/2)
 * - Lebenszeichen alle 30 s an den Webserver (der die Kasse ausliefert) -> Liste in der Uebersicht
 */
(function (global) {
  'use strict';
  const q = new URLSearchParams(location.search);
  const LAGER = 'kc.schulung.v1';
  let st; try { st = JSON.parse(localStorage.getItem(LAGER) || 'null'); } catch (e) { st = null; }
  if (q.get('schulung') === '1' && !st) { st = { aktiv: true, kennung: '', name: '', seit: new Date().toISOString() }; localStorage.setItem(LAGER, JSON.stringify(st)); }
  if (q.get('schulung') === '0' && st) { localStorage.removeItem(LAGER); st = null; }
  if (!st || !st.aktiv) return;
  const speichern = () => { try { localStorage.setItem(LAGER, JSON.stringify(st)); } catch (e) { /* voll */ } };
  const basis = location.origin;

  function trainingFest() {
    try {
      const m = JSON.parse(localStorage.getItem('kc_master_v040') || '{}');
      let g = false;
      if (m.trainingMode !== true) { m.trainingMode = true; g = true; }
      if (st.kennung && m.registerId !== st.kennung) { m.registerId = st.kennung; m.registerName = 'Schulung ' + st.kennung.replace('SCHULUNG-', ''); g = true; }
      if (g) localStorage.setItem('kc_master_v040', JSON.stringify(m));
      if (typeof state !== 'undefined' && state && state.master) { state.master.trainingMode = true; if (st.kennung) state.master.registerId = st.kennung; }
    } catch (e) { /* egal */ }
  }
  /* Trainingsmodus darf hier niemand ausschalten - Schalter abfangen */
  function schalterSperren() {
    ['trainingModeTopBtn', 'trainingModeBtn'].forEach((id) => { const b = document.getElementById(id); if (b && !b.dataset.kcSchulung) { b.dataset.kcSchulung = '1'; b.addEventListener('click', (e) => { e.stopImmediatePropagation(); e.preventDefault(); trainingFest(); global.setSystemHint?.('Schulung: Trainingsmodus bleibt an'); }, true); } });
  }
  function band() {
    if (document.getElementById('kcSchulungBand')) return;
    const b = document.createElement('div'); b.id = 'kcSchulungBand';
    b.style.cssText = 'position:fixed;left:50%;top:0;transform:translateX(-50%);z-index:200;background:#b45309;color:#fff;font:700 13px/1 system-ui;padding:5px 14px;border-radius:0 0 10px 10px;box-shadow:0 2px 6px rgba(0,0,0,.4);pointer-events:auto;cursor:pointer';
    b.textContent = `🎓 SCHULUNG · ${st.kennung || '…'}${st.name ? ' · ' + st.name : ''} · Übungsdaten, kein Umsatz`;
    b.title = 'Tippen: Namen eintragen'; b.addEventListener('click', () => { const n = prompt('Dein Name für die Schulung:', st.name || ''); if (n !== null) { st.name = n.trim().slice(0, 40); speichern(); b.textContent = `🎓 SCHULUNG · ${st.kennung}${st.name ? ' · ' + st.name : ''} · Übungsdaten, kein Umsatz`; lebenszeichen(); } });
    document.body.appendChild(b);
  }
  async function lebenszeichen() {
    try {
      let bons = 0; try { bons = readTrainingTransactions().length; } catch (e) { bons = 0; }
      const r = await fetch(basis + '/schulung/anmelden', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kennung: st.kennung, name: st.name, bons, geraet: navigator.platform || '' }) });
      const j = await r.json();
      if (j && j.kennung && !st.kennung) { st.kennung = j.kennung; speichern(); trainingFest(); const b = document.getElementById('kcSchulungBand'); if (b) b.textContent = `🎓 SCHULUNG · ${st.kennung}${st.name ? ' · ' + st.name : ''} · Übungsdaten, kein Umsatz`; }
    } catch (e) { /* Webserver nicht erreichbar - Schulung laeuft trotzdem, nur ohne Liste */ }
  }
  function start() { trainingFest(); schalterSperren(); band(); lebenszeichen(); setInterval(lebenszeichen, 30000); setInterval(schalterSperren, 3000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  global.KCSchulung = { stand: () => st };
})(window);
