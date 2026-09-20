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
    if(!text.startsWith('KCASH1:'))throw new Error('Zuerst eine Bargeldübergabe erzeugen.');
    const payload=JSON.parse(decodeURIComponent(escape(atob(text.slice(7)))));
    if(payload?.format!=='KC_CASH_TRANSFER')throw new Error('Die erzeugte Datei ist keine Bargeldübergabe.');
    if(!payload.transferId)throw new Error('Transfer-ID fehlt.');
    if(!Number.isFinite(Number(payload.total))||Number(payload.total)<=0)throw new Error('Ungültiger Übergabebetrag.');
    return {text,payload};
  }
  function dateiname(payload){
    const ziel=payload.scope==='split'?'KASSETTE':(payload.registerId||'KASSE');
    return `${ziel}_${payload.type||'transfer'}_${payload.effectiveDate||'datum'}.kccash`;
  }
  async function senden(){
    const status=el('commSendStatus');
    try{
      const token=tokenLesen();
      if(!token)throw new Error('Bitte zuerst den KC-Communicator Zugriffstoken des Kassenwarts eintragen.');
      if(typeof global.KCCommunicationClient!=='function')throw new Error('KC Communication Client konnte nicht geladen werden.');
      const {text,payload}=payloadLesen();
      status.textContent='Wird über KC Communicator an den PC-Manager gesendet …';
      const client=new global.KCCommunicationClient({
        sourceProgram:SOURCE,
        getAccessToken:async()=>token,
        defaultTestOnly:false
      });
      const file=new File([text],dateiname(payload),{type:'text/plain'});
      const uploaded=await client.uploadAttachment(file,{expiresInHours:168});
      if(!uploaded?.id)throw new Error('KC Communicator hat den Anhang nicht bestätigt.');
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
