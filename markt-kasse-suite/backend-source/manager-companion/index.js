// KC Sync Baustufe 2.2 – Manager-Companion (natives Programm, kein Browser-Tab, löst A-01).
// Serviert den API-Vertrag über echtes TLS, mit persistenter SQLite-Ablage (A-06) und echter
// mDNS/DNS-SD-Ankündigung (A-01) statt Browser-Netzwerkscan.
'use strict';
const https = require('https');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Bonjour } = require('bonjour-service');
const { openManagerDb } = require('./db');
const { loadOrCreateIdentity, renewCertificate } = require('./identity');
const { protectSecretFile } = require('./secure-file');

const gutscheinSignatur = require('./kc-gutschein-signatur.js');
const API_VERSION = '1.0';
const API_MAJOR = API_VERSION.split('.')[0];
// Befund N-07 (jetzt vollständig geschlossen, Vierter Nachprüfbericht MITTEL): eine fehlende
// Version wurde bisher stillschweigend wie die aktuelle Version behandelt und durchgelassen -
// das entwertete die Durchsetzung fast vollständig, da praktisch jede Anfrage ohne Versionsfeld
// unbemerkt akzeptiert wurde. Da es keine älteren, bereits im Feld befindlichen Clients gibt,
// die auf diese Nachsicht angewiesen wären, wird eine fehlende Version jetzt genauso behandelt
// wie eine erkennbar inkompatible: abgelehnt.
function isCompatibleVersion(requested) {
  if (requested === undefined || requested === null) return false;
  const major = String(requested).split('.')[0];
  return major === API_MAJOR;
}
const SERVICE_TYPE = 'kcsync';
const ROTATION_GRACE_MS = 10 * 60 * 1000; // Übergangsfrist nach einer Rotation

function newId(prefix) { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }
// Befund N-05: 64 Bit sind für online prüfbare, langfristige Bearer-Geheimnisse zu knapp
// bemessen - mindestens 128, hier 256 Bit für ausreichenden Abstand.
function newSecretValue() { return crypto.randomBytes(32).toString('hex'); }
function hashSecret(secret) { return crypto.createHash('sha256').update(secret).digest('hex'); }
function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8'), bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

class ManagerCompanion {
  constructor({ dbPath = ':memory:' } = {}) {
    this.dbPath = dbPath;
    this.db = openManagerDb(dbPath);
    this.bonjour = null;
    this.mdnsService = null;
    this.server = null;
  }

  async start(port = 0) {
    this._startedAt = Date.now();
    this.identity = await loadOrCreateIdentity(this.db, this.dbPath);
    // Befund D-04: fail-closed statt fail-open. Konnte der Dateischutz nicht nachweislich
    // greifen (weder beim Erzeugen noch - Befund T-03 - bei einem bereits vorhandenen Schlüssel
    // nach einem Neustart), darf der Manager nicht stillschweigend ungeschützt weiterlaufen.
    if (this.identity.keyProtection && !this.identity.keyProtection.ok) {
      throw new Error(
        `Schlüsseldatei konnte nicht nachweislich geschützt werden (${this.identity.keyProtection.platform}/` +
        `${this.identity.keyProtection.method}): ${this.identity.keyProtection.error}. Start abgebrochen (fail-closed).`
      );
    }
    this.adminToken = this._loadOrCreateAdminToken();
    this.server = https.createServer(
      { cert: this.identity.cert, key: this.identity.key },
      (req, res) => this._handle(req, res)
    );
    this.server.timeout = 10000; // Befund S-04: langsame/hängende Verbindungen dürfen keinen Socket unbegrenzt belegen
    this.server.headersTimeout = 8000;
    this.server.keepAliveTimeout = 5000;
    this._pairAttempts = new Map(); // einfacher Ratenschutz für den sensibelsten unauthentifizierten Endpunkt
    await new Promise(resolve => this.server.listen(port, '0.0.0.0', resolve));
    this.port = this.server.address().port;
    // BEFUND 01.09.2026 beim Verein: der Live-Kanal kam nicht hoch, der Fehler wurde hier
    // verschluckt, und der Start meldete trotzdem "ALLES BEREIT". Im PC-Manager blieben die
    // Kassen-LEDs grau, und die Prueseite sagte "Port 47392 antwortet nicht" - waehrend das
    // schwarze Fenster Erfolg meldete. Eine Meldung, die nicht stimmt, ist schlimmer als eine
    // fehlende. Der Manager startet weiterhin auch ohne diesen Kanal (er ist ein Zusatz), aber
    // der Grund wird jetzt gemerkt und vom Marktstart ausdruecklich genannt.
    this.liveMonitorFehler = null;
    try { await this._setupLiveMonitor(); }
    catch (e) { this.liveMonitorFehler = String(e && e.message ? e.message : e); }

    // Echte mDNS/DNS-SD-Ankündigung (A-01) - kein Browser-Netzwerkscan, ein natives Programm.
    // Befund T-01: mDNS bleibt plattformabhängig unzuverlässig (unter anderem unter Windows/
    // Node v24 im Prüfbericht bestätigt) - deshalb bewusst mit try/catch, damit ein Manager auf
    // einer Plattform ohne funktionierendes mDNS trotzdem startet und über die dokumentierte
    // statische Ausweichadresse (device-companion) erreichbar bleibt, statt komplett zu scheitern.
    try {
      this.bonjour = new Bonjour();
      this.mdnsService = this.bonjour.publish({
        name: `KC-Manager-${this.identity.managerId.slice(4, 10)}`,
        type: SERVICE_TYPE,
        port: this.port,
        txt: { managerId: this.identity.managerId, fingerprint: this.identity.fingerprint, apiVersion: API_VERSION },
      });
      await Promise.race([
        new Promise(resolve => this.mdnsService.on('up', resolve)),
        new Promise(resolve => setTimeout(resolve, 3000)),
      ]);
    } catch (err) {
      console.error('[KC Sync] mDNS-Ankündigung fehlgeschlagen, Manager bleibt trotzdem erreichbar (statische Ausweichadresse nötig):', err.message);
    }
    this._verbindungsPruefTimer = setInterval(() => this._pruefeVerbindungen(), 5000);
    return { port: this.port, managerId: this.identity.managerId, fingerprint: this.identity.fingerprint };
  }

  // Admin-Token für den Widerrufs-Endpunkt (Loopback allein ist keine starke Authentisierung).
  // Eigene Datei neben der Datenbank, plattformgerecht geschützt, bleibt über Neustarts stabil.
  // Befund D-04/T-03: Schutz wird bei JEDEM Start erneut geprüft (nicht nur bei Neuerzeugung),
  // und ein nicht nachweisbarer Schutz führt zum Startabbruch (fail-closed).
  _loadOrCreateAdminToken() {
    if (this.dbPath === ':memory:') return newSecretValue(); // Testbetrieb ohne Dateisystem
    const tokenPath = path.join(path.dirname(this.dbPath), path.basename(this.dbPath) + '.admin-token.txt');
    if (fs.existsSync(tokenPath)) {
      const protection = protectSecretFile(tokenPath); // bei jedem Start erneut durchsetzen/prüfen
      if (!protection.ok) throw new Error(`Admin-Token-Datei konnte nicht nachweislich geschützt werden (${protection.platform}/${protection.method}): ${protection.error}. Start abgebrochen (fail-closed).`);
      return fs.readFileSync(tokenPath, 'utf8').trim();
    }
    const token = newSecretValue();
    fs.writeFileSync(tokenPath, token, { mode: 0o600 });
    const protection = protectSecretFile(tokenPath);
    if (!protection.ok) throw new Error(`Admin-Token-Datei konnte nicht nachweislich geschützt werden (${protection.platform}/${protection.method}): ${protection.error}. Start abgebrochen (fail-closed).`);
    return token;
  }

  async stop() {
    if (this._verbindungsPruefTimer) clearInterval(this._verbindungsPruefTimer);
    if (this.mdnsService) this.mdnsService.stop();
    if (this.bonjour) this.bonjour.destroy();
    if (this._liveMonitorClients) { for (const ws of this._liveMonitorClients) { try { ws.close(); } catch (e) {} } this._liveMonitorClients.clear(); }
    if (this._liveMonitorServer) await new Promise((resolve) => this._liveMonitorServer.close(resolve));
    if (this.server) await new Promise(resolve => this.server.close(resolve));
  }

  issuePairingToken(ttlMs = 10 * 60 * 1000) {
    const token = newSecretValue();
    this.db.prepare('INSERT INTO pairing_tokens (token, used, expires_at) VALUES (?, 0, ?)')
      .run(token, new Date(Date.now() + ttlMs).toISOString());
    return token;
  }

  _json(res, status, body) {
    const data = JSON.stringify({ apiVersion: API_VERSION, ...body });
    res.writeHead(status, { 'Content-Type': 'application/json', 'Connection': 'close' });
    res.end(data);
  }

  // Befund T-02 (zweiter Anlauf): der vorherige Versuch zerstörte den Socket aktiv, sobald die
  // Antwort "fertig geschrieben" war (finish-Ereignis) - das bestätigt nur, dass Node die Daten
  // an den Kernel übergeben hat, NICHT dass der Client sie gelesen hat, und führte weiterhin zu
  // ECONNRESET. Jetzt wird die Anfrage stattdessen kontrolliert bis zum Ende durchgelassen
  // (überzählige Bytes werden verworfen, nicht gespeichert), erst danach ganz normal mit
  // "Connection: close" geantwortet - Node schließt die Verbindung dann selbst geordnet, erst
  // nachdem der Client die Antwort vollständig empfangen hat. Kein manuelles destroy() mehr,
  // außer als allerletzte Notbremse nach einem harten Timeout.
  _handle(req, res) {
    const MAX_BODY_BYTES = 256 * 1024; // 256 KB reicht für realistische Sync-Batches deutlich
    let body = '';
    let bytes = 0;
    let oversized = false;
    const deadline = setTimeout(() => { try { req.socket.destroy(); } catch (e) { /* bereits zu */ } }, 15000);
    req.on('data', (c) => {
      bytes += c.length;
      if (bytes > MAX_BODY_BYTES) {
        oversized = true;
        body = ''; // ab hier nichts Weiteres mehr im Speicher halten, nur noch zählen/verwerfen
        return;
      }
      body += c;
    });
    req.on('end', () => {
      clearTimeout(deadline);
      if (oversized) return this._json(res, 413, { error: 'payload_too_large' });
      let parsed = {};
      try { parsed = body ? JSON.parse(body) : {}; } catch (e) { /* pro Route validiert */ }
      try { this._route(req, res, parsed); }
      catch (err) { this._json(res, 500, { error: 'internal_error', message: err.message }); }
    });
    req.on('error', () => clearTimeout(deadline));
  }

