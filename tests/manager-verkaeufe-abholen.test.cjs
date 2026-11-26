/* KC-MANAGER-VERKAEUFE-ABHOLEN (26.11.2026, Betreiber: „Ja bau das ein, aber super vorsichtig“):
 * Verkäufe kommen ohne Datei-Import in die Auswertungen des PC-Managers. Komplett über den echten Startweg
 * (run-manager-service.js), echte Kassen im Browser (completeSale, Storno) und den echten PC-Manager:
 *   1. Verkauf an KASSE-01 (Glühwein + Feuerzangenbowle mit Pfand) und an KASSE-03 -> nach Sync im PC-Manager
 *   1b. großer Bon (19 Zeilen, über der 8-KB-Grenze) kommt vollständig an (schlanke Fassung)
 *   2. Storno des Bons von KASSE-03 kommt ebenfalls an (Umsatz geht zurück)
 *   3. Umsatz im PC-Manager = Warenumsatz der echten Bons ohne Pfand (Dashboard-Kachel „Gesamtumsatz“, wie beim Datei-Import)
 *   4. doppelt geholt / dieselbe Buchung zweimal beim Manager (Nachreichen) -> zählt nur einmal
 *   5. Trainingsbon und Buchung vor „Verkäufe zählen ab“ werden NICHT übernommen
 *   5b. Trinkgeld und Entnahme (mit Belegfoto, das nicht mitgehen darf) kommen genau einmal an, nicht als Umsatz
 *   6. Statuszeile „zuletzt geholt“; Manager-Dienst aus -> ruhige Warnung, keine Skriptfehler, Daten bleiben
 * Nur örtliche Adressen; alles andere wird abgebrochen, Netzsperre für echte Server.
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
const OHNE_ECHTSERVER = ['--host-resolver-rules=MAP *.supabase.co 0.0.0.0, MAP *.supabase.com 0.0.0.0, MAP *.workers.dev 0.0.0.0, MAP speed.cloudflare.com 0.0.0.0, MAP api.github.com 0.0.0.0'];

let ok = 0, rot = 0;
const p = (n, b, z = '') => { b ? ok++ : rot++; console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z !== '' ? '   [' + z + ']' : ''}`); };
const MGR_PORT = 8573, WEB_PORT = 8893, LIVE = 47392;
const lan = Object.values(os.networkInterfaces()).flat().find((e) => e && e.family === 'IPv4' && !e.internal && !e.address.startsWith('169.254.'));
if (!lan) { console.log('Keine Netzwerkadresse - dieser Test braucht eine.'); process.exit(1); }
const ARBEIT = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-verkaeufe-'));
const MGR_DB = path.join(ARBEIT, 'manager.sqlite');
const VERBINDUNGSDATEI = path.join(WURZEL, 'pc-manager', 'kassen-verbindungen.json');
const vorher = fs.existsSync(VERBINDUNGSDATEI) ? fs.readFileSync(VERBINDUNGSDATEI) : null;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const portFrei = (port) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.listen(port, '0.0.0.0', () => s.close(() => r(true))); });
const heute = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
const ORTLICH = new Set(['127.0.0.1', 'localhost', lan.address]);
async function abgeschirmt(kontext) {
  await kontext.route('**/*', (r) => { let h = ''; try { h = new URL(r.request().url()).hostname; } catch (e) { /* */ } return ORTLICH.has(h) ? r.continue() : r.abort(); });
  return kontext;
}
function holen(url) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'GET', timeout: 8000 }, (res) => {
      let d = ''; res.on('data', (c) => { d += c; });
      res.on('end', () => { let j = null; try { j = JSON.parse(d); } catch (e) { /* */ } resolve({ status: res.statusCode, json: j }); });
    });
    req.on('timeout', () => req.destroy(new Error('timeout'))); req.on('error', (e) => resolve({ status: 0, fehler: e.message })); req.end();
  });
}
const imManager = (kennung) => { const db = new DatabaseSync(MGR_DB); try { return db.prepare("SELECT COUNT(*) AS n FROM received_events WHERE type='sale' AND payload LIKE ?").get(`%${kennung}%`).n; } finally { db.close(); } };
async function kasseBereit(seite) {
  await seite.waitForFunction(() => typeof completeSale === 'function' && typeof PRODUCTS !== 'undefined' && !!window.KCSyncLiveEvent, null, { timeout: 30000 });
  await seite.getByText('KASSE STARTEN').click({ timeout: 3000 }).catch(() => {});
  await warte(600);
}
async function verkaufe(seite, ids) {
  return seite.evaluate(async (liste) => {
    document.querySelectorAll('dialog[open]').forEach((d) => d.close());
    state.master.trainingMode = false; state.cart = [];
    for (const id of liste) addConfiguredProduct(PRODUCTS.find((x) => x.id === id), null);
    state.given = +grossTotal().toFixed(2);
    const rec = await completeSale('cash', { silent: true });
    return { transactionId: rec.transactionId, due: rec.due, waren: rec.items.filter((i) => !i.discountLine).reduce((a, i) => a + Number(i.price || 0) * Number(i.qty || 0), 0), training: !!rec.training, registerId: rec.registerId, bon: rec.bon };
  }, ids);
}

