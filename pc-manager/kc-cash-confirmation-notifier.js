(function(global){
  'use strict';

  const LAST_KEY='kcm_cash_confirmation_push_last_v1';
  const SENT_KEY='kcm_cash_confirmation_push_sent_v1';
  const POLL_MS=15000;

  function syncSettings(){
    try{return JSON.parse(localStorage.getItem('kcm_sync')||'{}')||{};}catch{return {};}
  }
  function sentIds(){
    try{return new Set(JSON.parse(localStorage.getItem(SENT_KEY)||'[]'));}catch{return new Set();}
  }
  function saveSent(set){
    localStorage.setItem(SENT_KEY,JSON.stringify(Array.from(set).slice(-500)));
  }
  function lastSeen(){return localStorage.getItem(LAST_KEY)||'';}
  function saveLast(value){if(value)localStorage.setItem(LAST_KEY,value);}

  function euro(n){
    return Number(n||0).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
  }

  async function sendePush(b){
    const cfg=syncSettings();
    const token=String(global.KC_COMMUNICATION_ACCESS_TOKEN||cfg.token||'').trim();
    if(!token)throw new Error('KC-Communicator Zugriffstoken im PC-Manager fehlt');
    if(typeof global.KCCommunicationClient!=='function')throw new Error('KC Communication Client fehlt');

    const client=new global.KCCommunicationClient({
      baseUrl:cfg.url||undefined,
      publishableKey:cfg.publicKey||undefined,
      sourceProgram:'kc-money-butler',
      getAccessToken:async()=>token,
      defaultTestOnly:false
    });

    const titel='Geld angekommen';
    const nachricht=`${b.registerId||'Kasse'} hat ${euro(b.amount)} für ${b.businessDate||'den vorgesehenen Tag'} übernommen.`;

    return client.emitEvent('cash_transfer_confirmed',{
      recipients:[],
      variables:{
        transferId:b.transferId,
        registerId:b.registerId,
        amount:Number(b.amount)||0,
        businessDate:b.businessDate||null,
        confirmedAt:b.confirmedAt||b.receivedAt||new Date().toISOString(),
        title:titel,
        message:nachricht,
        notificationType:'cash-confirmation',
        channels:['push'],
        notifyRoles:['cashier','superadmin'],
        recipientLabels:['Kassenwart','Admin'],
        confirmationRequested:true
      },
      priority:'high',
      testOnly:false,
      correlationId:`cash-confirmed-${b.transferId}-${b.registerId||'register'}`
    });
  }

  async function pruefe(){
    try{
      const seit=lastSeen();
      const url='http://127.0.0.1:47392/cash-transfer-confirmations'+(seit?'?since='+encodeURIComponent(seit):'');
      const antwort=await fetch(url,{signal:AbortSignal.timeout(4000)});
      if(!antwort.ok)return;
      const daten=await antwort.json();
      const liste=Array.isArray(daten?.bestaetigungen)?daten.bestaetigungen:[];
      if(!liste.length)return;
      const sent=sentIds();
      for(const b of liste){
        const id=String(b.eventId||`${b.transferId||''}:${b.registerId||''}:${b.confirmedAt||b.receivedAt||''}`);
        if(sent.has(id)){saveLast(b.receivedAt);continue;}
        if(b.confirmationRequested!==true){
          sent.add(id);saveSent(sent);saveLast(b.receivedAt);continue;
        }
        await sendePush(b);
        sent.add(id);saveSent(sent);saveLast(b.receivedAt);
      }
    }catch(e){
      // Bewusst still: Bestätigung bleibt beim nächsten Takt erneut versendbar.
      console.warn('KC Cash Confirmation Push noch nicht versendet:',e?.message||e);
    }
  }

  setInterval(pruefe,POLL_MS);
  setTimeout(pruefe,4000);
  global.KCCashConfirmationPush={pruefe,sendePush};
})(window);
