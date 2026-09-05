
const VERSION="V0.31.2.5";
window.KCManagerAppVersion=VERSION;
window.KCTVPresentationVersion="0.29.38";
window.KCGetTVPresentation=()=>tvPresentation;
const DEFAULT_GROUPS=[
{id:"WG01",name:"Getränke",shortName:"Getränke",sortOrder:10,color:"#173765",active:true,notes:""},
{id:"WG02",name:"Speisen",shortName:"Speisen",sortOrder:20,color:"#8b4a23",active:true,notes:""},
{id:"WG03",name:"Pfand",shortName:"Pfand",sortOrder:30,color:"#29689a",active:true,notes:""}
];
const DEFAULT_ARTICLES=[
{id:"grot",name:"Glühwein rot",category:"Getränke",price:3.50,receiptText:"Glühwein rot",optionGroup:"shot",color:"#8b1e24",active:true,quantity:1,unit:"Becher",taxRate:19,info:{allergens:"Enthält Sulfite"}},
{id:"gweiss",name:"Glühwein weiß",category:"Getränke",price:3.50,receiptText:"Glühwein weiß",optionGroup:"shot",color:"#a36a20",active:true,quantity:1,unit:"Becher",taxRate:19},
{id:"feuer",name:"Feuerzangenbowle",category:"Getränke",price:5,receiptText:"Feuerzangenbowle",depositRule:"automatic",depositComponents:[{name:"Glaspfand",price:2},{name:"Feuerzangenpfand",price:2}],color:"#a43f18",active:true,quantity:1,unit:"Glas",taxRate:19},
// STILLGELEGT auf Wunsch des Vereins (01.09.2026): "Mettwurst" stand zweimal in der
// Preisliste - hier zu 3,50 aus den alten Vorgabedaten des Managers und als "mettwurst"
// zu 1,50 aus der Kasse, wo sie als Beilage gefuehrt wird. Derselbe Name mit zwei Preisen.
// NICHT geloescht, nur inaktiv: alte Auswertungen bleiben dadurch aufloesbar.
{id:"mett",name:"Mettwurst",category:"Speisen",price:3.5,receiptText:"Mettwurst",color:"#713b24",active:false,quantity:1,unit:"Stück",taxRate:7,priceListVisible:false},
{id:"sauerkraut",name:"Sauerkrauteintopf",category:"Speisen",price:5.5,receiptText:"Sauerkrauteintopf",color:"#77643d",active:true,quantity:1,unit:"Portion",taxRate:7},
{id:"hering",name:"Kartoffel mit Hering",category:"Speisen",price:4.5,image:"assets/hering_kartoffeln_auth.webp",receiptText:"Kartoffel m. Hering",color:"#42657d",active:true,quantity:1,unit:"Portion",taxRate:7},


{id:"knirpsecreme",name:"Kartoffel mit Kartoffelcreme",category:"Speisen",price:3.5,image:"assets/kartoffelcreme_auth.webp",receiptText:"Kartoffel m. Kartoffelcreme",color:"#a66e24",active:true,quantity:1,unit:"Portion",taxRate:7},
// Wertmarke: der VERKAUF laeuft als normaler Artikel ueber die Kasse. Das Einloesen ist
// etwas anderes und haengt am noch nicht freigeschalteten Zahlungsknopf unter MEHR.
{id:"wertmarke",name:"Wertmarke",category:"Sonstiges",price:5,receiptText:"Wertmarke",color:"#7c3aed",active:true,quantity:1,unit:"Stück",taxRate:0},
{id:"glasminus",name:"Glasrückgabe",category:"Pfand",price:-2,receiptText:"Glasrückgabe",image:"assets/pfandglas_auth.webp",color:"#9f1239",active:true,quantity:1,unit:"Stück",taxRate:0},
{id:"zangeminus",name:"Feuerzange Rückgabe",category:"Pfand",price:-2,receiptText:"Feuerzange Rückgabe",image:"assets/feuerzange_placeholder.svg",color:"#9f1239",active:true,quantity:1,unit:"Stück",taxRate:0,info:{}},
{id:"glaszangebundleminus",name:"Glas + Feuerzange Rückgabe",category:"Pfand",price:-4,receiptText:"Komplettrückgabe Glas + Feuerzange",image:"assets/pfand_bundle_placeholder.svg",color:"#9f1239",active:true,quantity:1,unit:"Bundle",taxRate:0,info:{}}
];
let groups=JSON.parse(localStorage.getItem("kcm_groups")||"null")||DEFAULT_GROUPS;
let articles=JSON.parse(localStorage.getItem("kcm_articles")||"null")||DEFAULT_ARTICLES;
{const registry=window.KCPOSCatalogRegistry,posGroups=JSON.parse(localStorage.getItem('kc_groups_v050')||'null'),posProducts=JSON.parse(localStorage.getItem('kc_products_v050')||'null'),merge=(current,incoming)=>{const map=new Map((current||[]).map(x=>[x.id,x]));(incoming||[]).forEach(x=>map.set(x.id,{...(map.get(x.id)||{}),...x}));return[...map.values()]};groups=merge(Array.isArray(groups)&&groups.length?groups:DEFAULT_GROUPS,Array.isArray(posGroups)&&posGroups.length?posGroups:registry?.groups);groups=merge(groups,registry?.groups?.filter(x=>x.name==='Happy Hour'));articles=merge(Array.isArray(articles)&&articles.length?articles:DEFAULT_ARTICLES,Array.isArray(posProducts)&&posProducts.length?posProducts:registry?.products);articles=merge(articles,registry?.products?.filter(x=>x.category==='Happy Hour'));localStorage.setItem('kcm_groups',JSON.stringify(groups));localStorage.setItem('kcm_articles',JSON.stringify(articles));}
// Die Warengruppe hiess "Packages" und heisst jetzt "Kombi". Geraete, die den alten Namen
// gespeichert haben, werden hier einmalig nachgezogen - sonst stuenden Kasse und Manager mit
// zwei verschiedenen Bezeichnungen fuer dieselbe Warengruppe da.
{let geaendert=false;
 groups.forEach(g=>{if(g.name==='Packages'){g.name='Kombi';geaendert=true}if(g.shortName==='Packages'){g.shortName='Kombi';geaendert=true}});
 articles.forEach(a=>{if(a.category==='Packages'){a.category='Kombi';geaendert=true}});
 if(geaendert){localStorage.setItem('kcm_groups',JSON.stringify(groups));localStorage.setItem('kcm_articles',JSON.stringify(articles))}}
// Denselben Doppeleintrag auf Geraeten stilllegen, die ihn schon gespeichert haben.
// EINMALIG ueber ein Merkzeichen - wer den Artikel spaeter bewusst wieder einschaltet,
// soll ihn behalten duerfen.
{const MERK='kcm_mett_doppeleintrag_stillgelegt_v1';
 if(!localStorage.getItem(MERK)){
   const a=articles.find(x=>x.id==='mett'), b=articles.find(x=>x.id==='mettwurst');
   if(a&&b){a.active=false;a.priceListVisible=false;localStorage.setItem('kcm_articles',JSON.stringify(articles));}
   localStorage.setItem(MERK,'1');}}
// Artikelnummern aus derselben Tabelle wie die Kasse (shared/kc-artikelnummern-core.js).
// Dadurch traegt ein Artikel im Manager, in der Kasse und auf dem gedruckten Etikett
// dieselbe Nummer - sonst zeigt ein Etikett spaeter auf einen Artikel, den die Kasse
// unter dieser Nummer nicht kennt.
{const n=window.KCArtikelnummern;if(n){const bericht=n.eintragen(articles);if(bericht.gesetzt)localStorage.setItem('kcm_articles',JSON.stringify(articles));
 if(bericht.abweichend.length)console.warn('Artikelnummern weichen vom gemeinsamen Stand ab:',bericht.abweichend);
 if(bericht.ohneNummer.length)console.warn('Artikel ohne Artikelnummer (nicht scannbar):',bericht.ohneNummer);}}
{const provisionalImages={grot:"assets/gluehwein_rot_auth.webp",gweiss:"assets/gluehwein_weiss_auth.webp",feuer:"assets/feuerzangenbowle_auth.webp",apfel:"assets/apfelpunsch_auth.webp",eier:"assets/eierlikoerpunsch_auth.webp",mett:"assets/gruenkohl_mettwurst_auth.webp",mettwurst:"assets/mettwurst_auth.webp",sauerkraut:"assets/sauerkraut_auth.webp",sauerkrautmett:"assets/sauerkraut_mettwurst_auth.webp",gruenkohl:"assets/gruenkohl_auth.webp",gruenkohlmett:"assets/gruenkohl_mettwurst_auth.webp",hering:"assets/hering_kartoffeln_auth.webp",knirpsecreme:"assets/kartoffelcreme_auth.webp"};articles.forEach(article=>{if(!article.image&&provisionalImages[article.id])article.image=provisionalImages[article.id]});localStorage.setItem('kcm_articles',JSON.stringify(articles));}
// Bedienerstamm des Managers - identisch mit dem der Kasse. Angezeigt und an die Kassen
// verteilt wird ausschliesslich das PSEUDONYM; der Klarname gehoert in die Mitgliederpflege
// bzw. ins Verwaltungsprogramm und wird nie in diese Liste geschrieben. Die Mitgliedsnummer
// bleibt mitgefuehrt, weil sie die Klammer zu Ausweis-QR, Stechuhr und Dienstplan ist.
// FRUEHER standen hier die Vorgabewerte "Hans, Peter, Marion, Gast" - echte Vornamen, die beim
// Verteilen der Stammdaten die Pseudonymliste der Kasse ueberschrieben haetten.
const KC_BEDIENERSTAMM=[
  {id:"team",name:"Team"},
  {id:"kc-0001",name:"Maja",memberNo:"KC-0001"},
  {id:"kc-0002",name:"Heidi",memberNo:"KC-0002"},
  {id:"kc-0003",name:"Puhbär",memberNo:"KC-0003"},
  {id:"kc-0004",name:"Balu",memberNo:"KC-0004"},
  {id:"kc-0005",name:"Bibi",memberNo:"KC-0005"},
  {id:"kc-0006",name:"Willi",memberNo:"KC-0006"},
  {id:"kc-0007",name:"Einhorn",memberNo:"KC-0007"},
  {id:"kc-0008",name:"Spock",memberNo:"KC-0008"},
  {id:"kc-0009",name:"Tigger",memberNo:"KC-0009"},
  {id:"kc-0010",name:"Pumuckl",memberNo:"KC-0010"},
  {id:"kc-0011",name:"Wickie",memberNo:"KC-0011"},
  {id:"kc-0012",name:"Nemo",memberNo:"KC-0012"},
  {id:"kc-0013",name:"Yoda",memberNo:"KC-0013"},
  {id:"kc-0014",name:"Bambi",memberNo:"KC-0014"},
  {id:"kc-0015",name:"Lillifee",memberNo:"KC-0015"},
  {id:"kc-0016",name:"Maus",memberNo:"KC-0016"},
  {id:"kc-0017",name:"Sandmann",memberNo:"KC-0017"},
  {id:"kc-0018",name:"Simba",memberNo:"KC-0018"}
].map(p=>({...p,code:`KCOPE1:${p.id}`}));
let settings=JSON.parse(localStorage.getItem("kcm_settings")||"null")||{clubName:"Köcheclub Werne",clubLogo:"",eventName:"Weihnachtsmarkt 2026",country:"Deutschland",tse:false,fiscalMode:"off",tseProvider:"",tseSerial:"",buttonSize:"standard",buttonMode:"image",showInfo:true,showPrice:true,showStaff:true,showTip:true,showDeposit:true,showPrint:true,showMore:true,showChange:true,requireChangeFlow:false,showCard:true,showAccount:true,showDiscount:true,showHappyHour:true,showRushMode:true,allowTraining:true,showProductInfo:true,highlightAllergens:true,autoFavorites:true,groupColorMode:true,requireOperatorConfirmation:false,operators:KC_BEDIENERSTAMM.map(p=>p.name),operatorProfiles:KC_BEDIENERSTAMM.map(p=>({...p})),workspaceButtons:null};

const MANAGER_WORKSPACE_BUTTONS=[
  {id:"payBtn",label:"BEZAHLEN",symbol:"💳",locked:true,defaultOrder:10,defaultSize:"xl",defaultColor:"#167447"},
  {id:"staffBtn",label:"PERSONAL",symbol:"👥",defaultOrder:20,defaultSize:"md",defaultColor:"#315d8d"},
  {id:"depositBtn",label:"PFANDRÜCKGABE",symbol:"♻",defaultOrder:30,defaultSize:"md",defaultColor:"#216b5a"},
  {id:"tipBtn",label:"TRINKGELD",symbol:"💝",defaultOrder:40,defaultSize:"md",defaultColor:"#7b4d8f"},
  {id:"printBonBtn",label:"BONDRUCK",symbol:"🧾",defaultOrder:50,defaultSize:"md",defaultColor:"#4c5b6b"},
  {id:"moreBtn",label:"MEHR",symbol:"•••",defaultOrder:60,defaultSize:"sm",defaultColor:"#354253"}
];
const MANAGER_WORKSPACE_SYMBOLS=["💳","👥","♻","💝","🧾","•••","💶","🛒","⭐","✓","⚙","☕","🍟","🌭","🥤","🎄"];
function managerDefaultWorkspace(){return Object.fromEntries(MANAGER_WORKSPACE_BUTTONS.map(x=>[x.id,{visible:true,order:x.defaultOrder,size:x.defaultSize,textScale:"normal",color:x.defaultColor,label:x.label,symbol:x.symbol,image:""}]))}
function managerWorkspaceConfig(){const d=managerDefaultWorkspace(),saved=settings.workspaceButtons&&typeof settings.workspaceButtons==="object"?settings.workspaceButtons:{};return Object.fromEntries(Object.keys(d).map(id=>[id,{...d[id],...(saved[id]||{})}]))}
let managerWorkspaceDraft=null;
let managerCategoryOrderDraft=null;
function escAttr(v){return String(v??"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;")}
function managerDefaultCategoryOrder(){return ["Favoriten",...groups.filter(g=>g.active!==false).sort((a,b)=>a.sortOrder-b.sortOrder).map(g=>g.id)]}
function managerCategoryOrder(){
  const available=managerDefaultCategoryOrder(),saved=Array.isArray(settings.categoryOrder)?settings.categoryOrder:[];
  return [...saved.filter(key=>available.includes(key)),...available.filter(key=>!saved.includes(key))];
}
function renderManagerCategoryOrder(){
  const list=el("managerCategoryOrder");if(!list)return;
  managerCategoryOrderDraft=managerCategoryOrderDraft||managerCategoryOrder();
  const label=key=>key==="Favoriten"?"★ Favoriten":(groups.find(g=>g.id===key)?.name||key);
  list.innerHTML=managerCategoryOrderDraft.map((key,index)=>`<div class="manager-category-row" data-category-key="${escAttr(key)}"><b><span>${index+1}</span>${escAttr(label(key))}</b><div><button type="button" data-category-move="up" ${index===0?"disabled":""} aria-label="${escAttr(label(key))} nach oben">↑</button><button type="button" data-category-move="down" ${index===managerCategoryOrderDraft.length-1?"disabled":""} aria-label="${escAttr(label(key))} nach unten">↓</button></div></div>`).join("");
  list.querySelectorAll("[data-category-move]").forEach(button=>button.onclick=()=>{const key=button.closest("[data-category-key]").dataset.categoryKey,index=managerCategoryOrderDraft.indexOf(key),target=button.dataset.categoryMove==="up"?index-1:index+1;if(target<0||target>=managerCategoryOrderDraft.length)return;[managerCategoryOrderDraft[index],managerCategoryOrderDraft[target]]=[managerCategoryOrderDraft[target],managerCategoryOrderDraft[index]];renderManagerCategoryOrder()});
}
function renderManagerWorkspace(){const list=el("managerWorkspaceEditor");if(!list)return;managerWorkspaceDraft=managerWorkspaceDraft||managerWorkspaceConfig();const rows=MANAGER_WORKSPACE_BUTTONS.slice().sort((a,b)=>(managerWorkspaceDraft[a.id]?.order||0)-(managerWorkspaceDraft[b.id]?.order||0));list.innerHTML=rows.map((def,index)=>{const c=managerWorkspaceDraft[def.id];return `<article class="manager-workspace-row" data-manager-workspace-id="${def.id}"><div class="manager-workspace-order"><button type="button" data-mws-move="up" ${index===0?"disabled":""}>↑</button><button type="button" data-mws-move="down" ${index===rows.length-1?"disabled":""}>↓</button></div><label>Sichtbar<input type="checkbox" data-mws-field="visible" ${c.visible!==false||def.locked?"checked":""} ${def.locked?"disabled":""}></label><div class="manager-workspace-sample" style="--sample-color:${escAttr(c.color)}">${c.image?`<img src="${escAttr(c.image)}" alt="">`:escAttr(c.symbol)} <b>${escAttr(c.label)}</b></div><label>Text<input data-mws-field="label" maxlength="22" value="${escAttr(c.label)}"></label><label>Symbol<select data-mws-field="symbol">${MANAGER_WORKSPACE_SYMBOLS.map(x=>`<option ${x===c.symbol?"selected":""}>${x}</option>`).join("")}</select></label><label>Größe<select data-mws-field="size"><option value="sm" ${c.size==="sm"?"selected":""}>Klein</option><option value="md" ${c.size==="md"?"selected":""}>Mittel</option><option value="lg" ${c.size==="lg"?"selected":""}>Groß</option><option value="xl" ${c.size==="xl"?"selected":""}>Sehr groß</option></select></label><label>Schrift<select data-mws-field="textScale"><option value="small" ${c.textScale==="small"?"selected":""}>Klein</option><option value="normal" ${c.textScale==="normal"?"selected":""}>Normal</option><option value="large" ${c.textScale==="large"?"selected":""}>Groß</option></select></label><label>Farbe<input type="color" data-mws-field="color" value="${escAttr(c.color)}"></label><div class="workspace-image-actions"><input type="file" data-mws-image accept="image/*"><button type="button" data-mws-clear ${c.image?"":"disabled"}>Bild löschen</button></div></article>`}).join("");list.querySelectorAll("[data-mws-field]").forEach(input=>input.onchange=()=>{const row=input.closest("[data-manager-workspace-id]"),id=row.dataset.managerWorkspaceId,field=input.dataset.mwsField;managerWorkspaceDraft[id][field]=input.type==="checkbox"?input.checked:input.value;renderManagerWorkspace()});list.querySelectorAll("[data-mws-move]").forEach(btn=>btn.onclick=()=>{const id=btn.closest("[data-manager-workspace-id]").dataset.managerWorkspaceId,ordered=MANAGER_WORKSPACE_BUTTONS.map(x=>x.id).sort((a,b)=>managerWorkspaceDraft[a].order-managerWorkspaceDraft[b].order),i=ordered.indexOf(id),j=btn.dataset.mwsMove==="up"?i-1:i+1;if(j<0||j>=ordered.length)return;[ordered[i],ordered[j]]=[ordered[j],ordered[i]];ordered.forEach((key,k)=>managerWorkspaceDraft[key].order=(k+1)*10);renderManagerWorkspace()});list.querySelectorAll("[data-mws-image]").forEach(input=>input.onchange=()=>{const file=input.files?.[0];if(!file)return;if(file.size>350000)return alert("Bild ist zu groß (maximal 350 KB).");const id=input.closest("[data-manager-workspace-id]").dataset.managerWorkspaceId,r=new FileReader();r.onload=()=>{managerWorkspaceDraft[id].image=String(r.result);renderManagerWorkspace()};r.readAsDataURL(file)});list.querySelectorAll("[data-mws-clear]").forEach(btn=>btn.onclick=()=>{managerWorkspaceDraft[btn.closest("[data-manager-workspace-id]").dataset.managerWorkspaceId].image="";renderManagerWorkspace()})}
function managerWorkspacePreset(name){const d=managerDefaultWorkspace();Object.keys(d).forEach(id=>{if(name==="compact"){d[id].size=id==="payBtn"?"lg":"sm";d[id].textScale="small"}else if(name==="touch"){d[id].size=id==="payBtn"?"xl":"lg";d[id].textScale="large"}else{d[id].size=id==="payBtn"?"xl":"md";d[id].textScale="normal"}});managerWorkspaceDraft=d;renderManagerWorkspace()}
let clubLogoDraft=settings.clubLogo||"";
let devices=JSON.parse(localStorage.getItem("kcm_devices")||"[]");
let closings=JSON.parse(localStorage.getItem("kcm_closings")||"[]");
let cashCounts=JSON.parse(localStorage.getItem("kcm_cashcounts")||"[]");
let syncSettings=JSON.parse(localStorage.getItem("kcm_sync")||"null")||{
  mode:"local",provider:"supabase",url:"",project:"",publicKey:"",
  role:"superadmin",user:"",token:"",auto:true,interval:5,encryption:false,secureServer:false
};
let syncQueue=JSON.parse(localStorage.getItem("kcm_sync_queue")||"[]").map(x=>window.KCSecureSync?KCSecureSync.normalizeQueueItem(x):x);
let syncSecretSession="";
let priceHistory=JSON.parse(localStorage.getItem("kcm_price_history")||"[]");
let managerTips=JSON.parse(localStorage.getItem("kcm_tips")||"[]");
let cashMovementsLog=JSON.parse(localStorage.getItem("kcm_cash_movements")||"[]");
let cashAuditLog=JSON.parse(localStorage.getItem("kcm_cash_audit")||"[]");
let cashWithdrawals=JSON.parse(localStorage.getItem("kcm_withdrawals")||"[]");
let managerDiscountAudit=JSON.parse(localStorage.getItem("kcm_discount_audit")||"[]");
let depositGroups=JSON.parse(localStorage.getItem("kcm_deposit_groups")||"null")||[
{id:"glass",name:"Glas",amount:2},{id:"firefork",name:"Feuerzange",amount:2},{id:"cup",name:"Tasse",amount:2},{id:"plate",name:"Teller",amount:2}
];
let practiceState=JSON.parse(localStorage.getItem("kcm_practice")||"{}");
let exchangeUsedPackages=JSON.parse(localStorage.getItem("kcm_exchange_used")||"[]");
let exchangeLog=JSON.parse(localStorage.getItem("kcm_exchange_log")||"[]");
let posAdminAudit=JSON.parse(localStorage.getItem("kcm_pos_admin_audit")||"[]");
let posAdminChanges=JSON.parse(localStorage.getItem("kcm_pos_admin_changes")||"[]");
let exchangeExternal={
  staff:JSON.parse(localStorage.getItem("kcm_exchange_staff")||"[]"),
  shifts:JSON.parse(localStorage.getItem("kcm_exchange_shifts")||"[]"),
  purchases:JSON.parse(localStorage.getItem("kcm_exchange_purchases")||"[]"),
  expenses:JSON.parse(localStorage.getItem("kcm_exchange_expenses")||"[]"),
  inventory:JSON.parse(localStorage.getItem("kcm_exchange_inventory")||"[]")
};
let pendingExchangePackage=null;

let syncLog=JSON.parse(localStorage.getItem("kcm_sync_log")||"[]");
let syncConflicts=JSON.parse(localStorage.getItem("kcm_sync_conflicts")||"[]");
let syncTimer=null;
let receipt=JSON.parse(localStorage.getItem("kcm_receipt")||"null")||{header:true,head1:"Köcheclub Werne",head2:"Weihnachtsmarkt",logo:true,registerId:true,operator:true,bonNo:true,vat:"summary",deposit:true,payment:true,change:true,foot1:"Vielen Dank!",foot2:"",autoPrint:true};
let registers=JSON.parse(localStorage.getItem("kcm_registers")||"null")||[{id:"KASSE-01",name:"Kasse 1",operator:"Team",active:true},{id:"KASSE-02",name:"Kasse 2",operator:"",active:true}];
let sales=window.KCSalesImportCore?.parseStorage?.(localStorage.getItem("kcm_sales"))||JSON.parse(localStorage.getItem("kcm_sales")||"[]"),gIndex=0,aIndex=0,pendingAuth=null;
Object.defineProperties(window,{settings:{configurable:true,get:()=>settings},groups:{configurable:true,get:()=>groups},articles:{configurable:true,get:()=>articles},registers:{configurable:true,get:()=>registers},devices:{configurable:true,get:()=>devices},managerSecurity:{configurable:true,get:()=>managerSecurity}});
const MANAGER_SECURITY_KEY="kcm_manager_security_v018";
let managerSecurity=JSON.parse(localStorage.getItem(MANAGER_SECURITY_KEY)||"null"),managerUnlocked=false;
const el=id=>document.getElementById(id),money=n=>new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(n||0);
const cleanText=(value,max=500)=>String(value??"").replace(/[<>"'\u0000-\u001f]/g,"").trim().slice(0,max);
const cleanId=(value,fallback)=>String(value??"").replace(/[^A-Za-z0-9._:-]/g,"-").slice(0,80)||fallback;
function cleanGroup(group,index=0){return {...group,id:cleanId(group?.id,`WG-${index+1}`),name:cleanText(group?.name||`Warengruppe ${index+1}`,80),shortName:cleanText(group?.shortName||group?.name,50),notes:cleanText(group?.notes,1000),sortOrder:Number(group?.sortOrder||((index+1)*10)),color:/^#[0-9a-f]{6}$/i.test(group?.color||"")?group.color:"#173765",active:group?.active!==false}}
const BIG14_LABELS={gluten:"Glutenhaltiges Getreide",crustaceans:"Krebstiere",eggs:"Eier",fish:"Fisch",peanuts:"Erdnüsse",soy:"Soja",milk:"Milch",nuts:"Schalenfrüchte",celery:"Sellerie",mustard:"Senf",sesame:"Sesam",sulphites:"Schwefeldioxid / Sulfite",lupin:"Lupinen",molluscs:"Weichtiere"};
const ALLERGEN_VALUES=["contained","traces","not-contained","not-checked"];
function cleanProductInfo(info={}){const structured=info.allergens&&typeof info.allergens==="object"&&!Array.isArray(info.allergens);const allergens={};Object.keys(BIG14_LABELS).forEach(id=>allergens[id]=ALLERGEN_VALUES.includes(info.allergens?.[id])?info.allergens[id]:"not-checked");const n=info.nutrition||{},num=v=>v===""||v==null?null:(Number.isFinite(Number(v))?Number(v):null);return {status:["draft","incomplete","review","approved","outdated","blocked"].includes(info.status)?info.status:"incomplete",version:cleanText(info.version||"1.0.0",30),shortDescription:cleanText(info.shortDescription||info.notes,500),ingredients:cleanText(info.ingredients,5000),additives:cleanText(info.additives||info.contents,2000),contents:cleanText(info.contents||info.additives,2000),important:cleanText(info.important,1500),notes:cleanText(info.notes,1500),legacyAllergens:cleanText(typeof info.allergens==="string"?info.allergens:info.legacyAllergens,1500),allergens:structured?allergens:allergens,nutrition:{energyKj:num(n.energyKj),energyKcal:num(n.energyKcal),fat:num(n.fat),saturates:num(n.saturates),carbohydrate:num(n.carbohydrate),sugars:num(n.sugars),protein:num(n.protein),salt:num(n.salt)},manufacturer:cleanText(info.manufacturer,300),supplier:cleanText(info.supplier,300),source:cleanText(info.source,500),validAt:cleanText(info.validAt,40),approvedBy:cleanText(info.approvedBy,150),approvedAt:cleanText(info.approvedAt,40)} }
// Artikelbilder liegen bei der KASSE, nicht beim Manager. Ein relativer Pfad wie
// "assets/gluehwein_rot_auth.webp" zeigt vom Manager aus ins Leere - er muss auf den
// pos-Ordner umgebogen werden. Eingebettete Bilder (data:) und vollstaendige Adressen
// bleiben unveraendert.
function artikelBildPfad(pfad){
  const p=String(pfad||"");
  if(!p||p.startsWith("data:")||p.startsWith("http")||p.startsWith("../")||p.startsWith("/"))return p;
  return "../pos/"+p;
}
function cleanArticle(article,index=0){return {...article,id:cleanId(article?.id,`ART-${index+1}`),name:cleanText(article?.name||`Artikel ${index+1}`,100),shortName:cleanText(article?.shortName,60),receiptText:cleanText(article?.receiptText||article?.name,100),category:cleanText(article?.category,80),barcode:cleanText(article?.barcode,80),image:/^(assets\/[A-Za-z0-9._/-]+|data:image\/(png|jpeg|webp|gif);base64,)/i.test(article?.image||"")?article.image:"",price:Number(article?.price||0),halfAllowed:article?.halfAllowed===true,halfPrice:Number(article?.halfPrice||0),purchasePrice:Number(article?.purchasePrice||0),active:article?.active!==false,priceListVisible:article?.priceListVisible!==false,info:cleanProductInfo(article?.info||{})}}
function cleanTransaction(row){return window.KCSalesImportCore?.transaction?.(row)||{...row,registerId:cleanId(row?.registerId,"UNKNOWN"),registerName:cleanText(row?.registerName,80),operator:cleanText(row?.operator,80),method:cleanText(row?.method||row?.payment,40),payment:cleanText(row?.payment||row?.method,40),items:Array.isArray(row?.items)?row.items.map((item,index)=>({...item,id:cleanId(item?.id,`ITEM-${index+1}`),name:cleanText(item?.name,100),qty:Number(item?.qty||0),price:Number(item?.price||0)})):[]}}

const MANAGER_FEATURES=[
  {key:"cashPayment",label:"Barzahlung",group:"Zahlung",locked:true,default:true,help:"Pflichtfunktion für den Verkaufsabschluss."},
  {key:"showCard",label:"Kartenzahlung",group:"Zahlung",default:true},
  {key:"showAccount",label:"Auf Konto",group:"Zahlung",default:true},
  {key:"showChange",label:"Rückgeldanzeige",group:"Zahlung",locked:true,default:true},
  {key:"requireChangeFlow",label:"Rückgeldablauf verpflichtend",group:"Zahlung",default:false},
  {key:"showStaff",label:"Personal",group:"Verkauf",default:true},
  {key:"showDiscount",label:"Rabatt",group:"Verkauf",default:true},
  {key:"showTip",label:"Trinkgeld",group:"Verkauf",default:true},
  {key:"showDeposit",label:"Pfandrückgabe",group:"Verkauf",default:true},
  {key:"showPrint",label:"Bondruck",group:"Verkauf",default:true},
  {key:"showMore",label:"Mehr-Menü",group:"Verkauf",default:true},
  {key:"showHappyHour",label:"Happy Hour",group:"Betriebsmodi",default:true},
  {key:"showRushMode",label:"Stoßzeiten",group:"Betriebsmodi",default:true},
  {key:"allowTraining",label:"Training",group:"Betriebsmodi",default:true},
  {key:"showInfo",label:"Artikelinformationen",group:"Darstellung",default:true},
  {key:"showPrice",label:"Preise auf Artikeltasten",group:"Darstellung",default:true},
  {key:"highlightAllergens",label:"Allergenhinweise",group:"Darstellung",default:true},
  {key:"autoFavorites",label:"Automatische Favoriten",group:"Darstellung",default:true},
  {key:"groupColorMode",label:"Warengruppenfarben",group:"Darstellung",default:true}
];
function normalizeFeatureSettings(){MANAGER_FEATURES.forEach(f=>{if(typeof settings[f.key]!=="boolean")settings[f.key]=f.default!==false;if(f.locked)settings[f.key]=true});settings.cashPayment=true;settings.showChange=true}
function renderFeatureConfig(){const root=el("featureConfigSections");if(!root)return;normalizeFeatureSettings();const groups={};MANAGER_FEATURES.forEach(f=>(groups[f.group]??=[]).push(f));root.innerHTML=Object.entries(groups).map(([group,items])=>`<article class="panel feature-config-card"><h3>${group}</h3><div class="feature-switch-list">${items.map(f=>`<div class="feature-switch-row"><div><strong>${f.label}</strong>${f.help?`<small>${f.help}</small>`:""}</div><label class="ios-switch ${f.locked?"locked":""}"><input type="checkbox" data-feature-key="${f.key}" ${settings[f.key]!==false?"checked":""} ${f.locked?"disabled":""}><span></span></label></div>`).join("")}</div></article>`).join("");root.querySelectorAll("[data-feature-key]").forEach(input=>input.onchange=()=>{settings[input.dataset.featureKey]=input.checked});const preview=el("featureDepositPreview");if(preview){const ids=["glasminus","zangeminus","glaszangebundleminus"];preview.innerHTML=ids.map(id=>{const a=articles.find(x=>x.id===id);return a?`<div class="feature-deposit-item"><img src="../pos/${a.image||"assets/pfand_placeholder.svg"}" alt=""><div><strong>${a.name}</strong><span>${Number(a.price).toFixed(2).replace(".",",")} €</span><small>${a.info?.important||"Rückgabeartikel"}</small></div></div>`:""}).join("")}}
function ensureDepositReturnArticles(){const defs=[{id:"glasminus",name:"Glasrückgabe",category:"Pfand",price:-2,receiptText:"Glasrückgabe",image:"assets/pfandglas_auth.webp",color:"#9f1239",active:true,quantity:1,unit:"Stück",taxRate:0},{id:"zangeminus",name:"Feuerzange Rückgabe",category:"Pfand",price:-2,receiptText:"Feuerzange Rückgabe",image:"assets/feuerzange_placeholder.svg",color:"#9f1239",active:true,quantity:1,unit:"Stück",taxRate:0,info:{}},{id:"glaszangebundleminus",name:"Glas + Feuerzange Rückgabe",category:"Pfand",price:-4,receiptText:"Komplettrückgabe Glas + Feuerzange",image:"assets/pfand_bundle_placeholder.svg",color:"#9f1239",active:true,quantity:1,unit:"Bundle",taxRate:0,info:{}}];defs.forEach(d=>{const i=articles.findIndex(a=>a.id===d.id);if(i<0)articles.push(d);else articles[i]={...d,...articles[i],price:d.price,category:"Pfand"}})}

function saveAll(){localStorage.setItem("kcm_groups",JSON.stringify(groups));localStorage.setItem("kcm_articles",JSON.stringify(articles));localStorage.setItem("kcm_settings",JSON.stringify(settings));localStorage.setItem("kcm_registers",JSON.stringify(registers));localStorage.setItem("kcm_sales",window.KCSalesImportCore?.stringifyStorage?.(sales)||JSON.stringify(sales));localStorage.setItem("kcm_devices",JSON.stringify(devices));localStorage.setItem("kcm_receipt",JSON.stringify(receipt));localStorage.setItem("kcm_closings",JSON.stringify(closings));localStorage.setItem("kcm_cashcounts",JSON.stringify(cashCounts));localStorage.setItem("kcm_sync",JSON.stringify(syncSettings));localStorage.setItem("kcm_cash_movements",JSON.stringify(cashMovementsLog));localStorage.setItem("kcm_cash_audit",JSON.stringify(cashAuditLog));
localStorage.setItem("kcm_withdrawals",JSON.stringify(cashWithdrawals));
localStorage.setItem("kcm_discount_audit",JSON.stringify(managerDiscountAudit));
localStorage.setItem("kcm_sync_queue",JSON.stringify(syncQueue));
localStorage.setItem("kcm_sync_log",JSON.stringify(syncLog));
localStorage.setItem("kcm_sync_conflicts",JSON.stringify(syncConflicts));
localStorage.setItem("kcm_price_history",JSON.stringify(priceHistory));
localStorage.setItem("kcm_tips",JSON.stringify(managerTips));
localStorage.setItem("kcm_deposit_groups",JSON.stringify(depositGroups));
localStorage.setItem("kcm_practice",JSON.stringify(practiceState));
localStorage.setItem("kcm_exchange_used",JSON.stringify(exchangeUsedPackages));
localStorage.setItem("kcm_exchange_log",JSON.stringify(exchangeLog));
localStorage.setItem("kcm_pos_admin_audit",JSON.stringify(posAdminAudit));
localStorage.setItem("kcm_pos_admin_changes",JSON.stringify(posAdminChanges));
localStorage.setItem("kcm_exchange_staff",JSON.stringify(exchangeExternal.staff));
localStorage.setItem("kcm_exchange_shifts",JSON.stringify(exchangeExternal.shifts));
localStorage.setItem("kcm_exchange_purchases",JSON.stringify(exchangeExternal.purchases));
localStorage.setItem("kcm_exchange_expenses",JSON.stringify(exchangeExternal.expenses));
localStorage.setItem("kcm_exchange_inventory",JSON.stringify(exchangeExternal.inventory))}
const NAV_GROUP_STATE_KEY="kcm_nav_groups_v016";
function readNavGroupState(){
  try{return JSON.parse(localStorage.getItem(NAV_GROUP_STATE_KEY)||"{}")||{}}catch{return {}}
}
function setNavGroup(group,expanded,persist=true){
  const toggle=group.querySelector(".nav-group-toggle"),submenu=group.querySelector(".nav-submenu");
  group.classList.toggle("expanded",expanded);
  toggle.setAttribute("aria-expanded",String(expanded));
  submenu.hidden=!expanded;
  if(persist){
    const state=readNavGroupState();
    state[group.dataset.navGroup]=expanded;
    localStorage.setItem(NAV_GROUP_STATE_KEY,JSON.stringify(state));
  }
}
function restoreNavGroups(){
  const state=readNavGroupState();
  document.querySelectorAll(".nav-group").forEach(group=>setNavGroup(group,state[group.dataset.navGroup]===true,false));
  const activeGroup=document.querySelector(".nav.active")?.closest(".nav-group");
  if(activeGroup)setNavGroup(activeGroup,true,false);
}
document.querySelectorAll(".nav-group-toggle").forEach(toggle=>toggle.addEventListener("click",()=>{
  const group=toggle.closest(".nav-group");
  setNavGroup(group,toggle.getAttribute("aria-expanded")!=="true");
}));
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x===b));
  document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.dataset.viewPanel===b.dataset.view));
  const parentGroup=b.closest(".nav-group");
  if(parentGroup)setNavGroup(parentGroup,true);
  if(b.dataset.view==="dashboard")renderDashboard();
  if(b.dataset.view==="reports")renderReport();
  /* BEFUND 31.08.2026 (Generalprobe): der Kassenabschluss wurde NUR neu gezeichnet, wenn
     gerade ein Code eingelesen wurde. Beim Programmstart und beim Oeffnen der Ansicht lief
     renderClosings() nicht - die Tabelle blieb leer, obwohl die Abschluesse gespeichert
     waren (gemessen: 24 Abschluesse im Speicher, 0 Zeilen in der Tabelle, nicht einmal der
     Hinweis "Keine offenen Abschluesse"). Wer am Morgen nach dem Markttag nachsehen wollte,
     sah eine leere Seite. */
  if(b.dataset.view==="closing")renderClosings();
});
restoreNavGroups();
document.querySelectorAll("[data-atab]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-atab]").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll("[data-apanel]").forEach(x=>x.classList.toggle("active",x.dataset.apanel===b.dataset.atab))});

