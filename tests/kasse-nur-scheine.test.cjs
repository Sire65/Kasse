// KC-KASSE-NUR-SCHEINE (20.11.2026, Wunsch Hansi: „Knopf nur Scheine zählen und ein Klickkästchen: Münzen und Rollen werden später gezählt“)
// Aufruf: node tests/kasse-nur-scheine.test.cjs
const fs=require('fs'),path=require('path'),vm=require('vm');
const read=(p)=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const ok=(v,msg)=>{if(!v)throw new Error(msg);};
const ui=read('shared/kc-closing-count-ui.js'),css=read('shared/kc-closing-count-ui.css');
for(const p of ['pos/index.html','schulung/pos/index.html']){
  const h=read(p);
  ok(h.includes('data-closing-count-mode="notes">💶 Nur Scheine zählen</button>'),p+': Knopf „💶 Nur Scheine zählen“ fehlt');
  ok(h.includes('kc-closing-count-ui.js?build=1.1.0'),p+': neue Version der Zähl-Oberfläche wird nicht geladen');
}
for(const p of ['pos/service-worker.js','schulung/pos/service-worker.js'])ok(read(p).includes('kc-closing-count-ui.js?build=1.1.0'),p+': Zwischenspeicher kennt die neue Version nicht');
ok(read('schulung/shared/kc-closing-count-ui.js')===ui,'Schulungs-Kopie der Zähl-Oberfläche weicht ab');
ok(/\['defer','notes','count','weigh'\]\.includes\(next\)/.test(ui),'Modus „notes“ fehlt');
ok(ui.includes('id="closingCoinsLater"')&&ui.includes('Münzen und Rollen werden später gezählt'),'Kästchen „Münzen und Rollen werden später gezählt“ fehlt');
ok(/if\(mode==='notes'\)muenzenSpaeter=true;/.test(ui),'„Nur Scheine“ beginnt nicht mit „Münzen und Rollen später“');
ok(ui.includes("...(nurScheine?{scope:'notes',coinsLater:true,partial:true,notesTotal:data.total}:{})"),'Zählung trägt „Münzen später“ nicht weiter');
ok(ui.includes("inputMode:mode==='notes'?(nurScheine?'notes':'count'):mode"),'Kästchen aus muss eine normale Zählung ergeben');
ok(ui.includes('Bitte die Anzahl der Scheine eintragen'),'verständliche Meldung bei leerer Scheinzählung fehlt');
ok(ui.includes("const type=n.dataset.closingCount||(n.dataset.closingRoll?'roll':n.dataset.closingWeight);"),'Zeilenbeträge je Schein/Münze stehen wieder auf 0,00 €');
ok(/\.closing-coins-later\{[^}]*font-weight:900/.test(css)&&/\.closing-coins-later input\{width:26px;height:26px/.test(css),'Kästchen nicht groß genug');
// PC-Manager: „nur Scheine“ ergibt KEINE Differenz (sonst fehlte scheinbar das Münzgeld), spätere Vollzählung ersetzt sie
for(const p of ['pc-manager/app.js','schulung/pc-manager/app.js']){
  const m=read(p),start=m.indexOf('function closingRows(){'),ende=m.indexOf('window.KCClosingCore=',start);
  ok(start>0&&ende>start,p+': closingRows nicht gefunden');
  const ctx={closings:[{closingId:'C1',registerId:'K1',businessDate:'2026-11-20',expectedCash:500}],cashCounts:[],closingBusinessDate:(x)=>x.businessDate};
  vm.createContext(ctx);vm.runInContext(m.slice(start,ende)+';this.closingRows=closingRows;',ctx);
  ctx.cashCounts.push({registerId:'K1',businessDate:'2026-11-20',total:420,inputMode:'notes',coinsLater:true,time:'2026-11-20T22:00:00Z'});
  let r=ctx.closingRows()[0];
  ok(r.nurScheine===true&&r.actual===420&&r.diff===null,p+': nur Scheine darf keine Differenz ergeben: '+JSON.stringify({n:r.nurScheine,a:r.actual,d:r.diff}));
  ctx.cashCounts.push({registerId:'K1',businessDate:'2026-11-20',total:498.5,inputMode:'count',countKind:'late',time:'2026-11-21T09:00:00Z'});
  r=ctx.closingRows()[0];
  ok(r.nurScheine===false&&r.diff===-1.5,p+': spätere vollständige Zählung muss die Differenz liefern');
  ok(m.includes('r.nurScheine?"Nur Scheine gezählt · Münzen/Rollen offen"'),p+': Anzeige „Münzen/Rollen offen“ fehlt');
  ok(m.includes('Münzen/Rollen noch zählen (Money Butler, Nachzählung)'),p+': Hinweis in den offenen Abschlüssen fehlt');
}
ok(read('pc-manager/kc-tagesabschluss-zentrale.js').includes('Number.isFinite(Number(r.diff))'),'Zentrale darf halbe Zählungen nicht als fertig melden');
console.log('Kasse „Nur Scheine zählen“ + „Münzen und Rollen später“: OK');
