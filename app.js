const VERSION="V0.29.0";
const DEFAULTS = {workspaceButtons:null,clubName:"Köcheclub Werne",clubLogo:"",eventName:"Weihnachtsmarkt 2026",registerName:"Kasse 1",operatorName:"Hans",operators:["Hans","Peter","Marion","Gast"],operatorProfiles:[],requireOperatorConfirmation:false,nextBon:123,depositRule:"automatic",showProductInfo:true,highlightAllergens:true,notificationProfile:"standard",buttonSize:"standard",buttonMode:"image",showPrice:true,registerId:"KASSE-01",showStaff:true,showTip:true,showDeposit:true,showPrint:true,showMore:true,showChange:true,requireChangeFlow:false,rushMode:false,trainingMode:false,autoFavorites:true,groupColorMode:true,fiscalMode:"off",tseProvider:"",tseSerial:"",superAdminAccess:null,receipt:{header:true,head1:"Köcheclub Werne",head2:"Weihnachtsmarkt",vat:"summary",foot1:"Vielen Dank!",autoPrint:true}};
const OPTIONS={
  shot:{title:"Schuss wählen",choices:[
    {id:"none",name:"Ohne Schuss",price:0,icon:"✓"},
    {id:"rum",name:"Schuss Rum",price:1.00,icon:"R"},
    {id:"amaretto",name:"Schuss Amaretto",price:1.00,icon:"A"}
  ]},
  dip:{title:"Dip wählen",choices:[
    {id:"kartoffeldip",name:"Kartoffeldip",price:0,icon:"K"},
    {id:"tzatziki",name:"Tzatziki",price:0,icon:"T"},
    {id:"ohne",name:"Ohne Dip",price:0,icon:"–"}
  ]}
};
const DEFAULT_PRODUCTS=[
 {id:"grot",name:"Glühwein rot",price:5.50,category:"Getränke",image:"assets/gluehwein_rot_auth.jpg",color:"#8b1e24",info:{status:"approved",shortDescription:"Heißer roter Glühwein",ingredients:"Rotwein, Zucker, Gewürze",additives:"Keine Angaben",allergens:{sulphites:"contained"},important:"Alkoholhaltig. Optional mit Rum oder Amaretto.",nutrition:{energyKj:355,energyKcal:85,fat:0,saturates:0,carbohydrate:9.5,sugars:9.5,protein:0.1,salt:0.01},source:"Lieferantenangabe",approvedAt:"2026-07-17"},optionGroup:"shot",depositComponents:[{id:"glass",name:"Glaspfand",price:2}]},
 {id:"gweiss",name:"Glühwein weiß",price:5.50,category:"Getränke",image:"assets/gluehwein_weiss_auth.jpg",color:"#a36a20",info:{status:"approved",shortDescription:"Heißer weißer Glühwein",ingredients:"Weißwein, Zucker, Gewürze",additives:"Keine Angaben",allergens:{sulphites:"contained"},important:"Alkoholhaltig. Optional mit Rum oder Amaretto.",nutrition:{energyKj:350,energyKcal:84,fat:0,saturates:0,carbohydrate:9.2,sugars:9.2,protein:0.1,salt:0.01},source:"Lieferantenangabe",approvedAt:"2026-07-17"},optionGroup:"shot",depositComponents:[{id:"glass",name:"Glaspfand",price:2}]},
 {id:"feuer",name:"Feuerzangenbowle",price:5.00,category:"Getränke",image:"assets/feuerzangenbowle_auth.jpg",color:"#a43f18",info:{ingredients:"Rotwein, Gewürze, Zuckerhut, Rum",allergens:"Enthält Sulfite",important:"Alkoholhaltig. Zusätzlich Glaspfand und Feuerzangenpfand beachten."},depositComponents:[{id:"glass",name:"Glaspfand",price:2},{id:"tong",name:"Feuerzangenpfand",price:2}]},
 {id:"apfel",name:"Apfelpunsch",price:4.50,category:"Getränke",image:"assets/apfelpunsch_auth.jpg",depositComponents:[{id:"glass",name:"Glaspfand",price:2}]},
 {id:"eier",name:"Eierlikörpunsch",price:6.50,category:"Getränke",image:"assets/eierlikoerpunsch_auth.jpg",depositComponents:[{id:"glass",name:"Glaspfand",price:2}]},
 {id:"sauerkraut",name:"Sauerkrauteintopf",price:5.50,category:"Speisen",image:"assets/sauerkraut_auth.jpg",color:"#77643d",info:{ingredients:"Sauerkraut, Kartoffeln, Speck, Gewürze",allergens:"Kann Sellerie und Senf enthalten",important:"Heiß ausgegeben."}},
 {id:"sauerkrautmett",name:"Sauerkrauteintopf + Mettwurst",price:7.00,category:"Speisen",image:"assets/sauerkraut_mettwurst_auth.jpg",color:"#785332",info:{ingredients:"Sauerkrauteintopf mit Mettwurst",allergens:"Kann Sellerie, Senf und Spuren von Gluten enthalten",important:"Mettwurst separat im Bestand geführt."}},
 {id:"gruenkohl",name:"Grünkohl",price:5.50,category:"Speisen",image:"assets/gruenkohl_auth.jpg",color:"#315e35",info:{ingredients:"Grünkohl, Kartoffeln, Zwiebeln, Gewürze",allergens:"Kann Senf und Sellerie enthalten",important:"Heiß ausgegeben."}},
 {id:"gruenkohlmett",name:"Grünkohl + Mettwurst",price:7.00,category:"Speisen",image:"assets/gruenkohl_mettwurst_auth.jpg",color:"#365d36",info:{ingredients:"Grünkohlgericht mit Mettwurst",allergens:"Kann Senf, Sellerie und Spuren von Gluten enthalten",important:"Mettwurst separat im Bestand geführt."}},
 {id:"mettwurst",name:"Mettwurst",price:1.50,category:"Speisen",image:"assets/gruenkohl_mettwurst_auth.jpg"},
 {id:"hering",name:"Heringsstipp mit Kartoffeln",price:5.50,category:"Speisen",image:"assets/sauerkraut_auth.jpg"},
 {id:"knirpse",name:"Kartoffelknirpse",price:4.00,category:"Speisen",image:"assets/sauerkraut_auth.jpg",color:"#a66e24",info:{ingredients:"Kartoffeln, Öl, Gewürze",allergens:"Dips können Milch und Milchprodukte enthalten",important:"Dip-Auswahl: Kartoffeldip, Tzatziki oder ohne Dip."},optionGroup:"dip"},
 {id:"glasplus",name:"Glaspfand",price:2.00,category:"Pfand",image:"assets/pfandglas_auth.jpg",manualDeposit:true},
 {id:"zangeplus",name:"Feuerzangenpfand",price:2.00,category:"Pfand",image:"assets/amaretto_auth.jpg",manualDeposit:true},
 {id:"glasminus",name:"Glasrückgabe",price:-2.00,category:"Pfand",image:"assets/pfandglas_auth.jpg"},
 {id:"zangeminus",name:"Feuerzange Rückgabe",price:-2.00,category:"Pfand",image:"assets/amaretto_auth.jpg"},
 {id:"becher",name:"Außer-Haus-Becher",price:1.00,category:"Sonstiges",image:"assets/becher_auth.jpg"}
];
let PRODUCTS=JSON.parse(localStorage.getItem("kc_products_v050")||"null")||DEFAULT_PRODUCTS;
const DEFAULT_GROUPS=[{id:"WG01",name:"Getränke",shortName:"Getränke",sortOrder:10,color:"#173765",active:true,notes:"Warme und kalte Getränke"},{id:"WG02",name:"Speisen",shortName:"Speisen",sortOrder:20,color:"#8b4a23",active:true,notes:"Speisen und Eintöpfe"},{id:"WG03",name:"Pfand",shortName:"Pfand",sortOrder:30,color:"#29689a",active:true,notes:"Pfand und Rückgaben"},{id:"WG04",name:"Sonstiges",shortName:"Sonstiges",sortOrder:40,color:"#596675",active:true,notes:"Weitere Artikel"}];
let GROUPS=JSON.parse(localStorage.getItem("kc_groups_v050")||"null")||DEFAULT_GROUPS;

const PACKAGE_STORAGE_KEY="kc_packages_v100";
const PACKAGE_AI_STATE_KEY="kc_package_ai_state_v100";
const DEFAULT_PACKAGES=[
 {id:"PKG-GK-GR",name:"Grünkohl + Glühwein rot",componentIds:["gruenkohl","grot"],price:10.50,category:"Packages",active:true,autoManaged:false,source:"manual",note:"Startpackage"},
 {id:"PKG-GK-EI",name:"Grünkohl + Eierlikörpunsch",componentIds:["gruenkohl","eier"],price:11.50,category:"Packages",active:true,autoManaged:false,source:"manual",note:"Startpackage"}
];
let PACKAGES=JSON.parse(localStorage.getItem(PACKAGE_STORAGE_KEY)||"null")||DEFAULT_PACKAGES;
let PACKAGE_SUGGESTIONS=[];
if(!GROUPS.some(g=>g.name==="Packages")){GROUPS.push({id:"WG05",name:"Packages",shortName:"Packages",sortOrder:5,color:"#6d28d9",active:true,notes:"Im Manager zusammengestellte Kombi-Angebote"});localStorage.setItem("kc_groups_v050",JSON.stringify(GROUPS))}
function savePackages(){localStorage.setItem(PACKAGE_STORAGE_KEY,JSON.stringify(PACKAGES))}
function packageProductView(pkg){
  const components=(pkg.componentIds||[]).map(id=>PRODUCTS.find(p=>p.id===id)).filter(Boolean);
  const lead=components.find(p=>p.id===pkg.imageProductId)||components[0];
  return {...pkg,isPackage:true,category:"Packages",image:lead?.image||"assets/logo.png",color:"#6d28d9",
    info:{status:"approved",shortDescription:`Package aus ${components.map(p=>p.name).join(" + ")}`,important:pkg.note||"Im Manager zusammengestellt."}};
}
function activePackageProducts(){return PACKAGES.filter(p=>p.active!==false).map(packageProductView)}
function allVisibleSaleProducts(){return [...visibleProducts(),...activePackageProducts()]}


const OFFER_STORAGE_KEY="kc_offers_v100";
const OFFER_OVERRIDE_KEY="kc_offer_overrides_v100";
const DEFAULT_OFFERS=[
 {id:"OFFER-HH-GLUEHWEIN",name:"Happy Hour Glühwein",type:"happyhour",productIds:["grot","gweiss"],priceMode:"percent",priceValue:10,
  startDate:"",endDate:"",startTime:"17:00",endTime:"18:00",weekdays:[1,2,3,4,5,6,0],active:true,manualStart:true,note:"Beispielaktion – im Manager anpassen."}
];
let OFFERS=JSON.parse(localStorage.getItem(OFFER_STORAGE_KEY)||"null")||DEFAULT_OFFERS;
let OFFER_OVERRIDES=JSON.parse(localStorage.getItem(OFFER_OVERRIDE_KEY)||"null")||{};
let lastOfferRuntimeSignature="";
function saveOffers(){localStorage.setItem(OFFER_STORAGE_KEY,JSON.stringify(OFFERS))}
function saveOfferOverrides(){localStorage.setItem(OFFER_OVERRIDE_KEY,JSON.stringify(OFFER_OVERRIDES))}
function localDateKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`}
function minuteOfDay(time){const [h,m]=String(time||"00:00").split(":").map(Number);return h*60+m}
function offerDateAllowed(offer,now=new Date()){
  const key=localDateKey(now);
  if(offer.startDate&&key<offer.startDate)return false;
  if(offer.endDate&&key>offer.endDate)return false;
  return !Array.isArray(offer.weekdays)||!offer.weekdays.length||offer.weekdays.includes(now.getDay());
}
function scheduledOfferActive(offer,now=new Date()){
  if(offer.active===false||!offerDateAllowed(offer,now))return false;
  const current=now.getHours()*60+now.getMinutes(),start=minuteOfDay(offer.startTime),end=minuteOfDay(offer.endTime);
  return end>start?current>=start&&current<end:(current>=start||current<end);
}
function manualOfferActive(offer,now=new Date()){
  const override=OFFER_OVERRIDES[offer.id];if(!override?.activeUntil)return false;
  if(new Date(override.activeUntil).getTime()<=now.getTime()){delete OFFER_OVERRIDES[offer.id];saveOfferOverrides();return false}
  return true;
}
function activeOffers(now=new Date()){return OFFERS.filter(o=>o.active!==false&&(scheduledOfferActive(o,now)||manualOfferActive(o,now)))}
function offerPrice(base,offer){
  const value=Math.max(0,Number(offer.priceValue||0));
  if(offer.priceMode==="fixed")return Math.max(0,Math.min(base,value));
  return Math.max(0,Math.round(base*(1-Math.min(100,value)/100)*100)/100);
}
function bestOfferForProduct(productId,now=new Date()){
  return activeOffers(now).filter(o=>(o.productIds||[]).includes(productId)).map(o=>({offer:o,price:offerPrice(Number(PRODUCTS.find(p=>p.id===productId)?.price||0),o)})).sort((a,b)=>a.price-b.price)[0]||null;
}
function saleProductView(product,now=new Date()){
  const hit=bestOfferForProduct(product.id,now);if(!hit)return product;
  return {...product,price:hit.price,originalPrice:Number(product.price||0),isOffer:true,isHappyHour:hit.offer.type==="happyhour",
    offerId:hit.offer.id,offerName:hit.offer.name,offerType:hit.offer.type};
}
function promotedBaseProducts(now=new Date()){return visibleProducts().map(p=>saleProductView(p,now))}
function dynamicOfferProducts(type,now=new Date()){
  return promotedBaseProducts(now).filter(p=>p.isOffer&&(type==="happyhour"?p.isHappyHour:!p.isHappyHour));
}
function offerCategoryNames(now=new Date()){
  const names=[];if(dynamicOfferProducts("offer",now).length)names.push("Angebote");if(dynamicOfferProducts("happyhour",now).length)names.push("Happy Hour");return names;
}

const previousMaster=JSON.parse(localStorage.getItem("kc_master_v040")||localStorage.getItem("kc_master_v030")||"null")||{};
const state={master:{...DEFAULTS,...previousMaster},cart:[],cartStartedAt:null,activeCategory:"Getränke",given:0,cashSelections:[],discount:{percent:0,reason:"",note:"",keys:[]},keypadBuffer:"",lastAdded:null,selectedCartKey:null,operatorConfirmedForSale:previousMaster.requireOperatorConfirmation!==true,role:"cashier",scanBuffer:"",scanTimer:null,pendingProduct:null,groupIndex:0,articleIndex:0,groupEditMode:false,articleEditMode:false,productPage:0,lastSelectedProduct:null,workflowMode:null,keypadMode:"cash"};
const DISPLAY_PROFILE_KEY="kc_pos_display_profile_v014";
let displayProfile=JSON.parse(localStorage.getItem(DISPLAY_PROFILE_KEY)||"null")||{groupIds:[],productIds:[]};
const isActiveRecord=record=>record?.active!==false;
function normalizeDisplayProfile(){
  const activeGroups=GROUPS.filter(isActiveRecord).map(g=>g.id);
  const activeProducts=PRODUCTS.filter(isActiveRecord).map(p=>p.id);
  const selectedGroups=Array.isArray(displayProfile.groupIds)
    ? displayProfile.groupIds.filter(id=>activeGroups.includes(id))
    : [];
  const selectedProducts=Array.isArray(displayProfile.productIds)
    ? displayProfile.productIds.filter(id=>activeProducts.includes(id))
    : [];
  displayProfile.groupIds=selectedGroups.length?selectedGroups:activeGroups;
  displayProfile.productIds=selectedProducts.length?selectedProducts:activeProducts;
}
function saveDisplayProfile(){localStorage.setItem(DISPLAY_PROFILE_KEY,JSON.stringify(displayProfile))}
function visibleGroups(){normalizeDisplayProfile();return GROUPS.filter(g=>isActiveRecord(g)&&displayProfile.groupIds.includes(g.id)).sort((a,b)=>a.sortOrder-b.sortOrder)}
function visibleProducts(){normalizeDisplayProfile();return PRODUCTS.filter(p=>isActiveRecord(p)&&displayProfile.productIds.includes(p.id))}
function productsForSale(){return [...promotedBaseProducts(),...activePackageProducts()]}

const el=id=>document.getElementById(id);let notifier=null;let currentInfoProduct=null;const money=n=>new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(n);const bonText=()=>String(state.master.nextBon).padStart(6,"0");
function saveMaster(){localStorage.setItem("kc_master_v040",JSON.stringify(state.master))}
function saveGroups(){localStorage.setItem("kc_groups_v050",JSON.stringify(GROUPS))}
function saveProducts(){localStorage.setItem("kc_products_v050",JSON.stringify(PRODUCTS))}

const TRANSACTION_KEY="kc_transactions_v040";
const TRAINING_TRANSACTION_KEY="kc_training_transactions_v040";
const TRANSACTION_MIGRATION_KEY="kc_transactions_migrated_v018";
const WITHDRAWAL_KEY="kc_cash_withdrawals_v018";
const CLOSING_KEY="kc_closings";
const TUV_REPORT_KEY="kc_tuv_last_v018";
const toCents=value=>Math.round(Number(value||0)*100);
const fromCents=value=>Number(value||0)/100;
function safeArray(key){try{const value=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(value)?value:[]}catch{return []}}
function safeText(value,max=300){return String(value??"").replace(/[<>"'\u0000-\u001f]/g,"").trim().slice(0,max)}
function safeId(value,fallback){const id=String(value??"").replace(/[^A-Za-z0-9._:-]/g,"-").slice(0,80);return id||fallback}
function safeImage(value){const image=String(value||"").trim();return /^(assets\/[A-Za-z0-9._/-]+|data:image\/(png|jpeg|webp|gif);base64,)/i.test(image)?image:"assets/logo.png"}
function operatorSlug(value,index=0){return safeId(String(value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),`bediener-${index+1}`)}
function normalizeOperatorProfiles(){
  const raw=Array.isArray(state.master.operatorProfiles)&&state.master.operatorProfiles.length?state.master.operatorProfiles:(state.master.operators||DEFAULTS.operators).map(name=>({name}));
  const used=new Set();state.master.operatorProfiles=raw.map((item,index)=>{const name=safeText(typeof item==="string"?item:item?.name,60)||`Bediener ${index+1}`;let id=operatorSlug(typeof item==="string"?name:item?.id||name,index),suffix=2;while(used.has(id))id=`${operatorSlug(name,index)}-${suffix++}`;used.add(id);return{id,name,code:`KCOPE1:${id}`}});
  state.master.operators=state.master.operatorProfiles.map(x=>x.name);
  if(!state.master.operatorProfiles.some(x=>x.name===state.master.operatorName))state.master.operatorName=state.master.operatorProfiles[0]?.name||"Bediener";
  return state.master.operatorProfiles;
}
function sanitizeGroup(group,index){return {...group,id:safeId(group?.id,`WG-${index+1}`),name:safeText(group?.name||`Warengruppe ${index+1}`,80),shortName:safeText(group?.shortName||group?.name,40),notes:safeText(group?.notes,500),color:/^#[0-9a-f]{6}$/i.test(group?.color||"")?group.color:"#173765",sortOrder:Number(group?.sortOrder||((index+1)*10)),active:group?.active!==false}}
function sanitizeProduct(product,index){const info=product?.info||{};return {...product,id:safeId(product?.id,`ART-${index+1}`),name:safeText(product?.name||`Artikel ${index+1}`,100),shortName:safeText(product?.shortName,60),receiptText:safeText(product?.receiptText||product?.name,100),category:safeText(product?.category,80),image:safeImage(product?.embeddedImage||product?.image),barcode:safeText(product?.barcode,80),price:Number(product?.price||0),purchasePrice:Number(product?.purchasePrice||0),active:product?.active!==false,info:{ingredients:safeText(info.ingredients,1500),allergens:safeText(info.allergens,1500),contents:safeText(info.contents,1500),important:safeText(info.important,1500),notes:safeText(info.notes,1500)}}}
function transactionIdentity(t,index=0){return t.transactionId||`${t.registerId||"legacy"}:${t.bon||t.bonNumber||"?"}:${t.time||index}`}
function readTransactions(){return safeArray(TRANSACTION_KEY)}
function readTrainingTransactions(){return safeArray(TRAINING_TRANSACTION_KEY)}
function saveTransactions(rows,training=false){localStorage.setItem(training?TRAINING_TRANSACTION_KEY:TRANSACTION_KEY,JSON.stringify(rows))}
function migrateTransactions(){
  if(localStorage.getItem(TRANSACTION_MIGRATION_KEY)==="done")return;
  const merged=[],seen=new Set();
  [TRANSACTION_KEY,"kc_transactions_v030","kc_transactions_v020"].forEach(key=>safeArray(key).forEach((row,index)=>{
    const id=transactionIdentity(row,index);if(seen.has(id))return;seen.add(id);merged.push({...row,transactionId:row.transactionId||`legacy-${id}`});
  }));
  saveTransactions(merged.filter(row=>!row.training));
  const training=[...readTrainingTransactions(),...merged.filter(row=>row.training)];
  saveTransactions([...new Map(training.map((row,index)=>[transactionIdentity(row,index),row])).values()],true);
  localStorage.setItem(TRANSACTION_MIGRATION_KEY,"done");
}

const ADMIN_AUDIT_KEY="kc_admin_audit_v017",ADMIN_CHANGES_KEY="kc_admin_changes_v017";
let adminSession=null,adminNavigationInProgress=false,adminFailedAttempts=0,adminLockedUntil=0;
const cloneData=value=>value==null?value:JSON.parse(JSON.stringify(value));
function adminAudit(){return JSON.parse(localStorage.getItem(ADMIN_AUDIT_KEY)||"[]")}
function adminChanges(){return JSON.parse(localStorage.getItem(ADMIN_CHANGES_KEY)||"[]")}
function appendAdminAudit(action,result,details={}){
  const event={auditId:crypto.randomUUID(),time:new Date().toISOString(),registerId:state.master.registerId,registerName:state.master.registerName,sessionId:adminSession?.sessionId||null,actor:adminSession?.actor||details.actor||"Unbekannt",role:state.role||"cashier",loginMethod:adminSession?.loginMethod||details.loginMethod||null,action,result,credentialId:adminSession?.credentialId||details.credentialId||null,details:details.message||null};
  const rows=adminAudit();rows.push(event);localStorage.setItem(ADMIN_AUDIT_KEY,JSON.stringify(rows.slice(-2000)));
  window.KCAuditCore?.append({...event,deviceId:state.master.registerId,metadata:{loginMethod:event.loginMethod,details:event.details}});
}
function recordAdminChange(entity,operation,entityId,before,after){
  const rows=adminChanges();rows.push({changeId:crypto.randomUUID(),time:new Date().toISOString(),registerId:state.master.registerId,registerName:state.master.registerName,sessionId:adminSession?.sessionId||null,actor:adminSession?.actor||state.master.operatorName||"Lokal",loginMethod:adminSession?.loginMethod||"local-ui",entity,operation,entityId,before:cloneData(before),after:cloneData(after)});
  localStorage.setItem(ADMIN_CHANGES_KEY,JSON.stringify(rows.slice(-5000)));appendAdminAudit(`${entity}-${operation}`,"success",{message:String(entityId)});renderAdminChangeStatus();
}
function recordCollectionDiff(entity,before,after){
  const oldMap=new Map((before||[]).map(x=>[x.id,x])),newMap=new Map((after||[]).map(x=>[x.id,x]));
  newMap.forEach((value,id)=>{const old=oldMap.get(id);if(!old||JSON.stringify(old)!==JSON.stringify(value))recordAdminChange(entity,old?"update":"create",id,old||null,value)});
  oldMap.forEach((value,id)=>{if(!newMap.has(id))recordAdminChange(entity,"delete",id,value,null)});
}
function renderAdminChangeStatus(){const node=el("adminChangeCount");if(node)node.textContent=`${adminChanges().length} Änderung(en) · ${adminAudit().length} Protokolleintrag/-einträge`}
function beginAdminSession(loginMethod,actor,credentialId=null){
  adminSession={sessionId:crypto.randomUUID(),startedAt:new Date().toISOString(),loginMethod,actor,credentialId,valid:true};state.role="superadmin";document.body.classList.add("role-admin","role-superadmin","admin-open");appendAdminAudit("login","success");el("serviceDialog").close();el("adminHomeDialog").showModal();
}
function endAdminSession(reason="logout"){
  if(adminSession)appendAdminAudit("logout","success",{message:reason});adminSession=null;state.role="cashier";document.body.classList.remove("admin-open","role-admin","role-superadmin");
}
function adminAccessLocked(){
  if(Date.now()<adminLockedUntil){el("serviceError").textContent=`Zu viele Fehlversuche. Bitte ${Math.ceil((adminLockedUntil-Date.now())/1000)} Sekunden warten.`;return true}return false;
}
function registerAdminFailure(loginMethod,message,credentialId=null){
  adminFailedAttempts++;appendAdminAudit("login","rejected",{loginMethod,message,credentialId});if(adminFailedAttempts>=5){adminLockedUntil=Date.now()+30000;adminFailedAttempts=0}el("serviceError").textContent=message;
}

function salesForStats(){
  return readTransactions();
}
function articleSalesCount(id){
  return salesForStats().reduce((sum,t)=>sum+(t.items||[]).filter(i=>i.id===id).reduce((s,i)=>s+Number(i.qty||0),0),0);
}
function autoFavoriteIds(){
  return [...PRODUCTS]
    .map(p=>({id:p.id,count:articleSalesCount(p.id)}))
    .sort((a,b)=>b.count-a.count)
    .filter(x=>x.count>0)
    .slice(0,6)
    .map(x=>x.id);
}
function setSystemHint(text,type="ok"){
  const n=el("systemHint");n.textContent=text;
  n.style.background=type==="warn"?"#fff1cf":type==="error"?"#fee2e2":"#dff3e3";
  n.style.color=type==="warn"?"#7a4a00":type==="error"?"#991b1b":"#176329";
}

const WORKSPACE_BUTTONS=[
  {id:"payBtn",label:"BEZAHLEN",symbol:"💳",locked:true,defaultOrder:10,defaultSize:"xl",defaultColor:"#167447"},
  {id:"discountBtn",label:"RABATT",symbol:"🏷",defaultOrder:15,defaultSize:"md",defaultColor:"#b66b00"},
  {id:"staffBtn",label:"PERSONAL",symbol:"👥",defaultOrder:20,defaultSize:"md",defaultColor:"#315d8d"},
  {id:"trainingModeBtn",label:"TESTMODUS",symbol:"🎓",defaultOrder:25,defaultSize:"md",defaultColor:"#075fbd"},
  {id:"depositBtn",label:"PFANDRÜCKGABE",symbol:"♻",defaultOrder:30,defaultSize:"md",defaultColor:"#216b5a"},
  {id:"tipBtn",label:"TRINKGELD",symbol:"💝",defaultOrder:40,defaultSize:"md",defaultColor:"#7b4d8f"},
  {id:"printBonBtn",label:"BONDRUCK",symbol:"🧾",defaultOrder:50,defaultSize:"md",defaultColor:"#4c5b6b"},
  {id:"moreBtn",label:"MEHR",symbol:"•••",defaultOrder:70,defaultSize:"sm",defaultColor:"#354253"}
];
const WORKSPACE_SYMBOLS=["💳","👥","♻","💝","🧾","🔐","•••","💶","🛒","⭐","✓","⚙","☕","🍟","🌭","🥤","🎄"];
function defaultWorkspace(){return Object.fromEntries(WORKSPACE_BUTTONS.map(x=>[x.id,{visible:true,order:x.defaultOrder,size:x.defaultSize,textScale:"normal",color:x.defaultColor,label:x.label,symbol:x.symbol,image:""}]))}
let workspaceDraft=null;
function workspaceConfig(){
  const defaults=defaultWorkspace(),saved=state.master.workspaceButtons&&typeof state.master.workspaceButtons==="object"?state.master.workspaceButtons:{};
  return Object.fromEntries(Object.keys(defaults).map(id=>[id,{...defaults[id],...(saved[id]||{})}]));
}
function applyWorkspace(){
  const cfg=workspaceConfig();
  WORKSPACE_BUTTONS.forEach(def=>{
    const node=el(def.id),c=cfg[def.id];if(!node||!c)return;
    node.style.order=String(Number(c.order)||def.defaultOrder);
    node.style.setProperty("--workspace-color",c.color||def.defaultColor);
    node.classList.add("workspace-button");
    node.dataset.workspaceSize=c.size||"md";node.dataset.workspaceText=c.textScale||"normal";
    if(def.id!=="payBtn") node.hidden=c.visible===false;
    const text=`${c.symbol||""}${c.symbol?" ":""}${c.label||def.label}`;
    if(def.id==="payBtn"){
      const span=node.querySelector("span");if(span)span.textContent=text;
    }else node.innerHTML=c.image?`<img class="workspace-button-image" src="${c.image}" alt=""><span>${text}</span>`:text;
  });
}
function renderWorkspaceEditor(){
  const list=el("workspaceEditorList");if(!list)return;
  workspaceDraft=workspaceDraft||workspaceConfig();
  const rows=WORKSPACE_BUTTONS.slice().sort((a,b)=>(workspaceDraft[a.id]?.order||0)-(workspaceDraft[b.id]?.order||0));
  list.innerHTML=rows.map((def,index)=>{const c=workspaceDraft[def.id];return `<article class="workspace-editor-row" data-workspace-id="${def.id}">
    <div class="workspace-order"><button type="button" data-ws-move="up" ${index===0?"disabled":""}>↑</button><button type="button" data-ws-move="down" ${index===rows.length-1?"disabled":""}>↓</button></div>
    <label class="workspace-visible"><input type="checkbox" data-ws-field="visible" ${c.visible!==false||def.locked?"checked":""} ${def.locked?"disabled":""}><span>Sichtbar</span></label>
    <div class="workspace-sample" style="--sample-color:${c.color}">${c.image?`<img src="${c.image}" alt="">`:c.symbol} <b>${c.label}</b></div>
    <label>Text<input data-ws-field="label" maxlength="22" value="${String(c.label).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"></label>
    <label>Symbol<select data-ws-field="symbol">${WORKSPACE_SYMBOLS.map(s=>`<option ${s===c.symbol?"selected":""}>${s}</option>`).join("")}</select></label>
    <label>Größe<select data-ws-field="size"><option value="sm" ${c.size==="sm"?"selected":""}>Klein</option><option value="md" ${c.size==="md"?"selected":""}>Mittel</option><option value="lg" ${c.size==="lg"?"selected":""}>Groß</option><option value="xl" ${c.size==="xl"?"selected":""}>Sehr groß</option></select></label>
    <label>Schrift<select data-ws-field="textScale"><option value="small" ${c.textScale==="small"?"selected":""}>Klein</option><option value="normal" ${c.textScale==="normal"?"selected":""}>Normal</option><option value="large" ${c.textScale==="large"?"selected":""}>Groß</option></select></label>
    <label>Farbe<input type="color" data-ws-field="color" value="${c.color}"></label>
    <label class="workspace-image-upload">Bild<input type="file" data-ws-image accept="image/*"></label><button type="button" data-ws-clear-image ${c.image?"":"disabled"}>Bild löschen</button>
  </article>`}).join("");
  list.querySelectorAll("[data-ws-field]").forEach(input=>input.onchange=()=>{const row=input.closest("[data-workspace-id]"),id=row.dataset.workspaceId,field=input.dataset.wsField;workspaceDraft[id][field]=input.type==="checkbox"?input.checked:input.value;renderWorkspaceEditor()});
  list.querySelectorAll("[data-ws-move]").forEach(btn=>btn.onclick=()=>{const id=btn.closest("[data-workspace-id]").dataset.workspaceId,ordered=WORKSPACE_BUTTONS.map(x=>x.id).sort((a,b)=>workspaceDraft[a].order-workspaceDraft[b].order),i=ordered.indexOf(id),j=btn.dataset.wsMove==="up"?i-1:i+1;if(j<0||j>=ordered.length)return;[ordered[i],ordered[j]]=[ordered[j],ordered[i]];ordered.forEach((key,k)=>workspaceDraft[key].order=(k+1)*10);renderWorkspaceEditor()});
  list.querySelectorAll("[data-ws-image]").forEach(input=>input.onchange=()=>{const file=input.files?.[0];if(!file)return;if(file.size>350000){setSystemHint("Bild ist zu groß (maximal 350 KB)","warn");return}const id=input.closest("[data-workspace-id]").dataset.workspaceId,r=new FileReader();r.onload=()=>{workspaceDraft[id].image=String(r.result);renderWorkspaceEditor()};r.readAsDataURL(file)});
  list.querySelectorAll("[data-ws-clear-image]").forEach(btn=>btn.onclick=()=>{workspaceDraft[btn.closest("[data-workspace-id]").dataset.workspaceId].image="";renderWorkspaceEditor()});
}
function workspacePreset(name){const d=defaultWorkspace();Object.keys(d).forEach((id,i)=>{if(name==="compact"){d[id].size=id==="payBtn"?"lg":"sm";d[id].textScale="small"}else if(name==="touch"){d[id].size=id==="payBtn"?"xl":"lg";d[id].textScale="large"}else{d[id].size=id==="payBtn"?"xl":"md";d[id].textScale="normal"}});workspaceDraft=d;renderWorkspaceEditor()}

function renderWorkspaceModePanel(){
  const training=!!state.master.trainingMode,discount=discountAmount()>0;
  document.body.classList.toggle("training-mode",training);
  document.body.classList.toggle("discount-mode",discount);
  const trainingBanner=el("trainingBanner"),discountBanner=el("discountBanner"),panel=el("workspaceModePanel");
  if(trainingBanner)trainingBanner.hidden=!training;
  if(discountBanner)discountBanner.hidden=!discount;
  if(panel)panel.hidden=!(training||discount);
}
function applyModes(){
  el("rushModeBtn")?.classList.toggle("active",!!state.master.rushMode);
  el("trainingModeBtn")?.classList.toggle("active",!!state.master.trainingMode);
  el("trainingModeTopBtn")?.classList.toggle("active",!!state.master.trainingMode);
  el("trainingModeTopBtn")?.setAttribute("aria-pressed",String(!!state.master.trainingMode));
  el("rushModeBtn")?.setAttribute("aria-pressed",String(!!state.master.rushMode));
  const trainingTop=el("trainingModeTopBtn");if(trainingTop)trainingTop.hidden=!!state.master.rushMode;
  const totalFlag=el("grandTotalTrainingFlag");if(totalFlag)totalFlag.hidden=!state.master.trainingMode;

  const sales=document.querySelector(".sales-area");
  sales?.classList.toggle("mode-training",!!state.master.trainingMode);
  sales?.classList.toggle("mode-rush",!!state.master.rushMode);

  const panel=el("workspaceModePanel");
  const text=el("workspaceModeText");
  const labels=[];
  if(state.master.trainingMode)labels.push("Trainingsmodus aktiv");
  if(state.master.rushMode)labels.push("Stoßzeiten aktiv");
  if(text)text.textContent=labels.join(" · ");
  if(panel)panel.hidden=labels.length===0;

  document.body.classList.toggle("rush-mode",!!state.master.rushMode);
}

function applyVisibility(){applyModes();
  document.body.classList.toggle("hide-staff",state.master.showStaff===false);
  document.body.classList.toggle("hide-tip",state.master.showTip===false);
  document.body.classList.toggle("hide-deposit",state.master.showDeposit===false);
  document.body.classList.toggle("hide-print",state.master.showPrint===false);
  document.body.classList.toggle("hide-more",state.master.showMore===false);
  document.body.classList.toggle("hide-change",state.master.showChange===false&&state.master.requireChangeFlow!==true);
  const optionalVisible=[state.master.showStaff,state.master.showTip,state.master.showDeposit,state.master.showPrint,state.master.showMore].filter(value=>value!==false).length,actions=el("payBtn")?.closest(".main-actions");
  actions?.classList.toggle("pay-priority",optionalVisible<=3);actions?.classList.toggle("pay-minimal",optionalVisible===1);actions?.classList.toggle("pay-only",optionalVisible===0);
}
function renderHeader(){applyVisibility();normalizeOperatorProfiles();el("clubName").textContent=state.master.clubName;el("clubLogo").src=safeImage(state.master.clubLogo||"assets/logo.png");el("eventName").textContent=state.master.eventName;el("registerName").textContent=state.master.registerName;el("operatorName").textContent=`Bediener: ${state.master.operatorName}`;el("version").textContent=VERSION;el("operatorBtnName").textContent=state.master.operatorName;const needs=state.master.requireOperatorConfirmation===true&&!state.operatorConfirmedForSale;el("operatorConfirmState").textContent=needs?"vor Artikel bestätigen":"aktiv";el("operatorBtn").classList.toggle("needs-confirmation",needs)}
function tick(){const d=new Date();el("dateText").textContent=d.toLocaleDateString("de-DE");el("timeText").textContent=d.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});el("footerClock").textContent=d.toLocaleTimeString("de-DE")}
function categories(){const names=visibleGroups().map(g=>g.name);return [...offerCategoryNames(),...names,...(names.length?["Favoriten"]:[])]}
function ensureActiveCategory(){
  const available=categories();
  if(!available.includes(state.activeCategory))state.activeCategory=available[0]||"Getränke";
}
function renderCategories(){
  ensureActiveCategory();
  el("categories").innerHTML=categories().map(c=>{
    const g=GROUPS.find(x=>x.name===c);
    const count=c==="Favoriten"?productsForSale().filter(p=>["grot","gweiss","feuer","sauerkrautmett","gruenkohlmett","knirpse"].includes(p.id)||p.favorite).length:
      c==="Angebote"?dynamicOfferProducts("offer").length:c==="Happy Hour"?dynamicOfferProducts("happyhour").length:productsForSale().filter(p=>p.category===c).length;
    return `<button class="${c===state.activeCategory?"active":""}" data-cat="${c}" style="--group-color:${g?.color||"#173765"}"><span>${c==="Favoriten"?"★ ":""}${c.toUpperCase()}</span><b class="category-count" aria-label="${count} Artikel">${count}</b></button>`;
  }).join("");el("categories").querySelectorAll("button").forEach(b=>b.onclick=()=>{state.activeCategory=b.dataset.cat;state.productPage=0;el("productSearchInput").value="";renderCategories();renderProducts()})}
