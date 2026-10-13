/* KC-ETIKETT-KESSELSCHILD (13.10.2026): Probe-Etikett 8 x 8 cm fuer das Metallschild am Gluehweinkessel.
   Prueft am erzeugten Etikett (Gluehwein rot): Preis inkl. Pfand (3,50 + 2,00 = 5,50), Pfandaufschluesselung,
   Allergene aus dem Artikelstamm, QR enthaelt genau die Artikelnummer, fehlende Zusatzstoffe werden ROT markiert
   (nie als "keine" gedruckt), Etikett 80 x 80 mm mit abgerundetem Rahmen, Schnittmarken vorhanden, PDF erzeugt. */
const {execFileSync} = require('child_process'); const fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..'); const A = path.join(W, 'werkzeuge', 'etiketten', 'ausgabe');
let f = 0; const pr = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) f++; };
execFileSync(process.execPath, [path.join(W, 'werkzeuge', 'etiketten', 'kesselschild.cjs'), 'grot', '--probe'], {stdio: 'pipe', env: process.env});
const html = fs.readFileSync(path.join(require('os').tmpdir(), 'kc-kesselschild', 'Kesselschild_Probe_grot.html'), 'utf8');
pr('Preis inkl. Pfand 5,50 €', html.includes('<div class="betrag">5,50 €</div>'));
pr('Pfand aufgeschlüsselt (3,50 € + 2,00 € Glaspfand)', html.includes('inkl. 2,00 € Pfand') && html.includes('+ 2,00 € Glaspfand'));
pr('Allergene aus dem Artikelstamm', /Allergene:<\/b> Schwefeldioxid \/ Sulfite/.test(html));
pr('QR enthält genau die Artikelnummer', /data-qr="01001"/.test(html));
pr('fehlende Zusatzstoffe rot markiert, nicht als "keine"', /Zusatzstoffe:<\/b> <span class="fehlt">/.test(html) && !/Zusatzstoffe:<\/b> keine/i.test(html));
pr('Etikett 80 x 80 mm, abgerundeter Rahmen', /\.etikett \{ width: 80mm; height: 80mm;[^}]*border-radius: 6mm/.test(html));
pr('Schnittmarken und Messbalken auf der Probe', (html.match(/class="marke"/g) || []).length === 8 && html.includes('Messbalken'));
pr('PDF erzeugt', fs.statSync(path.join(A, 'Kesselschild_Probe_grot.pdf')).size > 20000);
console.log(f ? `\n${f} FEHLER` : '\nAlles OK'); process.exit(f ? 1 : 0);
