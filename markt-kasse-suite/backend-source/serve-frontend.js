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

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const requestedPath = path.normalize(path.join(root, urlPath));
    if (!requestedPath.startsWith(root)) { res.writeHead(403); res.end('Verboten'); return; }

    let filePath = requestedPath;
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Nicht gefunden: ' + urlPath); return; }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.writeHead(500); res.end('Serverfehler: ' + err.message);
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
  console.log(`Auf diesem Rechner:  http://127.0.0.1:${port}/pos/index.html`);
  if (lanAddresses.length) {
    lanAddresses.forEach((addr) => console.log(`Für andere Geräte im selben WLAN: http://${addr}:${port}/pos/index.html`));
  } else {
    console.log('Keine WLAN-Adresse gefunden - nur auf diesem Rechner erreichbar.');
  }
});

process.on('SIGTERM', () => { server.close(() => process.exit(0)); });
process.on('SIGINT', () => { server.close(() => process.exit(0)); });
