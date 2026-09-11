const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const context={globalThis:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'cores/recipe-calculation-core/recipe-calculation-core.js'),'utf8'),context);
const core=context.globalThis.KCRecipeCalculationCore;

const recipe=core.normalizeRecipe({
  id:'R-GRUEN',productId:'gruenkohl',name:'Grünkohl Grundrezept',version:'1.0.0',
  outputAmount:150,outputUnit:'kg',portionAmount:250,portionUnit:'g',reservePercent:5,status:'approved',
  source:'Küchenleitung',approvedBy:'Test',approvedAt:'2026-07-23',
  ingredients:[
    {id:'kohl',name:'Grünkohl',amount:100,unit:'kg',lossPercent:15,unitCost:2,supplierId:'L-1'},
    {id:'kartoffel',name:'Kartoffeln',amount:40,unit:'kg',lossPercent:10},
    {id:'speck',name:'Speck',amount:5,unit:'kg'},
    {id:'kassler',name:'Kassler',amount:10,unit:'kg',preparation:'gewürfelt'},
    {id:'flocken',name:'Schmelzflocken',amount:1,unit:'kg',allergens:['gluten']}
  ],
  publicIngredients:'Grünkohl, Kartoffeln, Speck, Kassler, Schmelzflocken',
  publicImportant:'Heiß ausgeben.',
  allergens:{gluten:'contained'},
  nutrition:{energyKcal:120,fat:5}
});
assert.equal(core.VERSION,'0.1.0');
assert.equal(core.portions(recipe),600);
const base=core.calculate(recipe,{includeReserve:false});
assert.equal(base.ingredients[0].amountPerPortion,100/600);
const planned=core.calculate(recipe,{desiredPortions:1000});
assert.equal(Math.round(planned.ingredients[0].requiredAmount*1000)/1000,175);
const reverse=core.calculateFromAvailable(recipe,'kohl',50,'kg');
assert.equal(reverse.desiredPortions,300);
assert.equal(reverse.ingredients.find(x=>x.id==='kartoffel').requiredAmount,20);
assert.equal(core.validate(recipe).ok,true);
assert.throws(()=>core.portions({...recipe,portionUnit:'ml'}),/Einheitenart/);

const publicInfo=core.publicProductInfo(recipe,{contents:'intern',supplier:'Darf nicht heraus'});
assert.deepEqual(Object.keys(publicInfo).sort(),['additives','allergens','important','ingredients','nutrition','productId','schema','status','version'].sort());
const serialized=JSON.stringify(core.makePublicPackage([{recipe,info:{purchasePrice:10,supplier:'Geheim'}}]));
['outputAmount','portionAmount','lossPercent','unitCost','supplierId','purchasePrice','desiredPortions'].forEach(forbidden=>assert.equal(serialized.includes(forbidden),false,`${forbidden} darf nicht ins Kassenpaket`));
assert.match(serialized,/Grünkohl/);
assert.match(serialized,/energyKcal/);

const index=fs.readFileSync(path.join(root,'pc-manager/index.html'),'utf8');
assert.match(index,/recipe-calculation-core\/recipe-calculation-core\.js/);
assert.match(index,/recipe-manager\.js/);
assert.match(index,/recipe-manager\.css/);
assert.ok(fs.existsSync(path.join(root,'cores/recipe-calculation-core/studio-catalog-entry.json')));
assert.ok(fs.existsSync(path.join(root,'cores/recipe-calculation-core/tuv-rules.json')));
console.log('RecipeCalculationCore: Portionen, Skalierung, Rückwärtsrechnung und leckfreies Kassenpaket OK');
