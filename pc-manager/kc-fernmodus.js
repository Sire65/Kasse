// KC PC-Manager – Fernmodus (KS-04 „PC-Manager zuhause liest den Stand über Supabase“)
//
// Der PC-Manager spricht mit dem Manager-Dienst über http://127.0.0.1:47392 (und den
// Live-Monitor-WebSocket). Am Stand ist das der Mini-PC selbst. ZU HAUSE gibt es diesen Dienst
// nicht - dann verlängert diese Datei genau diesen Kanal über Supabase:
//   lesen   (GET)  -> „Spiegel“, den die Stand-Brücke am Mini-PC laufend hochlädt
//   senden  (POST) -> „Auftrag“, den der Mini-PC abholt, ausführt und quittiert
//   Live-Monitor   -> Ereignisse des Stands aus Supabase, alle 4 Sekunden
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
    '/api/v1/cash-transfer/queue', '/api/v1/finance-transfer/queue', '/bargeld/uebergabe', '/bargeld/protokoll'];
  const VERALTET_SEK = 120;
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
  async function spiegelLesen(pfad, query) {
    const stand = gewaehlterStand();
    const r = await rpc('kc_stand_spiegel', { p_stand: stand.standId, p_pfad: pfad });
    standInfo = { ...(standInfo || {}), sekundenSeitMeldung: r.sekundenSeitMeldung, name: stand.name };
    zeichneBanner();
    if (!r.vorhanden) return jsonAntwort(503, { error: 'stand_hat_noch_nichts_gemeldet', hinweis: 'Der Stand hat diese Übersicht noch nicht hochgeladen. Läuft der Mini-PC und ist er als Stand angemeldet?' });
    let inhalt = r.inhalt;
    const alter = Number(r.sekundenAlt || 0);
    const q = new URLSearchParams(query || '');
    if (pfad === '/kassen-verbindungen' && inhalt && Array.isArray(inhalt.kassen)) {
      inhalt = { ...inhalt, fernmodus: { sekundenAlt: alter, sekundenSeitMeldung: r.sekundenSeitMeldung },
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
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      let st = null;
      try { st = await rpc('kc_stand_auftrag', { p_auftrag: auftragId }); } catch (e) { continue; }
      if (st && st.status === 'erledigt') {
        meldeHinweis('success', `Am Stand ausgeführt (${beschreibe(pfad)}).`);
        return jsonAntwort(st.statusCode || 200, st.antwort || {});
      }
    }
    meldeHinweis('warning', `${beschreibe(pfad)}: an den Stand unterwegs. Der Stand meldet sich gerade nicht (kein Internet am Stand oder Mini-PC aus) – es wird ausgeführt, sobald er wieder online ist. Nichts doppelt senden.`);
    return jsonAntwort(202, { kcFernmodus: 'unterwegs', auftragId, hinweis: 'Wird am Stand ausgeführt, sobald der Mini-PC online ist.' });
  }
  function beschreibe(pfad) {
    return ({ '/master-data/push': 'Stammdaten an alle Kassen', '/dienstplan/push': 'Dienstplan an die Kassen', '/sold-out-status/setzen': 'Ausverkauft',
      '/remote-command/queue': 'Befehl an eine Kasse', '/kassen/kopplung-widerrufen': 'Gerät verloren / Kopplung widerrufen',
      '/api/v1/cash-transfer/queue': 'Geld-Übergabe', '/fernseher/tv-paket': 'Präsentation an den Fernseher', '/api/v1/finance-transfer/queue': 'Geld-Übergabe', '/bargeld/uebergabe': 'Bargeld-Übergabe', '/bargeld/protokoll': 'Bargeld-Protokoll' })[pfad] || pfad;
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
  class FernSocket {
    constructor(url) {
      this.url = url; this.readyState = 0; this.onopen = null; this.onmessage = null; this.onclose = null; this.onerror = null;
      this._hoerer = { open: [], message: [], close: [], error: [] };
      this._cursor = null; this._aktivitaet = {}; this._aus = false;
      setTimeout(() => this._start(), 0);
    }
    addEventListener(t, f) { (this._hoerer[t] || (this._hoerer[t] = [])).push(f); }
    removeEventListener(t, f) { this._hoerer[t] = (this._hoerer[t] || []).filter((x) => x !== f); }
    _feuer(t, ev) { try { const h = this['on' + t]; if (h) h.call(this, ev); } catch (e) { /* */ } (this._hoerer[t] || []).forEach((f) => { try { f.call(this, ev); } catch (e) { /* */ } }); }
    send() { /* Live-Monitor sendet nichts */ }
    close() { if (this._aus) return; this._aus = true; this.readyState = 3; clearTimeout(this._t); this._feuer('close', { code: 1000 }); }
    async _start() {
      const stand = gewaehlterStand();
      if (!stand || !angemeldet()) { this.readyState = 3; this._feuer('error', {}); this._feuer('close', { code: 1006 }); return; }
      try { this._cursor = (await rpc('kc_stand_ereignisse', { p_stand: stand.standId, p_nach_id: null })).letzteId; }
      catch (e) { this.readyState = 3; this._feuer('error', {}); this._feuer('close', { code: 1006 }); return; }
      this.readyState = 1; this._feuer('open', {});
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
        letzterFehler = null;
      } catch (e) { letzterFehler = e.message; }
      zeichneBanner();
      this._t = setTimeout(() => this._takt(), 4000);
    }
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
      setTimeout(runde, 15000);
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
      else { if (sek >= 60) { farbe = '#fff4e5'; text = '#7c2d12'; } inhalt = `🌐 Fernmodus · Stand „${stand.name}“ · zuletzt gemeldet vor ${dauer(sek)}`; }
    }
    el.style.background = farbe; el.style.color = text; el.innerHTML = inhalt;
    el.querySelectorAll('[data-kc-stand]').forEach((b) => { b.onclick = () => waehleStand({ standId: b.dataset.kcStand, name: b.dataset.kcName }); });
  }
  function dauer(sek) { return sek < 120 ? `${sek} s` : sek < 7200 ? `${Math.round(sek / 60)} min` : `${Math.round(sek / 3600)} h`; }

  global.KCFernmodus = { modus: () => modus, bestimmeModus, gewaehlterStand, waehleStand, standInfo: () => standInfo,
    // Auftrag an den Stand ohne Umweg über fetch (z. B. Präsentation an den Fernseher)
    auftrag: (pfad, daten) => auftragMitDaten(pfad, daten) };
  bestimmeModus();
})(window);
