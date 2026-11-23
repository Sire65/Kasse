#!/usr/bin/env node
'use strict';
// Erzeugt stand-paket.json: die Liste aller Dateien, die der Kassen-PC (Stand) und der PC-Manager zu Hause
// brauchen, mit SHA-256 und Größe. Der Starter (starter/kc-starter.js) lädt beim Start diese Liste von
// GitHub Pages und holt nur geänderte Dateien. Aufruf: node tools/stand-paket.js  (schreibt die Datei neu)
//                                                    node tools/stand-paket.js --pruefen  (Exit 1, wenn veraltet)
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execFileSync } = require('child_process');
const WURZEL = path.join(__dirname, '..');
const DATEI = path.join(WURZEL, 'stand-paket.json');

const { istPaketDatei, ORDNER, normiert, kennungVon, hatFrontMatter } = require('../starter/kc-paket-regeln');

function dateienListe() {
  const alle = execFileSync('git', ['ls-files', '-z'], { cwd: WURZEL }).toString('utf8').split('\0').filter(Boolean);
  return alle.filter((p) => p !== 'stand-paket.json' && istPaketDatei(p) && fs.existsSync(path.join(WURZEL, p))).sort();
}

function erzeuge() {
  const dateien = {};
  for (const p of dateienListe()) {
    const inhalt = normiert(p, fs.readFileSync(path.join(WURZEL, p)));
    if (hatFrontMatter(inhalt)) continue;
    dateien[p] = { s: crypto.createHash('sha256').update(inhalt).digest('hex'), g: inhalt.length };
  }
  const kennung = kennungVon(dateien);
  let alt = null; try { alt = JSON.parse(fs.readFileSync(DATEI, 'utf8')); } catch (e) { /* neu */ }
  const version = alt && alt.kennung === kennung ? alt.version : `${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{4})$/, '$1-$2')}-${kennung.slice(0, 6)}`;
  const erstellt = alt && alt.kennung === kennung ? alt.erstellt : new Date().toISOString();
  return { format: 'KC_STAND_PAKET_1', version, kennung, erstellt, anzahl: Object.keys(dateien).length,
    bytes: Object.values(dateien).reduce((s, d) => s + d.g, 0), dateien };
}

if (require.main === module) {
  const neu = erzeuge();
  if (process.argv.includes('--pruefen')) {
    let alt = null; try { alt = JSON.parse(fs.readFileSync(DATEI, 'utf8')); } catch (e) { /* */ }
    if (!alt || alt.kennung !== neu.kennung) { console.error('stand-paket.json ist veraltet – node tools/stand-paket.js ausführen.'); process.exit(1); }
    console.log(`stand-paket.json aktuell (${neu.version}, ${neu.anzahl} Dateien, ${(neu.bytes / 1e6).toFixed(1)} MB)`); process.exit(0);
  }
  fs.writeFileSync(DATEI, JSON.stringify(neu, null, 0) + '\n');
  console.log(`stand-paket.json: Version ${neu.version}, ${neu.anzahl} Dateien, ${(neu.bytes / 1e6).toFixed(1)} MB`);
}
module.exports = { erzeuge, dateienListe, ORDNER };
