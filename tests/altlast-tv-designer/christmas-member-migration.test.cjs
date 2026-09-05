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
delete presentation.source.memberContentVersion;
presentation.slides[1].media.dataUrl='../avatar-core/assets/chef/chef_male_wave.webp';
presentation.slides.slice(2,20).forEach((slide,index)=>{
  slide.title=`Alter Name ${index+1}`;
  slide.text='Alter gleicher Spruch';
  slide.media.dataUrl=index%2?'old-female.webp':'old-male.webp';
});
let saves=0;
Object.assign(sandbox.window,{
  KCGetTVPresentation:()=>presentation,
  saveTvPresentation:()=>{saves++},
  renderTvSlideList(){},
  loadTvEditor(){},
  renderTvPreview(){}
});
vm.runInContext(integrationSource,sandbox);

const count=sandbox.window.KCWeihnachtsmarktPresentation.replaceMemberSlides();
assert.equal(count,19);
assert.equal(presentation.slides[1].media.dataUrl,'../tv-content/weihnachtsmarkt-2026/members/gruppenfoto-koecheclub.jpg');
assert.equal(presentation.slides[2].title,'Frank Brösel');
assert.equal(presentation.slides[11].title,'Manfred Schoppmann');
assert.equal(presentation.slides[12].title,'Reinhilde Eggenstein');
assert.equal(presentation.slides[13].title,'Thomas Hess');
assert.equal(presentation.slides[14].title,'Christina Brösel');
assert.equal(new Set(presentation.slides.slice(2,20).map(slide=>slide.text)).size,18);
assert.equal(presentation.source.memberContentVersion,'1.3.0');
assert.equal(saves,1);
assert.ok(storage.has('kcm_tv_backup_before_members_1_3_0'));

presentation.slides[2].text='Eigene spätere Änderung';
assert.equal(sandbox.window.KCWeihnachtsmarktPresentation.replaceMemberSlides(),0);
assert.equal(presentation.slides[2].text,'Eigene spätere Änderung');
assert.equal(saves,1);

assert.equal(sandbox.window.KCWeihnachtsmarktPresentation.replaceMemberSlides({force:true}),19);
assert.notEqual(presentation.slides[2].text,'Eigene spätere Änderung');
assert.equal(saves,2);
console.log('PASS christmas-member-migration: alter Speicherstand wird einmalig ersetzt, spätere Bearbeitung geschützt, manueller Neuabgleich möglich');
