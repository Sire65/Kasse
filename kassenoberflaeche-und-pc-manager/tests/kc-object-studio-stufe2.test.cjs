const fs = require('fs');
const assert = require('assert');
const studio = fs.readFileSync('pc-manager/kc-object-studio.js','utf8');
const css = fs.readFileSync('pc-manager/styles.css','utf8');

// Mehrfachauswahl
assert(studio.includes('let active = \'slide\', selection = new Set()'), 'Mehrfachauswahl-Zustand fehlt');
assert(studio.includes('function toggleSelection'), 'Umschalt+Klick-Mehrfachauswahl fehlt');
assert(studio.includes('function renderMultiSelect'), 'Mehrfachauswahl-Werkzeugleiste fehlt');
assert(studio.includes('function alignSelection'), 'Ausrichten-Funktion für Mehrfachauswahl fehlt');
['left','hcenter','right','top','vcenter','bottom'].forEach(mode => assert(studio.includes(`data-align="${mode}"`), `Ausrichtungsoption fehlt: ${mode}`));
assert(studio.includes('drag={id:ev.pointerId,group:true'), 'Gemeinsames Ziehen mehrerer ausgewählter Objekte fehlt');
assert(studio.includes("selection.size>1) select('slide',stage())"), 'Escape muss die Mehrfachauswahl aufheben');

// Ausrichtungshilfen (Smart Guides)
assert(studio.includes('function smartGuides'), 'Ausrichtungshilfen (Smart Guides) fehlen');
assert(studio.includes('function hideGuides'), 'Ausblenden der Führungslinien fehlt');
assert(css.includes('.kc-smart-guide'), 'CSS für Ausrichtungshilfen fehlt');

// Ebenen-Übersicht
assert(studio.includes('function layersSection'), 'Ebenen-Übersicht fehlt');
assert(studio.includes('function reorderLayer'), 'Ebenen-Umsortierung fehlt');
assert(studio.includes('kc-layer-select') && studio.includes('kc-layer-up') && studio.includes('kc-layer-down'), 'Ebenenliste ohne Auswahl-/Sortier-Bedienelemente');
assert(css.includes('.kc-layers-list'), 'CSS für Ebenen-Übersicht fehlt');

console.log('PASS kc-object-studio-stufe2: Mehrfachauswahl & Ausrichten, Smart Guides, Ebenen-Übersicht');
