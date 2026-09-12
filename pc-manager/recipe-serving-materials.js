(function(global){
  'use strict';
  const VERSION='0.1.1';
  const MATERIAL_STORE='kcm_consumables_v1';
  const ASSIGN_STORE='kcm_recipe_serving_materials_v1';
  const BOWL_ID='CONSUMABLE-BOWL-BAGASSE-500-WM';
  const BOWL={
    id:BOWL_ID,
    name:'Einwegschale Bagasse, weiß, 500 ml',
    type:'Verbrauchsmaterial',
    usageType:'Ausgabegefäß',
    kind:'Schale',
    material:'Zuckerrohr/Bagasse',
    capacityMl:500,
    packSize:100,
    packPriceGross:14.99,
    unitCostGross:0.1499,
    currency:'EUR',
    taxIncluded:true,
    color:'weiß',
    disposable:true,
    plasticFree:true,
    biodegradable:true,
    compostable:true,
    greaseResistant:true,
    waterResistant:true,
    microwaveSuitable:true,
    refrigeratorSuitable:true,
    maxTemperatureC:100,
    image:'assets/einwegschale_bagasse_500ml.jpg',
    sourceNote:'Produktangaben/Preis laut Betreiber-Screenshot vom 12.09.2026; 14,99 € brutto je 100 Stück.'
  };
  const DEFAULT_PRODUCTS=['gruenkohl','gruenkohlmett','sauerkraut','sauerkrautmett','hering','knirpsecreme'];

  function read(key,fallback){try{const x=JSON.parse(localStorage.getItem(key)||'null');return x??fallback}catch{return fallback}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch(e){console.warn('Verbrauchsmaterial konnte nicht gespeichert werden',e)}}
  function seed(){
    const list=read(MATERIAL_STORE,[]);const map=new Map((Array.isArray(list)?list:[]).map(x=>[x.id,x]));
    map.set(BOWL_ID,{...(map.get(BOWL_ID)||{}),...BOWL});write(MATERIAL_STORE,[...map.values()]);
    const a=read(ASSIGN_STORE,{});DEFAULT_PRODUCTS.forEach(productId=>{if(!Array.isArray(a[productId])||!a[productId].length)a[productId]=[{materialId:BOWL_ID,qtyPerPortion:1,role:'Ausgabegefäß'}]});write(ASSIGN_STORE,a);
  }
  function materials(){return read(MATERIAL_STORE,[])}
  function assignments(){return read(ASSIGN_STORE,{})}
  function material(id){return materials().find(x=>x.id===id)||null}
  function forProduct(productId){return (assignments()[String(productId)]||[]).map(link=>({link,material:material(link.materialId)})).filter(x=>x.material)}
  function costForProduct(productId,portions){
    const count=Math.max(0,Number(portions)||0);
    const rows=forProduct(productId).map(({link,material})=>{
      const qtyPerPortion=Math.max(0,Number(link.qtyPerPortion)||0),unitCost=Number(material.unitCostGross)||0;
      return {materialId:material.id,name:material.name,role:link.role||material.usageType,qtyPerPortion,unitCost,costPerPortion:qtyPerPortion*unitCost,requiredQty:count*qtyPerPortion,totalCost:count*qtyPerPortion*unitCost};
    });
    return {rows,totalCost:rows.reduce((s,x)=>s+x.totalCost,0),costPerPortion:rows.reduce((s,x)=>s+x.costPerPortion,0)};
  }
  function assign(productId,materialId=BOWL_ID,qtyPerPortion=1){const a=assignments();a[productId]=[{materialId,qtyPerPortion:Number(qtyPerPortion)||1,role:'Ausgabegefäß'}];write(ASSIGN_STORE,a);render();return a[productId]}

  seed();
  function wrapCore(original){
    if(!original||original.__servingMaterialWrapped)return original;
    return Object.freeze({...original,__servingMaterialWrapped:true,calculate(recipe,options={}){
      const result=original.calculate(recipe,options),c=costForProduct(recipe.productId,result.desiredPortions),ingredientCost=result.totalCost;
      return {...result,ingredientCost,servingMaterials:c.rows,servingMaterialCost:c.totalCost,servingMaterialCostPerPortion:c.costPerPortion,totalCost:(ingredientCost==null?0:ingredientCost)+c.totalCost};
    }});
  }
  if(global.KCRecipeCalculationCore){
    global.KCRecipeCalculationCore=wrapCore(global.KCRecipeCalculationCore);
  }else{
    let coreValue;
    try{
      Object.defineProperty(global,'KCRecipeCalculationCore',{configurable:true,enumerable:true,get(){return coreValue},set(value){coreValue=wrapCore(value)}});
    }catch(e){console.warn('Rezept-Core-Hook konnte nicht vorbereitet werden',e)}
  }

  function money(v){return Number(v||0).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:4})+' €'}
  function productId(){return document.getElementById('aId')?.value?.trim()||''}
  function desired(){return Number(document.getElementById('recipeDesired')?.value||0)||0}
  function ensureUi(){
    const panel=document.getElementById('recipePanel');if(!panel||document.getElementById('recipeServingMaterials'))return;
    const summary=document.getElementById('recipeSummary');if(!summary)return;
    const box=document.createElement('fieldset');box.id='recipeServingMaterials';box.className='recipe-serving-materials';
    box.innerHTML='<legend>Ausgabegefäß / Verbrauchsmaterial</legend><div id="recipeServingMaterialBody"></div>';
    summary.insertAdjacentElement('beforebegin',box);render();
    ['aId','recipeDesired','recipeOutput','recipePortion'].forEach(id=>document.getElementById(id)?.addEventListener('input',()=>setTimeout(render,0)));
    document.getElementById('recipeCalculate')?.addEventListener('click',()=>setTimeout(render,0));
  }
  function render(){
    const box=document.getElementById('recipeServingMaterialBody');if(!box)return;const pid=productId();const links=forProduct(pid);const portions=desired();
    if(!pid){box.innerHTML='<p class="hint">Zuerst einen Artikel wählen.</p>';return}
    if(!links.length){box.innerHTML=`<p>Noch kein Ausgabegefäß zugeordnet.</p><button type="button" id="assignBagasseBowl">500-ml-Bagasse-Schale zuordnen</button>`;document.getElementById('assignBagasseBowl').onclick=()=>assign(pid);return}
    const c=costForProduct(pid,portions);
    box.innerHTML=links.map(({link,material})=>`<div style="display:grid;grid-template-columns:90px 1fr auto;gap:12px;align-items:center;margin:8px 0"><img src="${material.image}" alt="" style="width:86px;height:70px;object-fit:contain;background:#fff;border:1px solid #ddd;border-radius:8px"><div><strong>${material.name}</strong><br><small>${material.usageType} · ${material.capacityMl} ml · ${material.material}<br>${material.packPriceGross.toFixed(2).replace('.',',')} € / ${material.packSize} Stück = ${money(material.unitCostGross)} je Portion</small></div><label>Menge/Portion <input id="servingQty" type="number" min="0" step="1" value="${link.qtyPerPortion}" style="width:70px"></label></div>`).join('')+`<p><strong>Verpackungskosten:</strong> ${money(c.costPerPortion)} je Portion${portions?` · ${portions} Portionen = ${money(c.totalCost)}`:''}. Dieser Betrag wird zusätzlich zu den Zutatenkosten in die Rezeptkalkulation eingerechnet.</p>`;
    document.getElementById('servingQty')?.addEventListener('change',e=>assign(pid,BOWL_ID,e.target.value));
  }
  const observer=new MutationObserver(()=>ensureUi());observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureUi);else setTimeout(ensureUi,0);
  global.KCServingMaterials=Object.freeze({VERSION,BOWL_ID,BOWL,materials,assignments,forProduct,costForProduct,assign});
})(window);
