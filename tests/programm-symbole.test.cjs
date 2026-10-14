// KC-PROGRAMM-SYMBOLE (14.10.2026, Wunsch Hansi): Kasse, PC-Manager und Money Butler (normal + Schulung) lassen sich als
// Desktop-Symbol mit Kochmuetze (CD Weinrot/Beige) ablegen. Prueft Manifest, Bilddateien, HTML-Kopf und
// bei der Kasse die Offline-Liste (neuer Speichername -> kein Mischstand alt/neu).
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
let ok = 0, fehl = 0;
const p = (t, b, d = '') => { if (b) ok++; else { fehl++; console.log('FEHLER: ' + t + (d ? ' – ' + d : '')); } };
const png = (f) => { const b = fs.readFileSync(f); return b.slice(1, 4).toString() === 'PNG' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };
for (const [ordner, pfx, sw] of [['pos', 'kasse', true], ['schulung/pos', 'kasse-schulung', true], ['pc-manager', 'manager', false], ['schulung/pc-manager', 'manager-schulung', false], ['money-butler', 'money-butler', false], ['schulung/money-butler', 'money-butler-schulung', false]]) {
  const d = path.join(R, ordner);
  const m = JSON.parse(fs.readFileSync(path.join(d, 'manifest.webmanifest'), 'utf8'));
  p(ordner + ': Manifest hat 192er und 512er Symbol', ['192x192', '512x512'].every((s) => m.icons.some((i) => i.sizes === s)));
  for (const i of m.icons) {
    const f = path.join(d, i.src);
    p(ordner + ': ' + i.src + ' vorhanden', fs.existsSync(f));
    const g = fs.existsSync(f) && png(f);
    p(ordner + ': ' + i.src + ' Groesse passt', g && g[0] + 'x' + g[1] === i.sizes, String(g));
  }
  p(ordner + ': Symbol gehoert zur richtigen Fassung', m.icons.every((i) => i.src.includes('/' + pfx + '-')));
  const h = fs.readFileSync(path.join(d, 'index.html'), 'utf8');
  p(ordner + ': HTML verweist auf Manifest', h.includes('rel="manifest" href="manifest.webmanifest"'));
  p(ordner + ': HTML hat Apple-Symbol', h.includes('rel="apple-touch-icon" href="icons/' + pfx + '-192.png"'));
  if (sw) {
    const s = fs.readFileSync(path.join(d, 'service-worker.js'), 'utf8');
    p(ordner + ': Symbole in der Offline-Liste', m.icons.every((i) => s.includes('"' + i.src + '"')));
  }
}
const schul = JSON.parse(fs.readFileSync(path.join(R, 'schulung/pos/manifest.webmanifest'), 'utf8'));
p('Schulung-Kasse bleibt eigene App (id/start_url mit schulung=1)', schul.id === './?schulung=1' && schul.start_url.includes('schulung=1'));
console.log(`Programm-Symbole: ${ok}/${ok + fehl} bestanden`);
process.exit(fehl ? 1 : 0);