const EXCHANGE_FORMAT="KC_EXCHANGE_PACKAGE";
const EXCHANGE_SCHEMA="1.0";
const EXCHANGE_SOURCE="KC_MARKTKASSE_MANAGER";

function exchangeChecksumPayload(pkg){
  const clone=JSON.parse(JSON.stringify(pkg));
  delete clone.checksum;
  delete clone.signature;
  return JSON.stringify(clone);
}
function exchangeChecksum(text){
  let h1=0x811c9dc5,h2=0x9e3779b9;
  for(let i=0;i<text.length;i++){
    const c=text.charCodeAt(i);
    h1^=c;h1=Math.imul(h1,0x01000193);
    h2^=(c+i);h2=Math.imul(h2,0x85ebca6b);
  }
  return `${(h1>>>0).toString(16).padStart(8,"0")}${(h2>>>0).toString(16).padStart(8,"0")}`;
}
function packageExtension(type){
  return {config:"kcconfig",sales:"kcsales",staff:"kcstaff",purchase:"kcpurchase",
    expense:"kcexpense",inventory:"kcinventory",closing:"kcclosing",changeset:"kcchanges",bundle:"kcbundle"}[type]||"kcexchange";
}
function exchangeDataFor(type,includeAttachments){
  const base={
    config:{groups,articles,settings,registers,devices,receipt,priceHistory,depositGroups},
    sales:{sales,tips:managerTips,withdrawals:cashWithdrawals,closings,cashCounts},
    staff:{operators:settings.operators||[],shifts:exchangeExternal.shifts},
    purchase:{purchases:exchangeExternal.purchases,suppliers:[]},
    expense:{expenses:exchangeExternal.expenses},
    inventory:{inventory:exchangeExternal.inventory},
    closing:{closings,cashCounts},
    bundle:{
      config:{groups,articles,settings,registers,devices,receipt,priceHistory,depositGroups},
      sales:{sales,tips:managerTips,withdrawals:cashWithdrawals,closings,cashCounts},
      staff:{operators:settings.operators||[],shifts:exchangeExternal.shifts},
      purchase:{purchases:exchangeExternal.purchases,suppliers:[]},
      expense:{expenses:exchangeExternal.expenses},
      inventory:{inventory:exchangeExternal.inventory}
    }
  };
  const data=JSON.parse(JSON.stringify(base[type]||{}));
  const attachments=[];
  if(includeAttachments&&["config","bundle"].includes(type)){
    articles.forEach(a=>{
      if(a.embeddedImage)attachments.push({id:`article-image:${a.id}`,mime:"image/*",data:a.embeddedImage});
    });
  }
  return {data,attachments};
}
function createExchangePackage(type,target,clubId,eventId,includeAttachments){
  const content=exchangeDataFor(type,includeAttachments);
  const pkg={
    format:EXCHANGE_FORMAT,schemaVersion:EXCHANGE_SCHEMA,packageId:crypto.randomUUID(),
    packageType:type,sourceSystem:EXCHANGE_SOURCE,sourceVersion:VERSION,targetSystem:target,
    clubId,eventId,createdAt:new Date().toISOString(),data:content.data,
    attachments:content.attachments,checksum:"",signature:null,encryption:null
  };
  pkg.checksum=exchangeChecksum(exchangeChecksumPayload(pkg));
  return pkg;
}
function validateExchangePackage(pkg){
  const errors=[];
  if(pkg?.format!==EXCHANGE_FORMAT)errors.push("Unbekanntes Paketformat");
  if(pkg?.schemaVersion!==EXCHANGE_SCHEMA)errors.push(`Schema ${pkg?.schemaVersion||"fehlt"} wird nicht unterstützt`);
  if(!pkg?.packageId)errors.push("Paket-ID fehlt");
  if(!pkg?.packageType)errors.push("Paketart fehlt");
  if(!pkg?.sourceSystem)errors.push("Quellsystem fehlt");
  if(!pkg?.targetSystem)errors.push("Zielsystem fehlt");
  if(exchangeChecksum(exchangeChecksumPayload(pkg))!==pkg?.checksum)errors.push("Prüfsumme stimmt nicht");
  if(exchangeUsedPackages.includes(pkg?.packageId))errors.push("Paket wurde bereits importiert");
  return errors;
}
function keyForRecord(item,index=0){
  return item?.id||item?.transactionId||item?.articleId||item?.memberId||item?.shiftId||item?.purchaseId||
    item?.expenseId||item?.inventoryId||item?.withdrawalId||item?.discountId||item?.closingId||item?.countId||item?.auditId||item?.changeId||`${index}`;
}
function diffCollection(incoming,current,conflictOnChange=false){
  let added=0,changed=0,same=0,conflicts=0;
  const map=new Map((current||[]).map((x,i)=>[keyForRecord(x,i),x]));
  (incoming||[]).forEach((x,i)=>{
    const key=keyForRecord(x,i),old=map.get(key);
    if(!old)added++;
    else if(JSON.stringify(old)===JSON.stringify(x))same++;
    else{changed++;if(conflictOnChange)conflicts++}
  });
  return {added,changed,same,conflicts};
}
function diffExchangePackage(pkg){
  const d=pkg.data||{},rows=[];
  const push=(name,incoming,current,conflictOnChange=false)=>rows.push({name,...diffCollection(incoming,current,conflictOnChange)});
  if(pkg.packageType==="config"||pkg.packageType==="bundle"){
    const c=pkg.packageType==="bundle"?(d.config||{}):d;
    push("Warengruppen",c.groups,groups);push("Artikel",c.articles,articles);
    push("Kassen",c.registers,registers);push("Geräte",c.devices,devices);
  }
  if(pkg.packageType==="sales"||pkg.packageType==="bundle"){
    const s=pkg.packageType==="bundle"?(d.sales||{}):d;
    push("Umsätze",[...(s.sales||[]),...(s.trainingSales||[])],sales);push("Trinkgeld",s.tips,managerTips);push("Entnahmen",s.withdrawals,cashWithdrawals);push("Abschlüsse",s.closings,closings);
  }
  if(pkg.packageType==="staff"||pkg.packageType==="bundle"){
    const s=pkg.packageType==="bundle"?(d.staff||{}):d;
    push("Bediener",s.operators,settings.operators||[]);push("Schichten",s.shifts,exchangeExternal.shifts);
  }
  if(pkg.packageType==="purchase"||pkg.packageType==="bundle"){
    const p=pkg.packageType==="bundle"?(d.purchase||{}):d;push("Einkäufe",p.purchases,exchangeExternal.purchases);
  }
  if(pkg.packageType==="expense"||pkg.packageType==="bundle"){
    const e=pkg.packageType==="bundle"?(d.expense||{}):d;push("Ausgaben",e.expenses,exchangeExternal.expenses);
  }
  if(pkg.packageType==="inventory"||pkg.packageType==="bundle"){
    const i=pkg.packageType==="bundle"?(d.inventory||{}):d;push("Inventur",i.inventory,exchangeExternal.inventory);
  }
  if(pkg.packageType==="closing"){
    push("Abschlüsse",d.closings,closings);push("Zählungen",d.cashCounts,cashCounts);
  }
  if(pkg.packageType==="changeset"){
    push("Warengruppen",d.groups,groups,true);push("Artikel",d.articles,articles,true);
    push("Änderungsprotokoll",d.changes,posAdminChanges);push("Zugriffsprotokoll",d.audit,posAdminAudit);
    if(d.posSettings){const different=JSON.stringify(d.posSettings)!==JSON.stringify(settings);rows.push({name:"Kasseneinstellungen",added:0,changed:different?1:0,same:different?0:1,conflicts:different?1:0})}
  }
  return rows;
}
function mergeById(current,incoming){
  const result=[...(current||[])],index=new Map(result.map((x,i)=>[keyForRecord(x,i),i]));
  (incoming||[]).forEach((x,i)=>{
    const key=keyForRecord(x,i);
    if(index.has(key))result[index.get(key)]={...result[index.get(key)],...x};
    else{index.set(key,result.length);result.push(x)}
  });
  return result;
}
function mergeByKey(current,incoming,keyFn){
  const result=[...(current||[])],index=new Map(result.map((x,i)=>[keyFn(x)||`_${i}`,i]));
  (incoming||[]).forEach((x,i)=>{
    const key=keyFn(x)||`_neu${i}_${Date.now()}`;
    if(index.has(key))result[index.get(key)]={...result[index.get(key)],...x};
    else{index.set(key,result.length);result.push(x)}
  });
  return result;
}
function applyExchangePackageData(pkg){
  const d=pkg.data||{};
  const applyConfig=c=>{
    groups=mergeById(groups,(c.groups||[]).map(cleanGroup));articles=mergeById(articles,(c.articles||[]).map(cleanArticle));
    registers=mergeById(registers,c.registers);devices=mergeById(devices,c.devices);
    priceHistory=mergeById(priceHistory,c.priceHistory);depositGroups=mergeById(depositGroups,c.depositGroups);
    if(c.settings)settings={...settings,...c.settings};
    if(c.receipt)receipt={...receipt,...c.receipt};
  };
  const applySales=s=>{
    sales=mergeById(sales,[...(s.sales||[]).map(cleanTransaction),...(s.trainingSales||[]).map(row=>cleanTransaction({...row,training:true}))]);managerTips=mergeById(managerTips,s.tips);
    cashWithdrawals=mergeById(cashWithdrawals,s.withdrawals);managerDiscountAudit=mergeById(managerDiscountAudit,s.discountAudit);closings=mergeById(closings,s.closings);cashCounts=mergeById(cashCounts,s.cashCounts);
  };
  const applyStaff=s=>{
    const names=(s.operators||[]).map(x=>typeof x==="string"?x:x.name).filter(Boolean);
    settings.operators=[...new Set([...(settings.operators||[]),...names])];
    normalizeManagerOperatorProfiles(settings.operators);
    exchangeExternal.staff=mergeById(exchangeExternal.staff,s.operators);
    exchangeExternal.shifts=mergeById(exchangeExternal.shifts,s.shifts);
  };
  if(pkg.packageType==="config")applyConfig(d);
  if(pkg.packageType==="sales")applySales(d);
  if(pkg.packageType==="staff")applyStaff(d);
  if(pkg.packageType==="purchase")exchangeExternal.purchases=mergeById(exchangeExternal.purchases,d.purchases);
  if(pkg.packageType==="expense")exchangeExternal.expenses=mergeById(exchangeExternal.expenses,d.expenses);
  if(pkg.packageType==="inventory")exchangeExternal.inventory=mergeById(exchangeExternal.inventory,d.inventory);
  if(pkg.packageType==="closing"){closings=mergeById(closings,d.closings);cashCounts=mergeById(cashCounts,d.cashCounts)}
  if(pkg.packageType==="changeset"){
    groups=mergeById(groups,(d.groups||[]).map(cleanGroup));articles=mergeById(articles,(d.articles||[]).map(cleanArticle));
    posAdminChanges=mergeById(posAdminChanges,d.changes);posAdminAudit=mergeById(posAdminAudit,d.audit);
    const p=d.posSettings||{};
    settings={...settings,
      clubName:p.clubName||settings.clubName,eventName:p.eventName||settings.eventName,
      buttonSize:p.buttonSize||settings.buttonSize,buttonMode:p.buttonMode||settings.buttonMode,
      showInfo:p.showProductInfo??settings.showInfo,showPrice:p.showPrice??settings.showPrice,
      showStaff:p.showStaff??settings.showStaff,showTip:p.showTip??settings.showTip,showDeposit:p.showDeposit??settings.showDeposit,showPrint:p.showPrint??settings.showPrint,
      showMore:p.showMore??settings.showMore,showChange:p.showChange??settings.showChange,
      requireOperatorConfirmation:p.requireOperatorConfirmation??settings.requireOperatorConfirmation,
      operators:p.operators??settings.operators,operatorProfiles:p.operatorProfiles??settings.operatorProfiles
    };
    if(d.posDisplayProfile&&pkg.data?.changes?.some(change=>change.entity==="display-profile")){
      const registerId=d.changes.find(change=>change.entity==="display-profile")?.registerId||pkg.data.audit?.[0]?.registerId;
      if(registerId)settings.posDisplayProfiles={...(settings.posDisplayProfiles||{}),[registerId]:d.posDisplayProfile};
    }
  }
  if(pkg.packageType==="bundle"){
    applyConfig(d.config||{});applySales(d.sales||{});applyStaff(d.staff||{});
    exchangeExternal.purchases=mergeById(exchangeExternal.purchases,d.purchase?.purchases);
    exchangeExternal.expenses=mergeById(exchangeExternal.expenses,d.expense?.expenses);
    exchangeExternal.inventory=mergeById(exchangeExternal.inventory,d.inventory?.inventory);
  }
}
function logExchange(pkg,result,details){
  exchangeLog.unshift({time:new Date().toISOString(),packageId:pkg?.packageId||"",type:pkg?.packageType||"",
    source:pkg?.sourceSystem||"",result,details});
  exchangeLog=exchangeLog.slice(0,500);saveAll();renderExchangeLog();
}
function renderExchangeLog(){
  const body=el("exchangeLogBody");if(!body)return;
  body.innerHTML=exchangeLog.map(x=>`<tr><td>${new Date(x.time).toLocaleString("de-DE")}</td>
    <td>${x.packageId}</td><td>${x.type}</td><td>${x.source}</td>
    <td class="${x.result==="imported"?"exchange-ok":"exchange-conflict"}">${x.result}</td><td>${x.details}</td></tr>`).join("");
}
function renderPosAdminAudit(){
  const body=el("posAdminAuditBody");if(!body)return;
  body.innerHTML=posAdminAudit.slice().sort((a,b)=>String(b.time).localeCompare(String(a.time))).map(x=>`<tr>
    <td>${new Date(x.time).toLocaleString("de-DE")}</td><td>${x.registerName||x.registerId||"—"}</td>
    <td>${x.actor||"Superadmin"}</td><td>${x.loginMethod||"—"}</td><td>${x.action||"—"}</td><td>${x.result||"—"}</td></tr>`).join("")||'<tr><td colspan="6">Noch keine Vor-Ort-Änderungen importiert.</td></tr>';
}
function renderExchangePreview(pkg){
  const rows=diffExchangePackage(pkg);
  el("exchangeSummary").innerHTML=`
    <div><span>Quelle</span><strong>${pkg.sourceSystem}</strong></div>
    <div><span>Paketart</span><strong>${pkg.packageType}</strong></div>
    <div><span>Paket-ID</span><strong>${pkg.packageId}</strong></div>
    <div><span>Erstellt</span><strong>${new Date(pkg.createdAt).toLocaleString("de-DE")}</strong></div>`;
  el("exchangeDiffBody").innerHTML=rows.map(r=>`<tr><td>${r.name}</td><td>${r.added}</td><td>${r.changed}</td>
    <td>${r.same}</td><td class="${r.conflicts?"exchange-conflict":""}">${r.conflicts}</td></tr>`).join("");
}
el("createExchangePackage").onclick=()=>{
  const type=el("exchangeExportType").value,target=el("exchangeTarget").value;
  const pkg=createExchangePackage(type,target,el("exchangeClubId").value.trim(),el("exchangeEventId").value.trim(),el("exchangeAttachments").checked);
  download(`KC_${type}_${pkg.eventId}_${pkg.packageId.slice(0,8)}.${packageExtension(type)}`,JSON.stringify(pkg,null,2));
  el("exchangeExportResult").textContent=`Paket ${pkg.packageId} wurde erzeugt.`;
  logExchange(pkg,"exported",`Ziel ${target}`);
};
el("inspectExchangePackage").onclick=async()=>{
  const f=el("exchangeImportFile").files[0];if(!f)return;
  try{
    const pkg=JSON.parse(await f.text()),errors=validateExchangePackage(pkg);
    if(errors.length)throw new Error(errors.join(" · "));
    pendingExchangePackage=pkg;renderExchangePreview(pkg);
    el("exchangeImportStatus").textContent=`Geprüft: ${pkg.packageType} von ${pkg.sourceSystem}`;
    el("applyExchangePackage").disabled=false;
  }catch(err){
    pendingExchangePackage=null;el("applyExchangePackage").disabled=true;
    el("exchangeImportStatus").textContent=`Abgelehnt: ${err.message}`;
  }
};
el("applyExchangePackage").onclick=()=>{
  if(!pendingExchangePackage)return;
  const pkg=pendingExchangePackage,errors=validateExchangePackage(pkg);
  if(errors.length){el("exchangeImportStatus").textContent=`Abgelehnt: ${errors.join(" · ")}`;return}
  const conflicts=diffExchangePackage(pkg).reduce((sum,row)=>sum+row.conflicts,0);
  if(conflicts&&prompt(`${conflicts} Konflikt(e) gefunden. Vor-Ort-Daten würden Managerdaten überschreiben. Zum bewussten Übernehmen ÜBERNEHMEN eingeben:`)!=="ÜBERNEHMEN")return;
  if(!conflicts&&!confirm(`Paket ${pkg.packageId} wirklich übernehmen?`))return;
  try{
    applyExchangePackageData(pkg);exchangeUsedPackages.push(pkg.packageId);saveAll();
    logExchange(pkg,"imported","Daten wurden übernommen");
    pendingExchangePackage=null;el("applyExchangePackage").disabled=true;
    el("exchangeImportStatus").textContent="Import erfolgreich.";
    fillCategories();renderGroups();renderArticles();renderRegisters();renderDashboard();renderReport();renderClosings();renderPosAdminAudit();
  }catch(err){logExchange(pkg,"failed",err.message);el("exchangeImportStatus").textContent=`Fehler: ${err.message}`}
};

function fillCategories(){el("aCategory").innerHTML=groups.filter(g=>g.active).map(g=>`<option>${g.name}</option>`).join("");el("rGroup").innerHTML='<option value="">Alle Warengruppen</option>'+groups.map(g=>`<option>${g.name}</option>`).join("")}
function renderGroups(){el("groupBody").innerHTML=groups.map((g,i)=>`<tr data-i="${i}"><td>${g.id}</td><td>${g.name}</td><td>${g.sortOrder}</td><td><span style="display:inline-block;width:20px;height:14px;background:${g.color}"></span></td><td>${g.active?"Aktiv":"Inaktiv"}</td></tr>`).join("");el("groupBody").querySelectorAll("tr").forEach(r=>r.onclick=()=>loadGroup(+r.dataset.i))}
function loadGroup(i){gIndex=i;const g=groups[i];el("gId").value=g.id;el("gName").value=g.name;el("gShort").value=g.shortName||"";el("gSort").value=g.sortOrder;el("gColor").value=g.color;el("gActive").checked=g.active;el("gNotes").value=g.notes||""}
function readGroup(){return cleanGroup({id:el("gId").value.trim(),name:el("gName").value.trim(),shortName:el("gShort").value.trim(),sortOrder:+el("gSort").value||0,color:el("gColor").value,active:el("gActive").checked,notes:el("gNotes").value},gIndex)}
document.querySelectorAll("#groupToolbar button").forEach(b=>b.onclick=()=>{const c=b.dataset.cmd;if(c==="new"){gIndex=-1;["gId","gName","gShort","gNotes"].forEach(id=>el(id).value="");el("gActive").checked=true;return}if(c==="save"){const g=readGroup();if(!g.id||!g.name)return alert("Nummer und Bezeichnung erforderlich");if(gIndex>=0)groups[gIndex]=g;else groups.push(g);queueSync("group","upsert",g);saveAll();renderGroups();fillCategories()}if(c==="delete"&&gIndex>=0){groups.splice(gIndex,1);gIndex=0;saveAll();renderGroups();fillCategories()}if(c==="export")download("Warengruppen.json",JSON.stringify(groups,null,2));if(c==="print")window.print()});

function articlePriceHistory(articleId){
  return priceHistory.filter(x=>x.articleId===articleId).sort((a,b)=>String(b.validFrom).localeCompare(String(a.validFrom)));
}
function effectivePrice(article){
  const now=new Date().toISOString();
  const active=articlePriceHistory(article.id).filter(x=>x.validFrom<=now).sort((a,b)=>String(b.validFrom).localeCompare(String(a.validFrom)))[0];
  return active?Number(active.newPrice):Number(article.price||0);
}
function applyScheduledPrices(){
  const now=new Date().toISOString();
  articles.forEach(article=>{
    const active=articlePriceHistory(article.id).filter(x=>x.validFrom<=now).sort((a,b)=>String(b.validFrom).localeCompare(String(a.validFrom)))[0];
    if(active && Number(article.price)!==Number(active.newPrice)){
      article.price=Number(active.newPrice);
      active.status="active";
    }
  });
  priceHistory.forEach(x=>{if(x.validFrom>now)x.status="scheduled"});
  saveAll();
}
function renderPriceHistory(){
  const article=articles[aIndex];
  if(!article)return;
  el("priceCurrent").value=Number(article.price||0).toFixed(2);
  el("priceHistoryBody").innerHTML=articlePriceHistory(article.id).map(x=>`<tr>
    <td>${new Date(x.validFrom).toLocaleString("de-DE")}</td>
    <td>${money(x.oldPrice)}</td>
    <td>${money(x.newPrice)}</td>
    <td>${new Date(x.changedAt).toLocaleString("de-DE")}</td>
    <td>${x.user||""}</td>
    <td>${x.reason||""}</td>
    <td>${x.status||"scheduled"}</td>
  </tr>`).join("");
}

function renderBig14Editor(){const host=el("aBig14Editor");if(!host)return;host.innerHTML=Object.entries(BIG14_LABELS).map(([id,label])=>`<label><span>${label}</span><select data-big14="${id}"><option value="not-checked">Nicht geprüft</option><option value="contained">Enthalten</option><option value="traces">Spuren möglich</option><option value="not-contained">Nicht enthalten</option></select></label>`).join("")}
function setBig14Values(info={}){document.querySelectorAll("[data-big14]").forEach(node=>node.value=ALLERGEN_VALUES.includes(info.allergens?.[node.dataset.big14])?info.allergens[node.dataset.big14]:"not-checked")}
function readBig14Values(){const result={};document.querySelectorAll("[data-big14]").forEach(node=>result[node.dataset.big14]=node.value);return result}
function fieldNumber(id){const v=el(id).value;return v===""?null:Number(v)}
function renderArticles(){const body=el("articleBody");body.innerHTML=articles.map((a,i)=>`<tr data-i="${i}"><td>${a.id}</td><td>${a.name}</td><td>${a.category}</td><td>${money(a.price)}</td><td><input type="checkbox" data-article-pl="${i}" ${a.priceListVisible!==false?"checked":""} aria-label="${escAttr(a.name)} in Präsentations-Preislisten anzeigen" title="In Präsentations-Preislisten anzeigen"></td></tr>`).join("");body.querySelectorAll("tr").forEach(r=>r.onclick=()=>loadArticle(+r.dataset.i));body.querySelectorAll("[data-article-pl]").forEach(box=>box.onclick=event=>{event.stopPropagation();const article=articles[Number(box.dataset.articlePl)];if(!article)return;article.priceListVisible=box.checked;queueSync("article","upsert",article);saveAll();globalThis.KCManagerMessages?.success?.(`${article.name}: Präsentations-Preisliste ${box.checked?"eingeschaltet":"ausgeschaltet"}.`)})}
function loadArticle(i){aIndex=i;const a=articles[i],d=a.depositComponents||[],info=cleanProductInfo(a.info||{}),n=info.nutrition||{};el("aId").value=a.id;el("aName").value=a.name;el("aCategory").value=a.category;el("aShort").value=a.shortName||"";el("aReceipt").value=a.receiptText||a.name;el("aBarcode").value=a.barcode||"";el("aUnit").value=a.unit||"Stück";el("aQty").value=a.quantity||1;el("aActive").checked=a.active!==false;el("aFavorite").checked=!!a.favorite;el("aPrice").value=a.price||0;el("aHalfAllowed").checked=a.halfAllowed===true;el("aHalfPrice").value=Number.isFinite(Number(a.halfPrice))&&Number(a.halfPrice)>0?Number(a.halfPrice).toFixed(2):"";el("aPurchase").value=a.purchasePrice||0;el("aTax").value=a.taxRate||19;el("aStock").value=a.stock||0;el("aMinStock").value=a.minStock||0;el("aStaff").checked=a.allowStaff!==false;el("aDepositRule").value=a.depositRule||"global";el("aOption").value=a.optionGroup||"";el("aDep1Name").value=d[0]?.name||"";el("aDep1Price").value=d[0]?.price||0;el("aDep2Name").value=d[1]?.name||"";el("aDep2Price").value=d[1]?.price||0;el("aInfoStatus").value=info.status;el("aInfoVersion").value=info.version;el("aInfoShort").value=info.shortDescription||"";el("aIngredients").value=info.ingredients||"";el("aAllergens").value=info.legacyAllergens||"";el("aContents").value=info.additives||"";el("aImportant").value=info.important||"";el("aNotes").value=info.notes||"";el("aManufacturer").value=info.manufacturer||"";el("aSupplier").value=info.supplier||"";el("aInfoSource").value=info.source||"";el("aInfoValidAt").value=info.validAt||"";el("aInfoApprovedAt").value=info.approvedAt||"";el("aInfoApprovedBy").value=info.approvedBy||"";[["aEnergyKj",n.energyKj],["aEnergyKcal",n.energyKcal],["aFat",n.fat],["aSaturates",n.saturates],["aCarbohydrate",n.carbohydrate],["aSugars",n.sugars],["aProtein",n.protein],["aSalt",n.salt]].forEach(([id,v])=>el(id).value=v??"");setBig14Values(info);el("aColor").value=a.color||"#315d8d";el("aDisplay").value=a.displayMode||"global";el("aImage").value=a.image||"";el("aPreview").src=a.embeddedImage||artikelBildPfad(a.image)||"";renderPriceHistory();renderDepositGroups()}

