const global=window;

const DENOMS=[200,100,50,20,10,5,2,1,.5,.2,.1,.05,.02,.01];
const CASH_MEASURE=window.KCCashMeasureSettings;
let cashMeasureSettings=CASH_MEASURE.read();
let COIN_ROLLS=cashMeasureSettings.rolls.map(x=>({value:Number(x.value),coins:Number(x.coins)}));
let COIN_WEIGHTS_G=Object.fromEntries(cashMeasureSettings.coins.map(x=>[Number(x.value),Number(x.grams)]));
function reloadCashMeasureSettings(){
  cashMeasureSettings=CASH_MEASURE.read();
  COIN_ROLLS=cashMeasureSettings.rolls.map(x=>({value:Number(x.value),coins:Number(x.coins)}));
  COIN_WEIGHTS_G=Object.fromEntries(cashMeasureSettings.coins.map(x=>[Number(x.value),Number(x.grams)]));
}
let currentType="opening",currentPayload="";
// Anteile der zuletzt erzeugten Kassette - fuer Anzeige, Kurzcodes und Protokoll.
let letzteTeile=null;
const el=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(n);
const denomLabel=v=>v>=1?v+" €":Math.round(v*100)+" ct";
const localBusinessDate=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const isBusinessDate=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||""))return false;const [y,m,d]=value.split("-").map(Number),date=new Date(y,m-1,d);return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d};
const displayBusinessDate=value=>{const [y,m,d]=String(value).split("-");return `${d}.${m}.${y}`};
const MONEY_SECTION_STATE_KEY="kcm_money_sections_v0161";
function readMoneySectionState(){
  try{return JSON.parse(localStorage.getItem(MONEY_SECTION_STATE_KEY)||"{}")||{}}catch{return {}}
}
function setMoneySection(section,expanded,persist=true){
  const button=section.querySelector(".section-lock"),body=section.querySelector(".money-section-body"),icon=button.querySelector(".lock-icon"),label=button.querySelector(".lock-label");
  button.setAttribute("aria-expanded",String(expanded));
  button.title=expanded?"Bereich einklappen":"Bereich ausklappen";
  body.hidden=!expanded;
  icon.textContent=expanded?"🔓":"🔒";
  label.textContent=expanded?"Einklappen":"Ausklappen";
  section.classList.toggle("is-open",expanded);
  if(persist){
    const state=readMoneySectionState();
    state[section.dataset.moneySection]=expanded;
    localStorage.setItem(MONEY_SECTION_STATE_KEY,JSON.stringify(state));
  }
}
function initMoneySections(){
  const state=readMoneySectionState();
  document.querySelectorAll("[data-money-section]").forEach(section=>{
    const key=section.dataset.moneySection,expanded=typeof state[key]==="boolean"?state[key]:section.dataset.defaultOpen==="true";
    setMoneySection(section,expanded,false);
    section.querySelector(".section-lock").addEventListener("click",()=>setMoneySection(section,section.querySelector(".section-lock").getAttribute("aria-expanded")!=="true"));
  });
}
initMoneySections();
el("moneyToolTestHint").hidden=!window.KC_RUNTIME_FLAGS?.testPhaseToolGuidance;
document.querySelectorAll(".date-quick").forEach(button=>button.addEventListener("click",()=>{
  const offset=Number(button.dataset.dateOffset||0),date=new Date();
  date.setDate(date.getDate()+offset);
  el("effectiveDate").value=localBusinessDate(date);
  el("effectiveDate").dispatchEvent(new Event("input",{bubbles:true}));
  document.querySelectorAll(".date-quick").forEach(x=>x.classList.toggle("active",x===button));
}));
function updateCountDateHint(){
  const hint=el("countDateHint");
  if(!hint)return;
  if(currentType!=="count"){hint.hidden=true;hint.textContent="";return;}
  const value=el("effectiveDate").value,heute=localBusinessDate();
  hint.hidden=false;
  if(!isBusinessDate(value)){hint.textContent="Bitte den Geschäftstag des zugehörigen Kassenabschlusses auswählen.";return;}
  if(value<heute){
    hint.textContent=`Nachzählung zum Tagesabschluss vom ${displayBusinessDate(value)}. Der tatsächliche Zählzeitpunkt wird zusätzlich gespeichert.`;
  }else if(value===heute){
    hint.textContent=`Abendzählung zum Tagesabschluss vom ${displayBusinessDate(value)}.`;
  }else{
    hint.textContent="Eine Zählung kann keinem zukünftigen Tagesabschluss zugeordnet werden.";
  }
}
el("effectiveDate").addEventListener("input",()=>{
  const heute=new Date();
  const offsets=[-1,0,1];
  const value=el("effectiveDate").value;
  document.querySelectorAll(".date-quick").forEach((button,index)=>{
    const d=new Date(heute);d.setDate(d.getDate()+offsets[index]);
    button.classList.toggle("active",value===localBusinessDate(d));
  });
  updateCountDateHint();
});

