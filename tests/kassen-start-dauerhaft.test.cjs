/* KS-01 „Einmal koppeln, dauerhaft gültig“ – der ganze Weg, echt.
 *
 * WARUM DIESER TEST EXISTIERT
 * Bis November 2026 vergab der Markttag-Start bei JEDEM Start neue Ports und Schlüssel. Jedes
 * Tablet musste jeden Morgen neu gescannt werden – vom Monitor im Nebenraum. Seit KS-01 wird
 * einmal ein QR-Zettel gedruckt, und der gilt dauerhaft.
 *
 * Geprüft wird mit dem ECHTEN Startweg (run-manager-service.js, wie KC_Manager_Start.cmd ihn
 * aufruft), echten Kassen-Diensten, echtem Webserver und einem Browser als Tablet über die
 * Netzwerkadresse dieses Rechners:
 *   A  erster Start: Kopplung, feste Ports, QR-Zettel drucken, QR vom Zettel zurücklesen,
 *      Tablet öffnet die Adresse VOM ZETTEL, Buchung kommt im Manager an
 *   B  Neustart: nichts neu gekoppelt, gleiche Ports und Schlüssel, Zettel gültig,
 *      Tablet verbindet ohne Scannen – auch über die einfache Adresse ohne Anhang
 *   C  Kopplung läuft bald ab (30-Tage-Grenze): wird beim Start still erneuert, Zettel bleibt
 *   D  Manager neu installiert (neue ZIP, neue Manager-Datenbank): Kassen koppeln sich neu,
 *      Zettel bleibt, Buchungen gehen an den neuen Manager; Wächter startet abgestürzten
 *      Kassen-Dienst neu; „Schlüssel erneuern“ sperrt den alten Zettel sofort, das Tablet sagt
 *      verständlich, was zu tun ist
 *   E  Webserver-Port belegt: unübersehbare Warnung statt stillem Ausweichen
 *   F  PC hat eine andere Adresse als die Zettel: unübersehbare Warnung
 *   Sicherheit: Schlüsseldatei und Aktionen nur am PC selbst, nicht übers WLAN, nicht per
 *   fremder Webseite. Am Ende: keine verwaisten Prozesse, alle Ports frei.
 */
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http'), net = require('net');
const { spawn } = require('child_process');
const WURZEL = path.join(__dirname, '..');
const BACKEND = path.join(WURZEL, 'markt-kasse-suite', 'backend-source');
try { require.resolve('playwright'); } catch (e) { console.log('  ueberspringen: Playwright nicht installiert'); process.exit(0); }
for (const m of ['ws', 'selfsigned', 'bonjour-service']) {
  try { require.resolve(m, { paths: [BACKEND] }); } catch (e) { console.log(`  ueberspringen: ${m} fehlt - einmal "npm install" in markt-kasse-suite/backend-source`); process.exit(0); }
}
let jsQR = null, PNG = null;
try { jsQR = require('jsqr'); PNG = require('pngjs').PNG; } catch (e) { /* optional: QR-Rücklesen */ }
const { chromium } = require('playwright');
const { DatabaseSync } = require('node:sqlite');