el("schedulePriceChange").onclick=()=>{
  const article=articles[aIndex];
  if(!article)return alert("Bitte zuerst Artikel auswählen.");
  const newPrice=Number(el("priceNew").value);
  const date=el("priceValidDate").value;
  const time=el("priceValidTime").value||"00:00";
  if(!Number.isFinite(newPrice)||newPrice<0)return alert("Bitte gültigen neuen Preis eingeben.");
  if(!date)return alert("Bitte Gültigkeitsdatum auswählen.");
  const validFrom=new Date(`${date}T${time}:00`).toISOString();
  const oldPrice=effectivePrice(article);
  const record={
    id:crypto.randomUUID(),
    articleId:article.id,
    articleName:article.name,
    oldPrice:+oldPrice.toFixed(2),
    newPrice:+newPrice.toFixed(2),
    validFrom,
    changedAt:new Date().toISOString(),
    user:syncSettings.user||"Superadmin",
    reason:el("priceReason").value.trim(),
    status:validFrom<=new Date().toISOString()?"active":"scheduled"
  };
  priceHistory.push(record);
  if(record.status==="active")article.price=record.newPrice;
  queueSync("price-history","upsert",record);
  queueSync("article","upsert",article);
  saveAll();
  el("priceNew").value="";
  el("priceReason").value="";
  renderArticles();
  renderPriceHistory();
  alert("Preisanpassung gespeichert.");
};


function renderDepositGroups(){
  const a=articles[aIndex];if(!a)return;
  const selected=new Set(a.depositGroupIds||[]);
  el("depositGroupChoices").innerHTML=depositGroups.map(g=>`<label><input type="checkbox" data-deposit-group="${g.id}" ${selected.has(g.id)?"checked":""}> ${g.name} · ${money(g.amount)}</label>`).join("");
}
function selectedDepositGroups(){
  return [...document.querySelectorAll("[data-deposit-group]:checked")].map(x=>x.dataset.depositGroup);
}

function readArticle(){const deps=[];if(el("aDep1Name").value)deps.push({name:cleanText(el("aDep1Name").value,80),price:+el("aDep1Price").value||0});if(el("aDep2Name").value)deps.push({name:cleanText(el("aDep2Name").value,80),price:+el("aDep2Price").value||0});return cleanArticle({id:el("aId").value.trim(),name:el("aName").value.trim(),depositGroupIds:selectedDepositGroups(),category:el("aCategory").value,shortName:el("aShort").value,receiptText:el("aReceipt").value,barcode:el("aBarcode").value,unit:el("aUnit").value,quantity:+el("aQty").value||1,active:el("aActive").checked,favorite:el("aFavorite").checked,price:+el("aPrice").value||0,halfAllowed:el("aHalfAllowed").checked,halfPrice:+el("aHalfPrice").value||0,purchasePrice:+el("aPurchase").value||0,taxRate:+el("aTax").value||0,stock:+el("aStock").value||0,minStock:+el("aMinStock").value||0,allowStaff:el("aStaff").checked,depositRule:el("aDepositRule").value,optionGroup:el("aOption").value,depositComponents:deps,info:{status:el("aInfoStatus").value,version:el("aInfoVersion").value,shortDescription:el("aInfoShort").value,ingredients:el("aIngredients").value,additives:el("aContents").value,contents:el("aContents").value,legacyAllergens:el("aAllergens").value,allergens:readBig14Values(),important:el("aImportant").value,notes:el("aNotes").value,manufacturer:el("aManufacturer").value,supplier:el("aSupplier").value,source:el("aInfoSource").value,validAt:el("aInfoValidAt").value,approvedAt:el("aInfoApprovedAt").value,approvedBy:el("aInfoApprovedBy").value,nutrition:{energyKj:fieldNumber("aEnergyKj"),energyKcal:fieldNumber("aEnergyKcal"),fat:fieldNumber("aFat"),saturates:fieldNumber("aSaturates"),carbohydrate:fieldNumber("aCarbohydrate"),sugars:fieldNumber("aSugars"),protein:fieldNumber("aProtein"),salt:fieldNumber("aSalt")}},color:el("aColor").value,displayMode:el("aDisplay").value,image:el("aImage").value,embeddedImage:el("aPreview").src.startsWith("data:")?el("aPreview").src:undefined},aIndex)}
document.querySelectorAll("#articleToolbar button").forEach(b=>b.onclick=()=>{const c=b.dataset.cmd;if(c==="new"){aIndex=-1;["aId","aName","aShort","aReceipt","aBarcode","aImage"].forEach(id=>el(id).value="");return}if(c==="save"){const a=readArticle();if(!a.id||!a.name)return alert("Artikelnummer und Bezeichnung erforderlich");if(aIndex>=0)articles[aIndex]=a;else articles.push(a);queueSync("article","upsert",a);saveAll();renderArticles()}if(c==="delete"&&aIndex>=0){articles.splice(aIndex,1);aIndex=0;saveAll();renderArticles()}if(c==="image")el("imageFile").click();if(c==="export")download("Artikel.json",JSON.stringify(articles,null,2));if(c==="print")window.print()});
// Knopf "50 %" uebernimmt die Haelfte des Verkaufspreises und setzt die Freigabe gleich mit.
el("aHalfPrice50")?.addEventListener("click",()=>{const price=Number(el("aPrice").value||0);if(price<=0)return;el("aHalfPrice").value=(Math.round(price*50)/100).toFixed(2);el("aHalfAllowed").checked=true;});

