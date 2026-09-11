(()=>{
  "use strict";
  const MAX=30;
  const entries=[];
  let cursor=-1;
  let display=null;
  let list=null;
  let dialog=null;
  let historyButton=null;
  let holdTimer=null;
  let held=false;
  const normalizeType=t=>t==="error"?"error":t==="warn"||t==="warning"?"warning":t==="info"?"info":"success";
  const formatTime=iso=>new Date(iso).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  function paint(entry, historical=false){
    if(!display||!entry)return;
    display.className=`notification-bar cart-notification ${normalizeType(entry.type)}${entry.richtung||entry.type==="error"?" buchung":""} visible${historical?" history-view":""}`;
    display.textContent=historical?`↶ ${formatTime(entry.at)} · ${entry.text}`:entry.text;
    display.setAttribute("role",entry.type==="error"?"alert":"status");
  }
  // 10.09.2026 (Betreiber: "nach jeder Buchung ein Fenster mit grünem Haken, bei Problem ein
  // rotes Stoppschild, dabei Pfeile nutzen - links für Einnahme, rechts für Ausgabe. Soll von
  // alleine weggehen nach kurzer Zeit oder wenn schon die nächste Buchung kommt, genau wie die
  // Meldungszeile es schon tut"): KEINE neue, eigene Anzeige gebaut - genau diese bestehende
  // Meldungszeile stattdessen erweitert (macht ohnehin schon alles Geforderte: wird von der
  // nächsten Meldung abgelöst, kein Tippen zum Wegklicken nötig). Haken/Stoppschild und Pfeil
  // werden DIREKT IN DEN TEXT eingebaut (nicht per CSS-Pseudoelement) - das fällt sonst zu
  // leicht später an anderer Stelle nachgetragenen CSS-Regeln zum Opfer (heute Nacht gleich
  // zweimal genau so passiert). richtung: "ein" (Geld kommt in die Kasse) -> Pfeil nach links;
  // "aus" (Geld geht raus, z.B. Trinkgeld, Pfand-Rückgabe) -> Pfeil nach rechts - dieselbe
  // Richtung wie die bestehenden Laufpfeile auf der Zahlen-Seite. Ohne richtung (reine Fehler-
  // /Infomeldung): unverändert wie bisher, kein Symbol vorangestellt.
  function add(text,type="ok",richtung=null){
    const value=String(text||"").trim(); if(!value)return null;
    const normType=normalizeType(type);
    // Stoppschild bei JEDEM Fehler, unabhängig von einer Richtung ("bei Problem ein rotes
    // Stoppschild" - nicht nur, wenn zusätzlich eine Richtung angegeben wurde). Haken +
    // Pfeil nur bei einer echten, erfolgreichen Buchung mit bekannter Richtung.
    const symbol=normType==="error"?"🛑 ":richtung?"✓ "+(richtung==="ein"?"◀":richtung==="aus"?"▶":"")+" ":"";
    const entry={text:symbol+value,type:normType,richtung,at:new Date().toISOString()};
    entries.push(entry); if(entries.length>MAX)entries.splice(0,entries.length-MAX);
    cursor=entries.length;
    paint(entry,false); return entry;
  }
  function previous(){
    if(!entries.length)return null;
    cursor = cursor<=0 ? entries.length-1 : cursor-1;
    const entry=entries[cursor]; paint(entry,true); return entry;
  }
  function renderList(){
    if(!list)return;
    list.innerHTML=[...entries].reverse().map(e=>`<li class="${e.type}"><time>${formatTime(e.at)}</time><span>${escapeHtml(e.text)}</span></li>`).join("")||'<li class="empty"><span>Noch keine Meldungen gespeichert.</span></li>';
  }
  function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function openList(){renderList(); if(dialog&&!dialog.open)dialog.showModal();}
  function init(opts={}){
    display=document.getElementById(opts.displayId||"notificationBar");
    list=document.getElementById(opts.listId||"messageHistoryList");
    dialog=document.getElementById(opts.dialogId||"messageHistoryDialog");
    historyButton=document.getElementById(opts.buttonId||"messageHistoryBtn");
    if(historyButton){
      const start=()=>{held=false;clearTimeout(holdTimer);holdTimer=setTimeout(()=>{held=true;openList()},650)};
      const cancel=()=>clearTimeout(holdTimer);
      historyButton.addEventListener("pointerdown",start);
      ["pointerup","pointercancel","pointerleave"].forEach(ev=>historyButton.addEventListener(ev,cancel));
      historyButton.addEventListener("click",e=>{if(held){e.preventDefault();held=false;return}previous()});
      historyButton.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();previous()}});
    }
    return api;
  }
  const api={version:"1.1.0",init,add,previous,openList,entries:()=>entries.map(x=>({...x})),clear:()=>{entries.length=0;cursor=-1;renderList()}};
  window.KCMessageCore=api;
})();
