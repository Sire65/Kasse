/* KC PC-Manager · Lieferantenzuordnung aus KC Verwaltung
   KC Verwaltung bleibt führend für Adressen/Lieferanten. Der Manager speichert nur die Zuordnung.
*/
(function(global){
'use strict';
const ORG='KC_WERNE',LOCAL='kcm_supplier_links_v1';
const FALLBACK=[
 {id:'kcverwaltung:egv-unna',name:'EGV AG Unna',method:'delivery'},
 {id:'kcverwaltung:kaub',name:'Weinkellerei Emil Kaub & Co. KG',method:'delivery'},
 {id:'kcverwaltung:aldi',name:'ALDI',method:'pickup'},
 {id:'kcverwaltung:handelshof',name:'Handelshof',method:'pickup'},
 {id:'kcverwaltung:kralemann-bergkamen',name:'Kralemann Metzgerei Bergkamen',method:'pickup'}
];
const $=id=>document.getElementById(id), sb=()=>global.KCSupabase;
const online=()=>!!sb()?.istAngemeldet?.()&&navigator.onLine;
const rpc=(name,args)=>sb().rufeFunktionAuf(name,args);
function readLocal(){try{return JSON.parse(localStorage.getItem(LOCAL)||'{}')}catch{return {}}}
function writeLocal(x){localStorage.setItem(LOCAL,JSON.stringify(x))}
function supplierName(a){return String(a?.company||`${a?.firstName||''} ${a?.lastName||''}`).trim()}
function fromKCVerwaltung(){
  const found=[];
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);if(!key||!key.startsWith('kng_'))continue;
    try{
      const s=JSON.parse(localStorage.getItem(key)||'null');
      (s?.addresses||[]).filter(a=>String(a?.category||'').toLowerCase()==='lieferant').forEach(a=>{
        const name=supplierName(a);if(name)found.push({id:String(a.id||a.no||name),name,method:''});
      });
    }catch{}
  }
  const map=new Map();[...found,...FALLBACK].forEach(x=>{const k=x.name.toLowerCase();if(!map.has(k))map.set(k,x)});return [...map.values()];
}
function defaultFor(code,name){const s=`${code||''} ${name||''}`.toLowerCase();if(/mett|mettwurst/.test(s))return FALLBACK[4];if(/eier|advocaat|rebenschoppen|milsani|sahne/.test(s))return FALLBACK[2];if(/kaub|roter feger|weihnachtsapfel|apfelpunsch|glühwein|gluehwein/.test(s))return FALLBACK[1];return null}
function style(){if($('kcSupplierLinkStyle'))return;const n=document.createElement('style');n.id='kcSupplierLinkStyle';n.textContent='.kc-supplier-link{margin-top:8px;padding:10px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc}.kc-supplier-link-grid{display:grid;grid-template-columns:2fr 1fr auto;gap:8px;align-items:end}.kc-supplier-link label{display:grid;gap:4px;font-size:12px}.kc-supplier-link select{min-height:38px}.kc-supplier-hint{font-size:12px;color:#475569;margin-top:6px}.kc-supplier-status{font-size:12px;margin-top:5px}.kc-supplier-status.warn{color:#9a3412}';document.head.appendChild(n)}
function mount(){
  const input=$('aSupplier');if(!input||$('kcSupplierLink'))return false;style();
  input.readOnly=true;input.title='Lieferant wird aus KC Verwaltung zugeordnet';
  const box=document.createElement('div');box.id='kcSupplierLink';box.className='kc-supplier-link';box.innerHTML='<div class="kc-supplier-link-grid"><label>Lieferant aus KC Verwaltung<select id="kcSupplierSelect"></select></label><label>Beschaffungsart<select id="kcProcurement"><option value="delivery">Lieferung durch Lieferant</option><option value="pickup">Abholung bei Lieferant</option></select></label><button type="button" id="kcSupplierRefresh">↻ Adressen laden</button></div><div class="kc-supplier-hint">Führende Lieferantenadresse: KC Verwaltung. Im PC Manager wird nur die Artikel-Zuordnung gespeichert.</div><div id="kcSupplierStatus" class="kc-supplier-status"></div>';
  input.insertAdjacentElement('afterend',box);$('kcSupplierRefresh').onclick=()=>{fill();loadCurrent()};$('kcSupplierSelect').onchange=()=>{const o=$('kcSupplierSelect').selectedOptions[0];if(o?.dataset.method)$('kcProcurement').value=o.dataset.method;input.value=o?.textContent||''};fill();wire();loadCurrent();return true
}
function fill(){const select=$('kcSupplierSelect');if(!select)return;const list=fromKCVerwaltung();select.innerHTML='<option value="">— Lieferant wählen —</option>'+list.map(x=>`<option value="${String(x.id).replace(/"/g,'&quot;')}" data-method="${x.method||''}">${x.name}</option>`).join('')}
function status(t,w=false){const n=$('kcSupplierStatus');if(n){n.textContent=t;n.className='kc-supplier-status'+(w?' warn':'')}}
async function loadCurrent(){
 const code=$('aId')?.value?.trim(),name=$('aName')?.value?.trim();if(!code)return;
 let link=readLocal()[code]||null;
 if(online())try{const r=await rpc('kc_manager_article_supplier_link',{p_article_code:code});if(r&&r.supplier_ref_id)link=r}catch(e){status('Zentrale Zuordnung konnte nicht geladen werden: '+e.message,true)}
 if(!link){const d=defaultFor(code,name);if(d)link={supplier_ref_id:d.id,supplier_name:d.name,procurement_method:d.method,provisional:true}}
 if(link){const s=$('kcSupplierSelect');if(![...s.options].some(o=>o.value===link.supplier_ref_id)){const o=document.createElement('option');o.value=link.supplier_ref_id;o.textContent=link.supplier_name;s.appendChild(o)}s.value=link.supplier_ref_id;$('kcProcurement').value=link.procurement_method||'pickup';$('aSupplier').value=link.supplier_name||'';status(link.provisional?'Vorschlag gesetzt – beim Speichern wird die Zuordnung übernommen.':'Lieferantenzuordnung geladen.')}else{$('kcSupplierSelect').value='';status('Noch kein Lieferant zugeordnet.')}
}
async function saveCurrent(){
 const code=$('aId')?.value?.trim(),s=$('kcSupplierSelect'),opt=s?.selectedOptions?.[0];if(!code||!opt?.value)return;
 const payload={org_id:ORG,article_code:code,supplier_ref_id:opt.value,supplier_name:opt.textContent.trim(),procurement_method:$('kcProcurement').value};$('aSupplier').value=payload.supplier_name;
 const all=readLocal();all[code]=payload;writeLocal(all);
 if(online())try{await rpc('kc_manager_save_article_supplier_link',{p_payload:payload});status('Zuordnung in Supabase gespeichert.')}catch(e){status('Lokal gespeichert; Supabase: '+e.message,true)}else status('Offline: Zuordnung lokal vorgemerkt.',true)
}
function wire(){
 $('articleBody')?.addEventListener('click',()=>setTimeout(loadCurrent,0));
 $('articleToolbar')?.addEventListener('click',e=>{const b=e.target.closest('button[data-cmd="save"]');if(b)setTimeout(saveCurrent,0)});
 $('aId')?.addEventListener('change',loadCurrent);
}
const obs=new MutationObserver(()=>{if(mount())obs.disconnect()});obs.observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
global.KCSupplierLink={reload:()=>{fill();return loadCurrent()},save:saveCurrent,fromKCVerwaltung};
})(window);
