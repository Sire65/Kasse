/* KC MarktKasse – read-only Updateprüfung gegen GitHub main.
   Prüft ausschließlich Programmstand; keine Nutzdaten-, LocalStorage- oder Supabase-Schreibzugriffe. */
(function(global){
  'use strict';
  const VERSION='1.0.0';
  const REMOTE='https://raw.githubusercontent.com/Sire65/Kasse/main/latest-release-manifest.json';
  const INTERVAL=15*60*1000;
  let checking=false,last=null;

  function localManifest(){return global.KC_CENTRAL_RELEASE_MANIFEST||global.KCReleaseManifest?.state?.manifest||null}
  function localBuild(){return Number(localManifest()?.update?.buildId||0)}
  async function remoteManifest(){
    const r=await fetch(REMOTE+'?kc_update='+Date.now(),{cache:'no-store',headers:{Accept:'application/json'}});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const m=await r.json();
    if(m?.product!=='KC MarktKasse'||!Number(m?.update?.buildId))throw new Error('Ungültiges KC-MarktKasse-Update-Manifest');
    return m;
  }
  function notice(m){
    let box=document.getElementById('kcProgramUpdateNotice');
    if(!box){box=document.createElement('aside');box.id='kcProgramUpdateNotice';box.style.cssText='position:fixed;right:18px;bottom:18px;z-index:10000;max-width:430px;padding:14px 16px;border:1px solid #b88722;border-radius:10px;background:#fff8e7;color:#222;box-shadow:0 8px 30px #0003;font:14px Segoe UI,Arial,sans-serif';document.body.appendChild(box)}
    box.innerHTML='<strong>KC MarktKasse: Update verfügbar</strong><div style="margin-top:5px">Installiert: Build '+localBuild()+' · verfügbar: Build '+Number(m.update.buildId)+'</div><div style="margin-top:4px">Die Prüfung verändert keine Kassen-, Rezept- oder Supabase-Daten.</div><div style="margin-top:10px;display:flex;gap:8px"><button type="button" data-kc-update-reload>Nach Aktualisierung neu laden</button><button type="button" data-kc-update-later>Später</button></div>';
    box.querySelector('[data-kc-update-reload]').onclick=()=>location.reload();
    box.querySelector('[data-kc-update-later]').onclick=()=>box.remove();
  }
  async function check({silent=true}={}){
    if(checking)return last;checking=true;
    try{
      const m=await remoteManifest(),available=Number(m.update.buildId)>localBuild();
      last={ok:true,available,localBuild:localBuild(),remoteBuild:Number(m.update.buildId),manifest:m,checkedAt:new Date().toISOString()};
      if(available)notice(m);
      else if(!silent)global.KCManagerMessages?.success?.('KC MarktKasse ist auf dem aktuellen GitHub-Programmstand.');
      return last;
    }catch(error){
      last={ok:false,available:false,error:error.message,checkedAt:new Date().toISOString()};
      if(!silent)global.KCManagerMessages?.warning?.('Updateprüfung derzeit nicht möglich: '+error.message);
      return last;
    }finally{checking=false}
  }
  function bind(){
    const line=document.getElementById('managerVersionLine');
    if(line){line.style.cursor='pointer';line.title=(line.title?line.title+'\n':'')+'Klicken: Programmupdate prüfen';line.addEventListener('click',()=>check({silent:false}))}
    setTimeout(()=>check({silent:true}),1200);
    setInterval(()=>check({silent:true}),INTERVAL);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  global.KCProgramUpdater={VERSION,check,state:()=>last};
})(window);
