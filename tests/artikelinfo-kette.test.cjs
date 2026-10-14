/* 14.10.2026 (Betreiber: "Sind jetzt die Daten drin, alle und vollstaendig, und werden bei der naechsten Kassenanmeldung
   uebernommen?"). Kette PC-Manager -> Stammdaten senden -> Kasse:
   - Kaub-Getraenke und Eierlikoerpunsch kommen mit Zutaten und Allergenen an der Kasse an.
   - Fuehrt der Manager zu einem Artikel GAR KEINE Information, behaelt die Kasse ihre bekannten Angaben
     (Feuerzangenbowle Sulfite, Gruenkohl Senf/Sellerie) statt sie zu verlieren. Kasse und Schulung. */
const pw = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
const T = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'};
const s = http.createServer((q, r) => { const p = path.join(W, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, {'Content-Type': T[path.extname(p)] || 'application/octet-stream'}); r.end(d); }); });
let f = 0; const pr = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) f++; };
(async () => {
  const PORT = Number(process.env.P || 8988); await new Promise((r) => s.listen(PORT, r)); const b = await pw.chromium.launch();
  try {
    const mc = await b.newContext({serviceWorkers: 'block'}); let push = null;
    await mc.route(/127\.0\.0\.1:4739[12]/, (r) => r.abort());
    await mc.route(/127\.0\.0\.1:47392\/master-data\/push/, (r) => { push = JSON.parse(r.request().postData()); r.fulfill({status: 200, contentType: 'application/json', body: '{"revision":9}'}); });
    const m = await mc.newPage(); await m.goto(`http://127.0.0.1:${PORT}/pc-manager/index.html`); await m.waitForTimeout(2500);
    await m.evaluate(() => { ['kcm_kaub_angaben_v1', 'kcm_eierpunsch_angaben_v1'].forEach((k) => localStorage.removeItem(k)); const a = JSON.parse(JSON.stringify(articles)); a.forEach((x) => { if (['grot', 'gweiss', 'roterfeger', 'apfel', 'eier'].includes(x.id)) delete x.info; }); localStorage.setItem('kcm_articles', JSON.stringify(a)); });
    await m.reload(); await m.waitForTimeout(2500);
    await m.evaluate(() => { window.requireAuth = (fn) => fn(); document.getElementById('masterDataPushBtn')?.click(); }); await m.waitForTimeout(1500);
    pr('Manager sendet Stammdaten mit Artikelinformationen', !!push && push.articles.length > 10);
    for (const seite of ['pos', 'schulung/pos']) {
      const kc = await b.newContext({serviceWorkers: 'block', viewport: {width: 1024, height: 768}});
      await kc.route(/\/kc-sync-master-data(\?|$)/, (r) => r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(Object.assign({vorhanden: true, revision: 9}, push || {}))}));
      const k = await kc.newPage(); await k.addInitScript(() => localStorage.setItem('kc_master_v040', JSON.stringify({registerId: 'KASSE-01', pinLockEnabled: false})));
      await k.goto(`http://127.0.0.1:${PORT}/${seite}/index.html`); await k.waitForTimeout(4500);
      const r = await k.evaluate(() => Object.fromEntries(['grot', 'gweiss', 'roterfeger', 'apfel', 'eier', 'feuer', 'gruenkohlmett'].map((id) => { const i = PRODUCTS.find((x) => x.id === id)?.info || {}; return [id, {z: i.ingredients || '', a: window.KCAllergene.alsText(i.allergens) || i.legacyAllergens || ''}]; })));
      pr(`${seite}: Kaub-Getränke mit Zutaten und Sulfiten`, ['grot', 'gweiss', 'roterfeger', 'apfel'].every((id) => r[id].z && /Sulfite/.test(r[id].a)), JSON.stringify(r.apfel));
      pr(`${seite}: Eierlikörpunsch mit Eier, Milch, Sulfite`, /Eier/.test(r.eier.a) && /Milch/.test(r.eier.a) && /Sulfite/.test(r.eier.a) && /Advocaat/.test(r.eier.z));
      pr(`${seite}: Manager ohne Angabe -> Kasse behält ihre Angaben (Feuerzangenbowle, Grünkohl)`, /Sulfite/.test(r.feuer.a) && /Senf/.test(r.gruenkohlmett.a), JSON.stringify([r.feuer, r.gruenkohlmett]).slice(0, 160));
      await kc.close();
    }
  } finally { await b.close(); s.close(); }
  console.log(f ? `\n${f} FEHLER` : '\nAlles OK'); process.exit(f ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
