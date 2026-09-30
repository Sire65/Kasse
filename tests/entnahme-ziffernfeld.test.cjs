/* Entnahme: Ziffernfeld nur auf Tippen, Schnellbetraege ab 0,50 EUR (30.09.2026)
   Betreiber: "zu unuebersichtlich mit den vielen Zahlen. Wenn in das Feld Betrag geklickt wird, muss sich
   ein Ziffernfeld oeffnen, recht klein. Die vorgefertigten Betraege muessen besser angeordnet sein.
   0,50 muss auch anwaehlbar sein bei Toilettengeld."
   Geprueft in Kasse und Schulung: Ziffernfeld zu beim Oeffnen, klappt beim Tippen ins Betragsfeld auf,
   ist klein (hoechstens 300 px breit), OK / Schnellbetrag / daneben tippen schliesst es. Acht
   Schnellbetraege in einer Reihe, aufsteigend ab 0,50. Getippt 5,50 ergibt 5,50 (nicht 55).
   Eine WC-Geld-Entnahme ueber 0,50 wird wie bisher gespeichert. */
try{require.resolve('playwright')}catch(e){console.log('  ueberspringen: Playwright nicht installiert');process.exit(0)}
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const W=path.join(__dirname,'..');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.svg':'image/svg+xml'};
const s=http.createServer((q,r)=>{const p=path.join(W,decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kasse/,''));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(d)})});
let fehler=0;const pruefe=(n,b,z='')=>{console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'  ['+z+']':''}`);if(!b)fehler++};
(async()=>{await new Promise(r=>s.listen(8917,r));const b=await chromium.launch();
try{
 for(const [seite,vb,vh] of [['pos',1280,800],['schulung/pos',1280,800],['pos',1024,768]]){
  const ctx=await b.newContext({viewport:{width:vb,height:vh},hasTouch:true});const p=await ctx.newPage();
  await p.addInitScript(()=>{if(!localStorage.getItem('kc_master_v040'))localStorage.setItem('kc_master_v040',JSON.stringify({registerId:'KASSE-01',pinLockEnabled:false}))});
  await p.goto(`http://127.0.0.1:8917/Kasse/${seite}/index.html`);await p.waitForTimeout(3500);
  await p.evaluate(()=>{const g=document.getElementById('fullscreenGate');if(g)g.hidden=true;document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.querySelector('.more-grid button[data-action="withdraw"]').click()});
  await p.waitForTimeout(600);
  const offen=()=>p.evaluate(()=>{const z=document.getElementById('kcZiffernFeld');return !!z&&!z.hidden&&z.getBoundingClientRect().width>0});
  pruefe(`${seite} ${vb}x${vh}: Entnahme offen, Ziffernfeld anfangs zu`,await p.evaluate(()=>document.getElementById('withdrawDialog').open)&&!(await offen()));
  const schnell=await p.evaluate(()=>[...document.querySelectorAll('#kcBetragBlock [data-schnell]')].map(x=>({t:x.textContent.trim(),y:Math.round(x.getBoundingClientRect().top)})));
  pruefe(`${seite} ${vb}x${vh}: acht Schnellbetraege aufsteigend ab 0,50 € in einer Reihe`,schnell.map(x=>x.t).join('|')==='0,50 €|1 €|2 €|5 €|10 €|20 €|50 €|100 €'&&new Set(schnell.map(x=>x.y)).size===1,schnell.map(x=>x.t).join(' '));
  pruefe(`${seite} ${vb}x${vh}: Tablet-Tastatur klappt nicht zusaetzlich auf`,await p.evaluate(()=>document.getElementById('withdrawAmount').getAttribute('inputmode')==='none'));
  await p.tap('#withdrawAmount');await p.waitForTimeout(200);
  const breite=await p.evaluate(()=>Math.round(document.getElementById('kcZiffernFeld').getBoundingClientRect().width));
  pruefe(`${seite} ${vb}x${vh}: Tippen ins Betragsfeld oeffnet ein kleines Ziffernfeld`,await offen()&&breite<=300,breite+' px');
  const ganz=await p.evaluate(()=>{const r=document.getElementById('kcZiffernFeld').getBoundingClientRect(),ok=document.querySelector('#kcZiffernFeld [data-ziffern-ok]').getBoundingClientRect();
    const oben=document.elementFromPoint(ok.left+ok.width/2,ok.top+ok.height/2);return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth&&!!oben&&oben.closest('#kcZiffernFeld')!==null});
  pruefe(`${seite} ${vb}x${vh}: Ziffernfeld ganz sichtbar, OK-Taste antippbar`,ganz);
  for(const z of ['5',',','5','0'])await p.tap(`#kcZiffernFeld [data-ziffer="${z}"]`);
  pruefe(`${seite} ${vb}x${vh}: 5 , 5 0 ergibt 5,50`,await p.inputValue('#withdrawAmount')==='5.50',await p.inputValue('#withdrawAmount'));
  await p.tap('#kcZiffernFeld [data-ziffern-ok]');await p.waitForTimeout(150);
  pruefe(`${seite} ${vb}x${vh}: OK schliesst das Ziffernfeld, Betrag bleibt`,!(await offen())&&await p.inputValue('#withdrawAmount')==='5.50');
  await p.tap('#withdrawAmount');await p.waitForTimeout(150);
  await p.tap('#withdrawNote');await p.waitForTimeout(150);
  pruefe(`${seite} ${vb}x${vh}: Tippen daneben schliesst das Ziffernfeld`,!(await offen()));
  await p.tap('#withdrawAmount');await p.waitForTimeout(150);
  await p.evaluate(()=>document.querySelector('#kcBetragBlock [data-schnell="0.5"]').click());await p.waitForTimeout(150);
  pruefe(`${seite} ${vb}x${vh}: Schnellbetrag 0,50 setzt 0,50 und schliesst das Ziffernfeld`,await p.inputValue('#withdrawAmount')==='0.50'&&!(await offen()));
  await p.tap('[data-withdraw-reason="WC-Geld"]');await p.waitForTimeout(150);
  const vorher=await p.evaluate(()=>readWithdrawals?readWithdrawals().length:-1).catch(()=>-1);
  await p.tap('#saveWithdrawal');await p.waitForTimeout(1200);
  const gespeichert=await p.evaluate(()=>{const k=Object.keys(localStorage).find(k=>/withdraw/i.test(k));const rows=k?JSON.parse(localStorage.getItem(k)||'[]'):[];return rows[rows.length-1]||null});
  pruefe(`${seite} ${vb}x${vh}: WC-Geld-Entnahme ueber 0,50 € gespeichert`,!!gespeichert&&gespeichert.amount===0.5&&gespeichert.amountCents===50&&gespeichert.reason==='WC-Geld'&&!(await p.evaluate(()=>document.getElementById('withdrawDialog').open)),JSON.stringify(gespeichert&&{a:gespeichert.amount,c:gespeichert.amountCents,r:gespeichert.reason}));
  await ctx.close();
 }
}catch(err){console.log('ABBRUCH:',err&&err.stack||err);fehler++}
await b.close();s.close();console.log(fehler?`\n${fehler} FEHLER`:'\nAlles OK');process.exit(fehler?1:0)})();
