// KC MarktKasse – Tablet-Kassen-Start (KS-01 „Einmal koppeln, dauerhaft gültig“)
//
// WARUM ES DIESE DATEI GIBT
// Bis November 2026 hat ein separates Skript (markttag-start.js, lag nur in der ZIP auf dem
// Stand-PC, nie im Repository) bei JEDEM Start neue Ports und neue Zugangsschlüssel für die
// Tablet-Kassen vergeben. Folge: jeden Morgen jedes Tablet neu scannen, und zwar vom Monitor,
// der im Nebenraum steht. Gleichzeitig startete der offizielle Startweg dieses Repositories
// (KC_Manager_Start.cmd -> run-manager-service.js) überhaupt keine Kassen-Dienste.
//
// WAS DIESE DATEI TUT – bei jedem Start des schwarzen Fensters:
//   1. Liest die Kassenliste aus markttag-kassen.json (z. B. ["KASSE-01","KASSE-02"]).
//   2. Gibt jeder Kasse einen FESTEN Port (KASSE-01 -> 47500, KASSE-02 -> 47501 ...). Die Zuordnung
//      wird gespeichert – auch wenn die Liste später umsortiert wird, behält jede Kasse ihren Port.
//   3. Jede Kasse hat eine eigene Datenbank in einem Datenordner AUSSERHALB des Programmordners
//      (Windows: %LOCALAPPDATA%\KC-MarktKasse\tablet-kassen). Der Zugangsschlüssel des Tablets
//      liegt darin und bleibt über Neustarts UND über Programm-Updates (neue ZIP) gleich.
//   4. Koppelt jede Kasse mit dem Manager – aber nur, wenn nötig (noch nie gekoppelt, anderer
//      Manager, Kopplung zurückgezogen oder läuft in weniger als 7 Tagen ab). Der Schlüssel des
//      Tablets ist davon unabhängig: eine Neukopplung im Hintergrund erfordert KEIN Neuscannen.
//   5. Startet je Kasse den Kassen-Dienst (run-device-companion.js) als eigenen Prozess, bewacht
//      ihn und startet ihn nach einem Absturz selbst neu.
//   6. Ermittelt die WLAN-Adresse des PCs. Gibt es gedruckte QR-Zettel, wird deren Adresse
//      bevorzugt; passt sie nicht mehr, steht das unübersehbar im schwarzen Fenster.
//   7. Schreibt pc-manager/kassen-verbindungen.json (nur am PC selbst abrufbar, siehe
//      serve-frontend.js) für PC-Manager, Verbindungsprüfung und die QR-Zettel-Seite.
//
// Die QR-Adresse eines Tablets ist damit dauerhaft dieselbe – solange der PC im Router immer
// dieselbe Adresse bekommt (DHCP-Reservierung, siehe TABLET_UND_MANAGER_KOPPELN.md).
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { DeviceCompanion } = require('./device-companion');
const { meldung, erklaere, alsEinzeiler, druckeKasten, SCHRITT_BETREUER } = require('./fehlerhilfe');
const { sicherePortFrei, belegtFehler } = require('./port-freigabe');

const ERSTER_KASSEN_PORT = 47500;
const ERNEUERN_WENN_RESTTAGE_UNTER = 7;
const ID_MUSTER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/;
const ZUSTANDS_FORMAT = 1;
const VIRTUELLE_ADAPTER = /(vethernet|virtualbox|vmware|vmnet|hyper-v|wsl|docker|loopback|bluetooth|tailscale|zerotier|wireguard|openvpn|vpn|\btap\b|\btun\b|utun)/i;

function standardDatenOrdner() {
  if (process.env.KC_KASSEN_DATEN) return path.resolve(process.env.KC_KASSEN_DATEN);
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, 'KC-MarktKasse', 'tablet-kassen');
  }
  return path.join(os.homedir(), '.kc-marktkasse', 'tablet-kassen');
}

// Erlaubte Formen von markttag-kassen.json:
//   ["KASSE-01", "KASSE-02"]
//   [{"id":"KASSE-01","name":"Kasse 1"}, ...]
//   {"kassen": [...], "pcAdresse": "192.168.178.20"}   (pcAdresse optional, erzwingt die Adresse)
function konfigFehler(text) {
  const e = new Error(text);
  e.kcMeldung = meldung('konfig', 'Kassenliste markttag-kassen.json ist fehlerhaft – Tablet-Kassen starten nicht', text,
    ['Die Datei markt-kasse-suite\\backend-source\\markttag-kassen.json mit dem Editor öffnen und korrigieren. Richtig ist z. B.: ["KASSE-01", "KASSE-02", "KASSE-03"]',
      'Oder die Datei aus der Original-ZIP zurückkopieren.', 'Dann das Fenster schließen und neu starten.']);
  return e;
}

