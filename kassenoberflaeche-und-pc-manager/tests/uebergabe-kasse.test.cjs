/* Die Übergabe vom Baukasten an die Kasse - im echten Browser, über beide Seiten.
 *
 * ANLASS 03.09.2026 (Betreiber): "Wenn das alles fertig ist, muss die Übergabe an das
 * Kassensystem gebaut werden, und so flexibel, dass jederzeit weitere dazukommen können."
 *
 * Geprüft wird die ganze Kette: Der Baukasten gibt aus, die Ablage trägt es, die Kasse liest
 * es, prüft es, listet es auf und schaltet um. Und zwei Regeln, die nicht verhandelbar sind:
 * im Aufbau stehen KEINE Pixel und KEINE Artikeldaten.
 */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const WURZEL = path.resolve(__dirname, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
let ok = 0; const fehler = [];
const p = (name, bed, detail = '') => {
  if (bed) { ok++; console.log(`  OK    ${name}${detail ? '   [' + detail + ']' : ''}`); }
  else { fehler.push(name); console.log(`  FEHLER ${name}${detail ? '   [' + detail + ']' : ''}`); }
};

(async () => {
  const web = http.createServer((q, r) => {
    const f = path.join(WURZEL, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(f, (e, d) => {
      if (e) { r.writeHead(404); return r.end('x'); }
      r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' });
      r.end(d);
    });
  });
  await new Promise((r) => web.listen(0, '127.0.0.1', r));
  const port = web.address().port;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1720, height: 1200 } });
  const pg = await ctx.newPage();
  const skriptfehler = [];
  pg.on('pageerror', (e) => skriptfehler.push(e.message.slice(0, 140)));
  let name = 0;
  pg.on('dialog', (d) => d.accept(d.type() === 'prompt' ? `Oberfläche ${++name}` : undefined));

  console.log('== Der Baukasten gibt aus ==');
  await pg.goto(`http://127.0.0.1:${port}/pc-manager/tv-designer/index.html`);
  await pg.waitForTimeout(5500);
  p('Das Übergabeformat liegt in shared/ – eine Datei für beide Seiten',
    await pg.evaluate(() => window.KCOberflaechenFormat?.FORMAT === 'kc-kassenoberflaechen'));
  await pg.evaluate(() => { const m = document.getElementById('modeSelect'); m.value = 'kasse'; m.dispatchEvent(new Event('change', { bubbles: true })); });
  await pg.waitForTimeout(1000);
  await pg.evaluate(() => { try { localStorage.removeItem('kc.kassenoberflaechen.v1'); } catch (e) {} });
  p('Die Übergabe ist im Kassenmodus zu sehen',
    await pg.evaluate(() => Boolean(document.getElementById('kcUebergabe')) && !document.getElementById('kcUebergabe').hidden));

  /* Zwei verschiedene Geräte - das ist der Kern von "mehrere hinterlegen". */
  for (const vl of ['vl-9quer', 'vl-handy']) {
    await pg.evaluate((v) => document.querySelector(`[data-vorlage="${v}"]`).click(), vl);
    await pg.waitForTimeout(1300);
    await pg.evaluate(() => document.querySelector('[data-kc-ueb="geben"]').click());
    await pg.waitForTimeout(900);
  }
  const s = await pg.evaluate(() => window.KCKassenUebergabe.sammlung());
  p('Mehrere Oberflächen liegen nebeneinander in einer Sammlung', s.oberflaechen.length === 2,
    s.oberflaechen.map((o) => `${o.name} (${o.geraet})`).join(' · '));
  p('Jede bringt ihr eigenes Gerät und Raster mit',
    s.oberflaechen[0].raster.spalten === 12 && s.oberflaechen[1].raster.spalten === 6,
    s.oberflaechen.map((o) => `${o.geraet} ${o.raster.spalten}×${o.raster.zeilen}`).join(' · '));
  p('Jede hat Kassenseite und Zahlenseite',
    s.oberflaechen.every((o) => o.seiten.length === 2 && o.seiten[0].art === 'kasse'));
  const text = JSON.stringify(s);
  /* Die zwei nicht verhandelbaren Regeln. */
  p('Im Aufbau stehen keine Pixel, nur Rasterplätze', !/"x":|"y":|"w":|"h":/.test(text));
  p('Und kein einziger Artikel', !/Glühwein|Grünkohl|webp|5,50/.test(text), `${text.length} Zeichen`);
  p('Die Sammlung ist ohne Beanstandung',
    (await pg.evaluate(() => window.KCOberflaechenFormat.pruefeSammlung(window.KCKassenUebergabe.sammlung()).maengel)).length === 0);

  /* Eine übergebene Oberfläche muss zum Weiterbauen zurückkommen - sonst wäre die Übergabe
     eine Einbahnstraße und jede Änderung ein Neubau. */
  const ersteId = s.oberflaechen[0].id;
  await pg.evaluate(() => document.querySelector('[data-vorlage="vl-heute"]').click());
  await pg.waitForTimeout(1200);
  await pg.evaluate((i) => window.KCKassenUebergabe.zurueckholen(i), ersteId);
  await pg.waitForTimeout(1300);
  const zurueck = await pg.evaluate(() => ({
    geraet: project.kasse.geraet,
    felder: project.slides.filter((x) => x.kcSeite).reduce((n, x) => n + x.items.length, 0),
  }));
  p('Eine übergebene Oberfläche lässt sich zum Weiterbauen zurückholen',
    zurueck.geraet === s.oberflaechen[0].geraet
    && zurueck.felder === s.oberflaechen[0].seiten.reduce((n, se) => n + se.bausteine.length, 0),
    `${zurueck.geraet} · ${zurueck.felder} Felder`);

  console.log('\n== Die Kasse nimmt an ==');
  const kasse = await ctx.newPage();
  kasse.on('pageerror', (e) => skriptfehler.push('Kasse: ' + e.message.slice(0, 120)));
  /* Eine schlanke Seite mit denselben Bereichen wie die Kasse - hier geht es um die Übergabe,
     nicht um die ganze Kasse. Die Bereichsnamen sind die am 03.09. gemessenen. */
  await kasse.goto(`http://127.0.0.1:${port}/tests/uebergabe-kassenseite.html`);
  await kasse.waitForTimeout(900);
  await kasse.evaluate((daten) => { localStorage.setItem('kc.kassenoberflaechen.v1', JSON.stringify(daten)); }, s);
  await kasse.reload();
  await kasse.waitForTimeout(900);
  p('Die Kasse liest die Sammlung des Baukastens',
    (await kasse.evaluate(() => window.KCOberflaechen.liste().length)) === 2);
  const inKasse = await kasse.evaluate(() => window.KCOberflaechen.liste());
  p('Sie kennt Name, Gerät und Umfang jeder Oberfläche',
    inKasse.every((o) => o.name && o.geraet && o.felder > 0),
    inKasse.map((o) => `${o.name}: ${o.felder} Felder`).join(' · '));

  const gewaehlt = await kasse.evaluate((id) => window.KCOberflaechen.waehlen(id), s.oberflaechen[1].id);
  p('Zwischen den Oberflächen lässt sich umschalten', gewaehlt.ok);
  await kasse.reload(); await kasse.waitForTimeout(700);
  p('Die Wahl übersteht einen Neustart der Kasse',
    (await kasse.evaluate(() => window.KCOberflaechen.gewaehlte()?.id)) === s.oberflaechen[1].id);
  /* EHRLICH: Die Kasse baut sich noch nicht um. Das muss sie auch sagen. */
  const b = await kasse.evaluate(() => window.KCOberflaechen.bericht());
  p('Die Kasse sagt, wie viel sie von der Oberfläche heute zuordnen kann',
    b && b.gesamt > 0 && Number.isInteger(b.zuordenbar), `${b.zuordenbar} von ${b.gesamt}`);
  p('Und sie behauptet nicht, sie hätte sich schon umgebaut', b.umbauMoeglich === false);
  p('Die noch offenen Bausteine werden benannt, nicht übergangen', Array.isArray(b.offen),
    b.offen.length ? b.offen.join(', ') : 'keine offen');

  /* Jederzeit weitere dazu - und Unsauberes darf das Vorhandene nicht zerstören. */
  const dazu = await kasse.evaluate(() => window.KCOberflaechen.uebernehmen({
    format: 'kc-kassenoberflaechen', version: 1,
    oberflaechen: [{ id: 'of-neu', name: 'Später dazugekommen', geraet: 'ipad-gross-quer',
      raster: { spalten: 12, zeilen: 8 },
      seiten: [{ art: 'kasse', bausteine: [{ typ: 'kc-kopf-voll', spalte: 0, zeile: 0, spalten: 12, zeilen: 1 }] }] }],
  }));
  p('Jederzeit kommt eine weitere dazu', dazu.ok && dazu.anzahl === 3, `${dazu.anzahl} hinterlegt`);
  const kaputt = await kasse.evaluate(() => window.KCOberflaechen.uebernehmen('{ das ist kein JSON'));
  p('Eine unbrauchbare Datei wird abgelehnt', kaputt.ok === false, kaputt.maengel.join(' | '));
  p('Und die vorhandenen bleiben dabei unangetastet',
    (await kasse.evaluate(() => window.KCOberflaechen.liste().length)) === 3);
  const fremd = await kasse.evaluate(() => window.KCOberflaechen.uebernehmen({
    format: 'irgendwas-anderes', version: 1, oberflaechen: [] }));
  p('Ein fremdes Format wird erkannt', fremd.ok === false, fremd.maengel.join(' | '));
  const mitArtikel = await kasse.evaluate(() => window.KCOberflaechenFormat.pruefeSammlung({
    format: 'kc-kassenoberflaechen', version: 1,
    oberflaechen: [{ id: 'of-x', name: 'x', geraet: 'ipad-9-quer', raster: { spalten: 12, zeilen: 8 },
      seiten: [{ art: 'kasse', bausteine: [{ typ: 'kc-artikel-bild', spalte: 0, zeile: 0, spalten: 4, zeilen: 4, artikel: 'Glühwein rot' }] }] }],
  }).maengel);
  /* Der Rückfall in die zweite Quelle muss auffallen, wenn ihn jemand später baut. */
  p('Artikeldaten in einem Aufbau werden beanstandet',
    mitArtikel.some((m) => /Artikeldaten/.test(m)), mitArtikel.join(' | '));

  p('Keine Skriptfehler über den ganzen Lauf', skriptfehler.length === 0,
    [...new Set(skriptfehler)].slice(0, 2).join(' | ') || 'keine');

  await browser.close();
  try { web.closeAllConnections && web.closeAllConnections(); } catch (e) {}
  web.close();
  console.log(`\nÜbergabe an die Kasse: ${ok}/${ok + fehler.length} bestanden`);
  process.exit(fehler.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
