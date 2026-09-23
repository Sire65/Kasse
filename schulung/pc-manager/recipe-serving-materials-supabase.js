/* PC Manager – zentrale Supabase-Synchronisation für Ausgabegefäße/Verbrauchsmaterial.
   Supabase ist führend; localStorage bleibt Offline-Cache. */
(function(global){
  'use strict';
  const VERSION='1.0.0';
  const ORG_ID='KC_WERNE';
  const MATERIAL_STORE='kcm_consumables_v1';
  const ASSIGN_STORE='kcm_recipe_serving_materials_v1';
  const PENDING_STORE='kcm_serving_materials_pending_v1';
  let ready=false,lastSnapshot='',busy=false;

  const read=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback}catch{return fallback}};
  const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
  function config(){
    const s=read('kcm_sync',{})||{};
    if(s.mode!=='online'||s.provider!=='supabase'||!s.url||!s.publicKey)return null;
    return {url:String(s.url).replace(/\/$/,''),key:s.publicKey,token:s.token||s.publicKey};
  }
  function headers(extra={}){const c=config();return c?{'Content-Type':'application/json','apikey':c.key,'Authorization':`Bearer ${c.token}`,...extra}:null}
  async function request(path,options={}){
    const c=config();if(!c)throw new Error('Supabase-Teammodus nicht eingerichtet.');
    if(!navigator.onLine)throw new Error('Offline.');
    const r=await fetch(c.url+path,{...options,headers:{...headers(),...(options.headers||{})}});
    if(!r.ok)throw new Error(`Supabase HTTP ${r.status}: ${await r.text()}`);
    if(r.status===204)return null;const t=await r.text();return t?JSON.parse(t):null;
  }
  function fromDb(x){return {
    id:x.material_id,name:x.name,type:x.material_type,usageType:x.usage_type,kind:x.kind||'',material:x.material||'',capacityMl:x.capacity_ml,
    packSize:x.pack_size==null?null:Number(x.pack_size),packUnit:x.pack_unit||'Stück',packPriceNet:x.pack_price_net==null?null:Number(x.pack_price_net),
    packPriceGross:x.pack_price_gross==null?null:Number(x.pack_price_gross),unitCostGross:Number(x.unit_cost_gross||0),currency:x.currency||'EUR',
    taxIncluded:x.tax_included!==false,color:x.color||'',disposable:!!x.disposable,reusable:!!x.reusable,depositGross:Number(x.deposit_gross||0),
    lidIncluded:!!x.lid_included,image:x.image_path||'',sourceNote:x.source_note||'',active:x.active!==false
  }}
  function toDb(x){return {
    material_id:x.id,org_id:ORG_ID,name:x.name,material_type:x.type||'Verbrauchsmaterial',usage_type:x.usageType||'Ausgabegefäß',kind:x.kind||null,
    material:x.material||null,capacity_ml:x.capacityMl??null,pack_size:x.packSize??null,pack_unit:x.packUnit||'Stück',pack_price_net:x.packPriceNet??null,
    pack_price_gross:x.packPriceGross??null,unit_cost_gross:Number(x.unitCostGross||0),currency:x.currency||'EUR',tax_included:x.taxIncluded!==false,
    color:x.color||null,disposable:!!x.disposable,reusable:!!x.reusable,deposit_gross:Number(x.depositGross||0),lid_included:!!x.lidIncluded,
    image_path:x.image||null,source_note:x.sourceNote||null,active:x.active!==false,updated_at:new Date().toISOString()
  }}
  function snapshot(){return JSON.stringify([read(MATERIAL_STORE,[]),read(ASSIGN_STORE,{})])}
  function pending(){const x=read(PENDING_STORE,null);return x&&typeof x==='object'?x:null}
  function capturePending(reason='offline-change'){
    const payload={capturedAt:new Date().toISOString(),reason,materials:read(MATERIAL_STORE,[]),assignments:read(ASSIGN_STORE,{})};
    write(PENDING_STORE,payload);
    global.dispatchEvent(new CustomEvent('kc-serving-materials-pending',{detail:{pending:true,reason}}));
    return payload;
  }
  function clearPending(){localStorage.removeItem(PENDING_STORE);global.dispatchEvent(new CustomEvent('kc-serving-materials-pending',{detail:{pending:false}}))}
  function restorePendingLocal(){
    const p=pending();if(!p)return false;
    write(MATERIAL_STORE,Array.isArray(p.materials)?p.materials:[]);
    write(ASSIGN_STORE,p.assignments&&typeof p.assignments==='object'?p.assignments:{});
    global.dispatchEvent(new CustomEvent('kc-serving-materials-synced',{detail:{direction:'pending-restore'}}));
    return true;
  }
  async function pull(){
    const mats=await request(`/rest/v1/kc_manager_serving_materials?org_id=eq.${ORG_ID}&active=eq.true&select=*`);
    const links=await request(`/rest/v1/kc_manager_recipe_serving_materials?org_id=eq.${ORG_ID}&active=eq.true&select=*`);
    if(Array.isArray(mats))write(MATERIAL_STORE,mats.map(fromDb));
    if(Array.isArray(links)){
      const a={};links.forEach(x=>{(a[x.product_code]||(a[x.product_code]=[])).push({materialId:x.material_id,qtyPerPortion:Number(x.qty_per_portion||1),role:x.role||'Ausgabegefäß'})});
      write(ASSIGN_STORE,a);
    }
    lastSnapshot=snapshot();ready=true;
    global.dispatchEvent(new CustomEvent('kc-serving-materials-synced',{detail:{direction:'pull'}}));
  }
  async function push(){
    const mats=(read(MATERIAL_STORE,[])||[]).filter(x=>x&&x.id).map(toDb);
    const a=read(ASSIGN_STORE,{})||{},links=[];
    Object.entries(a).forEach(([productCode,rows])=>(Array.isArray(rows)?rows:[]).forEach(x=>links.push({org_id:ORG_ID,product_code:productCode,material_id:x.materialId,qty_per_portion:Number(x.qtyPerPortion||1),role:x.role||'Ausgabegefäß',active:true,updated_at:new Date().toISOString()})));
    if(mats.length)await request('/rest/v1/kc_manager_serving_materials?on_conflict=material_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(mats)});
    if(links.length)await request('/rest/v1/kc_manager_recipe_serving_materials?on_conflict=org_id,product_code,material_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(links)});
    lastSnapshot=snapshot();
    global.dispatchEvent(new CustomEvent('kc-serving-materials-synced',{detail:{direction:'push'}}));
  }
  async function pushPending(){
    if(busy||!config()||!navigator.onLine||!pending())return false;
    busy=true;
    try{
      // Erst den aktuellen Cloud-Stand holen. Pending bleibt separat erhalten.
      await pull();
      if(!restorePendingLocal())return false;
      await push();
      clearPending();
      return true;
    }catch(e){console.warn('Ausgabegefäß-Pending:',e.message);return false}
    finally{busy=false}
  }
  async function syncNow(forcePush=false){if(busy||!config())return false;busy=true;try{if(!ready&&!forcePush)await pull();else if(forcePush&&!pending())await push();else if(!forcePush)await pull();return true}catch(e){console.warn('Ausgabegefäß-Sync:',e.message);return false}finally{busy=false}}
  function watch(){setInterval(()=>{
    if(busy||!config())return;
    const now=snapshot();
    if(!navigator.onLine){if(now!==lastSnapshot)capturePending('offline-change');return}
    if(!ready){syncNow(false);return}
    if(pending())return;
    if(now!==lastSnapshot)syncNow(true);
  },1500)}
  async function boot(){lastSnapshot=snapshot();await syncNow(false);watch()}
  global.addEventListener('online',()=>{ready=false;syncNow(false)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else setTimeout(boot,0);
  global.KCServingMaterialsSupabase=Object.freeze({VERSION,syncNow,pull,push,pending,hasPending:()=>!!pending(),restorePendingLocal,pushPending});
})(window);
