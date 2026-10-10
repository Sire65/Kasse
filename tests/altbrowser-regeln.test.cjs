/* Regeln fuer alte Browser (Befund 30.09.2026, Samsung-Tablet SM-T535 / Samsung-Browser, nachgestellt
   mit echtem Chromium 83): leere Bildkacheln, unsichtbares Parken-Fenster, Startfenster ausserhalb des
   Bildschirms. Ursache: CSS "inset" (erst ab Chrome 87) und JS-Funktionen wie .at() (ab 92).
   Dieser Test haelt die Regeln fest, damit neue Aenderungen das nicht wieder einschleppen:
   1. Vor jeder "inset:"-Angabe steht die ausgeschriebene Form top/right/bottom/left.
   2. kc-altbrowser.js wird in Kasse und Schulung als ERSTES Skript geladen und ist offline gespeichert.
   3. Die Nachruestung tut auf aktuellen Browsern nichts und ergaenzt auf alten die fehlenden Funktionen. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const W=path.join(__dirname,'..');
let fehler=0;const pruefe=(n,b,z='')=>{console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'  ['+z+']':''}`);if(!b)fehler++};
const INSET=/(?<![-\w])inset\s*:\s*([^;{}"'`]+?)(\s*!important)?\s*(?=[;}"'`])/g;
for(const base of ['pos','schulung/pos']){
  const dateien=fs.readdirSync(path.join(W,base)).filter(f=>/\.(css|js)$/.test(f)).map(f=>path.join(base,f));
  const ohne=[];
  for(const d of dateien){
    const s=fs.readFileSync(path.join(W,d),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
    let m;INSET.lastIndex=0;
    while((m=INSET.exec(s))){const davor=s.slice(Math.max(0,m.index-80),m.index);if(!/left:[^;]*;\s*$/.test(davor))ohne.push(`${d}: ${m[0].slice(0,40)}`)}
  }
  pruefe(`${base}: jede inset-Angabe hat die ausgeschriebene Form davor`,ohne.length===0,ohne.slice(0,5).join(' | '));
  const html=fs.readFileSync(path.join(W,base,'index.html'),'utf8');
  const erstesSkript=(html.match(/<script[^>]*\ssrc="([^"]+)"/)||[])[1]||'';
  pruefe(`${base}: kc-altbrowser.js ist das erste Skript`,/^kc-altbrowser\.js/.test(erstesSkript),erstesSkript);
  const sw=fs.readFileSync(path.join(W,base,'service-worker.js'),'utf8');
  pruefe(`${base}: kc-altbrowser.js ist offline gespeichert`,/"\.\/kc-altbrowser\.js\?build=[^"]+"/.test(sw));
}
pruefe('Live und Schulung haben dieselbe Nachrüstung',fs.readFileSync(path.join(W,'pos/kc-altbrowser.js'),'utf8')===fs.readFileSync(path.join(W,'schulung/pos/kc-altbrowser.js'),'utf8'));
// 3. Verhalten: aktueller Browser (Node hat alles) -> nichts nachgeruestet
const quelle=fs.readFileSync(path.join(W,'pos/kc-altbrowser.js'),'utf8');
{const win={structuredClone:()=>0};const ctx={window:win,Array,String,Object,Math,JSON,AbortSignal,AbortController,setTimeout,Element:function(){},document:{}};ctx.Element.prototype={replaceChildren(){}};vm.runInNewContext(quelle,ctx);
 pruefe('Aktueller Browser: nichts wird nachgerüstet',Array.isArray(win.KC_ALTBROWSER_NACHGERUESTET)&&win.KC_ALTBROWSER_NACHGERUESTET.length===0,JSON.stringify(win.KC_ALTBROWSER_NACHGERUESTET));}
// Alter Browser: eigene, "nackte" Prototypen ohne die neuen Funktionen
{const A=function(){};A.prototype=Object.create(Array.prototype);const Anackt={prototype:{}};const Snackt=function(x){return String(x)};Snackt.prototype={split:String.prototype.split};
 const win={};const ctx={window:win,Array:Anackt,String:Snackt,Object:{prototype:Object.prototype,defineProperty:Object.defineProperty},Math,JSON,AbortSignal:{},AbortController,setTimeout,Element:function(){},document:{createTextNode:t=>t}};ctx.Element.prototype={};
 vm.runInNewContext(quelle,ctx);
 const n=win.KC_ALTBROWSER_NACHGERUESTET||[];
 pruefe('Alter Browser: at, replaceAll, hasOwn, AbortSignal.timeout, structuredClone, replaceChildren nachgerüstet',['at','replaceAll','hasOwn','timeout','structuredClone','replaceChildren'].every(x=>n.includes(x)),n.join(', '));
 const at=Anackt.prototype.at;pruefe('Nachgerüstetes .at(-1) liefert das letzte Element',at.call([1,2,3],-1)===3&&at.call([1,2,3],5)===undefined);
 const ra=Snackt.prototype.replaceAll;pruefe('Nachgerüstetes replaceAll ersetzt alle Vorkommen',ra.call('a-b-c','-','+')==='a+b+c');
 const sig=ctx.AbortSignal.timeout(10);pruefe('Nachgerüstetes AbortSignal.timeout liefert ein Signal',sig&&typeof sig.aborted==='boolean');}
// 4. Kleine Artikelbilder fuer alte Tablets (30.09.2026: "sehr sehr langsam bauen sich die Bilder")
for(const base of ['pos','schulung/pos']){
  const quellen=['app.js','images-v3.js'].map(f=>fs.readFileSync(path.join(W,base,f),'utf8')).join('\n');
  const namen=[...new Set([...quellen.matchAll(/assets\/([\w-]+_version_3)\.png/g)].map(m=>m[1]))];
  const sw=fs.readFileSync(path.join(W,base,'service-worker.js'),'utf8');
  const fehlt=namen.filter(n=>!fs.existsSync(path.join(W,base,'assets/klein',n+'.webp')));
  const nichtOffline=namen.filter(n=>!sw.includes(`"./assets/klein/${n}.webp"`));
  pruefe(`${base}: jedes grosse Artikelbild (${namen.length}) hat eine kleine Kopie`,namen.length>10&&!fehlt.length,fehlt.join(', '));
  pruefe(`${base}: kleine Kopien sind offline gespeichert`,!nichtOffline.length,nichtOffline.join(', '));
  const zuGross=namen.filter(n=>fs.existsSync(path.join(W,base,'assets/klein',n+'.webp'))&&fs.statSync(path.join(W,base,'assets/klein',n+'.webp')).size>150000);
  pruefe(`${base}: kleine Kopien sind wirklich klein (unter 150 KB)`,!zuGross.length,zuGross.join(', '));
  pruefe(`${base}: Ersatzschrift fuer fehlende Symbole ist da und offline gespeichert`,fs.existsSync(path.join(W,base,'assets/kc-emoji-ersatz.woff2'))&&sw.includes('"./assets/kc-emoji-ersatz.woff2"')&&/html\.kc-ohne-seitenverhaeltnis body\{[^}]*KC Emoji Ersatz/.test(fs.readFileSync(path.join(W,base,'kc-legacy-fallback.css'),'utf8')));
}
function baueDom(mitSeitenverhaeltnis,speicher){
  const log=[];
  function El(tag){this.tagName=tag;this.nodeType=1;this.attr={}}
  El.prototype.getAttribute=function(n){return n in this.attr?this.attr[n]:null};
  El.prototype.setAttribute=function(n,v){this.attr[n]=String(v)};
  El.prototype.getElementsByTagName=function(){return []};
  El.prototype.insertAdjacentHTML=function(wo,t){this.html=t};
  Object.defineProperty(El.prototype,'innerHTML',{configurable:true,get(){return this.html||''},set(t){this.html=t}});
  function Img(){El.call(this,'IMG')}Img.prototype=Object.create(El.prototype);
  Object.defineProperty(Img.prototype,'src',{configurable:true,get(){return this.getAttribute('src')},set(v){this.setAttribute('src',v)}});
  const root=new El('HTML');let fehlerHoerer=null;
  const win={CSS:{supports:()=>mitSeitenverhaeltnis},localStorage:speicher};
  const ctx={window:win,CSS:win.CSS,Array,String,Object,Math,JSON,AbortSignal,AbortController,setTimeout,Element:El,HTMLImageElement:Img,
    MutationObserver:function(){this.observe=()=>log.push('beobachtet')},
    document:{documentElement:root,addEventListener:(t,f)=>{if(t==='error')fehlerHoerer=f},createTextNode:t=>t}};
  vm.runInNewContext(quelle,ctx);
  return {win,El,Img,log,fehler:img=>fehlerHoerer&&fehlerHoerer({target:img})};
}
{const d=baueDom(false);
 const div=new d.El('DIV');
 div.innerHTML='<img class="x" src="assets/gluehwein_version_3.png" alt=""><input value="assets/gluehwein_version_3.png"><img src="assets/logo.png">';
 pruefe('Alter Browser: Kachel-HTML bekommt das kleine Bild',div.html.includes('src="assets/klein/gluehwein_version_3.webp"'),div.html);
 pruefe('Alter Browser: Eingabefelder/Daten bleiben unveraendert',div.html.includes('value="assets/gluehwein_version_3.png"')&&div.html.includes('src="assets/logo.png"'));
 const img=new d.Img();img.src='assets/rum_version_3.png';
 pruefe('Alter Browser: img.src = grosses Bild -> kleines Bild',img.getAttribute('src')==='assets/klein/rum_version_3.webp',img.getAttribute('src'));
 d.fehler(img);
 pruefe('Kleine Kopie fehlt -> grosses Bild kommt zurueck',img.getAttribute('src')==='assets/rum_version_3.png',img.getAttribute('src'));
 img.src='assets/rum_version_3.png';
 pruefe('Danach wird dieses Bild nicht mehr getauscht (keine Endlosschleife)',img.getAttribute('src')==='assets/rum_version_3.png');
 pruefe('Alter Browser: kleineBilder in der Diagnose',d.win.KC_ALTBROWSER_NACHGERUESTET.includes('kleineBilder'));}
// 10.10.2026 (Betreiber): kleine Bilder jetzt auf allen Geraeten; die grossen bleiben im Ordner und
// lassen sich per localStorage "kc.bilder"="gross" (ein Geraet) oder KLEINE_BILDER=false zurueckholen.
{const d=baueDom(true);
 const div=new d.El('DIV');div.innerHTML='<img src="assets/gluehwein_version_3.png">';
 const img=new d.Img();img.src='assets/rum_version_3.png';
 pruefe('Aktueller Browser: Kacheln bekommen ebenfalls das kleine Bild',div.html.includes('src="assets/klein/gluehwein_version_3.webp"')&&img.getAttribute('src')==='assets/klein/rum_version_3.webp',div.html);
 pruefe('Aktueller Browser: Diagnose meldet keine Altbrowser-Nachruestung',!d.win.KC_ALTBROWSER_NACHGERUESTET.includes('kleineBilder')&&d.win.KC_KLEINE_BILDER===true);}
{const d=baueDom(true,{getItem:k=>k==='kc.bilder'?'gross':null});
 const div=new d.El('DIV');const html='<img src="assets/gluehwein_version_3.png">';div.innerHTML=html;
 const img=new d.Img();img.src='assets/rum_version_3.png';
 pruefe('Schalter "kc.bilder"="gross": Bilder bleiben unveraendert gross',div.html===html&&img.getAttribute('src')==='assets/rum_version_3.png'&&!d.win.KC_KLEINE_BILDER);}
{const d=baueDom(false,{getItem:k=>k==='kc.bilder'?'gross':null});const img=new d.Img();img.src='assets/rum_version_3.png';
 pruefe('Alter Browser bekommt trotz Schalter die kleinen Bilder',img.getAttribute('src')==='assets/klein/rum_version_3.webp');}
for(const base of ['pos','schulung/pos']){
  const sw=fs.readFileSync(path.join(W,base,'service-worker.js'),'utf8');
  const gross=[...sw.matchAll(/"\.\/assets\/([\w-]+_version_3)\.png"/g)].map(m=>m[1]).filter(n=>fs.existsSync(path.join(W,base,'assets/klein',n+'.webp')));
  pruefe(`${base}: grosse Bilder mit kleiner Kopie werden nicht mehr vorab gespeichert`,!gross.length,gross.join(', '));
  const vorhanden=fs.readdirSync(path.join(W,base,'assets')).filter(f=>/_version_3\.png$/.test(f));
  pruefe(`${base}: grosse Bilder liegen weiterhin im Ordner (Rueckweg)`,vorhanden.length>=17,String(vorhanden.length));
}
console.log(fehler?`\n${fehler} FEHLER`:'\nAlles OK');process.exit(fehler?1:0);
