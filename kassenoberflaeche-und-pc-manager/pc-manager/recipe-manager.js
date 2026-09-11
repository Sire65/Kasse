(function(global){
  'use strict';
  const VERSION='0.1.1', STORE='kcm_recipes_v1', core=global.KCRecipeCalculationCore;
  if(!core)return;
  let recipes=seedKnownRecipes(readStore()), currentRows=[];
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function readStore(){try{const value=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(value)?value:[]}catch{return[]}}
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
  function saveStore(){localStorage.setItem(STORE,JSON.stringify(recipes))}
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
      <p class="recipe-public-note"><strong>Getrennte Datenwege:</strong> Mengen, Verluste, Kosten und Lieferantenzuordnungen bleiben intern. Das Kassenpaket enthält ausschließlich Inhaltsstoffe, Allergene, Nährwerte und Hinweise.</p>
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
      <div class="recipe-toolbar"><button id="recipeAdd">＋ Zutat</button><button id="recipeCalculate">Neu berechnen</button><button id="recipeSave" class="primary">Rezeptur speichern</button><button id="recipeExportAdmin">Verwaltungs-/Einkaufsexport</button><button id="recipeExportPos">Nur Informationen für Kasse</button></div>
      <div id="recipeSummary" class="recipe-summary"></div><div id="recipeStatus" class="recipe-result">Rezeptur bereit.</div>
    </div>`;
    editor.append(panel);
    tab.onclick=()=>{tabs.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===tab));editor.querySelectorAll('.atab').forEach(x=>x.classList.toggle('active',x===panel));load()};
    tabs.querySelectorAll('button:not([data-atab="recipe-core"])').forEach(button=>button.addEventListener('click',()=>panel.classList.remove('active')));
    $('recipeAdd').onclick=()=>{currentRows.push(core.normalizeIngredient({name:'Neue Zutat',amount:1,unit:'kg'}));renderRows()};
    $('recipeRows').addEventListener('input',readRows);
    $('recipeRows').addEventListener('click',event=>{const button=event.target.closest('[data-recipe-remove]');if(!button)return;currentRows.splice(+button.dataset.recipeRemove,1);renderRows();calculate()});
    $('recipeCalculate').onclick=calculate;
    $('recipeReverse').onclick=calculateReverse;
    $('recipeSave').onclick=save;
    $('recipeExportAdmin').onclick=()=>download(`Rezepturen_Verwaltung_${new Date().toISOString().slice(0,10)}.json`,{schema:'KC_RECIPE_PACKAGE_V1',version:VERSION,createdAt:new Date().toISOString(),recipes});
    $('recipeExportPos').onclick=exportPublic;
    document.getElementById('articleBody')?.addEventListener('click',()=>setTimeout(()=>{if(panel.classList.contains('active'))load()},0));
    load();
  }
  /* BEFUND 31.08.2026: hier wurde jede Zutatenzeile aus NUR den sieben Feldern der Tabelle
     NEU aufgebaut. Alles, was an der Zutat hängt, aber keine eigene Spalte hat, ging dabei
     verloren: Einkaufspreis (unitCost), Lieferant (supplierId), Artikelbezug (articleId),
     Allergene und Notizen. Und weil readRows am "input"-Ereignis hängt, passierte das bei
     JEDEM Tastendruck in der Tabelle - lautlos, ohne Meldung.
     Nachgestellt: unitCost 7,50 -> null, supplierId "L-1" -> "", Notiz -> "", Allergene -> [].
     JETZT: die bestehende Zutat wird als Grundlage genommen und nur das überschrieben, was
     in der Tabelle wirklich bearbeitet werden kann. */
  function readRows(){
    const vorher=new Map((currentRows||[]).map(x=>[String(x.id),x]));
    currentRows=[...$('recipeRows').querySelectorAll('tr[data-id]')].map(row=>core.normalizeIngredient({
      ...(vorher.get(String(row.dataset.id))||{}),
      id:row.dataset.id,name:row.querySelector('[data-k="name"]').value,amount:row.querySelector('[data-k="amount"]').value,
      unit:row.querySelector('[data-k="unit"]').value,preparation:row.querySelector('[data-k="preparation"]').value,
      lossPercent:row.querySelector('[data-k="loss"]').value,publicIngredient:row.querySelector('[data-k="public"]').checked
    }));
  }
  function renderRows(){
    $('recipeRows').innerHTML=currentRows.map((row,index)=>`<tr data-id="${esc(row.id)}"><td><input data-k="name" value="${esc(row.name)}"></td><td><input data-k="amount" type="number" min="0" step=".001" value="${row.amount}"></td><td><select data-k="unit">${core.UNITS.map(u=>`<option ${u===row.unit?'selected':''}>${u}</option>`).join('')}</select></td><td><input data-k="preparation" value="${esc(row.preparation)}" placeholder="z. B. gewürfelt"></td><td><input data-k="loss" type="number" min="0" max="99" step=".1" value="${row.lossPercent}"></td><td><input data-k="public" type="checkbox" ${row.publicIngredient?'checked':''}></td><td><button data-recipe-remove="${index}" title="Zutat entfernen">🗑</button></td></tr>`).join('')||'<tr><td colspan="7">Noch keine Zutaten. Bitte „Zutat“ wählen.</td></tr>';
    const selected=$('recipeReference')?.value;$('recipeReference').innerHTML=currentRows.map(row=>`<option value="${esc(row.id)}">${esc(row.name)}</option>`).join('');if(selected&&currentRows.some(x=>x.id===selected))$('recipeReference').value=selected;
  }
  function formRecipe(){
    readRows();
    const old=existing()||{};
    return core.normalizeRecipe({...old,productId:articleId(),name:$('recipeName').value,version:$('recipeVersion').value,status:$('recipeApproval').value,
      outputAmount:$('recipeOutput').value,outputUnit:$('recipeOutputUnit').value,portionAmount:$('recipePortion').value,
      portionUnit:$('recipePortionUnit').value,reservePercent:$('recipeReserve').value,ingredients:currentRows,
      publicIngredients:$('aIngredients')?.value||'',publicAdditives:$('aContents')?.value||'',publicImportant:$('aImportant')?.value||'',
      allergens:readAllergens(),nutrition:readNutrition(),source:$('aInfoSource')?.value||'',approvedBy:$('aInfoApprovedBy')?.value||'',approvedAt:$('aInfoApprovedAt')?.value||''});
  }
  function readAllergens(){const out={};document.querySelectorAll('[data-big14]').forEach(x=>out[x.dataset.big14]=x.value);return out}
  function readNutrition(){const map={energyKj:'aEnergyKj',energyKcal:'aEnergyKcal',fat:'aFat',saturates:'aSaturates',carbohydrate:'aCarbohydrate',sugars:'aSugars',protein:'aProtein',salt:'aSalt'},out={};Object.entries(map).forEach(([key,id])=>{const v=$(id)?.value;out[key]=v===''||v==null?null:Number(v)});return out}
  function calculate(){
    try{const recipe=formRecipe(),result=core.calculate(recipe,{desiredPortions:$('recipeDesired').value||undefined});
      $('recipeDesired').value=Math.round(result.desiredPortions);
      $('recipeSummary').innerHTML=`<span><b>${result.basePortions.toFixed(1)}</b><br>Portionen im Grundrezept</span><span><b>${result.desiredPortions.toFixed(0)}</b><br>geplante Portionen</span><span><b>${result.factor.toFixed(3)}</b><br>Skalierungsfaktor</span><span><b>${result.reservePercent.toFixed(1)} %</b><br>Reserve</span>`;
      status(result.ingredients.map(x=>`${x.name}: ${x.requiredAmount.toLocaleString('de-DE',{maximumFractionDigits:3})} ${x.unit}`).join(' · ')||'Keine Zutaten.');
    }catch(error){status(error.message,true)}
  }
  function calculateReverse(){
    try{const result=core.calculateFromAvailable(formRecipe(),$('recipeReference').value,$('recipeAvailable').value,$('recipeAvailableUnit').value);
      $('recipeDesired').value=Math.floor(result.desiredPortions);$('recipeSummary').innerHTML=`<span><b>${result.basePortions.toFixed(1)}</b><br>Portionen im Grundrezept</span><span><b>${Math.floor(result.desiredPortions)}</b><br>mögliche volle Portionen</span><span><b>${result.factor.toFixed(3)}</b><br>Skalierungsfaktor</span><span><b>0 %</b><br>Bestandsrechnung</span>`;
      status(`Aus dem Bestand sind ${Math.floor(result.desiredPortions)} volle Portionen möglich. Bedarf: ${result.ingredients.map(x=>`${x.name} ${x.requiredAmount.toLocaleString('de-DE',{maximumFractionDigits:3})} ${x.unit}`).join(' · ')}`);
    }catch(error){status(error.message,true)}
  }
  function save(){
    try{const recipe=formRecipe(),check=core.validate(recipe);if(!check.ok)throw new Error(check.errors.join(' '));
      const index=recipes.findIndex(x=>x.productId===recipe.productId);if(index>=0)recipes[index]=recipe;else recipes.push(recipe);saveStore();calculate();
      status(`Rezeptur „${recipe.name}“ wurde gespeichert.${check.warnings.length?' Hinweise: '+check.warnings.join(' '):''}`,check.warnings.length>0);
    }catch(error){status(error.message,true)}
  }
  function exportPublic(){
    const articles=JSON.parse(localStorage.getItem('kcm_articles')||'[]'),infoById=new Map(articles.map(a=>[a.id,a.info||{}]));
    const approved=recipes.filter(r=>r.status==='approved');if(!approved.length)return status('Keine freigegebene Rezeptur für die Kasse vorhanden.',true);
    const payload=core.makePublicPackage(approved.map(recipe=>({recipe,info:infoById.get(recipe.productId)||{}})));
    download(`Kasseninformationen_${new Date().toISOString().slice(0,10)}.json`,payload);
    status(`${payload.products.length} freigegebene Informationsdatensätze wurden ohne Mengen, Kosten und Lieferantendaten exportiert.`);
  }
  function load(){
    const recipe=existing()||core.normalizeRecipe({productId:articleId(),name:`${articleName()} Grundrezept`,outputAmount:1,outputUnit:'kg',portionAmount:250,portionUnit:'g'});
    $('recipeName').value=recipe.name;$('recipeVersion').value=recipe.version;$('recipeApproval').value=recipe.status;
    $('recipeOutput').value=recipe.outputAmount||'';$('recipeOutputUnit').value=recipe.outputUnit;$('recipePortion').value=recipe.portionAmount||250;
    $('recipePortionUnit').value=recipe.portionUnit;$('recipeReserve').value=recipe.reservePercent||0;currentRows=recipe.ingredients.map(core.normalizeIngredient);renderRows();calculate();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
  global.KCRecipeManager={version:VERSION,reload:load};
})(window);
