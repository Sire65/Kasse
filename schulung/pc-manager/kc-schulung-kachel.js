/* PC-Manager: Kachel "Schulung" im Dashboard.                                       08.09.2026
   Liest die Liste der Uebungstablets vom Webserver 8090 (derselbe Ursprung wie der Manager),
   zeigt Kennung, Name, geuebte Bons, zuletzt gesehen. "Schulung beenden" leert die Liste. */
(function () {
  'use strict';
  const BASIS = location.origin && /^http/.test(location.origin) ? location.origin : 'http://127.0.0.1:8090';
  function karte() {
    if (document.getElementById('kcSchulungKachel')) return document.getElementById('kcSchulungKachel');
    const grid = document.querySelector('[data-view="dashboard"] .dashboard-grid, .dashboard-grid'); if (!grid) return null;
    const a = document.createElement('article'); a.className = 'panel'; a.id = 'kcSchulungKachel';
    a.innerHTML = '<h3>🎓 Schulung <small id="kcSchulungAnzahl" style="font-weight:400;color:#6b7280"></small></h3><div id="kcSchulungListe" style="font-size:14px">–</div><p style="margin:8px 0 0"><button type="button" id="kcSchulungEnde" style="padding:6px 10px;border:0;border-radius:6px;background:#7f1d1d;color:#fff;cursor:pointer">Schulung beenden (Liste leeren)</button></p><p style="margin:6px 0 0;font-size:12px;color:#6b7280">Übungstablets kommen über den Schulungs-QR der Markttag-Übersicht. Übungsdaten bleiben auf den Tablets, hier nur Anwesenheit und Übungsstand.</p>';
    grid.appendChild(a);
    a.querySelector('#kcSchulungEnde').addEventListener('click', async () => { try { await fetch(BASIS + '/schulung/beenden', { method: 'POST' }); } catch (e) { /* egal */ } laden(); });
    return a;
  }
  async function laden() {
    const a = karte(); if (!a) return;
    try {
      const r = await fetch(BASIS + '/schulung/liste', { cache: 'no-store' }); const j = await r.json();
      const g = (j.geraete || []).sort((x, y) => x.kennung.localeCompare(y.kennung));
      a.querySelector('#kcSchulungAnzahl').textContent = g.length ? `${g.length} Tablet${g.length === 1 ? '' : 's'} verbunden` : 'kein Tablet verbunden';
      a.querySelector('#kcSchulungListe').innerHTML = g.length ? '<table style="width:100%;border-collapse:collapse"><tr><th style="text-align:left">Kennung</th><th style="text-align:left">Name</th><th>Bons geübt</th><th>zuletzt</th></tr>' + g.map((x) => `<tr><td>${x.kennung}</td><td>${(x.name || '–').replace(/[<>&]/g, '')}</td><td style="text-align:center">${x.bons || 0}</td><td style="text-align:center">${new Date(x.zuletzt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</td></tr>`).join('') + '</table>' : '–';
    } catch (e) { a.querySelector('#kcSchulungAnzahl').textContent = 'Webserver nicht erreichbar'; }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', laden); else laden();
  setInterval(laden, 10000);
})();
