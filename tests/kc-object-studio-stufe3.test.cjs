const fs = require('fs');
const assert = require('assert');
const studio = fs.readFileSync('pc-manager/kc-object-studio.js','utf8');
const css = fs.readFileSync('pc-manager/styles.css','utf8');

// Erscheinungs-Animationen
assert(studio.includes('function entranceStyle'), 'Erscheinungs-Animation-Zustand fehlt');
assert(studio.includes('function playEntrance'), 'Abspielen der Erscheinungs-Animation fehlt');
assert(studio.includes('function hookEntrancePlayback'), 'Anbindung an echte Folienwechsel (Editor + TV-Bühne) fehlt');
assert(studio.includes('__kcEntranceHooked'), 'Verkettung von renderSlideInto muss doppelte Bindung verhindern');
['fade','slide-left','slide-right','slide-up','slide-down','zoom','bounce'].forEach(type => {
  assert(studio.includes(`'${type}'`), `Animationstyp fehlt im Modul: ${type}`);
  assert(css.includes(`.kc-entrance-${type}`), `CSS-Animation fehlt: ${type}`);
});
['title','text','price','ticker','symbols','weather','banner','shape','image'].forEach(key => {
  assert(studio.includes(`entranceSection('${key}')`) || studio.includes('entranceSection(key)'), `Erscheinungs-Animation nicht an Panel für ${key} angehängt`);
});

// Text-Auto-Fit
assert(studio.includes('get autoFit(){return !!t.autoFit}') || studio.includes('get autoFit(){return !!t[`${key}AutoFit`]}'), 'Auto-Fit-Zustand fehlt im Textzustand');
assert(studio.includes('function applyAutoFit'), 'Auto-Fit-Berechnung fehlt');
assert(studio.includes('data-text-autofit'), 'Auto-Fit-Schalter fehlt im Werkzeugkasten');
assert(studio.includes('var(--autofit-scale,1)'), 'Auto-Fit-Skalierung ist nicht in die Schriftgrößen-Berechnung eingebaut');

// Gestaltungs-Vorlagen
assert(studio.includes('const themes = {'), 'Vorlagen-Bibliothek fehlt');
assert(studio.includes('function applyTheme'), 'Anwenden einer Vorlage fehlt');
['weihnacht-gold','eisblau','rustikal','modern-minimal','sommerfest'].forEach(id => assert(studio.includes(`'${id}'`), `Vorlage fehlt: ${id}`));
assert(studio.includes('function themesSection'), 'Vorlagen-Baustein im Werkzeugkasten fehlt');

console.log('PASS kc-object-studio-stufe3: Erscheinungs-Animationen, Text-Auto-Fit, Gestaltungs-Vorlagen');
