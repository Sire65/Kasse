// KC Kasse – Störungen des Stand-PCs auf dem Tablet anzeigen (KS-05).
// Am Stand ist der Bildschirm des Mini-PCs oft der Fernseher (Präsentation) – das schwarze Fenster
// mit den Meldungen sieht dann niemand. Darum zeigt die Kasse einen schmalen Hinweis unten an:
// „Am PC: <was> – Lösung: …“. Antippen zeigt alle Schritte. Kassieren wird nie blockiert.
// Quelle: /kc-kassen-start/stand-meldungen auf dem PC (nur Titel/Ursache/Lösung, keine Geheimnisse).
(function (global) {
  'use strict';
  if (global.KCStandMeldungen) return;
  const PAUSE_KEY = 'kc_stand_meldungen_pause_bis';
  let offen = false;
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function streifen() {
    let el = document.getElementById('kcStandMeldungen');
    if (!el) {
      el = document.createElement('div'); el.id = 'kcStandMeldungen'; el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:9000;background:#fff4e5;color:#7c2d12;border:2px solid #f5a524;border-radius:10px;padding:8px 12px;font:600 15px/1.35 system-ui,Segoe UI,Arial,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25);display:none';
      el.addEventListener('click', (e) => {
        if (e.target && e.target.dataset && e.target.dataset.kcSmPause) { try { localStorage.setItem(PAUSE_KEY, String(Date.now() + 10 * 60 * 1000)); } catch (x) { /* */ } el.style.display = 'none'; return; }
        offen = !offen; zeichne(global.KCStandMeldungen.letzte);
      });
      document.body.appendChild(el);
    }
    return el;
  }

  function zeichne(meldungen) {
    const el = streifen();
    let pause = 0; try { pause = Number(localStorage.getItem(PAUSE_KEY) || 0); } catch (e) { /* */ }
    if (!meldungen || !meldungen.length || Date.now() < pause) { el.style.display = 'none'; return; }
    const m = meldungen[0];
    const weitere = meldungen.length > 1 ? ` (+${meldungen.length - 1} weitere)` : '';
    el.innerHTML = offen
      ? meldungen.map((x) => `<div style="margin-bottom:6px">⚠ <strong>Am PC: ${esc(x.titel)}</strong><div style="font-weight:400">Ursache: ${esc(x.ursache)}</div><ol style="margin:2px 0 0 20px;font-weight:400">${(x.loesung || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>`).join('')
        + '<div style="text-align:right"><button type="button" data-kc-sm-pause="1" style="font:inherit;padding:4px 10px">10 Minuten ausblenden</button></div>'
      : `⚠ Am PC: ${esc(m.titel)}${weitere} – <u>antippen für die Lösung</u>`;
    el.style.display = 'block';
  }

  async function pruefen() {
    try {
      const a = await fetch('/kc-kassen-start/stand-meldungen', { cache: 'no-store' });
      if (!a.ok) return; // anderer Webserver (z. B. Vorführung) - nichts anzeigen
      const d = await a.json();
      global.KCStandMeldungen.letzte = d.meldungen || [];
      zeichne(global.KCStandMeldungen.letzte);
    } catch (e) { /* PC nicht erreichbar - das meldet bereits die Startprüfung der Kasse */ }
  }

  global.KCStandMeldungen = { letzte: [], pruefen };
  const los = () => { pruefen(); setInterval(pruefen, 30000); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', los); else los();
})(window);
