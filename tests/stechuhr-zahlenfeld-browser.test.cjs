// Stechuhr im Browser (28.11.2026, Betreiber: „beim Stechuhr-Fenster soll sich sofort ein Zifferneingabefeld öffnen, damit man das
// Geburtsdatum eingeben kann, nicht die Tastatur – aber trotzdem muss der QR-Scan vom Barcode-Scanner erkannt werden“). Kasse und Schulung.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
let n = 0, fehler = 0; const p = (t, b, x) => { n++; if (!b) fehler++; console.log(`${b ? '  OK  ' : 'FEHLER'} ${t}${x ? `  [${x}]` : ''}`); };
const typen = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => { const f = path.join(W, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(W) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': typen[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); });

async function seite(b, basis, ort) {
  const s = await b.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
  const jsf = []; s.on('pageerror', (e) => jsf.push(e.message));
  await s.route('**/*', (r) => (r.request().url().startsWith(basis) ? r.continue() : r.abort()));
  await s.goto(`${basis}/${ort}/index.html`); await s.waitForTimeout(2500);
  await s.evaluate(() => { ['fullscreenGate', 'kcStartupSummary', 'kcPinLockOverlay', 'kcStartkarteOverlay'].forEach((id) => { const e = document.getElementById(id); if (e) e.style.display = 'none'; }); document.querySelectorAll('[data-kc-sperrend]').forEach((e) => { e.style.display = 'none'; }); document.querySelectorAll('dialog[open]').forEach((d) => d.close()); });
  await s.evaluate(() => document.getElementById('timeClockBtn').click()); await s.waitForTimeout(300);
  const auf = await s.evaluate(() => { const f = document.getElementById('tcPosCredential'), z = document.getElementById('tcPosZiffern'); return { offen: document.getElementById('timeClockDialog').open, fokus: document.activeElement === f, mode: f.getAttribute('inputmode'), ziffern: !z.hidden && z.getBoundingClientRect().height > 150, tasten: z.querySelectorAll('button').length }; });
  p(`${ort}: Stechuhr öffnet sofort mit Zahlenfeld, keine Bildschirmtastatur, Fokus im Feld für den Scanner`, auf.offen && auf.fokus && auf.mode === 'none' && auf.ziffern && auf.tasten === 12, JSON.stringify(auf));
  const nachricht = () => s.evaluate(() => document.getElementById('tcPosMessage').textContent);
  // Geburtstag über das Zahlenfeld (Finger): Fokus bleibt im Feld, nach 6 Ziffern geht es weiter
  for (const z of ['0', '1', '0', '1']) await s.tap(`#tcPosZiffern [data-ziffer="${z}"]`);
  const mitte = await s.evaluate(() => ({ v: document.getElementById('tcPosCredential').value, fokus: document.activeElement === document.getElementById('tcPosCredential') }));
  p(`${ort}: Zahlenfeld schreibt ins Feld, Fokus bleibt dort (Scanner kann jederzeit)`, mitte.v === '0101' && mitte.fokus, JSON.stringify(mitte));
  await s.tap('#tcPosZiffern [data-ziffer="weg"]');
  p(`${ort}: ⌫ löscht die letzte Ziffer`, await s.inputValue('#tcPosCredential') === '010');
  const vorher = await nachricht();
  for (const z of ['1', '9', '0']) await s.tap(`#tcPosZiffern [data-ziffer="${z}"]`);
  await s.waitForTimeout(300);
  p(`${ort}: nach 6 Ziffern geht es von selbst weiter (Geburtstag wird geprüft)`, (await nachricht()) !== vorher || await s.evaluate(() => !document.getElementById('tcPosSchritt2').hidden), await nachricht());
  // Scanner (Tastatur, schnell + Enter) mitten in einer angefangenen Zifferneingabe
  await s.evaluate(() => { document.getElementById('tcPosZurueck')?.click(); const f = document.getElementById('tcPosCredential'); f.value = ''; f.focus(); document.getElementById('tcPosMessage').textContent = 'Bereit.'; });
  await s.tap('#tcPosZiffern [data-ziffer="1"]');
  let erkannt = null;
  await s.exposeFunction('kcGemeldet', (v) => { erkannt = v; });
  await s.evaluate(() => { const f = document.getElementById('tcPosCredential'); f.addEventListener('keydown', (e) => { if (e.key === 'Enter') window.kcGemeldet(f.value); }, true); });
  await s.keyboard.type('KC|0007|ABCDEF', { delay: 15 }); await s.keyboard.press('Enter'); await s.waitForTimeout(400);
  p(`${ort}: QR-Scan nach angetippter Ziffer wird trotzdem sauber erkannt (Ziffer verworfen)`, erkannt === 'KC|0007|ABCDEF' && (await nachricht()) !== 'Bereit.', JSON.stringify({ erkannt, m: await nachricht() }));
  // Scanner ohne vorheriges Tippen
  await s.evaluate(() => { document.getElementById('tcPosZurueck')?.click(); const f = document.getElementById('tcPosCredential'); f.value = ''; f.focus(); });
  erkannt = null; await s.keyboard.type('KC|0013|XYZ123', { delay: 15 }); await s.keyboard.press('Enter'); await s.waitForTimeout(300);
  p(`${ort}: QR-Scan direkt nach dem Öffnen wird erkannt`, erkannt === 'KC|0013|XYZ123', String(erkannt));
  // Geburtstag weiter möglich nach einem Scan
  await s.evaluate(() => { document.getElementById('tcPosZurueck')?.click(); const f = document.getElementById('tcPosCredential'); f.value = ''; f.focus(); });
  for (const z of ['2', '4']) await s.tap(`#tcPosZiffern [data-ziffer="${z}"]`);
  p(`${ort}: danach wieder Ziffern über das Zahlenfeld`, await s.inputValue('#tcPosCredential') === '24');
  // ⌨️ schaltet bei Bedarf doch die Tastatur ein
  await s.evaluate(() => { document.getElementById('tcPosZurueck')?.click(); });
  await s.tap('#tcPosZiffern [data-ziffer="tastatur"]'); await s.waitForTimeout(150);
  p(`${ort}: ⌨️ blendet bei Bedarf die Tastatur ein`, await s.evaluate(() => document.getElementById('tcPosCredential').getAttribute('inputmode')) === 'text');
  await s.evaluate(() => document.getElementById('timeClockDialog').close());
  await s.evaluate(() => document.getElementById('timeClockBtn').click()); await s.waitForTimeout(200);
  p(`${ort}: wieder geöffnet: wieder Zahlenfeld statt Tastatur`, await s.evaluate(() => document.getElementById('tcPosCredential').getAttribute('inputmode')) === 'none');
  p(`${ort}: keine JS-Fehler`, jsf.length === 0, jsf.join(' | '));
  await s.close();
}
(async () => {
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const basis = `http://127.0.0.1:${srv.address().port}`;
  const b = await chromium.launch();
  await seite(b, basis, 'pos'); await seite(b, basis, 'schulung/pos');
  await b.close(); srv.close();
  console.log(fehler ? `Stechuhr-Zahlenfeld (Browser): ${fehler} von ${n} FEHLGESCHLAGEN` : `Stechuhr-Zahlenfeld (Browser): alle ${n} bestanden`);
  process.exit(fehler ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
