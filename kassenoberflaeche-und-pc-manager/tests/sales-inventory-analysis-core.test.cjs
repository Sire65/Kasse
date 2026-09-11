const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const sandbox={window:{KCReleaseManifest:{register(){}}}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync("cores/sales-inventory-analysis-core/sales-inventory-analysis-core.js","utf8"),sandbox);
const core=sandbox.window.KCSalesInventoryAnalysisCore;
const articles=[{id:"kaffee",name:"Kaffee",category:"Getränke"},{id:"feuer",name:"Feuerzangenbowle",category:"Getränke"}];
const sales=[
  {id:"m1",time:"2026-07-20T12:15:00",registerId:"K1",items:[{id:"kaffee",name:"Kaffee",qty:2,price:3}]},
  {id:"m2",time:"2026-07-20T13:00:00",registerId:"K1",items:[{id:"feuer",name:"Feuerzangenbowle",qty:1,price:5}]},
  {id:"d1",time:"2026-07-21T12:30:00",registerId:"K2",items:[{id:"kaffee",name:"Kaffee",qty:3,price:3}]}
];
const all=core.analyze(sales,articles,{});
assert.equal(all.customers,3);assert.equal(all.revenue,20);assert.equal(all.quantity,6);
assert.equal(JSON.stringify(all.byWeekday.map(x=>[x[0],x[1]])),JSON.stringify([["Montag",2],["Dienstag",1]]));
assert.equal(core.analyze(sales,articles,{weekday:"1"}).customers,2);
assert.equal(core.analyze(sales,articles,{hourFrom:"13",hourTo:"14"}).customers,1);
const stock=core.calculateStock([{id:"zucker",name:"Würfelzucker",unit:"Stück",initial:20,min:3,reserve:3,perSale:{feuer:3}}],[],sales,1);
assert.equal(stock[0].used,3);assert.equal(stock[0].remaining,17);
assert.equal(core.labelSlideType("welcome"),"Begrüßung");
assert.ok(core.DEFAULT_STOCK.some(item=>item.id==="spruehsahne")&&core.DEFAULT_STOCK.some(item=>item.id==="ausserhaus"));
console.log("PASS sales-inventory-analysis-core: Kundenvergleich, Filter, Umsatz, Verbrauch und deutsche Folientypen");
