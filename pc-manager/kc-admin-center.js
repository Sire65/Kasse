// KC PC-Manager – Admin-Center. Bündelt Verbindungsstatus, Fernbefehle und Verweise auf die
// bestehenden Dashboards (Fernverkehr, Supabase) an einem Ort.
(function (global) {
  'use strict';
  const WS_HOST = '127.0.0.1', WS_PORT = 47392;

  async function sendeBefehl(registerId, command, ergebnisFeld) {
    ergebnisFeld.textContent = 'Wird gesendet …';
    try {
      const antwort = await fetch(`http://${WS_HOST}:${WS_PORT}/remote-command/queue`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registerId, command }),
      });
      if (!antwort.ok) throw new Error('Fehler ' + antwort.status);
      ergebnisFeld.innerHTML = `<span style="color:#166534;">✓ Eingereiht - ${registerId} holt es beim nächsten Kontakt ab (bis zu 15s).</span>`;
    } catch (e) {
      ergebnisFeld.innerHTML = `<span style="color:#b91c1c;">✗ Konnte nicht gesendet werden - läuft der Manager?</span>`;
    }
  }

  function artikelListe() {
    try { return JSON.parse(localStorage.getItem('kcm_articles') || '[]'); } catch (e) { return []; }
  }
  async function ladeAusverkauftListe() {
    try {
      const antwort = await fetch(`http://${WS_HOST}:${WS_PORT}/sold-out-status-alle`);
      if (!antwort.ok) return [];
      return (await antwort.json()).ausverkauft || [];
    } catch (e) { return []; }
  }
  async function setzeAusverkauft(articleId, soldOut) {
    return fetch(`http://${WS_HOST}:${WS_PORT}/sold-out-status/setzen`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleId, soldOut }),
    });
  }

  function kassenListe() {
    try { return JSON.parse(localStorage.getItem('kcm_registers') || localStorage.getItem('registers') || '[]'); }
    catch (e) { return []; }
  }

  async function render() {
    const ziel = document.getElementById('kcAdminCenterBody');
    if (!ziel) return;
    const kassen = kassenListe();
    const kassenIds = kassen.length ? kassen.map((k) => k.id || k.name).filter(Boolean) : ['KASSE-01', 'KASSE-02'];
    const artikel = artikelListe();
    const ausverkauftListe = await ladeAusverkauftListe();
    const ausverkauftIds = new Set(ausverkauftListe.map((a) => a.articleId));
    ziel.innerHTML = `
      <div class="kc-dash-card" style="width:auto;">
        <div class="kc-dash-card-head"><b>🚫 Ausverkauft</b></div>
        <p style="color:#666;font-size:.9rem;margin-top:0;">Wirkt auf allen Kassen innerhalb von etwa 15 Sekunden - genau wie an der Kasse selbst.</p>
        <!-- Sammel-Sperre wie an der Kasse: dort genügt ein Klick auf "Mettwurst", um alle
             Gerichte damit zu sperren. Im Manager musste man bisher jedes Kästchen einzeln
             suchen - bei drei Warengruppen und einem Dutzend Artikeln ist das im Betrieb zu
             langsam und man übersieht leicht eines. -->
        <div class="kc-sammel-zeile">
          <input type="text" id="kcAdminSammelWort" placeholder="Suchwort, z.B. Mettwurst"
                 title="Sperrt oder gibt alle Artikel frei, in deren Namen dieses Wort vorkommt">
          <button type="button" id="kcAdminSammelSperren">Alle sperren</button>
          <button type="button" id="kcAdminSammelFrei">Alle freigeben</button>
          <span id="kcAdminSammelInfo"></span>
        </div>
        <div style="max-height:280px;overflow-y:auto;">
          ${artikel.length ? artikel.map((a) => `
            <label style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid #f1f1f1;cursor:pointer;">
              <input type="checkbox" class="kc-admin-ausverkauft-checkbox" data-article="${a.id}" ${ausverkauftIds.has(a.id) ? 'checked' : ''}>
              <span>${a.name}</span>
            </label>`).join('') : '<p class="kc-live-empty">Keine Artikel gefunden - erst im Artikel-Bereich anlegen.</p>'}
        </div>
      </div>
      <div class="kc-dash-card" style="width:auto;">
        <div class="kc-dash-card-head"><b>Fernbefehle</b></div>
        <p style="color:#666;font-size:.9rem;margin-top:0;">Löst bei einer Kasse "Stammdaten sofort neu laden" aus - sie holt es beim nächsten regulären Kontakt automatisch ab (bis zu 15s), kein direkter Zugriff auf die Kasse nötig.</p>
        ${kassenIds.map((id) => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid #f1f1f1;">
            <b style="min-width:100px;">${id}</b>
            <button type="button" class="kc-admin-reload-btn" data-register="${id}">🔄 Stammdaten neu laden</button>
            <span class="kc-admin-reload-ergebnis" style="font-size:.85rem;"></span>
          </div>`).join('')}
      </div>
      <div class="kc-dash-card" style="width:auto;border:2px solid #b91c1c;">
        <div class="kc-dash-card-head"><b style="color:#b91c1c;">⚠️ Notfall (z.B. bei Diebstahl)</b></div>
        ${kassenIds.map((id) => `
          <div class="kc-notfall-zeile" data-register="${id}" style="padding:10px 0;border-top:1px solid #fee2e2;">
            <b style="display:block;margin-bottom:6px;">${id}</b>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" class="kc-admin-sperren-btn" data-register="${id}" style="background:#7f1d1d;color:#fff;border:none;">🔒 Sperren</button>
              <button type="button" class="kc-admin-entsperren-btn" data-register="${id}" style="background:#166534;color:#fff;border:none;">🔓 Entsperren</button>
              <button type="button" class="kc-admin-wipe-btn" data-register="${id}" style="background:#fff;color:#b91c1c;border:1px solid #b91c1c;">🗑 Datenbank leeren …</button>
              <button type="button" class="kc-admin-verloren-btn" data-register="${id}" style="background:#b91c1c;color:#fff;border:none;font-weight:800;">📵 Gerät verloren melden …</button>
            </div>
            <span class="kc-admin-notfall-ergebnis" style="font-size:.85rem;display:block;margin-top:4px;"></span>
          </div>`).join('')}
      </div>
      <div class="kc-dash-card" style="width:auto;">
        <div class="kc-dash-card-head"><b>Weitere Ansichten</b></div>
        <div class="toolbar" style="flex-direction:column;align-items:stretch;gap:8px;">
          <button type="button" data-admin-link="live-monitor">📡 Live-Monitor öffnen</button>
          <button type="button" data-admin-link="fernverkehr">📈 Fernverkehr-Dashboard öffnen</button>
          <button type="button" data-admin-link="supabase-dashboard">☁️ Supabase-Überwachung öffnen</button>
        </div>
      </div>
    `;
    ziel.querySelectorAll('.kc-admin-ausverkauft-checkbox').forEach((cb) => {
      cb.onchange = async () => {
        const artikelName = cb.nextElementSibling.textContent;
        if (cb.checked && !confirm(`${artikelName} wirklich als ausverkauft markieren?`)) { cb.checked = false; return; }
        if (!cb.checked && !confirm(`${artikelName} wieder verfügbar machen?`)) { cb.checked = true; return; }
        await setzeAusverkauft(cb.dataset.article, cb.checked);
      };
    });
    // --- Sammel-Sperre ---------------------------------------------------------------------
    // Arbeitet nach derselben Regel wie an der Kasse: gesucht wird im Artikelnamen, und was
    // gefunden wird, steht VOR dem Bestaetigen vollstaendig da. So ist nachvollziehbar, was
    // gesperrt wird, und die Namenssuche muss nicht perfekt sein.
    const wortFeld = ziel.querySelector('#kcAdminSammelWort');
    const infoFeld = ziel.querySelector('#kcAdminSammelInfo');
    const treffer = () => {
      const wort = String(wortFeld?.value || '').trim().toLowerCase();
      if (!wort) return [];
      return artikel.filter((a) => String(a.name || '').toLowerCase().includes(wort));
    };
    const zeigeTreffer = () => {
      const gefunden = treffer();
      if (!infoFeld) return;
      infoFeld.textContent = wortFeld.value.trim()
        ? (gefunden.length ? `${gefunden.length} Artikel: ${gefunden.map((a) => a.name).join(', ')}` : 'Kein Artikel gefunden.')
        : '';
    };
    wortFeld?.addEventListener('input', zeigeTreffer);
    const sammel = async (sperren) => {
      const gefunden = treffer();
      if (!gefunden.length) { zeigeTreffer(); return; }
      const liste = gefunden.map((a) => a.name).join('\n  ');
      if (!confirm(`${gefunden.length} Artikel ${sperren ? 'sperren' : 'freigeben'}?\n\n  ${liste}`)) return;
      infoFeld.textContent = 'Wird übertragen …';
      // Jeden Artikel einzeln melden - so erfaehrt jede Kasse genau, welcher betroffen ist.
      for (const a of gefunden) await setzeAusverkauft(a.id, sperren);
      infoFeld.textContent = `${gefunden.length} Artikel ${sperren ? 'gesperrt' : 'freigegeben'}.`;
      render();   // Kaestchen neu einlesen, damit die Haken stimmen
    };
    ziel.querySelector('#kcAdminSammelSperren')?.addEventListener('click', () => sammel(true));
    ziel.querySelector('#kcAdminSammelFrei')?.addEventListener('click', () => sammel(false));

    ziel.querySelectorAll('.kc-admin-reload-btn').forEach((btn) => {
      btn.onclick = () => sendeBefehl(btn.dataset.register, 'reload_stammdaten', btn.nextElementSibling);
    });
    ziel.querySelectorAll('.kc-admin-sperren-btn').forEach((btn) => {
      btn.onclick = () => {
        if (!confirm(`${btn.dataset.register} wirklich sperren? Die Kasse zeigt danach nur noch eine Sperr-Meldung, bis sie wieder entsperrt wird.`)) return;
        sendeBefehl(btn.dataset.register, 'sperren', btn.closest('.kc-notfall-zeile').querySelector('.kc-admin-notfall-ergebnis'));
      };
    });
    ziel.querySelectorAll('.kc-admin-entsperren-btn').forEach((btn) => {
      btn.onclick = () => sendeBefehl(btn.dataset.register, 'entsperren', btn.closest('.kc-notfall-zeile').querySelector('.kc-admin-notfall-ergebnis'));
    });
    ziel.querySelectorAll('.kc-admin-wipe-btn').forEach((btn) => {
      btn.onclick = () => {
        const registerId = btn.dataset.register;
        const eingabe = prompt(`ACHTUNG: Löscht ALLE Verkaufsdaten auf ${registerId} unwiderruflich (nicht die Kopplung selbst).\n\nZum Bestätigen genau eingeben: LÖSCHEN ${registerId}`);
        if (eingabe !== `LÖSCHEN ${registerId}`) { alert('Abgebrochen - Text stimmte nicht exakt überein.'); return; }
        if (!confirm(`Letzte Sicherheitsfrage: ${registerId} jetzt WIRKLICH und UNWIDERRUFLICH leeren?`)) return;
        sendeBefehl(registerId, 'datenbank_leeren', btn.closest('.kc-notfall-zeile').querySelector('.kc-admin-notfall-ergebnis'));
      };
    });
    // "Gerät verloren" - der einzige Weg, der bei einem Diebstahl tatsächlich wirkt.
    //
    // BEFUND bei der Durchsicht: Sperre und Löschbefehl gehen über die Fernbefehl-Warteschlange.
    // Die Kasse holt sie beim Abgleich ab - sie muss also mit dem Manager verbunden sein.
    // Genau das ist ein gestohlenes Gerät nicht: der Befehl bleibt liegen und wirkt nie.
    // Deshalb stehen hier DREI Schritte, von denen die ersten beiden sofort greifen, ganz ohne
    // das Gerät:
    //   1. Kopplung widerrufen  - das Gerät bekommt nichts mehr und wird nicht mehr angenommen
    //   2. Neue Karte           - der bisherige Datenschlüssel ist damit überholt
    //   3. Löschbefehl          - wirkt nur, falls sich das Gerät doch noch einmal meldet
    ziel.querySelectorAll('.kc-admin-verloren-btn').forEach((btn) => {
      btn.onclick = async () => {
        const registerId = btn.dataset.register;
        const ergebnis = btn.closest('.kc-notfall-zeile').querySelector('.kc-admin-notfall-ergebnis');
        const eingabe = prompt(`${registerId} als VERLOREN melden.\n\n`
          + 'Danach: Kopplung widerrufen, neue Startkarte, Löschbefehl. Das Gerät kann sich nicht '
          + 'mehr anmelden und seine gespeicherten Verkäufe nicht mehr lesen.\n\n'
          + `Zum Bestätigen genau eingeben: VERLOREN ${registerId}`);
        if (eingabe !== `VERLOREN ${registerId}`) { alert('Abgebrochen - Text stimmte nicht exakt überein.'); return; }
        ergebnis.textContent = 'Wird ausgeführt …';
        const schritte = [];

        // 1. Kopplung widerrufen
        try {
          const antwort = await fetch(`http://${WS_HOST}:${WS_PORT}/kassen/kopplung-widerrufen`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({registerId}), signal: AbortSignal.timeout(5000),
          });
          const daten = await antwort.json().catch(() => ({}));
          schritte.push(antwort.ok ? `Kopplung widerrufen (${daten.widerrufen || 0})` : 'Kopplung NICHT widerrufen');
        } catch (e) { schritte.push('Kopplung NICHT widerrufen (Dienst nicht erreichbar)'); }

        // 2. Neue Karte - macht den bisherigen Schlüssel wertlos
        try {
          await global.KCSecurityCardManager?.erzeuge?.(registerId);
          await global.KCSecurityCardManager?.zeichneKarte?.(registerId);
          schritte.push('neue Startkarte erstellt');
        } catch (e) { schritte.push('neue Startkarte FEHLGESCHLAGEN'); }

        // 3. Löschbefehl in die Warteschlange
        sendeBefehl(registerId, 'geraet_verloren', document.createElement('span'));
        schritte.push('Löschbefehl eingereiht');

        ergebnis.textContent = schritte.join(' · ') + '. Bitte die neue Karte ausdrucken.';
      };
    });

    ziel.querySelectorAll('[data-admin-link]').forEach((btn) => {
      btn.onclick = () => document.querySelector(`[data-view="${btn.dataset.adminLink}"]`)?.click();
    });
  }

  function initSeite() {
    if (document.querySelector('[data-view-panel="admin-center"]')) return;
    const nav = document.querySelector('[data-nav-group="operation"] .nav-submenu') || document.querySelector('.nav-submenu');
    if (!nav) return;
    const btn = document.createElement('button');
    btn.className = 'nav'; btn.type = 'button'; btn.dataset.view = 'admin-center';
    btn.textContent = 'Admin-Center';
    nav.appendChild(btn);

    const neu = document.createElement('section');
    neu.className = 'view'; neu.dataset.viewPanel = 'admin-center'; neu.hidden = true;
    neu.innerHTML = `
      <div class="page-head"><div><h1>Admin-Center</h1><p>Fernbefehle für die Kassen und schneller Zugriff auf die Dashboards.</p></div></div>
      <div id="kcAdminCenterBody" style="display:flex;flex-wrap:wrap;gap:18px;"></div>
    `;
    document.querySelector('.content')?.appendChild(neu);

    btn.onclick = () => {
      document.querySelectorAll('.nav').forEach((x) => x.classList.toggle('active', x === btn));
      document.querySelectorAll('.view').forEach((x) => { const active = x.dataset.viewPanel === 'admin-center'; x.classList.toggle('active', active); x.hidden = !active; });
      render();
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSeite);
  else initSeite();
})(window);
