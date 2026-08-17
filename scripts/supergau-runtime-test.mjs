import fs from 'node:fs';
import vm from 'node:vm';

class StorageMock {
  constructor(){this.map=new Map();}
  getItem(k){return this.map.has(k)?this.map.get(k):null;}
  setItem(k,v){this.map.set(k,String(v));}
  removeItem(k){this.map.delete(k);}
}

const localStorage=new StorageMock();
const sessionStorage=new StorageMock();
const events=new Map();
const windowObj={
  addEventListener:(n,fn)=>{if(!events.has(n))events.set(n,[]);events.get(n).push(fn);},
  dispatchEvent:()=>{},
};
const documentObj={
  visibilityState:'visible',
  addEventListener:()=>{}
};
let online=false;
let syncCalls=0;
const fetchMock=async (url,opts={})=>{
  const u=String(url);
  if(!online) throw new Error('OFFLINE');
  if(u.includes('/sync/batch')){
    syncCalls++;
    const body=JSON.parse(opts.body||'{}');
    return {ok:true,status:200,json:async()=>({status:'OK',results:(body.transactions||[]).map(x=>({transactionId:x.transactionId,status:'STORED'}))})};
  }
  if(u.includes('/sync/reconcile')) return {ok:true,status:200,json:async()=>({status:'OK',missingRemote:[],missingLocal:[],remoteCount:1,localCount:1})};
  if(u.includes('/sync/transactions')) return {ok:true,status:200,json:async()=>({status:'OK',count:1,transactions:[JSON.parse(localStorage.getItem('kc_transactions_v040'))[0]]})};
  throw new Error(`UNEXPECTED_URL:${u}`);
};

const context={
  console,
  Storage:StorageMock,
  localStorage,
  sessionStorage,
  window:windowObj,
  document:documentObj,
  navigator:{get onLine(){return online;}},
  fetch:fetchMock,
  CustomEvent:class{constructor(name,init){this.type=name;this.detail=init?.detail;}},
  URL,
  AbortController,
  setTimeout:(fn)=>{fn();return 1;},
  clearTimeout:()=>{},
  setInterval:()=>1,
  queueMicrotask:(fn)=>fn(),
  Date,
  JSON,
  Math,
  Set,
  Map,
  Object,
  String,
  Number,
  Error,
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('shared/kc-resilience.js','utf8'),context);

const tx={transactionId:'TEST-TX-1',registerId:'KASSE-01',registerName:'Kasse 1',time:new Date().toISOString(),recordHash:'hash-1',training:false,total:12.34};
localStorage.setItem('kc_transactions_v040',JSON.stringify([tx]));

let queued=JSON.parse(localStorage.getItem('kc_sync_outbox_v1')||'[]');
if(queued.length!==1) throw new Error(`Expected 1 queued transaction offline, got ${queued.length}`);

online=true;
await context.window.KCResilience.flush();
queued=JSON.parse(localStorage.getItem('kc_sync_outbox_v1')||'[]');
if(queued.length!==0) throw new Error(`Expected empty outbox after reconnect, got ${queued.length}`);
if(syncCalls<1) throw new Error('Expected gateway sync call after reconnect');

const ack=JSON.parse(localStorage.getItem('kc_sync_ack_v1')||'[]');
if(!ack.includes('TEST-TX-1')) throw new Error('Transaction was not acknowledged');

const rec=await context.window.KCResilience.reconcile('KASSE-01');
if(rec.status!=='OK') throw new Error('Reconciliation failed');
const restored=await context.window.KCResilience.restoreRegister('KASSE-01');
if(restored.status!=='OK') throw new Error('Restore failed');

console.log('PASS|runtime|offline queue -> reconnect sync -> reconcile -> restore');
