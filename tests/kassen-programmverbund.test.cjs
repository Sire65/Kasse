const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');let count=0;
function test(name,ok){assert.ok(ok,name);console.log('OK '+name);count++;}
function finance(payload,{busy=false,moves=[]}={}){
 const store=new Map([['kc_cash_movements',JSON.stringify(moves)]]),elements=new Map(),handlers=new Map();let confirms=0,acks=0;
 const state={master:{registerId:'KASSE-02',rushMode:false},cart:busy?[{}]:[],discount:{}};
 const document={getElementById:id=>elements.get(id)||null,querySelector:()=>null,documentElement:{appendChild(e){elements.set(e.id,e)}},createElement(){return {id:'',style:{},remove(){elements.delete(this.id)},querySelectorAll(){return []},set innerHTML(v){this.text=v;for(const id of ['kcFinanceTransferUebernehmen','kcFinanceTransferSpaeter'])elements.set(id,{addEventListener:(t,f)=>handlers.set(id,f)})}}}};
 const window={KCSyncConnection:{buildUrl:p=>p},KCMeldeweg:{ueberCompanion:async()=>{confirms++;return {ok:true}}}};
 const context={window,state,document,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v))},
  localBusinessDate:()=> '2026-10-31',safeArray:k=>JSON.parse(store.get(k)||'[]'),setSystemHint:()=>{},
  fetch:async u=>{if(u.endsWith('-ack')){acks++;return {ok:true}}return {ok:true,json:async()=>({pending:{transferId:'transfer-1#KASSE-02',payload}})}},setInterval:()=>{},setTimeout:()=>{},AbortSignal,Date,console};
 vm.runInNewContext(fs.readFileSync(path.join(ROOT,'pos/kc-finance-transfer-kasse.js'),'utf8'),context);
 return {window,state,store,elements,handlers,get confirms(){return confirms},get acks(){return acks}};
}
async function moneyButler(pre){
 const payload={format:'KC_CASH_COUNT',countId:'zero-count',registerId:'KASSE-02',effectiveDate:'2026-10-31',total:0};
 let uploads=0,requests=0;const button={disabled:false,addEventListener:()=>{}},status={textContent:''};
 const window={KCMoneyButlerAuth:{getAccessToken:async()=> 'TEST'},KC_COMMUNICATION_ACCESS_TOKEN:'TEST',KCCommunicationClient:class{
  async uploadAttachment(){uploads++;return {id:'attachment'}}
  async _request(name,p){requests++;assert.equal(p.actualCash,0);return {ok:true}}
 }};
 const context={window,document:{readyState:'complete',getElementById:id=>id==='commSend'?button:id==='payload'?{value:'KCOUNT1:'+Buffer.from(JSON.stringify(payload)).toString('base64')}:id==='commSendStatus'?status:null},
  localStorage:{getItem:()=> 'TEST'},File,atob,decodeURIComponent,escape,console};
 vm.runInNewContext(fs.readFileSync(path.join(ROOT,pre+'money-butler/kc-communicator-bridge.js'),'utf8'),context);
 test(pre+' Money Butler akzeptiert eine echte Nullzählung',window.KCMoneyButlerCommunicator.payloadLesen().payload.total===0);
 const a=window.KCMoneyButlerCommunicator.senden(),b=window.KCMoneyButlerCommunicator.senden();
 test(pre+' Doppeltipp nutzt denselben laufenden Sendevorgang',a===b&&button.disabled);await a;
 test(pre+' Nullzählung einmal übertragen und Sendeknopf wieder frei',uploads===1&&requests===1&&!button.disabled);
}
async function directImport(){
 for(const kind of ['future','checksum','duplicate','used-only']){
  let tick,acks=0;
  const error=new Error(kind);if(kind==='duplicate'||kind==='used-only')error.code='KC_CASH_DUPLICATE';
  const context={window:{KCSyncConnection:{buildUrl:p=>p}},state:{master:{registerId:'KASSE-02'}},
   localStorage:{getItem:()=>JSON.stringify(kind==='duplicate'?[{transferId:'x#KASSE-02'}]:[])},
   applyCashPayload:()=>{throw error},fetch:async u=>{if(u.endsWith('-ack')){acks++;return {ok:true}}return {json:async()=>({ok:true,pending:{transferId:'queue-x',payload:{transferId:'x',scope:'split'}}})}},
   setInterval:f=>{tick=f},setTimeout:()=>{},AbortSignal,btoa,unescape,encodeURIComponent};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT,'pos/kc-sync-cash-transfer.js'),'utf8'),context);await tick();
  test('Direktweg quittiert '+kind+' nur bei belegter Buchung',acks===(kind==='duplicate'?1:0));
 }
}
async function freshTokens(pre){
 let current='fresh-1',getToken,seen=[],marked=0;
 const window={KCSupabase:{holeZugriffsToken:()=>current},KCCommunicationClient:class{
  constructor(cfg){getToken=cfg.getAccessToken}
  async _request(name,p){seen.push(await getToken());current='fresh-2';if(p.action==='cash_count_mark')marked++;return {items:p.action==='cash_count_list'?[{id:'zero',actual_cash:0,payload:{format:'KC_CASH_COUNT',countId:'zero',registerId:'KASSE-02',effectiveDate:'2026-10-31',total:0,checksum:'ok'}}]:[]}}
 }};
 const store=new Map([['kcm_sync',JSON.stringify({token:'expired'})]]);
 const context={window,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},checksum:()=> 'ok',isBusinessDate:()=>true,document:{getElementById:()=>null},setInterval:()=>{},setTimeout:()=>{},console:{warn:()=>{}}};
 vm.runInNewContext(fs.readFileSync(path.join(ROOT,pre+'pc-manager/kc-money-butler-cloud-intake.js'),'utf8'),context);
 await window.KCMoneyButlerCloudIntake.poll();
 test(pre+' Manager nutzt aktuelle Anmeldung auch nach Tokenwechsel',seen[0]==='fresh-1'&&seen[1]==='fresh-2');
 test(pre+' Zählung bleibt erhalten solange Abschlussmodul fehlt',marked===0);
 window.KCClosingCore={ingestCashCountPayload:p=>assert.equal(p.total,0)};
 await window.KCMoneyButlerCloudIntake.poll();test(pre+' Nullzählung erst nach Übernahme quittiert',marked===1);
}
(async()=>{
 const p={format:'KC_CASH_TRANSFER',transferId:'transfer-1',registerId:'KASSETTE',scope:'split',registerIds:['KASSE-01','KASSE-02'],type:'topup',total:100,effectiveDate:'2026-10-31',looseBreakdown:{10:10},coinRolls:{},split:{ersteKasse:'KASSE-01',lose:{10:7},rollen:{}}};
 let h=finance(p);await h.window.KCFinanceTransferKasse.pruefeAufUebergabe();
 test('Finance liest echte lexikalische Kassenkennung statt window.state',h.elements.has('kcFinanceTransferOverlay'));
 await h.handlers.get('kcFinanceTransferUebernehmen')();let moves=JSON.parse(h.store.get('kc_cash_movements'));
 test('Kasse 2 bekommt nur ihren 30-Euro-Anteil der Kassette',moves.length===1&&moves[0].total===30&&moves[0].registerId==='KASSE-02'&&moves[0].type==='topup');
 test('Gemeinsame Übergabe-ID für QR, Finance und Direktweg',moves[0].transferId==='transfer-1#KASSE-02'&&JSON.parse(h.store.get('kc_cash_used_transfers')).includes('transfer-1#KASSE-02'));
 test('Bestätigung und ACK erst nach der Geldbuchung',h.confirms===1&&h.acks===1);
 h=finance(p,{busy:true});await h.window.KCFinanceTransferKasse.pruefeAufUebergabe();test('Geldbestätigung unterbricht keinen offenen Verkauf',!h.elements.has('kcFinanceTransferOverlay')&&h.acks===0);
 h.state.cart=[];h.state.master.rushMode=true;await h.window.KCFinanceTransferKasse.pruefeAufUebergabe();test('Keine Geldbestätigung mitten in Stoßzeiten',!h.elements.has('kcFinanceTransferOverlay'));
 h.state.master.rushMode=false;await h.window.KCFinanceTransferKasse.pruefeAufUebergabe();test('Übergabe bleibt nach Stoßzeiten verfügbar',h.elements.has('kcFinanceTransferOverlay'));
 h=finance({...p,effectiveDate:'2026-11-01'});await h.window.KCFinanceTransferKasse.pruefeAufUebergabe();test('Morgiges Geld bleibt ungebucht und unquittiert',!h.elements.has('kcFinanceTransferOverlay')&&h.acks===0);
 h=finance({...p,scope:undefined,registerId:'KASSE-01'});await h.window.KCFinanceTransferKasse.pruefeAufUebergabe();test('Fremde Kasse wird nicht gebucht',!h.elements.has('kcFinanceTransferOverlay')&&h.acks===0);
 h=finance(p,{moves});await h.window.KCFinanceTransferKasse.pruefeAufUebergabe();await h.handlers.get('kcFinanceTransferUebernehmen')();test('Bereits per QR gebuchtes Geld wird nur bestätigt',JSON.parse(h.store.get('kc_cash_movements')).length===1&&h.confirms===1);
 await directImport();
 for(const pre of ['', 'schulung/']){await freshTokens(pre);await moneyButler(pre);}
 console.log(count+' Verbundprüfungen erfolgreich.');
})().catch(e=>{console.error(e);process.exitCode=1});