const MUENZ_FOTOS={2:"assets/muenze_2.webp",1:"assets/muenze_1.webp",.5:"assets/muenze_0.5.webp",.2:"assets/muenze_0.2.webp",.1:"assets/muenze_0.1.webp",.05:"assets/muenze_0.05.webp",.02:"assets/muenze_0.02.webp",.01:"assets/muenze_0.01.webp"}; // wird nach und nach ergänzt, sobald weitere echte Münzbilder vorliegen
el("denoms").innerHTML=DENOMS.map(v=>{
  if(v>=5){
    return `<label class="denom" data-schein="${v}"><span class="schein-flaeche schein-foto" style="background-image:url('assets/schein_${v}.jpg')" aria-hidden="true"></span><input type="number" min="0" step="1" value="0" data-value="${v}"></label>`;
  }
  const label=v>=1?v+" €":Math.round(v*100)+" ct";
  const symbol=MUENZ_FOTOS[v]
    ?`<span class="muenze-symbol muenze-foto" style="background-image:url('${MUENZ_FOTOS[v]}')" aria-hidden="true"></span>`
    :`<span class="muenze-symbol" aria-hidden="true"><svg viewBox="0 0 52 52" width="40" height="40">
    <circle cx="26" cy="26" r="24" class="muenze-aussen"/>
    <circle cx="26" cy="26" r="16" class="muenze-innen"/>
    <text x="26" y="31" class="muenze-text">${v>=1?v:Math.round(v*100)}</text>
  </svg></span>`;
  return `<label class="denom" data-muenze="${v}">${symbol}<strong>${label}</strong><input type="number" min="0" step="1" value="0" data-value="${v}"></label>`;
}).join("");
function weighRows(items,target){
  return items.map(item=>{
    const wert=Number(item.value),gewicht=Number(item.grams)||0,has=gewicht>0;
    const label=target==="roll"?`${denomLabel(wert)} Rolle`:denomLabel(wert);
    const amountFactor=target==="roll"?(Number(item.coins)||0)*wert:wert;
    return `<div class="coin-weigh-row" data-weigh-row="${target}-${wert}">
      <strong>${label}</strong>
      <span>${has?`${gewicht.toFixed(2).replace(".",",")} g/${target==="roll"?"Rolle":"Stück"}`:"kein Gewicht gepflegt"}</span>
      <label><input type="number" min="0" step="0.01" inputmode="decimal" data-weigh-target="${target}" data-weigh-value="${wert}" data-weigh-unit="${gewicht}" data-weigh-factor="${amountFactor}" ${has?"":"disabled"} placeholder="0,00"><small>g netto</small></label>
      <span data-weigh-result="${target}-${wert}">—</span>
      <b data-weigh-amount="${target}-${wert}">—</b>
      <button type="button" data-weigh-apply="${target}-${wert}" disabled>Übernehmen</button>
    </div>`;
  }).join("");
}
function renderCashMeasureInputs(){
  el("coinRolls").innerHTML=COIN_ROLLS.map(r=>`<label class="coin-roll-row" data-rolle="${r.value}">
    <span class="roll-icon" aria-hidden="true"><svg viewBox="0 0 40 68" width="34" height="58"><rect x="3" y="10" width="34" height="52" rx="7" class="roll-body"/><rect x="3" y="10" width="34" height="11" rx="6" class="roll-cap"/><text x="20" y="42" class="roll-text">${denomLabel(r.value)}</text></svg></span>
    <strong>${denomLabel(r.value)}</strong>
    <span class="roll-input"><input type="number" min="0" step="1" value="0" inputmode="numeric" data-roll-value="${r.value}" data-roll-coins="${r.coins}" aria-label="Anzahl Rollen ${denomLabel(r.value)}"><small>Rollen</small></span>
    <span>${r.coins} Münzen</span>
    <span>${money(r.value*r.coins)}</span>
    <b data-roll-total="${r.value}">${money(0)}</b>
  </label>`).join("");
  el("coinWeighing").innerHTML=weighRows(cashMeasureSettings.coins,"coin");
  el("noteWeighing").innerHTML=weighRows(cashMeasureSettings.notes,"note");
  el("rollWeighing").innerHTML=weighRows(cashMeasureSettings.rolls,"roll");
  bindMeasureInputs();
}
function updateWeighRow(input){
  const target=input.dataset.weighTarget,wert=Number(input.dataset.weighValue),gewicht=Number(input.dataset.weighUnit),factor=Number(input.dataset.weighFactor),gramm=Number(String(input.value||"").replace(",","."));
  const key=`${target}-${wert}`,result=document.querySelector(`[data-weigh-result="${key}"]`),amount=document.querySelector(`[data-weigh-amount="${key}"]`),apply=document.querySelector(`[data-weigh-apply="${key}"]`);
  if(!Number.isFinite(gramm)||gramm<=0||!gewicht){result.textContent="—";amount.textContent="—";apply.disabled=true;apply.dataset.units="";return;}
  const roh=gramm/gewicht,units=Math.max(0,Math.round(roh)),soll=units*gewicht,abweichung=gramm-soll;
  result.textContent=`≈ ${units} ${target==="roll"?"Rollen":"Stück"} · Rest ${abweichung>=0?"+":""}${abweichung.toFixed(2).replace(".",",")} g`;
  amount.textContent=money(units*factor);
  apply.disabled=units<=0;apply.dataset.units=String(units);apply.dataset.target=target;apply.dataset.value=String(wert);
}
function bindMeasureInputs(){
  document.querySelectorAll("[data-roll-value]").forEach(n=>n.oninput=()=>{updateTotal();zeichneAufteilung();clearTransferOutput()});
  document.querySelectorAll("[data-weigh-target]").forEach(input=>input.addEventListener("input",()=>updateWeighRow(input)));
  document.querySelectorAll("[data-weigh-apply]").forEach(button=>button.addEventListener("click",()=>{
    const wert=Number(button.dataset.value),units=Number(button.dataset.units||0),target=button.dataset.target;
    if(!units)return;
    const ziel=target==="roll"
      ?[...document.querySelectorAll("[data-roll-value]")].find(n=>Number(n.dataset.rollValue)===wert)
      :[...document.querySelectorAll("[data-value]")].find(n=>Number(n.dataset.value)===wert);
    if(!ziel)return;
    ziel.value=String(units);
    ziel.dispatchEvent(new Event("input",{bubbles:true}));
    button.textContent="Übernommen";
    setTimeout(()=>button.textContent="Übernehmen",900);
  }));
}
renderCashMeasureInputs();

const ENTRY_MODE_KEY="kc_money_butler_entry_mode_v1";
let entryMode=localStorage.getItem(ENTRY_MODE_KEY)==="weigh"?"weigh":"count";
function setEntryMode(mode){
  entryMode=mode==="weigh"?"weigh":"count";
  localStorage.setItem(ENTRY_MODE_KEY,entryMode);
  document.body.classList.toggle("entry-mode-count",entryMode==="count");
  document.body.classList.toggle("entry-mode-weigh",entryMode==="weigh");
  document.querySelectorAll("[data-entry-mode]").forEach(b=>b.classList.toggle("active",b.dataset.entryMode===entryMode));
}
document.querySelectorAll("[data-entry-mode]").forEach(b=>b.addEventListener("click",()=>setEntryMode(b.dataset.entryMode)));
setEntryMode(entryMode);

