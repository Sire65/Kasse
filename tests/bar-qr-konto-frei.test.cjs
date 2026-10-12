/* KC-KASSE-BAR-QR-FREI (12.10.2026, Betreiber: "In der Rückgeld-Funktion gibt es auch KONTO. Der Button war
   von einem QR-Code überdeckt, so konnte ich ihn nicht drücken. Daneben wird BEHALTEN als Trinkgeld angezeigt,
   dadurch verschiebt sich was"). Kasse und Schulung, viele Bildschirmgrößen (iPad quer/hoch, niedrige Höhe):
   - Minus-Bon (Pfandrückgabe) und normaler Bon, Hauptseite und Zahlen-Seite
   - der QR-Code liegt vollständig INNERHALB von BAR und ist quadratisch (lesbar)
   - KONTO und BEHALTEN sind an jeder Stelle antippbar (nichts liegt darüber)
   - PERSONAL bleibt beschriftet und fragt nach Abschluss des Minus-Bons wieder nach Personalverbrauch */
const pw = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const s = http.createServer((q, r) => { const p = path.join(W, decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kasse/, '')); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
let f = 0; const pr = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) f++; };
const ANSICHTEN = process.env.NUR ? [[1024, 768]] : [[1024, 768], [1024, 700], [1180, 820], [768, 1024], [962, 601]];
(async () => {
  const PORT = Number(process.env.P || 8976); await new Promise((r) => s.listen(PORT, r)); const b = await pw.chromium.launch();
  try {
    for (const seite of ['pos', 'schulung/pos']) for (const [w, h] of ANSICHTEN) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' }); const p = await ctx.newPage();
      const js = []; p.on('pageerror', (e) => js.push(e.message));
      await p.addInitScript(() => { if (!localStorage.getItem('kc_master_v040')) localStorage.setItem('kc_master_v040', JSON.stringify({ registerId: 'KASSE-01', pinLockEnabled: false })); });
      await p.goto(`http://127.0.0.1:${PORT}/Kasse/${seite}/index.html`); await p.waitForTimeout(3500);
      await p.evaluate(() => { const g = document.getElementById('fullscreenGate'); if (g) g.hidden = true; document.querySelectorAll('dialog[open]').forEach((d) => d.close());
        [...document.querySelectorAll('body *')].filter((e) => /Startklar-Prüfung öffnen/.test(e.textContent) && getComputedStyle(e).position === 'fixed').forEach((e) => { e.style.display = 'none'; }); });
      const messen = () => p.evaluate(() => {
        const frei = (id) => { const k = document.getElementById(id); if (!k) return 'fehlt'; const r = k.getBoundingClientRect(); if (!r.width) return 'unsichtbar';
          return [0.08, 0.3, 0.5, 0.7, 0.92].every((fx) => [0.2, 0.5, 0.8].every((fy) => { const e = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy); return e && k.contains(e); })) ? 'frei' : 'VERDECKT'; };
        const pb = document.getElementById('payBtn').getBoundingClientRect(), q = document.getElementById('checkoutQrMini').getBoundingClientRect();
        return { innen: q.left >= pb.left - 0.5 && q.right <= pb.right + 0.5 && q.top >= pb.top - 0.5 && q.bottom <= pb.bottom + 0.5, quadrat: Math.abs(q.width - q.height) <= 1 && q.width >= 50,
          qr: [Math.round(q.width), Math.round(q.height)], konto: frei('accountChargeBtn'), behalten: frei('keepAsTipBtn') };
      });
      const tag = `${seite} ${w}x${h}`;
      for (const [fall, fuellen] of [['Minus-Bon', () => { state.cart = []; for (let i = 0; i < 6; i++) addConfiguredProduct(PRODUCTS.find((x) => x.id === 'glasminus'), null); renderCart(); }],
        ['normaler Bon', () => { state.cart = []; for (let i = 0; i < 3; i++) addConfiguredProduct(PRODUCTS.find((x) => /Glühwein/.test(x.name) && x.price > 0), null); renderCart(); }]]) {
        await p.evaluate(fuellen); await p.waitForTimeout(300);
        const m = await messen();
        pr(`${tag} ${fall} Hauptseite: QR in BAR, quadratisch, KONTO frei${fall === 'Minus-Bon' ? ', BEHALTEN frei' : ''}`,
          m.innen && m.quadrat && m.konto === 'frei' && (fall !== 'Minus-Bon' || m.behalten === 'frei'), JSON.stringify(m));
        await p.evaluate(() => [...document.querySelectorAll('button')].find((k) => /RÜCKGELD/.test(k.textContent) && k.getBoundingClientRect().width).click()); await p.waitForTimeout(300);
        const z = await messen();
        pr(`${tag} ${fall} Zahlen-Seite: QR in BAR, quadratisch, KONTO frei`, z.innen && z.quadrat && z.konto === 'frei', JSON.stringify(z));
        await p.evaluate(() => document.getElementById('kcZahlenZurueckTaste')?.click()); await p.waitForTimeout(300);
      }
      if (w === 1024 && h === 768) {
        // Minus-Bon über BAR auszahlen -> PERSONAL ist danach wieder Personalverbrauch
        await p.evaluate(() => { state.cart = []; addConfiguredProduct(PRODUCTS.find((x) => x.id === 'glasminus'), null); renderCart(); }); await p.waitForTimeout(200);
        await p.click('#staffBtn', { force: true }); await p.waitForTimeout(200);
        const vorher = await p.evaluate(() => document.getElementById('confirmTitle').textContent);
        await p.evaluate(() => document.getElementById('confirmDialog').close());
        await p.click('#payBtn', { force: true }); await p.waitForTimeout(1200); await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
        await p.evaluate(() => { addConfiguredProduct(PRODUCTS.find((x) => /Glühwein/.test(x.name) && x.price > 0), null); renderCart(); }); await p.waitForTimeout(200);
        await p.click('#staffBtn', { force: true }); await p.waitForTimeout(200);
        const nachher = await p.evaluate(() => ({ titel: document.getElementById('confirmTitle').textContent, text: document.getElementById('staffBtn').textContent }));
        await p.evaluate(() => document.getElementById('confirmDialog').close());
        pr(`${seite}: PERSONAL bei Minus-Bon fragt nach Spende, danach wieder Personalverbrauch`, /Spende/.test(vorher) && /Personalverbrauch/.test(nachher.titel) && /PERSONAL/.test(nachher.text), `${vorher} → ${nachher.titel} | Knopf: ${nachher.text}`);
      }
      pr(`${tag}: keine JS-Fehler`, !js.filter((x) => !/fetch|Failed|47391|47392|kc-sync/.test(x)).length, js.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } finally { await b.close(); s.close(); }
  console.log(f ? `\n${f} FEHLER` : '\nAlles OK'); process.exit(f ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
