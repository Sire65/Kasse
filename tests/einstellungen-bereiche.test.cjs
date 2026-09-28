/* Einstellungen: jeder Tab zeigt nur SEINEN Bereich (Befund 28.09.2026).
   Die Regel "body.role-superadmin .superadmin-only{display:inline-block}" traf auch ganze
   Einstellungsbereiche - der Bereich "System" stand fuer Service-Admins unter jedem Tab.
   Geprueft in Live und Schulung, als Service-Admin und als normale Kasse. */
try{require.resolve('playwright')}catch(e){console.log('  ueberspringen: Playwright nicht installiert');process.exit(0)}
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const WURZEL=path.join(__dirname,'..');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const s=http.createServer((q,r)=>{const p=path.join(WURZEL,decodeURIComponent(q.url.split('?')[0]));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end('x')}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(d)})});
let fehler=0;const pruefe=(n,b,z='')=>{console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'  ['+z+']':''}`);if(!b)fehler++};
const sichtbar=p=>p.evaluate(()=>[...document.querySelectorAll('[data-settings-panel]')].filter(x=>{const r=x.getBoundingClientRect();return r.height>0&&getComputedStyle(x).display!=='none'}).map(x=>x.dataset.settingsPanel));
(async()=>{await new Promise(r=>s.listen(8891,r));const b=await chromium.launch();
try{
for(const PFAD of ['/pos/index.html','/schulung/pos/index.html']){
  console.log('== '+PFAD);
  const ctx=await b.newContext({serviceWorkers:'block',viewport:{width:1280,height:900}});const p=await ctx.newPage();
  p.on('pageerror',e=>console.log('PAGEERROR:',e.message));
  await p.addInitScript(()=>{localStorage.setItem('kc_master_v040',JSON.stringify({registerId:'KASSE-01',pinLockEnabled:false}));localStorage.setItem('kc_offers_v100','[]')});
  await p.goto('http://127.0.0.1:8891'+PFAD);await p.waitForFunction(()=>typeof openSettings==='function',null,{timeout:15000});await p.waitForTimeout(800);
  // Service-Admin
  await p.evaluate(()=>{beginAdminSession('test','Test');document.querySelectorAll('dialog[open]').forEach(d=>d.close())});await p.waitForTimeout(300);
  await p.evaluate(()=>openSettings());await p.waitForTimeout(300);
  const tabs=await p.evaluate(()=>[...document.querySelectorAll('[data-settings-tab]')].map(x=>x.dataset.settingsTab));
  for(const tab of tabs){
    await p.evaluate(t=>document.querySelector(`[data-settings-tab="${t}"]`).click(),tab);await p.waitForTimeout(150);
    const v=await sichtbar(p);
    pruefe(`Admin, Tab "${tab}": nur der eigene Bereich sichtbar`,v.length===1&&v[0]===tab,v.join(', '));
  }
  const adminTabs=await p.evaluate(()=>['system','transfer','tse-entwicklung'].map(t=>{const x=document.querySelector(`[data-settings-tab="${t}"]`);return x?getComputedStyle(x).display!=='none':null}));
  pruefe('Admin sieht die Tabs System, Import/Export, TSE',adminTabs.every(x=>x===true),JSON.stringify(adminTabs));
  await p.evaluate(()=>document.querySelector('[data-settings-tab="general"]').click());await p.waitForTimeout(100);
  const normalBreite=await p.evaluate(()=>Math.round(document.querySelector('[data-settings-panel="general"]').getBoundingClientRect().width));
  const sys=await p.evaluate(()=>{document.querySelector('[data-settings-tab="system"]').click();const x=document.querySelector('[data-settings-panel="system"]');return {display:getComputedStyle(x).display,breite:Math.round(x.getBoundingClientRect().width)}});
  pruefe('System-Bereich im eigenen Tab als Block, so breit wie ein normaler Bereich',sys.display==='block'&&sys.breite===normalBreite,JSON.stringify({...sys,normalBreite}));
  await ctx.close();
  // Normale Kasse (kein Admin): Admin-Tabs und -Bereiche unsichtbar
  const ctx2=await b.newContext({serviceWorkers:'block',viewport:{width:1280,height:900}});const p2=await ctx2.newPage();
  await p2.addInitScript(()=>{localStorage.setItem('kc_master_v040',JSON.stringify({registerId:'KASSE-01',pinLockEnabled:false}));localStorage.setItem('kc_offers_v100','[]')});
  await p2.goto('http://127.0.0.1:8891'+PFAD);await p2.waitForFunction(()=>typeof openSettings==='function',null,{timeout:15000});await p2.waitForTimeout(800);
  // Ohne Anmeldung oeffnet sich der geschuetzte Einstellungsdialog gar nicht - geprueft wird
  // deshalb direkt, dass Admin-Tabs und Admin-Bereiche per CSS verborgen sind.
  const kasse=await p2.evaluate(()=>({admin:document.body.classList.contains('role-superadmin'),tabs:['system','transfer','tse-entwicklung'].filter(t=>{const x=document.querySelector(`[data-settings-tab="${t}"]`);return x&&getComputedStyle(x).display!=='none'}),bereiche:['system','transfer'].filter(t=>getComputedStyle(document.querySelector(`[data-settings-panel="${t}"]`)).display!=='none')}));
  pruefe('Normale Kasse: Admin-Tabs und Admin-Bereiche verborgen',!kasse.admin&&kasse.tabs.length===0&&kasse.bereiche.length===0,JSON.stringify(kasse));
  await ctx2.close();
}
}catch(err){console.log('ABBRUCH:',err&&err.stack||err);fehler++}
await b.close();s.close();console.log(fehler?`\n${fehler} FEHLER`:'\nAlles OK');process.exit(fehler?1:0)})();