function settingsImagePath(item,type){
  if(type==="coin")return item.image||`assets/muenze_${item.value}.webp`;
  if(type==="note")return item.image||`assets/schein_${item.value}.jpg`;
  return "";
}
async function cashMeasureCloudClient(){
  if(typeof KCCommunicationClient!=="function"||!window.KCMoneyButlerAuth?.getAccessToken)return null;
  return new KCCommunicationClient({sourceProgram:"kc-money-butler",getAccessToken:()=>window.KCMoneyButlerAuth.getAccessToken(),defaultTestOnly:false});
}
async function pullCashMeasureSettings(){
  try{
    const client=await cashMeasureCloudClient();if(!client)return false;
    const data=await client._request("kc-finance-bridge",{action:"cash_measure_settings_get"});
    if(!data?.settings)return false;
    CASH_MEASURE.save(data.settings);reloadCashMeasureSettings();renderCashMeasureInputs();updateTotal();
    return true;
  }catch(e){console.warn("Zentrale Gewichtseinstellungen konnten nicht geladen werden:",e?.message||e);return false}
}
async function pushCashMeasureSettings(settingsToSave){
  const client=await cashMeasureCloudClient();
  if(!client)throw new Error("Keine aktive Money-Butler-Anmeldung.");
  const data=await client._request("kc-finance-bridge",{action:"cash_measure_settings_upsert",sourceProgram:"kc-money-butler",settings:settingsToSave});
  return data;
}
function renderSettings(){
  const s=CASH_MEASURE.read();
  el("settingsCoins").innerHTML=s.coins.map(x=>`<div class="settings-money-row coin">
    <img src="${settingsImagePath(x,"coin")}" alt="">
    <strong>${denomLabel(Number(x.value))}</strong>
    <label>Gewicht g<input type="number" min="0.01" step="0.01" data-setting-coin="${x.value}" value="${x.grams??""}"></label>
    <span class="settings-extra">offizieller Standard</span>
  </div>`).join("");
  el("settingsRolls").innerHTML=s.rolls.map(x=>`<div class="settings-money-row">
    <div class="closing-roll-symbol">▰</div><strong>${denomLabel(Number(x.value))}</strong>
    <label>Münzen/Rolle<input type="number" min="1" step="1" data-setting-roll="${x.value}" value="${x.coins}"></label>
    <label class="settings-extra">Aktiver Zählwert g<input type="number" min="0" step=".01" data-setting-roll-grams="${x.value}" value="${x.grams??""}" placeholder="${x.referenceGrams??"optional"}"></label>
    <small class="settings-extra">Referenz: ${x.referenceGrams??"—"} g · ${x.referenceBasis||""}</small>
  </div>`).join("");
  el("settingsNotes").innerHTML=s.notes.map(x=>`<div class="settings-money-row">
    <img src="${settingsImagePath(x,"note")}" alt="">
    <strong>${denomLabel(Number(x.value))}</strong>
    <label>Aktiver Zählwert g<input type="number" min="0" step="0.01" data-setting-note="${x.value}" value="${x.grams??""}" placeholder="${x.referenceGrams??"nicht gesetzt"}"></label>
    <small class="settings-extra">Referenz: ${x.referenceGrams??"—"} g · ${x.referenceBasis||""}</small>
  </div>`).join("");
}
function collectSettings(){
  const s=CASH_MEASURE.read();
  document.querySelectorAll("[data-setting-coin]").forEach(n=>{const x=s.coins.find(v=>Number(v.value)===Number(n.dataset.settingCoin));if(x)x.grams=Math.max(.01,Number(n.value)||0)});
  document.querySelectorAll("[data-setting-roll]").forEach(n=>{const x=s.rolls.find(v=>Number(v.value)===Number(n.dataset.settingRoll));if(x)x.coins=Math.max(1,Math.round(Number(n.value)||1))});
  document.querySelectorAll("[data-setting-roll-grams]").forEach(n=>{const x=s.rolls.find(v=>Number(v.value)===Number(n.dataset.settingRollGrams));if(x)x.grams=n.value===""?null:Math.max(.01,Number(n.value)||0)});
  document.querySelectorAll("[data-setting-note]").forEach(n=>{const x=s.notes.find(v=>Number(v.value)===Number(n.dataset.settingNote));if(x)x.grams=n.value===""?null:Math.max(.01,Number(n.value)||0)});
  return s;
}
function activateSettingsTab(name){
  document.querySelectorAll("[data-settings-tab]").forEach(b=>b.classList.toggle("active",b.dataset.settingsTab===name));
  document.querySelectorAll("[data-settings-panel]").forEach(p=>p.hidden=p.dataset.settingsPanel!==name);
}
document.querySelectorAll("[data-settings-tab]").forEach(b=>b.addEventListener("click",()=>activateSettingsTab(b.dataset.settingsTab)));
el("settingsBtn")?.addEventListener("click",async()=>{await pullCashMeasureSettings();renderSettings();activateSettingsTab("coins");el("settingsDialog").showModal()});
el("saveCashSettings")?.addEventListener("click",async()=>{
  const button=el("saveCashSettings"),neu=collectSettings();
  button.disabled=true;button.textContent="Speichert …";
  try{
    CASH_MEASURE.save(neu);reloadCashMeasureSettings();renderCashMeasureInputs();updateTotal();
    await pushCashMeasureSettings(neu);
    renderSettings();button.textContent="Zentral gespeichert ✓";
  }catch(e){
    button.textContent="Lokal gespeichert · Cloudfehler";
    console.warn("Zentrale Gewichtseinstellungen nicht gespeichert:",e?.message||e);
  }finally{
    button.disabled=false;setTimeout(()=>button.textContent="Speichern",1600);
  }
});
el("resetCashSettings")?.addEventListener("click",()=>{
  if(!confirm("Standardwerte wirklich wiederherstellen?"))return;
  CASH_MEASURE.reset();reloadCashMeasureSettings();renderCashMeasureInputs();updateTotal();renderSettings();
});

