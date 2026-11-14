/* KS-01 – arbeiten PC-Manager und die drei Tablet-Kassen über den NEUEN Startweg weiter zusammen?
 *
 * Der Kassen-Start (kassen-start.js) betreibt die Kassen-Dienste jetzt selbst. Alle bereits
 * fertigen Datenwege laufen über diese Dienste - deshalb hier einmal komplett mit dem echten
 * Startweg (run-manager-service.js), echtem PC-Manager im Browser und drei Tablets über die
 * Netzwerkadresse:
 *   1. Stammdaten: im PC-Manager Preis ändern, „an alle Kassen senden“ -> alle drei Kassen haben ihn
 *   2. Dienstplan: Manager -> alle drei Kassen
 *   3. Geld-Übergabe (Money Butler / PC-Manager) -> genau die gemeinte Kasse
 *   4. Ausverkauft an Kasse 1 -> sichtbar an Kasse 3
 *   5. Verkauf an Kasse 3 -> zuverlässig im Manager (Sync) und im Live-Monitor
 *   6. Verbindungsübersicht des Managers kennt alle drei Kassen
 *   7. „Gerät verloren“ im Admin-Center sperrt das Tablet sofort aus; neue Kopplung + neuer Zettel
 * Test-Dienstplan mit Pseudonymen - keine Personendaten.
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
const { chromium } = require('playwright');
const { DatabaseSync } = require('node:sqlite');

let ok = 0, rot = 0;
const p = (n, b, z = '') => { b ? ok++ : rot++; console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z !== '' ? '   [' + z + ']' : ''}`); };
const MGR_PORT = 8572, WEB_PORT = 8892, LIVE = 47392;
const lan = Object.values(os.networkInterfaces()).flat().find((e) => e && e.family === 'IPv4' && !e.internal && !e.address.startsWith('169.254.'));
if (!lan) { console.log('Keine Netzwerkadresse - dieser Test braucht eine.'); process.exit(1); }
const ARBEIT = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-datenwege-'));
const MGR_DB = path.join(ARBEIT, 'manager.sqlite');
const VERBINDUNGSDATEI = path.join(WURZEL, 'pc-manager', 'kassen-verbindungen.json');
const vorher = fs.existsSync(VERBINDUNGSDATEI) ? fs.readFileSync(VERBINDUNGSDATEI) : null;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const portFrei = (port) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.listen(port, '0.0.0.0', () => s.close(() => r(true))); });

function holen(url, { methode = 'GET', kopf = {}, koerper } = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: methode, headers: { 'Content-Type': 'application/json', ...kopf }, timeout: 8000 }, (res) => {
      let d = ''; res.on('data', (c) => { d += c; });
      res.on('end', () => { let j = null; try { j = JSON.parse(d); } catch (e) { /* */ } resolve({ status: res.statusCode, json: j }); });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ status: 0, fehler: e.message }));
    req.end(koerper === undefined ? undefined : JSON.stringify(koerper));
  });
}
async function tablet(seite, pfad, optionen) {
  return seite.evaluate(async ([pf, opt]) => {
    try { const a = await fetch(window.KCSyncConnection.buildUrl(pf), opt || {}); let j = null; try { j = await a.json(); } catch (e) { /* */ } return { status: a.status, json: j }; }
    catch (e) { return { status: 0, fehler: String(e.message || e) }; }
  }, [pfad, optionen || null]);
}
async function bisAlle(seiten, pfad, bedingung, sekunden = 60) {
  const ergebnis = new Array(seiten.length).fill(null);
  for (let i = 0; i < sekunden; i++) {
    for (let n = 0; n < seiten.length; n++) {
      if (ergebnis[n] && bedingung(ergebnis[n])) continue;
      ergebnis[n] = await tablet(seiten[n], pfad);
    }
    if (ergebnis.every((e) => e && bedingung(e))) return ergebnis;
    await warte(1000);
  }
  return ergebnis;
}