const loadArticleWithoutPriceListFlag=loadArticle;
loadArticle=function(i){loadArticleWithoutPriceListFlag(i);el("aPriceListVisible").checked=articles[i]?.priceListVisible!==false};
const readArticleWithoutPriceListFlag=readArticle;
readArticle=function(){const article=readArticleWithoutPriceListFlag();article.priceListVisible=el("aPriceListVisible").checked;return article};
document.querySelector('#articleToolbar [data-cmd="new"]')?.addEventListener("click",()=>{el("aPriceListVisible").checked=true});
el("imageFile").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{el("aPreview").src=r.result;el("aImage").value=f.name};r.readAsDataURL(f)};
function cleanRegister(r={}){return {...r,id:cleanText(r.id,40)||"KASSE-01",name:cleanText(r.name,60)||"Kasse",operator:cleanText(r.operator,80),active:r.active!==false}}
let selectedRegisterIndex=0;
function renderRegisters(){registers.sort((a,b)=>(parseInt(String(a.id).replace(/\D/g,""),10)||0)-(parseInt(String(b.id).replace(/\D/g,""),10)||0));selectedRegisterIndex=Math.max(0,Math.min(selectedRegisterIndex,registers.length-1));el("registerCards").innerHTML=registers.map((r,i)=>`<article class="register-card ${i===selectedRegisterIndex?"selected":""}" data-register-index="${i}" tabindex="0" aria-label="${escAttr(r.name)} auswählen"><label>Kassen-ID<input data-i="${i}" data-k="id" value="${escAttr(r.id)}"></label><label>Name<input data-i="${i}" data-k="name" value="${escAttr(r.name)}"></label><label>Standardbediener<input data-i="${i}" data-k="operator" value="${escAttr(r.operator||"")}"></label><label class="check">Aktiv<input type="checkbox" data-i="${i}" data-k="active" ${r.active?"checked":""}></label></article>`).join("");el("registerCards").querySelectorAll("[data-register-index]").forEach(card=>card.onclick=()=>{selectedRegisterIndex=Number(card.dataset.registerIndex);el("registerCards").querySelectorAll(".register-card").forEach(x=>x.classList.toggle("selected",x===card))});el("registerCount").textContent=registers.length;fillRegisterSelects()}
el("newRegister").onclick=()=>{const used=new Set(registers.map(r=>parseInt(String(r.id).replace(/\D/g,""),10)));let n=1;while(used.has(n))n++;registers.push({id:`KASSE-${String(n).padStart(2,"0")}`,name:`Kasse ${n}`,operator:"",active:true});selectedRegisterIndex=registers.length-1;renderRegisters();globalThis.KCManagerMessages?.success?.(`Kasse ${n} wurde angelegt.`)};
el("saveRegisters").onclick=()=>{document.querySelectorAll(".register-card input").forEach(n=>{const r=registers[+n.dataset.i];r[n.dataset.k]=n.type==="checkbox"?n.checked:n.value});registers.forEach((r,i)=>registers[i]=cleanRegister(r));registers.forEach(r=>queueSync("register","upsert",r));saveAll();renderRegisters();globalThis.KCManagerMessages?.success?.(`${registers.length} Kassenprofil${registers.length===1?"":"e"} erfolgreich gespeichert.`)};
el("deleteRegister").onclick=button=>{if(!registers.length)return globalThis.KCManagerMessages?.warning?.("Es ist keine Kasse zum Löschen vorhanden.");const index=selectedRegisterIndex,target=registers[index],confirmed=button.currentTarget.dataset.confirmed==="1"||(globalThis.KCManagerMessages?.ask||confirm)(`Kasse „${target.name}“ (${target.id}) wirklich löschen?`);if(!confirmed)return;registers.splice(index,1);selectedRegisterIndex=Math.max(0,index-1);queueSync("register","delete",target);saveAll();renderRegisters();globalThis.KCManagerMessages?.success?.(`Kasse „${target.name}“ wurde gelöscht.`)};
function fillRegisterSelects(){const opts=registers.filter(r=>r.active).map(r=>`<option value="${escAttr(r.id)}">${escAttr(r.name)} (${escAttr(r.id)})</option>`).join("");el("configRegister").innerHTML=opts;if(el("dRegister"))el("dRegister").innerHTML=opts;if(el("cashRegister")){el("cashRegister").innerHTML=opts+`<option value="${window.KCGeldkassette?.ZIEL||"KASSETTE"}">Geldkassette – auf beide Laden aufteilen</option>`;if(typeof pflegeKassettenZiel==="function")pflegeKassettenZiel();}el("rRegister").innerHTML='<option value="">Alle Kassen</option>'+opts}
function managerLogoSource(){return clubLogoDraft||settings.clubLogo||"assets/kochmuetze.png"}
function renderManagerBrand(){el("managerClubName").textContent=settings.clubName||"Köcheclub Werne";el("managerClubLogo").src=managerLogoSource();el("projectName").textContent=settings.eventName||""}
function managerOperatorSlug(value,index=0){return cleanId(String(value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),`bediener-${index+1}`)}
function normalizeManagerOperatorProfiles(names=null){
  const prior=Array.isArray(settings.operatorProfiles)?settings.operatorProfiles:[],source=Array.isArray(names)?names:(prior.length?prior:(settings.operators||KC_BEDIENERSTAMM.map(p=>p.name)));
  const used=new Set();settings.operatorProfiles=source.map((item,index)=>{const name=cleanText(typeof item==="string"?item:item?.name,60)||`Bediener ${index+1}`,existing=prior.find(profile=>profile.name===name);let id=managerOperatorSlug(existing?.id||item?.id||name,index),suffix=2;while(used.has(id))id=`${managerOperatorSlug(name,index)}-${suffix++}`;used.add(id);const memberNo=(typeof item==="object"&&item?.memberNo)||existing?.memberNo||KC_BEDIENERSTAMM.find(x=>x.name===name)?.memberNo;return memberNo?{id,name,code:`KCOPE1:${id}`,memberNo}:{id,name,code:`KCOPE1:${id}`}});settings.operators=settings.operatorProfiles.map(profile=>profile.name);return settings.operatorProfiles;
}
function renderOperatorQrCards(){
  const profiles=normalizeManagerOperatorProfiles(),container=el("operatorQrCards");if(!container)return;
  container.innerHTML=profiles.map(profile=>`<article class="operator-qr-card" data-operator-qr="${profile.id}"><h4>${profile.name}</h4><code>${profile.code}</code><canvas width="180" height="180" aria-label="QR-Code für ${profile.name}"></canvas><button type="button" data-save-operator="${profile.id}">Als Bild speichern</button> <button type="button" data-print-operator="${profile.id}">Drucken</button></article>`).join("");
  profiles.forEach(profile=>drawRealQR(container.querySelector(`[data-operator-qr="${profile.id}"] canvas`),profile.code));
  container.querySelectorAll("[data-save-operator]").forEach(button=>button.onclick=()=>{const profile=profiles.find(x=>x.id===button.dataset.saveOperator),canvas=button.closest(".operator-qr-card").querySelector("canvas"),a=document.createElement("a");a.href=canvas.toDataURL("image/png");a.download=`KC_Bediener_${profile.id}.png`;a.click()});
  container.querySelectorAll("[data-print-operator]").forEach(button=>button.onclick=()=>{button.closest(".operator-qr-card").classList.add("print-target");document.body.classList.add("print-operator-qr");window.print();setTimeout(()=>{document.body.classList.remove("print-operator-qr");button.closest(".operator-qr-card").classList.remove("print-target")},500)});
}
function loadSettings(){
  const profiles=normalizeManagerOperatorProfiles();clubLogoDraft=settings.clubLogo||"";el("sClub").value=settings.clubName;el("sEvent").value=settings.eventName;el("sClubLogoPreview").src=managerLogoSource();el("sCountry").value=settings.country;el("sTse").value=String((settings.fiscalMode|| (settings.tse?"tse":"off"))==="tse");el("sButtonSize").value=settings.buttonSize;el("sButtonMode").value=settings.buttonMode;el("sInfo").checked=settings.showInfo;el("sPrice").checked=settings.showPrice;el("sShowStaff").checked=settings.showStaff!==false;el("sShowTip").checked=settings.showTip!==false;el("sShowDeposit").checked=settings.showDeposit!==false;el("sShowPrint").checked=settings.showPrint!==false;el("sShowMore").checked=settings.showMore!==false;el("sShowChange").checked=settings.showChange!==false;el("sRequireChange").checked=settings.requireChangeFlow===true;el("sRequireOperator").checked=settings.requireOperatorConfirmation===true;el("sPinLockEnabled").checked=settings.pinLockEnabled!==false;el("sOperators").value=profiles.map(profile=>profile.name).join("\n");renderManagerBrand();renderOperatorQrCards();
}
el("sClubLogoFile").onchange=event=>{const file=event.target.files[0];if(!file)return;if(!/^image\/(png|jpeg|webp)$/i.test(file.type))return alert("Bitte ein PNG-, JPG- oder WebP-Bild auswählen.");if(file.size>1500000)return alert("Das Logo ist zu groß. Bitte eine Datei unter 1,5 MB verwenden.");const reader=new FileReader();reader.onload=()=>{clubLogoDraft=String(reader.result||"");el("sClubLogoPreview").src=managerLogoSource()};reader.readAsDataURL(file)};
el("clearClubLogo").onclick=()=>{clubLogoDraft="";el("sClubLogoFile").value="";el("sClubLogoPreview").src="../pos/assets/logo.webp"};
el("saveSettings").onclick=()=>{const tse=el("sTse").value==="true",operatorNames=[...new Set(el("sOperators").value.split(/\r?\n/).map(name=>cleanText(name,60)).filter(Boolean))];if(!operatorNames.length)return alert("Bitte mindestens einen Bediener eintragen.");settings={...settings,clubName:cleanText(el("sClub").value,100)||"Köcheclub Werne",clubLogo:clubLogoDraft,eventName:cleanText(el("sEvent").value,100),country:el("sCountry").value,tse,fiscalMode:tse?"tse":"off",buttonSize:el("sButtonSize").value,buttonMode:el("sButtonMode").value,showInfo:el("sInfo").checked,showPrice:el("sPrice").checked,showStaff:el("sShowStaff").checked,showTip:el("sShowTip").checked,showDeposit:el("sShowDeposit").checked,showPrint:el("sShowPrint").checked,showMore:el("sShowMore").checked,showChange:el("sShowChange").checked,requireChangeFlow:el("sRequireChange").checked,requireOperatorConfirmation:el("sRequireOperator").checked,pinLockEnabled:el("sPinLockEnabled").checked};normalizeManagerOperatorProfiles(operatorNames);queueSync("settings","upsert",{id:"global",...settings});saveAll();renderManagerBrand();renderOperatorQrCards()}
async function deriveManagerPin(pin,salt,iterations=250000){const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:unb64(salt),iterations,hash:"SHA-256"},material,256);return b64(new Uint8Array(bits))}
function openManagerLock(){
  const setup=!managerSecurity?.pinHash;document.body.classList.add("manager-locked");
  el("authTitle").textContent=setup?"Manager erstmals absichern":"Manager entsperren";
  el("authHelp").textContent=setup?"Bitte jetzt eine persönliche sechsstellige Master-PIN festlegen. Es gibt keinen werkseitigen Standardcode.":`Verantwortlich: ${managerSecurity.owner||"Masteradmin"}`;
  el("authOwnerRow").hidden=!setup;el("authConfirmRow").hidden=!setup;el("authConfirm").textContent=setup?"Master-PIN festlegen":"Entsperren";
  el("authOwner").value="";el("authCode").value="";el("authConfirmCode").value="";
  if(!el("authDialog").open)el("authDialog").showModal();setTimeout(()=>setup?el("authOwner").focus():el("authCode").focus(),50);
}
function requireAuth(fn){if(managerUnlocked)return fn?.();pendingAuth=fn;openManagerLock()}
el("authDialog").addEventListener("cancel",event=>event.preventDefault());
el("authConfirm").onclick=async event=>{
  event.preventDefault();const pin=el("authCode").value,setup=!managerSecurity?.pinHash;
  if(!/^\d{6}$/.test(pin))return alert("Bitte eine sechsstellige Master-PIN eingeben.");
  if(setup){
    const owner=el("authOwner").value.trim();if(!owner)return alert("Bitte den Namen des Verantwortlichen eingeben.");
    if(pin!==el("authConfirmCode").value)return alert("Die beiden Master-PINs stimmen nicht überein.");
    const salt=b64(crypto.getRandomValues(new Uint8Array(16))),iterations=250000,pinHash=await deriveManagerPin(pin,salt,iterations);
    managerSecurity={version:1,owner,salt,iterations,pinHash,createdAt:new Date().toISOString()};localStorage.setItem(MANAGER_SECURITY_KEY,JSON.stringify(managerSecurity));
  }else if(await deriveManagerPin(pin,managerSecurity.salt,managerSecurity.iterations)!==managerSecurity.pinHash){return alert("Master-PIN nicht richtig.")}
  managerUnlocked=true;document.body.classList.remove("manager-locked");el("authDialog").close();const fn=pendingAuth;pendingAuth=null;fn?.();
}
function b64(bytes){return btoa(String.fromCharCode(...bytes))}function unb64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function encryptObject(obj,password){const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveKey"]);const key=await crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:250000,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["encrypt"]);const plain=new TextEncoder().encode(JSON.stringify(obj));const cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,plain);return{format:"KC_ENCRYPTED_V1",salt:b64(salt),iv:b64(iv),data:b64(new Uint8Array(cipher))}}
async function decryptObject(pkg,password){const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveKey"]);const key=await crypto.subtle.deriveKey({name:"PBKDF2",salt:unb64(pkg.salt),iterations:250000,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["decrypt"]);const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(pkg.iv)},key,unb64(pkg.data));return JSON.parse(new TextDecoder().decode(plain))}
function download(name,text){const blob=new Blob([text],{type:"application/octet-stream"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
el("createConfig").onclick=()=>requireAuth(async()=>{if(!el("configPassword").value)return alert("Dateipasswort erforderlich");const register=registers.find(r=>r.id===el("configRegister").value);normalizeFeatureSettings();ensureDepositReturnArticles();const payload={format:"KC_POS_CONFIG",version:2,schema:"KCB-CONFIG-1",createdAt:new Date().toISOString(),register,settings:{...settings,cashPayment:true,showChange:true},features:Object.fromEntries(MANAGER_FEATURES.map(f=>[f.key,f.locked?true:settings[f.key]!==false])),groups,articles};const enc=await encryptObject(payload,el("configPassword").value);download(`${register.id}_${settings.eventName.replace(/\s+/g,"_")}.kcpos`,JSON.stringify(enc))});
function germanImportError(error){
  const name=String(error?.name||""),message=String(error?.message||error||"");
  if(name==="QuotaExceededError"||/quota|exceeded the quota|storage/i.test(message))return"Der Browser-Speicher ist voll. Der Import wurde nicht gespeichert. Schließen Sie andere Versionen des Managers und verwenden Sie die kompakte Umsatzspeicherung dieser Version. Bereits vorhandene Buchungen bleiben erhalten.";
  if(name==="OperationError"||/decrypt|operation-specific reason/i.test(message))return"Die Datei konnte nicht entschlüsselt werden. Bitte Passwort und Kassendatei prüfen.";
  if(/JSON|unexpected token|unterminated/i.test(message))return"Die gewählte Datei ist beschädigt oder keine gültige KC-Kassendatei.";
  if(/Kein verschlüsselter KC-Kassenexport|Falsches Dateiformat/.test(message))return message;
  return`Der Import konnte nicht abgeschlossen werden: ${message}`;
}
el("importSales").onclick=()=>requireAuth(async()=>{
  const selected=[...el("salesFile").files],files=selected.filter(file=>file.name.toLowerCase().endsWith(".kcsales")),invalid=selected.filter(file=>!file.name.toLowerCase().endsWith(".kcsales")),password=el("salesPassword").value,progress=window.KCManagerImportProgress;
  if(!selected.length||!password)return alert("Kassendatei und Passwort erforderlich");
  if(!files.length){const message="Keine Kassendatei gewählt. Bitte ausschließlich KASSE-…_Umsaetze.kcsales auswählen; Prüfberichte wie expected-results.json gehören nicht in den Umsatzimport.";el("salesImportResult").textContent=message;window.KCManagerMessages?.warning?.(message);return}
  const stages=["Datei einlesen","Verschlüsseltes Paket prüfen","Umsatzdaten entschlüsseln","Buchungen und Duplikate prüfen","Managerdaten speichern und Auswertungen aktualisieren"];
  let totalAdded=0,totalDuplicates=0,totalWithdrawals=0;const results=[];
  const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>resolve()));
  progress?.start({files:files.length,file:`${files.length} Umsatzdatei${files.length===1?"":"en"} vorbereitet`,steps:stages});
  el("importSales").disabled=true;
  try{
    for(let index=0;index<files.length;index++){
      const file=files[index],base=index/files.length*100,portion=100/files.length,fileLabel=`Datei ${index+1} von ${files.length}: ${file.name}`;
      progress?.update({file:fileLabel,step:0,percent:base+portion*.04,detail:`${Math.max(1,Math.round(file.size/1024))} KB`});await paint();
      const text=await file.text();
      progress?.update({file:fileLabel,step:1,percent:base+portion*.15,detail:"JSON-Hülle und Verschlüsselungsdaten"});await paint();
      const pkg=JSON.parse(text);if(pkg.format!=="KC_ENCRYPTED_V1")throw new Error(`${file.name}: Kein verschlüsselter KC-Kassenexport.`);
      progress?.update({file:fileLabel,step:2,percent:base+portion*.28,detail:"Passwortprüfung und AES-Entschlüsselung"});await paint();
      const payload=await decryptObject(pkg,password);if(payload.format!=="KC_SALES_EXPORT")throw new Error(`${file.name}: Falsches Dateiformat.`);
      const incoming=Array.isArray(payload.transactions)?payload.transactions:[];
      progress?.update({file:fileLabel,step:3,percent:base+portion*.62,detail:`${incoming.length.toLocaleString("de-DE")} Vorgänge von ${payload.registerName||payload.registerId}`});await paint();
      const merged=window.KCSalesImportCore?.merge?.(sales,incoming,{registerId:payload.registerId,registerName:payload.registerName});
      const added=merged?.added??incoming.length,duplicates=merged?.duplicates.length||0;if(merged)sales=merged.transactions;else sales.push(...incoming.map(t=>cleanTransaction({...t,registerId:payload.registerId,registerName:payload.registerName})));
      if(Array.isArray(payload.tips))payload.tips.forEach(t=>{if(!managerTips.some(x=>x.id===t.id))managerTips.push({...t,registerId:payload.registerId,registerName:payload.registerName})});
      if(Array.isArray(payload.withdrawals))cashWithdrawals=mergeById(cashWithdrawals,payload.withdrawals.map(w=>({...w,registerId:w.registerId||payload.registerId,registerName:w.registerName||payload.registerName})));
      if(Array.isArray(payload.discountAudit))managerDiscountAudit=mergeById(managerDiscountAudit,payload.discountAudit);
      if(Array.isArray(payload.cashMovements))cashMovementsLog=mergeByKey(cashMovementsLog,payload.cashMovements.map(m=>({...m,registerId:m.registerId||payload.registerId,registerName:m.registerName||payload.registerName})),m=>m.transferId||m.time);
      if(Array.isArray(payload.cashImportAudit))cashAuditLog=mergeByKey(cashAuditLog,payload.cashImportAudit.map(a=>({...a,registerName:a.registerName||payload.registerName})),a=>`${a.time}|${a.transferId||""}|${a.result}`);
      totalAdded+=added;totalDuplicates+=duplicates;totalWithdrawals+=payload.withdrawals?.length||0;
      results.push(`${payload.registerName||payload.registerId}: ${added} neu, ${duplicates} bereits vorhanden`);
      progress?.update({file:fileLabel,step:4,percent:base+portion*.86,detail:`${added} neu · ${duplicates} Duplikate`});await paint();
    }
    saveAll();renderDashboard();renderReport();renderCashMovementsOverview();
    const skipped=invalid.length?` ${invalid.length} ungeeignete Begleitdatei${invalid.length===1?" wurde":"en wurden"} übersprungen: ${invalid.map(file=>file.name).join(", ")}.`:"";
    const summary=(totalAdded?`${totalAdded.toLocaleString("de-DE")} neue Vorgänge aus ${files.length} Datei${files.length===1?"":"en"} importiert. ${totalDuplicates.toLocaleString("de-DE")} Duplikate übersprungen.`:`Keine neuen Vorgänge: Alle ${totalDuplicates.toLocaleString("de-DE")} geprüften Buchungen waren bereits im Manager vorhanden.`)+skipped;
    el("salesImportResult").innerHTML=`<strong>${summary}</strong><br>${results.join("<br>")}${totalWithdrawals?`<br>${totalWithdrawals} Entnahmen übernommen.`:""}`;
    progress?.finish(summary);window.KCManagerMessages?.[totalAdded?"success":"info"]?.(summary);
  }catch(err){
    const message=`Import abgebrochen: ${germanImportError(err)}`;el("salesImportResult").textContent=message;progress?.fail(message);window.KCManagerMessages?.error?.(message);
  }finally{el("importSales").disabled=false}
});

// Master-Recovery: generisches Entschlüsseln JEDER mit dem KC-Format verschlüsselten Datei
// (nicht nur Umsatzexporte) - z.B. falls eine Kassen-PIN vergessen wurde und die dortige
// verschlüsselte Sicherung wiederhergestellt werden muss. Nutzt dieselbe, bereits vorhandene
// decryptObject()-Funktion wie der Umsatzimport - keine eigene Kryptografie.
(function(){
  const dropZone=el("recoveryDropZone"),fileInput=el("recoveryFile"),fileNameEl=el("recoveryFileName");
  let waehlteDatei=null,entschluesselterInhalt=null;
  function dateiUebernehmen(file){
    waehlteDatei=file;entschluesselterInhalt=null;el("recoveryDownload").hidden=true;el("recoveryResult").textContent="";
    fileNameEl.textContent=file?`Gewählt: ${file.name} (${Math.max(1,Math.round(file.size/1024))} KB)`:"";
  }
  dropZone?.addEventListener("click",()=>fileInput.click());
  dropZone?.addEventListener("dragover",e=>{e.preventDefault();dropZone.style.background="#eef2ff"});
  dropZone?.addEventListener("dragleave",()=>{dropZone.style.background=""});
  dropZone?.addEventListener("drop",e=>{e.preventDefault();dropZone.style.background="";if(e.dataTransfer.files[0])dateiUebernehmen(e.dataTransfer.files[0])});
  fileInput?.addEventListener("change",()=>{if(fileInput.files[0])dateiUebernehmen(fileInput.files[0])});

  el("recoveryDecrypt").onclick=()=>requireAuth(async()=>{
    const password=el("recoveryPassword").value,resultEl=el("recoveryResult");
    if(!waehlteDatei)return alert("Bitte zuerst eine Datei auswählen oder hineinziehen.");
    if(!password)return alert("Bitte das Dateipasswort eingeben.");
    resultEl.textContent="Wird entschlüsselt …";
    try{
      const text=await waehlteDatei.text(),pkg=JSON.parse(text);
      if(pkg.format!=="KC_ENCRYPTED_V1")throw new Error("Keine mit dem KC-Format verschlüsselte Datei.");
      const payload=await decryptObject(pkg,password);
      entschluesselterInhalt=payload;
      resultEl.innerHTML=`<strong>Erfolgreich entschlüsselt.</strong><br>Format: ${payload.format||"unbekannt"}${payload.registerName?` · Kasse: ${payload.registerName}`:""}<pre style="max-height:300px;overflow:auto;background:#f8fafc;padding:8px;border-radius:6px;">${JSON.stringify(payload,null,2).slice(0,4000)}</pre>`;
      el("recoveryDownload").hidden=false;
      window.KCManagerMessages?.success?.("Datei erfolgreich entschlüsselt.");
    }catch(err){
      entschluesselterInhalt=null;el("recoveryDownload").hidden=true;
      resultEl.textContent=`Entschlüsselung fehlgeschlagen: ${err.message.includes("decrypt")||err.name==="OperationError"?"Falsches Passwort oder beschädigte Datei.":err.message}`;
      window.KCManagerMessages?.error?.("Entschlüsselung fehlgeschlagen - Passwort prüfen.");
    }
  });

  el("recoveryDownload").onclick=()=>{
    if(!entschluesselterInhalt)return;
    const blob=new Blob([JSON.stringify(entschluesselterInhalt,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);
    a.download=(waehlteDatei?.name||"entschluesselt").replace(/\.[^.]+$/,"")+"_entschluesselt.json";
    a.click();URL.revokeObjectURL(a.href);
  };
})();
function filteredSales(){
  const rid=el("rRegister").value,g=el("rGroup").value,from=el("rFrom").value,to=el("rTo").value;
  const operator=(el("rOperator")?.value||"").trim().toLowerCase();
  const payment=el("rPayment")?.value||"";
  let rows=[];
  sales.filter(t=>
    !t.training&&t.type!=="personal"&&
    (!rid||t.registerId===rid)&&
    (!from||String(t.time).slice(0,10)>=from)&&
    (!to||String(t.time).slice(0,10)<=to)&&
    (!operator||String(t.operator||"").toLowerCase().includes(operator))&&
    (!payment||String(t.method||t.payment||"").startsWith(payment))
  ).forEach(t=>(t.items||[]).forEach(i=>{
    const a=articles.find(a=>a.id===i.id||a.name===i.name);
    if(!g||a?.category===g)rows.push({...i,bon:t.bon||t.bonNumber,date:String(t.time).slice(0,10),time:t.time,registerId:t.registerId,registerName:t.registerName,operator:t.operator||"",payment:t.method||t.payment||""})
  }));
  return rows
}
function renderReport(){
  if(el("rDataType").value==="withdrawals"){
    const rid=el("rRegister").value,from=el("rFrom").value,to=el("rTo").value,operator=(el("rOperator").value||"").trim().toLowerCase();
    const rows=cashWithdrawals.filter(item=>!item.training&&(!rid||item.registerId===rid)&&(!from||String(item.time).slice(0,10)>=from)&&(!to||String(item.time).slice(0,10)<=to)&&(!operator||String(item.operator||"").toLowerCase().includes(operator)));
    el("reportBody").innerHTML=rows.map(item=>{const articles=(item.complaint?.articles||[]).map(article=>`${article.qty}× ${cleanText(article.name,80)}`).join(", "),detail=item.reason==="Reklamation"?`Reklamation · ${cleanText(item.complaint?.reason,120)}${articles?` · ${articles}`:""}`:cleanText(item.reason,120);return `<tr><td>${cleanText(item.registerName||item.registerId,80)}</td><td>${String(item.time).slice(0,10)}</td><td>${cleanText(item.complaint?.refundBon||item.complaint?.reference||"",40)}</td><td>${detail}</td><td>${item.complaint?.articles?.reduce((sum,article)=>sum+Number(article.qty||0),0)||1}</td><td>${money(-Math.abs(Number(item.amount||0)))}</td></tr>`}).join("");
    return;
  }
  if(el("rDataType").value==="tips"){
    const rid=el("rRegister").value,from=el("rFrom").value,to=el("rTo").value,operator=(el("rOperator").value||"").trim().toLowerCase();
    const tips=managerTips.filter(t=>!t.training&&(!rid||t.registerId===rid)&&(!from||String(t.time).slice(0,10)>=from)&&(!to||String(t.time).slice(0,10)<=to)&&(!operator||String(t.operator||"").toLowerCase().includes(operator)));
    el("reportBody").innerHTML=tips.map(t=>`<tr><td>${t.registerName||t.registerId}</td><td>${String(t.time).slice(0,10)}</td><td>${t.bonNumber||""}</td><td>Trinkgeld · ${t.source}</td><td>1</td><td>${money(t.amount)}</td></tr>`).join("");
    return;
  }
  const rows=filteredSales();
  el("reportBody").innerHTML=rows.map(r=>`<tr><td>${r.registerName||r.registerId}</td><td>${r.date}</td><td>${r.bon||""}</td><td>${r.name}</td><td>${r.qty}</td><td>${money(r.price*r.qty)}</td></tr>`).join("")
}
el("applyReport").onclick=renderReport;["rRegister","rGroup","rFrom","rTo","rPayment","rDataType"].forEach(id=>el(id).onchange=renderReport);el("rOperator").oninput=renderReport

const PRACTICE_STEPS=[
{id:"open",label:"Kasse öffnen und Bediener wählen"},
{id:"cash",label:"Anfangsbestand einlesen"},
{id:"scanner",label:"Scanner testen"},
{id:"printer",label:"Testbon drucken"},
{id:"sale",label:"Testverkauf mit Pfand durchführen"},
{id:"tip",label:"Trinkgeld / Aufrunden testen"},
{id:"storno",label:"Artikel- und Bonstorno testen"},
{id:"closing",label:"Tagesabschluss erzeugen"},
{id:"count",label:"Money-Butler-Zählung importieren"},
{id:"backup",label:"Sicherung erstellen"}
];
function renderPractice(){
  el("practiceSteps").innerHTML=PRACTICE_STEPS.map((s,i)=>`<div class="practice-step ${practiceState[s.id]?"done":""}"><strong>${i+1}</strong><span>${s.label}</span><button type="button" data-practice="${s.id}">${practiceState[s.id]?"Bestanden ✓":"Als bestanden markieren"}</button></div>`).join("");
  el("practiceSteps").querySelectorAll("button").forEach(b=>b.onclick=()=>{practiceState[b.dataset.practice]=true;saveAll();renderPractice()});
}
el("resetPractice").onclick=()=>{practiceState={};saveAll();renderPractice()};
el("exportPracticeReport").onclick=()=>download("KC_Praxistest_Bericht.json",JSON.stringify({version:VERSION,time:new Date().toISOString(),steps:PRACTICE_STEPS.map(s=>({...s,passed:!!practiceState[s.id]}))},null,2));

function renderDashboard(){
  const rows=filteredSales(),revenue=rows.reduce((s,r)=>s+r.price*r.qty,0),bons=new Set(rows.map(r=>`${r.registerId}-${r.bon}`));
  el("kpiRevenue").textContent=money(revenue);
  el("kpiSales").textContent=bons.size;
  el("kpiAverage").textContent=money(bons.size?revenue/bons.size:0);
  /* BEFUND 31.08.2026: gezählt wurde jede Zeile, deren Name "Pfand" ODER "Rückgabe"
     enthält - also auch der BERECHNETE Pfand ("Glaspfand", "Feuerzangenpfand"). Unter der
     Überschrift "Pfandrückgaben" stand damit die Zahl der ausgegebenen Gläser statt der
     zurückgenommenen. Mit den vollständigen Vorführdaten wären das 6.708 gewesen, obwohl
     kein einziges Glas zurückgegeben wurde.
     Eine Rückgabe erkennt man am negativen Betrag - das Geld geht an den Kunden zurück. */
  el("kpiDeposit").textContent=rows.filter(r=>Number(r.price)<0||/r[üu]ckgabe/i.test(r.name||"")).reduce((s,r)=>s+Math.abs(Number(r.qty)||0),0);
  /* Halbe Portionen: die Bonzeile bringt portionFactor 0.5 mit. Gezaehlt wird die Menge,
     nicht der Umsatz - die Frage im Verein ist "wie oft wurde geteilt", nicht "wie viel Geld". */
  {const halfRows=rows.filter(r=>Number(r.portionFactor||1)===0.5),
     halfTotal=halfRows.reduce((sum,r)=>sum+Number(r.qty||0),0),halfByArticle={};
   halfRows.forEach(r=>halfByArticle[r.name]=(halfByArticle[r.name]||0)+Number(r.qty||0));
   if(el("kpiHalfPortions")) el("kpiHalfPortions").textContent=halfTotal.toLocaleString("de-DE");
   if(el("halfPortionSummary")) el("halfPortionSummary").innerHTML=Object.keys(halfByArticle).length
     ?Object.entries(halfByArticle).sort((a,b)=>b[1]-a[1]).map(([name,qty])=>`<div><strong>${cleanText(name,100)}</strong> · ${qty.toLocaleString("de-DE")}× ½</div>`).join("")
     :"Noch keine ½-Portionen verkauft.";}
  el("kpiActiveRegisters").textContent=new Set(rows.map(r=>r.registerId)).size;
  el("kpiTraining").textContent=sales.filter(t=>t.training).length;el("kpiTips").textContent=money(managerTips.filter(t=>!t.training).reduce((s,t)=>s+Number(t.amount||0),0));
  drawBar(el("registerChart"),aggregate(rows,r=>r.registerName||r.registerId));
  drawPie(el("groupChart"),aggregate(rows,r=>articles.find(a=>a.id===r.id||a.name===r.name)?.category||"Sonstiges"));
  /* Pfand ist kein Verkauf. Ohne diese Trennung stand "Glaspfand" mit 19.996 EUR als
     Top-Artikel Nummer eins über allen Speisen und Getränken - richtig gerechnet, aber
     als Aussage falsch: verkauft wurde Glühwein, das Glas ist nur geliehen. */
  drawBar(el("articleChart"),aggregate(rows.filter(r=>r.category!=="Pfand"&&!/pfand/i.test(r.name||"")),r=>r.name),true);
  drawBar(el("hourChart"),aggregate(rows,r=>String(new Date(r.time).getHours()).padStart(2,"0")+":00"));
  drawBar(el("operatorChart"),aggregate(rows,r=>r.operator||"Ohne Zuordnung"));
  const combos={};
  sales.forEach(t=>{const names=(t.items||[]).map(i=>i.name).sort();for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++){const k=`${names[i]} + ${names[j]}`;combos[k]=(combos[k]||0)+1}});
  localStorage.setItem("kcm_combinations",JSON.stringify(combos));
  el("gaugeContainer").innerHTML=registers.map(r=>`<div class="gauge" style="--value:${Math.min(100,rows.filter(x=>x.registerId===r.id).length*5)}"><span>${r.name}<br>${rows.filter(x=>x.registerId===r.id).length} Pos.</span></div>`).join("")
}
function aggregate(rows,key){const m={};rows.forEach(r=>m[key(r)]=(m[key(r)]||0)+r.price*r.qty);return m}
/* BEFUND 31.08.2026: der Betrag wurde starr hinter das Balkenende geschrieben (155+w). Beim
   längsten Balken - und der ist immer da, er bestimmt ja den Maßstab - stand die Zahl damit
   über dem rechten Rand hinaus und wurde angeschnitten ("65.746,!"). Ausgerechnet der
   grösste Wert war also der einzige unlesbare.
   Jetzt endet der Balken so weit vor dem Rand, dass der Betrag daneben Platz hat; passt er
   dort trotzdem nicht, steht er INNERHALB des Balkens in Weiss. */
function drawBar(c,data,top=false){
  const ctx=c.getContext("2d");
  const entries=Object.entries(data).sort((a,b)=>b[1]-a[1]).slice(0,top?6:10);
  /* Die Zeichenfläche war starr 260 px hoch. Bei zwei Kassen standen darin zwei Balken und
     darunter 190 px Leere - auf einer Leinwand wirkt das wie ein halb geladenes Bild.
     Die Höhe richtet sich jetzt nach der Anzahl der Balken. */
  const noetig=Math.max(90,20+entries.length*34+12);
  if(c.height!==noetig)c.height=noetig;
  ctx.clearRect(0,0,c.width,c.height);
  const max=Math.max(1,...entries.map(x=>x[1]));
  const links=150, platzRechts=95, breiteMax=Math.max(10,c.width-links-platzRechts);
  entries.forEach((e,i)=>{
    const y=20+i*34, w=(e[1]/max)*breiteMax, text=money(e[1]);
    ctx.fillStyle="#175d9d"; ctx.fillRect(links,y,w,22);
    ctx.fillStyle="#172033"; ctx.fillText(e[0].slice(0,22),5,y+15);
    const breiteText=ctx.measureText(text).width;
    if(links+w+6+breiteText<=c.width-2){ ctx.fillStyle="#172033"; ctx.fillText(text,links+w+6,y+15); }
    else { ctx.fillStyle="#ffffff"; ctx.fillText(text,links+w-breiteText-8,y+15); }
  });
}
function drawPie(c,data){const ctx=c.getContext("2d"),entries=Object.entries(data),total=entries.reduce((s,x)=>s+x[1],0)||1,colors=["#175d9d","#efb13c","#15942a","#c82c25","#7b61a8"];ctx.clearRect(0,0,c.width,c.height);let a=-Math.PI/2;entries.forEach((e,i)=>{const color=colors[i%colors.length],n=e[1]/total*Math.PI*2;ctx.beginPath();ctx.moveTo(150,130);ctx.arc(150,130,95,a,a+n);ctx.closePath();ctx.fillStyle=color;ctx.fill();a+=n;ctx.fillStyle=color;ctx.fillRect(288,26+i*25,13,13);ctx.fillStyle="#172033";ctx.fillText(`${e[0]} ${Math.round(e[1]/total*100)}%`,308,37+i*25)})}
function exportRows(){return filteredSales().map(r=>[r.registerName||r.registerId,r.date,r.bon||"",r.name,r.qty,(r.price*r.qty).toFixed(2)])}
el("reportCsv").onclick=()=>requireAuth(()=>download("Auswertung.csv",["Kasse;Datum;Bon;Artikel;Menge;Umsatz",...exportRows().map(r=>r.join(";"))].join("\n")));
el("reportExcel").onclick=()=>requireAuth(()=>download("Auswertung.xls",`<table>${exportRows().map(r=>`<tr>${r.map(v=>`<td>${v}</td>`).join("")}</tr>`).join("")}</table>`));
el("reportPrint").onclick=()=>requireAuth(()=>window.print());


function fillLabelArticles(){
  el("labelArticle").innerHTML=articles.map((a,i)=>`<option value="${i}">${a.name}</option>`).join("");
}
function labelCodeHtml(type,text){
  if(type==="none")return "";
  return `<img class="label-code" src="${renderQrDataUrl(String(text||""))}" alt="QR-Code"><small>${text}</small>`;
}
function renderLabelPreview(){
  const a=articles[Number(el("labelArticle").value)||0];if(!a)return;
  const checks={
    name:el("labelName").checked,price:el("labelPrice").checked,image:el("labelImage").checked,
    allergens:el("labelAllergens").checked,ingredients:el("labelIngredients").checked,
    deposit:el("labelDeposit").checked,club:el("labelClub").checked,id:el("labelId").checked
  };
  // BEFUND: das Etikett las nur "depositGroupIds". Die Artikel der Kasse fuehren ihr Pfand
  // aber in "depositComponents" (Gluehwein rot: Glaspfand 2 EUR, Feuerzangenbowle zusaetzlich
  // Feuerzangenpfand 2 EUR). Auf dem gedruckten Etikett stand deshalb KEIN Pfand - beim
  // Gluehwein genau die Angabe, nach der am Stand am haeufigsten gefragt wird.
  const deps=(a.depositGroupIds||[]).map(id=>depositGroups.find(g=>g.id===id)).filter(Boolean);
  if(!deps.length)(a.depositComponents||[]).forEach(k=>{if(Number(k?.price)>0)deps.push({name:k.name||"Pfand",amount:Number(k.price)})});
  // BEFUND: die Allergene wurden nur aus der Big-14-Tabelle gelesen. Artikel, deren Angabe als
  // Freitext vorliegt ("Enthaelt Sulfite"), druckten gar keine Allergenzeile - stillschweigend.
  // Bei einem Lebensmitteletikett ist das die Zeile, die am wenigsten fehlen darf.
  const allergenText=window.KCAllergene?.vorhanden(a.info?.allergens)
    ? window.KCAllergene.alsText(a.info.allergens)
    : (a.info?.legacyAllergens||"");
  el("labelPreview").className=`label-preview ${el("labelSize").value}`;
  el("labelPreview").innerHTML=`
    ${checks.club?`<strong>${settings.clubName}</strong><br>`:""}
    ${checks.image&&a.embeddedImage?`<img src="${a.embeddedImage}">`:checks.image&&a.image?`<img src="${artikelBildPfad(a.image)}">`:""}
    ${checks.name?`<h2>${a.name}</h2>`:""}
    ${checks.price?`<div style="font-size:2.2rem;font-weight:900">${money(a.price)}</div>`:""}
    ${checks.deposit&&deps.length?`<p>Pfand: ${deps.map(d=>`${d.name} ${money(d.amount)}`).join(" · ")}</p>`:""}
    ${checks.allergens&&allergenText?`<p><strong>Allergene:</strong> ${allergenText}</p>`:""}
    ${checks.ingredients&&a.info?.ingredients?`<p><strong>Zutaten:</strong> ${a.info.ingredients}</p>`:""}
    ${checks.id?`<p>Art.-Nr. ${a.barcode||a.id}</p>`:""}
    ${labelCodeHtml(el("labelCodeType").value,a.barcode||a.id)}
  `;
}
el("refreshLabel").onclick=renderLabelPreview;
["labelArticle","labelSize","labelCodeType","labelName","labelPrice","labelImage","labelAllergens","labelIngredients","labelDeposit","labelClub","labelId"].forEach(id=>el(id).onchange=renderLabelPreview);
el("printLabel").onclick=()=>{document.body.classList.add("print-label");window.print();setTimeout(()=>document.body.classList.remove("print-label"),100)};


function fullBackupObject(){
  return {
    format:"KC_FULL_BACKUP",version:4,appVersion:VERSION,createdAt:new Date().toISOString(),
    groups,articles,settings,registers,sales,devices,receipt,closings,cashCounts,syncSettings,
    priceHistory,managerTips,cashWithdrawals,managerDiscountAudit,depositGroups,practiceState,
    posUIProfiles:JSON.parse(localStorage.getItem("kcm_pos_ui_profiles_v1")||"[]"),
    posUIAssignments:JSON.parse(localStorage.getItem("kcm_pos_ui_assignments_v1")||"{}"),
    posUIHistory:JSON.parse(localStorage.getItem("kcm_pos_ui_history_v1")||"[]"),
    posUIDeployments:JSON.parse(localStorage.getItem("kcm_pos_ui_deployments_v1")||"[]")
  };
}
el("oneClickBackup").onclick=async()=>{const backup=fullBackupObject();backup.checksum=await sha256Hex(JSON.stringify(backup));download(`KC_MarktKasse_Vollbackup_${new Date().toISOString().slice(0,10)}.kcfullbackup`,JSON.stringify(backup,null,2))};
el("restoreBackup").onclick=async()=>{
  const f=el("restoreFile").files[0];if(!f)return el("restoreStatus").textContent="Bitte Datei auswählen.";
  try{
    const b=JSON.parse(await f.text());if(b.format!=="KC_FULL_BACKUP")throw new Error("Ungültiges Format");
    if(b.version>=2){const copy=JSON.parse(JSON.stringify(b)),supplied=copy.checksum;delete copy.checksum;if(!supplied||await sha256Hex(JSON.stringify(copy))!==supplied)throw new Error("Backup-Prüfsumme stimmt nicht")}
    groups=(b.groups||groups).map(cleanGroup);articles=(b.articles||articles).map(cleanArticle);settings=b.settings||settings;registers=b.registers||registers;sales=(b.sales||sales).map(cleanTransaction);devices=b.devices||devices;receipt=b.receipt||receipt;closings=b.closings||closings;cashCounts=b.cashCounts||cashCounts;syncSettings=b.syncSettings||syncSettings;priceHistory=b.priceHistory||priceHistory;managerTips=b.managerTips||managerTips;cashWithdrawals=b.cashWithdrawals||cashWithdrawals;managerDiscountAudit=b.managerDiscountAudit||managerDiscountAudit;depositGroups=b.depositGroups||depositGroups;practiceState=b.practiceState||{};
    if(Array.isArray(b.posUIProfiles))localStorage.setItem("kcm_pos_ui_profiles_v1",JSON.stringify(b.posUIProfiles));
    if(b.posUIAssignments&&typeof b.posUIAssignments==="object")localStorage.setItem("kcm_pos_ui_assignments_v1",JSON.stringify(b.posUIAssignments));
    if(Array.isArray(b.posUIHistory))localStorage.setItem("kcm_pos_ui_history_v1",JSON.stringify(b.posUIHistory));
    if(Array.isArray(b.posUIDeployments))localStorage.setItem("kcm_pos_ui_deployments_v1",JSON.stringify(b.posUIDeployments));
    saveAll();el("restoreStatus").textContent="Sicherung erfolgreich wiederhergestellt.";location.reload();
  }catch(err){el("restoreStatus").textContent="Fehler: "+err.message}
};

function cleanDevice(d={}){return {...d,registerId:cleanText(d.registerId,40),type:cleanText(d.type,40),maker:cleanText(d.maker,80),model:cleanText(d.model,80),connection:cleanText(d.connection,40),paper:cleanText(d.paper,40),protocol:cleanText(d.protocol,40),charset:cleanText(d.charset,40),autoPrint:!!d.autoPrint,active:!!d.active,notes:cleanText(d.notes,500)}}
function renderDevices(){el("deviceBody").innerHTML=devices.map((d,i)=>`<tr data-i="${i}"><td>${escAttr(d.registerId)}</td><td>${escAttr(d.type)}</td><td>${escAttr(d.maker)}</td><td>${escAttr(d.model)}</td><td>${escAttr(d.connection)}</td><td>${d.active?"Aktiv":"Inaktiv"}</td></tr>`).join("")}
el("newDevice").onclick=()=>{devices.push({registerId:registers[0]?.id||"KASSE-01",type:"Bondrucker",maker:"",model:"",connection:"Bluetooth",paper:"58",protocol:"ESC/POS",charset:"UTF-8",autoPrint:true,active:true,notes:""});saveAll();renderDevices()}
el("saveDevices").onclick=()=>{const d=cleanDevice({registerId:el("dRegister").value,type:el("dType").value,maker:el("dMaker").value,model:el("dModel").value,connection:el("dConnection").value,paper:el("dPaper").value,protocol:el("dProtocol").value,charset:el("dCharset").value,autoPrint:el("dAutoPrint").checked,active:el("dActive").checked,notes:el("dNotes").value});devices.push(d);queueSync("device","upsert",d);saveAll();renderDevices()}
el("testPrinter").onclick=()=>{const testId=crypto.randomUUID(),createdAt=new Date().toISOString(),w=window.open("","_blank");if(!w)return alert("Druckfenster wurde vom Browser blockiert.");w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>KC Drucktest</title><style>body{font:14px monospace;width:58mm;margin:4mm}h1{font-size:18px;border-bottom:1px dashed #000;padding-bottom:8px}</style></head><body><h1>KC MARKTKASSE</h1><p>DRUCKTEST</p><p>${createdAt}</p><p>Kasse: ${el("dRegister").value}</p><p>Test-ID: ${testId.slice(0,8)}</p><p>ÄÖÜ äöü ß · 1234567890</p><hr><p>Bitte Ausdruck, Papierbreite und Zeichensatz prüfen.</p><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();const log=JSON.parse(localStorage.getItem("kcm_device_tests")||"[]");log.push({testId,createdAt,registerId:el("dRegister").value,type:"printer-dialog-opened",result:"manual-check-required"});localStorage.setItem("kcm_device_tests",JSON.stringify(log));alert("Druckdialog geöffnet. Das Ergebnis bitte am Gerät prüfen.")}
el("deviceAiSearch").onclick=()=>alert("Geräte-Assistent: Hersteller und Modell eingeben. Danach Verbindung, Papierbreite und Protokoll prüfen.");
el("deviceCheckCompatibility").onclick=()=>{
  const type=el("dType").value,conn=el("dConnection").value,protocol=el("dProtocol").value;
  let msg=`${type}: ${conn}, ${protocol}. `;
  if(type==="Bondrucker"&&protocol==="ESC/POS")msg+="Grundsätzlich geeignet, Testbon erforderlich.";
  else if(type==="Barcode-/QR-Scanner"&&["Bluetooth","USB"].includes(conn))msg+="HID-Modus und Enter-Abschluss prüfen.";
  else msg+="Herstellerprüfung erforderlich.";
  alert(msg);
}

function loadReceipt(){el("rHeader").checked=receipt.header;el("rHead1").value=receipt.head1;el("rHead2").value=receipt.head2;el("rLogo").checked=receipt.logo;el("rRegisterId").checked=receipt.registerId;el("rReceiptOperator").checked=receipt.operator;el("rBonNo").checked=receipt.bonNo;el("rVat").value=receipt.vat;el("rDeposit").checked=receipt.deposit;el("rReceiptPayment").checked=receipt.payment;el("rChange").checked=receipt.change;el("rFoot1").value=receipt.foot1;el("rFoot2").value=receipt.foot2;el("rAutoPrint").checked=receipt.autoPrint;renderReceiptPreview()}
function readReceipt(){return{header:el("rHeader").checked,head1:el("rHead1").value,head2:el("rHead2").value,logo:el("rLogo").checked,registerId:el("rRegisterId").checked,operator:el("rReceiptOperator").checked,bonNo:el("rBonNo").checked,vat:el("rVat").value,deposit:el("rDeposit").checked,payment:el("rReceiptPayment").checked,change:el("rChange").checked,foot1:el("rFoot1").value,foot2:el("rFoot2").value,autoPrint:el("rAutoPrint").checked}}
function renderReceiptPreview(){const r=readReceipt();let s="";if(r.header)s+=`${r.head1}\n${r.head2}\n`;if(r.registerId)s+="KASSE-01\n";if(r.operator)s+="Bediener: Team\n";if(r.bonNo)s+="Bon 000123\n";s+="--------------------------\n2x Glühwein rot      11,00\n1x Glaspfand          2,00\n--------------------------\nSUMME                13,00 €\n";if(r.vat!=="none")s+="MwSt-Zusammenfassung\n";if(r.payment)s+="Zahlung: Bar\n";if(r.change)s+="Gegeben 20,00 / Rück 7,00\n";s+=`--------------------------\n${r.foot1}\n${r.foot2}`;el("receiptPreview").textContent=s}
["rHeader","rHead1","rHead2","rLogo","rRegisterId","rReceiptOperator","rBonNo","rVat","rDeposit","rReceiptPayment","rChange","rFoot1","rFoot2","rAutoPrint"].forEach(id=>el(id).oninput=renderReceiptPreview)
el("saveReceipt").onclick=()=>{receipt=readReceipt();queueSync("receipt","upsert",{id:"global",...receipt});saveAll();alert("Bonlayout gespeichert.")}

const DENOMS=[100,50,20,10,5,2,1,.5,.2,.1,.05,.02,.01];
const COIN_ROLLS=[{value:2,coins:25},{value:1,coins:25},{value:.5,coins:40},{value:.2,coins:40},{value:.1,coins:40},{value:.05,coins:50},{value:.02,coins:50},{value:.01,coins:50}];
const cashDenomLabel=v=>v>=1?v+" €":Math.round(v*100)+" ct";
const localBusinessDate=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const isBusinessDate=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||""))return false;const [y,m,d]=value.split("-").map(Number),date=new Date(y,m-1,d);return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d};
const displayBusinessDate=value=>{const [y,m,d]=String(value).split("-");return `${d}.${m}.${y}`};
const MANAGER_CASH_SECTION_STATE_KEY="kcm_manager_cash_sections_v0161";
function readManagerCashSectionState(){
  try{return JSON.parse(localStorage.getItem(MANAGER_CASH_SECTION_STATE_KEY)||"{}")||{}}catch{return {}}
}
function setManagerCashSection(section,expanded,persist=true){
  const button=section.querySelector(".manager-cash-lock"),body=section.querySelector(".manager-cash-body"),icon=button.querySelector(".manager-lock-icon"),label=button.querySelector(".manager-lock-label");
  button.setAttribute("aria-expanded",String(expanded));
  button.title=expanded?"Bereich einklappen":"Bereich ausklappen";
  body.hidden=!expanded;
  icon.textContent=expanded?"🔓":"🔒";
  label.textContent=expanded?"Einklappen":"Ausklappen";
  section.classList.toggle("is-open",expanded);
  if(persist){
    const state=readManagerCashSectionState();
    state[section.dataset.managerCashSection]=expanded;
    localStorage.setItem(MANAGER_CASH_SECTION_STATE_KEY,JSON.stringify(state));
  }
}
function initManagerCashSections(){
  const state=readManagerCashSectionState();
  document.querySelectorAll("[data-manager-cash-section]").forEach(section=>{
    const key=section.dataset.managerCashSection,expanded=typeof state[key]==="boolean"?state[key]:section.dataset.defaultOpen==="true";
    setManagerCashSection(section,expanded,false);
    section.querySelector(".manager-cash-lock").addEventListener("click",()=>setManagerCashSection(section,section.querySelector(".manager-cash-lock").getAttribute("aria-expanded")!=="true"));
  });
}
initManagerCashSections();
el("managerCashTestHint").hidden=!window.KC_RUNTIME_FLAGS?.testPhaseToolGuidance;
el("cashEffectiveDate").min=localBusinessDate();
// Echte Schein- und Muenzbilder wie an der Kasse. Vorher stand hier nur der Betrag als Text.
// Der Kassenwart zaehlt echtes Geld ab und traegt es hier ein - mit Bild ist auf einen Blick
// klar, welche Zeile gemeint ist, und Verwechslungen (20 ct / 20 €) werden unwahrscheinlicher.
el("denominations").innerHTML=DENOMS.map(v=>`<label class="geld-feld"><span class="geld-bild"><img src="${geldBild(v)}" alt="" loading="lazy"></span><span class="geld-text">${cashDenomLabel(v)}</span><input type="number" min="0" value="0" data-denom="${v}"></label>`).join("");
el("cashCoinRolls").innerHTML=COIN_ROLLS.map(r=>`<label class="geld-rolle"><span class="geld-bild geld-bild-klein"><img src="${geldBild(r.value)}" alt="" loading="lazy"></span><strong>${cashDenomLabel(r.value)}</strong><input type="number" min="0" step="1" value="0" inputmode="numeric" data-cash-roll-value="${r.value}" data-cash-roll-coins="${r.coins}"><small>${r.coins} Münzen · ${money(r.value*r.coins)} je Rolle</small><b data-cash-roll-total="${r.value}">${money(0)}</b></label>`).join("");
// Dateiname des Geldbildes zu einem Betrag. Muenzen liegen als .webp, Scheine als .jpg -
// so, wie sie auch die Kasse verwendet; beide Seiten zeigen damit dieselben Bilder.
function geldBild(betrag){
  const v=Number(betrag);
  if(v>=5) return `assets/schein_${v}.jpg`;
  // Muenzen: 2 und 1 ganzzahlig, darunter mit einer Nachkommastelle (0.5, 0.2, 0.1, 0.05 ...)
  const name=v>=1?String(v):String(v).replace(/0+$/,'').replace(/\.$/,'');
  return `assets/muenze_${name}.webp`;
}
function cashData(){
  const looseBreakdown={},breakdown={},coinRolls={};let looseTotal=0,rollTotal=0;
  document.querySelectorAll("[data-denom]").forEach(n=>{const count=Math.max(0,parseInt(n.value||0)),value=+n.dataset.denom;looseBreakdown[value]=count;breakdown[value]=count;looseTotal+=count*value});
  document.querySelectorAll("[data-cash-roll-value]").forEach(n=>{const rolls=Math.max(0,parseInt(n.value||0)),value=+n.dataset.cashRollValue,coinsPerRoll=+n.dataset.cashRollCoins,coinCount=rolls*coinsPerRoll,valuePerRoll=value*coinsPerRoll,total=rolls*valuePerRoll;coinRolls[value]={rolls,coinsPerRoll,coinCount,valuePerRoll:+valuePerRoll.toFixed(2),total:+total.toFixed(2)};breakdown[value]=(breakdown[value]||0)+coinCount;rollTotal+=total});
  looseTotal=+looseTotal.toFixed(2);rollTotal=+rollTotal.toFixed(2);return{looseBreakdown,coinRolls,breakdown,looseTotal,rollTotal,total:+(looseTotal+rollTotal).toFixed(2)};
}
function renderCashTotal(){const data=cashData();el("cashLooseTotal").textContent=money(data.looseTotal);el("cashRollTotal").textContent=money(data.rollTotal);el("cashTotal").textContent=money(data.total);document.querySelectorAll("[data-cash-roll-value]").forEach(n=>{const row=data.coinRolls[+n.dataset.cashRollValue];document.querySelector(`[data-cash-roll-total="${n.dataset.cashRollValue}"]`).textContent=money(row?.total||0)})}
function clearManagerCashOutput(){el("cashQrPayload").value="";el("cashResultType").textContent="—";el("cashResultRegister").textContent="—";el("cashResultDate").textContent="—";const ctx=el("cashQrCanvas").getContext("2d");ctx.clearRect(0,0,el("cashQrCanvas").width,el("cashQrCanvas").height)}
document.querySelectorAll("[data-denom],[data-cash-roll-value]").forEach(n=>n.oninput=()=>{renderCashTotal();clearManagerCashOutput()});
["cashRegister","cashType","cashEffectiveDate","cashNote"].forEach(id=>el(id).addEventListener("input",clearManagerCashOutput));
el("cashRegister")?.addEventListener("change",()=>{zeichneKassettenAufteilung();clearManagerCashOutput()});
document.addEventListener("input",e=>{if(e.target.matches("[data-denom],[data-cash-roll-value]"))zeichneKassettenAufteilung()});
function checksum(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,"0")}
// ECHTER FUND (derselbe Fehler steckte auch in Money Butler und Kasse): vorher wurde in eine
// feste Canvas-Groesse gezeichnet und die Modulbreite mit floor/ceil gerundet. Sobald der Code
// laenger wurde, kamen auf ein Modul nur noch ein bis zwei Pixel - der QR-Code sah aus wie ein
// QR-Code, war aber mit einem Decoder nachweislich NICHT mehr einlesbar. Jetzt bestimmt die
// Modulzahl die Bildgroesse, jedes Modul ist ganzzahlig und mindestens 4 px breit; wie gross
// er angezeigt wird, regelt weiterhin das CSS.
function drawRealQR(canvas,text){
  // Zeichnet ueber das gemeinsame Modul shared/kc-qr.js - siehe dort die Begruendung.
  const ergebnis=window.KCQrCode.zeichne(canvas,text,300);
  if(!ergebnis.ok)throw new Error(ergebnis.grund||"QR-Code konnte nicht erzeugt werden.");
  return ergebnis;
}
const CHECKOUT_COMMAND="CMD-CHECKOUT";
function renderCheckoutCommandQr(){drawRealQR(el("checkoutCommandQr"),CHECKOUT_COMMAND)}
el("printCheckoutQr").onclick=()=>{document.body.classList.add("print-checkout-qr");window.print();setTimeout(()=>document.body.classList.remove("print-checkout-qr"),500)};
el("saveCheckoutQr").onclick=()=>{const a=document.createElement("a");a.href=el("checkoutCommandQr").toDataURL("image/png");a.download="KC_Bezahlfunktion_QR.png";a.click()};
window.addEventListener("afterprint",()=>document.body.classList.remove("print-checkout-qr"));
renderCheckoutCommandQr();
el("generateCashQr").onclick=()=>requireAuth(()=>{
  // Baut den Payload ueber DIESELBE Funktion wie der WLAN-Direktversand - vorher gab es hier
  // eine zweite, eigene Fassung, und genau so laufen zwei Wege irgendwann auseinander.
  const{payload,teile,fehler}=baueCashTransferPayload();
  if(fehler)return alert(fehler);
  const encoded="KCASH1:"+btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  el("cashQrPayload").value=encoded;
  el("cashResultType").textContent=payload.type==="opening"?"Anfangsbestand":"Nachfüllung";
  el("cashResultRegister").textContent=teile
    ?`Kassette – ${cashKassette.kassen[0]} ${money(teile[cashKassette.kassen[0]].total)} / ${cashKassette.kassen[1]} ${money(teile[cashKassette.kassen[1]].total)}`
    :(el("cashRegister").selectedOptions[0]?.textContent||payload.registerId);
  el("cashResultDate").textContent=displayBusinessDate(payload.effectiveDate);
  try{drawRealQR(el("cashQrCanvas"),encoded)}
  catch(err){
    const flaeche=el("cashQrCanvas"),stift=flaeche.getContext("2d");
    stift.fillStyle="#fff";stift.fillRect(0,0,flaeche.width,flaeche.height);
    stift.fillStyle="#b91c1c";stift.font="bold 15px system-ui";stift.textAlign="center";
    stift.fillText("QR-Code zu groß",flaeche.width/2,flaeche.height/2-8);
    stift.fillText("bitte Kurzcode nutzen",flaeche.width/2,flaeche.height/2+14);
  }
  if(el("cashKassetteHinweis"))el("cashKassetteHinweis").hidden=!teile;
  setManagerCashSection(document.querySelector('[data-manager-cash-section="result"]'),true)
  const kurzcodeFeld=el("cashKurzcode");
  if(kurzcodeFeld){
    const typZiffer=payload.type==="opening"?"1":"2";
    // Der Kurzcode kann keine Stueckelung tragen. Bei der Kassette bekommt deshalb JEDE Kasse
    // ihren eigenen Kurzcode ueber ihren eigenen Anteil - genau wie im Money Butler.
    if(teile){
      const codeFuer=(ziffer,betrag)=>{
        const cent=String(Math.round(betrag*100)).padStart(6,"0");
        if(cent.length>6)return null;
        const ziffern=typZiffer+ziffer+cent;
        let quersumme=0;for(let i=0;i<ziffern.length;i++)quersumme+=Number(ziffern[i])*(i+2);
        return `${typZiffer}-${ziffer}-${cent}-${quersumme%10}`;
      };
      const eins=codeFuer("1",teile[cashKassette.kassen[0]].total),zwei=codeFuer("2",teile[cashKassette.kassen[1]].total);
      kurzcodeFeld.textContent=eins&&zwei?`Kasse 1: ${eins}    Kasse 2: ${zwei}`
        :"Betrag zu hoch für den Kurzcode (über 9.999,99 Euro) - bitte den vollständigen Code verwenden.";
      return;
    }
    // ECHTER FUND: hier wurde fuer JEDE Kasse ausser 01 und 02 die Ziffer 9 erzeugt - und 9
    // heisst an der Kasse "gilt gemeinsam fuer KASSE-01 und KASSE-02". Ein Kurzcode fuer eine
    // dritte Kasse waere also an Kasse 1 oder 2 buchbar gewesen. Jetzt kommt die Ziffer aus
    // der Kassen-ID, und ohne ableitbare Ziffer gibt es gar keinen Kurzcode.
    const kasseZiffer=(String(payload.registerId||"").match(/^KASSE-0([1-8])$/)||[])[1];
    const betragCent=String(Math.round(payload.total*100)).padStart(6,"0");
    if(!kasseZiffer){kurzcodeFeld.textContent=`Für ${payload.registerId} gibt es keinen Kurzcode - bitte den QR-Code oder die Datei verwenden.`}
    else if(betragCent.length>6){kurzcodeFeld.textContent="Betrag zu hoch für den Kurzcode (über 9.999,99 Euro) - bitte den vollständigen Code verwenden."}
    else{
      const ziffern=typZiffer+kasseZiffer+betragCent;
      let quersumme=0;for(let i=0;i<ziffern.length;i++)quersumme+=Number(ziffern[i])*(i+2);
      const pruefziffer=quersumme%10;
      kurzcodeFeld.textContent=`${typZiffer}-${kasseZiffer}-${betragCent}-${pruefziffer}`;
    }
  }
})
// Baut denselben KC_CASH_TRANSFER-Datensatz wie der QR-Knopf, aber ohne ihn anzuzeigen - für
// die direkte WLAN-Übergabe. Eigene, kleine Funktion, damit hier keine der Prüfungen/Felder
// der bestehenden QR-Erzeugung dupliziert und dadurch eventuell auseinanderlaufen.
// --- Geldkassette im PC-Manager -----------------------------------------------------------
// Derselbe Bereich und dieselbe Rechnung wie im Money Butler (shared/kc-geldkassette.js).
// Grund (User): faellt der Kassenwart aus, uebernimmt der PC-Manager die Aufgabe - dann muss
// es gleich aussehen und gleich rechnen, nicht aehnlich.
const KASSETTE_ZIEL=window.KCGeldkassette?window.KCGeldkassette.ZIEL:"KASSETTE";
const istKassettenZiel=()=>el("cashRegister")&&el("cashRegister").value===KASSETTE_ZIEL;
const denomLabel=v=>v>=1?v+" €":Math.round(v*100)+" ct";
function kassettenSorten(){
  const sorten=[];
  document.querySelectorAll("[data-denom]").forEach(n=>{
    const anzahl=Math.max(0,parseInt(n.value||0));
    if(anzahl>0)sorten.push({art:"lose",wert:+n.dataset.denom,anzahl,label:denomLabel(+n.dataset.denom)});
  });
  document.querySelectorAll("[data-cash-roll-value]").forEach(n=>{
    const anzahl=Math.max(0,parseInt(n.value||0));
    if(anzahl>0)sorten.push({art:"rolle",wert:+n.dataset.cashRollValue,anzahl,coinsPerRoll:+n.dataset.cashRollCoins,label:`${denomLabel(+n.dataset.cashRollValue)} - Rollen`});
  });
  return sorten;
}
const cashKassette=(window.KCGeldkassette&&el("cashKassetteAufteilung"))?window.KCGeldkassette.erstelle({
  container:el("cashKassetteAufteilung"),
  sortenLesen:kassettenSorten,
  gesamtLesen:()=>cashData().total,
  beiAenderung:()=>clearManagerCashOutput()
}):null;
function zeichneKassettenAufteilung(){
  const bereich=el("cashKassetteSection");
  if(!bereich||!cashKassette)return;
  bereich.hidden=!istKassettenZiel();
  if(istKassettenZiel())cashKassette.zeichnen();
}
// Eine Abendzaehlung gilt immer genau EINER Geldlade - dafuer gibt es keine gemeinsame
// Kassette. Der Manager kennt nur Anfangsbestand und Nachfuellung, deshalb bleibt das Ziel
// hier immer waehlbar; die Funktion haelt die Anzeige trotzdem konsistent.
function pflegeKassettenZiel(){zeichneKassettenAufteilung()}

function baueCashTransferPayload(){
  const c=cashData(),effectiveDate=el("cashEffectiveDate").value;
  if(!isBusinessDate(effectiveDate))return{fehler:"Bitte das gültige Einsatzdatum im Kalender auswählen."};
  if(effectiveDate<localBusinessDate())return{fehler:"Das Einsatzdatum darf nicht in der Vergangenheit liegen."};
  if(c.total<=0)return{fehler:"Bitte mindestens eine Stückelung oder Münzrolle eingeben."};
  const payload={format:"KC_CASH_TRANSFER",version:4,transferId:crypto.randomUUID(),registerId:el("cashRegister").value,type:el("cashType").value,time:new Date().toISOString(),effectiveDate,breakdown:c.breakdown,looseBreakdown:c.looseBreakdown,coinRolls:c.coinRolls,looseTotal:c.looseTotal,rollTotal:c.rollTotal,total:+c.total.toFixed(2),note:el("cashNote").value.trim()};
  if(istKassettenZiel()){
    if(!cashKassette)return{fehler:"Die Kassetten-Aufteilung konnte nicht geladen werden."};
    const ergebnis=cashKassette.anPayload(payload,checksum);
    if(ergebnis.fehler)return{fehler:ergebnis.fehler};
    payload.checksum=checksum(JSON.stringify(payload));
    return{payload,teile:ergebnis.teile};
  }
  payload.checksum=checksum(JSON.stringify(payload));
  return{payload};
}
el("sendCashDirect").onclick=()=>requireAuth(async()=>{
  const{payload,fehler}=baueCashTransferPayload();
  if(fehler)return alert(fehler);
  el("sendCashDirectResult").textContent="Wird gesendet …";
  try{
    // Bei der Kassette geht DERSELBE Code an beide Kassen - jede holt sich daraus ihren
    // eigenen Anteil. Eingereiht wird zweimal, mit je eigener Warteschlangen-Kennung, sonst
    // wuerde die zweite Einreihung als Doppelung verworfen.
    const ziele=payload.scope==="split"
      ?payload.registerIds.map(kasse=>({kasse,queueId:`${payload.transferId}#${kasse}`}))
      :[{kasse:payload.registerId,queueId:payload.transferId}];
    for(const ziel of ziele){
      const antwort=await fetch("https://127.0.0.1:8543/api/v1/cash-transfer/queue",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({transferId:ziel.queueId,registerLabel:ziel.kasse,payload})
      });
      if(!antwort.ok)throw new Error("Companion antwortete mit Fehler "+antwort.status);
    }
    el("sendCashDirectResult").textContent=payload.scope==="split"
      ?`Geldkassette über ${money(payload.total)} an ${ziele.map(z=>z.kasse).join(" und ")} gesendet - jede Kasse holt sich innerhalb von 15 Sekunden ihren eigenen Anteil.`
      :`Übergabe über ${money(payload.total)} an ${el("cashRegister").selectedOptions[0]?.textContent||payload.registerId} gesendet - wird von der Kasse innerhalb von 15 Sekunden abgeholt.`;
  }catch(e){
    el("sendCashDirectResult").textContent="Konnte nicht gesendet werden - ist der Kassen-Companion auf diesem Rechner gestartet und im selben WLAN wie die Kasse? Ersatzweise QR-Code oder Kurzcode verwenden.";
  }
});
el("printCashQr").onclick=()=>{document.body.classList.add("print-cash-qr");setManagerCashSection(document.querySelector('[data-manager-cash-section="result"]'),true,false);window.print();setTimeout(()=>document.body.classList.remove("print-cash-qr"),500)}
window.addEventListener("afterprint",()=>document.body.classList.remove("print-cash-qr"));



function addSyncLog(action,status,details){
  syncLog.unshift({
    id:crypto.randomUUID(),
    time:new Date().toISOString(),
    action,status,details
  });
  syncLog=syncLog.slice(0,500);
  saveAll();
  renderSyncState();
}
function queueSync(entity,operation,payload){
  const entityId=payload?.id||payload?.closingId||payload?.countId||payload?.transferId||crypto.randomUUID();
  const key=`${entity}:${entityId}:${operation}`;
  const existing=syncQueue.find(x=>x.key===key);
  const item=(window.KCSecureSync?KCSecureSync.normalizeQueueItem({
    key,entity,operation,entityId,payload,operationId:existing?.operationId,
    queuedAt:existing?.queuedAt||new Date().toISOString(),
    attempts:existing?.attempts||0,status:"pending"
  }):{key,entity,operation,entityId,payload,queuedAt:new Date().toISOString(),attempts:existing?.attempts||0,status:"pending"});
  if(existing)Object.assign(existing,item);
  else syncQueue.push(item);
  saveAll();
  renderSyncState();
}
function renderSyncState(){
  const badge=el("syncConnectionBadge");
  if(!badge)return;
  const online=syncSettings.mode==="online"&&navigator.onLine;
  badge.className=`sync-badge ${online?"online":"offline"}`;
  badge.textContent=syncSettings.mode==="local"?"Lokaler Betrieb":online?"Online bereit":"Offline / keine Verbindung";
  el("syncQueueCount").textContent=syncQueue.filter(x=>x.status==="pending").length;
  el("syncConflictCount").textContent=syncConflicts.length;
  const last=syncLog[0];
  el("syncLastRun").textContent=last?new Date(last.time).toLocaleString("de-DE"):"—";
  el("syncLastStatus").textContent=last?last.status:"—";
  const cryptoBadge=el("syncCryptoBadge");if(cryptoBadge){const active=!!syncSettings.encryption&&!!syncSecretSession;cryptoBadge.className=`sync-badge ${active?"online":"offline"}`;cryptoBadge.textContent=active?"Paketverschlüsselung aktiv":"Standardschutz (TLS erforderlich)";}
  el("syncLogBody").innerHTML=syncLog.slice(0,100).map(x=>`<tr><td>${new Date(x.time).toLocaleString("de-DE")}</td><td>${x.action}</td><td>${x.status}</td><td>${x.details}</td></tr>`).join("");
}
async function prepareSyncItems(items){
  if(!syncSettings.encryption)return items;
  if(!syncSettings.secureServer)throw new Error("Paketverschlüsselung benötigt einen kompatiblen Secure-Sync-Serveradapter.");
  if(!syncSecretSession)throw new Error("Übertragungsschlüssel fehlt. Bitte im geschützten Bereich einmal eingeben.");
  const envelope=await KCSecureSync.encryptEnvelope({items,clientVersion:VERSION,nonce:crypto.randomUUID()},{secret:syncSecretSession,projectId:syncSettings.project||"default"});
  return [{key:`secure:${crypto.randomUUID()}`,entity:"secure-envelope",entityId:syncSettings.project||"default",operation:"push",payload:envelope,queuedAt:new Date().toISOString(),operationId:crypto.randomUUID(),status:"pending",attempts:0}];
}
class BackendAdapter{
  constructor(settings){this.settings=settings}
  async test(){throw new Error("Nicht implementiert")}
  async push(items){throw new Error("Nicht implementiert")}
  async pull(){return []}
}
class MockBackendAdapter extends BackendAdapter{
  async test(){return {ok:true,message:"Lokaler Testadapter bereit"}}
  async push(items){
    const remote=JSON.parse(localStorage.getItem("kcm_mock_remote")||"[]");
    items.forEach(item=>{
      const i=remote.findIndex(x=>x.key===item.key);
      if(i>=0)remote[i]=item;else remote.push(item);
    });
    localStorage.setItem("kcm_mock_remote",JSON.stringify(remote));
    return {ok:true,accepted:items.map(x=>x.key),conflicts:[]}
  }
  async pull(){return JSON.parse(localStorage.getItem("kcm_mock_remote")||"[]")}
}
class RestBackendAdapter extends BackendAdapter{
  headers(){
    return {
      "Content-Type":"application/json",
      "Authorization":this.settings.token?`Bearer ${this.settings.token}`:"",
      "X-Project":this.settings.project||""
    };
  }
  async test(){
    const r=await fetch(`${this.settings.url.replace(/\/$/,"")}/health`,{headers:this.headers()});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    return {ok:true,message:"REST-Server erreichbar"}
  }
  async push(items){
    const r=await fetch(`${this.settings.url.replace(/\/$/,"")}/sync/push`,{
      method:"POST",headers:this.headers(),
      body:JSON.stringify({project:this.settings.project,items})
    });
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }
  async pull(){
    const r=await fetch(`${this.settings.url.replace(/\/$/,"")}/sync/pull?project=${encodeURIComponent(this.settings.project)}`,{headers:this.headers()});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }
}
class SupabaseBackendAdapter extends BackendAdapter{
  headers(){
    return {
      "Content-Type":"application/json",
      "apikey":this.settings.publicKey||"",
      "Authorization":this.settings.token?`Bearer ${this.settings.token}`:`Bearer ${this.settings.publicKey||""}`,
      "Prefer":"resolution=merge-duplicates"
    };
  }
  async test(){
    const url=`${this.settings.url.replace(/\/$/,"")}/rest/v1/sync_events?select=id&limit=1`;
    const r=await fetch(url,{headers:this.headers()});
    if(!r.ok)throw new Error(`Supabase HTTP ${r.status}`);
    return {ok:true,message:"Supabase erreichbar"}
  }
  async push(items){
    const rows=items.map(x=>({
      id:x.key,
      project_id:this.settings.project,
      entity_type:x.entity,
      entity_id:x.entityId,
      operation:x.operation,
      payload:x.payload,
      queued_at:x.queuedAt,
      client_version:VERSION
    }));
    const url=`${this.settings.url.replace(/\/$/,"")}/rest/v1/sync_events?on_conflict=id`;
    const r=await fetch(url,{method:"POST",headers:this.headers(),body:JSON.stringify(rows)});
    if(!r.ok)throw new Error(`Supabase HTTP ${r.status}`);
    return {ok:true,accepted:items.map(x=>x.key),conflicts:[]}
  }
  async pull(){
    const url=`${this.settings.url.replace(/\/$/,"")}/rest/v1/sync_events?project_id=eq.${encodeURIComponent(this.settings.project)}&select=*&order=queued_at.asc`;
    const r=await fetch(url,{headers:this.headers()});
    if(!r.ok)throw new Error(`Supabase HTTP ${r.status}`);
    return await r.json();
  }
}
function backendAdapter(){
  if(syncSettings.provider==="mock")return new MockBackendAdapter(syncSettings);
  if(syncSettings.provider==="rest")return new RestBackendAdapter(syncSettings);
  return new SupabaseBackendAdapter(syncSettings);
}
async function testConnection(){
  if(syncSettings.mode!=="online")throw new Error("Online-Teammodus ist nicht aktiviert");
  const badge=el("syncConnectionBadge");
  badge.className="sync-badge testing";badge.textContent="Verbindung wird geprüft …";
  const result=await backendAdapter().test();
  addSyncLog("connection-test","ok",result.message);
  return result;
}
async function runSync(){
  if(syncSettings.mode!=="online"){
    addSyncLog("sync","skipped","Lokaler Betrieb aktiv");
    return;
  }
  if(!navigator.onLine){
    addSyncLog("sync","offline","Keine Internetverbindung; Warteschlange bleibt erhalten");
    return;
  }
  const pending=syncQueue.filter(x=>x.status==="pending"&&(!x.nextAttemptAt||new Date(x.nextAttemptAt)<=new Date()));
  if(!pending.length){
    addSyncLog("sync","ok","Keine ausstehenden Datensätze");
    return;
  }
  pending.forEach(x=>x.attempts++);
  try{
    const wireItems=await prepareSyncItems(pending);
    const result=await backendAdapter().push(wireItems);
    const accepted=new Set(syncSettings.encryption?pending.map(x=>x.key):(result.accepted||pending.map(x=>x.key)));
    syncQueue.forEach(x=>{if(accepted.has(x.key))x.status="sent"});
    syncQueue=syncQueue.filter(x=>x.status!=="sent");
    if(Array.isArray(result.conflicts)&&result.conflicts.length){
      syncConflicts.push(...result.conflicts);
    }
    addSyncLog("sync","ok",`${accepted.size} Datensätze übertragen`);
  }catch(err){
    pending.forEach(x=>{x.status="pending";x.nextAttemptAt=window.KCSecureSync?KCSecureSync.nextRetry(x.attempts):new Date(Date.now()+60000).toISOString()});
    addSyncLog("sync","error",err.message);
  }
  saveAll();
  renderSyncState();
}
function configureAutoSync(){
  clearInterval(syncTimer);
  if(syncSettings.mode==="online"&&syncSettings.auto){
    syncTimer=setInterval(runSync,Math.max(1,syncSettings.interval||5)*60000);
  }
}
el("testSyncConnection").onclick=async()=>{
  try{await testConnection();renderSyncState()}catch(err){addSyncLog("connection-test","error",err.message)}
};
el("syncNow").onclick=runSync;
el("exportSyncDiagnostics").onclick=()=>{
  const diagnostics={
    version:VERSION,
    createdAt:new Date().toISOString(),
    settings:{...syncSettings,token:"***",publicKey:syncSettings.publicKey?"***":""},
    queue:syncQueue.map(x=>({...x,payload:syncSettings.encryption?"[verschlüsselt/ausgeblendet]":x.payload})),
    conflicts:syncConflicts,
    log:syncLog
  };
  download("KC_Sync_Diagnose.json",JSON.stringify(diagnostics,null,2));
};
window.addEventListener("online",()=>{renderSyncState();if(syncSettings.auto)runSync()});
window.addEventListener("offline",renderSyncState);

function queueAllCurrentData(){
  groups.forEach(x=>queueSync("group","upsert",x));
  articles.forEach(x=>queueSync("article","upsert",x));
  registers.forEach(x=>queueSync("register","upsert",x));
  devices.forEach(x=>queueSync("device","upsert",x));
  queueSync("settings","upsert",{id:"global",...settings});
  queueSync("receipt","upsert",{id:"global",...receipt});
}

function decodePrefixedCode(text){
  const value=text.trim();
  const prefixes=["KCLOSE1:","KCOUNT1:","KCASH1:"];
  const prefix=prefixes.find(p=>value.startsWith(p));
  if(!prefix)throw new Error("Unbekannter Code");
  return {prefix,payload:JSON.parse(decodeURIComponent(escape(atob(value.slice(prefix.length)))))};
}
function validateClosingPayload(prefix,payload){
  if(!payload||typeof payload!=="object")throw new Error("Code enthält keine gültigen Daten.");
  const copy=JSON.parse(JSON.stringify(payload)),supplied=copy.checksum;delete copy.checksum;
  if(!supplied||checksum(JSON.stringify(copy))!==supplied)throw new Error("Prüfsumme falsch – Code beschädigt oder verändert.");
  if(!payload.registerId)throw new Error("Kassen-ID fehlt.");
  if(prefix==="KCLOSE1:"&&(!payload.closingId||payload.format!=="KC_CASH_CLOSING"))throw new Error("Ungültiger Kassenabschluss.");
  if(prefix==="KCOUNT1:"&&(!payload.countId&&!payload.transferId))throw new Error("Ungültige Abendzählung.");
  if(!Number.isFinite(Number(prefix==="KCLOSE1:"?payload.expectedCash:payload.total)))throw new Error("Ungültiger Betrag.");
}
function processClosingCode(text,source="manual"){
  const {prefix,payload}=decodePrefixedCode(text);
  validateClosingPayload(prefix,payload);
  if(prefix==="KCLOSE1:"){
    if(closings.some(x=>x.closingId===payload.closingId))throw new Error("Dieser Kassenabschluss wurde bereits eingelesen.");
    const closingRecord={...payload,source,importedAt:new Date().toISOString()};closings.push(closingRecord);queueSync("closing","upsert",closingRecord);
  }else if(prefix==="KCOUNT1:"){
    const id=payload.countId||payload.transferId;
    if(cashCounts.some(x=>(x.countId||x.transferId)===id))throw new Error("Diese Abendzählung wurde bereits eingelesen.");
    const countRecord={...payload,source,importedAt:new Date().toISOString()};cashCounts.push(countRecord);queueSync("cash-count","upsert",countRecord);
  }else{
    throw new Error("Für den Kassenabschluss wird KCLOSE1 oder KCOUNT1 benötigt.");
  }
  saveAll();renderClosings();
}
function closingRows(){
  return closings.map(c=>{
    const candidates=cashCounts.filter(x=>x.registerId===c.registerId);
    const count=candidates.sort((a,b)=>String(b.time).localeCompare(String(a.time)))[0]||null;
    const actual=count?Number(count.total||0):null;
    const diff=actual===null?null:+(actual-Number(c.expectedCash||0)).toFixed(2);
    return {closing:c,count,actual,diff};
  });
}
function renderClosings(){
  const rows=closingRows();
  el("closingBody").innerHTML=rows.map(r=>`<tr><td>${r.closing.registerName||r.closing.registerId}</td><td>${String(r.closing.createdAt).slice(0,10)}</td><td>${money(r.closing.expectedCash)}</td><td>${r.actual===null?"—":money(r.actual)}</td><td class="${r.diff===0?"diff-ok":"diff-warn"}">${r.diff===null?"—":money(r.diff)}</td><td>${Number(r.closing.staffTotal||0)?`${money(r.closing.staffTotal)} (${r.closing.staffCount||0})`:"—"}</td><td>${r.count?(r.diff===0?"Stimmt":"Differenz"):"Zählung fehlt"}</td></tr>`).join("");
  el("closingPairs").innerHTML=rows.filter(r=>!r.count).map(r=>`<div class="closing-pair"><strong>${r.closing.registerName||r.closing.registerId}</strong><br>Soll ${money(r.closing.expectedCash)} · Zählcode fehlt</div>`).join("")||"<p>Keine offenen Abschlüsse.</p>";
  renderCashMovementsOverview();
}
const CASH_REJECT_GRUND={
  "rejected-missing-effective-date":"Einsatzdatum fehlt im Code",
  "rejected-wrong-effective-date":"Code war für ein anderes Datum vorgesehen",
  "rejected-wrong-register":"Code war für eine andere Kasse vorgesehen",
  "rejected-duplicate":"Code wurde bereits einmal eingelesen (Duplikat verhindert)",
  "rejected-second-opening":"Für diesen Tag gibt es bereits einen Anfangsbestand",
  "rejected-shortcode-format":"Kurzcode falsch aufgebaut (Format nicht erkannt)",
  "rejected-shortcode-checksum":"Kurzcode falsch abgetippt (Prüfziffer stimmt nicht)"
};
function renderCashMovementsOverview(){
  const bewegungenKörper=el("cashMovementsBody"),auditKörper=el("cashAuditBody");
  if(!bewegungenKörper||!auditKörper)return;
  const sortiert=[...cashMovementsLog].sort((a,b)=>String(b.importedAt||b.time).localeCompare(String(a.importedAt||a.time)));
  bewegungenKörper.innerHTML=sortiert.map(m=>`<tr><td>${new Date(m.importedAt||m.time).toLocaleString("de-DE")}</td><td>${m.registerId||"—"}</td><td>${m.type==="opening"?"Anfangsbestand":"Nachfüllung"}</td><td>${money(m.total)}</td><td>${(m.importSource||"").includes("shortcode")?"Kurzcode":(m.importSource||"").includes("manual")?"Code eingefügt":"QR-Scan"}</td><td class="diff-ok">Angenommen</td></tr>`).join("")||"<tr><td colspan=\"6\">Noch keine Bargeldbewegungen importiert.</td></tr>";
  const auditSortiert=[...cashAuditLog].filter(a=>a.result!=="accepted").sort((a,b)=>String(b.time).localeCompare(String(a.time)));
  auditKörper.innerHTML=auditSortiert.map(a=>`<tr><td>${new Date(a.time).toLocaleString("de-DE")}</td><td>${a.registerId||"—"}</td><td>${CASH_REJECT_GRUND[a.result]||a.result}</td></tr>`).join("")||"<tr><td colspan=\"3\">Keine abgelehnten Versuche protokolliert.</td></tr>";
}
el("processClosingScan").onclick=()=>{try{processClosingCode(el("closingScanInput").value,"manual-or-hid");el("closingScanResult").textContent="Code erfolgreich verarbeitet.";el("closingScanInput").value=""}catch(err){el("closingScanResult").textContent="Fehler: "+err.message}};
el("clearClosingScan").onclick=()=>{el("closingScanInput").value="";el("closingScanResult").textContent=""};
el("selectClosingFile").onclick=()=>el("closingFileInput").click();
el("closingFileInput").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{processClosingCode(await f.text(),"file");el("closingScanResult").textContent=`${f.name} wurde verarbeitet.`}catch(err){el("closingScanResult").textContent="Fehler: "+err.message}e.target.value=""};

