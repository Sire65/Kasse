#!/usr/bin/env node
'use strict';
// Baut installation/KC-Kasse-Installation.zip: nur Startdateien + Starter (wenige KB). Beim ersten Start lädt der
// Starter das Programm (ca. 80 MB, ohne Schulung/Tests/Werkzeuge) direkt von GitHub Pages nach C:\KC-Kasse.
// Statt der großen GitHub-ZIP (über 200 MB) - spart Platz auf dem Mini-PC.
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const { fuerPlatte, normiert } = require('../starter/kc-paket-regeln');
const W = path.join(__dirname, '..');
const NAME = 'KC-Kasse-Installation';
const ZIEL = path.join(W, 'installation', `${NAME}.zip`);
const DATEIEN = ['KC_Manager_Start.cmd', 'KC_Zuhause_Start.cmd', 'KC_Einrichtung.ps1',
  ...fs.readdirSync(path.join(W, 'starter')).map((f) => `starter/${f}`)];
const LIESMICH = [
  'KC MARKTKASSE - INSTALLATION',
  '',
  '1. Diese ZIP-Datei mit Rechtsklick - "Alle extrahieren..." - "Extrahieren" entpacken.',
  '2. Im entpackten Ordner doppelklicken:',
  '     am Mini-PC (Stand):  KC_Manager_Start.cmd',
  '     zu Hause:            KC_Zuhause_Start.cmd',
  '3. Das Programm wird aus dem Internet nach C:\\KC-Kasse geladen (ca. 80 MB, nur beim ersten Mal).',
  '   Auf dem Desktop erscheint "KC Kasse starten" (zu Hause: "KC Manager zu Hause").',
  '4. Danach diese ZIP und den entpackten Ordner loeschen - sie werden nicht mehr gebraucht.',
  '',
  'Vorhandene Daten (Kassen, Buchungen, Schluessel, Einstellungen) bleiben erhalten.',
  '',
].join('\r\n');

function bauen() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-installer-'));
  const ordner = path.join(tmp, NAME);
  const fest = new Date('2026-01-01T00:00:00Z');
  for (const rel of DATEIEN) {
    const z = path.join(ordner, rel); fs.mkdirSync(path.dirname(z), { recursive: true });
    fs.writeFileSync(z, fuerPlatte(rel, normiert(rel, fs.readFileSync(path.join(W, rel)))));
  }
  fs.writeFileSync(path.join(ordner, 'LIES_MICH.txt'), LIESMICH);
  const alle = []; (function w(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.utimesSync(p, fest, fest); if (fs.statSync(p).isDirectory()) w(p); else alle.push(path.relative(tmp, p)); } })(ordner);
  fs.utimesSync(ordner, fest, fest);
  fs.mkdirSync(path.dirname(ZIEL), { recursive: true });
  const neu = path.join(tmp, 'neu.zip');
  execFileSync('zip', ['-X', '-q', '-9', neu, `${NAME}/`, ...alle.sort().map((f) => f.split(path.sep).join('/'))], { cwd: tmp });
  const alt = fs.existsSync(ZIEL) ? fs.readFileSync(ZIEL) : null;
  const geaendert = !alt || !alt.equals(fs.readFileSync(neu));
  if (geaendert) fs.copyFileSync(neu, ZIEL);
  fs.rmSync(tmp, { recursive: true, force: true });
  return { geaendert, groesse: fs.statSync(ZIEL).size, dateien: alle.length };
}
if (require.main === module) { const r = bauen(); console.log(`${path.relative(W, ZIEL)}: ${(r.groesse / 1024).toFixed(0)} KB, ${r.dateien} Dateien${r.geaendert ? ' (neu)' : ' (unverändert)'}`); }
module.exports = { bauen, ZIEL, DATEIEN };
