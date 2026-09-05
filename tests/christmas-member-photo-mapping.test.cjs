const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('tv-content/weihnachtsmarkt-2026/presentation.js', 'utf8'), sandbox);

const content = sandbox.window.KC_WEIHNACHTSMARKT_PRESENTATION;
// KEINE handgetippte Namensliste mehr in diesem Test.
// Vorher stand die Zuordnung Name-Foto hier ein zweites Mal, von Hand gepflegt. Beim
// Berichtigen der Schreibweisen am 03.09.2026 lief genau das auseinander: Die Praesentation
// war richtig, der Test bestand auf der alten Schreibweise - und meldete die richtige Datei
// als Fehler. Ein Test, der eine eigene Quelle aufmacht, prueft am Ende sich selbst.
//
// Stattdessen wird gegen die beiden Stellen geprueft, die es wirklich gibt:
//   1. die Mitgliedsdaten des Vereins  - dort stehen die gueltigen Namen
//   2. die TV-Fassung (.kctv)          - dort steht dieselbe Zuordnung noch einmal
// Weichen die beiden voneinander ab, faellt es hier auf, statt am Freitag auf der Leinwand.
const stammNamen = new Set([...fs.readFileSync('pc-manager/kc-mitgliedsdaten.js', 'utf8')
  .matchAll(/name:\s*'([^']+)'/g)].map(m => m[1]));

const tv = JSON.parse(fs.readFileSync(
  'tv-content/weihnachtsmarkt-2026/Weihnachtsmarkt_Werne_2026_Bearbeitbar.kctv', 'utf8'));
const tvZuordnung = tv.slides.filter(s => s.type === 'member')
  .map(s => [s.title, String(s.media && s.media.dataUrl || '').split('/').pop()])
  .filter(([, bild]) => /^mitglied-\d\d\.jpg$/.test(bild));

const ausVorlage = Array.from(content.MEMBER_PROFILES.slice(0, 10), profile => [
  profile.name, profile.photo.split('/').pop()
]);

// Jeder Name muss aus den Mitgliedsdaten stammen - kein Platzhalter, keine alte Schreibweise.
ausVorlage.forEach(([name]) => assert.ok(stammNamen.has(name),
  `"${name}" steht nicht in den Mitgliedsdaten des Vereins`));

// Und beide Quellen muessen dieselbe Zuordnung tragen.
assert.deepEqual(ausVorlage, tvZuordnung);

const expected = ausVorlage;

const presentation = content.create();
expected.forEach(([name, photo], index) => {
  const slide = presentation.slides[index + 2];
  assert.equal(slide.title, name);
  assert.equal(slide.media.dataUrl.split('/').pop(), photo);
});

console.log('PASS christmas-member-photo-mapping: alle zehn vorhandenen Fotos sind den bestätigten Namen zugeordnet');
