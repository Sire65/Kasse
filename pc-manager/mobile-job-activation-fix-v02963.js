(function (global) {
  'use strict';
  const VERSION='0.29.63',$=id=>document.getElementById(id);
  const code=()=>String(Math.floor(100000+Math.random()*900000));
  async function createJob() {
    const builder=$('tvJobBuilder')?.value.trim();
    if(!builder)return alert('Bitte Erbauer oder Empfängerkennung eintragen.');
    const mode=$('tvMobileContentMode')?.value||'empty',view=mode==='current';
    const job={schema:'kc-mobile-tv-job-v1',jobId:`KCTV-JOB-${Date.now()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`,assignmentId:tvUuid(),name:$('tvJobName').value.trim(),event:$('tvJobEvent').value.trim(),builder,creatorId:(settings?.owner||'KC-Manager'),createdAt:new Date().toISOString(),expiresAt:$('tvJobExpiry').value||'',maxReturns:+$('tvJobReturns').value||3,returnCount:0,status:'open',contentMode:mode,permissions:{editor:!view,templates:!view,decorations:!view,articles:view?'none':'placeholders',manager:false,pos:false,moneyButler:false},basePresentation:{profile:structuredClone(tvPresentation.profile),design:structuredClone(tvPresentation.design),weather:structuredClone(tvPresentation.weather),slides:view?structuredClone(tvPresentation.slides):[]},articlePlaceholders:!view&&$('tvJobPlaceholders').checked?articles.filter(a=>a.active!==false).slice(0,100).map(a=>({token:`{{ARTICLE_${String(a.id).replace(/\W/g,'_')}}}`,id:a.id,name:a.name,priceToken:`{{PRICE_${String(a.id).replace(/\W/g,'_')}}}`})):[]};
    job.activationCode=code();
    job.checksum=await tvSha256(tvStable(job));
    tvMobileJobs.push(job);
    localStorage.setItem(TV_JOB_KEY,JSON.stringify(tvMobileJobs));
    tvDownload(`${job.jobId}.kctva`,job);
    $('tvJobResult').innerHTML=`<strong>Auftrag erstellt:</strong> ${tvEsc(job.jobId)}<br>Modus: <b>${view?'Aktuelle Präsentation · nur beobachten':'Leer · bearbeiten'}</b><br>Aktivierungscode: <b>${tvEsc(job.activationCode)}</b><br><small>Datei und Code gehören immer zusammen.</small>`;
    renderTvJobs(); enhanceList();
  }
  function enhanceList() {
    const list=$('tvJobList');
    if(!list||typeof tvMobileJobs==='undefined')return;
    [...list.querySelectorAll('.tv-job')].forEach((row,index)=>{
      const job=tvMobileJobs[index];
      if(!job||row.querySelector('.kc-job-code'))return;
      const badge=document.createElement('span');
      badge.className='kc-job-code';
      badge.textContent=`Aktivierungscode: ${job.activationCode}`;
      badge.title='Dieser Code gehört ausschließlich zu der angezeigten Auftragsdatei.';
      row.append(badge);
    });
  }
  function install(){const button=$('tvCreateJob');if(button)button.onclick=createJob;const list=$('tvJobList');if(list)new MutationObserver(enhanceList).observe(list,{childList:true,subtree:true});enhanceList()}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',()=>setTimeout(install,700)):setTimeout(install,700);
  global.KCMobileJobActivationFix={version:VERSION,createJob};
  global.KCReleaseManifest?.register?.('mobileJobActivationFix',VERSION);
})(window);
