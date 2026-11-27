// Bildschirm reinigen + Entnahme mit Laufrand (27.11.2026, Betreiber-Wunsch). Kasse und Schulung.
//  - 🔒 → Sperrbildschirm mit großem Knopf „Bildschirm reinigen“ → schwarze Putz-Sperre, nichts reagiert,
//    nach Ablauf von selbst zurück, offener Bon unverändert; „Fertig“ nur nach 3 s Halten.
//  - Entnahme: laufender Rahmen um den Bereich, der dran ist; zum Schluss pulsiert die grüne Taste.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
let n = 0, fehler = 0; const p = (t, b, x) => { n++; if (!b) fehler++; console.log(`${b ? '  OK  ' : 'FEHLER'} ${t}${x ? `  [${x}]` : ''}`); };
const typen = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => { const f = path.join(W, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(W) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': typen[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); });

async function pruefeSeite(b, basis, seite) {
  const s = await b.newPage({ viewport: { width: 1340, height: 800 } });
  const jsf = []; s.on('pageerror', (e) => jsf.push(e.message));
  await s.route('**/*', (r) => (r.request().url().startsWith(basis) ? r.continue() : r.abort()));
  await s.goto(`${basis}/${seite}/index.html`); await s.waitForTimeout(3000);
  const frei = () => s.evaluate(() => { ['fullscreenGate', 'kcStartupSummary', 'kcPinLockOverlay', 'kcStartkarteOverlay'].forEach((id) => { const e = document.getElementById(id); if (e) e.style.display = 'none'; }); document.querySelectorAll('[data-kc-sperrend]').forEach((e) => { e.style.display = 'none'; }); document.querySelectorAll('dialog[open]').forEach((d) => d.close()); });
  await frei();
  const bon = () => s.evaluate(() => state.cart.reduce((a, x) => a + (Number(x.qty) || 0), 0));
  const kachel = '#productGrid .product-tile-wrap button, #productGrid button';
  await s.click(kachel); await s.waitForTimeout(200);
  const bonVorher = await bon();
  p(`${seite}: Testbon hat einen Artikel`, bonVorher >= 1, String(bonVorher));

  // --- Putz-Sperre ---
  await s.click('#screenLockBtn'); await s.waitForTimeout(200);
  p(`${seite}: Schloss zeigt Sperrbildschirm mit Knopf „Bildschirm reinigen“`, await s.evaluate(() => !document.getElementById('screenSaver').hidden && !!document.getElementById('kcReinigenKnopf') && document.getElementById('kcReinigenKnopf').getBoundingClientRect().height >= 70));
  await s.click('#kcReinigenKnopf'); await s.waitForTimeout(200);
  const lage = await s.evaluate(() => ({ an: KCBildschirmReinigen.aktiv(), rest: KCBildschirmReinigen.restMs(), schwarz: getComputedStyle(document.getElementById('kcReinigen')).backgroundColor, voll: (() => { const r = document.getElementById('kcReinigen').getBoundingClientRect(); return r.width >= innerWidth && r.height >= innerHeight; })() }));
  p(`${seite}: Knopf startet schwarze Putz-Sperre über den ganzen Bildschirm (20 s)`, lage.an && lage.rest > 18000 && lage.rest <= 20000 && lage.schwarz === 'rgb(0, 0, 0)' && lage.voll, JSON.stringify(lage));
  // Wischen überall: Maus quer drüber, Klicks, Tasten (auch ein Scan)
  for (const [x, y] of [[200, 300], [700, 400], [1200, 700], [60, 40], [1300, 760]]) { await s.mouse.click(x, y); }
  await s.mouse.move(100, 100); await s.mouse.down(); await s.mouse.move(1200, 700, { steps: 12 }); await s.mouse.up();
  for (const c of '01001') await s.keyboard.press(c); await s.keyboard.press('Enter'); await s.keyboard.press('Escape');
  await s.waitForTimeout(300);
  p(`${seite}: während der Sperre löst nichts aus (Bon unverändert, Sperre bleibt)`, await bon() === bonVorher && await s.evaluate(() => KCBildschirmReinigen.aktiv() && !!document.getElementById('kcReinigen')));
  // kurzes Tippen auf „Fertig“ beendet nicht
  const fertig = await s.evaluate(() => { const r = document.querySelector('#kcReinigen [data-rn="fertig"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await s.mouse.move(fertig.x, fertig.y); await s.mouse.down(); await s.waitForTimeout(600); await s.mouse.up(); await s.waitForTimeout(300);
  p(`${seite}: kurzes Tippen auf „Fertig“ beendet nicht`, await s.evaluate(() => KCBildschirmReinigen.aktiv()));
  // Wischen über „Fertig“ (Finger bewegt sich) beendet nicht
  await s.mouse.move(fertig.x - 80, fertig.y); await s.mouse.down(); await s.mouse.move(fertig.x + 80, fertig.y, { steps: 20 }); await s.waitForTimeout(3400); await s.mouse.up(); await s.waitForTimeout(250);
  p(`${seite}: Wischen über „Fertig“ beendet nicht`, await s.evaluate(() => KCBildschirmReinigen.aktiv()));
  // +20 s halten verlängert
  const vorMehr = await s.evaluate(() => KCBildschirmReinigen.restMs());
  const mehr = await s.evaluate(() => { const r = document.querySelector('#kcReinigen [data-rn="mehr"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await s.mouse.move(mehr.x, mehr.y); await s.mouse.down(); await s.waitForTimeout(3400); await s.mouse.up(); await s.waitForTimeout(250);
  p(`${seite}: „+20 s“ 3 s gedrückt halten verlängert`, await s.evaluate(() => KCBildschirmReinigen.restMs()) > vorMehr + 12000);
  // „Fertig“ 3 s halten beendet, zurück zur Kasse, Bon unverändert
  await s.mouse.move(fertig.x, fertig.y); await s.mouse.down(); await s.waitForTimeout(3400); await s.mouse.up(); await s.waitForTimeout(700);
  p(`${seite}: „Fertig“ 3 s halten → zurück zur Kasse, Sperrbildschirm weg, Bon unverändert`, await s.evaluate(() => !KCBildschirmReinigen.aktiv() && !document.getElementById('kcReinigen') && document.getElementById('screenSaver').hidden) && await bon() === bonVorher);
  await s.click(kachel); await s.waitForTimeout(200);
  p(`${seite}: danach reagiert die Kasse wieder normal`, await bon() === bonVorher + 1);
  // Ablauf: nach der Zeit von selbst zurück (verkürzt)
  await s.evaluate(() => { showScreenSaver('manual'); KCBildschirmReinigen.start(1500); });
  await s.waitForTimeout(2600);
  p(`${seite}: nach Ablauf von selbst zurück zur Kasse`, await s.evaluate(() => !KCBildschirmReinigen.aktiv() && !document.getElementById('kcReinigen') && document.getElementById('screenSaver').hidden));
  // Liegt am Ende noch ein Finger auf, wartet die Sperre
  await s.evaluate(() => KCBildschirmReinigen.start(1000));
  await s.mouse.move(500, 400); await s.mouse.down(); await s.waitForTimeout(1800);
  p(`${seite}: liegt am Ende noch etwas auf dem Glas, bleibt die Sperre`, await s.evaluate(() => KCBildschirmReinigen.aktiv()));
  await s.mouse.up(); await s.waitForTimeout(1700);
  p(`${seite}: 1 s nach dem Loslassen zurück`, await s.evaluate(() => !KCBildschirmReinigen.aktiv()));

  // --- Entnahme mit Laufrand ---
  await frei();
  await s.evaluate(() => document.querySelector('.more-grid button[data-action="withdraw"]').click()); await s.waitForTimeout(400);
  const rand = () => s.evaluate(() => { const d = document.getElementById('withdrawDialog'); const l = [...d.querySelectorAll('.kc-laufrand')]; const nm = (k) => k.id || k.className.split(' ')[0]; return { l: l.map(nm), puls: document.getElementById('saveWithdrawal').classList.contains('kc-schritt-puls'), anim: l[0] ? getComputedStyle(l[0], '::after').animationName : '' }; });
  let r = await rand();
  p(`${seite}: Entnahme Schritt 1: Laufrand um die Gründe`, r.l.length === 1 && r.l[0] === 'withdraw-reason-field' && /kcSchrittLauf/.test(r.anim) && !r.puls, JSON.stringify(r));
  await s.click('[data-withdraw-reason="WC-Geld"]'); await s.waitForTimeout(300);
  r = await rand();
  p(`${seite}: Schritt 2: Laufrand um Münzen und Scheine`, r.l.length === 1 && r.l[0] === 'kcBetragBlock', JSON.stringify(r));
  await s.click('#kcBetragBlock [data-geld]'); await s.waitForTimeout(300);
  r = await rand();
  p(`${seite}: Schritt 3: Laufrand um Bon ja / Kein Bon`, r.l.length === 1 && r.l[0] === 'kc-bon-wahl', JSON.stringify(r));
  await s.click('#kcKeinBonKnopf'); await s.waitForTimeout(300);
  r = await rand();
  const knopf = await s.evaluate(() => { const k = document.getElementById('saveWithdrawal'); return { an: !k.disabled, anim: getComputedStyle(k).animationName }; });
  p(`${seite}: Schritt 4: grüne Taste frei, pulsiert, mit Laufrand`, r.l.length === 1 && r.l[0] === 'saveWithdrawal' && r.puls && knopf.an && /kcSchrittPuls/.test(knopf.anim), JSON.stringify({ r, knopf }));
  await s.evaluate(() => document.getElementById('withdrawDialog').close()); await s.waitForTimeout(200);
  r = await rand();
  p(`${seite}: Fenster zu → kein Laufrand mehr`, r.l.length === 0 && !r.puls, JSON.stringify(r));
  p(`${seite}: keine JS-Fehler`, jsf.length === 0, jsf.join(' | '));
  await s.close();
}

(async () => {
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const basis = `http://127.0.0.1:${srv.address().port}`;
  const b = await chromium.launch();
  await pruefeSeite(b, basis, 'pos');
  await pruefeSeite(b, basis, 'schulung/pos');
  await b.close(); srv.close();
  console.log(fehler ? `Bildschirm reinigen: ${fehler} von ${n} FEHLGESCHLAGEN` : `Bildschirm reinigen: alle ${n} bestanden`);
  process.exit(fehler ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
