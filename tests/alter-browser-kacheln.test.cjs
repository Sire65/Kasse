/* Alte Browser ohne "aspect-ratio" (Befund 30.09.2026, Betreiber-Foto: Samsung-Tablet SM-T535,
   Samsung-Browser - die Bildkacheln fielen zu duennen Strichen zusammen).
   Simuliert wird ein solcher Browser: CSS.supports meldet aspect-ratio als unbekannt, und alle
   aspect-ratio-Regeln werden aus den Stylesheets entfernt. Geprueft in Live und Schulung, KC-Aufbau
   und neues Layout: jede Bildkachel ist sichtbar gross und das Bild darin nicht auf 0 geschrumpft.
   Zusaetzlich: ein normaler Browser bekommt die Kennzeichnung NICHT (dort aendert sich nichts). */
try{require.resolve('playwright')}catch(e){console.log('  ueberspringen: Playwright nicht installiert');process.exit(0)}
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const W=path.join(__dirname,'..');let fehler=0;const pruefe=(n,b,z='')=>{console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'  ['+z+']':''}`);if(!b)fehler++};const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const s=http.createServer((q,r)=>{const p=path.join(W,decodeURIComponent(q.url.split('?')[0]));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end('x')}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(d)})});
(async()=>{await new Promise(r=>s.listen(8903,r));const b=await chromium.launch();
// Gegenprobe: ein normaler Browser bekommt keine Kennzeichnung.
{const ctx=await b.newContext({serviceWorkers:'block'});const p=await ctx.newPage();await p.addInitScript(()=>{localStorage.setItem('kc_master_v040',JSON.stringify({registerId:'KASSE-01',pinLockEnabled:false}))});
 await p.goto('http://127.0.0.1:8903/pos/index.html');await p.waitForTimeout(2500);
 pruefe('Normaler Browser: keine Rückfall-Kennzeichnung',!(await p.evaluate(()=>document.documentElement.classList.contains('kc-ohne-seitenverhaeltnis'))));await ctx.close()}
for(const [seite,std,neu,vp] of [['/schulung/pos/index.html',0,0,{width:1280,height:800}],['/pos/index.html',0,0,{width:1280,height:800}],['/pos/index.html',1,1,{width:1280,height:800}],['/pos/index.html',0,0,{width:1280,height:800}]]){
 const ctx=await b.newContext({serviceWorkers:'block',viewport:vp});const p=await ctx.newPage();
 await p.addInitScript(([std,neu])=>{
  const orig=CSS.supports.bind(CSS);CSS.supports=function(a,b){if(String(a).includes('aspect-ratio'))return false;return orig.apply(null,arguments)};
  localStorage.setItem('kc_master_v040',JSON.stringify({registerId:'KASSE-01',pinLockEnabled:false,neuesLayout:!!neu}));localStorage.setItem('kc_offers_v100','[]');if(std)localStorage.setItem('kc.kassenoberflaeche.standard.v1','1');
  const weg=()=>{for(const sh of document.styleSheets){let rs;try{rs=sh.cssRules}catch(e){continue}const lauf=l=>{for(const r of l){if(r.style&&r.style.getPropertyValue('aspect-ratio'))r.style.removeProperty('aspect-ratio');if(r.cssRules)lauf(r.cssRules)}};lauf(rs)}};
  new MutationObserver(weg).observe(document,{childList:true,subtree:true});document.addEventListener('DOMContentLoaded',weg);window.addEventListener('load',weg);setInterval(weg,300);
 },[std,neu]);
 await p.goto('http://127.0.0.1:8903'+seite);await p.waitForTimeout(3000);
 await p.evaluate(()=>{const k=[...document.querySelectorAll('button')].find(x=>/KASSE STARTEN/i.test(x.textContent));if(k)k.click()});await p.waitForTimeout(7500);
 await p.evaluate(()=>{window.dispatchEvent(new Event('resize'))});await p.waitForTimeout(600);
 const m=await p.evaluate(()=>{const ws=[...document.querySelectorAll('.product-grid .product-tile-wrap.image-v3')];const vis=ws.filter(w=>w.getBoundingClientRect().top<innerHeight);return {html:document.documentElement.className,body:/kc-aufbau/.test(document.body.className)?'aufbau':(/kc-layout-neu/.test(document.body.className)?'neu':'standard'),anzahl:ws.length,hoehen:vis.slice(0,6).map(w=>{const t=w.querySelector('.product-tile').getBoundingClientRect(),i=w.querySelector('img').getBoundingClientRect();return Math.round(t.width)+'x'+Math.round(t.height)+'/img'+Math.round(i.height)})}});
 const wo=`${seite.includes('schulung')?'Schulung':'Live'}, ${m.body}`;
 pruefe(`${wo}: Rückfall aktiv`,/kc-ohne-seitenverhaeltnis/.test(m.html));
 const werte=m.hoehen.map(h=>h.match(/(\d+)x(\d+)\/img(\d+)/).slice(1).map(Number));
 pruefe(`${wo}: alle Bildkacheln sichtbar groß, Bild nicht zusammengefallen`,m.anzahl>0&&werte.length>0&&werte.every(([b,h,i])=>b>=60&&h>=60&&i>=50),m.hoehen.join(' '));
 await ctx.close()}
await b.close();s.close();console.log(fehler?`\n${fehler} FEHLER`:'\nAlles OK');process.exit(fehler?1:0)})();