function allProductsForCategory(){
  let list=state.activeCategory==="Favoriten"
    ? productsForSale().filter(p=>["grot","gweiss","feuer","sauerkrautmett","gruenkohlmett","knirpse"].includes(p.id)||p.favorite)
    : state.activeCategory==="Angebote"?dynamicOfferProducts("offer")
    : state.activeCategory==="Happy Hour"?dynamicOfferProducts("happyhour")
    : productsForSale().filter(p=>p.category===state.activeCategory);
  const q=(el("productSearchInput")?.value||"").trim().toLowerCase();
  if(q)list=productsForSale().filter(p=>`${p.name} ${p.shortName||""} ${p.receiptText||""}`.toLowerCase().includes(q));
  return list;
}
function productsPerPage(){
  if(state.master.buttonSize==="compact")return 8;
  if(state.master.buttonSize==="large")return 4;
  return 6;
}
function productSet(){const all=allProductsForCategory(),per=productsPerPage(),max=Math.max(0,Math.ceil(all.length/per)-1);state.productPage=Math.max(0,Math.min(state.productPage,max));return all.slice(state.productPage*per,state.productPage*per+per)}
function setProductPage(page){
  const pages=Math.max(1,Math.ceil(allProductsForCategory().length/productsPerPage()));
  const target=Math.max(0,Math.min(Number(page)||0,pages-1));
  if(target===state.productPage)return false;
  state.productPage=target;
  renderProducts();
  setSystemHint(`Artikelseite ${target+1} von ${pages}`);
  return true;
}
function renderProductPager(){
  const all=allProductsForCategory();
  const per=productsPerPage();
  const pages=Math.max(1,Math.ceil(all.length/per));
  state.productPage=Math.max(0,Math.min(state.productPage,pages-1));
  el("productPagePrev").disabled=state.productPage<=0;
  el("productPageNext").disabled=state.productPage>=pages-1;
  el("productPageDots").innerHTML=
    `<span class="product-page-label">Seite ${state.productPage+1} / ${pages}</span>`+
    Array.from({length:pages},(_,i)=>`<button type="button" class="${i===state.productPage?"active":""}" data-page="${i}" aria-label="Artikelseite ${i+1}" aria-current="${i===state.productPage?"page":"false"}">${i+1}</button>`).join("");
  el("productPageDots").querySelectorAll("button").forEach(button=>button.onclick=()=>setProductPage(button.dataset.page));
}
function hasInfo(p){return !!p; /* Jeder Artikel erhält eine transparente Produktinfo. Fehlende Angaben bleiben ausdrücklich „nicht geprüft“. */}
function displayPrice(p){
  const base=Number(p?.price||0);
  if(state.master.depositRule!=="included"||!Array.isArray(p?.depositComponents))return base;
  return base+p.depositComponents.reduce((sum,item)=>sum+Number(item.price||0),0);
}
function renderProducts(){
  const grid=el("productGrid");
  grid.className=`product-grid size-${state.master.buttonSize}`;
  document.body.classList.toggle("hide-product-prices",!state.master.showPrice);
  grid.innerHTML=productSet().map(p=>{
    const infoVisible=state.master.showProductInfo&&hasInfo(p);
    const mode=state.master.buttonMode;
    const autoFav=state.master.autoFavorites&&autoFavoriteIds().includes(p.id);
    return `<div class="product-tile-wrap ${p.isPackage?"package-tile":""} ${p.isOffer?(p.isHappyHour?"happyhour-tile":"offer-tile"):""} ${infoVisible?"":"no-info"} ${state.lastSelectedProduct===p.id?"last-selected":""}">
      <button class="product-tile mode-${mode}" data-id="${p.id}" style="--tile-color:${p.color||"#315d8d"}" aria-label="${p.name} direkt verkaufen">
        <img src="${p.image}" alt="">
        <span class="product-label"><strong>${p.name}</strong><span class="${p.isOffer?"offer-price-line":""}">${p.isOffer?`<small class="offer-old-price">${money(p.originalPrice)}</small>`:""}${money(displayPrice(p))}</span>${p.isOffer?`<small class="offer-badge">${p.isHappyHour?"⏰ Happy Hour":"🏷 Angebot"} · ${escapeHtml(p.offerName)}</small>`:""}${p.isPackage?'<small class="package-tag">1 Tipp = komplette Kombination</small>':""}${p.optionGroup?'<small class="option-tag">Tippen = Standard · + = Varianten</small>':""}${p.depositComponents?`<small class="deposit-tag">${depositHint(p)}</small>`:""}</span>
      </button>
      ${p.optionGroup?`<button class="product-variant-button" data-variant-id="${p.id}" title="Varianten zu ${p.name}" aria-label="Varianten zu ${p.name} öffnen">+</button>`:""}
      ${infoVisible?`<button class="product-info-button" data-info-id="${p.id}" title="Artikelinformationen" aria-label="Informationen zu ${p.name}">i</button>`:""}
      ${autoFav?'<span class="auto-favorite-star" title="Automatischer Favorit">★</span>':""}
    </div>`;
  }).join("");
  grid.querySelectorAll(".product-tile").forEach(b=>b.onclick=()=>selectProduct(b.dataset.id));
  grid.querySelectorAll(".product-variant-button").forEach(b=>b.onclick=e=>{e.stopPropagation();openProductVariants(b.dataset.variantId)});
  grid.querySelectorAll(".product-info-button").forEach(b=>b.onclick=e=>{e.stopPropagation();openProductInfo(b.dataset.infoId)});
  renderProductPager();
}
function depositHint(p){if(state.master.depositRule==="automatic")return "zzgl. Pfand automatisch";if(state.master.depositRule==="included")return "inkl. Pfand";return "Pfand manuell"}

const ALLERGEN_LABELS={gluten:'Glutenhaltiges Getreide',crustaceans:'Krebstiere',eggs:'Eier',fish:'Fisch',peanuts:'Erdnüsse',soy:'Soja',milk:'Milch',nuts:'Schalenfrüchte',celery:'Sellerie',mustard:'Senf',sesame:'Sesam',sulphites:'Schwefeldioxid / Sulfite',lupin:'Lupinen',molluscs:'Weichtiere'};
const ALLERGEN_STATUS={contained:'Enthalten',traces:'Spuren möglich','not-contained':'Nicht enthalten','not-checked':'Nicht geprüft'};
function productInfoRecord(p){
  const raw=p.info||{};
  if(typeof raw.allergens==='string')return {status:'incomplete',shortDescription:raw.notes||'',ingredients:raw.ingredients||'',additives:raw.contents||'',important:raw.important||'',legacyAllergens:raw.allergens,allergens:{},nutrition:{},source:'',approvedAt:''};
  const base={productId:p.id,version:raw.version||'1.0.0',status:raw.status||'incomplete',shortDescription:raw.shortDescription||raw.notes||'',ingredients:raw.ingredients||'',additives:raw.additives||raw.contents||'',important:raw.important||'',allergens:raw.allergens||{},nutrition:raw.nutrition||{},manufacturer:raw.manufacturer||'',supplier:raw.supplier||'',source:raw.source||'',validAt:raw.validAt||'',approvedBy:raw.approvedBy||'',approvedAt:raw.approvedAt||''};
  return window.ProductInfoCore?ProductInfoCore.normalize(base):base;
}
function openProductInfo(id){
  const p=PRODUCTS.find(x=>x.id===id)||activePackageProducts().find(x=>x.id===id);if(!p)return;currentInfoProduct=p;
  const r=productInfoRecord(p);el('productInfoTitle').textContent=p.name;el('productInfoImage').src=p.image;
  const allergenSummary=r.legacyAllergens||Object.entries(r.allergens||{}).filter(([,v])=>v==='contained'||v==='traces').map(([k,v])=>`${ALLERGEN_LABELS[k]||k}: ${ALLERGEN_STATUS[v]}`).join(' · ');
  const sections=[];if(r.shortDescription)sections.push(infoSection('Kurzinformation',r.shortDescription,''));if(allergenSummary)sections.push(infoSection('Allergene',allergenSummary,state.master.highlightAllergens?'allergen':''));if(r.important)sections.push(infoSection('Wichtiger Hinweis',r.important,'important'));
  if(r.status!=='approved')sections.push(infoSection('Datenstatus','Produktinformation nicht vollständig geprüft – bitte Marktleitung fragen.','important'));
  el('productInfoContent').innerHTML=sections.join('')||'<p class="info-empty">Keine freigegebenen Schnellinformationen hinterlegt.</p>';
  el('productInfoDetailsBtn').hidden=false;el('productInfoDialog').showModal();notify('info',`${p.name}: Information geöffnet`,'product-info');
}
function infoSection(title,text,cls){return `<section class="info-section ${cls}"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></section>`}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function openFullProductInfo(){const p=currentInfoProduct;if(!p)return;const r=productInfoRecord(p);el('productInfoTitle')?.closest('dialog')?.close();el('productDetailsTitle').textContent=p.name;const approved=r.status==='approved';el('productDetailsStatus').className=`product-data-status ${approved?'approved':'incomplete'}`;el('productDetailsStatus').textContent=approved?`✓ Freigegebene Produktinformation · Stand ${r.approvedAt||'unbekannt'}`:'⚠ Nicht vollständig geprüft – bitte Marktleitung fragen';
  const allergenRows=Object.keys(ALLERGEN_LABELS).map(id=>{const status=r.allergens?.[id]||'not-checked';return `<tr><td>${ALLERGEN_LABELS[id]}</td><td class="allergen-status ${status}">${ALLERGEN_STATUS[status]}</td></tr>`}).join('');
  const n=r.nutrition||{},num=(v,unit)=>Number.isFinite(Number(v))?`${Number(v).toLocaleString('de-DE',{maximumFractionDigits:2})} ${unit}`:'–';
  const nutritionRows=[['Energie',`${num(n.energyKj,'kJ')} / ${num(n.energyKcal,'kcal')}`],['Fett',num(n.fat,'g')],['davon gesättigte Fettsäuren',num(n.saturates,'g')],['Kohlenhydrate',num(n.carbohydrate,'g')],['davon Zucker',num(n.sugars,'g')],['Eiweiß',num(n.protein,'g')],['Salz',num(n.salt,'g')]].map(x=>`<tr><td>${x[0]}</td><td>${x[1]}</td></tr>`).join('');
  el('productDetailsContent').innerHTML=`<section class="info-section"><h3>Übersicht</h3><p>${escapeHtml(r.shortDescription||'Keine Kurzbeschreibung hinterlegt.')}</p></section><section class="info-section"><h3>Zutaten</h3><p>${escapeHtml(r.ingredients||'Nicht hinterlegt')}</p></section><section class="info-section"><h3>Zusatzstoffe</h3><p>${escapeHtml(r.additives||'Nicht hinterlegt')}</p></section><section class="info-section"><h3>Big 14 – Allergene</h3><table class="allergen-table"><thead><tr><th>Allergen</th><th>Status</th></tr></thead><tbody>${allergenRows}</tbody></table></section><section class="info-section"><h3>Nährwerte je 100 g / 100 ml</h3><table class="nutrition-table"><tbody>${nutritionRows}</tbody></table></section><section class="info-section"><h3>Verantwortung, Quelle und Freigabe</h3><p>Hersteller: ${escapeHtml(r.manufacturer||'Nicht hinterlegt')}<br>Lieferant: ${escapeHtml(r.supplier||'Nicht hinterlegt')}<br>Quelle: ${escapeHtml(r.source||'Nicht hinterlegt')}<br>Gültig ab: ${escapeHtml(r.validAt||'Nicht hinterlegt')}<br>Freigegeben von: ${escapeHtml(r.approvedBy||'Nicht hinterlegt')}<br>Freigabe: ${escapeHtml(r.approvedAt||'Nicht hinterlegt')}<br>Datensatz-Version: ${escapeHtml(r.version||'1.0.0')}</p></section>`;el('productDetailsDialog').showModal();}
function notify(type,message,key='',duration){if(!notifier&&window.NotificationCore)notifier=new NotificationCore.Controller(el('notificationBar'),{profile:state.master.notificationProfile||'standard'});if(notifier){notifier.setProfile(state.master.notificationProfile||'standard');return notifier.show({type,message,key,duration})}setSystemHint(message,type==='error'?'warn':'ok');return true;}
function operatorReadyForArticle(){if(state.master.requireOperatorConfirmation!==true||state.operatorConfirmedForSale)return true;showMessage("Bediener bestätigen","👤","Bitte vor dem ersten Artikel den Bediener-QR scannen oder oben die Bedienertaste verwenden.");el("operatorBtn").classList.add("needs-confirmation");return false}
function selectProduct(id){if(!operatorReadyForArticle())return;const p=productsForSale().find(x=>x.id===id);if(!p)return;state.lastSelectedProduct=id;addConfiguredProduct(p,null)}
function openProductVariants(id){if(!operatorReadyForArticle())return;const p=PRODUCTS.find(x=>x.id===id);if(!p?.optionGroup)return;state.lastSelectedProduct=id;renderProducts();openOptions(p)}
function openOptions(p){state.pendingProduct=p;const group=OPTIONS[p.optionGroup];el("optionTitle").textContent=group.title;el("optionSubtitle").textContent=p.name;el("optionButtons").innerHTML=group.choices.map(o=>`<button type="button" class="option-choice" data-option="${o.id}"><span class="option-icon">${o.icon}</span><span><strong>${o.name}</strong><small>${o.price?`Aufpreis ${money(o.price)}`:"ohne Aufpreis"}</small></span><b>${o.price?`+ ${money(o.price)}`:""}</b></button>`).join("");el("optionButtons").querySelectorAll("button").forEach(b=>b.onclick=()=>{const o=group.choices.find(x=>x.id===b.dataset.option);el("optionDialog").close();addConfiguredProduct(p,o)});el("optionDialog").showModal()}
function addConfiguredProduct(p,option){
  if(p?.isPackage){
    const key=`package:${p.id}`;
    const found=state.cart.find(x=>x.key===key);
    const components=(p.componentIds||[]).map(id=>PRODUCTS.find(product=>product.id===id)).filter(Boolean);
    const deposits=[];
    if(state.master.depositRule!=="manual")components.forEach(component=>(component.depositComponents||[]).forEach(dep=>deposits.push({...dep,componentId:component.id})));
    const item={key,id:p.id,packageId:p.id,isPackage:true,name:p.name,price:Number(p.price||0),category:"Packages",image:p.image,qty:1,
      components:components.map(component=>({id:component.id,name:component.name,price:component.price})),deposits};
    if(!state.cart.length)state.cartStartedAt=new Date().toISOString();
    if(found)found.qty++;else state.cart.push(item);
    state.lastAdded=key;state.selectedCartKey=key;state.lastSelectedProduct=p.id;
    renderProducts();renderCart();notify("success",found?`${p.name} – Package-Menge jetzt ${found.qty}`:`Package ${p.name} vollständig hinzugefügt`,`package:${key}`);
    return;
  }
  const key=`${p.id}:${option?.id||"base"}:${p.offerId||"normal"}`;const found=state.cart.find(x=>x.key===key);const item={key,id:p.id,name:p.name,price:p.price,originalPrice:p.originalPrice||p.price,offerId:p.offerId||null,offerName:p.offerName||"",offerType:p.offerType||"",category:p.category,image:p.image,manualDeposit:!!p.manualDeposit,qty:1,option:option?{...option}:null,deposits:[]};if(p.depositComponents&&state.master.depositRule!=="manual")item.deposits=p.depositComponents.map(d=>({...d}));if(!state.cart.length)state.cartStartedAt=new Date().toISOString();if(found)found.qty++;else state.cart.push(item);state.lastAdded=key;state.selectedCartKey=key;state.lastSelectedProduct=p.id;renderProducts();renderCart();notify("success",found?`${p.name} – Menge jetzt ${found.qty}`:`${p.name} wurde dem Einkaufswagen hinzugefügt`,`add:${key}`)}
function lineUnit(x){return x.price+(x.option?.price||0)+(state.master.depositRule==="included"?x.deposits.reduce((s,d)=>s+d.price,0):0)}
function grossTotal(){return fromCents(state.cart.reduce((sum,item)=>sum+toCents(lineUnit(item)*item.qty)+(state.master.depositRule==="automatic"?toCents(item.deposits.reduce((value,deposit)=>value+Number(deposit.price||0),0)*item.qty):0),0))}
function positionDiscountAmount(item){const percent=Math.max(0,Math.min(100,Number(item?.positionDiscount?.percent||0))),unit=Number(item?.price||0)+Number(item?.option?.price||0);if(!item||item.category==="Pfand"||item.manualDeposit||unit<=0||percent<=0)return 0;const base=toCents(unit*Number(item.qty||0));return fromCents(Math.min(base,Math.round(base*percent/100)))}
function totalPositionDiscountAmount(){return fromCents(state.cart.reduce((sum,item)=>sum+toCents(positionDiscountAmount(item)),0))}
function discountBase(keysOverride=null){const selected=Array.isArray(keysOverride)?keysOverride:(Array.isArray(state.discount?.keys)?state.discount.keys:[]),restrict=selected.length>0;return fromCents(state.cart.reduce((sum,item)=>{const unit=Number(item.price||0)+Number(item.option?.price||0),eligible=item.category!=="Pfand"&&!item.manualDeposit&&unit>0&&!Number(item.positionDiscount?.percent||0);if(!eligible)return sum;if(restrict&&!selected.includes(item.key))return sum;return sum+toCents(unit*Number(item.qty||0))},0))}
function globalDiscountAmount(){const percent=Math.max(0,Math.min(100,Number(state.discount?.percent||0))),base=toCents(discountBase());return fromCents(Math.min(base,Math.round(base*percent/100)))}
function discountAmount(){return fromCents(toCents(globalDiscountAmount())+toCents(totalPositionDiscountAmount()))}
function total(){return fromCents(Math.max(0,toCents(grossTotal())-toCents(discountAmount())))}
function resetDiscount(){state.discount={percent:0,reason:"",note:"",keys:[]}}
function renderDiscountSummary(){
  const amount=discountAmount(),button=el("discountBtn"),banner=el("discountBannerText"),display=el("discountDisplay");
  if(banner)banner.textContent=amount>0?`${Number(state.discount.percent).toLocaleString("de-DE")} % Rabatt · − ${money(amount)}`:"Rabatt aktiv";
  if(display)display.textContent=amount?`− ${money(amount)} (${Number(state.discount.percent).toLocaleString("de-DE")} %)`:"0,00 € Rabatt";
  if(button){button.disabled=!state.cart.length||discountBase()<=0;button.classList.toggle("active",amount>0);button.title=amount?`${state.discount.percent} % Rabatt${state.discount.reason?` · ${state.discount.reason}`:""}`:"Rabatt festlegen"}
  renderWorkspaceModePanel()
}
const quantityUndoStack=[];
function rememberQuantityChange(item){if(!item)return;quantityUndoStack.push({key:item.key,qty:item.qty});if(quantityUndoStack.length>5)quantityUndoStack.shift();updateQuantityUndoButton()}
function updateQuantityUndoButton(){const button=el("undoQuantityBtn");if(!button)return;button.disabled=quantityUndoStack.length===0;button.title=quantityUndoStack.length?`Letzte Mengenänderung zurücknehmen (${quantityUndoStack.length} gespeichert)`:"Keine Mengenänderung zum Zurücknehmen"}
function undoQuantityChange(){const entry=quantityUndoStack.pop();if(!entry)return setSystemHint("Keine Mengenänderung zum Zurücknehmen","warn");const item=state.cart.find(row=>row.key===entry.key);if(!item){updateQuantityUndoButton();return setSystemHint("Der betreffende Artikel ist nicht mehr im Einkaufswagen","warn")}item.qty=entry.qty;state.selectedCartKey=item.key;renderCart();updateQuantityUndoButton();notify("info",`${item.name} – Menge auf ${item.qty} zurückgesetzt`,`undoqty:${item.key}`,1800)}
function selectedCartItem(){return state.cart.find(x=>x.key===state.selectedCartKey)||null}
function syncCartQuantityBar(){
  const item=selectedCartItem(),buttons=document.querySelectorAll("[data-cart-qty]"),more=el("moreQuantityBtn");
  buttons.forEach(button=>{button.disabled=!item;button.classList.toggle("active",!!item&&Number(button.dataset.cartQty)===item.qty)});
  if(more){
    more.disabled=!item;
    const overflow=!!item&&Number(item.qty)>7;
    more.classList.toggle("quantity-overflow-active",overflow);
    more.dataset.currentQty=overflow?String(item.qty):"";
    more.title=overflow?`Aktuelle Menge ${item.qty}. Antippen zum Ändern.`:"Andere Menge";
  }
  el("selectedCartHint").textContent=item?`${item.name} markiert · aktuell ${item.qty}×`:"Artikel im Einkaufswagen antippen"
}
function selectCartRow(index){const item=state.cart[index];if(!item)return;state.selectedCartKey=item.key;renderCart()}

let lastSettlementNotice="Einkaufswagen abgerechnet";
function setCartNotice(text,type="info"){lastSettlementNotice=text;const node=el("cartNotificationText");if(node)node.textContent=text;const bar=el("notificationBar");if(bar){bar.classList.toggle("notice-success",type==="success");bar.classList.toggle("notice-info",type!=="success")}}
function showDirectSettlementNotice(){const paymentState=el("changePaymentState");if(paymentState){paymentState.textContent="Direkt abgerechnet";paymentState.classList.add("direct-settlement")}el("changeDisplay").textContent=money(0);el("givenDisplay").textContent=money(0);el("dueDisplay").textContent=money(0)}

function renderCart(){const list=el("cartList");if(state.cart.length)setCartNotice("Einkaufswagen geöffnet","info");if(!state.cart.length){state.selectedCartKey=null;resetDiscount();list.innerHTML='<div class="cart-empty">Artikel antippen oder Barcode scannen.</div>'}else{if(!selectedCartItem())state.selectedCartKey=state.cart[state.cart.length-1].key;list.innerHTML=state.cart.map((x,i)=>`<div class="cart-row ${x.key===state.selectedCartKey?"selected":""}" data-cart-index="${i}" tabindex="0" aria-label="${x.name}, Menge ${x.qty}"><img class="cart-thumb" src="${x.image}" alt=""><div class="cart-name"><strong>${x.name}</strong>${x.option&&x.option.id!=="none"&&x.option.id!=="ohne"?`<small class="cart-option">+ ${x.option.name} (${money(x.option.price)})</small>`:""}${x.option&&(x.option.id==="kartoffeldip"||x.option.id==="tzatziki")?`<small class="cart-option">mit ${x.option.name}</small>`:""}${x.deposits.length?`<small class="cart-deposit">${x.deposits.map(d=>`${d.name} ${money(d.price)}`).join(" · ")} <span class="rule-chip">${state.master.depositRule==="automatic"?"extra":"inkl."}</span></small>`:""}<small>${money(lineUnit(x))} / Stk.</small>${x.positionDiscount?.percent?`<small class="cart-position-discount">Pos.-Rabatt ${Number(x.positionDiscount.percent).toLocaleString("de-DE")} % · − ${money(positionDiscountAmount(x))}</small>`:""}</div><button class="position-discount-button ${x.positionDiscount?.percent?"active":""}" data-pos-discount="${i}" title="Positionsrabatt für ${x.name}">${x.positionDiscount?.percent?`${Number(x.positionDiscount.percent).toLocaleString("de-DE")} % Pos.`:"POS. RABATT"}</button><div class="qty-box"><button data-a="minus" data-i="${i}" ${x.lockedQuantity?"disabled":""}>−</button><span>${x.qty}</span><button data-a="plus" data-i="${i}" ${x.lockedQuantity?"disabled":""}>+</button></div><div class="row-total ${lineUnit(x)<0?"negative":""} cart-line-price ${x.positionDiscount?.percent?"has-discount":"no-discount"}">${x.positionDiscount?.percent?`<small class="original-price">${money((lineUnit(x)+(state.master.depositRule==="automatic"?x.deposits.reduce((a,d)=>a+d.price,0):0))*x.qty)}</small><strong class="net-price">${money(fromCents(toCents((lineUnit(x)+(state.master.depositRule==="automatic"?x.deposits.reduce((a,d)=>a+d.price,0):0))*x.qty)-toCents(positionDiscountAmount(x))))}</strong>`:`<strong class="net-price">${money((lineUnit(x)+(state.master.depositRule==="automatic"?x.deposits.reduce((a,d)=>a+d.price,0):0))*x.qty)}</strong>`}</div><button class="delete-row" data-a="delete" data-i="${i}" title="Artikel stornieren">🗑</button></div>`).join("");list.querySelectorAll(".cart-row").forEach(row=>{row.onclick=()=>selectCartRow(+row.dataset.cartIndex);row.onkeydown=event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();selectCartRow(+row.dataset.cartIndex)}}});list.querySelectorAll("button").forEach(button=>button.onclick=event=>{
  event.stopPropagation();
  if(button.dataset.posDiscount!==undefined){
    const index=Number(button.dataset.posDiscount);
    state.selectedCartKey=state.cart[index]?.key||state.selectedCartKey;
    return openPositionDiscount(index);
  }
  state.selectedCartKey=state.cart[+button.dataset.i]?.key||state.selectedCartKey;
  cartAction(button.dataset.a,+button.dataset.i)
})}syncCartQuantityBar();updateQuantityUndoButton();{
  const positions=state.cart.length;
  const withDeposit=state.cart.filter(item=>item.category==="Pfand"||item.manualDeposit||item.deposits?.length).length;
  const withPositionDiscount=state.cart.filter(item=>Number(item.positionDiscount?.percent||0)>0).length;
  el("positionCount").innerHTML=`<b>${positions}</b> ${positions===1?"POSITION":"POSITIONEN"} <i aria-hidden="true">│</i> <b>${withDeposit}</b> ${withDeposit===1?"POSITION MIT PFAND":"POSITIONEN MIT PFAND"} <i aria-hidden="true">│</i> <b>${withPositionDiscount}</b> ${withPositionDiscount===1?"POSITION MIT RABATT":"POSITIONEN MIT RABATT"}`;
}renderDiscountSummary();el("grandTotal").textContent=money(total());el("dueDisplay").textContent=money(total());updateChange()}
function cartAction(a,i){
  const item=state.cart[i];if(!item)return;
  if((a==="plus"||a==="minus")&&item.lockedQuantity)return setSystemHint("Reklamationspositionen werden im Reklamationsdialog geändert","warn");
  if(a==="plus"){rememberQuantityChange(item);item.qty++;notify("info",`${item.name} – Menge auf ${item.qty} erhöht`,`qty:${item.key}`)}
  if(a==="minus"){rememberQuantityChange(item);item.qty=Math.max(0,item.qty-1);notify("info",`${item.name} – Menge auf ${item.qty} geändert`,`qty:${item.key}`)}
  if(a==="delete"){askConfirm("Artikel stornieren",`${item.name} aus dem Bon entfernen?`,()=>{state.cart.splice(i,1);notify("warning",`${item.name} wurde aus dem Einkaufswagen entfernt`,`remove:${item.key}`);if(state.selectedCartKey===item.key)state.selectedCartKey=state.cart[Math.min(i,state.cart.length-1)]?.key||null;renderCart()});return}
  if(state.cart[i]&&state.cart[i].qty===0){const removed=state.cart.splice(i,1)[0];if(state.selectedCartKey===removed.key)state.selectedCartKey=state.cart[Math.min(i,state.cart.length-1)]?.key||null}
  renderCart()
}
function askConfirm(t,txt,act){el("confirmTitle").textContent=t;el("confirmText").textContent=txt;el("confirmAction").onclick=e=>{e.preventDefault();el("confirmDialog").close();act()};el("confirmDialog").showModal()}
function updateChange(){
  const due=total(),change=Math.max(0,state.given-due),card=el("changeDisplay").closest(".change-card"),paymentState=el("changePaymentState"),hasDue=toCents(due)>0,sufficient=hasDue&&toCents(state.given)>=toCents(due);paymentState.classList.remove("direct-settlement");
  el("givenDisplay").textContent=money(state.given);
  el("changeDisplay").textContent=money(change);
  card.classList.toggle("payment-insufficient",hasDue&&!sufficient);
  card.classList.toggle("payment-sufficient",sufficient);
  if(!hasDue)paymentState.textContent="Noch kein Zahlbetrag";
  else if(sufficient)paymentState.textContent=`BETRAG AUSREICHEND · ${money(change)} zurück`;
  else paymentState.textContent=`NOCH ${money(Math.max(0,due-state.given))} FEHLEN`;
  const undo=el("undoCashBtn");
  if(undo){undo.disabled=!state.cashSelections.length;undo.title=state.cashSelections.length?`Letzte Geldwahl zurücknehmen (${state.cashSelections.at(-1).label})`:"Noch keine Schein- oder Münzauswahl"}
  updateBarPaymentButton({due,change,hasDue,sufficient});
}
function updateBarPaymentButton(snapshot=null){
  const button=el("payBtn"),title=el("payModeTitle"),detail=el("payModeDetail");
  if(!button||!title||!detail)return;
  const due=snapshot?.due??total(),change=snapshot?.change??Math.max(0,state.given-due);
  const hasDue=snapshot?.hasDue??toCents(due)>0;
  const cashEntered=toCents(state.given)>0;
  const sufficient=snapshot?.sufficient??(hasDue&&toCents(state.given)>=toCents(due));
  button.classList.toggle("pay-direct",!cashEntered);
  button.classList.toggle("pay-change",cashEntered);
  button.classList.toggle("pay-ready",cashEntered&&sufficient);
  button.classList.toggle("pay-insufficient",cashEntered&&!sufficient);
  if(!cashEntered){
    title.textContent="BAR DIREKT";
    detail.textContent="PASSEND ABRECHNEN";
    button.title="Bon sofort passend abrechnen";
  }else if(sufficient){
    title.textContent="ZAHLUNG ABSCHLIESSEN";
    detail.textContent=`${money(change)} RÜCKGELD`;
    button.title=`Rückgeldzahlung abschließen · ${money(change)} zurück`;
  }else{
    title.textContent="BAR / RÜCKGELD";
    detail.textContent=`NOCH ${money(Math.max(0,due-state.given))} FEHLEN`;
    button.title="Der gegebene Betrag reicht noch nicht aus";
  }
}
function setGiven(v,{preserveCashSelections=false}={}){if(!preserveCashSelections)state.cashSelections=[];state.given=fromCents(toCents(v));updateChange()}
function addCashSelection(value,label=money(value)){
  const cents=toCents(value);if(cents<=0)return;
  state.cashSelections.push({cents,label});
  setGiven(fromCents(toCents(state.given)+cents),{preserveCashSelections:true});
  state.keypadBuffer="";
  setSystemHint(`${label} hinzugefügt · gegeben ${money(state.given)} · BAR-Taste schließt über Rückgeldfunktion ab`);
}
function undoCashSelection(){
  const last=state.cashSelections.pop();
  if(!last)return setSystemHint("Noch keine Schein- oder Münzauswahl zum Zurücknehmen","warn");
  setGiven(fromCents(Math.max(0,toCents(state.given)-last.cents)),{preserveCashSelections:true});
  state.keypadBuffer="";
  setSystemHint(`${last.label} zurückgenommen · gegeben ${money(state.given)} · Rückgeld ${money(Math.max(0,state.given-total()))}`);
}

