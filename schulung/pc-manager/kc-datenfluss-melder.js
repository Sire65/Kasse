// KC PC-Manager – Datenfluss-Melder + Lebenszeichen für KC System Check.
//
// Zwei Aufgaben, beide ohne Zusatzbibliothek (nur fetch, wie der ganze PC-Manager):
// 1. Echten Datenfluss des Managers und des Money-Butlers zählen und nur bei realem I/O melden.
// 2. Lebenszeichen des PC-Managers an KC System Check senden.
// Telemetrie selbst wird über originalFetch übertragen und erzeugt daher keinen Scheinverkehr.
(function (global) {
  'use strict';

  const SUPABASE_URL = 'https://ptblnpiroqftcvlsrhac.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_SqXIeGN-clcZ4gjmpLdSww_4DLfyy24';
  const ANON_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0YmxucGlyb3FmdGN2bHNyaGFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNzU1MzEsImV4cCI6MjEwMDY1MTUzMX0.NRfXGXDoW17VjHeOHjupfrcPHMkbvtizY_K-BguJqz0';
  const KANAL = 'kc-datenfluss';
  const PROGRAMM = 'pc-manager';
  const MONEY_BUTLER = 'money-butler';
  const HEARTBEAT_PROGRAMM = 'kc-pc-manager';
  const MELDE_INTERVALL_MS = 10000;
  const HEARTBEAT_INTERVALL_MS = 30000;
  const INSTANZ_KEY = 'kc_manager_datenfluss_instanz_v1';

  const zaehler = Object.create(null);
  let geaendert = false;
  let letzterBroadcast = { ok: null, zeit: 0, fehler: '' };
  let letzterHeartbeat = { ok: null, zeit: 0, fehler: '' };

  function instanz() {
    try {
      let id = localStorage.getItem(INSTANZ_KEY);
      if (!id) { id = 'pc-' + (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)); localStorage.setItem(INSTANZ_KEY, id); }
      return id;
    } catch (e) { return 'pc-manager-browser'; }
  }
  function bearer() {
    try { const s = JSON.parse(localStorage.getItem('kc_manager_supabase_session_v1') || 'null'); if (s?.access_token) return s.access_token; } catch (e) { /* egal */ }
    return ANON_JWT;
  }
  function quellProgramm() {
    try {
      const cashprep = document.querySelector('[data-view-panel="cashprep"]');
      if (cashprep?.classList.contains('active')) return MONEY_BUTLER;
    } catch (e) { /* im Zweifel Manager */ }
    return PROGRAMM;
  }

  function zielName(url) {
    let host = '';
    try { host = new URL(url, global.location?.href).host; } catch (e) { return null; }
    if (/supabase\.co$/.test(host)) return 'supabase';
    if (/backblazeb2\.com$/.test(host)) return 'b2';
    if (/neon\.tech$/.test(host)) return 'neon';
    if (/^(127\.0\.0\.1|localhost):47392$/.test(host)) return 'manager-dienst';
    if (/^(127\.0\.0\.1|localhost)/.test(host)) return null;
    if (host === global.location?.host) return null;
    return host.slice(0, 40);
  }

  function zaehle(von, nach, bytes, fehler) {
    if (!von || !nach) return;
    const z = (zaehler[von] || (zaehler[von] = Object.create(null)));
    const k = z[nach] || (z[nach] = { req: 0, bytes: 0, fehler: 0 });
    k.req += 1; k.bytes += bytes || 0; if (fehler) k.fehler += 1;
    geaendert = true;
  }

  const originalFetch = global.fetch.bind(global);
  function fetchUmhuellen() {
    if (global.fetch.__kcDatenfluss) return;
    const umhuellt = function (eingabe, optionen) {
      const url = typeof eingabe === 'string' ? eingabe : (eingabe && eingabe.url) || '';
      const nach = zielName(url);
      const von = quellProgramm();
      let raus = 0;
      try { const b = optionen && optionen.body; if (typeof b === 'string') raus = b.length; else if (b && b.byteLength) raus = b.byteLength; } catch (e) { /* egal */ }
      const p = originalFetch(eingabe, optionen);
      if (!nach) return p;
      return p.then((antwort) => {
        let rein = 0; try { rein = parseInt(antwort.headers.get('content-length') || '0', 10) || 0; } catch (e) { /* egal */ }
        zaehle(von, nach, raus + rein, !antwort.ok);
        if (nach === 'manager-dienst') { if (antwort.ok) managerZuletztOk = Date.now(); else managerZuletztFehler = Date.now(); }
        return antwort;
      }, (fehler) => { zaehle(von, nach, raus, true); if (nach === 'manager-dienst') managerZuletztFehler = Date.now(); throw fehler; });
    };
    umhuellt.__kcDatenfluss = true;
    global.fetch = umhuellt;
  }

  function meldungen() {
    const jetzt = new Date().toISOString(), liste = [];
    for (const von of Object.keys(zaehler)) {
      const kanten = [];
      for (const nach of Object.keys(zaehler[von])) {
        const k = zaehler[von][nach];
        if (k.req > 0) kanten.push({ nach, req: k.req, bytes: k.bytes, fehler: k.fehler });
        zaehler[von][nach] = { req: 0, bytes: 0, fehler: 0 };
      }
      if (kanten.length) liste.push({ v: 1, von, geraet: von === PROGRAMM ? instanz() : null, fenster_ms: MELDE_INTERVALL_MS, zeit: jetzt, kanten });
    }
    return liste;
  }

  async function broadcast() {
    if (!geaendert) return;
    geaendert = false;
    const liste = meldungen();
    if (!liste.length) return;
    try {
      const antwort = await originalFetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + bearer() },
        body: JSON.stringify({ messages: liste.map((payload) => ({ topic: KANAL, event: 'fluss', payload })) }),
        cache: 'no-store', credentials: 'omit',
      });
      letzterBroadcast = { ok: antwort.ok, zeit: Date.now(), fehler: antwort.ok ? '' : `HTTP ${antwort.status}` };
    } catch (e) { letzterBroadcast = { ok: false, zeit: Date.now(), fehler: e.message || String(e) }; }
  }

  function version() {
    return String(global.KC_PC_MANAGER_VERSION || global.KC_VERSION || document.documentElement.dataset.version || document.querySelector('#version')?.textContent || '').replace(/^v/i, '').trim() || null;
  }
  let managerZuletztOk = 0, managerZuletztFehler = 0;
  function managerVerbunden() {
    if (!managerZuletztOk && !managerZuletztFehler) return null;
    return managerZuletztOk >= managerZuletztFehler;
  }
  async function heartbeat() {
    const gemessen = new Date().toISOString(), verbunden = managerVerbunden(), fehler = Object.values(zaehler).reduce((n, z) => n + Object.values(z).reduce((m, k) => m + k.fehler, 0), 0);
    const hb = {
      schema: 'kicc.program-heartbeat.v1', programId: HEARTBEAT_PROGRAMM, instanceId: instanz(), deviceId: `program:${HEARTBEAT_PROGRAMM}:${instanz()}`,
      name: 'KC PC Manager', deviceType: 'PC_MANAGER', version: version(), build: version(),
      status: !navigator.onLine ? 'OFFLINE' : (verbunden === false || fehler > 0) ? 'DEGRADED' : 'ONLINE',
      measuredAt: gemessen, latencyMs: null, trafficRx: null, trafficTx: null, queueDepth: null, errorCount: fehler,
      source: 'KC_PC_MANAGER_SELF_HEARTBEAT', trust: 'SELF_REPORTED',
      message: verbunden === false ? 'Manager-Dienst (47392) antwortet nicht' : 'PC-Manager geöffnet',
    };
    try {
      const antwort = await originalFetch(`${SUPABASE_URL}/functions/v1/kicc-program-heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + bearer() },
        body: JSON.stringify({ schema: 'kicc.remote-program-heartbeat.v1', nonce: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, sentAt: gemessen, authState: 'AUTHENTICATED', sourceId: instanz(), heartbeat: hb }),
        cache: 'no-store', credentials: 'omit',
      });
      letzterHeartbeat = { ok: antwort.ok, zeit: Date.now(), fehler: antwort.ok ? '' : `HTTP ${antwort.status}` };
    } catch (e) { letzterHeartbeat = { ok: false, zeit: Date.now(), fehler: e.message || String(e) }; }
  }

  const KCDatenfluss = {
    kasse(registerId, evt) {
      const n = String(registerId || '').match(/(\d{1,2})/);
      const von = n ? `kasse-${n[1].padStart(2, '0')}` : null;
      if (!von) return;
      let bytes = 0; try { bytes = JSON.stringify(evt || {}).length; } catch (e) { /* egal */ }
      zaehle(von, PROGRAMM, bytes, false);
    },
    manuell(nach, bytes, fehler) { zaehle(quellProgramm(), nach, bytes, fehler); },
    zustand() { return { broadcast: letzterBroadcast, heartbeat: letzterHeartbeat, instanz: instanz(), quelle: quellProgramm() }; },
    KANAL,
  };

  fetchUmhuellen();
  setInterval(broadcast, MELDE_INTERVALL_MS);
  setTimeout(heartbeat, 4000);
  setInterval(heartbeat, HEARTBEAT_INTERVALL_MS);
  global.addEventListener('online', heartbeat);
  global.addEventListener('offline', heartbeat);
  global.addEventListener('pagehide', broadcast);
  global.KCDatenfluss = KCDatenfluss;
})(window);
