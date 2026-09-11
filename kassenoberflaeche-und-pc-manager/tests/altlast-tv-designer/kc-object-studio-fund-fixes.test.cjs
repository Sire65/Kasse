const fs = require('fs');
const assert = require('assert');
const studio = fs.readFileSync('pc-manager/kc-object-studio.js','utf8');
const matrix = fs.readFileSync('pc-manager/tv-display-matrix-adapter.js','utf8');

// Wetter-Sichtbarkeit: die tatsächliche Anzeige-Logik prüft slide.type==='weather',
// nicht objectVisibility.weather - beim Einfügen/Löschen muss beides zusammenspielen.
assert(studio.includes("s.type='weather'"), 'Einfügen von Wetter muss den Folientyp setzen, sonst erscheinen die Wetterkarten nie');
assert(studio.includes("if(s.type==='weather') s.type='notice';"), 'Löschen von Wetter muss den Folientyp zurücksetzen');

// Laufschrift-Inhaltsquelle: Wetter/Programm/kombiniert müssen den tatsächlich
// angezeigten Text (s.ticker) auflösen, nicht nur die Einstellung speichern.
assert(studio.includes('function weatherTickerText'), 'Wetter-Auflösung für die Laufschrift fehlt');
assert(studio.includes('function programTickerText'), 'Programm-Auflösung für die Laufschrift fehlt');
assert(studio.includes('function resolveTickerText'), 'Zentrale Inhaltsquellen-Auflösung fehlt');
assert(studio.includes('refreshTickerContent(s)'), 'Auffrischung muss beim Folienwechsel/Quellenwechsel aufgerufen werden');

// Symbol-System vereinheitlicht: Werkzeugkasten steuert das tatsächlich sichtbare,
// einzeln verschiebbare System statt eines unsichtbaren Sammel-Blocks.
assert(studio.includes('function symbolObjects'), 'Zugriff auf die platzierten Symbol-Instanzen fehlt');
assert(studio.includes('kc-symbols-list'), 'Liste der platzierten Symbole im Werkzeugkasten fehlt');
assert(studio.includes("st.addEventListener('click',event=>{ const node=event.target.closest('.kc-symbol-object')"),
  'Klick auf ein platziertes Symbol muss den Werkzeugkasten öffnen (die alte Sammelfläche ist unsichtbar)');
assert(!studio.includes('data-symbols="list"'), 'Alte, wirkungslose Sammel-Steuerung für Symbole muss entfernt sein');

// Echter, unabhängiger Programmfehler in der LED-Matrix-Erweiterung: eine Variable
// wurde in einer Funktion benutzt, aber nur in einer ganz anderen deklariert.
assert(matrix.includes('var cfg = state(), position = layoutState();\n    root.querySelectorAll'),
  'position-Variable muss auch in panel() deklariert sein, sonst Laufzeitfehler bei jeder Laufschrift-Auswahl');

console.log('PASS kc-object-studio-fund-fixes: Wetter-Sichtbarkeit, Laufschrift-Inhaltsquelle, vereinheitlichtes Symbol-System, LED-Matrix-Fehler behoben');
