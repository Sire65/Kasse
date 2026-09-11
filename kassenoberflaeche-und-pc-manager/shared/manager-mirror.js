(()=>{
  'use strict';

  const SUPABASE_URL='https://ptblnpiroqftcvlsrhac.supabase.co';
  const SUPABASE_KEY='sb_publishable_SqXIeGN-clcZ4gjmpLdSww_4DLfyy24';
  const SESSION_KEY='kc_manager_mirror_session_v1';
  const POLL_MS=1200;
  let pollTimer=null;
  let dialog=null;

  const $=(id)=>document.getElementById(id);
  const fmtBytes=(n)=>{const v=Number(n||0);if(v<1024)return `${v} B`;if(v<1048576)return `${(v/1024).toFixed(1)} KB`;return `${(v/1048576).toFixed(2)} MB`;};
  const fmtSpeed=(kb)=>{const v=Number(kb||0);return v>=1024?`${(v/1024).toFixed(2)} MB/s`:`${v.toFixed(v<10?2:1)} KB/s`;};
  const safeText=(v)=>String(v??'');

  function loadSession(){try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
  function saveSession(s){sessionStorage.setItem(SESSION_KEY,JSON.stringify(s));}
  function clearSession(){sessionStorage.removeItem(SESSION_KEY);}

  function injectCss(){
    if(document.querySelector('link[data-kc-mirror-css]'))return;
    const link=document.createElement('link');link.rel='stylesheet';link.href='shared/manager-mirror.css';link.dataset.kcMirrorCss='1';document.head.appendChild(link);
  }

  function buildDialog(){
    if($('mirrorManagerDialog'))return $('mirrorManagerDialog');
    const node=document.createElement('dialog');
    node.id='mirrorManagerDialog';
    node.className='mirror-manager-dialog';
    node.innerHTML=`<form method="dialog" class="mirror-manager-card">
      <div class="mirror-head">
        <div><span class="info-kicker">MANAGER · DATENBANK-MONITOR</span><h2>Datenbanken & Spiegelung</h2><p>Live-Überwachung der automatischen Supabase → Neon Spiegelung.</p></div>
        <button value="close" class="icon-close" aria-label="Schließen">×</button>
      </div>

      <section id="mirrorLoginPanel" class="mirror-login-panel" hidden>
        <h3>Cloud-Admin anmelden</h3>
        <p>Für Live-Daten ist zusätzlich die Supabase-Admin-Anmeldung erforderlich. Das Passwort wird nicht gespeichert.</p>
        <div class="mirror-login-grid"><label>E-Mail<input id="mirrorAdminEmail" type="email" autocomplete="username" placeholder="Admin-E-Mail"></label><label>Passwort<input id="mirrorAdminPassword" type="password" autocomplete="current-password" placeholder="Passwort"></label></div>
        <div class="mirror-actions"><button id="mirrorLoginBtn" type="button" class="primary-action">Cloud-Monitor verbinden</button><span id="mirrorLoginError" class="mirror-error"></span></div>
      </section>

      <section id="mirrorLivePanel" hidden>
        <div class="mirror-toolbar"><div><span id="mirrorOverallLed" class="mirror-led gray"></span><strong id="mirrorOverallText">Status wird geladen …</strong></div><div class="mirror-actions"><button id="mirrorRefreshBtn" type="button">↻ Aktualisieren</button><button id="mirrorLogoutBtn" type="button">Cloud-Sitzung trennen</button></div></div>

        <div class="mirror-route" id="mirrorRoute">
          <article class="mirror-db-card source"><span class="mirror-db-icon">DB</span><div><small>QUELLE</small><h3>Supabase</h3><p>KC Core / Manager</p><b id="mirrorSourceState">Bereit</b></div></article>
          <div class="mirror-link-wrap">
            <div id="mirrorLink" class="mirror-link gray"><span class="mirror-particle p1"></span><span class="mirror-particle p2"></span><span class="mirror-particle p3"></span></div>
            <div class="mirror-speed"><strong id="mirrorCurrentSpeed">0 KB/s</strong><span id="mirrorAverageSpeed">Ø 0 KB/s</span></div>
            <div class="mirror-progress"><div><span id="mirrorProgressBar"></span></div><small id="mirrorProgressText">Warte auf nächsten Lauf</small></div>
          </div>
          <article class="mirror-db-card target"><span class="mirror-db-icon">DB</span><div><small>ZIEL / SPIEGEL</small><h3>Neon</h3><p>Production Mirror</p><b id="mirrorTargetState">Bereit</b></div></article>
        </div>

        <div class="mirror-metrics">
          <article><small>Aktuelle Tabelle</small><strong id="mirrorCurrentTable">–</strong></article>
          <article><small>Tabellenfortschritt</small><strong id="mirrorTableProgress">–</strong></article>
          <article><small>Datenmenge</small><strong id="mirrorPayload">0 B</strong></article>
          <article><small>Letzter Lauf</small><strong id="mirrorLastRun">–</strong></article>
          <article><small>Watchdog</small><strong id="mirrorWatchdog">–</strong></article>
          <article><small>Spiegelumfang</small><strong id="mirrorTableCount">–</strong></article>
        </div>

        <div class="mirror-legend" aria-label="Ampellegende"><span><i class="blue"></i> Daten fließen</span><span><i class="green"></i> Alles OK</span><span><i class="yellow"></i> Langsam / auffällig</span><span><i class="red"></i> Fehler</span></div>

        <section class="mirror-history"><div class="mirror-section-head"><h3>Letzte Übertragungen</h3><span id="mirrorGeneratedAt"></span></div><div id="mirrorHistoryRows" class="mirror-history-rows"></div></section>
      </section>
    </form>`;
    document.body.appendChild(node);
    node.addEventListener('close',stopPolling);
    $('mirrorLoginBtn').addEventListener('click',login);
    $('mirrorRefreshBtn').addEventListener('click',refreshDashboard);
    $('mirrorLogoutBtn').addEventListener('click',()=>{clearSession();stopPolling();showLogin();});
    return node;
  }

  function installButton(){
    const grid=document.querySelector('#adminHomeDialog .admin-home-grid');
    if(!grid||$('mirrorManagerOpen'))return;
    const btn=document.createElement('button');
    btn.type='button';btn.id='mirrorManagerOpen';btn.className='mirror-manager-open';
    btn.innerHTML='<span class="mirror-tile-icon">⇄</span><span>Datenbanken & Spiegelung</span>';
    btn.addEventListener('click',openManager);
    grid.appendChild(btn);
  }

  async function authRequest(email,password){
    const res=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({email,password})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.access_token)throw new Error(data?.error_description||data?.msg||'Anmeldung nicht möglich');
    return {access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||3600),email};
  }

  async function refreshSession(s){
    if(!s?.refresh_token)return null;
    const res=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({refresh_token:s.refresh_token})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.access_token)return null;
    const next={...s,access_token:data.access_token,refresh_token:data.refresh_token||s.refresh_token,expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||3600)};saveSession(next);return next;
  }

  async function validSession(){
    let s=loadSession();if(!s)return null;
    if(Number(s.expires_at||0)<Math.floor(Date.now()/1000)+60)s=await refreshSession(s);
    return s;
  }

  async function login(){
    const email=$('mirrorAdminEmail').value.trim(),password=$('mirrorAdminPassword').value;
    $('mirrorLoginError').textContent='';
    if(!email||!password){$('mirrorLoginError').textContent='E-Mail und Passwort eingeben.';return;}
    $('mirrorLoginBtn').disabled=true;$('mirrorLoginBtn').textContent='Verbindung wird geprüft …';
    try{const s=await authRequest(email,password);saveSession(s);$('mirrorAdminPassword').value='';showLive();await refreshDashboard();startPolling();}
    catch(e){$('mirrorLoginError').textContent=e instanceof Error?e.message:String(e);}
    finally{$('mirrorLoginBtn').disabled=false;$('mirrorLoginBtn').textContent='Cloud-Monitor verbinden';}
  }

  function showLogin(){if(!dialog)return;$('mirrorLoginPanel').hidden=false;$('mirrorLivePanel').hidden=true;}
  function showLive(){if(!dialog)return;$('mirrorLoginPanel').hidden=true;$('mirrorLivePanel').hidden=false;}

  async function openManager(){
    injectCss();dialog=buildDialog();dialog.showModal();
    const s=await validSession();if(!s){showLogin();return;}showLive();await refreshDashboard();startPolling();
  }

  function startPolling(){stopPolling();pollTimer=setInterval(refreshDashboard,POLL_MS);}
  function stopPolling(){if(pollTimer){clearInterval(pollTimer);pollTimer=null;}}

  async function fetchDashboard(){
    const s=await validSession();if(!s)throw new Error('SESSION_EXPIRED');
    const res=await fetch(`${SUPABASE_URL}/functions/v1/kc-db-mirror-control?action=dashboard`,{headers:{'Authorization':`Bearer ${s.access_token}`,'apikey':SUPABASE_KEY}});
    const data=await res.json().catch(()=>({}));
    if(res.status===401||res.status===403)throw new Error('SESSION_EXPIRED');
    if(!res.ok)throw new Error(data?.detail||data?.error||'Dashboard nicht erreichbar');
    return data;
  }

  function statusColor(data,last,watchdog){
    const live=data?.live||{};
    if(live.active||live.status==='running'||last?.status==='running')return 'blue';
    if(last?.status==='error'||watchdog?.status==='error')return 'red';
    if(last?.status==='warning'||watchdog?.status==='warning')return 'yellow';
    return last?.status==='ok'?'green':'gray';
  }

  function render(data){
    const runs=Array.isArray(data.runs)?data.runs:[];
    const snapshots=runs.filter(r=>r.run_type==='snapshot');
    const last=snapshots[0]||null;
    const watchdog=runs.find(r=>r.run_type==='watchdog')||null;
    const live=data.live||{};
    const m=last?.metrics||{};
    const color=statusColor(data,last,watchdog);
    const active=color==='blue';
    const currentKbps=Number(live.current_kbps??live.current_speed_kbps??m.kilobytes_per_second??0);
    const avgKbps=Number(live.average_kbps??live.average_speed_kbps??currentKbps);
    const batchIndex=Number(live.batch_index??m.batch_index??0),batchTotal=Number(live.batch_total??m.batch_total??0);
    const progress=Number(live.progress_percent??(batchTotal?batchIndex/batchTotal*100:(active?50:100)));
    const currentTable=safeText(live.current_table??m.table??'–');
    const payload=Number(live.payload_bytes??m.payload_bytes??0);

    $('mirrorOverallLed').className=`mirror-led ${color}`;
    $('mirrorOverallText').textContent=color==='blue'?'Spiegelung aktiv – Daten werden übertragen':color==='green'?'Spiegelung OK':color==='yellow'?'Spiegelung auffällig – Prüfung empfohlen':color==='red'?'Spiegelung mit Fehler':'Noch keine Statusdaten';
    $('mirrorLink').className=`mirror-link ${color}${active?' active':''}`;
    $('mirrorCurrentSpeed').textContent=fmtSpeed(currentKbps);
    $('mirrorAverageSpeed').textContent=`Ø ${fmtSpeed(avgKbps)}`;
    $('mirrorProgressBar').style.width=`${Math.max(0,Math.min(100,progress))}%`;
    $('mirrorProgressText').textContent=active?(batchTotal?`Übertragung läuft · ${batchIndex}/${batchTotal}`:'Übertragung läuft'):'Warte auf nächsten automatischen Lauf';
    $('mirrorSourceState').textContent=active?'Sendet':'Bereit';
    $('mirrorTargetState').textContent=active?'Empfängt':color==='red'?'Fehler':color==='yellow'?'Prüfen':'Synchron';
    $('mirrorCurrentTable').textContent=currentTable;
    $('mirrorTableProgress').textContent=batchTotal?`${batchIndex}/${batchTotal}`:(data.summary?.mirror_table_count?`${data.summary.mirror_table_count} Tabellen`:'–');
    $('mirrorPayload').textContent=fmtBytes(payload);
    $('mirrorLastRun').textContent=last?.finished_at?new Date(last.finished_at).toLocaleTimeString('de-DE'):'–';
    $('mirrorWatchdog').textContent=watchdog?`${String(watchdog.status).toUpperCase()} · ${safeText(watchdog.message||'')}`:'–';
    $('mirrorTableCount').textContent=data.summary?.mirror_table_count?`${data.summary.mirror_table_count} Tabellen`:'–';
    $('mirrorGeneratedAt').textContent=data.generated_at?`Stand ${new Date(data.generated_at).toLocaleTimeString('de-DE')}`:'';

    $('mirrorHistoryRows').innerHTML=snapshots.slice(0,8).map(r=>{const x=r.metrics||{},c=r.status==='ok'?'green':r.status==='warning'?'yellow':r.status==='running'?'blue':'red';return `<div class="mirror-history-row"><i class="${c}"></i><strong>${safeText(x.table||'Mirror')}</strong><span>${r.source_rows??0} → ${r.target_rows??'…'} Zeilen</span><span>${fmtBytes(x.payload_bytes||0)}</span><span>${fmtSpeed(x.kilobytes_per_second||0)}</span><span>${r.finished_at?new Date(r.finished_at).toLocaleTimeString('de-DE'):'läuft'}</span></div>`;}).join('')||'<p class="hint">Noch keine Übertragung protokolliert.</p>';
  }

  async function refreshDashboard(){
    if(!dialog||!dialog.open)return;
    try{const data=await fetchDashboard();render(data);}
    catch(e){if(e instanceof Error&&e.message==='SESSION_EXPIRED'){clearSession();stopPolling();showLogin();$('mirrorLoginError').textContent='Cloud-Sitzung abgelaufen. Bitte erneut anmelden.';}else{$('mirrorOverallLed').className='mirror-led red';$('mirrorOverallText').textContent='Live-Daten nicht erreichbar';}}
  }

  function boot(){injectCss();buildDialog();installButton();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();