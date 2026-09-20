(function(global){
  'use strict';

  const TOKEN_KEY='kc_money_butler_communication_token_v1';
  const SOURCE='kc-money-butler';
  const el=(id)=>document.getElementById(id);

  function tokenLesen(){
    return String(global.KC_COMMUNICATION_ACCESS_TOKEN||localStorage.getItem(TOKEN_KEY)||'').trim();
  }
  function tokenSpeichern(){
    const token=String(el('commToken')?.value||'').trim();
    if(!token){localStorage.removeItem(TOKEN_KEY);el('commSendStatus').textContent='Gespeicherter KC-Communicator Zugang wurde entfernt.';return;}
    localStorage.setItem(TOKEN_KEY,token);
    el('commSendStatus').textContent='KC-Communicator Zugang wurde nur auf diesem PC gespeichert.';
  }
  function payloadLesen(){
    const text=String(document.getElementById('payload')?.value||'').trim();
    const prefix=text.startsWith('KCASH1:')?'KCASH1:':text.startsWith('KCOUNT1:')?'KCOUNT1:':null;
    if(!prefix)throw new Error('Zuerst eine Bargeldübergabe oder Zählung erzeugen.');
    const payload=JSON.parse(decodeURIComponent(escape(atob(text.slice(prefix.length)))));
    if(payload?.format==='KC_CASH_TRANSFER'){
      if(!payload.transferId)throw new Error('Transfer-ID fehlt.');
      if(!Number.isFinite(Number(payload.total))||Number(payload.total)<=0)throw new Error('Ungültiger Übergabebetrag.');
      return {text,payload,kind:'transfer'};
    }
    if(payload?.format==='KC_CASH_COUNT'){
      if(!payload.countId)throw new Error('Zählungs-ID fehlt.');
      if(!payload.registerId)throw new Error('Kasse der Zählung fehlt.');
      if(!payload.effectiveDate)throw new Error('Geschäftstag der Zählung fehlt.');
      if(!Number.isFinite(Number(payload.total))||Number(payload.total)<=0)throw new Error('Ungültiger Zählbetrag.');
      return {text,payload,kind:'count'};
    }
    throw new Error('Der erzeugte Datensatz ist weder Bargeldübergabe noch Zählung.');
  }
  function dateiname(payload){
    const ziel=payload.scope==='split'?'KASSETTE':(payload.registerId||'KASSE');
    const typ=payload.format==='KC_CASH_COUNT'?(payload.countKind==='late'?'nachzaehlung':'zaehlung'):(payload.type||'transfer');
    return `${ziel}_${typ}_${payload.effectiveDate||'datum'}.kccash`;
  }
  async function senden(){
    const status=el('commSendStatus');
    try{
      const token=tokenLesen();
      if(!token)throw new Error('Bitte zuerst den KC-Communicator Zugriffstoken des Kassenwarts eintragen.');
      if(typeof global.KCCommunicationClient!=='function')throw new Error('KC Communication Client konnte nicht geladen werden.');
      const {text,payload,kind}=payloadLesen();
      status.textContent=kind==='count'
        ?'Zählung wird über KC Communicator an den PC-Manager gesendet …'
        :'Wird über KC Communicator an den PC-Manager gesendet …';
      const client=new global.KCCommunicationClient({
        sourceProgram:SOURCE,
        getAccessToken:async()=>token,
        defaultTestOnly:false
      });
      const file=new File([text],dateiname(payload),{type:'text/plain'});
      const uploaded=await client.uploadAttachment(file,{expiresInHours:168});
      if(!uploaded?.id)throw new Error('KC Communicator hat den Anhang nicht bestätigt.');

      if(kind==='count'){
        const result=await client._request('kc-finance-bridge',{
          action:'cash_count_create',
          sourceProgram:SOURCE,
          correlationId:payload.countId,
          countId:payload.countId,
          registerId:payload.registerId,
          businessDate:payload.effectiveDate,
          actualCash:Number(payload.total),
          countedAt:payload.countedAt||payload.time,
          countKind:payload.countKind||'same-day',
          attachmentIds:[uploaded.id],
          payload
        });
        status.textContent=`${payload.countKind==='late'?'Nachzählung':'Abendzählung'} gesendet: ${Number(payload.total).toLocaleString('de-DE',{style:'currency',currency:'EUR'})} · Abschluss vom ${payload.effectiveDate} → PC-Manager. Es wird keine neue Geldbewegung erzeugt.`;
        return result;
      }

      const targetRegisterIds=(payload.scope==='split'||payload.scope==='shared')
        ?Array.from(payload.registerIds||[])
        :[payload.registerId].filter(Boolean);
      const result=await client.emitEvent('cash_transfer_ready',{
        recipients:[],
        variables:{
          registerId:(payload.scope==='split'||payload.scope==='shared')?'KASSETTE':payload.registerId,
          amount:Number(payload.total),
          transferId:payload.transferId,
          transferType:payload.type,
          effectiveDate:payload.effectiveDate,
          scope:payload.scope||'register',
          targetRegisterIds,
          fileName:file.name,
          cashPayload:payload,
          confirmationRequested:payload.confirmationRequested===true,
          handoverRoute:'money-butler->kc-communicator->pc-manager'
        },
        attachmentIds:[uploaded.id],
        priority:'high',
        testOnly:false,
        correlationId:`money-butler-cash-${payload.transferId}`
      });
      status.textContent=`Gesendet: ${Number(payload.total).toLocaleString('de-DE',{style:'currency',currency:'EUR'})} · KC Communicator → PC-Manager. Die Kassen erhalten den Betrag erst nach Weitergabe durch den PC-Manager.`;
      return result;
    }catch(err){
      status.textContent='Nicht gesendet: '+(err?.message||String(err));
      return null;
    }
  }

  function init(){
    const feld=el('commToken');
    if(feld&&!feld.value)feld.value=localStorage.getItem(TOKEN_KEY)||'';
    el('commTokenSave')?.addEventListener('click',tokenSpeichern);
    el('commSend')?.addEventListener('click',senden);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();

  global.KCMoneyButlerCommunicator={senden,tokenLesen,payloadLesen};
})(window);
