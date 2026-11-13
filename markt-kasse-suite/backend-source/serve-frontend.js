// KC Sync – kleiner, eigenständiger statischer Webserver.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function argValue(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}
const port = Number(argValue('port', 8090));
const root = path.resolve(argValue('root', process.cwd()));

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.gif': 'image/gif', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.map': 'application/json',
};

// Tablet-Kassen (KS-01): kassen-verbindungen.json enthaelt die Zugangsschluessel der Tablets.
// Sie ist deshalb NUR vom PC selbst abrufbar - nicht ueber das Stand-WLAN (offener Befund aus
// ZUSAMMENFUEHRUNG_28_09_2026.md). Zusaetzlich wird der Host-Kopf geprueft, damit eine fremde
// Webseite im Browser des PCs nicht per DNS-Rebinding mitlesen kann.
function istLoopback(req) {
  const a = req.socket.remoteAddress || '';
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
}
function hostIstLokal(req) {
  return /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(String(req.headers.host || ''));
}
function nurLokal(req) { return istLoopback(req) && hostIstLokal(req); }
function istSchluesselDatei(datei) {
  // Windows ignoriert Gross-/Kleinschreibung und angehaengte Punkte/Leerzeichen.
  const name = path.basename(datei).toLowerCase().replace(/[. ]+$/, '');
  return name === 'kassen-verbindungen.json';
}

// Aktionen der QR-Zettel-Seite werden per IPC an den Startprozess (run-manager-service.js)
// weitergereicht, der die Tablet-Kassen verwaltet.
const offeneAnfragen = new Map();
let anfrageZaehler = 0;
if (process.send) {
  process.on('message', (m) => {
    if (!m || m.art !== 'kassen-start-antwort') return;
    const offen = offeneAnfragen.get(m.anfrageId);
    if (!offen) return;
    offeneAnfragen.delete(m.anfrageId);
    clearTimeout(offen.timer);
    offen.resolve({ status: m.status || 500, daten: m.daten || {} });
  });
  // Endet der Startprozess (Fenster zu, Absturz), endet auch der Webserver - sonst bliebe
  // Port 8090 belegt und der naechste Start liefe auf einem anderen Port.
  process.on('disconnect', () => process.exit(0));
}
function frageStartprozess(nachricht) {
  return new Promise((resolve) => {
    if (!process.send || !process.connected) { resolve({ status: 503, daten: { fehler: 'kassen_start_nicht_verbunden' } }); return; }
    const anfrageId = ++anfrageZaehler;
    const timer = setTimeout(() => { offeneAnfragen.delete(anfrageId); resolve({ status: 504, daten: { fehler: 'zeitueberschreitung' } }); }, 30000);
    offeneAnfragen.set(anfrageId, { resolve, timer });
    try { process.send({ art: 'kassen-start', anfrageId, ...nachricht }); }
    catch (e) { clearTimeout(timer); offeneAnfragen.delete(anfrageId); resolve({ status: 503, daten: { fehler: 'kassen_start_nicht_verbunden' } }); }
  });
}
function json(res, status, daten) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(daten));
}
function behandleKassenStart(req, res, urlPath) {
  if (!nurLokal(req)) { json(res, 403, { fehler: 'nur_am_pc_selbst' }); return; }
  const aktion = urlPath.slice('/kc-kassen-start/'.length);
  if (req.method === 'GET' && aktion === 'status') {
    frageStartprozess({ aktion: 'status' }).then((a) => json(res, a.status, a.daten));
    return;
  }
  if (req.method !== 'POST' || !['gedruckt', 'neuer-schluessel'].includes(aktion)) { json(res, 404, { fehler: 'unbekannt' }); return; }
  // Schutz gegen fremde Webseiten: eigener Kopf (erzwingt eine CORS-Vorabfrage, die hier nie
  // beantwortet wird) und - falls vorhanden - Herkunft nur vom PC selbst.
  const herkunft = req.headers.origin;
  if (req.headers['x-kc-aktion'] !== '1' || (herkunft && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(herkunft))) {
    json(res, 403, { fehler: 'herkunft_abgelehnt' }); return;
  }
  let koerper = '';
  req.on('data', (c) => { koerper += c; if (koerper.length > 4096) req.destroy(); });
  req.on('end', () => {
    let daten = {};
    try { daten = JSON.parse(koerper || '{}'); } catch (e) { json(res, 400, { fehler: 'json_ungueltig' }); return; }
    frageStartprozess({ aktion, id: daten.id, ids: daten.ids }).then((a) => json(res, a.status, a.daten));
  });
}

function liegtUnterRoot(datei) {
  const rel = path.relative(root, datei);
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath.startsWith('/kc-kassen-start/')) { behandleKassenStart(req, res, urlPath); return; }
    // Windows-Sonderformen (Datenstroeme "datei:stream") gibt es fuer echte Dateien hier nie.
    if (urlPath.includes(':')) { res.writeHead(403); res.end('Verboten'); return; }
    const requestedPath = path.normalize(path.join(root, urlPath));
    if (!liegtUnterRoot(requestedPath)) { res.writeHead(403); res.end('Verboten'); return; }
    if (istSchluesselDatei(requestedPath) && !nurLokal(req)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('Nur am PC selbst abrufbar.');
      return;
    }

    let filePath = requestedPath;
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    if (!fs.existsSync(filePath)) { res.writeHead(404, { 'Cache-Control': 'no-store' }); res.end('Nicht gefunden: ' + urlPath); return; }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.writeHead(500, { 'Cache-Control': 'no-store' }); res.end('Serverfehler: ' + err.message);
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} ist bereits belegt (läuft der Webserver schon in einem anderen Prozess?). Start abgebrochen.`);
  } else {
    console.error('Webserver-Fehler:', err.message);
  }
  process.exit(1);
});

server.listen(port, '0.0.0.0', () => {
  const os = require('os');
  const lanAddresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  console.log(`KC Sync Webserver läuft auf Port ${port} (Wurzelordner: ${root})`);
  console.log(`PC-Manager lokal:  http://127.0.0.1:${port}/pc-manager/index.html`);
  console.log(`Kasse lokal:       http://127.0.0.1:${port}/pos/index.html`);
  console.log(`Money Butler lokal:http://127.0.0.1:${port}/money-butler/index.html`);
  if (lanAddresses.length) {
    lanAddresses.forEach((addr) => {
      console.log(`WLAN Kasse:        http://${addr}:${port}/pos/index.html`);
      console.log(`WLAN Money Butler: http://${addr}:${port}/money-butler/index.html`);
    });
  } else {
    console.log('Keine WLAN-Adresse gefunden - nur auf diesem Rechner erreichbar.');
  }
});

process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
process.on('SIGINT', () => { server.close(() => process.exit(0)); });
