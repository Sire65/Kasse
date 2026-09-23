(function(global){
  "use strict";
  const VERSION="0.1.0",escape=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  let state=null;
  function ensure(){
    let dialog=document.getElementById("kcImportProgressDialog");if(dialog)return dialog;
    dialog=document.createElement("dialog");dialog.id="kcImportProgressDialog";dialog.className="kc-import-progress-dialog";
    dialog.innerHTML='<section><header><div><h2>Umsatzdaten werden importiert</h2><p id="kcImportProgressFile">Vorbereitung</p></div><strong id="kcImportProgressPercent">0 %</strong></header><progress id="kcImportProgressBar" max="100" value="0"></progress><div class="kc-import-progress-times"><span id="kcImportElapsed">Vergangen: 0 Sek.</span><span id="kcImportRemaining">Restzeit wird ermittelt</span></div><ol id="kcImportProgressSteps"></ol><div id="kcImportProgressSummary"></div><footer><button id="kcImportProgressClose" type="button" disabled>Fenster schließen</button></footer></section>';
    document.body.append(dialog);dialog.querySelector("#kcImportProgressClose").onclick=()=>dialog.close();return dialog;
  }
  function format(ms){const seconds=Math.max(0,Math.round(ms/1000));return seconds<60?`${seconds} Sek.`:`${Math.floor(seconds/60)} Min. ${seconds%60} Sek.`}
  function render(){
    if(!state)return;const dialog=ensure(),elapsed=Date.now()-state.startedAt,pct=Math.max(0,Math.min(100,state.percent));
    dialog.querySelector("#kcImportProgressPercent").textContent=`${Math.round(pct)} %`;dialog.querySelector("#kcImportProgressBar").value=pct;
    dialog.querySelector("#kcImportProgressFile").textContent=state.file;dialog.querySelector("#kcImportElapsed").textContent=`Vergangen: ${format(elapsed)}`;
    const total=pct>=3?elapsed/(pct/100):0;dialog.querySelector("#kcImportRemaining").textContent=pct>=100?`Gesamtdauer: ${format(elapsed)}`:total?`Voraussichtliche Restzeit: ${format(total-elapsed)}`:"Restzeit wird ermittelt";
    dialog.querySelector("#kcImportProgressSteps").innerHTML=state.steps.map(step=>`<li class="${step.status}"><i>${step.status==="done"?"✓":step.status==="active"?"●":"○"}</i><span>${escape(step.label)}</span>${step.detail?`<small>${escape(step.detail)}</small>`:""}</li>`).join("");
    dialog.querySelector("#kcImportProgressSummary").innerHTML=state.summary?`<div class="kc-import-progress-result ${state.error?"error":"success"}">${escape(state.summary)}</div>`:"";
  }
  function start({files=1,file="Import wird vorbereitet",steps=[]}={}){
    const dialog=ensure();state={startedAt:Date.now(),percent:0,file,files,steps:steps.map(label=>({label,status:"pending",detail:""})),summary:"",error:false};
    dialog.querySelector("#kcImportProgressClose").disabled=true;if(!dialog.open)dialog.showModal();clearInterval(dialog._kcTimer);dialog._kcTimer=setInterval(render,250);render();return api;
  }
  function update({percent,file,step,detail}={}){
    if(!state)return;if(Number.isFinite(percent))state.percent=percent;if(file)state.file=file;
    if(Number.isInteger(step)){state.steps.forEach((item,index)=>item.status=index<step?"done":index===step?"active":"pending");if(detail!==undefined)state.steps[step].detail=detail||""}render();
  }
  function finish(summary){if(!state)return;state.percent=100;state.steps.forEach(item=>item.status="done");state.summary=summary||"Import abgeschlossen.";clearInterval(ensure()._kcTimer);ensure().querySelector("#kcImportProgressClose").disabled=false;render()}
  function fail(message){if(!state)return;state.error=true;state.summary=message||"Import fehlgeschlagen.";clearInterval(ensure()._kcTimer);ensure().querySelector("#kcImportProgressClose").disabled=false;render()}
  const api={VERSION,start,update,finish,fail};global.KCManagerImportProgress=api;global.KCReleaseManifest?.register?.("managerImportProgress",VERSION);
})(window);
