(()=>{
  'use strict';
  const $=(id)=>document.getElementById(id);
  let timer=null,step=0,active=false;
  const profiles={
    slow:{label:'Langsam',kbps:6,color:'blue',duration:9000},
    normal:{label:'Normal',kbps:85,color:'blue',duration:6000},
    fast:{label:'Schnell',kbps:1800,color:'blue',duration:4200},
    warning:{label:'Warnung',kbps:2.5,color:'yellow',duration:6500},
    error:{label:'Fehler',kbps:0,color:'red',duration:4500}
  };
  const fmtSpeed=(kb)=>kb>=1024?`${(kb/1024).toFixed(2)} MB/s`:`${kb.toFixed(kb<10?2:1)} KB/s`;
  const stop=()=>{if(timer){clearInterval(timer);timer=null;}active=false;document.body.classList.remove('mirror-sim-active');const badge=$('mirrorSimBadge');if(badge)badge.hidden=true;};
  function setState(color,text,speed,progress,index,total,table,payload){
    const led=$('mirrorOverallLed'),link=$('mirrorLink');
    if(led)led.className=`mirror-led ${color}`;
    if(link)link.className=`mirror-link ${color}${color==='blue'?' active':''}`;
    if($('mirrorOverallText'))$('mirrorOverallText').textContent=text;
    if($('mirrorCurrentSpeed'))$('mirrorCurrentSpeed').textContent=fmtSpeed(speed);
    if($('mirrorAverageSpeed'))$('mirrorAverageSpeed').textContent=`Ø ${fmtSpeed(speed*0.88)}`;
    if($('mirrorProgressBar'))$('mirrorProgressBar').style.width=`${progress}%`;
    if($('mirrorProgressText'))$('mirrorProgressText').textContent=color==='red'?'Simulation: Übertragungsfehler':color==='yellow'?'Simulation: auffällig langsam':`Simulation läuft · ${index}/${total}`;
    if($('mirrorSourceState'))$('mirrorSourceState').textContent=color==='red'?'Gestoppt':'Sendet';
    if($('mirrorTargetState'))$('mirrorTargetState').textContent=color==='red'?'Fehler':color==='yellow'?'Prüfen':'Empfängt';
    if($('mirrorCurrentTable'))$('mirrorCurrentTable').textContent=table;
    if($('mirrorTableProgress'))$('mirrorTableProgress').textContent=`${index}/${total}`;
    if($('mirrorPayload'))$('mirrorPayload').textContent=payload;
    const badge=$('mirrorSimBadge');if(badge){badge.hidden=false;badge.textContent='SIMULATION · KEINE ECHTEN DATEN';}
  }
  function finish(profile){
    if(profile==='error'){
      setState('red','Simulation: Fehlerzustand',0,62,2,3,'kc_demo_error','0 B');
      return;
    }
    if(profile==='warning'){
      setState('yellow','Simulation: langsame/auffällige Spiegelung',profiles.warning.kbps,100,3,3,'kc_demo_warning','18.4 KB');
      return;
    }
    setState('green','Simulation abgeschlossen – alles OK',0,100,3,3,'–','24.8 KB');
    if($('mirrorProgressText'))$('mirrorProgressText').textContent='Simulation abgeschlossen';
    if($('mirrorSourceState'))$('mirrorSourceState').textContent='Bereit';
    if($('mirrorTargetState'))$('mirrorTargetState').textContent='Synchron';
    if($('mirrorLink'))$('mirrorLink').className='mirror-link green';
  }
  function run(profileName){
    const p=profiles[profileName];if(!p)return;
    stop();active=true;step=0;document.body.classList.add('mirror-sim-active');
    const live=$('mirrorLivePanel'),login=$('mirrorLoginPanel');if(live)live.hidden=false;if(login)login.hidden=true;
    const totalTicks=Math.max(8,Math.round(p.duration/350));
    const tables=['kc_demo_people','kc_demo_orders','kc_demo_receipts'];
    timer=setInterval(()=>{
      step++;
      const ratio=Math.min(1,step/totalTicks),progress=Math.round(ratio*100),index=Math.min(3,Math.max(1,Math.ceil(ratio*3)));
      const jitter=p.kbps? p.kbps*(0.82+Math.random()*0.35):0;
      const color=profileName==='warning'?'yellow':profileName==='error'&&ratio>.58?'red':'blue';
      const text=color==='red'?'Simulation: Verbindung unterbrochen':color==='yellow'?'Simulation: auffällig langsam':'Simulation: Daten fließen';
      setState(color,text,jitter,progress,index,3,tables[index-1],`${(2.5+ratio*22.3).toFixed(1)} KB`);
      if(ratio>=1){clearInterval(timer);timer=null;finish(profileName);}
    },350);
  }
  function install(){
    const dialog=$('mirrorManagerDialog');if(!dialog||$('mirrorSimControls'))return false;
    const host=dialog.querySelector('.mirror-manager-card');if(!host)return false;
    const box=document.createElement('section');box.id='mirrorSimControls';box.className='mirror-sim-controls';
    box.innerHTML='<div><strong>Anzeige testen</strong><span id="mirrorSimBadge" hidden>SIMULATION · KEINE ECHTEN DATEN</span></div><div class="mirror-sim-buttons"><button type="button" data-sim="slow">Langsam</button><button type="button" data-sim="normal">Normal</button><button type="button" data-sim="fast">Schnell</button><button type="button" data-sim="warning">Gelb / Warnung</button><button type="button" data-sim="error">Rot / Fehler</button><button type="button" id="mirrorSimStop">Simulation beenden</button></div>';
    const history=dialog.querySelector('.mirror-history');
    host.insertBefore(box,history||null);
    box.querySelectorAll('[data-sim]').forEach(btn=>btn.addEventListener('click',()=>run(btn.dataset.sim)));
    $('mirrorSimStop').addEventListener('click',()=>{stop();const live=$('mirrorLivePanel');if(live&&!sessionStorage.getItem('kc_manager_mirror_session_v1'))live.hidden=true;const login=$('mirrorLoginPanel');if(login&&!sessionStorage.getItem('kc_manager_mirror_session_v1'))login.hidden=false;});
    dialog.addEventListener('close',stop);
    return true;
  }
  let attempts=0;const waiter=setInterval(()=>{attempts++;if(install()||attempts>80)clearInterval(waiter);},100);
})();
