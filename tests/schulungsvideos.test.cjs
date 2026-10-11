/* KC-KASSE-SCHULUNGSVIDEOS 0.1.0 (11.10.2026) – kleine Erklaer-Videos mit Laura, Marc und Finger
   Betreiber: "auf der Schulungskasse immer, an der echten Kasse nur im Trainingsmodus, unter MEHR → Schulungsvideos,
   Kacheln fuer die Bereiche; Entnahme erst nach dem Einkauf". Geprueft:
   - echte Kasse ohne Training: kein Knopf, kein Start (auch nicht per Programm)
   - echte Kasse mit Training und Schulungskasse: Knopf da, Themen-Kacheln, Entnahmen mit 1 Video
   - offener Bon: kein Start
   - Video laeuft durch: Finger tippt bis Entnahme-Fenster mit 38,40 €, Grund und Bon – gespeichert wird NICHTS,
     am Ende alle Fenster zu, Warenkorb leer, "gesehen" gezaehlt, Bewertung wird in die Warteschlange gelegt
   - Trainingsmodus waehrend des Videos aus: Video stoppt sofort */
try{require.resolve('playwright')}catch(e){console.log('  ueberspringen: Playwright nicht installiert');process.exit(0)}
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const W=path.join(__dirname,'..');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2','.svg':'image/svg+xml'};
const s=http.createServer((q,r)=>{const p=path.join(W,decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kasse/,''));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(d)})});
let fehler=0;const pruefe=(n,b,z='')=>{console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'  ['+z+']':''}`);if(!b)fehler++};
async function seite(b,url,master){
  const ctx=await b.newContext({viewport:{width:1280,height:800},hasTouch:true});const p=await ctx.newPage();const js=[];p.on('pageerror',e=>js.push(e.message));
  // Ohne Stimme im Testbrowser: Sprechen dauert hier nur kurz
  await p.addInitScript(()=>{window.speechSynthesis.speak=u=>setTimeout(()=>u.onend&&u.onend(),60);window.speechSynthesis.cancel=()=>{};});
  await p.addInitScript(m=>{if(!localStorage.getItem('kc_master_v040'))localStorage.setItem('kc_master_v040',JSON.stringify(m))},master);
  await p.goto(url);await p.waitForTimeout(3500);
  await p.evaluate(()=>{const g=document.getElementById('fullscreenGate');if(g)g.hidden=true;document.querySelectorAll('dialog[open]').forEach(d=>d.close())});
  return {p,ctx,js};
}
const sichtbar=(p,sel)=>p.evaluate(s=>{const n=document.querySelector(s);return !!n&&!n.hidden&&n.getBoundingClientRect().width>0},sel);
(async()=>{await new Promise(r=>s.listen(8941,r));const b=await chromium.launch();const B='http://127.0.0.1:8941/Kasse/';
try{
  // 1. echte Kasse ohne Training
  {const {p,ctx,js}=await seite(b,B+'pos/index.html',{registerId:'KASSE-01',pinLockEnabled:false});
   await p.click('#moreBtn');await p.waitForTimeout(500);
   pruefe('Kasse ohne Training: Knopf Schulungsvideos verborgen',!(await sichtbar(p,'#kcSvMehrBtn'))&&await p.evaluate(()=>!!document.getElementById('kcSvMehrBtn')));
   await p.evaluate(()=>{document.getElementById('moreDialog').close();KCSchulungsvideos.uebersicht(null);KCSchulungsvideos.start(['entnahme-zeitpunkt'])});await p.waitForTimeout(800);
   pruefe('Kasse ohne Training: weder Uebersicht noch Video startbar',!(await p.evaluate(()=>document.getElementById('kcSvFenster')?.open))&&!(await p.evaluate(()=>!!document.getElementById('kcSvLage'))));
   pruefe('Finger-Kern aus training-demo-bridge.js steht bereit (window.KCLiveDemo)',await p.evaluate(()=>typeof KCLiveDemo?.click==='function'));
   pruefe('keine Programmfehler',!js.length,js.join(' | '));await ctx.close();}

  // 2. echte Kasse mit Training: Kacheln, offener Bon, Video komplett
  {const {p,ctx,js}=await seite(b,B+'pos/index.html',{registerId:'KASSE-01',pinLockEnabled:false,trainingMode:true});
   await p.click('#moreBtn');await p.waitForTimeout(500);
   pruefe('Kasse mit Training: Knopf Schulungsvideos sichtbar',await sichtbar(p,'#kcSvMehrBtn'));
   await p.click('#kcSvMehrBtn');await p.waitForTimeout(700);
   const k=await p.evaluate(()=>[...document.querySelectorAll('[data-sv-thema]')].map(x=>x.dataset.svThema+':'+(x.disabled?'aus':'an')+':'+x.querySelector('small').textContent));
   pruefe('Themen-Kacheln Oberflaeche, Verkaufen, Rueckgeld, Entnahmen; Entnahmen mit 1 Video',k.length===4&&/^entnahmen:an:1 Video/.test(k[3])&&k.slice(0,3).every(x=>/:aus:Videos in Vorbereitung/.test(x)),k.join(' | '));
   await p.click('[data-sv-thema="entnahmen"]');await p.waitForTimeout(400);
   pruefe('Entnahmen: Video „Erst einkaufen, dann entnehmen“ mit ▶',await p.evaluate(()=>/Erst einkaufen, dann entnehmen/.test(document.getElementById('kcSvInhalt').textContent)&&!!document.querySelector('[data-sv-start="entnahme-zeitpunkt"]')));
   await p.evaluate(()=>document.getElementById('kcSvFenster').close());
   // offener Bon
   await p.evaluate(()=>KCTrainingAPI.addStandardProduct('Glühwein rot'));await p.waitForTimeout(1500);
   await p.evaluate(()=>KCSchulungsvideos.start(['entnahme-zeitpunkt']));await p.waitForTimeout(600);
   pruefe('offener Bon: Video startet nicht',!(await p.evaluate(()=>!!document.getElementById('kcSvLage'))));
   await p.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());KCTrainingAPI.clearCart()});
   // Video komplett
   const vorher=await p.evaluate(()=>JSON.parse(localStorage.getItem('kc_cash_withdrawals_v018')||'[]').length);
   await p.evaluate(()=>{window.__sv={betrag:'',grund:'',bon:'',figuren:new Set(),tafeln:0};const t=setInterval(()=>{const w=document.getElementById('withdrawAmount');if(w&&w.value)__sv.betrag=w.value;const g=document.querySelector('[data-withdraw-reason].active');if(g)__sv.grund=g.dataset.withdrawReason;const r=document.getElementById('withdrawReceiptToggle');if(r&&document.getElementById('withdrawDialog').open)__sv.bon=r.getAttribute('aria-pressed');const f=document.querySelector('#kcSvLage .kc-sv-wer');if(f)__sv.figuren.add(f.textContent);if(document.querySelector('#kcSvLage .kc-sv-tafel'))__sv.tafeln++;if(document.getElementById('kcSvBewertung')?.open)clearInterval(t)},100);KCSchulungsvideos.start(['entnahme-zeitpunkt'])});
   await p.waitForTimeout(1500);
   pruefe('Video laeuft: Laura/Marc-Buehne sichtbar',await sichtbar(p,'#kcSvLage .kc-sv-coach'));
   for(let i=0;i<90&&!(await p.evaluate(()=>document.getElementById('kcSvBewertung')?.open));i++)await p.waitForTimeout(1000);
   const z=await p.evaluate(()=>({...__sv,figuren:[...__sv.figuren]}));
   pruefe('Finger hat Grund, 38,40 € und Bon vorgefuehrt',z.grund==='Einkauf Lebensmittel'&&z.betrag==='38.40'&&z.bon==='true',JSON.stringify(z));
   pruefe('Laura und Marc sprechen, Tafeln werden gezeigt',z.figuren.includes('Laura')&&z.figuren.includes('Marc')&&z.tafeln>0);
   pruefe('Bewertung 👍/👎 am Ende offen',await p.evaluate(()=>document.getElementById('kcSvBewertung')?.open));
   pruefe('nichts gespeichert: keine neue Entnahme',await p.evaluate(()=>JSON.parse(localStorage.getItem('kc_cash_withdrawals_v018')||'[]').length)===vorher);
   pruefe('am Ende: Entnahme-Fenster zu, Buehne weg, Warenkorb leer',await p.evaluate(()=>!document.getElementById('withdrawDialog').open&&!document.getElementById('kcSvLage')&&!KCTrainingAPI.getCartSnapshot().items.length));
   await p.click('[data-frage="gefallen"] [data-w="1"]');await p.click('[data-frage="hilft"] [data-w="0"]');await p.click('[data-sv-ende="1"]');await p.waitForTimeout(300);
   const bw=await p.evaluate(()=>KCSchulungsvideos.bewertungen());
   pruefe('Bewertung in der Warteschlange (Video, Fassung, gefallen, hilft)',bw.length===1&&bw[0].video==='entnahme-zeitpunkt'&&bw[0].stand==='1'&&bw[0].gefallen===true&&bw[0].hilft===false&&bw[0].gesendet===false,JSON.stringify(bw));
   pruefe('„gesehen“ gezaehlt',await p.evaluate(()=>JSON.parse(localStorage.getItem('kc_schulungsvideo_gesehen_v1')||'{}')['entnahme-zeitpunkt'])===1);
   // Trainingsmodus waehrend des Videos aus
   await p.evaluate(()=>{KCSchulungsvideos.start(['entnahme-zeitpunkt'])});await p.waitForTimeout(1500);
   await p.evaluate(()=>{state.master.trainingMode=false;renderWorkspaceModePanel()});await p.waitForTimeout(800);
   pruefe('Training aus: Video stoppt sofort, Knopf verschwindet',!(await p.evaluate(()=>!!document.getElementById('kcSvLage')))&&await p.evaluate(()=>document.getElementById('kcSvMehrBtn').hidden));
   pruefe('keine Programmfehler',!js.length,js.join(' | '));await ctx.close();}

  // 3. Schulungskasse: immer da (Trainingsmodus fest an)
  {const {p,ctx,js}=await seite(b,B+'schulung/pos/index.html?schulung=1',{registerId:'KASSE-01',pinLockEnabled:false});
   await p.click('#moreBtn');await p.waitForTimeout(500);
   pruefe('Schulungskasse: Knopf Schulungsvideos sichtbar',await sichtbar(p,'#kcSvMehrBtn'));
   const fig=await p.evaluate(async()=>{const r=await Promise.all(['chef_female_neutral_armless_v0257.webp','chef_male_neutral_armless_v0257.webp'].map(n=>fetch('../../avatar-core/assets/chef/'+n).then(x=>x.ok)));return r.every(Boolean)});
   pruefe('Schulungskasse: Laura- und Marc-Bild erreichbar',fig);
   pruefe('keine Programmfehler',!js.length,js.join(' | '));await ctx.close();}
}finally{await b.close();s.close()}
console.log(fehler?`\n${fehler} FEHLER`:'\nalles OK');process.exit(fehler?1:0)})();
