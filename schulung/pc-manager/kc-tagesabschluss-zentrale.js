// KC Tagesabschluss-Zentrale: fertige Soll/Ist-Paare aus dem PC-Manager zentral bereitstellen.
(function(global){
  'use strict';
  const el=id=>document.getElementById(id);
  const LAST_KEY='kcm_closing_central_last_v1';

  function client(){
    if(typeof global.KCCommunicationClient!=='function')return null;
    return new global.KCCommunicationClient({
      sourceProgram:'kc-bilderrechner',
      getAccessToken:async()=>global.KCSupabase?.holeZugriffsToken?.()||null
    });
  }
  function bridge(){
    const c=client();
    return c&&typeof global.createKCFinanceBridge==='function'?global.createKCFinanceBridge(c):null;
  }
  function status(text,art=''){
    const n=el('closingCentralStatus');if(!n)return;
    n.textContent=text;n.className='tc-status'+(art?(' '+art):'');
  }
  function payloadFuer(row){
    const c=row.closing,k=row.count;
    return {
      closingId:c.closingId,
      countId:k?.countId||k?.transferId||null,
      registerName:c.registerName||null,
      operator:c.operator||null,
      createdAt:c.createdAt||null,
      periodStart:c.periodStart||null,
      periodEnd:c.periodEnd||null,
      cashIn:Number(c.cashIn||0),
      cashSales:Number(c.cashSales||0),
      cashTips:Number(c.cashTips||0),
      cashOut:Number(c.cashOut||0),
      expectedCash:Number(c.expectedCash||0),
      actualCash:Number(row.actual||0),
      difference:Number(row.diff||0),
      staffTotal:Number(c.staffTotal||0),
      staffCount:Number(c.staffCount||0),
      accountSales:Number(c.accountSales||0),
      accountBreakdown:Array.isArray(c.accountBreakdown)?c.accountBreakdown:[],
      totalSales:Number(c.totalSales||0),
      transactionCount:Number(c.transactionCount||0),
      receiptExpected:Number(c.receiptExpected||0),
      note:c.note||'',
      countNote:k?.note||'',
      countInputMode:k?.inputMode||null,
      countKind:k?.countKind||null,
      countedAt:k?.countedAt||k?.time||null,
      countBreakdown:k?.breakdown||{},
      countCoinRolls:k?.coinRolls||{},
      countMeasurements:Array.isArray(k?.measurements)?k.measurements:[]
    };
  }

  async function sync(manuell=false){
    const fb=bridge();
    if(!fb){if(manuell)status('Zentraler Sync nicht bereit – Anmeldung oder Finance-Bridge fehlt.','warn');return {ok:false,count:0};}
    const rows=global.KCClosingCore?.rows?.()||[];
    const fertig=rows.filter(r=>r.count&&r.businessDate&&Number.isFinite(Number(r.actual))&&Number.isFinite(Number(r.diff)));
    if(!fertig.length){if(manuell)status('Noch kein vollständiges Soll/Ist-Paar vorhanden.','');return {ok:true,count:0};}
    let ok=0,fehler=null;
    for(const row of fertig){
      try{
        const c=row.closing;
        const res=await fb.upsertClosingReport({
          correlationId:c.closingId,
          registerId:c.registerId,
          businessDate:row.businessDate,
          expectedCash:Number(c.expectedCash||0),
          actualCash:Number(row.actual||0),
          difference:Number(row.diff||0),
          payload:payloadFuer(row)
        });
        if(!res?.ok)throw new Error(res?.error||'Zentraler Abschluss wurde nicht bestätigt.');
        ok++;
      }catch(e){fehler=e;}
    }
    localStorage.setItem(LAST_KEY,new Date().toISOString());
    if(fehler)status(`${ok} von ${fertig.length} Tagesabschlüssen zentral synchronisiert; Rest wird erneut versucht.`,'warn');
    else status(`${ok} vollständige(r) Tagesabschluss/Tagesabschlüsse zentral synchronisiert.`,'ok');
    return {ok:!fehler,count:ok,total:fertig.length};
  }

  el('closingCentralSync')?.addEventListener('click',()=>sync(true));
  document.querySelectorAll('[data-view="closing"]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>sync(false),400)));
  setTimeout(()=>sync(false),8000);
  global.KCTagesabschlussZentrale={sync};
})(window);
