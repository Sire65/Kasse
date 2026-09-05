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
    display.className=`notification-bar cart-notification ${normalizeType(entry.type)} visible${historical?" history-view":""}`;
    display.textContent=historical?`↶ ${formatTime(entry.at)} · ${entry.text}`:entry.text;
    display.setAttribute("role",entry.type==="error"?"alert":"status");
  }
  function add(text,type="ok"){
    const value=String(text||"").trim(); if(!value)return null;
    const entry={text:value,type:normalizeType(type),at:new Date().toISOString()};
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
