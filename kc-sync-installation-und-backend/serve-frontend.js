// KC Sync – kleiner, eigenständiger statischer Webserver.
//
// Grund für dieses eigene, winzige Programm statt eines fertigen Werkzeugs (z. B. "http-server"
// über npx): ein fertiges Werkzeug müsste bei jedem ersten Start aus dem Internet heruntergeladen
// werden - für einen Marktstand ohne verlässliches Internet ungeeignet. Dieses Skript braucht
// nur Node.js selbst, keine weitere Abhängigkeit.
//
// Öffnet die Kassenoberfläche/PC Manager über http://, nicht über file:// - wichtig, weil
// Browser bei file:// aus Sicherheitsgründen genau die Verbindungen blockieren, die KC Sync
// braucht (CORS-Regeln, teils auch IndexedDB).
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

// Kurzcode-Kopplung fuer alte/kamera-schwache Tablets (11.09.2026). Die Datei wird von
// markttag-start.js VOR dem Start dieses Prozesses geschrieben (kein gemeinsamer Speicher
// zwischen den beiden Prozessen) und hier einmal beim Hochfahren eingelesen. Fehlt die Datei
// oder ist sie leer, laeuft alles wie gehabt weiter - der Webserver braucht sie nicht zwingend.
const kurzcodePfad = argValue('kurzcodes', '');
let kurzcodeZiele = {};
if (kurzcodePfad) {
  try { kurzcodeZiele = JSON.parse(fs.readFileSync(kurzcodePfad, 'utf-8')) || {}; }
  catch (e) { console.warn('Kurzcodes konnten nicht gelesen werden:', e.message); }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.gif': 'image/gif', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.map': 'application/json',
};

// WER HAT SICH SCHON GEMELDET?
//
// WARUM: Jede Vorpruefung am PC ist ein Indiz. Eine Firewall-Abfrage sagt nur, ob eine REGEL
// existiert - ob das Tablet wirklich DURCHKOMMT, weiss nur das Tablet. Am 01.09.2026 stand
// genau das im Weg: der Rechner selbst konnte die Kasse oeffnen, das iPad nicht, und am
// Tablet war nicht zu erkennen, woran es lag.
//
// Deshalb merkt sich der Webserver, von welcher FREMDEN Adresse eine Anfrage kam und welche
// Kasse dabei geoeffnet wurde. Die Uebersichtsseite am PC zeigt das live an. Damit sieht man
// AM PC, ob es geklappt hat, statt am Tablet zu raten.
//
// Gespeichert wird nichts auf der Platte und nichts ueber den Inhalt - nur Adresse, Kassen-ID
// und Zeitpunkt, und nur im Arbeitsspeicher bis zum Schliessen des Fensters.
const geraete = new Map();
function merkeGeraet(req, urlPath) {
  try {
    const roh = (req.socket && req.socket.remoteAddress) || '';
    const ip = roh.replace(/^::ffff:/, '');
    if (!ip || ip === '127.0.0.1' || ip === '::1') return;   // der eigene Rechner zaehlt nicht
    const abfrage = new URLSearchParams((req.url.split('?')[1] || ''));
    const kasse = abfrage.get('kcRegisterId') || null;
    const vorher = geraete.get(ip) || {};
    geraete.set(ip, {
      ip,
      kasse: kasse || vorher.kasse || null,
      erste: vorher.erste || Date.now(),
      letzte: Date.now(),
      anfragen: (vorher.anfragen || 0) + 1,
      letzterPfad: urlPath,
    });
  } catch (e) { /* Statistik darf den Betrieb nie stoeren */ }
}

