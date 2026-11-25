'use strict';
// Scanner-Anzeige oben links neben der Kochmütze (23.11.2026): erkennt Scans an der Geschwindigkeit, Test-Scan kommt
// nicht in den Bon, normaler Scan schon, langsames Tippen zählt nicht als Scan, Platz links neben der Kochmütze.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
let n = 0, fehler = 0; const p = (t, b, x) => { n++; if (!b) fehler++; console.log(`${b ? '  OK  ' : 'FEHLER'} ${t}${x ? `  [${x}]` : ''}`); };
const typen = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => { const f = path.join(W, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(W) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': typen[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); });
(async () => {
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const basis = `http://127.0.0.1:${srv.address().port}`;
  const b = await chromium.launch(); const s = await b.newPage({ viewport: { width: 1340, height: 800 } });
  const jsf = []; s.on('pageerror', (e) => jsf.push(e.message));
  await s.route('**/*', (r) => (r.request().url().startsWith(basis) ? r.continue() : r.abort()));
  await s.goto(`${basis}/pos/index.html`); await s.waitForTimeout(2500);
  await s.evaluate(() => { ['fullscreenGate', 'kcStartupSummary', 'kcPinLockOverlay'].forEach((id) => { const e = document.getElementById(id); if (e) e.style.display = 'none'; }); document.querySelectorAll('[data-kc-sperrend]').forEach((e) => { e.style.display = 'none'; }); document.querySelectorAll('dialog[open]').forEach((d) => d.close()); });
  const lage = await s.evaluate(() => { const a = document.getElementById('kcScanner').getBoundingClientRect(), m = document.getElementById('clubLogo').getBoundingClientRect(); return { scan: a.right, logo: m.left, hoehe: a.height, zustand: KCScannerStatus.zustand(), deckkraft: getComputedStyle(document.getElementById('kcScanner')).opacity }; });
  p('Knopf steht links neben der Kochmütze', lage.scan <= lage.logo + 1 && lage.hoehe >= 36, JSON.stringify(lage));
  p('ohne Scan: blass (Scanner aus)', lage.zustand === 'unbekannt' && Number(lage.deckkraft) < 0.5, lage.deckkraft);
  const bon = () => s.evaluate(() => state.cart.reduce((a, x) => a + (Number(x.qty) || 0), 0));
  const tippen = async (text, pause) => { for (const c of text) { await s.keyboard.press(c); if (pause) await s.waitForTimeout(pause); } await s.keyboard.press('Enter'); await s.waitForTimeout(300); };
  await tippen('01001', 160);
  p('Tippen mit der Hand (160 ms je Zeichen) zählt nicht als Scan', await s.evaluate(() => KCScannerStatus.zustand()) === 'unbekannt');
  // langsamer Bluetooth-Scanner (Eyoyo EY-038, ca. 60 ms je Zeichen) wird erkannt
  await s.evaluate(() => localStorage.removeItem('kc_scanner_letzter_scan_v1'));
  await tippen('01001', 60);
  p('langsamerer Bluetooth-Scanner (60 ms je Zeichen) wird als Scanner erkannt', await s.evaluate(() => KCScannerStatus.zustand()) === 'bereit');
  const vor = await bon();
  await s.click('#kcScanner');
  p('Antippen öffnet den Test, Kochmütze (Service) nicht ausgelöst', await s.evaluate(() => !!document.getElementById('kcScannerTest') && !document.getElementById('secretTrigger').classList.contains('admin-hold-active')));
  await tippen('01001', 0);
  p('Test-Scan wird erkannt', /Scanner funktioniert/.test(await s.evaluate(() => document.getElementById('kstStatus').textContent)));
  p('Test-Scan kommt nicht in den Bon', await bon() === vor);
  p('danach: Scanner bereit (grün, hell)', await s.evaluate(() => { const k = document.getElementById('kcScanner'); return k.dataset.zustand === 'bereit' && getComputedStyle(k).opacity === '1'; }));
  await s.waitForTimeout(2700);
  p('Test schließt von selbst', await s.evaluate(() => !document.getElementById('kcScannerTest')));
  await tippen('01001', 0);
  p('normaler Scan landet im Bon', await bon() === vor + 1);
  await s.evaluate(() => { const i = document.createElement('input'); i.id = 'tf'; document.body.appendChild(i); i.focus(); });
  await s.waitForTimeout(100);
  p('offenes Eingabefeld: gelb „Feld aktiv“', await s.evaluate(() => document.getElementById('kcScanner').dataset.zustand) === 'feld');
  await s.evaluate(() => document.getElementById('tf').blur());
  for (const v of ['CMD-CHECKOUT', 'CMDCHECKOUT', 'cmd_checkout']) {
    await tippen('01001', 0);
    const vorher = await bon();
    await tippen(v, 0);
    p(`Bezahl-QR „${v}“ schließt den Verkauf ab`, vorher > 0 && (await bon()) === 0);
  }
  p('keine JS-Fehler', jsf.length === 0, jsf.join(' | '));
  await b.close(); srv.close();
  console.log(fehler ? `Scanner-Anzeige: ${fehler} von ${n} FEHLGESCHLAGEN` : `Scanner-Anzeige: alle ${n} bestanden`);
  process.exit(fehler ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
