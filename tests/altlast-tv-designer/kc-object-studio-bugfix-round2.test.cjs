const fs = require('fs');
const assert = require('assert');
const studio = fs.readFileSync('pc-manager/kc-object-studio.js','utf8');
const contextMenu = fs.readFileSync('pc-manager/tv-object-context-menu-v02944.js','utf8');
const workflow = fs.readFileSync('pc-manager/tv-editor-workflow.js','utf8');

// KRITISCH: an mindestens einem Dutzend Stellen im Programm (Folienwechsel, neue Folie,
// Duplizieren, Löschen, Verschieben, Vorlagen, Import, Undo/Redo, jeder Foliensprung im
// Testlauf) wird window.KCUnifiedEditor.renderProperties() aufgerufen. Fehlt diese Methode,
// wirft praktisch jede dieser Aktionen einen Laufzeitfehler.
assert(studio.includes('renderProperties:render'), 'renderProperties-API fehlt - verursacht Laufzeitfehler bei jedem Folienwechsel');

// Auswahlfelder müssen den tatsächlich gespeicherten Wert zeigen, nicht immer die erste Option.
const rawSelectsWithoutSync = studio.match(/<select data-(surface|frame|image)="[a-zA-Z]+">\s*<option/g);
assert(!rawSelectsWithoutSync, 'Auswahlfeld ohne Wertsynchronisation gefunden (zeigt immer die erste Option statt des gespeicherten Werts)');
['surfaceMode','line','fit'].forEach(field => {
  assert(studio.includes(`options([['`) , 'options()-Hilfsfunktion muss für dropdown-Werte verwendet werden');
});

// Löschen (Tastatur, Kontextmenü, Werkzeugkasten-Button) muss einheitlich über die eine,
// vollständige deleteActive()-Funktion laufen (die selbst die Auswahl auf die Folie
// zurücksetzt), statt über eine zweite, unvollständige Implementierung im Kontextmenü.
assert(contextMenu.includes('g.KCUnifiedEditor?.deleteActive?.()'), 'Kontextmenü-Löschen (Tastatur, Klick, Rechtsklick-Menü) muss auf die eine konsolidierte deleteActive()-Funktion umleiten');
assert(!contextMenu.includes('function remove('), 'Die zweite, unvollständige Lösch-Implementierung darf nicht mehr vorhanden sein');
assert(studio.includes("s[active]=''"), 'deleteActive() muss den tatsächlichen Inhalt von Titel/Text/Preis/Laufschrift leeren, nicht nur eine Sichtbarkeits-Markierung setzen, die für diese Typen ohnehin nicht geprüft wird');
assert(!workflow.includes("(e.key==='Delete'||e.key==='Backspace')"), 'Doppelte Del-Taste-Behandlung muss entfernt sein (verursachte inkonsistentes Löschen)');

// Ziehen/Skalieren darf während der Bewegung keine layoutauslösenden Eigenschaften
// (Rahmen/Fläche: border, padding, background) neu berechnen - nur Position/Größe/Drehung
// per günstiger CSS-Transform-Eigenschaft.
assert(studio.includes('function applyGeometry'), 'Leichtgewichtige Geometrie-Anwendung für flüssiges Ziehen fehlt');
assert(studio.includes('applyGeometry(d.node,p); syncGeometry();'), 'Ziehen muss die leichtgewichtige Variante nutzen, nicht die volle Rahmen/Fläche-Neuberechnung');

// Änderungen an Text/Rahmen/Fläche/Laufschrift müssen auch die tatsächliche TV-Bühne erreichen.
['[data-text]','[data-frame]','[data-surface]','[data-ticker]'].forEach(sel => {
  const idx = studio.indexOf(`container.querySelectorAll('${sel}')`);
  assert(idx > -1, `Bindung fehlt: ${sel}`);
  const snippet = studio.slice(idx, idx + 700);
  assert(snippet.includes('renderTvPreview'), `${sel}-Änderungen erreichen die TV-Bühne nicht`);
});

console.log('PASS kc-object-studio-bugfix-round2: renderProperties-API, Dropdown-Werte, konsistentes Löschen, flüssiges Ziehen, TV-Bühnen-Sync');
