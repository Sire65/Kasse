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
// KS-05: TV-Paket (Präsentation) - nur am PC selbst; es kann Mitgliederfotos enthalten.
const TV_PAKET_DATEI = process.env.KC_TV_PAKET_DATEI || null;
const STAND_MELDUNGEN_DATEI = process.env.KC_STAND_MELDUNGEN_DATEI || null;
const TV_PROGRAMM_DATEI = process.env.KC_TV_PROGRAMM_DATEI || null;
// KS-05: Präsentation aus dem TV-Designer als eigenständiges HTML-Programm - nur am PC selbst.
function behandleTvProgramm(req, res) {
  if (!TV_PROGRAMM_DATEI) { json(res, 404, { fehler: 'kein_tv_paket_ort' }); return; }
  if (req.method === 'GET') {
    let st = null; try { st = fs.statSync(TV_PROGRAMM_DATEI); } catch (e) { /* noch keins */ }
    if (!st) { json(res, 404, { fehler: 'noch_kein_tv_programm' }); return; }
    if (/[?&]nurStand=1/.test(req.url)) { json(res, 200, { stand: st.mtimeMs, groesse: st.size }); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    fs.createReadStream(TV_PROGRAMM_DATEI).pipe(res);
    return;
  }
  if (req.method !== 'POST') { json(res, 405, { fehler: 'methode' }); return; }
  const herkunft = req.headers.origin;
  if (req.headers['x-kc-aktion'] !== '1' || (herkunft && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(herkunft))) { json(res, 403, { fehler: 'herkunft_abgelehnt' }); return; }
  const teile = []; let groesse = 0, zuGross = false;
  req.on('data', (c) => { groesse += c.length; if (groesse > 64 * 1024 * 1024) { zuGross = true; req.destroy(); } else teile.push(c); });
  req.on('end', () => {
    if (zuGross) return;
    const html = Buffer.concat(teile).toString('utf8');
    if (!/<html[\s>]/i.test(html) || html.length < 200) { json(res, 400, { fehler: 'kein_gueltiges_tv_programm' }); return; }
    try {
      fs.mkdirSync(path.dirname(TV_PROGRAMM_DATEI), { recursive: true });
      const tmp = `${TV_PROGRAMM_DATEI}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, html); fs.renameSync(tmp, TV_PROGRAMM_DATEI);
    } catch (e) { json(res, 500, { fehler: 'speichern_fehlgeschlagen', technik: e.message }); return; }
    if (process.send && process.connected) { try { process.send({ art: 'kassen-start', anfrageId: 0, aktion: 'fernseher-sicherstellen' }); } catch (e) { /* */ } }
    json(res, 200, { gespeichert: true, groesse: html.length });
  });
}
function behandleTvPaket(req, res) {
  if (!TV_PAKET_DATEI) { json(res, 404, { fehler: 'kein_tv_paket_ort' }); return; }
  if (req.method === 'GET') {
    let st = null; try { st = fs.statSync(TV_PAKET_DATEI); } catch (e) { /* noch keins */ }
    if (!st) { json(res, 404, { fehler: 'noch_kein_tv_paket' }); return; }
    if (/[?&]nurStand=1/.test(req.url)) { json(res, 200, { stand: st.mtimeMs, groesse: st.size }); return; }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-KC-Stand': String(st.mtimeMs) });
    fs.createReadStream(TV_PAKET_DATEI).pipe(res);
    return;
  }
  if (req.method !== 'POST') { json(res, 405, { fehler: 'methode' }); return; }
  const herkunft = req.headers.origin;
  if (req.headers['x-kc-aktion'] !== '1' || (herkunft && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(herkunft))) { json(res, 403, { fehler: 'herkunft_abgelehnt' }); return; }
  const teile = []; let groesse = 0, zuGross = false;
  req.on('data', (c) => { groesse += c.length; if (groesse > 64 * 1024 * 1024) { zuGross = true; req.destroy(); } else teile.push(c); });
  req.on('end', () => {
    if (zuGross) return;
    let paket;
    try { paket = JSON.parse(Buffer.concat(teile).toString('utf8')); } catch (e) { json(res, 400, { fehler: 'kein_gueltiges_tv_paket' }); return; }
    if (!paket || !['KC-TV-1', 'kcm-tv-package-v2'].includes(paket.schema) || !Array.isArray(paket.slides)) { json(res, 400, { fehler: 'kein_gueltiges_tv_paket' }); return; }
    try {
      fs.mkdirSync(path.dirname(TV_PAKET_DATEI), { recursive: true });
      const tmp = `${TV_PAKET_DATEI}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(paket));
      fs.renameSync(tmp, TV_PAKET_DATEI);
    } catch (e) { json(res, 500, { fehler: 'speichern_fehlgeschlagen', technik: e.message }); return; }
    if (process.send && process.connected) { try { process.send({ art: 'kassen-start', anfrageId: 0, aktion: 'fernseher-sicherstellen' }); } catch (e) { /* */ } }
    json(res, 200, { gespeichert: true, folien: paket.slides.length });
  });
}

function behandleKassenStart(req, res, urlPath) {
  const aktion0 = urlPath.slice('/kc-kassen-start/'.length);
  // Meldungen des Stands für die Tablets (nur Titel/Ursache/Lösung, keine Geheimnisse) - auch übers WLAN.
  if (req.method === 'GET' && aktion0 === 'stand-meldungen') {
    let daten = { meldungen: [], stand: null };
    try { if (STAND_MELDUNGEN_DATEI) daten = JSON.parse(fs.readFileSync(STAND_MELDUNGEN_DATEI, 'utf8')); } catch (e) { /* noch keine */ }
    res.setHeader('Access-Control-Allow-Origin', '*');
    json(res, 200, daten); return;
  }
  if (!nurLokal(req)) { json(res, 403, { fehler: 'nur_am_pc_selbst' }); return; }
  const aktion = aktion0;
  if (aktion === 'tv-paket') { behandleTvPaket(req, res); return; }
  if (aktion === 'tv-programm') { behandleTvProgramm(req, res); return; }
  // KS-04: Läuft dieser Webserver am Stand (mit Manager-Dienst) oder zu Hause (nur PC-Manager, Fernmodus)?
  if (req.method === 'GET' && aktion === 'modus') { json(res, 200, { modus: process.env.KC_MODUS || (process.send ? 'stand' : 'unbekannt') }); return; }
  if (req.method === 'GET' && aktion === 'status') {
    frageStartprozess({ aktion: 'status' }).then((a) => json(res, a.status, a.daten));
    return;
  }
  if (req.method === 'GET' && aktion === 'stand-status') {
    frageStartprozess({ aktion: 'stand-status' }).then((a) => json(res, a.status, a.daten));
    return;
  }
  if (req.method !== 'POST' || !['gedruckt', 'neuer-schluessel', 'stand-einrichten', 'stand-abmelden'].includes(aktion)) { json(res, 404, { fehler: 'unbekannt' }); return; }
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
    frageStartprozess({ aktion, id: daten.id, ids: daten.ids, daten: aktion === 'stand-einrichten' ? daten : undefined }).then((a) => json(res, a.status, a.daten));
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
