(function(global){
'use strict';
const VERSION='1.3.0';
const KNOWN_EFFECTS=new Set(['none','snow-light','snow-heavy','glitter','gold-dust','gold-rain','stars','star-rain','bokeh','sparkle-wave','shooting-star','lights','candle']);
const KNOWN_TRANSITIONS=new Set(['none','fade','dissolve','slide-left','slide-right','slide-up','curtain','iris','focus','camera','cross-zoom','zoom','wipe','push']);
function n(v,d=0){v=Number(v);return Number.isFinite(v)?v:d}
function rect(v){const w=n(v?.w??v?.width,20),h=n(v?.h??v?.height,10),x=n(v?.x,50),y=n(v?.y,50);return{x:x-w/2,y:y-h/2,w,h}}
function overlap(a,b){const x=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)),y=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));return x*y}
function luminance(hex){const m=String(hex||'').match(/^#([0-9a-f]{6})$/i);if(!m)return null;const rgb=[0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16)/255).map(c=>c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4));return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]}
function contrast(a,b){const x=luminance(a),y=luminance(b);if(x===null||y===null)return null;return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
function issue(level,code,title,detail,slideIndex=null,gate='QUALITY'){return{level,code,title,detail,slideIndex,gate}}
function objectVisible(s,key){
 const visibility=s.objectVisibility||{}; if(visibility[key]===false)return false;
 if(key==='title'||key==='text'||key==='price')return !!String(s[key]||'').trim();
 if(key==='ticker')return !!String(s.ticker||'').trim()||['weather','program','combined'].includes(s.tickerSource?.mode);
 if(key==='symbols')return Array.isArray(s.decorations)&&s.decorations.length>0;
 if(key==='weather')return s.type==='weather'&&Number(s.weather?.days??1)!==0;
 if(key==='image')return !!(s.image||s.media?.src||s.media?.dataUrl);
 if(key==='video')return !!(s.video||s.media?.type?.startsWith?.('video'));
 if(key==='table')return !!(s.table||s.tableObject);
 if(key==='banner'||key==='shape')return !!(s.presentationDesign?.[key]?.type&&s.presentationDesign[key].type!=='none');
 return visibility[key]===true;
}
function inspect(project,env={}){
 const out=[], p=project||{}, slides=Array.isArray(p.slides)?p.slides:[];
 const page=p.page||{width:1024,height:700};
 if(!slides.length)out.push(issue('error','PRS-001','Keine Folien','Die Präsentation enthält keine Folie.',null,'CONTENT'));
 const ids=new Set();
 slides.forEach((s,i)=>{
  if(!s||typeof s!=='object'){out.push(issue('error','PRS-003','Ungültige Folie','Der Foliendatensatz ist beschädigt.',i,'DATA'));return}
  if(!s.id)out.push(issue('warning','PRS-004','Folien-ID fehlt','Für Synchronisation und Zusammenführung ist eine eindeutige ID erforderlich.',i,'DATA'));
  else if(ids.has(s.id))out.push(issue('error','PRS-005','Doppelte Folien-ID',`Die ID ${s.id} kommt mehrfach vor.`,i,'DATA')); else ids.add(s.id);
  const items=Array.isArray(s.items)?s.items:[];
  /* BEFUND 31.08.2026: es gibt ZWEI Foliendatensätze in der Suite - der Designer legt
     seine Inhalte in items[] ab, der TV-Bereich des Managers dagegen in layout{} mit
     objectVisibility. Für die zweite Bauart war items immer leer, also hätte der TÜV
     JEDE dieser Folien als "Leere Folie" gemeldet. Deshalb zählt jetzt auch, was nach
     objectVisible() auf der Folie wirklich zu sehen ist. */
  const sichtbareObjekte=Object.keys(s.layout||{}).filter(k=>objectVisible(s,k)).length
    +(Array.isArray(s.customTextObjects)?s.customTextObjects.length:0);
  if(!items.length&&!sichtbareObjekte)out.push(issue('warning','CNT-001','Leere Folie','Die Folie besitzt keine Elemente (Text, Bild, Formen usw.).',i,'CONTENT'));
  const dur=n(s.duration,10); if(dur<3)out.push(issue('warning','PLY-001','Anzeigedauer zu kurz',`${dur} Sekunden sind für TV-Lesbarkeit meist zu kurz.`,i,'PLAYBACK')); if(dur>120)out.push(issue('info','PLY-002','Sehr lange Anzeigedauer',`${dur} Sekunden eingestellt.`,i,'PLAYBACK'));
  const tr=s.transition||'fade'; if(!KNOWN_TRANSITIONS.has(tr))out.push(issue('warning','DSN-001','Unbekannter Übergang',`„${tr}“ kann auf dem TV abweichend dargestellt werden.`,i,'DESIGN'));
  items.forEach((it,ii)=>{
   const r={x:n(it.x),y:n(it.y),w:n(it.w,20),h:n(it.h,20)};
   if(r.x<0||r.y<0||r.x+r.w>page.width||r.y+r.h>page.height)out.push(issue('warning','LAY-001','Element außerhalb der Arbeitsfläche',`„${it.name||it.type||'Element'}“ überschreitet den ${page.width}×${page.height}-Arbeitsbereich.`,i,'LAYOUT'));
   if(it.type==='text'&&String(it.text||'').length>260&&dur<8)out.push(issue('warning','PRO-007','Lesezeit zu knapp',`${it.text.length} Zeichen bei ${dur} Sekunden sind für TV schwer erfassbar.`,i,'PLAYBACK'));
   if(it.type==='text'&&n(it.font,20)<16)out.push(issue('warning','PRO-003','Schrift für TV zu klein',`Schriftgröße ${it.font} ist auf einem Fernseher schwer lesbar.`,i,'DESIGN'));
   if((it.image||it.src||'').toString().startsWith('blob:'))out.push(issue('error','MED-001','Temporäres Medium',`„${it.name||'Bild'}“ verwendet eine blob:-Adresse und geht beim Neustart verloren.`,i,'MEDIA'));
  });
  for(let a=0;a<items.length;a++)for(let b=a+1;b<items.length;b++){
   const ra={x:n(items[a].x),y:n(items[a].y),w:n(items[a].w,20),h:n(items[a].h,20)},rb={x:n(items[b].x),y:n(items[b].y),w:n(items[b].w,20),h:n(items[b].h,20)};
   const ov=overlap(ra,rb);if(ov>Math.min(ra.w*ra.h,rb.w*rb.h)*.5)out.push(issue('info','PRO-001','Elemente überlappen sich deutlich',`„${items[a].name||items[a].type}“ und „${items[b].name||items[b].type}“ überdecken sich stark.`,i,'LAYOUT'));
  }
 });
 /* BEFUND 31.08.2026: dieselbe Meldung stand hier ZWEIMAL - einmal richtig hinter der
    Bedingung, einmal ohne jede Bedingung direkt dahinter. Dadurch meldete der TÜV
    "Keine aktive Masterfolie" auch dann, wenn ein Master aktiv war, und zusätzlich
    doppelt. Der zweite Aufruf ist entfernt. */
 if(!p.master?.enabled)out.push(issue('info','MST-001','Keine aktive Masterfolie','Ein Master verbessert Konsistenz und spätere Pflege.',null,'DESIGN'));
/* BEFUND 31.08.2026: geprüft wurde nur profile.resolution bzw. resolution. Die
    ausgelieferte Präsentation legt ihre Zielgröße aber in page {width,height} bzw. in
    tvProfile ab - der TÜV meldete deshalb "Zielauflösung fehlt", obwohl 1920x1080
    eingestellt war. Jetzt zählt jede der drei Schreibweisen. */
 const aufloesung=p.profile?.resolution||p.resolution||p.tvProfile?.resolution
   ||(n(p.page?.width)>0&&n(p.page?.height)>0?`${n(p.page.width)}x${n(p.page.height)}`:null);
 if(!aufloesung)out.push(issue('warning','TV-001','Zielauflösung fehlt','Für den Weihnachtsmarkt sollte 1920×1080 oder 3840×2160 festgelegt werden.',null,'TV'));
 if(env.storageAvailable===false)out.push(issue('error','SYS-001','Lokaler Speicher nicht verfügbar','Änderungen können nicht zuverlässig gespeichert werden.',null,'SYSTEM'));
 if(env.fullscreenAvailable===false)out.push(issue('warning','SYS-002','Vollbild-API fehlt','Der Browser unterstützt keinen echten Vollbildmodus.',null,'TV'));
 if(env.mediaRecorderAvailable===false)out.push(issue('info','SYS-003','Videoexport nicht verfügbar','In diesem Browser kann kein WebM/MP4 aufgezeichnet werden.',null,'EXPORT'));
 if((env.runtimeErrorCount||0)>0)out.push(issue('error','RUN-001','Absturz- oder Blockadeereignisse erkannt',`${env.runtimeErrorCount} schwere Laufzeitereignisse wurden protokolliert. Letztes Ereignis: ${env.lastRuntimeIncident?.type||'unbekannt'} – ${env.lastRuntimeIncident?.detail||''}`,null,'SYSTEM'));
 if((env.runtimeWarningCount||0)>0)out.push(issue('warning','RUN-002','Laufzeitwarnungen erkannt',`${env.runtimeWarningCount} Warnungen wie lange Tasks oder kurze UI-Blockaden wurden protokolliert.`,null,'SYSTEM'));
 if(env.designCoreAvailable===false)out.push(issue('error','CORE-001','DesignCore nicht geladen','Design, Übergänge und Effekte sind nicht zuverlässig verfügbar.',null,'CORE'));
 if(env.releaseReport){
  (env.releaseReport.issues||[]).forEach(x=>out.push(issue(x.level||'error',x.code||'REL-000',x.title||'Release-Prüfung',x.detail||'',null,'RELEASE')));
  if(env.releaseReport.status!=='PASS'&&!(env.releaseReport.issues||[]).length)out.push(issue('error','REL-000','Release nicht freigegeben','Das zentrale Release-Gate ist nicht bestanden.',null,'RELEASE'));
 }
 const counts={error:out.filter(x=>x.level==='error').length,warning:out.filter(x=>x.level==='warning').length,info:out.filter(x=>x.level==='info').length};
 const gates={}; ['RELEASE','CORE','DATA','CONTENT','DESIGN','LAYOUT','MEDIA','PLAYBACK','TV','EXPORT','SYSTEM'].forEach(g=>{const xs=out.filter(x=>x.gate===g);gates[g]=xs.some(x=>x.level==='error')?'BLOCKED':xs.some(x=>x.level==='warning')?'WARNING':'PASS'});
 const status=counts.error?'BLOCKED':counts.warning?'CONDITIONAL':'PASS';
 return{schema:'KC_PRESENTATION_TUV_REPORT_V1',version:VERSION,checkedAt:new Date().toISOString(),status,counts,gates,slideCount:slides.length,activeSlideCount:slides.filter(x=>x&&x.active!==false&&x.hidden!==true).length,issues:out};
}
function environment(){let storageAvailable=true;try{localStorage.setItem('__kc_tuv__','1');localStorage.removeItem('__kc_tuv__')}catch(e){storageAvailable=false}return{storageAvailable,fullscreenAvailable:!!document.documentElement.requestFullscreen,mediaRecorderAvailable:typeof MediaRecorder!=='undefined',designCoreAvailable:!!global.KCDesignCorePresentation,...(global.KCRuntimeStability?.environment?.()||{})}}
function download(report,name='KC_Presentation_TUV_Report.json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
global.KCPresentationTUV={VERSION,inspect,environment,download};
})(window);
