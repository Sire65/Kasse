const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync('pc-manager/index.html','utf8');
const studio = fs.readFileSync('pc-manager/kc-object-studio.js','utf8');
const app = fs.readFileSync('pc-manager/app.js','utf8');
const weihnachtsmarkt = fs.readFileSync('pc-manager/tv-weihnachtsmarkt-presentation.js','utf8');
const workflow = fs.readFileSync('pc-manager/tv-editor-workflow.js','utf8');
const contextMenu = fs.readFileSync('pc-manager/tv-object-context-menu-v02944.js','utf8');
const customText = fs.readFileSync('pc-manager/tv-custom-text-editor-v02954.js','utf8');

// Ursprünglicher Fehler: die Weihnachtsmarkt-Hintergrundkarte wurde unabhängig vom gewählten
// Objekt immer oben in den Werkzeugkasten eingefügt. Jetzt nur noch, wenn die Folie/der
// Hintergrund tatsächlich ausgewählt ist.
assert(weihnachtsmarkt.includes('activeIsSlide') && weihnachtsmarkt.includes('data-active-object="slide"'),
  'Hintergrund-Karte muss an die Folien-Auswahl gebunden sein');

// Die abgelösten ~10 Dateien dürfen nicht mehr geladen werden, das neue Modul schon.
const retired = ['tv-unified-editor.js','tv-content-object-core-v02940.js','tv-context-inspector-v02942.js',
  'tv-repair60-consolidation.js','tv-context-effect-fix.js','tv-object-productivity-v02941.js',
  'tv-object-library-v02945.js','tv-draw-textbox-v02948.js','tv-draw-ticker-v02957.js'];
retired.forEach(name => assert(!html.includes(`src="${name}"`), `Abgelöste Datei ist noch eingebunden: ${name}`));
assert(html.includes('src="kc-object-studio.js"'), 'Objekt-Studio ist nicht eingebunden');

// Zusätzlich gefundene Altlasten in app.js: ein zweites, unkoordiniertes Positions-Werkzeug
// musste dynamisch (nicht nur bei Registrierung) auf die Abschaltung reagieren, da es vor
// dem neuen Modul geladen wird.
assert((app.match(/if\(window\.KC_DISABLE_LEGACY_TV_EDITORS\)return;/g)||[]).length >= 3,
  'Alt-Renderer in app.js müssen die Abschaltung an mehreren Stellen dynamisch prüfen');
assert(studio.includes("global.KC_DISABLE_LEGACY_TV_EDITORS = true;") && studio.indexOf("global.KC_DISABLE_LEGACY_TV_EDITORS = true;") < studio.indexOf('DOMContentLoaded'),
  'Abschalt-Flag muss synchron vor jeglicher DOMContentLoaded-Logik gesetzt werden (Ladereihenfolge!)');

// Nur noch ein Rechtsklick-Kontextmenü statt zwei konkurrierenden.
assert(!workflow.includes("addEventListener('contextmenu'"), 'Zweites, konkurrierendes Kontextmenü muss entfernt sein');
assert(contextMenu.includes("addEventListener('contextmenu'"), 'Das verbleibende Kontextmenü muss vorhanden sein');
assert(contextMenu.includes('KCUnifiedEditor'), 'Kontextmenü muss weiterhin über die (jetzt aliasierte) KCUnifiedEditor-Schnittstelle arbeiten');
assert(studio.includes('global.KCUnifiedEditor = global.KCObjectStudio'), 'Rückwärtskompatibilitäts-Alias fehlt');

// Frei aufgezogene Textfelder müssen beim Anklicken den Werkzeugkasten öffnen.
assert(customText.includes('KCObjectStudio?.select?.'), 'Klick auf freies Textfeld öffnet den Werkzeugkasten nicht');

console.log('PASS kc-object-studio-consolidation: Ursprungsfehler behoben, Alt-Renderer sauber abgeschaltet, ein Kontextmenü, freie Textfelder wählbar');
