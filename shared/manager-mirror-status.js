(()=>{
  'use strict';
  const SUPABASE_URL='https://ptblnpiroqftcvlsrhac.supabase.co';
  const SUPABASE_KEY='sb_publishable_SqXIeGN-clcZ4gjmpLdSww_4DLfyy24';
  const SESSION_KEY='kc_manager_mirror_session_v1';
  const POLL_MS=1000;
  const $=(id)=>document.getElementById(id);
  let timer=null;
  const groupB=new Set(['kc_dp_daily_push_preview','kc_dp_pilot_testers','kc_dp_push_deliveries']);
  const groupC=new Set(['kc_dp_pilot_events','kc_dp_replacement_requests','kc_dp_replacement_responses','kng_keys','kng_key_access_map','kng_key_assignments','kng_key_movements','kc_core_people']);
  const coreTables=new Set(['kc_core_app_access','kc_core_app_registry','kc_core_club_memberships','kc_core_operational_directory','kc_core_organizations','kc_core_people','kc_core_pos_aliases','kc_core_project_monitor','kc_core_system_health','kc_core_user_links']);
  const groupFor=(table)=>groupB.has(table)?'B':groupC.has(table)?'C':'A';
  const fmtSpeed=(kb)=>{const v=Number(kb||0);return v>=1024?`${(v/1024).toFixed(2)} MB/s`:`${v.toFixed(v<10?2:1)} KB/s`;};
  const fmtBytes=(n)=>{const v=Number(n||0);if(v<1024)return `${v} B`;if(v<1048576)return `${(v/1024).toFixed(1)} KB`;return `${(v/1048576).toFixed(2)} MB`;};

  function injectCss(){
    if(!document.querySelector('link[data-kc-mirror-status-css]')){const l=document.createElement('link');l.rel='stylesheet';l.href='shared/manager-mirror-status.css';l.dataset.kcMirrorStatusCss='1';document.head.appendChild(l);}
    if(!document.querySelector('link[data-kc-mirror-overview-css]')){const l=document.createElement('link');l.rel='stylesheet';l.href='shared/manager-mirror-overview.css';l.dataset.kcMirrorOverviewCss='1';document.head.appendChild(l);}
  }
  function buildExtra(){
    const dialog=$('mirrorManagerDialog');if(!dialog||$('mirrorScheduleStatus'))return false;
    const live=$('mirrorLivePanel');if(!live)return false;
    const extra=document.createElement('section');extra.id='mirrorScheduleStatus';extra.className='mirror-schedule-status';
    extra.innerHTML=`<div class="mirror-schedule-head"><strong>Automatik & Überwachung</strong><span id="mirrorActiveGroup">Aktive Gruppe: –</span></div><div class="mirror-schedule-grid"><article><span class="mirror-group-badge">A</span><div><small>Mirror-Gruppe A</small><strong id="mirrorNextA">–</strong></div></article><article><span class="mirror-group-badge">B</span><div><small>Mirror-Gruppe B</small><strong id="mirrorNextB">–</strong></div></article><article><span class="mirror-group-badge">C</span><div><small>Mirror-Gruppe C</small><strong id="mirrorNextC">–</strong></div></article><article><span id="mirrorWatchdogLed" class="mirror-led gray"></span><div><small>Watchdog</small><strong id="mirrorWatchdogCompact">–</strong></div></article></div>`;
    const metrics=live.querySelector('.mirror-metrics');live.insertBefore(extra,metrics||null);return true;
  }
  function secondsToNext(offset){const now=new Date();const minute=now.getMinutes(),second=now.getSeconds();let add=((offset-minute)%5+5)%5;if(add===0&&second===0)return 0;if(add===0)add=5;return add*60-second;}
  const countdown=(sec)=>sec<=0?'jetzt':sec<60?`${sec}s`:`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')} min`;
  function updateCountdowns(){if($('mirrorNextA'))$('mirrorNextA').textContent=`in ${countdown(secondsToNext(0))}`;if($('mirrorNextB'))$('mirrorNextB').textContent=`in ${countdown(secondsToNext(2))}`;if($('mirrorNextC'))$('mirrorNextC').textContent=`in ${countdown(secondsToNext(4))}`;}
  function session(){try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
  async function fetchDashboard(){const s=session();if(!s?.access_token)return null;const res=await fetch(`${SUPABASE_URL}/functions/v1/kc-db-mirror-control?action=dashboard`,{headers:{Authorization:`Bearer ${s.access_token}`,apikey:SUPABASE_KEY},cache:'no-store'});if(!res.ok)return null;return await res.json().catch(()=>null);}
  const colorForStatus=(status)=>status==='ok'?'green':status==='warning'?'yellow':status==='error'?'red':status==='running'?'blue':'gray';
  function autoOpenProblem(data){
    const states=Array.isArray(data?.live?.table_states)?data.live.table_states:[];
    const badCore=states.find(s=>coreTables.has(s.table)&&(s.status==='error'||s.status==='warning'||Number(s.mismatch_count||0)>0));
    const core=$('kcMirrorCore');if(core){if(badCore){core.open=true;core.dataset.autoOpen='true';}else delete core.dataset.autoOpen;}
    const card=document.querySelector('#mirrorManagerDialog .mirror-manager-card');if(card){card.classList.remove('mirror-attention-yellow','mirror-attention-red');if(data?.live?.signal==='red')card.classList.add('mirror-attention-red');else if(data?.live?.signal==='yellow')card.classList.add('mirror-attention-yellow');}
  }
  function apply(data){
    if(!data||document.body.classList.contains('mirror-sim-active'))return;
    const live=data.live||{},runs=Array.isArray(data.runs)?data.runs:[],watchdog=runs.find(r=>r.run_type==='watchdog')||null;
    const active=Boolean(live.is_transferring),color=live.signal||'gray',currentTable=live.active_table||live.last_table||'–',group=groupFor(currentTable);
    const kbps=Number(live.current_kilobytes_per_second||0),avg=Number(live.average_kilobytes_per_second||0),idx=Number(live.batch_index||0),total=Number(live.batch_total||0),progress=total?Math.max(0,Math.min(100,idx/total*100)):(active?50:100);
    if($('mirrorOverallLed'))$('mirrorOverallLed').className=`mirror-led ${color}`;
    if($('mirrorOverallText'))$('mirrorOverallText').textContent=active?`Gruppe ${group}: Daten werden übertragen`:color==='green'?'Spiegelung OK':color==='yellow'?'Spiegelung auffällig – Prüfung empfohlen':color==='red'?'Spiegelung mit Fehler':'Noch keine Statusdaten';
    if($('mirrorLink'))$('mirrorLink').className=`mirror-link ${color}${active?' active':''}`;
    if($('mirrorCurrentSpeed'))$('mirrorCurrentSpeed').textContent=fmtSpeed(kbps);
    if($('mirrorAverageSpeed'))$('mirrorAverageSpeed').textContent=`Ø ${fmtSpeed(avg)}`;
    if($('mirrorProgressBar'))$('mirrorProgressBar').style.width=`${progress}%`;
    if($('mirrorProgressText'))$('mirrorProgressText').textContent=active?(total?`Gruppe ${group} läuft · ${idx}/${total}`:`Gruppe ${group} läuft`):`Nächster automatischer Lauf: A ${countdown(secondsToNext(0))}`;
    if($('mirrorSourceState'))$('mirrorSourceState').textContent=active?'Sendet':'Bereit';
    if($('mirrorTargetState'))$('mirrorTargetState').textContent=active?'Empfängt':color==='red'?'Fehler':color==='yellow'?'Prüfen':'Synchron';
    if($('mirrorCurrentTable'))$('mirrorCurrentTable').textContent=currentTable;
    if($('mirrorTableProgress'))$('mirrorTableProgress').textContent=total?`${idx}/${total}`:`${data.summary?.mirror_table_count||0} Tabellen`;
    if($('mirrorPayload'))$('mirrorPayload').textContent=fmtBytes(live.payload_bytes||0);
    if($('mirrorActiveGroup'))$('mirrorActiveGroup').textContent=active?`Aktive Gruppe: ${group}`:'Aktive Gruppe: keine';
    const wdColor=colorForStatus(watchdog?.status);if($('mirrorWatchdogLed'))$('mirrorWatchdogLed').className=`mirror-led ${wdColor}`;if($('mirrorWatchdogCompact'))$('mirrorWatchdogCompact').textContent=watchdog?`${String(watchdog.status).toUpperCase()}${watchdog.finished_at?' · '+new Date(watchdog.finished_at).toLocaleTimeString('de-DE'):''}`:'Keine Daten';if($('mirrorWatchdog'))$('mirrorWatchdog').textContent=watchdog?`${String(watchdog.status).toUpperCase()} · ${String(watchdog.message||'')}`:'–';
    autoOpenProblem(data);
    window.dispatchEvent(new CustomEvent('kc-mirror-dashboard',{detail:data}));
  }
  async function tick(){updateCountdowns();const dialog=$('mirrorManagerDialog');if(!dialog?.open||!session()?.access_token||document.body.classList.contains('mirror-sim-active'))return;const data=await fetchDashboard();apply(data);}
  function boot(){injectCss();let tries=0;const wait=setInterval(()=>{tries++;if(buildExtra()||tries>80){clearInterval(wait);updateCountdowns();timer=setInterval(tick,POLL_MS);}},100);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();