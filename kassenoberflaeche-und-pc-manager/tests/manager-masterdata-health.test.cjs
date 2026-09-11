const fs=require('fs'),assert=require('assert');
const code=fs.readFileSync('pc-manager/manager-masterdata-health-v02949.js','utf8'),html=fs.readFileSync('pc-manager/index.html','utf8'),css=fs.readFileSync('pc-manager/styles.css','utf8');
['fillLabels','labelArticle','kc-group-color-preview','Farbe übernehmen','data-cmd="import"','Warengruppen','Artikel','KCMasterdataButtonAudit'].forEach(value=>assert(code.includes(value),`Stammdatenfunktion fehlt: ${value}`));
assert(html.includes('manager-masterdata-health-v02949.js'),'Stammdatenstabilisierung nicht eingebunden');
assert(css.includes('--group-live-color'),'Live-Farbvorschau fehlt');
for(const id of ['groupToolbar','articleToolbar'])assert(html.includes(`id="${id}"`),`${id} fehlt`);
console.log('PASS manager-masterdata-health: Live-Farbe, Übernahme, Import, Buttonaudit und Etikettenartikel');
