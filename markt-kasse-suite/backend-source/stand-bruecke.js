// KC MarktKasse – Stand-Brücke (KS-04 „Tablet -> Mini-PC -> Supabase -> PC-Manager zuhause“)
//
// Läuft im Manager-Dienst auf dem Mini-PC am Stand. Ohne geöffneten Browser.
//   Stand -> Zuhause: jedes Live-Ereignis (live_event_log: Verkauf, Storno, Ausverkauft, Abschluss,
//                     Stempeln, Kassenstart …) fortlaufend + alle 30 s ein „Spiegel“ der Übersichten,
//                     die der PC-Manager vom Manager-Dienst liest.
//   Zuhause -> Stand: „Aufträge“ aus Supabase abholen, hier genau so ausführen, als kämen sie vom
//                     PC-Manager vor Ort (gleicher Pfad auf 127.0.0.1:47392), Ergebnis zurückmelden.
// Grundsätze: Kassieren hängt nie hiervon ab. Nichts geht verloren (Merkstelle: bis wohin gesendet,
// welche Aufträge erledigt). Nicht erreichbar -> nachreichen, mit klarer Meldung.
// Zugang: Stand-ID + Stand-Geheimnis (Datei stand-zugang.json im Datenordner, nie im Repository).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const { meldung, druckeKasten, SCHRITT_BETREUER } = require('./fehlerhilfe');

const SPIEGEL = [
  ['/kassen-verbindungen', '/kassen-verbindungen'],
  ['/sold-out-status-alle', '/sold-out-status-alle'],
  ['/abschluesse/liste', '/abschluesse/liste'],
  ['/gutscheine/liste', '/gutscheine/liste'],
  ['/zeiterfassung/liste', '/zeiterfassung/liste'],
  ['/cash-transfer-confirmations', '/cash-transfer-confirmations'],
  ['/bargeld/uebergaben', '/bargeld/uebergaben'],
  ['/bargeld/protokolle', '/bargeld/protokolle'],
  ['/verbindungsqualitaet', '/verbindungsqualitaet?limit=500'],
  ['/kassen/startprotokoll', '/kassen/startprotokoll'],
  ['/live-event-log', '/live-event-log?limit=200'],
];
const AUFTRAG_PFADE = new Set(['/master-data/push', '/dienstplan/push', '/sold-out-status/setzen', '/remote-command/queue',
  '/kassen/kopplung-widerrufen', '/api/v1/cash-transfer/queue', '/api/v1/finance-transfer/queue', '/bargeld/uebergabe', '/bargeld/protokoll',
  '/fernseher/tv-paket', '/fernseher/tv-programm']);
const MAX_SPIEGEL_BYTES = 2 * 1024 * 1024;

