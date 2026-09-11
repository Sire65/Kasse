const assert=require("node:assert/strict"),core=require("../cores/event-simulation-core/event-simulation-core.js");
const articles=[{id:"a",name:"A",price:2,category:"X"},{id:"glasplus",name:"Pfand",price:2,category:"Pfand"},{id:"glasminus",name:"Rückgabe",price:-2,category:"Pfand"},{id:"glaszangebundleminus",name:"Rückgabe Set",price:-4,category:"Pfand"}];
const generated=core.generate({seed:1,articles,registers:[{id:"K1",name:"Kasse",operator:"Test"}],days:[{date:"2026-12-04",bons:100}],weights:[{id:"a",weight:1}]});
assert.equal(generated.all.length,100);assert.equal(new Set(generated.all.map(x=>x.transactionId)).size,100);assert.deepEqual(core.verifyChains(generated.perRegister),[]);
assert(generated.all.every(tx=>tx.formatVersion===5&&!tx.training&&tx.items.length));
console.log("PASS event-simulation-core: deterministische Vorgänge, eindeutige IDs und gültige Kassen-Hashketten");
