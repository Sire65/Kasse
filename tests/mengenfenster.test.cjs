// Mengenfenster neben den Kacheln (28.11.2026, Betreiber). Kasse und Schulung.
//  Kachel → Artikel mit 1 im Bon + Fenster über dem Warenkorb; erste Zahl ersetzt, weitere zählen dazu (5+5=10);
//  nächste Kachel → Fenster wechselt; ✕ / 25 s / Kassieren schließen; BAR bleibt frei; ⓘ und + im Fenster; abschaltbar unter „Mehr“.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
let n = 0, fehler = 0; const p = (t, b, x) => { n++; if (!b) fehler++; console.log(`${b ? '  OK  ' : 'FEHLER'} ${t}${x ? `  [${x}]` : ''}`); };
const typen = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => { const f = path.join(W, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(W) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': typen[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); });

async function seite(b, basis, ort, groesse) {
  const s = await b.newPage({ viewport: groesse, hasTouch: true });
  const jsf = []; s.on('pageerror', (e) => jsf.push(e.message));
  await s.route('**/*', (r) => (r.request().url().startsWith(basis) ? r.continue() : r.abort()));
  await s.goto(`${basis}/${ort}/index.html`); await s.waitForTimeout(2800);
  const frei = () => s.evaluate(() => { ['fullscreenGate', 'kcStartupSummary', 'kcPinLockOverlay', 'kcStartkarteOverlay'].forEach((id) => { const e = document.getElementById(id); if (e) e.style.display = 'none'; }); document.querySelectorAll('[data-kc-sperrend]').forEach((e) => { e.style.display = 'none'; }); document.querySelectorAll('dialog[open]').forEach((d) => d.close()); });
  await frei();
  const tag = `${ort} ${groesse.width}×${groesse.height}`;
  const menge = (id) => s.evaluate((id) => state.cart.filter((x) => x.id === id).reduce((a, x) => a + x.qty, 0), id);
  const ids = await s.evaluate(() => { const alle = [...document.querySelectorAll('#productGrid .product-tile[data-id]')].map((x) => x.dataset.id); const mitPlus = alle.find((i) => PRODUCTS.find((q) => q.id === i)?.optionGroup); return { a: alle[0], b: mitPlus || alle[1] }; });
  const fenster = () => s.evaluate(() => { const w = document.getElementById('kcMenge'); if (!w || w.hidden) return null; const r = w.getBoundingClientRect(), bar = document.getElementById('payBtn'); const br = bar && bar.getBoundingClientRect(); const ges = document.querySelector('.cart-area, .cart-panel'); return { name: w.querySelector('.km-name').textContent, top: Math.round(r.top), h: Math.round(r.height), l: Math.round(r.left), w: Math.round(r.width), barFrei: !!br && br.top >= r.bottom, zahl: Math.round(w.querySelector('.km-zahl').getBoundingClientRect().height), plus: !w.querySelector('[data-km="variante"]').hidden, info: !w.querySelector('[data-km="info"]').hidden }; });

  await s.tap(`#productGrid .product-tile[data-id="${ids.a}"]`); await s.waitForTimeout(250);
  let f = await fenster();
  p(`${tag}: Kachel → Artikel mit 1 im Bon, Mengenfenster über dem Warenkorb, BAR frei`, await menge(ids.a) === 1 && !!f && f.barFrei && f.info, JSON.stringify(f));
  p(`${tag}: Mengentasten 1–6 groß (mind. 70 px)`, f && f.zahl >= 70, String(f && f.zahl));
  await s.tap('#kcMenge [data-km-zahl="3"]'); await s.waitForTimeout(150);
  p(`${tag}: „3“ → 3 Stück (ersetzt die 1)`, await menge(ids.a) === 3);
  await s.tap('#kcMenge [data-km-zahl="3"]'); await s.waitForTimeout(150);
  p(`${tag}: nochmal „3“ → 6 (zählt dazu)`, await menge(ids.a) === 6);
  await s.tap('#kcMenge [data-km="minus"]'); await s.tap('#kcMenge [data-km="plus"]'); await s.tap('#kcMenge [data-km="plus"]'); await s.waitForTimeout(150);
  p(`${tag}: − / + korrigieren`, await menge(ids.a) === 7);
  // nächster Artikel, während das Fenster offen ist
  const vorLage = f;
  await s.tap(`#productGrid .product-tile[data-id="${ids.b}"]`); await s.waitForTimeout(250);
  f = await fenster();
  p(`${tag}: nächste Kachel → Fenster wechselt an Ort und Stelle, voriger Artikel bleibt bei 7`, !!f && f.top === vorLage.top && f.h === vorLage.h && f.l === vorLage.l && f.name !== vorLage.name && await menge(ids.a) === 7 && await menge(ids.b) === 1, JSON.stringify([vorLage.name, f && f.name]));
  await s.tap('#kcMenge [data-km-zahl="5"]'); await s.tap('#kcMenge [data-km-zahl="5"]'); await s.waitForTimeout(150);
  p(`${tag}: „5“ + „5“ = 10`, await menge(ids.b) === 10);
  p(`${tag}: blaues + im Fenster bei Artikeln mit Varianten`, await s.evaluate((id) => !!PRODUCTS.find((q) => q.id === id)?.optionGroup, ids.b) ? f.plus : !f.plus);
  // Info
  await s.tap('#kcMenge [data-km="info"]'); await s.waitForTimeout(400);
  p(`${tag}: ⓘ öffnet die Artikelinfo`, await s.evaluate(() => !!document.querySelector('dialog[open]')));
  await s.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
  // derselbe Artikel nochmal angetippt: +1, erste Zahl ersetzt nur dieses +1
  await s.tap(`#productGrid .product-tile[data-id="${ids.a}"]`); await s.waitForTimeout(200);
  await s.tap('#kcMenge [data-km-zahl="2"]'); await s.waitForTimeout(150);
  p(`${tag}: vorhandener Artikel nochmal + „2“ → 7 + 2 = 9`, await menge(ids.a) === 9);
  // ✕
  await s.tap('#kcMenge [data-km="zu"]'); await s.waitForTimeout(150);
  p(`${tag}: rotes ✕ schließt, Bon bleibt`, !(await fenster()) && await menge(ids.a) === 9 && await menge(ids.b) === 10);
  // 25 s
  await s.tap(`#productGrid .product-tile[data-id="${ids.a}"]`); await s.waitForTimeout(200);
  p(`${tag}: wieder offen nach Kachel`, !!(await fenster()));
  await s.waitForTimeout(24000);
  p(`${tag}: nach 24 s noch offen`, !!(await fenster()));
  await s.waitForTimeout(1600);
  p(`${tag}: nach 25 s von selbst zu`, !(await fenster()));
  // Kassieren schließt
  await s.tap(`#productGrid .product-tile[data-id="${ids.a}"]`); await s.waitForTimeout(200);
  await s.evaluate(() => completeSale('cash', { silent: true }).catch(() => {})); await s.waitForTimeout(800);
  p(`${tag}: Kassieren schließt das Fenster`, !(await fenster()));
  // Abschalten unter Mehr
  await frei();
  const schalter = await s.evaluate(() => { const k = document.getElementById('kcMengeSchalter'); return k && k.closest('.more-grid') ? k.textContent : null; });
  p(`${tag}: Schalter „Mengenfenster: AN“ unter Mehr`, /Mengenfenster: AN/.test(schalter || ''), schalter);
  await s.evaluate(() => document.getElementById('kcMengeSchalter').click());
  await frei();
  await s.tap(`#productGrid .product-tile[data-id="${ids.a}"]`); await s.waitForTimeout(250);
  p(`${tag}: ausgeschaltet → kein Fenster, Kachel bucht wie bisher`, !(await fenster()) && /AUS/.test(await s.evaluate(() => document.getElementById('kcMengeSchalter').textContent)) && await menge(ids.a) >= 1);
  await s.evaluate(() => document.getElementById('kcMengeSchalter').click());
  p(`${tag}: keine JS-Fehler`, jsf.length === 0, jsf.join(' | '));
  await s.close();
}
(async () => {
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const basis = `http://127.0.0.1:${srv.address().port}`;
  const b = await chromium.launch();
  await seite(b, basis, 'pos', { width: 1280, height: 800 });
  await seite(b, basis, 'pos', { width: 1024, height: 768 });
  await seite(b, basis, 'schulung/pos', { width: 1280, height: 800 });
  await b.close(); srv.close();
  console.log(fehler ? `Mengenfenster: ${fehler} von ${n} FEHLGESCHLAGEN` : `Mengenfenster: alle ${n} bestanden`);
  process.exit(fehler ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
