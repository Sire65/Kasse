// 26.11.2026 Stechuhr: Zahlenfeld für den Geburtstag (TTMMJJ) gleich beim Öffnen – der QR-Scan klappt weiter (Fokus bleibt im Eingabefeld).
const fs = require('fs');
const assert = require('assert');
const s = fs.readFileSync('pos/time-clock-pos.js', 'utf8');
assert.ok(/id="tcPosCredential" class="tc-eingabe" autocomplete="off" inputmode="none"/.test(s), 'keine Bildschirmtastatur über dem Zahlenfeld');
assert.ok(/id="tcPosZiffern"/.test(s) && /\[1, 2, 3, 4, 5, 6, 7, 8, 9\]/.test(s) && /data-ziffer="0"/.test(s) && /data-ziffer="weg"/.test(s) && /data-ziffer="tastatur"/.test(s), 'Ziffern 0–9, löschen, Tastatur');
assert.ok(/addEventListener\('pointerdown', event => \{ if \(event\.target\.closest\('button'\)\) event\.preventDefault\(\); \}\)/.test(s), 'Zahlenfeld nimmt dem Eingabefeld nie den Fokus (Scanner schreibt weiter dort)');
assert.ok(/if \(z !== 'weg' && feld\.value\.length === 6\) identify\(\);/.test(s), 'sechs Ziffern → weiter');
assert.ok(/if \(!\/\^\\\\d\*\$\/\.test\(feld\.value\)\) feld\.value = '';/.test(s) || s.includes("if (!/^\\d*$/.test(feld.value)) feld.value = '';"), 'angefangener Scan wird beim Tippen verworfen');
assert.ok(/el\('tcPosZiffern'\)\.hidden = config\.allowBirthCode === false/.test(s), 'nur wenn Geburtstag erlaubt');
assert.ok(/setAttribute\('inputmode', 'none'\); el\('tcPosCredential'\)\.focus\(\)/.test(s), 'beim Zurück wieder ohne Bildschirmtastatur, Fokus für den Scanner');
// 28.11.2026: auch die Schulung hat das Zahlenfeld (gleiche Datei wie die Kasse), neue Fassung stempel-v4 / css 3
for (const ort of ['pos', 'schulung/pos']) {
  const html = fs.readFileSync(`${ort}/index.html`, 'utf8'), sw = fs.readFileSync(`${ort}/service-worker.js`, 'utf8');
  assert.ok(html.includes('time-clock-pos.js?build=stempel-v4') && html.includes('time-clock-pos.css?build=3') && sw.includes('"./time-clock-pos.js?build=stempel-v4"') && sw.includes('"./time-clock-pos.css?build=3"'), `${ort}: neue Fassung wird geladen und offline gespeichert`);
}
assert.strictEqual(fs.readFileSync('schulung/pos/time-clock-pos.js', 'utf8'), s, 'Schulung hat dieselbe Stechuhr wie die Kasse');
console.log('stechuhr-zahlenfeld: ok');
