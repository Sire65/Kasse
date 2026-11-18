(function () {
 'use strict';
 let busy = false;
 async function refresh() {
  const panel = document.querySelector('[data-view-panel="timeclock"]');
  if (!panel || busy) return;
  let status = document.getElementById('tcCloudStatus');
  if (!status) {
   status = document.createElement('p'); status.id='tcCloudStatus'; status.setAttribute('role','status');
   panel.querySelector('.page-head')?.after(status);
  }
  let retry=document.getElementById('tcCloudRetry');
  if(!retry){retry=document.createElement('button');retry.id='tcCloudRetry';retry.type='button';retry.textContent='Jetzt prüfen';retry.style.minHeight='44px';retry.onclick=refresh;status.after(retry);}
  busy = true;retry.disabled=true;
  status.textContent='Buchungen werden abgeglichen …';
  try {
   const sb=window.KCSupabase;
   const token=sb?.holeZugriffsToken?.();
   const signed=!!token && !!sb?.konfig?.publishableKey;
   const response = await fetch('http://127.0.0.1:47392/zeiterfassung/'+(signed?'cloud-senden':'cloud-status'), signed ? {
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({publishableKey:sb.konfig.publishableKey}),signal:AbortSignal.timeout(60000),cache:'no-store'
   } : {signal:AbortSignal.timeout(5000),cache:'no-store'});
   const data = await response.json();
   if (!response.ok && !Number.isInteger(data.pending))throw Error('Zentraler Abgleich derzeit nicht bestätigt.');
   if (!Number.isInteger(data.pending)) throw Error('Status fehlt');
   status.textContent = data.pending ? data.pending+' Buchung(en) lokal gesichert. Zentrale Übertragung steht noch aus.' : 'Alle hier gespeicherten Buchungen sind zentral bestätigt.';
   if (data.error) status.textContent = (data.pending ? data.pending+' Buchung(en) lokal gesichert. ' : '')+data.error;
   if(!signed&&data.pending)status.textContent += ' Bitte oben rechts bei Supabase anmelden.';
   status.className = data.pending || data.error ? 'tc-pos-message warn' : 'tc-pos-message';
  } catch (_) {
   status.textContent='Zentrale Übertragung derzeit nicht prüfbar. Bitte Manager-Dienst, Verbindung und Supabase-Anmeldung prüfen.';
   status.className='tc-pos-message warn';
  } finally { busy=false;retry.disabled=false; }
 }
 document.addEventListener('click', e=>{if(e.target.closest('[data-view="timeclock"]'))setTimeout(refresh,100)});
 setInterval(refresh,30000);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();
 window.KCTimeClockCloudStatus={refresh};
})();
