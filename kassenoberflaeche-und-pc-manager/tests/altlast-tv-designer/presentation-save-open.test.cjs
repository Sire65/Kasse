const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('pc-manager/index.html', 'utf8');
assert(html.includes('id="tvSaveAs"') && html.includes('id="tvOpenFile"') && html.includes('id="tvOpenFileInput"'),
  'Speichern-unter-/Öffnen-Bedienelemente fehlen');
assert(html.includes('presentation-save-open.js'), 'Speichern-unter/Öffnen-Modul ist nicht eingebunden');

const code = fs.readFileSync('pc-manager/presentation-save-open.js', 'utf8');
assert(code.includes('showSaveFilePicker'), 'Speichern-unter muss die moderne Datei-API nutzen');
assert(code.includes('showOpenFilePicker'), 'Öffnen muss die moderne Datei-API nutzen');
assert(code.includes("global.download?.(suggestedName, payload)"), 'Rückfall auf den bekannten Download fehlt, falls die Datei-API nicht verfügbar ist');
assert(code.includes("document.getElementById('tvOpenFileInput')?.click()"), 'Rückfall auf klassische Dateiauswahl fehlt, falls die Datei-API nicht verfügbar ist');
assert(code.includes("err.name === 'AbortError'"), 'Abbruch durch den Nutzer muss sauber behandelt werden, ohne störende Fehlermeldung');

// Regressionsschutz: tvPresentation/tvSlideIndex sind in app.js mit "let" deklariert und
// hängen sich NICHT an window - ein Zugriff über "global.tvPresentation" liest/schreibt eine
// nutzlose Kopie, während der Manager intern weiter mit der echten Variable arbeitet. Das
// führte dazu, dass "Öffnen" scheinbar erfolgreich lief, aber keine Folie tatsächlich
// wechselte. Muss als bloße Kennung (bare identifier) angesprochen werden.
assert(!code.includes('global.tvPresentation'), 'tvPresentation ist mit let deklariert und darf nicht über global./window angesprochen werden');
assert(!code.includes('global.tvSlideIndex'), 'tvSlideIndex ist mit let deklariert und darf nicht über global./window angesprochen werden');
assert(code.includes('tvPresentation = data') && code.includes('tvSlideIndex = 0'), 'Öffnen muss die echte tvPresentation/tvSlideIndex-Variable direkt zuweisen');

console.log('PASS presentation-save-open: Speichern unter und Öffnen mit Rückfallebene vorhanden');
