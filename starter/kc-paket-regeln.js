'use strict';
// Welche Dateien gehören zum Stand-Paket? Gemeinsame Regeln für tools/stand-paket.js (Liste erzeugen) und
// starter/kc-paket.js (Installation aus der ZIP). Bewusst NICHT im Paket: Schulung, Tests, Werkzeuge,
// Dokumentation, Laufzeit (node_modules) und die Mitglieder-Adressdatei.
const ORDNER = ['pos', 'pc-manager', 'shared', 'cores', 'tv-player', 'tv-content', 'money-butler', 'media',
  'exchange-core-v31', 'avatar-core', 'market-start-reset', 'kc-mobile-tv', 'assets', 'etiketten', 'training-video',
  'markt-kasse-suite/backend-source', 'starter'];
const AUSSCHLUSS = [/(^|\/)node_modules(\/|$)/, /^markt-kasse-suite\/backend-source\/tests\//, /^pc-manager\/kc-mitgliedsdaten\.js$/,
  /\.sqlite(-\w+)?$/, /\.admin-token\.txt$/, /\.key\.pem$/, /\.audit-anchor\.json$/, /zentral-zugang\.json$/, /(^|\/)[._][^/]*/];
// Dateien, die vom Programm nach C:\KC-Kasse\ (Installationswurzel) kopiert werden - Startdateien, Anleitung.
// Einzelne Dateien außerhalb der Ordner, die am Stand gebraucht werden.
const EINZELN = ['tools/kc-tv-hintergrund.ps1'];
const WURZEL_DATEIEN = /^(KC_[^/]+\.(cmd|ps1)|START_HIER\.(txt|cmd)|[^/]+\.pdf)$/i;

function istPaketDatei(rel) {
  const p = String(rel).replace(/\\/g, '/');
  const imOrdner = ORDNER.some((o) => p.startsWith(o + '/'));
  const wurzel = !p.includes('/') && !/\.md$/i.test(p);
  return (imOrdner || wurzel || EINZELN.includes(p)) && !AUSSCHLUSS.some((r) => r.test(p));
}

// Zeilenenden: .cmd/.bat/.ps1 liegen im Repository (und auf GitHub Pages) mit LF, nach dem Auschecken unter
// Windows bzw. in der ZIP mit CRLF. Prüfsumme und Größe zählen immer die LF-Fassung.
const ZEILENENDE_CRLF = /\.(cmd|bat|ps1)$/i;
function normiert(rel, buf) { return ZEILENENDE_CRLF.test(rel) ? Buffer.from(buf.toString('latin1').replace(/\r\n/g, '\n'), 'latin1') : buf; }
function fuerPlatte(rel, buf) { return ZEILENENDE_CRLF.test(rel) ? Buffer.from(buf.toString('latin1').replace(/\r?\n/g, '\r\n'), 'latin1') : buf; }
// Kennung = Fingerabdruck über alle Dateien (sortiert) - gleiche Dateien ergeben immer dieselbe Kennung.
function kennungVon(dateien) {
  const sortiert = Object.keys(dateien).sort().map((k) => [k, dateien[k].s, dateien[k].g]);
  return require('crypto').createHash('sha256').update(JSON.stringify(sortiert)).digest('hex').slice(0, 12);
}
// GitHub Pages wandelt Dateien mit YAML-Kopf ("---") um - sie könnten nicht 1:1 geladen werden und bleiben draußen.
function hatFrontMatter(buf) { const k = buf.slice(0, 5).toString('latin1'); return k.startsWith('---\n') || k.startsWith('---\r\n'); }
module.exports = { hatFrontMatter, ORDNER, AUSSCHLUSS, WURZEL_DATEIEN, EINZELN, istPaketDatei, normiert, fuerPlatte, kennungVon };
