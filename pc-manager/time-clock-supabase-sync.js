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
 // KC-KASSE-SPARSAM (18.11.2026): der volle Abgleich (Supabase) nur, wenn die Zeiterfassung offen
 // und das Fenster sichtbar ist oder Buchungen offen sind; sonst höchstens alle 5 Minuten
 // (gemeinsamer Anmeldestand). Die Nachfrage „offen?“ geht nur an den Manager-Dienst auf diesem PC.
 let zuletztVoll=0,zuletztOffen=0;
 function sichtbar(){const p=document.querySelector('[data-view-panel="timeclock"]');return !!p&&!document.hidden&&(p.classList.contains('active')||(!p.hidden&&p.offsetParent!==null));}
 async function takt(){
  if(sichtbar()||Date.now()-zuletztVoll>=300000){zuletztVoll=Date.now();return refresh();}
  try{
   const r=await fetch('http://127.0.0.1:47392/zeiterfassung/cloud-status',{signal:AbortSignal.timeout(5000),cache:'no-store'});
   const d=r.ok?await r.json():null;
   // offene Buchungen: sofort senden, wenn neue dazukamen; bleiben sie hängen (z. B. Mitgliedsnummer fehlt), alle 2 Minuten
   if(d&&Number.isInteger(d.pending)&&d.pending>0&&(d.pending!==zuletztOffen||Date.now()-zuletztVoll>=120000)){zuletztOffen=d.pending;zuletztVoll=Date.now();return refresh();}
   if(d&&Number.isInteger(d.pending))zuletztOffen=d.pending;
  }catch(_){/* Manager-Dienst nicht erreichbar: nächster Takt */}
 }
 setInterval(takt,30000);
 const ersteRunde=()=>{zuletztVoll=Date.now();refresh();};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ersteRunde,{once:true});else ersteRunde();
 window.KCTimeClockCloudStatus={refresh};
})();
