#!/usr/bin/env node
// KC Sync – Produktions-Startpunkt für Manager-Companion + lokalen KC-Webserver.
'use strict';
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { ManagerCompanion } = require('./manager-companion');
const { KiccRuntimeTelemetry } = require('./kicc-runtime-telemetry');
const { TabletKassenStart, leseKassenKonfig, standardDatenOrdner, zettelWebserverPort } = require('./kassen-start');
const { meldung, erklaere, druckeKasten, SCHRITTE_FENSTER_NEU } = require('./fehlerhilfe');

// Start abbrechen - immer mit Kasten (Was / Ursache / Loesung), nie mit rohem Stacktrace.
function startAbbrechen(m) {
  druckeKasten(console.error, [m], 'START ABGEBROCHEN');
  console.error('[Marktag-Start] START ABGEBROCHEN - Ursache und Lösung stehen im Kasten oben.');
  process.exit(1);
}

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

// Tablet-Kassen: der Webserver-Port steht in jedem gedruckten QR-Zettel. Ist er kurz belegt
// (z. B. ein gerade schliessendes altes Fenster), wird bis zu 15 s auf ihn gewartet, bevor -
// mit unuebersehbarer Warnung - auf einen anderen Port ausgewichen wird.
async function warteAufPort(port, sekunden = 15) {
  for (let i = 0; i < sekunden; i++) {
    if (await portIstFrei(port)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
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
    startAbbrechen(erklaere(err, { was: 'Manager-Datenbank öffnen', pfad: dbPath }));
  }

  try {
    const started = performance.now();
    await mgr.start(port);
    telemetry.update({ status: 'ONLINE', latencyMs: performance.now() - started, message: `Manager HTTPS aktiv · Port ${mgr.port}` });
    console.log(`[KC Sync Manager] HTTPS-Server läuft auf https://0.0.0.0:${mgr.port}`);
  } catch (err) {
    telemetry.update({ status: 'OFFLINE', errorCount: 1, message: `Manager-Start: ${err.message}` });
    await telemetry.send().catch(()=>{});
    startAbbrechen(erklaere(err, { was: 'Manager-Dienst starten', port }));
  }

  // Tablet-Kassen (KS-01): Kassenliste vorab lesen - ein Fehler darin darf den Manager nicht
  // aufhalten, wird aber unuebersehbar gemeldet.
  const datenOrdner = standardDatenOrdner();
  let kassenKonfigFehler = null;
  let tabletKassenVorhanden = false;
  const kassenListe = process.env.KC_KASSEN_LISTE ? path.resolve(process.env.KC_KASSEN_LISTE) : path.join(__dirname, 'markttag-kassen.json');
  try { tabletKassenVorhanden = leseKassenKonfig(kassenListe).kassen.length > 0; }
  catch (e) { kassenKonfigFehler = e.kcMeldung || erklaere(e, { was: 'Kassenliste lesen' }); }

  let webserverProzess = null;
  let kassenStart = null;
  const startWarnungen = []; // Meldungen {titel, ursache, loesung[]}
  if (mgr.liveMonitorFehler) {
    const m = erklaere(new Error(mgr.liveMonitorFehler), { was: 'Live-Kanal starten', port: 47392 });
    startWarnungen.push({ ...m, titel: `${m.titel} – im PC-Manager bleiben Kassen-LEDs und Live-Verkäufe leer (Kassieren geht trotzdem)` });
  }
  if (!args.keinWebserver) {
    const wunschPort = args.webserverPort || Number(process.env.KC_SYNC_WEBSERVER_PORT) || zettelWebserverPort(datenOrdner) || 8090;
    let webserverPort;
    if (tabletKassenVorhanden && await warteAufPort(wunschPort)) webserverPort = wunschPort;
    else webserverPort = await findeFreienPort(wunschPort);
    if (tabletKassenVorhanden && webserverPort !== wunschPort) {
      startWarnungen.push(meldung('webport', `Port ${wunschPort} ist belegt – die QR-Zettel der Tablets funktionieren so NICHT`,
        `Ein anderes Programm (fast immer ein zweites schwarzes Fenster) benutzt Port ${wunschPort}. Der Webserver läuft deshalb auf ${webserverPort}, die Zettel zeigen aber auf ${wunschPort}.`,
        SCHRITTE_FENSTER_NEU));
    }
    webserverProzess = spawn(
      process.execPath,
      ['serve-frontend.js', '--port', String(webserverPort), '--root', frontendRoot],
      { cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] }
    );
    // Aktionen aus dem PC-Manager (QR-Zettel gedruckt, neuer Schluessel) kommen ueber den
    // Webserver (nur vom PC selbst) per IPC hier an.
    webserverProzess.on('message', async (nachricht) => {
      if (!nachricht || nachricht.art !== 'kassen-start') return;
      const antworte = (inhalt) => { try { webserverProzess.send({ art: 'kassen-start-antwort', anfrageId: nachricht.anfrageId, ...inhalt }); } catch (e) { /* Webserver weg */ } };
      try {
        if (!kassenStart) return antworte({ status: 503, daten: { fehler: 'kassen_start_noch_nicht_bereit' } });
        if (nachricht.aktion === 'status') return antworte({ status: 200, daten: kassenStart.status() });
        if (nachricht.aktion === 'gedruckt') return antworte({ status: 200, daten: kassenStart.zettelGedruckt(nachricht.ids) });
        if (nachricht.aktion === 'neuer-schluessel') return antworte({ status: 200, daten: await kassenStart.neuerSchluessel(nachricht.id) });
        return antworte({ status: 404, daten: { fehler: 'aktion_unbekannt' } });
      } catch (e) {
        return antworte({ status: 400, daten: { fehler: String(e && e.message || e) } });
      }
    });
    webserverProzess.stdout.on('data', (d) => process.stdout.write(`[Webserver] ${d}`));
    webserverProzess.stderr.on('data', (d) => {
      telemetry.update({ status: 'DEGRADED', errorCount: Number(telemetry.state.errorCount || 0) + 1, message: 'PC-Manager-Webserver meldet Fehler' });
      process.stderr.write(`[Webserver] ${d}`);
    });
    webserverProzess.on('exit', (code) => {
      if (code && code !== 0) telemetry.update({ status: 'DEGRADED', errorCount: Number(telemetry.state.errorCount || 0) + 1, message: `PC-Manager-Webserver beendet · Code ${code}` });
    });

    const managerUrl = `http://127.0.0.1:${webserverPort}/pc-manager/index.html`;
    try { await warteAufHttp(managerUrl); }
    catch (e) {
      startAbbrechen(meldung('webserver', 'PC-Manager-Webseite startet nicht',
        `Der Webserver auf Port ${webserverPort} antwortet nicht – meist blockiert ein Virenscanner „node.exe“ oder der Port ist belegt.`,
        [...SCHRITTE_FENSTER_NEU.slice(0, 3), 'Meldet der Virenscanner etwas: „node.exe“ zulassen.', 'Bleibt der Fehler: Foto von diesem Fenster an den Betreuer schicken.'], e.message));
    }
    telemetry.update({ status: 'ONLINE', message: `Manager + PC-Manager-Webserver aktiv · ${webserverPort}` });

    // Tablet-Kassen starten: feste Ports, dauerhafte Schluessel, Kopplung nur wenn noetig.
    let kassenStatus = null;
    if (kassenKonfigFehler) {
      startWarnungen.push(kassenKonfigFehler);
    } else {
      try {
        const ks = new TabletKassenStart({ manager: mgr, backendDir: __dirname, frontendRoot, datenOrdner, konfigDatei: kassenListe });
        kassenStatus = await ks.start({ webserverPort });
        kassenStart = ks;
        startWarnungen.push(...ks.meldungen);
      } catch (e) {
        const m = e.kcMeldung || erklaere(e, { was: 'Tablet-Kassen starten' });
        startWarnungen.push({ ...m, titel: `Tablet-Kassen NICHT gestartet – ${m.titel}` });
        telemetry.update({ status: 'DEGRADED', errorCount: Number(telemetry.state.errorCount || 0) + 1, message: `Tablet-Kassen: ${e.message}` });
      }
    }

    console.log('');
    console.log('-------------------- START BEREIT ----------------------------');
    console.log(`PC-Manager:   ${managerUrl}`);
    console.log(`Kasse lokal:  http://127.0.0.1:${webserverPort}/pos/index.html`);
    console.log(`Money Butler: http://127.0.0.1:${webserverPort}/money-butler/index.html`);
    console.log('--------------------------------------------------------------');
    if (kassenStatus && kassenStatus.aktiv) {
      console.log(`Tablet-Kassen (PC-Adresse ${kassenStatus.lanAdresse || 'UNBEKANNT'}, ${kassenStatus.adressGrund || ''}):`);
      for (const k of kassenStatus.kassen) {
        const zettel = { gueltig: 'QR-Zettel gueltig', veraltet: 'QR-ZETTEL VERALTET - neu drucken', nicht_gedruckt: 'QR-Zettel noch nicht gedruckt' }[k.zettel] || k.zettel;
        console.log(`  ${k.id.padEnd(10)} Port ${k.port}  Dienst: ${k.dienst === 'laeuft' ? 'laeuft' : 'STEHT'}  ${zettel}`);
      }
      console.log(`QR-Zettel drucken: http://127.0.0.1:${webserverPort}/pc-manager/kassen-zettel.html`);
    }
    console.log('--------------------------------------------------------------');
    if (startWarnungen.length) {
      druckeKasten(console.log, startWarnungen, 'ACHTUNG');
      console.log(`[Marktag-Start] BEREIT MIT WARNUNGEN (${startWarnungen.length}) - Ursache und Lösung stehen im Kasten oben.`);
    } else {
      console.log('[Marktag-Start] ALLES BEREIT');
    }
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
    try { await kassenStart?.stop(); } catch {}
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
    druckeKasten(console.error, [erklaere(err, { was: 'Laufender Betrieb' })], 'PROGRAMM BEENDET');
    console.error('[KC Sync Manager] Das Programm wurde beendet. Tablets kassieren offline weiter; nach dem Neustart werden die Bons nachgereicht.');
    process.exit(1);
  });

  console.log('[KC Sync Manager] Läuft.');
}

main().catch((e) => startAbbrechen(erklaere(e, { was: 'Start' })));