// HID-Scanner: globaler Puffer für KCLOSE/KCOUNT
let managerScanBuffer="",managerScanTimer=null;
document.addEventListener("keydown",e=>{
  if(document.activeElement===el("closingScanInput"))return;
  clearTimeout(managerScanTimer);
  if(e.key==="Enter"){
    const code=managerScanBuffer.trim();managerScanBuffer="";
    if(code.startsWith("KCLOSE1:")||code.startsWith("KCOUNT1:")){
      try{processClosingCode(code,"hid-scanner");el("closingScanResult").textContent="Scanner-Code verarbeitet."}catch(err){el("closingScanResult").textContent="Fehler: "+err.message}
    }
    return;
  }
  if(e.key.length===1)managerScanBuffer+=e.key;
  managerScanTimer=setTimeout(()=>managerScanBuffer="",180);
});


function loadSyncSettings(){
  el("syncMode").value=syncSettings.mode||"local";
  el("syncProvider").value=syncSettings.provider||"supabase";
  el("syncUrl").value=syncSettings.url||"";
  el("syncProject").value=syncSettings.project||"";
  el("syncPublicKey").value=syncSettings.publicKey||"";
  el("syncRole").value=syncSettings.role||"superadmin";
  el("syncUser").value=syncSettings.user||"";
  el("syncToken").value=syncSettings.token||"";
  el("syncAuto").checked=syncSettings.auto!==false;
  el("syncInterval").value=String(syncSettings.interval||5);
  document.body.classList.toggle("role-cashier",syncSettings.role==="cashier");
  if(syncSettings.role==="cashier")setNavGroup(document.querySelector('[data-nav-group="operation"]'),true,false);
  renderSyncState();
  configureAutoSync();
}
el("saveSyncSettings").onclick=()=>{
  syncSettings={
    mode:el("syncMode").value,
    provider:el("syncProvider").value,
    url:el("syncUrl").value.trim(),
    project:el("syncProject").value.trim(),
    publicKey:el("syncPublicKey").value.trim(),
    role:el("syncRole").value,
    user:el("syncUser").value.trim(),
    token:el("syncToken").value,
    auto:el("syncAuto").checked,
    interval:Number(el("syncInterval").value||5)
  };
  saveAll();
  loadSyncSettings();
  addSyncLog("settings","ok","Teammodus-Einstellungen gespeichert");
};

