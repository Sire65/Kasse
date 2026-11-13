/* KS-04 – die ganze Strecke: Tablet -> Mini-PC (Stand) -> Supabase -> PC-Manager ZU HAUSE, und zurück.
 *
 * Echt: Stand-Start (run-manager-service.js mit Kassen + Stand-Brücke), Zuhause-Start (--zuhause, nur Webseite),
 * PC-Manager am Stand und zu Hause im Browser, Tablet im Browser, Supabase-Funktionen echt in PostgreSQL
 * (Nachbau der REST-Schnittstelle, tests/supabase-nachbau). Geprüft:
 *   1. Am Mini-PC „Diesen PC als Stand anmelden“ -> Stand-Brücke verbunden
 *   2. Verkauf am Tablet -> zu Hause im Live-Monitor (WebSocket über Supabase) und im Verlauf
 *   3. Zu Hause: Kassen-Übersicht und Ausverkauft-Liste aus dem Spiegel
 *   4. Zu Hause „Ausverkauft setzen“ -> am Stand ausgeführt, Tablet sieht es
 *   5. Zu Hause Preis ändern + „Stammdaten an alle Kassen senden“ -> Tablet hat den neuen Preis
 *   6. Kein Internet am Stand: Kassieren geht weiter, Meldung „wird nachgereicht“, danach kommt alles an;
 *      Auftrag von zu Hause währenddessen: „unterwegs“, wird nachgeholt
 *   7. Zu Hause ohne Anmeldung: klare Meldung statt Daten
 */
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http'), net = require('net');
const { spawn } = require('child_process');
const WURZEL = path.join(__dirname, '..');
const BACKEND = path.join(WURZEL, 'markt-kasse-suite', 'backend-source');
if (!process.env.KC_TEST_PG) { console.log('  ueberspringen: KC_TEST_PG nicht gesetzt (Test-PostgreSQL mit Grundlage + Migration)'); process.exit(0); }
let starteNachbau, chromium;
try { ({ starteNachbau } = require('./supabase-nachbau/postgrest-nachbau.cjs')); ({ chromium } = require('playwright')); }
catch (e) { console.log('  ueberspringen: npm-Paket "pg" oder Playwright fehlt'); process.exit(0); }
for (const m of ['ws', 'selfsigned', 'bonjour-service']) {
  try { require.resolve(m, { paths: [BACKEND] }); } catch (e) { console.log(`  ueberspringen: ${m} fehlt`); process.exit(0); }
}
let ok = 0, rot = 0;
const p = (n, b, z = '') => { b ? ok++ : rot++; console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z !== '' ? '   [' + String(z).slice(0, 180) + ']' : ''}`); };
const MGR = 8575, WEB_STAND = 8895, WEB_HAUS = 8896;
const ARBEIT = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-standhaus-'));
const VERBINDUNGSDATEI = path.join(WURZEL, 'pc-manager', 'kassen-verbindungen.json');
const vorher = fs.existsSync(VERBINDUNGSDATEI) ? fs.readFileSync(VERBINDUNGSDATEI) : null;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const portFrei = (port) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.listen(port, '0.0.0.0', () => s.close(() => r(true))); });
const lan = Object.values(os.networkInterfaces()).flat().find((e) => e && e.family === 'IPv4' && !e.internal);
const quelle = fs.readFileSync(path.join(WURZEL, 'pc-manager', 'kc-manager-supabase-status.js'), 'utf8');
const SB_URL = quelle.match(/SUPABASE_URL = '([^']+)'/)[1], SB_KEY = quelle.match(/SUPABASE_ANON_KEY = '([^']+)'/)[1];
const ADMIN = '44444444-4444-4444-8444-444444444444';
const holen = (url, opt = {}) => new Promise((r) => { const u = new URL(url); const q = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: opt.method || 'GET', headers: opt.headers || {} }, (res) => { let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => { try { r(JSON.parse(d)); } catch (e) { r(null); } }); }); q.on('error', () => r(null)); q.end(opt.body); });

async function starte(argumente, bis) {
  const kind = spawn(process.execPath, [path.join(BACKEND, 'run-manager-service.js'), ...argumente], {
    cwd: BACKEND, env: { ...process.env, KC_KASSEN_DATEN: path.join(ARBEIT, 'tablet-kassen') }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; kind.stdout.on('data', (d) => { log += d; }); kind.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 320 && !bis.test(log) && kind.exitCode === null; i++) await warte(250);
  return { kind, log: () => log };
}
async function stoppe(l) { if (!l || l.kind.exitCode !== null) return; const w = new Promise((r) => l.kind.once('exit', r)); l.kind.kill('SIGINT'); await Promise.race([w, warte(15000)]); if (l.kind.exitCode === null) l.kind.kill('SIGKILL'); }

// Browser-Kontext, dessen Supabase-Aufrufe zum Nachbau gehen; optional angemeldet als Admin.
async function pcManagerKontext(browser, sb, { angemeldet = true, standEinrichtenUmlenken = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  if (angemeldet) await ctx.addInitScript((t) => { localStorage.setItem('kc_manager_supabase_session_v1', JSON.stringify({ access_token: t, refresh_token: null })); }, `test-admin:${ADMIN}`);
  await ctx.route(`${SB_URL}/**`, async (route) => {
    const u = new URL(route.request().url());
    try {
      const a = await fetch(sb.url + u.pathname + u.search, { method: route.request().method(), headers: route.request().headers(), body: route.request().postData() || undefined });
      await route.fulfill({ status: a.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: await a.text() });
    } catch (e) { await route.abort(); }
  });
  if (standEinrichtenUmlenken) {
    // Im Test spricht die Stand-Brücke mit dem Nachbau statt mit dem echten Supabase-Projekt.
    await ctx.route('**/kc-kassen-start/stand-einrichten', async (route) => {
      const d = JSON.parse(route.request().postData()); d.url = sb.url;
      await route.continue({ postData: JSON.stringify(d) });
    });
  }
  return ctx;
}
async function tablet(seite, pfad, opt) {
  return seite.evaluate(async ([pf, o]) => { try { const a = await fetch(window.KCSyncConnection.buildUrl(pf), o || {}); return { status: a.status, json: await a.json().catch(() => null) }; } catch (e) { return { status: 0 }; } }, [pfad, opt || null]);
}
const verkauf = (seite, kennung, kasse) => tablet(seite, '/kc-sync-live-event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'sale', payload: { registerId: kasse, bon: 1, due: 3.5, transactionId: kennung } }) });

(async () => {
  let stand = null, haus = null, browser = null, sb = null;
  try {
    for (const port of [MGR, WEB_STAND, WEB_HAUS, 47392, 47500, 47501, 47502]) if (!(await portFrei(port))) { console.log(`Port ${port} belegt`); process.exit(1); }
    sb = await starteNachbau({ publishableKey: SB_KEY });
    await sb.sql('delete from public.kc_stand; delete from public.kc_manager_memberships');
    await sb.sql("insert into public.kc_manager_memberships values ($1, 'KC_WERNE', 'admin', true)", [ADMIN]);
    browser = await chromium.launch();

    // ---- Stand starten ----
    stand = await starte(['--db', path.join(ARBEIT, 'stand.sqlite'), '--port', String(MGR), '--webserver-port', String(WEB_STAND)], /\[Marktag-Start\]/);
    p('Stand: Start ALLES BEREIT, Hinweis „Verbindung nach Hause: nicht eingerichtet“', /ALLES BEREIT/.test(stand.log()) && /Verbindung nach Hause \(Supabase\): nicht eingerichtet/.test(stand.log()));
    const ks = await holen(`http://127.0.0.1:${WEB_STAND}/kc-kassen-start/status`);

    // ---- 1. Stand anmelden (am Mini-PC) ----
    const standCtx = await pcManagerKontext(browser, sb, { standEinrichtenUmlenken: true });
    const standPc = await standCtx.newPage();
    const standFehler = []; standPc.on('pageerror', (e) => standFehler.push(e.message));
    standPc.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Weihnachtsmarkt Werne' : undefined));
    await standPc.goto(`http://127.0.0.1:${WEB_STAND}/pc-manager/index.html`);
    await standPc.waitForFunction(() => window.KCStandBrueckeManager && window.KCFernmodus, null, { timeout: 30000 });
    p('Stand-PC-Manager erkennt: hier ist der Stand (kein Fernmodus)', (await standPc.evaluate(() => window.KCFernmodus.bestimmeModus())) === 'lokal');
    await standPc.evaluate(() => window.KCStandBrueckeManager.anmelden());
    let st = null;
    for (let i = 0; i < 40; i++) { st = await holen(`http://127.0.0.1:${WEB_STAND}/kc-kassen-start/stand-status`); if (st && st.verbunden === true) break; await warte(500); }
    p('1: Stand angemeldet und mit Supabase verbunden', st && st.eingerichtet && st.verbunden === true && st.standName === 'Weihnachtsmarkt Werne', JSON.stringify(st && { e: st.eingerichtet, v: st.verbunden, m: st.meldung && st.meldung.titel }));
    p('1: Schwarzes Fenster meldet „Verbindung nach Hause: OK“', /\[Stand-Brücke\] Verbindung nach Hause: OK/.test(stand.log()));
    const zugang = JSON.parse(fs.readFileSync(path.join(ARBEIT, 'tablet-kassen', 'stand-zugang.json'), 'utf8'));
    p('1: Stand-Geheimnis liegt im Datenordner, in Supabase nur als Hash', /^[0-9a-f]{64}$/.test(zugang.geheimnis) && (await sb.sql('select geheimnis_hash from public.kc_stand where id = $1', [zugang.standId]))[0].geheimnis_hash !== zugang.geheimnis);

    // ---- Tablets ----
    const t1 = await (await browser.newContext()).newPage(); await t1.goto(ks.kassen[0].qrAdresse); await t1.waitForFunction(() => !!window.KCSyncConnection);
    const t2 = await (await browser.newContext()).newPage(); await t2.goto(ks.kassen[1].qrAdresse); await t2.waitForFunction(() => !!window.KCSyncConnection);

    // ---- Zuhause starten ----
    haus = await starte(['--zuhause', '--webserver-port', String(WEB_HAUS)], /\[Zuhause-Start\] BEREIT|START ABGEBROCHEN/);
    p('Zuhause: Start ohne Manager-Dienst und ohne Kassen („Zuhause-Start BEREIT“)', /\[Zuhause-Start\] BEREIT/.test(haus.log()) && !/Kassen-Start/.test(haus.log()));
    const hausCtx = await pcManagerKontext(browser, sb);
    const hausPc = await hausCtx.newPage();
    const hausFehler = []; hausPc.on('pageerror', (e) => hausFehler.push(e.message));
    await hausPc.goto(`http://127.0.0.1:${WEB_HAUS}/pc-manager/index.html`);
    await hausPc.waitForFunction(() => window.KCFernmodus, null, { timeout: 30000 });
    p('Zuhause: PC-Manager schaltet in den Fernmodus', (await hausPc.evaluate(() => window.KCFernmodus.bestimmeModus())) === 'fern');
    await hausPc.waitForFunction(() => window.KCFernmodus.gewaehlterStand(), null, { timeout: 20000 }).catch(() => {});
    p('Zuhause: der einzige Stand wird automatisch gewählt', (await hausPc.evaluate(() => (window.KCFernmodus.gewaehlterStand() || {}).name)) === 'Weihnachtsmarkt Werne');
    await hausPc.waitForFunction(() => /zuletzt gemeldet vor/.test((document.getElementById('kcFernmodusBanner') || {}).textContent || ''), null, { timeout: 25000 }).catch(() => {});
    p('Zuhause: Anzeige unten rechts „Stand … zuletzt gemeldet vor … s“', /Fernmodus · Stand „Weihnachtsmarkt Werne“ · zuletzt gemeldet vor \d+ s/.test(await hausPc.locator('#kcFernmodusBanner').innerText().catch(() => '')));

    // ---- 2. Verkauf -> Live-Monitor zu Hause ----
    await hausPc.evaluate(() => { window.__live = []; const ws = new WebSocket('ws://127.0.0.1:47392/live-monitor'); ws.onmessage = (m) => window.__live.push(JSON.parse(m.data)); window.__ws = ws; });
    await warte(5000);
    const k1 = 'KS04-LIVE-' + Date.now();
    p('2: Tablet bucht einen Verkauf', (await verkauf(t1, k1, 'KASSE-01')).status === 202);
    let live = [];
    for (let i = 0; i < 40; i++) { live = await hausPc.evaluate(() => window.__live); if (live.some((e) => e.payload && e.payload.transactionId === k1)) break; await warte(500); }
    const ev = live.find((e) => e.payload && e.payload.transactionId === k1);
    p('2: Verkauf erscheint zu Hause im Live-Monitor (gleiches Format wie am Stand)', !!ev && ev.type === 'sale' && ev.payload.registerId === 'KASSE-01' && !!ev.receivedAt);
    for (let i = 0; i < 20 && !live.some((e) => e.type === 'heartbeat' && e.payload.registerId === 'KASSE-01'); i++) { await warte(500); live = await hausPc.evaluate(() => window.__live); }
    p('2: Kassen-Lebenszeichen (Herzschlag) kommen zu Hause an – für die LEDs', live.some((e) => e.type === 'heartbeat' && e.payload.registerId === 'KASSE-01'));
    let verlauf = null;
    for (let i = 0; i < 40; i++) { verlauf = await hausPc.evaluate(() => fetch('http://127.0.0.1:47392/live-event-log?limit=50').then((a) => a.json())); if (JSON.stringify(verlauf).includes(k1)) break; await warte(1000); }
    p('2: Verkauf steht zu Hause auch im Verlauf (live-event-log)', JSON.stringify(verlauf || {}).includes(k1));

    // ---- 3. Übersichten ----
    const kv = await hausPc.evaluate(() => fetch('http://127.0.0.1:47392/kassen-verbindungen').then((a) => a.json()));
    p('3: Zu Hause: alle drei Kassen als gekoppelt (Spiegel vom Stand)', (kv.kassen || []).map((k) => k.kasse).sort().join() === 'KASSE-01,KASSE-02,KASSE-03' && kv.fernmodus && kv.fernmodus.sekundenAlt >= 0);
    const nurStand = await hausPc.evaluate(() => fetch('http://127.0.0.1:47392/kassen/datenschluessel', { method: 'POST' }).then((a) => a.json().then((j) => ({ s: a.status, j }))));
    p('3: Datenschlüssel der Kassen sind zu Hause NICHT abrufbar („nur am Stand“)', nurStand.s === 503 && nurStand.j.error === 'nur_am_stand');

    // ---- 4. Ausverkauft von zu Hause ----
    const aus = await hausPc.evaluate(() => fetch('http://127.0.0.1:47392/sold-out-status/setzen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ articleId: 'grot', soldOut: true }) }).then((a) => a.json().then((j) => ({ s: a.status, j }))));
    p('4: Zu Hause „Glühwein rot ausverkauft“ -> am Stand ausgeführt', aus.s === 200, JSON.stringify(aus));
    let t2aus = null;
    for (let i = 0; i < 40; i++) { t2aus = await tablet(t2, '/kc-sync-sold-out-status'); if (t2aus.json && (t2aus.json.ausverkauft || []).includes('grot')) break; await warte(1000); }
    p('4: Tablet KASSE-02 zeigt „ausverkauft“', t2aus.json && (t2aus.json.ausverkauft || []).includes('grot'));

    // ---- 5. Stammdaten von zu Hause ----
    await hausPc.waitForFunction(() => typeof loadArticle === 'function', null, { timeout: 20000 });
    await hausPc.evaluate(() => { const i = articles.findIndex((a) => a.id === 'grot'); loadArticle(i); el('aPrice').value = '4.20'; document.querySelector('#articleToolbar button[data-cmd="save"]').click(); managerUnlocked = true; document.getElementById('masterDataPushBtn').click(); });
    let preis = null;
    for (let i = 0; i < 60; i++) { const s = await tablet(t1, '/kc-sync-master-data'); preis = s.json && (s.json.articles || []).find((a) => a.id === 'grot'); if (preis && Number(preis.price) === 4.2) break; await warte(1000); }
    p('5: Preis zu Hause geändert + „an alle Kassen senden“ -> Tablet hat 4,20 €', preis && Number(preis.price) === 4.2, preis && preis.price);

    // ---- 6. Kein Internet am Stand ----
    sb.setzeStandOffline(true);
    const kennungen = [1, 2, 3].map((i) => `KS04-OFFLINE-${i}-${Date.now()}`);
    for (const k of kennungen) p(`6: Kassieren ohne Internet geht weiter (${k.slice(0, 15)}…)`, (await verkauf(t1, k, 'KASSE-01')).status === 202);
    let gestoert = null;
    for (let i = 0; i < 40; i++) { gestoert = await holen(`http://127.0.0.1:${WEB_STAND}/kc-kassen-start/stand-status`); if (gestoert && gestoert.verbunden === false) break; await warte(500); }
    p('6: Stand meldet „Verbindung nach Hause gestört – Buchungen werden nachgereicht“', gestoert && gestoert.verbunden === false && /wird|werden nachgereicht/.test(gestoert.meldung && gestoert.meldung.titel), gestoert && gestoert.meldung && gestoert.meldung.titel);
    p('6: … auch im schwarzen Fenster mit Lösung', /Verbindung nach Hause gestört – Buchungen werden nachgereicht/.test(stand.log()) && /Lösung: 1\) Nichts tun/.test(stand.log()));
    const unterwegs = await hausPc.evaluate(() => fetch('http://127.0.0.1:47392/sold-out-status/setzen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ articleId: 'grot', soldOut: false }) }).then((a) => a.json().then((j) => ({ s: a.status, j }))));
    p('6: Auftrag von zu Hause, während der Stand offline ist: „unterwegs“ (nicht „erledigt“)', unterwegs.s === 202 && unterwegs.j.kcFernmodus === 'unterwegs');
    sb.setzeStandOffline(false);
    let angekommen = 0;
    for (let i = 0; i < 90; i++) {
      angekommen = (await sb.sql("select count(*)::int n from public.kc_stand_ereignis where payload->>'transactionId' like 'KS04-OFFLINE-%'"))[0].n;
      if (angekommen === 3) break; await warte(1000);
    }
    p('6: Internet wieder da -> alle 3 Offline-Verkäufe kommen nachgereicht in Supabase an', angekommen === 3, `${angekommen}/3`);
    let wieder = null;
    for (let i = 0; i < 60; i++) { wieder = await tablet(t2, '/kc-sync-sold-out-status'); if (wieder.json && !(wieder.json.ausverkauft || []).includes('grot')) break; await warte(1000); }
    p('6: … und der wartende Auftrag („wieder verfügbar“) wird nachgeholt', wieder.json && !(wieder.json.ausverkauft || []).includes('grot'));
    const doppelt = (await sb.sql("select count(*)::int n from public.kc_stand_auftrag where erledigt_am is not null"))[0].n;
    p('6: kein Auftrag doppelt ausgeführt', /\[Stand-Brücke\] Auftrag von zu Hause ausgeführt: \/sold-out-status\/setzen/.test(stand.log()) && (stand.log().match(/Auftrag von zu Hause ausgeführt: \/sold-out-status\/setzen/g) || []).length === 2, `${doppelt} erledigt`);

    // ---- 7. Zu Hause ohne Anmeldung ----
    const ohneCtx = await pcManagerKontext(browser, sb, { angemeldet: false });
    const ohne = await ohneCtx.newPage();
    await ohne.goto(`http://127.0.0.1:${WEB_HAUS}/pc-manager/index.html`);
    await ohne.waitForFunction(() => window.KCFernmodus, null, { timeout: 30000 });
    const r7 = await ohne.evaluate(() => fetch('http://127.0.0.1:47392/kassen-verbindungen').then((a) => a.json().then((j) => ({ s: a.status, j }))));
    p('7: Ohne Anmeldung: keine Daten, klare Ansage „bitte anmelden“', r7.s === 401 && /anmelden/.test(r7.j.hinweis));
    await ohne.waitForSelector('#kcFernmodusBanner', { timeout: 10000 }).catch(() => {});
    p('7: Anzeige unten rechts sagt „bitte … bei Supabase anmelden“', /bei Supabase anmelden/.test(await ohne.locator('#kcFernmodusBanner').innerText().catch(() => '')));

    const echte = (l) => l.filter((m) => !/Failed to fetch|NetworkError|Load failed|Fernmodus:/.test(m));
    p('keine Skriptfehler im PC-Manager (Stand und Zuhause)', !echte(standFehler).length && !echte(hausFehler).length, [...echte(standFehler), ...echte(hausFehler)].slice(0, 2).join(' | ') || 'keine');
  } catch (e) {
    rot++; console.log('FEHLER  Abbruch: ' + (e && e.stack || e));
    if (stand) console.log(stand.log().slice(-2500));
  } finally {
    if (browser) await browser.close();
    await stoppe(haus); await stoppe(stand);
    if (sb) await sb.schliessen();
    if (vorher) fs.writeFileSync(VERBINDUNGSDATEI, vorher); else fs.rmSync(VERBINDUNGSDATEI, { force: true });
    fs.rmSync(ARBEIT, { recursive: true, force: true });
  }
  console.log(`\nStand <-> Zuhause über Supabase (KS-04): ${ok}/${ok + rot} bestanden`);
  process.exit(rot ? 1 : 0);
})();