  _route(req, res, body) {
    const url = new URL(req.url, 'https://localhost');
    if (req.method === 'POST' && !isCompatibleVersion(body?.apiVersion)) {
      return this._json(res, 400, { error: 'version_unsupported', supported: API_VERSION });
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/health') return this._health(res);
    if (req.method === 'POST' && url.pathname === '/api/v1/pair') return this._pair(req, res, body);
    if (req.method === 'POST' && url.pathname === '/api/v1/fernzugriff/pairing-token') {
      const admin = this._checkAdminFernzugriff(req);
      if (!admin.ok) return this._json(res, admin.status, { error: admin.error });
      return this._json(res, 200, { pairingToken: this.issuePairingToken(), fingerprint: this.identity.fingerprint });
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/sync/push') return this._push(req, res, body);
    if (req.method === 'GET' && url.pathname === '/api/v1/master-data') return this._masterDataGet(req, res);
    // Dienstplan (Sollplan aus dp2, siehe Dienstplan-Bruecke): dieselbe Authentisierung wie
    // Stammdaten - jede gekoppelte Kasse darf ihn abrufen, er soll fuer ALLE Kollegen frei
    // einsehbar sein (kein PIN-Bereich), nur eben nur ueber eine echt gekoppelte Kasse.
    if (req.method === 'GET' && url.pathname === '/api/v1/dienstplan') return this._dienstplanGet(req, res);
    // Datenschluessel der anfragenden Kasse - laeuft ueber denselben angemeldeten und
    // verschluesselten Kanal wie die Stammdaten. Jede Kasse bekommt ausschliesslich ihren
    // eigenen; die Zuordnung kommt aus der Kopplung, nicht aus der Anfrage.
    if (req.method === 'GET' && url.pathname === '/api/v1/data-key') return this._dataKeyGet(req, res);
    if (req.method === 'GET' && url.pathname === '/api/v1/remote-command') return this._remoteCommandPoll(req, res);
    if (req.method === 'GET' && url.pathname === '/api/v1/sold-out-status') return this._soldOutStatusGet(req, res);
    // Anwesenheits-Ampel (LED neben dem Pseudonym in der Bedienerliste, kassenuebergreifend):
    // liefert die rohen Zeitbuchungen, die Kasse rechnet mit derselben summarize()-Logik wie
    // der PC-Manager selbst den Status aus - beide Seiten zeigen dadurch immer denselben Stand.
    if (req.method === 'GET' && url.pathname === '/api/v1/zeiterfassung-status') return this._zeiterfassungStatusGet(req, res);
    // Nummernvorrat fuer die Kassen. Laeuft ueber denselben angemeldeten, verschluesselten
    // Kanal wie die Stammdaten - das Geheimnis selbst verlaesst den Manager dabei NICHT, es
    // gehen nur fertig signierte Nummern raus.
    if (req.method === 'GET' && url.pathname === '/api/v1/voucher-numbers') return this._voucherNumbersGet(req, res, url);
    if (req.method === 'GET' && url.pathname === '/api/v1/sync/status') return this._status(req, res, url);
    if (req.method === 'POST' && url.pathname === '/api/v1/credential/revoke') return this._revoke(req, res, body);
    if (req.method === 'POST' && url.pathname === '/api/v1/credential/rotate') return this._rotateCredential(req, res, body);
    if (req.method === 'POST' && url.pathname === '/api/v1/admin/renew-certificate') return this._renewCertificate(req, res, body);
    if (req.method === 'GET' && url.pathname === '/api/v1/admin/diagnostics') return this._diagnostics(req, res);
    if (req.method === 'POST' && url.pathname === '/api/v1/admin/dead-letter/action') return this._deadLetterAction(req, res, body);
    if (req.method === 'POST' && url.pathname === '/api/v1/live-event') return this._liveEvent(req, res, body);
    if (req.method === 'POST' && url.pathname === '/api/v1/cash-transfer/queue') return this._cashTransferQueue(req, res, body);
    if (req.method === 'GET' && url.pathname === '/api/v1/cash-transfer/pending') return this._cashTransferPending(req, res);
    if (req.method === 'POST' && url.pathname === '/api/v1/cash-transfer/ack') return this._cashTransferAck(req, res, body);
    // 10.09.2026 (Betreiber: "vollstaendiger Gelduebergabe-Weg Money Butler -> PC Manager ->
    // Kasse", Finance Bridge): bewusst GETRENNT von den drei Routen direkt darueber (die
    // bleiben unveraendert fuer "Money Butler direkt am Stand, automatische Uebernahme ohne
    // Rueckfrage") - hier verlangt der Betreiber ausdruecklich eine bewusste Bestaetigung an
    // der Kasse, nicht automatisch. Gleiches Muster, eigene Tabelle (finance_bridge_transfers,
    // siehe db.js Version 23), damit beide Wege sich nie in die Quere kommen koennen.
    if (req.method === 'POST' && url.pathname === '/api/v1/finance-transfer/queue') return this._financeTransferQueue(req, res, body);
    if (req.method === 'GET' && url.pathname === '/api/v1/finance-transfer/pending') return this._financeTransferPending(req, res);
    if (req.method === 'POST' && url.pathname === '/api/v1/finance-transfer/ack') return this._financeTransferAck(req, res, body);
    this._json(res, 404, { error: 'not_found' });
  }

  _health(res) {
    this._json(res, 200, {
      managerId: this.identity.managerId,
      publicKeyFingerprint: this.identity.fingerprint,
      serverTime: new Date().toISOString(),
      status: 'ok',
    });
  }

  // Befund D-05: Credentials/Kopplungstoken bestanden bisher aus einem einzigen Klartextwert,
  // der zugleich Datenbankschlüssel UND Geheimnis war - ein Datenbankabzug hätte sofort
  // nutzbare Bearer-Token geliefert. Jetzt: öffentliche ID (unkritisch, dient nur dem
  // Nachschlagen) + separates Geheimnis, von dem nur ein SHA-256-Hash gespeichert wird. Der an
  // die Kasse ausgegebene Wert ist "id.geheimnis" - die Kasse behandelt das weiterhin als einen
  // einzigen Token-String, der Manager zerlegt ihn intern.
  _issueCredential(deviceInstanceId, registerLabel, ttlMs = 30 * 24 * 3600 * 1000, { unclaimed = false } = {}) {
    const id = newId('cred');
    const secret = newSecretValue();
    const resumeKey = crypto.randomBytes(32).toString('hex');
    const issuedAt = new Date(), expiresAt = new Date(Date.now() + ttlMs);
    this.db.prepare(
      'INSERT INTO credentials (credential_id, secret_hash, device_instance_id, register_label, revoked, issued_at, expires_at, pending_secret, pending_resume_key, claimed, resume_key_hash) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)'
    ).run(id, hashSecret(secret), deviceInstanceId, registerLabel || null, issuedAt.toISOString(), expiresAt.toISOString(), unclaimed ? secret : null, unclaimed ? resumeKey : null, unclaimed ? 0 : 1, hashSecret(resumeKey));
    return { credentialId: `${id}.${secret}`, credentialExpiresAt: expiresAt.toISOString(), resumeKey, row: { credential_id: id } };
  }

  _pair(req, res, body) {
    // Einfacher Ratenschutz: begrenzt wiederholte Versuche von einer Adresse, damit Pairing
    // nicht für Denial-of-Service oder Token-Raten missbraucht wird.
    const addr = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const attempts = (this._pairAttempts.get(addr) || []).filter((t) => now - t < 60000);
    if (attempts.length >= 10) return this._json(res, 429, { error: 'rate_limited' });
    attempts.push(now); this._pairAttempts.set(addr, attempts);

    // Nutzlast wird VOR dem Verbrauch des Tokens geprüft - ein Request mit gültigem Token aber
    // fehlerhafter Nutzlast darf den Token nicht verbrennen.
    if (!body.deviceInstanceId || typeof body.deviceInstanceId !== 'string') {
      return this._json(res, 400, { error: 'payload_invalid' });
    }
    const row = this.db.prepare('SELECT * FROM pairing_tokens WHERE token = ?').get(body.pairingToken);
    if (!row || row.used || new Date(row.expires_at) < new Date()) {
      return this._json(res, 410, { error: 'pairing_token_invalid' });
    }

    let issued;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      // Token wird atomar und bedingt (WHERE used = 0) verbraucht - schützt zusätzlich gegen
      // gleichzeitige Mehrfachverwendung desselben Tokens durch zwei parallele Anfragen.
      const consumed = this.db.prepare('UPDATE pairing_tokens SET used = 1 WHERE token = ? AND used = 0').run(body.pairingToken);
      if (consumed.changes === 0) { this.db.exec('ROLLBACK'); return this._json(res, 410, { error: 'pairing_token_invalid' }); }
      issued = this._issueCredential(body.deviceInstanceId, body.registerLabel);
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      return this._json(res, 500, { error: 'internal_error', message: err.message });
    }

    this._json(res, 200, {
      managerId: this.identity.managerId,
      publicKeyFingerprint: this.identity.fingerprint,
      credentialId: issued.credentialId,
      credentialExpiresAt: issued.credentialExpiresAt,
      resumeKey: issued.resumeKey,
    });
  }

  // Zerlegt den von der Kasse präsentierten Bearer-Wert. Zwei Formate werden unterstützt:
  // - NEU ("id.geheimnis", seit D-05): Geheimnis wird zeitkonstant gegen den gespeicherten Hash
  //   geprüft, der Klartext selbst wird nie abgelegt.
  // - ALT (reine credential_id, aus 2.1 vor D-05): die ID selbst WAR das gesamte Bearer-Geheimnis.
  //   Befund K-01: die Migration ergänzte zwar die neue Spalte, machte aber jedes bestehende
  //   2.1-Credential dadurch sofort ungültig, weil nur noch das neue Format akzeptiert wurde -
  //   das hätte jede bestehende Kopplung beim Update zerstört. Ein Alt-Wert wird jetzt direkt als
  //   credential_id nachgeschlagen und akzeptiert, wenn die Zeile erkennbar noch unmigriert ist
  //   (secret_hash leer) - das ist exakt dieselbe Berechtigungsstärke, die das alte Schema schon
  //   bot (Besitz der ID war der Beweis), keine Abschwächung.
  _authenticate(req) {
    const presented = req.headers['x-kc-credential'] || '';
    const dot = presented.indexOf('.');
    let row, isLegacyFormat = false, claimingLegacyUpgrade = false;
    if (dot < 0) {
      row = this.db.prepare('SELECT * FROM credentials WHERE credential_id = ?').get(presented);
      // Befund G-02: secret_hash darf hier NICHT sofort beim ersten Kontakt gesetzt werden -
      // solange die Aufwertung noch nicht tatsächlich verwendet wurde, muss das alte Bearer-
      // Format weiterhin funktionieren, sonst sperrt eine verlorene Antwort dauerhaft aus.
      if (!row || row.secret_hash) return { ok: false, error: 'credential_invalid' }; // kein Alt-Datensatz (mehr) / bereits final aufgewertet
      isLegacyFormat = true;
    } else {
      const id = presented.slice(0, dot), secret = presented.slice(dot + 1);
      row = this.db.prepare('SELECT * FROM credentials WHERE credential_id = ?').get(id);
      if (!row) return { ok: false, error: 'credential_invalid' };
      if (row.secret_hash && timingSafeStringEqual(hashSecret(secret), row.secret_hash)) {
        // regulärer, bereits abgeschlossener Aufwertungs-/Ausstellungspfad
      } else if (!row.secret_hash && row.legacy_upgrade_secret && timingSafeStringEqual(secret, row.legacy_upgrade_secret)) {
        // Befund G-02: erste erfolgreiche Verwendung der neu ausgegebenen Aufwertung - wird
        // unten final "beansprucht" (secret_hash gesetzt, altes Bearer-Format erlischt danach).
        claimingLegacyUpgrade = true;
      } else {
        return { ok: false, error: 'credential_invalid' };
      }
    }
    if (row.revoked) return { ok: false, error: 'credential_revoked' };
    if (new Date(row.expires_at) < new Date()) return { ok: false, error: 'credential_invalid' };
    if (row.superseded_by) {
      const graceExpired = Date.now() - new Date(row.superseded_at).getTime() > ROTATION_GRACE_MS;
      if (graceExpired) return { ok: false, error: 'credential_invalid' };
    }
    // Befund M-01/G-02: ein Alt-Credential blieb bisher unbegrenzt im schwächeren Format
    // gültig, solange niemand manuell rotierte. Erst NACHDEM feststeht, dass das Credential
    // überhaupt noch gültig ist (nicht widerrufen/abgelaufen), wird bei dieser ersten
    // erfolgreichen Verwendung eine Aufwertung ins neue Format ANGESTOSSEN - aber NICHT sofort
    // final gemacht (secret_hash bleibt vorerst leer). Eine Wiederholung mit demselben alten
    // Credential (z.B. nach verlorener Antwort) liefert dieselbe, bereits vorbereitete
    // Aufwertung unverändert erneut zurück, statt eine neue zu erzeugen oder auszusperren.
    let legacyUpgrade = null;
    if (isLegacyFormat) {
      if (row.legacy_upgrade_secret) {
        legacyUpgrade = { credentialId: `${row.credential_id}.${row.legacy_upgrade_secret}`, resumeKey: row.legacy_upgrade_resume_key };
      } else {
        const freshSecret = newSecretValue();
        const resumeKey = crypto.randomBytes(32).toString('hex');
        this.db.prepare('UPDATE credentials SET legacy_upgrade_secret = ?, legacy_upgrade_resume_key = ? WHERE credential_id = ?')
          .run(freshSecret, resumeKey, row.credential_id);
        legacyUpgrade = { credentialId: `${row.credential_id}.${freshSecret}`, resumeKey };
      }
    }
    // Erste erfolgreiche Verwendung der Aufwertung im neuen Format: jetzt final beanspruchen -
    // ab hier funktioniert das alte Bearer-Format für diese Zeile nicht mehr.
    if (claimingLegacyUpgrade) {
      this.db.prepare('UPDATE credentials SET secret_hash = ?, resume_key_hash = ?, legacy_upgrade_secret = NULL, legacy_upgrade_resume_key = NULL WHERE credential_id = ?')
        .run(hashSecret(row.legacy_upgrade_secret), hashSecret(row.legacy_upgrade_resume_key), row.credential_id);
    }
    // Befund H-01: sobald ein noch "unbeanspruchtes" Nachfolge-Credential (aus einer Rotation)
    // hier zum ersten Mal erfolgreich verwendet wird, gilt es ab sofort als beansprucht - das
    // temporär rückgewinnbare Klartext-Geheimnis wird gelöscht, eine erneute Ausgabe über den
    // Rotationsendpunkt (per altem Credential) ist danach nicht mehr möglich.
    if (!row.claimed) {
      this.db.prepare('UPDATE credentials SET claimed = 1, pending_secret = NULL, pending_resume_key = NULL WHERE credential_id = ?').run(row.credential_id);
    }
    return { ok: true, row, legacyUpgrade };
  }

  _push(req, res, body) {
    const auth = this._authenticate(req);
    if (!auth.ok) return this._json(res, 401, { error: auth.error });
    if (body.deviceInstanceId !== auth.row.device_instance_id) {
      return this._json(res, 403, { error: 'device_identity_mismatch' });
    }
    // Befund B3-M02 (Betriebs-Gate B): Bestätigungen bereits von der Kasse angewendeter
    // Dead-Letter-Aktionen entgegennehmen, damit sie nicht bei jedem weiteren Sync erneut
    // zugestellt werden.
    if (Array.isArray(body.acknowledgedDeadLetterActionIds) && body.acknowledgedDeadLetterActionIds.length) {
      const markApplied = this.db.prepare('UPDATE dead_letter_actions SET applied = 1 WHERE id = ? AND device_instance_id = ?');
      for (const id of body.acknowledgedDeadLetterActionIds) markApplied.run(id, body.deviceInstanceId);
    }
    if (!Array.isArray(body.events)) return this._json(res, 400, { error: 'payload_invalid' });
    const MAX_BATCH = 200;
    if (body.events.length > MAX_BATCH) return this._json(res, 400, { error: 'batch_too_large' });
    // Zeiten, Gutscheine und Abschluesse laufen jetzt ueber DIESEN Kanal (Outbox der Kasse ->
    // Sync), nicht mehr ueber den nur-lokalen Kanal 47392.
    //
    // BEFUND, der dazu gefuehrt hat: die Kasse meldete Zeiten und Gutscheine direkt an
    // http://<host>:47392 - das ist der Loopback-Kanal des Managers, der Fremdzugriffe
    // absichtlich abweist. Auf demselben Rechner ging es, von einem echten Tablet im WLAN kam
    // NIE etwas an (die Kasse behielt die Daten und meldete endlos nach). Ueber den Sync-Kanal
    // gelten dagegen alle bereits abgesicherten Garantien: Wiederholung, Duplikatschutz,
    // Sequenzpruefung - und er funktioniert vom Tablet aus, weil der Kassen-Companion auf dem
    // Tablet selbst laeuft und authentifiziert weiterleitet.
    // 10.09.2026 (Betreiber: "vollstaendiger Gelduebergabe-Weg Money Butler -> Manager ->
    // Kasse"): neuer Typ fuer die zuverlaessige Rueckbestaetigung der Kasse, wenn sie eine vom
    // Manager freigegebene Geldfuellung erfolgreich lokal gebucht hat. Derselbe bewaehrte
    // Meldeweg wie Verkauf/Abschluss/Zeiterfassung/Gutschein - keine neue Datenlogik.
    const ALLOWED_TYPES = new Set(['sale', 'void', 'closing', 'time_clock', 'voucher', 'cash_transfer_confirmed']);

    const acknowledged = [], duplicates = [], rejected = [];
    const insertEvent = this.db.prepare(
      'INSERT INTO received_events (event_id, device_instance_id, sequence_number, type, payload, received_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const findEvent = this.db.prepare('SELECT event_id FROM received_events WHERE event_id = ?');
    const findBySeq = this.db.prepare('SELECT event_id FROM received_events WHERE device_instance_id = ? AND sequence_number = ?');
    const logAnomaly = this.db.prepare(
      'INSERT INTO sequence_anomalies (device_instance_id, event_id, sequence_number, expected_sequence, kind, detected_at) VALUES (?, ?, ?, ?, ?, ?)'
    );

    // Befund D-01 (KRITISCH): zwei getrennte Werte statt einem einzigen Maximum - "höchste
    // jemals gesehene Sequenz" (nur Information) und "höchste LÜCKENLOSE Sequenz" (das ist die
    // einzige Zahl, die anderswo als Bestätigung gilt, siehe _status()). Ein später
    // eintreffendes Ereignis, das eine frühere Lücke schließt, wird jetzt angenommen und die
    // lückenlose Sequenz entsprechend nachgezogen - vorher wäre es fälschlich als "Regression"
    // abgelehnt worden, obwohl es die Lücke gerade heilen sollte.
    const seqRow = this.db.prepare('SELECT highest_seen, highest_contiguous FROM last_acked_sequence WHERE device_instance_id = ?').get(body.deviceInstanceId);
    let highestSeen = seqRow ? seqRow.highest_seen : 0;
    let highestContiguous = seqRow ? seqRow.highest_contiguous : 0;
    const orderedEvents = [...body.events].sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));

    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const ev of orderedEvents) {
        const validId = typeof ev.eventId === 'string' && ev.eventId.length > 0 && ev.eventId.length <= 128;
        const validSeq = Number.isInteger(ev.sequenceNumber) && ev.sequenceNumber > 0 && ev.sequenceNumber < Number.MAX_SAFE_INTEGER;
        const validType = ALLOWED_TYPES.has(ev.type);
        const validPayload = ev.payload === undefined || (typeof ev.payload === 'object' && JSON.stringify(ev.payload).length <= 8192);
        if (!validId || !validSeq || !validType || !validPayload) { rejected.push({ eventId: ev.eventId || null, reason: 'payload_invalid', permanent: true }); continue; }
        if (findEvent.get(ev.eventId)) { duplicates.push(ev.eventId); continue; } // idempotent (A-04)

        // Ist diese Sequenznummer für dieses Gerät bereits durch ein ANDERES Ereignis belegt?
        // Das ist eine echte Regression/ein Konflikt (zwei verschiedene Ereignis-IDs beanspruchen
        // dieselbe Sequenznummer) - nicht bloß "schon gesehen". Wird abgelehnt.
        const existing = findBySeq.get(body.deviceInstanceId, ev.sequenceNumber);
        if (existing) {
          logAnomaly.run(body.deviceInstanceId, ev.eventId, ev.sequenceNumber, highestContiguous + 1, 'sequence_conflict', new Date().toISOString());
          rejected.push({ eventId: ev.eventId, reason: 'sequence_conflict', permanent: true });
          continue;
        }

        if (ev.sequenceNumber > highestSeen + 1) {
          // Lücke oberhalb des bisherigen Maximums: nur protokollieren, nicht ablehnen - das
          // fehlende Ereignis kann noch unterwegs sein und die Lücke später selbst schließen.
          logAnomaly.run(body.deviceInstanceId, ev.eventId, ev.sequenceNumber, highestSeen + 1, 'gap', new Date().toISOString());
        }

        try {
          insertEvent.run(ev.eventId, body.deviceInstanceId, ev.sequenceNumber, ev.type, JSON.stringify(ev.payload || {}), new Date().toISOString());
        } catch (constraintErr) {
          // Letzte Verteidigungslinie: der UNIQUE-Constraint hat etwas abgefangen, das die
          // vorherige Anwendungslogik übersehen hat.
          logAnomaly.run(body.deviceInstanceId, ev.eventId, ev.sequenceNumber, highestContiguous + 1, 'constraint_conflict', new Date().toISOString());
          rejected.push({ eventId: ev.eventId, reason: 'constraint_conflict', permanent: true });
          continue;
        }
        // In die jeweilige Fachtabelle uebernehmen. received_events bleibt die massgebliche
        // Aufzeichnung; die Fachtabellen sind die auswertbare Sicht darauf. Schlaegt die
        // Uebernahme fehl, ist das Ereignis trotzdem sicher gespeichert - die Bestaetigung an
        // die Kasse haengt bewusst NICHT daran, sonst wuerde sie ewig nachmelden.
        try { this._uebernehmeFachereignis(ev); }
        catch (fachFehler) { /* Auswertungssicht ist nachrangig, die Buchung selbst steht */ }
        highestSeen = Math.max(highestSeen, ev.sequenceNumber);
        acknowledged.push(ev.eventId);
      }

