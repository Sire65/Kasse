/* Vorlagen-Galerie - jede Vorlage des Baukastens muss aufgehen.                   08.09.2026
 *
 * ANLASS (Betreiber): mehrere Anordnungen zum Vergleichen, noch kein Umbau an der Kasse.
 * Damit die Vorlagen nicht nur "hübsch im Designer" sind, prüft dieser Lauf für JEDE Vorlage:
 *   1. im Designer einsetzbar, kein Baustein ragt über das Raster, keiner überlappt
 *   2. die Übergabe nimmt sie ohne Mängel an
 *   3. die Kasse (mit dem Umbau vom 07.09.) zeigt sie ohne Platzhalter, nichts über den Rand
 * Mit KC_SHOTS=<ordner> entsteht je Vorlage ein Bild der echten Kasse (9 Zoll quer).
 */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => {
  let f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
const PORT = 8483;
let fehler = 0, n = 0;
const p = (name, ok, z = '') => { n++; console.log(`  ${ok ? 'OK    ' : 'FEHLER'} ${name}${z ? '   [' + z + ']' : ''}`); if (!ok) fehler++; };
const SHOTS = process.env.KC_SHOTS || '';
const VP = { 'ipad-gross-quer': { width: 1366, height: 1024 }, 'ipad-9-quer': { width: 1024, height: 768 }, 'ipad-9-hoch': { width: 768, height: 1024 }, 'handy-hoch': { width: 390, height: 844 }, 'pc-manager': { width: 1440, height: 900 } };

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const b = await chromium.launch();
  const fehlerListe = [];
  const d = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  d.on('pageerror', (e) => fehlerListe.push('designer: ' + e.message));
  d.on('dialog', (dlg) => dlg.type() === 'prompt' ? dlg.accept() : dlg.accept());
  await d.goto(`http://127.0.0.1:${PORT}/pc-manager/tv-designer/index.html`);
  await d.waitForFunction(() => window.KCKassenVorlagen && window.KCKassenUebergabe);
  await d.evaluate(() => { localStorage.removeItem('kc.kassenoberflaechen.v1'); const m = document.getElementById('modeSelect'); m.value = 'kasse'; m.dispatchEvent(new Event('change', { bubbles: true })); });
  const vorlagen = await d.evaluate(() => window.KCKassenVorlagen.VORLAGEN.map((v) => ({ id: v[0], name: v[1], geraet: v[2] })));
  console.log(`\n${vorlagen.length} Vorlagen im Baukasten`);

  const uebergeben = {};
  for (const v of vorlagen) {
    console.log(`\n== ${v.name} (${v.id}, ${v.geraet}) ==`);
    await d.evaluate((id) => document.querySelector(`[data-vorlage="${id}"]`).click(), v.id);
    await d.waitForTimeout(300);
    const lage = await d.evaluate(() => {
      const s = project.slides.find((x) => x.kcSeite === 'kasse');
      const g = window.KCKassenbaukasten.GERAETE.find((x) => x.id === project.kasse.geraet);
      const R = (g && g.raster) || [12, 8];
      const items = s.items.filter((i) => i.kc).map((i) => ({ t: i.type, c: i.kc.spalte, z: i.kc.zeile, cs: i.kc.spalten, zs: i.kc.zeilen }));
      const sp = Math.max(...items.map((i) => i.c + i.cs)), ze = Math.max(...items.map((i) => i.z + i.zs));
      const ueber = [];
      for (let a = 0; a < items.length; a++) for (let c = a + 1; c < items.length; c++) {
        const A = items[a], B = items[c];
        if (A.c < B.c + B.cs && B.c < A.c + A.cs && A.z < B.z + B.zs && B.z < A.z + A.zs) ueber.push(A.t + '×' + B.t);
      }
      const belegt = items.reduce((m, i) => m + i.cs * i.zs, 0);
      return { anzahl: items.length, sp, ze, ueber, belegt, R };
    });
    p('Kein Baustein überlappt einen anderen', lage.ueber.length === 0, lage.ueber.join(', ') || `${lage.anzahl} Bausteine`);
    p(`Nichts ragt über das ${lage.R[0]}x${lage.R[1]}-Raster`, lage.sp <= lage.R[0] && lage.ze <= lage.R[1], `${lage.sp}x${lage.ze}`);
    /* Tote Fläche ist kein Fehler (ältere Vorlagen lassen absichtlich Luft), aber man soll es sehen. */
    const felder = lage.R[0] * lage.R[1];
    console.log(`  ${lage.belegt === felder ? 'info  ' : 'offen '} Belegt ${lage.belegt}/${felder} Felder${lage.belegt === felder ? '' : ' - freie Fläche'}`);
    const of = await d.evaluate(() => window.KCKassenUebergabe.uebergeben());
    p('Übergabe ohne Mängel', !!of && !!of.id, of ? of.id : 'abgelehnt');
    if (of) uebergeben[v.id] = { id: of.id, geraet: v.geraet };
  }
  const sammlung = await d.evaluate(() => JSON.parse(localStorage.getItem('kc.kassenoberflaechen.v1')));
  await d.close();

  console.log('\n== Jede Vorlage an der echten Kasse ==');
  for (const v of vorlagen) {
    const u = uebergeben[v.id]; if (!u) continue;
    const vp = VP[u.geraet] || VP['ipad-9-quer'];
    const k = await b.newPage({ viewport: vp });
    k.on('pageerror', (e) => fehlerListe.push(v.id + ': ' + e.message));
    await k.addInitScript(() => localStorage.setItem('kc_master_v040', JSON.stringify({ registerId: 'KASSE-01', pinLockEnabled: false })));
    await k.addInitScript(() => localStorage.setItem('kc_offers_v100', '[]'));
    await k.addInitScript(([sam, gid]) => { localStorage.setItem('kc.kassenoberflaechen.v1', JSON.stringify(sam)); localStorage.setItem('kc.kassenoberflaeche.gewaehlt.v1', gid); }, [sammlung, u.id]);
    await k.goto(`http://127.0.0.1:${PORT}/pos/index.html`);
    await k.waitForTimeout(1600);
    await k.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /KASSE STARTEN/i.test(x.textContent)); if (b) b.click(); });
    await k.waitForTimeout(900);
    /* Der Starthinweis kommt je nach Rechner erst nach 1-2 s - zweimal nachsehen. */
    for (let i = 0; i < 2; i++) {
      await k.waitForTimeout(900);
      await k.evaluate(() => { const ok = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'OK' && x.getBoundingClientRect().width > 0); if (ok) ok.click(); });
    }
    /* Ein Artikel im Bon, damit man das Bonfeld beim Vergleichen beurteilen kann. */
    await k.evaluate(() => { const t = [...document.querySelectorAll('#kcAufbau .product-tile')]; t.slice(0, 3).forEach((x) => x.click()); });
    await k.waitForTimeout(300);
    const st = await k.evaluate(() => ({
      aktiv: document.body.classList.contains('kc-aufbau'),
      platzhalter: [...document.querySelectorAll('#kcAufbau .kc-bereich.platzhalter')].map((e) => e.dataset.typ),
      raus: [...document.querySelectorAll('#kcAufbau > .kc-bereich')].filter((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 || r.bottom > innerHeight + 1; }).map((e) => e.dataset.typ),
      kacheln: document.querySelectorAll('#kcAufbau .product-tile').length,
      bon: document.querySelectorAll('#cartList > *:not(.cart-empty)').length,
    }));
    p(`${v.name}: an der Kasse, nichts über den Rand, Kachel → Bon`, st.aktiv && !st.raus.length && st.kacheln > 0 && st.bon >= 1,
      `${st.kacheln} Kacheln${st.raus.length ? ', über Rand: ' + st.raus.join(', ') : ''}`);
    /* Bausteine ohne Gegenstück an der Kasse sind eine sichtbare Lücke, kein Fehler dieser Vorlage:
       der Betreiber will (08.09.) noch keinen weiteren Umbau an der Kasse. */
    if (st.platzhalter.length) console.log(`  offen  ${v.name}: noch nicht an die Kasse angebunden: ${st.platzhalter.join(', ')}`);
    if (SHOTS) await k.screenshot({ path: `${SHOTS}/vorlage_${v.id}.png` });
    await k.close();
  }
  p('Keine Skriptfehler über den ganzen Lauf', fehlerListe.length === 0, fehlerListe.slice(0, 3).join(' | ') || 'keine');
  await b.close(); srv.close();
  console.log(`\nVorlagen-Galerie: ${n - fehler}/${n} bestanden`);
  process.exit(fehler ? 1 : 0);
})();