let ok = 0, rot = 0;
const p = (n, b, z = '') => { b ? ok++ : rot++; console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z !== '' ? '   [' + z + ']' : ''}`); };

const MGR_PORT = 8571, WEB_PORT = 8891;
const lan = Object.values(os.networkInterfaces()).flat().find((e) => e && e.family === 'IPv4' && !e.internal && !e.address.startsWith('169.254.'));
if (!lan) { console.log('Keine Netzwerkadresse - dieser Test braucht eine (Tablet-Zugriff über WLAN).'); process.exit(1); }
const LAN = lan.address;
const ARBEIT = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-kassenstart-'));
const DATEN = path.join(ARBEIT, 'tablet-kassen');
const MGR_DB = path.join(ARBEIT, 'manager.sqlite');
const VERBINDUNGSDATEI = path.join(WURZEL, 'pc-manager', 'kassen-verbindungen.json');
const verbindungsdateiVorher = fs.existsSync(VERBINDUNGSDATEI) ? fs.readFileSync(VERBINDUNGSDATEI) : null;
const AUSGABE = process.env.KC_TEST_AUSGABE || null; // optional: Zettel-Vorschau ablegen

function holen(url, { methode = 'GET', kopf = {}, koerper, quelle } = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: methode, headers: kopf, localAddress: quelle, timeout: 8000 }, (res) => {
      let d = ''; res.on('data', (c) => { d += c; });
      res.on('end', () => { let j = null; try { j = JSON.parse(d); } catch (e) { /* kein JSON */ } resolve({ status: res.statusCode, json: j, text: d }); });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ status: 0, fehler: e.message }));
    req.end(koerper);
  });
}
const status = () => holen(`http://127.0.0.1:${WEB_PORT}/kc-kassen-start/status`).then((a) => a.json);
const aktion = (was, koerper) => holen(`http://127.0.0.1:${WEB_PORT}/kc-kassen-start/${was}`, { methode: 'POST', kopf: { 'Content-Type': 'application/json', 'X-KC-Aktion': '1' }, koerper: JSON.stringify(koerper) });
const portFrei = (port) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.listen(port, '0.0.0.0', () => s.close(() => r(true))); });
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

async function starte(name) {
  const kind = spawn(process.execPath, [path.join(BACKEND, 'run-manager-service.js'), '--db', MGR_DB, '--port', String(MGR_PORT), '--webserver-port', String(WEB_PORT)], {
    cwd: BACKEND, env: { ...process.env, KC_KASSEN_DATEN: DATEN, KICC_PROGRAM_HEARTBEAT_ENDPOINT: '', KICC_PROGRAM_FLOW_ENDPOINT: '' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  kind.stdout.on('data', (d) => { log += d; });
  kind.stderr.on('data', (d) => { log += d; });
  const ende = Date.now() + 70000;
  while (Date.now() < ende && !/\[Marktag-Start\] (ALLES BEREIT|BEREIT MIT WARNUNGEN)/.test(log) && kind.exitCode === null) await warte(250);
  const bereit = /\[Marktag-Start\] (ALLES BEREIT|BEREIT MIT WARNUNGEN)/.test(log);
  if (!bereit) console.log(`--- Startprotokoll ${name} ---\n${log.replace(/kcToken=[^&\s]+/g, 'kcToken=***')}\n---`);
  return { kind, log: () => log, bereit };
}
async function stoppe(lauf) {
  if (!lauf || lauf.kind.exitCode !== null) return;
  const weg = new Promise((r) => lauf.kind.once('exit', r));
  lauf.kind.kill('SIGINT');
  await Promise.race([weg, warte(15000)]);
  if (lauf.kind.exitCode === null) lauf.kind.kill('SIGKILL');
  await warte(500);
}
function managerDb(fn) { const db = new DatabaseSync(MGR_DB); try { return fn(db); } finally { db.close(); } }
// Gebucht wird ein echter Verkauf ("sale") - andere Buchungsarten weist der Manager zu Recht ab.
// Die Kennung steckt in transactionId und wird im Manager wiedergefunden.
async function warteAufBuchung(kennung, sekunden = 45) {
  for (let i = 0; i < sekunden * 2; i++) {
    const n = managerDb((db) => db.prepare("SELECT COUNT(*) AS n FROM received_events WHERE type = 'sale' AND payload LIKE ?").get(`%${kennung}%`).n);
    if (n > 0) return n;
    await warte(500);
  }
  return 0;
}
// Das Tablet: dieselben Aufrufe, die die Kasse über KCSyncConnection macht.
async function tabletFragt(seite, pfad, optionen) {
  return seite.evaluate(async ([pf, opt]) => {
    try {
      const a = await fetch(window.KCSyncConnection.buildUrl(pf), opt || {});
      let j = null; try { j = await a.json(); } catch (e) { /* leer */ }
      return { status: a.status, json: j };
    } catch (e) { return { status: 0, fehler: String(e.message || e) }; }
  }, [pfad, optionen || null]);
}
async function tabletBucht(seite, kennung) {
  const kasse = await seite.evaluate(() => window.KCSyncConnection.config.registerId);
  return tabletFragt(seite, '/kc-sync-record-event', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'sale', payload: { transactionId: kennung, registerId: kasse, bon: 1, type: 'sale', training: true, due: 0, items: [], time: new Date().toISOString() } }) });
}
async function warteGruen(seite, sekunden = 45) {
  let letzte = null;
  for (let i = 0; i < sekunden; i++) {
    letzte = await tabletFragt(seite, '/kc-sync-status');
    if (letzte.status === 200 && letzte.json && letzte.json.connection && letzte.json.connection.color === 'gruen') return letzte;
    await warte(1000);
  }
  return letzte;
}
async function oeffneKasse(seite, url) {
  await seite.goto(url, { waitUntil: 'domcontentloaded' });
  await seite.waitForFunction(() => !!window.KCSyncConnection, null, { timeout: 30000 });
}