function leseKassenKonfig(datei) {
  if (!fs.existsSync(datei)) return { kassen: [], pcAdresse: null, quelle: null };
  let roh;
  try { roh = JSON.parse(fs.readFileSync(datei, 'utf8').replace(/^﻿/, '')); }
  catch (e) { throw konfigFehler(`${path.basename(datei)} ist kein gültiges JSON (${e.message}). Beispiel: ["KASSE-01", "KASSE-02"]`); }
  const liste = Array.isArray(roh) ? roh : (roh && Array.isArray(roh.kassen) ? roh.kassen : null);
  if (!liste) throw konfigFehler(`${path.basename(datei)}: erwartet wird eine Liste, z. B. ["KASSE-01", "KASSE-02"]`);
  const gesehen = new Set();
  const kassen = liste.map((eintrag, i) => {
    const id = String(typeof eintrag === 'string' ? eintrag : eintrag && eintrag.id || '').trim();
    if (!ID_MUSTER.test(id)) throw konfigFehler(`${path.basename(datei)}, Eintrag ${i + 1}: „${id}“ ist keine gültige Kassen-ID (erlaubt: Buchstaben, Ziffern, - und _, höchstens 32 Zeichen).`);
    const schluessel = id.toUpperCase();
    if (gesehen.has(schluessel)) throw konfigFehler(`${path.basename(datei)}: Kasse „${id}“ steht doppelt in der Liste.`);
    gesehen.add(schluessel);
    const name = typeof eintrag === 'object' && eintrag && eintrag.name ? String(eintrag.name).slice(0, 60) : null;
    return { id, name };
  });
  const pcAdresse = !Array.isArray(roh) && roh && roh.pcAdresse ? String(roh.pcAdresse).trim() : null;
  if (pcAdresse && !/^\d{1,3}(\.\d{1,3}){3}$/.test(pcAdresse)) throw konfigFehler(`${path.basename(datei)}: pcAdresse „${pcAdresse}“ ist keine IPv4-Adresse.`);
  return { kassen, pcAdresse, quelle: datei };
}

