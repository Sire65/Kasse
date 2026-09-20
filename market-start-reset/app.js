(function(){
'use strict';
const CONFIRM='MARKTSTART 2026';
const POS_KEYS=[
  'kc_transactions_v040','kc_transactions_v030','kc_transactions_v020',
  'kc_training_transactions_v040','kc_cash_withdrawals_v018','kc_closings',
  'kc_discount_audit_v020','kc_tip_records','kc_donation_records','kc_voids_v040',
  'kc_cash_movements','kc_cash_import_audit','kc_cash_used_transfers','kc_training_next_bon_v018'
];
const MANAGER_KEYS=[
  'kcm_closings','kcm_cashcounts','kcm_sales','kcm_tips','kcm_cash_movements',
  'kcm_cash_audit','kcm_withdrawals','kcm_discount_audit','kcm_practice',
  'kcm_device_tests','kcm_mock_remote'
];
const PROTECTED_KEYS=[
  'kc_products_v050','kc_groups_v050','kc_master_v040',
  'kcm_groups','kcm_articles','kcm_accounts','kcm_settings','kcm_devices',
  'kc_cash_measure_settings_v1','kcm_registers','kcm_receipt'
];
const AUDIT_KEY='kc_market_start_local_audit_v1';
let previewReady=false,lastPreview=null;
const $=id=>document.getElementById(id);
const num=v=>Number(v||0).toLocaleString('de-DE');

function countValue(key){
  const raw=localStorage.getItem(key);
  if(raw==null)return 0;
  try{
    const v=JSON.parse(raw);
    if(Array.isArray(v))return v.length;
    if(v&&typeof v==='object')return Object.keys(v).length;
    return raw?1:0;
  }catch{return raw?1:0}
}
function openTxDb(){
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){resolve(null);return}
    const req=indexedDB.open('kc_pos_transactions_v1',1);
    req.onupgradeneeded=event=>{
      const db=event.target.result;
      if(!db.objectStoreNames.contains('transactions'))db.createObjectStore('transactions',{keyPath:'transactionId'});
      if(!db.objectStoreNames.contains('trainingTransactions'))db.createObjectStore('trainingTransactions',{keyPath:'transactionId'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
function storeCount(db,name){
  return new Promise((resolve,reject)=>{
    if(!db||!db.objectStoreNames.contains(name)){resolve(0);return}
    const tx=db.transaction(name,'readonly'),req=tx.objectStore(name).count();
    req.onsuccess=()=>resolve(req.result||0);req.onerror=()=>reject(req.error);
  });
}
async function txCounts(){
  const db=await openTxDb();
  if(!db)return {sales:0,training:0};
  try{return {sales:await storeCount(db,'transactions'),training:await storeCount(db,'trainingTransactions')}}
  finally{db.close()}
}
async function clearTxStores(){
  const db=await openTxDb();
  if(!db)return;
  const stores=['transactions','trainingTransactions'].filter(x=>db.objectStoreNames.contains(x));
  if(!stores.length){db.close();return}
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(stores,'readwrite');
    stores.forEach(s=>tx.objectStore(s).clear());
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
  db.close();
}
function sumKeys(keys){return keys.reduce((s,k)=>s+countValue(k),0)}
function details(keys){return keys.map(k=>({key:k,count:countValue(k)})).filter(x=>x.count>0)}
function setStatus(text,kind='info'){const el=$('status');el.className='status '+kind;el.textContent=text}
function enable(){if($('executeBtn'))$('executeBtn').disabled=!(previewReady&&$('confirmText').value===CONFIRM)}
function saveAudit(entry){
  let rows=[];try{rows=JSON.parse(localStorage.getItem(AUDIT_KEY)||'[]');if(!Array.isArray(rows))rows=[]}catch{}
  rows.push(entry);localStorage.setItem(AUDIT_KEY,JSON.stringify(rows.slice(-20)));
}
async function preview(){
  $('previewBtn').disabled=true;setStatus('Lokale Speicher werden geprüft …','info');
  try{
    const tx=await txCounts();
    const posLegacySales=countValue('kc_transactions_v040')+countValue('kc_transactions_v030')+countValue('kc_transactions_v020');
    const posLegacyTraining=countValue('kc_training_transactions_v040');
    const posOther=POS_KEYS.filter(k=>!k.startsWith('kc_transactions_')&&k!=='kc_training_transactions_v040').reduce((s,k)=>s+countValue(k),0);
    const manager=sumKeys(MANAGER_KEYS);
    const protectedPresent=PROTECTED_KEYS.filter(k=>localStorage.getItem(k)!=null).length;
    lastPreview={
      posSales:tx.sales+posLegacySales,
      posTraining:tx.training+posLegacyTraining,
      posOther,manager,protectedPresent,
      posDetails:details(POS_KEYS),managerDetails:details(MANAGER_KEYS)
    };
    $('posSales').textContent=num(lastPreview.posSales);
    $('posTraining').textContent=num(lastPreview.posTraining);
    $('posMovement').textContent=num(posOther);
    $('managerMovement').textContent=num(manager);
    $('protectedCount').textContent=num(protectedPresent);
    const rows=[...lastPreview.posDetails.map(x=>'POS · '+x.key+' · '+x.count),...lastPreview.managerDetails.map(x=>'Manager · '+x.key+' · '+x.count)];
    $('previewDetails').innerHTML=rows.length?rows.map(x=>'<div>'+x.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</div>').join(''):'Keine lokalen Bewegungslisten im Browser gefunden.';
    previewReady=true;
    const total=lastPreview.posSales+lastPreview.posTraining+posOther+manager;
    setStatus(total?num(total)+' lokale Bewegungs-/Testeinträge sind für die Bereinigung vorgemerkt.':'Keine lokalen Bewegungs-/Testeinträge vorhanden.',total?'warn':'ok');
  }catch(e){
    previewReady=false;setStatus('Prüfung fehlgeschlagen: '+String(e?.message||e),'error');
  }finally{$('previewBtn').disabled=false;enable()}
}
async function execute(){
  if(!previewReady||$('confirmText').value!==CONFIRM)return;
  $('executeBtn').disabled=true;setStatus('Lokale Marktstart-Vorbereitung läuft …','warn');
  try{
    const before=lastPreview;
    await clearTxStores();
    [...POS_KEYS,...MANAGER_KEYS].forEach(k=>localStorage.removeItem(k));
    saveAudit({time:new Date().toISOString(),action:'market_start_local_reset',confirmation:CONFIRM,before,protectedKeys:PROTECTED_KEYS});
    $('confirmText').value='';previewReady=false;
    setStatus('Lokale Bewegungsdaten wurden bereinigt. Stammdaten und Einstellungen blieben erhalten.','ok');
    await preview();
  }catch(e){setStatus('Bereinigung fehlgeschlagen: '+String(e?.message||e),'error')}
  finally{enable()}
}
$('previewBtn').addEventListener('click',preview);
$('confirmText').addEventListener('input',enable);
$('executeBtn').addEventListener('click',execute);
$('backBtn').addEventListener('click',()=>history.length>1?history.back():location.assign('../pc-manager/'));
preview();
})();