(async () => {
  let lauf = null, browser = null, belegt = null;
  try {
    for (const port of [MGR_PORT, WEB_PORT, 47392, 47500, 47501, 47502]) {
      if (!(await portFrei(port))) { console.log(`Port ${port} ist belegt - Test kann nicht laufen.`); process.exit(1); }
    }
    browser = await chromium.launch();

    // ================= A: erster Start =================
    console.log('\n-- A: erster Start --');
    lauf = await starte('A');
    p('A: Start meldet ALLES BEREIT', /ALLES BEREIT/.test(lauf.log()));
    p('A: alle drei Kassen werden beim ersten Start gekoppelt', ['01', '02', '03'].every((n) => new RegExp(`KASSE-${n}: neu gekoppelt`).test(lauf.log())));
    const sA = await status();
    p('A: drei Kassen mit festen Ports 47500 / 47501 / 47502', sA && sA.kassen.map((k) => `${k.id}:${k.port}`).join(',') === 'KASSE-01:47500,KASSE-02:47501,KASSE-03:47502', sA && sA.kassen.map((k) => k.port).join(','));
    p('A: alle drei Kassen-Dienste laufen', sA && sA.kassen.every((k) => k.dienst === 'laeuft'));
    p('A: Daten der Tablet-Kassen liegen im Datenordner, nicht im Programmordner',
      fs.existsSync(path.join(DATEN, 'KASSE-01.sqlite')) && fs.existsSync(path.join(DATEN, 'kassen-start.json')));
    p('A: Zettel gelten als „noch nicht gedruckt“', sA && sA.kassen.every((k) => k.zettel === 'nicht_gedruckt'));

    // ---- Sicherheit ----
    const vl = `pc-manager/kassen-verbindungen.json`;
    p('Sicherheit: Schlüsseldatei am PC selbst lesbar', (await holen(`http://127.0.0.1:${WEB_PORT}/${vl}`)).status === 200);
    p('Sicherheit: Schlüsseldatei übers WLAN gesperrt', (await holen(`http://${LAN}:${WEB_PORT}/${vl}`, { quelle: LAN })).status === 403);
    p('Sicherheit: auch mit anderer Schreibweise gesperrt (Windows)', (await holen(`http://${LAN}:${WEB_PORT}/PC-Manager/Kassen-Verbindungen.JSON`, { quelle: LAN })).status === 403);
    p('Sicherheit: fremder Host-Kopf (DNS-Rebinding) gesperrt', (await holen(`http://127.0.0.1:${WEB_PORT}/${vl}`, { kopf: { Host: 'boese.example' } })).status === 403);
    p('Sicherheit: Status der Tablet-Kassen übers WLAN gesperrt', (await holen(`http://${LAN}:${WEB_PORT}/kc-kassen-start/status`, { quelle: LAN })).status === 403);
    p('Sicherheit: Aktion ohne eigenen Kopf abgelehnt', (await holen(`http://127.0.0.1:${WEB_PORT}/kc-kassen-start/neuer-schluessel`, { methode: 'POST', koerper: '{"id":"KASSE-01"}' })).status === 403);
    p('Sicherheit: Aktion von fremder Webseite abgelehnt', (await holen(`http://127.0.0.1:${WEB_PORT}/kc-kassen-start/neuer-schluessel`, { methode: 'POST', kopf: { 'X-KC-Aktion': '1', Origin: 'http://boese.example' }, koerper: '{"id":"KASSE-01"}' })).status === 403);
    p('Sicherheit: Kassen-Dienst ohne Schlüssel übers WLAN abgewiesen', (await holen(`http://${LAN}:47500/kc-sync-status`, { quelle: LAN })).status === 403);

    // ---- PC-Manager: QR-Zettel drucken ----
    const pc = await (await browser.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
    const pcFehler = []; pc.on('pageerror', (e) => pcFehler.push(e.message));
    pc.on('dialog', (d) => d.accept());
    await pc.goto(`http://127.0.0.1:${WEB_PORT}/pc-manager/kassen-zettel.html`);
    await pc.waitForSelector('[data-drucke="KASSE-01"]', { timeout: 15000 });
    p('PC-Manager: Zettel-Seite zeigt alle drei Kassen', (await pc.locator('article.kasse').count()) === 3);
    await pc.click('#alleDrucken');
    let nachDruck = null;
    for (let i = 0; i < 20; i++) { nachDruck = await status(); if (nachDruck.kassen.every((k) => k.zettel === 'gueltig')) break; await warte(300); }
    p('PC-Manager: nach dem Drucken gelten alle drei Zettel', nachDruck.kassen.every((k) => k.zettel === 'gueltig'));
    await pc.waitForFunction(() => document.querySelectorAll('.marke.gruen').length >= 6, null, { timeout: 5000 }).catch(() => {});
    if (AUSGABE) { fs.mkdirSync(AUSGABE, { recursive: true }); await pc.screenshot({ path: path.join(AUSGABE, 'zettel-seite.png'), fullPage: true }); }

    // Der gedruckte Zettel: so rendern, wie der Drucker ihn bekommt, und den QR-Code zurücklesen.
    await pc.emulateMedia({ media: 'print' });
    // Nach dem Bestätigen zeichnet die Seite neu; für die Aufnahme alle Bögen wieder als „zu drucken“ markieren.
    await pc.evaluate(() => document.querySelectorAll('.bogen').forEach((b) => b.classList.add('drucken')));
    const zettelUrl = {};
    for (const k of nachDruck.kassen) {
      const bild = await pc.locator(`.bogen[data-bogen="${k.id}"] svg.qr`).screenshot();
      if (AUSGABE) await pc.locator(`.bogen[data-bogen="${k.id}"]`).screenshot({ path: path.join(AUSGABE, `zettel-${k.id}.png`) });
      if (jsQR) {
        const png = PNG.sync.read(bild);
        const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
        zettelUrl[k.id] = code && code.data;
        p(`Zettel ${k.id}: QR-Code vom Ausdruck gelesen = richtige Kassenadresse`, code && code.data === k.qrAdresse, code ? code.data.replace(/kcToken=[^&]+/, 'kcToken=***') : 'nicht lesbar');
      } else {
        zettelUrl[k.id] = k.qrAdresse;
        console.log('  (QR-Rücklesen übersprungen: "jsqr"/"pngjs" nicht installiert)');
      }
    }
    if (AUSGABE) await pc.pdf({ path: path.join(AUSGABE, 'qr-zettel.pdf'), format: 'A4' });
    await pc.emulateMedia({ media: 'screen' });
    p('Zettel: Adresse zeigt auf die WLAN-Adresse des PCs, nicht auf 127.0.0.1', String(zettelUrl['KASSE-01']).startsWith(`http://${LAN}:${WEB_PORT}/pos/index.html?`));

    // ---- Tablets scannen den Zettel ----
    const tabletKontext = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
    const tablet1 = await tabletKontext.newPage();
    const tabletFehler = []; tablet1.on('pageerror', (e) => tabletFehler.push(e.message));
    // Zwei Tablets = zwei Geräte = zwei getrennte Browser-Speicher.
    const tablet2Kontext = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
    const tab2 = await tablet2Kontext.newPage();
    await oeffneKasse(tablet1, zettelUrl['KASSE-01']);
    await oeffneKasse(tab2, zettelUrl['KASSE-02']);
    const k1 = await tablet1.evaluate(() => window.KCSyncConnection.config);
    p('Tablet 1: hat sich KASSE-01 mit Port und Schlüssel gemerkt', k1.registerId === 'KASSE-01' && k1.port === 47500 && !!k1.token);
    const g1 = await warteGruen(tablet1);
    p('Tablet 1: LED grün („Online und synchronisiert“)', g1 && g1.json && g1.json.connection.color === 'gruen', g1 && JSON.stringify(g1.json && g1.json.connection));
    const b1 = await tabletBucht(tablet1, 'ks01_verkauf_A');
    p('Tablet 1: Buchung wird vom Kassen-Dienst angenommen', b1.status === 200 && b1.json && b1.json.recorded === true, JSON.stringify(b1.json));
    p('A: Buchung von Tablet 1 kommt im Manager an', (await warteAufBuchung('ks01_verkauf_A')) > 0);
    const tokensA = Object.fromEntries(sA.kassen.map((k) => [k.id, k.token]));
    await stoppe(lauf);
    p('A: nach Strg+C sind alle Ports frei (keine verwaisten Kassen-Dienste)',
      (await portFrei(47500)) && (await portFrei(47501)) && (await portFrei(47502)) && (await portFrei(WEB_PORT)) && (await portFrei(MGR_PORT)));

    // ================= B: Neustart am nächsten Morgen =================
    console.log('\n-- B: Neustart (nächster Markttag) --');
    lauf = await starte('B');
    p('B: Start meldet ALLES BEREIT', /ALLES BEREIT/.test(lauf.log()));
    p('B: nichts wird neu gekoppelt', ['01', '02', '03'].every((n) => new RegExp(`KASSE-${n}: bereits gekoppelt`).test(lauf.log())));
    const sB = await status();
    p('B: gleiche Ports wie gestern', sB.kassen.map((k) => k.port).join(',') === '47500,47501,47502');
    p('B: gleiche Schlüssel wie gestern', sB.kassen.every((k) => k.token === tokensA[k.id]));
    p('B: gedruckte Zettel sind weiter gültig', sB.kassen.every((k) => k.zettel === 'gueltig'));
    // Das Tablet tippt auf das Symbol des Home-Bildschirms = dieselbe Adresse wie gestern.
    await oeffneKasse(tablet1, zettelUrl['KASSE-01']);
    const g1b = await warteGruen(tablet1);
    p('B: Tablet 1 verbindet OHNE neues Scannen, LED grün', g1b && g1b.json && g1b.json.connection.color === 'gruen');
    await oeffneKasse(tablet1, `http://${LAN}:${WEB_PORT}/pos/index.html`);
    const ohneAnhang = await tabletFragt(tablet1, '/kc-sync-status');
    p('B: auch über die einfache Adresse ohne Anhang (Tablet hat sich alles gemerkt)', ohneAnhang.status === 200, String(ohneAnhang.status));
    await tabletBucht(tablet1, 'ks01_verkauf_B');
    p('B: Buchung kommt im Manager an', (await warteAufBuchung('ks01_verkauf_B')) > 0);
    // Ein Tablet fällt aus: das Ersatz-Tablet scannt einmal den Zettel von KASSE-03 und kassiert sofort.
    const ersatz = await (await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true })).newPage();
    await oeffneKasse(ersatz, zettelUrl['KASSE-03']);
    p('B: Ersatz-Tablet meldet sich als KASSE-03', (await ersatz.evaluate(() => window.KCSyncConnection.config.registerId)) === 'KASSE-03');
    const gE = await warteGruen(ersatz);
    p('B: Ersatz-Tablet LED grün', gE && gE.json && gE.json.connection.color === 'gruen');
    await tabletBucht(ersatz, 'ks01_ersatz_B');
    p('B: Buchung vom Ersatz-Tablet (KASSE-03) kommt im Manager an', (await warteAufBuchung('ks01_ersatz_B')) > 0);
    await stoppe(lauf);

    // ================= C: Kopplung läuft bald ab =================
    console.log('\n-- C: Kopplung läuft in 2 Tagen ab --');
    managerDb((db) => db.prepare("UPDATE credentials SET expires_at = ? WHERE revoked = 0").run(new Date(Date.now() + 2 * 86400000).toISOString()));
    lauf = await starte('C');
    p('C: Kopplung wird beim Start still erneuert', /KASSE-01: neu gekoppelt \(Kopplung lief bald ab/.test(lauf.log()));
    const sC = await status();
    p('C: Schlüssel der Tablets bleiben trotzdem gleich (kein Neuscannen)', sC.kassen.every((k) => k.token === tokensA[k.id]));
    p('C: alte Kopplungen sind im Manager zurückgezogen (keine Doppel-Einträge)',
      managerDb((db) => db.prepare('SELECT COUNT(*) AS n FROM credentials WHERE revoked = 0').get().n) === 3);
    await oeffneKasse(tablet1, zettelUrl['KASSE-01']);
    await tabletBucht(tablet1, 'ks01_verkauf_C');
    p('C: Buchung kommt mit der erneuerten Kopplung im Manager an', (await warteAufBuchung('ks01_verkauf_C')) > 0);
    await stoppe(lauf);

    // ================= D: neue Programmversion / Manager neu installiert =================
    console.log('\n-- D: Manager-Datenbank neu (neue ZIP entpackt) --');
    for (const f of fs.readdirSync(ARBEIT)) if (f.startsWith('manager.sqlite')) fs.rmSync(path.join(ARBEIT, f), { force: true });
    lauf = await starte('D');
    p('D: Kassen koppeln sich mit dem neuen Manager', /KASSE-01: neu gekoppelt \(anderer Manager/.test(lauf.log()));
    const sD = await status();
    p('D: Schlüssel und Zettel bleiben gültig', sD.kassen.every((k) => k.token === tokensA[k.id] && k.zettel === 'gueltig'));
    await oeffneKasse(tablet1, zettelUrl['KASSE-01']);
    await tabletBucht(tablet1, 'ks01_verkauf_D');
    p('D: Buchung kommt beim NEUEN Manager an', (await warteAufBuchung('ks01_verkauf_D')) > 0);

    // Wächter: Kassen-Dienst stürzt ab
    const altePid = sD.kassen[0].pid;
    process.kill(altePid, 'SIGKILL');
    let nachAbsturz = null;
    for (let i = 0; i < 40; i++) { await warte(500); nachAbsturz = await status(); const k = nachAbsturz.kassen[0]; if (k.dienst === 'laeuft' && k.pid && k.pid !== altePid) break; }
    p('D: abgestürzter Kassen-Dienst wird vom Wächter neu gestartet',
      nachAbsturz.kassen[0].dienst === 'laeuft' && nachAbsturz.kassen[0].pid !== altePid && nachAbsturz.kassen[0].neustarts === 1);

    // Zettel verloren: Schlüssel erneuern
    const t2alt = tokensA['KASSE-02'];
    const neu = await aktion('neuer-schluessel', { id: 'KASSE-02' });
    p('D: „Schlüssel erneuern“ für KASSE-02 klappt', neu.status === 200);
    const k2neu = neu.json.kassen.find((k) => k.id === 'KASSE-02');
    p('D: KASSE-02 hat einen neuen Schlüssel, Zettel gilt als nicht gedruckt', k2neu.token !== t2alt && k2neu.zettel === 'nicht_gedruckt');
    p('D: KASSE-01 ist davon nicht betroffen', neu.json.kassen.find((k) => k.id === 'KASSE-01').token === tokensA['KASSE-01']);
    p('D: alter Zettel von KASSE-02 wird abgewiesen', (await holen(`http://${LAN}:47501/kc-sync-status?token=${encodeURIComponent(t2alt)}`, { quelle: LAN })).status === 403);
    p('D: neuer Schlüssel von KASSE-02 funktioniert', (await holen(`http://${LAN}:47501/kc-sync-status?token=${encodeURIComponent(k2neu.token)}`, { quelle: LAN })).status === 200);
    // Das Tablet von KASSE-02 mit dem alten Zettel: klare Ansage statt rätselhafter roter LED
    await tab2.goto(zettelUrl['KASSE-02']);
    let ansage = '';
    for (let i = 0; i < 40; i++) {
      ansage = await tab2.evaluate(() => { const g = document.getElementById('fullscreenGate'); if (g && !g.hidden) g.hidden = true; return document.body.innerText || ''; });
      if (/Zugang ungültig/.test(ansage)) break;
      await warte(500);
    }
    p('D: Tablet mit altem Zettel sagt „Zugang ungültig – QR-Zettel neu scannen“', /Zugang ungültig – QR-Zettel dieser Kasse neu scannen/.test(ansage));
    await stoppe(lauf);
    p('D: nach Strg+C sind alle Ports frei', (await portFrei(47500)) && (await portFrei(47501)) && (await portFrei(47502)) && (await portFrei(WEB_PORT)));

    // ================= E: Webserver-Port belegt =================
    console.log('\n-- E: Port 8891 belegt (z. B. altes Fenster noch offen) --');
    belegt = http.createServer((q, r) => r.end('alt')); await new Promise((r) => belegt.listen(WEB_PORT, '0.0.0.0', r));
    lauf = await starte('E');
    p('E: Start meldet BEREIT MIT WARNUNGEN statt ALLES BEREIT', /BEREIT MIT WARNUNGEN/.test(lauf.log()) && !/ALLES BEREIT/.test(lauf.log()));
    p('E: Warnung nennt den belegten Port und dass die Zettel so nicht gehen', new RegExp(`Port ${WEB_PORT} ist belegt.*funktionieren so NICHT`).test(lauf.log()));
    await stoppe(lauf);
    await new Promise((r) => belegt.close(r)); belegt = null;

    // ================= F: PC hat eine andere Adresse als die Zettel =================
    console.log('\n-- F: PC-Adresse weicht von den Zetteln ab --');
    const zustandDatei = path.join(DATEN, 'kassen-start.json');
    const z = JSON.parse(fs.readFileSync(zustandDatei, 'utf8'));
    z.kassen['KASSE-01'].zettel.adresse = '10.123.45.67';
    fs.writeFileSync(zustandDatei, JSON.stringify(z));
    lauf = await starte('F');
    p('F: Start warnt unübersehbar: PC-ADRESSE HAT SICH GEÄNDERT', /PC-ADRESSE HAT SICH GEÄNDERT.*10\.123\.45\.67/.test(lauf.log()) && /BEREIT MIT WARNUNGEN/.test(lauf.log()));
    const sF = await status();
    p('F: Zettel KASSE-01 gilt als veraltet', sF.kassen.find((k) => k.id === 'KASSE-01').zettel === 'veraltet');
    await pc.goto(`http://127.0.0.1:${WEB_PORT}/pc-manager/kassen-zettel.html`);
    await pc.waitForSelector('.warnung', { timeout: 10000 });
    p('F: Zettel-Seite im PC-Manager zeigt die Warnung', /PC-ADRESSE HAT SICH GEÄNDERT/.test(await pc.locator('#meldungen').innerText()));
    await stoppe(lauf);
    lauf = null;

    p('keine Skriptfehler auf Zettel-Seite und Tablet', pcFehler.length === 0 && tabletFehler.length === 0, [...pcFehler, ...tabletFehler].slice(0, 2).join(' | ') || 'keine');
    p('am Ende: alle Ports frei', (await portFrei(47500)) && (await portFrei(47501)) && (await portFrei(47502)) && (await portFrei(WEB_PORT)) && (await portFrei(MGR_PORT)) && (await portFrei(47392)));
  } catch (e) {
    rot++;
    console.log('FEHLER  Abbruch: ' + (e && e.stack || e));
    if (lauf) console.log(lauf.log().replace(/kcToken=[^&\s]+/g, 'kcToken=***').slice(-3000));
  } finally {
    await stoppe(lauf);
    if (belegt) belegt.close();
    if (browser) await browser.close();
    if (verbindungsdateiVorher) fs.writeFileSync(VERBINDUNGSDATEI, verbindungsdateiVorher); else fs.rmSync(VERBINDUNGSDATEI, { force: true });
    fs.rmSync(ARBEIT, { recursive: true, force: true });
  }
  console.log(`\nKassen-Start dauerhaft (KS-01): ${ok}/${ok + rot} bestanden`);
  process.exit(rot ? 1 : 0);
})();
