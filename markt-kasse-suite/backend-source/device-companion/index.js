// KC Sync Baustufe 2.2 – Kassen-Companion (natives Programm, kein Browser-Tab, löst A-01).
// mDNS/DNS-SD-Suche ist gezielt auf die GEPINNTE Manager-ID gefiltert (A-03) - findet die
// Suche einen Dienst mit abweichender ID oder abweichendem Fingerprint, wird er ignoriert,
// nie automatisch übernommen.
'use strict';
const https = require('https');
const crypto = require('crypto');
const { Bonjour } = require('bonjour-service');
const { openDeviceDb } = require('./db');

const SERVICE_TYPE = 'kcsync';
const API_VERSION = '1.0';
// Vorrat an Gutscheinnummern: unter MIN wird auf TARGET aufgefuellt.
const VOUCHER_STOCK_MIN = 10;
const VOUCHER_STOCK_TARGET = 40;
const API_MAJOR = API_VERSION.split('.')[0];

class DeviceCompanion {
  constructor({ dbPath = ':memory:' } = {}) {
    this.db = openDeviceDb(dbPath);
    this._ensureIdentity();
    this.knownManagerHost = null; // {host, port} der zuletzt erfolgreich erreichten Adresse
    // Mehrgeräte-Betrieb: erkennt, wenn ein ZWEITES physisches Gerät dieselbe Kassen-Adresse
    // nutzt (z.B. versehentlich dieselbe Tablet-Adresse zweimal geöffnet). Rein im
    // Arbeitsspeicher - kein hartes Sperren, nur eine Warnung fuer beide Seiten.
    this._activeSession = null; // { sessionId, lastSeenAt }
  }

  _ensureIdentity() {
    const row = this.db.prepare('SELECT * FROM device_identity WHERE id = 1').get();
    if (row) { this.deviceInstanceId = row.device_instance_id; this.sequenceNumber = row.sequence_number; return; }
    this.deviceInstanceId = crypto.randomUUID();
    this.sequenceNumber = 0;
    this.db.prepare('INSERT INTO device_identity (id, device_instance_id, sequence_number) VALUES (1, ?, 0)')
      .run(this.deviceInstanceId);
  }

  get pinned() {
    const row = this.db.prepare('SELECT pinned_manager_id, pinned_fingerprint, credential_id, pending_rotation_nonce, resume_key FROM device_identity WHERE id = 1').get();
    return { managerId: row.pinned_manager_id, fingerprint: row.pinned_fingerprint, credentialId: row.credential_id, pendingRotationNonce: row.pending_rotation_nonce, resumeKey: row.resume_key };
  }

  // Mehrgeräte-Betrieb am Marktstand: Zugangs-Schlüssel für den lokalen Status-/Ereignis-Server,
  // wenn er (für ein Tablet als eigene Kasse) auch aus dem WLAN erreichbar ist - ersetzt dort
  // "läuft auf demselben Rechner" als Vertrauensgrenze. Wird beim ersten Zugriff einmalig
  // erzeugt und bleibt danach über Neustarts stabil.
  get kasseAccessToken() {
    const row = this.db.prepare('SELECT kasse_access_token FROM device_identity WHERE id = 1').get();
    if (row.kasse_access_token) return row.kasse_access_token;
    const token = crypto.randomBytes(24).toString('base64url');
    this.db.prepare('UPDATE device_identity SET kasse_access_token = ? WHERE id = 1').run(token);
    return token;
  }

  // Sicherheitsebene 2: Nachrichtenverschlüsselung für den lokalen Tablet<->Kasse-Kanal (bisher
  // unverschlüsseltes HTTP, bewusst so gebaut um Browser-Zertifikatswarnungen bei
  // selbstsignierten Zertifikaten zu vermeiden - siehe Sicherheitskonzept). Der Schlüssel wird
  // aus dem bereits vorhandenen Zugangs-Schlüssel abgeleitet (SHA-256) - kein neuer Austausch
  // noetig, beide Seiten kennen den Zugangs-Schlüssel bereits. AES-256-GCM (Web-Crypto-Standard),
  // mit Zeitstempel im Klartext-Anteil gegen Replay-Angriffe (eine mitgeschnittene, spaeter
  // wiederholte Nachricht wird als zu alt erkannt und abgelehnt).
  _encryptionKey() {
    return crypto.createHash('sha256').update(this.kasseAccessToken).digest();
  }

  // Entschlüsselt eine eingehende Nachricht, falls sie verschlüsselt ankam (erkennbar am Feld
  // "encrypted"). Unverschlüsselte Nachrichten werden weiterhin akzeptiert (Rückwärtskompatibilität
  // waehrend der Umstellung, z.B. wenn Kasse und Tablet noch unterschiedliche Dateiversionen
  // haben) - liefert dafuer aber KEINE Wiedergabeschutz-Garantie.
  _decryptIfNeeded(parsed) {
    if (!parsed?.encrypted) return parsed;
    try {
      const key = this._encryptionKey();
      const iv = Buffer.from(parsed.iv, 'base64');
      const data = Buffer.from(parsed.data, 'base64');
      const tag = data.subarray(data.length - 16);
      const ciphertext = data.subarray(0, data.length - 16);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
      const inner = JSON.parse(plaintext);
      // Replay-Schutz: eine mitgeschnittene, spaeter wiederholte Nachricht ist aelter als 60s alt.
      if (typeof inner.ts !== 'number' || Math.abs(Date.now() - inner.ts) > 60000) {
        throw new Error('nachricht_zu_alt_oder_zeitstempel_fehlt');
      }
      return inner.payload;
    } catch (err) {
      throw new Error('entschluesselung_fehlgeschlagen: ' + err.message);
    }
  }

  // Kopplung per QR-Einmaltoken (A-02). Der Fingerprint kommt aus dem QR-Code selbst
  // (out-of-band, dort steht er neben Token/Adresse) - er wird NICHT aus einer ersten, noch
  // ungesicherten /health-Antwort übernommen. Schon der allererste Kontakt wird also gegen
  // einen unabhängig bekannten Fingerprint geprüft.
  async pair({ pairingToken, expectedFingerprint, host, port, registerLabel }) {
    if (!expectedFingerprint) throw new Error('expectedFingerprint_required'); // kein blindes Erstvertrauen
    const health = await this._request({ host, port }, 'GET', '/api/v1/health', undefined, {}, expectedFingerprint);
    if (health.publicKeyFingerprint !== expectedFingerprint) throw new Error('manager_identity_mismatch');
    const res = await this._request({ host, port }, 'POST', '/api/v1/pair', {
      pairingToken, deviceInstanceId: this.deviceInstanceId, registerLabel: registerLabel || 'Kasse (Prototyp)',
    }, {}, expectedFingerprint);
    if (res.error) throw new Error(res.error);
    // Ab hier gepinnt: künftige Verbindungen müssen managerId UND Fingerprint bestätigen (A-03).
    // Befund H-01 (Sechster Nachprüfbericht): der bei der Kopplung separat ausgegebene
    // Wiederherstellungsnachweis wird von hier an für jede spätere Rotation zusätzlich zum
    // Bearer-Credential benötigt - er wird NIE über denselben Kanal wie reguläre Sync-Aufrufe
    // erneut übertragen, nur bei Kopplung und bei jeder erfolgreichen Rotation neu ausgegeben.
    this.db.prepare('UPDATE device_identity SET pinned_manager_id = ?, pinned_fingerprint = ?, credential_id = ?, resume_key = ? WHERE id = 1')
      .run(health.managerId, health.publicKeyFingerprint, res.credentialId, res.resumeKey);
    this.knownManagerHost = { host, port };
    // Befund T-01: die Ausweich-Adresse ist jetzt automatisch Teil jeder Kopplung, nicht ein
    // separater, leicht vergessener manueller Schritt - besonders wichtig auf Plattformen
    // (laut Prüfbericht: Windows), auf denen mDNS unzuverlässig sein kann. Die beim Pairing
    // ohnehin schon bekannte, per QR bestätigte Adresse wird direkt als Rückfallebene übernommen.
    this.setStaticFallback(host, port);
    return res;
  }

