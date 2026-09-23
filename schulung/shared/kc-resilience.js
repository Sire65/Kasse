(()=>{
'use strict';

const GATEWAY='https://kc-failover-gateway.ha-joko.workers.dev';
const TRANSACTION_KEY='kc_transactions_v040';
const OUTBOX_KEY='kc_sync_outbox_v1';
const ACK_KEY='kc_sync_ack_v1';
const CONFLICT_KEY='kc_sync_conflicts_v1';
const STATUS_KEY='kc_sync_status_v1';
const MAX_ACKS=12000;
const originalSetItem=Storage.prototype.setItem;
let syncing=false;
let timer=null;

const readJson=(key,fallback)=>{try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback}catch{return fallback}};
const writeJson=(key,value)=>originalSetItem.call(localStorage,key,JSON.stringify(value));
const transactions=()=>readJson(TRANSACTION_KEY,[]).filter(x=>x&&!x.training&&x.transactionId);
const outbox=()=>readJson(OUTBOX_KEY,[]);
const ackIds=()=>new Set(readJson(ACK_KEY,[]));
const conflicts=()=>readJson(CONFLICT_KEY,[]);
const nowIso=()=>new Date().toISOString();

function setStatus(state,detail={}){
  const status={state,time:nowIso(),queued:outbox().length,...detail};
  writeJson(STATUS_KEY,status);
  window.dispatchEvent(new CustomEvent('kc-resilience-status',{detail:status}));
}

function queueTransactions(rows){
  const acks=ackIds();
  const current=outbox();
  const known=new Set(current.map(x=>x.transaction?.transactionId));
  let added=0;
  for(const row of rows||[]){
    if(!row?.transactionId||row.training||acks.has(row.transactionId)||known.has(row.transactionId))continue;
    current.push({transaction:row,queuedAt:nowIso(),attempts:0,nextAttemptAt:0,lastError:null});
    known.add(row.transactionId);added++;
  }
  if(added)writeJson(OUTBOX_KEY,current.slice(-10000));
  return added;
}

function scanLocalTransactions(){
  const added=queueTransactions(transactions());
  if(added)setStatus(navigator.onLine?'QUEUED':'OFFLINE',{added});
  scheduleSync(50);
}

Storage.prototype.setItem=function(key,value){
  const result=originalSetItem.call(this,key,value);
  if(this===localStorage&&key===TRANSACTION_KEY){
    try{queueMicrotask(scanLocalTransactions)}catch{setTimeout(scanLocalTransactions,0)}
  }
  return result;
};

function addAcks(ids){
  const all=readJson(ACK_KEY,[]);
  const set=new Set(all);
  ids.forEach(id=>set.add(id));
  writeJson(ACK_KEY,[...set].slice(-MAX_ACKS));
}

function saveConflict(item,remoteStatus='CONFLICT'){
  const list=conflicts();
  if(!list.some(x=>x.transactionId===item.transaction?.transactionId)){
    list.push({transactionId:item.transaction?.transactionId,registerId:item.transaction?.registerId,detectedAt:nowIso(),remoteStatus,localRecordHash:item.transaction?.recordHash||null});
    writeJson(CONFLICT_KEY,list.slice(-2000));
  }
}

async function post(path,body,timeoutMs=12000){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const res=await fetch(`${GATEWAY}${path}`,{method:'POST',headers:{'content-type':'application/json','x-kc-client':'KC-MarktKasse'},body:JSON.stringify(body),signal:controller.signal,cache:'no-store'});
    const data=await res.json().catch(()=>({}));
    if(!res.ok&&res.status!==207&&res.status!==409)throw new Error(data?.error||`HTTP_${res.status}`);
    return {res,data};
  }finally{clearTimeout(timeout)}
}