      // Lückenlosen Stand nachziehen: so weit vorrücken, wie fortlaufend gespeicherte
      // Sequenznummern existieren - das schließt auch Lücken, die durch dieses oder frühere
      // Ereignisse gerade erst geheilt wurden.
      while (findBySeq.get(body.deviceInstanceId, highestContiguous + 1)) highestContiguous += 1;

      this.db.prepare(
        `INSERT INTO last_acked_sequence (device_instance_id, highest_seen, highest_contiguous) VALUES (?, ?, ?)
         ON CONFLICT(device_instance_id) DO UPDATE SET highest_seen = excluded.highest_seen, highest_contiguous = excluded.highest_contiguous`
      ).run(body.deviceInstanceId, highestSeen, highestContiguous);

      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      return this._json(res, 500, { error: 'internal_error', message: err.message });
    }

    if (this._dropNextResponse) { this._dropNextResponse = false; req.socket.destroy(); return; }
    const pendingDeadLetterActions = this.db.prepare(
      'SELECT id, event_id, action, operator_note FROM dead_letter_actions WHERE device_instance_id = ? AND applied = 0'
    ).all(body.deviceInstanceId);
    this._json(res, 200, {
      acknowledged, duplicates, rejected,
      ...(auth.legacyUpgrade ? { credentialUpgrade: auth.legacyUpgrade } : {}),
      ...(pendingDeadLetterActions.length ? { pendingDeadLetterActions } : {}),
    });
  }

  _status(req, res, url) {
    const auth = this._authenticate(req);
    if (!auth.ok) return this._json(res, 401, { error: auth.error });
    const deviceInstanceId = url.searchParams.get('deviceInstanceId');
    if (deviceInstanceId !== auth.row.device_instance_id) return this._json(res, 403, { error: 'device_identity_mismatch' });
    const row = this.db.prepare('SELECT highest_seen, highest_contiguous FROM last_acked_sequence WHERE device_instance_id = ?').get(deviceInstanceId);
    // Befund D-01: lastAckedSequence meldet AUSSCHLIESSLICH den lückenlosen Stand, nicht das
    // bloße Maximum - eine offene Lücke darf nach außen nicht als "bestätigt" erscheinen.
    this._json(res, 200, { managerSync: 'verbunden', lastAckedSequence: row ? row.highest_contiguous : 0, highestSeenSequence: row ? row.highest_seen : 0, serverTime: new Date().toISOString(), ...(auth.legacyUpgrade ? { credentialUpgrade: auth.legacyUpgrade } : {}) });
  }

  // Live-Monitor (getrennter Kanal, siehe ausführliche Begründung in der Konzept-Abstimmung mit
  // dem Betreiber): schnell, "fire and forget", KEIN Archiv - Ereignisse werden nur an gerade
  // verbundene PC-Manager-Fenster durchgereicht, nie in einer Datenbank gespeichert. Die
  // eigentliche, zuverlässige Buchung läuft komplett unabhängig über den bestehenden Sync-Kanal
  // weiter - dieser Kanal darf sie niemals verlangsamen oder blockieren.
  _setupLiveMonitor(port = 47392) {
    this._liveMonitorClients = new Set();
    // Befund (echter Browsertest): eine wss://-Verbindung zu einem selbstsignierten Zertifikat
    // lässt ein echter Browser ohne vorherige manuelle Bestätigung nicht zu - anders als meine
    // eigenen Testskripte, die die Zertifikatsprüfung bewusst umgehen können. Genau dasselbe
    // Prinzip wie beim einfachen Kassen-Status-Endpunkt: ein eigener, reiner (nicht-TLS)
    // WebSocket-Server, ausschließlich auf Loopback gebunden - PC Manager und Manager-Companion
    // laufen auf derselben Maschine, keine Verschlüsselung nötig, kein Zertifikatsproblem.
    const http = require('http');
    const plainServer = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'POST' && url.pathname === '/master-data/push') {
        const addr = req.socket.remoteAddress || '';
        const isLoopback = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        if (!isLoopback) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'loopback_only' })); return; }
        let koerper = '';
        req.on('data', (c) => { koerper += c; if (koerper.length > 2_000_000) req.destroy(); }); // großzügig, aber begrenzt (viele Artikel+Bilder als Text)
        req.on('end', () => { try { this._masterDataPush(req, res, JSON.parse(koerper)); } catch (e) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'payload_invalid' })); } });
        return;
      }
      if (req.method === 'OPTIONS' && url.pathname === '/master-data/push') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Methods', 'POST');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.writeHead(204); res.end();
        return;
      }
      // Dienstplan-Bruecke: der PC-Manager (Browser, dort ist die Supabase-Anmeldung vorhanden)
      // holt den Sollplan aus dp2 (kc_dp_plan_published), uebersetzt person_id -> Pseudonym
      // und legt das Ergebnis HIER ab - genau dasselbe Loopback-Muster wie /master-data/push.
      if (req.method === 'POST' && url.pathname === '/dienstplan/push') {
        const addr = req.socket.remoteAddress || '';
        const isLoopback = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        if (!isLoopback) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'loopback_only' })); return; }
        let koerper = '';
        req.on('data', (c) => { koerper += c; if (koerper.length > 2_000_000) req.destroy(); });
        req.on('end', () => { try { this._dienstplanPush(req, res, JSON.parse(koerper)); } catch (e) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'payload_invalid' })); } });
        return;
      }
      if (req.method === 'OPTIONS' && url.pathname === '/dienstplan/push') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Methods', 'POST');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.writeHead(204); res.end();
        return;
      }
      if (req.method === 'POST' && url.pathname === '/remote-command/queue') {
        const addr = req.socket.remoteAddress || '';
        const isLoopback = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        if (!isLoopback) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'loopback_only' })); return; }
        let koerper = '';
        req.on('data', (c) => { koerper += c; if (koerper.length > 4096) req.destroy(); });
        req.on('end', () => {
          try {
            const daten = JSON.parse(koerper);
            if (!daten.registerId || !daten.command) throw new Error('payload_invalid');
            this.db.prepare('INSERT INTO remote_commands (register_id, command, created_at) VALUES (?, ?, ?)')
              .run(daten.registerId, daten.command, new Date().toISOString());
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ eingereiht: true }));
          } catch (e) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'payload_invalid' })); }
        });
        return;
      }
      if (req.method === 'OPTIONS' && url.pathname === '/remote-command/queue') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Methods', 'POST');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.writeHead(204); res.end();
        return;
      }
      if (req.method === 'GET' && url.pathname === '/sold-out-status-alle') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        const zeilen = this.db.prepare('SELECT article_id, sold_out, updated_at, updated_by_register FROM sold_out_status WHERE sold_out = 1').all();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ausverkauft: zeilen.map((z) => ({ articleId: z.article_id, updatedAt: z.updated_at, updatedBy: z.updated_by_register })) }));
        return;
      }
      // Verbindungsübersicht: welche Kassen sind gekoppelt und wann kam zuletzt etwas an?
      //
      // BEFUND aus dem Betrieb: die Kassen-LEDs im Manager wurden erst gruen, wenn eine Kasse
      // ein EREIGNIS meldete - also praktisch erst nach dem ersten Verkauf. Bis dahin stand
      // dort "Noch nie verbunden", obwohl die Kasse laengst angemeldet war. Eine
      // Verbindungsanzeige, die in Wahrheit den letzten Umsatz zeigt, ist irrefuehrend:
      // am Markttag steht jemand davor und weiss nicht, ob die Kasse angebunden ist.
      // Dieser Endpunkt liefert den Kopplungszustand unabhaengig von Verkaeufen.
      if (req.method === 'GET' && url.pathname === '/kassen-verbindungen') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        const zeilen = this.db.prepare(`
          SELECT credential_id, device_instance_id, register_label, revoked, issued_at, expires_at
          FROM credentials ORDER BY issued_at DESC
        `).all();
        // Letzte Meldung je Kasse aus dem Ereignisprotokoll - fuer "zuletzt gesehen".
        let letzte = [];
        try {
          letzte = this.db.prepare(`
            SELECT register_id, MAX(received_at) AS zuletzt FROM live_event_log GROUP BY register_id
          `).all();
        } catch (e) { /* Protokoll evtl. leer - dann gibt es nur den Kopplungszustand */ }
        const zuletztNach = Object.fromEntries(letzte.map((z) => [z.register_id, z.zuletzt]));
        const jetzt = Date.now();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          managerLaeuft: true,
          abgefragtUm: new Date().toISOString(),
          kassen: zeilen.filter((z) => !z.revoked).map((z) => {
            const kasse = z.register_label || z.device_instance_id;
            const zuletzt = zuletztNach[kasse] || null;
            const alterSek = zuletzt ? Math.round((jetzt - new Date(zuletzt).getTime()) / 1000) : null;
            return {
              kasse,
              gekoppelt: true,                  // Schluessel vorhanden und nicht zurueckgezogen
              gekoppeltSeit: z.issued_at,
              zuletztGemeldet: zuletzt,
              zuletztGemeldetVorSek: alterSek,
              // "verbunden" heisst hier: gekoppelt. Ob gerade Daten fliessen, sagt zuletztGemeldet.
              zustand: alterSek === null ? 'gekoppelt_ohne_meldung'
                     : alterSek < 90 ? 'aktiv'
                     : 'gekoppelt_still',
            };
          }),
        }));
        return;
      }
      if (req.method === 'OPTIONS' && url.pathname === '/kassen-verbindungen') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.writeHead(204); res.end(); return;
      }
      // Bestätigte Finance-Bridge-Geldübergaben für den lokalen PC-Manager.
      // Nur bereits zuverlässig aus der Kassen-Outbox empfangene Ereignisse werden geliefert.
      if (req.method === 'GET' && url.pathname === '/cash-transfer-confirmations') {
        const addr = req.socket.remoteAddress || '';
        const isLoopback = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        if (!isLoopback) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'loopback_only' })); return; }
        const seit = url.searchParams.get('since');
        const zeilen = seit
          ? this.db.prepare(`SELECT event_id, device_instance_id, payload, received_at FROM received_events WHERE type = 'cash_transfer_confirmed' AND received_at > ? ORDER BY received_at ASC`).all(seit)
          : this.db.prepare(`SELECT event_id, device_instance_id, payload, received_at FROM received_events WHERE type = 'cash_transfer_confirmed' ORDER BY received_at ASC LIMIT 200`).all();
        const bestaetigungen = [];
        for (const z of zeilen) {
          try { bestaetigungen.push({ eventId:z.event_id, deviceInstanceId:z.device_instance_id, receivedAt:z.received_at, ...JSON.parse(z.payload) }); }
          catch (e) { /* einzelnen defekten Datensatz überspringen */ }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ bestaetigungen, anzahl:bestaetigungen.length, abgefragtUm:new Date().toISOString() }));
        return;
      }
      if (req.method === 'OPTIONS' && url.pathname === '/cash-transfer-confirmations') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.writeHead(204); res.end(); return;
      }
      // 10.09.2026 (Betreiber: "wenn die Daten schon da sind, können sie ja auch direkt
      // angezeigt werden, am besten auch ein Knopf um die Daten manuell zu holen"): Verkäufe
      // kommen über den zuverlässigen Sync-Kanal schon lange sicher hier an (received_events)
      // - landeten bisher aber nur als Rohdatensatz, ohne dass der PC-Manager sie je abgeholt
      // hätte. Dieser Endpunkt liefert sie aus, damit der Manager sie ins Dashboard übernehmen
      // kann. "seit" (optional, ISO-Zeit) für schlankes, wiederholtes Abholen - nur neu
      // Angekommenes, nicht jedes Mal alles.
      if (req.method === 'GET' && url.pathname === '/verkaeufe-abholen') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        const seit = url.searchParams.get('seit');
        const zeilen = seit
          ? this.db.prepare(`SELECT event_id, device_instance_id, payload, received_at FROM received_events WHERE type = 'sale' AND received_at > ? ORDER BY received_at ASC`).all(seit)
          : this.db.prepare(`SELECT event_id, device_instance_id, payload, received_at FROM received_events WHERE type = 'sale' ORDER BY received_at ASC`).all();
        const verkaeufe = [];
        for (const z of zeilen) {
          try { verkaeufe.push(JSON.parse(z.payload)); } catch (e) { /* einzelner defekter Datensatz - Rest bleibt nutzbar */ }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ verkaeufe, anzahl: verkaeufe.length, abgefragtUm: new Date().toISOString() }));
        return;
      }
      if (req.method === 'OPTIONS' && url.pathname === '/verkaeufe-abholen') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.writeHead(204); res.end(); return;
      }
      // 10.09.2026 (Finance Bridge): Rueckbestaetigungen der Kassen abholen - dieselbe
      // received_events-Tabelle, derselbe bewaehrte Weg wie /verkaeufe-abholen, nur type =
      // 'cash_transfer_confirmed'. Der Manager nutzt das, um die zentrale Finance Bridge
      // (Supabase) auf "handed_to_register" zu setzen, sobald eine Kasse wirklich bestaetigt hat.
      if (req.method === 'GET' && url.pathname === '/gelduebergaben-bestaetigungen-abholen') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        const seit = url.searchParams.get('seit');
        const zeilen = seit
          ? this.db.prepare(`SELECT event_id, payload, received_at FROM received_events WHERE type = 'cash_transfer_confirmed' AND received_at > ? ORDER BY received_at ASC`).all(seit)
          : this.db.prepare(`SELECT event_id, payload, received_at FROM received_events WHERE type = 'cash_transfer_confirmed' ORDER BY received_at ASC`).all();
        const bestaetigungen = [];
        for (const z of zeilen) {
          try { bestaetigungen.push(JSON.parse(z.payload)); } catch (e) { /* einzelner defekter Datensatz - Rest bleibt nutzbar */ }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ bestaetigungen, anzahl: bestaetigungen.length, abgefragtUm: new Date().toISOString() }));
        return;
      }
      if (req.method === 'OPTIONS' && url.pathname === '/gelduebergaben-bestaetigungen-abholen') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.writeHead(204); res.end(); return;
      }
      // --- Zentrale KC-Datenhaltung -------------------------------------------------------
      // Der Manager stößt an, der Companion führt aus. Der Dienstschlüssel bleibt auf diesem
      // Rechner und geht nie in den Browser.
      if (url.pathname.startsWith('/zentral/')) {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.writeHead(204); res.end(); return;
        }
        const zentral = require('./zentral-sync.js');
        const konfig = zentral.ladeKonfig();
        const orgId = (konfig && konfig.orgId) || 'KC_WERNE';
        const antworte = (code, daten) => { res.writeHead(code, {'Content-Type':'application/json'}); res.end(JSON.stringify(daten)); };

        if (req.method === 'GET' && url.pathname === '/zentral/zustand') {
          zentral.zustand(orgId).then((z) => antworte(200, z))
            .catch((e) => antworte(200, {eingerichtet: !!konfig, fehler: e.message}));
          return;
        }
        if (req.method === 'GET' && url.pathname === '/zentral/personen') {
          zentral.personenHolen(orgId).then((p) => antworte(200, {personen: p}))
            .catch((e) => antworte(502, {fehler: e.message}));
          return;
        }
        if (req.method === 'POST' && (url.pathname === '/zentral/zeiten' || url.pathname === '/zentral/pseudonyme')) {
          let koerper = '';
          req.on('data', (c) => { koerper += c; if (koerper.length > 4 * 1024 * 1024) req.destroy(); });
          req.on('end', () => {
            let daten; try { daten = JSON.parse(koerper); } catch (e) { return antworte(400, {fehler: 'payload_invalid'}); }
            const aufgabe = url.pathname === '/zentral/zeiten'
              ? zentral.zeitenMelden(orgId, daten.ereignisse || [])
              : zentral.pseudonymeSchreiben(orgId, daten.pseudonyme || {});
            aufgabe.then((r) => antworte(200, {ok: true, ...r}))
                   .catch((e) => antworte(502, {fehler: e.message}));
          });
          return;
        }
        antworte(404, {fehler: 'unbekannt'});
        return;
      }

      // Gutscheine von den Kassen entgegennehmen.
      // Wie bei den Arbeitszeiten: die Kasse BEHAELT ihre Gutscheine und meldet sie nur -
      // dadurch liegen sie an zwei Stellen und ein Ausfall kostet kein Guthaben.
      if (req.method === 'OPTIONS' && url.pathname === '/gutscheine/melden') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.writeHead(204); res.end(); return;
      }
      if (req.method === 'POST' && url.pathname === '/gutscheine/melden') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        let koerper = '';
        req.on('data', (c) => { koerper += c; if (koerper.length > 512 * 1024) req.destroy(); });
        req.on('end', () => {
          try {
            const daten = JSON.parse(koerper);
            const liste = Array.isArray(daten.gutscheine) ? daten.gutscheine : [];
            const jetzt = new Date().toISOString();
            const einfuegen = this.db.prepare(`
              INSERT INTO vouchers (code, kind, amount, balance, issued_at, expires_at, issued_by_register, redemptions, updated_at, signature_ok)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(code) DO UPDATE SET
                balance=excluded.balance, redemptions=excluded.redemptions, updated_at=excluded.updated_at,
                signature_ok=COALESCE(excluded.signature_ok, vouchers.signature_ok)
            `);
            const nummerVerbraucht = this.db.prepare(
              "UPDATE voucher_numbers SET used = 1, used_at = ? WHERE code = ? AND used = 0");
            // Signatur pruefen, aber NIEMALS deswegen eine Meldung verwerfen: hinter jedem
            // Restwert steht Geld, das ein Gast bezahlt hat. Ein auffaelliger Gutschein soll
            // im Manager sichtbar sein, nicht verschwinden. Ohne Signatur (alte GS-Nummern
            // aus der Zeit vor der Umstellung) bleibt das Feld leer statt "falsch".
            const signaturBewerten = (g) => {
              if (!g.qr) return null;
              return gutscheinSignatur.pruefe(this.db, g.qr).gueltig ? 1 : 0;
            };
            const angekommen = [];
            this.db.exec('BEGIN IMMEDIATE');
            try {
              for (const g of liste) {
                if (!g || !g.code || typeof g.amount !== 'number') continue;
                einfuegen.run(String(g.code), g.kind || 'gutschein', Number(g.amount), Number(g.balance ?? g.amount),
                  String(g.issuedAt || jetzt), String(g.expiresAt || jetzt), g.registerId || null,
                  JSON.stringify(g.redemptions || []), jetzt, signaturBewerten(g));
                nummerVerbraucht.run(jetzt, String(g.code));
                angekommen.push(String(g.code));
              }
              this.db.exec('COMMIT');
            } catch (fehler) { try { this.db.exec('ROLLBACK'); } catch (e) {} throw fehler; }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, angekommen, gesamt: angekommen.length }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'payload_invalid' }));
          }
        });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/gutscheine/liste') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        const zeilen = this.db.prepare(`
          SELECT code, kind, amount, balance, issued_at, expires_at, issued_by_register, redemptions, updated_at, signature_ok
          FROM vouchers ORDER BY issued_at DESC LIMIT 5000
        `).all();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ gutscheine: zeilen.map((z) => ({
          code: z.code, kind: z.kind, amount: z.amount, balance: z.balance,
          issuedAt: z.issued_at, expiresAt: z.expires_at, registerId: z.issued_by_register,
          redemptions: JSON.parse(z.redemptions || '[]'), updatedAt: z.updated_at,
          // null = aus der Zeit vor der Umstellung, nicht bewertbar. 0 = auffaellig.
          signaturGeprueft: z.signature_ok,
        })) }));
        return;
      }
      // Arbeitszeiten von den Kassen entgegennehmen.
      //
      // GRUNDSATZ: Stunden duerfen nicht verloren gehen. Die Kasse meldet ihre Buchungen
      // laufend hierher und BEHAELT sie trotzdem. Sie bekommt zurueck, welche Buchungen
      // angekommen sind, und merkt sich das - geloescht wird auf der Kasse nichts.
      // Dieselbe Buchung darf beliebig oft gemeldet werden: der Schluessel ist die
      // Ereigniskennung, doppelte Meldungen landen nur einmal in der Tabelle. Damit ist es
      // ungefaehrlich, wenn eine Bestaetigung unterwegs verloren geht.
      if (req.method === 'OPTIONS' && url.pathname === '/zeiterfassung/melden') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.writeHead(204); res.end(); return;
      }
      if (req.method === 'POST' && url.pathname === '/zeiterfassung/melden') {
        const addr = req.socket.remoteAddress || '';
        const isLoopback = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        if (!isLoopback) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'loopback_only' })); return; }
        let koerper = '';
        req.on('data', (c) => { koerper += c; if (koerper.length > 512 * 1024) req.destroy(); });
        req.on('end', () => {
          try {
            const daten = JSON.parse(koerper);
            const ereignisse = Array.isArray(daten.ereignisse) ? daten.ereignisse : [];
            const jetzt = new Date().toISOString();
            const einfuegen = this.db.prepare(`
              INSERT INTO time_clock_events
                (event_id, person_id, person_type, kind, recorded_at, effective_at,
                 register_id, event_name, source, correction_reason, shift_reason, voided_at, received_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(event_id) DO UPDATE SET
                effective_at=excluded.effective_at, correction_reason=excluded.correction_reason,
                shift_reason=excluded.shift_reason, voided_at=excluded.voided_at
            `);
            const angekommen = [];
            this.db.exec('BEGIN IMMEDIATE');
            try {
              for (const e of ereignisse) {
                if (!e || !e.id || !e.personId || !e.kind || !e.effectiveAt) continue;
                einfuegen.run(String(e.id), String(e.personId), e.personType || null, String(e.kind),
                  String(e.recordedAt || e.effectiveAt), String(e.effectiveAt),
                  e.registerId || null, e.eventId || null, e.source || null,
                  e.correctionReason || null, e.shiftReason || null, e.voidedAt || null, jetzt);
                angekommen.push(String(e.id));
              }
              this.db.exec('COMMIT');
            } catch (fehler) {
              try { this.db.exec('ROLLBACK'); } catch (e2) { /* nichts zu verwerfen */ }
              throw fehler;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, angekommen, gesamt: angekommen.length }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'payload_invalid' }));
          }
        });
        return;
      }
      // Bargeldübergabe zur Auswertung melden (QR-Weg: der PC-Manager erzeugt den Code selbst,
      // der Manager-Dienst bekommt davon sonst nichts mit).
      if (req.method === 'OPTIONS' && url.pathname === '/bargeld/uebergabe') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.writeHead(204); res.end(); return;
      }
      if (req.method === 'POST' && url.pathname === '/bargeld/uebergabe') {
        const addr = req.socket.remoteAddress || '';
        const isLoopback = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        if (!isLoopback) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'loopback_only' })); return; }
        let koerper = '';
        req.on('data', (c) => { koerper += c; if (koerper.length > 64 * 1024) req.destroy(); });
        req.on('end', () => {
          try {
            const daten = JSON.parse(koerper);
            const ok = this._protokolliereUebergabe(daten.uebergabe || daten.payload || daten, daten.quelle || 'qr');
            res.writeHead(ok ? 200 : 400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(ok ? { ok: true } : { error: 'payload_invalid' }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'payload_invalid' }));
          }
        });
        return;
      }
      // Alle protokollierten Übergaben lesen (Statistikseite im Manager und im Money Butler).
      if (req.method === 'GET' && url.pathname === '/bargeld/uebergaben') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        const zeilen = this.db.prepare(`
          SELECT transfer_id, register_id, type, effective_date, created_at, source,
                 total, loose_total, roll_total, breakdown, loose_breakdown, coin_rolls, note
          FROM cash_transfer_log ORDER BY created_at DESC LIMIT 2000
        `).all();
        const json = (t) => { try { return JSON.parse(t || '{}'); } catch (e) { return {}; } };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ uebergaben: zeilen.map((z) => ({
          transferId: z.transfer_id, registerId: z.register_id, type: z.type,
          effectiveDate: z.effective_date, time: z.created_at, source: z.source,
          total: z.total, looseTotal: z.loose_total, rollTotal: z.roll_total,
          breakdown: json(z.breakdown), looseBreakdown: json(z.loose_breakdown),
          coinRolls: json(z.coin_rolls), note: z.note,
        })) }));
        return;
      }
      // Uebergabeprotokoll der Geldkassette melden (Weg 1: der Money Butler meldet beim
      // Erzeugen; Weg 2 ist das Nachtragen per Beleg-QR aus dem PC-Manager - beide landen hier).
      if (req.method === 'OPTIONS' && url.pathname === '/bargeld/protokoll') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.writeHead(204); res.end(); return;
      }
      if (req.method === 'POST' && url.pathname === '/bargeld/protokoll') {
        const addr = req.socket.remoteAddress || '';
        const isLoopback = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        if (!isLoopback) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'loopback_only' })); return; }
        let koerper = '';
        req.on('data', (c) => { koerper += c; if (koerper.length > 64 * 1024) req.destroy(); });
        req.on('end', () => {
          try {
            const daten = JSON.parse(koerper);
            const ok = this._protokolliereBeleg(daten.beleg || daten.payload || daten, daten.quelle || 'qr');
            res.writeHead(ok ? 200 : 400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(ok ? { ok: true } : { error: 'beleg_invalid' }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'beleg_invalid' }));
          }
        });
        return;
      }
      // Alle Uebergabeprotokolle lesen (Archiv im PC-Manager).
      if (req.method === 'GET' && url.pathname === '/bargeld/protokolle') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        const zeilen = this.db.prepare(`
          SELECT payload, received_at, source FROM cash_protocol_log
          ORDER BY created_at DESC LIMIT 1000
        `).all();
        const protokolle = [];
        for (const z of zeilen) {
          try {
            const beleg = JSON.parse(z.payload);
            beleg.empfangen = z.received_at; beleg.quelle = z.source;
            protokolle.push(beleg);
          } catch (e) { /* eine unlesbare Zeile darf nicht das ganze Archiv blockieren */ }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ protokolle }));
        return;
      }
      // Gemeldete Arbeitszeiten abrufen (fuer die Anzeige im Manager und die Weitergabe).
      // Datenschluessel einer Kasse hinterlegen (der PC-Manager erzeugt die Security Card).
      if (req.method === 'OPTIONS' && url.pathname === '/kassen/datenschluessel') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.writeHead(204); res.end(); return;
      }
      if (req.method === 'POST' && url.pathname === '/kassen/datenschluessel') {
        const addr = req.socket.remoteAddress || '';
        const isLoopback = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        if (!isLoopback) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'loopback_only' })); return; }
        let koerper = '';
        req.on('data', (c) => { koerper += c; if (koerper.length > 16 * 1024) req.destroy(); });
        req.on('end', () => {
          try {
            const d = JSON.parse(koerper);
            if (!d.registerId || !d.dataKey || !d.cardKey) throw new Error('unvollstaendig');
            const jetzt = new Date().toISOString();
            this.db.prepare(`
              INSERT INTO register_data_keys (register_id, data_key, card_key, ausgabe, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(register_id) DO UPDATE SET data_key=excluded.data_key, card_key=excluded.card_key,
                ausgabe=excluded.ausgabe, updated_at=excluded.updated_at
            `).run(String(d.registerId), String(d.dataKey), String(d.cardKey), Number(d.ausgabe || 1), jetzt, jetzt);
            res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'payload_invalid' }));
          }
        });
        return;
      }
      // Kopplung einer Kasse widerrufen - der wirksame Schritt bei Diebstahl.
      //
      // Anders als Sperre und Löschbefehl braucht das GERAET dafür nicht erreichbar zu sein:
      // ab hier wird jede Anfrage von ihm abgewiesen, es bekommt weder Schlüssel noch
      // Stammdaten, und seine Meldungen werden nicht mehr angenommen.
      if (req.method === 'OPTIONS' && url.pathname === '/kassen/kopplung-widerrufen') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.writeHead(204); res.end(); return;
      }
      if (req.method === 'POST' && url.pathname === '/kassen/kopplung-widerrufen') {
        const addr = req.socket.remoteAddress || '';
        const isLoopback = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        if (!isLoopback) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'loopback_only' })); return; }
        let koerper = '';
        req.on('data', (c) => { koerper += c; if (koerper.length > 8 * 1024) req.destroy(); });
        req.on('end', () => {
          try {
            const d = JSON.parse(koerper);
            if (!d.registerId) throw new Error('registerId fehlt');
            const betroffen = this.db.prepare('SELECT credential_id, device_instance_id FROM credentials WHERE LOWER(register_label) = LOWER(?) AND revoked = 0').all(String(d.registerId));
            this.db.prepare('UPDATE credentials SET revoked = 1 WHERE LOWER(register_label) = LOWER(?)').run(String(d.registerId));
            betroffen.forEach((z) => this._writeAuditLog('revoke_lost_device', z.device_instance_id, addr, 'ok'));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, widerrufen: betroffen.length }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'payload_invalid' }));
          }
        });
        return;
      }
      // Startprotokoll der Kassen: wer sich wann und auf welchem Weg angemeldet hat.
      //
      // Der Live-Monitor zeigt nur den Moment. Für die Frage "war Kasse 2 heute früh überhaupt
      // an?" braucht es den Verlauf - der liegt bereits im Live-Protokoll, hier nur gefiltert.
      if (req.method === 'GET' && url.pathname === '/kassen/startprotokoll') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        const zeilen = this.db.prepare(`
          SELECT register_id, payload, received_at FROM live_event_log
          WHERE type = 'kasse_start' ORDER BY received_at DESC LIMIT 300
        `).all();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ starts: zeilen.map((z) => {
          let p = {};
          try { p = JSON.parse(z.payload) || {}; } catch (e) { p = {}; }
          return { registerId: z.register_id || p.registerId || null, zeit: z.received_at,
                   gemeldeteZeit: p.zeit || null, freigabe: p.freigabe || null, geraet: p.geraet || null };
        }) }));
        return;
      }
      // Gemeldete Tagesabschlüsse lesen (Anzeige im PC-Manager).
      if (req.method === 'GET' && url.pathname === '/abschluesse/liste') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        const zeilen = this.db.prepare(`
          SELECT closing_id, register_id, register_name, created_at, period_start, period_end, status,
                 cash_in, cash_sales, cash_tips, cash_out, expected_cash, staff_total, staff_count,
                 transaction_count, note, received_at, account_sales, total_sales, account_breakdown, cash_count_json
          FROM closings ORDER BY created_at DESC LIMIT 500
        `).all();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ abschluesse: zeilen.map((z) => ({
          closingId: z.closing_id, registerId: z.register_id, registerName: z.register_name,
          createdAt: z.created_at, periodStart: z.period_start, periodEnd: z.period_end, status: z.status,
          cashIn: z.cash_in, cashSales: z.cash_sales, cashTips: z.cash_tips, cashOut: z.cash_out,
          expectedCash: z.expected_cash, staffTotal: z.staff_total, staffCount: z.staff_count,
          transactionCount: z.transaction_count, note: z.note, receivedAt: z.received_at,
          accountSales: z.account_sales, totalSales: z.total_sales,
          accountBreakdown: (() => { try { return JSON.parse(z.account_breakdown || '[]'); } catch (e) { return []; } })(),
          cashCount: (() => { try { return z.cash_count_json ? JSON.parse(z.cash_count_json) : null; } catch (e) { return null; } })(),
          cashCount: (() => { try { return z.cash_count_json ? JSON.parse(z.cash_count_json) : null; } catch (e) { return null; } })(),
        })) }));
        return;
      }
      if (req.method === 'GET' && url.pathname === '/zeiterfassung/liste') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        const zeilen = this.db.prepare(`
          SELECT event_id, person_id, person_type, kind, recorded_at, effective_at, register_id,
                 event_name, source, correction_reason, shift_reason, voided_at, received_at
          FROM time_clock_events ORDER BY effective_at DESC LIMIT 2000
        `).all();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ zeiten: zeilen.map((z) => ({
          id: z.event_id, personId: z.person_id, personType: z.person_type, kind: z.kind,
          recordedAt: z.recorded_at, effectiveAt: z.effective_at, registerId: z.register_id,
          eventId: z.event_name, source: z.source, correctionReason: z.correction_reason,
          shiftReason: z.shift_reason, voidedAt: z.voided_at, receivedAt: z.received_at,
        })) }));
        return;
      }
      if (req.method === 'POST' && url.pathname === '/sold-out-status/setzen') {
        const addr = req.socket.remoteAddress || '';
        const isLoopback = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        if (!isLoopback) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'loopback_only' })); return; }
        let koerper = '';
        req.on('data', (c) => { koerper += c; if (koerper.length > 2048) req.destroy(); });
        req.on('end', () => {
          try {
            const daten = JSON.parse(koerper);
            if (!daten.articleId) throw new Error('payload_invalid');
            this.db.prepare(`
              INSERT INTO sold_out_status (article_id, sold_out, updated_at, updated_by_register) VALUES (?, ?, ?, ?)
              ON CONFLICT(article_id) DO UPDATE SET sold_out=excluded.sold_out, updated_at=excluded.updated_at, updated_by_register=excluded.updated_by_register
            `).run(daten.articleId, daten.soldOut ? 1 : 0, new Date().toISOString(), 'PC-Manager');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ gesetzt: true }));
          } catch (e) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'payload_invalid' })); }
        });
        return;
      }
      if (req.method === 'OPTIONS' && url.pathname === '/sold-out-status/setzen') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Methods', 'POST');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.writeHead(204); res.end();
        return;
      }
      /* 08.09.2026: Herzschlag der Kassen-Kopfzeile (pos/kc-kopfzeile.js). Vom Tablet aus ist nur
         dieser Klartext-Port erreichbar (die /api/v1-Seite ist HTTPS mit eigenem Zertifikat, das
         der Browser eines Tablets nicht annimmt). Verraet nur Kennung und Uhrzeit, offen fuer jeden
         Ursprung. */
      if (req.method === 'GET' && url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ status: 'ok', managerId: this.identity && this.identity.managerId, serverTime: new Date().toISOString() }));
        return;
      }
      if (req.method === 'GET' && url.pathname === '/verbindungsqualitaet') {
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        const limit = Math.min(1000, Math.max(1, parseInt(url.searchParams.get('limit'), 10) || 300));
        const zeilen = this.db.prepare('SELECT register_id, lag_ms, recorded_at FROM connection_quality_log ORDER BY id DESC LIMIT ?').all(limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ eintraege: zeilen.reverse() }));
        return;
      }
      if (req.method === 'GET' && url.pathname === '/live-event-log') {
        const addr = req.socket.remoteAddress || '';
        const isLoopback = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
        // CORS: PC-Manager (anderer Port, also anderer Ursprung aus Browsersicht) braucht diese
        // Kopfzeile, sonst blockiert der Browser die Antwort selbst bei erfolgreicher Anfrage.
        // Unbedenklich, da diese Route ohnehin nur von Loopback aus überhaupt etwas liefert.
        if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        if (!isLoopback) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'loopback_only' })); return; }
        const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit'), 10) || 200));
        const zeilen = this.db.prepare('SELECT type, register_id, payload, received_at FROM live_event_log ORDER BY id DESC LIMIT ?').all(limit);
        const ereignisse = zeilen.map((z) => ({ type: z.type, receivedAt: z.received_at, payload: JSON.parse(z.payload) }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ events: ereignisse }));
        return;
      }
      res.writeHead(404); res.end();
    });
    const wss = new WebSocketServer({ noServer: true });
    plainServer.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname !== '/live-monitor') { socket.destroy(); return; }
      const addr = socket.remoteAddress || '';
      const isLoopback = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
      if (!isLoopback) { socket.destroy(); return; }
      wss.handleUpgrade(req, socket, head, (ws) => {
        this._liveMonitorClients.add(ws);
        ws.on('close', () => this._liveMonitorClients.delete(ws));
        ws.on('error', () => this._liveMonitorClients.delete(ws));
      });
    });
    return new Promise((resolve, reject) => {
      plainServer.once('error', (err) => {
        this._liveMonitorServer = null;
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`kc_sync_live_monitor_port_in_use: Port ${port} ist bereits belegt. Start abgebrochen, kein automatischer Portwechsel.`));
        } else { reject(err); }
      });
      plainServer.once('listening', () => { this._liveMonitorServer = plainServer; resolve(plainServer); });
      plainServer.listen(port, '127.0.0.1');
    });
  }

  // Reicht ein Ereignis sofort an alle gerade verbundenen Live-Monitor-Fenster durch. Bewusst
  // ohne jede Persistenz oder Warteschlange - ist gerade kein Fenster verbunden, geht das
  // Ereignis für die Anzeige einfach verloren (die eigentliche Buchung ist davon unberührt,
  // die läuft über den bestehenden, zuverlässigen Sync-Kanal).
  broadcastLiveEvent(eventData) {
    if (!this._liveMonitorClients || !this._liveMonitorClients.size) return;
    const payload = JSON.stringify(eventData);
    for (const ws of this._liveMonitorClients) {
      if (ws.readyState === ws.OPEN) { try { ws.send(payload); } catch (e) { /* einzelner Client, kein Grund die anderen zu stören */ } }
    }
  }

  // Nimmt ein Live-Ereignis von einer gekoppelten Kasse entgegen. Authentisiert wie der
  // reguläre Sync-Kanal (dasselbe Credential), KEINE Sequenzprüfung, KEINE Idempotenz-Logik -
  // reine, schnelle Durchleitung. Seit Version 9 zusätzlich eine dauerhafte, aber bewusst
  // NACHRANGIGE Aufzeichnung (live_event_log) für Verlauf/Statistik - siehe Kommentar an der
  // Migration in db.js: dies ersetzt NICHT die eigentliche, maßgebliche Buchung
  // (received_events bleibt allein zuständig), sondern ergänzt sie um einen Verlauf dessen,
  // was live zu sehen war. Absichtlich weiterhin so schlank wie möglich gehalten, damit dieser
  // Kanal die eigentliche Kassenbuchung niemals verlangsamt - die Speicherung passiert NACH
  // der Antwort an die Kasse, ein Fehler dabei wird nur geloggt, nie weitergereicht.
  // Ein ueber den Sync-Kanal eingetroffenes Ereignis in die passende Fachtabelle uebernehmen.
  _uebernehmeFachereignis(ev) {
    const jetzt = new Date().toISOString();
    const p = ev.payload || {};

    if (ev.type === 'time_clock') {
      const einfuegen = this.db.prepare(`
        INSERT INTO time_clock_events
          (event_id, person_id, person_type, kind, recorded_at, effective_at,
           register_id, event_name, source, correction_reason, shift_reason, voided_at, received_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(event_id) DO UPDATE SET
          effective_at=excluded.effective_at, correction_reason=excluded.correction_reason,
          shift_reason=excluded.shift_reason, voided_at=excluded.voided_at
      `);
      for (const e of (Array.isArray(p.ereignisse) ? p.ereignisse : [p])) {
        if (!e || !e.id || !e.personId || !e.kind || !e.effectiveAt) continue;
        einfuegen.run(String(e.id), String(e.personId), e.personType || null, String(e.kind),
          String(e.recordedAt || e.effectiveAt), String(e.effectiveAt), e.registerId || null,
          e.eventId || null, e.source || null, e.correctionReason || null,
          e.shiftReason || null, e.voidedAt || null, jetzt);
      }
      return;
    }

    if (ev.type === 'voucher') {
      const einfuegen = this.db.prepare(`
        INSERT INTO vouchers (code, kind, amount, balance, issued_at, expires_at, issued_by_register, redemptions, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET balance=excluded.balance, redemptions=excluded.redemptions, updated_at=excluded.updated_at
      `);
      for (const g of (Array.isArray(p.gutscheine) ? p.gutscheine : [p])) {
        if (!g || !g.code) continue;
        einfuegen.run(String(g.code), g.kind || 'gutschein', Number(g.amount || 0), Number(g.balance || 0),
          String(g.issuedAt || jetzt), String(g.expiresAt || jetzt), g.registerId || g.issuedByRegister || null,
          JSON.stringify(g.redemptions || []), jetzt);
      }
      return;
    }

    if (ev.type === 'closing') {
      // NUR fertige Abschluesse. Ein Abschluss ohne ausdrueckliches "fertig" wird bewusst
      // nicht uebernommen: eine halbe Tageszahl im Manager waere schlimmer als gar keine,
      // weil sie aussieht wie eine richtige.
      if (p.status && p.status !== 'fertig') return;
      if (!p.closingId) return;
      this.db.prepare(`
        INSERT INTO closings (closing_id, register_id, register_name, created_at, period_start, period_end,
          status, cash_in, cash_sales, cash_tips, cash_out, expected_cash,
          staff_total, staff_count, transaction_count, note, payload, received_at,
          account_sales, total_sales, account_breakdown, cash_count_json)
        VALUES (?, ?, ?, ?, ?, ?, 'fertig', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(closing_id) DO UPDATE SET received_at=excluded.received_at, cash_count_json=COALESCE(excluded.cash_count_json,closings.cash_count_json)
      `).run(String(p.closingId), p.registerId || null, p.registerName || null,
        String(p.createdAt || jetzt), p.periodStart || null, p.periodEnd || null,
        Number(p.cashIn || 0), Number(p.cashSales || 0), Number(p.cashTips || 0),
        Number(p.cashOut || 0), Number(p.expectedCash || 0), Number(p.staffTotal || 0),
        Number(p.staffCount || 0), Number(p.transactionCount || 0), p.note || null,
        JSON.stringify(p), jetzt,
        /* 08.09.2026: Kontoumsatz (kein Bargeld), Gesamtumsatz, Aufteilung je Konto */
        Number(p.accountSales || 0), Number(p.totalSales || 0), JSON.stringify(p.accountBreakdown || []),
        p.cashCount ? JSON.stringify(p.cashCount) : null);
    }
  }

  // Den Datenschluessel einer Kasse ausliefern. Die Kasse wird ueber ihren Kopplungsnachweis
  // erkannt - eine Kasse kann den Schluessel einer anderen also nicht abrufen.
  _dataKeyGet(req, res) {
    // BEFUND aus dem Durchlauf: hier wurde der Kopfzeilenwert direkt als Kennung nachgeschlagen.
    // Der Kopf enthaelt aber Kennung UND Geheimnis - der Nachschlag ging immer ins Leere, und
    // die Kasse bekam nie einen Schluessel. Es gilt derselbe Weg wie bei den Stammdaten: die
    // regulaere Anmeldepruefung, die auch Sperrung, Ablauf und Rotation beruecksichtigt.
    const auth = this._authenticate(req);
    if (!auth.ok) { this._json(res, 401, { error: auth.error }); return; }
    const kopplung = auth.row;
    if (!kopplung?.register_label) { this._json(res, 403, { error: 'unknown_device' }); return; }
    const zeile = this.db.prepare('SELECT data_key, ausgabe FROM register_data_keys WHERE LOWER(register_id) = LOWER(?)')
      .get(kopplung.register_label);
    if (!zeile) { this._json(res, 404, { error: 'no_key_for_register' }); return; }
    this._json(res, 200, { registerId: kopplung.register_label, dataKey: zeile.data_key, ausgabe: zeile.ausgabe || 1 });
  }

  _liveEvent(req, res, body) {
    const auth = this._authenticate(req);
    if (!auth.ok) return this._json(res, 401, { error: auth.error });
    if (!body?.type || typeof body.type !== 'string') return this._json(res, 400, { error: 'payload_invalid' });
    // Kleine, bewusste Begrenzung gegen Missbrauch - auch ein "fire and forget"-Kanal darf nicht
    // beliebig große Nutzlasten durchreichen.
    if (JSON.stringify(body.payload || {}).length > 4096) return this._json(res, 400, { error: 'payload_too_large' });
    const ereignis = {
      type: body.type,
      deviceInstanceId: auth.row.device_instance_id,
      receivedAt: new Date().toISOString(),
      payload: body.payload || {},
    };
    this.broadcastLiveEvent(ereignis);
    this._json(res, 200, { received: true });
    // Grundlage für die Verbindungsüberwachung (siehe _pruefeVerbindungen()) - JEDES
    // Live-Ereignis zählt als Lebenszeichen dieser Kasse, nicht nur der Herzschlag.
    if (ereignis.payload.registerId) this._markKasseGesehen(ereignis.payload.registerId);
    if (ereignis.type === 'sold_out_changed' && ereignis.payload.articleId) {
      try {
        this.db.prepare(`
          INSERT INTO sold_out_status (article_id, sold_out, updated_at, updated_by_register) VALUES (?, ?, ?, ?)
          ON CONFLICT(article_id) DO UPDATE SET sold_out=excluded.sold_out, updated_at=excluded.updated_at, updated_by_register=excluded.updated_by_register
        `).run(ereignis.payload.articleId, ereignis.payload.soldOut ? 1 : 0, ereignis.receivedAt, ereignis.payload.registerId || null);
      } catch (e) { /* nachrangig, Live-Anzeige/Kassenbedienung nie beeinträchtigen */ }
    }
    if (ereignis.type === 'heartbeat' && typeof ereignis.payload.letzteBekannteLagMs === 'number') {
      try {
        this.db.prepare('INSERT INTO connection_quality_log (register_id, lag_ms, recorded_at) VALUES (?, ?, ?)')
          .run(ereignis.payload.registerId || null, ereignis.payload.letzteBekannteLagMs, ereignis.receivedAt);
      } catch (e) { /* Verlaufsspeicherung ist nachrangig */ }
    }
    if (ereignis.type !== 'heartbeat') {
      try {
        this.db.prepare('INSERT INTO live_event_log (type, register_id, payload, received_at) VALUES (?, ?, ?, ?)')
          .run(ereignis.type, ereignis.payload.registerId || null, JSON.stringify(ereignis.payload), ereignis.receivedAt);
      } catch (e) { /* Verlaufsspeicherung ist nachrangig - niemals die Live-Anzeige oder Kassenbedienung dadurch beeinträchtigen */ }
    }
  }

  // Serverseitige Verbindungsüberwachung (User-Wunsch: "Verbindung verloren/wiederhergestellt"
  // soll zuverlässig protokolliert werden, nicht nur wenn zufällig gerade ein PC-Manager-Fenster
  // offen ist). Der Manager selbst sieht JEDES Ereignis (auch den Herzschlag alle 15s) - erkennt
  // dadurch Aussetzer unabhängig davon, ob überhaupt jemand gerade zuschaut.
  _markKasseGesehen(registerId) {
    if (!this._kassenLetzteAktivitaet) this._kassenLetzteAktivitaet = new Map();
    if (!this._kassenAlsVerbundenMarkiert) this._kassenAlsVerbundenMarkiert = new Set();
    this._kassenLetzteAktivitaet.set(registerId, Date.now());
    if (!this._kassenAlsVerbundenMarkiert.has(registerId)) {
      this._kassenAlsVerbundenMarkiert.add(registerId);
      this._protokolliereVerbindungsEreignis('connection_regained', registerId);
    }
  }

  _protokolliereVerbindungsEreignis(type, registerId) {
    const ereignis = { type, deviceInstanceId: null, receivedAt: new Date().toISOString(), payload: { registerId } };
    this.broadcastLiveEvent(ereignis);
    try {
      this.db.prepare('INSERT INTO live_event_log (type, register_id, payload, received_at) VALUES (?, ?, ?, ?)')
        .run(type, registerId, JSON.stringify(ereignis.payload), ereignis.receivedAt);
    } catch (e) { /* Verlaufsspeicherung ist nachrangig */ }
  }

  // Alle paar Sekunden aufgerufen (siehe start()): Kassen, die länger als FRESHNESS_MS nichts
  // von sich hören ließen, werden EINMALIG als "Verbindung verloren" protokolliert (nicht bei
  // jeder Prüfung erneut) - kommt später wieder ein Lebenszeichen, markiert _markKasseGesehen()
  // sie automatisch als wiederhergestellt.
  _pruefeVerbindungen(freshnessMs = 30000) {
    if (!this._kassenLetzteAktivitaet || !this._kassenAlsVerbundenMarkiert) return;
    const jetzt = Date.now();
    for (const [registerId, zuletzt] of this._kassenLetzteAktivitaet) {
      if (jetzt - zuletzt > freshnessMs && this._kassenAlsVerbundenMarkiert.has(registerId)) {
        this._kassenAlsVerbundenMarkiert.delete(registerId);
        this._protokolliereVerbindungsEreignis('connection_lost', registerId);
      }
    }
  }

  // Zentrale Stammdaten (Warengruppen/Artikel/Pakete) - PC-Manager bleibt die einzige
  // Pflegestelle. Nur vom selben Rechner aus erreichbar (wie die Bargeldübergabe-Warteschlange),
  // da PC-Manager und Manager-Companion immer zusammen auf einer Maschine laufen.
  _masterDataPush(req, res, body) {
    const addr = req.socket.remoteAddress || '';
    const isLoopback = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
    if (!isLoopback) return this._json(res, 403, { error: 'loopback_only' });
    if (!Array.isArray(body?.groups) || !Array.isArray(body?.articles)) return this._json(res, 400, { error: 'payload_invalid' });
    const packages = Array.isArray(body?.packages) ? body.packages : [];
    const accounts = Array.isArray(body?.accounts) ? body.accounts : [];
    // Darstellung mitnehmen - aber NUR das, was der Betreiber verantwortet. Was am Gerät
    // haengt oder waehrend der Schicht persoenlich gewaehlt wird, bleibt ausdruecklich
    // aussen vor (siehe VERBOTEN unten): eine Kasse, die sich beim naechsten Abgleich eine
    // fremde Kassennummer holt oder dem Bediener die gewaehlte Anordnung wegnimmt, waere
    // schlimmer als gar keine Fernpflege.
    const VERBOTEN = new Set([
      'registerId', 'registerName',        // Gerätezuordnung - sonst meldet sich das Tablet als falsche Kasse
      'neuesLayout', 'spiegelModus',       // Ansicht - waehlt der Bediener fuer seine Schicht
      'nextBon', 'trainingMode', 'rushMode', // Betriebszustand des einzelnen Geräts
      'superAdminAccess', 'pinLockEnabled',
    ]);
    const roh = (body && typeof body.settings === 'object' && body.settings) || {};
    const settings = Object.fromEntries(Object.entries(roh).filter(([k]) => !VERBOTEN.has(k)));
    const bisher = this.db.prepare('SELECT revision FROM master_data WHERE id = 1').get();
    const neueRevision = (bisher?.revision || 0) + 1;
    this.db.prepare(`
      INSERT INTO master_data (id, groups_json, articles_json, packages_json, accounts_json, settings_json, revision, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET groups_json=excluded.groups_json, articles_json=excluded.articles_json, packages_json=excluded.packages_json, accounts_json=excluded.accounts_json, settings_json=excluded.settings_json, revision=excluded.revision, updated_at=excluded.updated_at
    `).run(JSON.stringify(body.groups), JSON.stringify(body.articles), JSON.stringify(packages), JSON.stringify(accounts), JSON.stringify(settings), neueRevision, new Date().toISOString());
    this._json(res, 200, { received: true, revision: neueRevision });
  }

  // Abruf durch jede gekoppelte Kasse - dieselbe Authentisierung wie der reguläre Sync-Kanal
  // (Zugangs-Schlüssel aus der Kopplung), damit nur echte, gekoppelte Kassen Stammdaten
  // erhalten, kein unautorisierter Zugriff von außen.
  // Signierte Gutscheinnummern auf Vorrat ausgeben.
  //
  // Der Vorrat ist der Grund, warum das Ganze am Stand auch ohne Verbindung funktioniert: die
  // Kasse holt sich ueber ihren Companion im Voraus einen Stapel Nummern und zieht am
  // Markttag offline daraus. Faellt das WLAN aus, koennen weiter Gutscheine verkauft werden,
  // solange der Vorrat reicht - und das Geheimnis liegt trotzdem nur hier.
  _voucherNumbersGet(req, res, url) {
    const auth = this._authenticate(req);
    if (!auth.ok) return this._json(res, 401, { error: auth.error });
    const anzahl = Number(url.searchParams.get('anzahl') || 20);
    try {
      const nummern = gutscheinSignatur.nummernVergeben(this.db, anzahl, auth.row?.register_label || auth.row?.device_instance_id || null);
      this._json(res, 200, { nummern, gesamt: nummern.length });
    } catch (fehler) {
      this._json(res, 500, { error: 'voucher_numbers_failed', detail: String(fehler.message || fehler) });
    }
  }

  // Dienstplan-Bruecke (siehe /dienstplan/push oben): eine Zeile mit dem vollstaendigen,
  // aktuellen Sollplan als JSON - Pseudonyme, NIE Klarnamen (das erledigt der PC-Manager beim
  // Abholen aus Supabase, bevor er hier ankommt).
  _dienstplanPush(req, res, body) {
    const addr = req.socket.remoteAddress || '';
    const isLoopback = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
    if (!isLoopback) return this._json(res, 403, { error: 'loopback_only' });
    if (!Array.isArray(body?.schichten)) return this._json(res, 400, { error: 'payload_invalid' });
    const bisher = this.db.prepare('SELECT revision FROM dienstplan WHERE id = 1').get();
    const neueRevision = (bisher?.revision || 0) + 1;
    this.db.prepare(`
      INSERT INTO dienstplan (id, schichten_json, revision, updated_at) VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET schichten_json=excluded.schichten_json, revision=excluded.revision, updated_at=excluded.updated_at
    `).run(JSON.stringify(body.schichten), neueRevision, new Date().toISOString());
    this._json(res, 200, { received: true, revision: neueRevision, anzahl: body.schichten.length });
  }

  // Abruf durch die Kassen (ueber den device-companion, siehe dort) - dieselbe Authentisierung
  // wie Stammdaten. Der Inhalt selbst ist bewusst fuer ALLE Bediener einsehbar (kein PIN-
  // Bereich in der Kasse), nur der Transportweg braucht eine echte Kopplung.
  _dienstplanGet(req, res) {
    const auth = this._authenticate(req);
    if (!auth.ok) return this._json(res, 401, { error: auth.error });
    const zeile = this.db.prepare('SELECT schichten_json, revision, updated_at FROM dienstplan WHERE id = 1').get();
    if (!zeile) return this._json(res, 200, { schichten: [], revision: 0, updatedAt: null });
    this._json(res, 200, {
      schichten: (() => { try { return JSON.parse(zeile.schichten_json || '[]'); } catch (e) { return []; } })(),
      revision: zeile.revision,
      updatedAt: zeile.updated_at,
    });
  }

  _masterDataGet(req, res) {
    const auth = this._authenticate(req);
    if (!auth.ok) return this._json(res, 401, { error: auth.error });
    const zeile = this.db.prepare('SELECT groups_json, articles_json, packages_json, accounts_json, settings_json, revision, updated_at FROM master_data WHERE id = 1').get();
    if (!zeile) return this._json(res, 200, { groups: [], articles: [], packages: [], accounts: [], settings: {}, revision: 0, updatedAt: null });
    this._json(res, 200, {
      groups: JSON.parse(zeile.groups_json),
      articles: JSON.parse(zeile.articles_json),
      packages: JSON.parse(zeile.packages_json),
      accounts: (() => { try { return JSON.parse(zeile.accounts_json || '[]'); } catch (e) { return []; } })(),
      settings: (() => { try { return JSON.parse(zeile.settings_json || '{}'); } catch (e) { return {}; } })(),
      revision: zeile.revision,
      updatedAt: zeile.updated_at,
    });
  }

  // Fernbefehl für DIESE Kasse abholen (z.B. "Stammdaten sofort neu laden") - dieselbe
  // Authentisierung wie der reguläre Sync-Kanal, liefert nur Befehle für das eigene
  // register_label. Markiert den Befehl direkt als zugestellt (wird nicht erneut geliefert).
  _remoteCommandPoll(req, res) {
    const auth = this._authenticate(req);
    if (!auth.ok) return this._json(res, 401, { error: auth.error });
    const label = String(auth.row.register_label || '').trim().toLowerCase();
    const zeile = this.db.prepare(
      'SELECT id, command FROM remote_commands WHERE LOWER(register_id) = ? AND delivered = 0 ORDER BY created_at ASC LIMIT 1'
    ).get(label);
    if (!zeile) return this._json(res, 200, { befehl: null });
    this.db.prepare('UPDATE remote_commands SET delivered = 1, delivered_at = ? WHERE id = ?').run(new Date().toISOString(), zeile.id);
    this._json(res, 200, { befehl: zeile.command });
  }

  // Liefert den kompletten, aktuellen Ausverkauft-Stand - jede Kasse gleicht bei jedem
  // regulären Sync (alle 15s) komplett ab, kein Delta nötig (üblicherweise eine kleine Liste).
  _soldOutStatusGet(req, res) {
    const auth = this._authenticate(req);
    if (!auth.ok) return this._json(res, 401, { error: auth.error });
    const zeilen = this.db.prepare('SELECT article_id, sold_out FROM sold_out_status WHERE sold_out = 1').all();
    this._json(res, 200, { ausverkauft: zeilen.map((z) => z.article_id) });
  }

  // Liefert die Zeitbuchungen aller Kassen fuer die Anwesenheits-Ampel. Bewusst dieselbe
  // Begrenzung (2000, neueste zuerst) wie /zeiterfassung/liste fuer den PC-Manager selbst -
  // hier zusaetzlich angemeldet, weil die Anfrage ueber echtes Netzwerk (Kasse -> Companion ->
  // Manager) laeuft, nicht nur lokal auf demselben Rechner.
  _zeiterfassungStatusGet(req, res) {
    const auth = this._authenticate(req);
    if (!auth.ok) return this._json(res, 401, { error: auth.error });
    const zeilen = this.db.prepare(`
      SELECT event_id, person_id, person_type, kind, effective_at, voided_at
      FROM time_clock_events ORDER BY effective_at DESC LIMIT 2000
    `).all();
    this._json(res, 200, { ereignisse: zeilen.map((z) => ({
      id: z.event_id, personId: z.person_id, personType: z.person_type,
      kind: z.kind, effectiveAt: z.effective_at, voidedAt: z.voided_at,
    })) });
  }

  // Liefert die gespeicherte Verlaufsliste der Live-Ereignisse (neueste zuerst) - für PC-Manager,
  // um beim Öffnen des Live-Monitors nicht bei null anzufangen, sondern die letzte Zeit
  // nachzuladen. limit begrenzt bewusst, damit eine einzelne Anfrage nicht unbegrenzt groß wird.
  // (Verlaufs-Abruf läuft jetzt über den unverschlüsselten Loopback-Server in
  // _setupLiveMonitor() - siehe dort, gleicher Grund wie beim Live-Monitor-WebSocket selbst.)

  // Money Butler legt hier eine Bargeldübergabe für eine bestimmte Kasse ab. Läuft nur lokal
  // (Money Butler ist Teil des PC-Managers, derselbe Rechner) - kein Gerät-Zugangsschlüssel
  // nötig, dafür strikt auf localhost begrenzt, damit niemand von außen Übergaben einschleusen kann.
  _cashTransferQueue(req, res, body) {
    const addr = req.socket.remoteAddress || '';
    const isLoopback = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
    if (!isLoopback) return this._json(res, 403, { error: 'loopback_only' });
    if (!body?.registerLabel || typeof body.registerLabel !== 'string') return this._json(res, 400, { error: 'register_label_missing' });
    if (!body?.transferId || typeof body.transferId !== 'string' || body.transferId.length > 128) return this._json(res, 400, { error: 'transfer_id_invalid' });
    if (!body?.payload || typeof body.payload !== 'object' || JSON.stringify(body.payload).length > 8192) return this._json(res, 400, { error: 'payload_invalid' });
    try {
      this.db.prepare(
        'INSERT INTO cash_transfer_queue (transfer_id, register_label, payload, created_at, delivered) VALUES (?, ?, ?, ?, 0)'
      ).run(body.transferId, body.registerLabel.trim().toLowerCase(), JSON.stringify(body.payload), new Date().toISOString());
    } catch (e) {
      // gleiche transferId nochmal abgelegt (z.B. Doppelklick) - kein Fehler, einfach ignorieren
      if (!String(e.message || '').includes('UNIQUE')) return this._json(res, 500, { error: 'queue_write_failed' });
    }
    // Fuer die Planungsstatistik gleich mitschreiben. Schlaegt das fehl, ist die Uebergabe
    // selbst davon unberuehrt - Wechselgeld hat Vorrang vor Statistik.
    try { this._protokolliereUebergabe(body.payload, 'wlan'); }
    catch (e) { /* Statistik ist nachrangig, Uebergabe laeuft weiter */ }
    this._json(res, 200, { queued: true });
  }

  // Eine Bargeldübergabe MIT ihrer Stückelung für die spätere Auswertung festhalten.
  //
  // Die Kennung der Übergabe ist der Schlüssel: derselbe Vorgang darf mehrfach gemeldet werden
  // (der QR-Weg meldet aus dem PC-Manager, der WLAN-Weg meldet hier beim Einreihen) und steht
  // trotzdem nur einmal in der Tabelle. Gemeldet wird der Datensatz, wie er auch zur Kasse geht.
  _protokolliereUebergabe(payload, quelle) {
    if (!payload || typeof payload !== 'object' || !payload.transferId) return false;
    this.db.prepare(`
      INSERT INTO cash_transfer_log
        (transfer_id, register_id, type, effective_date, created_at, source,
         total, loose_total, roll_total, breakdown, loose_breakdown, coin_rolls, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(transfer_id) DO UPDATE SET
        register_id=excluded.register_id, type=excluded.type, effective_date=excluded.effective_date,
        total=excluded.total, loose_total=excluded.loose_total, roll_total=excluded.roll_total,
        breakdown=excluded.breakdown, loose_breakdown=excluded.loose_breakdown,
        coin_rolls=excluded.coin_rolls, note=excluded.note
    `).run(
      // Eine Geldkassette gehoert keiner einzelnen Kasse - sie bekommt eine eigene, lesbare
      // Kennung, damit sie in der Statistik nicht ohne Zuordnung dasteht (gleiche Schreibweise
      // wie beim QR-Weg aus dem Money Butler).
      String(payload.transferId), (payload.scope === 'split' ? 'KASSETTE' : payload.registerId) || null, payload.type || null,
      payload.effectiveDate || null, payload.time || new Date().toISOString(), quelle || null,
      Number(payload.total || 0), Number(payload.looseTotal || 0), Number(payload.rollTotal || 0),
      JSON.stringify(payload.breakdown || {}), JSON.stringify(payload.looseBreakdown || {}),
      JSON.stringify(payload.coinRolls || {}), payload.note || null,
    );
    return true;
  }

  // Ein Uebergabeprotokoll festhalten. Schluessel ist die Belegnummer, damit derselbe Beleg
  // ueber beide Wege (automatische Meldung und spaeteres Nachtragen per QR) ankommen darf und
  // trotzdem nur einmal im Archiv steht. Die Pruefsumme wird hier NICHT nachgerechnet - das
  // macht die Seite, die den Beleg einliest, bevor sie ihn ueberhaupt meldet.
  // Prüfsumme eines Übergabebelegs - dieselbe Rechnung wie in shared/kc-uebergabeprotokoll.js
  // (FNV-1a über den Beleg OHNE das Feld pruef). Bewusst hier nachgebildet, weil der Dienst
  // kein Browsermodul laden kann; die Testreihe vergleicht beide Wege gegeneinander.
  static _belegPruefsumme(beleg) {
    const kopie = { ...beleg };
    delete kopie.pruef;
    const text = JSON.stringify(kopie);
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }

  _protokolliereBeleg(beleg, quelle) {
    if (!beleg || typeof beleg !== 'object' || !beleg.id) return false;
    if (beleg.f !== 'KC_UEBERGABE_PROTOKOLL') return false;
    // BEFUND aus der TÜV-Prüfung: bis hierher wurde die mitgelieferte Prüfsumme NIE geprüft.
    // Ein Beleg mit veränderter Summe (300 € -> 3.000 €) wurde deshalb mit ok:true angenommen
    // und hat über ON CONFLICT den echten Eintrag im Archiv ÜBERSCHRIEBEN. Das Archiv ist der
    // Nachweis über die Geldübergaben - es muss sich darauf verlassen können.
    // Jetzt gilt: ohne gültige Prüfsumme kommt nichts ins Archiv.
    const erwartet = ManagerCompanion._belegPruefsumme(beleg);
    const mitgeliefert = String(beleg.pruef || '').toLowerCase();
    if (!mitgeliefert || mitgeliefert !== erwartet) return false;
    // Zusätzlich: ein bereits abgelegter Beleg darf nicht durch einen inhaltlich ANDEREN
    // mit derselben Belegnummer ersetzt werden. Dieselbe Meldung zweimal ist harmlos und
    // bleibt erlaubt (der Money Butler und das Nachtragen vom Papier melden denselben Beleg).
    const vorhanden = this.db.prepare('SELECT payload FROM cash_protocol_log WHERE beleg_id = ?').get(String(beleg.id));
    if (vorhanden && vorhanden.payload) {
      let alt = null;
      try { alt = JSON.parse(vorhanden.payload); } catch (e) { alt = null; }
      if (alt && String(alt.pruef || '').toLowerCase() !== mitgeliefert) return false;
    }
    this.db.prepare(`
      INSERT INTO cash_protocol_log
        (beleg_id, transfer_id, art, typ, effective_date, created_at, received_at, source,
         registers, total, note, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(beleg_id) DO UPDATE SET
        transfer_id=excluded.transfer_id, art=excluded.art, typ=excluded.typ,
        effective_date=excluded.effective_date, registers=excluded.registers,
        total=excluded.total, note=excluded.note, payload=excluded.payload
    `).run(
      String(beleg.id), beleg.tid || null, beleg.art || null, beleg.typ || null,
      beleg.datum || null, beleg.erstellt || new Date().toISOString(), new Date().toISOString(),
      quelle || null, JSON.stringify(beleg.kassen || []), Number(beleg.summe || 0),
      beleg.notiz || null, JSON.stringify(beleg),
    );
    return true;
  }

  // Die Kasse holt hier ab, ob eine Bargeldübergabe für SIE (ihr eigenes register_label aus der
  // Kopplung) bereitliegt - dieselbe Authentifizierung wie beim normalen Sync-Kanal, damit nur
  // die tatsächlich gepaarte, richtige Kasse ihre eigenen Übergaben sieht.
  _cashTransferPending(req, res) {
    const auth = this._authenticate(req);
    if (!auth.ok) return this._json(res, 401, { error: auth.error });
    const label = String(auth.row.register_label || '').trim().toLowerCase();
    if (!label) return this._json(res, 200, { pending: null });
    const row = this.db.prepare(
      'SELECT transfer_id, payload FROM cash_transfer_queue WHERE register_label = ? AND delivered = 0 ORDER BY created_at ASC LIMIT 1'
    ).get(label);
    if (!row) return this._json(res, 200, { pending: null });
    let payload;
    try { payload = JSON.parse(row.payload); } catch { return this._json(res, 200, { pending: null }); }
    this._json(res, 200, { pending: { transferId: row.transfer_id, payload } });
  }

  // Die Kasse bestätigt, dass sie die Übergabe wirklich übernommen hat - erst danach gilt sie
  // als zugestellt und wird nicht erneut ausgeliefert.
  _cashTransferAck(req, res, body) {
    const auth = this._authenticate(req);
    if (!auth.ok) return this._json(res, 401, { error: auth.error });
    if (!body?.transferId || typeof body.transferId !== 'string') return this._json(res, 400, { error: 'transfer_id_missing' });
    const label = String(auth.row.register_label || '').trim().toLowerCase();
    this.db.prepare(
      'UPDATE cash_transfer_queue SET delivered = 1, delivered_at = ? WHERE transfer_id = ? AND register_label = ?'
    ).run(new Date().toISOString(), body.transferId, label);
    this._json(res, 200, { acknowledged: true });
  }

  // 10.09.2026 (Betreiber: Finance Bridge, Money Butler zuhause -> PC Manager -> Kasse, mit
  // bewusster Bestaetigung an der Kasse statt automatischer Uebernahme): eigene, drei zu den
  // drei Funktionen direkt darueber ANALOGE Handler - selbes Muster, eigene Tabelle
  // (finance_bridge_transfers), damit der bestehende, automatische WLAN-Weg (cash_transfer_
  // queue) unveraendert weiterlaeuft und beide sich nie vermischen koennen.
  //
  // Der PC Manager selbst legt hier ab (loopback-only, dasselbe Muster wie Money Butler oben) -
  // NACHDEM er die Uebergabe aus der zentralen Finance Bridge (Supabase) geholt und "An Kasse
  // freigeben" angetippt hat.
  _financeTransferQueue(req, res, body) {
    const addr = req.socket.remoteAddress || '';
    const isLoopback = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
    if (!isLoopback) return this._json(res, 403, { error: 'loopback_only' });
    if (!body?.registerLabel || typeof body.registerLabel !== 'string') return this._json(res, 400, { error: 'register_label_missing' });
    if (!body?.transferId || typeof body.transferId !== 'string' || body.transferId.length > 128) return this._json(res, 400, { error: 'transfer_id_invalid' });
    if (!body?.payload || typeof body.payload !== 'object' || JSON.stringify(body.payload).length > 8192) return this._json(res, 400, { error: 'payload_invalid' });
    try {
      this.db.prepare(
        'INSERT INTO finance_bridge_transfers (transfer_id, register_label, payload, created_at, delivered) VALUES (?, ?, ?, ?, 0)'
      ).run(body.transferId, body.registerLabel.trim().toLowerCase(), JSON.stringify(body.payload), new Date().toISOString());
    } catch (e) {
      // dieselbe transferId nochmal abgelegt (z.B. Doppelklick auf "freigeben") - kein Fehler.
      if (!String(e.message || '').includes('UNIQUE')) return this._json(res, 500, { error: 'queue_write_failed' });
    }
    this._json(res, 200, { queued: true });
  }

  // Die Kasse fragt hier ab, ob eine ueber die Finance Bridge freigegebene Geldfuellung fuer
  // SIE bereitliegt - dieselbe Authentifizierung wie beim normalen Sync-Kanal.
  _financeTransferPending(req, res) {
    const auth = this._authenticate(req);
    if (!auth.ok) return this._json(res, 401, { error: auth.error });
    const label = String(auth.row.register_label || '').trim().toLowerCase();
    if (!label) return this._json(res, 200, { pending: null });
    const row = this.db.prepare(
      'SELECT transfer_id, payload FROM finance_bridge_transfers WHERE register_label = ? AND delivered = 0 ORDER BY created_at ASC LIMIT 1'
    ).get(label);
    if (!row) return this._json(res, 200, { pending: null });
    let payload;
    try { payload = JSON.parse(row.payload); } catch { return this._json(res, 200, { pending: null }); }
    this._json(res, 200, { pending: { transferId: row.transfer_id, payload } });
  }

  // Die Kasse bestaetigt hier ausdruecklich "Uebernehmen" angetippt UND den Betrag lokal
  // erfolgreich gebucht zu haben - erst danach gilt der Eintrag als zugestellt. Ein reines
  // Abholen (GET pending) zaehlt NICHT als Zustellung, sonst wuerde ein Wegtippen ohne echte
  // Buchung die Uebergabe unwiderruflich verschwinden lassen.
  _financeTransferAck(req, res, body) {
    const auth = this._authenticate(req);
    if (!auth.ok) return this._json(res, 401, { error: auth.error });
    if (!body?.transferId || typeof body.transferId !== 'string') return this._json(res, 400, { error: 'transfer_id_missing' });
    const label = String(auth.row.register_label || '').trim().toLowerCase();
    this.db.prepare(
      'UPDATE finance_bridge_transfers SET delivered = 1, delivered_at = ? WHERE transfer_id = ? AND register_label = ?'
    ).run(new Date().toISOString(), body.transferId, label);
    this._json(res, 200, { acknowledged: true });
  }


  _checkAdmin(req) {
    const addr = req.socket.remoteAddress || '';
    const isLoopback = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
    if (!isLoopback) return { ok: false, addr, error: 'admin_only_loopback', status: 403 };
    const provided = req.headers['x-kc-admin-token'] || '';
    if (!this._adminTokenMatches(provided)) return { ok: false, addr, error: 'admin_token_invalid', status: 403 };
    return { ok: true, addr };
  }

  // Eng gefasste Ausnahme NUR für die Fernkopplung (Manager zuhause, Kasse am Markt) - im
  // Unterschied zu _checkAdmin() bewusst OHNE Loopback-Zwang, da hier per Definition ein
  // Zugriff von außen (übers Internet) nötig ist. Verlangt weiterhin denselben Admin-Schlüssel
  // wie jede andere Admin-Aktion - wer den Schlüssel nicht hat, kommt auch hier nicht rein.
  _checkAdminFernzugriff(req) {
    const provided = req.headers['x-kc-admin-token'] || '';
    if (!this._adminTokenMatches(provided)) return { ok: false, error: 'admin_token_invalid', status: 403 };
    return { ok: true };
  }

  _revoke(req, res, body) {
    // Widerruf darf nur der Betreiber am Manager selbst auslösen. Loopback allein ist keine
    // starke Authentisierung - zusätzlich ein beim Start erzeugtes Admin-Token verlangen.
    const admin = this._checkAdmin(req);
    if (!admin.ok) {
      this._writeAuditLog('revoke', body?.deviceInstanceId || null, admin.addr, admin.error === 'admin_only_loopback' ? 'rejected_not_loopback' : 'rejected_bad_token');
      return this._json(res, admin.status, { error: admin.error });
    }
    // Befund D-07: Admin-Aktionen wurden bisher gar nicht protokolliert (wer, wann, wofür,
    // mit welchem Ergebnis) - jetzt in admin_audit_log nachvollziehbar.
    this.db.prepare('UPDATE credentials SET revoked = 1 WHERE device_instance_id = ?').run(body.deviceInstanceId);
    this._writeAuditLog('revoke', body.deviceInstanceId, admin.addr, 'ok');
    this._json(res, 200, { revoked: true });
  }

  // Baustufe 3: Zertifikatserneuerung OHNE neue Kopplung. Nutzt denselben Schlüssel weiter
  // (siehe identity.js) - der Fingerprint bleibt unverändert, bereits gekoppelte Kassen
  // vertrauen dem neuen Zertifikat automatisch weiter. Wird SOFORT auf den laufenden Server
  // angewendet (kein Neustart nötig), damit keine Downtime für bereits verbundene Kassen entsteht.
  async _renewCertificate(req, res, body) {
    const admin = this._checkAdmin(req);
    if (!admin.ok) {
      this._writeAuditLog('renew_certificate', null, admin.addr, admin.error === 'admin_only_loopback' ? 'rejected_not_loopback' : 'rejected_bad_token');
      return this._json(res, admin.status, { error: admin.error });
    }
    try {
      const result = await renewCertificate(this.db, this.identity.key, body?.days || 3650);
      this.identity.cert = result.cert;
      this.server.setSecureContext({ cert: result.cert, key: this.identity.key }); // live übernehmen, kein Neustart
      this._writeAuditLog('renew_certificate', null, admin.addr, 'ok');
      this._json(res, 200, { fingerprint: result.fingerprint, validTo: result.validTo });
    } catch (err) {
      this._writeAuditLog('renew_certificate', null, admin.addr, 'error: ' + err.message);
      this._json(res, 500, { error: 'certificate_renewal_failed', message: err.message });
    }
  }

  // Baustufe 3: technische Diagnoseinformationen OHNE Geheimnisse - explizit keine Credentials,
  // Token, Schlüssel oder Hashes davon, nur Zähler/Zeitstempel/Zustände für die Fehlersuche.
  _diagnostics(req, res) {
    const admin = this._checkAdmin(req);
    if (!admin.ok) return this._json(res, admin.status, { error: admin.error });
    const counts = {
      credentials: this.db.prepare('SELECT COUNT(*) n FROM credentials').get().n,
      revokedCredentials: this.db.prepare('SELECT COUNT(*) n FROM credentials WHERE revoked = 1').get().n,
      receivedEvents: this.db.prepare('SELECT COUNT(*) n FROM received_events').get().n,
      sequenceAnomalies: this.db.prepare('SELECT COUNT(*) n FROM sequence_anomalies').get().n,
      auditLogEntries: this.db.prepare('SELECT COUNT(*) n FROM admin_audit_log').get().n,
    };
    const devices = this.db.prepare('SELECT device_instance_id, highest_seen, highest_contiguous FROM last_acked_sequence').all();
    const auditChain = this.verifyAuditChain();
    this._json(res, 200, {
      managerId: this.identity.managerId,
      uptimeSeconds: Math.round((Date.now() - this._startedAt) / 1000),
      serverTime: new Date().toISOString(),
      counts,
      devices,
      auditChainIntact: auditChain.ok,
      certificateFingerprint: this.identity.fingerprint,
    });
  }

  // Baustufe 3: kontrollierte Dead-Letter-Bearbeitung. "retry" gibt dem Ereignis eine weitere
  // Chance (Manager kann es nicht selbst erneut anfordern - die Kasse muss es erneut senden,
  // dafür wird hier nur der Betreiber-Wunsch protokolliert), "discard" markiert es als bewusst
  // aufgegeben. Fiskalische Ereignisse werden dabei nie gelöscht, nur der Bearbeitungsstatus
  // protokolliert.
  _deadLetterAction(req, res, body) {
    const admin = this._checkAdmin(req);
    if (!admin.ok) return this._json(res, admin.status, { error: admin.error });
    const { deviceInstanceId, eventId, action, note } = body || {};
    if (!deviceInstanceId || !eventId || !['retry', 'discard'].includes(action)) {
      return this._json(res, 400, { error: 'payload_invalid' });
    }
    this.db.prepare('INSERT INTO dead_letter_actions (device_instance_id, event_id, action, operator_note, at) VALUES (?, ?, ?, ?, ?)')
      .run(deviceInstanceId, eventId, action, note || null, new Date().toISOString());
    this._writeAuditLog(`dead_letter_${action}`, deviceInstanceId, admin.addr, 'ok');
    this._json(res, 200, { recorded: true });
  }

  _adminTokenMatches(provided) { return timingSafeStringEqual(provided, this.adminToken); }

  // Credential-Rotation: eine bereits gekoppelte Kasse kann ihr Credential erneuern, ohne
  // erneut per QR koppeln zu müssen - z.B. planmäßig vor Ablauf, oder um nach einem verlorenen
  // Antwortpaket ohne Aussperrung fortzufahren.
  //
  // Befund D-03: Routine-Rotation (verlorene Antwort, Wiederholung durch dasselbe Gerät) und
  // Sicherheitswiderruf bei Kompromittierungsverdacht sind zwei verschiedene Dinge und dürfen
  // nicht über denselben Mechanismus laufen. Eine Wiederholung mit dem alten Credential wird
  // deshalb nur noch dann idempotent mit dem bereits erzeugten Nachfolge-Credential beantwortet,
  // wenn zusätzlich dieselbe, vom Gerät selbst erzeugte Rotations-Nonce mitgeschickt wird (die
  // das Gerät lokal für genau diesen einen Rotationsversuch vorhält, bis er bestätigt ist). Wer
  // nur das nackte alte Credential besitzt (z.B. aus einem separaten Leck, ohne die lokal
  // gespeicherte Nonce des Geräts), bekommt KEIN Nachfolge-Credential ausgehändigt - bei
  // echtem Kompromittierungsverdacht bleibt der sofortige Admin-Widerruf (siehe _revoke) der
  // richtige Weg, nicht die Rotation.
  _rotateCredential(req, res, body) {
    const auth = this._authenticate(req);
    if (!auth.ok) return this._json(res, 401, { error: auth.error });

    // Befund (Sechster Nachprüfbericht, HOCH, AKTIV BESTÄTIGT): das bloße Vorweisen des ALTEN
    // Credentials genügte bisher, um das Nachfolge-Geheimnis auch VOR dessen erster Nutzung zu
    // erhalten - ein Angreifer, dem nur dieses eine (kompromittierte) Bearer-Credential
    // zugespielt wurde, konnte dasselbe tun wie die echte Kasse. Jetzt wird zusätzlich der bei
    // Kopplung/letzter Rotation separat ausgegebene Wiederherstellungsnachweis verlangt (nur
    // sein Hash liegt in der Datenbank, der Klartext wurde nur einmal über den ursprünglichen,
    // bereits durch Fingerprint-Pinning geschützten Kanal übertragen) - ein Angreifer mit
    // ausschließlich dem Bearer-Credential besitzt diesen zweiten Nachweis nicht und scheitert
    // hier, unabhängig davon ob der Nachfolger schon beansprucht wurde oder nicht.
    const presentedResumeKey = req.headers['x-kc-resume-key'] || '';
    if (!auth.row.resume_key_hash || !presentedResumeKey || !timingSafeStringEqual(hashSecret(presentedResumeKey), auth.row.resume_key_hash)) {
      return this._json(res, 401, { error: 'resume_key_invalid' });
    }

    if (auth.row.superseded_by) {
      const successor = this.db.prepare('SELECT * FROM credentials WHERE credential_id = ?').get(auth.row.superseded_by);
      if (successor && !successor.claimed && successor.pending_secret) {
        // Wiederaufnahme nach verlorener Antwort bleibt möglich (derselbe gültige
        // Wiederherstellungsnachweis liegt vor) - liefert exakt dasselbe, bereits ausgestellte
        // Geheimnis erneut, erzeugt kein neues. Befund G-01: der zurückgelieferte resumeKey
        // muss der des NACHFOLGERS sein (pending_resume_key), nicht der zur Authentisierung
        // dieser Anfrage präsentierte (der gehört zum jetzt abgelösten alten Credential und
        // passt nicht zum resume_key_hash des Nachfolgers).
        return this._json(res, 200, { credentialId: `${successor.credential_id}.${successor.pending_secret}`, credentialExpiresAt: successor.expires_at, resumeKey: successor.pending_resume_key });
      }
      return this._json(res, 409, { error: 'rotation_already_completed' });
    }

    let issued;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      issued = this._issueCredential(auth.row.device_instance_id, auth.row.register_label, undefined, { unclaimed: true });
      // Altes Credential wird NICHT sofort widerrufen, sondern nur als "abgelöst" markiert -
      // bleibt für ROTATION_GRACE_MS zusätzlich nutzbar (Wiederaufnahme nach verlorener Antwort,
      // N-01), aber NICHT für regulären Sync/Status (siehe _authenticate).
      this.db.prepare('UPDATE credentials SET superseded_by = ?, superseded_at = ? WHERE credential_id = ?')
        .run(issued.row.credential_id, new Date().toISOString(), auth.row.credential_id);
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      return this._json(res, 500, { error: 'internal_error', message: err.message });
    }
    this._json(res, 200, { credentialId: issued.credentialId, credentialExpiresAt: issued.credentialExpiresAt, resumeKey: issued.resumeKey });
  }

  // Test-/Ausfall-Hilfsmittel, kein Teil des Vertrags:
  appliedCount() { return this.db.prepare('SELECT COUNT(*) AS n FROM received_events').get().n; }
  anomalies(kind) { return kind ? this.db.prepare('SELECT * FROM sequence_anomalies WHERE kind = ?').all(kind) : this.db.prepare('SELECT * FROM sequence_anomalies').all(); }
  auditLog(action) { return action ? this.db.prepare('SELECT * FROM admin_audit_log WHERE action = ?').all(action) : this.db.prepare('SELECT * FROM admin_audit_log').all(); }

  // Befund D-07 vertieft (Baustufe 3): jeder Eintrag verkettet einen Hash über seinen eigenen
  // Inhalt UND den Hash des unmittelbar vorherigen Eintrags. Eine nachträgliche Änderung,
  // Löschung oder Einfügung MITTEN in der Kette macht ALLE nachfolgenden Hashes ungültig -
  // ohne externes System nachweisbar über verifyAuditChain().
  //
  // Befund B3-M01 (Betriebs-Gate B): das Löschen des NEUESTEN Eintrags blieb bisher unentdeckt -
  // die Kette allein hat kein Konzept von "wo sollte sie enden", ein sauber verkürztes Ende
  // bleibt intern vollkommen widerspruchsfrei. Deshalb wird der jeweils letzte Hash zusätzlich
  // in einer EIGENEN, außerhalb der Datenbank liegenden Ankerdatei festgehalten - wer den
  // letzten Eintrag aus der Datenbank löscht, müsste zusätzlich auch diese separate Datei
  // unbemerkt anpassen.
  _auditAnchorPath() {
    if (this.dbPath === ':memory:') return null;
    return this.dbPath + '.audit-anchor.json';
  }

  _writeAuditLog(action, targetDeviceInstanceId, remoteAddress, result) {
    const at = new Date().toISOString();
    // Nur die letzte Zeile MIT vorhandenem Hash zählt als Kettenvorgänger - eine Alt-Zeile aus
    // der Zeit vor Baustufe 3 (entry_hash NULL) wird hier genauso übersprungen wie beim Prüfen
    // in verifyAuditChain(). Beide Seiten müssen exakt dieselbe Regel anwenden, sonst bricht
    // die Kette schon an der ersten echten Zeile nach einer Alt-Zeile.
    const last = this.db.prepare('SELECT entry_hash FROM admin_audit_log WHERE entry_hash IS NOT NULL ORDER BY id DESC LIMIT 1').get();
    const prevHash = last ? last.entry_hash : 'GENESIS';
    const entryHash = crypto.createHash('sha256')
      .update(`${prevHash}|${action}|${targetDeviceInstanceId || ''}|${remoteAddress || ''}|${result}|${at}`)
      .digest('hex');
    const info = this.db.prepare(
      'INSERT INTO admin_audit_log (action, target_device_instance_id, remote_address, result, at, entry_hash, prev_hash) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(action, targetDeviceInstanceId || null, remoteAddress || null, result, at, entryHash, prevHash);
    const anchorPath = this._auditAnchorPath();
    if (anchorPath) {
      fs.writeFileSync(anchorPath, JSON.stringify({ lastId: Number(info.lastInsertRowid), lastHash: entryHash, count: (this.db.prepare('SELECT COUNT(*) n FROM admin_audit_log WHERE entry_hash IS NOT NULL').get().n) }));
    }
  }

  // Prüft die gesamte Kette von Anfang an UND gleicht das Ende gegen den externen Anker ab.
  // Liefert { ok:true } oder { ok:false, brokenAtId } bzw. { ok:false, reason:'tail_mismatch' },
  // wenn die Kette intern zwar widerspruchsfrei ist, aber nicht mehr zum zuletzt bekannten,
  // extern festgehaltenen Endpunkt passt (z. B. weil der letzte Eintrag gelöscht wurde).
  verifyAuditChain() {
    const rows = this.db.prepare('SELECT * FROM admin_audit_log ORDER BY id ASC').all();
    let prevHash = 'GENESIS';
    for (const row of rows) {
      if (row.entry_hash === null) continue; // Eintrag aus der Zeit vor Baustufe 3, keine Kette möglich
      const expected = crypto.createHash('sha256')
        .update(`${prevHash}|${row.action}|${row.target_device_instance_id || ''}|${row.remote_address || ''}|${row.result}|${row.at}`)
        .digest('hex');
      if (expected !== row.entry_hash || row.prev_hash !== prevHash) return { ok: false, brokenAtId: row.id };
      prevHash = row.entry_hash;
    }
    const actualCount = rows.filter((r) => r.entry_hash !== null).length;
    const anchorPath = this._auditAnchorPath();
    if (anchorPath) {
      if (!fs.existsSync(anchorPath)) {
        // Gate-B-Schlusskorrektur: eine fehlende Ankerdatei wurde bisher stillschweigend
        // übersprungen (fail-open) - das entwertete den ganzen Zweck des Ankers, denn genau ein
        // gelöschter/fehlender Anker wäre die naheliegendste Art, die Erkennung zu umgehen. Gilt
        // NICHT als Fehler, wenn der Audit-Log selbst noch leer ist (frische Installation, für
        // die legitimerweise noch nie ein Anker geschrieben wurde).
        if (actualCount > 0) return { ok: false, reason: 'anchor_missing' };
      } else {
        let anchor;
        try {
          anchor = JSON.parse(fs.readFileSync(anchorPath, 'utf8'));
        } catch (err) {
          return { ok: false, reason: 'anchor_corrupted', message: err.message };
        }
        if (typeof anchor?.count !== 'number' || typeof anchor?.lastHash !== 'string') {
          return { ok: false, reason: 'anchor_corrupted', message: 'Ankerdatei hat kein gültiges Format' };
        }
        if (anchor.count !== actualCount || anchor.lastHash !== prevHash) {
          return { ok: false, reason: 'tail_mismatch', expected: anchor, actualCount, actualLastHash: prevHash };
        }
      }
    }
    return { ok: true };
  }
  simulateResponseDrop() { this._dropNextResponse = true; }

  // Baustufe 3: Speichergrenzen / Log-Rotation. WICHTIG: received_events (die eigentlichen
  // Umsatzdaten samt Deduplizierungsschutz) werden hier bewusst NIE gelöscht - nur reine
  // Diagnose-/Protokolldaten, deren unbegrenztes Wachstum sonst über Monate hinweg den
  // Speicherverbrauch treiben würde. sequence_anomalies sind nach Ablauf der Aufbewahrungsfrist
  // ohne fachlichen Wert mehr (reine Betriebsdiagnose); das Auditprotokoll wird NICHT gelöscht
  // (Manipulationsschutz durch Hash-Kette wäre sonst zwecklos), sondern nur summarisch
  // gemeldet, wenn es sehr groß wird.
  pruneOperationalData(retentionDays = 90, liveEventRetentionDays = 30, lagRetentionDays = 7) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 3600 * 1000).toISOString();
    const anomalies = this.db.prepare('DELETE FROM sequence_anomalies WHERE detected_at < ?').run(cutoff);
    const deadLetterActions = this.db.prepare('DELETE FROM dead_letter_actions WHERE at < ?').run(cutoff);
    const liveEventCutoff = new Date(Date.now() - liveEventRetentionDays * 24 * 3600 * 1000).toISOString();
    const liveEvents = this.db.prepare('DELETE FROM live_event_log WHERE received_at < ?').run(liveEventCutoff);
    const lagCutoff = new Date(Date.now() - lagRetentionDays * 24 * 3600 * 1000).toISOString();
    const lagEintraege = this.db.prepare('DELETE FROM connection_quality_log WHERE recorded_at < ?').run(lagCutoff);
    return { prunedAnomalies: anomalies.changes, prunedDeadLetterActions: deadLetterActions.changes, prunedLiveEvents: liveEvents.changes, prunedLag: lagEintraege.changes };
  }
}

module.exports = { ManagerCompanion };
