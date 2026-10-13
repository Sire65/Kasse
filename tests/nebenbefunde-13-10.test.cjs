/* 13.10.2026 (Betreiber: "doppelte Mettwurst loeschen ... Nebenbefunde korrigieren"):
   1. PC-Manager: gespeicherter Doppeleintrag "mett" (3,50 EUR, ohne Nummer) wird geloescht, die richtige Mettwurst
      (mettwurst, 02005) bleibt; ein "mett" MIT eigener Nummer wuerde nicht angefasst.
   2. Kasse/Schulung: ein geparkter Bon, der ueber P -> 🗑 -> WIRKLICH? verworfen wird, steht im Storno-Protokoll
      (kc_voids_v040, Grund parked-cart-discarded, mit Positionen) - wie das Verwerfen eines offenen Bons. */
const pw = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
const T = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'};
const s = http.createServer((q, r) => { const p = path.join(W, decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kasse/, '')); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, {'Content-Type': T[path.extname(p)] || 'application/octet-stream'}); r.end(d); }); });
let f = 0; const pr = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) f++; };
(async () => {
  const PORT = Number(process.env.P || 8978); await new Promise((r) => s.listen(PORT, r)); const b = await pw.chromium.launch();
  try {
    for (const seite of ['pc-manager', 'schulung/pc-manager']) for (const mitNummer of [false, true]) {
      const ctx = await b.newContext({serviceWorkers: 'block'}); await ctx.route(/127\.0\.0\.1:4739/, (r) => r.abort());
      const p = await ctx.newPage();
      await p.goto(`http://127.0.0.1:${PORT}/Kasse/${seite}/index.html`); await p.waitForTimeout(2500);
      // gespeicherten Altbestand nachstellen und neu laden
      await p.evaluate((mitNummer) => { const a = JSON.parse(localStorage.getItem('kcm_articles') || 'null') || articles;
        a.push({id: 'mett', name: 'Mettwurst', category: 'Speisen', price: 3.5, active: false, barcode: mitNummer ? '02099' : ''}); localStorage.setItem('kcm_articles', JSON.stringify(a)); }, mitNummer);
      await p.reload(); await p.waitForTimeout(2500);
      const r = await p.evaluate(() => ({mett: articles.some((x) => x.id === 'mett'), richtig: articles.find((x) => x.id === 'mettwurst')?.barcode,
        gespeichert: (JSON.parse(localStorage.getItem('kcm_articles') || '[]')).some((x) => x.id === 'mett')}));
      if (!mitNummer) pr(`${seite}: doppelte Mettwurst gelöscht (auch gespeichert), Mettwurst 02005 bleibt`, !r.mett && !r.gespeichert && r.richtig === '02005', JSON.stringify(r));
      else pr(`${seite}: ein "mett" mit eigener Nummer wird nicht gelöscht`, r.mett, JSON.stringify(r));
      await ctx.close();
    }
    for (const seite of ['pos', 'schulung/pos']) {
      const ctx = await b.newContext({viewport: {width: 1024, height: 768}, serviceWorkers: 'block'}); const p = await ctx.newPage();
      const js = []; p.on('pageerror', (e) => js.push(e.message));
      await p.addInitScript(() => { if (!localStorage.getItem('kc_master_v040')) localStorage.setItem('kc_master_v040', JSON.stringify({registerId: 'KASSE-01', pinLockEnabled: false})); });
      await p.goto(`http://127.0.0.1:${PORT}/Kasse/${seite}/index.html`); await p.waitForTimeout(3500);
      await p.evaluate(() => { const g = document.getElementById('fullscreenGate'); if (g) g.hidden = true; document.querySelectorAll('dialog[open]').forEach((d) => d.close()); localStorage.removeItem('kc_voids_v040'); });
      const vorher = await p.evaluate(() => { state.cart = []; addConfiguredProduct(PRODUCTS.find((x) => x.id === 'grot'), null); renderCart(); return window.KCOberflaechenAnwenden ? 1 : 0; });
      // parken über das P im Warenkorb
      const geparkt = await p.evaluate(() => { const k = document.querySelector('.kc-park-knopf, [data-kc-park], .kc-bereich.bon .kc-park'); if (k) { k.click(); return 'knopf'; } return 'kein'; });
      await p.waitForTimeout(400);
      const lager = await p.evaluate(() => Object.keys(localStorage).filter((k) => /park/i.test(k)).map((k) => [k, (JSON.parse(localStorage.getItem(k) || '[]') || []).length]));
      // Park-Seite öffnen und zweimal 🗑
      await p.evaluate(() => { const k = document.querySelector('.kc-park-knopf, [data-kc-park], .kc-bereich.bon .kc-park'); if (k) k.click(); });
      await p.waitForTimeout(400);
      const weg = await p.evaluate(async () => { const t = document.querySelector('button[data-park][data-was="verwerfen"]'); if (!t) return 'kein 🗑'; t.click(); await new Promise((r) => setTimeout(r, 200));
        const t2 = document.querySelector('button[data-park][data-was="verwerfen"]'); if (t2) t2.click(); await new Promise((r) => setTimeout(r, 600)); return 'ok'; });
      const log = await p.evaluate(() => JSON.parse(localStorage.getItem('kc_voids_v040') || '[]'));
      const e = log[log.length - 1];
      pr(`${seite}: verworfener geparkter Bon steht im Storno-Protokoll`, weg === 'ok' && !!e && e.reason === 'parked-cart-discarded' && Array.isArray(e.items) && e.items.some((x) => /Glühwein rot/.test(x.name || '')) && e.registerId === 'KASSE-01',
        `${geparkt} ${JSON.stringify(lager)} ${weg} ${JSON.stringify(e || {}).slice(0, 160)}`);
      pr(`${seite}: keine JS-Fehler`, !js.filter((x) => !/fetch|Failed|47391|47392|kc-sync/.test(x)).length, js.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } finally { await b.close(); s.close(); }
  console.log(f ? `\n${f} FEHLER` : '\nAlles OK'); process.exit(f ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
