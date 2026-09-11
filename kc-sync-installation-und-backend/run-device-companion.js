#!/usr/bin/env node
// KC Sync – echter Produktions-Startpunkt für den Kassen-Companion (device-companion).
//
// Befund B4-K01 (Baustufe-4-LED-Prüfbericht): startLocalStatusServer() existierte bisher nur
// als Methodendefinition, in der Dokumentation und im Integrationstest - kein Prozess rief sie
// im normalen Betrieb tatsächlich auf. Die Browser-LEDs fragten deshalb einen Port ab, an dem
// nie jemand lauschte. Dieses Skript ist der fehlende, echte Startpunkt: öffnet die bestehende
// Kassen-Datenbank, startet den lokalen Status-Server, synchronisiert periodisch, protokolliert
// Fehler verständlich und schließt beim Beenden sauber statt abrupt.
//
// Verwendung:
//   node run-device-companion.js [--db PFAD] [--status-port 47391] [--sync-interval-ms 15000]
//
// Umgebungsvariablen (Alternative zu den Kommandozeilenoptionen, z. B. für Diensteinrichtung):
//   KC_SYNC_DB_PATH, KC_SYNC_STATUS_PORT, KC_SYNC_SYNC_INTERVAL_MS

'use strict';
const path = require('path');
const { DeviceCompanion } = require('./device-companion');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--db') out.dbPath = argv[++i];
    else if (argv[i] === '--status-port') out.statusPort = Number(argv[++i]);
    else if (argv[i] === '--sync-interval-ms') out.syncIntervalMs = Number(argv[++i]);
    else if (argv[i] === '--bind') out.bindAddress = argv[++i];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbPath = args.dbPath || process.env.KC_SYNC_DB_PATH || path.join(process.cwd(), 'kc-sync-kasse.sqlite');
  const statusPort = args.statusPort || Number(process.env.KC_SYNC_STATUS_PORT) || 47391;
  const syncIntervalMs = args.syncIntervalMs || Number(process.env.KC_SYNC_SYNC_INTERVAL_MS) || 15000;
  const bindAddress = args.bindAddress || process.env.KC_SYNC_BIND_ADDRESS || '127.0.0.1';

  console.log(`[KC Sync Kasse] Öffne Datenbank: ${dbPath}`);
  let dev;
  try {
    dev = new DeviceCompanion({ dbPath });
  } catch (err) {
    // Fail-closed (D-04-Prinzip): eine beschädigte oder aus einer unbekannten neueren Version
    // stammende Datenbank darf nicht stillschweigend übergangen werden.
    console.error(`[KC Sync Kasse] Datenbank konnte nicht geöffnet werden, Start abgebrochen: ${err.message}`);
    process.exit(1);
  }

  try {
    await dev.startLocalStatusServer(statusPort, { bindAddress });
    console.log(`[KC Sync Kasse] Status-Server läuft auf http://${bindAddress}:${statusPort}/kc-sync-status`);
  } catch (err) {
    // Befund B4-M02: verständliche Diagnose statt unbehandeltem Absturz. Der Companion läuft
    // auch OHNE Status-Server sinnvoll weiter (Synchronisation ist wichtiger als die Anzeige) -
    // deshalb hier bewusst nicht process.exit(1), nur eine deutliche Warnung.
    console.error(`[KC Sync Kasse] Status-Server konnte nicht gestartet werden (Kasse synchronisiert trotzdem weiter): ${err.message}`);
  }

  let stopping = false;
  const syncTimer = setInterval(async () => {
    if (stopping) return;
    try {
      const result = await dev.sync();
      if (result.synced > 0) console.log(`[KC Sync Kasse] ${result.synced} Ereignis(se) synchronisiert.`);
    } catch (err) {
      console.error(`[KC Sync Kasse] Sync-Fehler: ${err.message}`);
    }
  }, syncIntervalMs);

  async function shutdown(signal) {
    if (stopping) return;
    stopping = true;
    console.log(`[KC Sync Kasse] ${signal} empfangen, beende sauber …`);
    clearInterval(syncTimer);
    dev.stopLocalStatusServer();
    console.log('[KC Sync Kasse] Beendet.');
    process.exit(0);
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    console.error('[KC Sync Kasse] Unerwarteter Fehler, Prozess wird beendet:', err);
    process.exit(1);
  });

  console.log('[KC Sync Kasse] Läuft. Beenden mit Strg+C oder SIGTERM.');
}

main();