let discountDraftPercent=0,discountDraftReason="",discountDraftKeys=[],discountDraftCategory="Alle",positionDiscountTargetKey=null;
function eligibleDiscountItems(){
  return state.cart.filter(item=>{
    const unit=Number(item.price||0)+Number(item.option?.price||0);
    const eligible=item.category!=="Pfand"&&!item.manualDeposit&&unit>0;
    return eligible&&(!positionDiscountTargetKey||item.key===positionDiscountTargetKey);
  })
}
function renderDiscountArticlePicker(){
  const search=(el("discountArticleSearch")?.value||"").trim().toLowerCase();
  const items=eligibleDiscountItems();
  const categories=["Alle",...new Set(items.map(item=>item.category))];
  el("discountCategoryFilters").innerHTML=categories.map(category=>`<button type="button" data-discount-category="${escapeHtml(category)}" class="${category===discountDraftCategory?"active":""}">${escapeHtml(category)}</button>`).join("");
  el("discountCategoryFilters").querySelectorAll("button").forEach(button=>button.onclick=()=>{
    discountDraftCategory=button.dataset.discountCategory;
    renderDiscountArticlePicker();
  });
  const visible=items.filter(item=>(discountDraftCategory==="Alle"||item.category===discountDraftCategory)&&(!search||item.name.toLowerCase().includes(search)));
  el("discountArticleList").innerHTML=visible.map(item=>`<label class="discount-article-row ${discountDraftKeys.includes(item.key)?"selected":""}">
    <input type="checkbox" data-discount-key="${item.key}" ${discountDraftKeys.includes(item.key)?"checked":""}>
    <img src="${item.image}" alt="">
    <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)} · Menge ${item.qty}</small></span>
    <b>${money((Number(item.price||0)+Number(item.option?.price||0))*item.qty)}</b>
  </label>`).join("")||'<p class="discount-no-results">Keine passenden Artikel gefunden.</p>';
  el("discountArticleList").querySelectorAll("[data-discount-key]").forEach(input=>input.onchange=()=>{
    if(input.checked&&!discountDraftKeys.includes(input.dataset.discountKey))discountDraftKeys.push(input.dataset.discountKey);
    if(!input.checked)discountDraftKeys=discountDraftKeys.filter(key=>key!==input.dataset.discountKey);
    renderDiscountArticlePicker();
    renderDiscountDraft();
  });
}
function renderDiscountDraft(){
  const percent=Math.max(0,Math.min(100,Number(discountDraftPercent||0)));
  const targetItem=positionDiscountTargetKey?state.cart.find(item=>item.key===positionDiscountTargetKey):null;
  const previewBase=targetItem?fromCents(toCents((Number(targetItem.price||0)+Number(targetItem.option?.price||0))*targetItem.qty)):discountBase(discountDraftKeys);
  const amount=fromCents(Math.round(toCents(previewBase)*percent/100));
  el("discountPreview").textContent=`− ${money(amount)}`;
  document.querySelectorAll("[data-discount-percent]").forEach(button=>button.classList.toggle("active",Number(button.dataset.discountPercent)===percent));
  document.querySelectorAll("[data-discount-reason]").forEach(button=>button.classList.toggle("active",button.dataset.discountReason===discountDraftReason));
}
function prepareDiscountDialog(){
  const card=el("discountDialog").querySelector(".discount-card");
  const target=positionDiscountTargetKey?state.cart.find(item=>item.key===positionDiscountTargetKey):null;
  card.classList.toggle("position-discount-mode",!!target);
  el("discountDialogKicker").textContent=target?"POSITION":"EINKAUFSWAGEN";
  el("discountDialogTitle").textContent=target?`Positionsrabatt · ${target.name}`:"Rabatt festlegen";
}
function openDiscountDialog(){
  positionDiscountTargetKey=null;
  if(!state.cart.length||eligibleDiscountItems().length===0)return setSystemHint("Für diesen Einkaufswagen ist kein Rabatt möglich","warn");
  discountDraftPercent=Number(state.discount.percent||0);
  discountDraftReason=state.discount.reason||"";
  const eligibleKeys=eligibleDiscountItems().map(item=>item.key);
  discountDraftKeys=Array.isArray(state.discount.keys)&&state.discount.keys.length?state.discount.keys.filter(key=>eligibleKeys.includes(key)):[...eligibleKeys];
  discountDraftCategory="Alle";
  el("discountCustomPercent").value=discountDraftPercent||"";
  el("discountReasonNote").value=state.discount.note||"";
  el("discountArticleSearch").value="";
  prepareDiscountDialog();
  renderDiscountArticlePicker();
  renderDiscountDraft();
  el("discountDialog").showModal();
}
function openPositionDiscount(index){
  const item=state.cart[index];
  const unit=Number(item?.price||0)+Number(item?.option?.price||0);
  if(!item||item.category==="Pfand"||item.manualDeposit||unit<=0)return setSystemHint("Für diese Position ist kein Rabatt möglich","warn");
  positionDiscountTargetKey=item.key;
  discountDraftPercent=Number(item.positionDiscount?.percent||0);
  discountDraftReason=item.positionDiscount?.reason||"";
  discountDraftKeys=[item.key];
  discountDraftCategory=item.category;
  el("discountCustomPercent").value=discountDraftPercent||"";
  el("discountReasonNote").value=item.positionDiscount?.note||"";
  el("discountArticleSearch").value=item.name;
  prepareDiscountDialog();
  renderDiscountArticlePicker();
  renderDiscountDraft();
  el("discountDialog").showModal();
}
function recordDiscountAudit(operation){const rows=safeArray("kc_discount_audit_v020");rows.push({discountId:crypto.randomUUID(),time:new Date().toISOString(),operation,registerId:state.master.registerId,operator:state.master.operatorName,percent:Number(state.discount.percent||0),amount:discountAmount(),reason:state.discount.reason||null,note:state.discount.note||null,keys:Array.isArray(state.discount.keys)?state.discount.keys:[],cartItems:state.cart.map(item=>({id:item.id,name:item.name,qty:item.qty}))});localStorage.setItem("kc_discount_audit_v020",JSON.stringify(rows.slice(-2000)))}
el("discountBtn").onclick=()=>{positionDiscountTargetKey=null;openDiscountDialog()};
el("discountDialog").addEventListener("close",()=>{positionDiscountTargetKey=null;el("discountDialog").querySelector(".discount-card")?.classList.remove("position-discount-mode")});
el("discountArticleSearch").oninput=renderDiscountArticlePicker;
el("discountSelectAllBtn").onclick=()=>{
  const all=eligibleDiscountItems().map(item=>item.key);
  discountDraftKeys=discountDraftKeys.length===all.length?[]:[...all];
  renderDiscountArticlePicker();
  renderDiscountDraft();
};
document.querySelectorAll("[data-discount-percent]").forEach(button=>button.onclick=()=>{discountDraftPercent=Number(button.dataset.discountPercent);el("discountCustomPercent").value=discountDraftPercent;renderDiscountDraft()});
el("discountCustomPercent").oninput=()=>{discountDraftPercent=Number(String(el("discountCustomPercent").value).replace(",","."))||0;renderDiscountDraft()};
document.querySelectorAll("[data-discount-reason]").forEach(button=>button.onclick=()=>{discountDraftReason=discountDraftReason===button.dataset.discountReason?"":button.dataset.discountReason;renderDiscountDraft()});
el("applyDiscountBtn").onclick=()=>{const percent=Number(discountDraftPercent);if(!Number.isFinite(percent)||percent<=0||percent>100)return setSystemHint("Rabatt muss größer als 0 und höchstens 100 Prozent sein","warn");if(positionDiscountTargetKey){const item=state.cart.find(row=>row.key===positionDiscountTargetKey);if(!item)return setSystemHint("Die gewählte Position ist nicht mehr vorhanden","warn");item.positionDiscount={percent:+percent.toFixed(1),reason:safeText(discountDraftReason,80),note:safeText(el("discountReasonNote").value,160)};const name=item.name,value=positionDiscountAmount(item);positionDiscountTargetKey=null;el("discountDialog").close();renderCart();setSystemHint(`${percent.toLocaleString("de-DE")} % Positionsrabatt für ${name} · − ${money(value)}`,"ok");return}if(!discountDraftKeys.length)return setSystemHint("Mindestens einen Artikel für den Rabatt auswählen","warn");state.discount={percent:+percent.toFixed(1),reason:safeText(discountDraftReason,80),note:safeText(el("discountReasonNote").value,160),keys:[...discountDraftKeys]};recordDiscountAudit("apply");el("discountDialog").close();renderCart();setSystemHint(`${state.discount.percent.toLocaleString("de-DE")} % Rabatt · − ${money(globalDiscountAmount())}`,"ok")};
el("clearDiscountBtn").onclick=()=>{if(positionDiscountTargetKey){const item=state.cart.find(row=>row.key===positionDiscountTargetKey);if(item)delete item.positionDiscount;positionDiscountTargetKey=null;el("discountDialog").close();renderCart();setSystemHint("Positionsrabatt entfernt","ok");return}const hadDiscount=globalDiscountAmount()>0;if(hadDiscount)recordDiscountAudit("remove");resetDiscount();el("discountDialog").close();renderCart();setSystemHint("Rabatt entfernt","ok")};
el("exitDiscountModeBtn")?.addEventListener("click",()=>{const hadDiscount=discountAmount()>0;if(hadDiscount)recordDiscountAudit("remove");resetDiscount();renderCart();setSystemHint("Rabattmodus beendet")});

function tipRecords(){
  return JSON.parse(localStorage.getItem("kc_tip_records")||"[]");
}
function saveTipRecord(amount,source,bonNumber=null,note=""){
  const value=Number(amount||0);
  if(value<=0)return null;
  const record={
    id:crypto.randomUUID(),
    time:new Date().toISOString(),
    registerId:state.master.registerId||"KASSE-01",
    registerName:state.master.registerName||"Kasse 1",
    operator:state.master.operatorName||"Hans",
    amount:+value.toFixed(2),
    source,
    bonNumber:bonNumber||null,
    note:note||"",
    training:!!state.master.trainingMode
  };
  const list=tipRecords();
  list.push(record);
  localStorage.setItem("kc_tip_records",JSON.stringify(list));
  return record;
}


function roundTargets(due){
  const values=new Set();
  values.add(Math.ceil(due));
  values.add(Math.ceil(due*2)/2);
  values.add(Math.ceil(due/5)*5);
  values.add(Math.ceil(due/10)*10);
  return [...values].filter(v=>v>due).sort((a,b)=>a-b).slice(0,4);
}
function openRoundUp(){
  const due=total();if(due<=0)return setSystemHint("Kein offener Bon","warn");
  el("roundUpDue").textContent=money(due);
  el("roundUpChoices").innerHTML=roundTargets(due).map(v=>`<button type="button" data-target="${v}">${money(v)}</button>`).join("");
  el("roundUpChoices").querySelectorAll("button").forEach(b=>b.onclick=()=>applyRoundUp(Number(b.dataset.target)));
  el("roundUpCustom").value="";
  el("roundUpDialog").showModal();
}
async function applyRoundUp(target){
  const due=total(),tip=Math.max(0,Number(target)-due);
  if(tip<=0)return setSystemHint("Zielbetrag muss höher sein","warn");
  const received=state.given>0?state.given:Number(target);
  if(received<Number(target))return setSystemHint(`Für ${money(target)} fehlen noch ${money(Number(target)-received)}`,"warn");
  const change=Math.max(0,received-Number(target));
  saveTipRecord(tip,"aufrunden",bonText(),`Aufgerundet auf ${money(target)}`);
  state.given=received;
  await completeSale("cash-roundup",{silent:true,changeTarget:Number(target)});
  el("roundUpDialog").close();
  setSystemHint(`Aufgerundet · Trinkgeld ${money(tip)} · Rückgeld ${money(change)}`);
}

function canonicalTransaction(row){const copy=cloneData(row);delete copy.recordHash;return JSON.stringify(copy)}
async function completeSale(method,{type="sale",silent=false,changeTarget=null,directSettlement=false}={}){
  if(!state.cart.length)return showMessage("Kein Bon","0,00 €","Bitte zuerst Artikel wählen.");
  if(state.saleInProgress)return;
  state.saleInProgress=true;
  try{
    const training=!!state.master.trainingMode,endTime=new Date().toISOString();
    const trainingCounter=Number(localStorage.getItem("kc_training_next_bon_v018")||1);
    const current=training?`T-${String(trainingCounter).padStart(6,"0")}`:bonText();
    const grossDue=+grossTotal().toFixed(2),globalDiscountValue=+globalDiscountAmount().toFixed(2),positionDiscountValue=+totalPositionDiscountAmount().toFixed(2),discountValue=+(globalDiscountValue+positionDiscountValue).toFixed(2),due=+total().toFixed(2),given=type==="personal"?0:+state.given.toFixed(2),settlementTarget=changeTarget!==null&&Number.isFinite(Number(changeTarget))?Number(changeTarget):due,change=type==="personal"?0:+Math.max(0,given-settlementTarget).toFixed(2);
    const rows=training?readTrainingTransactions():readTransactions(),previousHash=rows[rows.length-1]?.recordHash||null;
    const items=state.cart.map(item=>({...cloneData(item),unitTotal:+(lineUnit(item)+(state.master.depositRule==="automatic"?item.deposits.reduce((sum,d)=>sum+Number(d.price||0),0):0)).toFixed(2),lineTotal:+((lineUnit(item)+(state.master.depositRule==="automatic"?item.deposits.reduce((sum,d)=>sum+Number(d.price||0),0):0))*item.qty).toFixed(2)}));
    if(globalDiscountValue>0)items.push({id:"DISCOUNT",name:`Rabatt ${Number(state.discount.percent).toLocaleString("de-DE")} %${state.discount.reason?` · ${state.discount.reason}`:""}`,category:"Rabatt",price:-globalDiscountValue,qty:1,unitTotal:-globalDiscountValue,lineTotal:-globalDiscountValue,discountLine:true});
    state.cart.filter(item=>item.positionDiscount?.percent).forEach(item=>{const value=+positionDiscountAmount(item).toFixed(2);if(value>0)items.push({id:`POSITION-DISCOUNT-${item.id}`,name:`Positionsrabatt ${Number(item.positionDiscount.percent).toLocaleString("de-DE")} % · ${item.name}`,category:"Positionsrabatt",price:-value,qty:1,unitTotal:-value,lineTotal:-value,discountLine:true,sourceItemKey:item.key,reason:item.positionDiscount.reason||null,note:item.positionDiscount.note||null})});
    const rec={transactionId:crypto.randomUUID(),formatVersion:5,bon:current,bonNumber:current,startTime:state.cartStartedAt||endTime,time:endTime,endTime,registerId:state.master.registerId,registerName:state.master.registerName,operator:state.master.operatorName,type,training,method,payment:method,grossDue,grossDueCents:toCents(grossDue),discount:{percent:Number(state.discount.percent||0),amount:discountValue,amountCents:toCents(discountValue),globalAmount:globalDiscountValue,positionAmount:positionDiscountValue,base:discountBase(),reason:state.discount.reason||null,note:state.discount.note||null,keys:Array.isArray(state.discount.keys)?state.discount.keys:[],positions:state.cart.filter(item=>item.positionDiscount?.percent).map(item=>({key:item.key,id:item.id,name:item.name,percent:Number(item.positionDiscount.percent),amount:positionDiscountAmount(item),reason:item.positionDiscount.reason||null}))},due,total:due,dueCents:toCents(due),given,givenCents:toCents(given),settlementTarget:+settlementTarget.toFixed(2),change,changeCents:toCents(change),depositRule:state.master.depositRule,items,previousHash};
    rec.recordHash=await sha256Hex(canonicalTransaction(rec));rows.push(rec);saveTransactions(rows,training);
    if(training)localStorage.setItem("kc_training_next_bon_v018",String(trainingCounter+1));else{state.master.nextBon++;saveMaster()}
    state.cart=[];state.cartStartedAt=null;state.lastAdded=null;state.selectedCartKey=null;state.given=0;state.cashSelections=[];state.keypadBuffer="";quantityUndoStack.length=0;updateQuantityUndoButton();if(state.master.requireOperatorConfirmation===true)state.operatorConfirmedForSale=false;renderHeader();renderCart();
    setCartNotice("Einkaufswagen abgerechnet","success");
    if(directSettlement)showDirectSettlementNotice();
    notify("success","Einkaufswagen abgerechnet","sale-complete",7000);
    if(silent)setSystemHint(`${training?"Training":"Verkauf"} abgeschlossen · bereit für den nächsten Verkauf`);
    else if(type==="personal")showMessage("Personalverbrauch",money(due),`${training?"Trainingsvorgang":"Vorgang"} ${current} wurde protokolliert.`);
    else if(state.master.requireChangeFlow===true)showMessage(training?"Training abgeschlossen":"Rückgeld",money(change),`${training?"Trainingsbon":"Bon"} ${current} gespeichert.`);
    else showMessage(training?"Training abgeschlossen":"Verkauf abgeschlossen","✓",`${training?"Trainingsbon":"Bon"} ${current} gespeichert.`);
    return rec;
  }finally{state.saleInProgress=false}
}
function showMessage(t,v,txt){el("messageTitle").textContent=t;el("messageValue").textContent=v;el("messageText").textContent=txt;el("messageDialog").showModal()}
function renderMoney(){const notes=[5,10,20,50,100];el("banknotes").innerHTML=notes.map(v=>`<button class="banknote-button" data-value="${v}" data-cash-label="${v} €"><span class="banknote-visual n${v}">${v} €</span><b>${v} €</b></button>`).join("");el("banknotes").querySelectorAll("button").forEach(button=>button.onclick=()=>addCashSelection(Number(button.dataset.value),button.dataset.cashLabel));const coins=[{v:2,l:"2 €",c:"gold"},{v:1,l:"1 €",c:""},{v:.5,l:"50 ct",c:"gold"},{v:.2,l:"20 ct",c:"gold"},{v:.1,l:"10 ct",c:"gold"},{v:.05,l:"5 ct",c:"gold"}];el("coins").innerHTML=coins.map(c=>`<button class="coin-button" data-value="${c.v}" data-cash-label="${c.l}"><span class="coin ${c.c}">${c.l.split(" ")[0]}</span>${c.l}</button>`).join("");el("coins").querySelectorAll("button").forEach(button=>button.onclick=()=>addCashSelection(Number(button.dataset.value),button.dataset.cashLabel))}
function voidBon(){if(!state.cart.length)return;askConfirm("Offenen Bon verwerfen",`Den noch nicht gebuchten Bon ${bonText()} mit allen Positionen verwerfen?`,()=>{const log=safeArray("kc_voids_v040");log.push({voidId:crypto.randomUUID(),bon:bonText(),time:new Date().toISOString(),registerId:state.master.registerId,operator:state.master.operatorName,training:!!state.master.trainingMode,reason:"unbooked-cart-discarded",items:cloneData(state.cart)});localStorage.setItem("kc_voids_v040",JSON.stringify(log));state.cart=[];state.cartStartedAt=null;state.lastAdded=null;state.selectedCartKey=null;state.given=0;state.cashSelections=[];state.keypadBuffer="";quantityUndoStack.length=0;updateQuantityUndoButton();renderCart()})}
function openDisplaySettings(){
  normalizeDisplayProfile();
  const groupList=el("displayGroupList");
  const articleList=el("displayArticleList");
  groupList.innerHTML=GROUPS.filter(isActiveRecord).sort((a,b)=>a.sortOrder-b.sortOrder).map(g=>`<label><input type="checkbox" data-display-group="${g.id}" ${displayProfile.groupIds.includes(g.id)?"checked":""}><span><b>${g.name}</b><small>${g.shortName||"Warengruppe"}</small></span></label>`).join("");
  articleList.innerHTML=PRODUCTS.filter(isActiveRecord).map(p=>`<label data-article-category="${p.category}"><input type="checkbox" data-display-product="${p.id}" ${displayProfile.productIds.includes(p.id)?"checked":""}><img src="${p.image}" alt=""><span><b>${p.name}</b><small>${p.category}</small></span></label>`).join("");
  const syncArticleVisibility=()=>{
    const selected=new Set([...groupList.querySelectorAll("[data-display-group]:checked")].map(x=>GROUPS.find(g=>g.id===x.dataset.displayGroup)?.name));
    articleList.querySelectorAll("[data-article-category]").forEach(row=>row.hidden=!selected.has(row.dataset.articleCategory));
  };
  groupList.querySelectorAll("input").forEach(x=>x.addEventListener("change",syncArticleVisibility));
  syncArticleVisibility();
  el("displaySettingsDialog").showModal();
}
function applyDisplaySettings(){
  const before=cloneData(displayProfile);
  const groupIds=[...el("displayGroupList").querySelectorAll("[data-display-group]:checked")].map(x=>x.dataset.displayGroup);
  if(!groupIds.length){setSystemHint("Mindestens eine Warengruppe muss sichtbar bleiben","warn");return}
  const allowedNames=new Set(GROUPS.filter(g=>groupIds.includes(g.id)).map(g=>g.name));
  const productIds=[...el("displayArticleList").querySelectorAll("[data-display-product]:checked")].map(x=>x.dataset.displayProduct).filter(id=>allowedNames.has(PRODUCTS.find(p=>p.id===id)?.category));
  if(!productIds.length){setSystemHint("Mindestens ein Artikel muss sichtbar bleiben","warn");return}
  displayProfile={groupIds,productIds};saveDisplayProfile();
  const cats=categories();if(!cats.includes(state.activeCategory))state.activeCategory=cats[0]||"Getränke";
  state.productPage=0;renderCategories();renderProducts();el("displaySettingsDialog").close();recordAdminChange("display-profile","update",state.master.registerId,before,displayProfile);setSystemHint("Kassenansicht übernommen");
}

function openSettings(){
  el("depositRuleSelect").value=state.master.depositRule;
  el("registerIdSetting").value=state.master.registerId||"KASSE-01";
  el("registerNameSetting").value=state.master.registerName||"Kasse 1";
  el("showInfoToggle").checked=state.master.showProductInfo;
  el("highlightAllergensToggle").checked=state.master.highlightAllergens;
  el("requireOperatorToggle").checked=state.master.requireOperatorConfirmation===true;
  el("showStaffToggle").checked=state.master.showStaff!==false;
  el("showTipToggle").checked=state.master.showTip!==false;
  el("showDepositToggle").checked=state.master.showDeposit!==false;
  el("showPrintToggle").checked=state.master.showPrint!==false;
  el("buttonSizeSelect").value=state.master.buttonSize;
  el("buttonModeSelect").value=state.master.buttonMode;
  el("showPriceSelect").value=state.master.showPrice?"yes":"no";
  el("fiscalModeSelect").value=state.master.fiscalMode||"off";
  el("tseProviderSetting").value=state.master.tseProvider||"";
  el("tseSerialSetting").value=state.master.tseSerial||"";
  renderFiscalInternalStatus();
  updateLayoutPreview();
  workspaceDraft=workspaceConfig();renderWorkspaceEditor();
  fillCategorySelect();
  loadGroup(state.groupIndex);
  loadArticle(state.articleIndex);
  populateTransferFilters();
  renderReportPreview();
  el("settingsDialog").showModal();
}
function openService(){
  el("servicePin").value="";
  el("serviceQrCode").value="";
  el("serviceError").textContent="";
  el("serviceDialog").showModal();
  setTimeout(()=>el("servicePin").focus(),50);
}
async function serviceLogin(e){
  e?.preventDefault();
  if(adminAccessLocked())return;
  const pin=el("servicePin").value.trim();
  if(!/^\d{4}$/.test(pin)){
    registerAdminFailure("pin","Bitte eine vierstellige PIN eingeben.");
    el("servicePin").select();
    return;
  }
  const access=state.master.superAdminAccess;
  if(!access?.active||(!access.pinKdf?.hash&&!access.pinHash)){
    registerAdminFailure("pin","Keine aktive Superadmin-PIN eingerichtet. Bitte die aktuelle Manager-Konfiguration importieren.");
    return;
  }
  if(access.expiresAt&&Date.now()>new Date(access.expiresAt).getTime()){
    registerAdminFailure("pin","Der Superadmin-Zugang ist abgelaufen.",access.credentialId);
    return;
  }
  let valid=false;
  if(access.pinKdf?.algorithm==="PBKDF2-SHA-256"){
    const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveBits"]);
    const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:unb64(access.pinKdf.salt),iterations:Number(access.pinKdf.iterations||250000),hash:"SHA-256"},material,256);
    valid=b64(new Uint8Array(bits))===access.pinKdf.hash;
  }else valid=await sha256Hex(`KCPIN1:${pin}`)===access.pinHash;
  if(!valid){
    registerAdminFailure("pin","PIN nicht richtig.",access.credentialId);
    el("servicePin").select();
    return;
  }
  adminFailedAttempts=0;
  beginAdminSession("pin",access.owner||"Superadmin",access.credentialId||null);
}

document.querySelectorAll("[data-settings-tab]").forEach(btn=>btn.onclick=()=>{
  if(btn.dataset.settingsTab==="packages"){fillPackageSelectors();renderPackageTable();analyzePackagePairs()}
  if(btn.dataset.settingsTab==="offers"){fillOfferProducts();renderOfferTable();renderOfferRuntime()}
  document.querySelectorAll("[data-settings-tab]").forEach(x=>x.classList.toggle("active",x===btn));
  document.querySelectorAll("[data-settings-panel]").forEach(x=>x.classList.toggle("active",x.dataset.settingsPanel===btn.dataset.settingsTab));
});

function updateLayoutPreview(){
  const preview=el("layoutPreview");if(!preview)return;
  const mode=el("buttonModeSelect").value;
  preview.className=`preview-tile mode-${mode}`;
  preview.style.width=el("buttonSizeSelect").value==="compact"?"175px":el("buttonSizeSelect").value==="large"?"250px":"210px";
  preview.querySelector("b").style.display=el("showPriceSelect").value==="yes"?"block":"none";
  preview.querySelector("i").style.display=el("showInfoToggle").checked?"flex":"none";
}
["buttonSizeSelect","buttonModeSelect","showPriceSelect","showInfoToggle"].forEach(id=>el(id).addEventListener("change",updateLayoutPreview));

const groupFields={
  id:"groupId",name:"groupName",shortName:"groupShortName",sortOrder:"groupSortOrder",
  color:"groupColor",active:"groupActive",notes:"groupNotes"
};
const articleFieldMap={
  id:"articleId",name:"articleName",category:"articleCategory",shortName:"articleShortName",
  receiptText:"articleReceiptText",barcode:"articleBarcode",unit:"articleUnit",quantity:"articleQuantity",
  sortOrder:"articleSortOrder",active:"articleActive",favorite:"articleFavorite",
  stockManaged:"articleStockManaged",price:"articlePrice",purchasePrice:"articlePurchasePrice",
  taxRate:"articleTaxRate",minStock:"articleMinStock",stock:"articleStock",priceGroup:"articlePriceGroup",
  allowPriceChange:"articleAllowPriceChange",allowQuantityChange:"articleAllowQuantityChange",
  allowStaff:"articleAllowStaff",receiptNote:"articleReceiptNote",depositRule:"articleDepositRule",
  optionGroup:"articleOptionGroup",partialDepositReturn:"articlePartialDepositReturn",
  staffDeposit:"articleStaffDeposit",color:"articleColor",image:"articleImage",
  displayMode:"articleDisplayMode",buttonSize:"articleButtonSize",showInfo:"articleShowInfo",
  showPrice:"articleShowPrice"
};

function fillCategorySelect(){
  const s=el("articleCategory");if(!s)return;
  const current=s.value;
  s.innerHTML=GROUPS.filter(isActiveRecord).sort((a,b)=>a.sortOrder-b.sortOrder).map(g=>`<option value="${g.name}">${g.name}</option>`).join("");
  if([...s.options].some(o=>o.value===current))s.value=current;
}
function setFormDisabled(map,disabled){
  Object.values(map).forEach(id=>{const node=el(id);if(node)node.disabled=disabled});
}
function loadGroup(index){
  if(!GROUPS.length)return clearGroupForm();
  state.groupIndex=Math.max(0,Math.min(index,GROUPS.length-1));
  const g=GROUPS[state.groupIndex];
  Object.entries(groupFields).forEach(([key,id])=>{
    const node=el(id);if(node.type==="checkbox")node.checked=!!g[key];else node.value=g[key]??"";
  });
  el("groupRecordStatus").textContent=`Datensatz ${state.groupIndex+1} von ${GROUPS.length}`;
  renderGroupTable();
}
function clearGroupForm(){
  Object.values(groupFields).forEach(id=>{const n=el(id);if(n.type==="checkbox")n.checked=true;else n.value=""});
  el("groupColor").value="#315d8d";el("groupSortOrder").value=(GROUPS.length+1)*10;
}
function readGroupForm(){
  return sanitizeGroup({
    id:el("groupId").value.trim(),name:el("groupName").value.trim(),
    shortName:el("groupShortName").value.trim(),sortOrder:Number(el("groupSortOrder").value||0),
    color:el("groupColor").value,active:el("groupActive").checked,notes:el("groupNotes").value.trim()
  },state.groupIndex);
}
function renderGroupTable(){
  el("groupTableBody").innerHTML=GROUPS.map((g,i)=>`<tr data-index="${i}" class="${i===state.groupIndex?"selected":""}">
    <td>${g.id}</td><td>${g.name}</td><td>${g.shortName||""}</td><td>${g.sortOrder}</td>
    <td><span class="color-swatch" style="background:${g.color}"></span> ${g.color}</td>
    <td class="${isActiveRecord(g)?"status-active":"status-inactive"}">${isActiveRecord(g)?"Aktiv":"Inaktiv"}</td></tr>`).join("");
  el("groupTableBody").querySelectorAll("tr").forEach(r=>r.onclick=()=>loadGroup(+r.dataset.index));
}
function saveGroupRecord(){
  const g=readGroupForm();
  if(!g.id||!g.name)return showMessage("Pflichtfelder","!","Warengruppen-Nr. und Bezeichnung müssen ausgefüllt sein.");
  const duplicate=GROUPS.findIndex((x,i)=>x.id===g.id&&i!==state.groupIndex);
  if(duplicate>=0)return showMessage("Doppelte Nummer","!","Diese Warengruppen-Nr. existiert bereits.");
  const before=state.groupEditMode&&GROUPS[state.groupIndex]?cloneData(GROUPS[state.groupIndex]):null;
  const affectedBefore=before&&before.name!==g.name?PRODUCTS.filter(p=>p.category===before.name).map(cloneData):[];
  if(before){
    const oldName=GROUPS[state.groupIndex].name;GROUPS[state.groupIndex]=g;
    PRODUCTS.forEach(p=>{if(p.category===oldName)p.category=g.name});
  }else{GROUPS.push(g);state.groupIndex=GROUPS.length-1}
  saveGroups();saveProducts();state.groupEditMode=false;fillCategorySelect();loadGroup(state.groupIndex);renderCategories();renderProducts();
  recordAdminChange("group",before?"update":"create",g.id,before,g);
  affectedBefore.forEach(old=>recordAdminChange("article","update",old.id,old,PRODUCTS.find(p=>p.id===old.id)));
}
function groupCommand(cmd){
  if(cmd==="new"){state.groupEditMode=false;clearGroupForm();setFormDisabled(groupFields,false);return}
  if(cmd==="edit"){state.groupEditMode=true;setFormDisabled(groupFields,false);return}
  if(cmd==="save"){saveGroupRecord();return}
  if(cmd==="update"){loadGroup(state.groupIndex);return}
  if(cmd==="first")return loadGroup(0);
  if(cmd==="prev")return loadGroup(state.groupIndex-1);
  if(cmd==="next")return loadGroup(state.groupIndex+1);
  if(cmd==="last")return loadGroup(GROUPS.length-1);
  if(cmd==="export")return exportJson("KC_MarktKasse_Warengruppen.json",GROUPS);
  if(cmd==="import")return el("groupImportFile").click();
  if(cmd==="print")return printMasterPanel("groups");
}

