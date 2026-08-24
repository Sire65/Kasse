// KC Sync – manuelle Kopplung von Manager und Kasse (für den Windows-Test).
//
// Ehrlicher Nachtrag: eine richtige QR-Code-Kopplung in der eigentlichen Kassen-/Manager-
// Oberfläche wurde bisher nicht gebaut (das war bisher nur automatisiert in der Testsuite
// nachgebildet, nie als für den Betreiber tatsächlich nutzbares Werkzeug). Dieses Skript ist
// ein Notbehelf für den Windows-Test, kein Ersatz für eine spätere echte Kopplungs-Oberfläche.
//
// Setzt voraus: der Manager läuft bereits (echte geplante Aufgabe, echter Port, z. B. 8543).
// Die Kasse darf ebenfalls laufen oder gestoppt sein - beides funktioniert, da hier direkt auf
// die Kassen-Datenbankdatei geschrieben wird; läuft die Kassen-Aufgabe dabei, sollte sie sicherheitshalber
// kurz neu gestartet werden, damit sie die neue Kopplung sicher übernimmt.
//
// Verwendung:
//   node pair-manually.js --manager-db "<Pfad zu manager.sqlite>" --kasse-db "<Pfad zu kasse.sqlite>" --manager-port 8543

'use strict';
const path = require('path');
const { openManagerDb } = require('./manager-companion/db');
const { loadOrCreateIdentity } = require('./manager-companion/identity');
const { DeviceCompanion } = require('./device-companion');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--manager-db') out.managerDb = argv[++i];
    else if (argv[i] === '--kasse-db') out.kasseDb = argv[++i];
    else if (argv[i] === '--manager-port') out.managerPort = Number(argv[++i]);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const managerDbPath = args.managerDb || path.join(__dirname, 'install', 'manager.sqlite');
  const kasseDbPath = args.kasseDb || path.join(__dirname, 'install', 'kasse.sqlite');
  const managerPort = args.managerPort || 8543;

  console.log(`Manager-Datenbank: ${managerDbPath}`);
  console.log(`Kassen-Datenbank:  ${kasseDbPath}`);
  console.log(`Manager-Port:      ${managerPort} (muss der Port sein, auf dem der ECHTE, laufende Manager horcht)`);

  const managerDb = openManagerDb(managerDbPath);
  const identity = await loadOrCreateIdentity(managerDb, managerDbPath);
  const token = 'pair_' + require('crypto').randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  managerDb.prepare('INSERT INTO pairing_tokens (token, used, expires_at) VALUES (?, 0, ?)').run(token, expiresAt);
  managerDb.close();

  console.log(`Kopplungs-Token erzeugt (10 Minuten gültig). Manager-ID: ${identity.managerId}`);

  const dev = new DeviceCompanion({ dbPath: kasseDbPath });
  try {
    const result = await dev.pair({
      pairingToken: token,
      expectedFingerprint: identity.fingerprint,
      host: '127.0.0.1',
      port: managerPort,
    });
    console.log('Kopplung erfolgreich. Credential-ID:', result.credentialId.split('.')[0]);
    console.log('Falls die Kassen-Aufgabe gerade läuft: einmal ueber Stop-ScheduledTask/Start-ScheduledTask neu starten, damit sie die Kopplung sicher übernimmt.');
  } catch (err) {
    console.error('Kopplung fehlgeschlagen:', err.message);
    process.exitCode = 1;
  }
}

main();