  // Manuelle Ausweich-Adresse hinterlegen/lesen (Befund T-01: mDNS ist plattformabhängig
  // unzuverlässig, u.a. unter Windows/Node v24 im Prüfbericht bestätigt) - dokumentierter,
  // expliziter Ausweg statt stillem Scheitern. Wird trotzdem beim Verbindungsaufbau gegen den
  // gepinnten Fingerprint geprüft, ist also kein Vertrauensbruch gegenüber A-03.
  setStaticFallback(host, port) {
    this.db.prepare('UPDATE device_identity SET static_fallback_host = ?, static_fallback_port = ? WHERE id = 1').run(host, port);
  }
  get staticFallback() {
    const row = this.db.prepare('SELECT static_fallback_host, static_fallback_port FROM device_identity WHERE id = 1').get();
    return row?.static_fallback_host ? { host: row.static_fallback_host, port: row.static_fallback_port } : null;
  }

  // Sucht per echtem mDNS/DNS-SD nach der GEPINNTEN Manager-ID (A-01, A-03). Kein Scan über
  // IP-Bereiche. Liefert null, wenn nichts Passendes innerhalb des Zeitlimits gefunden wird -
  // versucht danach, falls hinterlegt, die manuelle Ausweich-Adresse.
  async discoverPinnedManager(timeoutMs = 4000) {
    const pinned = this.pinned;
    if (!pinned.managerId) return null; // noch nicht gekoppelt - Discovery macht hier keinen Sinn
    const bonjour = new Bonjour();
    const mdnsResult = await new Promise((resolve) => {
      const browser = bonjour.find({ type: SERVICE_TYPE });
      const done = (result) => { browser.stop(); bonjour.destroy(); resolve(result); };
      browser.on('up', (svc) => {
        if (svc.txt?.managerId === pinned.managerId && svc.txt?.fingerprint === pinned.fingerprint) {
          const addr = svc.addresses?.find((a) => a.includes('.')) || svc.host;
          done({ host: addr, port: svc.port });
        }
        // Dienste mit abweichender ID/Fingerprint werden bewusst ignoriert (A-03) - kein Fallback-Raten
      });
      setTimeout(() => done(null), timeoutMs);
    });
    if (mdnsResult) return mdnsResult;

    const fallback = this.staticFallback;
    if (!fallback) return null;
    try {
      const health = await this._request(fallback, 'GET', '/api/v1/health', undefined, {}, pinned.fingerprint);
      if (health.managerId === pinned.managerId && health.publicKeyFingerprint === pinned.fingerprint) return fallback;
    } catch (e) { /* Ausweich-Adresse nicht erreichbar oder falscher Manager - kein Ausweg */ }
    return null;
  }