// Kasse + Schulung: Storno und Reklamation werden nach dem Speichern über den sicheren Weg gemeldet (wie jeder Verkauf)
for (const datei of ['pos/app.js', 'schulung/pos/app.js']) {
  const q = fs.readFileSync(path.join(WURZEL, datei), 'utf8');
  p(`${datei}: Storno meldet sicher`, q.includes('renderHeader();if(!original.training)kcSicherMelden(rec);return rec;'));
  p(`${datei}: Reklamation meldet sicher`, q.includes('if(!training){state.master.nextBon++;saveMaster();kcSicherMelden(rec)}return rec;'));
  p(`${datei}: Trinkgeld, Entnahme, Reklamations-Protokoll und Storno-Gegenbuchungen melden sicher (6 Stellen)`, (q.match(/kcSicherMeldenBeleg\("(trinkgeld|entnahme)",/g) || []).length === 6);
  p(`${datei}: Meldung kann die Buchung nicht stören (try/catch, Training ausgeschlossen)`, /function kcSicherMelden\(rec\)\{try\{if\(rec&&!rec\.training&&/.test(q));
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

    browser = await chromium.launch({ args: OHNE_ECHTSERVER });
    const k1 = await (await abgeschirmt(await browser.newContext({ viewport: { width: 1180, height: 820 } }))).newPage();
    const k3 = await (await abgeschirmt(await browser.newContext({ viewport: { width: 1180, height: 820 } }))).newPage();
    const kasseFehler = []; [k1, k3].forEach((s) => s.on('pageerror', (e) => kasseFehler.push(e.message)));
    await k1.goto(status.kassen[0].qrAdresse, { waitUntil: 'domcontentloaded' });
    await k3.goto(status.kassen[2].qrAdresse, { waitUntil: 'domcontentloaded' });
    await kasseBereit(k1); await kasseBereit(k3);

    // PC-Manager: „Verkäufe zählen ab“ = heute (für den Test; Vorgabe ist der Marktbeginn)
    const pcK = await abgeschirmt(await browser.newContext({ viewport: { width: 1400, height: 900 } }));
    await pcK.addInitScript((d) => { try { if (!sessionStorage.getItem('kcTestAb')) { localStorage.setItem('kcm_verkaeufe_ab', d); sessionStorage.setItem('kcTestAb', '1'); } } catch (e) { /* */ } }, heute);
    const pc = await pcK.newPage(); const pcFehler = []; pc.on('pageerror', (e) => pcFehler.push(e.message)); pc.on('dialog', (d) => d.accept());
    await pc.goto(`http://127.0.0.1:${WEB_PORT}/pc-manager/index.html`);
    await pc.waitForFunction(() => !!window.KCManagerVerkaeufe && !!window.KCVerkaeufeAbholen, null, { timeout: 30000 });
    const vorgabe = await pc.evaluate(() => window.KCVerkaeufeAbholen.VORGABE_AB);
    p('Vorgabe „Verkäufe zählen ab“ = Marktbeginn 04.12.2026', vorgabe === '2026-12-04', vorgabe);
    const leisten = await pc.evaluate(() => [...document.querySelectorAll('.kc-vab-leiste')].map((l) => l.closest('[data-view-panel]')?.dataset.viewPanel).join(','));
    p('Leiste „Verkäufe von den Kassen“ auf Dashboard und Umsatzseite', leisten === 'dashboard,sales', leisten);
    const anfangsZahl = await pc.evaluate(() => window.KCManagerVerkaeufe.anzahl());

    // 1. echte Verkäufe
    const v1 = await verkaufe(k1, ['grot', 'feuer']);
    const v3 = await verkaufe(k3, ['gruenkohl', 'grot']);
    p('KASSE-01 bucht Glühwein + Feuerzangenbowle (mit Pfand)', v1.transactionId && v1.due > 0 && !v1.training, `${v1.due} €`);
    p('KASSE-03 bucht Grünkohl + Glühwein', v3.transactionId && v3.due > 0 && !v3.training, `${v3.due} €`);
    // großer Bon: 19 verschiedene Zeilen, vollständig größer als die 8-KB-Grenze des Manager-Dienstes -> schlanke Fassung
    const vieleIds = await k1.evaluate(() => PRODUCTS.filter((x) => Number(x.price) > 0).slice(0, 19).map((x) => x.id));
    const vg = await verkaufe(k1, vieleIds);
    const vgGroesse = await k1.evaluate((id) => JSON.stringify(readTransactions().find((t) => t.transactionId === id)).length, vg.transactionId);
    p('KASSE-01 bucht großen Bon (19 Zeilen, vollständig über 8 KB)', vgGroesse > 8192 && vg.due > 0, `${vgGroesse} Zeichen, ${vg.due} €`);
    // 2. Storno an KASSE-03 (echte Funktion)
    const st = await k3.evaluate(async (id) => { const o = readTransactions().find((t) => t.transactionId === id); const r = await reverseCompletedTransaction(o, 'Test Fehlbuchung'); return { transactionId: r.transactionId, due: r.due, waren: r.items.reduce((a, i) => a + Number(i.price || 0) * Number(i.qty || 0), 0), type: r.type }; }, v3.transactionId);
    p('KASSE-03 storniert den Bon (Gegenbon)', st.type === 'reversal' && Math.abs(st.due + v3.due) < 0.001, `${st.due} €`);
    // Trinkgeld und Entnahme an KASSE-01 (echte Funktionen); die Entnahme mit großem Belegfoto - das darf nie mitgehen (Grenze 8 KB)
    const tipp = await k1.evaluate(() => saveTipRecord(1.5, 'manual', null, 'Test Trinkgeld'));
    p('KASSE-01: Trinkgeld 1,50 € gespeichert', !!(tipp && tipp.id && tipp.amount === 1.5));
    const entn = await k1.evaluate(async () => {
      document.querySelectorAll('dialog[open]').forEach((d) => d.close());
      openWithdrawal();
      const knopf = [...document.querySelectorAll('[data-withdraw-reason]')].find((b) => b.dataset.withdrawReason !== 'Reklamation');
      knopf.click();
      withdrawalReceiptAvailable = true; withdrawalReceiptAttachment = { name: 'beleg.jpg', type: 'image/jpeg', size: 30000, data: 'data:image/jpeg;base64,' + 'A'.repeat(40000) };
      el('withdrawAmount').value = '20'; el('withdrawNote').value = 'Test Einkauf';
      await el('saveWithdrawal').onclick();
      const w = safeArray(WITHDRAWAL_KEY).at(-1) || {}; return { withdrawalId: w.withdrawalId, reason: w.reason, amount: w.amount, mitFoto: !!(w.receiptAttachment && w.receiptAttachment.data) };
    });
    p('KASSE-01: Entnahme 20 € mit Belegfoto gespeichert', entn.amount === 20 && entn.mitFoto, `${entn.reason}`);

    // über Mini-PC-Dienst (alle 15 s) zum Manager-Dienst
    let da = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 60 && !da.every(Boolean); i++) { da = [v1.transactionId, v3.transactionId, st.transactionId, tipp.id, entn.withdrawalId, vg.transactionId].map(imManager); if (!da.every(Boolean)) await warte(1000); }
    p('Verkäufe, großer Bon, Storno, Trinkgeld und Entnahme kommen sicher beim Manager-Dienst an', da.every(Boolean), da.join('/'));
    const entnRoh = (() => { const db = new DatabaseSync(MGR_DB); try { return db.prepare("SELECT payload FROM received_events WHERE type='sale' AND payload LIKE ?").get(`%${entn.withdrawalId}%`).payload; } finally { db.close(); } })();
    p('Entnahme beim Manager ohne Belegfoto, unter 8 KB', !/AAAAAAAAAAAAAAAA/.test(entnRoh) && entnRoh.length < 8192 && /"kcArt":"entnahme"/.test(entnRoh), `${entnRoh.length} Zeichen`);

    // Störfälle direkt beim Manager einspeisen: dieselbe Buchung nochmal (Nachreichen), Trainingsbon, alte Buchung
    const roh = await k1.evaluate(async (id) => readTransactions().find((t) => t.transactionId === id), v1.transactionId);
    const senden = (payload) => k1.evaluate(async (pl) => { const a = await fetch(window.KCSyncConnection.buildUrl('/kc-sync-record-event'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'sale', payload: pl }) }); return a.status; }, payload);
    await senden(roh);
    await senden({ ...roh, transactionId: 'TEST-TRAINING-1', training: true });
    await senden({ ...roh, transactionId: 'TEST-ALT-1', time: '2026-11-01T18:00:00.000Z', endTime: '2026-11-01T18:00:00.000Z', startTime: '2026-11-01T17:59:00.000Z' });
    for (let i = 0; i < 40 && !(imManager(v1.transactionId) >= 2 && imManager('TEST-ALT-1') && imManager('TEST-TRAINING-1')); i++) await warte(1000);
    p('Testfälle liegen beim Manager (Doppelt, Training, alt)', imManager(v1.transactionId) >= 2 && imManager('TEST-ALT-1') === 1 && imManager('TEST-TRAINING-1') === 1, `doppelt ${imManager(v1.transactionId)}`);

    // 3. PC-Manager holt (Knopf) - zweimal
    await pc.evaluate(() => document.querySelector('[data-view-panel="dashboard"] .kc-vab-knopf').click());
    let pcStand = null;
    for (let i = 0; i < 20; i++) {
      await warte(700);
      pcStand = await pc.evaluate((ids) => ({ ids: ids.map((id) => sales.filter((s) => s.transactionId === id).length), alle: sales.length, umsatz: el('kpiRevenue').textContent, stand: document.querySelector('.kc-vab-stand').textContent, gespeichert: (window.KCSalesImportCore.parseStorage(localStorage.getItem('kcm_sales')) || []).length }), [v1.transactionId, v3.transactionId, st.transactionId, 'TEST-TRAINING-1', 'TEST-ALT-1', vg.transactionId]);
      if (pcStand.ids.slice(0, 3).every((n) => n === 1) && pcStand.ids[5] === 1) break;
    }
    p('PC-Manager: beide Verkäufe und das Storno je genau einmal übernommen', pcStand.ids.slice(0, 3).every((n) => n === 1), pcStand.ids.join('/'));
    p('PC-Manager: großer Bon genau einmal übernommen', pcStand.ids[5] === 1);
    const gross = await pc.evaluate((id) => { const t = sales.find((x) => x.transactionId === id); return { zeilen: t.items.length, waren: t.items.reduce((a, i) => a + i.price * i.qty, 0), kasse: t.registerId }; }, vg.transactionId);
    p('PC-Manager: großer Bon mit allen 19 Zeilen und richtigem Warenwert', gross.zeilen === 19 && Math.abs(gross.waren - vg.waren) < 0.001 && gross.kasse === 'KASSE-01', `${gross.zeilen} Zeilen, ${gross.waren.toFixed(2)} €`);
    p('PC-Manager: Trainingsbon NICHT übernommen', pcStand.ids[3] === 0);
    p('PC-Manager: Buchung vor „Verkäufe zählen ab“ NICHT übernommen', pcStand.ids[4] === 0);
    p('PC-Manager: genau 4 neue Vorgänge, dauerhaft gespeichert', pcStand.alle === anfangsZahl + 4 && pcStand.gespeichert === pcStand.alle, `${anfangsZahl} -> ${pcStand.alle}, gespeichert ${pcStand.gespeichert}`);
    // Das Dashboard zählt (wie beim Datei-Import) den Warenumsatz ohne Pfand
    const soll = (v1.waren + v3.waren + st.waren + vg.waren).toFixed(2).replace('.', ',');
    p(`Dashboard „Gesamtumsatz“ = Warenumsatz der echten Bons ohne Pfand (${soll} €, Storno abgezogen)`, pcStand.umsatz.replace(/\s/g, ' ').includes(soll), pcStand.umsatz);
    p('Statuszeile: „zuletzt geholt … gezählt ab“ mit Datum', /zuletzt geholt \d\d:\d\d:\d\d · \d+ neu/.test(pcStand.stand) && pcStand.stand.includes(heute.split('-').reverse().join('.')), pcStand.stand);
    await pc.evaluate(() => window.KCVerkaeufeAbholen.holen({ manuell: true }));
    await pc.evaluate(() => window.KCVerkaeufeAbholen.holen());
    const nochmal = await pc.evaluate(() => sales.length);
    p('nochmal geholt (2×): nichts doppelt', nochmal === pcStand.alle, `${nochmal}`);
    const tw = await pc.evaluate(([t, w]) => ({ t: managerTips.filter((x) => x.id === t).length, w: cashWithdrawals.filter((x) => x.withdrawalId === w).length,
      betragT: (managerTips.find((x) => x.id === t) || {}).amount, betragW: (cashWithdrawals.find((x) => x.withdrawalId === w) || {}).amount,
      foto: cashWithdrawals.some((x) => x.withdrawalId === w && x.receiptAttachment && x.receiptAttachment.data), kennz: managerTips.concat(cashWithdrawals).some((x) => 'kcArt' in x),
      gespT: JSON.parse(localStorage.getItem('kcm_tips') || '[]').filter((x) => x.id === t).length, gespW: JSON.parse(localStorage.getItem('kcm_withdrawals') || '[]').filter((x) => x.withdrawalId === w).length,
      inUmsatz: sales.some((x) => x.transactionId === t || x.transactionId === w) }), [tipp.id, entn.withdrawalId]);
    p('PC-Manager: Trinkgeld 1,50 € genau einmal übernommen und gespeichert', tw.t === 1 && tw.gespT === 1 && tw.betragT === 1.5, JSON.stringify({ t: tw.t, gespT: tw.gespT }));
    p('PC-Manager: Entnahme 20 € genau einmal übernommen und gespeichert', tw.w === 1 && tw.gespW === 1 && tw.betragW === 20, JSON.stringify({ w: tw.w, gespW: tw.gespW }));
    p('PC-Manager: Trinkgeld/Entnahme zählen NICHT als Umsatz, ohne Foto, ohne Kennzeichen', !tw.inUmsatz && !tw.foto && !tw.kennz);
    const statusTW = await pc.evaluate(() => document.querySelector('.kc-vab-stand').textContent);
    const datei2 = await pc.evaluate(([t, w]) => { const vorT = managerTips.length, vorW = cashWithdrawals.length; const tips = [managerTips.find((x) => x.id === t)], wd = [cashWithdrawals.find((x) => x.withdrawalId === w)];
      tips.forEach((x) => { if (!managerTips.some((y) => y.id === x.id)) managerTips.push(x); }); const nachW = mergeById(cashWithdrawals, wd).length; return { t: managerTips.length - vorT, w: nachW - vorW }; }, [tipp.id, entn.withdrawalId]);
    p('Datei-Import derselben Trinkgeld/Entnahme würde nichts doppeln', datei2.t === 0 && datei2.w === 0, JSON.stringify(datei2));
    // wie ein zusätzlicher Datei-Import derselben Buchungen (gleiche Zusammenführung)
    const datei = await pc.evaluate((tx) => { const m = window.KCSalesImportCore.merge(sales, tx, {}); return { added: m.added, duplicates: m.duplicates.length }; }, [roh]);
    p('Datei-Import derselben Buchung würde sie als Duplikat überspringen', datei.added === 0 && datei.duplicates >= 1, JSON.stringify(datei));

    // 5. Umsatzanalyse sieht die Buchungen (Kasse-Filter kennt beide Kassen)
    const analyse = await pc.evaluate(() => { const box = document.getElementById('kcAnaRegister'); return box ? [...box.options].map((o) => o.value).filter(Boolean).sort().join(',') : 'fehlt'; });
    p('Umsatz- und Kundenanalyse kennt KASSE-01 und KASSE-03', /KASSE-01/.test(analyse) && /KASSE-03/.test(analyse), analyse);

    // 6. Manager-Dienst aus -> ruhige Warnung, Daten bleiben
    const weg = new Promise((r) => kind.once('exit', r)); kind.kill('SIGINT'); await Promise.race([weg, warte(15000)]); if (kind.exitCode === null) kind.kill('SIGKILL');
    await pc.evaluate(() => window.KCVerkaeufeAbholen.holen());
    const aus = await pc.evaluate(() => ({ stand: document.querySelector('.kc-vab-stand').textContent, art: document.querySelector('.kc-vab-stand').className, n: sales.length }));
    p('Dienst aus: ruhige Warnung „nicht erreichbar“, Verkäufe bleiben', /nicht erreichbar/.test(aus.stand) && /warn/.test(aus.art) && aus.n === pcStand.alle, aus.stand);
    p('keine Skriptfehler (PC-Manager und Kassen)', !pcFehler.length && !kasseFehler.filter((x) => !/Failed to fetch|Load failed|net::ERR|access control/.test(x)).length, [...pcFehler, ...kasseFehler].slice(0, 3).join(' | ') || 'keine');
  } catch (e) {
    rot++; console.log('FEHLER  Abbruch: ' + (e && e.stack || e)); console.log(log.replace(/kcToken=[^&\s]+/g, 'kcToken=***').slice(-2500));
  } finally {
    if (kind && kind.exitCode === null) { const weg = new Promise((r) => kind.once('exit', r)); kind.kill('SIGINT'); await Promise.race([weg, warte(15000)]); if (kind.exitCode === null) kind.kill('SIGKILL'); }
    if (browser) await browser.close();
    if (vorher) fs.writeFileSync(VERBINDUNGSDATEI, vorher); else fs.rmSync(VERBINDUNGSDATEI, { force: true });
    fs.rmSync(ARBEIT, { recursive: true, force: true });
  }
  console.log(`\nVerkäufe automatisch in den PC-Manager: ${ok}/${ok + rot} bestanden`);
  process.exit(rot ? 1 : 0);
})();