function testResult(name,state,detail){
  return `<div class="test-result ${state}"><span>${state==="ok"?"●":state==="warn"?"●":"●"}</span><strong>${name}</strong><small>${detail}</small></div>`;
}
async function runConnectionTests(){
  const out=el("testcenterResults");out.innerHTML=testResult("Prüfung","warn","läuft …");
  const token=window.KCMoneyButlerCommunicator?.tokenLesen?.()||"";
  if(!token){out.innerHTML=testResult("KC Communicator","warn","Kein Zugriffstoken gespeichert.")+testResult("Datenbank","warn","Ohne Anmeldung nicht prüfbar.")+testResult("PC Manager","warn","Cloudweg ohne Anmeldung nicht prüfbar.")+testResult("KC Verwaltung","warn","Finanzweg ohne Anmeldung nicht prüfbar.");return;}
  const client=new KCCommunicationClient({sourceProgram:"kc-money-butler",getAccessToken:async()=>token,defaultTestOnly:false});
  const rows=[];
  try{await client.health();rows.push(testResult("Datenbank / KC Cloud","ok","erreichbar"));}catch(e){rows.push(testResult("Datenbank / KC Cloud","fail",e?.message||String(e)))}
  try{const a=await client.checkAccess();rows.push(testResult("KC Communicator",a?.canSend?"ok":"warn",a?.canSend?"Senden freigegeben":"erreichbar, aber Senden nicht freigegeben"));}catch(e){rows.push(testResult("KC Communicator","fail",e?.message||String(e)))}
  async function protectedCheck(name,action){
    try{await client._request("kc-finance-bridge",{action,limit:1,onlyUnimported:true,statuses:["pending_manager"]});rows.push(testResult(name,"ok","Cloudweg erreichbar und berechtigt"))}
    catch(e){if(Number(e?.status)===403)rows.push(testResult(name,"warn","Cloudweg erreichbar, aber diesem Benutzer fehlen Verwaltungsrechte"));else rows.push(testResult(name,"fail",e?.message||String(e)))}
  }
  await protectedCheck("PC Manager / Finance Bridge","cash_count_list");
  await protectedCheck("KC Verwaltung / Tagesabschlüsse","closing_report_list");
  out.innerHTML=rows.join("");
}
el("runAllTests")?.addEventListener("click",runConnectionTests);

function clearTransferOutput(){
  currentPayload="";el("payload").value="";el("handoverType").textContent="—";el("handoverRegister").textContent="—";el("handoverDate").textContent="—";
  const ctx=el("qrCanvas").getContext("2d");ctx.clearRect(0,0,el("qrCanvas").width,el("qrCanvas").height);
  el("handoverOutputQr")?.setAttribute("hidden","");
  el("handoverOutputShortcode")?.setAttribute("hidden","");
  el("communicatorSettings")?.setAttribute("hidden","");
}

// --- Geldkassette: eine Erfassung, zwei Geldladen ----------------------------------------
// Bedienung und Rechnung kommen aus shared/kc-geldkassette.js - dieselbe Stelle, die auch der
// PC-Manager benutzt. Ausdruecklicher Wunsch: es soll an beiden Stellen gleich sein.
const KASSETTE_ZIEL=window.KCGeldkassette.ZIEL;
const KASSETTE_KASSEN=window.KCGeldkassette.KASSEN;
const istKassette=()=>el("register").value===KASSETTE_ZIEL;