function productToForm(p){
  const d=p.depositComponents||[];
  return {
    ...p,shortName:p.shortName||"",receiptText:p.receiptText||p.name,barcode:p.barcode||"",
    unit:p.unit||"Stück",quantity:p.quantity??1,sortOrder:p.sortOrder??0,active:p.active!==false,
    favorite:!!p.favorite,stockManaged:!!p.stockManaged,purchasePrice:p.purchasePrice??0,
    taxRate:p.taxRate??19,minStock:p.minStock??0,stock:p.stock??0,priceGroup:p.priceGroup||"",
    allowPriceChange:!!p.allowPriceChange,allowQuantityChange:p.allowQuantityChange!==false,
    allowStaff:p.allowStaff!==false,receiptNote:p.receiptNote||"",depositRule:p.depositRule||"global",
    partialDepositReturn:!!p.partialDepositReturn,staffDeposit:!!p.staffDeposit,
    displayMode:p.displayMode||"global",buttonSize:p.buttonSize||"global",
    showInfo:p.showInfo!==false,showPrice:p.showPrice!==false,
    deposit1Name:d[0]?.name||"",deposit1Price:d[0]?.price??0,
    deposit2Name:d[1]?.name||"",deposit2Price:d[1]?.price??0
  };
}
function loadArticle(index){
  if(!PRODUCTS.length)return clearArticleForm();
  state.articleIndex=Math.max(0,Math.min(index,PRODUCTS.length-1));
  fillCategorySelect();
  const p=productToForm(PRODUCTS[state.articleIndex]);
  Object.entries(articleFieldMap).forEach(([key,id])=>{
    const n=el(id);if(!n)return;if(n.type==="checkbox")n.checked=!!p[key];else n.value=p[key]??"";
  });
  el("articleDeposit1Name").value=p.deposit1Name;el("articleDeposit1Price").value=p.deposit1Price;
  el("articleDeposit2Name").value=p.deposit2Name;el("articleDeposit2Price").value=p.deposit2Price;
  el("articleIngredients").value=p.info?.ingredients||"";el("articleAllergens").value=p.info?.allergens||"";
  el("articleContents").value=p.info?.contents||"";el("articleImportant").value=p.info?.important||"";
  el("articleNotes").value=p.info?.notes||"";
  el("articleRecordStatus").textContent=`Datensatz ${state.articleIndex+1} von ${PRODUCTS.length}`;
  renderArticleTable();
}
function clearArticleForm(){
  Object.values(articleFieldMap).forEach(id=>{const n=el(id);if(!n)return;if(n.type==="checkbox")n.checked=false;else n.value=""});
  fillCategorySelect();el("articleQuantity").value=1;el("articlePrice").value="0.00";el("articleTaxRate").value="19";
  el("articleActive").checked=true;el("articleAllowQuantityChange").checked=true;el("articleAllowStaff").checked=true;
  el("articleShowInfo").checked=true;el("articleShowPrice").checked=true;el("articleColor").value="#315d8d";
  ["articleDeposit1Name","articleDeposit1Price","articleDeposit2Name","articleDeposit2Price","articleIngredients","articleAllergens","articleContents","articleImportant","articleNotes"].forEach(id=>el(id).value="");
}
function readArticleForm(){
  const data={};
  Object.entries(articleFieldMap).forEach(([key,id])=>{const n=el(id);if(!n)return;data[key]=n.type==="checkbox"?n.checked:n.value});
  ["quantity","sortOrder","price","purchasePrice","taxRate","minStock","stock"].forEach(k=>data[k]=Number(data[k]||0));
  const deposits=[];
  const n1=el("articleDeposit1Name").value.trim(),p1=Number(el("articleDeposit1Price").value||0);
  const n2=el("articleDeposit2Name").value.trim(),p2=Number(el("articleDeposit2Price").value||0);
  if(n1&&p1>=0)deposits.push({id:"deposit1",name:n1,price:p1});
  if(n2&&p2>=0)deposits.push({id:"deposit2",name:n2,price:p2});
  data.depositComponents=deposits;
  data.info={
    ingredients:el("articleIngredients").value.trim(),allergens:el("articleAllergens").value.trim(),
    contents:el("articleContents").value.trim(),important:el("articleImportant").value.trim(),
    notes:el("articleNotes").value.trim()
  };
  if(!Object.values(data.info).some(Boolean))delete data.info;
  if(!data.optionGroup)delete data.optionGroup;
  return sanitizeProduct(data,state.articleIndex);
}
function renderArticleTable(){
  el("articleTableBody").innerHTML=PRODUCTS.map((p,i)=>`<tr data-index="${i}" class="${i===state.articleIndex?"selected":""}">
    <td>${p.id}</td><td>${p.name}</td><td>${p.category}</td><td>${p.receiptText||p.name}</td>
    <td>${money(Number(p.price||0))}</td><td class="${p.active===false?"status-inactive":"status-active"}">${p.active===false?"Inaktiv":"Aktiv"}</td></tr>`).join("");
  el("articleTableBody").querySelectorAll("tr").forEach(r=>r.onclick=()=>loadArticle(+r.dataset.index));
}
function saveArticleRecord(){
  const p=readArticleForm();
  if(!p.id||!p.name||!p.category)return showMessage("Pflichtfelder","!","Artikel-Nr., Artikelbezeichnung und Warengruppe müssen ausgefüllt sein.");
  const duplicate=PRODUCTS.findIndex((x,i)=>x.id===p.id&&i!==state.articleIndex);
  if(duplicate>=0)return showMessage("Doppelte Artikelnummer","!","Diese Artikelnummer existiert bereits.");
  const before=state.articleEditMode&&PRODUCTS[state.articleIndex]?cloneData(PRODUCTS[state.articleIndex]):null;
  if(before)PRODUCTS[state.articleIndex]={...PRODUCTS[state.articleIndex],...p};
  else{PRODUCTS.push(p);state.articleIndex=PRODUCTS.length-1}
  saveProducts();state.articleEditMode=false;loadArticle(state.articleIndex);renderCategories();renderProducts();
  recordAdminChange("article",before?"update":"create",p.id,before,PRODUCTS[state.articleIndex]);
}
function articleCommand(cmd){
  if(cmd==="new"){state.articleEditMode=false;clearArticleForm();setFormDisabled(articleFieldMap,false);return}
  if(cmd==="edit"){state.articleEditMode=true;setFormDisabled(articleFieldMap,false);return}
  if(cmd==="save"){saveArticleRecord();return}
  if(cmd==="update"){loadArticle(state.articleIndex);return}
  if(cmd==="first")return loadArticle(0);
  if(cmd==="prev")return loadArticle(state.articleIndex-1);
  if(cmd==="next")return loadArticle(state.articleIndex+1);
  if(cmd==="last")return loadArticle(PRODUCTS.length-1);
  if(cmd==="export")return exportJson("KC_MarktKasse_Artikel.json",PRODUCTS);
  if(cmd==="import")return el("articleImportFile").click();
  if(cmd==="print")return printMasterPanel("articles");
}
function exportJson(name,data){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href);
}
function importJsonFile(file,type){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const data=JSON.parse(reader.result);
      if(!Array.isArray(data))throw new Error("Array erwartet");
      if(type==="groups"){const before=cloneData(GROUPS);GROUPS=data.map(sanitizeGroup);saveGroups();fillCategorySelect();loadGroup(0);renderCategories();recordCollectionDiff("group",before,GROUPS)}
      else{const before=cloneData(PRODUCTS);PRODUCTS=data.map(sanitizeProduct);saveProducts();loadArticle(0);renderProducts();recordCollectionDiff("article",before,PRODUCTS)}
      showMessage("Import erfolgreich","✓",`${data.length} Datensätze wurden übernommen.`);
    }catch(err){showMessage("Import fehlgeschlagen","!",`Datei konnte nicht gelesen werden: ${err.message}`)}
  };
  reader.readAsText(file);
}
function printMasterPanel(panel){
  document.body.classList.add("print-masterdata");
  document.querySelectorAll("[data-settings-panel]").forEach(x=>x.classList.toggle("active",x.dataset.settingsPanel===panel));
  setTimeout(()=>{window.print();document.body.classList.remove("print-masterdata")},50);
}
document.querySelectorAll("#groupToolbar button[data-command]").forEach(b=>b.onclick=()=>groupCommand(b.dataset.command));
document.querySelectorAll("#articleToolbar button[data-command]").forEach(b=>b.onclick=()=>articleCommand(b.dataset.command));
el("groupImportFile").addEventListener("change",e=>{if(e.target.files[0])importJsonFile(e.target.files[0],"groups");e.target.value=""});
el("articleImportFile").addEventListener("change",e=>{if(e.target.files[0])importJsonFile(e.target.files[0],"articles");e.target.value=""});
document.querySelectorAll("[data-article-tab]").forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll("[data-article-tab]").forEach(x=>x.classList.toggle("active",x===btn));
  document.querySelectorAll("[data-article-panel]").forEach(x=>x.classList.toggle("active",x.dataset.articlePanel===btn.dataset.articleTab));
});
el("saveTestSettings").onclick=e=>{
  e.preventDefault();
  const before=cloneData(state.master);
  Object.assign(state.master,{
    depositRule:el("depositRuleSelect").value,
    registerId:el("registerIdSetting").value.trim()||state.master.registerId,
    registerName:el("registerNameSetting").value.trim()||state.master.registerName,
    showProductInfo:el("showInfoToggle").checked,
    highlightAllergens:el("highlightAllergensToggle").checked,
    requireOperatorConfirmation:el("requireOperatorToggle").checked,
    showStaff:el("showStaffToggle").checked,
    showTip:el("showTipToggle").checked,
    showDeposit:el("showDepositToggle").checked,
    showPrint:el("showPrintToggle").checked,
    buttonSize:el("buttonSizeSelect").value,
    buttonMode:el("buttonModeSelect").value,
    showPrice:el("showPriceSelect").value==="yes",
    fiscalMode:el("fiscalModeSelect").value,
    tseProvider:el("tseProviderSetting").value.trim(),
    tseSerial:el("tseSerialSetting").value.trim(),
    workspaceButtons:cloneData(workspaceDraft||workspaceConfig())
  });
  state.operatorConfirmedForSale=state.master.requireOperatorConfirmation!==true;
  saveMaster();renderHeader();renderCategories();renderProducts();renderCart();
  if(JSON.stringify(before)!==JSON.stringify(state.master))recordAdminChange("settings","update","pos-settings",before,state.master);
  el("settingsDialog").close();
};

function renderFiscalInternalStatus(){
  const mode=el("fiscalModeSelect")?.value||state.master.fiscalMode||"off",node=el("fiscalModeInternalStatus");
  if(!node)return;
  node.textContent=mode==="tse"?"TSE-Modus ist ausgewählt. Erst mit verbundenem, geprüftem Adapter darf er als betriebsbereit gelten.":"Lokaler Betriebsmodus ohne TSE-Anbindung.";
}
el("fiscalModeSelect")?.addEventListener("change",renderFiscalInternalStatus);



function securityContext(){return{role:state.role,session:adminSession?{...adminSession,valid:true}:null,policy:state.master.securityPolicy||{}}}
function hasPermission(permission){return !!window.KCSecurityCore?.has(permission,securityContext())}
function secureAuthOk(){return hasPermission("protected.open")||hasPermission("settings.manage")||hasPermission("*")}

