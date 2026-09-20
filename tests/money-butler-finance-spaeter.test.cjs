const fs=require('fs');
const path=require('path');
const vm=require('vm');

const code=fs.readFileSync(path.join(__dirname,'..','pos','kc-finance-transfer-kasse.js'),'utf8');
function assert(v,msg){if(!v)throw new Error(msg);}

function createHarness(){
  const store=new Map();
  const listeners=new Map();
  const elements=new Map();

  function button(id){
    const b={id,disabled:false,addEventListener:(t,fn)=>{listeners.set(id+':'+t,fn)}};
    elements.set(id,b); return b;
  }

  const document={
    documentElement:{appendChild(el){elements.set(el.id,el);el._attached=true;}},
    getElementById(id){return elements.get(id)||null;},
    createElement(){
      const el={
        id:'',style:{},_attached:false,_buttons:[],
        querySelectorAll(sel){return sel==='button'?this._buttons:[];},
        remove(){this._attached=false;if(this.id)elements.delete(this.id);},
        set innerHTML(v){
          this._html=v;
          for(const id of ['kcFinanceTransferSpaeter','kcFinanceTransferUebernehmen']){
            if(v.includes('id="'+id+'"'))this._buttons.push(button(id));
          }
        },
        get innerHTML(){return this._html||'';}
      };
      return el;
    }
  };

  const localStorage={
    getItem:k=>store.has(k)?store.get(k):null,
    setItem:(k,v)=>store.set(k,String(v)),
    removeItem:k=>store.delete(k)
  };

  const transferId='TEST-SPAETER-25-00';
  const payload={
    format:'KC_CASH_TRANSFER',transferId,registerId:'KASSE-01',type:'opening',
    total:25,effectiveDate:'2026-09-20',confirmationRequested:true
  };
  let ack=0,confirm=0;
  const window={
    state:{master:{registerId:'KASSE-01'}},
    KCSyncConnection:{buildUrl:p=>p},
    KCMeldeweg:{ueberCompanion:async()=>{confirm++;return {ok:true};}}
  };
  let pending=true;
  const fetch=async(url)=>{
    if(url==='/kc-sync-finance-transfer')return {ok:true,json:async()=>pending?{pending:{transferId,payload}}:{pending:null}};
    if(url==='/kc-sync-finance-transfer-ack'){ack++;pending=false;return {ok:true,json:async()=>({ok:true})};}
    throw new Error('Unerwartete URL '+url);
  };

  const context={
    window,document,localStorage,fetch,console,
    setInterval:()=>0,setTimeout:()=>0,AbortSignal,Date,
    localBusinessDate:()=> '2026-09-20',
    safeArray:key=>JSON.parse(localStorage.getItem(key)||'[]'),
    setSystemHint:()=>{}
  };
  vm.createContext(context);
  vm.runInContext(code,context,{filename:'kc-finance-transfer-kasse.js'});
  return {store,listeners,elements,window,get ack(){return ack},get confirm(){return confirm}};
}

(async()=>{
  const h=createHarness();

  await h.window.KCFinanceTransferKasse.pruefeAufUebergabe();
  assert(h.elements.get('kcFinanceTransferOverlay')?._attached===true,'Übergabe wurde nicht angezeigt');

  const spaeter=h.listeners.get('kcFinanceTransferSpaeter:click');
  assert(typeof spaeter==='function','Später-Handler fehlt');
  spaeter();

  assert(!h.elements.get('kcFinanceTransferOverlay'),'Später muss das Overlay schließen');
  assert(JSON.parse(h.store.get('kc_cash_movements')||'[]').length===0,'Später darf kein Geld buchen');
  assert(h.ack===0,'Später darf keinen ACK senden');
  assert(h.confirm===0,'Später darf keine Empfangsbestätigung senden');

  await h.window.KCFinanceTransferKasse.pruefeAufUebergabe();
  assert(h.elements.get('kcFinanceTransferOverlay')?._attached===true,'Transfer muss nach Später erneut erscheinen');

  const uebernehmen=h.listeners.get('kcFinanceTransferUebernehmen:click');
  assert(typeof uebernehmen==='function','Übernehmen-Handler fehlt');
  await uebernehmen();

  const moves=JSON.parse(h.store.get('kc_cash_movements')||'[]');
  assert(moves.length===1,'Übernehmen muss genau eine Geldbewegung erzeugen');
  assert(moves[0].total===25,'Übernehmen hat falschen Betrag gebucht');
  assert(h.confirm===1,'Übernehmen muss genau eine Empfangsbestätigung senden');
  assert(h.ack===1,'Übernehmen muss genau einen ACK senden');

  await h.window.KCFinanceTransferKasse.pruefeAufUebergabe();
  assert(JSON.parse(h.store.get('kc_cash_movements')||'[]').length===1,'Nach ACK darf keine zweite Geldbewegung entstehen');
  assert(h.confirm===1,'Nach ACK darf keine zweite Bestätigung entstehen');

  console.log('Finance Später -> erneut anzeigen -> Übernehmen: 25,00 EUR exactly once: OK');
})().catch(e=>{console.error(e);process.exit(1);});
