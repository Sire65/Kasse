/* KC HealthCore V1.0.0 - program-only monitoring, privacy-preserving, non-blocking */
(()=>{
  'use strict';
  const VERSION='1.0.0', LOG_KEY='kc_health_log_v100', SETTINGS_KEY='kc_health_settings_v100', MAX_EVENTS=500;
  const defaults={enabled:true,level:'normal',autoRushProtection:true,intervalMs:60000,idleBudgetMs:8,retentionDays:14};
  let settings={...defaults}, probes={}, timer=null, lastInput=Date.now(), busy=false, started=false, lastCycle=null;
  const now=()=>new Date().toISOString();
  const safeParse=(v,f)=>{try{return JSON.parse(v)}catch{return f}};
  const loadEvents=()=>safeParse(localStorage.getItem(LOG_KEY)||'[]',[]).filter(x=>x&&x.time);
  function saveEvents(rows){try{localStorage.setItem(LOG_KEY,JSON.stringify(rows.slice(-MAX_EVENTS)))}catch{}}
  function append(type,severity='info',details={}){
    const evt={id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,time:now(),type,severity,details:sanitize(details)};
    const rows=loadEvents();rows.push(evt);saveEvents(rows);return evt;
  }
  function sanitize(v,depth=0){
    if(depth>4)return '[gekürzt]';
    if(v==null||typeof v==='number'||typeof v==='boolean')return v;
    if(typeof v==='string')return v.replace(/[\u0000-\u001f]/g,' ').slice(0,800);
    if(Array.isArray(v))return v.slice(0,30).map(x=>sanitize(x,depth+1));
    if(typeof v==='object'){const o={};for(const [k,x] of Object.entries(v)){if(/name|operator|customer|account|receipt|bon|item|article|payment/i.test(k))continue;o[k]=sanitize(x,depth+1)}return o}
    return String(v).slice(0,200);
  }
  function loadSettings(){settings={...defaults,...safeParse(localStorage.getItem(SETTINGS_KEY)||'{}',{})};return {...settings}}
  function saveSettings(next){settings={...settings,...next};localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));schedule();return {...settings}}
  function activity(){lastInput=Date.now()}
  function isProtected(){return settings.autoRushProtection&&(busy||Date.now()-lastInput<4500||probes.isSaleActive?.()===true||probes.isPaymentOpen?.()===true)}
  function schedule(){if(timer)clearTimeout(timer);timer=null;if(!started||!settings.enabled)return;timer=setTimeout(requestCycle,Math.max(30000,Number(settings.intervalMs)||60000))}
  function requestCycle(){
    if(!settings.enabled)return;
    if(isProtected()){schedule();return}
    if('requestIdleCallback' in window)requestIdleCallback(deadline=>runCycle(deadline),{timeout:1500});
    else setTimeout(()=>runCycle({timeRemaining:()=>settings.idleBudgetMs,didTimeout:true}),0);
  }
  async function runCycle(deadline){
    const startedAt=performance.now(), results=[];
    const add=(id,status,message,metric)=>results.push({id,status,message,metric});
    try{
      if(isProtected())return;
      const budget=Math.max(3,Number(settings.idleBudgetMs)||8);
      try{const k='kc_health_probe';localStorage.setItem(k,'1');const ok=localStorage.getItem(k)==='1';localStorage.removeItem(k);add('storage',ok?'pass':'fail',ok?'Lokalspeicher erreichbar':'Lokalspeicher inkonsistent')}catch(e){add('storage','fail',e.message)}
      if(performance.now()-startedAt<budget){add('online',navigator.onLine?'pass':'warn',navigator.onLine?'Browser online':'Browser offline')}
      if(performance.now()-startedAt<budget&&navigator.serviceWorker){const reg=await navigator.serviceWorker.getRegistration();add('serviceWorker',reg?.active?'pass':'warn',reg?.active?'Service Worker aktiv':'Service Worker nicht aktiv')}
      if(performance.now()-startedAt<budget&&probes.checkCore){const r=await probes.checkCore();add('core',r?.status||'pass',r?.message||'Kernstatus geprüft')}
      const elapsed=performance.now()-startedAt;lastCycle={time:now(),elapsedMs:+elapsed.toFixed(2),results};
      const failures=results.filter(x=>x.status==='fail');const warnings=results.filter(x=>x.status==='warn');
      if(failures.length)append('silent-cycle','error',{elapsedMs:elapsed,failures,warnings});
      else if(warnings.length&&settings.level!=='minimal')append('silent-cycle','warn',{elapsedMs:elapsed,warnings});
      if(elapsed>Math.max(20,budget*3)){append('monitor-budget-exceeded','warn',{elapsedMs:elapsed,budgetMs:budget});settings.level='minimal'}
    }catch(e){append('monitor-error','error',{message:e?.message||String(e)});settings.enabled=false;localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings))}
    finally{schedule()}
  }
  function start(options={}){
    if(started)return;started=true;loadSettings();probes=options.probes||{};
    ['pointerdown','keydown','touchstart'].forEach(t=>addEventListener(t,activity,{capture:true,passive:true}));
    addEventListener('error',e=>append('javascript-error','error',{message:e.message,source:String(e.filename||'').split('/').pop(),line:e.lineno,column:e.colno}));
    addEventListener('unhandledrejection',e=>append('unhandled-rejection','error',{message:e.reason?.message||String(e.reason||'Unbekannter Promise-Fehler')}));
    addEventListener('offline',()=>append('browser-offline','warn',{}));addEventListener('online',()=>append('browser-online','info',{}));
    document.addEventListener('visibilitychange',()=>append('visibility','info',{state:document.visibilityState}));
    try{if('PerformanceObserver'in window){const po=new PerformanceObserver(list=>{for(const x of list.getEntries()){if(x.duration>=150)append('long-task','warn',{durationMs:+x.duration.toFixed(1)})}});po.observe({entryTypes:['longtask']})}}catch{}
    append('healthcore-start','info',{version:VERSION,level:settings.level});schedule();
  }
  function setBusy(value){busy=!!value;if(!busy)activity()}
  function status(){const events=loadEvents(), recent=events.slice(-50);return{version:VERSION,settings:{...settings},lastCycle,eventCount:events.length,errorCount:recent.filter(x=>x.severity==='error').length,warnCount:recent.filter(x=>x.severity==='warn').length,protected:isProtected()}}
  function clear(){localStorage.removeItem(LOG_KEY);append('diagnostics-cleared','info',{})}
  function buildDiagnostic(appInfo={},manualReport=null){
    const cutoff=Date.now()-(Number(settings.retentionDays)||14)*86400000;
    return {format:'KCB-DIAG-1',formatVersion:1,createdAt:now(),privacy:{programOnly:true,personalData:false,salesData:false,userTracking:false},app:sanitize(appInfo),health:status(),manualReport:sanitize(manualReport),events:loadEvents().filter(x=>Date.parse(x.time)>=cutoff)};
  }
  const b64=bytes=>btoa(String.fromCharCode(...bytes));
  async function encryptDiagnostic(payload,password){
    if(!crypto?.subtle)throw new Error('Web-Crypto ist nicht verfügbar.');
    if(String(password||'').length<8)throw new Error('Der Exportcode muss mindestens 8 Zeichen lang sein.');
    const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
    const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
    const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt']);
    const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(payload))));
    return {format:'KCB-DIAG-ENC-1',formatVersion:1,createdAt:now(),cipher:'AES-256-GCM',kdf:{name:'PBKDF2',hash:'SHA-256',iterations:210000,salt:b64(salt)},iv:b64(iv),payload:b64(cipher)};
  }
  window.KCHealthCore={VERSION,start,setBusy,activity,getSettings:()=>({...settings}),saveSettings,status,append,clear,buildDiagnostic,encryptDiagnostic,getEvents:loadEvents};
})();