function requirePermission(permission,action){
  const decision=window.KCSecurityCore?.decision(permission,securityContext())||{allowed:false,code:"SECURITY_CORE_UNAVAILABLE"};
  if(!decision.allowed){appendAdminAudit(permission,"rejected",{message:decision.code});return false}
  return typeof action==="function"?action(decision):true;
}
function b64(bytes){return btoa(String.fromCharCode(...bytes))}
function unb64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function encryptObject(obj,password){const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveKey"]);const key=await crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:250000,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["encrypt"]);const cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(JSON.stringify(obj)));return{format:"KC_ENCRYPTED_V1",salt:b64(salt),iv:b64(iv),data:b64(new Uint8Array(cipher))}}
async function decryptObject(wrapper,password){
  if(wrapper?.format!=="KC_ENCRYPTED_V1")return wrapper;
  const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveKey"]);
  const key=await crypto.subtle.deriveKey({name:"PBKDF2",salt:unb64(wrapper.salt),iterations:250000,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["decrypt"]);
  const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(wrapper.iv)},key,unb64(wrapper.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

let pendingConfigImport=null,pendingBackupImport=null;

function populateTransferFilters(){
  const opts=GROUPS.filter(isActiveRecord).sort((a,b)=>a.sortOrder-b.sortOrder).map(g=>`<option value="${g.name}">${g.name}</option>`).join("");
  el("exportArticlesGroup").innerHTML=opts;
  el("salesGroupFilter").innerHTML='<option value="">Alle Warengruppen</option>'+opts;
}
function csvEscape(v){
  const s=String(v??"");
  return /[;"\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
}
function downloadText(name,text,type="text/plain;charset=utf-8"){
  const blob=new Blob(["\ufeff"+text],{type});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),500);
}
function rowsToCsv(headers,rows){
  return [headers.map(csvEscape).join(";"),...rows.map(r=>r.map(csvEscape).join(";"))].join("\r\n");
}
function rowsToExcelHtml(title,headers,rows){
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family:Arial}h1{font-size:18pt}table{border-collapse:collapse;width:100%}th,td{border:1px solid #888;padding:6px}th{background:#173765;color:#fff}</style>
  </head><body><h1>${title}</h1><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead>
  <tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${v??""}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
}
function getArticleExportRows(){
  let items=[...PRODUCTS];
  const scope=el("exportArticlesScope").value;
  if(scope==="active")items=items.filter(p=>p.active!==false);
  if(scope==="group")items=items.filter(p=>p.category===el("exportArticlesGroup").value);
  const headers=["Artikel-Nr.","Artikelbezeichnung","Kurzbezeichnung","Bontext","Warengruppe","Verkaufseinheit","Menge je Verkauf","Verkaufspreis","Einkaufspreis","Steuersatz","Barcode","Pfandregel","Optionsgruppe","Aktiv","Bildpfad","Zutaten","Allergene","Inhaltsstoffe","Wichtiger Hinweis","Freitext"];
  const rows=items.map(p=>[
    p.id,p.name,p.shortName||"",p.receiptText||p.name,p.category,p.unit||"Stück",p.quantity??1,
    Number(p.price||0).toFixed(2),Number(p.purchasePrice||0).toFixed(2),p.taxRate??19,p.barcode||"",
    p.depositRule||"global",p.optionGroup||"",p.active===false?"Nein":"Ja",p.image||"",
    p.info?.ingredients||"",p.info?.allergens||"",p.info?.contents||"",p.info?.important||"",p.info?.notes||""
  ]);
  return {title:"Artikelliste",headers,rows};
}
function getGroupExportRows(){
  let items=[...GROUPS];
  if(el("exportGroupsScope").value==="active")items=items.filter(isActiveRecord);
  return {
    title:"Warengruppen",
    headers:["Nr.","Bezeichnung","Kurzbezeichnung","Sortierung","Farbe","Aktiv","Beschreibung"],
    rows:items.map(g=>[g.id,g.name,g.shortName||"",g.sortOrder,g.color,isActiveRecord(g)?"Ja":"Nein",g.notes||""])
  };
}
function dateOnly(iso){return String(iso||"").slice(0,10)}
function filterTransactions(){
  let tx=readTransactions().filter(t=>t.type!=="personal");
  const mode=el("salesDateMode").value;
  if(mode==="day"){
    const d=el("salesDateSingle").value; if(d)tx=tx.filter(t=>dateOnly(t.time)===d);
  }else if(mode==="range"){
    const from=el("salesDateFrom").value,to=el("salesDateTo").value;
    if(from)tx=tx.filter(t=>dateOnly(t.time)>=from);
    if(to)tx=tx.filter(t=>dateOnly(t.time)<=to);
  }
  const group=el("salesGroupFilter").value;
  if(group){
    tx=tx.map(t=>({...t,items:(t.items||[]).filter(i=>{
      const p=PRODUCTS.find(p=>p.id===i.id||p.name===i.name);
      return p?.category===group;
    })})).filter(t=>t.items.length);
  }
  return tx;
}
function buildSalesReport(){
  const tx=filterTransactions(),type=el("salesReportType").value;
  if(type==="transactions"){
    const headers=["Bon","Datum","Uhrzeit","Zahlungsart","Artikel","Menge","Einzelpreis","Gesamt"];
    const rows=[];
    tx.forEach(t=>(t.items||[]).forEach(i=>rows.push([
      t.bon||t.bonNumber||"",dateOnly(t.time),new Date(t.time).toLocaleTimeString("de-DE"),
      t.method||t.payment||"",i.name,i.qty,Number(i.price||0).toFixed(2),Number(i.price*i.qty).toFixed(2)
    ])));
    return {title:"Einzelumsätze",headers,rows};
  }
  if(type==="articles"){
    const map=new Map();
    tx.forEach(t=>(t.items||[]).forEach(i=>{
      const key=i.id||i.name,prev=map.get(key)||{name:i.name,qty:0,total:0};
      prev.qty+=Number(i.qty||0);prev.total+=Number(i.price||0)*Number(i.qty||0);map.set(key,prev);
    }));
    return {title:"Artikelumsätze",headers:["Artikel","Menge","Umsatz"],rows:[...map.values()].map(x=>[x.name,x.qty,x.total.toFixed(2)])};
  }
  const map=new Map();
  tx.forEach(t=>(t.items||[]).forEach(i=>{
    const p=PRODUCTS.find(p=>p.id===i.id||p.name===i.name),group=p?.category||"Ohne Warengruppe";
    const prev=map.get(group)||{qty:0,total:0};prev.qty+=Number(i.qty||0);prev.total+=Number(i.price||0)*Number(i.qty||0);map.set(group,prev);
  }));
  return {title:"Warengruppenauswertung",headers:["Warengruppe","Menge","Umsatz"],rows:[...map.entries()].map(([g,x])=>[g,x.qty,x.total.toFixed(2)])};
}
function renderReportPreview(){
  const r=buildSalesReport();
  el("reportPreviewHead").innerHTML=`<tr>${r.headers.map(h=>`<th>${h}</th>`).join("")}</tr>`;
  el("reportPreviewBody").innerHTML=r.rows.slice(0,250).map(row=>`<tr>${row.map(v=>`<td>${v}</td>`).join("")}</tr>`).join("");
}
function printReport(report){
  const logo=el("clubLogo").src;
  const win=window.open("","_blank");
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${report.title}</title>
  <style>@page{margin:14mm}body{font-family:Arial;color:#172033}header{display:flex;align-items:center;border-bottom:2px solid #173765;padding-bottom:10px;margin-bottom:16px}header img{width:70px;height:70px;object-fit:contain;margin-right:15px}h1{margin:0;font-size:20pt}header p{margin:4px 0 0;color:#555}table{width:100%;border-collapse:collapse;font-size:9pt}th,td{border:1px solid #aaa;padding:5px}th{background:#173765;color:white}footer{position:fixed;bottom:0;left:0;right:0;border-top:1px solid #888;padding-top:5px;font-size:8pt;display:flex;justify-content:space-between}</style>
  </head><body><header><img src="${logo}"><div><h1>${state.master.clubName}</h1><p>${report.title} · ${state.master.eventName}</p></div></header>
  <table><thead><tr>${report.headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${report.rows.map(r=>`<tr>${r.map(v=>`<td>${v??""}</td>`).join("")}</tr>`).join("")}</tbody></table>
  <footer><span>KC MarktKasse ${VERSION}</span><span>Erstellt: ${new Date().toLocaleString("de-DE")}</span></footer>
  <script>window.onload=()=>window.print()<\/script></body></html>`);
  win.document.close();
}
async function fileToDataUrl(path){
  try{
    const res=await fetch(path);const blob=await res.blob();
    return await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob)});
  }catch{return null}
}
async function buildConfigPackage(includeImages=false){
  const products=JSON.parse(JSON.stringify(PRODUCTS));
  if(includeImages){
    for(const p of products){
      if(p.image)p.embeddedImage=await fileToDataUrl(p.image);
    }
  }
  return {
    format:"KC_MARKTKASSE_CONFIG",
    formatVersion:1,
    appVersion:VERSION,
    createdAt:new Date().toISOString(),
    master:state.master,
    groups:GROUPS,
    products,
    packages:PACKAGES,
    offers:OFFERS,
    meta:{includeImages,clubName:state.master.clubName,eventName:state.master.eventName}
  };
}
function validateConfig(pkg){
  const errors=[];
  if(pkg?.format!=="KC_MARKTKASSE_CONFIG")errors.push("Ungültiges Konfigurationsformat");
  if(!Array.isArray(pkg.groups))errors.push("Warengruppen fehlen");
  if(!Array.isArray(pkg.products))errors.push("Artikel fehlen");
  if(pkg.packages!==undefined&&!Array.isArray(pkg.packages))errors.push("Packages ungültig");
  if(pkg.offers!==undefined&&!Array.isArray(pkg.offers))errors.push("Angebote ungültig");
  if(!pkg.master)errors.push("Grundeinstellungen fehlen");
  return errors;
}
function normalizeIncomingConfig(raw){
  if(raw?.format==="KC_MARKTKASSE_CONFIG")return raw;
  if(raw?.format!=="KC_POS_CONFIG")throw new Error("Ungültiges Konfigurationsformat");
  const sourceSettings=raw.settings||{},register=raw.register||{};
  return {
    format:"KC_MARKTKASSE_CONFIG",formatVersion:raw.version||1,appVersion:raw.sourceVersion||"PC-Manager",
    createdAt:raw.createdAt||new Date().toISOString(),
    master:{
      ...state.master,
      clubName:sourceSettings.clubName??state.master.clubName,
      clubLogo:sourceSettings.clubLogo??state.master.clubLogo,
      eventName:sourceSettings.eventName??state.master.eventName,
      registerId:register.id??state.master.registerId,
      registerName:register.name??state.master.registerName,
      operatorName:register.operator??state.master.operatorName,
      buttonSize:sourceSettings.buttonSize??state.master.buttonSize,
      buttonMode:sourceSettings.buttonMode??state.master.buttonMode,
      showProductInfo:sourceSettings.showInfo??state.master.showProductInfo,
      showPrice:sourceSettings.showPrice??state.master.showPrice,
      showStaff:sourceSettings.showStaff??state.master.showStaff,
      showTip:sourceSettings.showTip??state.master.showTip,
      showDeposit:sourceSettings.showDeposit??state.master.showDeposit,
      showPrint:sourceSettings.showPrint??state.master.showPrint,
      showMore:sourceSettings.showMore??state.master.showMore,
      showChange:sourceSettings.showChange??state.master.showChange,
      requireChangeFlow:sourceSettings.requireChangeFlow??state.master.requireChangeFlow,
      requireOperatorConfirmation:sourceSettings.requireOperatorConfirmation??state.master.requireOperatorConfirmation,
      operators:sourceSettings.operators??state.master.operators,
      operatorProfiles:sourceSettings.operatorProfiles??state.master.operatorProfiles,
      fiscalMode:sourceSettings.fiscalMode??(sourceSettings.tse?"tse":state.master.fiscalMode),
      tseProvider:sourceSettings.tseProvider??state.master.tseProvider,
      tseSerial:sourceSettings.tseSerial??state.master.tseSerial,
      superAdminAccess:sourceSettings.superAdminAccess??state.master.superAdminAccess
    },
    groups:Array.isArray(raw.groups)?raw.groups:[],
    products:Array.isArray(raw.articles)?raw.articles:[],
    packages:Array.isArray(raw.packages)?raw.packages:[],
    offers:Array.isArray(raw.offers)?raw.offers:[],
    displayProfile:sourceSettings.posDisplayProfiles?.[register.id]||null,
    meta:{source:"KC_POS_CONFIG",clubName:sourceSettings.clubName,eventName:sourceSettings.eventName}
  };
}
function applyConfig(pkg){
  const incomingMaster=pkg.master||{},incomingReceipt=incomingMaster.receipt||{};
  state.master={...DEFAULTS,...incomingMaster,clubName:safeText(incomingMaster.clubName||DEFAULTS.clubName,100),clubLogo:safeImage(incomingMaster.clubLogo||"assets/logo.png"),eventName:safeText(incomingMaster.eventName||DEFAULTS.eventName,100),registerId:safeId(incomingMaster.registerId,DEFAULTS.registerId),registerName:safeText(incomingMaster.registerName||DEFAULTS.registerName,80),operatorName:safeText(incomingMaster.operatorName||DEFAULTS.operatorName,80),receipt:{...DEFAULTS.receipt,...incomingReceipt,head1:safeText(incomingReceipt.head1||DEFAULTS.receipt.head1,120),head2:safeText(incomingReceipt.head2||DEFAULTS.receipt.head2,120),foot1:safeText(incomingReceipt.foot1||DEFAULTS.receipt.foot1,200)}};
  normalizeOperatorProfiles();state.operatorConfirmedForSale=state.master.requireOperatorConfirmation!==true;GROUPS=pkg.groups.map(sanitizeGroup);
  PRODUCTS=pkg.products.map(sanitizeProduct);
  PACKAGES=Array.isArray(pkg.packages)?pkg.packages.map(sanitizePackage):PACKAGES;
  OFFERS=Array.isArray(pkg.offers)?pkg.offers.map(sanitizeOffer):OFFERS;
  if(pkg.displayProfile){displayProfile=cloneData(pkg.displayProfile);saveDisplayProfile()}
  saveMaster();saveGroups();saveProducts();savePackages();saveOffers();
  renderHeader();renderCategories();renderProducts();fillCategorySelect();populateTransferFilters();
}

function sanitizePackage(raw,index=0){
  const ids=Array.isArray(raw?.componentIds)?raw.componentIds.map(id=>safeId(id,"")).filter(Boolean).slice(0,6):[];
  return {id:safeId(raw?.id,`PKG-${Date.now()}-${index}`),name:safeText(raw?.name||"Neues Package",80),componentIds:ids,
    price:Math.max(0,Number(raw?.price||0)),category:"Packages",active:raw?.active!==false,autoManaged:!!raw?.autoManaged,
    source:raw?.source==="ai"?"ai":"manual",score:Number(raw?.score||0),imageProductId:safeId(raw?.imageProductId||ids[0]||"",""),
    note:safeText(raw?.note||"",220),updatedAt:raw?.updatedAt||new Date().toISOString()};
}
function packageOptions(selected=""){
  return PRODUCTS.filter(p=>p.active!==false&&p.category!=="Pfand").map(p=>`<option value="${p.id}" ${p.id===selected?"selected":""}>${escapeHtml(p.name)} · ${money(p.price)}</option>`).join("");
}
function fillPackageSelectors(){
  ["packageProduct1","packageProduct2","packageImageProduct"].forEach(id=>{const node=el(id);if(node)node.innerHTML='<option value="">Bitte wählen</option>'+packageOptions(node.value)});
}
function packageSum(ids){return ids.map(id=>PRODUCTS.find(p=>p.id===id)).filter(Boolean).reduce((s,p)=>s+Number(p.price||0),0)}
function updatePackagePriceHint(){
  const ids=[el("packageProduct1")?.value,el("packageProduct2")?.value].filter(Boolean),sum=packageSum(ids),price=Number(el("packagePrice")?.value||0);
  if(el("packagePriceHint"))el("packagePriceHint").textContent=ids.length<2?"Bitte zwei Artikel auswählen.":`Einzelpreise ${money(sum)} · Packagevorteil ${money(Math.max(0,sum-price))}`;
}
function clearPackageForm(){
  el("packageId").value="";el("packageName").value="";fillPackageSelectors();el("packageProduct1").value="";el("packageProduct2").value="";
  el("packageImageProduct").value="";el("packagePrice").value="0.00";el("packageActive").checked=true;el("packageAutoManaged").checked=false;el("packageNote").value="";updatePackagePriceHint();
}
function loadPackage(id){
  const pkg=PACKAGES.find(p=>p.id===id);if(!pkg)return;fillPackageSelectors();
  el("packageId").value=pkg.id;el("packageName").value=pkg.name;el("packageProduct1").value=pkg.componentIds?.[0]||"";
  el("packageProduct2").value=pkg.componentIds?.[1]||"";el("packageImageProduct").value=pkg.imageProductId||pkg.componentIds?.[0]||"";
  el("packagePrice").value=Number(pkg.price||0).toFixed(2);el("packageActive").checked=pkg.active!==false;el("packageAutoManaged").checked=!!pkg.autoManaged;el("packageNote").value=pkg.note||"";updatePackagePriceHint();
}
function renderPackageTable(){
  const body=el("packageTableBody");if(!body)return;
  body.innerHTML=PACKAGES.map(pkg=>{const comps=(pkg.componentIds||[]).map(id=>PRODUCTS.find(p=>p.id===id)?.name||id);const sum=packageSum(pkg.componentIds||[]);
    return `<tr data-package-id="${pkg.id}"><td><strong>${escapeHtml(pkg.name)}</strong></td><td>${escapeHtml(comps.join(" + "))}</td><td>${money(sum)}</td><td>${money(pkg.price)}</td><td class="${pkg.source==="ai"?"package-source-ai":"package-source-manual"}">${pkg.source==="ai"?"KI / Verkaufsdaten":"Manager"}</td><td>${pkg.active!==false?"Aktiv":"Inaktiv"}</td></tr>`}).join("");
  body.querySelectorAll("tr").forEach(row=>row.onclick=()=>loadPackage(row.dataset.packageId));
}
function savePackageFromForm(){
  const ids=[el("packageProduct1").value,el("packageProduct2").value].filter(Boolean);
  if(ids.length!==2||ids[0]===ids[1])return showMessage("Package unvollständig","!","Bitte zwei unterschiedliche Artikel auswählen.");
  const price=Number(el("packagePrice").value||0),name=safeText(el("packageName").value,80);
  if(!name||price<=0)return showMessage("Pflichtfelder","!","Name und Package-Preis müssen ausgefüllt sein.");
  const id=el("packageId").value||`PKG-${Date.now()}`,existing=PACKAGES.findIndex(p=>p.id===id);
  const before=existing>=0?cloneData(PACKAGES[existing]):null;
  const pkg=sanitizePackage({id,name,componentIds:ids,price,active:el("packageActive").checked,autoManaged:el("packageAutoManaged").checked,
    source:before?.source||"manual",imageProductId:el("packageImageProduct").value||ids[0],note:el("packageNote").value,updatedAt:new Date().toISOString()});
  if(existing>=0)PACKAGES[existing]=pkg;else PACKAGES.push(pkg);
  savePackages();renderPackageTable();renderCategories();renderProducts();loadPackage(pkg.id);recordAdminChange("package",before?"update":"create",pkg.id,before,pkg);setSystemHint("Package im Manager gespeichert");
}
function transactionItemsForPackageAnalysis(transaction){
  return [...new Set((transaction.items||[]).flatMap(item=>item.isPackage?(item.components||[]).map(c=>c.id):[item.id]).filter(id=>PRODUCTS.some(p=>p.id===id&&p.category!=="Pfand")))];
}
function analyzePackagePairs(){
  const days=Number(el("packageAnalysisDays")?.value||30),since=Date.now()-days*86400000,weekday=new Date().getDay(),transactions=readTransactions().filter(t=>{
    const time=new Date(t.time||t.endTime||0).getTime();return time>=since&&new Date(time).getDay()===weekday&&t.type!=="refund";
  });
  const itemCounts=new Map(),pairCounts=new Map();
  transactions.forEach(t=>{const ids=transactionItemsForPackageAnalysis(t);ids.forEach(id=>itemCounts.set(id,(itemCounts.get(id)||0)+1));
    for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const pair=[ids[i],ids[j]].sort(),key=pair.join("|");pairCounts.set(key,(pairCounts.get(key)||0)+1)}});
  PACKAGE_SUGGESTIONS=[...pairCounts].map(([key,count])=>{const ids=key.split("|"),support=transactions.length?count/transactions.length:0,
    confidence=Math.max(count/(itemCounts.get(ids[0])||1),count/(itemCounts.get(ids[1])||1)),sum=packageSum(ids),
    score=count*4+support*30+confidence*25;
    return {ids,count,support,confidence,score,price:Math.max(.1,Math.round(sum*.95*10)/10)};
  }).filter(x=>x.count>=2).sort((a,b)=>b.score-a.score).slice(0,12);
  if(!PACKAGE_SUGGESTIONS.length){
    PACKAGE_SUGGESTIONS=[
      {ids:["gruenkohl","grot"],count:0,support:0,confidence:0,score:10,price:Math.round(packageSum(["gruenkohl","grot"])*.95*10)/10,fallback:true},
      {ids:["gruenkohl","eier"],count:0,support:0,confidence:0,score:9,price:Math.round(packageSum(["gruenkohl","eier"])*.95*10)/10,fallback:true}
    ];
  }
  renderPackageSuggestions(transactions.length,days);return PACKAGE_SUGGESTIONS;
}
function renderPackageSuggestions(transactionCount=0,days=30){
  const list=el("packageSuggestionList");if(!list)return;
  list.innerHTML=PACKAGE_SUGGESTIONS.map((s,i)=>{const ps=s.ids.map(id=>PRODUCTS.find(p=>p.id===id)).filter(Boolean),name=ps.map(p=>p.name).join(" + ");
    return `<article class="package-suggestion"><strong>${escapeHtml(name)}</strong><small>${s.fallback?"Startvorschlag – noch zu wenig Verkaufsdaten":`${s.count} gemeinsame Bons · Trefferquote ${Math.round(s.confidence*100)} % · Score ${s.score.toFixed(1)}`}</small><div>Vorschlagspreis: <b>${money(s.price)}</b></div><div class="package-suggestion-actions"><button type="button" data-package-adopt="${i}">In Editor übernehmen</button><button type="button" data-package-activate="${i}" class="primary-action">Direkt freigeben</button></div></article>`}).join("");
  list.querySelectorAll("[data-package-adopt]").forEach(b=>b.onclick=()=>adoptPackageSuggestion(+b.dataset.packageAdopt,false));
  list.querySelectorAll("[data-package-activate]").forEach(b=>b.onclick=()=>adoptPackageSuggestion(+b.dataset.packageActivate,true));
  el("packageAiStatus").textContent=`${transactionCount} Bons · ${days} Tage · ${PACKAGE_SUGGESTIONS.length} Vorschläge`;
}
function adoptPackageSuggestion(index,activate){
  const s=PACKAGE_SUGGESTIONS[index];if(!s)return;const products=s.ids.map(id=>PRODUCTS.find(p=>p.id===id)).filter(Boolean);
  clearPackageForm();el("packageName").value=products.map(p=>p.name).join(" + ");el("packageProduct1").value=s.ids[0];el("packageProduct2").value=s.ids[1];
  el("packageImageProduct").value=s.ids[0];el("packagePrice").value=s.price.toFixed(2);el("packageActive").checked=activate;el("packageAutoManaged").checked=true;
  el("packageNote").value=`KI-Vorschlag für ${new Date().toLocaleDateString("de-DE",{weekday:"long"})}: ${s.count||0} gemeinsame Verkäufe, Score ${s.score.toFixed(1)}.`;updatePackagePriceHint();
  if(activate)savePackageFromForm();
}
function rebuildDailyPackages(){
  analyzePackagePairs();const max=Number(el("packageMaxDaily")?.value||4),today=new Date().toISOString().slice(0,10);
  PACKAGES=PACKAGES.filter(p=>!(p.source==="ai"&&p.autoManaged));
  PACKAGE_SUGGESTIONS.slice(0,max).forEach((s,index)=>{const ps=s.ids.map(id=>PRODUCTS.find(p=>p.id===id)).filter(Boolean);if(ps.length!==2)return;
    PACKAGES.push(sanitizePackage({id:`AI-${today}-${index+1}`,name:ps.map(p=>p.name).join(" + "),componentIds:s.ids,price:s.price,active:true,autoManaged:true,source:"ai",score:s.score,imageProductId:s.ids[0],note:`Automatisch für ${new Date().toLocaleDateString("de-DE",{weekday:"long"})} aus Verkaufsdaten zusammengestellt.`}));
  });
  savePackages();localStorage.setItem(PACKAGE_AI_STATE_KEY,JSON.stringify({lastDailyBuild:today,count:max}));
  renderPackageTable();renderCategories();renderProducts();setSystemHint(`${Math.min(max,PACKAGE_SUGGESTIONS.length)} Tages-Packages neu erstellt`);
}
function initializeSmartPackages(){
  PACKAGES=PACKAGES.map(sanitizePackage);savePackages();fillPackageSelectors();renderPackageTable();
  const ai=JSON.parse(localStorage.getItem(PACKAGE_AI_STATE_KEY)||"{}"),today=new Date().toISOString().slice(0,10);
  if(ai.lastDailyBuild!==today)rebuildDailyPackages();else analyzePackagePairs();
}
el("packageNewBtn")?.addEventListener("click",clearPackageForm);
el("packageSaveBtn")?.addEventListener("click",savePackageFromForm);
el("packageDeleteBtn")?.addEventListener("click",()=>{const id=el("packageId").value;if(!id)return;const before=PACKAGES.find(p=>p.id===id);PACKAGES=PACKAGES.filter(p=>p.id!==id);savePackages();renderPackageTable();renderCategories();renderProducts();clearPackageForm();recordAdminChange("package","delete",id,before,null)});
el("packageAnalyzeBtn")?.addEventListener("click",analyzePackagePairs);
el("packageDailyRefreshBtn")?.addEventListener("click",rebuildDailyPackages);
["packageProduct1","packageProduct2","packagePrice"].forEach(id=>el(id)?.addEventListener("change",()=>{if(id!=="packagePrice"){const ids=[el("packageProduct1").value,el("packageProduct2").value].filter(Boolean);if(ids.length===2&&!Number(el("packagePrice").value))el("packagePrice").value=(Math.round(packageSum(ids)*.95*10)/10).toFixed(2)}updatePackagePriceHint()}));


function sanitizeOffer(raw,index=0){
  const weekdays=Array.isArray(raw?.weekdays)?raw.weekdays.map(Number).filter(n=>n>=0&&n<=6):[1,2,3,4,5,6,0];
  return {id:safeId(raw?.id,`OFFER-${Date.now()}-${index}`),name:safeText(raw?.name||"Neue Aktion",80),
    type:raw?.type==="happyhour"?"happyhour":"offer",productIds:Array.isArray(raw?.productIds)?raw.productIds.map(id=>safeId(id,"")).filter(Boolean):[],
    priceMode:raw?.priceMode==="fixed"?"fixed":"percent",priceValue:Math.max(0,Number(raw?.priceValue||0)),
    startDate:/^\d{4}-\d{2}-\d{2}$/.test(raw?.startDate||"")?raw.startDate:"",endDate:/^\d{4}-\d{2}-\d{2}$/.test(raw?.endDate||"")?raw.endDate:"",
    startTime:/^\d{2}:\d{2}$/.test(raw?.startTime||"")?raw.startTime:"17:00",endTime:/^\d{2}:\d{2}$/.test(raw?.endTime||"")?raw.endTime:"18:00",
    weekdays,active:raw?.active!==false,manualStart:raw?.manualStart!==false,note:safeText(raw?.note||"",220),updatedAt:raw?.updatedAt||new Date().toISOString()};
}
function fillOfferProducts(){
  const node=el("offerProducts");if(!node)return;const selected=[...node.selectedOptions].map(o=>o.value);
  node.innerHTML=PRODUCTS.filter(p=>p.active!==false&&p.category!=="Pfand").map(p=>`<option value="${p.id}" ${selected.includes(p.id)?"selected":""}>${escapeHtml(p.name)} · ${money(p.price)}</option>`).join("");
}
function selectedOfferProductIds(){return [...(el("offerProducts")?.selectedOptions||[])].map(o=>o.value)}
function offerWeekdaysFromForm(){return [...document.querySelectorAll("[data-offer-weekday]:checked")].map(x=>Number(x.dataset.offerWeekday))}
function setOfferWeekdays(days){document.querySelectorAll("[data-offer-weekday]").forEach(x=>x.checked=(days||[]).includes(Number(x.dataset.offerWeekday)))}
function clearOfferForm(){
  el("offerId").value="";el("offerName").value="";el("offerType").value="offer";fillOfferProducts();[...el("offerProducts").options].forEach(o=>o.selected=false);
  el("offerPriceMode").value="percent";el("offerPriceValue").value="10";el("offerStartDate").value="";el("offerEndDate").value="";
  el("offerStartTime").value="17:00";el("offerEndTime").value="18:00";setOfferWeekdays([1,2,3,4,5,6,0]);el("offerActive").checked=true;
  el("offerManualStart").checked=true;el("offerNote").value="";updateOfferPreview();
}
function loadOffer(id){
  const offer=OFFERS.find(o=>o.id===id);if(!offer)return;fillOfferProducts();el("offerId").value=offer.id;el("offerName").value=offer.name;
  el("offerType").value=offer.type;[...el("offerProducts").options].forEach(o=>o.selected=(offer.productIds||[]).includes(o.value));
  el("offerPriceMode").value=offer.priceMode;el("offerPriceValue").value=offer.priceValue;el("offerStartDate").value=offer.startDate||"";
  el("offerEndDate").value=offer.endDate||"";el("offerStartTime").value=offer.startTime;el("offerEndTime").value=offer.endTime;
  setOfferWeekdays(offer.weekdays);el("offerActive").checked=offer.active!==false;el("offerManualStart").checked=offer.manualStart!==false;el("offerNote").value=offer.note||"";updateOfferPreview();
}
function updateOfferPreview(){
  const ids=selectedOfferProductIds(),mode=el("offerPriceMode")?.value,value=Number(el("offerPriceValue")?.value||0),type=el("offerType")?.value;
  const sample=PRODUCTS.find(p=>ids.includes(p.id)),price=sample?(mode==="fixed"?Math.min(sample.price,value):offerPrice(sample.price,{priceMode:mode,priceValue:value})):0;
  if(el("offerPreview"))el("offerPreview").textContent=sample?`${type==="happyhour"?"Happy Hour":"Angebot"}: ${sample.name} · ${money(sample.price)} → ${money(price)} · ${el("offerStartTime").value}–${el("offerEndTime").value}`:"Bitte mindestens einen Artikel auswählen.";
}
function saveOfferFromForm(){
  const ids=selectedOfferProductIds(),name=safeText(el("offerName").value,80),value=Number(el("offerPriceValue").value||0);
  if(!name||!ids.length)return showMessage("Aktion unvollständig","!","Bitte Name und mindestens einen Artikel auswählen.");
  if(value<=0)return showMessage("Preisregel unvollständig","!","Der Aktionswert muss größer als 0 sein.");
  if(minuteOfDay(el("offerStartTime").value)===minuteOfDay(el("offerEndTime").value))return showMessage("Zeit nicht gültig","!","Beginn und Ende dürfen nicht identisch sein.");
  const id=el("offerId").value||`OFFER-${Date.now()}`,existing=OFFERS.findIndex(o=>o.id===id),before=existing>=0?cloneData(OFFERS[existing]):null;
  const offer=sanitizeOffer({id,name,type:el("offerType").value,productIds:ids,priceMode:el("offerPriceMode").value,priceValue:value,
    startDate:el("offerStartDate").value,endDate:el("offerEndDate").value,startTime:el("offerStartTime").value,endTime:el("offerEndTime").value,
    weekdays:offerWeekdaysFromForm(),active:el("offerActive").checked,manualStart:el("offerManualStart").checked,note:el("offerNote").value,updatedAt:new Date().toISOString()});
  if(existing>=0)OFFERS[existing]=offer;else OFFERS.push(offer);saveOffers();renderOfferTable();renderOfferRuntime();renderCategories();renderProducts();loadOffer(offer.id);
  recordAdminChange("offer",before?"update":"create",offer.id,before,offer);setSystemHint("Preisaktion im Manager gespeichert");
}
function offerRuleText(o){return o.priceMode==="fixed"?`${money(o.priceValue)} Aktionspreis`:`${Number(o.priceValue).toLocaleString("de-DE")} % günstiger`}
function renderOfferTable(){
  const body=el("offerTableBody");if(!body)return;body.innerHTML=OFFERS.map(o=>`<tr data-offer-id="${o.id}"><td><strong>${escapeHtml(o.name)}</strong></td>
    <td>${o.type==="happyhour"?"⏰ Happy Hour":"🏷 Angebot"}</td><td>${(o.productIds||[]).length}</td><td>${offerRuleText(o)}</td>
    <td>${o.startTime}–${o.endTime}</td><td>${activeOffers().some(a=>a.id===o.id)?"Aktiv":o.active!==false?"Geplant":"Inaktiv"}</td></tr>`).join("");
  body.querySelectorAll("tr").forEach(row=>row.onclick=()=>loadOffer(row.dataset.offerId));
}
function nextOfferCandidate(now=new Date()){
  return OFFERS.filter(o=>o.active!==false&&offerDateAllowed(o,now)).sort((a,b)=>minuteOfDay(a.startTime)-minuteOfDay(b.startTime))[0]||null;
}
function manualOfferEndDate(offer,now=new Date()){
  const end=new Date(now);const endMinute=minuteOfDay(offer.endTime),current=now.getHours()*60+now.getMinutes();
  end.setHours(Math.floor(endMinute/60),endMinute%60,0,0);if(endMinute<=current)end.setDate(end.getDate()+1);return end;
}
function startOfferNow(id,source="manager"){
  const offer=OFFERS.find(o=>o.id===id);if(!offer||offer.active===false)return false;
  OFFER_OVERRIDES[id]={activeUntil:manualOfferEndDate(offer).toISOString(),startedAt:new Date().toISOString(),source};saveOfferOverrides();
  recordAdminChange("offer","manual-start",id,null,{activeUntil:OFFER_OVERRIDES[id].activeUntil,source});refreshOfferRuntime(true);return true;
}
function stopOfferNow(id,source="manager"){
  if(!OFFER_OVERRIDES[id]&&!scheduledOfferActive(OFFERS.find(o=>o.id===id)||{}))return false;
  OFFER_OVERRIDES[id]={activeUntil:new Date(0).toISOString(),stoppedAt:new Date().toISOString(),source};saveOfferOverrides();
  const offer=OFFERS.find(o=>o.id===id);if(offer){offer.active=false;saveOffers()}
  recordAdminChange("offer","manual-stop",id,null,{source});refreshOfferRuntime(true);return true;
}
function renderOfferRuntime(){
  const active=activeOffers(),next=nextOfferCandidate(),status=el("offerRuntimeStatus"),schedule=el("offerNextSchedule");
  if(status)status.textContent=active.length?`${active.length} Aktion(en) aktiv`:"Keine aktive Aktion";
  if(schedule)schedule.innerHTML=active.length?active.map(o=>`<b>${escapeHtml(o.name)}</b> · ${o.startTime}–${o.endTime}`).join("<br>"):
    next?`Nächste freigegebene Aktion: <b>${escapeHtml(next.name)}</b><br>${next.startTime}–${next.endTime}`:"Noch keine Aktion geplant.";
  renderOfferTable();
}
function refreshOfferRuntime(force=false){
  const active=activeOffers(),signature=active.map(o=>o.id).sort().join("|");
  if(force||signature!==lastOfferRuntimeSignature){
    lastOfferRuntimeSignature=signature;ensureActiveCategory();renderCategories();renderProducts();renderOfferRuntime();
    if(active.length)setSystemHint(`${active.map(o=>o.name).join(", ")} aktiv`);else setSystemHint("Normalpreise aktiv");
  }
  const quick=el("happyHourQuickBtn"),candidate=active.find(o=>o.type==="happyhour")||OFFERS.find(o=>o.type==="happyhour"&&o.active!==false&&o.manualStart!==false&&offerDateAllowed(o));
  if(quick){
    quick.hidden=!candidate;quick.classList.toggle("active",!!active.find(o=>o.id===candidate?.id));
    if(candidate)el("happyHourQuickText").textContent=active.find(o=>o.id===candidate.id)?`Happy Hour aktiv bis ${candidate.endTime}`:`Happy Hour heute ${candidate.startTime}–${candidate.endTime}`;
    quick.dataset.offerId=candidate?.id||"";
  }
}
function initializeOfferCore(){OFFERS=OFFERS.map(sanitizeOffer);saveOffers();fillOfferProducts();renderOfferTable();refreshOfferRuntime(true)}
el("offerNewBtn")?.addEventListener("click",clearOfferForm);
el("offerSaveBtn")?.addEventListener("click",saveOfferFromForm);
el("offerDeleteBtn")?.addEventListener("click",()=>{const id=el("offerId").value;if(!id)return;const before=OFFERS.find(o=>o.id===id);OFFERS=OFFERS.filter(o=>o.id!==id);delete OFFER_OVERRIDES[id];saveOffers();saveOfferOverrides();clearOfferForm();refreshOfferRuntime(true);recordAdminChange("offer","delete",id,before,null)});
el("offerStartNowBtn")?.addEventListener("click",()=>{const id=el("offerId").value;if(!id)return showMessage("Keine Aktion gewählt","!","Bitte zuerst eine Aktion aus der Liste wählen.");startOfferNow(id,"manager")});
el("offerStopNowBtn")?.addEventListener("click",()=>{const id=el("offerId").value;if(!id)return showMessage("Keine Aktion gewählt","!","Bitte zuerst eine Aktion aus der Liste wählen.");stopOfferNow(id,"manager")});
el("happyHourQuickBtn")?.addEventListener("click",()=>{const id=el("happyHourQuickBtn").dataset.offerId,offer=OFFERS.find(o=>o.id===id);if(!offer)return;
  if(activeOffers().some(o=>o.id===id))return showMessage("Happy Hour läuft","⏰",`${offer.name} ist bereits bis ${offer.endTime} aktiv.`);
  if(!offer.manualStart)return showMessage("Start gesperrt","🔒","Diese Aktion darf nur automatisch oder im Manager gestartet werden.");
  startOfferNow(id,"cashier-button");notify("success",`${offer.name} bis ${offer.endTime} gestartet`,"happy-hour-start",2600);
});
["offerType","offerProducts","offerPriceMode","offerPriceValue","offerStartTime","offerEndTime"].forEach(id=>el(id)?.addEventListener("change",updateOfferPreview));

document.querySelectorAll("[data-transfer-tab]").forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll("[data-transfer-tab]").forEach(x=>x.classList.toggle("active",x===btn));
  document.querySelectorAll("[data-transfer-panel]").forEach(x=>x.classList.toggle("active",x.dataset.transferPanel===btn.dataset.transferTab));
});
document.querySelectorAll("[data-export]").forEach(btn=>btn.onclick=()=>{
  const cmd=btn.dataset.export;
  let report=cmd.startsWith("articles")?getArticleExportRows():cmd.startsWith("groups")?getGroupExportRows():buildSalesReport();
  if(cmd.endsWith("-csv"))downloadText(`${report.title}.csv`,rowsToCsv(report.headers,report.rows),"text/csv;charset=utf-8");
  if(cmd.endsWith("-xls"))downloadText(`${report.title}.xls`,rowsToExcelHtml(report.title,report.headers,report.rows),"application/vnd.ms-excel");
  if(cmd.endsWith("-print"))printReport(report);
});
el("previewSalesReport").onclick=renderReportPreview;
["salesDateMode","salesDateSingle","salesDateFrom","salesDateTo","salesGroupFilter","salesReportType"].forEach(id=>el(id).addEventListener("change",renderReportPreview));
el("exportConfigPackage").onclick=async()=>{
  if(!secureAuthOk())return showMessage("Nicht erlaubt","!","Bitte zuerst als Superadmin anmelden.");
  const password=prompt("Passwort für verschlüsselte Konfigurationsdatei:");
  if(!password)return;
  const pkg=await buildConfigPackage(el("configIncludeImages").checked);
  const encrypted=await encryptObject(pkg,password);
  downloadText(`${state.master.registerId}_${state.master.eventName.replace(/\s+/g,"_")}.kcpos`,JSON.stringify(encrypted),"application/octet-stream");
};

el("exportEncryptedSales").onclick=async()=>{
  if(!secureAuthOk())return showMessage("Nicht erlaubt","!","Bitte zuerst als Superadmin anmelden.");
  const password=el("salesExportPassword").value;if(!password)return showMessage("Passwort fehlt","!","Bitte Dateipasswort eingeben.");
  const payload={format:"KC_SALES_EXPORT",version:4,createdAt:new Date().toISOString(),registerId:state.master.registerId||"KASSE-01",registerName:state.master.registerName||"Kasse 1",transactions:readTransactions(),tips:tipRecords(),withdrawals:safeArray(WITHDRAWAL_KEY),discountAudit:safeArray("kc_discount_audit_v020")};
  const encrypted=await encryptObject(payload,password);
  downloadText(`${payload.registerId}_Umsaetze_${new Date().toISOString().slice(0,10)}.kcsales`,JSON.stringify(encrypted),"application/octet-stream");
};


const POS_EXCHANGE_USED_KEY="kc_pos_exchange_used";
function posExchangeChecksumPayload(pkg){const c=JSON.parse(JSON.stringify(pkg));delete c.checksum;delete c.signature;return JSON.stringify(c)}
function posExchangeChecksum(text){let h1=0x811c9dc5,h2=0x9e3779b9;for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);h1^=c;h1=Math.imul(h1,0x01000193);h2^=(c+i);h2=Math.imul(h2,0x85ebca6b)}return `${(h1>>>0).toString(16).padStart(8,"0")}${(h2>>>0).toString(16).padStart(8,"0")}`}
function buildPosExchangeSales(){
  const pkg={format:"KC_EXCHANGE_PACKAGE",schemaVersion:"1.0",packageId:crypto.randomUUID(),
    packageType:"sales",sourceSystem:"KC_MARKTKASSE_POS",sourceVersion:VERSION,
    targetSystem:"KC_MARKTKASSE_MANAGER",clubId:"KC-WERNE",eventId:state.master.eventName||"WM-2026",
    createdAt:new Date().toISOString(),data:{sales:readTransactions(),trainingSales:readTrainingTransactions(),tips:tipRecords(),withdrawals:safeArray(WITHDRAWAL_KEY),discountAudit:safeArray("kc_discount_audit_v020"),
      cashMovements:JSON.parse(localStorage.getItem("kc_cash_movements")||"[]"),
      closings:JSON.parse(localStorage.getItem("kc_closings")||"[]")},
    attachments:[],checksum:"",signature:null,encryption:null};
  pkg.checksum=posExchangeChecksum(posExchangeChecksumPayload(pkg));return pkg;
}
function buildPosAdminChangeSet(){
  const changes=adminChanges(),changedGroupIds=new Set(),changedArticleIds=new Set(),settingsChanged=changes.some(change=>change.entity==="settings"),displayProfileChanged=changes.some(change=>change.entity==="display-profile");
  changes.forEach(change=>{
    if(change.entity==="group")changedGroupIds.add(change.entityId);
    if(change.entity==="article")changedArticleIds.add(change.entityId);
  });
  const pkg={format:"KC_EXCHANGE_PACKAGE",schemaVersion:"1.0",packageId:crypto.randomUUID(),
    packageType:"changeset",sourceSystem:"KC_MARKTKASSE_POS",sourceVersion:VERSION,
    targetSystem:"KC_MARKTKASSE_MANAGER",clubId:"KC-WERNE",eventId:state.master.eventName||"WM-2026",
    createdAt:new Date().toISOString(),data:{
      changes:cloneData(changes),audit:cloneData(adminAudit()),
      groups:GROUPS.filter(group=>changedGroupIds.has(group.id)).map(cloneData),
      articles:PRODUCTS.filter(article=>changedArticleIds.has(article.id)).map(cloneData),
      posSettings:settingsChanged?cloneData(state.master):null,
      posDisplayProfile:displayProfileChanged?cloneData(displayProfile):null
    },attachments:[],checksum:"",signature:null,encryption:null};
  pkg.checksum=posExchangeChecksum(posExchangeChecksumPayload(pkg));return pkg;
}
function validatePosExchange(pkg){
  const errors=[];if(pkg?.format!=="KC_EXCHANGE_PACKAGE")errors.push("Paketformat ungültig");
  if(pkg?.schemaVersion!=="1.0")errors.push("Schema nicht unterstützt");
  if(posExchangeChecksum(posExchangeChecksumPayload(pkg))!==pkg?.checksum)errors.push("Prüfsumme falsch");
  const used=JSON.parse(localStorage.getItem(POS_EXCHANGE_USED_KEY)||"[]");
  if(used.includes(pkg?.packageId))errors.push("Paket bereits importiert");
  return errors;
}
el("exportKCExchangeSales").onclick=()=>{
  const pkg=buildPosExchangeSales();
  downloadText(`${state.master.registerId}_Umsatz_${pkg.packageId.slice(0,8)}.kcsales`,JSON.stringify(pkg,null,2),"application/json");
  el("kcExchangePosStatus").textContent=`Exportiert: ${pkg.packageId}`;
};
el("exportAdminChanges").onclick=()=>{
  if(!adminChanges().length)return showMessage("Keine Änderungen","✓","Es liegen keine Vor-Ort-Änderungen für den PC-Manager vor.");
  appendAdminAudit("changeset-export","success",{message:`${adminChanges().length} Änderung(en)`});
  const pkg=buildPosAdminChangeSet();
  exportJson(`${state.master.registerId}_Aenderungen_${new Date().toISOString().slice(0,10)}_${pkg.packageId.slice(0,8)}.kcchanges`,pkg);
  el("adminChangeCount").textContent=`${adminChanges().length} Änderung(en) exportiert · Paket ${pkg.packageId.slice(0,8)}`;
};
el("selectKCExchangeImport").onclick=()=>el("importKCExchangeFile").click();
el("importKCExchangeFile").onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  try{
    const pkg=JSON.parse(await f.text()),errors=validatePosExchange(pkg);
    if(errors.length)throw new Error(errors.join(" · "));
    if(!["config","bundle"].includes(pkg.packageType))throw new Error("Nur Konfigurations- oder Gesamtpakete erlaubt");
    const c=pkg.packageType==="bundle"?(pkg.data.config||{}):pkg.data;
    if(c.groups)GROUPS=c.groups.map(sanitizeGroup);if(c.articles)PRODUCTS=c.articles.map(sanitizeProduct);if(c.packages)PACKAGES=c.packages.map(sanitizePackage);if(c.offers)OFFERS=c.offers.map(sanitizeOffer);
    if(c.settings)state.master={...state.master,...c.settings};
    if(c.receipt)state.master.receipt={...state.master.receipt,...c.receipt};
    saveGroups();saveProducts();savePackages();saveOffers();saveMaster();
    const used=JSON.parse(localStorage.getItem(POS_EXCHANGE_USED_KEY)||"[]");used.push(pkg.packageId);
    localStorage.setItem(POS_EXCHANGE_USED_KEY,JSON.stringify(used));
    renderHeader();renderCategories();renderProducts();renderCart();
    el("kcExchangePosStatus").textContent=`Importiert: ${pkg.packageId}`;
  }catch(err){el("kcExchangePosStatus").textContent=`Abgelehnt: ${err.message}`}
  e.target.value="";
};

el("exportFullBackup").onclick=async()=>{
  const pkg=await buildConfigPackage(true);
  const backup={format:"KC_MARKTKASSE_BACKUP",formatVersion:4,createdAt:new Date().toISOString(),config:pkg,transactions:readTransactions(),trainingTransactions:readTrainingTransactions(),voids:safeArray("kc_voids_v040"),withdrawals:safeArray(WITHDRAWAL_KEY),discountAudit:safeArray("kc_discount_audit_v020"),closings:safeArray(CLOSING_KEY)};
  backup.checksum=await sha256Hex(JSON.stringify(backup));
  downloadText(`KC_MarktKasse_Backup_${new Date().toISOString().slice(0,10)}.kcbak`,JSON.stringify(backup,null,2),"application/json");
};
el("selectConfigImport").onclick=()=>el("configImportFile").click();
el("configImportFile").addEventListener("change",async e=>{
  const f=e.target.files[0];if(!f)return;
  try{
    let raw=JSON.parse((await f.text()).replace(/^\uFEFF/,""));
    if(raw?.format==="KC_ENCRYPTED_V1"){
      const password=el("configImportPassword").value;
      if(!password)throw new Error("Dateipasswort fehlt");
      try{raw=await decryptObject(raw,password)}catch{throw new Error("Dateipasswort falsch oder Datei beschädigt")}
    }
    const pkg=normalizeIncomingConfig(raw),errors=validateConfig(pkg);
    if(errors.length)throw new Error(errors.join(", "));
    pendingConfigImport=pkg;
    el("configImportSummary").innerHTML=`<strong>${f.name}</strong><br>${pkg.groups.length} Warengruppen · ${pkg.products.length} Artikel · Version ${pkg.appVersion||"unbekannt"}`;
    el("applyConfigImport").disabled=false;
    appendAdminAudit("config-check","success",{message:f.name});
  }catch(err){
    pendingConfigImport=null;el("configImportSummary").textContent=`Fehler: ${err.message}`;el("applyConfigImport").disabled=true;
    appendAdminAudit("config-check","rejected",{message:`${f.name}: ${err.message}`});
  }
  e.target.value="";
});
el("applyConfigImport").onclick=()=>{
  if(!pendingConfigImport)return;
  askConfirm("Konfiguration übernehmen","Aktuelle Artikel, Preise, Warengruppen und Einstellungen werden ersetzt.",()=>{
    applyConfig(pendingConfigImport);appendAdminAudit("config-import","success");pendingConfigImport=null;el("applyConfigImport").disabled=true;
    el("configImportSummary").textContent="Konfiguration erfolgreich übernommen.";
  });
};
el("selectBackupImport").onclick=()=>el("backupImportFile").click();
el("backupImportFile").addEventListener("change",e=>{
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();r.onload=async()=>{
    try{
      const b=JSON.parse(r.result);if(b.format!=="KC_MARKTKASSE_BACKUP")throw new Error("Ungültiges Backup");
      if(b.formatVersion>=3){const copy=cloneData(b),supplied=copy.checksum;delete copy.checksum;if(!supplied||await sha256Hex(JSON.stringify(copy))!==supplied)throw new Error("Backup-Prüfsumme stimmt nicht")}
      const configErrors=validateConfig(b.config);if(configErrors.length)throw new Error(configErrors.join(" · "));
      if(!Array.isArray(b.transactions)||!Array.isArray(b.trainingTransactions||[]))throw new Error("Transaktionsdaten fehlen");
      pendingBackupImport=b;el("applyBackupImport").disabled=false;
    }catch(err){pendingBackupImport=null;showMessage("Backup ungültig","!",err.message)}
  };r.readAsText(f);
});
el("applyBackupImport").onclick=()=>{
  if(!pendingBackupImport||state.role!=="superadmin")return showMessage("Nicht erlaubt","!","Backup-Wiederherstellung benötigt Superadminrechte.");
  askConfirm("Backup wiederherstellen","Alle aktuellen lokalen Daten werden ersetzt.",()=>{
    applyConfig(pendingBackupImport.config);
    saveTransactions(pendingBackupImport.transactions||[]);
    saveTransactions(pendingBackupImport.trainingTransactions||[],true);
    localStorage.setItem("kc_voids_v040",JSON.stringify(pendingBackupImport.voids||[]));
    localStorage.setItem(WITHDRAWAL_KEY,JSON.stringify(pendingBackupImport.withdrawals||[]));
    localStorage.setItem("kc_discount_audit_v020",JSON.stringify(pendingBackupImport.discountAudit||[]));
    localStorage.setItem(CLOSING_KEY,JSON.stringify(pendingBackupImport.closings||[]));
    pendingBackupImport=null;el("applyBackupImport").disabled=true;
    showMessage("Backup wiederhergestellt","✓","Die lokalen Daten wurden vollständig ersetzt.");
  });
};


function allTransactions(){return readTransactions()}
function renderRecentBons(){
  const tx=allTransactions().slice(-5).reverse();
  el("recentBons").innerHTML=tx.map(t=>`<div class="recent-bon"><span>Bon ${String(t.bon||t.bonNumber||"").padStart(6,"0")} · ${money(t.due||t.total||0)}</span><button type="button" data-print-bon="${t.bon||t.bonNumber}">Drucken</button>${t.type!=="reversal"?`<button type="button" class="superadmin-only" data-reverse-bon="${t.bon||t.bonNumber}">Stornieren</button>`:""}</div>`).join("")||"<p>Keine Bons vorhanden.</p>";
  el("recentBons").querySelectorAll("[data-print-bon]").forEach(b=>b.onclick=()=>printBonByNumber(b.dataset.printBon));
  el("recentBons").querySelectorAll("[data-reverse-bon]").forEach(b=>b.onclick=()=>requestCompletedReversal(b.dataset.reverseBon));
}
function printBonByNumber(no){
  const t=allTransactions().find(x=>String(x.bon||x.bonNumber)===String(no));
  if(!t)return showMessage("Bon nicht gefunden","!",`Bon ${no} wurde nicht gefunden.`);

  const r=state.master.receipt||{};
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const items=(t.items||[]).filter(item=>!item.discountLine&&item.id!=="DISCOUNT");
  const normalRows=items.map(item=>{
    const qty=Number(item.qty||0);
    const line=Number(item.lineTotal??Number(item.price||0)*qty);
    return `<tr><td class="qty">${esc(qty)}×</td><td class="name">${esc(item.name||"Artikel")}</td><td class="sum">${money(line)}</td></tr>`;
  }).join("");
  const discountRows=(t.items||[]).filter(item=>item.discountLine).map(item=>
    `<tr class="discount"><td></td><td>${esc(item.name||"Rabatt")}</td><td class="sum">${money(Number(item.lineTotal??item.price??0))}</td></tr>`
  ).join("");

  const gross=Number(t.grossDue??t.total??t.due??0);
  const discount=Number(t.discount?.amount||0);
  const due=Number(t.due??t.total??0);
  const given=Number(t.given||0);
  const change=Number(t.change||0);
  const date=new Date(t.time||t.endTime||Date.now());

  const page=`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Bon ${esc(t.bon||t.bonNumber)}</title>
  <style>
    @page{size:80mm auto;margin:3mm 4mm 4mm}
    *{box-sizing:border-box}
    html,body{width:72mm;max-width:72mm;margin:0;padding:0;background:#fff;color:#000}
    body{font-family:"Courier New",monospace;font-size:10pt;line-height:1.22}
    .bon{width:72mm;max-width:72mm}
    header{text-align:center;margin-bottom:2.5mm}
    h1{font-size:14pt;margin:0} h2{font-size:11pt;margin:1mm 0 0}
    .meta{font-size:8.8pt;margin:2mm 0}
    .rule{border-top:1px dashed #000;margin:2mm 0}
    table{width:100%;border-collapse:collapse;table-layout:fixed}
    td{padding:.7mm 0;vertical-align:top}
    .qty{width:10mm}.name{padding-right:2mm;overflow-wrap:anywhere}.sum{width:22mm;text-align:right;white-space:nowrap}
    .discount td{font-size:8.8pt}
    .line{display:flex;justify-content:space-between;gap:3mm;margin:.7mm 0}
    .total strong{font-size:13pt}
    footer{text-align:center;margin-top:4mm;font-size:9pt}
    @media screen{body{margin:8px auto;border:1px solid #ccc;padding:4mm;box-shadow:0 2px 12px #0002}}
    @media print{html,body{width:72mm!important;max-width:72mm!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important}}
  </style></head><body><main class="bon">
    <header>${r.header!==false?`<h1>${esc(r.head1||state.master.clubName)}</h1><h2>${esc(r.head2||state.master.eventName)}</h2>`:""}</header>
    <section class="meta">
      <div>${esc(state.master.registerName)} · Bon ${esc(t.bon||t.bonNumber)}</div>
      <div>${date.toLocaleDateString("de-DE")} · ${date.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})}</div>
      <div>Bediener: ${esc(t.operator||state.master.operatorName)}</div>
    </section>
    <div class="rule"></div>
    <table><tbody>${normalRows}${discountRows}</tbody></table>
    <div class="rule"></div>
    ${discount>0?`<div class="line"><span>Zwischensumme</span><span>${money(gross)}</span></div><div class="line"><span>Rabatt</span><span>− ${money(discount)}</span></div>`:""}
    <div class="line total"><strong>SUMME</strong><strong>${money(due)}</strong></div>
    <div class="line"><span>Zahlart</span><span>${esc(String(t.method||t.payment||"DIREKT").toUpperCase())}</span></div>
    ${given>0?`<div class="line"><span>Gegeben</span><span>${money(given)}</span></div>`:""}
    ${change>0?`<div class="line"><span>Rückgeld</span><span>${money(change)}</span></div>`:""}
    ${t.type==="refund"?`<div class="rule"></div><strong>REKLAMATION: ${esc(t.complaint?.reason||t.reason||"")}</strong>`:""}
    <footer>${esc(r.foot1||"Vielen Dank!")}</footer>
  </main><script>window.onload=()=>setTimeout(()=>window.print(),120)<\/script></body></html>`;

  const w=window.open("","_blank","width=420,height=760");
  if(!w)return setSystemHint("Bondruck wurde vom Browser blockiert","warn");
  w.document.open();w.document.write(page);w.document.close();
}
el("productInfoDetailsBtn").onclick=openFullProductInfo;

el("printBonBtn").onclick=()=>{renderRecentBons();el("bonSearchResult").innerHTML="";el("bonPrintDialog").showModal()};
el("bonSearchBtn").onclick=()=>{const n=el("bonSearchInput").value.trim(),t=allTransactions().find(x=>String(x.bon||x.bonNumber).padStart(6,"0")===n.padStart(6,"0"));el("bonSearchResult").innerHTML=t?`<div class="recent-bon"><span>Bon ${n.padStart(6,"0")} · ${money(t.due||t.total||0)}</span><button type="button" id="printFoundBon">Drucken</button>${t.type!=="reversal"?'<button type="button" id="reverseFoundBon" class="superadmin-only">Stornieren</button>':""}</div>`:"<p>Bon nicht gefunden.</p>";if(t){el("printFoundBon").onclick=()=>printBonByNumber(t.bon||t.bonNumber);if(el("reverseFoundBon"))el("reverseFoundBon").onclick=()=>requestCompletedReversal(t.bon||t.bonNumber)}};
async function reverseCompletedTransaction(original,reason){
  const rows=readTransactions();if(rows.some(row=>row.type==="reversal"&&row.originalTransactionId===original.transactionId))throw new Error("Dieser Bon wurde bereits vollständig storniert.");
  const current=bonText(),endTime=new Date().toISOString(),previousHash=rows[rows.length-1]?.recordHash||null,due=-Math.abs(Number(original.due??original.total??0));
  const rec={transactionId:crypto.randomUUID(),formatVersion:4,bon:current,bonNumber:current,startTime:endTime,time:endTime,endTime,registerId:state.master.registerId,registerName:state.master.registerName,operator:state.master.operatorName,type:"reversal",training:false,method:original.method||original.payment||"reversal",payment:original.payment||original.method||"reversal",due,total:due,dueCents:toCents(due),given:0,givenCents:0,change:0,changeCents:0,depositRule:original.depositRule,items:(original.items||[]).map(item=>({...cloneData(item),qty:-Math.abs(Number(item.qty||0)),lineTotal:-Math.abs(Number(item.lineTotal??Number(item.price||0)*Number(item.qty||0)))})),originalTransactionId:original.transactionId,originalBon:original.bon||original.bonNumber,reason:safeText(reason,300),previousHash};
  rec.recordHash=await sha256Hex(canonicalTransaction(rec));rows.push(rec);saveTransactions(rows);state.master.nextBon++;saveMaster();recordAdminChange("transaction","reversal",rec.transactionId,original,rec);renderHeader();return rec;
}
function requestCompletedReversal(no){
  if(state.role!=="superadmin"||!adminSession)return showMessage("Nicht erlaubt","!","Gebuchte Bons dürfen nur im Superadmin-Bereich storniert werden.");
  const original=allTransactions().find(row=>String(row.bon||row.bonNumber)===String(no));if(!original)return showMessage("Bon nicht gefunden","!",String(no));
  const reason=prompt("Grund für die vollständige Stornierung:","Fehlbuchung");if(!reason)return;
  askConfirm("Gebuchten Bon stornieren",`Für Bon ${no} wird ein protokollierter Gegenbon über ${money(-Math.abs(Number(original.due??original.total??0)))} erzeugt.`,async()=>{try{const rec=await reverseCompletedTransaction(original,reason);el("bonPrintDialog").close();showMessage("Storno gebucht",money(rec.due),`Gegenbon ${rec.bon} wurde gespeichert.`)}catch(err){showMessage("Storno abgelehnt","!",err.message)}});
}
function decodeCashPayload(text){if(!text.startsWith("KCASH1:"))throw new Error("Ungültiger Bargeld-QR-Code");return JSON.parse(decodeURIComponent(escape(atob(text.slice(7)))))}
function localBusinessDate(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`}
function isBusinessDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||""))return false;const [y,m,d]=value.split("-").map(Number),date=new Date(y,m-1,d);return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d}
function displayBusinessDate(value){const [y,m,d]=String(value).split("-");return `${d}.${m}.${y}`}
function cashBreakdownTotal(breakdown){
  if(!breakdown||typeof breakdown!=="object"||Array.isArray(breakdown))throw new Error("Stückelungsdaten fehlen");
  let total=0;
  for(const [rawValue,rawCount] of Object.entries(breakdown)){
    const value=Number(rawValue),count=Number(rawCount);
    if(!Number.isFinite(value)||value<=0||!Number.isInteger(count)||count<0)throw new Error("Stückelungsdaten sind ungültig");
    total+=value*count;
  }
  return +total.toFixed(2);
}
function cashMovementDate(row){
  if(isBusinessDate(row?.effectiveDate))return row.effectiveDate;
  const fallback=new Date(row?.importedAt||row?.time||"");
  return Number.isNaN(fallback.getTime())?null:localBusinessDate(fallback);
}
function legacyTransferFingerprint(p){
  const stable=JSON.stringify({
    registerId:p.registerId,
    type:p.type,
    time:p.time,
    breakdown:p.breakdown,
    total:p.total,
    note:p.note||""
  });
  let h=2166136261;
  for(let i=0;i<stable.length;i++){h^=stable.charCodeAt(i);h=Math.imul(h,16777619)}
  return "LEGACY-"+(h>>>0).toString(16).padStart(8,"0");
}
function cashTransferKey(p){
  return p.transferId||legacyTransferFingerprint(p);
}
function recordCashImportAttempt(entry){
  const audit=JSON.parse(localStorage.getItem("kc_cash_import_audit")||"[]");
  audit.push(entry);
  localStorage.setItem("kc_cash_import_audit",JSON.stringify(audit));
}
function applyCashPayload(text,source="unknown"){
  const p=decodeCashPayload(text);
  if(p?.format!=="KC_CASH_TRANSFER")throw new Error("Der Code ist keine Bargeldübergabe");
  if(!p.checksum||checksumObject(p)!==p.checksum)throw new Error("Prüfsumme falsch – Code beschädigt oder verändert");
  if(!["opening","topup"].includes(p.type))throw new Error("Ungültige Vorgangsart für eine Bargeldübergabe");
  if(!p.transferId)throw new Error("Übergabe-ID fehlt – Code nicht übernehmen");
  if(!Number.isFinite(Number(p.total))||Number(p.total)<=0)throw new Error("Ungültiger Bargeldbetrag");
  let breakdownTotal;
  try{breakdownTotal=cashBreakdownTotal(p.breakdown)}catch(err){throw new Error(`${err.message} – Code nicht übernehmen`)}
  if(Math.abs(breakdownTotal-Number(p.total))>.009)throw new Error(`Stückelung ${money(breakdownTotal)} und Gesamtbetrag ${money(Number(p.total))} stimmen nicht überein`);
  if(Number.isFinite(Number(p.looseTotal))&&Number.isFinite(Number(p.rollTotal))&&Math.abs((Number(p.looseTotal)+Number(p.rollTotal))-Number(p.total))>.009)throw new Error("Lose Stückelung, Rollengeld und Gesamtbetrag stimmen nicht überein");
  if(!isBusinessDate(p.effectiveDate)){
    recordCashImportAttempt({time:new Date().toISOString(),result:"rejected-missing-effective-date",source,transferId:p.transferId||null,registerId:p.registerId||null});
    throw new Error("Einsatzdatum fehlt oder ist ungültig – bitte einen neuen Übergabecode erzeugen");
  }
  const today=localBusinessDate();
  if(p.effectiveDate!==today){
    recordCashImportAttempt({time:new Date().toISOString(),result:"rejected-wrong-effective-date",source,transferId:p.transferId,registerId:p.registerId,effectiveDate:p.effectiveDate,expectedDate:today});
    throw new Error(`Dieser Code ist für den ${displayBusinessDate(p.effectiveDate)} vorgesehen. Heute ist der ${displayBusinessDate(today)}.`);
  }
  const sharedScope=p.scope==="shared"&&Array.isArray(p.registerIds);
  const registerAllowed=sharedScope?p.registerIds.includes(state.master.registerId):p.registerId===state.master.registerId;
  if(!registerAllowed){
    recordCashImportAttempt({
      time:new Date().toISOString(),
      result:"rejected-wrong-register",
      source,
      transferId:p.transferId||null,
      expectedRegister:state.master.registerId,
      suppliedRegister:sharedScope?p.registerIds:p.registerId
    });
    throw new Error(sharedScope?`Gemeinsamer Bestand ist nicht für ${state.master.registerId} freigegeben`:`QR-Code ist für ${p.registerId}, diese Kasse ist ${state.master.registerId}`);
  }

  const key=cashTransferKey(p);
  const used=JSON.parse(localStorage.getItem("kc_cash_used_transfers")||"[]");
  if(used.includes(key)){
    recordCashImportAttempt({
      time:new Date().toISOString(),
      result:"rejected-duplicate",
      source,
      transferId:key,
      registerId:p.registerId,
      total:p.total
    });
    throw new Error("Diese Bargeldübergabe wurde bereits eingelesen. Eine doppelte Buchung wurde verhindert.");
  }

  const movements=JSON.parse(localStorage.getItem("kc_cash_movements")||"[]");
  if(p.type==="opening"&&movements.some(row=>row.type==="opening"&&((p.scope==="shared"&&row.poolId===p.poolId)||(p.scope!=="shared"&&row.registerId===p.registerId))&&cashMovementDate(row)===p.effectiveDate)){
    recordCashImportAttempt({time:new Date().toISOString(),result:"rejected-second-opening",source,transferId:key,registerId:p.registerId,effectiveDate:p.effectiveDate,total:p.total});
    throw new Error(`Für ${displayBusinessDate(p.effectiveDate)} wurde bereits ein Anfangsbestand übernommen. Weiteres Wechselgeld bitte als Nachfüllung erzeugen.`);
  }
  movements.push({
    ...p,
    transferId:key,
    importSource:source,
    importedAt:new Date().toISOString()
  });
  localStorage.setItem("kc_cash_movements",JSON.stringify(movements));

  used.push(key);
  localStorage.setItem("kc_cash_used_transfers",JSON.stringify(used));

  recordCashImportAttempt({
    time:new Date().toISOString(),
    result:"accepted",
    source,
    transferId:key,
    registerId:p.registerId,
    total:p.total
  });
  return {...p,transferId:key};
}
el("applyCashDeposit").onclick=()=>{try{const p=applyCashPayload(el("cashDepositPayload").value.trim(),"manual-paste");el("cashDepositResult").textContent=`${p.type==="opening"?"Anfangsbestand":"Nachfüllung"} über ${money(p.total)} wurde für ${p.registerId} am ${displayBusinessDate(p.effectiveDate)} gespeichert.`}catch(err){el("cashDepositResult").textContent="Fehler: "+err.message}};

function payloadChecksum(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,"0")}
function checksumObject(value){const copy=cloneData(value);delete copy.checksum;return payloadChecksum(JSON.stringify(copy))}
function encodePayload(prefix,value){return prefix+btoa(unescape(encodeURIComponent(JSON.stringify(value))))}
function drawFinder(ctx,x,y,size){
  ctx.fillStyle="#000";ctx.fillRect(x,y,size,size);
  ctx.fillStyle="#fff";ctx.fillRect(x+size*.16,y+size*.16,size*.68,size*.68);
  ctx.fillStyle="#000";ctx.fillRect(x+size*.32,y+size*.32,size*.36,size*.36);
}
function drawQrFallback(canvas,text){
  const size=Math.max(116,Number(canvas.getAttribute("width")||116));
  canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext("2d");
  ctx.imageSmoothingEnabled=false;
  ctx.fillStyle="#fff";ctx.fillRect(0,0,size,size);
  const modules=29,quiet=3,cell=size/(modules+quiet*2);
  let seed=0;for(const ch of text)seed=(seed*31+ch.charCodeAt(0))>>>0;
  const dark=(r,c)=>{
    const v=((r*73+c*151+seed)^(r*c*17+seed>>>3))>>>0;
    return (v%7)<3;
  };
  ctx.fillStyle="#000";
  for(let r=0;r<modules;r++)for(let c=0;c<modules;c++){
    const inFinder=(r<8&&c<8)||(r<8&&c>modules-9)||(r>modules-9&&c<8);
    if(!inFinder&&dark(r,c))ctx.fillRect(Math.floor((c+quiet)*cell),Math.floor((r+quiet)*cell),Math.ceil(cell),Math.ceil(cell));
  }
  const fs=7*cell;
  drawFinder(ctx,quiet*cell,quiet*cell,fs);
  drawFinder(ctx,(quiet+modules-7)*cell,quiet*cell,fs);
  drawFinder(ctx,quiet*cell,(quiet+modules-7)*cell,fs);
}
function drawRealQr(canvas,text){
  if(!canvas)return;
  canvas.width=116;canvas.height=116;
  try{
    if(typeof qrcode!=="function")throw new Error("QR-Modul nicht geladen");
    const qr=qrcode(0,"M");qr.addData(text);qr.make();
    const ctx=canvas.getContext("2d"),modules=qr.getModuleCount(),quiet=4,cell=canvas.width/(modules+quiet*2);
    ctx.imageSmoothingEnabled=false;
    ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#000";
    for(let row=0;row<modules;row++)for(let col=0;col<modules;col++)if(qr.isDark(row,col))ctx.fillRect(Math.floor((col+quiet)*cell),Math.floor((row+quiet)*cell),Math.ceil(cell),Math.ceil(cell));
  }catch(err){
    console.warn("QR-Fallback wird verwendet",err);
    drawQrFallback(canvas,text);
  }
}
function closingSnapshot(){
  const prior=safeArray(CLOSING_KEY).filter(c=>c.registerId===state.master.registerId).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  const startAt=prior?.createdAt||null;
  const inRange=time=>!startAt||String(time)>startAt;
  const tx=readTransactions().filter(t=>(!t.registerId||t.registerId===state.master.registerId)&&inRange(t.time));
  const movements=safeArray("kc_cash_movements").filter(m=>m.registerId===state.master.registerId&&inRange(m.importedAt||m.time));
  const withdrawals=safeArray(WITHDRAWAL_KEY).filter(m=>m.registerId===state.master.registerId&&!m.training&&inRange(m.time));
  const tips=tipRecords().filter(t=>t.registerId===state.master.registerId&&!t.training&&inRange(t.time));
  const cashIn=movements.reduce((sum,m)=>sum+Number(m.total||0),0);
  const cashSales=tx.filter(t=>t.type!=="personal"&&String(t.method||t.payment).startsWith("cash")).reduce((sum,t)=>sum+Number(t.due??t.total??0),0);
  const cashTips=tips.reduce((sum,t)=>sum+Number(t.amount||0),0);
  const cashOut=withdrawals.reduce((sum,m)=>sum+Number(m.amount||0),0);
  return {startAt,tx,movements,withdrawals,tips,cashIn:+cashIn.toFixed(2),cashSales:+cashSales.toFixed(2),cashTips:+cashTips.toFixed(2),cashOut:+cashOut.toFixed(2),expectedCash:+(cashIn+cashSales+cashTips-cashOut).toFixed(2)};
}
function openClosingDialog(){
  const s=closingSnapshot();el("closingCashIn").textContent=money(s.cashIn);el("closingCashSales").textContent=money(s.cashSales);el("closingCashTips").textContent=money(s.cashTips);el("closingCashOut").textContent=money(s.cashOut);el("closingExpected").textContent=money(s.expectedCash);el("closingPayload").value="";el("closingQrCanvas").classList.remove("ready");el("closingDialog").showModal();
}
function createClosing(){
  const s=closingSnapshot(),createdAt=new Date().toISOString();
  const payload={format:"KC_CASH_CLOSING",version:3,closingId:crypto.randomUUID(),registerId:state.master.registerId,registerName:state.master.registerName,operator:state.master.operatorName,createdAt,periodStart:s.startAt,periodEnd:createdAt,cashIn:s.cashIn,cashSales:s.cashSales,cashTips:s.cashTips,cashOut:s.cashOut,expectedCash:s.expectedCash,transactionCount:s.tx.length,firstTransactionId:s.tx[0]?.transactionId||null,lastTransactionId:s.tx[s.tx.length-1]?.transactionId||null,note:el("closingNote").value.trim()};
  payload.checksum=checksumObject(payload);const code=encodePayload("KCLOSE1:",payload);
  const closings=safeArray(CLOSING_KEY);closings.push(payload);localStorage.setItem(CLOSING_KEY,JSON.stringify(closings));el("closingPayload").value=code;
  try{drawRealQr(el("closingQrCanvas"),code);el("closingQrCanvas").classList.add("ready")}catch(err){setSystemHint(`Abschluss gespeichert, QR nicht darstellbar: ${err.message}`,"warn")}
  setSystemHint(`Tagesabschluss ${payload.closingId.slice(0,8)} gespeichert`);return {payload,code};
}
el("createClosingCode").onclick=createClosing;
el("copyClosingCode").onclick=async()=>{const code=el("closingPayload").value;if(!code)return setSystemHint("Zuerst Abschlusscode erzeugen","warn");try{await navigator.clipboard.writeText(code);setSystemHint("Abschlusscode kopiert")}catch{setSystemHint("Kopieren nicht möglich – bitte Datei speichern","warn")}};
el("saveClosingFile").onclick=()=>{const code=el("closingPayload").value;if(!code)return setSystemHint("Zuerst Abschlusscode erzeugen","warn");downloadText(`${state.master.registerId}_Abschluss_${new Date().toISOString().slice(0,10)}.kcclosing`,code)};
el("printClosingCode").onclick=()=>{const code=el("closingPayload").value;if(!code)return setSystemHint("Zuerst Abschlusscode erzeugen","warn");const image=el("closingQrCanvas").toDataURL("image/png"),s=closingSnapshot(),w=window.open("","_blank");w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Tagesabschluss</title><style>body{font-family:Arial;max-width:720px;margin:30px auto}img{width:280px;image-rendering:pixelated}dl{display:grid;grid-template-columns:1fr auto;gap:8px}dt,dd{border-bottom:1px solid #ddd;padding:6px}dd{font-weight:bold}</style></head><body><h1>Tagesabschluss ${state.master.registerName}</h1><p>${new Date().toLocaleString("de-DE")}</p><dl><dt>Anfangsbestand + Nachfüllungen</dt><dd>${money(s.cashIn)}</dd><dt>Barverkäufe</dt><dd>${money(s.cashSales)}</dd><dt>Bar-Trinkgeld / Aufrundung</dt><dd>${money(s.cashTips)}</dd><dt>Entnahmen</dt><dd>${money(s.cashOut)}</dd><dt>Erwarteter Bestand</dt><dd>${money(s.expectedCash)}</dd></dl><img src="${image}" alt="Abschluss-QR"><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close()};

let withdrawalReason="",withdrawalReceiptAvailable=false,withdrawalReceiptAttachment=null,complaintReason="",complaintArticles=new Map(),complaintCategory="Alle";
function complaintProducts(){return PRODUCTS.filter(product=>isActiveRecord(product)&&product.category!=="Pfand"&&!product.manualDeposit&&Number(product.price||0)>0).sort((a,b)=>String(a.category).localeCompare(String(b.category),"de")||String(a.name).localeCompare(String(b.name),"de"))}
function complaintArticleTotal(){return fromCents([...complaintArticles.entries()].reduce((sum,[id,qty])=>{const product=PRODUCTS.find(item=>item.id===id);return sum+(product?toCents(Number(product.price||0)*qty):0)},0))}
function renderComplaintArticles(){
  const search=(el("complaintArticleSearch")?.value||"").trim().toLowerCase(),all=complaintProducts(),categories=["Alle",...new Set(all.map(product=>product.category))],filters=el("complaintCategoryFilters");
  if(filters){filters.innerHTML=categories.map(category=>`<button type="button" data-complaint-category="${escapeHtml(category)}" class="${category===complaintCategory?"active":""}">${escapeHtml(category)}</button>`).join("");filters.querySelectorAll("button").forEach(button=>button.onclick=()=>{complaintCategory=button.dataset.complaintCategory;renderComplaintArticles()})}
  const visible=all.filter(product=>(complaintCategory==="Alle"||product.category===complaintCategory)&&(!search||product.name.toLowerCase().includes(search)));
  el("complaintArticleList").innerHTML=visible.map(product=>{const qty=complaintArticles.get(product.id)||0;return `<div class="complaint-article-row ${qty?"selected":""}" data-complaint-article="${product.id}"><span><b>${product.name}</b><small>${product.category} · ${money(product.price)}</small></span><div class="complaint-qty"><button type="button" data-complaint-minus="${product.id}" aria-label="${product.name} Menge verringern">−</button><b>${qty}</b><button type="button" data-complaint-plus="${product.id}" aria-label="${product.name} Menge erhöhen">+</button></div></div>`}).join("")||'<p class="complaint-no-results">Keine passenden Artikel gefunden.</p>';
  el("complaintArticleList").querySelectorAll("[data-complaint-minus]").forEach(button=>button.onclick=()=>changeComplaintQuantity(button.dataset.complaintMinus,-1));
  el("complaintArticleList").querySelectorAll("[data-complaint-plus]").forEach(button=>button.onclick=()=>changeComplaintQuantity(button.dataset.complaintPlus,1));
  const amount=complaintArticleTotal();el("complaintArticleTotal").textContent=money(amount);if(withdrawalReason==="Reklamation")el("withdrawAmount").value=amount?amount.toFixed(2):""
}
function changeComplaintQuantity(id,delta){const next=Math.max(0,Math.min(99,(complaintArticles.get(id)||0)+delta));if(next)complaintArticles.set(id,next);else complaintArticles.delete(id);renderComplaintArticles()}
function resetComplaint(){complaintReason="";complaintArticles=new Map();complaintCategory="Alle";el("complaintPanel").hidden=true;el("complaintBonReference").value="";if(el("complaintArticleSearch"))el("complaintArticleSearch").value="";el("complaintArticleTotal").textContent=money(0);document.querySelectorAll("[data-complaint-reason]").forEach(button=>button.classList.remove("active"));renderComplaintArticles()}
function resetWithdrawalReceipt(){withdrawalReceiptAvailable=false;withdrawalReceiptAttachment=null;el("withdrawReceiptToggle").classList.remove("active");el("withdrawReceiptToggle").setAttribute("aria-pressed","false");el("withdrawReceiptToggle").textContent="☐ BON / QUITTUNG VORHANDEN";el("withdrawReceiptActions").hidden=true;el("withdrawReceiptFile").value="";el("withdrawReceiptStatus").textContent="Noch kein Beleg erfasst."}
function openWithdrawal(){el("withdrawAmount").value="";el("withdrawNote").value="";withdrawalReason="";document.querySelectorAll("[data-withdraw-reason]").forEach(button=>button.classList.remove("active"));resetComplaint();resetWithdrawalReceipt();el("withdrawDialog").showModal();setTimeout(()=>el("withdrawAmount").focus(),50)}
document.querySelectorAll("[data-withdraw-reason]").forEach(button=>button.onclick=()=>{withdrawalReason=button.dataset.withdrawReason;document.querySelectorAll("[data-withdraw-reason]").forEach(x=>x.classList.toggle("active",x===button));el("complaintPanel").hidden=withdrawalReason!=="Reklamation";if(withdrawalReason==="Reklamation"){renderComplaintArticles();el("withdrawAmount").value=complaintArticleTotal()?complaintArticleTotal().toFixed(2):""}});
document.querySelectorAll("[data-complaint-reason]").forEach(button=>button.onclick=()=>{complaintReason=complaintReason===button.dataset.complaintReason?"":button.dataset.complaintReason;document.querySelectorAll("[data-complaint-reason]").forEach(item=>item.classList.toggle("active",item.dataset.complaintReason===complaintReason))});
el("complaintArticleSearch").oninput=renderComplaintArticles;
el("complaintClearSelection").onclick=()=>{
  complaintArticles.clear();
  complaintReason="";
  document.querySelectorAll("[data-complaint-reason]").forEach(button=>button.classList.remove("active"));
  el("complaintArticleTotal").textContent=money(0);
  el("withdrawAmount").value="";
  renderComplaintArticles();
  setSystemHint("Reklamationsauswahl wurde geleert","ok");
};
el("withdrawReceiptToggle").onclick=()=>{withdrawalReceiptAvailable=!withdrawalReceiptAvailable;el("withdrawReceiptToggle").classList.toggle("active",withdrawalReceiptAvailable);el("withdrawReceiptToggle").setAttribute("aria-pressed",String(withdrawalReceiptAvailable));el("withdrawReceiptToggle").textContent=withdrawalReceiptAvailable?"☑ BON / QUITTUNG VORHANDEN":"☐ BON / QUITTUNG VORHANDEN";el("withdrawReceiptActions").hidden=!withdrawalReceiptAvailable;if(!withdrawalReceiptAvailable){withdrawalReceiptAttachment=null;el("withdrawReceiptFile").value="";el("withdrawReceiptStatus").textContent="Noch kein Beleg erfasst."}};
el("scanWithdrawalReceipt").onclick=()=>el("withdrawReceiptFile").click();
function fileAsDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("Beleg konnte nicht gelesen werden"));reader.readAsDataURL(file)})}
async function prepareWithdrawalReceipt(file){
  if(!file)return null;
  if(!/^image\//.test(file.type)&&file.type!=="application/pdf")throw new Error("Bitte Bild oder PDF auswählen");
  if(file.type==="application/pdf"){
    if(file.size>1200000)throw new Error("PDF ist zu groß; bitte unter 1,2 MB speichern");
    return{name:safeText(file.name,120),type:file.type,size:file.size,data:await fileAsDataUrl(file)};
  }
  const source=await fileAsDataUrl(file),image=new Image();
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error("Belegbild ist beschädigt"));image.src=source});
  const scale=Math.min(1,1280/Math.max(image.width,image.height)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);
  const data=canvas.toDataURL("image/jpeg",.78);if(data.length>1800000)throw new Error("Belegbild ist trotz Verkleinerung zu groß");
  return{name:safeText(file.name,120),type:"image/jpeg",size:Math.round(data.length*.75),data};
}
el("withdrawReceiptFile").onchange=async event=>{const file=event.target.files[0];if(!file)return;el("withdrawReceiptStatus").textContent="Beleg wird verarbeitet …";try{withdrawalReceiptAttachment=await prepareWithdrawalReceipt(file);withdrawalReceiptAvailable=true;el("withdrawReceiptStatus").textContent=`Erfasst: ${withdrawalReceiptAttachment.name}`;}catch(err){withdrawalReceiptAttachment=null;event.target.value="";el("withdrawReceiptStatus").textContent=`Fehler: ${err.message}`}};
async function recordComplaintRefund(amount){
  if(state.master.trainingMode)throw new Error("Reale Reklamationsauszahlungen sind im Testmodus gesperrt.");
  const selected=[...complaintArticles.entries()].filter(([,qty])=>qty>0).map(([id,qty])=>({product:PRODUCTS.find(item=>item.id===id),qty})).filter(item=>item.product);
  if(!selected.length)throw new Error("Bitte mindestens einen zurückgegebenen Artikel auswählen.");
  if(!complaintReason)throw new Error("Bitte einen Reklamationsgrund über die großen Tasten auswählen.");
  const articleTotal=fromCents(selected.reduce((sum,item)=>sum+toCents(Number(item.product.price||0)*item.qty),0)),adjustment=fromCents(toCents(amount)-toCents(articleTotal));
  const items=selected.map(({product,qty})=>({id:product.id,name:product.name,category:product.category,price:Number(product.price||0),qty:-qty,unitTotal:Number(product.price||0),lineTotal:fromCents(-toCents(Number(product.price||0)*qty)),refund:true}));
  if(toCents(adjustment)!==0)items.push({id:"REFUND-ADJUSTMENT",name:"Reklamationsausgleich",category:"Reklamation",price:adjustment,qty:-1,unitTotal:adjustment,lineTotal:-adjustment,refund:true});
  const rows=readTransactions(),current=bonText(),endTime=new Date().toISOString(),previousHash=rows[rows.length-1]?.recordHash||null,reference=safeText(el("complaintBonReference").value,40),original=reference?rows.find(row=>String(row.bon||row.bonNumber)===reference||row.transactionId===reference):null,due=-Math.abs(Number(amount));
  const rec={transactionId:crypto.randomUUID(),formatVersion:5,bon:current,bonNumber:current,startTime:endTime,time:endTime,endTime,registerId:state.master.registerId,registerName:state.master.registerName,operator:state.master.operatorName,type:"refund",training:false,method:"complaint-refund",payment:"complaint-refund",grossDue:due,grossDueCents:toCents(due),discount:{percent:0,amount:0,amountCents:0,base:0,reason:null,note:null},due,total:due,dueCents:toCents(due),given:0,givenCents:0,change:0,changeCents:0,depositRule:state.master.depositRule,items,reason:`Reklamation: ${complaintReason}`,complaint:{reason:complaintReason,reference:reference||null,articleTotal,adjustment,note:safeText(el("withdrawNote").value,300)},originalTransactionId:original?.transactionId||null,originalBon:original?.bon||original?.bonNumber||reference||null,previousHash};
  rec.recordHash=await sha256Hex(canonicalTransaction(rec));rows.push(rec);saveTransactions(rows);state.master.nextBon++;saveMaster();return rec;
}
function addComplaintToCurrentCart(amount){
  const selected=[...complaintArticles.entries()].filter(([,qty])=>qty>0).map(([id,qty])=>({product:PRODUCTS.find(item=>item.id===id),qty})).filter(item=>item.product);
  if(!selected.length)throw new Error("Bitte mindestens einen Rückgabeartikel auswählen.");
  const reference=safeText(el("complaintBonReference").value,40)||null,note=safeText(el("withdrawNote").value,300),articleTotal=complaintArticleTotal(),currentDue=total();
  if(toCents(amount)>toCents(currentDue))throw new Error(`Die Reklamation (${money(amount)}) ist höher als der aktuelle Zahlbetrag (${money(currentDue)}). Bitte als separate Reklamationsauszahlung buchen.`);
  selected.forEach(({product,qty})=>state.cart.push({key:`complaint:${product.id}:${crypto.randomUUID()}`,id:`REFUND-${product.id}`,name:`Reklamation · ${product.name}`,price:-Math.abs(Number(product.price||0)),category:"Reklamation",image:product.image,manualDeposit:false,qty,option:null,deposits:[],refund:true,lockedQuantity:true,complaint:{reason:complaintReason,reference,note,sourceProductId:product.id}}));
  const adjustment=fromCents(toCents(amount)-toCents(articleTotal));
  if(toCents(adjustment)!==0)state.cart.push({key:`complaint-adjustment:${crypto.randomUUID()}`,id:"REFUND-ADJUSTMENT",name:"Reklamationsausgleich",price:-adjustment,category:"Reklamation",image:"",manualDeposit:false,qty:1,option:null,deposits:[],refund:true,lockedQuantity:true,complaint:{reason:complaintReason,reference,note,adjustment:true}});
  state.selectedCartKey=state.cart.at(-1)?.key||null;renderCart();notify("success",`Reklamation − ${money(amount)} wurde vom Zahlbetrag abgezogen`,"complaint-in-cart",6000)
}
el("saveWithdrawal").onclick=async()=>{
  const saveButton=el("saveWithdrawal");
  if(saveButton.disabled)return;
  if(!withdrawalReason)return setSystemHint("Bitte einen Entnahmegrund auswählen","warn");
  if(withdrawalReason==="Reklamation"){
    const selected=[...complaintArticles.entries()].filter(([,qty])=>qty>0);
    if(!selected.length)return setSystemHint("Bitte mindestens einen Rückgabeartikel und dessen Menge auswählen","warn");
    if(!complaintReason)return setSystemHint("Bitte einen Reklamationsgrund auswählen","warn");
  }
  const amount=Number(el("withdrawAmount").value);
  if(!Number.isFinite(amount)||amount<=0)return setSystemHint("Bitte einen gültigen Betrag eingeben","warn");
  saveButton.disabled=true;
  saveButton.textContent="WIRD GESPEICHERT …";
  try{
    if(withdrawalReason==="Reklamation"&&state.cart.some(item=>lineUnit(item)>0)){
      addComplaintToCurrentCart(+amount.toFixed(2));
      el("withdrawDialog").close();
      resetComplaint();
      return;
    }
    const complaintTransaction=withdrawalReason==="Reklamation"?await recordComplaintRefund(+amount.toFixed(2)):null;
    const rows=safeArray(WITHDRAWAL_KEY);
    const articleTotal=withdrawalReason==="Reklamation"?complaintArticleTotal():0;
    const record={
      withdrawalId:crypto.randomUUID(),time:new Date().toISOString(),
      registerId:state.master.registerId,registerName:state.master.registerName,
      operator:state.master.operatorName,amount:+amount.toFixed(2),amountCents:toCents(amount),
      reason:withdrawalReason,note:safeText(el("withdrawNote").value,500),
      receiptAvailable:withdrawalReceiptAvailable,receiptAttachment:withdrawalReceiptAttachment,
      training:!!state.master.trainingMode,
      complaint:withdrawalReason==="Reklamation"?{
        reason:complaintReason,reference:safeText(el("complaintBonReference").value,40)||null,
        articles:[...complaintArticles.entries()].map(([id,qty])=>{const product=PRODUCTS.find(item=>item.id===id);return{id,name:product?.name||id,qty,unitPrice:Number(product?.price||0),total:fromCents(toCents(Number(product?.price||0)*qty))}}),
        articleTotal,adjustment:fromCents(toCents(amount)-toCents(articleTotal)),
        refundTransactionId:complaintTransaction?.transactionId||null,refundBon:complaintTransaction?.bon||null
      }:null
    };
    rows.push(record);
    localStorage.setItem(WITHDRAWAL_KEY,JSON.stringify(rows));
    el("withdrawDialog").close();
    if(withdrawalReason==="Reklamation")resetComplaint();
    setSystemHint(`${money(record.amount)} ${record.reason==="Reklamation"?`Reklamationsauszahlung · ${record.complaint.reason}`:`Entnahme · ${record.reason}`} gespeichert`,"ok");
  }catch(err){
    console.error(err);
    setSystemHint(err?.message||"Entnahme konnte nicht gespeichert werden","error");
  }finally{
    saveButton.disabled=false;
    saveButton.textContent="ENTNAHME SPEICHERN";
  }
};


