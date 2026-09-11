/* Bau-Schritt: alle Vorlagen des Designers als pos/kc-oberflaechen-vorlagen.json ablegen.  08.09.2026
   Die Kasse liest die Datei beim Start und bietet die Vorlagen im Mehr-Fenster an (Betreiber:
   "damit man an der Kasse wechseln kann"). Nach jeder Änderung an den Vorlagen neu ausführen:
     node tests/vorlagen-export.cjs */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const srv = http.createServer((q, r) => { let f = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
(async () => {
  await new Promise((r) => srv.listen(8499, r));
  const b = await chromium.launch(); const d = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  d.on('dialog', (x) => x.accept());
  await d.goto('http://127.0.0.1:8499/pc-manager/tv-designer/index.html');
  await d.waitForFunction(() => window.KCKassenVorlagen && window.KCKassenUebergabe);
  await d.evaluate(() => { localStorage.removeItem('kc.kassenoberflaechen.v1'); const m = document.getElementById('modeSelect'); m.value = 'kasse'; m.dispatchEvent(new Event('change', { bubbles: true })); });
  const ids = await d.evaluate(() => window.KCKassenVorlagen.VORLAGEN.map((v) => v[0]));
  let n = 0;
  for (const id of ids) {
    await d.evaluate((v) => document.querySelector(`[data-vorlage="${v}"]`).click(), id);
    await d.waitForTimeout(150);
    /* Die Übergabe vergibt eigene IDs; für die Kasse soll die Vorlagen-ID stehen, damit ein
       Neubau dieselbe Oberfläche ersetzt statt sie zu verdoppeln. */
    const of = await d.evaluate((v) => { const o = window.KCKassenUebergabe.uebergeben(); if (!o) return null; const s = JSON.parse(localStorage.getItem('kc.kassenoberflaechen.v1')); const e = s.oberflaechen.find((x) => x.id === o.id); e.id = 'vorlage-' + v; e.name = window.KCKassenVorlagen.VORLAGEN.find((x) => x[0] === v)[1]; localStorage.setItem('kc.kassenoberflaechen.v1', JSON.stringify(s)); return e.id; }, id);
    if (of) n++; else console.log('ABGELEHNT:', id);
  }
  const sam = await d.evaluate(() => JSON.parse(localStorage.getItem('kc.kassenoberflaechen.v1')));
  sam.hinweis = 'Automatisch aus den Designer-Vorlagen erzeugt (tests/vorlagen-export.cjs). Nicht von Hand ändern.';
  fs.writeFileSync(path.join(root, 'pos', 'kc-oberflaechen-vorlagen.json'), JSON.stringify(sam, null, 1));
  console.log(`${n}/${ids.length} Vorlagen nach pos/kc-oberflaechen-vorlagen.json geschrieben`);
  await b.close(); srv.close();
})();
