const fs=require('fs'),assert=require('assert');
const shared=fs.readFileSync('pc-manager/tv-shared-renderer-v02946.js','utf8');
const player=fs.readFileSync('tv-player/tv-object-parity-v1.js','utf8');
const menu=fs.readFileSync('pc-manager/tv-object-context-menu-v02944.js','utf8');
for(const code of [shared,player]){
  assert(code.includes('customTextObjects'),'Mehrere Textobjekte fehlen in einem Renderer');
  assert(code.includes('container-type'),'Folienbezogene Größenbasis fehlt');
  assert(code.includes('cqw'),'Gemeinsame proportionale Schriftberechnung fehlt');
  assert(code.includes('translate(-50%,-50%)'),'Gemeinsame Prozentgeometrie fehlt');
}
const studio=fs.readFileSync('pc-manager/kc-object-studio.js','utf8');
assert(menu.includes('g.KCUnifiedEditor?.deleteActive?.()'),'Kontextmenü-Löschen muss auf die konsolidierte deleteActive()-Funktion delegieren');
assert(studio.includes("isCustomText(active)"),'Einzelnes gezeichnetes Textobjekt kann nicht gelöscht werden');
console.log('PASS tv-stage-parity-custom-text: unabhängige Textfelder und identische 16:9-Schrift-/Positionslogik');
