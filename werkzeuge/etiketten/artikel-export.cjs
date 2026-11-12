// Artikelstamm fuer die Preisetiketten der Club-App exportieren: node werkzeuge/etiketten/artikel-export.cjs
// KC-ETIKETT-EXPORT (12.11.2026, Betreiber: „Preisetiketten in die Club-App – Formate 8x8/7x7/6x6/5x5, mit/ohne Foto, Allergene, Preis …,
// nach Warengruppen, Anzahl und Vorschau“). Die Club-App liegt auf derselben Adresse (sire65.github.io) und laedt /Kasse/etiketten/artikel.json
// und die Fotos aus /Kasse/pos/… direkt – keine Datenbank, keine Kosten. Nach jeder Aenderung am Artikelstamm neu erzeugen.
// Fehlende Pflichtangaben bleiben null (die Club-App druckt sie rot als „nicht erfasst“ – UNKNOWN nie als OK).
const fs = require('fs'), path = require('path'), http = require('http'); const pw = require('playwright');
const {artikelstammLesen} = require('./artikelstamm.cjs');
const W = path.join(__dirname, '..', '..'), ZIEL = path.join(W, 'etiketten'); fs.mkdirSync(ZIEL, {recursive: true});
const T = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml'};
(async () => {
  const s = http.createServer((q, r) => { const p = path.join(W, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, {'Content-Type': T[path.extname(p)] || 'application/octet-stream'}); r.end(d); }); });
  await new Promise((r) => s.listen(0, r));
  const b = await pw.chromium.launch();
  try {
    const artikel = (await artikelstammLesen(b, s.address().port)).map((a) => ({...a, bild: a.bild && fs.existsSync(path.join(W, 'pos', a.bild)) ? 'pos/' + a.bild : null,
      // Kachelbilder (_version_3): volle Breite, Namensbalken unten (ab 83 %) weg; i-Symbol oben links (Mitte/Radius als Anteil der Breite) uebermalen
      bildAusschnitt: /_version_3\.png$/.test(a.bild || '') ? [0, 0, 1, 0.83] : null, bildSymbol: /_version_3\.png$/.test(a.bild || '') ? [0.093, 0.093, 0.082] : null}))
      .sort((x, y) => x.kategorie.localeCompare(y.kategorie, 'de') || x.sortierung - y.sortierung || x.name.localeCompare(y.name, 'de'));
    const daten = {stand: new Date().toISOString(), quelle: 'Kasse pos/app.js (PRODUCTS)', artikel};
    fs.writeFileSync(path.join(ZIEL, 'artikel.json'), JSON.stringify(daten, null, 1) + '\n');
    console.log(`fertig: ${artikel.length} Artikel -> etiketten/artikel.json (${[...new Set(artikel.map((a) => a.kategorie))].join(', ')})`);
  } finally { await b.close(); s.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