function schreibeAtomar(datei, inhalt) {
  fs.mkdirSync(path.dirname(datei), { recursive: true });
  const tmp = `${datei}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, inhalt, { mode: 0o600 });
  fs.renameSync(tmp, datei);
}
function lies(datei, ersatz) { try { return JSON.parse(fs.readFileSync(datei, 'utf8')); } catch (e) { return ersatz; } }
const warte = (ms) => new Promise((r) => { const t = setTimeout(r, ms); if (t.unref) t.unref(); });

// Anfrage an den eigenen Manager-Dienst (Loopback) - derselbe Weg wie der PC-Manager vor Ort.
function lokal(port, methode, pfad, koerper) {
  return new Promise((resolve) => {
    const daten = koerper === undefined ? null : Buffer.from(JSON.stringify(koerper));
    const req = http.request({ host: '127.0.0.1', port, path: pfad, method: methode, timeout: 20000,
      headers: { 'Content-Type': 'application/json', ...(daten ? { 'Content-Length': daten.length } : {}) } }, (res) => {
      const teile = []; res.on('data', (c) => teile.push(c));
      res.on('end', () => { const text = Buffer.concat(teile).toString('utf8'); let json = null; try { json = JSON.parse(text); } catch (e) { /* kein JSON */ } resolve({ status: res.statusCode, json, text }); });
    });
    req.on('timeout', () => req.destroy(new Error('zeitueberschreitung')));
    req.on('error', (e) => resolve({ status: 0, json: null, fehler: e.message }));
    if (daten) req.write(daten);
    req.end();
  });
}

class StandBruecke {
  constructor({ manager, datenOrdner, log = console.log, fehlerLog = console.error, livePort = 47392, takt = 5000, spiegelTakt = 30000, version = null } = {}) {
    this.manager = manager;
    this.datenOrdner = datenOrdner;
    this.log = log;
    this.fehlerLog = fehlerLog;
    this.livePort = livePort;
    this.takt = takt;
    this.spiegelTakt = spiegelTakt;
    this.version = version;
    this.zugangDatei = path.join(datenOrdner, 'stand-zugang.json');
    this.merkDatei = path.join(datenOrdner, 'stand-bruecke-merk.json');
    this.zustand = { eingerichtet: false, verbunden: null, letzterErfolg: null, letzterVersuch: null, rueckstand: 0, meldung: null, auftraegeErledigt: 0 };
    this._spiegelHash = new Map();
    this._letzterSpiegel = 0;
    this._stopp = false;
    this._laeuft = false;
  }

  get zugang() { const z = lies(this.zugangDatei, null); return z && z.url && z.standId && z.geheimnis && z.publishableKey ? z : null; }

  status() {
    const z = this.zugang;
    return { ...this.zustand, eingerichtet: !!z, standName: z ? z.name : null, standId: z ? z.standId : null, supabase: z ? z.url : null };
  }

  // Vom PC-Manager am Stand (nach „Diesen PC als Stand anmelden“) über die IPC-Strecke des Webservers.
  einrichten({ url, publishableKey, standId, geheimnis, name } = {}) {
    if (!/^https:\/\/[a-z0-9.-]+$/i.test(String(url || '')) && !/^http:\/\/127\.0\.0\.1:\d+$/.test(String(url || ''))) throw new Error('supabase_adresse_ungueltig');
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(String(publishableKey || '')) && !/^[A-Za-z0-9._-]{20,}$/.test(String(publishableKey || ''))) throw new Error('schluessel_ungueltig');
    if (!/^[0-9a-f-]{36}$/.test(String(standId || '')) || !/^[0-9a-f]{64}$/.test(String(geheimnis || ''))) throw new Error('stand_zugang_ungueltig');
    schreibeAtomar(this.zugangDatei, JSON.stringify({ url, publishableKey, standId, geheimnis, name: String(name || 'Stand').slice(0, 80), eingerichtetAm: new Date().toISOString() }, null, 2));
    // Neuer Stand: alles noch einmal vollständig senden (die Cloud kennt ihn noch nicht).
    schreibeAtomar(this.merkDatei, JSON.stringify({ standId, gesendetBis: 0, erledigt: {} }));
    this._spiegelHash.clear(); this._letzterSpiegel = 0;
    this.log(`[Stand-Brücke] Eingerichtet: Stand „${name}“. Buchungen gehen ab jetzt auch nach Hause (Supabase).`);
    this.start();
    return this.status();
  }

  abmelden() {
    try { fs.rmSync(this.zugangDatei, { force: true }); } catch (e) { /* schon weg */ }
    this.zustand = { ...this.zustand, verbunden: null, meldung: null };
    this.log('[Stand-Brücke] Abgemeldet – es wird nichts mehr nach Hause gesendet.');
    return this.status();
  }

  start() {
    this._stopp = false;
    if (this._laeuft) return;
    if (!this.zugang) { this.zustand.eingerichtet = false; return; }
    this._laeuft = true;
    this._schleife().finally(() => { this._laeuft = false; });
  }

  stop() { this._stopp = true; }

  async _schleife() {
    let pause = this.takt;
    while (!this._stopp && this.zugang) {
      let ergebnis;
      try { ergebnis = await this._runde(); }
      catch (e) { ergebnis = { ok: false, fehler: e }; }
      if (ergebnis.ok) {
        if (this.zustand.verbunden !== true) {
          this.log(`[Stand-Brücke] Verbindung nach Hause: OK (Stand „${this.zugang ? this.zugang.name : ''}“)${this.zustand.verbunden === false ? ' – alles Nachgereichte ist angekommen.' : ''}`);
        }
        this.zustand.verbunden = true; this.zustand.meldung = null;
        pause = ergebnis.mehr ? 300 : this.takt;
      } else {
        const m = this._erklaere(ergebnis.fehler);
        if (this.zustand.verbunden !== false || (this.zustand.meldung && this.zustand.meldung.schluessel !== m.schluessel)) druckeKasten(this.fehlerLog, [m]);
        this.zustand.verbunden = false; this.zustand.meldung = m;
        pause = Math.min(60000, pause < this.takt ? this.takt : pause * 2);
      }
      await warte(pause);
    }
  }

  _erklaere(e) {
    const status = e && e.status;
    if (status === 401) {
      return meldung('stand-zugang', 'Verbindung nach Hause: Stand-Zugang wird abgelehnt',
        'Der Stand wurde im PC-Manager abgemeldet oder der Zugang ist ungültig. Am Stand wird normal weiter kassiert; nach Hause geht nichts.',
        ['Am Mini-PC den PC-Manager öffnen → Verbindung prüfen → „Diesen PC als Stand anmelden“.', SCHRITT_BETREUER], `HTTP 401 ${e.message || ''}`.trim());
    }
    if (status === 404) {
      return meldung('stand-supabase-fehlt', 'Verbindung nach Hause: Supabase kennt die Stand-Brücke nicht',
        'Die Datenbank-Erweiterung „Stand-Brücke“ ist in Supabase noch nicht eingespielt.',
        ['Betreuer: supabase/migrations/20261113_kc_stand_bruecke.sql in Supabase einspielen.', 'Am Stand wird solange normal kassiert; die Buchungen werden später nachgereicht.'], `HTTP 404 ${e.message || ''}`.trim());
    }
    if (!status) {
      return meldung('stand-offline', 'Verbindung nach Hause gestört – Buchungen werden nachgereicht',
        `Supabase ist gerade nicht erreichbar (kein Internet am Stand oder Störung). ${this.zustand.rueckstand ? `${this.zustand.rueckstand} Ereignis(se) warten auf dem Mini-PC.` : ''} Am Stand wird ganz normal weiter kassiert.`,
        ['Nichts tun – sobald das Internet wieder da ist, wird alles automatisch nachgereicht.', 'Dauert es lange: prüfen, ob der 5G-Router Internet hat (Anzeige am Router).'], String((e && (e.cause && e.cause.code || e.message)) || e));
    }
    return meldung('stand-fehler', 'Verbindung nach Hause: Fehler bei Supabase',
      'Supabase hat die Meldung abgelehnt. Am Stand wird normal weiter kassiert; es wird automatisch erneut versucht.',
      ['Nichts tun – es wird jede Minute erneut versucht.', SCHRITT_BETREUER], `HTTP ${status} ${e.message || ''}`.trim());
  }

  async _rpc(z, name, args) {
    const antwort = await fetch(`${z.url}/rest/v1/rpc/${name}`, {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json', apikey: z.publishableKey, Authorization: `Bearer ${z.publishableKey}` },
      body: JSON.stringify(args),
    });
    const daten = await antwort.json().catch(() => null);
    if (!antwort.ok) throw Object.assign(new Error((daten && daten.message) || `HTTP ${antwort.status}`), { status: antwort.status });
    return daten;
  }

  _merk(z) {
    const m = lies(this.merkDatei, null);
    if (m && m.standId === z.standId) return m;
    return { standId: z.standId, gesendetBis: 0, erledigt: {} };
  }

  async _spiegelSammeln() {
    const spiegel = {};
    for (const [schluessel, pfad] of SPIEGEL) {
      const a = await lokal(this.livePort, 'GET', pfad);
      if (a.status !== 200 || !a.json) continue;
      this._nimmInSpiegel(spiegel, schluessel, a.json);
    }
    // Geld-Bestätigungen mit Empfangszeit, damit zu Hause „?seit=…“ genauso filtern kann wie am Stand.
    try {
      const zeilen = this.manager.db.prepare("SELECT payload, received_at FROM received_events WHERE type = 'cash_transfer_confirmed' ORDER BY received_at ASC").all();
      const eintraege = [];
      for (const z of zeilen) { try { eintraege.push({ receivedAt: z.received_at, daten: JSON.parse(z.payload) }); } catch (e) { /* defekt */ } }
      this._nimmInSpiegel(spiegel, '/gelduebergaben-bestaetigungen-abholen', { eintraege });
    } catch (e) { /* Tabelle fehlt - nichts zu spiegeln */ }
    return spiegel;
  }

  _nimmInSpiegel(spiegel, schluessel, inhalt) {
    const text = JSON.stringify(inhalt);
    if (Buffer.byteLength(text) > MAX_SPIEGEL_BYTES) return;
    const hash = crypto.createHash('sha256').update(text).digest('hex');
    if (this._spiegelHash.get(schluessel) === hash) return; // unverändert - nicht erneut senden
    spiegel[schluessel] = inhalt;
    spiegel.__hashes = spiegel.__hashes || {};
    spiegel.__hashes[schluessel] = hash;
  }

  _info() {
    const aktivitaet = {};
    try { for (const [kasse, ms] of (this.manager._kassenLetzteAktivitaet || new Map())) aktivitaet[kasse] = new Date(ms).toISOString(); } catch (e) { /* */ }
    return { version: this.version, letzteAktivitaet: aktivitaet, gemeldetUm: new Date().toISOString(), rueckstand: this.zustand.rueckstand };
  }

  async _runde() {
    const z = this.zugang;
    if (!z) return { ok: true };
    const merk = this._merk(z);
    this.zustand.letzterVersuch = new Date().toISOString();
    const zeilen = this.manager.db.prepare('SELECT id, type, register_id, payload, received_at FROM live_event_log WHERE id > ? ORDER BY id LIMIT 300').all(merk.gesendetBis);
    this.zustand.rueckstand = this.manager.db.prepare('SELECT COUNT(*) AS n FROM live_event_log WHERE id > ?').get(merk.gesendetBis).n;
    const ereignisse = zeilen.map((r) => {
      let payload = {}; try { payload = JSON.parse(r.payload); } catch (e) { payload = {}; }
      return { quelleId: r.id, art: r.type, kasse: r.register_id || payload.registerId || null, payload, zeitpunkt: r.received_at };
    });
    let spiegel = {};
    if (Date.now() - this._letzterSpiegel >= this.spiegelTakt || this._spiegelSofort) {
      spiegel = await this._spiegelSammeln();
      this._spiegelSofort = false;
    }
    const hashes = spiegel.__hashes || {}; delete spiegel.__hashes;
    const antwort = await this._rpc(z, 'kc_stand_melden', { p_stand: z.standId, p_geheimnis: z.geheimnis, p_ereignisse: ereignisse, p_spiegel: spiegel, p_info: this._info() });
    if (Object.keys(hashes).length || Date.now() - this._letzterSpiegel >= this.spiegelTakt) this._letzterSpiegel = Date.now();
    for (const [k, h] of Object.entries(hashes)) this._spiegelHash.set(k, h);
    if (zeilen.length) {
      merk.gesendetBis = zeilen[zeilen.length - 1].id;
      this.zustand.rueckstand = Math.max(0, this.zustand.rueckstand - zeilen.length);
    }
    // Aufträge von zu Hause ausführen
    let ausgefuehrt = 0;
    for (const a of (antwort && antwort.auftraege) || []) {
      let ergebnis = merk.erledigt[a.auftragId];
      if (!ergebnis) {
        if (!AUFTRAG_PFADE.has(a.pfad)) ergebnis = { status: 400, antwort: { error: 'pfad_nicht_erlaubt' } };
        else if (a.pfad === '/fernseher/tv-paket') {
          // KS-05: Präsentation von zu Hause auf den Fernseher am Stand (der TV-Player holt sie binnen 30 s)
          const p = a.koerper || {};
          if (!['KC-TV-1', 'kcm-tv-package-v2'].includes(p.schema) || !Array.isArray(p.slides)) ergebnis = { status: 400, antwort: { error: 'kein_gueltiges_tv_paket' } };
          else { schreibeAtomar(path.join(this.datenOrdner, 'tv-paket.kctv'), JSON.stringify(p)); ergebnis = { status: 200, antwort: { gespeichert: true, folien: p.slides.length } }; }
          this.log(`[Stand-Brücke] Auftrag von zu Hause ausgeführt: ${a.pfad} → ${ergebnis.status}`);
        } else if (a.pfad === '/fernseher/tv-programm') {
          // KS-05: HTML-Programm aus dem TV-Designer (von zu Hause) auf den Fernseher am Stand
          const html = a.koerper && typeof a.koerper.html === 'string' ? a.koerper.html : '';
          if (!/<html[\s>]/i.test(html)) ergebnis = { status: 400, antwort: { error: 'kein_gueltiges_tv_programm' } };
          else { schreibeAtomar(path.join(this.datenOrdner, 'tv-programm.html'), html); ergebnis = { status: 200, antwort: { gespeichert: true, groesse: html.length } }; }
          this.log(`[Stand-Brücke] Auftrag von zu Hause ausgeführt: ${a.pfad} → ${ergebnis.status}`);
        } else {
          const r = await lokal(this.livePort, 'POST', a.pfad, a.koerper || {});
          ergebnis = { status: r.status || 503, antwort: r.json || (r.fehler ? { error: r.fehler } : { text: (r.text || '').slice(0, 500) }) };
          this.log(`[Stand-Brücke] Auftrag von zu Hause ausgeführt: ${a.pfad} → ${ergebnis.status}`);
        }
        merk.erledigt[a.auftragId] = ergebnis;
        schreibeAtomar(this.merkDatei, JSON.stringify(merk)); // vor dem Quittieren merken: kein Doppel-Ausführen nach Absturz
        ausgefuehrt++;
      }
      await this._rpc(z, 'kc_stand_auftrag_erledigt', { p_stand: z.standId, p_geheimnis: z.geheimnis, p_auftrag: a.auftragId, p_status: ergebnis.status, p_antwort: ergebnis.antwort });
      this.zustand.auftraegeErledigt++;
    }
    if (ausgefuehrt) this._spiegelSofort = true; // Änderungen (z. B. Ausverkauft) sofort zurückspiegeln
    // Merkstelle kurz halten
    const ids = Object.keys(merk.erledigt).map(Number).sort((x, y) => x - y);
    for (const id of ids.slice(0, Math.max(0, ids.length - 300))) delete merk.erledigt[id];
    schreibeAtomar(this.merkDatei, JSON.stringify(merk));
    this.zustand.letzterErfolg = new Date().toISOString();
    return { ok: true, mehr: zeilen.length === 300 || ausgefuehrt > 0 };
  }
}

module.exports = { StandBruecke, SPIEGEL, AUFTRAG_PFADE };
