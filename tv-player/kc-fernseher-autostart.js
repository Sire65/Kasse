// KC TV-Player – Fernsehbetrieb am Stand (KS-05). Nur aktiv mit ?fernseher=1 (so öffnet der
// Kassen-Start den Fernseher). Ohne den Parameter bleibt der TV-Player genau wie bisher.
//   • Bedienleiste und Mauszeiger ausblenden – Kunden sehen nur die Präsentation.
//   • Präsentation vom PC holen (PC-Manager → „📺 An den Fernseher senden“), ohne USB-Stick und
//     ohne Klick; ein neu gesendetes Paket wird innerhalb von 30 s übernommen, ohne Neustart.
//   • Gibt es noch keins: zuletzt gezeigtes Paket, sonst die eingebaute Weihnachtsmarkt-
//     Präsentation – nie „TV-Paket bitte einlesen“ vor den Kunden.
//   • Bildschirm wach halten (kein Abdunkeln/Bildschirmschoner durch den Browser).
(function (global) {
  'use strict';
  const q = new URLSearchParams(location.search);
  if (q.get('fernseher') !== '1') return;
  const KEY = 'kc_tv_player_package', STAND_KEY = 'kc_tv_fernseher_stand';
  const PRUEFEN_MS = Math.max(2, Number(q.get('pruefen')) || 30) * 1000;
  document.documentElement.classList.add('kc-fernseher');
  const stil = document.createElement('style');
  stil.textContent = '.kc-fernseher #control{display:none!important}.kc-fernseher,.kc-fernseher *{cursor:none!important}';
  document.head.appendChild(stil);

  const gueltig = (p) => p && ['KC-TV-1', 'kcm-tv-package-v2'].includes(p.schema) && Array.isArray(p.slides) && p.slides.length > 0;

  function zeige(paket, herkunft) {
    try {
      try { global.KCAudioPresentationCore && global.KCAudioPresentationCore.stop && global.KCAudioPresentationCore.stop(); } catch (e) { /* */ }
      // „data“, „i“ und show() gehören zu app.js (gemeinsamer Skript-Bereich der Seite).
      data = paket; i = 0; global.currentTvPackageData = paket; // eslint-disable-line no-undef
      try { global.KCAudioPresentationCore && global.KCAudioPresentationCore.play(paket, { base: '../' }); } catch (e) { /* ohne Ton weiter */ }
      show(); // eslint-disable-line no-undef
      global.KCFernseher.herkunft = herkunft;
      document.documentElement.dataset.kcFernseherHerkunft = herkunft;
    } catch (e) { /* Anzeige läuft mit dem bisherigen Inhalt weiter */ }
  }

  async function holeVomPc(erzwingen) {
    let st;
    try {
      const a = await fetch('/kc-kassen-start/tv-paket?nurStand=1', { cache: 'no-store' });
      if (a.status === 404) return 'keins';
      if (!a.ok) return 'fehler';
      st = String((await a.json()).stand);
    } catch (e) { return 'fehler'; }
    let bekannt = null; try { bekannt = localStorage.getItem(STAND_KEY); } catch (e) { /* */ }
    if (!erzwingen && bekannt === st && global.KCFernseher.herkunft === 'pc') return 'unveraendert';
    try {
      const a = await fetch('/kc-kassen-start/tv-paket', { cache: 'no-store' });
      if (!a.ok) return 'fehler';
      const text = await a.text();
      const paket = JSON.parse(text);
      if (!gueltig(paket)) return 'ungueltig';
      // Für einen Neustart ohne PC merken - große Pakete passen evtl. nicht in den Browser-Speicher.
      try { localStorage.setItem(KEY, text); localStorage.setItem(STAND_KEY, st); } catch (e) { try { localStorage.setItem(STAND_KEY, ''); } catch (x) { /* */ } }
      zeige(paket, 'pc');
      return 'neu';
    } catch (e) { return 'fehler'; }
  }

  function eingebaut() {
    const C = global.KC_WEIHNACHTSMARKT_PRESENTATION;
    if (C && C.create) { try { zeige(C.create(), 'eingebaut'); return true; } catch (e) { /* */ } }
    return false;
  }

  let wachhalter = null;
  async function wachHalten() {
    try { if (navigator.wakeLock && document.visibilityState === 'visible') wachhalter = await navigator.wakeLock.request('screen'); } catch (e) { /* nicht verfügbar */ }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wachHalten(); });

  async function start() {
    const ergebnis = await holeVomPc(true);
    if (ergebnis !== 'neu') {
      let gespeichert = null; try { gespeichert = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* */ }
      if (gueltig(gespeichert)) global.KCFernseher.herkunft = 'gespeichert'; // app.js zeigt es bereits
      else eingebaut();
      document.documentElement.dataset.kcFernseherHerkunft = global.KCFernseher.herkunft || '';
    }
    wachHalten();
    setInterval(() => { holeVomPc(false); }, PRUEFEN_MS);
  }

  global.KCFernseher = { herkunft: null, holeVomPc, wachhalter: () => wachhalter };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(window);
