/* KC PC-Manager – Präsentationsdaten-Adapter 04.09.2026
   Liest die Kassenbuchungen aus kc_transactions_v040, erkennt den Demo-Batch
   PRAESENTATION-2026-09-04 und stellt aggregierte Kennzahlen für den Manager bereit.
   Keine produktiven Daten werden verändert. */
(function(){
  'use strict';
  const TX_KEY='kc_transactions_v040';
  const BACKUP_KEY='kc_presentation_demo_backup_20260904';
  const BATCH_ID='PRAESENTATION-2026-09-04';

  function rows(){
    try{const value=JSON.parse(localStorage.getItem(TX_KEY)||'[]');return Array.isArray(value)?value:[]}catch{return []}
  }
  function demoRows(){return rows().filter(r=>r&&r.demoBatchId===BATCH_ID)}
  function money(v){return Number(v||0)}
  function keyDate(v){const d=new Date(v);return Number.isNaN(d.getTime())?'unbekannt':d.toLocaleDateString('de-DE')}
  function keyHour(v){const d=new Date(v);return Number.isNaN(d.getTime())?'?':String(d.getHours()).padStart(2,'0')+':00'}
  function add(map,key,value){map[key]=(map[key]||0)+value}
  function sortedObject(map){return Object.fromEntries(Object.entries(map).sort((a,b)=>b[1]-a[1]))}

  function aggregate(source=demoRows()){
    const byDay={},byHour={},byProduct={},qtyByProduct={},byCategory={},byRegister={},byOperator={};
    let revenue=0,items=0,deposits=0,returns=0,minTime=null,maxTime=null;
    for(const tx of source){
      const due=money(tx.due??tx.total);revenue+=due;
      const time=tx.endTime||tx.time||tx.startTime;
      add(byDay,keyDate(time),due);add(byHour,keyHour(time),due);
      add(byRegister,tx.registerName||tx.registerId||'Kasse',due);add(byOperator,tx.operator||'Unbekannt',due);
      const ms=new Date(time).getTime();if(Number.isFinite(ms)){minTime=minTime===null?ms:Math.min(minTime,ms);maxTime=maxTime===null?ms:Math.max(maxTime,ms)}
      for(const item of (tx.items||[])){
        const qty=Number(item.qty||0),line=money(item.lineTotal??(money(item.price)*qty));
        items+=Math.max(0,qty);
        add(byProduct,item.name||item.id||'Artikel',line);add(qtyByProduct,item.name||item.id||'Artikel',qty);
        add(byCategory,item.category||'Sonstiges',line);
        if(item.category==='Pfand'||/pfand/i.test(item.name||'')){if(line<0)returns+=Math.abs(line);else deposits+=line}
      }
    }
    const count=source.length;
    return {
      batchId:BATCH_ID,isDemo:count>0,count,revenue:+revenue.toFixed(2),averageReceipt:count?+(revenue/count).toFixed(2):0,
      itemCount:items,deposits:+deposits.toFixed(2),depositReturns:+returns.toFixed(2),
      period:{from:minTime?new Date(minTime).toISOString():null,to:maxTime?new Date(maxTime).toISOString():null},
      byDay:sortedObject(byDay),byHour:sortedObject(byHour),byProduct:sortedObject(byProduct),qtyByProduct:sortedObject(qtyByProduct),
      byCategory:sortedObject(byCategory),byRegister:sortedObject(byRegister),byOperator:sortedObject(byOperator),
      backupPresent:!!localStorage.getItem(BACKUP_KEY)
    };
  }

  function status(){const all=rows(),demo=demoRows(),stats=aggregate(demo);return {...stats,totalStored:all.length,realStored:all.length-demo.length}}
  function dispatch(){window.dispatchEvent(new CustomEvent('kc-presentation-data-changed',{detail:status()}))}
  window.addEventListener('storage',e=>{if(e.key===TX_KEY||e.key===BACKUP_KEY)dispatch()});

  window.KCPresentationDemoAdapter=Object.freeze({TX_KEY,BACKUP_KEY,BATCH_ID,rows,demoRows,aggregate,status,refresh:dispatch});
  dispatch();
})();
