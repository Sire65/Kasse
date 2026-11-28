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
  const markiert = () => s.evaluate(() => [...document.querySelectorAll('#kcMenge .km-zahl.km-gewaehlt')].map((x) => x.dataset.kmZahl).join(','));
  p(`${tag}: beim Öffnen ist die 1 farbig markiert, Tür (weiß auf rot, kontrastreich) statt rotem X`, await markiert() === '1' && await s.evaluate(() => { const t = document.querySelector('#kcMenge [data-km="zu"]'); return !!t.querySelector('svg') && getComputedStyle(t).backgroundColor === 'rgb(185, 28, 28)' && getComputedStyle(t).borderTopColor === 'rgb(255, 255, 255)'; }) && await s.evaluate(() => getComputedStyle(document.querySelector('#kcMenge .km-gewaehlt')).backgroundColor) === 'rgb(22, 163, 74)');
  // Symbole i, +, Tür: Grafik genau in der Mitte des Knopfs (unabhängig von der Schrift des Tablets)
  const mitte = await s.evaluate(() => [...document.querySelectorAll('#kcMenge .km-kopf button')].filter((b) => !b.hidden).map((b) => { const r = b.getBoundingClientRect(), g = b.querySelector('svg')?.getBoundingClientRect(); return g ? Math.max(Math.abs(g.left + g.width / 2 - (r.left + r.width / 2)), Math.abs(g.top + g.height / 2 - (r.top + r.height / 2))) : 99; }));
  p(`${tag}: i, + und Tür als Grafik genau mittig (≤ 1 px)`, mitte.length >= 2 && mitte.every((d) => d <= 1), JSON.stringify(mitte));
  // dieselbe Kachel mehrmals: das Fenster zählt mit (Markierung = Menge)
  await s.tap(`#productGrid .product-tile[data-id="${ids.a}"]`); await s.waitForTimeout(150);
  await s.tap(`#productGrid .product-tile[data-id="${ids.a}"]`); await s.waitForTimeout(150);
  p(`${tag}: Kachel 3× angetippt → im Fenster 3, die 3 markiert`, await menge(ids.a) === 3 && await markiert() === '3' && /^3×/.test(await s.evaluate(() => document.querySelector('#kcMenge .km-summe').textContent)), await s.evaluate(() => document.querySelector('#kcMenge .km-summe').textContent));
  await s.tap('#kcMenge [data-km="minus"]'); await s.tap('#kcMenge [data-km="minus"]'); await s.waitForTimeout(150);
  p(`${tag}: zurück auf 1, die 1 markiert`, await menge(ids.a) === 1 && await markiert() === '1');
  await s.evaluate(() => { KCMengenfenster.zu(); }); await s.tap(`#productGrid .product-tile[data-id="${ids.a}"]`); await s.waitForTimeout(150);
  await s.tap('#kcMenge [data-km="minus"]'); await s.waitForTimeout(150);
  p(`${tag}: Fenster neu geöffnet, Menge 1`, await menge(ids.a) === 1 && await markiert() === '1');
  await s.evaluate(() => { state.cart = []; renderCart(); KCMengenfenster.zu(); });
  await s.tap(`#productGrid .product-tile[data-id="${ids.a}"]`); await s.waitForTimeout(200);
  await s.tap('#kcMenge [data-km-zahl="3"]'); await s.waitForTimeout(150);
  p(`${tag}: „3“ → 3 Stück (ersetzt die 1), die 3 ist markiert`, await menge(ids.a) === 3 && await markiert() === '3');
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
  p(`${tag}: „5“ + „5“ = 10, die 5 bleibt markiert`, await menge(ids.b) === 10 && await markiert() === '5');
  p(`${tag}: blaues + im Fenster bei Artikeln mit Varianten`, await s.evaluate((id) => !!PRODUCTS.find((q) => q.id === id)?.optionGroup, ids.b) ? f.plus : !f.plus);
  // Abzeichen „✓ Menge“ auf den Kacheln im Bon, Mülleimer rot
  await s.waitForTimeout(250);
  const abz = (id) => s.evaluate((id) => { const w = document.querySelector(`#productGrid .product-tile[data-id="${id}"]`)?.closest('.product-tile-wrap'); const a = w && w.querySelector('.kc-im-bon'); return a ? a.textContent : null; }, id);
  const andere = await s.evaluate((ids) => [...document.querySelectorAll('#productGrid .product-tile[data-id]')].map((x) => x.dataset.id).find((i) => i !== ids.a && i !== ids.b), ids);
  p(`${tag}: Kacheln im Bon tragen „✓ Menge“, andere nicht`, await abz(ids.a) === '✓ 7' && await abz(ids.b) === '✓ 10' && await abz(andere) === null, JSON.stringify([await abz(ids.a), await abz(ids.b), await abz(andere)]));
  p(`${tag}: Abzeichen fängt keine Berührung ab`, await s.evaluate(() => getComputedStyle(document.querySelector('.kc-im-bon')).pointerEvents) === 'none');
  p(`${tag}: Mülleimer in den Bon-Zeilen rot`, await s.evaluate(() => { const d = document.querySelector('.cart-row .delete-row'); const st = getComputedStyle(d); return /dc2626/.test(st.backgroundImage) && st.fontSize === '0px'; }));
  // alle i-Knöpfe gleich (Ø 40 px, Farbe wie im Roter-Feger-Bild), Meldungs-Pfeil und Bon-Mülleimer als Grafik
  const iKnoepfe = await s.evaluate(() => [...document.querySelectorAll('#productGrid .product-info-button')].map((b) => { const r = b.getBoundingClientRect(), t = b.closest('.product-tile-wrap').getBoundingClientRect(), st = getComputedStyle(b); return [Math.round(r.width), Math.round(r.height), Math.round(r.left - t.left), Math.round(r.top - t.top), st.backgroundColor, st.borderRadius].join('|'); }));
  p(`${tag}: alle i-Knöpfe gleich groß, gleiche Lage und Farbe`, iKnoepfe.length >= 6 && new Set(iKnoepfe).size === 1 && /^40\|40\|/.test(iKnoepfe[0]) && /rgb\(18, 58, 104\)/.test(iKnoepfe[0]), [...new Set(iKnoepfe)].join(' / '));
  p(`${tag}: Meldungs-Pfeil als mittige Grafik, Bon-Mülleimer rot wie in den Zeilen`, await s.evaluate(() => { const m = getComputedStyle(document.getElementById('messageHistoryBtn')), mb = getComputedStyle(document.getElementById('messageHistoryBtn'), '::before'), v = getComputedStyle(document.getElementById('voidBonBtn')); return /svg/.test(m.backgroundImage) && /center/.test(m.backgroundPosition + ' center') && mb.content === 'none' && /dc2626/.test(v.backgroundImage) && v.backgroundColor === 'rgb(254, 242, 242)'; }));
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
  p(`${tag}: Tür schließt, Bon bleibt`, !(await fenster()) && await menge(ids.a) === 9 && await menge(ids.b) === 10);
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
  await s.waitForTimeout(400);
  p(`${tag}: nach dem Kassieren keine Abzeichen mehr`, await s.evaluate(() => document.querySelectorAll('.kc-im-bon').length) === 0);
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
