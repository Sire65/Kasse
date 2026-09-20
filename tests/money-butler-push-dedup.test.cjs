const fs=require('fs');
const path=require('path');
const vm=require('vm');

const code=fs.readFileSync(path.join(__dirname,'..','pc-manager','kc-cash-confirmation-notifier.js'),'utf8');
function assert(v,msg){if(!v)throw new Error(msg);}

(async()=>{
  const store=new Map();
  store.set('kcm_sync',JSON.stringify({token:'TESTTOKEN'}));
  const localStorage={
    getItem:k=>store.has(k)?store.get(k):null,
    setItem:(k,v)=>store.set(k,String(v)),
    removeItem:k=>store.delete(k)
  };

  const event={
    eventId:'evt-cash-1',transferId:'T-100',registerId:'KASSE-01',amount:12.34,
    businessDate:'2026-09-20',confirmedAt:'2026-09-20T09:00:00Z',
    receivedAt:'2026-09-20T09:00:01Z',confirmationRequested:true
  };

  let fetchCount=0;
  const fetch=async()=>({ok:true,json:async()=>({bestaetigungen:[event]})});
  let sends=0;
  class Client{
    async emitEvent(type,body){
      sends++;
      assert(type==='cash_transfer_confirmed','Falscher Push-Ereignistyp');
      assert(body.variables.amount===12.34,'Falscher Push-Betrag');
      if(sends===1)throw new Error('simulierter Push-Ausfall');
      return {ok:true};
    }
  }
  const window={KCCommunicationClient:Client};
  const context={window,localStorage,fetch,AbortSignal,Date,console,setInterval:()=>0,setTimeout:()=>0};
  vm.createContext(context);
  vm.runInContext(code,context,{filename:'kc-cash-confirmation-notifier.js'});

  await window.KCCashConfirmationPush.pruefe();
  assert(sends===1,'Erster Push-Versuch fehlt');
  assert(!JSON.parse(store.get('kcm_cash_confirmation_push_sent_v1')||'[]').includes(event.eventId),'Fehlgeschlagener Push darf nicht als gesendet markiert werden');

  await window.KCCashConfirmationPush.pruefe();
  assert(sends===2,'Push wurde nach Fehler nicht erneut versucht');
  assert(JSON.parse(store.get('kcm_cash_confirmation_push_sent_v1')||'[]').includes(event.eventId),'Erfolgreicher Push wurde nicht als gesendet markiert');

  await window.KCCashConfirmationPush.pruefe();
  assert(sends===2,'Derselbe Push wurde doppelt gesendet');

  console.log('Cash confirmation push: fail once -> retry -> exactly once successful delivery: OK');
})().catch(e=>{console.error(e);process.exit(1);});