// Alle Sorten, die ueberhaupt in der Kassette liegen (Stueckzahl groesser null).
function kassetteSorten(){
  const sorten=[];
  document.querySelectorAll("[data-value]").forEach(n=>{
    const anzahl=Math.max(0,parseInt(n.value||0));
    if(anzahl>0)sorten.push({art:"lose",wert:parseFloat(n.dataset.value),anzahl,label:denomLabel(parseFloat(n.dataset.value))});
  });
  document.querySelectorAll("[data-roll-value]").forEach(n=>{
    const anzahl=Math.max(0,parseInt(n.value||0));
    if(anzahl>0)sorten.push({art:"rolle",wert:parseFloat(n.dataset.rollValue),anzahl,coinsPerRoll:parseInt(n.dataset.rollCoins),label:`${denomLabel(parseFloat(n.dataset.rollValue))} - Rollen`});
  });
  return sorten;
}
const kassette=window.KCGeldkassette.erstelle({
  container:el("kassetteAufteilung"),
  sortenLesen:kassetteSorten,
  gesamtLesen:()=>getData().total,
  beiAenderung:clearTransferOutput
});
function zeichneAufteilung(){
  const bereich=el("kassetteSection");
  if(!bereich)return;
  bereich.hidden=!istKassette();
  if(istKassette())kassette.zeichnen();
}
function setDatePurpose(){
  el("effectiveDateLabel").textContent=currentType==="count"?"Tagesabschluss vom *":"Gültig für *";
  updateCountDateHint();
}
// Die Abendzaehlung gilt immer genau einer Geldlade - eine gemeinsame Kassette gibt es dabei
// nicht. Deshalb wird das Kassetten-Ziel dann gesperrt und auf Kasse 1 zurueckgestellt.
function pflegeKassettenAuswahl(){
  const option=[...el("register").options].find(o=>o.value===KASSETTE_ZIEL);
  if(!option)return;
  const gesperrt=currentType==="count";
  option.disabled=gesperrt;
  option.textContent=gesperrt?"Geldkassette – bei der Abendzählung nicht möglich":"Geldkassette – auf beide Laden aufteilen";
  if(gesperrt&&istKassette())el("register").value="KASSE-01";
}
document.querySelectorAll(".choice").forEach(b=>b.onclick=()=>{document.querySelectorAll(".choice").forEach(x=>x.classList.toggle("active",x===b));currentType=b.dataset.type;setDatePurpose();pflegeKassettenAuswahl();zeichneAufteilung();clearTransferOutput()});
document.querySelectorAll("[data-value]").forEach(n=>n.oninput=()=>{updateTotal();zeichneAufteilung();clearTransferOutput()});
["register","effectiveDate","note"].forEach(id=>el(id).addEventListener("input",clearTransferOutput));
el("register").addEventListener("change",()=>{zeichneAufteilung();clearTransferOutput()});
function getData(){
  const looseBreakdown={},breakdown={},coinRolls={};let looseTotal=0,rollTotal=0;
  document.querySelectorAll("[data-value]").forEach(n=>{
    const count=Math.max(0,parseInt(n.value||0)),value=parseFloat(n.dataset.value);
    looseBreakdown[value]=count;breakdown[value]=count;looseTotal+=count*value;
  });
  document.querySelectorAll("[data-roll-value]").forEach(n=>{
    const rolls=Math.max(0,parseInt(n.value||0)),value=parseFloat(n.dataset.rollValue),coinsPerRoll=parseInt(n.dataset.rollCoins);
    const coinCount=rolls*coinsPerRoll,valuePerRoll=value*coinsPerRoll,total=rolls*valuePerRoll;
    coinRolls[value]={rolls,coinsPerRoll,coinCount,valuePerRoll:+valuePerRoll.toFixed(2),total:+total.toFixed(2)};
    breakdown[value]=(breakdown[value]||0)+coinCount;rollTotal+=total;
  });
  looseTotal=+looseTotal.toFixed(2);rollTotal=+rollTotal.toFixed(2);
  return{looseBreakdown,coinRolls,breakdown,looseTotal,rollTotal,total:+(looseTotal+rollTotal).toFixed(2)};
}
function updateTotal(){
  const data=getData();
  el("looseTotal").textContent=money(data.looseTotal);el("rollTotal").textContent=money(data.rollTotal);el("total").textContent=money(data.total);
  el("handoverLooseTotal").textContent=money(data.looseTotal);el("handoverRollTotal").textContent=money(data.rollTotal);el("handoverTotal").textContent=money(data.total);
  document.querySelectorAll("[data-roll-value]").forEach(n=>{const value=parseFloat(n.dataset.rollValue),row=data.coinRolls[value];document.querySelector(`[data-roll-total="${n.dataset.rollValue}"]`).textContent=money(row?.total||0)});
}
function checksum(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,"0")}
// ECHTER FUND: vorher wurde immer in eine feste 360-px-Flaeche gezeichnet und die Modulbreite
// mit floor/ceil gerundet. Sobald der Code laenger wurde, kamen auf ein Modul nur noch zwei
// Pixel - und die Rundung verschob sie zusaetzlich. Ergebnis: der QR-Code sah aus wie ein
// QR-Code, war aber nachweislich NICHT mehr einlesbar. Jetzt bestimmt die Modulzahl die
// Bildgroesse, jedes Modul ist ganzzahlig und mindestens 4 px breit; die Anzeigegroesse
// begrenzt weiterhin das CSS (max-width:100%).
function drawQR(canvas,text){
  // Zeichnet ueber das gemeinsame Modul shared/kc-qr.js - siehe dort die Begruendung.
  const ergebnis=window.KCQrCode.zeichne(canvas,text,360);
  if(!ergebnis.ok)throw new Error(ergebnis.grund||"QR-Code konnte nicht erzeugt werden.");
  return ergebnis;
}
let selectedHandoverMethod=null;
const HANDOVER_METHODS={
  qr:{label:"QR-Code",description:"QR-Code anzeigen und an Kasse oder PC-Manager scannen."},
  shortcode:{label:"Kurzcode",description:"Kurzcode anzeigen und an der Kasse von Hand eingeben."},
  file:{label:"Datei",description:".kccash-Datei speichern und zum PC-Manager oder Kassengerät übertragen."},
  communicator:{label:"KC Communicator",description:"Von zuhause über KC Communicator an den PC-Manager senden."}
};
function decodeCurrentTransfer(){
  if(!currentPayload)throw new Error("Zuerst die Übergabe erzeugen.");
  const prefix=currentPayload.startsWith("KCASH1:")?"KCASH1:":currentPayload.startsWith("KCOUNT1:")?"KCOUNT1:":null;
  if(!prefix)throw new Error("Unbekannter Übertragungscode.");
  return{prefix,payload:JSON.parse(decodeURIComponent(escape(atob(currentPayload.slice(prefix.length)))))};
}
function setConfirmationRequested(wanted){
  const{prefix,payload}=decodeCurrentTransfer();
  delete payload.checksum;
  if(wanted){
    payload.confirmationRequested=true;
    payload.confirmationRequestedAt=new Date().toISOString();
  }else{
    delete payload.confirmationRequested;
    delete payload.confirmationRequestedAt;
  }
  payload.checksum=checksum(JSON.stringify(payload));
  currentPayload=prefix+btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  el("payload").value=currentPayload;
  try{drawQR(el("qrCanvas"),currentPayload)}catch{}
  return payload;
}
function openHandoverStart(method){
  if(!currentPayload)return alert("Zuerst die Übergabe erzeugen.");
  const def=HANDOVER_METHODS[method];if(!def)return;
  selectedHandoverMethod=method;
  el("handoverStartTitle").textContent=def.label+" starten";
  el("handoverStartRoute").textContent=def.description;
  el("handoverStartTarget").textContent=el("handoverRegister").textContent;
  el("handoverStartAmount").textContent=el("handoverTotal").textContent;
  el("handoverStartDate").textContent=el("handoverDate").textContent;
  el("handoverStartStatus").textContent="";
  const confirm=el("handoverConfirmationWanted");
  confirm.checked=false;
  confirm.disabled=method==="shortcode"||currentType==="count";
  el("handoverConfirmationHint").textContent=currentType==="count"
    ?"Bei einer Zählung wird kein Geld übertragen. Deshalb ist keine Geld-Empfangsbestätigung erforderlich."
    :method==="shortcode"
      ?"Beim Kurzcode ist keine automatische Empfangsbestätigung möglich, weil dieser Notweg keine Zusatzdaten überträgt."
      :"Optional: Der Transfer enthält dann die Anforderung, den Eingang des Geldes zu bestätigen.";
  const auth=el("handoverCommunicatorAuth");
  auth.hidden=method!=="communicator";
  el("handoverStartDialog").showModal();
}
document.querySelectorAll("[data-handover-method]").forEach(button=>button.addEventListener("click",()=>openHandoverStart(button.dataset.handoverMethod)));
el("handoverStartCancel")?.addEventListener("click",()=>el("handoverStartDialog").close());
el("handoverStartButton")?.addEventListener("click",async()=>{
  if(!selectedHandoverMethod)return;
  const status=el("handoverStartStatus"),wantConfirmation=!!el("handoverConfirmationWanted").checked;
  status.textContent="Wird gestartet …";
  try{
    if(selectedHandoverMethod!=="shortcode")setConfirmationRequested(wantConfirmation);
    el("handoverOutputQr").hidden=true;
    el("handoverOutputShortcode").hidden=true;
    el("communicatorSettings").hidden=true;
    if(selectedHandoverMethod==="qr"){
      el("handoverStartDialog").close();
      el("handoverOutputQr").hidden=false;
      el("handoverOutputQr").scrollIntoView({block:"nearest",behavior:"smooth"});
      return;
    }
    if(selectedHandoverMethod==="shortcode"){
      el("handoverStartDialog").close();
      el("handoverOutputShortcode").hidden=false;
      el("handoverOutputShortcode").scrollIntoView({block:"nearest",behavior:"smooth"});
      return;
    }
    if(selectedHandoverMethod==="file"){
      el("handoverStartDialog").close();
      el("save").click();
      return;
    }
    if(selectedHandoverMethod==="communicator"){
      const token=await window.KCMoneyButlerAuth?.getAccessToken?.();
      if(!token)throw new Error("Bitte zuerst im Money Butler anmelden.");
      const result=await window.KCMoneyButlerCommunicator?.senden?.();
      if(!result)throw new Error(el("commSendStatus")?.textContent||"KC Communicator hat die Übergabe nicht bestätigt.");
      status.textContent=wantConfirmation
        ?"Gesendet. Empfangsbestätigung wurde angefordert."
        :"Gesendet. Der PC-Manager erhält die Übergabe über KC Communicator.";
      setTimeout(()=>el("handoverStartDialog").close(),700);
    }
  }catch(err){status.textContent="Nicht gestartet: "+(err?.message||String(err));}
});

