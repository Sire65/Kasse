const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),crypto=require("node:crypto");
const sim=require("../cores/event-simulation-core/event-simulation-core.js");
const salesImport=require("../cores/sales-import-core/sales-import-core.js");
const out=path.resolve(process.argv[2]||"simulation-results/repair55"),password="KC-Test-2026!";
fs.mkdirSync(out,{recursive:true});
const products=[
  ["grot","Glühwein rot",5.5,"Getränke"],["gweiss","Glühwein weiß",5.5,"Getränke"],["feuer","Feuerzangenbowle",5,"Getränke"],["apfel","Apfelpunsch",4.5,"Getränke"],["eier","Eierlikörpunsch",6.5,"Getränke"],
  ["sauerkraut","Sauerkrauteintopf",5.5,"Speisen"],["sauerkrautmett","Sauerkrauteintopf + Mettwurst",7,"Speisen"],["gruenkohl","Grünkohl",5.5,"Speisen"],["gruenkohlmett","Grünkohl + Mettwurst",7,"Speisen"],["mettwurst","Mettwurst",1.5,"Speisen"],["hering","Heringsstipp mit Kartoffeln",5.5,"Speisen"],["knirpse","Kartoffelknirpse",4,"Speisen"],
  ["glasplus","Glaspfand",2,"Pfand"],["zangeplus","Feuerzangenpfand",2,"Pfand"],["glasminus","Glasrückgabe",-2,"Pfand"],["zangeminus","Feuerzange Rückgabe",-2,"Pfand"],["glaszangebundleminus","Glas + Feuerzange Rückgabe",-4,"Pfand"],["becher","Außer-Haus-Becher",1,"Sonstiges"],["schussrum","Schuss Rum",1.5,"Zusätze"],["schussamaretto","Schuss Amaretto",1.5,"Zusätze"]
].map(([id,name,price,category])=>({id,name,price,category}));
const config={seed:20261204,articles:products,registers:[["KASSE-01","Hauptkasse","Andrea"],["KASSE-02","Getränkekasse","Klaus"],["KASSE-03","Speisenkasse","Marianne"],["KASSE-04","Mobile Kasse","Frank"]].map(([id,name,operator])=>({id,name,operator})),days:[{date:"2026-12-04",bons:1800},{date:"2026-12-05",bons:2600},{date:"2026-12-06",bons:2300},{date:"2026-12-07",bons:1500}],weights:[["grot",18],["gweiss",12],["feuer",7],["apfel",9],["eier",8],["sauerkraut",7],["sauerkrautmett",8],["gruenkohl",9],["gruenkohlmett",11],["mettwurst",4],["hering",2],["knirpse",5],["becher",5],["schussrum",3],["schussamaretto",2]].map(([id,weight])=>({id,weight}))};
const generated=sim.generate(config),chainErrors=sim.verifyChains(generated.perRegister);
async function encrypt(payload){
  const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12),material=await crypto.webcrypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveKey"]),key=await crypto.webcrypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:250000,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["encrypt"]),cipher=Buffer.from(await crypto.webcrypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(JSON.stringify(payload))));
  return{format:"KC_ENCRYPTED_V1",salt:salt.toString("base64"),iv:iv.toString("base64"),data:cipher.toString("base64")};
}
const sandbox={window:{},console};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.resolve(__dirname,"../cores/sales-inventory-analysis-core/sales-inventory-analysis-core.js"),"utf8"),sandbox);
const compact=salesImport.merge([],generated.all).transactions,duplicateCheck=salesImport.merge(compact,generated.all),analysisCore=sandbox.window.KCSalesInventoryAnalysisCore,analysis=analysisCore.analyze(compact,products,{articleGroups:Object.fromEntries(products.map(p=>[p.id,p.category]))});
const stock=[
  {id:"wuerfelzucker",name:"Würfelzucker",unit:"Stück",initial:12000,min:500,reserve:500,perSale:{feuer:3}},
  {id:"servietten",name:"Servietten",unit:"Stück",initial:25000,min:1000,reserve:1000,perSale:Object.fromEntries(products.filter(p=>!["Pfand","Zusätze"].includes(p.category)).map(p=>[p.id,1]))},
  {id:"spekulatius",name:"Spekulatius",unit:"Stück",initial:16000,min:800,reserve:800,perSale:{grot:1,gweiss:1,feuer:1,eier:1,apfel:1}},
  {id:"rum42",name:"Rum 42 %",unit:"ml",initial:30000,min:2000,reserve:1000,perSale:{schussrum:20}},
  {id:"amaretto",name:"Amaretto",unit:"ml",initial:20000,min:1500,reserve:750,perSale:{schussamaretto:20}},
  {id:"rum54",name:"Rum 54 %",unit:"ml",initial:30000,min:2000,reserve:1000,perSale:{feuer:20}}
];
const ledger=[{id:"L-1",stockId:"servietten",time:"2026-12-06T09:00:00+01:00",quantity:5000,reason:"Nachkauf",note:"Simulation"}],stockResult=analysisCore.calculateStock(stock,ledger,generated.all,.25);
const expected={transactions:generated.all.length,customers:analysis.customers,revenue:+analysis.revenue.toFixed(2),quantity:analysis.quantity,average:+analysis.average.toFixed(2),byDay:Object.fromEntries(analysis.byDay),byHour:Object.fromEntries(analysis.byHour),byArticleRevenue:Object.fromEntries(analysis.byArticleRevenue),byArticleQuantity:Object.fromEntries(analysis.byArticleQuantity),byGroup:Object.fromEntries(analysis.byGroup),stock:stockResult.map(x=>({id:x.id,initial:x.initial,booked:x.booked,used:x.used,remaining:x.remaining,status:x.status.code}))};
(async()=>{
  for(const register of config.registers){const transactions=generated.perRegister[register.id],payload={format:"KC_SALES_EXPORT",version:4,createdAt:new Date().toISOString(),registerId:register.id,registerName:register.name,transactions,tips:[],withdrawals:[],discountAudit:[]};fs.writeFileSync(path.join(out,`${register.id}_Umsaetze.kcsales`),JSON.stringify(await encrypt(payload)))}
  fs.writeFileSync(path.join(out,"manager-test-import.json"),JSON.stringify({format:"KC_MANAGER_SIMULATION_IMPORT_V1",testOnly:true,transactions:compact,articles:products,stock,ledger},null,2));
  fs.writeFileSync(path.join(out,"expected-results.json"),JSON.stringify(expected,null,2));
  const compactBytes=new TextEncoder().encode(salesImport.stringifyStorage(compact)).length,report={schema:"KC_EVENT_SIMULATION_REPORT_V1",createdAt:new Date().toISOString(),password,generation:{...generated.summary,managerCompactBytes:compactBytes},chainErrors,duplicateImport:{attempted:generated.all.length,added:duplicateCheck.added,skipped:duplicateCheck.duplicates.length},expected,limits:{nominalLocalStorageBytes:5*1024*1024,manager:{bytes:compactBytes,percent:+(compactBytes/(5*1024*1024)*100).toFixed(1),pass:compactBytes<5*1024*1024},perRegister:Object.fromEntries(Object.entries(generated.summary.storageBytes).map(([id,bytes])=>[id,{bytes,percent:+(bytes/(5*1024*1024)*100).toFixed(1),pass:bytes<5*1024*1024}]))},pass:chainErrors.length===0&&Object.values(generated.summary.storageBytes).every(x=>x<5*1024*1024)&&compactBytes<5*1024*1024&&duplicateCheck.added===0&&duplicateCheck.duplicates.length===generated.all.length&&analysis.customers===generated.all.length};
  fs.writeFileSync(path.join(out,"simulation-report.json"),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
