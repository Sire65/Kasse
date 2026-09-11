/* Reihenfolge der Ereignisse im Live-Monitor.
 *
 * BEFUND 02.09.2026 aus einem Bildschirmfoto des Betreibers: oben standen die drei Verkaeufe
 * neueste-zuerst (22:01:36, 22:01:16, 22:00:57), darunter die Verbindungsmeldungen
 * aelteste-zuerst (21:47:44 ... 22:00:38). Zwei Stellen bestimmten die Reihenfolge, beide nur
 * halb: die nachgeladene Vorgeschichte kommt vom Manager bereits neueste-zuerst und wurde hier
 * noch einmal umgedreht.
 *
 * Der Test faelscht nichts nach, sondern liefert Vorgeschichte und Live-Ereignisse auf denselben
 * beiden Wegen aus, die der Manager auch im Betrieb benutzt: HTTP fuer die Historie,
 * WebSocket fuer die laufenden Ereignisse. Geprueft wird, was am Ende auf dem Bildschirm steht.
 */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
// ws liegt beim Backend (dort wird der Live-Kanal betrieben) - von dort geholt, statt eine
// zweite Kopie in diesen Ordner zu legen.
const { WebSocketServer } = require(require.resolve('ws', { paths: [path.resolve(__dirname, '..', '..', 'kc-sync-installation-und-backend')] }));
const WURZEL = path.resolve(__dirname, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };
let ok = 0, rot = 0;
const p = (n, b, z = '') => { b ? ok++ : rot++; console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '   [' + z + ']' : ''}`); };

const zeit = (hhmmss) => new Date(`2026-09-01T${hhmmss}.000Z`).toISOString();
// So, wie der Manager es liefert: NEUESTE ZUERST.
const HISTORIE = [
  { type: 'connection_lost', registerId: 'KASSE-01', receivedAt: zeit('20:00:38'), payload: {} },
  { type: 'connection_restored', registerId: 'KASSE-01', receivedAt: zeit('20:00:07'), payload: {} },
  { type: 'connection_restored', registerId: 'KASSE-01', receivedAt: zeit('20:00:04'), payload: {} },
  { type: 'connection_lost', registerId: 'KASSE-01', receivedAt: zeit('19:52:21'), payload: {} },
  { type: 'connection_lost', registerId: 'KASSE-01', receivedAt: zeit('19:48:17'), payload: {} },
  { type: 'connection_restored', registerId: 'KASSE-01', receivedAt: zeit('19:47:44'), payload: {} },
];

(async () => {
  const web = http.createServer((q, r) => {
    const f = path.join(WURZEL, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end('x'); } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
  });
  await new Promise((r) => web.listen(8796, '127.0.0.1', r));

  const dienst = http.createServer((q, r) => {
    r.setHeader('Access-Control-Allow-Origin', '*');
    if (q.url.startsWith('/live-event-log')) {
      r.writeHead(200, { 'Content-Type': 'application/json' });
      return r.end(JSON.stringify({ events: HISTORIE }));
    }
    if (q.url.startsWith('/kassen-verbindungen')) {
      r.writeHead(200, { 'Content-Type': 'application/json' });
      return r.end(JSON.stringify({ managerLaeuft: true, kassen: [
        { kasse: 'KASSE-01', gekoppelt: true, zuletztGemeldetVorSek: 2 },
        { kasse: 'KASSE-02', gekoppelt: true, zuletztGemeldetVorSek: null }] }));
    }
    r.writeHead(404); r.end('x');
  });
  await new Promise((r) => dienst.listen(47392, '127.0.0.1', r));
  const wss = new WebSocketServer({ noServer: true });
  const offen = new Set();
  dienst.on('upgrade', (req, socket, head) => {
    if (!req.url.startsWith('/live-monitor')) return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => { offen.add(ws); ws.on('close', () => offen.delete(ws)); });
  });
  const sende = (evt) => { for (const ws of offen) ws.send(JSON.stringify(evt)); };

  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const fehler = []; pg.on('pageerror', (e) => fehler.push(e.message));
  await pg.goto('http://127.0.0.1:8796/pc-manager/index.html');
  await pg.waitForTimeout(9000);
  await pg.evaluate(() => { document.body.classList.remove('manager-locked'); document.querySelectorAll('dialog[open]').forEach((d) => { try { d.close(); } catch (e) {} }); });
  await pg.waitForTimeout(1000);

  // Live-Monitor oeffnen, damit die Liste sichtbar ist und die Historie nachgeladen wird.
  await pg.evaluate(() => { if (window.KCLiveMonitor?.oeffne) window.KCLiveMonitor.oeffne(); else document.querySelector('[data-view="live-monitor"], #navLiveMonitor')?.click(); });
  await pg.waitForTimeout(2500);

  // Erst JETZT kommen die drei Verkaeufe live herein - genau die Reihenfolge aus dem Betrieb:
  // die Vorgeschichte lag schon da, die Verkaeufe treffen danach ein.
  sende({ type: 'sale', registerId: 'KASSE-01', receivedAt: zeit('20:00:57'), payload: { operator: 'Team', total: 9.0, itemCount: 1, method: 'cash-button-direct' } });
  await pg.waitForTimeout(300);
  sende({ type: 'sale', registerId: 'KASSE-01', receivedAt: zeit('20:01:16'), payload: { operator: 'Pumuckl', total: 7.5, itemCount: 1, method: 'cash-roundup' } });
  await pg.waitForTimeout(300);
  sende({ type: 'sale', registerId: 'KASSE-01', receivedAt: zeit('20:01:36'), payload: { operator: 'Pumuckl', total: 17.0, itemCount: 1, method: 'internal-personal' } });
  await pg.waitForTimeout(2500);

  const zeiten = await pg.evaluate(() => [...document.querySelectorAll('#kcLiveList .kc-live-row time, .kc-live-row time')].map((e) => e.textContent.trim()));
  p('es stehen alle Ereignisse in der Liste - Vorgeschichte UND die neuen Verkaeufe',
    zeiten.length >= 9, `${zeiten.length} Zeilen: ${zeiten.join(' ')}`);

  const alsZahl = (t) => { const [h, m, s] = t.split(':').map(Number); return h * 3600 + m * 60 + (s || 0); };
  const werte = zeiten.map(alsZahl);
  const absteigend = werte.every((v, i) => i === 0 || werte[i - 1] >= v);
  p('die ganze Liste steht neueste zuerst - kein Sprung zurueck in der Mitte',
    absteigend, zeiten.join(' | '));

  p('der neueste Verkauf steht ganz oben', zeiten[0] === '22:01:36' || /01:36$/.test(zeiten[0]), zeiten[0]);
  p('die aelteste Verbindungsmeldung steht ganz unten',
    /47:44$/.test(zeiten[zeiten.length - 1]), zeiten[zeiten.length - 1]);

  // Ein Ereignis OHNE verwertbaren Zeitstempel darf nicht verschwinden - eine fehlende Zeit
  // ist kein Grund, ein Ereignis zu verstecken.
  sende({ type: 'sale', registerId: 'KASSE-01', receivedAt: null, payload: { operator: 'Ohnezeit', total: 1.0, itemCount: 1, method: 'cash' } });
  await pg.waitForTimeout(1500);
  const mitOhne = await pg.evaluate(() => (document.getElementById('kcLiveList') || document.body).innerText);
  p('ein Ereignis ohne Zeitstempel bleibt sichtbar, statt wegsortiert zu werden',
    /Ohnezeit/.test(mitOhne), mitOhne.split('\n').slice(0, 2).join(' | '));

  p('keine Skriptfehler ueber den ganzen Lauf', fehler.length === 0, fehler.slice(0, 2).join(' | ') || 'keine');

  await b.close();
  [web, dienst].forEach((s) => { try { s.closeAllConnections && s.closeAllConnections(); } catch (e) {} s.close(); });
  console.log(`\nReihenfolge im Live-Monitor: ${ok}/${ok + rot} bestanden`);
  process.exit(rot ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
