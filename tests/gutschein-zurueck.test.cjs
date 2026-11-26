/* Gutscheinbon mit Zurueck-Knopf (26.11.2026)
   Betreiber: "Schau mal in der Kasse nach. Dort gibt es Gutscheine. Wenn man den drueckt, kommt scheinbar kein
   Button, um dort wieder rauszukommen. Abbrechen oder zurueck muss es dort geben."
   Geprueft in Kasse und Schulung: Mehr -> Gutschein -> Betrag -> "Gutschein ausstellen und drucken" -> das
   Bon-Fenster hat oben links "Zurueck zur Kasse", verdeckt den Gutschein nicht, ist beim Ausdruck unsichtbar
   und schliesst das Fenster. Das Gutscheinfenster selbst hat "Schliessen". Mit E=webkit auch Safari-Engine. */
const pw=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const W=path.join(__dirname,'..');const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
const s=http.createServer((q,r)=>{const p=path.join(W,decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kasse/,''));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(d)})});
let f=0;const pr=(n,b,z='')=>{console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'  ['+z+']':''}`);if(!b)f++};
const ENGINE=process.env.E||'chromium',PORT=Number(process.env.P||8981);
(async()=>{await new Promise(r=>s.listen(PORT,r));const b=await pw[ENGINE].launch();
try{
for(const [seite,vb,vh] of [['pos',1280,800],['schulung/pos',1180,820]]){
 const ctx=await b.newContext({viewport:{width:vb,height:vh}});await ctx.addInitScript(()=>{window.print=()=>{}});
 const p=await ctx.newPage();const js=[];p.on('pageerror',e=>js.push(e.message));
 await p.addInitScript(()=>{if(!localStorage.getItem('kc_master_v040'))localStorage.setItem('kc_master_v040',JSON.stringify({registerId:'KASSE-01',pinLockEnabled:false,trainingMode:true}))});
 await p.goto(`http://127.0.0.1:${PORT}/Kasse/${seite}/index.html`);await p.waitForTimeout(3500);
 const n=`${ENGINE} ${seite}`;
 await p.evaluate(()=>{const g=document.getElementById('fullscreenGate');if(g)g.hidden=true;document.querySelectorAll('dialog[open]').forEach(d=>d.close());window.KCGutscheinUI.oeffne()});
 await p.waitForTimeout(300);
 const zu=await p.evaluate(()=>{const k=document.querySelector('#gutscheinDialog [data-gs-schliessen]'),r=k&&k.getBoundingClientRect();return !!r&&r.height>0&&r.bottom<=innerHeight});
 pr(`${n}: Gutscheinfenster hat sichtbar „Schließen“`,zu);
 await p.click('#gutscheinDialog [data-gs-betrag="10"]');
 const [fenster]=await Promise.all([ctx.waitForEvent('page'),p.click('#gsAusstellen')]);
 await fenster.waitForLoadState();await fenster.waitForTimeout(300);
 const a=await fenster.evaluate(()=>{const z=document.querySelector('.kc-bon-zurueck'),zr=z&&z.getBoundingClientRect(),kopf=document.querySelector('.kopf')?.getBoundingClientRect();
  return {zurueck:z&&z.textContent,links:!!zr&&zr.left<20&&zr.top<20,frei:!!zr&&!!kopf&&zr.bottom<=kopf.top,gutschein:/GUTSCHEIN/.test(document.body.textContent)&&/GS-\d{4}-\d{4}-\d{2}/.test(document.body.textContent)}});
 pr(`${n}: Gutscheinbon hat oben links „Zurück zur Kasse“`,/Zurück zur Kasse/.test(a.zurueck||'')&&a.links,JSON.stringify(a));
 pr(`${n}: Knopf verdeckt den Gutschein nicht`,a.frei&&a.gutschein);
 const druck=await fenster.evaluate(()=>{const st=[...document.styleSheets].flatMap(x=>[...x.cssRules]).map(r=>r.cssText).join(' ');return /print[\s\S]*kc-bon-zurueck[\s\S]*display:\s*none/.test(st)});
 pr(`${n}: beim Ausdruck ist der Zurück-Knopf unsichtbar`,druck);
 const weg=fenster.waitForEvent('close',{timeout:4000}).then(()=>true).catch(()=>false);
 await fenster.evaluate(()=>document.querySelector('.kc-bon-zurueck').click());
 pr(`${n}: Zurück schließt den Gutscheinbon`,await weg);
 await p.click('#gutscheinDialog [data-gs-schliessen]');
 pr(`${n}: „Schließen“ schließt das Gutscheinfenster, Kasse bedienbar`,await p.evaluate(()=>!document.getElementById('gutscheinDialog').open&&document.visibilityState!=='hidden'));
 pr(`${n}: keine JS-Fehler`,!js.filter(x=>!/access control|kc-sync|Load failed|Failed to fetch/.test(x)).length,js.join('|').slice(0,200));
 await ctx.close();
}}catch(e){console.log('ABBRUCH:',e&&e.stack||e);f++}
await b.close();s.close();console.log(f?f+' FEHLER':'Alles OK');process.exit(f?1:0)})();
