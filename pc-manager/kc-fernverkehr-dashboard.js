// KC PC-Manager – Fernverkehr-Dashboard. Bündelt Verbindungsstatus, Antwortzeit-Verlauf (Lag)
// und Ereignis-Historie für alle Kassen an einem Ort - besonders gedacht für den
// Fernzugriffs-Fall (Manager zuhause, Kasse am Markt über Internet verbunden).
(function (global) {
  'use strict';
  const WS_HOST = '127.0.0.1', WS_PORT = 47392;

  async function ladeQualitaetsverlauf() {
    const antwort = await fetch(`http://${WS_HOST}:${WS_PORT}/verbindungsqualitaet?limit=500`);
    if (!antwort.ok) throw new Error('Abruf fehlgeschlagen');
    return (await antwort.json()).eintraege || [];
  }

  function nachKasseGruppieren(eintraege) {
    const gruppen = {};
    for (const e of eintraege) {
      if (!e.register_id) continue;
      (gruppen[e.register_id] ||= []).push(e);
    }
    return gruppen;
  }

  // Einfache SVG-Liniengrafik - keine externe Bibliothek nötig, passt zum bestehenden Stil
  // (dasselbe Prinzip wie die Verkehrsanzeige/Rundinstrumente an anderer Stelle im Programm).
  function zeichneLagGrafik(werte) {
    if (!werte.length) return '<p class="kc-live-empty">Noch keine Messwerte.</p>';
    const breite = 640, hoehe = 160, rand = 30;
    const maxLag = Math.max(50, ...werte.map((w) => w.lag_ms || 0));
    const punkte = werte.map((w, i) => {
      const x = rand + (i / Math.max(1, werte.length - 1)) * (breite - rand * 2);
      const y = hoehe - rand - ((w.lag_ms || 0) / maxLag) * (hoehe - rand * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const farbe = werte.at(-1).lag_ms < 300 ? '#166534' : werte.at(-1).lag_ms < 1000 ? '#b45309' : '#b91c1c';
    return `
      <svg viewBox="0 0 ${breite} ${hoehe}" width="100%" height="${hoehe}" style="background:#fafafa;border-radius:8px;">
        <line x1="${rand}" y1="${hoehe - rand}" x2="${breite - rand}" y2="${hoehe - rand}" stroke="#ddd"/>
        <text x="4" y="${rand}" font-size="11" fill="#999">${maxLag} ms</text>
        <text x="4" y="${hoehe - rand}" font-size="11" fill="#999">0 ms</text>
        <polyline points="${punkte}" fill="none" stroke="${farbe}" stroke-width="2"/>
      </svg>
      <div style="text-align:right;font-size:.85rem;color:#666;">aktuell: <b style="color:${farbe};">${werte.at(-1).lag_ms} ms</b> · Ø ${Math.round(werte.reduce((s, w) => s + (w.lag_ms || 0), 0) / werte.length)} ms · ${werte.length} Messungen</div>`;
  }

  async function render() {
    const ziel = document.getElementById('kcFernverkehrBody');
    if (!ziel) return;
    ziel.innerHTML = '<p class="kc-live-empty">Wird geladen …</p>';
    try {
      const eintraege = await ladeQualitaetsverlauf();
      const gruppen = nachKasseGruppieren(eintraege);
      const kassenIds = Object.keys(gruppen);
      if (!kassenIds.length) { ziel.innerHTML = '<p class="kc-live-empty">Noch keine Daten - sobald eine Kasse verbunden ist und Herzschläge sendet, erscheinen hier Grafiken.</p>'; return; }
      ziel.innerHTML = kassenIds.map((id) => `
        <div class="kc-dash-card" style="width:auto;min-width:340px;">
          <div class="kc-dash-card-head"><b>${id}</b> - Antwortzeit-Verlauf (Fernstrecke)</div>
          ${zeichneLagGrafik(gruppen[id])}
        </div>`).join('');
    } catch (e) {
      ziel.innerHTML = `<p class="kc-live-empty">Konnte nicht geladen werden: ${e.message}</p>`;
    }
  }

  function initSeite() {
    if (document.querySelector('[data-view-panel="fernverkehr"]')) return;
    const nav = document.querySelector('[data-nav-group="operation"] .nav-submenu') || document.querySelector('.nav-submenu');
    if (!nav) return;
    const btn = document.createElement('button');
    btn.className = 'nav'; btn.type = 'button'; btn.dataset.view = 'fernverkehr';
    btn.textContent = 'Fernverkehr-Dashboard';
    nav.appendChild(btn);

    const neu = document.createElement('section');
    neu.className = 'view'; neu.dataset.viewPanel = 'fernverkehr'; neu.hidden = true;
    neu.innerHTML = `
      <div class="page-head"><div><h1>Fernverkehr-Dashboard</h1><p>Antwortzeit und Verbindungsqualität aller Kassen über die Zeit.</p></div>
      <button type="button" id="kcFernverkehrRefresh" class="primary">🔄 Aktualisieren</button></div>
      <div id="kcFernverkehrBody" style="display:flex;flex-wrap:wrap;gap:18px;"><p class="kc-live-empty">Noch nicht geladen.</p></div>
    `;
    document.querySelector('.content')?.appendChild(neu);

    btn.onclick = () => {
      document.querySelectorAll('.nav').forEach((x) => x.classList.toggle('active', x === btn));
      document.querySelectorAll('.view').forEach((x) => { const active = x.dataset.viewPanel === 'fernverkehr'; x.classList.toggle('active', active); x.hidden = !active; });
      render();
    };
    document.getElementById('kcFernverkehrRefresh').addEventListener('click', render);
    setInterval(() => { if (!neu.hidden) render(); }, 20000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSeite);
  else initSeite();
})(window);
