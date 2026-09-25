#!/usr/bin/env node
// KC Sync – Produktions-Startpunkt für Manager-Companion + lokalen KC-Webserver.
'use strict';
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { ManagerCompanion } = require('./manager-companion');
const { KiccRuntimeTelemetry } = require('./kicc-runtime-telemetry');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--db') out.dbPath = argv[++i];
    else if (argv[i] === '--port') out.port = Number(argv[++i]);
    else if (argv[i] === '--webserver-port') out.webserverPort = Number(argv[++i]);
    else if (argv[i] === '--frontend-root') out.frontendRoot = argv[++i];
    else if (argv[i] === '--kein-webserver') out.keinWebserver = true;
    else if (argv[i] === '--open-manager') out.openManager = true;
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

function warteAufHttp(url, timeoutMs = 12000) {
  const ende = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const versuch = () => {
      if (Date.now() >= ende) return reject(new Error('Lokaler KC-Webserver antwortet nicht.'));
      const req = http.get(url, (res) => {
        res.resume();
        if ((res.statusCode || 500) < 500) resolve();
        else setTimeout(versuch, 250);
      });
      req.setTimeout(1200, () => req.destroy());
      req.on('error', () => setTimeout(versuch, 250));
    };
    versuch();
  });
}

function browserOeffnen(url) {
  try {
    let command, args;
    if (process.platform === 'win32') {
      command = 'cmd.exe';
      args = ['/d', '/s', '/c', 'start', '', url];
    } else if (process.platform === 'darwin') {
      command = 'open';
      args = [url];
    } else {
      command = 'xdg-open';
      args = [url];
    }
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const paketRoot = path.resolve(__dirname, '..', '..');
  const frontendRoot = path.resolve(args.frontendRoot || process.env.KC_FRONTEND_ROOT || paketRoot);
  const dbPath = args.dbPath || process.env.KC_SYNC_MANAGER_DB_PATH || path.join(__dirname, 'kc-sync-manager.sqlite');
  const port = args.port || Number(process.env.KC_SYNC_MANAGER_PORT) || 8543;
  const telemetry = new KiccRuntimeTelemetry({
    programId: 'kc-pc-manager',
    name: 'KC PC Manager',
    version: process.env.KC_PC_MANAGER_VERSION || null,
    build: process.env.KC_PC_MANAGER_BUILD || null
  });

  console.log('==============================================================');
  console.log(' KC MARKTKASSE - PC MANAGER STARTROUTINE');
  console.log('==============================================================');
  console.log(`[KC Start] Paket: ${paketRoot}`);
  console.log(`[KC Start] Web-Wurzel: ${frontendRoot}`);
  console.log(`[KC Sync Manager] Öffne Datenbank: ${dbPath}`);

  let mgr;
  try {
    mgr = new ManagerCompanion({ dbPath });
  } catch (err) {
    telemetry.update({ status: 'OFFLINE', errorCount: 1, message: `Startfehler: ${err.message}` });
    await telemetry.send().catch(()=>{});
    console.error(`[KC Sync Manager] Datenbank konnte nicht geöffnet werden, Start abgebrochen: ${err.message}`);
    process.exit(1);
  }

  try {
    const started = performance.now();
    await mgr.start(port);
    telemetry.update({ status: 'ONLINE', latencyMs: performance.now() - started, message: `Manager HTTPS aktiv · Port ${mgr.port}` });
    console.log(`[KC Sync Manager] HTTPS-Server läuft auf https://0.0.0.0:${mgr.port}`);
  } catch (err) {
    telemetry.update({ status: 'OFFLINE', errorCount: 1, message: `Manager-Start: ${err.message}` });
    await telemetry.send().catch(()=>{});
    console.error(`[KC Sync Manager] Start fehlgeschlagen: ${err.message}`);
    process.exit(1);
  }

  let webserverProzess = null;
  if (!args.keinWebserver) {
    const wunschPort = args.webserverPort || Number(process.env.KC_SYNC_WEBSERVER_PORT) || 8090;
    const webserverPort = await findeFreienPort(wunschPort);
    webserverProzess = spawn(
      process.execPath,
      ['serve-frontend.js', '--port', String(webserverPort), '--root', frontendRoot],
      { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    webserverProzess.stdout.on('data', (d) => process.stdout.write(`[Webserver] ${d}`));
    webserverProzess.stderr.on('data', (d) => {
      telemetry.update({ status: 'DEGRADED', errorCount: Number(telemetry.state.errorCount || 0) + 1, message: 'PC-Manager-Webserver meldet Fehler' });
      process.stderr.write(`[Webserver] ${d}`);
    });
    webserverProzess.on('exit', (code) => {
      if (code && code !== 0) telemetry.update({ status: 'DEGRADED', errorCount: Number(telemetry.state.errorCount || 0) + 1, message: `PC-Manager-Webserver beendet · Code ${code}` });
    });

    const managerUrl = `http://127.0.0.1:${webserverPort}/pc-manager/index.html`;
    await warteAufHttp(managerUrl);
    telemetry.update({ status: 'ONLINE', message: `Manager + PC-Manager-Webserver aktiv · ${webserverPort}` });

    console.log('');
    console.log('-------------------- START BEREIT ----------------------------');
    console.log(`PC-Manager:   ${managerUrl}`);
    console.log(`Kasse lokal:  http://127.0.0.1:${webserverPort}/pos/index.html`);
    console.log(`Money Butler: http://127.0.0.1:${webserverPort}/money-butler/index.html`);
    console.log('--------------------------------------------------------------');
    console.log('Dieses Fenster während des Betriebs geöffnet lassen.');
    console.log('Beenden mit Strg+C.');
    console.log('');

    if (args.openManager) {
      const ok = browserOeffnen(managerUrl);
      console.log(ok ? '[KC Start] PC-Manager wird im Standardbrowser geöffnet.' : '[KC Start] Browser konnte nicht automatisch geöffnet werden.');
    }
  }

  telemetry.start();
  let stopping = false;
  async function shutdown(signal) {
    if (stopping) return;
    stopping = true;
    console.log(`[KC Sync Manager] ${signal} empfangen, beende sauber …`);
    telemetry.update({ status: 'OFFLINE', message: `Beendet: ${signal}` });
    await telemetry.send().catch(()=>{});
    telemetry.stop();
    try { mgr.server?.close(); } catch {}
    try { webserverProzess?.kill('SIGTERM'); } catch {}
    console.log('[KC Sync Manager] Beendet.');
    process.exit(0);
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', async (err) => {
    telemetry.update({ status: 'OFFLINE', errorCount: Number(telemetry.state.errorCount || 0) + 1, message: `Uncaught: ${err.message}` });
    await telemetry.send().catch(()=>{});
    console.error('[KC Sync Manager] Unerwarteter Fehler, Prozess wird beendet:', err);
    process.exit(1);
  });

  console.log('[KC Sync Manager] Läuft.');
}

main();
