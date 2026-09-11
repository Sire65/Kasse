/* KC Objekt-Studio V1.2 – Auswahl, Werkzeugkasten, Rahmen-Aufziehen, Mehrfachauswahl,
   Ausrichtungshilfen, Ebenen-Übersicht, Erscheinungs-Animationen, Text-Auto-Fit,
   Gestaltungs-Vorlagen.
   Ersetzt: tv-unified-editor.js, tv-content-object-core-v02940.js,
            tv-object-library-v02945.js, tv-context-inspector-v02942.js,
            tv-repair60-consolidation.js, tv-context-effect-fix.js,
            tv-object-productivity-v02941.js, tv-live-editor-fix.js,
            und den Ticker-Erweiterungsteil von tv-editor-workflow.js.
   Baustufe 3: Gestaltung (Erscheinungs-Animationen, Text-Auto-Fit, Gestaltungs-Vorlagen). */
(function (global) {
  'use strict';
  global.KC_DISABLE_LEGACY_TV_EDITORS = true; // synchron gesetzt, bevor irgendein Alt-Beobachter zum ersten Mal feuert
  const VERSION = '1.2.0';
  const STAGE_ID = 'tvPreviewScreen', EDITOR_ID = 'tvContextEditor';

  /* ---------- Objekttypen & Vorgaben ---------- */
  const objectKeys = new Set(['title','text','price','ticker','symbols','weather','banner','shape','image','table']);
  const textKeys = new Set(['title','text','price']);
  const drawableKeys = ['title','text','price','ticker','banner','shape','image']; // Typen, die per Maus aufgezogen werden können
  const restoreLabels = {
    title:['T','Überschrift'], text:['T','Textfeld'], price:['€','Preisfeld'], ticker:['↔','Laufschrift'],
    banner:['▭','Banner'], shape:['◆','Sonderelement'], symbols:['★','Symbole'], weather:['☁','Wetter'], image:['🖼','Bild']
  };
  const defaults = {
    title:{x:50,y:22,w:84,h:14,scale:1,rotation:0,opacity:1}, text:{x:50,y:44,w:78,h:20,scale:1,rotation:0,opacity:1},
    price:{x:50,y:67,w:45,h:14,scale:1,rotation:0,opacity:1}, symbols:{x:82,y:10,w:22,h:10,scale:1,rotation:0,opacity:1,color:'#ffffff',spacing:12},
    ticker:{x:50,y:92,w:90,h:8,scale:1,rotation:0,opacity:1}, weather:{x:50,y:56,w:90,h:58,scale:1,rotation:0,opacity:1},
    banner:{x:50,y:10,w:68,h:10,scale:1,rotation:0,opacity:1}, shape:{x:84,y:22,w:24,h:18,scale:1,rotation:0,opacity:1},
    image:{x:50,y:52,w:45,h:45,scale:1,rotation:0,opacity:1}, table:{x:50,y:52,w:72,h:45,scale:1,rotation:0,opacity:1}
  };
  const fontOptions = [
    ['system','Arial / klar'],['humanist','Trebuchet / humanistisch'],['serif','Georgia / klassisch'],
    ['rounded','Arial Rounded'],['condensed','Arial Narrow'],['monospace','Consolas / technisch'],
    ['script','Schreibschrift / elegant'],['handwritten','Handschrift / persönlich'],['display','Plakativ / Headline']
  ];
  const fontMap = {
    system:'Arial,Helvetica,sans-serif', humanist:'"Trebuchet MS",Arial,sans-serif', serif:'Georgia,"Times New Roman",serif',
    rounded:'"Arial Rounded MT Bold",Arial,sans-serif', condensed:'"Arial Narrow",Arial,sans-serif', monospace:'Consolas,monospace',
    script:'"Brush Script MT","Segoe Script",cursive', handwritten:'"Segoe Print","Bradley Hand",cursive',
    display:'"Copperplate","Arial Black",sans-serif'
  };
  const framePresets = [
    ['custom','Frei einstellen'],
    ['gold','Gold'],['silver','Silber'],['ice','Eisblau'],['wood','Rustikal-Holz'],['neon','Neon-Leuchtrand']
  ];
  const framePresetValues = {
    gold:{line:'double',width:5,color:'#d4af37',radius:6,padding:10},
    silver:{line:'double',width:4,color:'#c9d3dc',radius:6,padding:10},
    ice:{line:'solid',width:3,color:'#8fd3ff',radius:14,padding:12},
    wood:{line:'solid',width:8,color:'#8a5a2b',radius:2,padding:8},
    neon:{line:'solid',width:3,color:'#ff2fd0',radius:18,padding:10}
  };
  const symbolOptions = [...new Set(['🎄','⭐','❄️','🎅','🕯️','🎁','🔔','🍷','☕','🥨','🌟','✨','❤️','🎶','🏠','👨‍🍳',
    '🤶','🧑‍🎄','🦌','🛷','🌨️','☃️','⛄','🍪','🍵','🔥','🌲','👼','🏮','🎀','🧦','🍬','🍭','🥁','🎺','🎵','🕊️','💫','🌠',
    '⛪','🛍️','🌰','🧁','🍰','🪵','🧸','🚂','🦉','🐿️','🦊','🎼','🛎️','🌙','☄️','💛','💚','💙'])];

  let active = 'slide', selection = new Set(), drag = null, drawing = null, observer = null, updating = false, refreshQueued = false;

  const stage = () => document.getElementById(STAGE_ID);
  const box = () => document.getElementById(EDITOR_ID);
  const slide = () => typeof global.currentTvSlide === 'function' ? global.currentTvSlide() : (global.KCGetTVPresentation?.()?.slides?.[0] || null);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const options = (items, value) => items.map(([id,label]) => `<option value="${id}" ${id===value?'selected':''}>${label}</option>`).join('');
  const clamp = (v,min,max) => Math.max(min, Math.min(max, v));

  function design(s) { return global.KCDesignCorePresentation?.normalize?.(s) || (s.presentationDesign ||= {}); }
  function isCustomText(key) { return String(key||'').startsWith('customText:'); }
  function customTextItem(key) { const id = String(key).slice(11); return slide()?.customTextObjects?.find(item => item.id === id) || null; }
  function state(key) {
    if (isCustomText(key)) return customTextItem(key)?.layout || null;
    const s = slide(); if (!s || !defaults[key]) return null;
    s.layout ||= {}; const p = s.layout[key] ||= {};
    for (const [name,value] of Object.entries(defaults[key])) if (p[name] === undefined) p[name] = value;
    return p;
  }
  function weatherTickerText(){
    const rows = global.KCGetTVPresentation?.()?.weather?.lastData || [];
    return rows.map(x=>`${x.label}: ${x.min}°/${x.max}° ${x.summary||''}`.trim()).join(' · ');
  }
  function programTickerText(){
    const rows = global.settings?.eventProgram || [];
    return rows.filter(x=>x.active!==false).sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)).map(x=>`${x.time||''} ${x.title||''}`.trim()).join(' · ');
  }
  function resolveTickerText(s){
    const mode = s.tickerSource?.mode || 'manual';
    if(mode==='weather') return weatherTickerText();
    if(mode==='program') return programTickerText();
    if(mode==='combined') return [weatherTickerText(),programTickerText()].filter(Boolean).join(' · ');
    return s.ticker || '';
  }
  function refreshTickerContent(s){
    if(!s) return; const mode = s.tickerSource?.mode || 'manual'; if(mode==='manual') return;
    const resolved = resolveTickerText(s); if(resolved) s.ticker = resolved;
  }
  function tickerState() {
    const s = slide(); if (!s) return null;
    return s.tickerDesign ||= { mode:'scroll',speed:13,direction:'left',frame:false,pixel:false,pause:false,
      fontFamily:'monospace',fontSize:1,color:'#ffffff',bold:true,italic:false,underline:false,align:'center',
      background:'#10243a',backgroundOpacity:.82, separator:' • ',repeat:'continuous',easing:'linear',gap:80,
      uppercase:false,shadow:false,outline:false,reverseAlternate:false };
  }
  function frameStyle(key) {
    const s = slide(); if (!s) return null;
    s.objectStyles ||= {};
    return s.objectStyles[key] ||= { frame:false,preset:'custom',width:2,line:'solid',color:'#ffffff',radius:0,padding:0 };
  }
  function surfaceStyle(key) {
    const s = slide(); if (!s) return null;
    s.objectStyles ||= {}; const style = s.objectStyles[key] ||= {};
    style.surfaceMode ||= 'transparent'; style.surfaceColor ||= '#173765'; style.surfaceOpacity ??= .7; style.surfaceBlur ??= 8;
    return style;
  }
  function textState(key) {
    if (isCustomText(key)) {
      const item = customTextItem(key); const t = item.typography ||= {};
      return { get fontFamily(){return t.fontFamily||'system'},set fontFamily(v){t.fontFamily=v},
        get size(){return +(t.size||1)},set size(v){t.size=+v}, get color(){return t.color||'#ffffff'},set color(v){t.color=v},
        get bold(){return !!t.bold},set bold(v){t.bold=v}, get italic(){return !!t.italic},set italic(v){t.italic=v},
        get underline(){return !!t.underline},set underline(v){t.underline=v}, get align(){return t.align||'center'},set align(v){t.align=v},
        get letterSpacing(){return +(t.letterSpacing||0)},set letterSpacing(v){t.letterSpacing=+v},
        get lineHeight(){return +(t.lineHeight||1.15)},set lineHeight(v){t.lineHeight=+v},
        get autoFit(){return !!t.autoFit},set autoFit(v){t.autoFit=v} };
    }
    const s = slide(), t = design(s).typography ||= {};
    return { get fontFamily(){return t[`${key}FontFamily`]||t.fontFamily||'system'},set fontFamily(v){t[`${key}FontFamily`]=v},
      get size(){return +(t[`${key}Size`]||1)},set size(v){t[`${key}Size`]=+v},
      get color(){return t[`${key}Color`]||(key==='price'?'#ffd34d':'#ffffff')},set color(v){t[`${key}Color`]=v},
      get bold(){return t[`${key}Bold`] ?? (key!=='text')},set bold(v){t[`${key}Bold`]=v},
      get italic(){return !!t[`${key}Italic`]},set italic(v){t[`${key}Italic`]=v},
      get underline(){return !!t[`${key}Underline`]},set underline(v){t[`${key}Underline`]=v},
      get align(){return t[`${key}Align`]||t.textAlign||'center'},set align(v){t[`${key}Align`]=v},
      get letterSpacing(){return +(t[`${key}LetterSpacing`]??t.letterSpacing??0)},set letterSpacing(v){t[`${key}LetterSpacing`]=+v},
      get lineHeight(){return +(t[`${key}LineHeight`]||t.lineHeight||1.15)},set lineHeight(v){t[`${key}LineHeight`]=+v},
      get autoFit(){return !!t[`${key}AutoFit`]},set autoFit(v){t[`${key}AutoFit`]=v} };
  }

  /* ---------- Darstellung auf der Bühne ---------- */
  function applyTextStyle(node, key) {
    if (!node) return; const t = textState(key), base = key==='title'?4.2:key==='price'?6.2:4;
    node.style.setProperty('font-family', fontMap[t.fontFamily]||fontMap.system, 'important');
    node.style.setProperty('font-size', `calc(${base}cqw * ${t.size} * var(--autofit-scale,1))`, 'important');
    node.style.setProperty('color', t.color, 'important');
    node.style.setProperty('font-weight', t.bold?'800':'400', 'important');
    node.style.setProperty('font-style', t.italic?'italic':'normal', 'important');
    node.style.setProperty('text-decoration', t.underline?'underline':'none', 'important');
    node.style.setProperty('text-align', t.align, 'important');
    node.style.setProperty('letter-spacing', `${t.letterSpacing}em`, 'important');
    node.style.setProperty('line-height', String(t.lineHeight), 'important');
    if(t.autoFit) applyAutoFit(node,key); else node.style.setProperty('--autofit-scale',1);
  }
  function applyAutoFit(node,key){
    if(!node) return; const t=textState(key); if(!t.autoFit){ node.style.setProperty('--autofit-scale',1); return; }
    node.style.setProperty('--autofit-scale',1);
    let scale=1; const min=.4; let guard=0;
    while(node.scrollHeight>node.clientHeight+1 && scale>min && guard<24){ scale=Math.max(min,scale-.05); node.style.setProperty('--autofit-scale',scale); guard++; }
  }
  function applyFrame(node, key) {
    if (!node) return; const style = frameStyle(key); if (!style) return;
    if (style.frame) { node.style.setProperty('border', `${style.width||2}px ${style.line||'solid'} ${style.color||'#ffffff'}`, 'important'); node.style.setProperty('border-radius', `${style.radius||0}px`,'important'); node.style.setProperty('padding', `${style.padding||0}px`,'important'); }
    else { node.style.removeProperty('border'); node.style.removeProperty('border-radius'); node.style.removeProperty('padding'); }
  }
  function applySurface(node, key) {
    if (!node || !['title','text','price'].includes(key)) return; const style = surfaceStyle(key); if (!style) return;
    if (style.surfaceMode === 'transparent') { node.style.background = 'transparent'; node.style.backdropFilter = ''; return; }
    if (style.surfaceMode === 'glass') { node.style.background = colorWithOpacity(style.surfaceColor, style.surfaceOpacity); node.style.backdropFilter = `blur(${style.surfaceBlur||8}px)`; return; }
    node.style.background = colorWithOpacity(style.surfaceColor, style.surfaceOpacity); node.style.backdropFilter = '';
  }
  function colorWithOpacity(hex,opacity){ const m=String(hex||'').match(/^#([0-9a-f]{6})$/i); if(!m) return hex||'transparent'; const n=parseInt(m[1],16); return `rgba(${n>>16},${(n>>8)&255},${n&255},${opacity??1})`; }
  function apply(node,p,key) {
    if (!node||!p) return;
    node.style.setProperty('--ue-x',`${p.x}%`); node.style.setProperty('--ue-y',`${p.y}%`); node.style.setProperty('--ue-w',`${p.w}%`); node.style.setProperty('--ue-h',`${p.h}%`);
    node.style.setProperty('--ue-scale',p.scale||1); node.style.setProperty('--ue-rot',`${p.rotation||0}deg`); node.style.setProperty('--ue-opacity',p.opacity??1); node.style.zIndex=p.z||10;
    if (textKeys.has(key) || isCustomText(key)) applyTextStyle(node,key);
    if (!isCustomText(key)) { applyFrame(node,key); applySurface(node,key); }
    if (key==='symbols') { node.style.setProperty('--ue-symbol-size',`${2.4*(p.scale||1)}rem`); node.style.setProperty('--ue-symbol-gap',`${p.spacing??12}px`); node.style.setProperty('--ue-symbol-color',p.color||'#fff'); }
    if (key==='ticker') {
      const t=tickerState(), target=node.querySelector('span')||node;
      node.dataset.tickerMode=t.mode; node.dataset.tickerDirection=t.direction;
      node.style.setProperty('--ticker-speed',`${(t.speed||13)/{continuous:1,'1':4,'2':2,'3':1.4,'5':1}[t.repeat||'continuous']||t.speed||13}s`);
      node.classList.toggle('ticker-frame',!!t.frame); node.classList.toggle('ticker-pixel',!!t.pixel); node.classList.toggle('ticker-paused',!!t.pause);
      node.style.background=colorWithOpacity(t.background,t.backgroundOpacity);
      node.style.setProperty('--ticker-gap',`${t.gap||80}px`); node.dataset.tickerEasing=t.easing||'linear'; node.dataset.tickerRepeat=t.repeat||'continuous'; node.dataset.tickerAlternate=t.reverseAlternate?'true':'false';
      target.style.fontFamily=fontMap[t.fontFamily]||fontMap.monospace; target.style.setProperty('font-size',`calc(4cqw * ${t.fontSize||1})`,'important');
      target.style.color=t.color; target.style.fontWeight=t.bold?'800':'400'; target.style.fontStyle=t.italic?'italic':'normal'; target.style.textDecoration=t.underline?'underline':'none'; target.style.textAlign=t.align||'center';
      target.style.textTransform=t.uppercase?'uppercase':'none'; target.style.textShadow=t.shadow?'0 0 6px currentColor,0 0 14px currentColor':'none'; target.style.webkitTextStroke=t.outline?'1px currentColor':'0';
    }
  }
  function applyGeometry(node,p){
    if(!node||!p) return;
    node.style.setProperty('--ue-x',`${p.x}%`); node.style.setProperty('--ue-y',`${p.y}%`); node.style.setProperty('--ue-w',`${p.w}%`); node.style.setProperty('--ue-h',`${p.h}%`);
    node.style.setProperty('--ue-scale',p.scale||1); node.style.setProperty('--ue-rot',`${p.rotation||0}deg`); node.style.setProperty('--ue-opacity',p.opacity??1); node.style.zIndex=p.z||10;
  }
  function addHandles(node){ if(node.querySelector(':scope>.kc-ue-handles'))return; const h=document.createElement('span'); h.className='kc-ue-handles'; h.innerHTML='<i data-ue-h="nw"></i><i data-ue-h="n"></i><i data-ue-h="ne"></i><i data-ue-h="e"></i><i data-ue-h="se"></i><i data-ue-h="s"></i><i data-ue-h="sw"></i><i data-ue-h="w"></i><i data-ue-h="rotate"></i>'; node.appendChild(h); }
  function decorate(){
    const st=stage(), s=slide(); if(!st||!s) return; updating=true;
    if(s.tickerSource?.mode && s.tickerSource.mode!=='manual') refreshTickerContent(s);
    const weather=st.querySelector('.tv-weather-cards.in-slide'); if(weather) weather.dataset.tvObject='weather';
    st.classList.add('kc-object-studio-stage');
    st.querySelectorAll('[data-tv-object]').forEach(node=>{
      let key=node.dataset.tvObject; if(key==='content') return;
      const custom = isCustomText(key);
      if(!custom && (!objectKeys.has(key) || !defaults[key])) return;
      if(node.classList.contains('kc-empty-object')){
        // Leerer "Zum Hinzufügen anklicken"-Platzhalter: nur Position übernehmen, keine
        // gespeicherte Rahmen-/Flächen-/Typografie-Gestaltung anwenden - sonst wirkt ein noch
        // gar nicht vorhandener Preis/Laufschrift wie ein unerwünschter, echter Rahmen.
        const p=state(key); node.style.cssText=`position:absolute;left:${p.x}%;top:${p.y}%;width:${p.w}%;height:${p.h}%;transform:translate(-50%,-50%);z-index:${p.z||10}`;
      } else {
        node.classList.add('kc-ue-object'); apply(node, state(key), key); addHandles(node);
      }
      node.classList.toggle('kc-ue-selected', key===active || selection.has(key));
      node.setAttribute('role','button'); node.tabIndex=0;
      node.setAttribute('aria-label', `${global.KCPropertyCore?.describe(key).label||key}; anklicken zum Bearbeiten, Umschalt+Klick für Mehrfachauswahl`);
      node.onclick=event=>{ event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); event.shiftKey ? toggleSelection(key,node) : select(key,node); };
      node.onkeydown=event=>{ if(event.key==='Enter'||event.key===' '){ event.preventDefault(); select(key,node); } };
    });
    st.onclick=event=>{ if(event.target===st){ event.stopPropagation(); select('slide',st); } };
    updating=false;
  }
  function toggleSelection(key,node){
    if(!selection.size && active!=='slide') selection.add(active);
    selection.has(key) ? selection.delete(key) : selection.add(key);
    if(selection.size<2){ const only=[...selection][0]; selection.clear(); return select(only||'slide',node); }
    active=key; decorate();
    try { render(); } catch(error) { console.error('KC Objekt-Studio konnte den Werkzeugkasten nicht aufbauen:', error); }
  }
  function clearSelection(){ selection.clear(); }
  function selectionKeys(){ return selection.size>1 ? [...selection] : [active]; }
  function select(key,node){
    active = (objectKeys.has(key) || isCustomText(key)) ? key : 'slide';
    selection.clear();
    global.KCSetLegacySelectedObject?.(active); global.KCSelectionCore?.select?.(active,node,{slideId:slide()?.id}); global.KCPropertyCore?.open?.(active);
    decorate();
    try { render(); } catch(error) { console.error('KC Objekt-Studio konnte den Werkzeugkasten nicht aufbauen:', error); }
    return active;
  }
  function save(withThumbnail=false){ global.saveTvPresentation?.(); if(withThumbnail) global.renderTvSlideList?.(); }

  /* ---------- Ziehen / Skalieren / Drehen bestehender Objekte ---------- */
  function begin(ev,node,handle){
    const key=node.dataset.tvObject; if(!(objectKeys.has(key)||isCustomText(key)) || node.isContentEditable) return;
    const p=state(key), st=stage(); if(!p||!st) return;
    ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
    const group = selection.size>1 && selection.has(key) && (!handle||handle==='move');
    if(!group) select(key,node); else active=key;
    const rect=st.getBoundingClientRect();
    if(group){
      const members=[...selection].map(k=>({key:k,node:st.querySelector(`[data-tv-object="${CSS.escape(k)}"]`),start:{...state(k)}})).filter(m=>m.node&&m.start);
      drag={id:ev.pointerId,group:true,members,key,handle:'move',sx:ev.clientX,sy:ev.clientY,rect};
    } else {
      drag={id:ev.pointerId,node,key,handle:handle||'move',sx:ev.clientX,sy:ev.clientY,start:{...p},rect};
    }
    node.setPointerCapture?.(ev.pointerId); node.classList.add('kc-ue-moving');
  }
  function move(ev){
    if(!drag||ev.pointerId!==drag.id) return; ev.preventDefault();
    const d=drag, dx=(ev.clientX-d.sx)/d.rect.width*100, dy=(ev.clientY-d.sy)/d.rect.height*100;
    if(d.group){
      hideGuides();
      for(const m of d.members){ const p=state(m.key); if(!p) continue; p.x=m.start.x+dx; p.y=m.start.y+dy; applyGeometry(m.node,p); }
      syncGeometry(); return;
    }
    const p=state(d.key);
    if(d.handle==='move'){ p.x=d.start.x+dx; p.y=d.start.y+dy; }
    else if(d.handle==='rotate'){ const r=d.node.getBoundingClientRect(); p.rotation=Math.round(Math.atan2(ev.clientY-(r.top+r.height/2),ev.clientX-(r.left+r.width/2))*180/Math.PI+90); }
    else { let w=d.start.w,h=d.start.h,x=d.start.x,y=d.start.y;
      if(d.handle.includes('e')) w=d.start.w+dx; if(d.handle.includes('w')){ w=d.start.w-dx; x=d.start.x+dx/2; }
      if(d.handle.includes('s')) h=d.start.h+dy; if(d.handle.includes('n')){ h=d.start.h-dy; y=d.start.y+dy/2; }
      Object.assign(p,{w:Math.max(4,w),h:Math.max(4,h),x,y}); }
    global.KCSmartLayoutCore?.snap?.(p);
    if(d.handle==='move') smartGuides(p,d.key); else hideGuides();
    applyGeometry(d.node,p); syncGeometry();
  }
  function end(ev){
    if(!drag||ev.pointerId!==drag.id) return; hideGuides();
    if(drag.group){ drag.members.forEach(m=>m.node.classList.remove('kc-ue-moving')); drag=null; save(true); global.renderTvPreview?.(); render(); return; }
    const key=drag.key,node=drag.node; node.classList.remove('kc-ue-moving'); node.releasePointerCapture?.(ev.pointerId); drag=null; active=key; apply(node,state(key),key); save(true); select(key,node);
  }
  /* ---------- Ausrichtungshilfen (Smart Guides) ---------- */
  function guideEls(){
    let v=document.getElementById('kcSmartGuideV'), h=document.getElementById('kcSmartGuideH'); const st=stage(); if(!st) return {v:null,h:null};
    if(!v){ v=document.createElement('div'); v.id='kcSmartGuideV'; v.className='kc-smart-guide kc-smart-guide-v'; st.appendChild(v); }
    if(!h){ h=document.createElement('div'); h.id='kcSmartGuideH'; h.className='kc-smart-guide kc-smart-guide-h'; st.appendChild(h); }
    return {v,h};
  }
  function hideGuides(){ document.getElementById('kcSmartGuideV')?.classList.remove('active'); document.getElementById('kcSmartGuideH')?.classList.remove('active'); }
  function smartGuides(p,key){
    const s=slide(); if(!s) return; const {v,h}=guideEls(); if(!v||!h) return;
    const threshold=1.4; let bestX=null,bestY=null;
    const targetsX=[50], targetsY=[50];
    for(const otherKey of Object.keys(defaults)){ if(otherKey===key||!s.objectVisibility?.[otherKey]) continue; const o=s.layout?.[otherKey]; if(!o) continue; targetsX.push(o.x); targetsY.push(o.y); }
    for(const t of targetsX) if(bestX===null && Math.abs(p.x-t)<threshold) bestX=t;
    for(const t of targetsY) if(bestY===null && Math.abs(p.y-t)<threshold) bestY=t;
    if(bestX!==null){ p.x=bestX; v.style.left=`${bestX}%`; v.classList.add('active'); } else v.classList.remove('active');
    if(bestY!==null){ p.y=bestY; h.style.top=`${bestY}%`; h.classList.add('active'); } else h.classList.remove('active');
  }
  function editText(node){ const key=node?.dataset.tvObject; if(!textKeys.has(key)&&key!=='ticker'&&!isCustomText(key)) return; select(key,node); const target=key==='ticker'?(node.querySelector('span')||node):node; target.contentEditable='true'; target.classList.add('kc-ue-text-edit'); target.focus(); }
  function finishText(target){ if(!target?.isContentEditable) return; target.contentEditable='false'; target.classList.remove('kc-ue-text-edit'); const key=target.closest('[data-tv-object]')?.dataset.tvObject||target.dataset.tvObject, s=slide();
    if(isCustomText(key)){ const item=customTextItem(key); if(item){ item.text=target.innerText.trim(); save(true); } return; }
    if(s&&(textKeys.has(key)||key==='ticker')){ s[key]=target.innerText.trim(); save(true); render(); } }

  /* ---------- Rahmen per Maus aufziehen (neues Objekt anlegen) ---------- */
  function drawStatus(text){ const node=document.getElementById('tvPreviewStatus'); if(node) node.textContent=text; }
  function armDraw(type){
    if(type!=='customText' && !drawableKeys.includes(type)) return insertObject(type);
    drawing = { type, from:null, to:null, overlay:null };
    document.body.classList.add('kc-draw-active');
    drawStatus(`${type==='customText'?'Freies Textfeld':(restoreLabels[type]?.[1]||type)}: mit gedrückter Maustaste auf der Folie einen Rahmen aufziehen · Esc bricht ab.`);
  }
  function cancelDraw(){ drawing?.overlay?.remove(); drawing=null; document.body.classList.remove('kc-draw-active'); drawStatus('Vorschau bereit'); }
  function drawPoint(event,rect){ return { x:clamp(event.clientX-rect.left,0,rect.width), y:clamp(event.clientY-rect.top,0,rect.height) }; }
  function drawOverlay(rect,from,to){ if(!drawing) return; if(!drawing.overlay){ drawing.overlay=document.createElement('div'); drawing.overlay.className='kc-draw-preview'; stage()?.appendChild(drawing.overlay); } Object.assign(drawing.overlay.style,{ left:`${Math.min(from.x,to.x)}px`, top:`${Math.min(from.y,to.y)}px`, width:`${Math.abs(to.x-from.x)}px`, height:`${Math.abs(to.y-from.y)}px` }); }
  function stagePointerDown(event){
    if(!drawing || event.button!==0 || event.target.closest('[data-tv-object]')) return;
    const root=stage(); if(!root) return; event.preventDefault(); event.stopImmediatePropagation();
    const rect=root.getBoundingClientRect(), from=drawPoint(event,rect);
    drawing.pointerId=event.pointerId; drawing.rect=rect; drawing.from=from; drawing.to=from;
    root.setPointerCapture?.(event.pointerId); drawOverlay(rect,from,from);
  }
  function stagePointerMove(event){ if(!drawing||!drawing.from||event.pointerId!==drawing.pointerId) return; event.preventDefault(); drawing.to=drawPoint(event,drawing.rect); drawOverlay(drawing.rect,drawing.from,drawing.to); }
  function stagePointerUp(event){
    if(!drawing||!drawing.from||event.pointerId!==drawing.pointerId) return;
    event.preventDefault(); const type=drawing.type, rect=drawing.rect, from=drawing.from, to=drawing.to; cancelDraw();
    let w=Math.abs(to.x-from.x), h=Math.abs(to.y-from.y);
    if(type==='customText'){
      const left=Math.min(from.x,to.x), top=Math.min(from.y,to.y);
      let pw=w, ph=h;
      if(pw<12||ph<12){ pw=rect.width*.34; ph=rect.height*.14; }
      const wPct=clamp(pw/rect.width*100,8,94), hPct=clamp(ph/rect.height*100,5,90);
      const xPct=clamp((left+pw/2)/rect.width*100,wPct/2,100-wPct/2), yPct=clamp((top+ph/2)/rect.height*100,hPct/2,100-hPct/2);
      createCustomText({x:xPct,y:yPct,w:wPct,h:hPct});
      return;
    }
    if(w<16||h<16){ insertObject(type); return; } // reiner Klick ohne Ziehen -> Standardgröße einsetzen
    const left=Math.min(from.x,to.x), top=Math.min(from.y,to.y);
    const pw=clamp(w/rect.width*100,8,96), ph=clamp(h/rect.height*100,5,92);
    const px=clamp((left+w/2)/rect.width*100,pw/2,100-pw/2), py=clamp((top+h/2)/rect.height*100,ph/2,100-ph/2);
    insertObject(type,{x:px,y:py,w:pw,h:ph});
  }
  function createCustomText(rect){
    const item=slide(); if(!item) return;
    item.customTextObjects ||= [];
    const id = `text-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
    const key = `customText:${id}`;
    item.customTextObjects.push({ id, text:'Text eingeben',
      layout:{x:rect.x,y:rect.y,w:rect.w,h:rect.h,scale:1,rotation:0,opacity:1,z:20+item.customTextObjects.length},
      typography:{fontFamily:'system',size:1,color:'#ffffff',bold:false,italic:false,underline:false,align:'center',lineHeight:1.15,letterSpacing:0}
    });
    save(true); global.renderTvPreview?.(); global.KCTVEditorWorkflow?.checkpoint?.();
    requestAnimationFrame(()=>{ const node=stage()?.querySelector(`[data-tv-object="${CSS.escape(key)}"]`); if(node){ select(key,node); node.contentEditable='true'; node.classList.add('kc-ue-text-edit'); node.focus(); } });
  }
  function insertObject(key,rect){
    const s=slide(); if(!s) return; s.objectVisibility||={}; s.objectVisibility[key]=true; s.layout||={};
    if(key==='title') s.title||='Neue Überschrift'; if(key==='text') s.text||='Neuer Text'; if(key==='price') s.price||='0,00 €';
    if(key==='ticker'){ s.tickerSource ||= {mode:'manual'}; if(s.tickerSource.mode==='manual') s.ticker||='Neue Laufschrift'; else refreshTickerContent(s); }
    if(key==='banner'){ s.presentationDesign||={}; s.presentationDesign.banner={type:'ribbon',text:'Neuer Banner'}; }
    if(key==='shape'){ s.presentationDesign||={}; s.presentationDesign.shape={type:'speech',text:'Neuer Hinweis',position:'top-right'}; }
    if(key==='symbols'){ s.decorations||=[]; if(!s.decorations.length) s.decorations.push('⭐'); }
    if(key==='weather'){ const p=global.KCGetTVPresentation?.(); if(p) p.weather={...(p.weather||{}),days:p.weather?.days||3,location:p.weather?.location||'Werne'}; s.type='weather'; }
    if(key==='image'){ s.objectStyles||={}; }
    if(rect && defaults[key]) { s.layout[key]=Object.assign({},defaults[key],rect); }
    save(true); global.renderTvPreview?.(); queueRefresh(); requestAnimationFrame(()=>{ const node=stage()?.querySelector(`[data-tv-object="${CSS.escape(key)}"]`); if(node) select(key,node); });
  }

  function effectsState(){ const s=slide(); if(!s) return null; const d=design(s); d.effects=Object.assign({speed:1,density:2,size:1,opacity:.78,direction:'down'},d.effects||{}); return d.effects; }
  function effectsSection(){
    const s=slide(), e=effectsState(); if(!e) return '';
    const opts=[['none','Kein Effekt'],['snow-light','Leichter Schneefall'],['snow-heavy','Dichter Schneefall'],['rain','Regen'],['glitter','Glitzer'],['gold-dust','Goldstaub'],['gold-rain','Goldregen'],['stars','Sternenregen'],['star-rain','Sterne fallen'],['bokeh','Lichtpunkte'],['sparkle-wave','Glitzerwelle'],['shooting-star','Sternschnuppen']];
    return `<section class="kc-property-section kc-effect-control-card"><h4>Animation &amp; Sondereffekte</h4><label>Effekt<select data-effect="type">${options(opts,s.animation||'none')}</select></label><div class="kc-ue-grid"><label>Tempo <o>${(+e.speed).toFixed(2)}×</o><input data-effect="speed" type="range" min=".35" max="2.5" step=".05" value="${e.speed}"></label><label>Dichte <o>${Math.round(e.density)}</o><input data-effect="density" type="range" min="1" max="5" step="1" value="${e.density}"></label><label>Größe <o>${(+e.size).toFixed(1)}×</o><input data-effect="size" type="range" min=".5" max="2" step=".1" value="${e.size}"></label><label>Deckkraft <o>${Math.round(e.opacity*100)} %</o><input data-effect="opacity" type="range" min=".15" max="1" step=".05" value="${e.opacity}"></label></div></section>`;
  }
  function updateEffectLayer(){
    const s=slide(); if(!s) return;
    document.querySelectorAll('#tvPreviewScreen,#tvDashboardPreview,#tvPresentationStage').forEach(stageNode=>{
      const old=stageNode.querySelector(':scope > .tv-effect, .tv-effect'); const html=(s.animation&&s.animation!=='none'&&typeof global.renderEffects==='function')?(global.renderEffects(s)||''):'';
      if(old) old.remove(); if(html) stageNode.insertAdjacentHTML('afterbegin',html);
    });
  }

  /* ---------- Werkzeugkasten-Bausteine ---------- */
  function commonGeometry(p){ if(!p) return ''; return `<section class="kc-property-section"><h4>Position</h4><div class="kc-ue-grid"><label>Horizontal <o>${Math.round(p.x)} %</o><input data-layout="x" type="range" min="2" max="98" value="${p.x}"></label><label>Vertikal <o>${Math.round(p.y)} %</o><input data-layout="y" type="range" min="2" max="98" value="${p.y}"></label><label>Breite <o>${Math.round(p.w)} %</o><input data-layout="w" type="range" min="4" max="96" value="${p.w}"></label><label>Höhe <o>${Math.round(p.h)} %</o><input data-layout="h" type="range" min="4" max="96" value="${p.h}"></label><label>Skalierung <o>${Math.round((p.scale||1)*100)} %</o><input data-layout="scale" type="range" min=".25" max="4" step=".05" value="${p.scale||1}"></label><label>Drehung <o>${Math.round(p.rotation||0)}°</o><input data-layout="rotation" type="range" min="-180" max="180" value="${p.rotation||0}"></label><label>Deckkraft <o>${Math.round((p.opacity??1)*100)} %</o><input data-layout="opacity" type="range" min=".1" max="1" step=".05" value="${p.opacity??1}"></label></div></section>`; }
  function frameSection(key){
    const style=frameStyle(key); if(!style) return '';
    return `<section class="kc-property-section kc-frame-section"><h4>Rahmen</h4><label>Vorlage<select data-frame="preset">${options(framePresets,style.preset||'custom')}</select></label><label class="check"><input data-frame="frame" type="checkbox" ${style.frame?'checked':''}> Rahmen anzeigen</label><div class="kc-ue-grid"><label>Linie<select data-frame="line">${options([['solid','Durchgehend'],['dashed','Gestrichelt'],['dotted','Gepunktet'],['double','Doppelt']],style.line||'solid')}</select></label><label>Stärke<input data-frame="width" type="range" min="1" max="16" value="${style.width||2}"></label><label>Farbe<input data-frame="color" type="color" value="${style.color||'#ffffff'}"></label><label>Ecken<input data-frame="radius" type="range" min="0" max="80" value="${style.radius||0}"></label><label>Innenabstand<input data-frame="padding" type="range" min="0" max="40" value="${style.padding||0}"></label></div></section>`;
  }
  function surfaceSection(key){
    if(!['title','text','price'].includes(key)) return ''; const style=surfaceStyle(key); if(!style) return '';
    return `<section class="kc-property-section kc-surface-section"><h4>Textfläche</h4><div class="kc-ue-grid"><label>Darstellung<select data-surface="surfaceMode">${options([['transparent','Transparent'],['glass','Glasrückwand'],['solid','Farbig ausgefüllt']],style.surfaceMode||'transparent')}</select></label></label><label>Deckkraft<input data-surface="surfaceOpacity" type="range" min="0" max="1" step=".05" value="${style.surfaceOpacity}"></label><label>Glas-Weichzeichnung<input data-surface="surfaceBlur" type="range" min="0" max="24" value="${style.surfaceBlur}"></label></div></section>`;
  }
  function entranceStyle(key){
    const s=slide(); if(!s) return null;
    s.objectStyles ||= {}; const style = s.objectStyles[key] ||= {};
    return style.entrance ||= {type:'none',duration:600,delay:0};
  }
  const entranceOptions = [
    ['none','Kein'],['fade','Einblenden'],['slide-left','Von links'],['slide-right','Von rechts'],
    ['slide-up','Von unten'],['slide-down','Von oben'],['zoom','Einzoomen'],['bounce','Hüpfen']
  ];
  function entranceSection(key){
    const e=entranceStyle(key); if(!e) return '';
    return `<section class="kc-property-section kc-entrance-section"><h4>Erscheinungs-Animation</h4><div class="kc-ue-grid"><label>Effekt<select data-entrance="type">${options(entranceOptions,e.type)}</select></label><label>Dauer <o>${e.duration} ms</o><input data-entrance="duration" type="range" min="200" max="2000" step="100" value="${e.duration}"></label><label>Verzögerung <o>${e.delay} ms</o><input data-entrance="delay" type="range" min="0" max="3000" step="100" value="${e.delay}"></label></div><button type="button" data-entrance-preview>▶ Vorschau abspielen</button></section>`;
  }
  function playEntrance(node,e){
    if(!node||!e||e.type==='none') return;
    node.classList.remove('kc-entrance-fade','kc-entrance-slide-left','kc-entrance-slide-right','kc-entrance-slide-up','kc-entrance-slide-down','kc-entrance-zoom','kc-entrance-bounce');
    void node.offsetWidth;
    node.style.setProperty('--entrance-duration',`${e.duration||600}ms`); node.style.setProperty('--entrance-delay',`${e.delay||0}ms`);
    node.classList.add(`kc-entrance-${e.type}`);
  }
  function fontFormatButtons(prefix,t){ return `<div class="kc-format-buttons"><label><input data-${prefix}="bold" type="checkbox" ${t.bold?'checked':''}> Fett</label><label><input data-${prefix}="italic" type="checkbox" ${t.italic?'checked':''}> Kursiv</label><label><input data-${prefix}="underline" type="checkbox" ${t.underline?'checked':''}> Unterstrichen</label></div>`; }

  function textPanel(key,p){
    const s = isCustomText(key)?null:slide(); const t=textState(key);
    const content = isCustomText(key) ? (customTextItem(key)?.text||'') : (s[key]||'');
    return `<section class="kc-property-section"><h4>Inhalt</h4><label class="wide">Text<textarea data-content="${esc(key)}" rows="${key==='text'?4:2}">${esc(content)}</textarea></label></section>
<section class="kc-property-section"><h4>Schrift</h4><div class="kc-ue-grid"><label>Schriftart<select data-text="fontFamily">${options(fontOptions,t.fontFamily)}</select></label><label>Schriftgröße <o>${Math.round(t.size*100)} %</o><input data-text="size" type="range" min=".5" max="2.5" step=".05" value="${t.size}"></label><label>Schriftfarbe<input data-text="color" type="color" value="${t.color}"></label></div>${fontFormatButtons('text',t)}<label class="check"><input data-text-autofit type="checkbox" ${t.autoFit?'checked':''}> Automatisch verkleinern, wenn der Text nicht in den Rahmen passt</label></section>
<section class="kc-property-section"><h4>Ausrichtung &amp; Abstand</h4><div class="kc-ue-grid"><label>Ausrichtung<select data-text="align">${options([['left','Links'],['center','Zentriert'],['right','Rechts']],t.align)}</select></label><label>Buchstabenabstand<input data-text="letterSpacing" type="range" min="-.04" max=".2" step=".01" value="${t.letterSpacing}"></label><label>Zeilenabstand<input data-text="lineHeight" type="range" min=".8" max="2" step=".05" value="${t.lineHeight}"></label></div></section>
${isCustomText(key)?'':frameSection(key)}${isCustomText(key)?'':surfaceSection(key)}${entranceSection(key)}${commonGeometry(p)}`;
  }
  function tickerPanel(p){
    const s=slide(), t=tickerState();
    const source = s.tickerSource ||= {mode:'manual'}; s.objectVisibility||={};
    const sourceSection = `<section class="kc-property-section"><h4>Inhaltsquelle</h4><label class="check"><input data-ticker-visible type="checkbox" ${s.objectVisibility.ticker!==false?'checked':''}> Laufschrift auf dieser Folie anzeigen</label><label>Übernahme<select data-ticker-source>${options([['manual','Eigener Text'],['weather','Wetter übernehmen'],['program','Tagesprogramm übernehmen'],['combined','Wetter und Tagesprogramm']],source.mode)}</select></label></section>`;
    const contentSection = source.mode==='manual' ? `<section class="kc-property-section"><h4>Lauftext</h4><textarea class="wide" data-content="ticker" rows="3">${esc(s.ticker||'')}</textarea></section>` : '';
    const behaviour = `<section class="kc-property-section"><h4>Lauf-Verhalten</h4><div class="kc-ue-grid"><label>Effekt<select data-ticker="mode">${options([['scroll','Laufen'],['static','Stehend'],['blink','Blinken'],['bounce','Pendeln'],['assemble','Buchstaben-Aufbau']],t.mode)}</select></label><label>Richtung<select data-ticker="direction">${options([['left','Nach links'],['right','Nach rechts']],t.direction)}</select></label><label>Geschwindigkeit <o>${t.speed} s</o><input data-ticker="speed" type="range" min="3" max="30" value="${t.speed}"></label><label>Wiederholungen<select data-ticker="repeat">${options([['continuous','Endlos'],['1','1×'],['2','2×'],['3','3×'],['5','5×']],t.repeat)}</select></label><label>Bewegung<select data-ticker="easing">${options([['linear','Gleichmäßig'],['ease-in-out','Sanft beschleunigen'],['steps','LED-Schritte']],t.easing)}</select></label><label>Laufabstand<input data-ticker="gap" type="range" min="20" max="240" value="${t.gap}"></label></div><label class="check"><input data-ticker="reverseAlternate" type="checkbox" ${t.reverseAlternate?'checked':''}> Richtung bei Wiederholung wechseln</label></section>`;
    const typography = `<section class="kc-property-section"><h4>Schrift &amp; Optik</h4><div class="kc-ue-grid"><label>Schriftart<select data-ticker="fontFamily">${options(fontOptions,t.fontFamily)}</select></label><label>Schriftgröße<input data-ticker="fontSize" type="range" min=".5" max="2.5" step=".05" value="${t.fontSize}"></label><label>Schriftfarbe<input data-ticker="color" type="color" value="${t.color}"></label><label>Trennzeichen<input data-ticker="separator" maxlength="12" value="${esc(t.separator)}"></label></div>${fontFormatButtons('ticker',t)}<div class="kc-format-buttons"><label><input data-ticker="uppercase" type="checkbox" ${t.uppercase?'checked':''}> Großbuchstaben</label><label><input data-ticker="shadow" type="checkbox" ${t.shadow?'checked':''}> Leuchtschatten</label><label><input data-ticker="outline" type="checkbox" ${t.outline?'checked':''}> Kontur</label></div></section>`;
    const frame = `<section class="kc-property-section"><h4>Rahmen &amp; Hintergrund</h4><div class="kc-ue-grid"><label>Hintergrund<input data-ticker="background" type="color" value="${t.background}"></label><label>Hintergrund-Deckkraft<input data-ticker="backgroundOpacity" type="range" min="0" max="1" step=".05" value="${t.backgroundOpacity}"></label></div><div class="kc-format-buttons"><label><input data-ticker="frame" type="checkbox" ${t.frame?'checked':''}> Leuchtrahmen</label><label><input data-ticker="pixel" type="checkbox" ${t.pixel?'checked':''}> Pixeloptik</label><label><input data-ticker="pause" type="checkbox" ${t.pause?'checked':''}> Pausieren</label></div></section>`;
    return sourceSection + contentSection + behaviour + typography + frame + entranceSection('ticker') + commonGeometry(p);
  }
  function symbolObjects(s){ const wanted=s.decorations||[]; s.decorationObjects ||= wanted.map((symbol,i)=>({symbol,x:76+i*7,y:16,scale:1})); return s.decorationObjects; }
  function symbolsPanel(){
    const s=slide(), items=symbolObjects(s);
    const list = items.map((o,i)=>`<li><span class="kc-symbol-list-glyph">${o.symbol}</span><input data-symbol-scale="${i}" type="range" min=".3" max="3" step=".1" value="${o.scale||1}"><button type="button" class="danger" data-symbol-remove="${i}">✕</button></li>`).join('');
    return `<section class="kc-property-section"><h4>Symbol-Bibliothek</h4><small>Symbol auf die Folie ziehen, oder anklicken zum Hinzufügen</small><div class="tv-decoration-library">${symbolOptions.map(x=>`<button type="button" data-symbol="${x}">${x}</button>`).join('')}</div></section>
<section class="kc-property-section"><h4>Platzierte Symbole</h4><small>Auf der Folie einzeln verschiebbar und über den Eckpunkt skalierbar; hier zusätzlich Größe einstellen oder entfernen.</small>${items.length?`<ul class="kc-symbols-list">${list}</ul>`:'<small>Noch keine Symbole auf dieser Folie.</small>'}</section>
${entranceSection('symbols')}`;
  }
  function weatherPanel(p){
    const w=global.KCGetTVPresentation?.()?.weather||{}; const style=surfaceStyle('weather')||{};
    return `<section class="kc-property-section"><h4>Wetterkarten</h4><div class="kc-ue-grid"><label>Ort<input data-weather="location" value="${esc(w.location||'')}"></label><label>Tage<select data-weather="days">${options([['0','Aus'],['1','1 Tag'],['2','2 Tage'],['3','3 Tage'],['5','5 Tage'],['7','7 Tage'],['10','10 Tage'],['14','14 Tage']],String(w.days??3))}</select></label><label>Quelle<select data-weather="source">${options([['online','Online'],['manual','Manuell / Offline']],w.source||'online')}</select></label><label>Aktualisierung<select data-weather="refresh">${options([['30','30 Minuten'],['60','60 Minuten'],['180','3 Stunden']],String(w.refresh??60))}</select></label></div></section>
<section class="kc-property-section"><h4>Fläche</h4><div class="kc-ue-grid"><label>Darstellung<select data-surface="surfaceMode">${options([['transparent','Transparent'],['glass','Glasrückwand'],['solid','Farbig ausgefüllt']],style.surfaceMode||'transparent')}</select></label><label>Farbe<input data-surface="surfaceColor" type="color" value="${style.surfaceColor||'#173765'}"></label><label>Deckkraft<input data-surface="surfaceOpacity" type="range" min="0" max="1" step=".05" value="${style.surfaceOpacity??.7}"></label></div></section>
${entranceSection('weather')}${commonGeometry(p)}`;
  }
  function imagePanel(p){
    const s=slide(), media=s.media||{};
    return `<section class="kc-property-section"><h4>Bild</h4><label class="kc-wm-file-button">Bild wählen / austauschen<input type="file" accept="image/*" data-image-upload></label>${media.name?`<small>Aktuell: ${esc(media.name)}</small>`:'<small>Kein Bild ausgewählt</small>'}</section>
<section class="kc-property-section"><h4>Zuschnitt &amp; Skalierung</h4><div class="kc-ue-grid"><label>Bildausschnitt<select data-image="fit">${options([['cover','Füllen (beschneiden)'],['contain','Ganz einpassen']],(slide().objectStyles?.image?.fit)||'cover')}</select></label></div></section>
${frameSection('image')}${entranceSection('image')}${commonGeometry(p)}`;
  }
  function designObjectPanel(key,p){
    const d=design(slide()), o=d[key]||{};
    return `<section class="kc-property-section"><h4>${key==='banner'?'Banner':'Form'}</h4><label>Text<input data-design-object="text" value="${esc(o.text||'')}"></label><label>Darstellung<select data-design-object="type">${options(Object.entries(key==='banner'?(global.KCDesignCorePresentation?.banners||{}):(global.KCDesignCorePresentation?.shapes||{})),o.type||'none')}</select></label></section>${frameSection(key)}${entranceSection(key)}${commonGeometry(p)}`;
  }
  function visibleObjects(){
    const s=slide(); if(!s) return [];
    const list=[]; const optional=new Set(['ticker','weather','banner','shape','image']);
    for(const key of Object.keys(defaults)){
      if(key==='table'||key==='symbols') continue;
      if(optional.has(key)){ if(s.objectVisibility?.[key]!==true) continue; } else if(s.objectVisibility?.[key]===false) continue;
      const p=s.layout?.[key]; if(!p) continue; list.push({key,label:labelFor(key),z:p.z||10});
    }
    if((s.decorations||[]).length) list.push({key:'symbols',label:`Symbole (${s.decorations.length})`,z:s.layout?.symbols?.z||10});
    for(const item of (s.customTextObjects||[])) list.push({key:`customText:${item.id}`,label:item.text?`Text: ${item.text.slice(0,18)}`:'Freies Textfeld',z:item.layout?.z||10});
    return list.sort((a,b)=>b.z-a.z);
  }
  function layersSection(){
    const items=visibleObjects(); if(!items.length) return '<section class="kc-property-section kc-layers-section"><h4>Ebenen</h4><small>Noch keine Objekte auf dieser Folie.</small></section>';
    return `<section class="kc-property-section kc-layers-section"><h4>Ebenen</h4><ul class="kc-layers-list">${items.map((item,i)=>`<li data-layer-key="${esc(item.key)}" class="${item.key===active?'active':''}"><button type="button" class="kc-layer-select">${esc(item.label)}</button><span class="kc-layer-buttons"><button type="button" class="kc-layer-up" ${i===0?'disabled':''} title="Eine Ebene nach vorne">▲</button><button type="button" class="kc-layer-down" ${i===items.length-1?'disabled':''} title="Eine Ebene nach hinten">▼</button></span></li>`).join('')}</ul></section>`;
  }
  const themes = {
    'weihnacht-gold':{label:'Weihnacht Gold',background:{color1:'#1a1005',color2:'#3a2308',angle:135},font:'serif',frame:'gold',transition:'star'},
    'eisblau':{label:'Eisblau',background:{color1:'#0b1f33',color2:'#0a3a52',angle:120},font:'humanist',frame:'ice',transition:'snow'},
    'rustikal':{label:'Rustikal',background:{color1:'#2b1c10',color2:'#4a2f18',angle:150},font:'handwritten',frame:'wood',transition:'wipe'},
    'modern-minimal':{label:'Modern Minimal',background:{color1:'#10151d',color2:'#1c2733',angle:180},font:'condensed',frame:'custom',transition:'fade'},
    'sommerfest':{label:'Sommerfest',background:{color1:'#123d2e',color2:'#1f6e4f',angle:140},font:'rounded',frame:'custom',transition:'zoom'}
  };
  function applyTheme(id){
    const theme=themes[id]; const s=slide(); if(!theme||!s) return;
    const d=design(s); d.background=Object.assign(d.background||{},theme.background);
    d.typography ||= {}; for(const key of ['title','text','price']) d.typography[`${key}FontFamily`]=theme.font;
    d.transition=Object.assign(d.transition||{},{type:theme.transition,duration:d.transition?.duration||800});
    if(theme.frame!=='custom'){ const style=frameStyle('title'); if(style){ Object.assign(style,framePresetValues[theme.frame],{frame:true,preset:theme.frame}); } }
    save(true); global.renderTvPreview?.(); render();
  }
  function themesSection(){
    return `<section class="kc-property-section kc-themes-section"><h4>Gestaltungs-Vorlagen</h4><small>Setzt Hintergrund, Schriftart, Rahmen der Überschrift und Übergang gemeinsam.</small><div class="kc-format-buttons kc-draw-grid">${Object.entries(themes).map(([id,t])=>`<button type="button" data-theme="${id}">${t.label}</button>`).join('')}</div></section>`;
  }
  function slidePanel(){
    const s=slide(), d=design(s);
    const restoreButtons = Object.keys(restoreLabels).map(key=>{const [icon,label]=restoreLabels[key]; return `<button type="button" data-draw-object="${key}">${icon} ${label}</button>`;}).join('');
    const transitions = [
      ['fade','Überblenden'],['slide','Weich schieben'],['zoom','Sanfter Zoom'],['wipe','Wischen'],['flip','Flip'],
      ['light','Lichtblende'],['star','Sternenblende'],['snow','Schneeblende'],['blur','Unschärfe'],['pan','Schwenk'],['none','Keiner']
    ];
    return `<section class="kc-property-section"><h4>Rahmen aufziehen / Objekt einsetzen</h4><small>Typ wählen, dann mit gedrückter Maustaste auf der Folie einen Rahmen aufziehen – oder einfach klicken für Standardgröße.</small><div class="kc-format-buttons kc-draw-grid">${restoreButtons}<button type="button" data-draw-object="customText">✎ Freies Textfeld</button></div></section>
${layersSection()}
${themesSection()}
<section class="kc-property-section"><h4>Hintergrund</h4><div class="kc-ue-grid"><label>Farbe 1<input data-slide-design="color1" type="color" value="${d.background?.color1||'#173765'}"></label><label>Farbe 2<input data-slide-design="color2" type="color" value="${d.background?.color2||'#10243a'}"></label><label>Verlaufswinkel <o>${d.background?.angle??135}°</o><input data-slide-design="angle" type="range" min="0" max="360" value="${d.background?.angle??135}"></label></div></section>
<section class="kc-property-section"><h4>Folie</h4><div class="kc-ue-grid"><label>Anzeigedauer<input data-slide="duration" type="number" min="3" max="120" value="${s.duration||8}"></label></div><label class="check"><input data-slide="enabled" type="checkbox" ${s.enabled!==false?'checked':''}> Folie aktiv</label></section>
${effectsSection()}
<section class="kc-property-section kc-transition-editor"><h4>Übergang zur Folie</h4><div class="kc-ue-grid"><label>Effekt<select data-transition="type">${options(transitions,d.transition?.type||'fade')}</select></label><label>Dauer <o>${d.transition?.duration||800} ms</o><input data-transition="duration" type="range" min="300" max="1800" step="100" value="${d.transition?.duration||800}"></label></div><button type="button" data-test-transition>▶ Übergang testen</button></section>`;
  }

  /* ---------- Rendern ---------- */
  function render(){
    const container=box(), s=slide(); if(!container||!s) return;
    if(selection.size>1) return renderMultiSelect(container);
    const definition=global.KCPropertyCore?.open?.(active);
    const p = active==='slide' ? null : state(active);
    updating=true;
    let body;
    if(active==='slide') body=slidePanel();
    else if(textKeys.has(active)||isCustomText(active)) body=textPanel(active,p);
    else if(active==='ticker') body=tickerPanel(p);
    else if(active==='symbols') body=symbolsPanel();
    else if(active==='weather') body=weatherPanel(p);
    else if(active==='image') body=imagePanel(p);
    else if(['banner','shape'].includes(active)) body=designObjectPanel(active,p);
    else body=commonGeometry(p);
    container.innerHTML = `<section class="kc-unified-properties" data-active-object="${esc(active)}"><header><div><strong>${definition?.label||'Folie bearbeiten'}</strong></div>${active!=='slide'?'<button type="button" data-reset>↺ Position</button>':''}</header>${body}<div class="kc-ue-actions">${(textKeys.has(active)||active==='ticker'||isCustomText(active))?'<button type="button" data-direct-edit>✎ Direkt auf der Folie schreiben</button>':''}<button type="button" data-auto-layout>Überlappungen automatisch ordnen</button>${active!=='slide'?'<button type="button" data-front>Nach vorne</button><button type="button" data-back>Nach hinten</button><button type="button" class="danger" data-delete-object>⌫ Objekt löschen/leeren</button>':''}</div><div class="kc-ue-layout-status"></div></section>`;
    bindProperties(container,p); updateLayoutStatus(); updating=false;
    if(active==='ticker') global.KCTVDisplayMatrixAdapter?.refresh?.();
  }
  function labelFor(key){ return isCustomText(key)?'Freies Textfeld':(restoreLabels[key]?.[1]||global.KCPropertyCore?.describe?.(key)?.label||key); }
  function renderMultiSelect(container){
    updating=true; const keys=[...selection];
    container.innerHTML = `<section class="kc-unified-properties" data-active-object="multi"><header><div><strong>Mehrfachauswahl (${keys.length} Objekte)</strong></div><button type="button" data-clear-selection>Auswahl aufheben</button></header>
<section class="kc-property-section"><h4>Ausgewählt</h4><ul class="kc-multi-list">${keys.map(k=>`<li>${labelFor(k)}</li>`).join('')}</ul></section>
<section class="kc-property-section"><h4>Ausrichten</h4><div class="kc-format-buttons"><button type="button" data-align="left">Links</button><button type="button" data-align="hcenter">Zentriert (waag.)</button><button type="button" data-align="right">Rechts</button><button type="button" data-align="top">Oben</button><button type="button" data-align="vcenter">Zentriert (senk.)</button><button type="button" data-align="bottom">Unten</button></div></section>
<section class="kc-property-section"><h4>Gemeinsam</h4><label>Deckkraft <o id="kcMultiOpacityOut">100 %</o><input data-multi-opacity type="range" min=".1" max="1" step=".05" value="1"></label><div class="kc-format-buttons"><button type="button" data-multi-front>Alle nach vorne</button><button type="button" data-multi-back>Alle nach hinten</button><button type="button" class="danger" data-multi-delete>⌫ Auswahl löschen</button></div></section></section>`;
    container.querySelector('[data-clear-selection]').onclick=()=>select('slide',stage());
    container.querySelectorAll('[data-align]').forEach(button=>button.onclick=()=>{ alignSelection(button.dataset.align); });
    container.querySelector('[data-multi-opacity]').oninput=e=>{ const v=+e.target.value; keys.forEach(k=>{ const p=state(k); if(p){ p.opacity=v; applyGeometry(stage()?.querySelector(`[data-tv-object="${CSS.escape(k)}"]`),p); } }); container.querySelector('#kcMultiOpacityOut').textContent=`${Math.round(v*100)} %`; save(); global.renderTvPreview?.(); };
    container.querySelector('[data-multi-front]').onclick=()=>{ keys.forEach(k=>{ const p=state(k); if(p) p.z=Math.max(1,(p.z||10)+1); }); save(); global.renderTvPreview?.(); render(); };
    container.querySelector('[data-multi-back]').onclick=()=>{ keys.forEach(k=>{ const p=state(k); if(p) p.z=Math.max(1,(p.z||10)-1); }); save(); global.renderTvPreview?.(); render(); };
    container.querySelector('[data-multi-delete]').onclick=()=>{ const s=slide(); keys.forEach(k=>{ if(isCustomText(k)){ const id=String(k).slice(11); s.customTextObjects=(s.customTextObjects||[]).filter(item=>item.id!==id); } else { s.objectVisibility||={}; s.objectVisibility[k]=false; } }); save(true); global.renderTvPreview?.(); select('slide',stage()); };
    updating=false;
  }
  function alignSelection(mode){
    const keys=[...selection]; const boxes=keys.map(k=>({key:k,p:state(k)})).filter(x=>x.p); if(!boxes.length) return;
    const left=Math.min(...boxes.map(b=>b.p.x-b.p.w/2)), right=Math.max(...boxes.map(b=>b.p.x+b.p.w/2));
    const top=Math.min(...boxes.map(b=>b.p.y-b.p.h/2)), bottom=Math.max(...boxes.map(b=>b.p.y+b.p.h/2));
    for(const {key,p} of boxes){
      if(mode==='left') p.x=left+p.w/2; if(mode==='right') p.x=right-p.w/2; if(mode==='hcenter') p.x=(left+right)/2;
      if(mode==='top') p.y=top+p.h/2; if(mode==='bottom') p.y=bottom-p.h/2; if(mode==='vcenter') p.y=(top+bottom)/2;
      applyGeometry(stage()?.querySelector(`[data-tv-object="${CSS.escape(key)}"]`),p);
    }
    save(); global.renderTvPreview?.();
  }
  function inputValue(input){ return input.type==='checkbox'?input.checked:(input.type==='range'||input.type==='number'?+input.value:input.value); }
  function bindProperties(container,p){
    container.querySelectorAll('[data-layout]').forEach(input=>input.oninput=()=>{ p[input.dataset.layout]=inputValue(input); global.KCSmartLayoutCore?.normalize?.(p); apply(stage()?.querySelector(`[data-tv-object="${CSS.escape(active)}"]`),p,active); save(); syncGeometry(); updateLayoutStatus(); });
    container.querySelectorAll('[data-content]').forEach(input=>input.oninput=()=>{
      const key=input.dataset.content;
      if(isCustomText(key)){ const item=customTextItem(key); if(item) item.text=input.value; }
      else slide()[key]=input.value;
      const node=stage()?.querySelector(`[data-tv-object="${CSS.escape(key)}"]`); const target=key==='ticker'?(node?.querySelector('span')||node):node; if(target) target.textContent=input.value; save();
      if(target&&(textKeys.has(key)||isCustomText(key))) applyAutoFit(target,key);
    });
    container.querySelector('[data-text-autofit]')?.addEventListener('change',e=>{ const t=textState(active); t.autoFit=e.target.checked; applyTextStyle(stage()?.querySelector(`[data-tv-object="${CSS.escape(active)}"]`),active); save(); global.renderTvPreview?.(); });
    container.querySelectorAll('[data-text]').forEach(input=>input.oninput=()=>{ const t=textState(active); t[input.dataset.text]=inputValue(input); applyTextStyle(stage()?.querySelector(`[data-tv-object="${CSS.escape(active)}"]`),active); save(); global.renderTvPreview?.(); });
    container.querySelectorAll('[data-ticker]').forEach(input=>input.oninput=()=>{ const t=tickerState(); t[input.dataset.ticker]=inputValue(input); apply(stage()?.querySelector('[data-tv-object="ticker"]'),p,'ticker'); save(); global.renderTvPreview?.(); });
    container.querySelector('[data-ticker-visible]')?.addEventListener('change',e=>{ slide().objectVisibility.ticker=e.target.checked; save(); global.renderTvPreview?.(); });
    container.querySelector('[data-ticker-source]')?.addEventListener('change',e=>{ const s=slide(); s.tickerSource.mode=e.target.value; refreshTickerContent(s); save(); render(); global.renderTvPreview?.(); });
    container.querySelectorAll('[data-symbol]').forEach(button=>button.onclick=()=>{
      const s=slide(),symbol=button.dataset.symbol; s.decorations||=[]; s.decorations.push(symbol);
      const items=symbolObjects(s); items.push({symbol,x:30+Math.random()*40,y:20+Math.random()*40,scale:1});
      save(true); global.renderTvPreview?.(); render();
    });
    container.querySelectorAll('[data-symbol-scale]').forEach(input=>input.oninput=()=>{
      const s=slide(), items=symbolObjects(s), i=+input.dataset.symbolScale; if(!items[i]) return; items[i].scale=+input.value;
      const node=stage()?.querySelectorAll('.kc-symbol-object')?.[i]; if(node) node.style.setProperty('--symbol-scale',items[i].scale);
      save(); global.renderTvPreview?.();
    });
    container.querySelectorAll('[data-symbol-remove]').forEach(button=>button.onclick=()=>{
      const s=slide(), items=symbolObjects(s), i=+button.dataset.symbolRemove; if(!items[i]) return;
      const removed=items[i].symbol; const pos=s.decorations.indexOf(removed); if(pos>-1) s.decorations.splice(pos,1);
      items.splice(i,1); save(true); global.renderTvPreview?.(); render();
    });
    container.querySelectorAll('[data-weather]').forEach(input=>input.onchange=()=>{ const w=global.KCGetTVPresentation().weather; w[input.dataset.weather]=['days','refresh'].includes(input.dataset.weather)?+input.value:input.value; save(); });
    container.querySelectorAll('[data-design-object]').forEach(input=>input.oninput=()=>{ const d=design(slide()); d[active][input.dataset.designObject]=input.value; save(); });
    container.querySelectorAll('[data-frame]').forEach(input=>input.oninput=()=>{
      const style=frameStyle(active); const field=input.dataset.frame;
      if(field==='preset'){ style.preset=input.value; if(framePresetValues[input.value]){ Object.assign(style,framePresetValues[input.value]); style.frame=true; render(); } }
      else { style[field]=input.type==='checkbox'?input.checked:(input.type==='range'?+input.value:input.value); if(field!=='preset') style.preset='custom'; }
      apply(stage()?.querySelector(`[data-tv-object="${CSS.escape(active)}"]`),p,active); save(); global.renderTvPreview?.();
    });
    container.querySelectorAll('[data-surface]').forEach(input=>input.oninput=()=>{ const style=surfaceStyle(active==='weather'?'weather':active); style[input.dataset.surface]=input.type==='range'?+input.value:input.value; if(active!=='weather') applySurface(stage()?.querySelector(`[data-tv-object="${CSS.escape(active)}"]`),active); save(); global.renderTvPreview?.(); });
    container.querySelectorAll('[data-slide]').forEach(input=>input.onchange=()=>{ slide()[input.dataset.slide]=inputValue(input); save(); global.renderTvPreview?.(); });
    container.querySelectorAll('[data-slide-design]').forEach(input=>input.oninput=()=>{ const d=design(slide()); d.background||={}; d.background[input.dataset.slideDesign]=input.dataset.slideDesign==='angle'?+input.value:input.value; save(); global.renderTvPreview?.(); });
    container.querySelectorAll('[data-layer-key]').forEach(li=>{
      const key=li.dataset.layerKey;
      li.querySelector('.kc-layer-select').onclick=()=>select(key,stage()?.querySelector(`[data-tv-object="${CSS.escape(key)}"]`));
      li.querySelector('.kc-layer-up').onclick=()=>reorderLayer(key,1);
      li.querySelector('.kc-layer-down').onclick=()=>reorderLayer(key,-1);
    });
    container.querySelectorAll('[data-theme]').forEach(button=>button.onclick=()=>applyTheme(button.dataset.theme));
    container.querySelectorAll('[data-draw-object]').forEach(button=>button.onclick=()=>armDraw(button.dataset.drawObject));
    container.querySelector('[data-image-upload]')?.addEventListener('change',event=>{ const file=event.target.files[0]; if(!file) return; const reader=new FileReader(); reader.onload=()=>{ slide().media={name:file.name,type:file.type,dataUrl:reader.result}; save(true); global.renderTvPreview?.(); render(); }; reader.readAsDataURL(file); });
    container.querySelector('[data-image="fit"]')?.addEventListener('change',e=>{ const s=slide(); s.objectStyles||={}; s.objectStyles.image||={}; s.objectStyles.image.fit=e.target.value; save(); global.renderTvPreview?.(); });
    container.querySelectorAll('[data-entrance]').forEach(input=>input.oninput=()=>{
      const e=entranceStyle(active); if(!e) return; const field=input.dataset.entrance;
      e[field]=field==='type'?input.value:+input.value;
      const output=input.closest('label')?.querySelector('o'); if(output) output.textContent=`${input.value} ms`;
      save();
    });
    container.querySelector('[data-entrance-preview]')?.addEventListener('click',()=>playEntrance(stage()?.querySelector(`[data-tv-object="${CSS.escape(active)}"]`),entranceStyle(active)));
    container.querySelector('[data-direct-edit]')?.addEventListener('click',()=>editText(stage()?.querySelector(`[data-tv-object="${CSS.escape(active)}"]`)));
    container.querySelector('[data-reset]')?.addEventListener('click',()=>{ if(defaults[active]){ Object.assign(p,{...defaults[active]}); global.renderTvPreview?.(); save(); } });
    container.querySelector('[data-auto-layout]')?.addEventListener('click',()=>{ autoArrange(); global.renderTvPreview?.(); save(); });
    container.querySelector('[data-front]')?.addEventListener('click',()=>setZ(1));
    container.querySelector('[data-back]')?.addEventListener('click',()=>setZ(-1));
    container.querySelector('[data-delete-object]')?.addEventListener('pointerup',()=>deleteActive());
    container.querySelectorAll('[data-effect]').forEach(input=>{
      input.addEventListener('pointerdown',e=>e.stopPropagation()); input.addEventListener('pointermove',e=>e.stopPropagation());
      input.addEventListener('input',()=>{
        const e=effectsState(); if(!e) return; const key=input.dataset.effect;
        if(key==='type') slide().animation=input.value; else e[key]=+input.value;
        const output=input.closest('label')?.querySelector('o'); if(output){ const n=+input.value; output.textContent = key==='speed'?`${n.toFixed(2)}×`:key==='density'?String(Math.round(n)):key==='size'?`${n.toFixed(1)}×`:key==='opacity'?`${Math.round(n*100)} %`:input.value; }
        updateEffectLayer(); save();
      });
    });
    container.querySelectorAll('[data-transition]').forEach(input=>input.oninput=()=>{ const d=design(slide()); d.transition||={}; d.transition[input.dataset.transition]=input.dataset.transition==='duration'?+input.value:input.value; const output=input.parentElement.querySelector('o'); if(output) output.textContent=`${d.transition.duration} ms`; save(); });
    container.querySelector('[data-test-transition]')?.addEventListener('click',()=>{ const node=stage(),d=design(slide()),name=`transition-${d.transition?.type||'fade'}`; if(!node) return; [...node.classList].filter(x=>x.startsWith('transition-')).forEach(x=>node.classList.remove(x)); void node.offsetWidth; node.classList.add(name); });
  }
  function reorderLayer(key,direction){
    const items=visibleObjects(); const index=items.findIndex(x=>x.key===key); if(index===-1) return;
    const neighborIndex=index-direction; if(neighborIndex<0||neighborIndex>=items.length) return;
    const a=state(key), b=state(items[neighborIndex].key); if(!a||!b) return;
    const az=a.z||10, bz=b.z||10; a.z=bz; b.z=az;
    apply(stage()?.querySelector(`[data-tv-object="${CSS.escape(key)}"]`),a,key);
    apply(stage()?.querySelector(`[data-tv-object="${CSS.escape(items[neighborIndex].key)}"]`),b,items[neighborIndex].key);
    save(); global.renderTvPreview?.(); render();
  }
  function deleteActive(){
    if(active==='slide') return; const s=slide();
    if(isCustomText(active)){ const id=String(active).slice(11); s.customTextObjects=(s.customTextObjects||[]).filter(item=>item.id!==id); }
    else {
      s.objectVisibility||={};
      s.objectVisibility[active]=false;
      if(['title','text','price','ticker'].includes(active)){ s[active]=''; }
      else if(active==='banner'||active==='shape'){ s.presentationDesign||={}; s.presentationDesign[active]={type:'none',text:''}; }
      else if(active==='weather'){ if(s.type==='weather') s.type='notice'; }
      else if(active==='symbols'){ s.decorations=[]; s.decorationObjects=[]; }
      else if(active==='image'){ delete s.media; }
      else if(active==='table'){ delete s.tableObject; delete s.catalogTable; }
    }
    save(true); global.renderTvPreview?.(); select('slide',stage());
  }
  function setZ(delta){ const p=state(active); if(!p) return; p.z=Math.max(1,(p.z||10)+delta); apply(stage()?.querySelector(`[data-tv-object="${CSS.escape(active)}"]`),p,active); save(); }
  function autoArrange(){
    const s=slide(); s.layout||={}; const layout=s.layout;
    for(const key of Object.keys(defaults)) if(layout[key]) global.KCSmartLayoutCore?.normalize?.(layout[key],5);
    const presets={title:defaults.title,text:defaults.text,price:defaults.price,symbols:defaults.symbols,ticker:defaults.ticker,weather:defaults.weather};
    let pairs=global.KCSmartLayoutCore?.inspect?.(layout)||[]; const touched=new Set(pairs.flat());
    for(const key of touched) if(presets[key]) Object.assign(layout[key],{...presets[key],z:layout[key].z||10});
    return global.KCSmartLayoutCore?.inspect?.(layout)||[];
  }
  function updateLayoutStatus(){
    const node=document.querySelector('.kc-ue-layout-status'), pairs=global.KCSmartLayoutCore?.inspect?.(slide()?.layout||{})||[]; if(!node) return;
    node.className=`kc-ue-layout-status ${pairs.length?'warn':'ok'}`;
    node.textContent = pairs.length ? `${pairs.length} Überlappung(en): ${pairs.map(x=>x.join(' / ')).join(', ')}` : 'Keine deutliche Objektüberlappung erkannt.';
  }
  function syncGeometry(){
    document.querySelectorAll('.kc-unified-properties [data-layout]').forEach(input=>{
      const p=state(active); if(p && document.activeElement!==input){ input.value=p[input.dataset.layout];
        const output=input.parentElement.querySelector('o'); if(output) output.textContent = input.dataset.layout==='rotation'?`${Math.round(input.value)}°`:(input.dataset.layout==='opacity'||input.dataset.layout==='scale'?`${Math.round(input.value*100)} %`:`${Math.round(input.value)} %`); }
    });
  }

  /* ---------- Bindung an Bühne ---------- */
  function bind(){
    const st=stage(); if(!st||st.dataset.studioBound) return; st.dataset.studioBound='1';
    st.addEventListener('pointerdown',event=>{ const node=event.target.closest('[data-tv-object]'); if(node&&st.contains(node)&&(objectKeys.has(node.dataset.tvObject)||isCustomText(node.dataset.tvObject))) begin(event,node,event.target.closest('[data-ue-h]')?.dataset.ueH); },true);
    st.addEventListener('pointerdown',stagePointerDown,true);
    st.addEventListener('pointermove',move,true); st.addEventListener('pointermove',stagePointerMove,true);
    st.addEventListener('pointerup',end,true); st.addEventListener('pointerup',stagePointerUp,true);
    st.addEventListener('pointercancel',end,true); st.addEventListener('pointercancel',()=>cancelDraw(),true);
    st.addEventListener('click',event=>{ const node=event.target.closest('.kc-symbol-object'); if(node){ event.preventDefault(); event.stopPropagation(); select('symbols',node); } },true);
    st.addEventListener('dblclick',event=>{ const node=event.target.closest('[data-tv-object]'); if(node&&(textKeys.has(node.dataset.tvObject)||node.dataset.tvObject==='ticker'||isCustomText(node.dataset.tvObject))){ event.preventDefault(); event.stopImmediatePropagation(); editText(node); } },true);
    st.addEventListener('focusout',event=>finishText(event.target),true);
    document.addEventListener('keydown',event=>{ if(event.key==='Escape'){ if(drawing) cancelDraw(); else if(selection.size>1) select('slide',stage()); } },true);
  }
  function queueRefresh(){
    if(refreshQueued||updating) return; const focused=document.activeElement;
    if(focused?.closest?.(`#${EDITOR_ID} [data-content]`)) return;
    refreshQueued=true; requestAnimationFrame(()=>{ refreshQueued=false; if(document.activeElement?.closest?.(`#${EDITOR_ID} [data-content]`)) return; bind(); decorate(); render(); });
  }
  function hookEntrancePlayback(){
    const previous = global.renderSlideInto;
    if(typeof previous!=='function' || previous.__kcEntranceHooked) return;
    const wrapped = function(screen,slideArg){
      const result = previous.apply(this,arguments);
      try{
        if(screen && slideArg && screen.dataset.kcEntranceSlide!==String(slideArg.id||'')){
          screen.dataset.kcEntranceSlide=String(slideArg.id||'');
          for(const key of Object.keys(defaults)){
            const style=slideArg.objectStyles?.[key]?.entrance; if(!style||style.type==='none') continue;
            const node=screen.querySelector(`[data-tv-object="${CSS.escape(key)}"]`); if(node) playEntrance(node,style);
          }
        }
      } catch(error){ console.error('KC Objekt-Studio: Erscheinungs-Animation konnte nicht abgespielt werden:',error); }
      return result;
    };
    wrapped.__kcEntranceHooked = true;
    global.renderSlideInto = wrapped;
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{
    const st=stage();
    if(st){ observer=new MutationObserver(mutations=>{ if(!updating&&mutations.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&!n.classList?.contains('kc-ue-handles')))) queueRefresh(); }); observer.observe(st,{childList:true}); }
    hookEntrancePlayback();
    queueRefresh();
  },300));

  global.KCObjectStudio = { version:VERSION, refresh:queueRefresh, select, render, renderProperties:render, deleteActive, autoArrange, armDraw, get active(){return active;} };
  global.KCUnifiedEditor = global.KCObjectStudio; // Rückwärtskompatibilität für Kontextmenü, Zwischenablage, Editor-Workflow
  global.KCReleaseManifest?.register?.('kcObjectStudio', VERSION);
})(window);