async function sha256Hex(text){
  const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function inspectLedger(rows,label){
  let previousHash=null,legacy=0;
  for(const row of rows){
    if(!row.recordHash){legacy++;continue}
    const expected=await sha256Hex(canonicalTransaction(row));
    if(expected!==row.recordHash)return {status:"fail",message:`${label}: Datensatz-Prüfsumme stimmt nicht.`};
    if(row.previousHash!==previousHash)return {status:"fail",message:`${label}: Prüfkette ist unterbrochen.`};
    previousHash=row.recordHash;
  }
  return legacy?{status:"warn",message:`${label}: ${legacy} übernommene Alt-Datensätze ohne Prüfkette.`}:{status:"pass",message:`${label}: ${rows.length} Datensätze geprüft.`};
}
let latestTuvReport=null;
async function runTuvSelfTest({show=false}={}){
  const tests=[],add=(id,name,status,message)=>tests.push({id,name,status,message});
  add("version","Versionsstand",VERSION==="V0.29.0"?"pass":"fail",`Geladene Version: ${VERSION}`);
  try{const key="kc_tuv_storage_probe";localStorage.setItem(key,"ok");const ok=localStorage.getItem(key)==="ok";localStorage.removeItem(key);add("storage","Lokaler Datenspeicher",ok?"pass":"fail",ok?"Lesen und Schreiben erfolgreich.":"Schreib-/Lesetest fehlgeschlagen.")}catch(err){add("storage","Lokaler Datenspeicher","fail",err.message)}
  const activeGroups=GROUPS.filter(isActiveRecord),activeProducts=PRODUCTS.filter(isActiveRecord);
  const groupIds=new Set(GROUPS.map(x=>x.id)),productIds=new Set(PRODUCTS.map(x=>x.id));
  add("catalog","Artikelstamm",activeGroups.length&&activeProducts.length&&groupIds.size===GROUPS.length&&productIds.size===PRODUCTS.length?"pass":"fail",`${activeGroups.length} aktive Gruppen · ${activeProducts.length} aktive Artikel · IDs ${groupIds.size===GROUPS.length&&productIds.size===PRODUCTS.length?"eindeutig":"nicht eindeutig"}.`);
  const profileOk=Array.isArray(displayProfile.groupIds)&&Array.isArray(displayProfile.productIds)&&displayProfile.groupIds.some(id=>groupIds.has(id))&&displayProfile.productIds.some(id=>productIds.has(id));
  add("display","Kassenansicht",profileOk?"pass":"fail",profileOk?"Mindestens eine gültige Gruppe und ein gültiger Artikel sichtbar.":"Sichtbarkeitsprofil ist ungültig.");
  const real=readTransactions(),training=readTrainingTransactions();
  add("separation","Trainingstrennung",real.some(x=>x.training)?"fail":"pass",real.some(x=>x.training)?"Trainingsbuchung im Produktivspeicher gefunden.":`${real.length} Produktiv- und ${training.length} Trainingsvorgänge sauber getrennt.`);
  try{const realLedger=await inspectLedger(real,"Produktivspeicher"),trainingLedger=await inspectLedger(training,"Trainingsspeicher");add("ledger","Datensatz-Prüfkette",realLedger.status==="fail"||trainingLedger.status==="fail"?"fail":realLedger.status==="warn"||trainingLedger.status==="warn"?"warn":"pass",`${realLedger.message} ${trainingLedger.message}`)}catch(err){add("ledger","Datensatz-Prüfkette","fail",err.message)}
  add("crypto","Kryptografie",crypto?.subtle&&typeof crypto.randomUUID==="function"?"pass":"fail",crypto?.subtle?"Web-Crypto verfügbar.":"Web-Crypto nicht verfügbar.");
  add("qr","QR-Erzeugung",typeof qrcode==="function"?"pass":"fail",typeof qrcode==="function"?"Echtes QR-Modul geladen.":"QR-Modul fehlt.");
  const access=state.master.superAdminAccess,accessStatus=!access?.active?"warn":access.expiresAt&&Date.now()>new Date(access.expiresAt).getTime()?"fail":"pass";
  add("admin","Superadmin-Zugang",accessStatus,!access?.active?"Kein Superadmin-QR konfiguriert.":accessStatus==="fail"?"Superadmin-QR ist abgelaufen.":"Aktive Superadmin-Freigabe vorhanden.");
  const fiscal=state.master.fiscalMode||"off",tseComplete=fiscal==="tse"&&state.master.tseProvider&&state.master.tseSerial;
  add("fiscal","Interner Fiskalmodus",fiscal==="off"?"warn":tseComplete?"pass":"fail",fiscal==="off"?"Lokaler Modus ohne Fiskaladapter ist eingestellt.":tseComplete?"Adapterdaten sind hinterlegt; Verbindung ist im Echtbetrieb zusätzlich zu prüfen.":"Fiskaladapter ist aktiviert, aber nicht vollständig konfiguriert.");
  const counts={pass:tests.filter(x=>x.status==="pass").length,warn:tests.filter(x=>x.status==="warn").length,fail:tests.filter(x=>x.status==="fail").length};
  const overall=counts.fail?"fail":counts.warn?"warn":"pass";
  latestTuvReport={format:"KC_INTERNAL_SELF_TEST",formatVersion:1,officialCertification:false,testId:crypto.randomUUID(),generatedAt:new Date().toISOString(),app:"KC_MARKTKASSE_POS",appVersion:VERSION,registerId:state.master.registerId,registerName:state.master.registerName,fiscalMode:fiscal,summary:{overall,...counts},tests,diagnostics:{productCount:PRODUCTS.length,groupCount:GROUPS.length,transactionCount:real.length,trainingTransactionCount:training.length,closingCount:safeArray(CLOSING_KEY).length,withdrawalCount:safeArray(WITHDRAWAL_KEY).length,viewport:{width:window.innerWidth,height:window.innerHeight},userAgent:navigator.userAgent}};
  localStorage.setItem(TUV_REPORT_KEY,JSON.stringify(latestTuvReport));
  const button=el("tuvButton");button.classList.remove("warn","fail");if(overall!=="pass")button.classList.add(overall);button.title=`Letzter Selbsttest: ${counts.pass} OK, ${counts.warn} Hinweise, ${counts.fail} Fehler`;
  if(show){
    const summary=el("tuvSummary");summary.className=`tuv-summary ${overall}`;summary.textContent=counts.fail?`${counts.fail} Fehler · ${counts.warn} Hinweise · ${counts.pass} bestanden`:counts.warn?`${counts.pass} bestanden · ${counts.warn} Hinweise`:`Alle ${counts.pass} Prüfungen bestanden`;
    el("tuvResults").innerHTML=tests.map(test=>`<div class="tuv-result"><span class="${test.status}">${test.status==="pass"?"✓":test.status==="warn"?"!":"×"}</span><div><b>${test.name}</b><small>${test.message}</small></div></div>`).join("");
  }
  return latestTuvReport;
}
el("tuvButton").onclick=async()=>{el("tuvDialog").showModal();await runTuvSelfTest({show:true})};
el("runTuvAgain").onclick=()=>runTuvSelfTest({show:true});
el("downloadTuvReport").onclick=async()=>{const report=latestTuvReport||await runTuvSelfTest({show:true});downloadText(`${state.master.registerId}_TUEV_Selbsttest_${new Date().toISOString().replace(/[:.]/g,"-")}.kctuv`,JSON.stringify(report,null,2),"application/json")};
async function trySuperAdminQr(code){
  const raw=String(code||"").trim();
  if(!raw.startsWith("KCSUPER1:"))return false;
  if(adminAccessLocked())return true;
  const parts=raw.split(":"),credentialId=parts[1]||null,expiresUnix=Number(parts[2]||0),access=state.master.superAdminAccess;
  if(parts.length!==4||!credentialId||!Number.isFinite(expiresUnix)){
    registerAdminFailure("qr","QR-Code hat ein ungültiges Format.",credentialId);return true;
  }
  if(!access?.active||!access.hash){
    registerAdminFailure("qr","Kein aktiver Superadmin-QR eingerichtet. Bitte die aktuelle Manager-Konfiguration importieren.",credentialId);return true;
  }
  if(access.credentialId!==credentialId){
    registerAdminFailure("qr","Dieser QR-Code gehört nicht zur aktuellen Freigabe.",credentialId);return true;
  }
  if(Date.now()>expiresUnix*1000||(access.expiresAt&&Date.now()>new Date(access.expiresAt).getTime())){
    registerAdminFailure("qr","Der Superadmin-QR ist abgelaufen.",credentialId);return true;
  }
  if(await sha256Hex(raw)!==access.hash){
    registerAdminFailure("qr","Superadmin-QR ist ungültig.",credentialId);return true;
  }
  adminFailedAttempts=0;
  beginAdminSession("qr",access.owner||"Superadmin",credentialId);
  return true;
}
document.querySelectorAll("[data-admin-target]").forEach(btn=>btn.onclick=()=>{
  const target=btn.dataset.adminTarget;
  adminNavigationInProgress=true;
  el("adminHomeDialog").close();
  if(target==="reversal"){
    renderRecentBons();el("bonSearchResult").innerHTML="";el("bonPrintDialog").showModal();
    setTimeout(()=>adminNavigationInProgress=false,50);return;
  }
  openSettings();
  setTimeout(()=>{
    const requested=target==="devices"?"general":target==="security"?"system":target;
    const tab=document.querySelector(`[data-settings-tab="${requested}"]`);
    if(tab)tab.click();
    adminNavigationInProgress=false;
  },50);
});
el("adminHomeDialog").addEventListener("close",()=>{if(!adminNavigationInProgress)endAdminSession("admin-home-closed")});
el("settingsDialog")?.addEventListener("close",()=>{if(!adminNavigationInProgress)endAdminSession("settings-closed")});
el("bonPrintDialog").addEventListener("close",()=>{if(adminSession&&!adminNavigationInProgress)endAdminSession("bon-dialog-closed")});




document.querySelectorAll("#groupToolbar button[data-command]").forEach(btn=>btn.onclick=()=>groupCommand(btn.dataset.command));
document.querySelectorAll("#articleToolbar button[data-command]").forEach(btn=>btn.onclick=()=>articleCommand(btn.dataset.command));


// V0.29.0: stabiler geheimer Zugang auf Maus, Touch und Stift
let secretHoldTimer=null;
let secretHoldStart=0;
let secretProgress=null;

function clearSecretHold(){
  clearTimeout(secretHoldTimer);
  secretHoldTimer=null;
  secretHoldStart=0;
  el("secretTrigger").classList.remove("admin-hold-active");
  if(secretProgress){secretProgress.remove();secretProgress=null}
}
function beginSecretHold(event){
  clearSecretHold();
  event.preventDefault();
  secretHoldStart=Date.now();
  el("secretTrigger").classList.add("admin-hold-active");
  secretProgress=null;
  if(event.pointerId!==undefined && el("secretTrigger").setPointerCapture){
    try{el("secretTrigger").setPointerCapture(event.pointerId)}catch{}
  }
  secretHoldTimer=setTimeout(()=>{
    openService();
    clearSecretHold();
  },5000);
}
function endSecretHold(event){
  if(secretHoldStart && Date.now()-secretHoldStart>=4900){
    openService();
  }
  clearSecretHold();
}
const secret=el("secretTrigger");
const PUBLIC_BETA = window.KC_RUNTIME_FLAGS?.publicBeta === true;
if(PUBLIC_BETA){
  secret.classList.remove("secret-trigger");
  secret.style.touchAction="manipulation";
  secret.setAttribute("aria-label", state.master.clubName || "Köcheclub Werne");
}else{
  secret.style.touchAction="none";
  secret.addEventListener("pointerdown",beginSecretHold);
  secret.addEventListener("pointerup",endSecretHold);
  secret.addEventListener("pointercancel",clearSecretHold);
  secret.addEventListener("contextmenu",e=>e.preventDefault());

  // Interner Ausweichzugang bleibt ausschließlich im internen Release aktiv.
  let secretTapCount=0,secretTapReset=null;
  secret.addEventListener("click",()=>{
    secretTapCount++;
    clearTimeout(secretTapReset);
    if(secretTapCount>=7){secretTapCount=0;openService()}
    secretTapReset=setTimeout(()=>secretTapCount=0,1800);
  });
}

el("serviceLogin").onclick=serviceLogin;
el("servicePin").addEventListener("keydown",e=>{
  if(e.key==="Enter"){e.preventDefault();serviceLogin(e)}
});
async function serviceQrLogin(e){
  e?.preventDefault();
  const code=el("serviceQrCode").value.trim();
  if(!code)return registerAdminFailure("qr","Bitte den Superadmin-QR scannen oder einfügen.");
  if(!await trySuperAdminQr(code))registerAdminFailure("qr","Kein gültiger Superadmin-QR-Code.");
}
el("serviceQrLogin").onclick=serviceQrLogin;
el("serviceQrCode").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();serviceQrLogin(e)}});
let serviceScanBuffer="",serviceScanTimer=null;
el("serviceDialog").addEventListener("keydown",e=>{
  if(!el("serviceDialog").open||e.ctrlKey||e.altKey||e.metaKey)return;
  if(e.key==="Enter"&&serviceScanBuffer){
    e.preventDefault();e.stopPropagation();el("serviceQrCode").value=serviceScanBuffer;serviceScanBuffer="";clearTimeout(serviceScanTimer);serviceQrLogin(e);return;
  }
  if(e.key.length===1&&(serviceScanBuffer||e.key==="K")&&document.activeElement!==el("servicePin")){
    e.preventDefault();e.stopPropagation();serviceScanBuffer+=e.key;el("serviceQrCode").value=serviceScanBuffer;
    clearTimeout(serviceScanTimer);serviceScanTimer=setTimeout(()=>serviceScanBuffer="",250);
  }
},true);

