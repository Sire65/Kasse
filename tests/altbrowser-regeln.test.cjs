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
console.log(fehler?`\n${fehler} FEHLER`:'\nAlles OK');process.exit(fehler?1:0);
