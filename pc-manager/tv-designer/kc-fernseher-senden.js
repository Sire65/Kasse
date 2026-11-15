// TV-Designer – „📺 An den Fernseher senden“ (KS-05)
// Schickt die Präsentation als eigenständiges HTML-Programm (dasselbe wie START_TV_PLAYER.html im
// TV-Paket) direkt auf den Fernseher am Stand – ohne USB-Stick, ohne Klick am Fernseher.
//   Geöffnet aus dem PC-Manager: über dessen Weg (am Stand direkt, zu Hause über Supabase).
//   Sonst: direkt an den Webserver dieses PCs.
(function (global) {
  'use strict';
  const meldeStatus = (t) => { try { if (typeof status === 'function') status(t); } catch (e) { /* */ } }; // eslint-disable-line no-undef

  async function direkt(html) {
    const a = await fetch('/kc-kassen-start/tv-programm', { method: 'POST', headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-KC-Aktion': '1' }, body: html });
    const d = await a.json().catch(() => ({}));
    if (a.ok) return { ok: true, text: 'Präsentation ist gesendet – der Fernseher zeigt sie spätestens in 30 Sekunden.' };
    return { ok: false, text: d.fehler === 'kein_tv_paket_ort'
      ? 'Dieser PC ist nicht der Stand-PC. Lösung: den Designer aus dem PC-Manager öffnen (zu Hause: KC_Zuhause_Start.cmd), dann geht es über Supabase.'
      : `Senden fehlgeschlagen (${d.fehler || a.status}). Lösung: Läuft das schwarze Fenster? Dann erneut versuchen.` };
  }

  async function senden() {
    if (typeof buildStandaloneProgram !== 'function') { meldeStatus('Präsentation ist noch nicht geladen – bitte kurz warten und erneut versuchen.'); return { ok: false }; } // eslint-disable-line no-undef
    let html;
    try { html = buildStandaloneProgram(); } catch (e) { meldeStatus(`Präsentation konnte nicht erzeugt werden (${e.message}).`); return { ok: false }; } // eslint-disable-line no-undef
    meldeStatus('Präsentation wird an den Fernseher gesendet …');
    let ergebnis;
    try {
      const pcManager = global.opener && !global.opener.closed && global.opener.KCFernseherManager;
      ergebnis = pcManager && pcManager.sendeProgramm ? await pcManager.sendeProgramm(html) : await direkt(html);
    } catch (e) { ergebnis = { ok: false, text: `Senden fehlgeschlagen (${e.message}). Lösung: Internet bzw. schwarzes Fenster prüfen und erneut versuchen.` }; }
    meldeStatus(ergebnis.text);
    return ergebnis;
  }

  function knopf() {
    const exportKnopf = document.getElementById('tvPackageExportBtn');
    if (!exportKnopf || document.getElementById('tvFernseherSendenBtn')) return;
    const k = document.createElement('button');
    k.id = 'tvFernseherSendenBtn'; k.type = 'button'; k.textContent = '📺 An den Fernseher senden';
    k.title = 'Präsentation direkt auf den Fernseher am Stand schicken (ohne USB-Stick)';
    k.onclick = senden;
    exportKnopf.insertAdjacentElement('afterend', k);
  }
  global.addEventListener('message', (e) => { if (e.data && e.data.type === 'KC_TV_TRIGGER_FERNSEHER') senden(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', knopf); else knopf();
  global.KCFernseherSenden = { senden };
})(window);
