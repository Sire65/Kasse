// KC Sync Live-Monitor – PC-Manager-Seite.
//
// Zeigt für jede unter "Kassen" eingetragene, aktive Kasse eine eigene LED-Gruppe (Ampel +
// Aktivitäts-LED) in der Kopfzeile - dynamisch aus der bestehenden Kassenliste (window.registers)
// abgeleitet, keine eigene, zweite Geräteliste. Zusätzlich eine Live-Monitor-Seite mit
// Verkehrsanzeige (Zeigerinstrument), laufendem Ereignisstrom (Verkäufe, Storno-Fälle,
// Kommen/Gehen) und Filtern.
//
// Seit Version 9 werden Verkäufe/Kommen-Gehen zusätzlich dauerhaft im Manager gespeichert
// (live_event_log) - beim Öffnen dieser Seite wird die letzte Historie nachgeladen. WICHTIG:
// das bleibt eine NACHRANGIGE Verlaufsanzeige, nicht die eigentliche Buchung - die läuft
// weiterhin unverändert über den bestehenden, zuverlässigen Sync-Kanal.
(function (global) {
  'use strict';
  const WS_HOST = global.KC_SYNC_MANAGER_HOST || '127.0.0.1';
  const WS_PORT = global.KC_SYNC_LIVE_MONITOR_PORT || 47392;
  const FRESHNESS_MS = 30000; // Herzschlag alle 15s + Toleranz
  const MAX_BUFFER = 500;

  // VORGABE DES VEREINS (01.09.2026): "Die gruene LED soll IMMER leuchten bei Verbindung,
  // nicht nur bei Verkauf. Bei realem Datenverkehr soll die gelbe flackern."
  //
  // BEFUND: genau das tat sie nicht. Die Status-LED haing an "lastSeenAt" - also am letzten
  // Ereignis, das eine geoeffnete Kasse geschickt hat. Ist am Tablet Safari im Hintergrund
  // oder der Bildschirm aus, friert iOS die Seite ein, es kommen keine Herzschlaege mehr, und
  // die LED ging auf rot - obwohl die Kasse sehr wohl gekoppelt und der Dienst erreichbar war.
  // Der Manager sagte "nicht verbunden", waehrend alles stand.
  //
  // Der Manager-Dienst weiss es besser: unter /kassen-verbindungen fuehrt er, welche Kasse
  // gekoppelt ist. Das ist die Verbindungsauskunft; das Ereignis ist nur der Verkehr.
  // Seitdem gilt:
  //   gruene LED (Status)    = Dienst erreichbar UND diese Kasse gekoppelt -> leuchtet dauerhaft
  //   gelbe LED (Aktivitaet) = flackert bei jedem echten Ereignis
  //   rot                    = Dienst antwortet nicht ODER diese Kasse ist nicht gekoppelt
  const KOPPLUNG_URL = `http://${WS_HOST}:${WS_PORT}/kassen-verbindungen`;
  let kopplung = { dienstErreichbar: null, kassen: new Map(), abgefragtUm: 0 };
  async function holeKopplung() {
    try {
      const antwort = await fetch(KOPPLUNG_URL, { cache: 'no-store' });
      if (!antwort.ok) throw new Error('HTTP ' + antwort.status);
      const daten = await antwort.json();
      const karte = new Map();
      (daten.kassen || []).forEach((k) => karte.set(String(k.kasse), k));
      kopplung = { dienstErreichbar: true, kassen: karte, abgefragtUm: Date.now() };
    } catch (e) {
      kopplung = { dienstErreichbar: false, kassen: new Map(), abgefragtUm: Date.now() };
    }
    try { renderStatusList(); (global.registers || []).forEach((r) => updateStatusLed(r.id)); } catch (e) {}
  }
  // Eine Kasse gilt als verbunden, wenn der Dienst laeuft und sie dort als gekoppelt steht.
  // Gross-/Kleinschreibung spielt keine Rolle: der Dienst fuehrt sie unter dem Etikett, die
  // Oberflaeche unter der Kassen-ID - beim Verein sind das dieselben Werte, aber verlassen
  // sollte man sich darauf nicht.
  function istVerbunden(registerId) {
    if (kopplung.dienstErreichbar !== true) return false;
    const gesucht = String(registerId).toLowerCase();
    for (const [name, k] of kopplung.kassen) {
      if (String(name).toLowerCase() === gesucht && k.gekoppelt) return true;
    }
    return false;
  }

  let ws = null, reconnectTimer = null;
  const perRegister = new Map(); // registerId -> {lastSeenAt, lastActivityAt}
  const eventBuffer = [];
  let listView = null;

  // Klare Textstatusliste je Kasse (User-Wunsch: "wie eine Fritzbox-Datei") - ergänzt die
  // kleinen LEDs um eine gut lesbare Übersicht "Kasse 1: Angemeldet, Kasse 2: Keine Verbindung".
  function zeigeKasseninfo(registerId) {
    const register = (global.registers || []).find((r) => r.id === registerId);
    const entry = perRegister.get(registerId);
    const verbindung = kassenVerbindungen?.[registerId];
    const jetzt = Date.now();
    const zeile = (label, wert) => `<div style="display:flex;justify-content:space-between;gap:16px;padding:5px 0;border-bottom:1px solid #eee;"><span style="color:#666;">${label}</span><span style="font-weight:700;text-align:right;">${wert}</span></div>`;
    const alter = document.getElementById('kcKasseninfoOverlay');
    if (alter) alter.remove();
    const overlay = document.createElement('div');
    overlay.id = 'kcKasseninfoOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(7,17,31,.6);z-index:99996;display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:12px;padding:22px 26px;min-width:300px;max-width:90vw;box-shadow:0 10px 40px rgba(0,0,0,.3);';
    box.innerHTML = `
      <div style="font-size:1.2rem;font-weight:900;margin-bottom:12px;">${escLabel(register?.name || registerId)}</div>
      ${zeile('Kassen-ID', escLabel(registerId))}
      ${zeile('Geräteart', entry?.geraeteart ? escLabel(entry.geraeteart) : 'Noch keine Meldung erhalten')}
      ${zeile('Bediener', entry?.operator ? escLabel(entry.operator) : '—')}
      ${zeile('Verbindung', entry ? (jetzt - entry.lastSeenAt < 30000 ? '<span style="color:#166534;">Angemeldet</span>' : '<span style="color:#b91c1c;">Keine Verbindung</span>') : '<span style="color:#b91c1c;">Noch nie verbunden</span>')}
      ${entry ? zeile('Zuletzt gesehen', new Date(entry.lastSeenAt).toLocaleTimeString('de-DE')) : ''}
      ${verbindung ? zeile('Netzwerk-Port', verbindung.port) : ''}
      <button type="button" id="kcKasseninfoClose" style="margin-top:14px;width:100%;padding:10px;font-weight:900;border-radius:8px;border:none;background:#166534;color:#fff;">Schließen</button>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    document.getElementById('kcKasseninfoClose').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  function renderStatusList() {
    const container = document.getElementById('kcLiveStatusList');
    if (!container) return;
    const all = global.registers || [];
    const jetzt = Date.now();
    container.innerHTML = all.map((r) => {
      if (!r.active) return `<div style="padding:6px 10px;color:#94a3b8;">${escLabel(r.name || r.id)}: <em>deaktiviert</em></div>`;
      const entry = perRegister.get(r.id);
      const seitMs = entry ? jetzt - entry.lastSeenAt : Infinity;
      let text, farbe;
      if (kopplung.dienstErreichbar === false) {
        text = 'Manager-Dienst antwortet nicht'; farbe = '#b91c1c';
      } else if (!istVerbunden(r.id)) {
        text = kopplung.dienstErreichbar === null ? 'wird geprüft …' : 'Nicht gekoppelt';
        farbe = kopplung.dienstErreichbar === null ? '#5b6572' : '#b91c1c';
      } else if (seitMs < 30000) {
        text = 'Verbunden · Kasse sendet'; farbe = '#166534';
      } else {
        // Verbunden bleibt verbunden. Dass gerade keine Kasse sendet, ist eine Angabe ueber den
        // VERKEHR, nicht ueber die Verbindung - am Tablet friert iOS die Seite im Hintergrund ein.
        text = entry ? 'Verbunden · zurzeit keine Meldungen' : 'Verbunden · noch keine Meldung';
        farbe = '#166534';
      }
      return `<div style="padding:6px 10px;font-weight:700;">${escLabel(r.name || r.id)}: <span style="color:${farbe};">${text}</span></div>`;
    }).join('');
  }

  function connect() {
    try {
      ws = new WebSocket(`ws://${WS_HOST}:${WS_PORT}/live-monitor`);
    } catch (e) { scheduleReconnect(); return; }
    ws.onmessage = (msg) => {
      try { handleEvent(JSON.parse(msg.data)); } catch (e) { /* fehlerhafte Nachricht ignorieren */ }
    };
    ws.onclose = scheduleReconnect;
    ws.onerror = () => { try { ws.close(); } catch (e) {} };
  }
  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, 1200);
  }

  // Absicherung gegen Browser-Drosselung von Hintergrund-Tabs: sobald dieser Tab wieder
  // sichtbar wird (Nutzer wechselt zurück), sofort prüfen ob die Verbindung noch offen ist -
  // statt auf den regulären, in einem gedrosselten Tab selbst verzögerten Wiederverbindungs-
  // Timer zu warten.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      connect();
    }
  });

  function handleEvent(evt) {
    const registerId = evt.payload?.registerId;
    if (registerId) {
      const entry = perRegister.get(registerId) || {};
      entry.lastSeenAt = Date.now();
      if (evt.type !== 'heartbeat') entry.lastActivityAt = Date.now();
      if (evt.payload?.geraeteart) entry.geraeteart = evt.payload.geraeteart;
      if (evt.payload?.operator) entry.operator = evt.payload.operator;
      perRegister.set(registerId, entry);
      flashActivityLed(registerId);
      updateStatusLed(registerId);
    }
    if (evt.type !== 'heartbeat') {
      eventBuffer.unshift(evt);
      sortiereNeuesteZuerst();
      if (eventBuffer.length > MAX_BUFFER) eventBuffer.length = MAX_BUFFER;
      updateCounter();
      renderGauge();
      if (listView && !listView.hidden) renderList();
    }
  }

  // --- LED-Gruppen in der Kopfzeile, dynamisch aus window.registers ---
  function ledGroupsContainer() {
    let el = document.getElementById('kcLiveLedGroups');
    if (!el) {
      const meta = document.querySelector('.header-meta');
      if (!meta) return null;
      el = document.createElement('div');
      el.id = 'kcLiveLedGroups';
      el.className = 'kc-live-led-groups';
      el.setAttribute('aria-live', 'polite');
      meta.appendChild(el);
    }
    return el;
  }
  function renderLedGroups() {
    const container = ledGroupsContainer();
    if (!container) return;
    const all = (global.registers || []);
    const existingIds = new Set([...container.children].map((c) => c.dataset.registerId));
    const wantedIds = new Set(all.map((r) => r.id));
    // Verwaiste Gruppen entfernen (Kasse wurde tatsächlich GELÖSCHT, nicht nur deaktiviert).
    [...container.children].forEach((c) => { if (!wantedIds.has(c.dataset.registerId)) c.remove(); });
    all.forEach((r) => {
      let group = container.querySelector(`.kc-live-led-group[data-register-id="${cssEscape(r.id)}"]`);
      if (!group) {
        group = document.createElement('div');
        group.className = 'kc-live-led-group';
        group.dataset.registerId = r.id;
        group.style.cursor = 'pointer';
        group.addEventListener('click', () => zeigeKasseninfo(r.id));
        container.appendChild(group);
      }
      group.title = r.name || r.id;
      group.classList.toggle('kc-live-led-group-inactive', !r.active);
      if (r.active) {
        // Nur bei Bedarf neu aufbauen - nicht bei jedem Aufruf, sonst würde eine gerade
        // laufende Aufblitz-Animation der Aktivitäts-LED abgeschnitten.
        if (!group.querySelector('.kc-live-led-pair')) {
          group.innerHTML = `<span class="kc-live-led-group-label">${escLabel(r.name || r.id)}</span><span class="kc-live-led-pair"><span class="kc-live-led kc-live-led-status"></span><span class="kc-live-led kc-live-led-activity"></span></span>`;
          updateStatusLed(r.id);
        } else {
          const label = group.querySelector('.kc-live-led-group-label');
          if (label) label.textContent = r.name || r.id;
        }
      } else {
        // Deaktiviert: rotes X statt der beiden LEDs, keine Verbindungsprüfung mehr nötig.
        group.innerHTML = `<span class="kc-live-led-group-label">${escLabel(r.name || r.id)}</span><span class="kc-live-led-inactive-mark" title="Kasse ist deaktiviert (Häkchen 'Aktiv' entfernt)">✕</span>`;
      }
    });
  }
  function escLabel(s) { return String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
  function updateStatusLed(registerId) {
    const group = document.querySelector(`.kc-live-led-group[data-register-id="${cssEscape(registerId)}"]`);
    if (!group || group.classList.contains('kc-live-led-group-inactive')) return;
    const statusLed = group.querySelector('.kc-live-led-status');
    if (!statusLed) return;
    const entry = perRegister.get(registerId);
    statusLed.classList.remove('kc-live-gruen', 'kc-live-gelb', 'kc-live-rot');
    if (kopplung.dienstErreichbar === null) { statusLed.title = 'Verbindung wird geprüft …'; return; }
    if (kopplung.dienstErreichbar === false) {
      statusLed.classList.add('kc-live-rot');
      statusLed.title = 'Manager-Dienst antwortet nicht (Port 47392) - läuft das schwarze Fenster?';
      return;
    }
    if (!istVerbunden(registerId)) {
      statusLed.classList.add('kc-live-rot');
      statusLed.title = 'Diese Kasse ist nicht mit dem Manager gekoppelt';
      return;
    }
    // Ab hier: verbunden. Die LED bleibt gruen, auch wenn gerade nichts gesendet wird -
    // Verkehr zeigt die Aktivitaets-LED daneben an.
    statusLed.classList.add('kc-live-gruen');
    const alter = entry?.lastSeenAt ? Math.round((Date.now() - entry.lastSeenAt) / 1000) : null;
    statusLed.title = alter === null
      ? 'Verbunden (gekoppelt) - noch keine Meldung von dieser Kasse'
      : (alter < 30 ? 'Verbunden - Kasse sendet gerade' : `Verbunden - letzte Meldung vor ${alter} s`);
  }
  function flashActivityLed(registerId) {
    const group = document.querySelector(`.kc-live-led-group[data-register-id="${cssEscape(registerId)}"]`);
    const led = group?.querySelector('.kc-live-led-activity');
    if (!led) return;
    led.classList.remove('kc-live-aktiv'); void led.offsetWidth; led.classList.add('kc-live-aktiv');
  }
  function cssEscape(s) { return window.CSS?.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'); }

  // Alle LEDs regelmäßig auf "veraltet" prüfen, nicht nur bei eingehenden Ereignissen - sonst
  // bliebe eine tatsächlich getrennte Kasse fälschlich grün, bis zufällig wieder ein Ereignis kommt.
  holeKopplung();
  setInterval(holeKopplung, 5000);   // Verbindungsauskunft direkt beim Manager-Dienst
  setInterval(() => { (global.registers || []).forEach((r) => updateStatusLed(r.id)); }, 5000);
  setInterval(renderLedGroups, 4000); // erkennt neu angelegte/gelöschte Kassen automatisch

  // --- Live-Monitor-Seite ---
  function pageEntry() {
    if (document.querySelector('[data-view="live-monitor"]')) return;
    const operation = document.querySelector('[data-nav-group="operation"] .nav-submenu');
    if (!operation) return;
    const btn = document.createElement('button');
    btn.className = 'nav'; btn.type = 'button'; btn.dataset.view = 'live-monitor';
    btn.textContent = 'Live-Monitor';
    operation.appendChild(btn);

    const section = document.createElement('section');
    section.className = 'view'; section.dataset.viewPanel = 'live-monitor'; section.hidden = true;
    section.innerHTML = `
      <div class="page-head"><div><h1>Live-Monitor</h1><p>Laufender Ereignisstrom aller Kassen - Verkäufe/Kommen-Gehen werden zusätzlich dauerhaft im Manager mitgeschrieben.</p></div></div>
      <div class="kc-live-gauge-row" id="kcLiveGaugeRow"></div>
      <div class="kc-live-status-list" id="kcLiveStatusList" style="margin-bottom:14px;"></div>
      <div class="kc-live-monitor-toolbar">
        <label>Kasse<select id="kcLiveFilterRegister"><option value="">Alle Kassen</option></select></label>
        <label>Art<select id="kcLiveFilterType"><option value="">Alle</option><option value="sale">Verkauf</option><option value="staff">Kommen/Gehen</option><option value="connection_lost">Verbindung verloren</option><option value="connection_regained">Verbindung wiederhergestellt</option><option value="sold_out_changed">Ausverkauft-Änderung</option></select></label>
        <label>Bediener/Person<input id="kcLiveFilterOperator" type="text" placeholder="Name"></label>
        <label>Betrag von<input id="kcLiveFilterAmountMin" type="number" step="0.01"></label>
        <label>Betrag bis<input id="kcLiveFilterAmountMax" type="number" step="0.01"></label>
        <span class="kc-live-monitor-counter" id="kcLiveCounter">0 Ereignisse</span>
      </div>
      <div class="kc-live-monitor-list" id="kcLiveList"><p class="kc-live-empty">Noch keine Ereignisse in dieser Sitzung.</p></div>
    `;
    document.querySelector('.content')?.appendChild(section);
    listView = section;

    ['kcLiveFilterRegister', 'kcLiveFilterType', 'kcLiveFilterOperator', 'kcLiveFilterAmountMin', 'kcLiveFilterAmountMax']
      .forEach((id) => document.getElementById(id).addEventListener('input', renderList));

    btn.onclick = () => {
      document.querySelectorAll('.nav').forEach((x) => x.classList.toggle('active', x === btn));
      document.querySelectorAll('.view').forEach((x) => { const active = x.dataset.viewPanel === 'live-monitor'; x.classList.toggle('active', active); x.hidden = !active; });
      fillRegisterFilter();
      ladeHistorieEinmalig();
      renderList();
      renderStatusList();
      renderGauge();
    };
  }

  // EINE Stelle bestimmt die Reihenfolge - immer neueste zuerst.
  //
  // BEFUND 02.09.2026 (aus einem Bildschirmfoto des Betreibers): oben standen die drei
  // Verkaeufe neueste-zuerst, darunter die Verbindungsmeldungen aelteste-zuerst. Ursache: die
  // nachgeladene Vorgeschichte kommt vom Manager bereits neueste-zuerst und wurde hier noch
  // einmal umgedreht. Zwei Stellen wussten die Reihenfolge, beide nur halb.
  // Jetzt sortiert eine einzige Funktion nach jedem Einfuegen, egal woher das Ereignis kam.
  // Ereignisse ohne verwertbaren Zeitstempel bleiben, wo sie sind, statt nach ganz unten zu
  // rutschen - eine fehlende Zeit ist kein Grund, ein Ereignis zu verstecken.
  function zeitpunktVon(evt) {
    const roh = evt && (evt.receivedAt || evt.timestamp || evt.zeit);
    const t = roh ? new Date(roh).getTime() : NaN;
    return Number.isFinite(t) ? t : null;
  }
  function sortiereNeuesteZuerst() {
    eventBuffer.sort((a, b) => {
      const za = zeitpunktVon(a); const zb = zeitpunktVon(b);
      if (za === null && zb === null) return 0;
      if (za === null) return -1;   // ohne Zeit: oben lassen, nicht wegsortieren
      if (zb === null) return 1;
      return zb - za;
    });
  }

  // Lädt beim allerersten Öffnen dieser Seite die zuletzt gespeicherten Ereignisse aus dem
  // Manager nach. Läuft nur EINMAL pro Sitzung - danach übernehmen die live über WebSocket
  // eintreffenden Ereignisse nahtlos.
  let historieGeladen = false;
  async function ladeHistorieEinmalig() {
    if (historieGeladen) return;
    historieGeladen = true;
    try {
      const antwort = await fetch(`http://${WS_HOST}:${WS_PORT}/live-event-log?limit=200`);
      if (!antwort.ok) return;
      const daten = await antwort.json();
      // NICHT mehr umdrehen: der Manager liefert bereits neueste zuerst. Einsortiert wird
      // ueber sortiereNeuesteZuerst() - dadurch landet die Vorgeschichte auch dann richtig,
      // wenn waehrend des Nachladens schon live etwas hereinkam.
      eventBuffer.push(...(daten.events || []));
      sortiereNeuesteZuerst();
      if (eventBuffer.length > MAX_BUFFER) eventBuffer.length = MAX_BUFFER;
      updateCounter();
      if (listView && !listView.hidden) renderList();
      renderGauge();
    } catch (e) { /* Manager gerade nicht erreichbar - Live-Monitor funktioniert trotzdem, nur ohne Vorgeschichte */ }
  }

  // --- Verkehrsanzeige (Zeigerinstrument): wie viele Ereignisse kamen in der letzten Minute an ---
  function gaugeContainer() {
    let el = document.getElementById('kcLiveGaugeRow');
    return el;
  }
  function renderGauge() {
    const row = gaugeContainer();
    if (!row) return;
    const jetzt = Date.now();
    const letzteMinute = eventBuffer.filter((e) => jetzt - new Date(e.receivedAt || jetzt).getTime() < 60000).length;
    // Skala 0-20 Ereignisse/Minute deckt einen sehr regen Marktstand ab - alles darüber zeigt voll aus.
    const anteil = Math.min(1, letzteMinute / 20);
    const winkel = -90 + anteil * 180; // -90° (links, leer) bis +90° (rechts, voll)
    const farbe = letzteMinute === 0 ? '#94a3b8' : letzteMinute < 6 ? '#166534' : letzteMinute < 14 ? '#b45309' : '#b91c1c';
    row.innerHTML = `
      <div class="kc-live-gauge">
        <svg viewBox="0 0 200 120" width="200" height="120">
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e2e8f0" stroke-width="14" stroke-linecap="round"/>
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="${farbe}" stroke-width="14" stroke-linecap="round"
                stroke-dasharray="${anteil * 251.3} 251.3"/>
          <line x1="100" y1="100" x2="${100 + 65 * Math.sin(winkel * Math.PI / 180)}" y2="${100 - 65 * Math.cos(winkel * Math.PI / 180)}"
                stroke="#1c2430" stroke-width="3" stroke-linecap="round"/>
          <circle cx="100" cy="100" r="6" fill="#1c2430"/>
        </svg>
        <div class="kc-live-gauge-label"><b>${letzteMinute}</b> Ereignis${letzteMinute === 1 ? '' : 'se'}/Min.</div>
      </div>`;
  }
  setInterval(renderGauge, 5000); // auch ohne neue Ereignisse regelmäßig aktualisieren (Anzeige soll wieder absinken)
  function fillRegisterFilter() {
    const sel = document.getElementById('kcLiveFilterRegister');
    if (!sel) return;
    const current = sel.value;
    const opts = (global.registers || []).map((r) => `<option value="${escLabel(r.id)}">${escLabel(r.name || r.id)}</option>`).join('');
    sel.innerHTML = '<option value="">Alle Kassen</option>' + opts;
    sel.value = current;
  }
  function updateCounter() {
    const counter = document.getElementById('kcLiveCounter');
    if (counter) counter.textContent = `${eventBuffer.length} Ereignis${eventBuffer.length === 1 ? '' : 'se'} in dieser Sitzung`;
  }
  function renderList() {
    const list = document.getElementById('kcLiveList');
    if (!list) return;
    const fRegister = document.getElementById('kcLiveFilterRegister')?.value || '';
    const fType = document.getElementById('kcLiveFilterType')?.value || '';
    const fOperator = (document.getElementById('kcLiveFilterOperator')?.value || '').toLowerCase();
    const fMin = parseFloat(document.getElementById('kcLiveFilterAmountMin')?.value);
    const fMax = parseFloat(document.getElementById('kcLiveFilterAmountMax')?.value);
    const rows = eventBuffer.filter((evt) => {
      const p = evt.payload || {};
      if (fRegister && p.registerId !== fRegister) return false;
      if (fType && evt.type !== fType) return false;
      const person = (p.operator || p.personName || '').toLowerCase();
      if (fOperator && !person.includes(fOperator)) return false;
      const amount = typeof p.due === 'number' ? p.due : null;
      if (!isNaN(fMin) && (amount === null || amount < fMin)) return false;
      if (!isNaN(fMax) && (amount === null || amount > fMax)) return false;
      return true;
    });
    if (!rows.length) { list.innerHTML = '<p class="kc-live-empty">Keine Ereignisse für diese Filter.</p>'; return; }
    list.innerHTML = rows.map(renderRow).join('');
  }
  function renderRow(evt) {
    const p = evt.payload || {};
    const time = new Date(evt.receivedAt || Date.now()).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const registerLabel = (global.registers || []).find((r) => r.id === p.registerId)?.name || p.registerId || '';
    if (evt.type === 'staff') {
      // Der Abmeldegrund ("krank geworden", "früher entlassen") wird an der Kasse miterfasst,
      // wurde hier aber nicht angezeigt: man sah nur "Einhorn - Gehen" und musste sich den
      // Grund anderswo suchen. Er steht jetzt in der letzten Spalte, wo bisher nichts stand.
      const grund = p.shiftReason ? escLabel(p.shiftReason) : '';
      return `<div class="kc-live-row kc-live-row-staff"><time>${time}</time><span>${escLabel(registerLabel)}</span><span>${escLabel(p.personName || '')}</span><span>${p.kind === 'in' ? 'Kommen' : 'Gehen'}</span><span class="kc-live-grund">${grund}</span></div>`;
    }
    if (evt.type === 'connection_lost' || evt.type === 'connection_regained') {
      const verloren = evt.type === 'connection_lost';
      return `<div class="kc-live-row ${verloren ? 'kc-live-row-storno' : 'kc-live-row-staff'}"><time>${time}</time><span>${escLabel(registerLabel)}</span><span></span><span>${verloren ? '🔴 Verbindung verloren' : '🟢 Verbindung wiederhergestellt'}</span><span></span></div>`;
    }
    if (evt.type === 'sold_out_changed') {
      let artikelName = p.articleId;
      try { artikelName = (JSON.parse(localStorage.getItem('kcm_articles') || '[]').find((a) => a.id === p.articleId) || {}).name || p.articleId; } catch (e) { /* Fallback: Artikel-ID anzeigen */ }
      return `<div class="kc-live-row ${p.soldOut ? 'kc-live-row-storno' : 'kc-live-row-staff'}"><time>${time}</time><span>${escLabel(registerLabel)}</span><span></span><span>${p.soldOut ? '🚫 Ausverkauft: ' : '✅ Wieder verfügbar: '}${escLabel(artikelName)}</span><span></span></div>`;
    }
    const isStorno = p.isPayout || (typeof p.due === 'number' && p.due < 0);
    const methodLabel = { bar: 'Bar', card: 'Karte', account: 'Konto', personal: 'Personal' }[p.method] || (p.method || '');
    const amount = typeof p.due === 'number' ? p.due.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '';
    return `<div class="kc-live-row ${isStorno ? 'kc-live-row-storno' : ''}"><time>${time}</time><span>${escLabel(registerLabel)}</span><span>${escLabel(p.operator || '')}</span><span>${isStorno ? 'Storno/Auszahlung · ' : ''}${escLabel(methodLabel)}${p.itemCount ? ` · ${p.itemCount} Pos.` : ''}</span><span class="kc-live-amount">${amount}</span></div>`;
  }

  // --- Tablet-Verbindungsadressen im "Kassen"-Bereich anzeigen ---
  // Die Einrichtungsdatei (KC_Sync_Einrichtung_starten.ps1) legt beim Einrichten eine kleine
  // JSON-Datei mit den fertigen Adressen je Kasse an - hier wird sie gelesen und neben der
  // passenden Kassen-Karte angezeigt, nach Position zugeordnet (1. Karte = Kasse 1 usw.), damit
  // der Betreiber die Adresse jederzeit im PC Manager wiederfindet, statt sie sich aus dem
  // Einrichtungsfenster merken zu müssen.
  let kassenVerbindungen = null;
  async function ladeKassenVerbindungen() {
    try {
      const res = await fetch('kassen-verbindungen.json', { cache: 'no-store' });
      if (res.ok) kassenVerbindungen = await res.json();
    } catch (e) { /* Datei existiert (noch) nicht oder Einrichtung liegt vor dieser Funktion - kein Fehler */ }
  }
  function zeigeVerbindungsadressen() {
    if (!kassenVerbindungen) return;
    document.querySelectorAll('.register-card[data-register-index]').forEach((card) => {
      const index = Number(card.dataset.registerIndex);
      const register = (global.registers || [])[index];
      if (!register) return;
      const alt = card.querySelector('.kc-tablet-adresse');
      const eintrag = kassenVerbindungen[register.id];
      if (alt && alt.dataset.fuerId === register.id) return; // schon korrekt angezeigt, nichts zu tun
      if (alt) alt.remove(); // Kassen-ID der Karte hat sich geändert (z.B. umbenannt) - neu aufbauen

      const block = document.createElement('div');
      block.className = 'kc-tablet-adresse';
      block.dataset.fuerId = register.id;
      block.style.cssText = 'margin-top:8px;padding:8px;border-radius:6px;font-size:.82rem;';
      if (eintrag) {
        block.style.background = '#f0f7ff';
        block.innerHTML = `<div style="font-weight:700;margin-bottom:4px;">Tablet-Adresse für ${escLabel(register.id)} (einmalig auf dem Tablet öffnen):</div><div style="word-break:break-all;font-family:monospace;">${eintrag.url}</div><button type="button" style="margin-top:6px;padding:4px 10px;">In Zwischenablage kopieren</button>`;
        block.querySelector('button').onclick = (ev) => {
          ev.stopPropagation();
          navigator.clipboard?.writeText(eintrag.url).then(() => { block.querySelector('button').textContent = 'Kopiert!'; setTimeout(() => { const b = block.querySelector('button'); if (b) b.textContent = 'In Zwischenablage kopieren'; }, 2000); });
        };
      } else {
        // Klarer Hinweis statt stillschweigend nichts zu zeigen (User-Wunsch: "logisch und
        // auffindbar, sonst Chaos") - diese Kassen-ID hat keine passende Hintergrund-Instanz.
        block.style.background = '#fef3c7';
        block.textContent = `Keine Tablet-Adresse für "${register.id}" hinterlegt - die Kassen-ID in der Kassenverwaltung muss genau einer der bei der Einrichtung angelegten Kassen entsprechen (z. B. KASSE-01, KASSE-02, KASSE-03).`;
      }
      card.appendChild(block);
    });
  }
  ladeKassenVerbindungen().then(zeigeVerbindungsadressen);
  setInterval(() => { zeigeVerbindungsadressen(); renderLedGroups(); renderStatusList(); }, 3000); // erfasst auch neu gerenderte Karten und geänderte "Aktiv"-Häkchen

  function mount() {
    renderLedGroups();
    pageEntry();
    connect();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  global.KCLiveMonitor = { version: '0.1.0' };
})(window);
