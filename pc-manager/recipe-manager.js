(function(global){
  'use strict';
  const VERSION='0.2.0';
  const STORE='kcm_recipes_v1';
  const PENDING_STORE='kcm_recipes_pending_v1';
  const ORG_ID='KC_WERNE';
  const core=global.KCRecipeCalculationCore;
  if(!core)return;

  let recipes=seedKnownRecipes(readStore()), currentRows=[];
  let cloudReady=false, cloudLoading=false;
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function readJson(key,fallback){try{const value=JSON.parse(localStorage.getItem(key)||'null');return value??fallback}catch{return fallback}}
  function readStore(){const value=readJson(STORE,[]);return Array.isArray(value)?value:[]}
  function saveStore(){localStorage.setItem(STORE,JSON.stringify(recipes))}
  function pendingIds(){const value=readJson(PENDING_STORE,[]);return Array.isArray(value)?value:[]}
  function setPending(ids){localStorage.setItem(PENDING_STORE,JSON.stringify([...new Set(ids.filter(Boolean))]))}
  function markPending(productId){setPending([...pendingIds(),productId])}
  function clearPending(productId){setPending(pendingIds().filter(id=>id!==productId))}

  function seedKnownRecipes(records){
    const common=[
      {name:'Speck',amount:0,unit:'kg',preparation:'gewürfelt; anbraten; vollständig einschließlich ausgelassenem Fett und Bratensatz verwenden',lossPercent:0,notes:'Kein Abtropfverlust; genaue Einsatzmenge noch offen.'},
      {name:'Zwiebeln',amount:0,unit:'kg',preparation:'mit Speck anbraten; vollständig einschließlich Fett und Bratensatz verwenden',lossPercent:0,notes:'Kein Abtropfverlust; genaue Einsatzmenge noch offen.'},
      {name:'Zucker',amount:0,unit:'kg',preparation:'Einsatzmenge noch festlegen',lossPercent:0}
    ];
    const definitions={
      gruenkohl:{name:'Grünkohl Grundrezept',base:{name:'Grünkohl',amount:10,unit:'kg',preparation:'1 Grünkohlkarton; genaue Fertigausbeute noch erfassen',lossPercent:0},extra:[]},
      gruenkohlmett:{name:'Grünkohl + Mettwurst Grundrezept',base:{name:'Grünkohl',amount:10,unit:'kg',preparation:'1 Grünkohlkarton; genaue Fertigausbeute noch erfassen',lossPercent:0},extra:[]},
      sauerkraut:{name:'Sauerkrauteintopf Grundrezept',base:{name:'Sauerkraut',amount:1,unit:'dose',preparation:'10/1-Dose; genaue Netto- und Fertigausbeute noch erfassen',lossPercent:0},extra:[
        {name:'Lorbeerblätter',amount:0,unit:'stueck',preparation:'Einsatzmenge noch festlegen',lossPercent:0},
        {name:'Nelken',amount:0,unit:'stueck',preparation:'Einsatzmenge noch festlegen',lossPercent:0},
        {name:'Wacholderbeeren',amount:0,unit:'stueck',preparation:'Einsatzmenge noch festlegen',lossPercent:0}
      ]},
      sauerkrautmett:{name:'Sauerkrauteintopf + Mettwurst Grundrezept',base:{name:'Sauerkraut',amount:1,unit:'dose',preparation:'10/1-Dose; genaue Netto- und Fertigausbeute noch erfassen',lossPercent:0},extra:[
        {name:'Lorbeerblätter',amount:0,unit:'stueck',preparation:'Einsatzmenge noch festlegen',lossPercent:0},
        {name:'Nelken',amount:0,unit:'stueck',preparation:'Einsatzmenge noch festlegen',lossPercent:0},
        {name:'Wacholderbeeren',amount:0,unit:'stueck',preparation:'Einsatzmenge noch festlegen',lossPercent:0}
      ]}
    };
    Object.entries(definitions).forEach(([productId,def])=>{
      let recipe=records.find(item=>item.productId===productId);
      if(!recipe){recipe=core.normalizeRecipe({productId,name:def.name,status:'draft',outputAmount:0,outputUnit:'kg',portionAmount:250,portionUnit:'g',ingredients:[]});records.push(recipe)}
      recipe.ingredients||=[];
      [def.base,...common,...def.extra].forEach(raw=>{if(!recipe.ingredients.some(item=>item.name.toLocaleLowerCase('de-DE')===raw.name.toLocaleLowerCase('de-DE')))recipe.ingredients.push(core.normalizeIngredient(raw))});
      recipe.publicImportant=recipe.publicImportant||'Speck-Zwiebel-Gemisch wird vollständig einschließlich ausgelassenem Fett und Bratensatz verwendet; kein Abtropfverlust. Genaue Einsatzmengen und Fertigausbeute sind noch zu erfassen.';
    });
    try{localStorage.setItem(STORE,JSON.stringify(records))}catch{}
    return records;
  }

  function syncConfig(){return readJson('kcm_sync',{})||{}}
  function cloudConfig(){
    const s=syncConfig();
    if(s.mode!=='online'||s.provider!=='supabase'||!s.url||!s.publicKey)return null;
    return {url:String(s.url).replace(/\/$/,''),key:s.publicKey,token:s.token||s.publicKey};
  }
  function cloudHeaders(extra={}){
    const c=cloudConfig();if(!c)return null;
    return {'Content-Type':'application/json','apikey':c.key,'Authorization':`Bearer ${c.token}`,...extra};
  }
  async function cloudFetch(path,options={}){
    const c=cloudConfig();if(!c)throw new Error('Supabase-Teammodus ist nicht eingerichtet.');
    if(!navigator.onLine)throw new Error('Keine Internetverbindung.');
    const response=await fetch(`${c.url}${path}`,{...options,headers:{...cloudHeaders(),...(options.headers||{})}});
    if(!response.ok){let detail='';try{detail=(await response.json())?.message||''}catch{}throw new Error(`Supabase HTTP ${response.status}${detail?': '+detail:''}`)}
    if(response.status===204)return null;
    const text=await response.text();return text?JSON.parse(text):null;
  }
  function num(v){return v===null||v===undefined||v===''?null:Number(v)}
  function dbRecipeToLocal(row,ingredientRows){
    return core.normalizeRecipe({
      productId:row.product_code,name:row.name,version:row.version,status:row.status,
      outputAmount:num(row.output_amount),outputUnit:row.output_unit||'kg',portionAmount:num(row.portion_amount),portionUnit:row.portion_unit||'g',
      reservePercent:num(row.reserve_percent)||0,publicIngredients:row.public_ingredients||'',publicAdditives:row.public_additives||'',
      publicImportant:row.public_important||'',source:row.source||'',approvedBy:row.approved_by||'',approvedAt:row.approved_at||'',
      ingredients:ingredientRows.filter(x=>x.recipe_id===row.recipe_id).sort((a,b)=>a.line_no-b.line_no).map(x=>core.normalizeIngredient({
        id:x.ingredient_id,name:x.name,amount:num(x.amount)||0,unit:x.unit||'kg',preparation:x.preparation||'',lossPercent:num(x.loss_percent)||0,
        publicIngredient:!!x.public_ingredient,unitCost:num(x.unit_cost),supplierId:x.supplier_id||'',articleId:x.ingredient_code||x.ingredient_article_id||'',notes:x.notes||''
      }))
    });
  }
  function recipePayload(recipe){
    return {
      org_id:ORG_ID,product_code:recipe.productId,name:recipe.name,version:recipe.version||'1.0.0',status:recipe.status||'draft',
      output_amount:recipe.outputAmount??null,output_unit:recipe.outputUnit||null,portion_amount:recipe.portionAmount??null,portion_unit:recipe.portionUnit||null,
      reserve_percent:recipe.reservePercent||0,public_ingredients:recipe.publicIngredients||null,public_additives:recipe.publicAdditives||null,
      public_important:recipe.publicImportant||null,source:recipe.source||null,approved_by:recipe.approvedBy||null,approved_at:recipe.approvedAt||null,active:true
    };
  }
  function ingredientPayload(recipe){
    return (recipe.ingredients||[]).map((x,index)=>({
      line_no:index+1,ingredient_code:x.articleId||null,name:x.name,amount:x.amount??null,unit:x.unit||null,preparation:x.preparation||null,
      loss_percent:x.lossPercent||0,public_ingredient:!!x.publicIngredient,unit_cost:x.unitCost??null,supplier_id:x.supplierId||null,notes:x.notes||null
    }));
  }
  async function pushRecipe(recipe){
    await cloudFetch('/rest/v1/rpc/kc_manager_save_recipe',{method:'POST',body:JSON.stringify({p_recipe:recipePayload(recipe),p_ingredients:ingredientPayload(recipe)})});
    clearPending(recipe.productId);
  }
  async function pullAll(){
    const heads=await cloudFetch(`/rest/v1/kc_manager_recipes?org_id=eq.${encodeURIComponent(ORG_ID)}&active=eq.true&select=*&order=product_code.asc`);
    const lines=await cloudFetch('/rest/v1/kc_manager_recipe_ingredients?select=*&order=recipe_id.asc,line_no.asc');
    if(!Array.isArray(heads))throw new Error('Ungültige Rezeptantwort von Supabase.');
    recipes=heads.map(row=>dbRecipeToLocal(row,Array.isArray(lines)?lines:[]));
    saveStore();cloudReady=true;
  }
  async function flushPending(){
    for(const id of pendingIds()){
      const recipe=recipes.find(x=>x.productId===id);if(!recipe){clearPending(id);continue}
      await pushRecipe(recipe);
    }
  }
  async function initializeCloud(){
    if(cloudLoading)return;cloudLoading=true;
    try{
      if(!cloudConfig())return;
      await flushPending();
      const before=recipes.slice();
      await pullAll();
      if(!recipes.length&&before.length){
        recipes=before;
        for(const recipe of before){await pushRecipe(recipe)}
        await pullAll();
      }
      load();status(`Supabase verbunden · ${recipes.length} Rezepturen zentral geladen.`);
    }catch(error){cloudReady=false;status(`Offline-Cache aktiv: ${error.message}`,true)}
    finally{cloudLoading=false}
  }

  function articleId(){return $('aId')?.value.trim()||''}
  function articleName(){return $('aName')?.value.trim()||'Artikel'}
  function existing(){return recipes.find(x=>x.productId===articleId())}
  function download(name,payload){const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:name});a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
  function status(message,warn=false){const node=$('recipeStatus');if(node){node.textContent=message;node.className=`recipe-result${warn?' warn':''}`}}

  function mount(){
    const tabs=document.querySelector('[data-view-panel="articles"] .tabs'),editor=document.querySelector('[data-view-panel="articles"] .article-editor');
    if(!tabs||!editor||$('recipePanel'))return;
    const tab=document.createElement('button');tab.type='button';tab.dataset.atab='recipe-core';tab.textContent='Rezeptur & Kalkulation';tabs.append(tab);
    const panel=document.createElement('div');panel.id='recipePanel';panel.className='atab';panel.dataset.apanel='recipe-core';
    panel.innerHTML=`<div class="recipe-card">
      <p class="recipe-public-note"><strong>Zentrale Speicherung:</strong> Supabase ist die führende Rezeptdatenbank. Der Browser hält nur einen Offline-Cache; offene Änderungen werden beim nächsten Online-Kontakt automatisch übertragen.</p>
      <div class="form-grid">
        <label>Rezeptname<input id="recipeName"></label><label>Version<input id="recipeVersion" value="1.0.0"></label>
        <label>Status<select id="recipeApproval"><option value="draft">Entwurf</option><option value="review">In Prüfung</option><option value="approved">Freigegeben</option><option value="outdated">Veraltet</option><option value="blocked">Gesperrt</option></select></label>
        <label>Fertige Rezeptmenge<input id="recipeOutput" type="number" min="0" step=".001"></label><label>Einheit<select id="recipeOutputUnit"><option>kg</option><option>g</option><option>l</option><option>ml</option></select></label>
        <label>Portionsgröße<input id="recipePortion" type="number" min="0" step=".1" value="250"></label><label>Einheit<select id="recipePortionUnit"><option>g</option><option>kg</option><option>ml</option><option>l</option></select></label>
        <label>Sicherheitsreserve %<input id="recipeReserve" type="number" min="0" max="50" step=".1" value="0"></label>
        <label>Gewünschte Portionen<input id="recipeDesired" type="number" min="0" step="1"></label>
      </div>
      <div class="recipe-scroll"><table class="recipe-table"><thead><tr><th>Zutat</th><th>Menge</th><th>Einheit</th><th>Vorbereitung</th><th>Verlust %</th><th>öffentlich</th><th></th></tr></thead><tbody id="recipeRows"></tbody></table></div>
      <fieldset><legend>Rückwärtsrechnung aus vorhandenem Bestand</legend><div class="form-grid"><label>Bezugszutat<select id="recipeReference"></select></label><label>Vorhandene Menge<input id="recipeAvailable" type="number" min="0" step=".001"></label><label>Einheit<select id="recipeAvailableUnit">${core.UNITS.map(u=>`<option>${u}</option>`).join('')}</select></label><button type="button" id="recipeReverse">Aus Bestand berechnen</button></div></fieldset>
      <div class="recipe-toolbar"><button id="recipeAdd">＋ Zutat</button><button id="recipeCalculate">Neu berechnen</button><button id="recipeSave" class="primary">Rezeptur in Supabase speichern</button><button id="recipeCloudReload">↻ Aus Supabase laden</button><button id="recipeExportAdmin">Verwaltungs-/Einkaufsexport</button><button id="recipeExportPos">Nur Informationen für Kasse</button></div>
      <div id="recipeSummary" class="recipe-summary"></div><div id="recipeStatus" class="recipe-result">Rezeptur bereit.</div>
    </div>`;
    editor.append(panel);
    tab.onclick=()=>{tabs.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===tab));editor.querySelectorAll('.atab').forEach(x=>x.classList.toggle('active',x===panel));load();if(!cloudReady)initializeCloud()};
    tabs.querySelectorAll('button:not([data-atab="recipe-core"])').forEach(button=>button.addEventListener('click',()=>panel.classList.remove('active')));
    $('recipeAdd').onclick=()=>{currentRows.push(core.normalizeIngredient({name:'Neue Zutat',amount:1,unit:'kg'}));renderRows()};
    $('recipeRows').addEventListener('input',readRows);
    $('recipeRows').addEventListener('click',event=>{const button=event.target.closest('[data-recipe-remove]');if(!button)return;currentRows.splice(+button.dataset.recipeRemove,1);renderRows();calculate()});
    $('recipeCalculate').onclick=calculate;$('recipeReverse').onclick=calculateReverse;$('recipeSave').onclick=save;
    $('recipeCloudReload').onclick=initializeCloud;
    $('recipeExportAdmin').onclick=()=>download(`Rezepturen_Verwaltung_${new Date().toISOString().slice(0,10)}.json`,{schema:'KC_RECIPE_PACKAGE_V1',version:VERSION,createdAt:new Date().toISOString(),recipes});
    $('recipeExportPos').onclick=exportPublic;
    document.getElementById('articleBody')?.addEventListener('click',()=>setTimeout(()=>{if(panel.classList.contains('active'))load()},0));
    window.addEventListener('online',()=>initializeCloud());
    load();initializeCloud();
  }

  function readRows(){
    const vorher=new Map((currentRows||[]).map(x=>[String(x.id),x]));
    currentRows=[...$('recipeRows').querySelectorAll('tr[data-id]')].map(row=>core.normalizeIngredient({
      ...(vorher.get(String(row.dataset.id))||{}),id:row.dataset.id,name:row.querySelector('[data-k="name"]').value,
      amount:row.querySelector('[data-k="amount"]').value,unit:row.querySelector('[data-k="unit"]').value,
      preparation:row.querySelector('[data-k="preparation"]').value,lossPercent:row.querySelector('[data-k="loss"]').value,
      publicIngredient:row.querySelector('[data-k="public"]').checked
    }));
  }
  function renderRows(){
    $('recipeRows').innerHTML=currentRows.map((row,index)=>`<tr data-id="${esc(row.id)}"><td><input data-k="name" value="${esc(row.name)}"></td><td><input data-k="amount" type="number" min="0" step=".001" value="${row.amount}"></td><td><select data-k="unit">${core.UNITS.map(u=>`<option ${u===row.unit?'selected':''}>${u}</option>`).join('')}</select></td><td><input data-k="preparation" value="${esc(row.preparation)}" placeholder="z. B. gewürfelt"></td><td><input data-k="loss" type="number" min="0" max="99" step=".1" value="${row.lossPercent}"></td><td><input data-k="public" type="checkbox" ${row.publicIngredient?'checked':''}></td><td><button data-recipe-remove="${index}" title="Zutat entfernen">🗑</button></td></tr>`).join('')||'<tr><td colspan="7">Noch keine Zutaten. Bitte „Zutat“ wählen.</td></tr>';
    const selected=$('recipeReference')?.value;$('recipeReference').innerHTML=currentRows.map(row=>`<option value="${esc(row.id)}">${esc(row.name)}</option>`).join('');if(selected&&currentRows.some(x=>x.id===selected))$('recipeReference').value=selected;
  }
  function formRecipe(){
    readRows();const old=existing()||{};
    return core.normalizeRecipe({...old,productId:articleId(),name:$('recipeName').value,version:$('recipeVersion').value,status:$('recipeApproval').value,
      outputAmount:$('recipeOutput').value,outputUnit:$('recipeOutputUnit').value,portionAmount:$('recipePortion').value,portionUnit:$('recipePortionUnit').value,
      reservePercent:$('recipeReserve').value,ingredients:currentRows,publicIngredients:$('aIngredients')?.value||'',publicAdditives:$('aContents')?.value||'',
      publicImportant:$('aImportant')?.value||'',allergens:readAllergens(),nutrition:readNutrition(),source:$('aInfoSource')?.value||'',
      approvedBy:$('aInfoApprovedBy')?.value||'',approvedAt:$('aInfoApprovedAt')?.value||''});
  }
  function readAllergens(){const out={};document.querySelectorAll('[data-big14]').forEach(x=>out[x.dataset.big14]=x.value);return out}
  function readNutrition(){const map={energyKj:'aEnergyKj',energyKcal:'aEnergyKcal',fat:'aFat',saturates:'aSaturates',carbohydrate:'aCarbohydrate',sugars:'aSugars',protein:'aProtein',salt:'aSalt'},out={};Object.entries(map).forEach(([key,id])=>{const v=$(id)?.value;out[key]=v===''||v==null?null:Number(v)});return out}
  function calculate(){try{const recipe=formRecipe(),result=core.calculate(recipe,{desiredPortions:$('recipeDesired').value||undefined});$('recipeDesired').value=Math.round(result.desiredPortions);$('recipeSummary').innerHTML=`<span><b>${result.basePortions.toFixed(1)}</b><br>Portionen im Grundrezept</span><span><b>${result.desiredPortions.toFixed(0)}</b><br>geplante Portionen</span><span><b>${result.factor.toFixed(3)}</b><br>Skalierungsfaktor</span><span><b>${result.reservePercent.toFixed(1)} %</b><br>Reserve</span>`;status(result.ingredients.map(x=>`${x.name}: ${x.requiredAmount.toLocaleString('de-DE',{maximumFractionDigits:3})} ${x.unit}`).join(' · ')||'Keine Zutaten.')}catch(error){status(error.message,true)}}
  function calculateReverse(){try{const result=core.calculateFromAvailable(formRecipe(),$('recipeReference').value,$('recipeAvailable').value,$('recipeAvailableUnit').value);$('recipeDesired').value=Math.floor(result.desiredPortions);$('recipeSummary').innerHTML=`<span><b>${result.basePortions.toFixed(1)}</b><br>Portionen im Grundrezept</span><span><b>${Math.floor(result.desiredPortions)}</b><br>mögliche volle Portionen</span><span><b>${result.factor.toFixed(3)}</b><br>Skalierungsfaktor</span><span><b>0 %</b><br>Bestandsrechnung</span>`;status(`Aus dem Bestand sind ${Math.floor(result.desiredPortions)} volle Portionen möglich. Bedarf: ${result.ingredients.map(x=>`${x.name} ${x.requiredAmount.toLocaleString('de-DE',{maximumFractionDigits:3})} ${x.unit}`).join(' · ')}`)}catch(error){status(error.message,true)}}

  async function save(){
    let recipe,check;
    try{
      recipe=formRecipe();check=core.validate(recipe);if(!check.ok)throw new Error(check.errors.join(' '));
      const index=recipes.findIndex(x=>x.productId===recipe.productId);if(index>=0)recipes[index]=recipe;else recipes.push(recipe);
      saveStore();markPending(recipe.productId);calculate();
      if(!cloudConfig())return status(`Rezeptur „${recipe.name}“ lokal zwischengespeichert. Supabase-Teammodus ist noch nicht eingerichtet.`,true);
      status(`Rezeptur „${recipe.name}“ wird in Supabase gespeichert …`);
      await pushRecipe(recipe);cloudReady=true;
      status(`Rezeptur „${recipe.name}“ zentral in Supabase gespeichert.${check.warnings.length?' Hinweise: '+check.warnings.join(' '):''}`,check.warnings.length>0);
    }catch(error){if(recipe?.productId)markPending(recipe.productId);status(`Speichern vorgemerkt: ${error.message}`,true)}
  }
  function exportPublic(){const articles=JSON.parse(localStorage.getItem('kcm_articles')||'[]'),infoById=new Map(articles.map(a=>[a.id,a.info||{}]));const approved=recipes.filter(r=>r.status==='approved');if(!approved.length)return status('Keine freigegebene Rezeptur für die Kasse vorhanden.',true);const payload=core.makePublicPackage(approved.map(recipe=>({recipe,info:infoById.get(recipe.productId)||{}})));download(`Kasseninformationen_${new Date().toISOString().slice(0,10)}.json`,payload);status(`${payload.products.length} freigegebene Informationsdatensätze wurden ohne Mengen, Kosten und Lieferantendaten exportiert.`)}
  function load(){const recipe=existing()||core.normalizeRecipe({productId:articleId(),name:`${articleName()} Grundrezept`,outputAmount:1,outputUnit:'kg',portionAmount:250,portionUnit:'g'});$('recipeName').value=recipe.name;$('recipeVersion').value=recipe.version;$('recipeApproval').value=recipe.status;$('recipeOutput').value=recipe.outputAmount||'';$('recipeOutputUnit').value=recipe.outputUnit;$('recipePortion').value=recipe.portionAmount||250;$('recipePortionUnit').value=recipe.portionUnit;$('recipeReserve').value=recipe.reservePercent||0;currentRows=(recipe.ingredients||[]).map(core.normalizeIngredient);renderRows();calculate()}

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
  global.KCRecipeManager={version:VERSION,reload:load,refreshFromSupabase:initializeCloud,isCloudReady:()=>cloudReady};
})(window);