el("productPagePrev").onclick=()=>{
  setProductPage(state.productPage-1);
};
el("productPageNext").onclick=()=>{
  setProductPage(state.productPage+1);
};


const OPENING_STEPS=[
  {id:"cash",label:"Anfangsbestand oder Nachfüllung einlesen"},
  {id:"scanner",label:"Scanner testen"},
  {id:"printer",label:"Bondrucker testen"},
  {id:"articles",label:"Artikel und Preise prüfen"},
  {id:"operator",label:"Bediener und Kassen-ID prüfen"}
];
const CLOSING_STEPS=[
  {id:"stop",label:"Verkauf beenden"},
  {id:"closing",label:"Kassenabschlusscode erzeugen"},
  {id:"count",label:"Bargeld mit Money Butler zählen"},
  {id:"compare",label:"Soll-/Ist-Vergleich im Manager durchführen"},
  {id:"backup",label:"Datenexport beziehungsweise Synchronisation prüfen"}
];
let workflowDone=new Set();
function openWorkflow(mode){
  state.workflowMode=mode;workflowDone=new Set();
  el("workflowTitle").textContent=mode==="opening"?"Öffnungsassistent":"Abschlussassistent";
  renderWorkflow();el("workflowDialog").showModal();
}
function workflowList(){return state.workflowMode==="opening"?OPENING_STEPS:CLOSING_STEPS}
function renderWorkflow(){
  const steps=workflowList();
  el("workflowSteps").innerHTML=steps.map((s,i)=>`<div class="workflow-step ${workflowDone.has(s.id)?"done":""}">
    <strong>${i+1}</strong><span>${s.label}</span><button type="button" data-step="${s.id}">${workflowDone.has(s.id)?"Erledigt ✓":"Erledigen"}</button>
  </div>`).join("");
  el("workflowSteps").querySelectorAll("button").forEach(b=>b.onclick=()=>{workflowDone.add(b.dataset.step);renderWorkflow()});
  el("workflowProgressText").textContent=`${workflowDone.size} von ${steps.length} erledigt`;
}
el("finishWorkflow").onclick=()=>{
  const steps=workflowList();
  if(workflowDone.size<steps.length)return setSystemHint("Bitte alle Schritte abschließen","warn");
  el("workflowDialog").close();
  setSystemHint(state.workflowMode==="opening"?"Kasse einsatzbereit":"Tagesabschluss vollständig");
  el("shiftStatus").textContent=state.workflowMode==="opening"?"Schicht aktiv":"Schicht beendet";
};
el("openingAssistantBtn").onclick=()=>openWorkflow("opening");

const SCREEN_SAVER_IDLE_MS=5*60*1000;
let screenSaverTimer=null;
let screenSaverCountdownTimer=null;
let screenSaverDeadline=Date.now()+SCREEN_SAVER_IDLE_MS;
let screenSaverActive=false;

