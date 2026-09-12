(function(global){
  'use strict';
  const VERSION='0.2.0';
  const MATERIAL_STORE='kcm_consumables_v1';
  const ASSIGN_STORE='kcm_recipe_serving_materials_v1';
  const BOWL_ID='CONSUMABLE-BOWL-BAGASSE-500-WM';
  const BOWL_DEFAULT={
    id:BOWL_ID,name:'Einwegschale Bagasse, weiß, 500 ml',type:'Verbrauchsmaterial',usageType:'Ausgabegefäß',kind:'Schale',material:'Zuckerrohr/Bagasse',
    capacityMl:500,packSize:100,packPriceGross:14.99,unitCostGross:0.1499,currency:'EUR',taxIncluded:true,color:'weiß',disposable:true,
    plasticFree:true,biodegradable:true,compostable:true,greaseResistant:true,waterResistant:true,microwaveSuitable:true,refrigeratorSuitable:true,
    maxTemperatureC:100,image:'assets/einwegschale_bagasse_500ml.jpg',sourceNote:'Produktangaben/Preis laut Betreiber-Screenshot vom 12.09.2026; 14,99 € brutto je 100 Stück.'
  };
  const DEFAULT_PRODUCTS=['gruenkohl','gruenkohlmett','sauerkraut','sauerkrautmett','hering','knirpsecreme'];
  const PERSIST_MARKER='[AUSGABEGESCHIRR]';

  function read(key,fallback){try{const x=JSON.parse(localStorage.getItem(key)||'null');return x??fallback}catch{return fallback}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch(e){console.warn('Verbrauchsmaterial konnte nicht gespeichert werden',e)}}
  function materials(){return read(MATERIAL_STORE,[])}
  function assignments(){return read(ASSIGN_STORE,{})}
  function material(id){return materials().find(x=>x.id===id)||null}
  function currentBowl(){return material(BOWL_ID)||BOWL_DEFAULT}
  function seed(){
    const list=materials(),map=new Map((Array.isArray(list)?list:[]).map(x=>[x.id,x])),existing=map.get(BOWL_ID);
    map.set(BOWL_ID,{...BOWL_DEFAULT,...(existing||{}),id:BOWL_ID,unitCostGross:existing?.packSize?Number(existing.packPriceGross||0)/Number(existing.packSize):BOWL_DEFAULT.unitCostGross});
    write(MATERIAL_STORE,[...map.values()]);
    const a=assignments();DEFAULT_PRODUCTS.forEach(productId=>{if(!Array.isArray(a[productId])||!a[productId].length)a[productId]=[{materialId:BOWL_ID,qtyPerPortion:1,role:'Ausgabegefäß'}]});write(ASSIGN_STORE,a);
  }
  function updateMaterial(patch={}){const list=materials(),i=list.findIndex(x=>x.id===BOWL_ID),old=i>=0?list[i]:BOWL_DEFAULT,next={...old,...patch,id:BOWL_ID};next.packSize=Math.max(1,Number(next.packSize)||1);next.packPriceGross=Math.max(0,Number(next.packPriceGross)||0);next.unitCostGross=next.packPriceGross/next.packSize;if(i>=0)list[i]=next;else list.push(next);write(MATERIAL_STORE,list);render();return next}
  function forProduct(productId){return (assignments()[String(productId)]||[]).map(link=>({link,material:material(link.materialId)})).filter(x=>x.material)}
  function costForProduct(productId,portions){
    const count=Math.max(0,Number(portions)||0),rows=forProduct(productId).map(({link,material})=>{const qtyPerPortion=Math.max(0,Number(link.qtyPerPortion)||0),unitCost=Number(material.unitCostGross)||0;return {materialId:material.id,name:material.name,role:link.role||material.usageType,qtyPerPortion,unitCost,costPerPortion:qtyPerPortion*unitCost,requiredQty:count*qtyPerPortion,totalCost:count*qtyPerPortion*unitCost}});
    return {rows,totalCost:rows.reduce((s,x)=>s+x.totalCost,0),costPerPortion:rows.reduce((s,x)=>s+x.costPerPortion,0)};
  }
  function assign(productId,materialId=BOWL_ID,qtyPerPortion=1){const a=assignments();a[productId]=[{materialId,qtyPerPortion:Math.max(0,Number(qtyPerPortion)||0),role:'Ausgabegefäß'}];write(ASSIGN_STORE,a);render();return a[productId]}
  seed();

  function isPersistedMaterial(x){return !!x&&(x.articleId===BOWL_ID||x.ingredientCode===BOWL_ID||String(x.name||'').trim()===currentBowl().name||String(x.preparation||'').includes(PERSIST_MARKER))}
  function wrapCore(original){
    if(!original||original.__servingMaterialWrapped)return original;
    return Object.freeze({...original,__servingMaterialWrapped:true,calculate(recipe,options={}){
      const result=original.calculate(recipe,options),effective=result.desiredPortions*(1+Number(result.reservePercent||0)/100),c=costForProduct(recipe.productId,effective);
      const persisted=(result.ingredients||[]).filter(isPersistedMaterial),persistedCost=persisted.reduce((s,x)=>s+(Number(x.totalCost)||0),0),hasPersisted=persisted.some(x=>Number(x.amount)>0&&Number(x.unitCost)>0);
      const baseCost=result.totalCost==null?0:Number(result.totalCost),servingCost=hasPersisted?persistedCost:c.totalCost;
      return {...result,ingredientCost:result.totalCost==null&&!hasPersisted?null:Math.max(0,baseCost-persistedCost),servingMaterials:c.rows,servingMaterialCost:servingCost,servingMaterialCostPerPortion:c.costPerPortion,totalCost:baseCost+(hasPersisted?0:c.totalCost)};
    }});
  }
  if(global.KCRecipeCalculationCore)global.KCRecipeCalculationCore=wrapCore(global.KCRecipeCalculationCore);
  else{let coreValue;try{Object.defineProperty(global,'KCRecipeCalculationCore',{configurable:true,enumerable:true,get(){return coreValue},set(value){coreValue=wrapCore(value)}})}catch(e){console.warn('Rezept-Core-Hook konnte nicht vorbereitet werden',e)}}

  function unitBase(value,unit){const n=Number(value)||0,u=String(unit||'').toLowerCase();if(u==='kg'||u==='l')return n*1000;if(u==='g'||u==='ml')return n;if(u==='mg')return n/1000;return NaN}
  function basePortionsFromPayload(r){const out=unitBase(r?.output_amount,r?.output_unit),portion=unitBase(r?.portion_amount,r?.portion_unit);return Number.isFinite(out)&&Number.isFinite(portion)&&portion>0?out/portion:0}
  function installSupabaseBridge(){
    if(!global.fetch||global.fetch.__kcServingMaterialBridge)return;const native=global.fetch.bind(global);
    const bridged=async function(input,init={}){
      try{
        const url=typeof input==='string'?input:String(input?.url||'');
        if(url.includes('/rest/v1/rpc/kc_manager_save_recipe')&&typeof init.body==='string'){
          const body=JSON.parse(init.body),pid=String(body?.p_recipe?.product_code||''),links=forProduct(pid);
          if(links.length){
            let lines=Array.isArray(body.p_ingredients)?body.p_ingredients.slice():[];
            lines=lines.filter(x=>x?.ingredient_code!==BOWL_ID&&String(x?.preparation||'').indexOf(PERSIST_MARKER)<0&&String(x?.name||'')!==currentBowl().name);
            const basePortions=basePortionsFromPayload(body.p_recipe);
            links.forEach(({link,material})=>{if(basePortions>0)lines.push({line_no:lines.length+1,ingredient_code:material.id,name:material.name,amount:basePortions*Math.max(0,Number(link.qtyPerPortion)||0),unit:'stueck',preparation:`${PERSIST_MARKER} ${link.role||material.usageType}; ${material.kind}; ${material.capacityMl} ml`,loss_percent:0,public_ingredient:false,unit_cost:Number(material.unitCostGross)||0,supplier_id:null,notes:`${material.type}; Packung ${material.packSize} Stück / ${Number(material.packPriceGross||0).toFixed(2)} € brutto. Automatisch aus Ausgabegefäß-Zuordnung.`})});
            body.p_ingredients=lines.map((x,i)=>({...x,line_no:i+1}));init={...init,body:JSON.stringify(body)};
          }
        }
      }catch(e){console.warn('Ausgabegefäß konnte dem Supabase-Rezeptauftrag nicht ergänzt werden',e)}
      return native(input,init);
    };bridged.__kcServingMaterialBridge=true;global.fetch=bridged;
  }
  installSupabaseBridge();

  function money(v){return Number(v||0).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:4})+' €'}
  function productId(){return document.getElementById('aId')?.value?.trim()||''}
  function desired(){return Number(document.getElementById('recipeDesired')?.value||0)||0}
  function reserve(){return Number(document.getElementById('recipeReserve')?.value||0)||0}
  function hideMaterialRows(){document.querySelectorAll('#recipeRows tr[data-id]').forEach(tr=>{const n=tr.querySelector('[data-k="name"]')?.value||'',p=tr.querySelector('[data-k="preparation"]')?.value||'';if(n===currentBowl().name||p.includes(PERSIST_MARKER)){tr.style.display='none';tr.dataset.servingMaterial='1'}})}
  function ensureUi(){
    const panel=document.getElementById('recipePanel');if(!panel)return;hideMaterialRows();if(document.getElementById('recipeServingMaterials'))return;
    const summary=document.getElementById('recipeSummary');if(!summary)return;const box=document.createElement('fieldset');box.id='recipeServingMaterials';box.className='recipe-serving-materials';box.innerHTML='<legend>Ausgabegefäß / Verbrauchsmaterial</legend><div id="recipeServingMaterialBody"></div>';summary.insertAdjacentElement('beforebegin',box);render();
    ['aId','recipeDesired','recipeOutput','recipePortion','recipeReserve'].forEach(id=>document.getElementById(id)?.addEventListener('input',()=>setTimeout(render,0)));document.getElementById('recipeCalculate')?.addEventListener('click',()=>setTimeout(render,0));
  }
  function render(){
    hideMaterialRows();const box=document.getElementById('recipeServingMaterialBody');if(!box)return;const pid=productId(),links=forProduct(pid),planned=desired()*(1+reserve()/100);
    if(!pid){box.innerHTML='<p class="hint">Zuerst einen Artikel wählen.</p>';return}
    if(!links.length){box.innerHTML='<p>Noch kein Ausgabegefäß zugeordnet.</p><button type="button" id="assignBagasseBowl">500-ml-Bagasse-Schale zuordnen</button>';document.getElementById('assignBagasseBowl').onclick=()=>assign(pid);return}
    const c=costForProduct(pid,planned),m=currentBowl();
    box.innerHTML=`<div style="display:grid;grid-template-columns:90px 1fr auto;gap:12px;align-items:center;margin:8px 0"><img src="${m.image}" alt="Einwegschale" style="width:86px;height:70px;object-fit:contain;background:#fff;border:1px solid #ddd;border-radius:8px"><div><strong>${m.name}</strong><br><small>${m.usageType} · ${m.capacityMl} ml · ${m.material}</small><br><label>Packpreis brutto <input id="servingPackPrice" type="number" min="0" step="0.01" value="${Number(m.packPriceGross).toFixed(2)}" style="width:86px"> €</label> <label>Packgröße <input id="servingPackSize" type="number" min="1" step="1" value="${m.packSize}" style="width:72px"> Stk.</label><br><small>= ${money(m.unitCostGross)} je Schale</small></div><label>Menge/Portion <input id="servingQty" type="number" min="0" step="1" value="${links[0].link.qtyPerPortion}" style="width:70px"></label></div><p><strong>Verpackungskosten:</strong> ${money(c.costPerPortion)} je Portion${planned?` · geplante Menge inkl. Reserve ${planned.toLocaleString('de-DE',{maximumFractionDigits:1})} = ${money(c.totalCost)}`:''}. Beim Speichern wird die Zuordnung als nichtöffentliches Verbrauchsmaterial zentral mit dem Rezept in Supabase gesichert.</p>`;
    document.getElementById('servingQty')?.addEventListener('change',e=>assign(pid,BOWL_ID,e.target.value));
    const price=document.getElementById('servingPackPrice'),size=document.getElementById('servingPackSize'),upd=()=>updateMaterial({packPriceGross:price.value,packSize:size.value});price?.addEventListener('change',upd);size?.addEventListener('change',upd);
  }
  const observer=new MutationObserver(()=>ensureUi());observer.observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureUi);else setTimeout(ensureUi,0);
  global.KCServingMaterials=Object.freeze({VERSION,BOWL_ID,get BOWL(){return currentBowl()},materials,assignments,forProduct,costForProduct,assign,updateMaterial});
})(window);
