/* Personenart auf dem Weg von der Vereinsverwaltung in die Kasse.
 *
 * Hintergrund: die Zeiterfassung kennt nur 'member' und 'helper'. Wer in der Verwaltung
 * "Gast" oder "Aushilfe" ist, muss hier als 'helper' ankommen. Vorher stand in der Bruecke
 * fest 'member' - ein Gast wurde damit unterwegs stillschweigend zum Vollmitglied.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const {execFileSync} = require('child_process');

let ok = 0, rot = 0;
const p = (name, gut, zusatz = '') => { gut ? ok++ : rot++; console.log(`${gut ? '  OK  ' : 'FEHLER'}  ${name}${zusatz ? '   [' + zusatz + ']' : ''}`); };

const WURZEL = path.resolve(__dirname, '..');
const KONVERTER = path.resolve(WURZEL, '..', 'kc-sync-installation-und-backend', 'convert-kng-members.js');

// ------------------------------------------------------------------ 1. Der Konverter
const mitglieder = [
  {id: 'a', memberNo: 'KC-0001', firstName: 'Anna',  lastName: 'Aktiv',  memberType: 'Aktiv',         birthDate: '1960-03-04', exitDate: ''},
  {id: 'b', memberNo: 'KC-0002', firstName: 'Paul',  lastName: 'Passiv', memberType: 'Passiv',        birthDate: '', exitDate: ''},
  {id: 'c', memberNo: 'KC-0003', firstName: 'Ehm',   lastName: 'Ehren',  memberType: 'Ehrenmitglied', birthDate: '', exitDate: ''},
  {id: 'd', memberNo: 'KC-0004', firstName: 'Gerd',  lastName: 'Gast',   memberType: 'Gast',          birthDate: '', exitDate: ''},
  {id: 'e', memberNo: 'KC-0005', firstName: 'Uwe',   lastName: 'Hilfe',  memberType: 'Aushilfe',      birthDate: '', exitDate: ''},
  {id: 'f', memberNo: 'KC-0006', firstName: 'Erna',  lastName: 'Raus',   memberType: 'Aktiv',         birthDate: '', exitDate: '2025-12-31'},
  {id: 'g', memberNo: 'KC-0007', firstName: 'Otto',  lastName: 'Ohne',   memberType: '',              birthDate: '', exitDate: ''},
  {id: 'h', memberNo: 'KC-0008', firstName: 'Xena',  lastName: 'Fremd',  memberType: 'Irgendwas',     birthDate: '', exitDate: ''},
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-personenart-'));
const stateDatei = path.join(tmp, 'state.js');
const ausgabe = path.join(tmp, 'paket.json');
fs.writeFileSync(stateDatei, 'module.exports = ' + JSON.stringify({members: mitglieder}) + ';');

if (!fs.existsSync(KONVERTER)) {
  p('Konverter convert-kng-members.js gefunden', false, KONVERTER);
} else {
  const ausgabeText = execFileSync('node', [KONVERTER, stateDatei, ausgabe], {encoding: 'utf8'});
  const paket = JSON.parse(fs.readFileSync(ausgabe, 'utf8'));
  const von = (nr) => paket.people.find((x) => x.credential === nr);

  p('Konverter laeuft durch', Array.isArray(paket.people), `${paket.people.length} Personen`);
  p('Aktiv wird member', von('KC-0001')?.type === 'member', von('KC-0001')?.type);
  p('Passiv wird member', von('KC-0002')?.type === 'member', von('KC-0002')?.type);
  p('Ehrenmitglied wird member', von('KC-0003')?.type === 'member', von('KC-0003')?.type);
  p('Gast wird helper, NICHT member', von('KC-0004')?.type === 'helper', von('KC-0004')?.type);
  p('Aushilfe wird helper, NICHT member', von('KC-0005')?.type === 'helper', von('KC-0005')?.type);
  p('Ausgeschiedene werden gar nicht uebergeben', !von('KC-0006'), von('KC-0006') ? 'ist dabei' : 'fehlt richtigerweise');
  p('leere Mitgliedsart bleibt member', von('KC-0007')?.type === 'member', von('KC-0007')?.type);
  p('unbekannte Mitgliedsart wird helper, nicht member', von('KC-0008')?.type === 'helper', von('KC-0008')?.type);
  p('die Mitgliedsart im Klartext geht mit', von('KC-0004')?.role === 'Gast', von('KC-0004')?.role);
  p('Konverter meldet die Aufteilung im Klartext',
    /Mitglieder: 4/.test(ausgabeText) && /Helfer \(Gast\/Aushilfe\): 3/.test(ausgabeText),
    ausgabeText.split('\n').filter((z) => /Mitglieder:|Helfer/.test(z)).join(' | '));
  p('Mitgliedsnummer bleibt der Schluessel', von('KC-0001')?.credential === 'KC-0001');
  p('Geburtstagscode wird weiter gebildet', von('KC-0001')?.birthCode === '040360', von('KC-0001')?.birthCode);
}

// -------------------------------------------- 2. Das Einlesen im Manager (gleiche Tabelle)
const quelle = fs.readFileSync(path.join(WURZEL, 'pc-manager', 'time-clock-manager.js'), 'utf8');
p('Manager setzt die Personenart nicht mehr fest auf member',
  !/type:\s*eintrag\.type === 'helper' \? 'helper' : 'member'/.test(quelle));
p('Manager benutzt die Uebersetzungstabelle', /ART_JE_MITGLIEDSART/.test(quelle) && /personenart\(eintrag\)/.test(quelle));

// Die Tabelle aus der Datei herausloesen und wirklich rechnen lassen
const block = quelle.match(/const ART_JE_MITGLIEDSART = \{[\s\S]*?\};/);
const fnBlock = quelle.match(/function personenart\(eintrag\) \{[\s\S]*?\n  \}/);
if (block && fnBlock) {
  const personenart = new Function(`${block[0]}\n${fnBlock[0]}\nreturn personenart;`)();
  p('Manager: Gast -> helper', personenart({type: 'Gast'}) === 'helper', personenart({type: 'Gast'}));
  p('Manager: Aushilfe -> helper', personenart({type: 'Aushilfe'}) === 'helper');
  p('Manager: guest/employee (Datenbankschreibweise) -> helper',
    personenart({type: 'guest'}) === 'helper' && personenart({type: 'employee'}) === 'helper');
  p('Manager: Aktiv -> member', personenart({type: 'Aktiv'}) === 'member');
  p('Manager: helper bleibt helper', personenart({type: 'helper'}) === 'helper');
  p('Manager: leeres Feld bleibt member', personenart({}) === 'member');
  p('Manager: unbekannter Wert wird helper, nicht member', personenart({type: 'Hausmeister'}) === 'helper');
} else {
  p('Uebersetzungstabelle im Manager auffindbar', false);
}

// ------------------------------------------------- 3. Der Abruf aus der zentralen Datenbank
const zentral = fs.readFileSync(path.join(WURZEL, 'pc-manager', 'kc-zentral.js'), 'utf8');
p('Zentralabruf setzt die Personenart nicht mehr fest auf member',
  !/const satz = \{id: treffer\?\.id \|\| `z_\$\{p\.personId\}`, type: 'member'/.test(zentral));
p('Zentralabruf wertet membership_type aus',
  /membershipType \|\| p\.membership_type/.test(zentral) && /'guest'/.test(zentral) && /'employee'/.test(zentral));

fs.rmSync(tmp, {recursive: true, force: true});
console.log(`\nPersonenart-Uebergabe: ${ok}/${ok + rot} bestanden`);
process.exit(rot ? 1 : 0);
