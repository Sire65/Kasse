(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.KCRecipeCalculationCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '0.1.0';
  const MASS = {mg:.001,g:1,kg:1000};
  const VOLUME = {ml:1,l:1000};
  const COUNT = {stueck:1,portion:1,packung:1,dose:1,bund:1};
  const text = (value, max=500) => String(value ?? '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0,max);
  const number = (value, fallback=0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
  function unitFamily(unit) {
    const id = text(unit,20).toLowerCase().replace('stück','stueck');
    if (id in MASS) return 'mass';
    if (id in VOLUME) return 'volume';
    if (id in COUNT) return 'count';
    return 'unknown';
  }
  function toBase(amount, unit) {
    const id = text(unit,20).toLowerCase().replace('stück','stueck');
    const table = id in MASS ? MASS : id in VOLUME ? VOLUME : id in COUNT ? COUNT : null;
    if (!table) throw new Error(`Unbekannte Einheit: ${unit}`);
    return number(amount) * table[id];
  }
  function fromBase(amount, unit) {
    const id = text(unit,20).toLowerCase().replace('stück','stueck');
    const table = id in MASS ? MASS : id in VOLUME ? VOLUME : id in COUNT ? COUNT : null;
    if (!table) throw new Error(`Unbekannte Einheit: ${unit}`);
    return number(amount) / table[id];
  }
  function normalizeIngredient(raw={}) {
    const unit = text(raw.unit || 'kg',20).toLowerCase().replace('stück','stueck');
    return {
      id:text(raw.id || uid('ZUTAT'),60), name:text(raw.name,160),
      amount:Math.max(0,number(raw.amount)), unit, family:unitFamily(unit),
      preparation:text(raw.preparation,200), lossPercent:Math.min(99,Math.max(0,number(raw.lossPercent))),
      articleId:text(raw.articleId,80), supplierId:text(raw.supplierId,80),
      unitCost:raw.unitCost === '' || raw.unitCost == null ? null : Math.max(0,number(raw.unitCost)),
      allergens:Array.isArray(raw.allergens) ? raw.allergens.map(x=>text(x,40)).filter(Boolean) : [],
      publicName:text(raw.publicName || raw.name,160), publicIngredient:raw.publicIngredient !== false,
      notes:text(raw.notes,300)
    };
  }
  function normalizeRecipe(raw={}) {
    return {
      schema:'KC_RECIPE_V1', id:text(raw.id || uid('REZEPT'),60), productId:text(raw.productId,80),
      name:text(raw.name || 'Neue Rezeptur',160), version:text(raw.version || '1.0.0',30),
      status:['draft','review','approved','outdated','blocked'].includes(raw.status) ? raw.status : 'draft',
      outputAmount:Math.max(0,number(raw.outputAmount)), outputUnit:text(raw.outputUnit || 'kg',20).toLowerCase(),
      portionAmount:Math.max(0,number(raw.portionAmount,250)), portionUnit:text(raw.portionUnit || 'g',20).toLowerCase(),
      reservePercent:Math.min(50,Math.max(0,number(raw.reservePercent))),
      ingredients:Array.isArray(raw.ingredients) ? raw.ingredients.map(normalizeIngredient) : [],
      publicIngredients:text(raw.publicIngredients,5000), publicAdditives:text(raw.publicAdditives,2000),
      publicImportant:text(raw.publicImportant,1500), allergens:raw.allergens && typeof raw.allergens === 'object' ? {...raw.allergens} : {},
      nutrition:raw.nutrition && typeof raw.nutrition === 'object' ? {...raw.nutrition} : {},
      source:text(raw.source,500), approvedBy:text(raw.approvedBy,120), approvedAt:text(raw.approvedAt,40),
      createdAt:text(raw.createdAt || new Date().toISOString(),40), updatedAt:new Date().toISOString()
    };
  }
  function portions(recipe) {
    const r=normalizeRecipe(recipe);
    if (!r.outputAmount || !r.portionAmount) return 0;
    if (unitFamily(r.outputUnit) !== unitFamily(r.portionUnit)) throw new Error('Fertigmenge und Portionsgröße benötigen dieselbe Einheitenart.');
    return toBase(r.outputAmount,r.outputUnit) / toBase(r.portionAmount,r.portionUnit);
  }
  function calculate(recipe, options={}) {
    const r=normalizeRecipe(recipe), basePortions=portions(r);
    if (!basePortions) throw new Error('Fertigmenge und Portionsgröße müssen größer als null sein.');
    const desired=options.desiredPortions == null ? basePortions : Math.max(0,number(options.desiredPortions));
    const reserve=options.includeReserve === false ? 0 : r.reservePercent;
    const factor=(desired/basePortions)*(1+reserve/100);
    const rows=r.ingredients.map(ingredient=>{
      const usableAmount=ingredient.amount*(1-ingredient.lossPercent/100);
      return {...ingredient,
        requiredAmount:ingredient.amount*factor,
        requiredUsableAmount:usableAmount*factor,
        amountPerPortion:ingredient.amount/Math.max(basePortions,1),
        usablePerPortion:usableAmount/Math.max(basePortions,1),
        totalCost:ingredient.unitCost == null ? null : ingredient.amount*factor*ingredient.unitCost
      };
    });
    return {recipe:r,basePortions,desiredPortions:desired,reservePercent:reserve,factor,ingredients:rows,
      totalCost:rows.some(x=>x.totalCost!=null)?rows.reduce((sum,x)=>sum+(x.totalCost||0),0):null};
  }
  function calculateFromAvailable(recipe, ingredientId, availableAmount, availableUnit) {
    const r=normalizeRecipe(recipe), ingredient=r.ingredients.find(x=>x.id===ingredientId);
    if (!ingredient) throw new Error('Bezugszutat wurde nicht gefunden.');
    if (unitFamily(ingredient.unit)!==unitFamily(availableUnit)) throw new Error('Vorhandene Menge und Rezeptzutat haben unterschiedliche Einheiten.');
    const availableInIngredientUnit=fromBase(toBase(availableAmount,availableUnit),ingredient.unit);
    if (!ingredient.amount) throw new Error('Die Bezugszutat hat keine Einsatzmenge.');
    const factor=availableInIngredientUnit/ingredient.amount;
    const basePortions=portions(r);
    return calculate(r,{desiredPortions:basePortions*factor,includeReserve:false});
  }
  function validate(recipe) {
    const r=normalizeRecipe(recipe), errors=[],warnings=[];
    if(!r.productId)errors.push('Artikel-ID fehlt.');
    if(!r.name)errors.push('Rezeptname fehlt.');
    if(!r.outputAmount||!r.portionAmount)errors.push('Fertigmenge und Portionsgröße sind Pflicht.');
    if(unitFamily(r.outputUnit)==='unknown'||unitFamily(r.portionUnit)==='unknown')errors.push('Unbekannte Fertig- oder Portionseinheit.');
    if(unitFamily(r.outputUnit)!==unitFamily(r.portionUnit))errors.push('Fertigmenge und Portion sind nicht vergleichbar.');
    if(!r.ingredients.length)errors.push('Mindestens eine Zutat ist erforderlich.');
    r.ingredients.forEach((i,index)=>{if(!i.name)errors.push(`Zutat ${index+1}: Name fehlt.`);if(!i.amount)errors.push(`Zutat ${index+1}: Menge fehlt.`);if(i.family==='unknown')errors.push(`Zutat ${index+1}: Einheit ist unbekannt.`);if(i.lossPercent>50)warnings.push(`${i.name||`Zutat ${index+1}`}: hoher Verlust von ${i.lossPercent} %.`)});
    if(r.status==='approved'&&(!r.source||!r.approvedBy||!r.approvedAt))errors.push('Freigegebene Rezepturen benötigen Quelle, Freigebenden und Datum.');
    return {ok:errors.length===0,errors,warnings,record:r};
  }
  function publicProductInfo(recipe, baseInfo={}) {
    const r=normalizeRecipe(recipe);
    const listed=r.ingredients.filter(x=>x.publicIngredient).map(x=>x.publicName).filter(Boolean);
    return {
      schema:'KC_PRODUCT_INFO_V1', productId:r.productId, version:r.version,
      status:r.status==='approved'?'approved':'incomplete',
      ingredients:r.publicIngredients || listed.join(', '),
      additives:r.publicAdditives || text(baseInfo.additives || baseInfo.contents,2000),
      important:r.publicImportant || text(baseInfo.important,1500),
      allergens:Object.keys(r.allergens).length ? {...r.allergens} : {...(baseInfo.allergens||{})},
      nutrition:Object.keys(r.nutrition).length ? {...r.nutrition} : {...(baseInfo.nutrition||{})}
    };
  }
  function makePublicPackage(records=[]) {
    return {schema:'KC_PRODUCT_INFO_PACKAGE_V1',version:VERSION,createdAt:new Date().toISOString(),
      products:records.map(item=>publicProductInfo(item.recipe,item.info))};
  }
  return Object.freeze({VERSION,UNITS:Object.freeze(['mg','g','kg','ml','l','stueck','packung','dose','bund']),unitFamily,toBase,fromBase,
    normalizeIngredient,normalizeRecipe,portions,calculate,calculateFromAvailable,validate,publicProductInfo,makePublicPackage});
});