async function flushOutbox(){
  if(syncing)return;
  const current=outbox();
  if(!current.length){setStatus(navigator.onLine?'SYNCED':'OFFLINE');return;}
  if(!navigator.onLine){setStatus('OFFLINE');return;}
  syncing=true;setStatus('SYNCING');
  try{
    const now=Date.now();
    const due=current.filter(x=>Number(x.nextAttemptAt||0)<=now).slice(0,100);
    if(!due.length){setStatus('RETRY_WAIT');return;}
    const {data}=await post('/sync/batch',{transactions:due.map(x=>x.transaction)});
    const byId=new Map((data.results||[]).map(x=>[x.transactionId,x.status]));
    const acknowledged=[];
    const remaining=[];
    for(const item of current){
      const id=item.transaction?.transactionId;
      const status=byId.get(id);
      if(status==='STORED'||status==='ALREADY_STORED'){acknowledged.push(id);continue;}
      if(status==='CONFLICT'){saveConflict(item,status);remaining.push({...item,attempts:Number(item.attempts||0)+1,nextAttemptAt:Date.now()+300000,lastError:'CONFLICT'});continue;}
      if(due.includes(item)){
        const attempts=Number(item.attempts||0)+1;
        remaining.push({...item,attempts,nextAttemptAt:Date.now()+Math.min(300000,Math.max(3000,2**Math.min(attempts,8)*1000)),lastError:data?.error||null});
      }else remaining.push(item);
    }
    if(acknowledged.length)addAcks(acknowledged);
    writeJson(OUTBOX_KEY,remaining);
    setStatus(remaining.length?'QUEUED':'SYNCED',{acknowledged:acknowledged.length,conflicts:conflicts().length});
  }catch(error){
    const list=outbox().map(item=>{const attempts=Number(item.attempts||0)+1;return {...item,attempts,nextAttemptAt:Date.now()+Math.min(300000,Math.max(3000,2**Math.min(attempts,8)*1000)),lastError:error instanceof Error?error.message:String(error)}});
    writeJson(OUTBOX_KEY,list);
    setStatus('GATEWAY_UNREACHABLE',{error:error instanceof Error?error.message:String(error)});
  }finally{
    syncing=false;
    if(outbox().length)scheduleSync(5000);
  }
}

function scheduleSync(delay=1500){
  if(timer)clearTimeout(timer);
  timer=setTimeout(flushOutbox,delay);
}

async function reconcile(registerId){
  const local=transactions().filter(x=>!registerId||x.registerId===registerId);
  const rid=registerId||local[0]?.registerId;
  if(!rid)return {status:'NO_REGISTER'};
  const ids=local.map(x=>x.transactionId);
  const {data}=await post('/sync/reconcile',{registerId:rid,transactionIds:ids},20000);
  const missing=new Set(data.missingRemote||[]);
  if(missing.size)queueTransactions(local.filter(x=>missing.has(x.transactionId)));
  if((data.missingLocal||[]).length)await restoreRegister(rid);
  scheduleSync(50);
  return data;
}

async function restoreRegister(registerId,{since=null}={}){
  if(!registerId)throw new Error('REGISTER_ID_REQUIRED');
  const url=new URL(`${GATEWAY}/sync/transactions`);url.searchParams.set('register_id',registerId);if(since)url.searchParams.set('since',since);
  const res=await fetch(url,{cache:'no-store'});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data?.error||`HTTP_${res.status}`);
  const local=transactions();
  const map=new Map(local.map(x=>[x.transactionId,x]));
  const conflictRows=conflicts();
  let added=0,conflictCount=0;
  for(const remote of data.transactions||[]){
    const old=map.get(remote.transactionId);
    if(!old){map.set(remote.transactionId,remote);added++;continue;}
    const sameHash=old.recordHash&&remote.recordHash&&old.recordHash===remote.recordHash;
    const samePayload=JSON.stringify(old)===JSON.stringify(remote);
    if(!sameHash&&!samePayload){
      conflictCount++;
      if(!conflictRows.some(x=>x.transactionId===remote.transactionId))conflictRows.push({transactionId:remote.transactionId,registerId,detectedAt:nowIso(),remoteStatus:'RESTORE_CONFLICT',localRecordHash:old.recordHash||null,remoteRecordHash:remote.recordHash||null});
    }
  }
  const merged=[...map.values()].sort((a,b)=>String(a.time||a.endTime||'').localeCompare(String(b.time||b.endTime||'')));
  originalSetItem.call(localStorage,TRANSACTION_KEY,JSON.stringify(merged));
  writeJson(CONFLICT_KEY,conflictRows.slice(-2000));
  addAcks((data.transactions||[]).map(x=>x.transactionId).filter(Boolean));
  setStatus(conflictCount?'CONFLICT':'RESTORED',{added,remoteCount:data.count||0,conflicts:conflictCount});
  return {status:conflictCount?'CONFLICT':'OK',added,remoteCount:data.count||0,conflicts:conflictCount};
}

function getStatus(){return readJson(STATUS_KEY,{state:'INIT',queued:outbox().length});}

window.KCResilience=Object.freeze({
  gateway:GATEWAY,
  flush:flushOutbox,
  reconcile,
  restoreRegister,
  scan:scanLocalTransactions,
  status:getStatus,
  queueSize:()=>outbox().length,
  conflicts:()=>conflicts().slice()
});

window.addEventListener('online',()=>{setStatus('ONLINE');scanLocalTransactions();});
window.addEventListener('offline',()=>setStatus('OFFLINE'));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scanLocalTransactions();});
scanLocalTransactions();
setInterval(()=>{scanLocalTransactions();},30000);

})();
