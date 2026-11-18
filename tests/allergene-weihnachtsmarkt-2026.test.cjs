/* Allergen-Nachtrag Weihnachtsmarkt 2026 (16.11.2026, Betreiber: "trage auch alles in die Kasse ein und in PC Manager")
   Geprueft in Kasse, Schulungskasse, PC-Manager und Schulungs-PC-Manager - jeweils frisches Geraet und Geraet mit
   altem gespeichertem Stand (Kaub-Block hatte Roter Feger/Apfelpunsch mit "Sulfite enthalten" gespeichert, Gruenkohl
   als Text-Allergen):
   - Roter Feger / Apfelpunsch laut Etikett: KEINE Sulfite, alle 14 "nicht enthalten"
   - Gruenkohl: Gluten (Haferflocken) enthalten, Senf/Sellerie Spuren; Zutat Haferflocken
   - Gruenkohl + Mettwurst: Gluten + Senf enthalten, Sellerie Spuren
   - Kartoffel mit Hering (Heringsstip): Fisch, Ei, Milch, Senf enthalten
   - Mettwurst (Mettendchen): Senf enthalten, Sellerie Spuren
   - Gluehwein rot: Sulfite enthalten, Zusatzstoffe laut Etikett
   - EINMALIG: eine spaetere Aenderung im Manager wird beim naechsten Start nicht zurueckgesetzt
   - Kasse zeigt im Info-Fenster "Glutenhaltiges Getreide: Enthalten" beim Gruenkohl, keine JS-Fehler */
const pw = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
const T = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'};
const s = http.createServer((q, r) => { const p = path.join(W, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, {'Content-Type': T[path.extname(p)] || 'application/octet-stream'}); r.end(d); }); });
let f = 0; const pr = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) f++; };
const ALT = [
  {id: 'roterfeger', name: 'Roter Feger', price: 2.5, category: 'Getränke', info: {ingredients: 'Fruchtsäfte, Glühweingewürz', allergens: {sulphites: 'contained'}, source: 'Händlerangabe Getränke Volz'}},
  {id: 'apfel', name: 'Apfelpunsch', price: 2.5, category: 'Getränke', info: {allergens: {sulphites: 'contained'}}},
  {id: 'gruenkohl', name: 'Grünkohl', price: 5.5, category: 'Speisen', info: {ingredients: 'Grünkohl, Kartoffeln, Zwiebeln, Gewürze', allergens: 'Kann Senf und Sellerie enthalten', important: 'Heiß ausgegeben.'}},
  {id: 'hering', name: 'Kartoffel mit Hering', price: 4.5, category: 'Speisen'},
  {id: 'mettwurst', name: 'Mettwurst', price: 1.5, category: 'Speisen'},
  {id: 'eier', name: 'Eierlikörpunsch', price: 4.5, category: 'Getränke', info: {notes: 'Rezeptur je Ansatz (13.10.2026): 6 l Rebenschoppen halbtrocken + 3 × 0,7 l Advocaat + 3 EL Vanillezucker (≈ 8,1 l); serviert mit Sahnehaube und Backkakao.'}}];
