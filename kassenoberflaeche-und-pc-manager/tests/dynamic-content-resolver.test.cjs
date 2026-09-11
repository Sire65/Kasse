const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

const playerHtml = fs.readFileSync('tv-player/index.html', 'utf8');
assert(playerHtml.includes('dynamic-content-resolver.js'), 'Dynamische Inhaltsauflösung nicht in tv-player eingebunden');
assert(!playerHtml.includes('member-rotation.js'), 'Alte, abgelöste Rotationsdatei darf nicht mehr eingebunden sein');

const pool = Array.from({ length: 18 }, (_, i) => ({
  id: `m${i + 1}`, renderMode: 'member-showcase', title: `Mitglied ${i + 1}`, text: `Zitat ${i + 1}`,
  decorations: ['🎄'], media: { name: `m${i + 1}.jpg` }
}));
const programSnapshot = [
  { date: '2099-01-01', time: '10:00', endTime: '11:00', title: 'Testpunkt A' },
  { date: '2099-01-02', time: '12:00', endTime: '13:00', title: 'Testpunkt B' },
];

const sandbox = {
  data: {
    slides: [
      { id: 'wm26-member-slot-a', memberSlot: 'a', title: '', text: '' },
      { id: 'wm26-member-slot-b', memberSlot: 'b', title: '', text: '' },
      { id: 'today-slide', programSlot: 'today', title: '', text: '' },
      { id: 'tomorrow-slide', programSlot: 'tomorrow', title: '', text: '' },
      { id: 'weather-slide', type: 'weather', animation: 'none' },
    ],
    source: { memberPool: pool },
    profile: { memberRotation: { enabled: true, minutes: 3 } },
    eventProgramSnapshot: programSnapshot,
    weather: { lastData: [{ summary: 'Schneeschauer' }] },
  },
  active: function () { return sandbox.data.slides; },
  Date: Date, console: console,
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('tv-player/dynamic-content-resolver.js', 'utf8'), sandbox);

const result = sandbox.active();

// Mitglieder-Rotation: beide feste Plätze müssen mit echten Mitgliedsdaten befüllt sein, unterschiedlich
const slotA = result.find(s => s.id === 'wm26-member-slot-a');
const slotB = result.find(s => s.id === 'wm26-member-slot-b');
assert(pool.some(m => m.title === slotA.title), 'Platz A muss mit einem echten Mitglied befüllt sein');
assert(pool.some(m => m.title === slotB.title), 'Platz B muss mit einem echten Mitglied befüllt sein');
assert.notStrictEqual(slotA.title, slotB.title, 'Beide Plätze müssen unterschiedliche Mitglieder zeigen');

// Programm: da die Testdaten kein heutiges/morgiges Datum treffen, muss der Rückfalltag greifen
const todaySlide = result.find(s => s.id === 'today-slide');
const tomorrowSlide = result.find(s => s.id === 'tomorrow-slide');
assert(todaySlide.text.includes('Testpunkt A'), 'Rückfall auf den ersten verfügbaren Tag fehlt');
assert(tomorrowSlide.text.includes('Testpunkt B'), 'Rückfall auf den zweiten verfügbaren Tag fehlt');

// Wetter-Effekt: "Schneeschauer" muss zu einem Schnee-Effekt führen
const weatherSlide = result.find(s => s.id === 'weather-slide');
assert.strictEqual(weatherSlide.animation, 'snow-light', 'Wetterabhängiger Effekt wurde nicht korrekt gewählt');

console.log('PASS dynamic-content-resolver: Mitglieder-Rotation an festen Plätzen, Programm-Rückfalltag, wetterabhängiger Effekt');