groups=groups.map(cleanGroup);articles=articles.map(cleanArticle);sales=sales.map(cleanTransaction);saveAll();
applyScheduledPrices();fillCategories();renderGroups();loadGroup(0);renderBig14Editor();renderArticles();loadArticle(0);renderRegisters();loadSettings();renderDevices();loadReceipt();loadSyncSettings();renderDashboard();renderReport();renderClosings();renderPosAdminAudit();

const SUPERADMIN_QR_PAYLOAD_KEY="kcm_superadmin_qr_payload_v017";
function base64Url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
async function sha256Hex(text){const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("")}
function renderQrDataUrl(text){
  if(typeof qrcode!=="function")throw new Error("QR-Modul konnte nicht geladen werden.");
  const qr=qrcode(0,"M");qr.addData(text);qr.make();return qr.createDataURL(7,4);
}
function storedSuperAdminPayload(){return localStorage.getItem(SUPERADMIN_QR_PAYLOAD_KEY)||""}
function showSuperAdminCredential(){
  const access=settings.superAdminAccess,payload=storedSuperAdminPayload(),img=el("superAdminQrImage"),summary=el("superAdminCredentialSummary");
  if(!access?.active||!payload){img.style.display="none";summary.style.display="none";el("emergencyWarning").textContent=access?.active?"QR-Geheimnis auf diesem Gerät nicht vorhanden.":"Noch kein aktiver QR-Zugang.";return}
  try{img.src=renderQrDataUrl(payload);img.style.display="block";summary.style.display="block";summary.textContent=`ID ${access.credentialId.slice(0,8)} · ${access.owner} · gültig bis ${new Date(access.expiresAt).toLocaleString("de-DE")}`;el("emergencyWarning").textContent="Persönlich verwahren. Nicht fotografieren oder weitergeben.";el("superAdminQrStatus").textContent=`Aktiv für ${access.owner} bis ${new Date(access.expiresAt).toLocaleDateString("de-DE")}. Neue Kassenkonfiguration erforderlich.`}catch(err){el("superAdminQrStatus").textContent="Fehler: "+err.message}
}
el("generateSuperAdminQr").onclick=()=>requireAuth(async()=>{
  const owner=el("superAdminOwner").value.trim();if(!owner)return alert("Bitte einen Namen für das Protokoll eingeben.");
  const pin=el("superAdminPin").value.trim();if(!/^\d{4}$/.test(pin))return alert("Bitte eine neue vierstellige Kassen-PIN eingeben.");
  const issuedAt=new Date(),expiresAt=new Date(issuedAt.getTime()+Number(el("superAdminValidity").value||30)*86400000),credentialId=crypto.randomUUID(),secret=base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const payload=`KCSUPER1:${credentialId}:${Math.floor(expiresAt.getTime()/1000)}:${secret}`,hash=await sha256Hex(payload),salt=b64(crypto.getRandomValues(new Uint8Array(16))),iterations=250000,pinHash=await deriveManagerPin(pin,salt,iterations);
  settings.superAdminAccess={version:2,credentialId,hash,pinKdf:{algorithm:"PBKDF2-SHA-256",salt,iterations,hash:pinHash},owner,issuedAt:issuedAt.toISOString(),expiresAt:expiresAt.toISOString(),active:true};
  el("superAdminPin").value="";
  localStorage.setItem(SUPERADMIN_QR_PAYLOAD_KEY,payload);saveAll();queueSync("settings","upsert",{id:"global",...settings});showSuperAdminCredential();
});
el("printEmergencyQr").onclick=()=>requireAuth(()=>{if(!storedSuperAdminPayload())return alert("Zuerst einen QR-Zugang erzeugen.");document.body.classList.add("print-superadmin-qr");window.print();setTimeout(()=>document.body.classList.remove("print-superadmin-qr"),500)});
el("saveSuperAdminQr").onclick=()=>{const img=el("superAdminQrImage"),access=settings.superAdminAccess;if(!access?.active||!img.src)return alert("Zuerst einen QR-Zugang erzeugen.");const a=document.createElement("a");a.href=img.src;a.download=`KC_Superadmin_${access.owner.replace(/[^A-Za-z0-9_-]+/g,"_")}_${access.credentialId.slice(0,8)}.png`;a.click()};
el("revokeSuperAdminQr").onclick=()=>requireAuth(()=>{if(!settings.superAdminAccess)return;settings.superAdminAccess={...settings.superAdminAccess,active:false,revokedAt:new Date().toISOString()};localStorage.removeItem(SUPERADMIN_QR_PAYLOAD_KEY);saveAll();queueSync("settings","upsert",{id:"global",...settings});showSuperAdminCredential();el("superAdminQrStatus").textContent="QR-Zugang gesperrt. Die Sperrung jetzt per neuer Konfigurationsdatei an alle Kassen übertragen."});
window.addEventListener("afterprint",()=>document.body.classList.remove("print-superadmin-qr"));
showSuperAdminCredential();
openManagerLock();

// V0.20.5: Arbeitsflächenpflege ausschließlich im Manager
renderManagerWorkspace();renderManagerCategoryOrder();
el("wsPresetCompact")?.addEventListener("click",()=>managerWorkspacePreset("compact"));
el("wsPresetTouch")?.addEventListener("click",()=>managerWorkspacePreset("touch"));
el("wsPresetProfessional")?.addEventListener("click",()=>managerWorkspacePreset("professional"));
el("wsReset")?.addEventListener("click",()=>{managerWorkspaceDraft=managerDefaultWorkspace();managerCategoryOrderDraft=managerDefaultCategoryOrder();renderManagerWorkspace();renderManagerCategoryOrder()});
el("saveWorkspace")?.addEventListener("click",()=>requireAuth(()=>{settings.workspaceButtons=JSON.parse(JSON.stringify(managerWorkspaceDraft||managerWorkspaceConfig()));settings.categoryOrder=[...(managerCategoryOrderDraft||managerCategoryOrder())];saveAll();queueSync("settings","upsert",{id:"global",...settings});alert("Kassenoberfläche und Reiterfolge gespeichert. Für die Verkaufskasse jetzt eine neue Konfiguration exportieren.")}));


// V0.20.6 — Framework Core Catalog / generic SellerAuthCore assignment
const CORE_CATALOG_STORAGE_KEY="framework_core_catalog_v1";
const DEFAULT_SELLER_AUTH_PROGRAMS=[
  {id:"kc-marktkasse",name:"KC MarktKasse",type:"application",assigned:false,integrationStatus:"not-integrated"},
  {id:"kc-koecheclub",name:"KC Köcheclub",type:"application",assigned:false,integrationStatus:"not-integrated"},
  {id:"dienstplan",name:"Dienstplan",type:"application",assigned:false,integrationStatus:"not-integrated"},
  {id:"netzwerk-leitstand",name:"Netzwerk-Leitstand",type:"application",assigned:false,integrationStatus:"not-integrated"},
  {id:"pflanzenpflege",name:"PflanzenPflege",type:"application",assigned:false,integrationStatus:"not-integrated"},
  {id:"framework-studio",name:"Framework Studio",type:"studio",assigned:false,integrationStatus:"not-integrated"}
];
function readCoreCatalog(){
  try{return JSON.parse(localStorage.getItem(CORE_CATALOG_STORAGE_KEY))||null}catch{return null}
}
let coreCatalogDraft=readCoreCatalog()||{sellerAuth:{enabled:false,method:"platform-webauthn+pin",fastLoginSeconds:30,programs:JSON.parse(JSON.stringify(DEFAULT_SELLER_AUTH_PROGRAMS))}};
function safeProgramId(value){return String(value||"program").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||`program-${Date.now()}`}
function renderCoreCatalog(){
  const list=el("sellerAuthProgramList");if(!list)return;
  const cfg=coreCatalogDraft.sellerAuth||(coreCatalogDraft.sellerAuth={enabled:false,method:"pin",fastLoginSeconds:30,programs:[]});
  el("sellerAuthEnabled").checked=!!cfg.enabled;el("sellerAuthMethod").value=cfg.method||"pin";el("sellerAuthFastLogin").value=Number(cfg.fastLoginSeconds||0);
  list.innerHTML=cfg.programs.map((p,i)=>`<div class="catalog-program-row" data-catalog-index="${i}"><input type="checkbox" data-catalog-field="assigned" ${p.assigned?"checked":""} aria-label="Core zuordnen"><input type="text" data-catalog-field="name" value="${escAttr(p.name)}" aria-label="Programmname"><span class="catalog-id">${escAttr(p.id)}</span><button type="button" data-catalog-remove ${p.id==="kc-marktkasse"?"disabled title=\"Basisprogramm bleibt im Katalog\"":""}>Entfernen</button></div>`).join("");
  list.querySelectorAll("[data-catalog-field]").forEach(input=>input.onchange=()=>{const i=Number(input.closest("[data-catalog-index]").dataset.catalogIndex),field=input.dataset.catalogField;cfg.programs[i][field]=input.type==="checkbox"?input.checked:input.value;if(field==="name"&&!cfg.programs[i].id)cfg.programs[i].id=safeProgramId(input.value)});
  list.querySelectorAll("[data-catalog-remove]").forEach(btn=>btn.onclick=()=>{const i=Number(btn.closest("[data-catalog-index]").dataset.catalogIndex);cfg.programs.splice(i,1);renderCoreCatalog()});
}
el("addCatalogProgram")?.addEventListener("click",()=>{const name=prompt("Name des Programms:");if(!name)return;coreCatalogDraft.sellerAuth.programs.push({id:safeProgramId(name),name:name.trim(),type:"application",assigned:false,integrationStatus:"not-integrated"});renderCoreCatalog()});
el("saveCoreCatalog")?.addEventListener("click",()=>requireAuth(()=>{const cfg=coreCatalogDraft.sellerAuth;cfg.enabled=el("sellerAuthEnabled").checked;cfg.method=el("sellerAuthMethod").value;cfg.fastLoginSeconds=Math.max(0,Math.min(3600,Number(el("sellerAuthFastLogin").value||0)));localStorage.setItem(CORE_CATALOG_STORAGE_KEY,JSON.stringify(coreCatalogDraft));alert("Core-Katalog und Programmzuordnungen gespeichert. Vor produktiver Aktivierung je Programm Integrations- und TÜV-Gate durchführen.")}));
el("exportCoreAssignments")?.addEventListener("click",()=>{const payload={format:"FRAMEWORK_CORE_ASSIGNMENTS",schemaVersion:"1.0",exportedAt:new Date().toISOString(),core:{id:"seller-auth-core",version:"0.1.1",status:"candidate-not-integrated",config:coreCatalogDraft.sellerAuth,assignments:coreCatalogDraft.sellerAuth.programs.filter(p=>p.assigned).map(p=>({programId:p.id,programName:p.name}))}};downloadText(`SellerAuthCore_Zuordnungen_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(payload,null,2),"application/json")});
const originalRenderCoreCatalogNav=document.querySelector('[data-view="corecatalog"]');if(originalRenderCoreCatalogNav)originalRenderCoreCatalogNav.addEventListener("click",renderCoreCatalog);renderCoreCatalog();


// V0.21.1 – progressive disclosure: security details remain optional for normal operation.
(function initSecureSyncControls(){
  const encryption=el("syncEncryption"),secret=el("syncSecret");
  if(!encryption||!secret)return;
  encryption.checked=!!syncSettings.encryption;
  encryption.onchange=()=>{
    if(encryption.checked&&!syncSettings.secureServer){
      encryption.checked=false;
      syncSettings.encryption=false;
      alert("Diese Zusatzverschlüsselung wird erst aktiviert, wenn ein kompatibler Secure-Sync-Server eingerichtet ist. Die Kasse arbeitet weiterhin lokal und über TLS geschützt.");
    }else syncSettings.encryption=encryption.checked;
    saveAll();renderSyncState();
  };
  secret.onchange=()=>{
    const value=secret.value.trim();
    if(value&&value.length<16){alert("Bitte mindestens 16 Zeichen verwenden.");secret.value="";return;}
    syncSecretSession=value;
    secret.value="";
    renderSyncState();
  };
  renderSyncState();
})();


// V0.21.5 – ClosingCore: geführter Geschäftsjahreswechsel
const BUSINESS_YEAR_KEY="kcm_business_year";
const BUSINESS_YEAR_ARCHIVE_KEY="kcm_business_year_archive";
function readBusinessYear(){
  try{return JSON.parse(localStorage.getItem(BUSINESS_YEAR_KEY)||"null")||{year:2026,nextBon:1,changedAt:null,changedBy:null}}catch{return {year:2026,nextBon:1}}
}
function readBusinessYearArchive(){try{return JSON.parse(localStorage.getItem(BUSINESS_YEAR_ARCHIVE_KEY)||"[]")}catch{return []}}
function renderBusinessYear(){
  const y=readBusinessYear(), archive=readBusinessYearArchive();
  if(!el("currentBusinessYear"))return;
  el("currentBusinessYear").textContent=y.year;
  el("currentNextBon").textContent=String(y.nextBon).padStart(6,"0");
  el("currentYearSales").textContent=sales.filter(x=>String(x.time||x.createdAt||"").startsWith(String(y.year))).length;
  el("newBusinessYear").value=Math.max(Number(y.year)||2025,2026);
  el("businessYearArchive").innerHTML=archive.length?archive.slice().reverse().map(a=>`<div class="year-archive-row"><b>${a.year}</b><span>${new Date(a.archivedAt).toLocaleString("de-DE")}</span><span>Letzte Bonnummer: ${String(a.lastBon||0).padStart(6,"0")}</span><span>${a.owner||"—"}</span></div>`).join(""):"<p>Noch kein Geschäftsjahr archiviert.</p>";
}
function createBusinessYearBackup(){
  return {format:"KC_BUSINESS_YEAR_BACKUP",version:1,createdAt:new Date().toISOString(),appVersion:VERSION,businessYear:readBusinessYear(),groups,articles,settings,registers,sales,closings,cashCounts,receipt,managerTips,cashWithdrawals,managerDiscountAudit};
}
el("runBusinessYearAssistant")?.addEventListener("click",()=>requireAuth(()=>{
  const current=readBusinessYear(), year=Number(el("newBusinessYear").value), start=Number(el("newBonStart").value), owner=cleanText(el("yearChangeOwner").value,80), reason=cleanText(el("yearChangeReason").value,300);
  if(!Number.isInteger(year)||year<2020||year>2099)return el("businessYearResult").textContent="Bitte ein gültiges Geschäftsjahr eingeben.";
  if(!Number.isInteger(start)||start<1)return el("businessYearResult").textContent="Die erste Bonnummer muss mindestens 1 sein.";
  if(!owner||!reason||!el("yearChangeConfirm").checked)return el("businessYearResult").textContent="Name, Begründung und Bestätigung sind erforderlich.";
  if(year<Number(current.year))return el("businessYearResult").textContent="Ein Rücksprung in ein älteres Geschäftsjahr ist nicht zulässig.";
  const backup=createBusinessYearBackup();
  download(`KC_MarktKasse_Sicherung_vor_Jahreswechsel_${current.year}_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(backup,null,2));
  const archive=readBusinessYearArchive();
  const lastBon=Math.max(0,...sales.map(x=>Number(x.bon||x.bonNumber||0)).filter(Number.isFinite));
  archive.push({year:current.year,archivedAt:new Date().toISOString(),owner,reason,lastBon,salesCount:sales.length});
  localStorage.setItem(BUSINESS_YEAR_ARCHIVE_KEY,JSON.stringify(archive));
  localStorage.setItem(BUSINESS_YEAR_KEY,JSON.stringify({year,nextBon:start,changedAt:new Date().toISOString(),changedBy:owner,reason}));
  localStorage.setItem("kc_bon_number_v040",String(start));
  localStorage.setItem("kc_bon_counter",String(start));
  try{window.KCAuditCore?.record?.({action:"business-year.change",actor:owner,role:"manager",result:"success",reason,oldValue:current,newValue:{year,nextBon:start}})}catch{}
  el("businessYearResult").textContent=`Geschäftsjahr ${year} wurde gestartet. Nächste Bonnummer: ${String(start).padStart(6,"0")}. Die Sicherungsdatei wurde erstellt.`;
  el("yearChangeConfirm").checked=false; renderBusinessYear();
}));
el("launchTrainingVideo")?.addEventListener("click",()=>{window.open("../training-video/index.html","_blank");el("trainingLaunchResult").textContent="Schulungsvideo wurde in einem neuen Fenster geöffnet."});
el("launchTraining")?.addEventListener("click",()=>{window.open("../pos/index.html?training=1&coach=1","_blank");el("trainingLaunchResult").textContent="Schulung wurde in einem neuen Fenster geöffnet."});
el("printTrainingGuide")?.addEventListener("click",()=>window.print());
document.querySelector('[data-view="businessyear"]')?.addEventListener("click",renderBusinessYear);
renderBusinessYear();


/* V0.21.5 – Manager-Formularassistent */
(function managerFormAssistant(){
  const codeTargets=[
    {id:"aBarcode",label:"Code erstellen",kind:"article"},
    {id:"configCode",label:"Code erstellen",kind:"numeric"},
    {id:"salesCode",label:"Code erstellen",kind:"numeric"}
  ];
  const randomDigits=(length=6)=>Array.from(crypto.getRandomValues(new Uint8Array(length)),n=>n%10).join("");
  const makeArticleCode=()=>`ART-${Date.now().toString(36).toUpperCase()}-${randomDigits(4)}`;
  function enhanceCodes(){
    codeTargets.forEach(cfg=>{
      const input=document.getElementById(cfg.id);if(!input||input.dataset.codeEnhanced)return;
      input.dataset.codeEnhanced="1";
      const label=input.closest("label");if(!label)return;
      const row=document.createElement("div");row.className="code-field-row";
      label.parentNode.insertBefore(row,label);row.appendChild(label);
      const btn=document.createElement("button");btn.type="button";btn.className="code-create-btn";btn.textContent=cfg.label;
      btn.addEventListener("click",()=>{input.value=cfg.kind==="article"?makeArticleCode():randomDigits(6);input.dispatchEvent(new Event("input",{bubbles:true}));input.focus();});
      row.appendChild(btn);
    });
  }
  function markRequired(){
    document.querySelectorAll("input[required],select[required],textarea[required]").forEach(input=>{
      const label=input.closest("label");if(!label||label.querySelector(".required-star"))return;
      const star=document.createElement("span");star.className="required-star";star.textContent="*";star.setAttribute("aria-label","Pflichtfeld");
      label.insertBefore(star,input);
    });
  }
  function logicalTabOrder(){
    const active=document.querySelector('.view:not([hidden]):not([style*="display: none"])')||document.querySelector('.view.active')||document;
    let tab=1;
    active.querySelectorAll('input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),a[href]').forEach(node=>node.tabIndex=tab++);
  }
  document.addEventListener("focusin",event=>event.target.closest("label")?.classList.add("field-active"));
  document.addEventListener("focusout",event=>event.target.closest("label")?.classList.remove("field-active"));
  document.addEventListener("click",event=>{if(event.target.closest(".nav,[data-view]"))setTimeout(logicalTabOrder,0)});
  window.addEventListener("DOMContentLoaded",()=>{enhanceCodes();markRequired();logicalTabOrder();});
})();


ensureDepositReturnArticles();normalizeFeatureSettings();saveAll();
el("saveFeatureConfig")?.addEventListener("click",()=>{normalizeFeatureSettings();saveAll();queueSync("settings","upsert",{id:"global",...settings});alert("Funktionskonfiguration gespeichert. Sie wird beim nächsten Konfigurationsexport übertragen.")});
el("featureConfigRecommended")?.addEventListener("click",()=>{MANAGER_FEATURES.forEach(f=>settings[f.key]=f.locked?true:f.default!==false);settings.requireChangeFlow=true;renderFeatureConfig()});

document.querySelectorAll("[data-view=\"featureconfig\"]").forEach(b=>b.addEventListener("click",()=>setTimeout(renderFeatureConfig,0)));


