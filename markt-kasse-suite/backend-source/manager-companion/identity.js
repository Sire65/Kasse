// KC Sync Baustufe 2.2 – Manager-Identität + selbstsigniertes TLS-Zertifikat.
// Wird einmalig erzeugt und danach dauerhaft wiederverwendet, damit der Fingerprint über
// Neustarts hinweg stabil bleibt (A-03: Pinning).
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');
const { protectSecretFile } = require('./secure-file');

// Befund S-05: der private Schlüssel darf nicht im Klartext in derselben Datenbank wie die
// Betriebsdaten liegen. Eigene Datei neben der Datenbank, plattformgerecht geschützt.
function keyFilePath(dbPath) {
  if (dbPath === ':memory:') return null; // Testbetrieb ohne Dateisystem-Bezugspunkt
  return path.join(path.dirname(dbPath), path.basename(dbPath) + '.key.pem');
}

async function loadOrCreateIdentity(db, dbPath = ':memory:') {
  let row = db.prepare('SELECT * FROM identity WHERE id = 1').get();
  const keyPath = keyFilePath(dbPath);

  if (!row) {
    // Befund (echter Windows-Testlauf): auf einer wirklich frischen, leeren Datenbank konnten
    // zwei gleichzeitig startende Prozesse (der Manager selbst UND ein separates Werkzeug wie
    // die Kopplungshilfe) beide eine EIGENE, jeweils andere Identität erzeugen - der langsamere
    // gewann den Schreibzugriff und überschrieb die Datenbank mit einem Fingerprint, der nicht
    // zu dem passte, was der bereits laufende Manager tatsächlich über TLS präsentierte
    // ("tls_fingerprint_mismatch"). Die eigentliche kryptografische Erzeugung passiert weiterhin
    // außerhalb jeder Transaktion (sie ist asynchron), aber das Prüfen-und-Schreiben passiert
    // jetzt exklusiv: nur ein Prozess gewinnt, jeder andere erkennt das und übernimmt dessen
    // bereits geschriebene Identität, statt seine eigene zu verwenden.
    const managerId = 'mgr_' + crypto.randomBytes(16).toString('hex');
    const pems = await selfsigned.generate(
      [{ name: 'commonName', value: 'kc-manager.local' }],
      { days: 3650, keySize: 2048 }
    );
    const spki = new crypto.X509Certificate(pems.cert).publicKey.export({ type: 'spki', format: 'der' });
    const fingerprint = 'sha256:' + crypto.createHash('sha256').update(spki).digest('hex');

    db.exec('BEGIN IMMEDIATE');
    try {
      row = db.prepare('SELECT * FROM identity WHERE id = 1').get();
      if (!row) {
        // Schlüsseldatei VOR dem INSERT schreiben (noch innerhalb derselben synchronen
        // Ausführung, vor COMMIT) - sobald die Zeile für andere Prozesse sichtbar wird, muss
        // die zugehörige Datei bereits existieren.
        if (keyPath) fs.writeFileSync(keyPath, pems.private, { mode: 0o600 });
        db.prepare('INSERT INTO identity (id, manager_id, tls_cert, tls_key_fallback, fingerprint) VALUES (1, ?, ?, ?, ?)')
          .run(managerId, pems.cert, keyPath ? null : pems.private, fingerprint);
        row = db.prepare('SELECT * FROM identity WHERE id = 1').get();
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    if (keyPath && row.manager_id !== managerId) {
      // Ein anderer Prozess hat den Wettlauf gewonnen - unser eigener, jetzt ungültiger
      // Schlüssel-Kandidat wurde nie geschrieben (siehe oben), nichts aufzuräumen.
    } else if (keyPath) {
      protectSecretFile(keyPath);
    }
  }

  // Befund T-03: der Schutz wurde bisher nur bei der ERSTELLUNG geprüft. Nach einem Neustart
  // (z. B. mit einem anderen Prozess-Konto, wie im Prüfbericht beobachtet) kann die zuvor
  // gesetzte ACL das Lesen der eigenen Datei plötzlich verhindern - das wird jetzt bei JEDEM
  // Start erneut geprüft, nicht nur beim ersten Anlegen.
  let keyProtection = { ok: true, platform: process.platform, method: 'n/a (In-Memory)' };
  let key = row.tls_key_fallback;
  if (keyPath) {
    if (!fs.existsSync(keyPath)) {
      keyProtection = { ok: false, platform: process.platform, method: 'missing', error: `Schlüsseldatei ${keyPath} fehlt, obwohl eine Identität in der Datenbank hinterlegt ist.` };
    } else {
      keyProtection = protectSecretFile(keyPath); // erneut durchsetzen/prüfen, nicht nur einmalig
      if (keyProtection.ok) {
        try { key = fs.readFileSync(keyPath, 'utf8'); }
        catch (err) { keyProtection = { ok: false, platform: process.platform, method: keyProtection.method, error: `Schlüsseldatei geschützt, aber nicht lesbar: ${err.message}` }; }
      }
    }
  }
  return { managerId: row.manager_id, cert: row.tls_cert, key, fingerprint: row.fingerprint, keyProtection };
}

module.exports = { loadOrCreateIdentity, renewCertificate };

// Baustufe 3: Zertifikatserneuerung OHNE neue Kopplung. Nutzt bewusst denselben, bereits
// vorhandenen privaten Schlüssel weiter (nicht neu erzeugt) - dadurch bleibt der SPKI-
// Fingerprint (C-01: Pinning auf dem Schlüssel, nicht dem Zertifikat) exakt identisch, und
// jede bereits gekoppelte Kasse vertraut dem neuen Zertifikat automatisch weiter, ohne dass ein
// neuer QR-Kopplungsvorgang nötig wäre.
async function renewCertificate(db, currentKeyPem, days = 3650) {
  const privKeyObj = crypto.createPrivateKey(currentKeyPem);
  const pubKeyPem = crypto.createPublicKey(privKeyObj).export({ type: 'spki', format: 'pem' });
  const pems = await selfsigned.generate(
    [{ name: 'commonName', value: 'kc-manager.local' }],
    { days, keyPair: { privateKey: currentKeyPem, publicKey: pubKeyPem } }
  );
  const newFingerprint = 'sha256:' + crypto.createHash('sha256')
    .update(new crypto.X509Certificate(pems.cert).publicKey.export({ type: 'spki', format: 'der' })).digest('hex');
  const oldRow = db.prepare('SELECT tls_cert, fingerprint FROM identity WHERE id = 1').get();
  if (oldRow.fingerprint !== newFingerprint) {
    // Sicherheitsnetz: sollte der Fingerprint sich doch ändern (z. B. falscher Schlüssel
    // übergeben), lieber abbrechen als eine Erneuerung auszuliefern, die bestehende Kopplungen
    // stillschweigend bricht.
    throw new Error('certificate_renewal_fingerprint_mismatch: Erneuerung hätte den Fingerprint verändert, abgebrochen.');
  }
  const now = new Date();
  const validTo = new Date(Date.now() + days * 24 * 3600 * 1000);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO certificate_history (tls_cert, valid_from, valid_to, renewed_at) VALUES (?, ?, ?, ?)')
      .run(oldRow.tls_cert, now.toISOString(), validTo.toISOString(), now.toISOString());
    db.prepare('UPDATE identity SET tls_cert = ? WHERE id = 1').run(pems.cert);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return { cert: pems.cert, fingerprint: newFingerprint, validTo: validTo.toISOString() };
}
