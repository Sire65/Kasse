/* Sammelbestellung: Kombi-Karten wie auf der Hauptseite (11.10.2026, Betreiber: "halb das Getränk und halb das
   Essen, die Wurst muss zu sehen sein, aber keine zusätzliche Wurst"). Kasse und Schulung:
   - jede Kombi-Karte schräg geteilt (Getränk oben, Essen unten), kein "+" mehr
   - mit Wurst: Bild "Grünkohl mit Wurst"; ohne Wurst: nur Grünkohl
   - beide Hälften bedecken die ganze Bildfläche (keine graue Ecke) */
const pw = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const s = http.createServer((q, r) => { const p = path.join(W, decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kasse/, '')); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
let f = 0; const pr = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) f++; };
(async () => {
  const PORT = Number(process.env.P || 8974); await new Promise((r) => s.listen(PORT, r)); const b = await pw.chromium.launch();
  try {
    for (const seite of ['pos', 'schulung/pos']) {
      const ctx = await b.newContext({ viewport: { width: 1024, height: 768 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
      const js = []; p.on('pageerror', (e) => js.push(e.message));
      await p.addInitScript(() => { if (!localStorage.getItem('kc_master_v040')) localStorage.setItem('kc_master_v040', JSON.stringify({ registerId: 'KASSE-01', pinLockEnabled: false })); });
      await p.goto(`http://127.0.0.1:${PORT}/Kasse/${seite}/index.html`); await p.waitForTimeout(3500);
      await p.evaluate(() => { const g = document.getElementById('fullscreenGate'); if (g) g.hidden = true; document.querySelectorAll('dialog[open]').forEach((d) => d.close()); });
      await p.evaluate(() => document.querySelector('.cart-title .cart-heading-icon').click()); await p.waitForTimeout(1200);
      const k = await p.evaluate(() => [...document.querySelectorAll('.kc-sammel-spalte[data-sammel-gruppe="Kombi"] .kc-sammel-karte')].map((c) => {
        const box = c.querySelector('.kc-sammel-kombi'); const r = box && box.getBoundingClientRect();
        const o = c.querySelector('img.kc-sk-oben'), u = c.querySelector('img.kc-sk-unten');
        const deckt = (i) => { if (!i || !r) return false; const x = i.getBoundingClientRect(); return x.left <= r.left + 1 && x.top <= r.top + 1 && x.right >= r.right - 1 && x.bottom >= r.bottom - 1; };
        return { name: (c.querySelector('.kc-sammel-kombi-name') || {}).textContent || '', schraeg: !!(box && box.classList.contains('kc-sammel-kombi-schraeg')),
          plus: !!c.querySelector('.kc-sammel-kombi-plus'), oben: o && o.getAttribute('src'), unten: u && u.getAttribute('src'), deckt: deckt(o) && deckt(u),
          clip: o ? getComputedStyle(o).clipPath : '' };
      }));
      pr(`${seite}: vier Kombi-Karten`, k.length === 4, String(k.length));
      pr(`${seite}: alle schräg geteilt, kein "+"`, k.length && k.every((x) => x.schraeg && !x.plus && /polygon/.test(x.clip)), JSON.stringify(k.map((x) => [x.name, x.schraeg, x.plus])));
      pr(`${seite}: Getränk oben (Glühwein bzw. Punsch)`, k.every((x) => /gluehwein_version_3|eierpunsch_version_3/.test(x.oben || '')), k.map((x) => x.oben).join(' | '));
      pr(`${seite}: mit Wurst = Grünkohl mit Wurst, ohne Wurst = Grünkohl`, k.every((x) => (/Wurst/.test(x.name) ? /gruenkohl_wurst_version_3/ : /gruenkohl_version_3/).test(x.unten || '')), k.map((x) => x.name + ' → ' + (x.unten || '').split('/').pop()).join(' | '));
      pr(`${seite}: Bilder bedecken die ganze Fläche`, k.every((x) => x.deckt));
      pr(`${seite}: keine JS-Fehler`, !js.filter((x) => !/fetch|Failed|47391|47392|kc-sync/.test(x)).length, js.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } finally { await b.close(); s.close(); }
  console.log(f ? `\n${f} FEHLER` : '\nAlles OK'); process.exit(f ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
