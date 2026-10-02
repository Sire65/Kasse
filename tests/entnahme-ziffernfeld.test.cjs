/* Entnahme wie Money Butler (02.10.2026, ersetzt den Stand vom 30.09.2026)
   Betreiber: "wie Money Butler die Muenzen und Scheine anzeigen ordentlich aufgereiht ... die Gruende als
   Buttons farbig ... Button ausgegraut bis Sachen gewaehlt wurden ... Bon/Quittung etwas groesser ...
   wenn ins Schreibfeld geklickt wird Tastatur einblenden ... 0,50 reicht, echte Bilder der Muenzen und Scheine".
   Geprueft in Kasse und Schulung (1280x800, 1024x768): echte Bilder 0,50/1/2 EUR und 5-100 EUR in einer
   Reihe; Antippen zaehlt dazu (Zaehler); Letzte zurueck / Leeren; "Anderer Betrag" oeffnet das kleine
   Ziffernfeld (5 , 5 0 = 5,50, ersetzt den Betrag); Speichern grau bis Betrag UND Grund; farbige Gruende;
   Notiz mit Bildschirmtastatur (inputmode text); Buchung unveraendert (Betrag, Cent, Grund, Bon). */
try{require.resolve('playwright')}catch(e){console.log('  ueberspringen: Playwright nicht installiert');process.exit(0)}
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const W=path.join(__dirname,'..');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2','.svg':'image/svg+xml'};
const s=http.createServer((q,r)=>{const p=path.join(W,decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kasse/,''));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(d)})});
let fehler=0;const pruefe=(n,b,z='')=>{console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'  ['+z+']':''}`);if(!b)fehler++};
(async()=>{await new Promise(r=>s.listen(8917,r));const b=await chromium.launch();
try{
 for(const [seite,vb,vh] of [['pos',1280,800],['schulung/pos',1280,800],['pos',1024,768]]){
  const ctx=await b.newContext({viewport:{width:vb,height:vh},hasTouch:true});const p=await ctx.newPage();const jsFehler=[];p.on('pageerror',e=>jsFehler.push(e.message));
  await p.addInitScript(()=>{if(!localStorage.getItem('kc_master_v040'))localStorage.setItem('kc_master_v040',JSON.stringify({registerId:'KASSE-01',pinLockEnabled:false}))});
  await p.goto(`http://127.0.0.1:8917/Kasse/${seite}/index.html`);await p.waitForTimeout(3500);
  const oeffne=()=>p.evaluate(()=>{const g=document.getElementById('fullscreenGate');if(g)g.hidden=true;document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.querySelector('.more-grid button[data-action="withdraw"]').click()});
  await oeffne();await p.waitForTimeout(700);
  const n=`${seite} ${vb}x${vh}`;
  const offen=()=>p.evaluate(()=>{const z=document.getElementById('kcZiffernFeld');return !!z&&!z.hidden&&z.getBoundingClientRect().width>0});
  const wert=()=>p.inputValue('#withdrawAmount');
  const gesperrt=()=>p.evaluate(()=>document.getElementById('saveWithdrawal').disabled);
  pruefe(`${n}: Entnahme offen, Ziffernfeld zu, Speichern grau`,await p.evaluate(()=>document.getElementById('withdrawDialog').open)&&!(await offen())&&await gesperrt());
  const geld=await p.evaluate(()=>[...document.querySelectorAll('#kcBetragBlock [data-geld]')].map(x=>{const i=x.querySelector('img'),r=x.getBoundingClientRect();return {w:x.dataset.geld,src:i&&i.getAttribute('src'),ok:!!i&&i.complete&&i.naturalWidth>0,y:Math.round(r.top+r.height/2),rechts:r.right,links:r.left}}));
  pruefe(`${n}: echte Bilder 0,50 1 2 5 10 20 50 100 € geladen`,geld.map(g=>g.w).join('|')==='0.5|1|2|5|10|20|50|100'&&geld.every(g=>g.ok&&/^assets\/(muenze|schein)_/.test(g.src)),geld.map(g=>g.w+(g.ok?'':'!')).join(' '));
  const dlg=await p.evaluate(()=>{const r=document.querySelector('#withdrawDialog .withdraw-card').getBoundingClientRect();return {l:r.left,r:r.right}});
  pruefe(`${n}: alles in einer Reihe und im Fenster`,Math.max(...geld.map(g=>g.y))-Math.min(...geld.map(g=>g.y))<20&&geld.every(g=>g.links>=dlg.l&&g.rechts<=dlg.r));
  for(const w of ['5','5','0.5'])await p.tap(`[data-geld="${w}"]`);
  pruefe(`${n}: 2× 5 € + 0,50 € = 10,50 € mit Zaehler`,await wert()==='10.50'&&/2× 5 €/.test(await p.textContent('#kcGeldSumme'))&&(await p.textContent('[data-geld="5"] .kc-geld-zahl'))==='2×',await wert());
  pruefe(`${n}: Speichern noch grau ohne Grund (mit Hinweis)`,await gesperrt()&&/Grund/.test(await p.textContent('#kcSpeichernHinweis')));
  await p.tap('[data-geld-zurueck]');
  pruefe(`${n}: Letzte zurueck nimmt 0,50 € weg`,await wert()==='10.00');
  await p.tap('[data-geld-leeren]');
  pruefe(`${n}: Leeren setzt auf 0`,await wert()===''&&await p.evaluate(()=>[...document.querySelectorAll('.kc-geld-zahl')].every(z=>z.hidden)));
  await p.tap('[data-geld="20"]');await p.tap('[data-geld-anders]');await p.waitForTimeout(150);
  pruefe(`${n}: Anderer Betrag oeffnet kleines Ziffernfeld, ganz sichtbar`,await offen()&&await p.evaluate(()=>{const r=document.getElementById('kcZiffernFeld').getBoundingClientRect();return r.width<=300&&r.top>=0&&r.bottom<=innerHeight&&r.right<=innerWidth}));
  for(const z of ['5',',','5','0'])await p.tap(`#kcZiffernFeld [data-ziffer="${z}"]`);
  pruefe(`${n}: 5 , 5 0 ersetzt den Betrag durch 5,50`,await wert()==='5.50',await wert());
  await p.tap('#kcZiffernFeld [data-ziffern-ok]');await p.waitForTimeout(100);
  await p.tap('[data-geld="0.5"]');
  pruefe(`${n}: danach Muenze dazu = 6,00, Ziffernfeld zu`,await wert()==='6.00'&&!(await offen()),await wert());
  await p.tap('[data-withdraw-reason="WC-Geld"]');await p.waitForTimeout(200);
  const farben=await p.evaluate(()=>new Set([...document.querySelectorAll('#withdrawReasonButtons > button:not([hidden])')].map(x=>getComputedStyle(x).backgroundColor)).size);
  pruefe(`${n}: Gruende farbig unterscheidbar, Speichern jetzt frei`,farben>=6&&!(await gesperrt())&&/bereit/.test(await p.textContent('#kcSpeichernHinweis')),farben+' Farben');
  pruefe(`${n}: Notiz oeffnet die Bildschirmtastatur (inputmode text)`,await p.evaluate(()=>document.getElementById('withdrawNote').getAttribute('inputmode')==='text'));
  const bonH=await p.evaluate(()=>document.getElementById('withdrawReceiptToggle').getBoundingClientRect().height);
  pruefe(`${n}: Bon/Quittung als grosser Knopf`,bonH>=56,Math.round(bonH)+' px');
  await p.fill('#withdrawNote','Toilette Marktplatz');await p.tap('#withdrawReceiptToggle');
  await p.tap('#saveWithdrawal');await p.waitForTimeout(1200);
  const gespeichert=await p.evaluate(()=>{const rows=JSON.parse(localStorage.getItem('kc_cash_withdrawals_v018')||'[]');return rows[rows.length-1]||null});
  pruefe(`${n}: Buchung unveraendert: 6,00 € WC-Geld mit Bon und Notiz`,!!gespeichert&&gespeichert.amount===6&&gespeichert.amountCents===600&&gespeichert.reason==='WC-Geld'&&gespeichert.receiptAvailable===true&&gespeichert.note==='Toilette Marktplatz'&&!(await p.evaluate(()=>document.getElementById('withdrawDialog').open)),JSON.stringify(gespeichert&&{a:gespeichert.amount,c:gespeichert.amountCents,r:gespeichert.reason,b:gespeichert.receiptAvailable}));
  await oeffne();await p.waitForTimeout(700);
  pruefe(`${n}: neu geoeffnet wieder leer und grau`,await wert()===''&&await gesperrt()&&await p.evaluate(()=>[...document.querySelectorAll('.kc-geld-zahl')].every(z=>z.hidden)));
  pruefe(`${n}: keine JS-Fehler`,!jsFehler.length,jsFehler.join(' | '));
  await ctx.close();
 }
}catch(err){console.log('ABBRUCH:',err&&err.stack||err);fehler++}
await b.close();s.close();console.log(fehler?`\n${fehler} FEHLER`:'\nAlles OK');process.exit(fehler?1:0)})();
