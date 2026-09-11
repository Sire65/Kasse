const fs = require('fs');
const assert = require('assert');
const studio = fs.readFileSync('pc-manager/kc-object-studio.js','utf8');
const contextMenu = fs.readFileSync('pc-manager/tv-object-context-menu-v02944.js','utf8');

// Nach langer Fehlersuche festgestellt: das 'click'-Ereignis wurde auf dem Lösch-Knopf aus
// einem nicht abschließend geklärten Grund nicht zuverlässig ausgelöst, während 'pointerup'
// auf demselben Knopf nachweislich (echte OS-Klicks, Chrome DevTools Protocol) zuverlässig
// funktionierte. Bindung bewusst auf das zuverlässige Ereignis umgestellt - darf nicht wieder
// auf 'click' zurückgebaut werden, ohne das erneut live zu prüfen.
assert(studio.includes("container.querySelector('[data-delete-object]')?.addEventListener('pointerup',()=>deleteActive());"),
  'Lösch-Knopf muss an pointerup gebunden sein (click erwies sich als unzuverlässig)');
assert(contextMenu.includes("document.addEventListener('pointerup',e=>{if(e.target.closest('[data-delete-object]'))"),
  'Kontextmenü-Lösch-Auslöser muss ebenfalls an pointerup gebunden sein');

// Entf-/Rücktaste muss in der Capture-Phase erfasst werden, sonst kann ein anderer Bubble-Phase-
// Handler die Taste vorher abfangen.
assert(contextMenu.includes("document.addEventListener('keydown',e=>{if(e.key==='Escape')close();if((e.key==='Delete'||e.key==='Backspace')") &&
  contextMenu.includes("g.KCUnifiedEditor?.deleteActive?.();close()}}},true)"),
  'Entf-/Rücktaste-Behandlung muss in der Capture-Phase registriert sein');

// deleteActive() muss den tatsächlichen Inhalt leeren (nicht nur eine wirkungslose
// Sichtbarkeits-Markierung setzen, die für Titel/Text/Preis/Laufschrift ohnehin nicht geprüft wird).
assert(studio.includes("if(['title','text','price','ticker'].includes(active)){ s[active]=''; }"),
  'deleteActive() muss den echten Inhalt von Titel/Text/Preis/Laufschrift leeren');

console.log('PASS delete-mechanism-fix: Lösch-Knopf/Kontextmenü auf pointerup umgestellt, Entf-Taste in Capture-Phase, echte Inhaltsleerung');