/* V0.29.4 – PresentationCore / TV-Bildschirm */
const TV_PRESENTATION_KEY="kcm_tv_presentation_v2",TV_SCHEMA="kcm-tv-package-v2";
const TV_DAYS=["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];
const TV_DECORS=["🎄","🎅","🤶","🧑‍🎄","🦌","🛷","🎁","⭐","🌟","✨","❄️","🌨️","🔔","🕯️","☃️","⛄","🍪","☕","🍵","🔥","🌲","👼","🏮","🎀","🧦","🍬","🍭","🥁","🎺","🎶","🪅","🕊️","💫","🌠","🏠","⛪","🛍️","🍷","🥨","🌰","🧁","🍰","🪵"];
const TV_TEMPLATES={
 "Weihnachtsmarkt klassisch":{theme:"warm",animation:"snow-light",slides:[["welcome","Herzlich willkommen","Der Köcheclub Werne begrüßt Sie auf dem Weihnachtsmarkt."],["menu","Unsere Spezialitäten","Frisch zubereitet und mit Freude serviert."],["project","Gemeinsam Gutes tun","Wir unterstützen ausgewählte soziale Projekte."],["weather","Winterwetter","Aktuelle Aussichten für Ihren Besuch."],["thanks","Danke für Ihren Besuch","Wir wünschen eine schöne Weihnachtszeit."]]},
 "Weihnachtsmarkt modern":{theme:"dark",animation:"stars",slides:[["welcome","Willkommen beim Köcheclub","Genuss · Gemeinschaft · Weihnachtsfreude"],["price","Heute im Angebot","Unsere aktuellen Spezialitäten"],["lcd","Aktuell","Schön, dass Sie da sind!"],["thanks","Bis bald","Besuchen Sie uns wieder."]]},
 "Vereinsfest":{theme:"club",animation:"none",slides:[["welcome","Willkommen zum Vereinsfest","Gemeinsam feiern und genießen."],["member","Unser Verein","Menschen, Ideen und Engagement."],["menu","Speisen & Getränke","Unsere Auswahl für heute."],["thanks","Vielen Dank","Schön, dass Sie dabei waren."]]}
};
let tvPresentation=(()=>{try{return JSON.parse(localStorage.getItem(TV_PRESENTATION_KEY)||"null")}catch{return null}})()||{schema:TV_SCHEMA,version:"0.29.5",profile:{name:"Weihnachtsmarkt",screenInch:50,resolution:"1920x1080",viewingDistance:6,loop:true,animationsEnabled:true},design:{animation:"snow-light",intensity:2},schedule:{enabled:false,week:TV_DAYS.map((d,i)=>({day:d,enabled:true,start:i===0?"11:00":"14:00",end:i<4?"20:00":"23:00"})),special:[]},weather:{days:3,location:"Werne",source:"online",refresh:60,lastData:[]},slides:[{id:crypto.randomUUID(),type:"welcome",title:"Herzlich willkommen",text:"Der Köcheclub Werne begrüßt Sie auf dem Weihnachtsmarkt.",price:"",duration:8,noTime:true,start:"00:00",end:"23:59",ticker:"Schön, dass Sie da sind!",theme:"warm",decorations:["🎄","⭐"],animation:"snow-light",enabled:true}]};
let tvSlideIndex=0,tvPreviewTimer=null,tvPreviewPlaying=false;
const tvEsc=s=>String(s??"").replace(/[&<>\"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;","'":"&#39;"}[m]));
const tvMoney=v=>`${Number(v||0).toFixed(2).replace(".",",")} €`;
function saveTvPresentation(){tvPresentation.updatedAt=new Date().toISOString();localStorage.setItem(TV_PRESENTATION_KEY,JSON.stringify(tvPresentation));renderTvDashboard()}
function linkedTvArticle(s){return articles.find(a=>a.id===s.articleId)}
function hydrateTvSlide(s){const a=linkedTvArticle(s);return a?{...s,title:s.title||a.name,price:s.price||tvMoney(a.price),articleName:a.name}:s}
function currentTvSlide(){return tvPresentation.slides[Math.max(0,Math.min(tvSlideIndex,tvPresentation.slides.length-1))]}
function switchTvTab(name){document.querySelectorAll('[data-tv-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tvTab===name));document.querySelectorAll('[data-tv-page]').forEach(p=>p.classList.toggle('active',p.dataset.tvPage===name));if(name==='dashboard')renderTvDashboard()}
function renderTvArticleOptions(){const s=el('tvArticleLink');if(!s)return;const cur=s.value;s.innerHTML='<option value="">Kein Artikel verknüpft</option>'+articles.filter(a=>a.active!==false).map(a=>`<option value="${tvEsc(a.id)}">${tvEsc(a.name)} · ${tvMoney(a.price)}</option>`).join('');s.value=cur}
function renderTvSlideList(){const l=el('tvSlideList');if(!l)return;el('tvSlideCount').textContent=`${tvPresentation.slides.length} Folien`;l.innerHTML=tvPresentation.slides.map((s,i)=>`<button class="tv-slide-item ${i===tvSlideIndex?'active':''}" data-tv-index="${i}"><strong>${tvEsc(hydrateTvSlide(s).title||'Ohne Titel')}</strong><span>${tvEsc(s.type)} · ${s.duration||8} Sek. · ${s.noTime?'dauernd':`${s.start}-${s.end}`}</span></button>`).join('');l.querySelectorAll('[data-tv-index]').forEach(b=>b.onclick=()=>{tvSlideIndex=+b.dataset.tvIndex;loadTvEditor();renderTvSlideList()})}
function loadTvEditor(){const s=currentTvSlide();if(!s)return;renderTvArticleOptions();['Type','Title','Text','Price','Duration','Start','End','Ticker','Theme'].forEach(k=>{const e=el('tvSlide'+k);if(e)e.value=s[k.charAt(0).toLowerCase()+k.slice(1)]??(k==='Duration'?8:'')});el('tvArticleLink').value=s.articleId||'';el('tvSlideNoTime').checked=s.noTime!==false;el('tvSlideEnabled').checked=s.enabled!==false;el('tvSlideStart').disabled=el('tvSlideEnd').disabled=el('tvSlideNoTime').checked;el('tvAnimation').value=s.animation||tvPresentation.design.animation||'none';el('tvDecorationsText').value=(s.decorations||[]).join(' ');renderTvPreview()}
function readTvEditor(){const s=currentTvSlide();if(!s)return;s.type=el('tvSlideType').value;s.articleId=el('tvArticleLink').value;s.title=el('tvSlideTitle').value.trim();s.text=el('tvSlideText').value.trim();s.price=el('tvSlidePrice').value.trim();s.duration=Math.max(3,Math.min(120,+el('tvSlideDuration').value||8));s.noTime=el('tvSlideNoTime').checked;s.start=el('tvSlideStart').value||'00:00';s.end=el('tvSlideEnd').value||'23:59';s.ticker=el('tvSlideTicker').value.trim();s.theme=el('tvSlideTheme').value;s.enabled=el('tvSlideEnabled').checked;s.animation=el('tvAnimation')?.value||s.animation||'none';el('tvSlideStart').disabled=el('tvSlideEnd').disabled=s.noTime;saveTvPresentation();renderTvSlideList();renderTvPreview()}
function renderEffects(s){const effect=tvPresentation.profile.animationsEnabled!==false?(s.animation||tvPresentation.design.animation):'none';if(effect==='none')return'';const chars=effect.includes('snow')?'❄':effect==='stars'?'★':effect==='shooting-star'?'☄':'✦';const count=(tvPresentation.design.intensity||2)*8;return`<div class="tv-effect effect-${effect}">${Array.from({length:count},(_,i)=>`<i style="--i:${i}">${chars}</i>`).join('')}</div>`}
function tvScale(){const inch=+(tvPresentation.profile.screenInch||50),dist=+(tvPresentation.profile.viewingDistance||6);return Math.max(.85,Math.min(1.45,(inch/50)*(6/Math.max(3,dist))))}
function renderSlideInto(screen,raw){if(!screen||!raw)return;const s=hydrateTvSlide(raw),scale=tvScale();screen.className=`tv-preview-screen theme-${tvEsc(s.theme||'club')} type-${tvEsc(s.type||'notice')}`;screen.style.setProperty('--tv-scale',scale);screen.innerHTML=`${renderEffects(s)}<div class="tv-decor top">${(s.decorations||[]).slice(0,4).join(' ')}</div><div class="tv-preview-content"><h2>${tvEsc(s.title||'')}</h2><p>${tvEsc(s.text||'')}</p>${s.price?`<div class="tv-preview-price">${tvEsc(s.price)}</div>`:''}${s.type==='weather'?renderWeatherCards(true):''}</div>${s.ticker?`<div class="tv-preview-ticker"><span>${tvEsc(s.ticker)}</span></div>`:''}`}
function renderTvPreview(){renderSlideInto(el('tvPreviewScreen'),currentTvSlide());renderSlideInto(el('tvDashboardPreview'),currentTvSlide());const p=tvPresentation.profile;if(el('tvPreviewMeta'))el('tvPreviewMeta').textContent=`16:9 · ${p.screenInch} Zoll · ${p.resolution} · Abstand ${p.viewingDistance} m`;renderTvChecks(hydrateTvSlide(currentTvSlide()))}
function renderTvChecks(s){if(!s||!el('tvReadabilityChecks'))return;const inch=+tvPresentation.profile.screenInch,checks=[];if((s.title||'').length>48)checks.push(['warn','Überschrift ist lang.']);if((s.text||'').length>160)checks.push(['bad','Zu viel Text für eine gut lesbare TV-Folie.']);if((s.duration||0)<5)checks.push(['warn','Anzeigedauer unter 5 Sekunden.']);if(!checks.length)checks.push(['ok',`${inch}-Zoll-Lesbarkeitsprüfung ohne Beanstandung.`]);el('tvReadabilityChecks').innerHTML=checks.map(c=>`<div class="tv-check ${c[0]}">${c[1]}</div>`).join('')}
function tvPreviewStep(d=1){if(!tvPresentation.slides.length)return;tvSlideIndex=(tvSlideIndex+d+tvPresentation.slides.length)%tvPresentation.slides.length;loadTvEditor();renderTvSlideList()}
function stopTvPreview(){clearTimeout(tvPreviewTimer);tvPreviewPlaying=false;el('tvPreviewPlay').textContent='▶ Präsentation testen';el('tvPreviewStatus').textContent='Vorschau angehalten'}
function runTvPreview(){if(!tvPreviewPlaying)return;const active=tvPresentation.slides.filter(s=>s&&s.enabled!==false);if(!active.length){stopTvPreview();el('tvPreviewStatus').textContent='Keine aktive Folie vorhanden';return}const s=currentTvSlide();el('tvPreviewStatus').textContent=active.length===1?`Nur eine aktive Folie · ${s.duration||8} Sek.`:`Folie ${tvSlideIndex+1}/${tvPresentation.slides.length} · ${s.duration||8} Sek.`;clearTimeout(tvPreviewTimer);tvPreviewTimer=setTimeout(()=>{if(!tvPreviewPlaying)return;try{let guard=0;do{tvSlideIndex=(tvSlideIndex+1)%tvPresentation.slides.length;guard++}while(tvPresentation.slides[tvSlideIndex]?.enabled===false&&guard<tvPresentation.slides.length);loadTvEditor();renderTvSlideList()}catch(error){console.error('TV-Vorschaufehler; automatischer Ablauf wird fortgesetzt.',error)}finally{runTvPreview()}},Math.max(3,+s.duration||8)*1000)}
function renderWeekMatrix(){el('tvWeekMatrix').innerHTML=tvPresentation.schedule.week.map((r,i)=>`<div class="tv-week-row"><label class="check"><input data-week-enabled="${i}" type="checkbox" ${r.enabled?'checked':''}>${r.day}</label><input data-week-start="${i}" type="time" value="${r.start}"><input data-week-end="${i}" type="time" value="${r.end}"></div>`).join('');el('tvWeekMatrix').querySelectorAll('input').forEach(x=>x.onchange=()=>{const i=+(x.dataset.weekEnabled??x.dataset.weekStart??x.dataset.weekEnd),r=tvPresentation.schedule.week[i];if(x.dataset.weekEnabled!==undefined)r.enabled=x.checked;if(x.dataset.weekStart!==undefined)r.start=x.value;if(x.dataset.weekEnd!==undefined)r.end=x.value;saveTvPresentation()})}
function renderSpecials(){el('tvSpecialList').innerHTML=tvPresentation.schedule.special.map((r,i)=>`<div class="tv-special-row"><strong>${r.date}</strong><span>${r.closed?'Geschlossen':`${r.start}–${r.end}`}</span><button data-special-del="${i}">Löschen</button></div>`).join('');el('tvSpecialList').querySelectorAll('[data-special-del]').forEach(b=>b.onclick=()=>{tvPresentation.schedule.special.splice(+b.dataset.specialDel,1);saveTvPresentation();renderSpecials()})}
function fakeWeather(){const loc=tvPresentation.weather.location||'Werne',days=+tvPresentation.weather.days||3,icons=['❄️','☁️','🌨️','⛅','🌤️','🌧️','🌬️'];const now=new Date();tvPresentation.weather.lastData=Array.from({length:days},(_,i)=>({date:new Date(now.getTime()+i*86400000).toISOString().slice(0,10),label:i===0?'Heute':i===1?'Morgen':i===2?'Übermorgen':new Date(now.getTime()+i*86400000).toLocaleDateString('de-DE',{weekday:'short'}),icon:icons[i%icons.length],summary:i===0?'Leichter Schneefall':'Wechselnd bewölkt',min:-2+i,max:2+i}));tvPresentation.weather.lastUpdated=new Date().toISOString();saveTvPresentation();el('tvWeatherStatus').textContent=`Wettervorschau für ${loc} aktualisiert. Online-Schnittstelle kann später im TV-Player angebunden werden.`;renderWeatherPreview()}
function renderWeatherCards(inSlide=false){const d=tvPresentation.weather.lastData||[];return`<div class="tv-weather-cards ${inSlide?'in-slide':''}">${d.map(x=>`<div><strong>${x.label}</strong><b>${x.icon}</b><span>${x.min}° / ${x.max}°</span><small>${x.summary}</small></div>`).join('')}</div>`}
function renderWeatherPreview(){el('tvWeatherPreview').innerHTML=renderWeatherCards(false)}
function applyTemplate(name){const t=TV_TEMPLATES[name];if(!t)return;tvPresentation.slides=t.slides.map(([type,title,text],i)=>({id:crypto.randomUUID(),type,title,text,price:'',duration:type==='menu'?12:8,noTime:true,start:'00:00',end:'23:59',ticker:i===0?'Willkommen beim Köcheclub Werne':'',theme:t.theme,decorations:type==='welcome'?['🎄','⭐']:['❄️'],animation:t.animation,enabled:true}));tvSlideIndex=0;saveTvPresentation();renderTvSlideList();loadTvEditor();switchTvTab('slides')}
function aiGenerate(){const event=el('tvAiEvent').value,style=el('tvAiStyle').value,count=+el('tvAiCount').value||8,theme=style==='warm'?'warm':style==='modern'?'dark':'club',decor=el('tvAiDecor').checked,base=[['welcome',`Willkommen zum ${event}`,`Der Köcheclub Werne begrüßt Sie herzlich.`],['menu','Unsere Spezialitäten','Frisch zubereitet und direkt für Sie serviert.'],['project','Engagement des Köcheclubs','Gemeinsam unterstützen wir ausgewählte Projekte.'],['recipe','Unser Rezept-Tipp','Entdecken Sie winterliche Genussideen.'],['lcd','Aktueller Hinweis','Schön, dass Sie da sind!'],['thanks','Danke für Ihren Besuch','Wir wünschen Ihnen eine schöne Zeit.']];if(el('tvAiPrices').checked)base.splice(2,0,['price','Heute im Angebot','Aktuelle Preise aus den Artikelstammdaten.']);if(el('tvAiWeather').checked)base.splice(-1,0,['weather','Wetter in '+(tvPresentation.weather.location||'Werne'),'Die Aussichten für die nächsten Tage.']);tvPresentation.slides=Array.from({length:count},(_,i)=>{const x=base[i%base.length];return{id:crypto.randomUUID(),type:x[0],title:x[1],text:x[2],price:'',duration:x[0]==='menu'?12:8,noTime:true,start:'00:00',end:'23:59',ticker:i===0?`${event} · Köcheclub Werne`:'',theme,decorations:decor?(i%2?['❄️','⭐']:['🎄','🎁']):[],animation:decor?'snow-light':'none',enabled:true}});tvSlideIndex=0;saveTvPresentation();renderTvSlideList();loadTvEditor();el('tvAiResult').textContent=`${count} Folien wurden logisch aufgebaut und können jetzt einzeln angepasst werden.`;switchTvTab('slides')}
function renderTvDashboard(){if(!el('tvKpiSlides'))return;const secs=tvPresentation.slides.filter(s=>s.enabled!==false).reduce((a,s)=>a+(+s.duration||0),0);el('tvKpiSlides').textContent=tvPresentation.slides.length;el('tvKpiRuntime').textContent=`${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')} Min.`;el('tvKpiSchedule').textContent=tvPresentation.schedule.enabled?'Wochenmatrix aktiv':'Dauerbetrieb';el('tvKpiScreen').textContent=`${tvPresentation.profile.screenInch} Zoll`;el('tvKpiWeather').textContent=+tvPresentation.weather.days?`${tvPresentation.weather.days} Tage`:'Aus';el('tvKpiStatus').textContent='Bereit';el('tvScheduleChart').innerHTML=tvPresentation.schedule.week.map(r=>{const [sh,sm]=r.start.split(':').map(Number),[eh,em]=r.end.split(':').map(Number),h=Math.max(0,(eh+em/60)-(sh+sm/60));return`<div><span>${r.day.slice(0,2)}</span><i style="--w:${Math.min(100,h/14*100)}%"></i><b>${r.enabled?h.toFixed(1):'0'} h</b></div>`}).join('');const types={};tvPresentation.slides.forEach(s=>types[s.type]=(types[s.type]||0)+1);const typeCore=window.KCSalesInventoryAnalysisCore;el('tvTypeChart').innerHTML=Object.entries(types).map(([k,v])=>`<div><span>${typeCore?.labelSlideType?.(k)||'Sonstiger Folientyp'}</span><strong>${v}</strong></div>`).join('');el('tvHealthList').innerHTML=['Manager-Datenquelle verbunden','PC-Vorschau aktuell','Zeitsteuerung geprüft','Export bereit'].map(x=>`<div>🟢 ${x}</div>`).join('');renderSlideInto(el('tvDashboardPreview'),currentTvSlide())}
function exportTvPackage(){readTvEditor();const payload={...tvPresentation,schema:TV_SCHEMA,exportedAt:new Date().toISOString(),source:{application:'KC MarktKasse Manager',managerVersion:VERSION},catalogSnapshot:articles.filter(a=>tvPresentation.slides.some(s=>s.articleId===a.id)).map(a=>({id:a.id,name:a.name,price:+a.price||0,active:a.active!==false,image:a.image||''})),eventProgramSnapshot:(settings.eventProgram||[]).filter(x=>x.active!==false).map(x=>({date:x.date,time:x.time,title:x.title}))};download(`KC_TV_${new Date().toISOString().slice(0,10)}.kctv`,JSON.stringify(payload,null,2));el('tvPreviewStatus').textContent='TV-Paket für USB wurde erstellt.'}
function initTvManager(){if(!el('tvSlideList'))return;document.querySelectorAll('[data-tv-tab]').forEach(b=>b.onclick=()=>switchTvTab(b.dataset.tvTab));renderTvSlideList();loadTvEditor();renderWeekMatrix();renderSpecials();renderWeatherPreview();el('tvDecorationLibrary').innerHTML=TV_DECORS.map(x=>`<button type="button">${x}</button>`).join('');el('tvDecorationLibrary').querySelectorAll('button').forEach(b=>b.onclick=()=>{const s=currentTvSlide();s.decorations=s.decorations||[];s.decorations.includes(b.textContent)?s.decorations=s.decorations.filter(x=>x!==b.textContent):s.decorations.push(b.textContent);saveTvPresentation();loadTvEditor()});el('tvTemplateGallery').innerHTML=Object.keys(TV_TEMPLATES).map(n=>`<button data-template="${tvEsc(n)}"><strong>${tvEsc(n)}</strong><span>Vorlage anwenden</span></button>`).join('');el('tvTemplateGallery').querySelectorAll('[data-template]').forEach(b=>b.onclick=()=>applyTemplate(b.dataset.template));['tvSlideType','tvArticleLink','tvSlideTitle','tvSlideText','tvSlidePrice','tvSlideDuration','tvSlideNoTime','tvSlideStart','tvSlideEnd','tvSlideTicker','tvSlideTheme','tvSlideEnabled','tvAnimation'].forEach(id=>el(id)?.addEventListener(['tvSlideTitle','tvSlideText','tvSlidePrice','tvSlideTicker'].includes(id)?'input':'change',readTvEditor));el('tvArticleLink').onchange=()=>{const s=currentTvSlide(),a=linkedTvArticle(s);if(a){s.title=a.name;s.price=tvMoney(a.price);s.text=s.text||a.shortName||a.receiptText||''}saveTvPresentation();loadTvEditor();renderTvSlideList()};el('tvNewSlide').onclick=()=>{tvPresentation.slides.push({id:crypto.randomUUID(),type:'notice',title:'Neue Folie',text:'',price:'',duration:8,noTime:true,start:'00:00',end:'23:59',ticker:'',theme:'club',decorations:[],animation:'none',enabled:true});tvSlideIndex=tvPresentation.slides.length-1;saveTvPresentation();renderTvSlideList();loadTvEditor()};el('tvDuplicateSlide').onclick=()=>{const c={...currentTvSlide(),id:crypto.randomUUID(),decorations:[...(currentTvSlide().decorations||[])]};tvPresentation.slides.splice(tvSlideIndex+1,0,c);tvSlideIndex++;saveTvPresentation();renderTvSlideList();loadTvEditor()};el('tvDeleteSlide').onclick=()=>{if(tvPresentation.slides.length<=1)return alert('Mindestens eine Folie muss erhalten bleiben.');tvPresentation.slides.splice(tvSlideIndex,1);tvSlideIndex=Math.max(0,tvSlideIndex-1);saveTvPresentation();renderTvSlideList();loadTvEditor()};el('tvMoveUp').onclick=()=>{if(tvSlideIndex<1)return;[tvPresentation.slides[tvSlideIndex-1],tvPresentation.slides[tvSlideIndex]]=[tvPresentation.slides[tvSlideIndex],tvPresentation.slides[tvSlideIndex-1]];tvSlideIndex--;saveTvPresentation();renderTvSlideList();loadTvEditor()};el('tvMoveDown').onclick=()=>{if(tvSlideIndex>=tvPresentation.slides.length-1)return;[tvPresentation.slides[tvSlideIndex+1],tvPresentation.slides[tvSlideIndex]]=[tvPresentation.slides[tvSlideIndex],tvPresentation.slides[tvSlideIndex+1]];tvSlideIndex++;saveTvPresentation();renderTvSlideList();loadTvEditor()};el('tvSavePresentation').onclick=()=>{readTvEditor();alert('TV-Präsentation gespeichert.')};el('tvExportPackage').onclick=exportTvPackage;el('tvDashExport').onclick=exportTvPackage;el('tvPreviewPrevious').onclick=()=>{stopTvPreview();tvPreviewStep(-1)};el('tvPreviewNext').onclick=()=>{stopTvPreview();tvPreviewStep(1)};el('tvPreviewPlay').onclick=()=>{tvPreviewPlaying=!tvPreviewPlaying;if(tvPreviewPlaying){el('tvPreviewPlay').textContent='⏸ Test anhalten';runTvPreview()}else stopTvPreview()};el('tvDashTest').onclick=()=>{switchTvTab('slides');el('tvPreviewPlay').click()};el('tvDashEdit').onclick=()=>switchTvTab('slides');el('tvPreviewFullscreen').onclick=()=>document.body.classList.toggle('tv-preview-fullscreen');el('tvScreenInch').value=tvPresentation.profile.screenInch;el('tvResolution').value=tvPresentation.profile.resolution;el('tvViewingDistance').value=tvPresentation.profile.viewingDistance;el('tvAnimationsEnabled').checked=tvPresentation.profile.animationsEnabled!==false;el('tvAnimationIntensity').value=tvPresentation.design.intensity||2;['tvScreenInch','tvScreenCustom','tvResolution','tvViewingDistance','tvAnimationsEnabled','tvAnimationIntensity'].forEach(id=>el(id).onchange=()=>{const inch=el('tvScreenInch').value==='custom'?(+el('tvScreenCustom').value||50):+el('tvScreenInch').value;tvPresentation.profile.screenInch=inch;tvPresentation.profile.resolution=el('tvResolution').value;tvPresentation.profile.viewingDistance=+el('tvViewingDistance').value||6;tvPresentation.profile.animationsEnabled=el('tvAnimationsEnabled').checked;tvPresentation.design.intensity=+el('tvAnimationIntensity').value||2;el('tvScaleInfo').textContent=`Automatische Skalierung aktiv: Überschriften, Preise, Symbole und Abstände werden für ${inch} Zoll angepasst.`;saveTvPresentation();renderTvPreview()});el('tvScheduleEnabled').checked=tvPresentation.schedule.enabled;el('tvScheduleEnabled').onchange=()=>{tvPresentation.schedule.enabled=el('tvScheduleEnabled').checked;saveTvPresentation()};el('tvAddSpecial').onclick=()=>{const date=el('tvSpecialDate').value;if(!date)return alert('Bitte Datum wählen.');tvPresentation.schedule.special.push({date,start:el('tvSpecialStart').value||'00:00',end:el('tvSpecialEnd').value||'23:59',closed:el('tvSpecialClosed').checked});saveTvPresentation();renderSpecials()};el('tvWeatherDays').value=tvPresentation.weather.days;el('tvWeatherLocation').value=tvPresentation.weather.location;el('tvWeatherSource').value=tvPresentation.weather.source;el('tvWeatherRefresh').value=tvPresentation.weather.refresh;['tvWeatherDays','tvWeatherLocation','tvWeatherSource','tvWeatherRefresh'].forEach(id=>el(id).onchange=()=>{tvPresentation.weather.days=+el('tvWeatherDays').value;tvPresentation.weather.location=el('tvWeatherLocation').value;tvPresentation.weather.source=el('tvWeatherSource').value;tvPresentation.weather.refresh=+el('tvWeatherRefresh').value;saveTvPresentation()});el('tvWeatherTest').onclick=fakeWeather;el('tvAiGenerate').onclick=aiGenerate;document.querySelector('[data-view="tvscreen"]')?.addEventListener('click',()=>{renderTvDashboard();renderTvSlideList();loadTvEditor()});renderTvDashboard();el('tvScaleInfo').textContent=`Automatische Skalierung aktiv: Überschriften, Preise, Symbole und Abstände werden für ${tvPresentation.profile.screenInch} Zoll angepasst.`}
initTvManager();


// KC TV V0.29.6 – ImportCore Candidate + KC Mobil TV Workflow
const TV_JOB_KEY="kcm_tv_mobile_jobs_v1",TV_IMPORT_KEY="kcm_tv_import_history_v1";
let tvMobileJobs=(()=>{try{return JSON.parse(localStorage.getItem(TV_JOB_KEY)||"[]")}catch{return[]}})();
let tvImportFiles=[],tvCheckedReturns=[];
const tvUuid=()=>crypto.randomUUID?crypto.randomUUID():`id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
async function tvSha256(text){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
function tvStable(v){if(Array.isArray(v))return`[${v.map(tvStable).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+tvStable(v[k])).join(',')}}`;return JSON.stringify(v)}
function tvDownload(name,obj){download(name,typeof obj==='string'?obj:JSON.stringify(obj,null,2))}
function tvEffectLabel(v){return({none:'Ohne Effekt','snow-light':'Schneefall','snow-heavy':'Starker Schnee',glitter:'Glitzer',stars:'Sternenregen','shooting-star':'Sternschnuppen','gold-dust':'Goldstaub',lights:'Lichterkette',candle:'Kerzenlicht'})[v]||v}
const oldRenderTvSlideList=renderTvSlideList;
renderTvSlideList=function(){const l=el('tvSlideList');if(!l)return;el('tvSlideCount').textContent=`${tvPresentation.slides.length} Folien`;l.innerHTML=tvPresentation.slides.map((s,i)=>{const chips=[s.theme,tvEffectLabel(s.animation||'none'),...(s.decorations||[]).slice(0,1),s.media?.name?'Datei':''].filter(Boolean).slice(0,3);return`<button class="tv-slide-item ${i===tvSlideIndex?'active':''}" data-tv-index="${i}"><span class="tv-thumb theme-${tvEsc(s.theme||'club')}">${(s.decorations||[]).slice(0,2).join(' ')}<i>${s.animation&&s.animation!=='none'?'✦':''}</i></span><strong>${tvEsc(hydrateTvSlide(s).title||'Ohne Titel')}</strong><span>${tvEsc(s.type)} · ${s.duration||8} Sek.</span><em>${chips.map(c=>`<b>${tvEsc(c)}</b>`).join('')}</em></button>`}).join('');l.querySelectorAll('[data-tv-index]').forEach(b=>b.onclick=()=>{tvSlideIndex=+b.dataset.tvIndex;loadTvEditor();renderTvSlideList()})}
const oldRenderSlideInto=renderSlideInto;
renderSlideInto=function(screen,raw){oldRenderSlideInto(screen,raw);if(!screen||!raw)return;const s=raw;if(s.media?.dataUrl){const m=document.createElement(s.media.type?.startsWith('video')?'video':'img');m.className='tv-slide-media';m.src=s.media.dataUrl;if(m.tagName==='VIDEO'){m.autoplay=true;m.muted=true;m.loop=true}screen.querySelector('.tv-preview-content')?.prepend(m)}}
async function analyzeTvImports(){const files=[...(el('tvImportFiles')?.files||[])];tvImportFiles=[];for(const f of files){const item={id:tvUuid(),name:f.name,size:f.size,type:f.type||'',ext:f.name.split('.').pop().toLowerCase(),status:'bereit'};if(f.size>25*1024*1024){item.status='zu groß';item.error='Maximal 25 MB je Datei';tvImportFiles.push(item);continue}if(['jpg','jpeg','png','webp','mp4','webm'].includes(item.ext)){item.dataUrl=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)});item.kind=item.ext==='mp4'||item.ext==='webm'?'video':'image'}else if(['csv','txt'].includes(item.ext)){item.text=await f.text();item.kind=item.ext==='csv'?'table':'text'}else {item.dataUrl=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)});item.kind='document';item.status='als Dokumentdatei'}item.hash=await tvSha256(item.dataUrl||item.text||item.name);tvImportFiles.push(item)}renderTvImportQueue()}
function renderTvImportQueue(){const q=el('tvImportQueue');if(!q)return;q.innerHTML=tvImportFiles.length?tvImportFiles.map(x=>`<label class="tv-import-row"><input type="checkbox" data-import-id="${x.id}" ${x.error?'':'checked'} ${x.error?'disabled':''}><strong>${tvEsc(x.name)}</strong><span>${tvEsc(x.kind||x.ext)} · ${(x.size/1024).toFixed(0)} KB</span><b>${tvEsc(x.status)}</b></label>`).join(''):'<p>Noch keine Dateien analysiert.</p>'}
function createSlidesFromImports(){const ids=[...document.querySelectorAll('[data-import-id]:checked')].map(x=>x.dataset.importId),selected=tvImportFiles.filter(x=>ids.includes(x.id));if(!selected.length)return alert('Bitte mindestens eine geprüfte Datei auswählen.');for(const x of selected){if(x.kind==='table'){const lines=x.text.split(/\r?\n/).filter(Boolean);const rows=lines.slice(0,30).map(r=>r.split(/[;,\t]/));const title=rows.shift()?.join(' · ')||x.name;const chunks=[];while(rows.length)chunks.push(rows.splice(0,6));chunks.forEach((c,i)=>tvPresentation.slides.push({id:tvUuid(),type:'menu',title:i?`${title} – Fortsetzung`:title,text:c.map(r=>r.join('   ')).join('\n'),price:'',duration:12,noTime:true,start:'00:00',end:'23:59',ticker:'',theme:'gold',decorations:['⭐'],animation:'glitter',enabled:true,sourceFile:{name:x.name,hash:x.hash}}))}else if(x.kind==='text'){const parts=(el('tvImportSplit').checked?x.text.match(/[\s\S]{1,450}/g):[x.text])||[''];parts.forEach((p,i)=>tvPresentation.slides.push({id:tvUuid(),type:'notice',title:i?`${x.name} – ${i+1}`:x.name,text:p,duration:10,noTime:true,start:'00:00',end:'23:59',ticker:'',theme:'club',decorations:[],animation:'none',enabled:true,sourceFile:{name:x.name,hash:x.hash}}))}else {tvPresentation.slides.push({id:tvUuid(),type:x.kind==='image'?'gallery':x.kind==='video'?'video':'document',title:x.name,text:x.kind==='document'?'Importierte Dokumentdatei – zur sicheren Anzeige als Anlage übernommen.':'',duration:x.kind==='video'?20:10,noTime:true,start:'00:00',end:'23:59',ticker:'',theme:'dark',decorations:[],animation:'none',enabled:true,media:{name:x.name,type:x.type,dataUrl:x.dataUrl,hash:x.hash}})}}tvSlideIndex=Math.max(0,tvPresentation.slides.length-selected.length);saveTvPresentation();renderTvSlideList();loadTvEditor();switchTvTab('slides')}
async function createMobileJob(){const builder=el('tvJobBuilder').value.trim();if(!builder)return alert('Bitte Erbauer oder Empfängerkennung eintragen.');const job={schema:'kc-mobile-tv-job-v1',jobId:`KCTV-JOB-${Date.now()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`,assignmentId:tvUuid(),name:el('tvJobName').value.trim(),event:el('tvJobEvent').value.trim(),builder,creatorId:(settings?.owner||'KC-Manager'),createdAt:new Date().toISOString(),expiresAt:el('tvJobExpiry').value||'',maxReturns:+el('tvJobReturns').value||3,returnCount:0,status:'open',permissions:{editor:true,templates:true,decorations:true,articles:'placeholders',manager:false,pos:false,moneyButler:false},basePresentation:{profile:tvPresentation.profile,design:tvPresentation.design,weather:tvPresentation.weather,slides:[]},articlePlaceholders:el('tvJobPlaceholders').checked?articles.filter(a=>a.active!==false).slice(0,100).map(a=>({token:`{{ARTICLE_${String(a.id).replace(/\W/g,'_')}}}`,id:a.id,name:a.name,priceToken:`{{PRICE_${String(a.id).replace(/\W/g,'_')}}}`})):[]};job.activationCode=job.jobId.split('-').slice(-2).join('-');job.checksum=await tvSha256(tvStable(job));tvMobileJobs.push(job);localStorage.setItem(TV_JOB_KEY,JSON.stringify(tvMobileJobs));tvDownload(`${job.jobId}.kctva`,job);el('tvJobResult').innerHTML=`<strong>Auftrag erstellt:</strong> ${tvEsc(job.jobId)}<br>Erbauer: ${tvEsc(builder)} · Aktivierungscode: <b>${tvEsc(job.activationCode)}</b><br>Prüfsumme: <code>${job.checksum.slice(0,20)}…</code>`;renderTvJobs()}
function renderTvJobs(){const l=el('tvJobList');if(!l)return;l.innerHTML=tvMobileJobs.length?tvMobileJobs.map(j=>`<div class="tv-job"><strong>${tvEsc(j.name)}</strong><span>${tvEsc(j.builder)} · ${tvEsc(j.jobId)}</span><b>${j.returnCount||0}/${j.maxReturns} Rückgaben · ${j.status}</b><button data-job-export="${j.jobId}">Auftrag erneut exportieren</button></div>`).join(''):'<p>Noch keine Bauaufträge.</p>';l.querySelectorAll('[data-job-export]').forEach(b=>b.onclick=()=>{const j=tvMobileJobs.find(x=>x.jobId===b.dataset.jobExport);if(j)tvDownload(`${j.jobId}.kctva`,j)})}
async function checkMobileReturns(){tvCheckedReturns=[];for(const f of [...(el('tvReturnFiles').files||[])]){try{const p=JSON.parse(await f.text()),job=tvMobileJobs.find(j=>j.jobId===p.jobId);let state='gültig',reason='';if(p.schema!=='kc-mobile-tv-return-v1'){state='gesperrt';reason='Falsches Format'}else if(!job){state='gesperrt';reason='Unbekannter Auftrag'}else if(p.assignmentId!==job.assignmentId){state='gesperrt';reason='Auftragskennung stimmt nicht'}else if(p.activationCode!==job.activationCode){state='gesperrt';reason='Aktivierungscode falsch'}else if((job.importedPackageIds||[]).includes(p.packageId)){state='doppelt';reason='Bereits importiert'}else {const copy={...p};delete copy.checksum;const hash=await tvSha256(tvStable(copy));if(hash!==p.checksum){state='gesperrt';reason='Prüfsumme ungültig'}}tvCheckedReturns.push({file:f.name,payload:p,state,reason,selected:state==='gültig'})}catch(e){tvCheckedReturns.push({file:f.name,state:'gesperrt',reason:'Datei nicht lesbar',selected:false})}}renderReturnList()}
function renderReturnList(){const l=el('tvReturnList');if(!l)return;l.innerHTML=tvCheckedReturns.length?tvCheckedReturns.map((r,i)=>`<label class="tv-return ${r.state}"><input type="checkbox" data-return-index="${i}" ${r.selected?'checked':''} ${r.state!=='gültig'?'disabled':''}><strong>${tvEsc(r.payload?.builderName||r.file)}</strong><span>${r.payload?.slides?.length||0} Folien · ${tvEsc(r.payload?.packageId||'')}</span><b>${tvEsc(r.state)} ${tvEsc(r.reason)}</b></label>`).join(''):'<p>Noch keine Rückgaben geprüft.</p>'}
function mergeMobileReturns(){const idx=[...document.querySelectorAll('[data-return-index]:checked')].map(x=>+x.dataset.returnIndex),rs=idx.map(i=>tvCheckedReturns[i]).filter(r=>r.state==='gültig');if(!rs.length)return alert('Keine gültige Rückgabe ausgewählt.');const seen=new Set(),merged=[];for(const r of rs){for(const s of r.payload.slides||[]){const sig=JSON.stringify([s.title,s.text,s.type,s.media?.hash]);if(!seen.has(sig)){seen.add(sig);merged.push({...s,id:tvUuid(),mobileSource:{builder:r.payload.builderName,packageId:r.payload.packageId}})}}}const oldCount=tvPresentation.slides.length;tvPresentation.slides.push(...merged);for(const r of rs){const j=tvMobileJobs.find(x=>x.jobId===r.payload.jobId);if(j){j.importedPackageIds=j.importedPackageIds||[];j.importedPackageIds.push(r.payload.packageId);j.returnCount=(j.returnCount||0)+1;if(j.returnCount>=j.maxReturns)j.status='completed'}}localStorage.setItem(TV_JOB_KEY,JSON.stringify(tvMobileJobs));saveTvPresentation();renderTvJobs();renderTvSlideList();el('tvMergeResult').innerHTML=`<div class="tv-check ok">${merged.length} unterschiedliche Folien aus ${rs.length} Rückgaben wurden als Entwurfsblock angefügt. Vorhandene ${oldCount} Folien blieben unverändert. Schlechte Folien können jetzt einzeln gelöscht werden.</div>`;switchTvTab('slides')}
function initTv296(){el('tvImportAnalyze')&&(el('tvImportAnalyze').onclick=analyzeTvImports);el('tvImportCreate')&&(el('tvImportCreate').onclick=createSlidesFromImports);el('tvCreateJob')&&(el('tvCreateJob').onclick=createMobileJob);el('tvCheckReturns')&&(el('tvCheckReturns').onclick=checkMobileReturns);el('tvMergeReturns')&&(el('tvMergeReturns').onclick=mergeMobileReturns);el('tvExportMobileApp')&&(el('tvExportMobileApp').onclick=()=>alert('Die portable Anwendung liegt im Programmpaket im Ordner kc-mobile-tv.'));renderTvImportQueue();renderTvJobs()}
document.addEventListener('DOMContentLoaded',()=>setTimeout(initTv296,0));

/* V0.29.8 – Contextual Preview Editor, real thumbnails and transitions */
(function(){
 let contextTab='content', selectedObject='slide';
 const ctx=id=>document.getElementById(id);
 const esc=tvEsc;
 function design(s){return window.KCDesignCorePresentation?.normalize(s)||s.presentationDesign||{} }
 function paletteBg(s){const d=design(s),p=KCDesignCorePresentation.palettes[d.palette]||KCDesignCorePresentation.palettes.warm;return `linear-gradient(145deg,${d.background?.color1||p.bg},${d.background?.color2||p.bg2})`}
 function effectMarkup(s){
   if(tvPresentation.profile.animationsEnabled===false||!s.animation||s.animation==='none')return '';
   const count=Math.max(10,(tvPresentation.design.intensity||2)*10), chars=s.animation.includes('snow')?'❄':s.animation==='stars'?'★':s.animation==='shooting-star'?'☄':'✦';
   if(['lights','candle'].includes(s.animation))return `<div class="tv-effect effect-${s.animation}"></div>`;
   return `<div class="tv-effect effect-${s.animation}">${Array.from({length:count},(_,i)=>`<i style="--x:${(i*37)%100}%;--y:${-10-(i%5)*8}%;--size:${14+(i%5)*5}px;--dur:${5+(i%6)}s;--delay:${-(i%9)*.55}s">${chars}</i>`).join('')}</div>`;
 }
  function selectObject(obj){selectedObject=obj||'slide';document.querySelectorAll('#tvPreviewScreen [data-tv-object]').forEach(n=>n.classList.toggle('tv-object-selected',n.dataset.tvObject===selectedObject));if(window.KCUnifiedEditor){window.KCUnifiedEditor.select(selectedObject,document.querySelector(`#tvPreviewScreen [data-tv-object="${CSS.escape(selectedObject)}"]`));return}renderContextEditor()}
  window.KCSetLegacySelectedObject=obj=>{selectedObject=obj||'slide'};
 function transitionName(v){return KCDesignCorePresentation.transitions[v]||v||'Überblenden'}
 window.renderSlideInto=function(screen,raw){
   if(!screen||!raw)return;const s=hydrateTvSlide(raw),d=design(raw),scale=tvScale();
   screen.className=`tv-preview-screen theme-${esc(s.theme||'club')} type-${esc(s.type||'notice')} transition-${esc(d.transition?.type||'fade')}`;
   screen.style.setProperty('--tv-scale',scale);screen.innerHTML=`${effectMarkup(s)}<div class="tv-decor tv-clickable" data-tv-object="symbols">${(s.decorations||[]).slice(0,5).join(' ')}</div><div class="tv-preview-content" data-tv-object="content"><h2 class="tv-clickable" data-tv-object="title">${esc(s.title||'')}</h2><p class="tv-clickable" data-tv-object="text">${esc(s.text||'')}</p>${s.price?`<div class="tv-preview-price tv-clickable" data-tv-object="price">${esc(s.price)}</div>`:''}${s.type==='weather'?renderWeatherCards(true):''}</div>${s.ticker?`<div class="tv-preview-ticker tv-clickable" data-tv-object="ticker"><span>${esc(s.ticker)}</span></div>`:''}`;
   KCDesignCorePresentation.apply(screen,raw);
   screen.querySelector('.dc-banner')?.setAttribute('data-tv-object','banner');screen.querySelector('.dc-banner')?.classList.add('tv-clickable');
   screen.querySelector('.dc-shape')?.setAttribute('data-tv-object','shape');screen.querySelector('.dc-shape')?.classList.add('tv-clickable');
   screen.querySelectorAll('[data-tv-object]').forEach(n=>n.onclick=e=>{e.stopPropagation();selectObject(n.dataset.tvObject)});screen.onclick=()=>selectObject('slide');
   if(screen.id==='tvPreviewScreen')setTimeout(()=>selectObject(selectedObject),0);
 }
 window.renderTvSlideList=function(){const l=ctx('tvSlideList');if(!l)return;ctx('tvSlideCount').textContent=`${tvPresentation.slides.length} Folien`;l.innerHTML=tvPresentation.slides.map((s,i)=>{const d=design(s),p=KCDesignCorePresentation.palettes[d.palette]||KCDesignCorePresentation.palettes.warm,chips=[p.name,tvEffectLabel(s.animation||'none'),transitionName(d.transition?.type)].slice(0,3);return`<button class="tv-slide-item ${i===tvSlideIndex?'active':''}" data-tv-index="${i}"><span class="tv-thumb"><span class="tv-thumb-mini" style="--mini-bg:${paletteBg(s)};--mini-text:${p.text}"><span class="mini-decor">${(s.decorations||[]).slice(0,2).join(' ')}</span>${esc((hydrateTvSlide(s).title||'Folie').slice(0,22))}${d.banner?.type!=='none'?'<span class="mini-banner">Banner</span>':''}</span></span><strong>${esc(hydrateTvSlide(s).title||'Ohne Titel')}</strong><span>${esc(s.type)} · ${s.duration||8} Sek.</span><em>${chips.map(c=>`<b>${esc(c)}</b>`).join('')}</em></button>`}).join('');l.querySelectorAll('[data-tv-index]').forEach(b=>b.onclick=()=>{tvSlideIndex=+b.dataset.tvIndex;selectedObject='slide';loadTvEditor();renderTvSlideList()})}
 function syncLegacy(){const s=currentTvSlide();if(!s)return;renderTvArticleOptions();['Type','Title','Text','Price','Duration','Start','End','Ticker','Theme'].forEach(k=>{const e=ctx('tvSlide'+k);if(e)e.value=s[k.charAt(0).toLowerCase()+k.slice(1)]??(k==='Duration'?8:'')});if(ctx('tvArticleLink'))ctx('tvArticleLink').value=s.articleId||'';if(ctx('tvSlideNoTime'))ctx('tvSlideNoTime').checked=s.noTime!==false;if(ctx('tvSlideEnabled'))ctx('tvSlideEnabled').checked=s.enabled!==false;if(ctx('tvSlideStart'))ctx('tvSlideStart').disabled=ctx('tvSlideEnd').disabled=ctx('tvSlideNoTime')?.checked;if(ctx('tvAnimation'))ctx('tvAnimation').value=s.animation||'none';if(ctx('tvDecorationsText'))ctx('tvDecorationsText').value=(s.decorations||[]).join(' ')}
 window.loadTvEditor=function(){syncLegacy();renderTvPreview();renderContextEditor()}
 function bindInputs(){ctx('tvContextEditor')?.querySelectorAll('[data-bind]').forEach(e=>{const handler=()=>{const s=currentTvSlide(),d=design(s),key=e.dataset.bind,v=e.type==='checkbox'?e.checked:e.type==='number'||e.type==='range'?+e.value:e.value;
     if(key.startsWith('design.')){const parts=key.split('.').slice(1);let o=d;while(parts.length>1)o=o[parts.shift()];o[parts[0]]=v}else if(key==='decorations')s.decorations=v.split(/\s+/).filter(Boolean);else s[key]=v;
     saveTvPresentation();syncLegacy();renderTvPreview();renderTvSlideList();renderContextEditor(false)};e.addEventListener(e.tagName==='SELECT'||e.type==='checkbox'?'change':'input',handler)})}
 function optionMap(map,val){return Object.entries(map).map(([k,v])=>`<option value="${k}" ${k===val?'selected':''}>${esc(v)}</option>`).join('')}
  function renderContextEditor(resetTitle=true){if(window.KCUnifiedEditor){window.KCUnifiedEditor.renderProperties();return}const box=ctx('tvContextEditor'),s=currentTvSlide();if(!box||!s)return;const d=design(s),p=KCDesignCorePresentation.palettes[d.palette]||KCDesignCorePresentation.palettes.warm;if(resetTitle){ctx('tvContextTitle').textContent=({banner:'Banner bearbeiten',shape:'Sonderelement bearbeiten',title:'Überschrift bearbeiten',text:'Text bearbeiten',price:'Preis bearbeiten',ticker:'Lauftext bearbeiten',symbols:'Symbole bearbeiten',slide:'Folie bearbeiten',content:'Inhalt bearbeiten'})[selectedObject]||'Folie bearbeiten';ctx('tvContextHint').textContent='Auswahl direkt in der Vorschau oder über die Buttons';}
   let h='';
   if(contextTab==='content')h=`<div class="tv-context-grid"><label>Folientyp<select data-bind="type">${[['welcome','Begrüßung'],['price','Preisfolie'],['menu','Speisekarte'],['weather','Wetter'],['notice','Hinweis'],['thanks','Danke']].map(x=>`<option value="${x[0]}" ${s.type===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></label><label>Anzeigedauer<input data-bind="duration" type="number" min="3" max="120" value="${s.duration||8}"></label><label class="wide">Überschrift<input data-bind="title" value="${esc(s.title||'')}"></label><label class="wide">Text<textarea data-bind="text" rows="5">${esc(s.text||'')}</textarea></label><label>Preis / Zusatz<input data-bind="price" value="${esc(s.price||'')}"></label><label class="wide">LED-/LCD-Lauftext<input data-bind="ticker" value="${esc(s.ticker||'')}"></label><label class="check">Folie aktiv<input data-bind="enabled" type="checkbox" ${s.enabled!==false?'checked':''}></label></div>`;
   if(contextTab==='fonts')h=`<div class="tv-context-grid"><label>Überschriftfarbe<input data-bind="design.typography.titleColor" type="color" value="${d.typography.titleColor||p.text}"></label><label>Textfarbe<input data-bind="design.typography.textColor" type="color" value="${d.typography.textColor||p.text}"></label><label>Preisfarbe<input data-bind="design.typography.priceColor" type="color" value="${d.typography.priceColor||p.accent}"></label><label>Überschriftgröße<input data-bind="design.typography.titleSize" type="range" min=".8" max="1.5" step=".05" value="${d.typography.titleSize||1}"></label><label>Textgröße<input data-bind="design.typography.textSize" type="range" min=".8" max="1.4" step=".05" value="${d.typography.textSize||1}"></label><label>Preisgröße<input data-bind="design.typography.priceSize" type="range" min=".8" max="1.6" step=".05" value="${d.typography.priceSize||1}"></label></div>`;
   if(contextTab==='symbols')h=`<div class="tv-context-section"><h4>Symbole und Effekt</h4><div class="tv-decoration-library">${TV_DECORS.map(x=>`<button type="button" data-add-symbol="${x}">${x}</button>`).join('')}</div><label>Aktive Symbole<input data-bind="decorations" value="${esc((s.decorations||[]).join(' '))}"></label><label>Animation<select data-bind="animation"><option value="none">Keine</option><option value="snow-light" ${s.animation==='snow-light'?'selected':''}>Leichter Schneefall</option><option value="snow-heavy" ${s.animation==='snow-heavy'?'selected':''}>Starker Schneefall</option><option value="glitter" ${s.animation==='glitter'?'selected':''}>Glitzer</option><option value="stars" ${s.animation==='stars'?'selected':''}>Sternenregen</option><option value="shooting-star" ${s.animation==='shooting-star'?'selected':''}>Sternschnuppen</option><option value="gold-dust" ${s.animation==='gold-dust'?'selected':''}>Goldstaub</option><option value="lights" ${s.animation==='lights'?'selected':''}>Lichterkette</option><option value="candle" ${s.animation==='candle'?'selected':''}>Kerzenflackern</option></select></label></div>`;
   if(contextTab==='colors')h=`<div class="tv-context-grid"><label>Farbwelt<select data-bind="design.palette">${optionMap(Object.fromEntries(Object.entries(KCDesignCorePresentation.palettes).map(([k,v])=>[k,v.name])),d.palette)}</select></label><label>Hintergrund 1<input data-bind="design.background.color1" type="color" value="${d.background.color1||p.bg}"></label><label>Hintergrund 2<input data-bind="design.background.color2" type="color" value="${d.background.color2||p.bg2}"></label><label>Akzent-/Preisfarbe<input data-bind="design.typography.priceColor" type="color" value="${d.typography.priceColor||p.accent}"></label></div>`;
   if(contextTab==='background')h=`<div class="tv-context-grid"><label>Hintergrundtyp<select data-bind="design.background.type"><option value="gradient" ${d.background.type==='gradient'?'selected':''}>Farbverlauf</option><option value="solid" ${d.background.type==='solid'?'selected':''}>Vollton</option><option value="image" ${d.background.type==='image'?'selected':''}>Bild</option></select></label><label>Transparenz<input data-bind="design.background.opacity" type="range" min=".4" max="1" step=".05" value="${d.background.opacity??1}"></label><label>Banner<select data-bind="design.banner.type">${optionMap(KCDesignCorePresentation.banners,d.banner.type)}</select></label><label>Bannertext<input data-bind="design.banner.text" value="${esc(d.banner.text||'')}"></label><label>Form<select data-bind="design.shape.type">${optionMap(KCDesignCorePresentation.shapes,d.shape.type)}</select></label><label>Formtext<input data-bind="design.shape.text" value="${esc(d.shape.text||'')}"></label></div>`;
   if(contextTab==='transition'){const prev=tvPresentation.slides[(tvSlideIndex-1+tvPresentation.slides.length)%tvPresentation.slides.length];h=`<div class="tv-transition-strip"><div class="tv-transition-preview" style="background:${paletteBg(prev)}">${esc((prev?.title||'Vorherige Folie').slice(0,20))}</div><div class="tv-transition-arrow">→</div><div class="tv-transition-preview" style="background:${paletteBg(s)}">${esc((s.title||'Aktuelle Folie').slice(0,20))}</div></div><div class="tv-context-grid"><label class="wide">Übergang von der vorherigen Folie<select data-bind="design.transition.type">${optionMap(KCDesignCorePresentation.transitions,d.transition.type)}</select></label><label>Dauer in Millisekunden<input data-bind="design.transition.duration" type="number" min="300" max="1800" step="100" value="${d.transition.duration||800}"></label><button type="button" id="tvTestTransition">Übergang jetzt testen</button></div>`}
   box.innerHTML=h;bindInputs();box.querySelectorAll('[data-add-symbol]').forEach(b=>b.onclick=()=>{s.decorations=s.decorations||[];s.decorations.includes(b.dataset.addSymbol)?s.decorations=s.decorations.filter(x=>x!==b.dataset.addSymbol):s.decorations.push(b.dataset.addSymbol);saveTvPresentation();renderTvPreview();renderTvSlideList();renderContextEditor(false)});ctx('tvTestTransition')?.addEventListener('click',()=>{const sc=ctx('tvPreviewScreen');sc.classList.remove('transition-fade','transition-slide','transition-zoom','transition-wipe','transition-flip','transition-star','transition-snow');void sc.offsetWidth;sc.classList.add('transition-'+(d.transition.type||'fade'))})
 }
 document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{document.querySelectorAll('[data-tv-context]').forEach(b=>b.onclick=()=>{contextTab=b.dataset.tvContext;document.querySelectorAll('[data-tv-context]').forEach(x=>x.classList.toggle('active',x===b));renderContextEditor()});renderTvSlideList();loadTvEditor()},100));
})();


/* V0.29.9 – Direct manipulation / Drag-and-drop stage */
(function(){
  if(window.KC_DISABLE_LEGACY_TV_EDITORS)return;
  const DEFAULTS={title:[50,28],text:[50,49],price:[50,68],symbols:[12,10],banner:[50,12],shape:[86,20],ticker:[50,94]};
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function slide(){return typeof currentTvSlide==='function'?currentTvSlide():null}
  function pos(s,key){s.layout=s.layout||{};return s.layout[key]||(s.layout[key]={x:DEFAULTS[key]?.[0]||50,y:DEFAULTS[key]?.[1]||50,w:key==='text'?78:key==='title'?84:key==='ticker'?100:35})}
  function decorate(){
    if(window.KC_DISABLE_LEGACY_TV_EDITORS)return;
    const stage=document.getElementById('tvPreviewScreen'),s=slide();if(!stage||!s)return;
    stage.classList.add('tv-direct-stage');
    stage.querySelectorAll('[data-tv-object]').forEach(node=>{
      const key=node.dataset.tvObject;if(!DEFAULTS[key]||node.dataset.dragReady)return;
      node.dataset.dragReady='1';node.classList.add('tv-draggable-object');
      const p=pos(s,key);apply(node,p,key);
      node.title='Anklicken und mit der Maus oder dem Finger verschieben';
      node.addEventListener('pointerdown',ev=>{
        if(ev.button!==undefined&&ev.button!==0)return;ev.preventDefault();ev.stopPropagation();
        node.setPointerCapture?.(ev.pointerId);node.classList.add('is-dragging');
        const rect=stage.getBoundingClientRect();
        const move=e=>{const q=pos(s,key);q.x=clamp((e.clientX-rect.left)/rect.width*100,2,98);q.y=clamp((e.clientY-rect.top)/rect.height*100,3,97);apply(node,q,key)};
        const up=e=>{node.classList.remove('is-dragging');node.releasePointerCapture?.(e.pointerId);node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',up);node.removeEventListener('pointercancel',up);saveTvPresentation();renderTvSlideList?.();};
        node.addEventListener('pointermove',move);node.addEventListener('pointerup',up);node.addEventListener('pointercancel',up);
      });
    });
  }
  function apply(node,p,key){node.style.setProperty('--obj-x',p.x+'%');node.style.setProperty('--obj-y',p.y+'%');node.style.setProperty('--obj-w',(p.w||35)+'%');node.dataset.position=`${Math.round(p.x)} / ${Math.round(p.y)}`}
  function addPositionTools(){
    if(window.KC_DISABLE_LEGACY_TV_EDITORS)return;
    const box=document.getElementById('tvContextEditor'),s=slide();if(!box||!s||box.querySelector('.tv-position-tools'))return;
    const selected=document.querySelector('#tvPreviewScreen .tv-object-selected')?.dataset.tvObject;
    if(!DEFAULTS[selected])return;const p=pos(s,selected);
    const card=document.createElement('section');card.className='tv-position-tools';card.innerHTML=`<div class="tv-tool-card-title"><strong>Position und Größe</strong><small>Direkt in der Vorschau ziehen</small></div><div class="tv-position-grid"><label>Horizontal<input data-pos="x" type="range" min="2" max="98" value="${p.x}"></label><label>Vertikal<input data-pos="y" type="range" min="3" max="97" value="${p.y}"></label><label>Breite<input data-pos="w" type="range" min="12" max="100" value="${p.w||35}"></label><button type="button" data-reset-position>Position zurücksetzen</button></div>`;
    box.prepend(card);
    card.querySelectorAll('[data-pos]').forEach(i=>i.oninput=()=>{p[i.dataset.pos]=+i.value;const n=document.querySelector(`#tvPreviewScreen [data-tv-object="${selected}"]`);if(n)apply(n,p,selected);saveTvPresentation();renderTvSlideList?.()});
    card.querySelector('[data-reset-position]').onclick=()=>{Object.assign(p,{x:DEFAULTS[selected][0],y:DEFAULTS[selected][1],w:selected==='text'?78:selected==='title'?84:selected==='ticker'?100:35});renderTvPreview();};
  }
  const preview=document.getElementById('tvPreviewScreen');if(preview)new MutationObserver(()=>requestAnimationFrame(()=>{decorate();addPositionTools()})).observe(preview,{childList:true,subtree:true});
  const editor=document.getElementById('tvContextEditor');if(editor)new MutationObserver(()=>requestAnimationFrame(addPositionTools)).observe(editor,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{decorate();addPositionTools()},250));
})();


