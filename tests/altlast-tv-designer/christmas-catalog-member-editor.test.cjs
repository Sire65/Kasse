const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const contentSource=fs.readFileSync('tv-content/weihnachtsmarkt-2026/presentation.js','utf8');
const integrationSource=fs.readFileSync('pc-manager/tv-weihnachtsmarkt-presentation.js','utf8');
const storage=new Map();
const document={
  readyState:'loading',
  body:{dataset:{},addEventListener(){}},
  addEventListener(){},
  getElementById(){return null},
  querySelectorAll(){return[]},
  querySelector(){return null}
};
const localStorage={
  getItem:key=>storage.get(key)||null,
  setItem:(key,value)=>storage.set(key,value)
};
const sandbox={window:{localStorage},localStorage,document,MutationObserver:class{observe(){}},setTimeout(){},confirm(){return true},alert(){}};
vm.createContext(sandbox);
vm.runInContext(contentSource,sandbox);

const presentation=sandbox.window.KC_WEIHNACHTSMARKT_PRESENTATION.create();
presentation.slides=publication27(presentation.slides);
delete presentation.source.catalogContentVersion;
let saves=0;
const managerArticles=[
  {id:'grot',name:'Roter Winzerglühwein',price:3.5,info:{shortDescription:'Heißer Winzerglühwein aus roten Trauben'}},
  {id:'gweiss',name:'Weißer Winzerglühwein',price:3.4},
  {id:'feuer',name:'Feuerzangenbowle',price:6},
  {id:'eier',name:'Eierlikörpunsch à la Köcheclub',price:4.5}
];
vm.runInContext(`let articles=${JSON.stringify(managerArticles)}`,sandbox);
Object.assign(sandbox.window,{
  KCGetTVPresentation:()=>presentation,
  saveTvPresentation:()=>{saves++},
  renderTvSlideList(){},
  loadTvEditor(){},
  renderTvPreview(){}
});
vm.runInContext(integrationSource,sandbox);

const count=sandbox.window.KCWeihnachtsmarktPresentation.replaceCatalogSlides();
assert.equal(count,4);
assert.equal(presentation.slides.length,28);
assert.equal(presentation.slides.slice(24,28).map(slide=>slide.contentKey).join('|'),'prices-alcoholic|prices-non-alcoholic|prices-food|recipe-eggnog-punch');
assert.equal(presentation.source.catalogContentVersion,'1.2.0');
assert.ok(storage.has('kcm_tv_backup_before_catalog_1_2_0'));
assert.equal(saves,1);

const drinks=presentation.slides[24];
sandbox.window.KCWeihnachtsmarktPresentation.syncCatalogTable(drinks);
assert.equal(drinks.tableObject.rows[1][0],'Roter Winzerglühwein');
assert.equal(drinks.tableObject.rows[1][1],'Heißer Winzerglühwein aus roten Trauben');
assert.equal(drinks.tableObject.rows[1][2],'3,50 €');
assert.equal(drinks.tableObject.rows[4][2],'4,50 €');
assert.match(integrationSource,/typeof articles!==["']undefined["']/);
assert.match(integrationSource,/18 Mitglieder und Sprüche/);
assert.match(integrationSource,/data-quote-up/);
assert.match(integrationSource,/data-member-quote/);

function publication27(slides){
  const copy=slides.slice(0,27);
  copy[24]={id:'wm26-025',title:'Eierlikörpunsch',text:'Altes Rezept'};
  copy[25]={id:'wm26-026',title:'Getränke',text:'Alte Preisliste'};
  copy[26]={id:'wm26-027',title:'Speisen',text:'Alte Speisen'};
  return copy;
}

console.log('PASS christmas-catalog-member-editor: vier Folien migrationsfähig, Managerpreise synchron und Sprüche zentral neu zuordenbar');
