/* PC Manager – Einkaufszutaten / Rezeptbezüge Weihnachtsmarkt
   Additiv: keine vorhandenen Zutaten, Mengen oder Preise werden überschrieben. */
(function(global){
  'use strict';
  const VERSION='0.1.0';
  const STORE='kcm_recipe_procurement_catalog_v1';
  const ITEMS=[
    {id:'WM-HH-WUERFELZUCKER',name:'Würfelzucker',supplier:'Handelshof',procurement:'Selbstabholung',packageText:'Packungsgröße noch erfassen',price:null},
    {id:'WM-HH-SENF-BOLTE-MITTEL',name:'Bolte Senf, mittelscharf',supplier:'Handelshof',procurement:'Selbstabholung',packageText:'ca. 800 ml Flasche – genaue Größe prüfen',price:null},
    {id:'WM-HH-KARTOFFEL-KLEIN-VORGEGART',name:'Kartoffeln, klein, vorgegart',supplier:'Handelshof',procurement:'Selbstabholung',packageText:'Gebinde/Menge noch erfassen',price:null},
    {id:'WM-HH-ZWIEBELN',name:'Zwiebeln',supplier:'Handelshof',procurement:'Selbstabholung',packageText:'Gebinde/Menge noch erfassen',price:null},
    {id:'WM-HH-APFEL',name:'Äpfel',supplier:'Handelshof',procurement:'Selbstabholung',packageText:'Sorte/Gebinde noch erfassen',price:null},
    {id:'WM-HH-HERINGSFILETS',name:'Heringsfilets',supplier:'Handelshof',procurement:'Selbstabholung',packageText:'Gebinde/Menge noch erfassen',price:null},
    {id:'WM-HH-SAHNE',name:'Sahne',supplier:'Handelshof',procurement:'Selbstabholung',packageText:'Gebinde/Menge noch erfassen',price:null},
    {id:'WM-HH-MAYONNAISE',name:'Mayonnaise',supplier:'Handelshof',procurement:'Selbstabholung',packageText:'Gebinde/Menge noch erfassen',price:null},
    {id:'WM-HH-POPP-KARTOFFELCREME',name:'Popp Kartoffelcreme',supplier:'Handelshof',procurement:'Selbstabholung',packageText:'ca. 2,5 kg Schale – genaue Größe prüfen',price:null},
    {id:'WM-ALDI-RUM-54',name:'Rum 54 % vol.',supplier:'Aldi',procurement:'Selbstabholung',packageText:'Marke/Flaschengröße noch erfassen',price:null,alcoholPercent:54},
    {id:'WM-ALDI-GEWUERZSPEKULATIUS',name:'Gewürzspekulatius',supplier:'Aldi',procurement:'Selbstabholung',packageText:'Packungsgröße noch erfassen',price:null,freeIssue:true},
    {id:'WM-HH-PAPIERSERVIETTEN',name:'Papierservietten',supplier:'Handelshof',procurement:'Selbstabholung',packageText:'Packungsgröße noch erfassen',price:null,consumable:true},
    {id:'WM-HH-ALUFOLIE',name:'Alufolie',supplier:'Handelshof',procurement:'Selbstabholung',packageText:'Rollenlänge/Breite noch erfassen',price:null,consumable:true},
    {id:'WM-HH-FRISCHHALTEFOLIE',name:'Frischhaltefolie',supplier:'Handelshof',procurement:'Selbstabholung',packageText:'Rollenlänge/Breite noch erfassen',price:null,consumable:true},
    {id:'WM-HH-HEMDCHENBEUTEL',name:'Hemdchenbeutel / Einkaufstaschen',supplier:'Handelshof',procurement:'Selbstabholung',packageText:'Packungsgröße noch erfassen',price:null,consumable:true}
  ];
  const LINKS={
    hering:[
      ['WM-HH-KARTOFFEL-KLEIN-VORGEGART','Kartoffeln, klein, vorgegart'],['WM-HH-ZWIEBELN','Zwiebeln'],['WM-HH-APFEL','Äpfel'],
      ['WM-HH-HERINGSFILETS','Heringsfilets'],['WM-HH-SAHNE','Sahne'],['WM-HH-MAYONNAISE','Mayonnaise']
    ],
    knirpsecreme:[['WM-HH-KARTOFFEL-KLEIN-VORGEGART','Kartoffeln, klein, vorgegart'],['WM-HH-POPP-KARTOFFELCREME','Popp Kartoffelcreme']],
    feuer:[['WM-ALDI-RUM-54','Rum 54 % vol.']]
  };
  function read(){try{return JSON.parse(localStorage.getItem(STORE)||'null')||{}}catch{return {}}}
  function seed(){
    const old=read(),items=new Map((old.items||[]).map(x=>[x.id,x]));ITEMS.forEach(x=>items.set(x.id,{...x,...(items.get(x.id)||{})}));
    const links={...(old.links||{})};Object.entries(LINKS).forEach(([pid,list])=>{if(!Array.isArray(links[pid])||!links[pid].length)links[pid]=list.map(([itemId,name])=>({itemId,name,amount:null,unit:null,status:'Menge offen'}));});
    const result={version:VERSION,items:[...items.values()],links,existingReferences:{rum40:{name:'Rum 40 % vol.',action:'vorhandenen Datensatz verwenden; nicht doppelt anlegen'},amaretto:{name:'Amaretto',action:'vorhandenen Datensatz verwenden; nicht doppelt anlegen'}}};
    localStorage.setItem(STORE,JSON.stringify(result));return result;
  }
  function byId(id){return seed().items.find(x=>x.id===id)||null}
  function forProduct(productId){return (seed().links[String(productId)]||[]).map(x=>({...x,item:byId(x.itemId)}));}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function ensureUi(){
    const panel=document.getElementById('recipePanel');if(!panel||document.getElementById('recipeProcurementLinks'))return;
    const summary=document.getElementById('recipeSummary');if(!summary)return;
    const box=document.createElement('fieldset');box.id='recipeProcurementLinks';box.innerHTML='<legend>Einkaufszutaten / Beschaffung</legend><div id="recipeProcurementBody"></div>';summary.insertAdjacentElement('beforebegin',box);render();
    document.getElementById('articleBody')?.addEventListener('click',()=>setTimeout(render,0));
    document.getElementById('aId')?.addEventListener('input',render);
  }
  function render(){
    const box=document.getElementById('recipeProcurementBody');if(!box)return;const pid=document.getElementById('aId')?.value?.trim()||'';const rows=forProduct(pid);
    if(!rows.length){box.innerHTML='<p class="hint">Für diesen Artikel sind noch keine zusätzlichen Einkaufszutaten aus der Weihnachtsmarkt-Beschaffung hinterlegt.</p>';return;}
    box.innerHTML=`<div class="recipe-scroll"><table class="recipe-table"><thead><tr><th>Zutat</th><th>Bezugsquelle</th><th>Gebinde</th><th>Rezeptmenge</th></tr></thead><tbody>${rows.map(x=>`<tr><td><strong>${esc(x.name)}</strong></td><td>${esc(x.item?.procurement)} ${esc(x.item?.supplier)}</td><td>${esc(x.item?.packageText)}</td><td><strong>${x.amount==null?'noch erfassen':esc(x.amount+' '+(x.unit||''))}</strong></td></tr>`).join('')}</tbody></table></div><p class="hint">Diese Liste ist Beschaffungs-/Zuordnungshilfe. Erst nach Eingabe der tatsächlichen Rezeptmenge wird sie kalkulationswirksam. Vorhandener 40-%-Rum und Amaretto bleiben unverändert und werden nicht doppelt angelegt.</p>`;
  }
  seed();const mo=new MutationObserver(ensureUi);mo.observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureUi);else ensureUi();
  global.KCRecipeProcurementCatalog={VERSION,ITEMS,LINKS,forProduct,seed};
})(window);