  recordEvent(type, payload) {
    const nextSeq = this.sequenceNumber + 1;
    const event = {
      eventId: crypto.randomUUID(),
      sequenceNumber: nextSeq,
      type,
      payload,
      createdAtDeviceTime: new Date().toISOString(),
    };
    // Beleg + Outbox-Eintrag + Sequenznummer-Fortschreibung ECHT atomar: entweder alles drei
    // oder nichts, nie ein inkonsistenter Zwischenstand.
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare(
        'INSERT INTO outbox (event_id, sequence_number, type, payload, created_at_device, status) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(event.eventId, event.sequenceNumber, type, JSON.stringify(payload), event.createdAtDeviceTime, 'pending');
      this.db.prepare('UPDATE device_identity SET sequence_number = ? WHERE id = 1').run(nextSeq);
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
    this.sequenceNumber = nextSeq;
    this._localWriteSeq = (this._localWriteSeq || 0) + 1; this._lastLocalWriteAt = Date.now(); // Baustufe 3/4: Aktivitäts-LED
    return event.eventId;
  }

  pendingCount() {
    return this.db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE status = 'pending'").get().n;
  }
  // Befund N-06: Sichtbarkeit für den Betreiber statt stillem Verwerfen - fiskalische Ereignisse
  // dürfen nicht unbemerkt verschwinden, auch wenn sie nicht automatisch nachgeliefert werden.
  deadLetterEvents() {
    return this.db.prepare("SELECT event_id, sequence_number, type, attempts, last_error FROM outbox WHERE status IN ('dead_letter','oversized')").all();
  }

  // Baustufe 3: Speichergrenze - bereits vom Manager bestätigte (acked) Einträge haben nach
  // Ablauf der Aufbewahrungsfrist keinen fachlichen Wert mehr (die Deduplizierung läuft über
  // den Manager, nicht über die lokale Outbox) und würden die Kassen-Datenbank sonst über
  // Monate hinweg unbegrenzt wachsen lassen. dead_letter/oversized bleiben unangetastet, bis
  // der Betreiber sie bewusst bearbeitet hat.
  pruneAcked(retentionDays = 30) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 3600 * 1000).toISOString();
    const result = this.db.prepare("DELETE FROM outbox WHERE status = 'acked' AND created_at_device < ?").run(cutoff);
    return { pruned: result.changes };
  }

  // Erneuert das Credential über das bereits vorhandene, gültige Credential - kein erneutes
  // QR-Scannen nötig.
  //
  // Befund (Vierter Nachprüfbericht) + D-03 gemeinsam neu durchdacht: der bisherige
  // Nonce-Mechanismus wurde entfernt (siehe ausführliche Begründung im Manager). Das erneute
  // Vorweisen desselben alten, noch gültigen Credentials ist die einzig sinnvolle Berechtigung,
  // die an dieser Stelle geprüft werden kann - eine Wiederholung nach einer verlorenen Antwort
  // funktioniert dadurch automatisch, ohne dass die Kasse sich zusätzlich einen Nonce merken muss.
  async rotateCredential() {
    const pinned = this.pinned;
    if (!pinned.credentialId) throw new Error('not_paired');
    const target = this.knownManagerHost || (await this.discoverPinnedManager());
    if (!target) throw new Error('unreachable');

    const res = await this._request(target, 'POST', '/api/v1/credential/rotate', {},
      { 'X-KC-Credential': pinned.credentialId, 'X-KC-Resume-Key': pinned.resumeKey || '' }, pinned.fingerprint);
    if (res.error) throw new Error(res.error);
    this.db.prepare('UPDATE device_identity SET credential_id = ?, resume_key = ? WHERE id = 1').run(res.credentialId, res.resumeKey || pinned.resumeKey);
    return res;
  }

  async _syncInternal() {
    const MAX_BATCH_SIZE = 200; // muss zur Server-Obergrenze passen (siehe manager-companion/index.js)
    const MAX_BATCH_BYTES = 200 * 1024; // etwas Sicherheitsabstand zum 256-KB-Serverlimit
    const pinned = this.pinned;
    if (!pinned.credentialId) return { synced: 0, reason: 'not_paired' };

    let target = this.knownManagerHost;
    if (target) {
      const health = await this._request(target, 'GET', '/api/v1/health', undefined, {}, pinned.fingerprint).catch(() => null);
      if (!health || health.managerId !== pinned.managerId || health.publicKeyFingerprint !== pinned.fingerprint) {
        target = null; // gemerkte Adresse ungültig, falscher Manager, oder TLS-Fingerprint weicht ab
      }
    }
    if (!target) {
      target = await this.discoverPinnedManager();
      if (!target) return { synced: 0, reason: 'unreachable' };
      this.knownManagerHost = target;
    }

    const pendingRows = this.db.prepare("SELECT * FROM outbox WHERE status = 'pending' ORDER BY sequence_number").all();
    const allEvents = pendingRows.map((r) => ({ eventId: r.event_id, sequenceNumber: r.sequence_number, type: r.type, payload: JSON.parse(r.payload), createdAtDeviceTime: r.created_at_device }));

    // Befund D-02: Batches wurden bisher mit JSON.stringify(ev).length gemessen - das zählt
    // UTF-16-Codeeinheiten, nicht die tatsächlich über das Netz gesendeten UTF-8-Bytes, und
    // ignoriert die Größe des umschließenden Anfragekörpers (deviceInstanceId, Klammern,
    // Kommata). Ein Batch mit Umlauten/Emoji/CJK-Zeichen konnte das Serverlimit dadurch
    // trotzdem überschreiten. Jetzt wird der TATSÄCHLICH zu sendende Anfragekörper serialisiert
    // und mit Buffer.byteLength(...,'utf8') gemessen.
    const bodyBytes = (events) => Buffer.byteLength(JSON.stringify({ deviceInstanceId: this.deviceInstanceId, events }), 'utf8');
    const batches = [];
    let current = [];
    const markOversized = this.db.prepare("UPDATE outbox SET status = 'oversized' WHERE event_id = ?");
    for (const ev of allEvents) {
      const singleEventBytes = bodyBytes([ev]);
      if (singleEventBytes > MAX_BATCH_BYTES) {
        // Ein einzelnes Ereignis, das für sich allein schon das Limit sprengt, kann in keinem
        // Batch jemals ankommen - würde sonst bei jedem sync()-Versuch erneut hängen bleiben.
        // Wird als 'oversized' markiert (nicht mehr 'pending'), damit es nicht endlos wiederholt
        // wird. Vollständige Wiederherstellung/Bearbeitung dieses Zustands ist Teil des noch
        // offenen Befunds N-06 (Dead-Letter) und hier bewusst nicht vollständig gelöst.
        markOversized.run(ev.eventId);
        console.error(`[KC Sync] Einzelnes Ereignis ${ev.eventId} überschreitet allein das Batch-Limit (${singleEventBytes} Bytes) und wurde als 'oversized' markiert.`);
        continue;
      }
      const candidate = [...current, ev];
      if (current.length && (candidate.length > MAX_BATCH_SIZE || bodyBytes(candidate) > MAX_BATCH_BYTES)) {
        batches.push(current); current = [ev];
      } else {
        current = candidate;
      }
    }
    if (current.length) batches.push(current);
    // Befund (Gate-B-Schlusskorrektur 1): auch OHNE neue Verkäufe muss sich die Kasse beim
    // Manager melden - sonst werden Dead-Letter-Aktionen (B3-M02) nie abgeholt, solange zufällig
    // keine neuen Ereignisse anfallen. Ein leerer "Check-in"-Batch übernimmt diese Rolle, ohne
    // dass echte Nutzdaten gesendet werden müssen.
    if (!batches.length) batches.push([]);

    let totalSynced = 0, lastReason = 'empty';
    for (const events of batches) {
      let res;
      try {
        res = await this._request(target, 'POST', '/api/v1/sync/push',
          { deviceInstanceId: this.deviceInstanceId, events },
          { 'X-KC-Credential': pinned.credentialId },
          pinned.fingerprint
        );
      } catch (e) { return { synced: totalSynced, reason: totalSynced ? 'partial_network_error' : 'network_error' }; } // bereits gesendete Batches bleiben bestätigt, Rest bleibt 'pending'

      if (res.error) {
        if (res.error === 'credential_revoked') {
          this.db.prepare('UPDATE device_identity SET credential_id = NULL WHERE id = 1').run(); // erzwingt Neukopplung (A-02)
        }
        return { synced: totalSynced, reason: res.error };
      }
      const done = [...(res.acknowledged || []), ...(res.duplicates || [])];
      const markAcked = this.db.prepare("UPDATE outbox SET status = 'acked' WHERE event_id = ?");
      for (const eventId of done) markAcked.run(eventId);

      // Befund B3-M02 (Betriebs-Gate B): "retry"/"discard" waren bisher reine Wünsche im
      // Manager-Protokoll ohne tatsächliche Wirkung auf der Kasse. Wird jetzt hier wirklich
      // angewendet: "retry" gibt dem Ereignis eine neue Chance (zurück auf 'pending', damit der
      // nächste sync()-Lauf es erneut versucht), "discard" schließt es endgültig von weiteren
      // Versuchen aus. Die Bestätigung geht über einen kleinen, sofortigen Folgeaufruf zurück,
      // damit dieselbe Aktion nicht bei jedem weiteren Sync erneut zugestellt wird.
      if (Array.isArray(res.pendingDeadLetterActions) && res.pendingDeadLetterActions.length) {
        const retryEvent = this.db.prepare("UPDATE outbox SET status = 'pending', attempts = 0, last_error = NULL WHERE event_id = ? AND status IN ('dead_letter','oversized')");
        const discardEvent = this.db.prepare("UPDATE outbox SET status = 'discarded' WHERE event_id = ? AND status IN ('dead_letter','oversized')");
        for (const dla of res.pendingDeadLetterActions) {
          if (dla.action === 'retry') retryEvent.run(dla.event_id);
          else if (dla.action === 'discard') discardEvent.run(dla.event_id);
        }
        try {
          await this._request(target, 'POST', '/api/v1/sync/push',
            { deviceInstanceId: this.deviceInstanceId, events: [], acknowledgedDeadLetterActionIds: res.pendingDeadLetterActions.map((a) => a.id) },
            { 'X-KC-Credential': pinned.credentialId }, pinned.fingerprint);
        } catch (e) { /* Bestätigung nicht angekommen - Manager liefert die Aktion beim nächsten Sync einfach erneut, bereits angewendet ist sie lokal trotzdem */ }
      }

      // Befund N-06: dauerhaft ungültige Ereignisse (strukturell falsch, echter Sequenzkonflikt)
      // wurden bisher endlos wiederholt, weil nur 'acknowledged'/'duplicates' lokal abgeschlossen
      // wurden. Permanent abgelehnte Ereignisse gehen jetzt in einen "dead_letter"-Ruhezustand
      // (analog zum bereits vorhandenen 'oversized'-Zustand) statt bei jedem Sync erneut Bandbreite
      // und Serverzeit zu verbrauchen. Fiskalische Ereignisse werden dabei NICHT stillschweigend
      // gelöscht, nur von der automatischen Wiederholung ausgenommen - für den Betreiber bleiben
      // sie über deadLetterEvents() sichtbar und einsehbar.
      const markDeadLetter = this.db.prepare("UPDATE outbox SET status = 'dead_letter', attempts = attempts + 1, last_error = ? WHERE event_id = ?");
      const bumpAttempts = this.db.prepare("UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE event_id = ?");
      for (const r of (res.rejected || [])) {
        if (!r || !r.eventId) continue;
        if (r.permanent) markDeadLetter.run(r.reason || 'rejected', r.eventId);
        else bumpAttempts.run(r.reason || 'rejected', r.eventId);
      }

      // Befund M-01 (Sechster Nachprüfbericht): der Manager kann bei Verwendung eines noch
      // im Altformat vorliegenden Credentials eine automatische Aufwertung mitteilen - wird
      // sie mitgeschickt, übernimmt die Kasse das neue Credential sofort und transparent für
      // alle künftigen Aufrufe, ohne dass ein Betreiber manuell eingreifen muss.
      if (res.credentialUpgrade?.credentialId) {
        this.db.prepare('UPDATE device_identity SET credential_id = ?, resume_key = COALESCE(?, resume_key) WHERE id = 1')
          .run(res.credentialUpgrade.credentialId, res.credentialUpgrade.resumeKey || null);
      }

      totalSynced += done.length;
      lastReason = done.length ? 'ok' : 'no_progress';
      if (!done.length) break; // kein Fortschritt in diesem Batch - nicht endlos weiterversuchen
    }
    return { synced: totalSynced, reason: lastReason };
  }

  // Baustufe 3: äußere Hülle um die eigentliche Synchronisation, die für die Ampel-/Aktivitäts-
  // Anzeige den Versuchs- und Erfolgszeitpunkt sowie eine etwaige Fehlerursache PERSISTENT
  // festhält (nicht nur im Arbeitsspeicher) - eine Oberfläche muss auch direkt nach einem
  // Neustart der Kasse den zuletzt bekannten, echten Zustand zeigen können, nicht "unbekannt".
  async sync() {
    const attemptAt = new Date().toISOString();
    this.db.prepare('UPDATE device_identity SET last_sync_attempt_at = ? WHERE id = 1').run(attemptAt);
    let result;
    try {
      result = await this._syncInternal();
    } catch (err) {
      this.db.prepare('UPDATE device_identity SET last_sync_error = ? WHERE id = 1').run(err.message);
      throw err;
    }
    if (result.reason === 'ok' || result.reason === 'empty' || result.reason === 'no_progress') {
      this.db.prepare('UPDATE device_identity SET last_sync_success_at = ?, last_sync_error = NULL WHERE id = 1').run(new Date().toISOString());
    } else {
      this.db.prepare('UPDATE device_identity SET last_sync_error = ? WHERE id = 1').run(result.reason);
    }
    // Stammdaten-Abruf ist bewusst NACHRANGIG zum eigentlichen, zuverlässigen Buchungs-Sync -
    // ein Problem hierbei (z. B. Manager kurz nicht erreichbar) darf den obigen, wichtigeren
    // Sync-Erfolg niemals verfälschen oder verzögern.
    try { await this._syncMasterData(); await this._syncDataKey(); } catch (e) { /* nächster Versuch beim nächsten Sync-Zyklus */ }
    try { await this._syncRemoteCommand(); } catch (e) { /* nächster Versuch beim nächsten Sync-Zyklus */ }
    try { await this._syncSoldOutStatus(); } catch (e) { /* nächster Versuch beim nächsten Sync-Zyklus */ }
    try { await this._syncZeiterfassungStatus(); } catch (e) { /* nächster Versuch beim nächsten Sync-Zyklus */ }
    try { await this._syncDienstplan(); } catch (e) { /* nächster Versuch beim nächsten Sync-Zyklus */ }
    try { await this._syncVoucherNumbers(); } catch (e) { /* nächster Versuch beim nächsten Sync-Zyklus */ }
    return result;
  }

  // Holt den Datenschlüssel dieser Kasse vom Manager und legt ihn lokal ab.
  //
  // So bekommt das Tablet ihn morgens, ohne dass jemand etwas eingibt - genau die Vorgabe:
  // keine zusätzlichen Schritte am Marktmorgen. Fehlt das Netz, öffnet die gedruckte Karte.
  async _syncDataKey() {
    const pinned = this.pinned;
    if (!pinned.credentialId) return;
    const target = this.knownManagerHost;
    if (!target) return;
    try {
      const antwort = await this._request(target, 'GET', '/api/v1/data-key', undefined,
        { 'X-KC-Credential': pinned.credentialId }, pinned.fingerprint);
      if (antwort?.dataKey) {
        const setzen = this.db.prepare(`
          INSERT INTO local_settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
        setzen.run('data_key', String(antwort.dataKey));
        setzen.run('data_key_ausgabe', String(antwort.ausgabe || 1));
      }
    } catch (e) { /* kein Schlüssel hinterlegt oder Manager weg - die Karte bleibt der Weg */ }
  }

  // Holt die aktuellen Stammdaten vom Manager, aber NUR wenn sich die Revisionsnummer
  // tatsächlich geändert hat (spart unnötige Übertragung bei jedem Sync-Zyklus).
  async _syncMasterData() {
    const pinned = this.pinned;
    if (!pinned.credentialId) return;
    const target = this.knownManagerHost;
    if (!target) return;
    const antwort = await this._request(target, 'GET', '/api/v1/master-data', undefined, { 'X-KC-Credential': pinned.credentialId }, pinned.fingerprint);
    if (!antwort || typeof antwort.revision !== 'number') return;
    const bisher = this.db.prepare('SELECT revision FROM master_data_cache WHERE id = 1').get();
    if (bisher && bisher.revision >= antwort.revision) return; // schon aktuell
    this.db.prepare(`
      INSERT INTO master_data_cache (id, groups_json, articles_json, packages_json, accounts_json, settings_json, revision, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET groups_json=excluded.groups_json, articles_json=excluded.articles_json, packages_json=excluded.packages_json, accounts_json=excluded.accounts_json, settings_json=excluded.settings_json, revision=excluded.revision, updated_at=excluded.updated_at
    `).run(JSON.stringify(antwort.groups || []), JSON.stringify(antwort.articles || []), JSON.stringify(antwort.packages || []), JSON.stringify(antwort.accounts || []), JSON.stringify(antwort.settings || {}), antwort.revision, antwort.updatedAt || new Date().toISOString());
  }

  async _syncRemoteCommand() {
    const pinned = this.pinned;
    if (!pinned.credentialId) return;
    const target = this.knownManagerHost;
    if (!target) return;
    const antwort = await this._request(target, 'GET', '/api/v1/remote-command', undefined, { 'X-KC-Credential': pinned.credentialId }, pinned.fingerprint);
    if (!antwort?.befehl) return;
    this._wartenderBefehl = antwort.befehl;
    if (antwort.befehl === 'reload_stammdaten') {
      // Erzwingt beim nächsten Sync einen vollständigen Neuabruf, egal ob sich die
      // Revisionsnummer seitdem geändert hat - für den Fall, dass der Betreiber gezielt
      // "jetzt neu laden" ausgelöst hat, auch ohne echte inhaltliche Änderung.
      try { this.db.prepare('DELETE FROM master_data_cache WHERE id = 1').run(); } catch (e) { /* nicht kritisch */ }
    }
  }

  // Vorrat an signierten Gutscheinnummern auffuellen.
  //
  // Nachgefuellt wird nur, wenn der Vorrat zur Neige geht - nicht bei jedem Zyklus. Der
  // Manager vergibt die Nummern fortlaufend und merkt sich jede einzelne; jede unnoetig
  // abgeholte Nummer waere eine Luecke in der Nummernfolge, die spaeter niemand erklaeren kann.
  async _syncVoucherNumbers() {
    const pinned = this.pinned;
    if (!pinned.credentialId) return;
    const target = this.knownManagerHost;
    if (!target) return;
    const vorhanden = this.db.prepare('SELECT COUNT(*) AS n FROM voucher_number_stock').get().n;
    if (vorhanden >= VOUCHER_STOCK_MIN) return;
    const antwort = await this._request(target, 'GET', `/api/v1/voucher-numbers?anzahl=${VOUCHER_STOCK_TARGET - vorhanden}`,
      undefined, { 'X-KC-Credential': pinned.credentialId }, pinned.fingerprint);
    const nummern = Array.isArray(antwort?.nummern) ? antwort.nummern : [];
    if (!nummern.length) return;
    const einfuegen = this.db.prepare(
      'INSERT OR IGNORE INTO voucher_number_stock (code, qr, fetched_at) VALUES (?, ?, ?)');
    const jetzt = new Date().toISOString();
    for (const n of nummern) {
      if (n?.nummer && n?.qr) einfuegen.run(String(n.nummer), String(n.qr), jetzt);
    }
  }

  async _syncSoldOutStatus() {
    const pinned = this.pinned;
    if (!pinned.credentialId) return;
    const target = this.knownManagerHost;
    if (!target) return;
    const antwort = await this._request(target, 'GET', '/api/v1/sold-out-status', undefined, { 'X-KC-Credential': pinned.credentialId }, pinned.fingerprint);
    if (!antwort || !Array.isArray(antwort.ausverkauft)) return;
    this._ausverkauftListe = antwort.ausverkauft;
  }

  // Anwesenheits-Ampel: holt die Zeitbuchungen ALLER Kassen vom Manager, damit die eigene
  // Kasse eine LED je Pseudonym zeigen kann, die auch weiss, wer an einer ANDEREN Kasse
  // gestempelt hat - nicht nur an sich selbst. Bleibt bei Fehlschlag beim zuletzt bekannten
  // Stand (kein Absturz, keine leere Anzeige nur wegen eines einzelnen verpassten Zyklus).
  async _syncZeiterfassungStatus() {
    const pinned = this.pinned;
    if (!pinned.credentialId) return;
    const target = this.knownManagerHost;
    if (!target) return;
    const antwort = await this._request(target, 'GET', '/api/v1/zeiterfassung-status', undefined, { 'X-KC-Credential': pinned.credentialId }, pinned.fingerprint);
    if (!antwort || !Array.isArray(antwort.ereignisse)) return;
    this._zeiterfassungEreignisse = antwort.ereignisse;
  }

  // Dienstplan (Sollplan aus dp2, ueber den PC-Manager) - fuer die Kalender-/Blaetterpfeil-
  // Ansicht in der Kasse, frei einsehbar fuer alle Kollegen.
  async _syncDienstplan() {
    const pinned = this.pinned;
    if (!pinned.credentialId) return;
    const target = this.knownManagerHost;
    if (!target) return;
    const antwort = await this._request(target, 'GET', '/api/v1/dienstplan', undefined, { 'X-KC-Credential': pinned.credentialId }, pinned.fingerprint);
    if (!antwort || !Array.isArray(antwort.schichten)) return;
    this._dienstplanSchichten = antwort.schichten;
  }

  // Baustufe 3: liefert den Zustand für die Ampel neben dem Hamburger-Menü. Grün = online und
  // synchronisiert, Rot = Offlinebetrieb, Gelb = Problem oder Rückstau - genau die drei vom
  // Betreiber vorgegebenen Zustände, aus tatsächlich beobachtetem Verhalten abgeleitet, nicht
  // nur aus dem letzten Sync-Versuch allein.
  //
  // Befund B3-M03 (Betriebs-Gate B): Grün bedeutete bisher nur "der LETZTE Versuch war
  // erfolgreich" - ohne neuen Versuch blieb die Ampel unbegrenzt Grün, selbst wenn der Manager
  // inzwischen ausgefallen ist und das schlicht noch nicht bemerkt wurde. Grün gilt jetzt nur
  // noch INNERHALB einer Frischegrenze; danach gilt der Status als veraltet (Gelb), bis ein
  // neuer Versuch ihn bestätigt oder widerlegt.
  connectionStatus(freshnessWindowMs = 5 * 60 * 1000) {
    const row = this.db.prepare('SELECT last_sync_attempt_at, last_sync_success_at, last_sync_error FROM device_identity WHERE id = 1').get();
    const pending = this.pendingCount();
    const deadLetters = this.deadLetterEvents().length;
    if (!row.last_sync_attempt_at) return { color: 'gelb', reason: 'noch_kein_sync_versuch' };
    const successRecent = row.last_sync_success_at && row.last_sync_success_at >= row.last_sync_attempt_at;
    if (!successRecent) return { color: 'rot', reason: row.last_sync_error || 'offline' };
    const ageMs = Date.now() - new Date(row.last_sync_success_at).getTime();
    if (ageMs > freshnessWindowMs) return { color: 'gelb', reason: 'status_veraltet', ageMs };
    if (deadLetters > 0) return { color: 'gelb', reason: 'dead_letter_ereignisse_vorhanden', count: deadLetters };
    if (pending > 20) return { color: 'gelb', reason: 'rueckstau', count: pending }; // deutlich mehr als ein normaler Zwischenstand
    return { color: 'gruen', reason: 'online_synchronisiert' };
  }

  // Baustufe 3: zweite, unabhängige Aktivitäts-LED für lokale Speicherung und Netzwerkverkehr -
  // zeigt ob die Kasse gerade tatsächlich etwas TUT (schreibt/sendet), unabhängig vom
  // grundsätzlichen Verbindungszustand der ersten Ampel.
  // Befund B4-M01 (Baustufe-4-LED-Prüfbericht): ein kurzlebiger Boolean (nur für 2 Sekunden
  // "wahr") konnte eine Aktivität verpassen, die zwischen zwei Abfragen der Oberfläche begann
  // UND endete. Jetzt monotone Zähler statt eines ablaufenden Zustands - die Oberfläche
  // vergleicht den zuletzt gesehenen Zählerstand mit dem aktuellen und erkennt dadurch JEDE
  // Aktivität seit der letzten Abfrage, egal wie kurz sie war, statt nur zufällig getroffene.
  activityStatus() {
    return {
      localStorageWriteCount: this._localWriteSeq || 0,
      lastLocalWriteAt: this._lastLocalWriteAt || null,
      networkActivityCount: this._networkActivitySeq || 0,
      lastNetworkActivityAt: this._lastNetworkActivityAt || null,
    };
  }

  // Baustufe 4: lokaler Status-Server für die im Browser laufende Kassenoberfläche. Die Kasse
  // selbst ist eine Webseite (index.html/app.js), device-companion läuft als eigener, lokaler
  // Node-Prozess daneben - die Oberfläche kann also nicht direkt auf diese Klasse zugreifen,
  // sondern fragt periodisch diesen kleinen, NUR auf 127.0.0.1 lauschenden HTTP-Endpunkt ab.
  // Bewusst ohne Authentisierung, da er ausschließlich lesend ist und keine Geheimnisse, keine
  // Umsatzdaten und keine steuernden Aktionen liefert.
  //
  // Befund B4-M02 (Baustufe-4-LED-Prüfbericht): startLocalStatusServer() bestätigte seinen
  // eigenen Start bisher nicht und behandelte keinen Fehler - ein bereits belegter Port führte
  // zu einem unbehandelten EADDRINUSE-Ereignis und beendete den gesamten Kassen-Companion-
  // Prozess. Jetzt: echte Startbestätigung per Promise, expliziter Fehler-Handler, fail-closed
  // mit verständlicher Diagnose statt eines rohen Absturzes, KEIN stillschweigender Wechsel auf
  // einen anderen Port (die Browser-Seite hat eine feste URL konfiguriert - ein anderer Port
  // wäre dort unsichtbar falsch).
  //
  // Sicherheitshinweis aus demselben Bericht: Access-Control-Allow-Origin:'*' hätte jeder im
  // Browser geöffneten fremden Webseite erlaubt, den lokalen Kassenstatus mitzulesen. Jetzt wird
  // der Origin der anfragenden Seite gegen eine Positivliste geprüft - nur bei Übereinstimmung
  // wird genau dieser eine Origin zurückgegeben, sonst gar kein CORS-Header (der Browser
  // blockiert den Zugriff für fremde Seiten dann selbst).
  startLocalStatusServer(port = 47391, { allowedOrigins = ['null', 'http://127.0.0.1', 'http://localhost'], bindAddress = '127.0.0.1' } = {}) {
    if (this._statusServer) return Promise.resolve(this._statusServer);
    const http = require('http');
    const server = http.createServer(async (req, res) => {
      const remoteAddr = req.socket.remoteAddress || '';
      const isLoopback = remoteAddr === '127.0.0.1' || remoteAddr === '::1' || remoteAddr === '::ffff:127.0.0.1';

      // Mehrgeräte-Betrieb: Zugriffe von AUSSERHALB des eigenen Rechners (z. B. ein Tablet im
      // Stand-WLAN) brauchen den Zugangs-Schlüssel - "läuft auf demselben Rechner" ist dafür
      // keine ausreichende Vertrauensgrenze mehr, sobald der Server im Netzwerk erreichbar ist.
      // Loopback-Zugriffe (die bisherige, unveränderte Windows-Kasse) bleiben ohne Schlüssel
      // möglich.
      let tokenOk = isLoopback;
      if (!tokenOk) {
        const provided = req.headers['x-kc-kasse-token'] || new URL(req.url, 'http://x').searchParams.get('token');
        tokenOk = provided && provided === this.kasseAccessToken;
      }

      const origin = req.headers.origin;
      // Bei gültigem Schlüssel wird der anfragende Origin akzeptiert (die genaue WLAN-Adresse
      // eines Tablets kann nicht im Voraus in eine feste Liste eingetragen werden) - ohne
      // Schlüssel (Loopback-Fall) gilt weiterhin die bisherige feste Positivliste.
      // BEFUND aus dem Betrieb: die Bedingung verlangte zusaetzlich, dass die Anfrage aus dem
      // NETZWERK kommt. Ruft jemand die Kasse auf DEMSELBEN Rechner ueber die WLAN-Adresse auf
      // (http://192.168.x.x:8090), ist die Anfrage aber Loopback - dann griff die feste Liste,
      // die nur 127.0.0.1 kennt, und der Browser blockierte die Antwort. Ergebnis: die Kasse
      // wirkte verbunden, meldete aber nichts.
      // LOESUNG: die eigenen Netzwerkadressen dieses Rechners gelten ebenfalls als bekannt.
      // Bewusst NICHT "bei gueltigem Schluessel jede Herkunft" - dann koennte eine beliebige
      // fremde Webseite den Kassenstatus auslesen, sobald sie den Schluessel kennt.
      const eigeneAdressen = [];
      try {
        const netze = require('os').networkInterfaces();
        for (const name of Object.keys(netze)) {
          for (const eintrag of netze[name] || []) {
            if (eintrag.family === 'IPv4' && !eintrag.internal) eigeneAdressen.push(`http://${eintrag.address}`);
          }
        }
      } catch (e) { /* Netzwerkliste nicht lesbar - dann gilt nur die feste Positivliste */ }
      const bekannteHerkunft = [...allowedOrigins, ...eigeneAdressen];
      const originAllowed = tokenOk && !isLoopback
        ? !!origin
        : (origin && bekannteHerkunft.some((allowed) => origin === allowed || origin.startsWith(allowed + ':')));
      if (originAllowed) res.setHeader('Access-Control-Allow-Origin', origin);

      if (req.method === 'OPTIONS') {
        // Vorabanfrage des Browsers für POST mit JSON-Körper (CORS-Preflight).
        if (originAllowed) {
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-KC-Kasse-Token');
        }
        res.writeHead(204);
        res.end();
        return;
      }

      if (!tokenOk) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'kasse_token_required' }));
        return;
      }

      if (req.method === 'GET' && req.url.split('?')[0] === '/kc-sync-sold-out-status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ausverkauft: this._ausverkauftListe || [] }));
        return;
      }
      if (req.method === 'GET' && req.url.split('?')[0] === '/kc-sync-team-status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ereignisse: this._zeiterfassungEreignisse || [] }));
        return;
      }
      if (req.method === 'GET' && req.url.split('?')[0] === '/kc-sync-dienstplan') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ schichten: this._dienstplanSchichten || [] }));
        return;
      }
      if (req.method === 'POST' && req.url.split('?')[0] === '/kc-sync-sold-out-melden') {
        let koerper = '';
        req.on('data', (c) => { koerper += c; if (koerper.length > 2048) req.destroy(); });
        req.on('end', async () => {
          try {
            const daten = JSON.parse(koerper);
            if (!daten.articleId) throw new Error('payload_invalid');
            // Sofort im eigenen Zwischenspeicher übernehmen (eigene Kasse zeigt es dadurch
            // augenblicklich, nicht erst beim nächsten Sync) UND sofort an den Manager
            // weiterleiten (derselbe schnelle Weg wie eine Buchung, nicht der 15s-Rhythmus).
            const liste = new Set(this._ausverkauftListe || []);
            if (daten.soldOut) liste.add(daten.articleId); else liste.delete(daten.articleId);
            this._ausverkauftListe = [...liste];
            await this._forwardLiveEvent('sold_out_changed', { articleId: daten.articleId, soldOut: !!daten.soldOut, registerId: daten.registerId || null });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ gemeldet: true }));
          } catch (e) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'payload_invalid' })); }
        });
        return;
      }
      // Eine Nummer aus dem Vorrat an die Kasse geben. Sie wird dabei sofort aus dem Vorrat
      // entfernt - lieber eine Nummer verlieren, wenn die Kasse danach abstuerzt, als
      // dieselbe Nummer zweimal fuer zwei verschiedene Gutscheine zu vergeben.
      if (req.method === 'GET' && req.url.split('?')[0] === '/kc-sync-voucher-number') {
        const naechste = this.db.prepare('SELECT code, qr FROM voucher_number_stock ORDER BY code LIMIT 1').get();
        if (naechste) this.db.prepare('DELETE FROM voucher_number_stock WHERE code = ?').run(naechste.code);
        const rest = this.db.prepare('SELECT COUNT(*) AS n FROM voucher_number_stock').get().n;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ nummer: naechste?.code || null, qr: naechste?.qr || null, vorrat: rest }));
        return;
      }
      if (req.method === 'GET' && req.url.split('?')[0] === '/kc-sync-pending-command') {
        const befehl = this._wartenderBefehl || null;
        this._wartenderBefehl = null;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ befehl }));
        return;
      }

      if (req.method === 'GET' && req.url.split('?')[0] === '/kc-sync-datenschluessel') {
        const zeile = this.db.prepare("SELECT value FROM local_settings WHERE key = 'data_key'").get();
        const ausgabe = this.db.prepare("SELECT value FROM local_settings WHERE key = 'data_key_ausgabe'").get();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(zeile?.value
          ? { datenschluessel: zeile.value, ausgabe: Number(ausgabe?.value || 1) }
          : { datenschluessel: null }));
        return;
      }

      if (req.method === 'GET' && req.url.split('?')[0] === '/kc-sync-master-data') {
        const zeile = this.db.prepare('SELECT groups_json, articles_json, packages_json, accounts_json, settings_json, revision, updated_at FROM master_data_cache WHERE id = 1').get();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (!zeile) { res.end(JSON.stringify({ vorhanden: false })); return; }
        res.end(JSON.stringify({
          vorhanden: true,
          groups: JSON.parse(zeile.groups_json),
          articles: JSON.parse(zeile.articles_json),
          packages: JSON.parse(zeile.packages_json),
          accounts: (() => { try { return JSON.parse(zeile.accounts_json || '[]'); } catch (e) { return []; } })(),
          settings: (() => { try { return JSON.parse(zeile.settings_json || '{}'); } catch (e) { return {}; } })(),
          revision: zeile.revision,
          updatedAt: zeile.updated_at,
        }));
        return;
      }

      if (req.method === 'GET' && req.url.split('?')[0] === '/kc-sync-my-connection-info') {
        // Bewusst NUR über Loopback erreichbar (nicht wie die anderen Routen auch mit Token
        // von außen) - hier wird der Token selbst preisgegeben, das darf niemals übers WLAN
        // abgefragt werden können, sondern nur direkt auf DIESEM Rechner.
        if (!isLoopback) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'nur_lokal_erreichbar' })); return; }
        const os = require('os');
        const adressen = [];
        for (const [name, liste] of Object.entries(os.networkInterfaces())) {
          for (const eintrag of liste || []) {
            if (eintrag.family === 'IPv4' && !eintrag.internal) adressen.push({ schnittstelle: name, adresse: eintrag.address });
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ token: this.kasseAccessToken, port, netzwerkAdressen: adressen }));
        return;
      }

      if (req.method === 'GET' && req.url.split('?')[0] === '/kc-sync-status') {
        // Mehrgeräte-Erkennung: mit welcher Sitzungs-ID fragt gerade an, und war das eine
        // ANDERE als zuletzt (und diese noch "frisch" - grosszuegig 8s, deckt sowohl den
        // schnellen 1,2s- als auch den normalen 4s-Abfragetakt ab)?
        const params = new URL(req.url, 'http://x').searchParams;
        const sessionId = params.get('sessionId');
        let conflict = false;
        if (sessionId) {
          const prev = this._activeSession;
          if (prev && prev.sessionId !== sessionId && (Date.now() - prev.lastSeenAt) < 8000) conflict = true;
          this._activeSession = { sessionId, lastSeenAt: Date.now() };
        }
        const body = JSON.stringify({ connection: this.connectionStatus(), activity: this.activityStatus(), multiDeviceConflict: conflict });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(body);
        return;
      }

      if (req.method === 'POST' && req.url.split('?')[0] === '/kc-sync-release-session') {
        // Bewusstes Abmelden: dieses Geraet gibt seinen Anspruch auf diese Kasse frei, damit ein
        // anderes Geraet (falls es dieselbe Adresse ebenfalls nutzt) keine Konflikt-Warnung mehr
        // bekommt - fuer den Fall eines gewollten Geraetewechsels.
        const params = new URL(req.url, 'http://x').searchParams;
        const sessionId = params.get('sessionId');
        if (this._activeSession && this._activeSession.sessionId === sessionId) this._activeSession = null;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ released: true }));
        return;
      }

      if (req.method === 'GET' && req.url.split('?')[0] === '/kc-sync-cash-transfer') {
        const result = await this._fetchPendingCashTransfer();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }

      if (req.method === 'POST' && req.url.split('?')[0] === '/kc-sync-cash-transfer-ack') {
        let ackBody = '';
        req.on('data', (c) => { ackBody += c; if (ackBody.length > 2048) req.destroy(); });
        req.on('end', async () => {
          let parsed;
          try { parsed = JSON.parse(ackBody); } catch { parsed = {}; }
          const okAck = parsed.transferId ? await this._ackCashTransfer(parsed.transferId) : false;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ acknowledged: okAck }));
        });
        return;
      }

      // 10.09.2026 (Betreiber, Finance Bridge): bewusst ZWEI EIGENE lokale Pfade statt der
      // beiden direkt darueber - jene bleiben unveraendert fuer die bestehende, automatische
      // Uebernahme (Money Butler direkt am Stand). Hier: Geldfuellung kommt ueber die zentrale
      // Finance Bridge, PC Manager gibt sie erst nach eigener Pruefung frei, die Kasse fragt
      // ausdruecklich nach Bestaetigung statt automatisch zu buchen.
      if (req.method === 'GET' && req.url.split('?')[0] === '/kc-sync-finance-transfer') {
        const result = await this._fetchPendingFinanceTransfer();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }

      if (req.method === 'POST' && req.url.split('?')[0] === '/kc-sync-finance-transfer-ack') {
        let ackBody = '';
        req.on('data', (c) => { ackBody += c; if (ackBody.length > 2048) req.destroy(); });
        req.on('end', async () => {
          let parsed;
          try { parsed = JSON.parse(ackBody); } catch { parsed = {}; }
          const okAck = parsed.transferId ? await this._ackFinanceTransfer(parsed.transferId) : false;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ acknowledged: okAck }));
        });
        return;
      }

      if (req.method === 'POST' && req.url.split('?')[0] === '/kc-sync-live-event') {
        // Befund/Konzeptvorgabe: dieser Weg darf die Kassenoberfläche NIEMALS verzögern. Die
        // Antwort geht sofort zurück, die eigentliche Weiterleitung an den Manager läuft
        // unabhängig davon und "fire and forget" - ihr Ausgang wird der Kasse nicht mehr
        // mitgeteilt, ein Fehlschlag (z. B. Manager gerade offline) führt zu nichts weiter als
        // einem fehlenden Live-Anzeige-Eintrag, niemals zu einem Problem in der Kassenbedienung.
        let body = '';
        req.on('data', (c) => { body += c; if (body.length > 8192) req.destroy(); });
        req.on('end', () => {
          res.writeHead(202, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ accepted: true }));
          try {
            const parsed = JSON.parse(body);
            this._forwardLiveEvent(parsed.type, parsed.payload).catch(() => { /* bewusst ignoriert, siehe oben */ });
          } catch (e) { /* fehlerhafter Körper - Antwort ist bereits raus, nichts weiter zu tun */ }
        });
        return;
      }

      if (req.method === 'POST' && req.url.split('?')[0] === '/kc-sync-record-event') {
        // Die BISHER FEHLENDE Brücke zum zuverlässigen Sync-Kanal: recordEvent() schreibt ECHT
        // und atomar in die lokale Outbox (dieselbe, bereits über neun Prüfrunden abgesicherte
        // Logik) - der bestehende sync()-Mechanismus überträgt die Buchung von dort zuverlässig
        // zum Manager, mit allen bekannten Garantien (Wiederholung, Duplikatschutz,
        // Sequenzlücken-Erkennung). Anders als der Live-Monitor-Kanal wird das Ergebnis hier
        // EHRLICH zurückgemeldet - ein Fehlschlag beim Schreiben in die eigene lokale
        // Datenbank ist ein echtes, meldenswertes Problem, kein hinnehmbarer Anzeige-Ausfall.
        let recordBody = '';
        req.on('data', (c) => { recordBody += c; if (recordBody.length > 65536) req.destroy(); });
        req.on('end', () => {
          try {
            const raw = JSON.parse(recordBody);
            const parsed = this._decryptIfNeeded(raw);
            if (!parsed?.type) throw new Error('payload_invalid: type fehlt');
            const eventId = this.recordEvent(parsed.type, parsed.payload || {});
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ recorded: true, eventId }));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ recorded: false, error: String(err?.message || err) }));
          }
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not_found' }));
    });
    return new Promise((resolve, reject) => {
      server.once('error', (err) => {
        this._statusServer = null;
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`kc_sync_status_port_in_use: Port ${port} ist bereits belegt (läuft der Kassen-Companion schon in einem anderen Prozess?). Start abgebrochen, kein automatischer Portwechsel.`));
        } else {
          reject(err);
        }
      });
      server.once('listening', () => {
        this._statusServer = server;
        resolve(server);
      });
      server.listen(port, bindAddress);
    });
  }

  // Leitet ein Live-Ereignis "fire and forget" an den Manager weiter - kurze eigene Zeitgrenze,
  // damit ein gerade nicht erreichbarer Manager niemals zu einer hängenden Anfrage führt. Nutzt
  // bewusst NICHT die Outbox/Wiederholungslogik des zuverlässigen Sync-Kanals - ein verlorenes
  // Live-Ereignis ist für eine reine Anzeige hinnehmbar, anders als eine echte Buchung.
  async _forwardLiveEvent(type, payload) {
    const pinned = this.pinned;
    if (!pinned.credentialId) return;
    const target = this.knownManagerHost;
    if (!target) return; // kein Discovery-Versuch hier - das wäre für einen "fire and forget"-Kanal zu langsam
    const start = Date.now();
    try {
      const nutzlast = type === 'heartbeat' ? { ...payload, letzteBekannteLagMs: this._letzteLagMs } : payload;
      await this._request(target, 'POST', '/api/v1/live-event', { type, payload: nutzlast },
        { 'X-KC-Credential': pinned.credentialId }, pinned.fingerprint);
      this._letzteLagMs = Date.now() - start; // für den NÄCHSTEN Herzschlag, echte Antwortzeit dieser Anfrage
    } catch (e) { /* bewusst ignoriert - siehe Funktionskommentar oben */ }
  }

  // Fragt beim Manager nach, ob eine Bargeldübergabe (Money Butler) für DIESE Kasse bereitliegt.
  // Anders als der Live-Event-Kanal wird ein Fehlschlag hier ehrlich als "nichts gefunden"
  // behandelt (kein stiller Fehler), damit die Kassenoberfläche weiß, dass sie es später
  // nochmal versuchen soll, statt fälschlich "keine Übergabe vorhanden" anzunehmen.
  async _fetchPendingCashTransfer() {
    const pinned = this.pinned;
    if (!pinned.credentialId) return { ok: false, reason: 'not_paired' };
    const target = this.knownManagerHost || (await this.discoverPinnedManager());
    if (!target) return { ok: false, reason: 'unreachable' };
    try {
      const result = await this._request(target, 'GET', '/api/v1/cash-transfer/pending', undefined,
        { 'X-KC-Credential': pinned.credentialId }, pinned.fingerprint);
      return { ok: true, pending: result.pending || null };
    } catch (e) { return { ok: false, reason: 'request_failed' }; }
  }

  // Bestätigt dem Manager, dass eine Übergabe wirklich übernommen wurde - erst danach gilt sie
  // dort als zugestellt.
  async _ackCashTransfer(transferId) {
    const pinned = this.pinned;
    if (!pinned.credentialId) return false;
    const target = this.knownManagerHost;
    if (!target) return false;
    try {
      await this._request(target, 'POST', '/api/v1/cash-transfer/ack', { transferId },
        { 'X-KC-Credential': pinned.credentialId }, pinned.fingerprint);
      return true;
    } catch (e) { return false; }
  }

  // 10.09.2026 (Betreiber, Finance Bridge): analoge Funktionen zu den beiden direkt darueber,
  // aber gegen die eigene /api/v1/finance-transfer/...-Route (eigene Tabelle im Manager,
  // siehe dort) - bewusst getrennt vom bestehenden, automatischen Weg.
  async _fetchPendingFinanceTransfer() {
    const pinned = this.pinned;
    if (!pinned.credentialId) return { ok: false, reason: 'not_paired' };
    const target = this.knownManagerHost || (await this.discoverPinnedManager());
    if (!target) return { ok: false, reason: 'unreachable' };
    try {
      const result = await this._request(target, 'GET', '/api/v1/finance-transfer/pending', undefined,
        { 'X-KC-Credential': pinned.credentialId }, pinned.fingerprint);
      return { ok: true, pending: result.pending || null };
    } catch (e) { return { ok: false, reason: 'request_failed' }; }
  }

  async _ackFinanceTransfer(transferId) {
    const pinned = this.pinned;
    if (!pinned.credentialId) return false;
    const target = this.knownManagerHost;
    if (!target) return false;
    try {
      await this._request(target, 'POST', '/api/v1/finance-transfer/ack', { transferId },
        { 'X-KC-Credential': pinned.credentialId }, pinned.fingerprint);
      return true;
    } catch (e) { return false; }
  }

  stopLocalStatusServer() {
    if (this._statusServer) { this._statusServer.close(); this._statusServer = null; }
  }

  // Zeitabweichungserkennung (Baustufe 3): vergleicht die eigene Uhrzeit mit der zuletzt vom
  // Manager gemeldeten. Wird NICHT automatisch korrigiert (das wäre auf einem Kassensystem
  // riskant), nur als Hinweis bereitgestellt.
  async clockDrift() {
    const pinned = this.pinned;
    const target = this.knownManagerHost || (await this.discoverPinnedManager());
    if (!target) return { checked: false, reason: 'unreachable' };
    const before = Date.now();
    const health = await this._request(target, 'GET', '/api/v1/health', undefined, {}, pinned.fingerprint).catch(() => null);
    const roundTripMs = Date.now() - before;
    if (!health?.serverTime) return { checked: false, reason: 'no_response' };
    const serverTimeMs = new Date(health.serverTime).getTime();
    const localTimeMs = before + roundTripMs / 2; // grobe Kompensation der Laufzeit
    const driftMs = localTimeMs - serverTimeMs;
    return { checked: true, driftMs, roundTripMs, significant: Math.abs(driftMs) > 60000 }; // über 1 Minute gilt als auffällig
  }

  // TLS-Fingerprint-Prüfung (A-08): Ein selbstsigniertes Zertifikat wird bewusst akzeptiert,
  // ABER nur wenn der Fingerabdruck des tatsächlich präsentierten Zertifikats exakt dem bei
  // der Kopplung gepinnten entspricht - echtes Certificate Pinning auf Transportebene.
  // Ausgelagert, damit die Gültigkeits-/Fingerprint-Prüfung selbst auch ohne echten
  // TLS-Handshake gezielt getestet werden kann (z.B. mit einem synthetisch abgelaufenen
  // Zertifikat, ohne dafür einen echten Server mit passendem Schlüssel aufsetzen zu müssen).
  static checkPeerCertificate(cert, expectedFingerprint) {
    const actual = cert && cert.raw ? 'sha256:' + crypto.createHash('sha256')
      .update(new crypto.X509Certificate(cert.raw).publicKey.export({ type: 'spki', format: 'der' }))
      .digest('hex') : null;
    if (actual !== expectedFingerprint) return { ok: false, error: 'tls_fingerprint_mismatch' };
    // Befund (Vierter Nachprüfbericht, MITTEL): fehlende oder nicht auswertbare
    // Gültigkeitsangaben wurden bisher übersprungen statt abgelehnt (ein fehlendes valid_from
    // ergab notBefore=null und übersprang die Prüfung stillschweigend; ein kaputtes Datum ergab
    // NaN, wodurch JEDER Zahlenvergleich damit immer "false" liefert und die Ablehnung nie
    // griff). Konsequent fail-closed wie schon bei D-04: fehlen oder sind die Daten nicht
    // auswertbar, wird das Zertifikat abgelehnt, nicht stillschweigend akzeptiert.
    const now = Date.now();
    const notBefore = cert.valid_from ? new Date(cert.valid_from).getTime() : NaN;
    const notAfter = cert.valid_to ? new Date(cert.valid_to).getTime() : NaN;
    if (Number.isNaN(notBefore) || Number.isNaN(notAfter)) return { ok: false, error: 'tls_certificate_validity_unreadable' };
    if (now < notBefore) return { ok: false, error: 'tls_certificate_not_yet_valid' };
    if (now > notAfter) return { ok: false, error: 'tls_certificate_expired' };
    return { ok: true };
  }

  _request({ host, port }, method, path, body, headers = {}, expectedFingerprint = undefined) {
    this._networkActivitySeq = (this._networkActivitySeq || 0) + 1; this._lastNetworkActivityAt = Date.now(); // Baustufe 3/4: Aktivitäts-LED
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify({ apiVersion: API_VERSION, ...body }) : null;
      const req = https.request({
        hostname: host, port, path, method,
        headers: { 'Content-Type': 'application/json', ...headers },
        rejectUnauthorized: false, // eigene Prüfung unten statt der öffentlichen CA-Kette
        agent: false, // erzwingt eine frische TLS-Verbindung je Anfrage, sonst feuert secureConnect bei wiederverwendeten Verbindungen nicht erneut
      });
      req.on('error', reject);
      req.on('response', (res) => {
        let chunks = '';
        res.on('data', (c) => (chunks += c));
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(chunks); } catch (e) { return reject(e); }
          // Befund N-07: die Version der Antwort wird jetzt tatsächlich geprüft, nicht nur
          // entgegengenommen - eine erkennbar inkompatible Hauptversion wird abgelehnt, statt
          // eine möglicherweise anders strukturierte Antwort blind zu verarbeiten.
          // Befund N-07 (vervollständigt, Fünfter Nachprüfbericht M-01): eine fehlende
          // Antwort-Version wurde bisher stillschweigend durchgelassen, nur eine erkennbar
          // inkompatible wurde abgelehnt - symmetrisch zur Server-Seite wird jetzt auch eine
          // fehlende Version als nicht vertrauenswürdig behandelt.
          const responseMajor = parsed?.apiVersion ? String(parsed.apiVersion).split('.')[0] : null;
          if (responseMajor !== API_MAJOR) {
            return reject(new Error(`api_version_missing_or_mismatch: Manager antwortet mit Version ${parsed?.apiVersion ?? '(fehlt)'}, Kasse erwartet ${API_VERSION}`));
          }
          resolve(parsed);
        });
      });
      const send = () => { if (data) req.write(data); req.end(); };
      if (!expectedFingerprint) { send(); return; } // nur zulässig, wenn der Aufrufer selbst noch keinen Pin hat (z.B. nie in pair())
      req.on('socket', (socket) => {
        socket.once('secureConnect', () => {
          const check = DeviceCompanion.checkPeerCertificate(socket.getPeerCertificate(), expectedFingerprint);
          if (!check.ok) { req.destroy(new Error(check.error)); return; }
          send(); // erst JETZT, nach bestätigtem Fingerprint UND bestätigter Gültigkeit, verlassen Credential/Nutzdaten das Gerät (S-02)
        });
      });
    });
  }
}

module.exports = { DeviceCompanion };
