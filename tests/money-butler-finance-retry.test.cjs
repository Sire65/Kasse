const fs=require('fs');
const path=require('path');
const vm=require('vm');

const code=fs.readFileSync(path.join(__dirname,'..','pos','kc-finance-transfer-kasse.js'),'utf8');

function assert(v,msg){if(!v)throw new Error(msg);}

(async()=>{
  const transferId='TEST-RETRY-12-34';
  const payload={
    format:'KC_CASH_TRANSFER',
    transferId,
    registerId:'KASSE-01',
    type:'opening',
    total:12.34,
    effectiveDate:'2026-09-20',
    confirmationRequested:true
  };

  const store=new Map();
  store.set('kc_finance_transfer_verarbeitet_v1',JSON.stringify([transferId]));
  store.set('kc_cash_movements',JSON.stringify([{
    type:'opening',registerId:'KASSE-01',total:12.34,effectiveDate:'2026-09-20',
    transferId,importSource:'finance-bridge',importedAt:'2026-09-20T08:00:00.000Z'
  }]));

  const localStorage={
    getItem:k=>store.has(k)?store.get(k):null,
    setItem:(k,v)=>store.set(k,String(v)),
    removeItem:k=>store.delete(k)
  };

  let meldeVersuche=0;
  let ackVersuche=0;
  const window={
    state:{master:{registerId:'KASSE-01'}},
    KCSyncConnection:{buildUrl:p=>p},
    KCMeldeweg:{
      ueberCompanion:async(type,body)=>{
        meldeVersuche++;
        assert(type==='cash_transfer_confirmed','Falscher Meldetyp');
        assert(body.transferId===transferId,'Falsche Transfer-ID');
        assert(body.amount===12.34,'Falscher Betrag');
        if(meldeVersuche===1)throw new Error('simulierter kurzer Netzausfall');
        return {ok:true};
      }
    }
  };

  const fetch=async(url,opts)=>{
    if(url==='/kc-sync-finance-transfer'){
      return {ok:true,json:async()=>({pending:{transferId,payload}})};
    }
    if(url==='/kc-sync-finance-transfer-ack'){
      ackVersuche++;
      return {ok:true,json:async()=>({ok:true})};
    }
    throw new Error('Unerwartete URL '+url);
  };

  const context={
    window,localStorage,fetch,
    document:{getElementById:()=>null},
    console,
    setInterval:()=>0,
    setTimeout:()=>0,
    AbortSignal,
    Date
  };
  vm.createContext(context);
  vm.runInContext(code,context,{filename:'kc-finance-transfer-kasse.js'});

  assert(window.KCFinanceTransferKasse?.pruefeAufUebergabe,'Prüffunktion fehlt');

  await window.KCFinanceTransferKasse.pruefeAufUebergabe();
  assert(meldeVersuche===1,'Erster Bestätigungsversuch fehlt');
  assert(ackVersuche===0,'Nach fehlgeschlagener Bestätigung darf noch kein ACK erfolgen');
  assert(JSON.parse(store.get('kc_cash_movements')).length===1,'Geld wurde beim fehlgeschlagenen Bestätigungsversuch doppelt gebucht');
  assert(!JSON.parse(store.get('kc_finance_transfer_bestaetigt_v1')||'[]').includes(transferId),'Fehlgeschlagene Bestätigung darf nicht als erfolgreich gespeichert werden');

  await window.KCFinanceTransferKasse.pruefeAufUebergabe();
  assert(meldeVersuche===2,'Bestätigung wurde beim nächsten Takt nicht erneut versucht');
  assert(ackVersuche===1,'Nach erfolgreicher Bestätigung fehlt der ACK');
  assert(JSON.parse(store.get('kc_cash_movements')).length===1,'Retry hat das Geld doppelt gebucht');
  assert(JSON.parse(store.get('kc_finance_transfer_bestaetigt_v1')||'[]').includes(transferId),'Erfolgreiche Bestätigung wurde nicht separat gespeichert');

  await window.KCFinanceTransferKasse.pruefeAufUebergabe();
  assert(meldeVersuche===2,'Erfolgreich bestätigter Transfer wurde erneut gemeldet');
  assert(JSON.parse(store.get('kc_cash_movements')).length===1,'Dritter Takt hat Geld doppelt gebucht');

  console.log('Finance confirmation retry: 12,34 EUR · fail once -> retry -> no duplicate booking: OK');
})().catch(e=>{console.error(e);process.exit(1);});
