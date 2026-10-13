/* KC-ARTIKELINFO-KAUB (13.10.2026): belegte Kaub-Angaben in den Artikeldaten (PC-Manager fuehrend, Kasse uebernimmt).
   - Manager: einmalig Hersteller, Kaub-Artikel, Zutaten (nur wenn leer), Allergen Sulfite, Hinweis auf fehlende
     Zusatzstoffe/Naehrwerte; gepflegte Felder werden NICHT ueberschrieben; unbelegtes "Kirschsaft" beim Roten Feger ersetzt.
   - Zusatzstoffe/Naehrwerte werden nicht erfunden (bleiben leer bzw. wie gepflegt).
   - Kasse und Schulung: Grundausstattung mit denselben belegten Angaben, Kesselschild zeigt beim Apfelpunsch Sulfite. */
const pw = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
const T = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'};
const s = http.createServer((q, r) => { const p = path.join(W, decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kasse/, '')); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, {'Content-Type': T[path.extname(p)] || 'application/octet-stream'}); r.end(d); }); });
let f = 0; const pr = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) f++; };
(async () => {
  const PORT = Number(process.env.P || 8985); await new Promise((r) => s.listen(PORT, r)); const b = await pw.chromium.launch();
  try {
    for (const seite of ['pc-manager', 'schulung/pc-manager']) {
      const ctx = await b.newContext({serviceWorkers: 'block'}); await ctx.route(/127\.0\.0\.1:4739/, (r) => r.abort());
      const p = await ctx.newPage();
      await p.goto(`http://127.0.0.1:${PORT}/Kasse/${seite}/index.html`); await p.waitForTimeout(2500);
      // gespeicherten Stand wie auf einem Manager-PC nachstellen: alte Angaben + ein vom Verein gepflegtes Feld
      await p.evaluate(() => { localStorage.removeItem('kcm_kaub_angaben_v1');
        const a = JSON.parse(JSON.stringify(articles));
        const g = a.find((x) => x.id === 'grot'); g.info = {allergens: 'Enthält Sulfite'};
        const r = a.find((x) => x.id === 'roterfeger'); r.info = {ingredients: 'Kirschsaft, Gewürze, Zucker'};
        const ap = a.find((x) => x.id === 'apfel'); ap.info = {ingredients: 'Vom Verein gepflegt', additives: 'Vom Verein gepflegt', nutrition: {energyKcal: 50}};
        localStorage.setItem('kcm_articles', JSON.stringify(a)); });
      await p.reload(); await p.waitForTimeout(2500);
      const r = await p.evaluate(() => Object.fromEntries(['grot', 'gweiss', 'roterfeger', 'apfel'].map((id) => [id, articles.find((x) => x.id === id)?.info || {}])));
      pr(`${seite}: Glühwein rot – Hersteller Kaub, Luana, Sulfite, alter Allergentext erhalten`, /Kaub/.test(r.grot.manufacturer) && /7104/.test(r.grot.supplier) && r.grot.allergens?.sulphites === 'contained' && r.grot.legacyAllergens === 'Enthält Sulfite', JSON.stringify(r.grot).slice(0, 200));
      pr(`${seite}: Glühwein weiß – 7301, Weißwein, Sulfite`, /7301/.test(r.gweiss.supplier) && /Weißwein/.test(r.gweiss.ingredients) && r.gweiss.allergens?.sulphites === 'contained');
      pr(`${seite}: Roter Feger – unbelegtes "Kirschsaft" ersetzt, Sulfite, alkoholfrei`, !/Kirschsaft/.test(r.roterfeger.ingredients) && /Fruchtsäfte/.test(r.roterfeger.ingredients) && r.roterfeger.allergens?.sulphites === 'contained' && /0 % vol/.test(r.roterfeger.important || ''));
      pr(`${seite}: Apfelpunsch – gepflegte Felder bleiben, Kaub-Angaben ergänzt`, r.apfel.ingredients === 'Vom Verein gepflegt' && r.apfel.additives === 'Vom Verein gepflegt' && r.apfel.nutrition?.energyKcal === 50 && /7602/.test(r.apfel.supplier));
      pr(`${seite}: Zusatzstoffe/Nährwerte nicht erfunden, Hinweis auf Anfrage bei Kaub`, !r.grot.additives && Object.values(r.grot.nutrition || {}).every((v) => v == null) && /info@gluehweine\.com/.test(r.grot.notes || ''));
      pr(`${seite}: Kurzbeschreibung ist eine Beschreibung, nicht der Hinweistext`, r.grot.shortDescription === 'Heißer roter Glühwein' && r.roterfeger.shortDescription === 'Alkoholfreier Früchtepunsch mit Glühweingewürz', r.grot.shortDescription);
      const e = await p.evaluate(() => { localStorage.removeItem('kcm_eierpunsch_angaben_v1'); const a = JSON.parse(JSON.stringify(articles)); a.find((x) => x.id === 'eier').info = {}; localStorage.setItem('kcm_articles', JSON.stringify(a)); });
      await p.reload(); await p.waitForTimeout(2500);
      const ei = await p.evaluate(() => articles.find((x) => x.id === 'eier')?.info || {});
      pr(`${seite}: Eierlikörpunsch – Rezeptur-Zutaten (halbtrocken, Sahne, Backkakao), Allergene Eier + Sulfite + Milch, Rezeptur in der Notiz`, /Rebenschoppen/.test(ei.ingredients) && /Advocaat/.test(ei.ingredients) && /Vanillezucker/.test(ei.ingredients)
        && /halbtrocken/.test(ei.ingredients) && /Backkakao/.test(ei.ingredients) && ei.allergens?.eggs === 'contained' && ei.allergens?.sulphites === 'contained' && ei.allergens?.milk === 'contained' && /3 × 0,7 l Advocaat/.test(ei.notes || '') && /Sahnehaube/.test(ei.shortDescription) && !ei.additives, JSON.stringify(ei).slice(0, 160));
      await ctx.close();
    }
    const quelle = fs.readFileSync(path.join(W, 'pos', 'app.js'), 'utf8');
    pr('Kasse: Grundausstattung ohne unbelegtes "Kirschsaft", Apfelpunsch mit Kaub-Angaben', !/Kirschsaft/.test(quelle) && /Kaub 7602/.test(quelle) && quelle === quelle && fs.readFileSync(path.join(W, 'schulung', 'pos', 'app.js'), 'utf8').includes('Kaub 7602'));
    const {execFileSync} = require('child_process');
    execFileSync(process.execPath, [path.join(W, 'werkzeuge', 'etiketten', 'kesselschild.cjs'), 'apfel', '--probe'], {stdio: 'pipe', env: process.env});
    const html = fs.readFileSync(path.join(require('os').tmpdir(), 'kc-kesselschild', 'Kesselschild_Probe_apfel.html'), 'utf8');
    execFileSync(process.execPath, [path.join(W, 'werkzeuge', 'etiketten', 'kesselschild.cjs'), 'eier', '--probe'], {stdio: 'pipe', env: process.env});
    const eh = fs.readFileSync(path.join(require('os').tmpdir(), 'kc-kesselschild', 'Kesselschild_Probe_eier.html'), 'utf8');
    pr('Kesselschild Eierlikörpunsch: Allergene Eier, Milch und Sulfite, 6,50 € inkl. Pfand', (() => { const z = (eh.match(/Allergene:<\/b> ([^<]*)/) || [])[1] || ''; return /Eier/.test(z) && /Milch/.test(z) && /Sulfite/.test(z); })() && eh.includes('6,50\u00a0€'));
    pr('Kesselschild Apfelpunsch: Sulfite als Allergen, Zusatzstoffe rot "nicht erfasst"', /Allergene:<\/b> Schwefeldioxid \/ Sulfite/.test(html) && /Zusatzstoffe:<\/b> <span class="fehlt">/.test(html));
  } finally { await b.close(); s.close(); }
  console.log(f ? `\n${f} FEHLER` : '\nAlles OK'); process.exit(f ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
