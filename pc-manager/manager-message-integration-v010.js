(function(global){
'use strict';
const VERSION='0.2.0',history=[];let bar,timer,lastType='',lastAt=0;
function show(message,type='success',duration){
 if(!message)return;clearTimeout(timer);lastType=type;lastAt=Date.now();
 history.push({message:String(message),type,at:new Date().toISOString()});if(history.length>50)history.shift();
 if(!bar){bar=document.createElement('div');bar.className='kc-manager-message';bar.setAttribute('aria-live','polite');document.body?.append(bar)}
 bar.className=`kc-manager-message ${type} visible`;bar.innerHTML=`<span aria-hidden="true">${type==='success'?'✓':type==='error'?'✕':type==='warning'?'⚠':'ℹ'}</span><strong>${String(message).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</strong>`;bar.setAttribute('role',type==='error'?'alert':'status');
 const ms=duration??(type==='error'?0:type==='warning'?6000:4200);if(ms)timer=setTimeout(()=>bar.classList.remove('visible'),ms);
}
function ask(message){return global.confirm(message)}
function describe(button){const cmd=button.dataset.cmd||'',text=(button.textContent||'').trim();if(cmd==='save'||/speichern/i.test(text))return['Änderungen wurden erfolgreich gespeichert.','success'];if(cmd==='delete'||/löschen/i.test(text))return['Eintrag wurde gelöscht.','success'];if(cmd==='new'||/neu(e|er|es)?\b/i.test(text))return['Neuer Eintrag wurde angelegt.','info'];if(/export|paket|übernehmen/i.test(text))return['Aktion wurde ausgeführt.','success'];return null}
function init(){
 if(!bar){bar=document.createElement('div');bar.className='kc-manager-message';bar.setAttribute('aria-live','polite');document.body.append(bar)}
 const nativeAlert=global.alert.bind(global);global.alert=message=>show(message,/fehler|ungültig|nicht|erforderlich|bitte/i.test(String(message))?'warning':'success');global.KCNativeAlert=nativeAlert;
 document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;const started=Date.now(),cmd=button.dataset.cmd||'',text=(button.textContent||'').trim();
  if((cmd==='delete'||/löschen/i.test(text))&&!button.dataset.confirmed&&!button.dataset.confirmHandler){if(!ask(`${text||'Eintrag'} wirklich ausführen?`)){event.preventDefault();event.stopImmediatePropagation();return}button.dataset.confirmed='1';queueMicrotask(()=>delete button.dataset.confirmed)}
  const result=describe(button);if(result)setTimeout(()=>{if(lastAt<started||!['warning','error'].includes(lastType))show(...result)},40);
 },true);
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
global.KCManagerMessages={version:VERSION,show,success:m=>show(m,'success'),info:m=>show(m,'info'),warning:m=>show(m,'warning'),error:m=>show(m,'error'),ask,history:()=>history.map(x=>({...x}))};
global.KCReleaseManifest?.register?.('managerMessageCore',VERSION);
})(window);