function updateScreenSaverClock(){
  const node=el("screenSaverTime");
  if(!node)return;
  const now=new Date();
  const weekday=now.toLocaleDateString("de-DE",{weekday:"long"});
  const date=now.toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit",year:"2-digit"});
  const time=now.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});
  node.textContent=`Heute ist ${weekday}, der ${date}. Es ist ${time} Uhr.`;
}
function updateScreenSaverCountdown(){
  const node=el("screenSaverCountdown");
  if(!node)return;
  if(screenSaverActive){
    node.textContent="Zum Entsperren Bildschirm berühren";
    return;
  }
  if(state.master.rushMode){
    node.textContent="Automatische Abdunklung in Stoßzeiten pausiert";
    return;
  }
  const remaining=Math.max(0,screenSaverDeadline-Date.now());
  const min=Math.floor(remaining/60000);
  const sec=Math.floor((remaining%60000)/1000);
  node.textContent=`Automatische Abdunklung in ${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}
function showScreenSaver(reason="manual"){
  if(state.master.rushMode&&reason==="idle")return;
  const saver=el("screenSaver");
  if(!saver)return;
  screenSaverActive=true;
  saver.hidden=false;
  saver.dataset.reason=reason;
  updateScreenSaverClock();
  updateScreenSaverCountdown();
  clearInterval(screenSaverCountdownTimer);
  screenSaverCountdownTimer=setInterval(()=>{updateScreenSaverClock();updateScreenSaverCountdown();},1000);
  document.body.classList.add("screen-saver-active");
}
function hideScreenSaver(){
  const saver=el("screenSaver");
  if(!saver||!screenSaverActive)return;
  saver.hidden=true;
  screenSaverActive=false;
  clearInterval(screenSaverCountdownTimer);
  document.body.classList.remove("screen-saver-active");
  resetScreenSaverTimer();
}
function resetScreenSaverTimer(){
  clearTimeout(screenSaverTimer);
  screenSaverDeadline=Date.now()+SCREEN_SAVER_IDLE_MS;
  updateScreenSaverCountdown();
  if(screenSaverActive||state.master.rushMode)return;
  screenSaverTimer=setTimeout(()=>showScreenSaver("idle"),SCREEN_SAVER_IDLE_MS);
}
function registerScreenActivity(event){
  if(screenSaverActive){
    event?.preventDefault?.();
    hideScreenSaver();
    return;
  }
  resetScreenSaverTimer();
}
["pointerdown","touchstart","keydown"].forEach(type=>{
  document.addEventListener(type,registerScreenActivity,{passive:type!=="keydown"});
});
el("screenSaver")?.addEventListener("click",hideScreenSaver);
el("screenSaver")?.addEventListener("keydown",event=>{
  if(event.key==="Enter"||event.key===" "||event.key==="Escape")hideScreenSaver();
});
el("screenLockBtn").onclick=()=>showScreenSaver("manual");
resetScreenSaverTimer();
setInterval(updateScreenSaverCountdown,1000);

el("rushModeBtn").onclick=()=>{
  const activating=!state.master.rushMode;
  state.master.rushMode=activating;
  if(activating&&state.master.trainingMode){state.master.trainingMode=false;notify("warning","Trainingsmodus wurde beendet, weil Stoßzeiten aktiviert wurden","training-rush-exclusive",5000)}
  if(state.master.rushMode){clearTimeout(screenSaverTimer);if(screenSaverActive)hideScreenSaver()}else resetScreenSaverTimer();
  saveMaster();applyModes();renderCategories();renderProducts();
  setSystemHint(state.master.rushMode?"Stoßzeiten aktiv – Trainingsmodus und automatische Displayabdunklung sind pausiert":"Normalbetrieb aktiv");
};

el("resetWorkspaceBtn")?.addEventListener("click",()=>{workspaceDraft=defaultWorkspace();renderWorkspaceEditor()});
el("compactWorkspaceBtn")?.addEventListener("click",()=>workspacePreset("compact"));
el("touchWorkspaceBtn")?.addEventListener("click",()=>workspacePreset("touch"));
el("professionalWorkspaceBtn")?.addEventListener("click",()=>workspacePreset("professional"));

function setTrainingMode(active){if(active&&state.master.rushMode){setSystemHint("Trainingsmodus ist während Stoßzeiten nicht verfügbar","warn");return false}state.master.trainingMode=!!active;saveMaster();applyModes();setSystemHint(state.master.trainingMode?"Testmodus aktiv – keine echten Umsätze":"Testmodus beendet – Produktivmodus aktiv",state.master.trainingMode?"warn":"ok");return true}
el("trainingModeBtn").onclick=()=>setTrainingMode(!state.master.trainingMode);
el("trainingModeTopBtn").onclick=()=>setTrainingMode(!state.master.trainingMode);
el("exitTrainingModeBtn")?.addEventListener("click",()=>setTrainingMode(false));
function openSelectedQuantity(){const item=selectedCartItem();if(!item)return setSystemHint("Zuerst eine Einkaufswagenzeile antippen","warn");el("quantityArticleName").textContent=item.name;el("customQuantity").value=item.qty;el("quantityDialog").showModal()}
el("moreQuantityBtn").onclick=openSelectedQuantity;
el("undoQuantityBtn").onclick=undoQuantityChange;
let quickQuantityKey=null;
let quickQuantityLastAt=0;
function applyQuantity(q){
  const item=selectedCartItem();
  if(!item)return;
  rememberQuantityChange(item);
  item.qty=Math.max(1,Number(q)||1);
  quickQuantityKey=null;
  renderCart();
  if(el("quantityDialog").open)el("quantityDialog").close();
}
function applyQuickQuantity(q){
  const item=selectedCartItem();
  if(!item)return;
  const value=Math.max(1,Number(q)||1);
  const now=Date.now();
  rememberQuantityChange(item);
  if(quickQuantityKey===item.key&&now-quickQuantityLastAt<4000){item.qty+=value}else{item.qty=value}
  quickQuantityKey=item.key;
  quickQuantityLastAt=now;
  renderCart();
  notify("info",`${item.name} – Menge ${item.qty}`,`quickqty:${item.key}`,1200);
}
document.querySelectorAll("[data-qty]").forEach(b=>b.onclick=()=>applyQuantity(b.dataset.qty));
document.querySelectorAll("[data-cart-qty]").forEach(button=>button.onclick=()=>applyQuickQuantity(button.dataset.cartQty));
el("applyCustomQuantity").onclick=()=>applyQuantity(el("customQuantity").value);


function saveManualTip(amount){
  const record=saveTipRecord(amount,"manual",el("tipBonNumber").value.trim()||null,el("tipNote").value.trim());
  if(!record)return setSystemHint("Bitte gültigen Trinkgeldbetrag eingeben","warn");
  setGiven(0);state.keypadBuffer="";
  el("tipDialog").close();
  setSystemHint(`${money(record.amount)} Trinkgeld gespeichert`);
}
el("tipBtn").onclick=()=>{
  const staged=state.given>0?state.given:0;
  el("tipCustomAmount").value=staged?staged.toFixed(2):"";
  el("tipBonNumber").value=state.cart.length?bonText():"";
  el("tipNote").value="";
  el("tipStagedAmount").hidden=!staged;
  el("tipStagedAmount").textContent=staged?`${money(staged)} aus den Geldtasten übernommen. Mehrere Münzen und Scheine können vorher nacheinander angeklickt werden.`:"";
  el("tipDialog").showModal();
};
document.querySelectorAll("[data-tip]").forEach(b=>b.onclick=()=>saveManualTip(b.dataset.tip));
el("saveCustomTip").onclick=()=>saveManualTip(el("tipCustomAmount").value);


// Der Aufrunden-Dialog ist vorbereitet, der sichtbare Button aber optional.
// Ein fehlender Zusatzbutton darf den Start der Verkaufsoberfläche nie abbrechen.
el("roundUpBtn")?.addEventListener("click",openRoundUp);
el("applyRoundUpCustom").onclick=()=>applyRoundUp(Number(el("roundUpCustom").value));
function confirmOperator(profile,source="button"){
  if(!profile)return false;state.master.operatorName=profile.name;state.operatorConfirmedForSale=true;saveMaster();renderHeader();setSystemHint(`Bediener ${profile.name} per ${source==="qr"?"QR":"Taste"} bestätigt`);return true;
}
function operatorFromCode(code){return normalizeOperatorProfiles().find(profile=>profile.code===code)||null}
el("operatorBtn").onclick=()=>{
  const profiles=normalizeOperatorProfiles();
  el("operatorList").innerHTML=profiles.map(profile=>`<button type="button" data-operator-id="${profile.id}" class="${profile.name===state.master.operatorName?"active":""}">${profile.name}${profile.name===state.master.operatorName?" ✓":""}</button>`).join("");
  el("operatorList").querySelectorAll("button").forEach(button=>button.onclick=()=>{confirmOperator(profiles.find(profile=>profile.id===button.dataset.operatorId));el("operatorDialog").close()});
  el("operatorDialog").showModal();
};
el("productSearchInput").addEventListener("input",()=>{state.productPage=0;renderProducts()});
el("panicHotspot").onclick=()=>el("panicDialog").showModal();
el("panicReturnBtn").onclick=()=>{
  document.querySelectorAll("dialog[open]").forEach(d=>{try{d.close()}catch{}});
  endAdminSession("panic-return");
};
document.body.classList.toggle("group-color-mode",state.master.groupColorMode!==false);

const KEYPAD_MODES={
  cash:{label:"BARGELD EINGEBEN",help:"Betrag eingeben. OK übernimmt ihn in die Rückgeldfunktion – der Bon bleibt offen."},
  quantity:{label:"MENGE ÄNDERN",help:"Position im Bon markieren, ganze Menge eingeben und OK drücken."},
  discount:{label:"POSITIONSRABATT",help:"Position markieren, Rabatt in Prozent eingeben und OK drücken."},
  article:{label:"ARTIKELNUMMER / BARCODE",help:"Artikelnummer oder Barcode eingeben und mit OK in den Bon übernehmen."},
  bon:{label:"BONNUMMER SUCHEN",help:"Bonnummer eingeben und mit OK suchen."},
  price:{label:"PREIS ÄNDERN",help:"Nur mit Managerberechtigung: Position markieren, neuen Einzelpreis eingeben und OK drücken."}
};
function setKeypadMode(mode){
  if(!KEYPAD_MODES[mode])mode="cash";
  if(mode==="price"&&state.role!=="superadmin"){
    setSystemHint("Preisänderung ist nur mit Managerberechtigung möglich","warn");mode="cash";
  }
  state.keypadMode=mode;state.keypadBuffer="";
  document.querySelectorAll("[data-keypad-mode]").forEach(button=>button.classList.toggle("active",button.dataset.keypadMode===mode));
  el("keypadModeLabel").textContent=KEYPAD_MODES[mode].label;
  el("keypadHelp").textContent=KEYPAD_MODES[mode].help;
  renderKeypadDisplay();
}
function keypadNumber(){return Number(String(state.keypadBuffer||"0").replace(",","."))}
function renderKeypadDisplay(){
  const value=keypadNumber(),display=el("keypadDisplay");if(!display)return;
  if(state.keypadMode==="cash"||state.keypadMode==="price")display.textContent=money(Number.isFinite(value)?value:0);
  else if(state.keypadMode==="discount")display.textContent=`${Number.isFinite(value)?value:0} %`;
  else display.textContent=state.keypadBuffer||"0";
}
function applyKeypadValue(){
  const mode=state.keypadMode||"cash",value=keypadNumber();
  if(!state.keypadBuffer)return setSystemHint("Bitte zuerst eine Zahl eingeben","warn");
  if(mode==="cash"){
    if(!Number.isFinite(value)||value<=0)return setSystemHint("Ungültigen Bargeldbetrag korrigieren","warn");
    setGiven(value);setSystemHint(`Gegeben ${money(state.given)} · Rückgeld ${money(Math.max(0,state.given-total()))} · BAR-Taste zum Abschließen`);
  }else if(mode==="quantity"){
    const item=selectedCartItem(),qty=Math.trunc(value);
    if(!item)return setSystemHint("Bitte zuerst eine Bonposition markieren","warn");
    if(!Number.isFinite(qty)||qty<1||qty>999)return setSystemHint("Menge muss zwischen 1 und 999 liegen","warn");
    rememberQuantityChange(item);item.qty=qty;renderCart();setSystemHint(`${item.name}: Menge auf ${qty} gesetzt`);
  }else if(mode==="discount"){
    const item=selectedCartItem(),percent=Math.max(0,Math.min(100,value));
    if(!item)return setSystemHint("Bitte zuerst eine Bonposition markieren","warn");
    if(item.category==="Pfand"||item.manualDeposit)return setSystemHint("Auf Pfand ist kein Rabatt möglich","warn");
    item.positionDiscount=percent>0?{percent,reason:"Zahlenblock",note:""}:null;renderCart();setSystemHint(`${item.name}: ${percent} % Positionsrabatt`);
  }else if(mode==="article"){
    const query=String(state.keypadBuffer).replace(/[,.]/g,"");
    const product=productsForSale().find(p=>String(p.barcode||"").replace(/\D/g,"")===query||String(p.id||"").replace(/\D/g,"")===query);
    if(!product)return showMessage("Artikel nicht gefunden","!",`Keine Artikelnummer oder kein Barcode ${query} vorhanden.`);
    selectProduct(product.id);setSystemHint(`${product.name} über Zahlenblock gewählt`);
  }else if(mode==="bon"){
    const query=String(state.keypadBuffer).replace(/[,.]/g,""),row=allTransactions().find(t=>String(t.bon||t.bonNumber||"").replace(/\D/g,"")===query);
    if(!row)return showMessage("Bon nicht gefunden","!",`Bonnummer ${query} wurde nicht gefunden.`);
    showMessage(`Bon ${row.bon||row.bonNumber}`,money(Number(row.due??row.total??0)),`${new Date(row.time||row.endTime).toLocaleString("de-DE")} · ${row.operator||"ohne Bediener"} · ${(row.items||[]).length} Positionen`);
  }else if(mode==="price"){
    const item=selectedCartItem();
    if(state.role!=="superadmin")return setSystemHint("Preisänderung ist nur mit Managerberechtigung möglich","warn");
    if(!item)return setSystemHint("Bitte zuerst eine Bonposition markieren","warn");
    if(!Number.isFinite(value)||value<0||value>9999)return setSystemHint("Preis muss zwischen 0 und 9.999 Euro liegen","warn");
    const before=item.price;item.price=fromCents(toCents(value));recordAdminChange("cart-item","price-override",item.key,{price:before},{price:item.price});renderCart();setSystemHint(`${item.name}: Preis auf ${money(item.price)} geändert`);
  }
  state.keypadBuffer="";renderKeypadDisplay();
}
function handleKeypad(key){
  if(key==="clear"){state.keypadBuffer="";if(state.keypadMode==="cash")setGiven(0);renderKeypadDisplay();return}
  if(key==="back"){state.keypadBuffer=state.keypadBuffer.slice(0,-1);renderKeypadDisplay();return}
  if(key==="ok"){applyKeypadValue();return}
  if(!/^\d$|^00$|^[,.]$/.test(key))return;
  const part=(key==="."||key===",")?",":key;
  if(part===","&&(state.keypadBuffer.includes(",")||["quantity","article","bon"].includes(state.keypadMode)))return;
  if(state.keypadBuffer.replace(/\D/g,"").length>=12)return;
  if(state.keypadBuffer==="0"&&part!==",")state.keypadBuffer="";
  state.keypadBuffer+=part;renderKeypadDisplay();
}
document.querySelectorAll(".keypad button").forEach(button=>button.onclick=()=>handleKeypad(button.dataset.key||button.textContent.trim()));
el("undoCashBtn").onclick=undoCashSelection;
el("voidBonBtn").onclick=voidBon;
el("undoLastBtn").onclick=()=>{const i=state.cart.findIndex(x=>x.key===state.lastAdded);if(i>=0){state.cart[i].qty--;if(state.cart[i].qty<=0){const removed=state.cart.splice(i,1)[0];if(state.selectedCartKey===removed.key)state.selectedCartKey=state.cart.at(-1)?.key||null}if(!state.cart.length)state.cartStartedAt=null;renderCart()}};
async function checkoutSale(source="button"){
  if(!state.cart.length)return showMessage("Kein Bon","0,00 €","Bitte zuerst Artikel wählen.");
  const cashEntered=toCents(state.given)>0;
  if(!cashEntered){
    setGiven(total());state.keypadBuffer="";renderKeypadDisplay();
    return completeSale(source==="qr"?"cash-qr-direct":"cash-button-direct",{silent:true,directSettlement:true});
  }
  if(toCents(state.given)<toCents(total())){
    return showMessage("Betrag nicht ausreichend","!",`Es fehlen noch ${money(total()-state.given)}. Bitte weiteren Schein, weitere Münzen oder einen höheren Betrag eingeben.`);
  }
  return completeSale(source==="qr"?"cash-qr-change":"cash-button-change",{silent:false,directSettlement:false});
}
el("payBtn").onclick=()=>checkoutSale("button");
el("cardBtn").onclick=()=>setSystemHint("EC-Kartenzahlung ist noch nicht verfügbar","warn");
el("staffBtn").onclick=()=>{if(!state.cart.length)return showMessage("Kein Bon","0,00 €","Bitte zuerst Artikel wählen.");askConfirm("Personalverbrauch speichern",`${money(total())} als Personalverbrauch protokollieren?`,()=>completeSale("internal-personal",{type:"personal"}))};
el("depositBtn").onclick=()=>{state.activeCategory="Pfand";renderCategories();renderProducts()};
el("complaintBtn").onclick=()=>{openWithdrawal();setTimeout(()=>document.querySelector('[data-withdraw-reason="Reklamation"]')?.click(),40)};
el("moreBtn").onclick=()=>el("moreDialog").showModal();el("menuBtn").onclick=()=>el("moreDialog").showModal();
el("moreDialogCloseX")?.addEventListener("click",()=>el("moreDialog")?.close());
el("withdrawDialogCloseX")?.addEventListener("click",()=>el("withdrawDialog")?.close());

el("applyDisplaySettings").onclick=applyDisplaySettings;
function leaveMore(action){el("moreDialog").close();setTimeout(action,20)}
document.querySelectorAll('.more-grid button[data-action]').forEach(button=>button.onclick=()=>{
  const action=button.dataset.action;
  if(action==="staff")return leaveMore(()=>el("staffBtn").click());
  if(action==="tip")return leaveMore(()=>el("tipBtn").click());
  if(action==="deposit")return leaveMore(()=>el("depositBtn").click());
  if(action==="lastbon")return leaveMore(()=>el("printBonBtn").click());
  if(action==="operator")return leaveMore(()=>el("operatorBtn").click());
  if(action==="rush")return leaveMore(()=>el("rushModeBtn").click());
  if(action==="training")return leaveMore(()=>el("trainingModeBtn").click());
  if(action==="currency")return leaveMore(openCurrencyConverter);
  if(action==="manager")return leaveMore(()=>openService());
  if(action==="opening")return leaveMore(()=>el("openingAssistantBtn").click());
  if(action==="closing")return leaveMore(openClosingDialog);
  if(action==="cashdeposit")return leaveMore(()=>el("cashDepositDialog").showModal());
  if(action==="withdraw")return leaveMore(openWithdrawal);
});
document.addEventListener("keydown",async e=>{if(["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName))return;clearTimeout(state.scanTimer);if(e.key==="Enter"){const code=state.scanBuffer.trim();state.scanBuffer="";if(code==="CMD-CHECKOUT")return checkoutSale("qr");
    if(code.startsWith("KCOPE1:")){const profile=operatorFromCode(code);if(profile)confirmOperator(profile,"qr");else showMessage("Bediener-QR unbekannt","!","Dieser Bediener ist nicht in der aktuellen Manager-Konfiguration enthalten.");return}
    if(code.startsWith("KCASH1:")){try{const p=applyCashPayload(code,"hid-scanner");showMessage("Bargeldeinzahlung",money(p.total),`${p.type==="opening"?"Anfangsbestand":"Nachfüllung"} für ${displayBusinessDate(p.effectiveDate)} übernommen.`)}catch(err){showMessage("QR-Code abgelehnt","!",err.message)}return;}const map={ART0001:"mettwurst",ART1001:"grot",ART1002:"gweiss",ART1003:"feuer",DEP0001:"glasplus"};if(map[code])selectProduct(map[code]);return}if(e.key.length===1)state.scanBuffer+=(e.key);state.scanTimer=setTimeout(()=>state.scanBuffer="",130)});
GROUPS=GROUPS.map(sanitizeGroup);PRODUCTS=PRODUCTS.map(sanitizeProduct);saveGroups();saveProducts();
try{migrateTransactions()}catch(err){console.error("Transaktionsmigration fehlgeschlagen",err)}
el("cashTransferTestHint").hidden=!window.KC_RUNTIME_FLAGS?.testPhaseToolGuidance;

/* TrainingCore bridge: only active inside the bundled training package. */
window.KCTrainingAPI={
  addStandardProduct(name){
    const wanted=String(name||'').toLowerCase();
    const product=PRODUCTS.find(item=>String(item.name||'').toLowerCase()===wanted)||PRODUCTS.find(item=>String(item.name||'').toLowerCase().includes(wanted));
    if(!product)return false;
    if(state.master.requireOperatorConfirmation===true)state.operatorConfirmedForSale=true;
    state.activeCategory=product.category;renderCategories();renderProducts();
    const tile=[...document.querySelectorAll(".product-tile")].find(node=>String(node.getAttribute("aria-label")||node.textContent||"").toLowerCase().includes(wanted));
    if(tile){tile.classList.add("training-live-click");tile.scrollIntoView({block:"center",inline:"center",behavior:"smooth"});setTimeout(()=>{const main=tile.querySelector(".product-main, [data-product-main], button:not(.product-plus):not(.product-info-button)")||tile;main.dispatchEvent(new MouseEvent("pointerdown",{bubbles:true}));setTimeout(()=>{main.click();main.dispatchEvent(new MouseEvent("pointerup",{bubbles:true}));tile.classList.remove("training-live-click");document.querySelector(".cart-area")?.classList.add("training-cart-arrival");setTimeout(()=>document.querySelector(".cart-area")?.classList.remove("training-cart-arrival"),1100)},360)},650);return true}
    addConfiguredProduct(product,null);return true;
  },
  clearCart(){
    state.cart=[];state.cartStartedAt=null;state.lastAdded=null;state.selectedCartKey=null;renderCart();return true;
  },
  getCartSnapshot(){return {items:cloneData(state.cart),total:total()}},
  closeAllDialogs(){
    document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close()}catch{}});
    return true;
  },
  openDeposit(){
    document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close()}catch{}});
    state.activeCategory='Pfand';renderCategories();renderProducts();
    return true;
  },
  addDepositReturn(name='Glasrückgabe'){
    document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close()}catch{}});
    state.activeCategory='Pfand';renderCategories();renderProducts();
    const product=PRODUCTS.find(p=>String(p.name||'').toLowerCase()===String(name).toLowerCase())||PRODUCTS.find(p=>p.id==='glasminus');
    if(!product)return false;
    addConfiguredProduct(product,null);return true;
  },
  openComplaint(stage='reason-mode'){
    document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close()}catch{}});
    if(stage==='menu'){
      el('moreDialog').showModal();
      return true;
    }
    openWithdrawal();
    const complaintButton=document.querySelector('[data-withdraw-reason="Reklamation"]');
    complaintButton?.click();
    if(stage==='article'){
      setTimeout(()=>{
        const firstPlus=document.querySelector('#complaintArticleList button:last-child');
        firstPlus?.click();
      },80);
    }
    if(stage==='specific-reason'){
      setTimeout(()=>document.querySelector('[data-complaint-reason="Kalt ausgegeben"]')?.click(),80);
    }
    if(stage==='review'){
      setTimeout(()=>{
        const firstPlus=document.querySelector('#complaintArticleList button:last-child');firstPlus?.click();
        document.querySelector('[data-complaint-reason="Kalt ausgegeben"]')?.click();
        el('complaintBonReference').value='BEISPIEL-1042';
        el('withdrawNote').value='Beispiel: Getränk wurde kalt ausgegeben.';
      },100);
    }
    return true;
  },
  openRushMode(){
    document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close()}catch{}});
    el('moreDialog').showModal();
    setTimeout(()=>document.querySelector('[data-action="rush"]')?.classList.add('training-focus-ring'),80);
    return true;
  },
  openProductInfo(name='Glühwein rot'){
    document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close()}catch{}});
    const product=PRODUCTS.find(p=>String(p.name||'').toLowerCase()===String(name).toLowerCase())||PRODUCTS[0];
    if(!product)return false;
    const tile=[...document.querySelectorAll('.product-tile')].find(x=>String(x.getAttribute('aria-label')||x.textContent).toLowerCase().includes(String(product.name).toLowerCase()));
    const infoButton=tile?.querySelector('[data-product-info], .product-info, .info-button, button[title*="Info"]');
    if(infoButton){infoButton.click();return true}
    if(typeof openProductInfo==='function'){openProductInfo(product);return true}
    return false;
  },
  activateStaffMode(){
    document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close()}catch{}});
    el('staffBtn')?.click();return true;
  },
  openClosing(){
    document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close()}catch{}});
    el('moreDialog').showModal();
    setTimeout(()=>document.querySelector('[data-action="closing"]')?.click(),120);
    return true;
  }
};


/* CurrencyCore V0.29.0 – ECB reference rates, local cache and history. */
const KC_CURRENCY_NAMES={EUR:"Euro",USD:"US-Dollar",GBP:"Britisches Pfund",CHF:"Schweizer Franken",JPY:"Japanischer Yen",CAD:"Kanadischer Dollar",AUD:"Australischer Dollar",NZD:"Neuseeland-Dollar",SEK:"Schwedische Krone",NOK:"Norwegische Krone",DKK:"Dänische Krone",PLN:"Polnischer Złoty",CZK:"Tschechische Krone",HUF:"Ungarischer Forint",RON:"Rumänischer Leu",BGN:"Bulgarischer Lew",TRY:"Türkische Lira",CNY:"Chinesischer Renminbi",HKD:"Hongkong-Dollar",SGD:"Singapur-Dollar",INR:"Indische Rupie",BRL:"Brasilianischer Real",MXN:"Mexikanischer Peso",ZAR:"Südafrikanischer Rand",IDR:"Indonesische Rupiah",ILS:"Israelischer Schekel",KRW:"Südkoreanischer Won",MYR:"Malaysischer Ringgit",PHP:"Philippinischer Peso",THB:"Thailändischer Baht",ISK:"Isländische Krone"};
const KC_CURRENCY_CACHE_KEY="kc_currency_ecb_cache_v1",KC_CURRENCY_HISTORY_KEY="kc_currency_ecb_history_v1";
const KC_ECB_URL="https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const KC_FALLBACK_RATES={EUR:1,USD:1.08,GBP:.84,CHF:.95,JPY:165,CAD:1.47,AUD:1.65,NZD:1.80,SEK:11.2,NOK:11.7,DKK:7.46,PLN:4.3,CZK:25.1,HUF:395,RON:4.97,BGN:1.9558,TRY:35,CNY:7.8,HKD:8.45,SGD:1.46,INR:90,BRL:5.9,MXN:18.5,ZAR:20,IDR:17500,ILS:4,KRW:1480,MYR:5.1,PHP:62,THB:39,ISK:150};
let kcCurrencyState={rates:KC_FALLBACK_RATES,date:"lokaler Startbestand",fetchedAt:null,source:"ECB-Fallback",status:"offline"};
function loadCurrencyCache(){try{const c=JSON.parse(localStorage.getItem(KC_CURRENCY_CACHE_KEY)||"null");if(c?.rates?.EUR===1)kcCurrencyState=c}catch{}}
function saveCurrencyCache(){localStorage.setItem(KC_CURRENCY_CACHE_KEY,JSON.stringify(kcCurrencyState))}
function currencyHistory(){try{return JSON.parse(localStorage.getItem(KC_CURRENCY_HISTORY_KEY)||"[]")}catch{return []}}
function addCurrencyHistory(entry){const h=[entry,...currencyHistory()].slice(0,100);localStorage.setItem(KC_CURRENCY_HISTORY_KEY,JSON.stringify(h));renderCurrencyHistory()}
function currencyFmt(v,code){try{return new Intl.NumberFormat("de-DE",{style:"currency",currency:code,maximumFractionDigits:code==="JPY"?0:2}).format(v)}catch{return `${Number(v).toFixed(2)} ${code}`}}
function currencyRate(from,to){const r=kcCurrencyState.rates;if(!r[from]||!r[to])return null;return r[to]/r[from]}
function renderCurrencyConverter(){const from=el("currencyFrom")?.value||"EUR",to=el("currencyTo")?.value||"USD",amount=Math.max(0,Number(el("currencyAmount")?.value||0)),rate=currencyRate(from,to),result=rate==null?null:amount*rate;el("currencyEquation").textContent=`${currencyFmt(amount,from)} (${from})`;el("currencyConverted").textContent=result==null?"Kurs nicht verfügbar":currencyFmt(result,to);el("currencyRateText").textContent=rate==null?"Kein Kurs vorhanden":`1 ${from} = ${rate.toLocaleString("de-DE",{minimumFractionDigits:4,maximumFractionDigits:6})} ${to}`;el("currencyRateDate").textContent=kcCurrencyState.date||"–";el("currencyFetchedAt").textContent=kcCurrencyState.fetchedAt?new Date(kcCurrencyState.fetchedAt).toLocaleString("de-DE"):"noch kein Internetabruf";const s=el("currencyOnlineState");s.textContent=kcCurrencyState.status==="online"?"ECB-Kurse geladen":"Offline-/Cache-Kurse";s.classList.toggle("online",kcCurrencyState.status==="online")}
function fillCurrencySelects(){const codes=Object.keys(kcCurrencyState.rates).sort((a,b)=>(KC_CURRENCY_NAMES[a]||a).localeCompare(KC_CURRENCY_NAMES[b]||b,"de"));[el("currencyFrom"),el("currencyTo")].forEach((select,i)=>{const old=select.value||(i?"USD":"EUR");select.innerHTML=codes.map(c=>`<option value="${c}">${c} – ${KC_CURRENCY_NAMES[c]||c}</option>`).join("");select.value=codes.includes(old)?old:(i?"USD":"EUR")})}
function renderCurrencyHistory(){const body=el("currencyHistoryBody");if(!body)return;const h=currencyHistory();body.innerHTML=h.length?h.map(x=>`<tr><td>${escapeHtml(new Date(x.fetchedAt).toLocaleString("de-DE"))}</td><td>${escapeHtml(x.date||"–")}</td><td>ECB</td><td>${x.count||0}</td><td>${escapeHtml(x.status||"OK")}</td></tr>`).join(""):'<tr><td colspan="5">Noch keine Kursabrufe gespeichert.</td></tr>'}
async function refreshEcbRates(){const btn=el("currencyRefresh"),stateText=el("currencyOnlineState");btn.disabled=true;btn.textContent="Kurse werden abgerufen …";stateText.textContent="Internetabgleich läuft";try{const response=await fetch(KC_ECB_URL,{cache:"no-store"});if(!response.ok)throw new Error(`HTTP ${response.status}`);const xml=new DOMParser().parseFromString(await response.text(),"application/xml");if(xml.querySelector("parsererror"))throw new Error("Ungültige XML-Antwort");const day=xml.querySelector('Cube[time]');if(!day)throw new Error("Kein Kursdatum enthalten");const rates={EUR:1};day.querySelectorAll('Cube[currency][rate]').forEach(n=>{const code=n.getAttribute("currency"),rate=Number(n.getAttribute("rate"));if(code&&Number.isFinite(rate))rates[code]=rate});if(Object.keys(rates).length<10)throw new Error("Zu wenige Kurse empfangen");kcCurrencyState={rates,date:day.getAttribute("time"),fetchedAt:new Date().toISOString(),source:"European Central Bank",status:"online"};saveCurrencyCache();addCurrencyHistory({fetchedAt:kcCurrencyState.fetchedAt,date:kcCurrencyState.date,count:Object.keys(rates).length,status:"Internetabgleich erfolgreich"});fillCurrencySelects();renderCurrencyConverter();setSystemHint(`ECB-Wechselkurse aktualisiert · Kursstand ${kcCurrencyState.date}`)}catch(err){kcCurrencyState.status="offline";renderCurrencyConverter();showMessage("Kursabruf nicht möglich","!",`Die zuletzt lokal gespeicherten Kurse bleiben erhalten. ${err.message}. Alle Werte dienen ausschließlich der Orientierung und sind ohne Gewähr.`)}finally{btn.disabled=false;btn.textContent="↻ Kurse mit Internet abgleichen"}}
function openCurrencyConverter(){loadCurrencyCache();fillCurrencySelects();renderCurrencyHistory();renderCurrencyConverter();el("currencyDialog").showModal()}
el("currencyDialogCloseX")?.addEventListener("click",()=>el("currencyDialog").close());
el("currencyAmount")?.addEventListener("input",renderCurrencyConverter);el("currencyFrom")?.addEventListener("change",renderCurrencyConverter);el("currencyTo")?.addEventListener("change",renderCurrencyConverter);
el("currencySwap")?.addEventListener("click",()=>{const a=el("currencyFrom").value;el("currencyFrom").value=el("currencyTo").value;el("currencyTo").value=a;renderCurrencyConverter()});
el("currencyRefresh")?.addEventListener("click",refreshEcbRates);el("currencyHistoryToggle")?.addEventListener("click",()=>{const p=el("currencyHistoryPanel");p.hidden=!p.hidden;el("currencyHistoryToggle").textContent=p.hidden?"Historie anzeigen":"Historie ausblenden"});el("currencyHistoryClear")?.addEventListener("click",()=>{localStorage.removeItem(KC_CURRENCY_HISTORY_KEY);renderCurrencyHistory()});
loadCurrencyCache();

normalizeOperatorProfiles();normalizeDisplayProfile();initializeSmartPackages();initializeOfferCore();renderHeader();setKeypadMode("cash");renderCategories();renderProducts();renderMoney();renderCart();renderAdminChangeStatus();drawRealQr(el("checkoutQrMini"),"CMD-CHECKOUT");setTimeout(()=>drawRealQr(el("checkoutQrMini"),"CMD-CHECKOUT"),120);window.addEventListener("load",()=>drawRealQr(el("checkoutQrMini"),"CMD-CHECKOUT"));tick();setInterval(tick,1000);setInterval(()=>refreshOfferRuntime(false),30000);
setTimeout(()=>runTuvSelfTest().catch(err=>console.error("Selbsttest fehlgeschlagen",err)),700);
setInterval(()=>runTuvSelfTest().catch(err=>console.error("Selbsttest fehlgeschlagen",err)),300000);
if("serviceWorker" in navigator&&location.protocol!=="file:"){window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js").catch(()=>{}))}


// V0.29.0 – KassenCoachCore: interaktive Schulung ohne Produktivbuchungen
(function initKassenCoach(){
  const params=new URLSearchParams(location.search); if(params.get("embeddedTraining")==="1")return; if(params.get("coach")!=="1")return;
  const steps=[
    {title:"Willkommen zur MarktKasse-Schulung",text:"Sie üben jetzt einen vollständigen Verkauf. Alle Buchungen bleiben im Trainingsspeicher und zählen nicht als echter Umsatz.",target:"#trainingBanner"},
    {title:"Warengruppen",text:"Oben wählen Sie die passende Warengruppe. Die aktive Gruppe ist deutlich hervorgehoben.",target:"#categories"},
    {title:"Artikel auswählen",text:"Tippen Sie auf einen Artikel. Er wird sofort in den Einkaufswagen übernommen. Ein kleines i öffnet Produkt- und Allergeninformationen. Bei Artikeln mit Varianten verkauft ein Tipp den Standardartikel; das Pluszeichen öffnet die Variantenauswahl.",target:"#productGrid"},
    {title:"Einkaufswagen und Menge",text:"Im Einkaufswagen können Sie die Menge mit Plus und Minus ändern. Der Mülleimer entfernt eine falsche Position.",target:"#cartList"},
    {title:"Rabatt",text:"Rabatte werden über den Rabattknopf geöffnet. Grund und Höhe werden nachvollziehbar protokolliert.",target:"#discountBtn"},
    {title:"Bezahlen",text:"Mit BEZAHLEN öffnen Sie die Zahlungsansicht. Bei Barzahlung zeigt die Kasse das Rückgeld rot, bis genügend Geld eingegeben wurde.",target:"#payBtn"},
    {title:"Weitere Funktionen",text:"Unter MEHR finden Sie selten benötigte Vorgänge. Die normale Verkaufsoberfläche bleibt dadurch übersichtlich.",target:"#moreBtn"},
    {title:"Schulung beendet",text:"Sie kennen jetzt den grundlegenden Verkaufsvorgang. Wiederholen Sie den Ablauf beliebig oft im Testmodus.",target:null}
  ];
  let index=0; const overlay=el("coachOverlay"), title=el("coachTitle"), text=el("coachText"), label=el("coachStepLabel");
  state.master.trainingMode=true; saveMaster(); applyModes(); overlay.hidden=false;
  function render(){document.querySelectorAll(".coach-highlight").forEach(x=>x.classList.remove("coach-highlight"));const step=steps[index];title.textContent=step.title;text.textContent=step.text;label.textContent=`Schritt ${index+1} von ${steps.length}`;el("coachBack").disabled=index===0;el("coachNext").textContent=index===steps.length-1?"Schulung beenden":"Weiter";if(step.target){const node=document.querySelector(step.target);node?.classList.add("coach-highlight");node?.scrollIntoView({block:"center",behavior:"smooth"})}}
  el("coachBack").onclick=()=>{if(index>0){index--;render()}};
  el("coachNext").onclick=()=>{if(index<steps.length-1){index++;render()}else{overlay.hidden=true;document.querySelectorAll(".coach-highlight").forEach(x=>x.classList.remove("coach-highlight"));notify("success","Schulung erfolgreich abgeschlossen","coach-complete")}};
  el("coachClose").onclick=()=>{overlay.hidden=true;document.querySelectorAll(".coach-highlight").forEach(x=>x.classList.remove("coach-highlight"))};
  setTimeout(render,300);
})();


// AccountChargeCore + SharedCash extension V0.29.0
const KC_ACCOUNT_KEY="kc_account_master_v029";
const KC_ACCOUNT_EVENTS_KEY="kc_account_events_v029";
const KC_ACCOUNT_INVOICES_KEY="kc_account_invoices_v029";
const KC_ACCOUNT_SYNC_KEY="kc_account_sync_snapshot_v029";
let kcSelectedAccountId=null;
function kcRead(key,fallback=[]){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return cloneData(fallback)}}
function kcWrite(key,value){localStorage.setItem(key,JSON.stringify(value))}
function kcSeedAccounts(){
  if(localStorage.getItem(KC_ACCOUNT_KEY))return;
  kcWrite(KC_ACCOUNT_KEY,[{id:"ACC-STADTMARKETING",name:"Stadtmarketing Werne",status:"active",validFrom:"2026-12-01",validUntil:"2026-12-31",limit:500,allowedGroups:["Essen"],allowProducts:[],blockProducts:[],version:1,approvedAt:new Date().toISOString()}]);
}
function kcAccounts(){kcSeedAccounts();return kcRead(KC_ACCOUNT_KEY)}
function kcEvents(){return kcRead(KC_ACCOUNT_EVENTS_KEY)}
function kcInvoices(){return kcRead(KC_ACCOUNT_INVOICES_KEY)}
function kcAccountEvents(id){return kcEvents().filter(x=>x.accountId===id&&x.status!=="void")}
function kcAccountOpenAmount(id){
  return +kcAccountEvents(id).filter(x=>["open","invoiced"].includes(x.status)).reduce((s,x)=>s+Number(x.amount||0),0).toFixed(2)
}
function kcLocalUnsynced(id){return +kcAccountEvents(id).filter(x=>x.syncStatus!=="confirmed"&&["open","invoiced"].includes(x.status)).reduce((s,x)=>s+Number(x.amount||0),0).toFixed(2)}
function kcBalanceView(id){
  const a=kcAccounts().find(x=>x.id===id),snap=kcRead(KC_ACCOUNT_SYNC_KEY,{accounts:{},fetchedAt:null});
  const central=Number(snap.accounts?.[id]?.openAmount||0),unsynced=kcLocalUnsynced(id);
  const exact=!!snap.fetchedAt;
  return {account:a,central,unsynced,total:+(central+unsynced).toFixed(2),asOf:snap.fetchedAt,quality:exact?"Zentralstand plus lokale, noch nicht bestätigte Buchungen":"Nur lokaler Kassenstand; zentraler Abgleich fehlt"};
}
function kcAccountValid(a){
  const today=localBusinessDate();
  return a.status==="active"&&(!a.validFrom||today>=a.validFrom)&&(!a.validUntil||today<=a.validUntil);
}
function kcRuleCheck(a,item){
  if((a.blockProducts||[]).includes(item.id))return {ok:false,reason:`${item.name}: Artikel gesperrt`};
  if((a.allowProducts||[]).includes(item.id))return {ok:true};
  if(!(a.allowedGroups||[]).includes(item.category))return {ok:false,reason:`${item.name}: Warengruppe ${item.category} nicht freigegeben`};
  return {ok:true};
}
function kcValidateAccountCart(a){
  const results=state.cart.map(item=>({...kcRuleCheck(a,item),item}));
  const denied=results.filter(x=>!x.ok),allowed=results.filter(x=>x.ok);
  const bal=kcBalanceView(a.id),newAmount=+(bal.total+total()).toFixed(2),limitOk=!Number(a.limit)||newAmount<=Number(a.limit);
  return {denied,allowed,bal,limitOk,newAmount,allOk:!denied.length&&limitOk&&kcAccountValid(a)};
}
function kcRenderAccountList(){
  const q=(el("accountSearch")?.value||"").toLowerCase();
  const rows=kcAccounts().filter(a=>kcAccountValid(a)&&a.name.toLowerCase().includes(q));
  el("accountList").innerHTML=rows.map(a=>{const b=kcBalanceView(a.id);return `<button type="button" data-account="${a.id}"><b>${escapeHtml(a.name)}</b><small>Offen ${money(b.total)} · Limit ${a.limit?money(a.limit):"unbegrenzt"}</small></button>`}).join("")||"<p>Kein freigegebenes Konto gefunden.</p>";
  el("accountList").querySelectorAll("[data-account]").forEach(b=>b.onclick=()=>kcSelectAccount(b.dataset.account));
}
function kcSelectAccount(id){
  kcSelectedAccountId=id;const a=kcAccounts().find(x=>x.id===id),v=kcValidateAccountCart(a),p=el("accountSelectedPanel");p.hidden=false;
  el("accountSelectedName").textContent=a.name;
  el("accountBalanceInfo").innerHTML=`<p><b>Bisher offen: ${money(v.bal.total)}</b><br><small>${v.bal.quality}${v.bal.asOf?` · Zentralstand ${new Date(v.bal.asOf).toLocaleString("de-DE")}`:""}</small></p>`;
  el("accountRuleInfo").innerHTML=`<p>Erlaubt: ${(a.allowedGroups||[]).join(", ")||"nur Einzelartikel"} · Höchstbetrag: ${a.limit?money(a.limit):"unbegrenzt"}</p>`;
  el("accountCartValidation").innerHTML=v.denied.length?`<div class="validation-error">${v.denied.map(x=>escapeHtml(x.reason)).join("<br>")}</div>`:`<div class="validation-ok">Alle Positionen freigegeben · neuer Stand ${money(v.newAmount)}</div>`;
  el("postToAccountBtn").disabled=!v.allOk;
  el("accountAcknowledge").checked=false;
}
function kcOpenAccountCharge(){
  if(!state.cart.length)return showMessage("Kein Bon","0,00 €","Bitte zuerst Artikel wählen.");
  kcSelectedAccountId=null;el("accountSelectedPanel").hidden=true;el("accountSearch").value="";kcRenderAccountList();el("accountChargeDialog").showModal();
}
async function kcPostAccount(){
  const a=kcAccounts().find(x=>x.id===kcSelectedAccountId);if(!a)return;
  const v=kcValidateAccountCart(a);if(!v.allOk)return showMessage("Kontobuchung abgelehnt","!",v.denied[0]?.reason||"Limit oder Gültigkeit verletzt.");
  if(!el("accountAcknowledge").checked)return setSystemHint("Bitte Kontenauswahl und Buchung bestätigen","warn");
  const cartCopy=cloneData(state.cart),amount=+total().toFixed(2);
  const rec=await completeSale("account-charge",{silent:true});
  const events=kcEvents();events.push({eventId:crypto.randomUUID(),accountId:a.id,accountName:a.name,transactionId:rec.transactionId,bon:rec.bon,amount,date:rec.endTime,registerId:rec.registerId,operator:rec.operator,items:cartCopy.map(i=>({id:i.id,name:i.name,category:i.category,qty:i.qty,price:i.price})),status:"open",syncStatus:"pending",configVersion:a.version||1});kcWrite(KC_ACCOUNT_EVENTS_KEY,events);
  el("accountChargeDialog").close();showMessage("Auf Konto gebucht",money(amount),`${a.name} · neuer lokaler Gesamtstand ${money(kcBalanceView(a.id).total)}`);
}
function kcOpenBalance(){
  const accounts=kcAccounts().filter(kcAccountValid);
  el("balanceDialogTitle").textContent="Kontostände";
  el("balanceDialogBody").innerHTML=accounts.map(a=>{const b=kcBalanceView(a.id);return `<button type="button" class="balance-row" data-balance-account="${a.id}"><span><b>${escapeHtml(a.name)}</b><small>${escapeHtml(b.quality)}</small></span><strong>${money(b.total)}</strong></button>`}).join("");
  el("accountBalanceDialog").showModal();
}
function kcRenderManager(){
  const groups=[...new Set(PRODUCTS.map(p=>p.category))];el("amGroups").innerHTML=groups.map(g=>`<label><input type="checkbox" value="${escapeHtml(g)}">${escapeHtml(g)}</label>`).join("");
  const rows=kcAccounts();el("amAccounts").innerHTML=rows.map(a=>`<button type="button" data-edit-account="${a.id}"><b>${escapeHtml(a.name)}</b><small>${a.status} · ${a.validFrom||"offen"} bis ${a.validUntil||"offen"} · Limit ${a.limit?money(a.limit):"∞"}</small></button>`).join("");
  el("amAccounts").querySelectorAll("[data-edit-account]").forEach(b=>b.onclick=()=>kcLoadManagerAccount(b.dataset.editAccount));
  const opts=rows.map(a=>`<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");el("invoiceAccount").innerHTML=opts;
  const inv=kcInvoices();el("invoiceSelect").innerHTML=inv.filter(x=>x.status==="issued").map(x=>`<option value="${x.invoiceId}">${x.invoiceNo} · ${escapeHtml(x.accountName)} · ${money(x.total)}</option>`).join("");
}
function kcLoadManagerAccount(id){
  const a=kcAccounts().find(x=>x.id===id);if(!a)return;el("amId").value=a.id;el("amName").value=a.name;el("amValidFrom").value=a.validFrom||"";el("amValidUntil").value=a.validUntil||"";el("amLimit").value=a.limit||"";el("amStatus").value=a.status;el("amAllowProducts").value=(a.allowProducts||[]).join(",");el("amBlockProducts").value=(a.blockProducts||[]).join(",");
  el("amGroups").querySelectorAll("input").forEach(x=>x.checked=(a.allowedGroups||[]).includes(x.value));
}
function kcSaveManagerAccount(){
  const rows=kcAccounts(),id=el("amId").value||`ACC-${crypto.randomUUID()}`,old=rows.find(x=>x.id===id);
  const a={id,name:el("amName").value.trim(),validFrom:el("amValidFrom").value,validUntil:el("amValidUntil").value,limit:Number(el("amLimit").value||0),status:el("amStatus").value,allowedGroups:[...el("amGroups").querySelectorAll("input:checked")].map(x=>x.value),allowProducts:el("amAllowProducts").value.split(",").map(x=>x.trim()).filter(Boolean),blockProducts:el("amBlockProducts").value.split(",").map(x=>x.trim()).filter(Boolean),version:Number(old?.version||0)+1,approvedAt:new Date().toISOString()};
  if(!a.name)return setSystemHint("Kontoname ist Pflicht","warn");
  if(old)rows[rows.findIndex(x=>x.id===id)]=a;else rows.push(a);kcWrite(KC_ACCOUNT_KEY,rows);recordAdminChange("account",old?"update":"create",id,old||null,a);kcRenderManager();setSystemHint("Konto freigegeben und für Synchronisation vorgemerkt");
}
function kcCreateInvoice(){
  const accountId=el("invoiceAccount").value,from=el("invoiceFrom").value,until=el("invoiceUntil").value,a=kcAccounts().find(x=>x.id===accountId);
  const events=kcEvents(),selected=events.filter(e=>e.accountId===accountId&&e.status==="open"&&(!from||e.date.slice(0,10)>=from)&&(!until||e.date.slice(0,10)<=until));
  if(!selected.length)return el("invoiceResult").textContent="Keine offenen Buchungen im Zeitraum.";
  const inv=kcInvoices(),invoiceNo=`RG-${new Date().getFullYear()}-${String(inv.length+1).padStart(4,"0")}`,invoiceId=crypto.randomUUID(),sum=+selected.reduce((s,e)=>s+e.amount,0).toFixed(2);
  selected.forEach(e=>{e.status="invoiced";e.invoiceId=invoiceId});kcWrite(KC_ACCOUNT_EVENTS_KEY,events);
  inv.push({invoiceId,invoiceNo,accountId,accountName:a.name,from,until,total:sum,status:"issued",createdAt:new Date().toISOString(),eventIds:selected.map(e=>e.eventId)});kcWrite(KC_ACCOUNT_INVOICES_KEY,inv);kcRenderManager();el("invoiceResult").textContent=`${invoiceNo} über ${money(sum)} erzeugt. ${selected.length} Buchungen gemeinsam in Rechnung gestellt.`;
}
function kcMarkInvoicePaid(){
  const id=el("invoiceSelect").value,inv=kcInvoices(),invoice=inv.find(x=>x.invoiceId===id);if(!invoice)return;
  invoice.status="paid";invoice.paidAt=new Date().toISOString();const events=kcEvents();events.filter(e=>e.invoiceId===id).forEach(e=>e.status="paid");kcWrite(KC_ACCOUNT_EVENTS_KEY,events);kcWrite(KC_ACCOUNT_INVOICES_KEY,inv);kcRenderManager();el("invoiceResult").textContent=`${invoice.invoiceNo}: Zahlungseingang ${money(invoice.total)} verbucht; alle enthaltenen Artikelbuchungen sind bezahlt.`;
}
function kcCreateSharedCash(){
  const shared=el("sharedCashEnabled").checked,amount=Number(el("sharedCashAmount").value),regs=el("sharedCashRegisters").value.split(",").map(x=>x.trim()).filter(Boolean),date=el("sharedCashDate").value||localBusinessDate();
  if(!amount||shared&&!regs.length)return;
  const p={format:"KC_CASH_TRANSFER",transferId:crypto.randomUUID(),type:"opening",scope:shared?"shared":"register",poolId:shared?`POOL-${date}-${payloadChecksum(regs.join("|"))}`:null,poolName:el("sharedCashName").value.trim(),registerId:shared?null:state.master.registerId,registerIds:shared?regs:undefined,effectiveDate:date,total:amount,breakdown:{[amount]:1},looseTotal:amount,rollTotal:0,note:shared?"Gemeinsamer Wechselgeldbestand für mehrere Kassen":"Kassenbezogener Anfangsbestand",createdAt:new Date().toISOString()};p.checksum=checksumObject(p);
  el("sharedCashPayloadOut").value=encodePayload("KCASH1:",p);el("sharedCashStatus").textContent=shared?`${money(amount)} gelten gemeinsam für ${regs.join(", ")}. Jede Kasse darf denselben Pool-Code einmal übernehmen; der Pool wird nicht doppelt zum Gesamtbestand addiert.`:`${money(amount)} für ${state.master.registerId}.`;
}

// V0.29.0 UI-Fix: „Stimmt so“ setzt den gegebenen Betrag exakt auf den Zahlbetrag.
el("exactCashBtn")?.addEventListener("click",()=>{
  const due=total();
  if(toCents(due)<=0)return setSystemHint("Noch kein Zahlbetrag vorhanden","warn");
  setGiven(due);
  state.keypadBuffer="";
  setSystemHint(`Stimmt so · ${money(due)} passend übernommen · BAR-Taste schließt den Bon ab`);
});

el("accountChargeBtn")?.addEventListener("click",kcOpenAccountCharge);
el("accountSearch")?.addEventListener("input",kcRenderAccountList);
el("postToAccountBtn")?.addEventListener("click",kcPostAccount);
el("accountBalanceOpen")?.addEventListener("click",()=>{el("moreDialog")?.close();kcOpenBalance()});
el("accountManagerOpen")?.addEventListener("click",()=>{kcRenderManager();el("accountManagerDialog").showModal()});
el("sharedCashManagerOpen")?.addEventListener("click",()=>{el("sharedCashDate").value=localBusinessDate();el("sharedCashManagerDialog").showModal()});
el("amSave")?.addEventListener("click",kcSaveManagerAccount);
el("createInvoiceBtn")?.addEventListener("click",kcCreateInvoice);
el("markInvoicePaidBtn")?.addEventListener("click",kcMarkInvoicePaid);
el("createSharedCashTransfer")?.addEventListener("click",kcCreateSharedCash);
kcSeedAccounts();
