// KC PC-Manager – Fernmodus (KS-04 „PC-Manager zuhause liest den Stand über Supabase“)
//
// Der PC-Manager spricht mit dem Manager-Dienst über http://127.0.0.1:47392 (und den
// Live-Monitor-WebSocket). Am Stand ist das der Mini-PC selbst. ZU HAUSE gibt es diesen Dienst
// nicht - dann verlängert diese Datei genau diesen Kanal über Supabase:
//   lesen   (GET)  -> „Spiegel“, den die Stand-Brücke am Mini-PC laufend hochlädt
//   senden  (POST) -> „Auftrag“, den der Mini-PC abholt, ausführt und quittiert
//   Live-Monitor   -> Ereignisse des Stands aus Supabase, alle 10 s (Seite verborgen: 60 s)
// KC-KASSE-SPARSAM (18.11.2026): Spiegel-Antworten je Pfad 25 s zwischengespeichert (gleichzeitige
// gleiche Anfragen werden zusammengefasst), Standliste alle 60 s, Auftragsrückfrage mit wachsender
// Pause, Verlauf (/live-event-log) aus den Ereignissen statt aus einem eigenen Spiegel.
// KC-STAND-LEITUNG (19.11.2026): steht die direkte Leitung des PC-Managers (kc-direkte-leitung-manager.js), kommen die
// Signale „stand“ (neue Ereignisse), „stand-spiegel“ (Übersichten geändert) und „auftrag-erledigt“ sofort an. Dann wird
// nur auf Signal geladen, plus Sicherheitsabfrage alle 60 s (Seite verborgen: 5 min). Ohne Leitung: wie oben (Stufe A).
// Alle anderen Teile des PC-Managers bleiben unverändert - sie merken nicht, ob sie am Stand oder
// zu Hause laufen. Wann der Fernmodus gilt:
//   • gestartet über KC_Zuhause_Start.cmd (der Webserver meldet „zuhause“), oder
//   • kein Manager-Dienst auf diesem PC erreichbar UND ein Stand ausgewählt.
// Am Stand (KC_Manager_Start.cmd) ist der Fernmodus nie aktiv.
// Unten rechts steht immer, woher die Daten kommen und wie alt sie sind (nie „grün“, wenn
// der Stand sich nicht meldet).
(function (global) {
  'use strict';
  if (global.KCFernmodus) return;
  const LOKAL = /^https?:\/\/(127\.0\.0\.1|localhost):47392(\/[^?#]*)?(\?[^#]*)?$/i;
  const WS_LOKAL = /^wss?:\/\/(127\.0\.0\.1|localhost):47392\/live-monitor/i;
  const STAND_KEY = 'kc_fernmodus_stand_v1';
  const SPIEGEL = ['/kassen-verbindungen', '/sold-out-status-alle', '/abschluesse/liste', '/gutscheine/liste', '/zeiterfassung/liste',
    '/cash-transfer-confirmations', '/gelduebergaben-bestaetigungen-abholen', '/bargeld/uebergaben', '/bargeld/protokolle',
    '/verbindungsqualitaet', '/kassen/startprotokoll', '/live-event-log'];
  const AUFTRAG = ['/master-data/push', '/dienstplan/push', '/sold-out-status/setzen', '/remote-command/queue', '/kassen/kopplung-widerrufen',
    '/api/v1/cash-transfer/queue', '/api/v1/finance-transfer/queue', '/bargeld/uebergabe', '/bargeld/protokoll', '/update/freigeben'];
  const VERALTET_SEK = 120;
  const SPIEGEL_PUFFER_MS = 25000;            // Spiegel erneuert der Stand höchstens alle 30 s
  const SOCKET_TAKT_MS = 10000, SOCKET_TAKT_VERBORGEN_MS = 60000, SOCKET_TAKT_MAX_MS = 120000;
  const STAND_LISTE_MS = 60000;
  const AUFTRAG_PAUSEN_MS = [1000, 2000, 4000, 8000, 8000, 8000, 8000]; // zusammen 39 s, 7 Rückfragen (vorher 15)
  const AUFTRAG_WARTEN_MS = 39000;
  // mit direkter Leitung: Sicherheitsabfragen, sonst nur auf Signal
  const LEITUNG_SPIEGEL_MS = 60000, LEITUNG_SPIEGEL_VERBORGEN_MS = 300000;
  const LEITUNG_SOCKET_MS = 60000, LEITUNG_SOCKET_VERBORGEN_MS = 300000;
  const LEITUNG_STAND_LISTE_MS = 300000;
  const LEITUNG_AUFTRAG_PAUSEN_MS = [2000, 10000, 10000, 17000]; // Rückfrage sonst nur nach Signal „auftrag-erledigt“
  const verborgen = () => !!(global.document && global.document.hidden);
  const leitungSteht = () => { try { return !!(global.KCDirekteLeitungManager && global.KCDirekteLeitungManager.steht && global.KCDirekteLeitungManager.steht()); } catch (e) { return false; } };
  const echtFetch = global.fetch.bind(global);
  const EchtWebSocket = global.WebSocket;

  let serverModus = null;          // 'zuhause' | 'stand' | 'unbekannt'
  let modus = null;                // 'lokal' | 'fern' | 'aus'
  let modusZeit = 0;
  let standInfo = null;            // { sekundenSeitMeldung, info, name }
  let letzterFehler = null;

  const jsonAntwort = (status, daten) => new Response(JSON.stringify(daten), { status, headers: { 'Content-Type': 'application/json' } });
  function gewaehlterStand() { try { return JSON.parse(localStorage.getItem(STAND_KEY) || 'null'); } catch (e) { return null; } }
  function waehleStand(s) { try { localStorage.setItem(STAND_KEY, JSON.stringify(s)); } catch (e) { /* */ } modusZeit = 0; zeichneBanner(); }
  function angemeldet() { return !!(global.KCSupabase && global.KCSupabase.istAngemeldet && global.KCSupabase.istAngemeldet()); }
  async function rpc(name, args) {
    if (!global.KCSupabase || !global.KCSupabase.rufeFunktionAuf) throw new Error('supabase_modul_fehlt');
    return global.KCSupabase.rufeFunktionAuf(name, args);
  }

  async function holeServerModus() {
    if (serverModus) return serverModus;
    try {
      const a = await echtFetch('/kc-kassen-start/modus', { cache: 'no-store' });
      serverModus = a.ok ? ((await a.json()).modus || 'unbekannt') : 'unbekannt';
    } catch (e) { serverModus = 'unbekannt'; }
    return serverModus;
  }
  async function lokalErreichbar() {
    try { const a = await echtFetch('http://127.0.0.1:47392/kassen-verbindungen', { cache: 'no-store', signal: AbortSignal.timeout(1500) }); return a.status > 0; }
    catch (e) { return false; }
  }
  async function bestimmeModus() {
    if (modus && Date.now() - modusZeit < 20000) return modus;
    const sm = await holeServerModus();
    let neu;
    if (sm === 'stand') neu = 'lokal';
    else if (sm === 'zuhause') neu = 'fern';
    else neu = (await lokalErreichbar()) ? 'lokal' : (gewaehlterStand() ? 'fern' : 'aus');
    modus = neu; modusZeit = Date.now();
    if (modus === 'fern') { await standAuswaehlenFallsNoetig(); starteStatusTakt(); }
    zeichneBanner();
    return modus;
  }

  async function standAuswaehlenFallsNoetig() {
    if (gewaehlterStand() || !angemeldet()) return;
    try {
      const liste = await rpc('kc_stand_liste', {});
      if (Array.isArray(liste) && liste.length === 1) waehleStand({ standId: liste[0].standId, name: liste[0].name });
      else if (Array.isArray(liste) && liste.length > 1) zeichneBanner(liste);
    } catch (e) { letzterFehler = e.message; }
  }

  // ---------- lesen: Spiegel ----------
  // Zwischenspeicher je Stand+Pfad: { zeit, versprechen }. Der Stand erneuert den Spiegel höchstens
  // alle 30 s - öfter nachzufragen bringt nichts Neues, kostet aber je Aufruf eine Supabase-Abfrage.
  const spiegelPuffer = new Map();
  function spiegelLeeren() { spiegelPuffer.clear(); }
  async function spiegelHolen(stand, pfad) {
    const schluessel = stand.standId + ' ' + pfad;
    const vorhanden = spiegelPuffer.get(schluessel);
    const puffer = leitungSteht() ? (verborgen() ? LEITUNG_SPIEGEL_VERBORGEN_MS : LEITUNG_SPIEGEL_MS) : SPIEGEL_PUFFER_MS;
    if (vorhanden && Date.now() - vorhanden.zeit < puffer) {
      const r = await vorhanden.versprechen;
      return { r, zusatzSek: Math.floor((Date.now() - vorhanden.zeit) / 1000) };
    }
    const eintrag = { zeit: Date.now(), versprechen: null };
    eintrag.versprechen = (pfad === '/live-event-log' ? verlaufAusEreignissen(stand) : rpc('kc_stand_spiegel', { p_stand: stand.standId, p_pfad: pfad }))
      .catch((e) => { if (spiegelPuffer.get(schluessel) === eintrag) spiegelPuffer.delete(schluessel); throw e; });
    spiegelPuffer.set(schluessel, eintrag);
    return { r: await eintrag.versprechen, zusatzSek: 0 };
  }
  // Verlauf zu Hause: die Ereignisse liegen ohnehin schon in Supabase (kc_stand_ereignisse) - ein eigener
  // Spiegel von /live-event-log (bis 200 Ereignisse, ändert sich ständig) wäre doppelt. Ältere Stand-Brücken
  // spiegeln ihn noch: gibt es keine Ereignisse, wird wie bisher der Spiegel gelesen.
  async function verlaufAusEreignissen(stand) {
    const kopf = await rpc('kc_stand_ereignisse', { p_stand: stand.standId, p_nach_id: null });
    const letzte = Number(kopf && kopf.letzteId) || 0;
    if (letzte > 0) {
      const r = await rpc('kc_stand_ereignisse', { p_stand: stand.standId, p_nach_id: Math.max(0, letzte - 500), p_limit: 500 });
      const liste = (r && r.ereignisse) || [];
      if (liste.length) {
        const events = liste.slice().reverse().map((e) => ({ type: e.art, receivedAt: e.zeitpunkt, payload: e.payload || {} }));
        return { vorhanden: true, inhalt: { events }, sekundenAlt: 0, sekundenSeitMeldung: r.sekundenSeitMeldung };
      }
    }
    return rpc('kc_stand_spiegel', { p_stand: stand.standId, p_pfad: '/live-event-log' });
  }
  async function spiegelLesen(pfad, query) {
    const stand = gewaehlterStand();
    const { r, zusatzSek } = await spiegelHolen(stand, pfad);
    const seitMeldung = r.sekundenSeitMeldung === null || r.sekundenSeitMeldung === undefined ? r.sekundenSeitMeldung : r.sekundenSeitMeldung + zusatzSek;
    standInfo = { ...(standInfo || {}), sekundenSeitMeldung: seitMeldung, name: stand.name };
    zeichneBanner();
    if (!r.vorhanden) return jsonAntwort(503, { error: 'stand_hat_noch_nichts_gemeldet', hinweis: 'Der Stand hat diese Übersicht noch nicht hochgeladen. Läuft der Mini-PC und ist er als Stand angemeldet?' });
    let inhalt = r.inhalt;
    const alter = Number(r.sekundenAlt || 0) + zusatzSek;
    const q = new URLSearchParams(query || '');
    if (pfad === '/kassen-verbindungen' && inhalt && Array.isArray(inhalt.kassen)) {
      inhalt = { ...inhalt, fernmodus: { sekundenAlt: alter, sekundenSeitMeldung: seitMeldung },
        kassen: inhalt.kassen.map((k) => {
          const vorSek = k.zuletztGemeldetVorSek === null || k.zuletztGemeldetVorSek === undefined ? null : k.zuletztGemeldetVorSek + alter;
          return { ...k, zuletztGemeldetVorSek: vorSek, zustand: vorSek === null ? 'gekoppelt_ohne_meldung' : vorSek < 90 ? 'aktiv' : 'gekoppelt_still' };
        }) };
    }
    if (pfad === '/gelduebergaben-bestaetigungen-abholen') {
      const seit = q.get('seit');
      const liste = ((inhalt && inhalt.eintraege) || []).filter((e) => !seit || e.receivedAt > seit).map((e) => e.daten);
      inhalt = { bestaetigungen: liste, anzahl: liste.length, abgefragtUm: new Date().toISOString() };
    }
    if (pfad === '/cash-transfer-confirmations' && inhalt && Array.isArray(inhalt.bestaetigungen)) {
      const seit = q.get('since');
      const liste = inhalt.bestaetigungen.filter((e) => !seit || e.receivedAt > seit);
      inhalt = { ...inhalt, bestaetigungen: liste, anzahl: liste.length };
    }
    const limit = parseInt(q.get('limit'), 10);
    if (limit > 0 && inhalt && Array.isArray(inhalt.events)) inhalt = { ...inhalt, events: inhalt.events.slice(0, limit) };
    if (limit > 0 && inhalt && Array.isArray(inhalt.eintraege) && pfad === '/verbindungsqualitaet') inhalt = { ...inhalt, eintraege: inhalt.eintraege.slice(0, limit) };
    return jsonAntwort(200, inhalt);
  }

  // ---------- senden: Auftrag ----------
  async function auftragSenden(pfad, koerper) {
    let daten = {};
    try { daten = koerper ? JSON.parse(typeof koerper === 'string' ? koerper : await new Response(koerper).text()) : {}; }
    catch (e) { return jsonAntwort(400, { error: 'payload_invalid' }); }
    return auftragMitDaten(pfad, daten);
  }
  async function auftragMitDaten(pfad, daten) {
    const stand = gewaehlterStand();
    const { auftragId } = await rpc('kc_stand_auftrag_anlegen', { p_stand: stand.standId, p_pfad: pfad, p_koerper: daten });
    // Wachsende Pause (1, 2, 4, 8 … s): der Stand meldet sich ohne Neues nur alle 30 s.
    // Mit direkter Leitung: warten auf das Signal „auftrag-erledigt“ (Rückfrage dann sofort), sonst nur selten nachfragen.
    const ende = Date.now() + AUFTRAG_WARTEN_MS;
    for (let i = 0; Date.now() < ende; i++) {
      const pausen = leitungSteht() ? LEITUNG_AUFTRAG_PAUSEN_MS : AUFTRAG_PAUSEN_MS;
      const pause = Math.min(pausen[Math.min(i, pausen.length - 1)], Math.max(0, ende - Date.now()));
      if (pause <= 0) break;
      await warteAufErledigt(pause);
      let st = null;
      try { st = await rpc('kc_stand_auftrag', { p_auftrag: auftragId }); } catch (e) { continue; }
      if (st && st.status === 'erledigt') {
        spiegelLeeren(); // der Stand spiegelt Änderungen gleich danach - nicht 25 s alte Antworten zeigen
        meldeHinweis('success', `Am Stand ausgeführt (${beschreibe(pfad)}).`);
        return jsonAntwort(st.statusCode || 200, st.antwort || {});
      }
    }
    meldeHinweis('warning', `${beschreibe(pfad)}: an den Stand unterwegs. Der Stand meldet sich gerade nicht (kein Internet am Stand oder Mini-PC aus) – es wird ausgeführt, sobald er wieder online ist. Nichts doppelt senden.`);
    return jsonAntwort(202, { kcFernmodus: 'unterwegs', auftragId, hinweis: 'Wird am Stand ausgeführt, sobald der Mini-PC online ist.' });
  }
  // Wartende Aufträge: das Signal „auftrag-erledigt“ beendet die Pause sofort
  const erledigtWarter = new Set();
  function warteAufErledigt(ms) {
    return new Promise((r) => {
      const fertig = () => { clearTimeout(t); erledigtWarter.delete(fertig); r(); };
      const t = setTimeout(fertig, ms);
      erledigtWarter.add(fertig);
    });
  }
  function beschreibe(pfad) {
    return ({ '/master-data/push': 'Stammdaten an alle Kassen', '/dienstplan/push': 'Dienstplan an die Kassen', '/sold-out-status/setzen': 'Ausverkauft',
      '/remote-command/queue': 'Befehl an eine Kasse', '/kassen/kopplung-widerrufen': 'Gerät verloren / Kopplung widerrufen',
      '/api/v1/cash-transfer/queue': 'Geld-Übergabe', '/fernseher/tv-paket': 'Präsentation an den Fernseher', '/api/v1/finance-transfer/queue': 'Geld-Übergabe', '/bargeld/uebergabe': 'Bargeld-Übergabe', '/bargeld/protokoll': 'Bargeld-Protokoll', '/update/freigeben': 'Programm-Update freigeben' })[pfad] || pfad;
  }
  function meldeHinweis(art, text) { try { global.KCManagerMessages && global.KCManagerMessages[art] && global.KCManagerMessages[art](text); } catch (e) { /* */ } }

  // ---------- fetch umlenken ----------
  global.fetch = async function (eingabe, optionen) {
    const url = typeof eingabe === 'string' ? eingabe : (eingabe && eingabe.url) || '';
    const m = url.match(LOKAL);
    if (!m) return echtFetch(eingabe, optionen);
    const md = await bestimmeModus();
    if (md !== 'fern') return echtFetch(eingabe, optionen);
    const pfad = m[2] || '/', query = (m[3] || '').slice(1);
    const methode = String((optionen && optionen.method) || (eingabe && eingabe.method) || 'GET').toUpperCase();
    if (!angemeldet()) return jsonAntwort(401, { error: 'fernmodus_nicht_angemeldet', hinweis: 'Zu Hause bitte im PC-Manager bei Supabase anmelden.' });
    if (!gewaehlterStand()) return jsonAntwort(503, { error: 'fernmodus_kein_stand', hinweis: 'Unten rechts den Stand auswählen.' });
    try {
      if (methode === 'OPTIONS') return new Response(null, { status: 204 });
      if ((methode === 'GET' || methode === 'HEAD') && SPIEGEL.includes(pfad)) return await spiegelLesen(pfad, query);
      if (methode === 'POST' && AUFTRAG.includes(pfad)) return await auftragSenden(pfad, optionen && optionen.body);
      return jsonAntwort(503, { error: 'nur_am_stand', hinweis: 'Diese Funktion gibt es nur direkt am Stand-PC.' });
    } catch (e) {
      letzterFehler = e.message; zeichneBanner();
      throw new TypeError(`Fernmodus: ${e.message}`);
    }
  };

  // ---------- Live-Monitor: WebSocket umlenken ----------
  const offeneSockets = new Set();
  class FernSocket {
    constructor(url) {
      this.url = url; this.readyState = 0; this.onopen = null; this.onmessage = null; this.onclose = null; this.onerror = null;
      this._hoerer = { open: [], message: [], close: [], error: [] };
      this._cursor = null; this._aktivitaet = {}; this._aus = false; this._fehler = 0;
      setTimeout(() => this._start(), 0);
    }
    addEventListener(t, f) { (this._hoerer[t] || (this._hoerer[t] = [])).push(f); }
    removeEventListener(t, f) { this._hoerer[t] = (this._hoerer[t] || []).filter((x) => x !== f); }
    _feuer(t, ev) { try { const h = this['on' + t]; if (h) h.call(this, ev); } catch (e) { /* */ } (this._hoerer[t] || []).forEach((f) => { try { f.call(this, ev); } catch (e) { /* */ } }); }
    send() { /* Live-Monitor sendet nichts */ }
    close() {
      if (this._aus) return; this._aus = true; this.readyState = 3; clearTimeout(this._t);
      offeneSockets.delete(this);
      if (this._sichtbar && global.document && global.document.removeEventListener) global.document.removeEventListener('visibilitychange', this._sichtbar);
      this._feuer('close', { code: 1000 });
    }
    async _start() {
      const stand = gewaehlterStand();
      if (!stand || !angemeldet()) { this.readyState = 3; this._feuer('error', {}); this._feuer('close', { code: 1006 }); return; }
      try { this._cursor = (await rpc('kc_stand_ereignisse', { p_stand: stand.standId, p_nach_id: null })).letzteId; }
      catch (e) { this.readyState = 3; this._feuer('error', {}); this._feuer('close', { code: 1006 }); return; }
      this.readyState = 1; this._feuer('open', {});
      offeneSockets.add(this);
      if (global.document && global.document.addEventListener) {
        this._sichtbar = () => { if (!global.document.hidden) this._sofort(); };
        global.document.addEventListener('visibilitychange', this._sichtbar);
      }
      this._takt();
    }
    async _takt() {
      if (this._aus) return;
      const stand = gewaehlterStand();
      try {
        const r = await rpc('kc_stand_ereignisse', { p_stand: stand.standId, p_nach_id: this._cursor, p_limit: 200 });
        standInfo = { ...(standInfo || {}), sekundenSeitMeldung: r.sekundenSeitMeldung, name: stand.name, ...(r.info ? { info: r.info } : {}) };
        for (const e of r.ereignisse || []) {
          this._cursor = Math.max(this._cursor || 0, e.id);
          this._feuer('message', { data: JSON.stringify({ type: e.art, payload: e.payload || {}, receivedAt: e.zeitpunkt, deviceInstanceId: null }) });
        }
        // Lebenszeichen der Kassen (Herzschlag) aus der Stand-Meldung - für die Status-LEDs
        const akt = (standInfo && standInfo.info && standInfo.info.letzteAktivitaet) || {};
        for (const [kasse, zeit] of Object.entries(akt)) {
          if (this._aktivitaet[kasse] !== zeit) {
            this._aktivitaet[kasse] = zeit;
            this._feuer('message', { data: JSON.stringify({ type: 'heartbeat', payload: { registerId: kasse }, receivedAt: zeit }) });
          }
        }
        letzterFehler = null; this._fehler = 0;
      } catch (e) { letzterFehler = e.message; this._fehler++; }
      zeichneBanner();
      // Sichtbar alle 10 s, verborgen alle 60 s; bei Fehlern wachsende Pause (höchstens 2 min).
      const grund = leitungSteht() ? (verborgen() ? LEITUNG_SOCKET_VERBORGEN_MS : LEITUNG_SOCKET_MS)
        : (verborgen() ? SOCKET_TAKT_VERBORGEN_MS : SOCKET_TAKT_MS);
      const pause = this._fehler ? Math.min(SOCKET_TAKT_MAX_MS, grund * Math.pow(2, Math.min(this._fehler, 4))) : grund;
      this._t = setTimeout(() => this._takt(), pause);
    }
    // Seite wird wieder sichtbar: nicht bis zu 60 s warten
    _sofort() { if (this._aus || this.readyState !== 1) return; clearTimeout(this._t); this._t = setTimeout(() => this._takt(), 0); }
  }
  global.WebSocket = function (url, protokolle) {
    if (WS_LOKAL.test(String(url)) && modus === 'fern') return new FernSocket(url);
    if (WS_LOKAL.test(String(url)) && modus === null) {
      // Modus noch nicht bekannt: erst klären, dann passend verbinden (Live-Monitor verbindet bei Fehler neu).
      bestimmeModus();
      return new FernSocketWarte(url, protokolle);
    }
    return protokolle === undefined ? new EchtWebSocket(url) : new EchtWebSocket(url, protokolle);
  };
  global.WebSocket.prototype = EchtWebSocket.prototype;
  ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach((k) => { global.WebSocket[k] = EchtWebSocket[k]; });
  // Platzhalter, solange der Modus noch geprüft wird: meldet „geschlossen“, der Live-Monitor
  // versucht es nach kurzer Zeit erneut - dann mit dem richtigen Weg.
  class FernSocketWarte extends FernSocket { async _start() { await bestimmeModus(); this.readyState = 3; this._feuer('close', { code: 1006 }); } }

  // ---------- Statusanzeige unten rechts ----------
  let taktLaeuft = false;
  function starteStatusTakt() {
    if (taktLaeuft) return; taktLaeuft = true;
    const runde = async () => {
      const stand = gewaehlterStand();
      if (stand && angemeldet()) {
        try {
          const liste = await rpc('kc_stand_liste', {});
          const s = (liste || []).find((x) => x.standId === stand.standId);
          standInfo = s ? { name: s.name, sekundenSeitMeldung: s.sekundenSeitMeldung, info: s.info } : { name: stand.name, fehlt: true };
          letzterFehler = null;
        } catch (e) { letzterFehler = e.message; }
      } else await standAuswaehlenFallsNoetig();
      zeichneBanner();
      setTimeout(runde, leitungSteht() ? LEITUNG_STAND_LISTE_MS : STAND_LISTE_MS);
    };
    runde();
  }
  function zeichneBanner(auswahl) {
    if (!document.body) { document.addEventListener('DOMContentLoaded', () => zeichneBanner(auswahl), { once: true }); return; }
    let el = document.getElementById('kcFernmodusBanner');
    if (modus !== 'fern') { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div'); el.id = 'kcFernmodusBanner';
      el.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:99999;max-width:440px;padding:10px 14px;border-radius:12px;font:600 14px/1.35 system-ui,Segoe UI,Arial,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.25)';
      document.body.appendChild(el);
    }
    const stand = gewaehlterStand();
    let farbe = '#e7f6ee', text = '#14532d', inhalt;
    if (!angemeldet()) { farbe = '#fff4e5'; text = '#7c2d12'; inhalt = '🌐 Fernmodus (zu Hause): bitte oben im PC-Manager bei Supabase anmelden – dann erscheinen die Daten vom Stand.'; }
    else if (!stand) {
      farbe = '#fff4e5'; text = '#7c2d12';
      inhalt = '🌐 Fernmodus: welchen Stand anzeigen? ' + (auswahl && auswahl.length ? auswahl.map((s) => `<button type="button" data-kc-stand="${s.standId}" data-kc-name="${String(s.name).replace(/"/g, '&quot;')}" style="margin:4px 4px 0 0">${String(s.name).replace(/</g, '&lt;')}</button>`).join('') : '(noch kein Stand angemeldet – am Mini-PC „Diesen PC als Stand anmelden“)');
    } else if (letzterFehler && !standInfo) { farbe = '#fdecea'; text = '#7f1d1d'; inhalt = `🌐 Fernmodus · Stand „${stand.name}“: Supabase nicht erreichbar (${letzterFehler}). Internet zu Hause prüfen.`; }
    else {
      const sek = standInfo && standInfo.sekundenSeitMeldung;
      if (sek === null || sek === undefined) { farbe = '#fdecea'; text = '#7f1d1d'; inhalt = `🌐 Fernmodus · Stand „${stand.name}“ hat sich noch NIE gemeldet – läuft der Mini-PC, ist er als Stand angemeldet?`; }
      else if (sek >= VERALTET_SEK) { farbe = '#fdecea'; text = '#7f1d1d'; inhalt = `🌐 Fernmodus · Stand „${stand.name}“ · VERALTET: zuletzt gemeldet vor ${dauer(sek)}. Kein Internet am Stand oder Mini-PC aus – am Stand wird trotzdem kassiert, die Daten kommen nach.`; }
      // gelb erst ab 90 s: mit direkter Leitung meldet sich ein ruhiger Stand nur jede Minute (Aufträge wecken ihn sofort)
      else { if (sek >= 90) { farbe = '#fff4e5'; text = '#7c2d12'; } inhalt = `🌐 Fernmodus · Stand „${stand.name}“ · zuletzt gemeldet vor ${dauer(sek)}`; }
      const rt = standInfo && standInfo.info && standInfo.info.router;
      if (rt && Number.isFinite(Number(rt.gesamtBytes))) {
        const g = Number(rt.gesamtBytes) / 1073741824, v = Number(rt.volumenGB) || 0, p = v ? Math.round(g / v * 100) : null;
        inhalt += ` · 📶 4G ${g.toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}${v ? ` von ${v} GB` : ' GB'}`;
        if (p != null && p >= 80) { farbe = '#fdecea'; text = '#7f1d1d'; inhalt += ` – ${p} %, bitte nachbuchen!`; }
      }
    }
    el.style.background = farbe; el.style.color = text; el.innerHTML = inhalt;
    bannerPlatz();
    el.querySelectorAll('[data-kc-stand]').forEach((b) => { b.onclick = () => waehleStand({ standId: b.dataset.kcStand, name: b.dataset.kcName }); });
  }
  // KC-FERNMODUS-PLATZ (Wunsch Hansi 20.11.2026): Liegt unten rechts schon der gelbe Entwicklungs-Hinweis
  // (#devQuickAccessBadge), rückt die Fernmodus-Meldung darüber – sonst verdeckt der Hinweis sie.
  function bannerPlatz() {
    const el = document.getElementById('kcFernmodusBanner'); if (!el) return;
    const hinweis = document.getElementById('devQuickAccessBadge');
    const sichtbar = hinweis && !hinweis.hidden && hinweis.offsetHeight > 0;
    el.style.bottom = sichtbar ? (hinweis.offsetHeight + 14 + 10) + 'px' : '12px';
  }
  if (global.document && global.document.addEventListener) global.document.addEventListener('kc-hinweis-unten-rechts', bannerPlatz);
  function dauer(sek) { return sek < 120 ? `${sek} s` : sek < 7200 ? `${Math.round(sek / 60)} min` : `${Math.round(sek / 3600)} h`; }

  // ---------- Signale der direkten Leitung (kc-direkte-leitung-manager.js ruft das auf) ----------
  // Sichtbare Seite: Live-Monitor höchstens alle 5 s auf Signal (ein voller Stand meldet alle 5 s). Verborgene Seite:
  // Signale nur merken – geholt wird beim Sichtbarwerden (FernSocket holt dann ohnehin sofort) bzw. in der Sicherheitsabfrage.
  const SIGNAL_ABSTAND_MS = 5000;
  let socketWecker = null, letzterSignalAbruf = 0, spiegelVeraltet = false;
  function signal(art) {
    if (modus !== 'fern') return;
    if ((art === 'stand' || art === 'nachholen') && !verborgen() && !socketWecker) {
      const warteMs = Math.max(300, SIGNAL_ABSTAND_MS - (Date.now() - letzterSignalAbruf));
      socketWecker = setTimeout(() => { socketWecker = null; letzterSignalAbruf = Date.now(); offeneSockets.forEach((s) => s._sofort()); }, warteMs);
    }
    if (art === 'stand-spiegel' || art === 'nachholen') { if (verborgen()) spiegelVeraltet = true; else spiegelLeeren(); }
    if (art === 'auftrag-erledigt' || art === 'nachholen') [...erledigtWarter].forEach((f) => f());
  }
  if (global.document && global.document.addEventListener) {
    global.document.addEventListener('visibilitychange', () => { if (!global.document.hidden && spiegelVeraltet) { spiegelVeraltet = false; spiegelLeeren(); } });
  }

  global.KCFernmodus = { modus: () => modus, bestimmeModus, gewaehlterStand, waehleStand, standInfo: () => standInfo, signal,
    // Auftrag an den Stand ohne Umweg über fetch (z. B. Präsentation an den Fernseher)
    auftrag: (pfad, daten) => auftragMitDaten(pfad, daten) };
  bestimmeModus();
})(window);