el("generate").onclick=()=>{const c=getData(),effectiveDate=el("effectiveDate").value,heute=localBusinessDate();if(!isBusinessDate(effectiveDate))return alert("Bitte das gültige Einsatzdatum im Kalender auswählen.");if(currentType!=="count"&&effectiveDate<heute)return alert("Anfangsbestand und Nachfüllung dürfen nicht in der Vergangenheit liegen.");if(currentType==="count"&&effectiveDate>heute)return alert("Eine Zählung kann keinem zukünftigen Tagesabschluss zugeordnet werden.");if(c.total<=0)return alert("Bitte mindestens eine Stückelung eingeben.");const countedAt=new Date().toISOString(),istNachzaehlung=currentType==="count"&&effectiveDate<heute;const payload={
  format:currentType==="count"?"KC_CASH_COUNT":"KC_CASH_TRANSFER",
  version:currentType==="count"?3:4,
  transferId:crypto.randomUUID(),
  countId:currentType==="count"?crypto.randomUUID():undefined,
  registerId:el("register").value,
  type:currentType,
  time:countedAt,
  countedAt:currentType==="count"?countedAt:undefined,
  effectiveDate,
  countForBusinessDate:currentType==="count"?effectiveDate:undefined,
  countKind:currentType==="count"?(istNachzaehlung?"late":"same-day"):undefined,
  countLabel:currentType==="count"?(istNachzaehlung?`Nachzählung zum Tagesabschluss vom ${displayBusinessDate(effectiveDate)}`:`Abendzählung zum Tagesabschluss vom ${displayBusinessDate(effectiveDate)}`):undefined,
  breakdown:c.breakdown,
  looseBreakdown:c.looseBreakdown,
  coinRolls:c.coinRolls,
  looseTotal:c.looseTotal,
  rollTotal:c.rollTotal,
  total:c.total,
  note:el("note").value.trim()
};
// Geldkassette: EIN Code fuer beide Kassen, aber mit getrennten Anteilen. Jede Kasse bucht
// nur ihren eigenen Anteil - deshalb bleiben Doppelbuchungsschutz, Abschlussuebersicht und
// Abendzaehlung an der Kasse unveraendert gueltig.
letzteTeile=null;
if(istKassette()){
  const ergebnis=kassette.anPayload(payload,checksum);
  if(ergebnis.fehler)return alert(ergebnis.fehler);
  letzteTeile=ergebnis.teile;
}
const raw=JSON.stringify(payload);payload.checksum=checksum(raw);
// Fuer die Statistik festhalten, WAS uebergeben wurde - nicht nur die Summe. Bewusst ohne
// await: der QR-Code darf nicht darauf warten, ob der Manager-Dienst gerade erreichbar ist.
// Ist er es nicht, bleibt die Uebergabe im lokalen Verlauf dieses Geraets stehen.
// Bei der Kassette hat der Vorgang absichtlich keine einzelne Kassen-ID (er gilt fuer beide).
// Fuer die Statistik bekommt er trotzdem eine lesbare Kennung, sonst faellt er aus jedem
// Kassen-Filter im PC-Manager heraus und waere dort praktisch unsichtbar.
global.KCBargeldStatistik?.melden?.(payload.scope==="split"?{...payload,registerId:"KASSETTE"}:payload, 'money-butler');
currentPayload=(currentType==="count"?"KCOUNT1:":"KCASH1:")+btoa(unescape(encodeURIComponent(JSON.stringify(payload))));el("payload").value=currentPayload;el("handoverType").textContent=currentType==="opening"?"Anfangsbestand":currentType==="topup"?"Nachfüllung":(istNachzaehlung?"Nachzählung":"Abendzählung");el("handoverRegister").textContent=istKassette()?`Kassette – Kasse 1 ${money(letzteTeile["KASSE-01"].total)} / Kasse 2 ${money(letzteTeile["KASSE-02"].total)}`:(el("register").selectedOptions[0]?.textContent||el("register").value);el("kassetteHinweis").hidden=!istKassette();el("handoverDate").textContent=displayBusinessDate(effectiveDate);
  // Der QR-Code hat eine harte Groessengrenze. Faellt sie, darf NICHT still abgebrochen werden -
  // sonst stehen Kurzcode und Protokoll auf altem Stand und niemand merkt es (echter Fund im Test).
  try{drawQR(el("qrCanvas"),currentPayload)}
  catch(err){
    const flaeche=el("qrCanvas"),stift=flaeche.getContext("2d");
    stift.fillStyle="#fff";stift.fillRect(0,0,flaeche.width,flaeche.height);
    stift.fillStyle="#b91c1c";stift.font="bold 15px system-ui";stift.textAlign="center";
    stift.fillText("QR-Code zu groß",flaeche.width/2,flaeche.height/2-10);
    stift.fillText("bitte Kurzcode oder Datei nutzen",flaeche.width/2,flaeche.height/2+14);
  }
  setMoneySection(document.querySelector('[data-money-section="handover"]'),true);
  el("handoverOutputQr").hidden=true;
  el("handoverOutputShortcode").hidden=true;
  el("communicatorSettings").hidden=true;
  selectedHandoverMethod=null;
  const kurzcodeFeld=el("kurzcode");
  if(kurzcodeFeld){
    if(currentType==="count"){kurzcodeFeld.textContent="Für die Abendzählung nicht verfügbar - bitte den vollständigen Code verwenden."}
    else{
      const typZiffer=currentType==="opening"?"1":"2";
      // Der Kurzcode kann keine Stueckelung tragen. Bei der Kassette bekommt deshalb JEDE Kasse
      // ihren eigenen Kurzcode ueber ihren eigenen Anteil - der Kassenleser bleibt unveraendert.
      const codeFuer=(kasseZiffer,betrag)=>{
        const betragCent=String(Math.round(betrag*100)).padStart(6,"0");
        if(betragCent.length>6)return null;
        const ziffern=typZiffer+kasseZiffer+betragCent;
        let quersumme=0;for(let i=0;i<ziffern.length;i++)quersumme+=Number(ziffern[i])*(i+2);
        return `${typZiffer}-${kasseZiffer}-${betragCent}-${quersumme%10}`;
      };
      if(istKassette()){
        const eins=codeFuer("1",letzteTeile["KASSE-01"].total),zwei=codeFuer("2",letzteTeile["KASSE-02"].total);
        kurzcodeFeld.textContent=eins&&zwei
          ?`Kasse 1: ${eins}    Kasse 2: ${zwei}`
          :"Betrag zu hoch für den Kurzcode (über 9.999,99 Euro) - bitte den vollständigen Code verwenden.";
      }else{
        // Die Ziffer kommt aus der Kassen-ID (KASSE-03 -> "3"). Laesst sie sich nicht
        // ableiten, wird KEIN Kurzcode ausgegeben - frueher wurde daraus stillschweigend
        // eine andere Kasse, und das Geld waere falsch gebucht worden.
        const ziffer=(el("register").value.match(/^KASSE-0([1-8])$/)||[])[1];
        const code=ziffer?codeFuer(ziffer,c.total):null;
        kurzcodeFeld.textContent=!ziffer
          ?`Für ${el("register").value} gibt es keinen Kurzcode - bitte den QR-Code oder die Datei verwenden.`
          :(code||"Betrag zu hoch für den Kurzcode (über 9.999,99 Euro) - bitte den vollständigen Code verwenden.");
      }
    }
  }
  zeichneProtokoll(payload,c);
};
el("reset").onclick=()=>{document.querySelectorAll("[data-value],[data-roll-value]").forEach(n=>n.value=0);document.querySelectorAll("[data-weigh-grams]").forEach(n=>{n.value="";updateWeighRow(n)});el("effectiveDate").value="";el("note").value="";updateCountDateHint();updateTotal();clearTransferOutput()};
el("print").onclick=()=>{if(!currentPayload)return alert("Zuerst QR-Code erzeugen.");window.print()};
el("copy").onclick=async()=>{if(!currentPayload)return alert("Zuerst QR-Code erzeugen.");await navigator.clipboard.writeText(currentPayload);alert("Code kopiert.")};
el("save").onclick=()=>{if(!currentPayload)return alert("Zuerst QR-Code erzeugen.");const blob=new Blob([currentPayload],{type:"text/plain"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${el("register").value}_${currentType}_${el("effectiveDate").value}.kccash`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),300)};
// --- Uebergabeprotokoll ------------------------------------------------------------------
// Die Kassette verlaesst abends das Haus. Das Protokoll haelt fest, wer sie mit welchem Inhalt
// gebracht und wer sie angenommen hat. Vollstaendig gebaut, aber ueber den Schalter
// KC_RUNTIME_FLAGS.uebergabeProtokoll abgeschaltet - erst beim Einschalten wird es sichtbar.
const protokollAktiv=()=>!!window.KC_RUNTIME_FLAGS?.uebergabeProtokoll;
function stueckelungsZeilen(daten){
  const zeilen=[];
  Object.keys(daten.looseBreakdown||{}).map(Number).sort((a,b)=>b-a).forEach(wert=>{
    const anzahl=daten.looseBreakdown[wert];
    if(anzahl>0)zeilen.push(`<tr><td>${denomLabel(wert)}</td><td>${anzahl} Stück</td><td>${money(anzahl*wert)}</td></tr>`);
  });
  Object.keys(daten.coinRolls||{}).map(Number).sort((a,b)=>b-a).forEach(wert=>{
    const rolle=daten.coinRolls[wert];
    if(rolle&&rolle.rolls>0)zeilen.push(`<tr><td>${denomLabel(wert)} – Rollen</td><td>${rolle.rolls} ${rolle.rolls===1?"Rolle":"Rollen"} (${rolle.coinCount} Münzen)</td><td>${money(rolle.total)}</td></tr>`);
  });
  return zeilen.join("")||`<tr><td colspan="3">—</td></tr>`;
}
// Inhalt des Protokoll-QR-Codes kommt aus dem gemeinsamen Modul shared/kc-uebergabeprotokoll.js
// - dieselbe Stelle, die der PC-Manager zum Lesen benutzt. Zwei eigene Fassungen wuerden
// auseinanderlaufen, und dann gilt ein gueltiger Beleg irgendwann als falsch.
function protokollNutzlast(payload,gesamt){
  const modul=global.KCUebergabeprotokoll;
  if(!modul)throw new Error("Protokoll-Modul nicht geladen");
  return modul.erzeugen(payload,gesamt);
}
function zeichneProtokoll(payload,gesamt){
  const blatt=el("protokollBlatt"),knopf=el("protokoll");
  if(!blatt||!knopf)return;
  if(!protokollAktiv()){blatt.hidden=true;knopf.hidden=true;return}
  knopf.hidden=false;
  const kassette=payload.scope==="split";
  const anteile=kassette&&letzteTeile?payload.registerIds.map(kasse=>`
      <h4>${kasse}</h4>
      <table class="protokoll-tabelle">${stueckelungsZeilen(letzteTeile[kasse])}
        <tr class="protokoll-summe"><td>Summe</td><td></td><td>${money(letzteTeile[kasse].total)}</td></tr></table>`).join(""):"";
  const beleg=payload.total>0?protokollNutzlast(payload,gesamt):null;
  blatt.innerHTML=`<div id="protokollInhalt">
    <div class="protokoll-kopf">
      <div>
        <h3>Übergabeprotokoll ${kassette?"Geldkassette":"Bargeld"}</h3>
        <p>Vorgang: ${payload.type==="opening"?"Anfangsbestand":payload.type==="topup"?"Nachfüllung":"Abendzählung"} &nbsp;·&nbsp; Gültig für: ${displayBusinessDate(payload.effectiveDate)}${kassette?"":` &nbsp;·&nbsp; Ziel: ${payload.registerId}`}</p>
      </div>
      <div class="protokoll-qr">
        <canvas id="protokollQrCanvas" width="230" height="230" aria-label="QR-Code mit dem vollständigen Protokollinhalt"></canvas>
        <small id="protokollQrText">—</small>
      </div>
    </div>
    <h4>Inhalt gesamt</h4>
    <table class="protokoll-tabelle">${stueckelungsZeilen(gesamt)}
      <tr class="protokoll-summe"><td>Gesamtbetrag</td><td></td><td>${money(payload.total)}</td></tr></table>
    ${anteile}
    ${payload.note?`<p>Notiz: ${payload.note}</p>`:""}
    <div class="protokoll-unterschriften">
      <div><span class="protokoll-linie"></span>Übergeben (Kassenwart), Datum</div>
      <div><span class="protokoll-linie"></span>Übernommen (Standteam), Datum</div>
    </div>
  </div>`;
  blatt.hidden=false;
  // QR erst nach dem Einhaengen zeichnen - vorher gibt es das Canvas noch nicht.
  const flaeche=el("protokollQrCanvas"),beschriftung=el("protokollQrText");
  if(flaeche&&beleg){
    try{
      drawQR(flaeche,beleg);
      const gelesen=global.KCUebergabeprotokoll.lesen(beleg);
      // Die Beleg-ID auch im Klartext, damit der Zettel ohne Scanner zuordenbar bleibt.
      beschriftung.textContent="Beleg "+gelesen.id.slice(0,8).toUpperCase();
      // Weg 1: den Beleg gleich an den Manager melden. Bewusst ohne await - laeuft der Dienst
      // nicht, bleibt der QR-Code auf dem Papier der Weg ins Archiv (Weg 2).
      global.KCUebergabeprotokoll.melden(gelesen,"money-butler");
    }catch(err){
      const stift=flaeche.getContext("2d");
      stift.fillStyle="#fff";stift.fillRect(0,0,flaeche.width,flaeche.height);
      stift.fillStyle="#b91c1c";stift.font="bold 13px system-ui";stift.textAlign="center";
      stift.fillText("QR-Code zu groß",flaeche.width/2,flaeche.height/2);
      beschriftung.textContent="—";
    }
  }
}
el("protokoll").onclick=()=>{
  if(!currentPayload)return alert("Zuerst QR-Code erzeugen.");
  document.body.classList.add("nur-protokoll");
  window.print();
  setTimeout(()=>document.body.classList.remove("nur-protokoll"),300);
};

pflegeKassettenAuswahl();
zeichneAufteilung();
zeichneProtokoll({scope:"register",type:"opening",effectiveDate:localBusinessDate(),registerId:"KASSE-01",total:0},{looseBreakdown:{},coinRolls:{}});
el("protokollBlatt").hidden=true;
updateTotal();


/* V0.21.5 – logische Tastaturreihenfolge */
window.addEventListener("DOMContentLoaded",()=>{let tab=1;document.querySelectorAll('input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),a[href]').forEach(node=>node.tabIndex=tab++);});

// --- Statistik ueber die Zeit ------------------------------------------------------------
// Zeigt dieselben Zahlen wie der PC-Manager (gemeinsames Modul), damit beide Stellen nicht
// auseinanderlaufen. Ohne Manager-Dienst greift der lokale Verlauf dieses Geraets.
(function(){
  const stat=global.KCBargeldStatistik;
  if(!stat||!document.getElementById('mbStatistik'))return;
  async function zeichneStatistik(){
    const {liste,quelle}=await stat.laden();
    const daten=stat.auswerten(liste,{
      typ:document.getElementById('mbStatTyp').value,
      von:document.getElementById('mbStatVon').value,
      bis:document.getElementById('mbStatBis').value,
    });
    stat.zeichne(document.getElementById('mbStatistik'),daten,quelle);
  }
  document.getElementById('mbStatAktualisieren').onclick=zeichneStatistik;
  ['mbStatTyp','mbStatVon','mbStatBis'].forEach(id=>document.getElementById(id).addEventListener('change',zeichneStatistik));
  // Beim Aufklappen einmal laden - vorher waere es unnoetige Arbeit.
  document.querySelector('[data-money-section="statistik"] .section-lock')
    ?.addEventListener('click',()=>setTimeout(zeichneStatistik,120));
})();

window.KCMoneyButlerAuth?.ready?.then(access=>{if(access)setTimeout(()=>pullCashMeasureSettings(),250)});
