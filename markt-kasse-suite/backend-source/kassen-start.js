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
function leseKassenKonfig(datei) {
  if (!fs.existsSync(datei)) return { kassen: [], pcAdresse: null, quelle: null };
  let roh;
  try { roh = JSON.parse(fs.readFileSync(datei, 'utf8').replace(/^﻿/, '')); }
  catch (e) { throw new Error(`${path.basename(datei)} ist kein gültiges JSON (${e.message}). Beispiel: ["KASSE-01", "KASSE-02"]`); }
  const liste = Array.isArray(roh) ? roh : (roh && Array.isArray(roh.kassen) ? roh.kassen : null);
  if (!liste) throw new Error(`${path.basename(datei)}: erwartet wird eine Liste, z. B. ["KASSE-01", "KASSE-02"]`);
  const gesehen = new Set();
  const kassen = liste.map((eintrag, i) => {
    const id = String(typeof eintrag === 'string' ? eintrag : eintrag && eintrag.id || '').trim();
    if (!ID_MUSTER.test(id)) throw new Error(`${path.basename(datei)}, Eintrag ${i + 1}: „${id}“ ist keine gültige Kassen-ID (erlaubt: Buchstaben, Ziffern, - und _, höchstens 32 Zeichen).`);
    const schluessel = id.toUpperCase();
    if (gesehen.has(schluessel)) throw new Error(`${path.basename(datei)}: Kasse „${id}“ steht doppelt in der Liste.`);
    gesehen.add(schluessel);
    const name = typeof eintrag === 'object' && eintrag && eintrag.name ? String(eintrag.name).slice(0, 60) : null;
    return { id, name };
  });
  const pcAdresse = !Array.isArray(roh) && roh && roh.pcAdresse ? String(roh.pcAdresse).trim() : null;
  if (pcAdresse && !/^\d{1,3}(\.\d{1,3}){3}$/.test(pcAdresse)) throw new Error(`${path.basename(datei)}: pcAdresse „${pcAdresse}“ ist keine IPv4-Adresse.`);
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
  if (fest) {
    return { adresse: fest, grund: 'fest eingestellt (markttag-kassen.json)', alle,
      warnung: vorhanden(fest) ? null : `Die fest eingestellte PC-Adresse ${fest} gehört zu keiner Netzwerkkarte dieses PCs. Tablets erreichen den PC so nicht.` };
  }
  if (zettelAdresse && vorhanden(zettelAdresse)) return { adresse: zettelAdresse, grund: 'Adresse der gedruckten QR-Zettel', alle, warnung: null };
  const rang = (x) => (x.privat ? 2 : 0) + (x.virtuell ? 0 : 1);
  const beste = [...alle].sort((x, y) => rang(y) - rang(x))[0] || null;
  let warnung = null;
  if (!beste) warnung = 'Keine WLAN-/Netzwerkadresse gefunden. Ist der PC mit dem Stand-WLAN verbunden? Tablets können so nicht verbinden.';
  else if (zettelAdresse) warnung = `PC-ADRESSE HAT SICH GEÄNDERT: die gedruckten QR-Zettel zeigen auf ${zettelAdresse}, der PC hat jetzt ${beste.adresse}. `
    + 'Im Router dem PC wieder die alte Adresse geben (DHCP-Reservierung) ODER im PC-Manager unter „Verbindung prüfen“ die QR-Zettel neu drucken und neu scannen.';
  return { adresse: beste ? beste.adresse : null, grund: beste ? `Netzwerkkarte „${beste.name}“` : 'keine', alle, warnung };
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
    this.warnungen = [];
    this.aktiv = false;
    this._stoppen = false;
    this.zustandsDatei = path.join(datenOrdner, 'kassen-start.json');
    this.verbindungsDatei = frontendRoot ? path.join(frontendRoot, 'pc-manager', 'kassen-verbindungen.json') : null;
  }

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
    fs.mkdirSync(this.datenOrdner, { recursive: true });
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
      const ergebnis = await this._kopplungSicherstellen(k);
      k.kopplung = ergebnis;
      this.log(`[Kassen-Start] ${k.id}: ${ergebnis.neu ? `neu gekoppelt (${ergebnis.grund})` : 'bereits gekoppelt'} · Port ${k.port}`);
    }

    const zettelAdressen = [...new Set(this.kassen.map((k) => k.zettel && k.zettel.adresse).filter(Boolean))];
    const wahl = waehleLanAdresse({ fest: konfig.pcAdresse, zettelAdresse: zettelAdressen[0] || null, netze: this.netze });
    this.adressWahl = wahl;
    this.lanAdresse = wahl.adresse;
    this.warnungen = [];
    if (wahl.warnung) this.warnungen.push(wahl.warnung);

    for (const k of this.kassen) {
      try {
        await this._starteDienst(k);
      } catch (e) {
        this.warnungen.push(`${k.id}: Kassen-Dienst startet nicht – ${e.message}`);
        this.fehlerLog(`[Kassen-Start] ${k.id}: Kassen-Dienst startet nicht – ${e.message}`);
      }
    }
    this.aktiv = true;
    this._pruefeZettel();
    this._meldeGesperrte();
    this._speichereZustand();
    this._schreibeVerbindungsdatei();
    this._sperrWaechter = setInterval(() => { this._pruefeSperren().catch((e) => this.fehlerLog(`[Kassen-Start] Sperr-Prüfung: ${e.message}`)); }, 5000);
    if (this._sperrWaechter.unref) this._sperrWaechter.unref();
    return this.status();
  }

  _meldeGesperrte() {
    for (const k of this.kassen) {
      if (!k.gesperrtGemeldet) continue;
      const text = `${k.id} wurde als VERLOREN gesperrt: der alte QR-Zettel gilt nicht mehr. Im PC-Manager den neuen Zettel für ${k.id} drucken und das Ersatz-Tablet damit koppeln.`;
      if (!this.warnungen.includes(text)) this.warnungen.push(text);
      this.fehlerLog(`[Kassen-Start] ${text}`);
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
      // Im Admin-Center als VERLOREN gesperrt (Kopplung widerrufen): dann darf auch der
      // Tablet-Schluessel nicht weiter gelten - sonst kassierte das verlorene Tablet weiter.
      if (grund === 'Kopplung war zurückgezogen' || k._schluesselErsetzen) {
        dev.db.prepare('UPDATE device_identity SET kasse_access_token = NULL WHERE id = 1').run();
        k.zettel = null;
        k._schluesselErsetzen = false;
        k.gesperrtGemeldet = true;
      }
      k.token = dev.kasseAccessToken; // einmal erzeugt, danach dauerhaft gleich
      k.geraet = dev.deviceInstanceId;
      k.credentialId = String(dev.pinned.credentialId).split('.')[0];
      return { neu: !!grund, grund: grund || null };
    } finally {
      try { dev.stopLocalStatusServer(); } catch (e) { /* nie gestartet */ }
      dev.db.close();
    }
  }

  _starteDienst(k) {
    return new Promise((resolve, reject) => {
      let ausgabe = '';
      let fertig = false;
      const kind = spawn(this.nodeExe, [this.dienstSkript, '--db', k.dbPfad, '--status-port', String(k.port), '--bind', '0.0.0.0'], {
        cwd: this.backendDir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
        env: { ...process.env, KC_KASSE_ID: k.id },
      });
      k.prozess = kind;
      k.dienst = 'startet';
      const zeilen = (strom, ziel) => {
        let rest = '';
        strom.on('data', (d) => {
          const text = rest + d.toString();
          const teile = text.split(/\r?\n/);
          rest = teile.pop();
          for (const z of teile) {
            if (!z.trim()) continue;
            if (!fertig) ausgabe = (ausgabe + '\n' + z).slice(-800);
            ziel(`[${k.id}] ${z}`);
          }
        });
      };
      zeilen(kind.stdout, this.log);
      zeilen(kind.stderr, this.fehlerLog);
      kind.on('exit', (code, signal) => {
        if (k.prozess === kind) { k.prozess = null; k.dienst = 'gestoppt'; }
        if (!fertig) { fertig = true; reject(new Error(`beendet (Code ${code}${signal ? ', ' + signal : ''}). ${ausgabe.trim().split('\n').pop() || ''}`.trim())); return; }
        if (this._stoppen || k._absichtlich) return;
        // Wächter: unerwarteter Absturz -> nach kurzer Pause selbst wieder starten.
        k.neustarts += 1;
        const pause = Math.min(30000, 2000 * k.neustarts);
        this.fehlerLog(`[Kassen-Start] ${k.id}: Kassen-Dienst unerwartet beendet (Code ${code}). Neustart in ${Math.round(pause / 1000)} s.`);
        setTimeout(() => {
          if (this._stoppen || k._absichtlich || k.prozess) return;
          this._starteDienst(k).then(() => this._schreibeVerbindungsdatei()).catch((e) => this.fehlerLog(`[Kassen-Start] ${k.id}: Neustart fehlgeschlagen – ${e.message}`));
        }, pause).unref?.();
      });
      // Bereit, sobald der Status-Endpunkt antwortet.
      const ende = Date.now() + 20000;
      const pruefe = async () => {
        if (fertig) return;
        if (await holeStatus(k.port)) {
          fertig = true; k.dienst = 'laeuft'; resolve(); return;
        }
        if (Date.now() > ende) { fertig = true; try { kind.kill(); } catch (e) { /* schon weg */ } reject(new Error('antwortet nach 20 s nicht')); return; }
        setTimeout(pruefe, 250);
      };
      setTimeout(pruefe, 200);
    });
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
    if (veraltet.length && !this.warnungen.some((w) => w.startsWith('PC-ADRESSE'))) {
      this.warnungen.push(`QR-Zettel passen nicht mehr zu: ${veraltet.join(', ')}. Im PC-Manager unter „Verbindung prüfen“ neu drucken und neu scannen.`);
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
        this.warnungen = this.warnungen.filter((w) => !w.startsWith(`${k.id} wurde als VERLOREN gesperrt`));
      }
    }
    this.warnungen = this.warnungen.filter((w) => !w.startsWith('QR-Zettel passen nicht mehr'));
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
      await this._starteDienst(k);
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
      warnungen: [...this.warnungen],
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
      this.fehlerLog(`[Kassen-Start] Verbindungsdatei konnte nicht geschrieben werden: ${e.message}`);
    }
  }

  async stop() {
    this._stoppen = true;
    if (this._sperrWaechter) clearInterval(this._sperrWaechter);
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
