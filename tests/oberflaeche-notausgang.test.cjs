// 30.09.2026: Oberflaeche ohne MENUE-/MEHR-Knopf (z. B. KC015) darf das Tablet nicht einsperren.
const assert = require('assert');
const fs = require('fs');
for (const dir of ['pos', 'schulung/pos']) {
  const js = fs.readFileSync(`${dir}/kc-oberflaechen-anwenden.js`, 'utf8');
  const css = fs.readFileSync(`${dir}/kc-oberflaechen-anwenden.css`, 'utf8');
  const html = fs.readFileSync(`${dir}/index.html`, 'utf8');
  const sw = fs.readFileSync(`${dir}/service-worker.js`, 'utf8');
  assert.match(js, /function sorgeFuerMenueZugang\(\)/, `${dir}: Notausgang-Funktion fehlt`);
  assert.match(js, /requestAnimationFrame\(sorgeFuerMenueZugang\)/, `${dir}: Notausgang wird beim Anwenden nicht geprueft`);
  assert.match(js, /getElementById\('menuBtn'\)[\s\S]*getElementById\('moreBtn'\)/, `${dir}: Pruefung auf MENUE/MEHR fehlt`);
  assert.match(js, /getElementById\('moreDialog'\)[^\n]*showModal\(\)/, `${dir}: Notausgang oeffnet das Mehr-Fenster nicht`);
  assert.match(js, /get\('oberflaeche'\)[\s\S]{0,120}=== 'standard'\) \{ zuruecksetzen\(\)/, `${dir}: ?oberflaeche=standard fehlt`);
  assert.match(js, /kcMenueSchwebend'\); if \(menue\) menue.hidden = true;/, `${dir}: Standard blendet den Notausgang nicht aus`);
  assert.match(css, /\.kc-menue-schwebend \{/, `${dir}: CSS fehlt`);
  // Build mindestens 0.9.10 (Stand des Notausgangs); spaetere Builds sind erlaubt (30.09.2026: 0.9.11 Pfand-Anzeige).
  const mindestens = (text) => { const m = text.match(/kc-oberflaechen-anwenden\.js\?build=0\.9\.(\d+)/); return !!m && Number(m[1]) >= 10; };
  assert.ok(mindestens(html), `${dir}: Build nicht erhoeht`);
  assert.ok(mindestens(sw), `${dir}: Offline-Liste nicht nachgezogen`);
  assert.strictEqual((html.match(/kc-oberflaechen-anwenden\.js\?build=([\d.]+)/) || [])[1], (sw.match(/kc-oberflaechen-anwenden\.js\?build=([\d.]+)/) || [])[1], `${dir}: Seite und Offline-Liste mit verschiedenem Build`);
}
const pos = fs.readFileSync('pos/kc-oberflaechen-anwenden.js', 'utf8');
assert.strictEqual(pos, fs.readFileSync('schulung/pos/kc-oberflaechen-anwenden.js', 'utf8'), 'Live und Schulung muessen gleich sein');
console.log('oberflaeche-notausgang: ok');
