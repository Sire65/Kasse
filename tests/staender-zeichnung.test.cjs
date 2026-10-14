/* KC-SCHILD-STAENDER (14.10.2026): Ständer-Variante des Edelstahlschilds SCH-001 Rev. C.
   Maße wie Original (90 x 100, Ø8 mittig 8 mm unter Oberkante, Ecken R8, 1,5 mm, Etikett 80 x 80 ab 16 mm), keine Langlöcher,
   Zeichnung (Front, Seite, Perspektive) auf einer A4-Seite. */
const fs = require('fs'), path = require('path'), {execFileSync} = require('child_process');
let f = 0; const pr = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) f++; };
const datei = path.join(__dirname, '..', 'werkzeuge/etiketten/staender-zeichnung.cjs');
const {M} = require(datei);
pr('Maße wie SCH-001: 90 x 100, Blech 1,5, Ecken R8', M.breite === 90 && M.hoehe === 100 && M.t === 1.5 && M.eckRadius === 8);
pr('Rundloch Ø8 mittig, Mitte 8 mm unter Oberkante', M.loch === 8 && M.lochAbOben === 8);
pr('Etikett 80 x 80 ab 16 mm unter Oberkante', M.etikett === 80 && M.hoehe - M.etikettUnten - M.etikett === 16);
const quelle = fs.readFileSync(datei, 'utf8');
pr('keine Langlöcher gezeichnet', !/Langloch\s*16\s*x\s*4'/.test(quelle) && /Langlöcher 16 × 4 entfallen/.test(quelle));
pr('Front, Seite und Perspektive vorhanden', ['VORDERANSICHT', 'SEITENANSICHT', 'PERSPEKTIVE'].every((x) => quelle.includes(x)));
execFileSync(process.execPath, [datei], {stdio: 'pipe', env: process.env});
const pdf = fs.readFileSync(path.join(__dirname, '..', 'werkzeuge/etiketten/ausgabe/Staender_Schild_Zeichnung.pdf'), 'latin1');
const seiten = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
pr('PDF: genau eine A4-Seite (quer)', seiten === 1 && /MediaBox\s*\[\s*0 0 841\.\d+ 595\.\d+/.test(pdf), String(seiten));
console.log(f ? `\n${f} FEHLER` : '\nAlles OK'); process.exit(f ? 1 : 0);