const schulung = new Map();   /* Kennung -> Uebungstablet */
const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    merkeGeraet(req, urlPath);

    // Statusauskunft fuer die Uebersichtsseite. Die liegt als lokale Datei vor und fragt hier
    // ueber das Netz nach - deshalb ausdruecklich fuer alle Herkuenfte freigegeben. Es werden
    // ausschliesslich die eben beschriebenen Verbindungsdaten herausgegeben.
    // SCHULUNG (08.09.2026): Uebungstablets melden sich hier an (Kennung, Name), die Uebersicht
    // und der Manager lesen die Liste. Nur im Speicher, verschwindet mit dem Fenster.
    if (urlPath === '/schulung/anmelden' && req.method === 'POST') {
      let body = ''; req.on('data', (c) => { body += c; if (body.length > 4000) req.destroy(); });
      req.on('end', () => {
        try { const d = JSON.parse(body || '{}'); const k = String(d.kennung || '').slice(0, 20) || ('SCHULUNG-' + String(schulung.size + 1).padStart(2, '0'));
          schulung.set(k, { kennung: k, name: String(d.name || '').slice(0, 40), bons: Number(d.bons || 0), geraet: String(d.geraet || '').slice(0, 60), zuletzt: new Date().toISOString() });
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify({ ok: true, kennung: k, anzahl: schulung.size }));
        } catch (e) { res.writeHead(400, { 'Access-Control-Allow-Origin': '*' }); res.end('{}'); }
      });
      return;
    }
    if (urlPath === '/schulung/anmelden' && req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST' }); return res.end(); }
    if (urlPath === '/schulung/beenden' && req.method === 'POST') { schulung.clear(); res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); return res.end('{"ok":true}'); }
    if (urlPath === '/schulung/liste') {
      const jetzt = Date.now(); const geraete = [...schulung.values()].filter((g) => jetzt - Date.parse(g.zuletzt) < 120000);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); return res.end(JSON.stringify({ ok: true, geraete }));
    }
    if (urlPath === '/__kc-status') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify({ jetzt: Date.now(), geraete: [...geraete.values()] }));
      return;
    }
    // Manuelle Kurzcode-Kopplung (11.09.2026): Ersatz fuer Tablets, deren Kamera keinen
    // QR-Code lesen kann (z.B. Samsung SM-T535, Android 5.0.2). "/k" zeigt ein Eingabefeld,
    // "/k/<CODE>" leitet direkt auf die echte, lange Kopplungs-URL der jeweiligen Kasse um.
    if (urlPath === '/k' || urlPath === '/k/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KC Kasse - Kurzcode</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:420px;margin:40px auto;padding:0 20px;color:#1c2430;text-align:center}
  h1{font-size:1.3rem}
  input{font-family:monospace;font-size:1.8rem;letter-spacing:.15em;text-align:center;text-transform:uppercase;
    width:100%;padding:14px 8px;border:2px solid #9fb0c2;border-radius:10px;box-sizing:border-box;margin:18px 0}
  button{font-size:1.15rem;font-weight:800;padding:14px 24px;border:0;border-radius:10px;background:#173765;color:#fff;width:100%}
  .fehler{color:#b91c1c;font-weight:700;margin-top:10px}
</style></head><body>
  <h1>Kasse mit Kurzcode koppeln</h1>
  <p>Den Kurzcode von der Übersichtsseite eintippen (Groß-/Kleinschreibung egal).</p>
  <form id="f"><input id="c" maxlength="8" autocomplete="off" autocapitalize="characters" inputmode="text" placeholder="z.B. K7X9QM"><button type="submit">Kasse öffnen</button></form>
  <div class="fehler" id="e" hidden>Code nicht gefunden - bitte erneut eingeben.</div>
  <script>
    document.getElementById('f').addEventListener('submit', function(ev){
      ev.preventDefault();
      var code = document.getElementById('c').value.trim();
      if (!code) return;
      window.location.href = '/k/' + encodeURIComponent(code);
    });
    if (location.search.indexOf('fehler=1') !== -1) document.getElementById('e').hidden = false;
  </script>
</body></html>`);
      return;
    }
    if (urlPath.indexOf('/k/') === 0) {
      const code = decodeURIComponent(urlPath.slice(3)).trim().toUpperCase();
      const ziel = kurzcodeZiele[code];
      if (ziel) { res.writeHead(302, { Location: ziel }); res.end(); return; }
      res.writeHead(302, { Location: '/k?fehler=1' }); res.end(); return;
    }

    // Befund-Vorsorge: Pfad-Traversal ("../") darf niemals außerhalb von root lesen können.
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

// Mehrgeräte-Betrieb am Marktstand: 0.0.0.0 statt nur 127.0.0.1, damit Tablets im selben WLAN
// die Seite erreichen können, nicht nur der eigene Rechner.
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
