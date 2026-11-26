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
const html = fs.readFileSync('pos/index.html', 'utf8'), sw = fs.readFileSync('pos/service-worker.js', 'utf8');
assert.ok(html.includes('time-clock-pos.js?build=stempel-v3') && html.includes('time-clock-pos.css?build=2') && sw.includes('"./time-clock-pos.js?build=stempel-v3"') && sw.includes('"./time-clock-pos.css?build=2"'), 'neue Fassung wird geladen und offline gespeichert');
console.log('stechuhr-zahlenfeld: ok');
