(function(global){
  'use strict';

  const POLL_MS=15000;
  const LAST_ERROR_KEY='kcm_money_butler_cloud_last_error_v1';
  let running=false;

  function cfg(){
    try{return JSON.parse(localStorage.getItem('kcm_sync')||'{}')||{};}catch{return {};}
  }
  function token(){
    const c=cfg();
    return String(global.KC_COMMUNICATION_ACCESS_TOKEN||c.token||'').trim();
  }
  function client(){
    const c=cfg(),t=token();
    if(!t||typeof global.KCCommunicationClient!=='function')return null;
    return new global.KCCommunicationClient({
      baseUrl:c.url||undefined,
      publishableKey:c.publicKey||undefined,
      sourceProgram:'kc-money-butler',
      getAccessToken:async()=>t,
      defaultTestOnly:false
    });
  }
  function decodeRow(row){
    const p=row?.payload?.cashPayload;
    if(!p||p.format!=='KC_CASH_TRANSFER')throw new Error('Finance-Bridge-Datensatz enthält keinen KC_CASH_TRANSFER.');
    const copy=JSON.parse(JSON.stringify(p)),supplied=copy.checksum;delete copy.checksum;
    if(!supplied||typeof checksum!=='function'||checksum(JSON.stringify(copy))!==supplied)throw new Error('Prüfsumme der Cloud-Geldübergabe ist falsch.');
    if(!p.transferId||String(p.transferId).length>128)throw new Error('Transfer-ID der Cloud-Geldübergabe ist ungültig.');
    if(!['opening','topup'].includes(p.type))throw new Error('Vorgangsart der Cloud-Geldübergabe ist ungültig.');
    if(!Number.isFinite(Number(p.total))||Number(p.total)<=0)throw new Error('Betrag der Cloud-Geldübergabe ist ungültig.');
    if(!isBusinessDate(p.effectiveDate))throw new Error('Einsatzdatum der Cloud-Geldübergabe ist ungültig.');
    if(Math.abs(Number(row.amount||0)-Number(p.total))>.009)throw new Error('Cloud-Betrag und Money-Butler-Datensatz stimmen nicht überein.');
    return p;
  }
  async function mark(c,id,status){
    return c._request('kc-finance-bridge',{action:'cash_transfer_mark',id,status});
  }
  function decodeCountRow(row){
    const p=row?.payload;
    if(!p||p.format!=='KC_CASH_COUNT')throw new Error('Finance-Bridge-Datensatz enthält keine KC_CASH_COUNT.');
    const copy=JSON.parse(JSON.stringify(p)),supplied=copy.checksum;delete copy.checksum;
    if(!supplied||typeof checksum!=='function'||checksum(JSON.stringify(copy))!==supplied)throw new Error('Prüfsumme der Cloud-Zählung ist falsch.');
    if(!p.countId||String(p.countId).length>128)throw new Error('Zählungs-ID ist ungültig.');
    if(!p.registerId)throw new Error('Kasse der Cloud-Zählung fehlt.');
    if(!isBusinessDate(p.effectiveDate))throw new Error('Geschäftstag der Cloud-Zählung ist ungültig.');
    if(!Number.isFinite(Number(p.total))||Number(p.total)<0)throw new Error('Ist-Bestand der Cloud-Zählung ist ungültig.');
    if(Math.abs(Number(row.actual_cash||0)-Number(p.total))>.009)throw new Error('Cloud-Istbestand und Money-Butler-Zählung stimmen nicht überein.');
    return p;
  }
  async function markCount(c,id){
    return c._request('kc-finance-bridge',{action:'cash_count_mark',id,status:'manager_received'});
  }
  async function pollCounts(c){
    const data=await c._request('kc-finance-bridge',{action:'cash_count_list',statuses:['pending_manager'],limit:100});
    const items=Array.isArray(data?.items)?data.items:[];
    for(const row of items){
      try{
        const payload=decodeCountRow(row);
        global.KCClosingCore?.ingestCashCountPayload?.(payload,'communicator-cloud');
        await markCount(c,row.id);
        localStorage.removeItem(LAST_ERROR_KEY);
        const status=document.getElementById('communicatorCashResult');
        if(status)status.textContent=`${payload.countKind==='late'?'Nachzählung':'Abendzählung'} automatisch übernommen: ${Number(payload.total).toLocaleString('de-DE',{style:'currency',currency:'EUR'})} · ${payload.registerId} · Abschluss vom ${payload.effectiveDate}. Keine Geldbewegung erzeugt.`;
      }catch(e){
        localStorage.setItem(LAST_ERROR_KEY,JSON.stringify({at:new Date().toISOString(),id:row?.id||null,error:String(e?.message||e),kind:'cash-count'}));
        console.warn('Money-Butler Cloud-Zählung noch nicht übernommen:',e?.message||e);
      }
    }
  }
  async function poll(){
    if(running)return;
    const c=client();if(!c)return;
    running=true;
    try{
      const data=await c._request('kc-finance-bridge',{
        action:'cash_transfer_list',
        statuses:['pending_manager','manager_received'],
        limit:100
      });
      const items=Array.isArray(data?.items)?data.items:[];
      for(const row of items){
        try{
          const payload=decodeRow(row);
          if(row.status==='pending_manager')await mark(c,row.id,'manager_received');
          await queueCashTransferPayload(payload);
          await mark(c,row.id,'handed_to_register');
          localStorage.removeItem(LAST_ERROR_KEY);
          const status=document.getElementById('communicatorCashResult');
          if(status)status.textContent=`KC Communicator automatisch übernommen: ${Number(payload.total).toLocaleString('de-DE',{style:'currency',currency:'EUR'})} → ${payload.scope==='split'||payload.scope==='shared'?(payload.registerIds||[]).join(' und '):payload.registerId}. An Kasse weitergegeben.`;
        }catch(e){
          localStorage.setItem(LAST_ERROR_KEY,JSON.stringify({at:new Date().toISOString(),id:row?.id||null,error:String(e?.message||e)}));
          console.warn('Money-Butler Cloud-Übergabe noch nicht weitergegeben:',e?.message||e);
        }
      }
      await pollCounts(c);
    }catch(e){
      localStorage.setItem(LAST_ERROR_KEY,JSON.stringify({at:new Date().toISOString(),error:String(e?.message||e)}));
    }finally{running=false;}
  }

  setInterval(poll,POLL_MS);
  setTimeout(poll,5000);
  global.KCMoneyButlerCloudIntake={poll};
})(window);
