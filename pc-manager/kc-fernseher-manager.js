// KC PC-Manager – „📺 An den Fernseher senden“ (KS-05)
// Die Präsentation entsteht im TV-Designer. Der Knopf auf der TV-Seite des PC-Managers öffnet den
// Designer (mit aktuellem Bühnenprogramm) und löst dort „An den Fernseher senden“ aus. Der Designer
// schickt das fertige HTML-Programm hierher zurück (sendeProgramm), und von hier geht es
//   am Stand:  an den Webserver dieses PCs – der Fernseher übernimmt es binnen 30 s
//   zu Hause:  über Supabase an den Stand (Fernmodus) – dort genauso.
(function (global) {
  'use strict';
  const el = (id) => document.getElementById(id);

  async function sendeProgramm(html) {
    if (typeof html !== 'string' || !/<html[\s>]/i.test(html)) return { ok: false, text: 'Die Präsentation ist leer. Lösung: im Designer Folien anlegen und erneut senden.' };
    const fern = global.KCFernmodus && global.KCFernmodus.modus && global.KCFernmodus.modus() === 'fern';
    let a, d;
    if (fern) a = await global.KCFernmodus.auftrag('/fernseher/tv-programm', { html });
    else a = await fetch('/kc-kassen-start/tv-programm', { method: 'POST', headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-KC-Aktion': '1' }, body: html });
    d = await a.json().catch(() => ({}));
    let ergebnis;
    if (a.status === 202) ergebnis = { ok: true, text: 'An den Stand unterwegs – kommt auf den Fernseher, sobald der Mini-PC online ist.' };
    else if (a.ok) ergebnis = { ok: true, text: 'Präsentation ist gesendet – der Fernseher zeigt sie spätestens in 30 Sekunden.' };
    else ergebnis = { ok: false, text: (d.fehler || d.error) === 'kein_tv_paket_ort'
      ? 'Dieser PC ist weder Stand-PC noch im Fernmodus. Lösung: am Stand KC_Manager_Start.cmd bzw. zu Hause KC_Zuhause_Start.cmd benutzen.'
      : `Senden fehlgeschlagen (${d.fehler || d.error || a.status}). Lösung: schwarzes Fenster bzw. Internet prüfen und erneut versuchen.` };
    try { global.KCManagerMessages && global.KCManagerMessages[ergebnis.ok ? 'success' : 'error'](ergebnis.text); } catch (e) { /* */ }
    return ergebnis;
  }

  // Designer öffnen (wie „Präsentation bearbeiten“, inkl. Bühnenprogramm) und Senden auslösen.
  function ueberDesignerSenden() {
    const bearbeiten = el('tvDashEdit');
    if (bearbeiten) bearbeiten.click();
    const ausloesen = () => { try { const f = global.open('', 'kcTvDesigner'); if (f) f.postMessage({ type: 'KC_TV_TRIGGER_FERNSEHER' }, '*'); } catch (e) { /* Fenster noch nicht bereit */ } };
    setTimeout(ausloesen, 2500);
  }

  function knopfEinbauen() {
    const nach = el('tvDashExport');
    if (!nach || el('tvDashFernseher')) return;
    const k = document.createElement('button');
    k.type = 'button'; k.id = 'tvDashFernseher'; k.className = 'primary';
    k.textContent = '📺 An den Fernseher senden';
    k.title = 'Präsentation aus dem TV-Designer direkt auf den Fernseher am Stand schicken (ohne USB-Stick)';
    k.onclick = ueberDesignerSenden;
    nach.insertAdjacentElement('afterend', k);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', knopfEinbauen); else knopfEinbauen();
  global.KCFernseherManager = { sendeProgramm, ueberDesignerSenden };
})(window);
