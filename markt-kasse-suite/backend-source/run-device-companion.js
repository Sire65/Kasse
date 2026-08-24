#!/usr/bin/env node
// KC Sync – echter Produktions-Startpunkt für den Kassen-Companion (device-companion).
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
    console.error(`[KC Sync Kasse] Datenbank konnte nicht geöffnet werden, Start abgebrochen: ${err.message}`);
    process.exit(1);
  }

  try {
    await dev.startLocalStatusServer(statusPort, { bindAddress });
    console.log(`[KC Sync Kasse] Status-Server läuft auf http://${bindAddress}:${statusPort}/kc-sync-status`);
  } catch (err) {
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
