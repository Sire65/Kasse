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
    return String(global.KCSupabase?.holeZugriffsToken?.()||global.KC_COMMUNICATION_ACCESS_TOKEN||c.token||'').trim();
  }
  function client(){
    const c=cfg(),t=token();
    if(!t||typeof global.KCCommunicationClient!=='function')return null;
    return new global.KCCommunicationClient({
      baseUrl:c.url||undefined,
      publishableKey:c.publicKey||undefined,
      sourceProgram:'kc-money-butler',
      getAccessToken:async()=>token(),
      defaultTestOnly:false
    });
  }
  // 20.11.2026: Die Prüfsumme des Money Butler gilt für die Feldreihenfolge beim Erzeugen. Supabase speichert
  // die Daten als jsonb und sortiert die Felder dabei um - die Prüfsumme lässt sich aus der Datenbank daher
  // nicht nachrechnen (jede Cloud-Übergabe blieb deshalb liegen). Auf diesem Weg sichern Anmeldung, Datenbank
  // und der Abgleich Betrag-Datensatz/Betrag-Spalte die Echtheit; die Prüfsumme muss vorhanden sein und wird
  // geprüft, wenn die Reihenfolge erhalten blieb - ein Abweichen allein blockiert nicht mehr.
  function pruefsummeCloud(p){
    const copy=JSON.parse(JSON.stringify(p)),supplied=copy.checksum;delete copy.checksum;
    if(!supplied)return 'fehlt';
    if(typeof checksum==='function'&&checksum(JSON.stringify(copy))===supplied)return 'ok';
    return 'umsortiert';
  }
  function decodeRow(row){
    const p=row?.payload?.cashPayload;
    if(!p||p.format!=='KC_CASH_TRANSFER')throw new Error('Finance-Bridge-Datensatz enthält keinen KC_CASH_TRANSFER.');
    if(pruefsummeCloud(p)==='fehlt')throw new Error('Prüfsumme der Cloud-Geldübergabe fehlt.');
    if(!p.transferId||String(p.transferId).length>128)throw new Error('Transfer-ID der Cloud-Geldübergabe ist ungültig.');
    if(!['opening','topup'].includes(p.type))throw new Error('Vorgangsart der Cloud-Geldübergabe ist ungültig.');
    if(!Number.isFinite(Number(p.total))||Number(p.total)<=0)throw new Error('Betrag der Cloud-Geldübergabe ist ungültig.');
    if(!isBusinessDate(p.effectiveDate))throw new Error('Einsatzdatum der Cloud-Geldübergabe ist ungültig.');
    if(Math.abs(Number(row.amount||0)-Number(p.total))>.009)throw new Error('Cloud-Betrag und Money-Butler-Datensatz stimmen nicht überein.');
    return p;
  }
  // Gemeinsamer Merker mit kc-finance-uebergaben.js: welche Uebergaben schon an die Kasse gegeben wurden.
  const FREIGEGEBEN_KEY='kcm_finance_transfers_freigegeben_v1';
  function freigegebene(){try{return JSON.parse(localStorage.getItem(FREIGEGEBEN_KEY)||'{}')||{};}catch{return {};}}
  function istFreigegeben(id){return !!freigegebene()[id];}
  function merkeFreigegeben(id){const k=freigegebene();k[id]=new Date().toISOString();try{localStorage.setItem(FREIGEGEBEN_KEY,JSON.stringify(k));}catch{}}
  // Die Kasse prueft die Pruefsumme ueber die Feldreihenfolge, in der das Paket bei ihr ankommt. Aus Supabase
  // kommt es umsortiert (jsonb) - der PC-Manager hat es oben geprueft (Betrag Spalte = Datensatz) und versiegelt
  // es fuer die Kasse neu, unveraendert im Inhalt.
  function neuVersiegelt(payload){
    const copy=JSON.parse(JSON.stringify(payload));delete copy.checksum;
    if(typeof checksum!=='function')throw new Error('Pruefsummenfunktion fehlt.');
    copy.checksum=checksum(JSON.stringify(copy));return copy;
  }
  async function anKasseGeben(row,payload){
    const mehrere=Array.isArray(payload.registerIds)&&(payload.scope==='split'||payload.scope==='shared');
    const ziele=mehrere?payload.registerIds:[row.register_id||payload.registerId];
    for(const kasse of ziele){
      const transferId=(row.correlation_id||`finance-${row.id}`)+(mehrere?`#${kasse}`:'');
      const antwort=await fetch('http://127.0.0.1:47392/api/v1/finance-transfer/queue',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({registerLabel:kasse,transferId,payload:neuVersiegelt(payload)})
      });
      if(antwort.status===401)throw new Error('Bitte im PC-Manager oben rechts bei Supabase anmelden (Fernmodus).');
      if(!antwort.ok)throw new Error('Manager-Dienst antwortete mit Fehler '+antwort.status);
    }
  }
  async function mark(c,id,status){
    return c._request('kc-finance-bridge',{action:'cash_transfer_mark',id,status});
  }
  function decodeCountRow(row){
    const p=row?.payload;
    if(!p||p.format!=='KC_CASH_COUNT')throw new Error('Finance-Bridge-Datensatz enthält keine KC_CASH_COUNT.');
    if(pruefsummeCloud(p)==='fehlt')throw new Error('Prüfsumme der Cloud-Zählung fehlt.');
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
        if(typeof global.KCClosingCore?.ingestCashCountPayload!=='function')throw new Error('Tagesabschluss ist noch nicht bereit. Zählung bleibt zur Abholung erhalten.');
        global.KCClosingCore.ingestCashCountPayload(payload,'communicator-cloud');
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
          if(payload.confirmationRequested===true){
            // 20.11.2026 (Betreiber: "soll in der Praxis allein laufen, ohne im PC-Manager zu bestaetigen"):
            // automatisch an die Zielkasse geben - genau wie der Knopf "An Kasse freigeben" (gleiche
            // Uebergabe-ID = correlation_id, damit die Empfangsbestaetigung der Kasse zugeordnet wird),
            // aber mit dem vollstaendigen Money-Butler-Paket (Stueckelung). "handed_to_register" setzt erst
            // die Bestaetigung der Kasse (kc-finance-uebergaben.js), nicht dieser Schritt.
            if(istFreigegeben(row.id))continue;
            await anKasseGeben(row,payload);
            merkeFreigegeben(row.id);
          }else{
            await queueCashTransferPayload(payload);
            await mark(c,row.id,'handed_to_register');
          }
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

  // KC-RT-PROGRAMME (11.10.2026): Steht die direkte Leitung, meldet sich jede neue Übergabe/Zählung sofort
  // (kc-direkte-leitung-manager.js ruft poll() auf). Dann nur noch jede Minute zur Sicherheit nachfragen statt alle 15 s.
  let letzterPoll=0;
  const pollGezaehlt=()=>{letzterPoll=Date.now();return poll();};
  // 14.10.2026 (Datenbank schonen): auch im Hintergrund nur jede Minute statt alle 15 s – beim Zurückkommen sofort.
  setInterval(()=>{if((global.KCDirekteLeitungManager?.steht?.()||global.document?.hidden)&&Date.now()-letzterPoll<60000)return;pollGezaehlt();},POLL_MS);
  global.document?.addEventListener?.('visibilitychange',()=>{if(!global.document.hidden&&Date.now()-letzterPoll>POLL_MS)pollGezaehlt();});
  setTimeout(pollGezaehlt,5000);
  global.KCMoneyButlerCloudIntake={poll:pollGezaehlt};
})(window);