(async () => {
  let kind = null, browser = null, log = '';
  try {
    for (const port of [MGR_PORT, WEB_PORT, LIVE, 47500, 47501, 47502]) {
      if (!(await portFrei(port))) { console.log(`Port ${port} ist belegt - Test kann nicht laufen.`); process.exit(1); }
    }
    kind = spawn(process.execPath, [path.join(BACKEND, 'run-manager-service.js'), '--db', MGR_DB, '--port', String(MGR_PORT), '--webserver-port', String(WEB_PORT)], {
      cwd: BACKEND, env: { ...process.env, KC_KASSEN_DATEN: path.join(ARBEIT, 'tablet-kassen') }, stdio: ['ignore', 'pipe', 'pipe'] });
    kind.stdout.on('data', (d) => { log += d; }); kind.stderr.on('data', (d) => { log += d; });
    for (let i = 0; i < 280 && !/\[Marktag-Start\]/.test(log); i++) await warte(250);
    p('Start: ALLES BEREIT mit drei Kassen', /ALLES BEREIT/.test(log) && /KASSE-03/.test(log));
    const status = (await holen(`http://127.0.0.1:${WEB_PORT}/kc-kassen-start/status`)).json;

    browser = await chromium.launch();
    const tablets = [];
    for (const k of status.kassen) {
      const seite = await (await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true })).newPage();
      await seite.goto(k.qrAdresse, { waitUntil: 'domcontentloaded' });
      await seite.waitForFunction(() => !!window.KCSyncConnection, null, { timeout: 30000 });
      tablets.push(seite);
    }
    p('drei Tablets haben ihre Kasse geöffnet', tablets.length === 3);

    // 1. Stammdaten aus dem echten PC-Manager
    const pc = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
    const pcFehler = []; pc.on('pageerror', (e) => pcFehler.push(e.message));
    pc.on('dialog', (d) => d.accept());
    await pc.goto(`http://127.0.0.1:${WEB_PORT}/pc-manager/index.html`);
    await pc.waitForFunction(() => typeof loadArticle === 'function' && Array.isArray(window.articles || articles), null, { timeout: 30000 });
    await pc.evaluate(() => { const i = articles.findIndex((a) => a.id === 'grot'); loadArticle(i); el('aPrice').value = '3.70'; document.querySelector('#articleToolbar button[data-cmd="save"]').click(); });
    await pc.evaluate(() => { managerUnlocked = true; document.getElementById('masterDataPushBtn').click(); });
    const stamm = await bisAlle(tablets, '/kc-sync-master-data', (e) => e.status === 200 && e.json && e.json.vorhanden && (e.json.articles || []).some((a) => a.id === 'grot' && Number(a.price) === 3.7));
    stamm.forEach((e, i) => p(`Stammdaten: KASSE-0${i + 1} hat den im PC-Manager geänderten Preis (3,70)`, e && e.json && e.json.vorhanden && (e.json.articles || []).some((a) => a.id === 'grot' && Number(a.price) === 3.7), e && e.json ? `${(e.json.articles || []).length} Artikel` : JSON.stringify(e)));
    await tablets[0].reload({ waitUntil: 'domcontentloaded' });
    let preis = null;
    for (let i = 0; i < 30 && preis !== 3.7; i++) { await warte(500); preis = await tablets[0].evaluate(() => (typeof PRODUCTS !== 'undefined' && (PRODUCTS.find((x) => x.id === 'grot') || {}).price) || null).catch(() => null); }
    p('Stammdaten: Kasse am Tablet zeigt den neuen Preis in der Oberfläche', preis === 3.7, String(preis));

    // 2. Dienstplan (Pseudonyme)
    const plan = { eventId: 'test-weihnachtsmarkt', sourceUpdatedAt: new Date().toISOString(), schichten: [{ id: 's1', pseudonym: 'P-001', start: '2026-11-27T16:00:00+01:00', ende: '2026-11-27T20:00:00+01:00', bereich: 'Ausschank' }] };
    const dp = await holen(`http://127.0.0.1:${LIVE}/dienstplan/push`, { methode: 'POST', koerper: plan });
    p('Dienstplan: Manager nimmt den Plan an', dp.status === 200, String(dp.status));
    const dps = await bisAlle(tablets, '/kc-sync-dienstplan', (e) => e.status === 200 && e.json && (e.json.schichten || []).length === 1 && e.json.eventId === 'test-weihnachtsmarkt');
    dps.forEach((e, i) => p(`Dienstplan: KASSE-0${i + 1} hat den Plan`, e && e.json && (e.json.schichten || []).length === 1, e && e.json ? `Revision ${e.json.revision}` : ''));

    // 3. Geld-Übergabe nur an KASSE-02
    const geld = await holen(`http://127.0.0.1:${LIVE}/api/v1/cash-transfer/queue`, { methode: 'POST', koerper: { transferId: 'KS01-GELD-1', registerLabel: 'KASSE-02', payload: { transferId: 'KS01-GELD-1', registerId: 'KASSE-02', amount: 150 } } });
    p('Geld-Übergabe: Manager legt sie für KASSE-02 ab', geld.status === 200, String(geld.status));
    let k2geld = null;
    for (let i = 0; i < 40; i++) { k2geld = await tablet(tablets[1], '/kc-sync-cash-transfer'); if (k2geld.json && JSON.stringify(k2geld.json).includes('KS01-GELD-1')) break; await warte(1000); }
    p('Geld-Übergabe: KASSE-02 sieht sie', !!k2geld.json && JSON.stringify(k2geld.json).includes('KS01-GELD-1'));
    const k1geld = await tablet(tablets[0], '/kc-sync-cash-transfer');
    p('Geld-Übergabe: KASSE-01 sieht sie NICHT', !JSON.stringify(k1geld.json || {}).includes('KS01-GELD-1'));

    // 4. Ausverkauft an KASSE-01 -> KASSE-03
    const aus = await tablet(tablets[0], '/kc-sync-sold-out-melden', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ articleId: 'grot', soldOut: true, registerId: 'KASSE-01' }) });
    p('Ausverkauft: KASSE-01 meldet „Glühwein rot ausverkauft“', aus.status === 200);
    const aus3 = await bisAlle([tablets[2]], '/kc-sync-sold-out-status', (e) => e.json && (e.json.ausverkauft || []).includes('grot'), 60);
    p('Ausverkauft: KASSE-03 zeigt es ebenfalls', aus3[0] && aus3[0].json && (aus3[0].json.ausverkauft || []).includes('grot'));

    // 5. Verkauf an KASSE-03
    const kennung = 'KS01-VERKAUF-' + Date.now();
    await tablet(tablets[2], '/kc-sync-live-event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'sale', payload: { registerId: 'KASSE-03', bon: 1, due: 3.7, transactionId: kennung } }) });
    const buchung = await tablet(tablets[2], '/kc-sync-record-event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'sale', payload: { transactionId: kennung, registerId: 'KASSE-03', bon: 1, type: 'sale', due: 3.7, items: [{ id: 'grot', qty: 1, price: 3.7 }], time: new Date().toISOString() } }) });
    p('Verkauf: KASSE-03 bucht', buchung.json && buchung.json.recorded === true);
    let angekommen = 0;
    for (let i = 0; i < 60 && !angekommen; i++) {
      const db = new DatabaseSync(MGR_DB);
      try { angekommen = db.prepare("SELECT COUNT(*) AS n FROM received_events WHERE type='sale' AND payload LIKE ?").get(`%${kennung}%`).n; } finally { db.close(); }
      if (!angekommen) await warte(1000);
    }
    p('Verkauf: kommt zuverlässig (Sync) im Manager an', angekommen > 0);
    const liveLog = await holen(`http://127.0.0.1:${LIVE}/live-event-log?limit=50`);
    p('Verkauf: erscheint im Live-Monitor des PC-Managers', JSON.stringify(liveLog.json || {}).includes('KASSE-03'));

    // 6. Verbindungsübersicht
    const vb = await holen(`http://127.0.0.1:${LIVE}/kassen-verbindungen`);
    const namen = ((vb.json && vb.json.kassen) || []).map((k) => k.kasse).sort().join(',');
    p('Manager kennt alle drei Kassen als gekoppelt', namen === 'KASSE-01,KASSE-02,KASSE-03', namen);

    // 7. Gerät verloren (Admin-Center) -> Tablet sofort ausgesperrt
    const altToken = status.kassen[1].token;
    const wider = await holen(`http://127.0.0.1:${LIVE}/kassen/kopplung-widerrufen`, { methode: 'POST', koerper: { registerId: 'KASSE-02' } });
    p('Gerät verloren: Admin-Center widerruft KASSE-02', wider.status === 200);
    let nachher = null;
    for (let i = 0; i < 30; i++) { await warte(1000); nachher = (await holen(`http://127.0.0.1:${WEB_PORT}/kc-kassen-start/status`)).json; const k = nachher.kassen[1]; if (k.token !== altToken && k.dienst === 'laeuft') break; }
    const k2 = nachher.kassen[1];
    p('Gerät verloren: KASSE-02 bekommt sofort einen neuen Tablet-Schlüssel', k2.token !== altToken && k2.dienst === 'laeuft');
    const altTablet = await tablet(tablets[1], '/kc-sync-status');
    p('Gerät verloren: das verlorene Tablet wird abgewiesen', altTablet.status === 403, String(altTablet.status));
    p('Gerät verloren: Warnung „neuen Zettel drucken“ steht im Status', (nachher.warnungen || []).some((w) => /KASSE-02 wurde als VERLOREN gesperrt/.test(w)));
    p('Gerät verloren: KASSE-01 und KASSE-03 arbeiten unverändert weiter',
      (await tablet(tablets[0], '/kc-sync-status')).status === 200 && (await tablet(tablets[2], '/kc-sync-status')).status === 200);
    const ersatz = await (await browser.newContext()).newPage();
    await ersatz.goto(k2.qrAdresse, { waitUntil: 'domcontentloaded' });
    await ersatz.waitForFunction(() => !!window.KCSyncConnection, null, { timeout: 30000 });
    let gruen = null;
    for (let i = 0; i < 45; i++) { gruen = await tablet(ersatz, '/kc-sync-status'); if (gruen.json && gruen.json.connection && gruen.json.connection.color === 'gruen') break; await warte(1000); }
    p('Gerät verloren: Ersatz-Tablet mit dem NEUEN Zettel ist wieder grün verbunden', gruen.json && gruen.json.connection && gruen.json.connection.color === 'gruen', JSON.stringify(gruen.json && gruen.json.connection));

    p('keine Skriptfehler im PC-Manager', pcFehler.length === 0, pcFehler.slice(0, 2).join(' | ') || 'keine');
  } catch (e) {
    rot++; console.log('FEHLER  Abbruch: ' + (e && e.stack || e)); console.log(log.replace(/kcToken=[^&\s]+/g, 'kcToken=***').slice(-2500));
  } finally {
    if (kind && kind.exitCode === null) { const weg = new Promise((r) => kind.once('exit', r)); kind.kill('SIGINT'); await Promise.race([weg, warte(15000)]); if (kind.exitCode === null) kind.kill('SIGKILL'); }
    if (browser) await browser.close();
    if (vorher) fs.writeFileSync(VERBINDUNGSDATEI, vorher); else fs.rmSync(VERBINDUNGSDATEI, { force: true });
    fs.rmSync(ARBEIT, { recursive: true, force: true });
  }
  console.log(`\nDatenwege über den Kassen-Start (KS-01): ${ok}/${ok + rot} bestanden`);
  process.exit(rot ? 1 : 0);
})();
