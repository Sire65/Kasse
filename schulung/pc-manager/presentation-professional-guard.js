/* KC Presentation Professional Guard V0.29.17 - additive safety and quality extension
 *
 * ZWEI BEFUNDE aus der Prüfung vom 31.08.2026 - beide behoben, siehe unten:
 *
 * BEFUND A: EIN KLICK HAT DIE PRÄSENTATION VERÄNDERT
 *   installStage hing an "pointerup" der Vorschaufläche und rief bei JEDEM Loslassen der
 *   Maus fixSlide() auf - danach wurde gespeichert. Es genügte also, in die Vorschau zu
 *   klicken, um Objekte zu verschieben. Nachgemessen an der ausgelieferten Präsentation:
 *   die Laufschrift wanderte von y 94 auf 91 und von w 92 auf 90, die Symbole von x 90
 *   auf 89 - auf allen 28 Folien, zusammen 56 Objekte. Ein Klick ist keine Bearbeitung.
 *   JETZT: es wird nur noch korrigiert, wenn der Zeiger zwischen Drücken und Loslassen
 *   wirklich bewegt wurde (mehr als 3 Pixel) - also nach einem echten Verschieben oder
 *   Vergrößern. Wer nur etwas anklickt oder auswählt, ändert nichts mehr.
 *
 * BEFUND B: ES WURDEN AUCH OBJEKTE KORRIGIERT, DIE GAR NICHT ZU SEHEN SIND
 *   fixSlide lief über ALLE Einträge in slide.layout. Jede Folie trägt aber sämtliche
 *   Platzhalter (Laufschrift, Wetter, Banner, Form, Bild ...), unabhängig davon, ob sie
 *   auf dieser Folie eingeschaltet sind. Korrigiert wurde also fleißig an Dingen, die
 *   niemand sieht - und die dadurch beim späteren Einschalten an einer anderen Stelle
 *   standen als hinterlegt.
 *   JETZT: dieselbe Sichtbarkeitsregel wie im Objekt-Studio (sichtbar()); alles andere
 *   bleibt unangetastet.
 */
(function(global){'use strict';
const VERSION='1.3.0',MARGIN=5;
function currentProject(){const project=global.KCGetTVPresentation?.();if(project?.slides)return project;if(global.tvPresentation?.slides)return global.tvPresentation;if(Array.isArray(global.slides))return{slides:global.slides};return{slides:[]}}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}

/* Dieselbe Regel wie kc-object-studio.js/visibleObjects: die fünf zuschaltbaren Objekte
   zählen nur bei ausdrücklichem true, die festen nur, solange sie nicht abgeschaltet sind,
   und "symbols" nur, wenn die Folie überhaupt Symbole hat. */
const ZUSCHALTBAR=new Set(['ticker','weather','banner','shape','image']);
function sichtbar(slide,key){
  if(key==='symbols')return (slide?.decorations||[]).length>0;
  if(ZUSCHALTBAR.has(key))return slide?.objectVisibility?.[key]===true;
  return slide?.objectVisibility?.[key]!==false;
}

function fixObject(v){if(!v||typeof v!=='object')return false;let changed=false;let w=Number(v.w??v.width??20),h=Number(v.h??v.height??10),x=Number(v.x??50),y=Number(v.y??50);w=clamp(w,4,100-2*MARGIN);h=clamp(h,4,100-2*MARGIN);const nx=clamp(x,MARGIN+w/2,100-MARGIN-w/2),ny=clamp(y,MARGIN+h/2,100-MARGIN-h/2);if(nx!==x){v.x=nx;changed=true}if(ny!==y){v.y=ny;changed=true}if((v.w??v.width)!==w){if('width'in v&&!('w'in v))v.width=w;else v.w=w;changed=true}if((v.h??v.height)!==h){if('height'in v&&!('h'in v))v.height=h;else v.h=h;changed=true}return changed}
function fixSlide(s){let count=0;Object.entries(s?.layout||{}).forEach(([key,v])=>{if(!sichtbar(s,key))return;if(fixObject(v))count++});return count}
function fixAll(){const p=currentProject();let count=0;(p.slides||[]).forEach(s=>count+=fixSlide(s));if(typeof global.saveTvPresentation==='function')global.saveTvPresentation();if(typeof global.save==='function')try{global.save()}catch{};if(typeof global.renderTvPreview==='function')global.renderTvPreview();if(typeof global.preview==='function')global.preview();if(typeof global.renderTvSlideList==='function')global.renderTvSlideList();global.KCPresentationTUVRun?.();return count}
function addSafeArea(stage){if(!stage||stage.querySelector('.kc-tv-safe-area'))return;const a=document.createElement('div');a.className='kc-tv-safe-area';a.innerHTML='<span class="kc-safe-label">TV-Sicherheitsbereich</span>';stage.appendChild(a)}
function status(stage){if(!stage)return;let b=stage.parentElement?.querySelector('.kc-live-tv-status');if(!b){b=document.createElement('div');b.className='kc-live-tv-status';stage.parentElement?.appendChild(b)}const bad=[...stage.querySelectorAll('[data-tv-object]')].some(n=>{const r=n.getBoundingClientRect(),s=stage.getBoundingClientRect(),m=s.width*.05;return r.left<s.left+m||r.right>s.right-m||r.top<s.top+s.height*.05||r.bottom>s.bottom-s.height*.05});b.className='kc-live-tv-status '+(bad?'bad':'ok');b.textContent=bad?'● Außerhalb TV-Sicherheitsbereich':'● TV-Layout OK'}

function installStage(stage){
  if(!stage)return;
  addSafeArea(stage);status(stage);
  if(stage.dataset.kcGuard)return;
  stage.dataset.kcGuard='1';
  // Merken, wo gedrückt wurde - nur bei echter Bewegung wird hinterher korrigiert.
  let start=null;
  stage.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY}},true);
  stage.addEventListener('pointerup',e=>{
    const bewegt=start&&(Math.abs(e.clientX-start.x)>3||Math.abs(e.clientY-start.y)>3);
    start=null;
    if(!bewegt){status(stage);return}                 // reiner Klick: nichts ändern
    setTimeout(()=>{
      const p=currentProject(),idx=Number(global.tvSlideIndex??global.idx??0),s=p.slides?.[idx];
      if(s&&fixSlide(s)){
        if(typeof global.saveTvPresentation==='function')global.saveTvPresentation();
        if(typeof global.renderTvPreview==='function')global.renderTvPreview();
        if(typeof global.preview==='function')global.preview();
      }
      status(stage);
    },0);
  },true);
}
function refresh(){installStage(document.getElementById('tvPreviewScreen'));installStage(document.getElementById('preview'))}
let queued=false;const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refresh()})};document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{refresh();const a=document.getElementById('tvPreviewScreen'),b=document.getElementById('preview');if(a)new MutationObserver(queue).observe(a,{childList:true,subtree:true});if(b)new MutationObserver(queue).observe(b,{childList:true,subtree:true})},250));
global.KCPresentationProfessional={VERSION,fixAll,fixSlide,refresh,sichtbar};
})(window);
