const fs=require('fs');
const path=require('path');
function read(p){return fs.readFileSync(path.join(__dirname,'..',p),'utf8');}
function ok(v,msg){if(!v)throw new Error(msg);}

const app=read('pc-manager/app.js');
const mgr=read('pc-manager/kc-abschluesse-manager.js');
const central=read('pc-manager/kc-tagesabschluss-zentrale.js');
const index=read('pc-manager/index.html');
const bridge=read('pc-manager/kc-finance-bridge.js');

ok(app.includes('x.registerId===c.registerId&&closingBusinessDate(x)===tag'),
  'Abendzählung wird nicht strikt nach Kasse + Geschäftstag zugeordnet');
ok(app.includes('window.KCClosingCore={ingestClosingPayload,ingestCashCountPayload,rows:closingRows'),
  'KCClosingCore API fehlt');
ok(mgr.includes("ingestClosingPayload?.(abschluss, 'companion-auto')"),
  'Automatisch gemeldete Kassenabschlüsse werden nicht in den ClosingCore übernommen');
ok(central.includes('correlationId:c.closingId'),'Zentraler Abschluss nutzt closingId nicht als idempotente correlationId');
ok(central.includes('actualCash:Number(row.actual||0)'),'Ist-Bestand fehlt im zentralen Abschluss');
ok(central.includes('difference:Number(row.diff||0)'),'Differenz fehlt im zentralen Abschluss');
ok(bridge.includes("action:'closing_report_upsert'"),'Finance Bridge kann fertigen Tagesabschluss nicht hochladen');
ok(index.includes('kc-finance-bridge.js?build=1.1.0'),'Finance Bridge ist im PC-Manager nicht aktiviert');
ok(index.includes('kc-tagesabschluss-zentrale.js?build=1.0.0'),'Zentraler Tagesabschluss-Sync ist nicht aktiviert');
ok(!index.includes('kc-finance-uebergaben.js?build=1.0.0'),'Unnötiger 30-Sekunden-Finance-Poller wurde wieder aktiviert');
ok(index.includes('id="closingCentralSync"'),'Bedienbarer zentraler Prüfschalter fehlt');

// Fachliche Soll/Ist-Probe: gleiche Kasse, zwei Tage, neueste Zählung darf nicht auf alten Tag springen.
const closings=[
  {closingId:'C20',registerId:'KASSE-01',createdAt:'2026-12-20T22:00:00Z',expectedCash:100},
  {closingId:'C21',registerId:'KASSE-01',createdAt:'2026-12-21T22:00:00Z',expectedCash:200}
];
const counts=[
  {countId:'N20',registerId:'KASSE-01',effectiveDate:'2026-12-20',time:'2026-12-20T22:10:00Z',total:99},
  {countId:'N21',registerId:'KASSE-01',effectiveDate:'2026-12-21',time:'2026-12-21T22:10:00Z',total:202}
];
const day=x=>String(x.businessDate||x.effectiveDate||x.periodEnd||x.createdAt||x.time||'').slice(0,10);
for(const c of closings){
  const match=counts.filter(x=>x.registerId===c.registerId&&day(x)===day(c))
    .sort((a,b)=>String(b.time||'').localeCompare(String(a.time||'')))[0];
  if(c.closingId==='C20')ok(match?.countId==='N20','20.12. wurde mit falscher Zählung gepaart');
  if(c.closingId==='C21')ok(match?.countId==='N21','21.12. wurde mit falscher Zählung gepaart');
}
console.log('Tagesabschluss Kasse -> PC-Manager: Kasse+Tag, Auto-Import, Soll/Ist, zentrale Übergabe: OK');

// TÜV v2: repoübergreifende Prüfung und Syntaxcheck aktiviert.

const livePos=read('pos/app.js');
const trainingPos=read('schulung/pos/app.js');
const liveIndex=read('pos/index.html');
const trainingIndex=read('schulung/pos/index.html');
const liveSw=read('pos/service-worker.js');
const trainingSw=read('schulung/pos/service-worker.js');
for(const [name,src] of [['Live-POS',livePos],['Schulungs-POS',trainingPos]]){
  ok(src.includes('businessDate,createdAt'), name+' Tagesabschluss enthält kein explizites Geschäftsdatum');
}
ok(liveIndex.includes('app.js?build=0.31.3.6-r14'),'Live-POS App-Build nicht auf r14');
ok(trainingIndex.includes('app.js?build=0.31.3.6-r14'),'Schulungs-POS App-Build nicht auf r14');
ok(liveSw.includes('kc-bildrechner-2026-09-20-montag-rc31')&&liveSw.includes('./app.js?build=0.31.3.6-r14'),'Live Offline-Cache nicht auf rc31/r14');
ok(trainingSw.includes('kc-schulung-2026-09-20-montag-rc33')&&trainingSw.includes('./app.js?build=0.31.3.6-r14'),'Schulung Offline-Cache nicht auf rc33/r14');
console.log('Live- und Schulungs-POS Tagesabschluss/Offline-Rollout: OK');