const pruefe = (n, a) => {
  const g = (id) => (a.find((x) => x.id === id) || {}).info || {};
  const rf = g('roterfeger').allergens || {}, ap = g('apfel').allergens || {}, gk = g('gruenkohl'), gm = (g('gruenkohlmett').allergens || null), h = g('hering').allergens || {}, m = g('mettwurst').allergens || {};
  pr(`${n}: Roter Feger + Apfelpunsch ohne Sulfite (Etikett)`, rf.sulphites === 'not-contained' && ap.sulphites === 'not-contained' && rf.eggs === 'not-contained', JSON.stringify(rf).slice(0, 120));
  // 18.11.2026 (zweiter Nachtrag, Rezept + CHEF Gemuesefond): Senf und Sellerie sind im Gruenkohl ENTHALTEN, Schmelzflocken = Hafer
  pr(`${n}: Grünkohl Gluten, Senf, Sellerie enthalten, Schmelzflocken`, gk.allergens?.gluten === 'contained' && gk.allergens?.mustard === 'contained' && gk.allergens?.celery === 'contained' && /Schmelzflocken/.test(gk.ingredients || ''), JSON.stringify(gk.allergens).slice(0, 120));
  if (gm) pr(`${n}: Grünkohl + Mettwurst Gluten und Senf enthalten`, gm.gluten === 'contained' && gm.mustard === 'contained' && gm.celery === 'contained');
  pr(`${n}: Heringsstip Fisch, Ei, Milch, Senf`, h.fish === 'contained' && h.eggs === 'contained' && h.milk === 'contained' && h.mustard === 'contained', JSON.stringify(h));
  pr(`${n}: Heringsstipp-Rezept (Mayonnaise, saure Sahne) und Sulfite als Spur`, h.sulphites === 'traces' && h.gluten === 'not-contained' && /Mayonnaise/.test(g('hering').ingredients || ''));
  const sk = g('sauerkraut');
  if (a.some((x) => x.id === 'sauerkraut')) pr(`${n}: Sauerkraut mit Gluten und Sellerie (Gemüsefond), Kassler im Rezept, Zusatzstoffe`, sk.allergens?.gluten === 'contained' && sk.allergens?.celery === 'contained' && sk.allergens?.mustard === 'traces' && /Kassler/.test(sk.ingredients || '') && /Konservierungsstoff/.test(sk.additives || ''));
  pr(`${n}: Mettendchen Senf enthalten, Sellerie Spuren`, m.mustard === 'contained' && m.celery === 'traces', JSON.stringify(m));
  pr(`${n}: Mettendchen mit Konservierungsstoff und Antioxidationsmittel`, /Konservierungsstoff/.test(g('mettwurst').additives || '') && /Antioxidationsmittel/.test(g('mettwurst').additives || ''));
};
(async () => {
  const PORT = Number(process.env.P || 8991); await new Promise((r) => s.listen(PORT, r)); const b = await pw.chromium.launch();
  try {
    for (const seite of ['pos', 'schulung/pos']) for (const alt of [false, true]) {
      const c = await b.newContext({serviceWorkers: 'block'}); const p = await c.newPage(); const js = []; p.on('pageerror', (e) => js.push(e.message));
      await p.addInitScript((alt) => { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', '1'); localStorage.setItem('kc_master_v040', JSON.stringify({registerId: 'KASSE-01', pinLockEnabled: false}));
        if (alt) localStorage.setItem('kc_products_v050', JSON.stringify(alt)); }, alt ? ALT : null);
      await p.goto(`http://127.0.0.1:${PORT}/${seite}/index.html`); await p.waitForTimeout(3500);
      const n = `${seite} ${alt ? 'alter Stand' : 'frisch'}`;
      pruefe(n, await p.evaluate(() => PRODUCTS));
      if (!alt) { const gr = await p.evaluate(() => (PRODUCTS.find((x) => x.id === 'grot') || {}).info || {});
        pr(`${n}: Glühwein rot Sulfite + Zusatzstoffe laut Etikett`, gr.allergens?.sulphites === 'contained' && /Kaliumsorbat/.test(gr.additives || ''), (gr.additives || '').slice(0, 80)); }
      const info = await p.evaluate(() => { document.querySelectorAll('dialog[open]').forEach((d) => d.close()); openProductInfo('gruenkohl'); return document.getElementById('productInfoContent').innerText.replace(/\s+/g, ' '); });
      pr(`${n}: Info-Fenster Grünkohl zeigt Gluten „Enthalten“`, /Glutenhaltiges Getreide: Enthalten/.test(info) && !/object Object/.test(info), info.slice(0, 160));
      // einmalig: Aenderung danach bleibt
      await p.evaluate(() => { const a = PRODUCTS.find((x) => x.id === 'roterfeger'); a.info.allergens.sulphites = 'traces'; localStorage.setItem('kc_products_v050', JSON.stringify(PRODUCTS)); });
      await p.reload(); await p.waitForTimeout(3000);
      pr(`${n}: Nachtrag läuft nur einmal (spätere Angabe bleibt)`, await p.evaluate(() => PRODUCTS.find((x) => x.id === 'roterfeger').info.allergens.sulphites === 'traces'));
      pr(`${n}: keine JS-Fehler`, !js.filter((x) => !/access control|kc-sync|Load failed|Failed to fetch/.test(x)).length, js.join('|').slice(0, 200));
      await c.close();
    }
    for (const seite of ['pc-manager', 'schulung/pc-manager']) for (const alt of [false, true]) {
      const c = await b.newContext({serviceWorkers: 'block'}); await c.route(/127\.0\.0\.1:4739[12]/, (r) => r.abort());
      const p = await c.newPage(); const js = []; p.on('pageerror', (e) => js.push(e.message));
      await p.addInitScript((alt) => { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', '1');
        if (alt) { localStorage.setItem('kcm_articles', JSON.stringify(alt)); localStorage.setItem('kcm_kaub_angaben_v1', '1'); } }, alt ? ALT : null);
      await p.goto(`http://127.0.0.1:${PORT}/${seite}/index.html`); await p.waitForTimeout(3500);
      const n = `${seite} ${alt ? 'alter Stand' : 'frisch'}`;
      pruefe(n, await p.evaluate(() => articles));
      const gespeichert = await p.evaluate(() => JSON.parse(localStorage.getItem('kcm_articles') || '[]').find((x) => x.id === 'hering')?.info?.allergens?.fish);
      // 18.11.2026: Vanillezucker 150 g (nicht 3 EL) – frisch und auf Geräten mit altem Stand
      const eierNotiz = await p.evaluate(() => (articles.find((x) => x.id === 'eier') || {}).info?.notes || '');
      pr(`${n}: Eierlikörpunsch-Notiz mit 150 g Vanillezucker`, /150 g Vanillezucker/.test(eierNotiz) && !/3 EL Vanillezucker/.test(eierNotiz), eierNotiz.slice(0, 120));
      pr(`${n}: im Manager gespeichert (geht mit dem Stammdaten-Abgleich an die Kassen)`, gespeichert === 'contained', String(gespeichert));
      await p.evaluate(() => { const a = articles.find((x) => x.id === 'mettwurst'); a.info.allergens.celery = 'contained'; localStorage.setItem('kcm_articles', JSON.stringify(articles)); });
      await p.reload(); await p.waitForTimeout(3000);
      pr(`${n}: Nachtrag läuft nur einmal (Pflege im Manager bleibt)`, await p.evaluate(() => articles.find((x) => x.id === 'mettwurst').info.allergens.celery === 'contained'));
      pr(`${n}: keine JS-Fehler`, !js.filter((x) => !/access control|kc-sync|Load failed|Failed to fetch|47391|47392/.test(x)).length, js.join('|').slice(0, 200));
      await c.close();
    }
  } catch (e) { console.log('ABBRUCH:', e && e.stack || e); f++; }
  await b.close(); s.close(); console.log(f ? `\n${f} FEHLER` : '\nAlles OK'); process.exit(f ? 1 : 0);
})();
