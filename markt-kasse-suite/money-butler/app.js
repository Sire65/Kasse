const DENOMS=[100,50,20,10,5,2,1,.5,.2,.1,.05,.02,.01];
const COIN_ROLLS=[
  {value:2,coins:25},{value:1,coins:25},
  {value:.5,coins:40},{value:.2,coins:40},{value:.1,coins:40},
  {value:.05,coins:50},{value:.02,coins:50},{value:.01,coins:50}
];
let currentType="opening",currentPayload="";
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
el("effectiveDate").min=localBusinessDate();
el("denoms").innerHTML=DENOMS.map(v=>`<label class="denom"${v>=5?` data-schein="${v}"`:""}><strong>${v>=1?v+" €":Math.round(v*100)+" ct"}</strong><input type="number" min="0" step="1" value="0" data-value="${v}"></label>`).join("");
el("coinRolls").innerHTML=COIN_ROLLS.map(r=>`<label class="coin-roll-row" data-rolle="${r.value}">
  <strong>${denomLabel(r.value)}</strong>
  <span class="roll-input"><input type="number" min="0" step="1" value="0" inputmode="numeric" data-roll-value="${r.value}" data-roll-coins="${r.coins}" aria-label="Anzahl Rollen ${denomLabel(r.value)}"><small>Rollen</small></span>
  <span>${r.coins} Münzen</span>
  <span>${money(r.value*r.coins)}</span>
  <b data-roll-total="${r.value}">${money(0)}</b>
</label>`).join("");
function clearTransferOutput(){
  currentPayload="";el("payload").value="";el("handoverType").textContent="—";el("handoverRegister").textContent="—";el("handoverDate").textContent="—";
  const ctx=el("qrCanvas").getContext("2d");ctx.clearRect(0,0,el("qrCanvas").width,el("qrCanvas").height);
}
function setDatePurpose(){el("effectiveDateLabel").textContent=currentType==="count"?"Zähltag *":"Gültig für *"}
document.querySelectorAll(".choice").forEach(b=>b.onclick=()=>{document.querySelectorAll(".choice").forEach(x=>x.classList.toggle("active",x===b));currentType=b.dataset.type;setDatePurpose();clearTransferOutput()});
document.querySelectorAll("[data-value],[data-roll-value]").forEach(n=>n.oninput=()=>{updateTotal();clearTransferOutput()});
["register","effectiveDate","note"].forEach(id=>el(id).addEventListener("input",clearTransferOutput));
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
function drawQR(canvas,text){if(typeof qrcode!=="function")throw new Error("QR-Modul konnte nicht geladen werden.");const qr=qrcode(0,"M");qr.addData(text);qr.make();const ctx=canvas.getContext("2d"),modules=qr.getModuleCount(),quiet=4,cell=canvas.width/(modules+quiet*2);ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#000";for(let row=0;row<modules;row++)for(let col=0;col<modules;col++)if(qr.isDark(row,col))ctx.fillRect(Math.floor((col+quiet)*cell),Math.floor((row+quiet)*cell),Math.ceil(cell),Math.ceil(cell))}
el("generate").onclick=()=>{const c=getData(),effectiveDate=el("effectiveDate").value;if(!isBusinessDate(effectiveDate))return alert("Bitte das gültige Einsatzdatum im Kalender auswählen.");if(effectiveDate<localBusinessDate())return alert("Das Einsatzdatum darf nicht in der Vergangenheit liegen.");if(c.total<=0)return alert("Bitte mindestens eine Stückelung eingeben.");const payload={
  format:currentType==="count"?"KC_CASH_COUNT":"KC_CASH_TRANSFER",
  version:currentType==="count"?3:4,
  transferId:crypto.randomUUID(),
  countId:currentType==="count"?crypto.randomUUID():undefined,
  registerId:el("register").value,
  type:currentType,
  time:new Date().toISOString(),
  effectiveDate,
  breakdown:c.breakdown,
  looseBreakdown:c.looseBreakdown,
  coinRolls:c.coinRolls,
  looseTotal:c.looseTotal,
  rollTotal:c.rollTotal,
  total:c.total,
  note:el("note").value.trim()
};const raw=JSON.stringify(payload);payload.checksum=checksum(raw);currentPayload=(currentType==="count"?"KCOUNT1:":"KCASH1:")+btoa(unescape(encodeURIComponent(JSON.stringify(payload))));el("payload").value=currentPayload;el("handoverType").textContent=currentType==="opening"?"Anfangsbestand":currentType==="topup"?"Nachfüllung":"Abendzählung";el("handoverRegister").textContent=el("register").selectedOptions[0]?.textContent||el("register").value;el("handoverDate").textContent=displayBusinessDate(effectiveDate);drawQR(el("qrCanvas"),currentPayload);setMoneySection(document.querySelector('[data-money-section="handover"]'),true);
  const kurzcodeFeld=el("kurzcode");
  if(kurzcodeFeld){
    if(currentType==="count"){kurzcodeFeld.textContent="Für die Abendzählung nicht verfügbar - bitte den vollständigen Code verwenden."}
    else{
      const typZiffer=currentType==="opening"?"1":"2";
      const kasseZiffer=el("register").value==="KASSE-01"?"1":el("register").value==="KASSE-02"?"2":"9";
      const betragCent=String(Math.round(c.total*100)).padStart(6,"0");
      if(betragCent.length>6){kurzcodeFeld.textContent="Betrag zu hoch für den Kurzcode (über 9.999,99 Euro) - bitte den vollständigen Code verwenden."}
      else{
        const ziffern=typZiffer+kasseZiffer+betragCent;
        let quersumme=0;for(let i=0;i<ziffern.length;i++)quersumme+=Number(ziffern[i])*(i+2);
        const pruefziffer=quersumme%10;
        kurzcodeFeld.textContent=`${typZiffer}-${kasseZiffer}-${betragCent}-${pruefziffer}`;
      }
    }
  }
};
el("reset").onclick=()=>{document.querySelectorAll("[data-value],[data-roll-value]").forEach(n=>n.value=0);el("effectiveDate").value="";el("note").value="";updateTotal();clearTransferOutput()};
el("print").onclick=()=>{if(!currentPayload)return alert("Zuerst QR-Code erzeugen.");window.print()};
el("copy").onclick=async()=>{if(!currentPayload)return alert("Zuerst QR-Code erzeugen.");await navigator.clipboard.writeText(currentPayload);alert("Code kopiert.")};
el("save").onclick=()=>{if(!currentPayload)return alert("Zuerst QR-Code erzeugen.");const blob=new Blob([currentPayload],{type:"text/plain"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${el("register").value}_${currentType}_${el("effectiveDate").value}.kccash`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),300)};
updateTotal();


/* V0.21.5 – logische Tastaturreihenfolge */
window.addEventListener("DOMContentLoaded",()=>{let tab=1;document.querySelectorAll('input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),a[href]').forEach(node=>node.tabIndex=tab++)});
