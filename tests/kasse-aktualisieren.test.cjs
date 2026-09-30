/* Update-Seite kasse-aktualisieren.html (30.09.2026, Betreiber: altes Tablet holte die neue Version nicht).
   Echt mit aktivem Offline-Speicher (Service Worker): Kasse und Schulung werden installiert, ein Bon
   gebucht, dann raeumt die Update-Seite auf. Geprueft: Programmsteuerungen und Programm-Caches sind
   weg, Bons und Einstellungen bleiben, Kasse und Schulung laufen danach wieder mit Offline-Speicher. */
try{require.resolve('playwright')}catch(e){console.log('  ueberspringen: Playwright nicht installiert');process.exit(0)}
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const WURZEL=path.join(__dirname,'..');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp3':'audio/mpeg','.webmanifest':'application/manifest+json'};
const s=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kasse/,'');const p=path.join(WURZEL,u);fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end('x')}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(d)})});
let fehler=0;const pruefe=(n,b,z='')=>{console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'  ['+z+']':''}`);if(!b)fehler++};
const sicher=async(p,fn)=>{for(let i=0;i<10;i++){try{return await p.evaluate(fn)}catch(e){await p.waitForTimeout(800)}}return null};
const URL_='http://127.0.0.1:8907/Kasse/';
(async()=>{await new Promise(r=>s.listen(8907,r));const b=await chromium.launch();
try{
  const ctx=await b.newContext({viewport:{width:1280,height:800}});const p=await ctx.newPage();
  await p.addInitScript(()=>{if(!localStorage.getItem('kc_master_v040'))localStorage.setItem('kc_master_v040',JSON.stringify({registerId:'KASSE-01',pinLockEnabled:false}))});
  for(const seite of ['schulung/pos','pos']){await p.goto(URL_+seite+'/index.html');await p.waitForTimeout(4000);await p.reload().catch(()=>{});await p.waitForTimeout(2500)}
  const bon=await sicher(p,async()=>{await window.__kcTxHydrated;document.querySelectorAll('dialog[open]').forEach(d=>d.close());addConfiguredProduct(productsForSale().find(x=>x.id==='grot'),null);const r=await completeSale('cash',{silent:true});return r&&r.bon});
  await p.waitForTimeout(1500);
  const zaehle=()=>sicher(p,async()=>{await window.__kcTxHydrated;return readTransactions().length+readTrainingTransactions().length});
  const vorBons=await zaehle();
  const vor=await sicher(p,async()=>({regs:(await navigator.serviceWorker.getRegistrations()).map(r=>r.scope),caches:await caches.keys(),master:localStorage.getItem('kc_master_v040')}));
  pruefe('Ausgangslage: Kasse und Schulung offline installiert, ein Bon gebucht',!!bon&&vorBons>=1&&vor.regs.length>=2&&vor.caches.some(c=>c.startsWith('kc-bildrechner-'))&&vor.caches.some(c=>c.startsWith('kc-schulung-')),JSON.stringify({bon,vorBons,regs:vor.regs.length,caches:vor.caches}));
  await p.goto(URL_+'kasse-aktualisieren.html');
  await p.waitForFunction(()=>/Server: \d/.test(document.getElementById('version').textContent),null,{timeout:10000}).catch(()=>{});
  const server=await p.evaluate(()=>document.getElementById('version').textContent);
  const soll=(fs.readFileSync(path.join(WURZEL,'pos/index.html'),'utf8').match(/app\.js\?build=([^'"]+)/)||[])[1];
  pruefe('Update-Seite zeigt die Version auf dem Server',server.includes(soll),server);
  await p.click('#los');await p.waitForSelector('#fertig',{state:'visible',timeout:15000});
  const nach=await p.evaluate(async()=>({regs:(await navigator.serviceWorker.getRegistrations()).map(r=>r.scope),caches:await caches.keys(),master:localStorage.getItem('kc_master_v040')}));
  pruefe('Programmsteuerungen von Kasse und Schulung entfernt',nach.regs.length===0,nach.regs.join(', '));
  pruefe('Programm-Caches entfernt',!nach.caches.some(c=>/^kc-(bildrechner|schulung|marktkasse)-/.test(c)),nach.caches.join(', '));
  pruefe('Einstellungen unverändert',nach.master===vor.master);
  await p.click('#zurKasse');await p.waitForTimeout(4500);
  const nachBons=await zaehle();
  pruefe('Bons nach dem Aufräumen vollständig da',nachBons===vorBons,`${vorBons} → ${nachBons}`);
  const wieder=await sicher(p,async()=>{await navigator.serviceWorker.ready;return {build:(document.querySelector('script[src*="app.js?build="]')||{}).src,regs:(await navigator.serviceWorker.getRegistrations()).length}});
  pruefe('Kasse läuft danach mit aktueller Version und neuem Offline-Speicher',!!wieder&&String(wieder.build).includes(soll)&&wieder.regs>=1,JSON.stringify(wieder));
  await ctx.close();
}catch(err){console.log('ABBRUCH:',err&&err.stack||err);fehler++}
await b.close();s.close();console.log(fehler?`\n${fehler} FEHLER`:'\nAlles OK');process.exit(fehler?1:0)})();