function istPrivat(adresse) {
  const [a, b] = adresse.split('.').map(Number);
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

function lanAdressen(netze = os.networkInterfaces()) {
  const aus = [];
  for (const [name, liste] of Object.entries(netze || {})) {
    for (const e of liste || []) {
      if (e && (e.family === 'IPv4' || e.family === 4) && !e.internal && !String(e.address).startsWith('169.254.')) {
        aus.push({ name, adresse: e.address, virtuell: VIRTUELLE_ADAPTER.test(name), privat: istPrivat(e.address) });
      }
    }
  }
  return aus;
}

// Wählt die Adresse, unter der die Tablets den PC erreichen.
// Reihenfolge: fest eingestellt (pcAdresse) > Adresse der gedruckten Zettel > bestes Heimnetz.
function waehleLanAdresse({ fest = null, zettelAdresse = null, netze } = {}) {
  const alle = lanAdressen(netze);
  const vorhanden = (a) => alle.some((x) => x.adresse === a);
  const mit = (m) => ({ meldung: m, warnung: m ? alsEinzeiler(m) : null });
  if (fest) {
    return { adresse: fest, grund: 'fest eingestellt (markttag-kassen.json)', alle, ...mit(vorhanden(fest) ? null : meldung('adresse-fest',
      `Die fest eingestellte PC-Adresse ${fest} gehört zu keiner Netzwerkkarte dieses PCs – Tablets erreichen den PC so nicht`,
      `In markttag-kassen.json steht „pcAdresse“: ${fest}. Der PC hat aber ${alle.map((a) => a.adresse).join(', ') || 'gar keine Netzwerkadresse'}.`,
      [`Im Router dem PC die Adresse ${fest} fest zuweisen (DHCP-Reservierung), dann Fenster neu starten.`,
        'Oder in markttag-kassen.json die Angabe „pcAdresse“ korrigieren bzw. entfernen, dann Fenster neu starten.'])) };
  }
  if (zettelAdresse && vorhanden(zettelAdresse)) return { adresse: zettelAdresse, grund: 'Adresse der gedruckten QR-Zettel', alle, ...mit(null) };
  const rang = (x) => (x.privat ? 2 : 0) + (x.virtuell ? 0 : 1);
  const beste = [...alle].sort((x, y) => rang(y) - rang(x))[0] || null;
  let m = null;
  if (!beste) m = meldung('adresse-keine', 'Keine WLAN-/Netzwerkadresse gefunden – Tablets können nicht verbinden',
    'Der PC ist mit keinem Netzwerk verbunden (WLAN aus, Router aus oder Kabel ab).',
    ['PC mit dem Stand-WLAN verbinden (oder per Kabel mit dem Router) und prüfen, dass der Router läuft.', 'Dann das Fenster schließen und neu starten.']);
  else if (zettelAdresse) m = meldung('adresse-geaendert',
    `PC-ADRESSE HAT SICH GEÄNDERT: die gedruckten QR-Zettel zeigen auf ${zettelAdresse}, der PC hat jetzt ${beste.adresse}`,
    'Der Router hat dem PC nach dem Einschalten eine andere Adresse gegeben. Die Tablets finden den PC so nicht.',
    [`Am besten: im Router dem PC wieder die Adresse ${zettelAdresse} geben und „immer die gleiche IPv4-Adresse zuweisen“ anhaken (DHCP-Reservierung). Dann Fenster neu starten – die Zettel gelten wieder.`,
      'Oder: im PC-Manager → Verbindung prüfen → „QR-Zettel drucken / prüfen“ alle Zettel neu drucken und alle Tablets einmal neu scannen.']);
  return { adresse: beste ? beste.adresse : null, grund: beste ? `Netzwerkkarte „${beste.name}“` : 'keine', alle, ...mit(m) };
}

function sha256(text) { return crypto.createHash('sha256').update(String(text)).digest('hex'); }

function schreibeAtomar(datei, inhalt) {
  fs.mkdirSync(path.dirname(datei), { recursive: true });
  const tmp = `${datei}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, inhalt, { mode: 0o600 });
  fs.renameSync(tmp, datei);
}

function holeStatus(port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/kc-sync-status', timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}

function warte(ms) { return new Promise((r) => setTimeout(r, ms)); }

function portFrei(port) {
  return new Promise((resolve) => {
    const s = require('net').createServer();
    s.once('error', () => resolve(false));
    s.listen(port, '0.0.0.0', () => s.close(() => resolve(true)));
  });
}

class TabletKassenStart {
  constructor({ manager, backendDir = __dirname, frontendRoot, nodeExe = process.execPath, datenOrdner = standardDatenOrdner(),
    konfigDatei = path.join(__dirname, 'markttag-kassen.json'), log = console.log, fehlerLog = console.error,
    netze = undefined, dienstSkript = null } = {}) {
    if (!manager || !manager.identity || !manager.port) throw new Error('TabletKassenStart braucht einen gestarteten Manager.');
    this.manager = manager;
    this.backendDir = backendDir;
    this.frontendRoot = frontendRoot;
    this.nodeExe = nodeExe;
    this.datenOrdner = datenOrdner;
    this.konfigDatei = konfigDatei;
    this.log = log;
    this.fehlerLog = fehlerLog;
    this.netze = netze;
    this.dienstSkript = dienstSkript || path.join(backendDir, 'run-device-companion.js');
    this.kassen = [];
    this.meldungen = [];
    this.aktiv = false;
    this._stoppen = false;
    this.zustandsDatei = path.join(datenOrdner, 'kassen-start.json');
    this.verbindungsDatei = frontendRoot ? path.join(frontendRoot, 'pc-manager', 'kassen-verbindungen.json') : null;
  }

  get warnungen() { return this.meldungen.map(alsEinzeiler); }
  _melde(m, { drucken = false } = {}) {
    this.meldungen = this.meldungen.filter((x) => x.schluessel !== m.schluessel);
    this.meldungen.push(m);
    if (drucken) druckeKasten(this.fehlerLog, [m]);
  }
  _entferne(schluessel) { this.meldungen = this.meldungen.filter((x) => x.schluessel !== schluessel); }

  _ladeZustand() {
    try {
      const z = JSON.parse(fs.readFileSync(this.zustandsDatei, 'utf8'));
      if (z && typeof z.kassen === 'object') return z;
    } catch (e) { /* noch kein Zustand – erster Start */ }
    return { format: ZUSTANDS_FORMAT, kassen: {} };
  }

  _speichereZustand() {
    const kassen = { ...(this.zustand.kassen || {}) };
    for (const k of this.kassen) kassen[k.id] = { port: k.port, zettel: k.zettel || null };
    this.zustand = { format: ZUSTANDS_FORMAT, kassen, aktualisiertAm: new Date().toISOString() };
    schreibeAtomar(this.zustandsDatei, JSON.stringify(this.zustand, null, 2));
  }

  async start({ webserverPort }) {
    this.webserverPort = webserverPort;
    this.gestartetUm = new Date().toISOString();
    const konfig = leseKassenKonfig(this.konfigDatei);
    this.konfig = konfig;
    if (!konfig.kassen.length) {
      this.aktiv = false;
      this.log('[Kassen-Start] Keine Tablet-Kassen eingetragen (markttag-kassen.json fehlt oder ist leer).');
      this._schreibeVerbindungsdatei();
      return this.status();
    }
    try { fs.mkdirSync(this.datenOrdner, { recursive: true }); fs.accessSync(this.datenOrdner, fs.constants.W_OK); }
    catch (e) { e.kcMeldung = erklaere(e, { was: 'Datenordner der Tablet-Kassen anlegen', pfad: this.datenOrdner }); throw e; }
    // Endet der Hauptprozess unerwartet, duerfen keine verwaisten Kassen-Dienste die festen
    // Ports blockieren - sonst scheitert der naechste Start mit "Port belegt".
    process.once('exit', () => { for (const k of this.kassen) { try { k.prozess && k.prozess.kill(); } catch (e) { /* schon weg */ } } });
    this.zustand = this._ladeZustand();
    this.log(`[Kassen-Start] Datenordner der Tablet-Kassen: ${this.datenOrdner}`);

    // Feste Ports: einmal vergeben, für immer gespeichert.
    const vergeben = new Set(Object.values(this.zustand.kassen).map((z) => z && z.port).filter(Boolean));
    let naechster = ERSTER_KASSEN_PORT;
    this.kassen = konfig.kassen.map((k) => {
      const alt = this.zustand.kassen[k.id];
      let port = alt && alt.port;
      if (!port) {
        while (vergeben.has(naechster)) naechster++;
        port = naechster;
        vergeben.add(port);
      }
      const dateiname = k.id.replace(/[^A-Za-z0-9_-]/g, '_') + '.sqlite';
      return { id: k.id, name: k.name, port, dbPfad: path.join(this.datenOrdner, dateiname),
        zettel: alt && alt.zettel || null, prozess: null, neustarts: 0, dienst: 'gestoppt', kopplung: null };
    });

    for (const k of this.kassen) {
      // Jede Kasse fuer sich: scheitert eine, starten die anderen trotzdem.
      try {
        const ergebnis = await this._kopplungSicherstellen(k);
        k.kopplung = ergebnis;
        this.log(`[Kassen-Start] ${k.id}: ${ergebnis.neu ? `neu gekoppelt (${ergebnis.grund})` : 'bereits gekoppelt'} · Port ${k.port}`);
      } catch (e) {
        k.kopplung = { neu: false, grund: 'FEHLGESCHLAGEN' };
        this._melde(erklaere(e, { kasse: k.id, was: 'Kopplung mit dem Manager' }));
        this.fehlerLog(`[Kassen-Start] ${k.id}: Kopplung FEHLGESCHLAGEN – Details im Kasten unten.`);
      }
    }

    const zettelAdressen = [...new Set(this.kassen.map((k) => k.zettel && k.zettel.adresse).filter(Boolean))];
    const wahl = waehleLanAdresse({ fest: konfig.pcAdresse, zettelAdresse: zettelAdressen[0] || null, netze: this.netze });
    this.adressWahl = wahl;
    this.lanAdresse = wahl.adresse;
    if (wahl.meldung) this._melde(wahl.meldung);

    for (const k of this.kassen) {
      if (!k.token) continue; // Datenbank der Kasse nicht lesbar - Meldung steht schon da
      try {
        await this._starteDienst(k);
      } catch (e) {
        this._dienstGescheitert(k, e);
        this.fehlerLog(`[Kassen-Start] ${k.id}: Kassen-Dienst startet nicht – Details im Kasten unten. Neuer Versuch alle 30 s.`);
      }
    }
    this._meldeGesperrte();
    this.aktiv = true;
    this._pruefeZettel();
    this._speichereZustand();
    this._schreibeVerbindungsdatei();
    this._sperrWaechter = setInterval(() => { this._pruefeSperren().catch((e) => this._melde(erklaere(e, { was: 'Prüfung „Gerät verloren“' }), { drucken: true })); }, 5000);
    if (this._sperrWaechter.unref) this._sperrWaechter.unref();
    return this.status();
  }

  _meldeGesperrte() {
    for (const k of this.kassen) {
      if (!k.gesperrtGemeldet) continue;
      this._melde(meldung(`verloren-${k.id}`, `${k.id} wurde als VERLOREN gesperrt – der alte QR-Zettel gilt nicht mehr`,
        'Im Admin-Center wurde „Gerät verloren“ gewählt. Das verlorene Tablet ist ausgesperrt; die anderen Kassen arbeiten normal weiter.',
        [`PC-Manager → Verbindung prüfen → „QR-Zettel drucken / prüfen“: den Zettel für ${k.id} drucken.`,
          'Ein Ersatz-Tablet damit einmal scannen (Kamera, Link öffnen, „Zum Home-Bildschirm“).']), { drucken: this.aktiv });
    }
  }

  // Waehrend des Betriebs: wurde eine Kasse im Admin-Center als verloren gemeldet, wird ihr
  // Tablet-Schluessel SOFORT ersetzt (nicht erst beim naechsten Start) und die Kasse neu gekoppelt.
  async _pruefeSperren() {
    if (this._stoppen || this._sperrPruefungLaeuft) return;
    this._sperrPruefungLaeuft = true;
    try {
      for (const k of this.kassen) {
        if (!k.credentialId || k._absichtlich) continue;
        const zeile = this.manager.db.prepare('SELECT revoked FROM credentials WHERE credential_id = ?').get(k.credentialId);
        if (!zeile || !zeile.revoked) continue;
        k._absichtlich = true;
        // Der Kassen-Dienst loescht nach dem Widerruf evtl. selbst seine Kopplung - deshalb hier
        // ausdruecklich vermerken, dass der Tablet-Schluessel zu ersetzen ist.
        k._schluesselErsetzen = true;
        this.log(`[Kassen-Start] ${k.id}: Kopplung wurde widerrufen (Gerät verloren) – neuer Tablet-Schlüssel wird vergeben.`);
        try {
          await this._stoppeDienst(k);
          k.kopplung = await this._kopplungSicherstellen(k);
          await this._starteDienst(k);
        } finally { k._absichtlich = false; }
        this._meldeGesperrte();
        this._pruefeZettel();
        this._speichereZustand();
        this._schreibeVerbindungsdatei();
      }
    } finally { this._sperrPruefungLaeuft = false; }
  }

  async _kopplungSicherstellen(k) {
    const m = this.manager;
    const dev = new DeviceCompanion({ dbPath: k.dbPfad });
    try {
      const p = dev.pinned;
      let grund = null;
      if (!p.credentialId) grund = 'noch nie gekoppelt';
      else if (p.managerId !== m.identity.managerId || p.fingerprint !== m.identity.fingerprint) grund = 'anderer Manager, z. B. neu installiert';
      else {
        const zeile = m.db.prepare('SELECT revoked, expires_at FROM credentials WHERE credential_id = ?').get(String(p.credentialId).split('.')[0]);
        if (!zeile) grund = 'Kopplung im Manager unbekannt';
        else if (zeile.revoked) grund = 'Kopplung war zurückgezogen';
        else if (new Date(zeile.expires_at).getTime() - Date.now() < ERNEUERN_WENN_RESTTAGE_UNTER * 86400000) grund = 'Kopplung lief bald ab – erneuert';
      }
      // Zuerst den Tablet-Schluessel sichern - auch wenn die Kopplung gleich scheitert, soll das
      // Tablet seine Kasse erreichen und offline weiter kassieren koennen.
      if (grund === 'Kopplung war zurückgezogen' || k._schluesselErsetzen) {
        dev.db.prepare('UPDATE device_identity SET kasse_access_token = NULL WHERE id = 1').run();
        k.zettel = null;
        k._schluesselErsetzen = false;
        k.gesperrtGemeldet = true;
      }
      k.token = dev.kasseAccessToken;
      k.geraet = dev.deviceInstanceId;
      if (grund) {
        await dev.pair({ pairingToken: m.issuePairingToken(), expectedFingerprint: m.identity.fingerprint,
          host: '127.0.0.1', port: m.port, registerLabel: k.id });
        const neu = String(dev.pinned.credentialId).split('.')[0];
        const alte = m.db.prepare('SELECT credential_id FROM credentials WHERE device_instance_id = ? AND credential_id <> ? AND revoked = 0')
          .all(dev.deviceInstanceId, neu);
        for (const a of alte) {
          m.db.prepare('UPDATE credentials SET revoked = 1 WHERE credential_id = ?').run(a.credential_id);
          try { m._writeAuditLog('revoke', dev.deviceInstanceId, 'kassen-start', 'ersetzt_durch_neue_kopplung'); } catch (e) { /* Protokoll ist Zusatz */ }
        }
      }
      // (Tablet-Schluessel: oben gesichert, einmal erzeugt, danach dauerhaft gleich.
      //  Im Admin-Center als VERLOREN gesperrt -> oben ersetzt, sonst kassierte das verlorene Tablet weiter.)
      k.credentialId = String(dev.pinned.credentialId).split('.')[0];
      return { neu: !!grund, grund: grund || null };
    } finally {
      try { dev.stopLocalStatusServer(); } catch (e) { /* nie gestartet */ }
      dev.db.close();
    }
  }

  // Startet den Kassen-Dienst einer Kasse. Fehler kommen als eindeutige Ursache zurück
  // (Port belegt / beendet / antwortet nicht) - nie als blosses "Zeitüberschreitung".
  async _starteDienst(k) {
    // Port vorher pruefen: belegt ihn ein altes Kassenfenster, wird es beendet; ein fremdes
    // Programm wird nur benannt (nie beendet).
    const pf = await sicherePortFrei(k.port, { log: this.log, wofuer: k.id });
    if (!pf.frei) throw belegtFehler(k.port, pf);
    return this._spawneDienst(k);
  }

  _spawneDienst(k) {
    return new Promise((resolve, reject) => {
      let ausgabe = '';
      let fertig = false;
      const kind = spawn(this.nodeExe, [this.dienstSkript, '--db', k.dbPfad, '--status-port', String(k.port), '--bind', '0.0.0.0'], {
        cwd: this.backendDir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
        env: { ...process.env, KC_KASSE_ID: k.id },
      });
      k.prozess = kind;
      k.dienst = 'startet';
      const scheitern = (fehler) => {
        if (fertig) return;
        fertig = true;
        kind._keinNeustart = true; // gescheiterter Start: kein Waechter-Neustart, sondern geplanter Neuversuch
        try { kind.kill(); } catch (e) { /* schon weg */ }
        reject(fehler);
      };
      const zeilen = (strom, ziel) => {
        let rest = '';
        strom.on('data', (d) => {
          const text = rest + d.toString();
          const teile = text.split(/\r?\n/);
          rest = teile.pop();
          for (const z of teile) {
            if (!z.trim()) continue;
            ausgabe = (ausgabe + '\n' + z).slice(-800);
            ziel(`[${k.id}] ${z}`);
            // Der Dienst meldet selbst, dass sein Port belegt ist -> sofort mit genau dieser Ursache.
            if (/kc_sync_status_port_in_use/.test(z)) scheitern(Object.assign(new Error(`Port ${k.port} ist bereits belegt`), { code: 'EADDRINUSE', port: k.port }));
          }
        });
      };
      zeilen(kind.stdout, this.log);
      zeilen(kind.stderr, this.fehlerLog);
      kind.on('error', (e) => scheitern(e)); // z. B. node.exe nicht ausführbar
      kind.on('exit', (code, signal) => {
        if (k.prozess === kind) { k.prozess = null; k.dienst = 'gestoppt'; }
        if (!fertig) { scheitern(new Error(`Kassen-Dienst hat sich beim Start beendet (Code ${code}${signal ? ', ' + signal : ''}). ${ausgabe.trim().split('\n').pop() || ''}`.trim())); return; }
        if (this._stoppen || k._absichtlich || kind._keinNeustart) return;
        // Wächter: unerwarteter Absturz -> nach kurzer Pause selbst wieder starten.
        k.neustarts += 1;
        const pause = Math.min(30000, 2000 * k.neustarts);
        this.fehlerLog(`[Kassen-Start] ${k.id}: Kassen-Dienst unerwartet beendet (Code ${code}). Wird in ${Math.round(pause / 1000)} s automatisch neu gestartet.`);
        if (k.neustarts >= 3) {
          this._melde(meldung(`absturz-${k.id}`, `${k.id}: Kassen-Dienst stürzt wiederholt ab (${k.neustarts}×)`,
            'Der Dienst wird jedes Mal automatisch neu gestartet, beendet sich aber immer wieder. Das Tablet kassiert solange offline weiter; die Bons werden nachgereicht, sobald der Dienst läuft.',
            ['Das schwarze Fenster schließen und neu starten.', 'Meldet der Virenscanner etwas: „node.exe“ zulassen.', SCHRITT_BETREUER],
            `letzte Ausgabe: ${ausgabe.trim().split('\n').pop() || '–'}`), { drucken: true });
          this._schreibeVerbindungsdatei();
        }
        setTimeout(() => {
          if (this._stoppen || k._absichtlich || k.prozess) return;
          this._starteDienst(k).then(() => this._schreibeVerbindungsdatei())
            .catch((e) => this._dienstGescheitert(k, e, 'Kassen-Dienst neu starten'));
        }, pause).unref?.();
      });
      // Bereit, sobald der Status-Endpunkt antwortet.
      const ende = Date.now() + 20000;
      const pruefe = async () => {
        if (fertig) return;
        if (await holeStatus(k.port)) { fertig = true; k.dienst = 'laeuft'; resolve(); return; }
        if (Date.now() > ende) { scheitern(new Error('Kassen-Dienst antwortet nach 20 s nicht')); return; }
        setTimeout(pruefe, 250);
      };
      setTimeout(pruefe, 200);
    });
  }

  // Start eines Kassen-Dienstes gescheitert: Meldung mit Lösung - und alle 30 s ein stiller
  // Neuversuch. Wird z. B. das alte Fenster geschlossen, läuft die Kasse von selbst an und die
  // Meldung verschwindet wieder.
  _dienstGescheitert(k, fehler, was = 'Kassen-Dienst starten') {
    this._melde({ ...erklaere(fehler, { kasse: k.id, was, port: k.port }), schluessel: `dienst-${k.id}` }, { drucken: this.aktiv });
    this._schreibeVerbindungsdatei();
    if (k._neuversuch || this._stoppen) return;
    k._neuversuch = setTimeout(async () => {
      k._neuversuch = null;
      if (this._stoppen || k.prozess || k._absichtlich) return;
      try {
        await this._starteDienst(k);
        this._entferne(`dienst-${k.id}`);
        this.log(`[Kassen-Start] ${k.id}: Kassen-Dienst läuft jetzt – das Problem hat sich erledigt.`);
        this._schreibeVerbindungsdatei();
      } catch (e) { this._dienstGescheitert(k, e, was); }
    }, 30000);
    if (k._neuversuch.unref) k._neuversuch.unref();
  }

  _stoppeDienst(k) {
    const kind = k.prozess;
    if (!kind) return Promise.resolve();
    return new Promise((resolve) => {
      const t = setTimeout(() => { try { kind.kill('SIGKILL'); } catch (e) { /* weg */ } resolve(); }, 5000);
      kind.once('exit', () => { clearTimeout(t); resolve(); });
      try { kind.kill('SIGTERM'); } catch (e) { clearTimeout(t); resolve(); }
    });
  }

  qrAdresse(k) {
    if (!this.lanAdresse || !this.webserverPort || !k.token) return null;
    return `http://${this.lanAdresse}:${this.webserverPort}/pos/index.html?kcPort=${k.port}`
      + `&kcToken=${encodeURIComponent(k.token)}&kcRegisterId=${encodeURIComponent(k.id)}`;
  }

  _pruefeZettel() {
    for (const k of this.kassen) {
      const url = this.qrAdresse(k);
      if (!k.zettel) k.zettelStatus = 'nicht_gedruckt';
      else k.zettelStatus = url && sha256(url) === k.zettel.hash && k.zettel.adresse === this.lanAdresse
        && Number(k.zettel.webserverPort) === Number(this.webserverPort) ? 'gueltig' : 'veraltet';
    }
    const veraltet = this.kassen.filter((k) => k.zettelStatus === 'veraltet').map((k) => k.id);
    this._entferne('zettel-veraltet');
    if (veraltet.length && !this.meldungen.some((m) => m.schluessel === 'adresse-geaendert')) {
      this._melde(meldung('zettel-veraltet', `QR-Zettel passen nicht mehr zu: ${veraltet.join(', ')}`,
        'Seit dem Druck hat sich die PC-Adresse, der Webserver-Port oder der Schlüssel dieser Kasse geändert.',
        ['PC-Manager → Verbindung prüfen → „QR-Zettel drucken / prüfen“: die betroffenen Zettel neu drucken.',
          'Die Tablets dieser Kassen mit dem neuen Zettel einmal neu scannen.']));
    }
  }

  // Vom PC-Manager aus: Zettel wurde gedruckt -> diesen Stand merken.
  zettelGedruckt(ids) {
    const liste = Array.isArray(ids) ? ids.map(String) : [];
    const jetzt = new Date().toISOString();
    for (const k of this.kassen) {
      if (!liste.includes(k.id)) continue;
      const url = this.qrAdresse(k);
      if (!url) continue;
      k.zettel = { hash: sha256(url), adresse: this.lanAdresse, webserverPort: this.webserverPort, gedrucktAm: jetzt };
      if (k.gesperrtGemeldet) {
        k.gesperrtGemeldet = false;
        this._entferne(`verloren-${k.id}`);
      }
    }
    this._pruefeZettel();
    this._speichereZustand();
    this._schreibeVerbindungsdatei();
    return this.status();
  }

  // Vom PC-Manager aus: Zettel verloren -> alter Schlüssel sofort ungültig, neuer Zettel nötig.
  async neuerSchluessel(id) {
    const k = this.kassen.find((x) => x.id === String(id));
    if (!k) throw new Error('kasse_unbekannt');
    k._absichtlich = true;
    try {
      await this._stoppeDienst(k);
      const dev = new DeviceCompanion({ dbPath: k.dbPfad });
      try {
        dev.db.prepare('UPDATE device_identity SET kasse_access_token = NULL WHERE id = 1').run();
        k.token = dev.kasseAccessToken;
      } finally { dev.db.close(); }
      k.zettel = null;
      // Ab hier gilt der neue Schluessel. Startet der Dienst nicht, wird das gemeldet - aber nicht
      // als "fehlgeschlagen" zurueckgegeben, sonst glaubte man, der alte Zettel gelte noch.
      try { await this._starteDienst(k); this._entferne(`dienst-${k.id}`); }
      catch (e) { this._dienstGescheitert(k, e, 'Kassen-Dienst nach neuem Schlüssel starten'); }
    } finally { k._absichtlich = false; }
    this.log(`[Kassen-Start] ${k.id}: neuer Zugangsschlüssel – alter QR-Zettel ist ab sofort ungültig.`);
    this._pruefeZettel();
    this._speichereZustand();
    this._schreibeVerbindungsdatei();
    return this.status();
  }

  status({ mitSchluessel = true } = {}) {
    return {
      format: 2,
      aktiv: this.aktiv,
      erzeugtAm: new Date().toISOString(),
      gestartetUm: this.gestartetUm || null,
      webserverPort: this.webserverPort || null,
      lanAdresse: this.lanAdresse || null,
      adressGrund: this.adressWahl ? this.adressWahl.grund : null,
      alleAdressen: this.adressWahl ? this.adressWahl.alle.map((a) => `${a.adresse} (${a.name})`) : [],
      datenOrdner: this.datenOrdner,
      warnungen: this.warnungen,
      meldungen: this.meldungen.map((m) => ({ ...m, loesung: [...m.loesung] })),
      liveKanal: { laeuft: !this.manager.liveMonitorFehler, fehler: this.manager.liveMonitorFehler || null, gestartetUm: this.gestartetUm || null },
      kassen: this.kassen.map((k) => ({
        id: k.id,
        name: k.name || k.id,
        port: k.port,
        host: this.lanAdresse || null,
        ...(mitSchluessel ? { token: k.token, qrAdresse: this.qrAdresse(k) } : {}),
        dienst: k.dienst,
        pid: k.prozess ? k.prozess.pid : null,
        neustarts: k.neustarts,
        kopplung: k.kopplung,
        zettel: k.zettelStatus || 'nicht_gedruckt',
        zettelGedrucktAm: k.zettel ? k.zettel.gedrucktAm : null,
      })),
    };
  }

  _schreibeVerbindungsdatei() {
    if (!this.verbindungsDatei) return;
    try {
      const s = this.status();
      // Kompatibel zu allen bisherigen Lesern: { erzeugtAm, webserverPort, lanAdresse, liveKanal, kassen:[{id,name,port,token,host}] }
      schreibeAtomar(this.verbindungsDatei, JSON.stringify(s, null, 2));
    } catch (e) {
      this._melde(erklaere(e, { was: 'Verbindungsdatei für den PC-Manager schreiben', pfad: this.verbindungsDatei }), { drucken: !this._dateiFehlerGemeldet });
      this._dateiFehlerGemeldet = true;
    }
  }

  async stop() {
    this._stoppen = true;
    if (this._sperrWaechter) clearInterval(this._sperrWaechter);
    for (const k of this.kassen) if (k._neuversuch) clearTimeout(k._neuversuch);
    await Promise.all(this.kassen.map((k) => this._stoppeDienst(k)));
  }
}

// Der Webserver-Port steht in jedem QR-Zettel. Er wird deshalb aus den gedruckten Zetteln
// übernommen (Standard 8090) und darf nicht stillschweigend wandern.
function zettelWebserverPort(datenOrdner = standardDatenOrdner()) {
  try {
    const z = JSON.parse(fs.readFileSync(path.join(datenOrdner, 'kassen-start.json'), 'utf8'));
    const ports = Object.values(z.kassen || {}).map((k) => k && k.zettel && Number(k.zettel.webserverPort)).filter(Boolean);
    return ports[0] || null;
  } catch (e) { return null; }
}

module.exports = { TabletKassenStart, leseKassenKonfig, waehleLanAdresse, lanAdressen, standardDatenOrdner, zettelWebserverPort, ERSTER_KASSEN_PORT };
