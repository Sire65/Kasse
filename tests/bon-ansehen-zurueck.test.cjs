/* Bon ansehen mit Zurueck-Knopf (02.10.2026)
   Betreiber: "wenn ich bei Bon druck einen Bon ansehe, oeffnet der sich. Oben rechts ist ein Druckbutton,
   aber dort muss es auch einen Zurueck-Button geben, sonst komme ich aus dem Bild nicht mehr raus".
   Geprueft in Kasse und Schulung: BONDRUCK -> Bon antippen -> Fenster hat links "Zurueck zur Kasse" und rechts
   "Drucken", beide verdecken den Bon nicht; Zurueck schliesst das Fenster, die Kasse ist wieder da.
   Drucken-Knoepfe (sofortiger Druck) haben den Zurueck-Knopf ebenfalls; beim Ausdruck ist er unsichtbar.
   Mit E=webkit auch in der Safari-Engine (iPad). */
const pw=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const W=path.join(__dirname,'..');const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
const s=http.createServer((q,r)=>{const p=path.join(W,decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kasse/,''));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(d)})});
let f=0;const pr=(n,b,z='')=>{console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'  ['+z+']':''}`);if(!b)f++};
const ENGINE=process.env.E||'chromium',PORT=Number(process.env.P||8980);
(async()=>{await new Promise(r=>s.listen(PORT,r));const b=await pw[ENGINE].launch();
try{
for(const [seite,vb,vh] of [['pos',1280,800],['schulung/pos',1180,820]]){
 const ctx=await b.newContext({viewport:{width:vb,height:vh}});const p=await ctx.newPage();const js=[];p.on('pageerror',e=>js.push(e.message));
 await p.addInitScript(()=>{if(!localStorage.getItem('kc_master_v040'))localStorage.setItem('kc_master_v040',JSON.stringify({registerId:'KASSE-01',pinLockEnabled:false}))});
 await p.goto(`http://127.0.0.1:${PORT}/Kasse/${seite}/index.html`);await p.waitForTimeout(3500);
 const n=`${ENGINE} ${seite}`;
 await p.evaluate(()=>{const g=document.getElementById('fullscreenGate');if(g)g.hidden=true;document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  const bon={bon:'000777',bonNumber:'000777',time:new Date().toISOString(),items:[{name:'Glühwein rot',qty:2,price:3.5,lineTotal:7}],total:7,due:7,given:10,change:3,method:'cash',type:'sale'};
  window.allTransactions=()=>[bon];window.readTransactions=()=>[bon];
  document.getElementById('printBonBtn').click()});
 await p.waitForTimeout(400);
 const knopf=await p.evaluate(()=>!!document.querySelector('#bonPrintDialog [data-view-bon="000777"]'));
 pr(`${n}: BONDRUCK zeigt den Bon zum Ansehen`,knopf);
 const [fenster]=await Promise.all([ctx.waitForEvent('page'),p.evaluate(()=>document.querySelector('#bonPrintDialog [data-view-bon="000777"]').click())]);
 await fenster.waitForLoadState();await fenster.waitForTimeout(300);
 const a=await fenster.evaluate(()=>{const z=document.querySelector('.kc-bon-zurueck'),d=document.querySelector('.kc-bon-druckknopf'),bon=document.body.getBoundingClientRect(),zr=z&&z.getBoundingClientRect(),dr=d&&d.getBoundingClientRect();
  return {zurueck:z&&z.textContent,drucken:d&&d.textContent,frei:!!zr&&!!dr&&zr.bottom<=bon.top&&dr.bottom<=bon.top,links:!!zr&&zr.left<20,glühwein:/Glühwein rot/.test(document.body.textContent)}});
 pr(`${n}: Bon-Fenster hat links „Zurück zur Kasse“, rechts „Drucken“`,/Zurück zur Kasse/.test(a.zurueck||'')&&/Drucken/.test(a.drucken||'')&&a.links,JSON.stringify(a));
 pr(`${n}: Knöpfe verdecken den Bon nicht, Inhalt unverändert`,a.frei&&a.glühwein);
 const druck=await fenster.evaluate(()=>{const st=[...document.styleSheets].flatMap(x=>[...x.cssRules]).map(r=>r.cssText).join(' ');return /print[\s\S]*kc-bon-zurueck[\s\S]*display:\s*none/.test(st)});
 pr(`${n}: beim Ausdruck ist der Zurück-Knopf unsichtbar`,druck);
 const zu=fenster.waitForEvent('close',{timeout:4000}).then(()=>true).catch(()=>false);
 await fenster.evaluate(()=>document.querySelector('.kc-bon-zurueck').click());
 pr(`${n}: Zurück schließt das Bon-Fenster`,await zu);
 pr(`${n}: Kasse ist danach weiter bedienbar`,await p.evaluate(()=>!!document.getElementById('printBonBtn')&&document.visibilityState!=='hidden'));
 const [druckFenster]=await Promise.all([ctx.waitForEvent('page'),p.evaluate(()=>{window.print=()=>{};document.querySelector('#bonPrintDialog [data-print-bon="000777"]')?.click()||openBonView('000777')})]);
 await druckFenster.waitForLoadState();
 pr(`${n}: auch das Druck-Fenster hat „Zurück zur Kasse“`,await druckFenster.evaluate(()=>!!document.querySelector('.kc-bon-zurueck')));
 await druckFenster.close().catch(()=>{});
 pr(`${n}: keine JS-Fehler`,!js.filter(x=>!/access control|kc-sync|Load failed|Failed to fetch/.test(x)).length,js.join('|').slice(0,200));
 await ctx.close();
}}catch(e){console.log('ABBRUCH:',e&&e.stack||e);f++}
await b.close();s.close();console.log(f?f+' FEHLER':'Alles OK');process.exit(f?1:0)})();
