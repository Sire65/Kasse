#!/usr/bin/env node
// KC Sync – echter Produktions-Startpunkt für den Manager-Companion (manager-companion).
//
// GEFUNDENE LÜCKE: install-manager-service.ps1 erwartet diese Datei bereits seit längerem
// (Zeile "$runnerPath = Join-Path $scriptDir 'run-manager-service.js'"), sie existierte aber
// nie tatsächlich - die Windows-Diensteinrichtung für den Manager konnte dadurch nie wirklich
// starten. Dieses Skript ist der fehlende, echte Startpunkt, nach demselben Muster wie das
// bereits vorhandene und bewährte run-device-companion.js.
//
// Verwendung:
//   node run-manager-service.js [--db PFAD] [--port 8543]
//
// Umgebungsvariablen (Alternative, z. B. für Diensteinrichtung):
//   KC_SYNC_MANAGER_DB_PATH, KC_SYNC_MANAGER_PORT

'use strict';
const path = require('path');
const { spawn } = require('child_process');
const { ManagerCompanion } = require('./manager-companion');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--db') out.dbPath = argv[++i];
    else if (argv[i] === '--port') out.port = Number(argv[++i]);
    else if (argv[i] === '--webserver-port') out.webserverPort = Number(argv[++i]);
    else if (argv[i] === '--kein-webserver') out.keinWebserver = true;
  }
  return out;
}

function portIstFrei(port) {
  return new Promise((resolve) => {
    const test = require('net').createServer();
    test.once('error', () => resolve(false));
    test.once('listening', () => { test.close(() => resolve(true)); });
    test.listen(port, '0.0.0.0');
  });
}
async function findeFreienPort(wunschPort) {
  for (let versuch = 0; versuch < 50; versuch++) {
    const kandidat = wunschPort + versuch;
    if (await portIstFrei(kandidat)) return kandidat;
  }
  throw new Error('Kein freier Port gefunden.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbPath = args.dbPath || process.env.KC_SYNC_MANAGER_DB_PATH || path.join(process.cwd(), 'kc-sync-manager.sqlite');
  const port = args.port || Number(process.env.KC_SYNC_MANAGER_PORT) || 8543;

  console.log(`[KC Sync Manager] Öffne Datenbank: ${dbPath}`);
  let mgr;
  try {
    mgr = new ManagerCompanion({ dbPath });
  } catch (err) {
    console.error(`[KC Sync Manager] Datenbank konnte nicht geöffnet werden, Start abgebrochen: ${err.message}`);
    process.exit(1);
  }

  try {
    await mgr.start(port);
    console.log(`[KC Sync Manager] HTTPS-Server läuft auf https://0.0.0.0:${mgr.port}`);
  } catch (err) {
    console.error(`[KC Sync Manager] Start fehlgeschlagen: ${err.message}`);
    process.exit(1);
  }

  let webserverProzess = null;
  if (!args.keinWebserver) {
    const wunschPort = args.webserverPort || Number(process.env.KC_SYNC_WEBSERVER_PORT) || 8090;
    const webserverPort = await findeFreienPort(wunschPort);
    const wurzelOrdner = path.join(__dirname, '..', 'kassenoberflaeche-und-pc-manager');
    webserverProzess = spawn(process.execPath, ['serve-frontend.js', '--port', String(webserverPort), '--root', wurzelOrdner], { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'] });
    webserverProzess.stdout.on('data', (d) => process.stdout.write(`[Webserver] ${d}`));
    webserverProzess.stderr.on('data', (d) => process.stderr.write(`[Webserver] ${d}`));
    await new Promise((resolve) => setTimeout(resolve, 1200));
    console.log(`[KC Sync Manager] PC-Manager hier öffnen: http://127.0.0.1:${webserverPort}/pc-manager/index.html`);
  }

  let stopping = false;
  async function shutdown(signal) {
    if (stopping) return;
    stopping = true;
    console.log(`[KC Sync Manager] ${signal} empfangen, beende sauber …`);
    try { mgr.server?.close(); } catch (e) { /* bereits geschlossen */ }
    try { webserverProzess?.kill('SIGTERM'); } catch (e) { /* bereits beendet */ }
    console.log('[KC Sync Manager] Beendet.');
    process.exit(0);
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    console.error('[KC Sync Manager] Unerwarteter Fehler, Prozess wird beendet:', err);
    process.exit(1);
  });

  console.log('[KC Sync Manager] Läuft. Beenden mit Strg+C oder SIGTERM.');
}

main();