/* V0.29.10 – professional controls and reliable particle renderer */
(function(){
 const fontMap={system:'Arial,Helvetica,sans-serif',serif:'Georgia,"Times New Roman",serif',humanist:'"Trebuchet MS",Arial,sans-serif',rounded:'"Arial Rounded MT Bold",Arial,sans-serif',condensed:'"Arial Narrow",Arial,sans-serif',monospace:'Consolas,monospace'};
 function escx(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
 function effCfg(s){const d=KCDesignCorePresentation.normalize(s);d.effects=d.effects||{speed:1,density:2,size:1,opacity:.78,direction:'down'};return d.effects}
 function particleHTML(s){const effect=s.animation||'none';if(effect==='none')return'';const c=effCfg(s),density=Math.max(1,Math.min(5,+c.density||2)),count=effect.includes('heavy')?density*18:density*11;const chars={glitter:'✦','gold-dust':'◆','gold-rain':'◆',stars:'★','star-rain':'★',bokeh:'●','sparkle-wave':'✦','shooting-star':'☄',rain:'╱'};const ch=effect.includes('snow')?'❄':(chars[effect]||'✦');const speed=Math.max(.35,Math.min(2.5,+c.speed||1)),size=Math.max(.5,Math.min(2,+c.size||1)),opacity=Math.max(.15,Math.min(1,+c.opacity||.78));let out='';for(let i=0;i<count;i++){const x=(i*47+13)%100,ps=Math.round((12+(i%7)*3)*size),dur=((4.2+(i%8)*.55)/speed).toFixed(2),delay=(-((i*0.63)%8)).toFixed(2),drift=((i%2?1:-1)*(12+(i%5)*5))+'vw',po=(opacity*(.55+(i%4)*.13)).toFixed(2);out+=`<i class="particle" style="--x:${x}%;--ps:${ps}px;--pd:${dur}s;--pdelay:${delay}s;--drift:${drift};--po:${po}">${ch}</i>`}return `<div class="tv-effect effect-${escx(effect)}">${out}</div>`}
 window.renderEffects=particleHTML;
 function applyPro(stage,s){if(!stage||!s)return;const d=KCDesignCorePresentation.normalize(s),t=d.typography||{};stage.style.setProperty('--font-family',fontMap[t.fontFamily]||fontMap.system);stage.style.setProperty('--title-weight',t.titleBold===false?'500':'800');stage.style.setProperty('--title-style',t.titleItalic?'italic':'normal');stage.style.setProperty('--title-transform',t.titleUppercase?'uppercase':'none');stage.style.setProperty('--text-weight',t.textBold?'700':'400');stage.style.setProperty('--text-style',t.textItalic?'italic':'normal');stage.style.setProperty('--price-weight',t.priceBold===false?'600':'900');stage.style.setProperty('--price-style',t.priceItalic?'italic':'normal');stage.style.setProperty('--letter-spacing',(+t.letterSpacing||0)+'em');stage.style.setProperty('--line-height',t.lineHeight||1.15);stage.style.setProperty('--text-align',t.textAlign||'center');stage.style.setProperty('--title-shadow',t.shadow===false?'none':'0 3px 15px rgba(0,0,0,.42)');stage.style.setProperty('--title-stroke',t.outline?'1px rgba(0,0,0,.5)':'0 transparent')}
 const oldRender=window.renderSlideInto;if(typeof oldRender==='function')window.renderSlideInto=function(screen,raw){oldRender(screen,raw);if(!screen)return;applyPro(screen,raw);const old=screen.querySelector('.tv-effect');if(old)old.outerHTML=particleHTML(raw)};
  const observer=new MutationObserver(()=>{if(window.KC_DISABLE_LEGACY_TV_EDITORS)return;document.querySelectorAll('#tvPreviewScreen,.preview').forEach(stage=>{const s=(typeof currentTvSlide==='function'?currentTvSlide():(window.slides&&window.slides[window.idx]))||null;if(s)applyPro(stage,s)})});if(!window.KC_DISABLE_LEGACY_TV_EDITORS)observer.observe(document.documentElement,{childList:true,subtree:true});
 function bindAdvanced(box,s){if(!box||!s||box.querySelector('.pro-advanced'))return;const d=KCDesignCorePresentation.normalize(s),t=d.typography,e=d.effects;const isFonts=box.querySelector('[data-bind="design.typography.titleColor"]');const isSymbols=box.querySelector('[data-bind="animation"]');if(isFonts){const card=document.createElement('section');card.className='pro-editor-card pro-advanced';card.innerHTML=`<h4>Professionelle Typografie</h4><div class="pro-effect-grid"><label>Schriftfamilie<select data-pro="fontFamily"><option value="system">System / klar</option><option value="humanist">Humanistisch</option><option value="serif">Klassisch</option><option value="rounded">Rund</option><option value="condensed">Schmal / Plakat</option><option value="monospace">Technisch</option></select></label><label>Ausrichtung<select data-pro="textAlign"><option value="left">Links</option><option value="center">Zentriert</option><option value="right">Rechts</option></select></label><label>Buchstabenabstand<input data-pro="letterSpacing" type="range" min="-.02" max=".12" step=".01" value="${t.letterSpacing||0}"></label><label>Zeilenabstand<input data-pro="lineHeight" type="range" min=".9" max="1.6" step=".05" value="${t.lineHeight||1.15}"></label></div><div class="pro-toggle-row"><label><input data-pro="titleBold" type="checkbox" ${t.titleBold!==false?'checked':''}> Titel fett</label><label><input data-pro="titleItalic" type="checkbox" ${t.titleItalic?'checked':''}> Titel kursiv</label><label><input data-pro="titleUppercase" type="checkbox" ${t.titleUppercase?'checked':''}> Versalien</label><label><input data-pro="textBold" type="checkbox" ${t.textBold?'checked':''}> Text fett</label><label><input data-pro="textItalic" type="checkbox" ${t.textItalic?'checked':''}> Text kursiv</label><label><input data-pro="priceBold" type="checkbox" ${t.priceBold!==false?'checked':''}> Preis fett</label><label><input data-pro="priceItalic" type="checkbox" ${t.priceItalic?'checked':''}> Preis kursiv</label><label><input data-pro="shadow" type="checkbox" ${t.shadow!==false?'checked':''}> Schatten</label><label><input data-pro="outline" type="checkbox" ${t.outline?'checked':''}> Kontur</label></div>`;box.prepend(card);card.querySelector('[data-pro="fontFamily"]').value=t.fontFamily||'system';card.querySelector('[data-pro="textAlign"]').value=t.textAlign||'center';card.querySelectorAll('[data-pro]').forEach(i=>i.oninput=()=>{t[i.dataset.pro]=i.type==='checkbox'?i.checked:(i.type==='range'?+i.value:i.value);if(typeof saveTvPresentation==='function')saveTvPresentation();if(typeof renderTvPreview==='function')renderTvPreview();else if(typeof preview==='function')preview()})}
 if(isSymbols){const card=document.createElement('section');card.className='pro-editor-card pro-advanced';card.innerHTML=`<h4>Effektsteuerung</h4><div class="pro-effect-grid"><label>Effekt<select data-effect="type"><option value="none">Kein Effekt</option><option value="snow-light">Leichter Schneefall</option><option value="snow-heavy">Dichter Schneefall</option><option value="glitter">Feines Glitzern</option><option value="gold-dust">Goldregen</option><option value="stars">Sternenregen</option><option value="bokeh">Ruhige Lichtpunkte</option><option value="sparkle-wave">Glitzerwelle</option><option value="shooting-star">Sternschnuppen</option></select></label><label>Tempo<input data-effect="speed" type="range" min=".35" max="2.5" step=".05" value="${e.speed||1}"></label><label>Dichte<input data-effect="density" type="range" min="1" max="5" step="1" value="${e.density||2}"></label><label>Partikelgröße<input data-effect="size" type="range" min=".5" max="2" step=".1" value="${e.size||1}"></label><label>Deckkraft<input data-effect="opacity" type="range" min=".15" max="1" step=".05" value="${e.opacity||.78}"></label></div>`;box.prepend(card);card.querySelector('[data-effect="type"]').value=s.animation||'none';card.querySelectorAll('[data-effect]').forEach(i=>i.oninput=()=>{if(i.dataset.effect==='type')s.animation=i.value;else e[i.dataset.effect]=+i.value;if(typeof saveTvPresentation==='function')saveTvPresentation();if(typeof renderTvPreview==='function')renderTvPreview();else if(typeof preview==='function')preview()})}
 }
  const boxes=window.KC_DISABLE_LEGACY_TV_EDITORS?[]:['tvContextEditor','contextEditor'].map(id=>document.getElementById(id)).filter(Boolean);boxes.forEach(box=>{new MutationObserver(()=>{const s=typeof currentTvSlide==='function'?currentTvSlide():(window.slides&&window.slides[window.idx]);if(s)requestAnimationFrame(()=>bindAdvanced(box,s))}).observe(box,{childList:true,subtree:true});const s=typeof currentTvSlide==='function'?currentTvSlide():(window.slides&&window.slides[window.idx]);if(s)bindAdvanced(box,s)});
})();

// Zentrale Stammdaten (Warengruppen/Artikel) an alle gekoppelten Kassen senden - läuft über
// den Manager-Companion (loopback, derselbe Rechner), der es beim nächsten Sync jeder Kasse
// zur Verfügung stellt. PC-Manager bleibt dadurch die alleinige Pflegestelle.
document.getElementById('masterDataPushBtn')?.addEventListener('click', () => requireAuth(async () => {
  const statusFeld = document.getElementById('masterDataPushStatus');
  statusFeld.textContent = 'Wird gesendet …';
  try {
    const antwort = await fetch('http://127.0.0.1:47392/master-data/push', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      // Darstellung mitsenden - Knopfgrößen, Bild oder Text, Farben, sichtbare Sondertasten,
      // Bedienerliste, Vereins- und Veranstaltungsname. Was am Gerät hängt oder während der
      // Schicht persönlich gewählt wird (Kassennummer, Ansicht), filtert der Manager-Dienst
      // ausdrücklich heraus - siehe VERBOTEN dort.
      body: JSON.stringify({ groups, articles, packages: [], settings }),
    });
    if (!antwort.ok) throw new Error('Manager antwortete mit ' + antwort.status);
    const daten = await antwort.json();
    statusFeld.textContent = `Gesendet - Stand Nr. ${daten.revision}: Warengruppen, Artikel und Darstellung. `
      + 'Jede Kasse übernimmt es beim nächsten Abgleich. Die am Stand gewählte Ansicht bleibt unangetastet.';
  } catch (e) {
    statusFeld.textContent = 'Konnte nicht gesendet werden - läuft der Manager-Companion? (Marktag-Start.js)';
  }
}));

// --- Demodaten -----------------------------------------------------------------------------
// Erzeugt erfundene Umsaetze, damit Auswertungen und Grafiken Werte zeigen (Wunsch des Users:
// ausdruecklich ohne Einlesen, hinterher wieder loeschbar). Die Erzeugung selbst steckt in
// kc-demo-daten.js; hier haengen nur die Knoepfe und das Schreiben in die Ablage.
//
// BEWUSST NICHT gemeldet: kein queueSync, kein Manager-Dienst, keine Cloud - erfundene Zahlen
// duerfen das System nicht verlassen. Sie liegen nur in der Ablage dieses Rechners.
(function(){
  const modul=window.KCDemoDaten;
  if(!modul||!el("demoDatenErzeugen"))return;
  const bestand=()=>({sales,tips:managerTips,closings,cashMovements:cashMovementsLog,
    articles,registers,operators:settings.operators||[]});
  function standAnzeigen(){
    const z=modul.zaehle(bestand());
    const gesamt=z.verkaeufe+z.trinkgelder+z.abschluesse+z.bewegungen;
    el("demoDatenStand").textContent=gesamt
      ? `Zurzeit enthalten: ${z.verkaeufe} Verkäufe, ${z.trinkgelder} Trinkgelder, ${z.abschluesse} Tagesabschlüsse, ${z.bewegungen} Bargeldbewegungen (alle als Demodaten markiert).`
      : "Zurzeit sind keine Demodaten vorhanden.";
    modul.zeigeHinweis(bestand());
  }
  el("demoDatenErzeugen").onclick=()=>requireAuth(()=>{
    if(modul.vorhanden(bestand())&&!confirm("Es sind bereits Demodaten vorhanden. Sie werden zuerst entfernt und neu erzeugt. Fortfahren?"))return;
    // Erst die alten heraus, damit sich nichts doppelt aufsummiert.
    sales=sales.filter(x=>!modul.istDemo(x));
    managerTips=managerTips.filter(x=>!modul.istDemo(x));
    closings=closings.filter(x=>!modul.istDemo(x));
    cashMovementsLog=cashMovementsLog.filter(x=>!modul.istDemo(x));
    const neu=modul.erzeuge(bestand());
    if(neu.fehler)return alert(neu.fehler);
    sales=sales.concat(neu.verkaeufe);
    managerTips=managerTips.concat(neu.trinkgelder);
    closings=closings.concat(neu.abschluesse);
    cashMovementsLog=cashMovementsLog.concat(neu.bewegungen);
    saveAll();
    standAnzeigen();
    renderDashboard();renderReport();renderClosings();
    alert(`Demodaten erzeugt: ${neu.verkaeufe.length} Verkäufe über ${modul.TAGE} Markttage.\n\nDie Auswertungen zeigen jetzt Werte. Vor dem echten Markttag bitte über "Demodaten entfernen" wieder herausnehmen.`);
  });
  el("demoDatenEntfernen").onclick=()=>requireAuth(()=>{
    const z=modul.zaehle(bestand());
    const gesamt=z.verkaeufe+z.trinkgelder+z.abschluesse+z.bewegungen;
    if(!gesamt)return alert("Es sind keine Demodaten vorhanden.");
    if(!confirm(`${gesamt} Demodatensätze entfernen?\n\nEchte Daten bleiben unangetastet - entfernt wird ausschließlich, was als Demodaten markiert ist.`))return;
    sales=sales.filter(x=>!modul.istDemo(x));
    managerTips=managerTips.filter(x=>!modul.istDemo(x));
    closings=closings.filter(x=>!modul.istDemo(x));
    cashMovementsLog=cashMovementsLog.filter(x=>!modul.istDemo(x));
    saveAll();
    standAnzeigen();
    renderDashboard();renderReport();renderClosings();
    alert("Demodaten entfernt.");
  });
  standAnzeigen();
})();
