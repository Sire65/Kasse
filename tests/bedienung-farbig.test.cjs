/* Bedienung farbig (02.10.2026): Weitere Funktionen geordnet und farbig, Rabatt-Gruende farbig mit Vorschlag,
   Gutschein mit echten Scheinen, Bargeldeinzahlung mit grossem Scanfeld, Vorschau und Kurzcode-Kaestchen.
   Betreiber: "Sind damit alle Uebersichten bedienerfreundlich aufgebaut?" -> Entwuerfe -> "ja alles so bauen".
   Geprueft in Kasse und Schulung (1280x800, 1024x768; mit E=webkit auch iPad-Groessen):
   Knoepfe ausgegraut bis zur Wahl, Buchungen laufen ueber die unveraenderten vorhandenen Funktionen
   (Rabatt Stammgast, Gutschein 35 EUR, Anfangsbestand 150 EUR per Code, Nachfuellung 600 EUR per Kurzcode).
   Bildschirmfotos nur mit BILDER=1. */
const pw=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const W=path.join(__dirname,'..');const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
const s=http.createServer((q,r)=>{const p=path.join(W,decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kasse/,''));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(d)})});
let f=0;const pr=(n,b,z='')=>{console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'  ['+z+']':''}`);if(!b)f++};
const ENGINE=process.env.E||'chromium',PORT=Number(process.env.P||8950);
(async()=>{await new Promise(r=>s.listen(PORT,r));const b=await pw[ENGINE].launch();
for(const [seite,vb,vh] of (process.env.F?JSON.parse(process.env.F):[['pos',1280,800],['schulung/pos',1280,800],['pos',1024,768]])){
const ctx=await b.newContext({viewport:{width:vb,height:vh}});const p=await ctx.newPage();const js=[];p.on('pageerror',e=>js.push(e.message));
await p.addInitScript(()=>{if(!localStorage.getItem('kc_master_v040'))localStorage.setItem('kc_master_v040',JSON.stringify({registerId:'KASSE-01',pinLockEnabled:false}))});
await p.goto(`http://127.0.0.1:${PORT}/Kasse/${seite}/index.html`);await p.waitForTimeout(3500);
const n=`${ENGINE} ${seite} ${vb}x${vh}`,tag=`${ENGINE}_${seite.replace('/','_')}_${vb}`;
const zu=()=>p.evaluate(()=>{const g=document.getElementById('fullscreenGate');if(g)g.hidden=true;document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.querySelectorAll('#kcStartupCheck,.kc-startup-check').forEach(x=>x.remove())});
const k=sel=>p.evaluate(s=>document.querySelector(s).click(),sel);
// 1 Mehr
await zu();await p.evaluate(()=>document.getElementById('moreDialog').showModal());await p.waitForTimeout(300);
const m=await p.evaluate(()=>({titel:[...document.querySelectorAll('#moreDialog .kc-mg-titel')].filter(t=>!t.hidden).map(t=>t.textContent),farbe:getComputedStyle(document.querySelector('#moreDialog [data-action="withdraw"]')).backgroundColor,klickbar:!!document.querySelector('#moreDialog .more-grid [data-action="helfer"]')}));
pr(`${n}: Mehr-Menü geordnet (Geld/Rückgabe/Bon), Entnahme grün`,m.titel.length>=3&&/46, 125, 50/.test(m.farbe)&&m.klickbar,m.titel.join(' | '));
if(process.env.BILDER)await p.screenshot({path:`${tag}_1_mehr.png`});
await k('#moreDialog [data-action="helfer"]');await p.waitForTimeout(400);
pr(`${n}: Knopf im Mehr-Menü funktioniert weiter (Helfer)`,await p.evaluate(()=>!document.getElementById('moreDialog').open));
// 2 Rabatt
await zu();await p.evaluate(()=>document.querySelector('#products [data-id], .product-grid [data-id], [data-product-id]')?.click());await p.waitForTimeout(400);
await p.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>{if(d.id!=='discountDialog')d.close()});document.getElementById('discountBtn').click()});
pr(`${n}: Rabatt-Fenster offen mit Artikel`,await p.evaluate(()=>document.getElementById('discountDialog').open&&document.getElementById('discountSummaryCount').textContent!=='0'));await p.waitForTimeout(400);
pr(`${n}: Rabatt – Übernehmen grau, Hinweis`,await p.evaluate(()=>document.getElementById('applyDiscountBtn').disabled&&/zuerst/.test(document.getElementById('kcRabattHinweis')?.textContent||'')));
if(process.env.BILDER)await p.screenshot({path:`${tag}_2a_rabatt.png`});
await k('[data-discount-reason="Stammgast"]');await p.waitForTimeout(300);
const r=await p.evaluate(()=>({frei:!document.getElementById('applyDiscountBtn').disabled,h:document.getElementById('kcRabattHinweis').textContent,v:document.getElementById('discountPreview').textContent}));
pr(`${n}: Rabatt – Stammgast 10 % vorgeschlagen, frei, Ersparnis angezeigt`,r.frei&&/10 %/.test(r.h)&&!/−0,00/.test(r.h),r.h+' / '+r.v);
if(process.env.BILDER)await p.screenshot({path:`${tag}_2b_rabatt.png`});
await k('#applyDiscountBtn');await p.waitForTimeout(400);
pr(`${n}: Rabatt übernommen (Fenster zu)`,await p.evaluate(()=>!document.getElementById('discountDialog').open));
// 3 Gutschein
await zu();await p.evaluate(()=>document.querySelector('.more-grid button[data-action="gutschein"]').click());await p.waitForTimeout(500);
const g0=await p.evaluate(()=>({bilder:[...document.querySelectorAll('#gsBetraege img')].filter(i=>i.complete&&i.naturalWidth>0).length,aus:document.getElementById('gsAusstellen').disabled,zif:getComputedStyle(document.getElementById('gsZiffern')).display}));
pr(`${n}: Gutschein – 5 echte Scheine, Ziffernfeld zu, Drucken grau`,g0.bilder===5&&g0.aus&&g0.zif==='none',JSON.stringify(g0));
if(process.env.BILDER)await p.screenshot({path:`${tag}_3a_gutschein.png`});
await k('#gsBetraege [data-gs-betrag="20"]');await p.waitForTimeout(200);
const g1=await p.evaluate(()=>({a:document.getElementById('kcGsAnzeige').textContent,aus:document.getElementById('gsAusstellen').disabled}));
pr(`${n}: Gutschein – 20 € gewählt, Drucken frei`,/20,00/.test(g1.a)&&!g1.aus,g1.a);
if(process.env.BILDER)await p.screenshot({path:`${tag}_3b_gutschein.png`});
await k('#kcGsAnders');await p.waitForTimeout(150);for(const z of ['3','5'])await k(`#gsZiffern [data-z="${z}"]`);await p.waitForTimeout(150);
pr(`${n}: Gutschein – Anderer Betrag 35 €`,/35,00/.test(await p.evaluate(()=>document.getElementById('kcGsAnzeige').textContent))&&await p.evaluate(()=>getComputedStyle(document.getElementById('gsZiffern')).display!=='none'));
if(process.env.BILDER)await p.screenshot({path:`${tag}_3c_gutschein.png`});
const vorG=await p.evaluate(()=>(window.KCGutschein?.alle?.()||JSON.parse(localStorage.getItem('kc_gutscheine_v1')||'[]')).length).catch(()=>-1);
await p.evaluate(()=>{window.open=()=>({document:{write(){},close(){}},print(){},close(){}})});
await k('#gsAusstellen');await p.waitForTimeout(500);
const erg=await p.evaluate(()=>document.getElementById('gsErgebnis').textContent);
pr(`${n}: Gutschein über 35,00 € ausgestellt`,/35,00/.test(erg)&&/ausgestellt/.test(erg),erg.slice(0,80));
pr(`${n}: danach Anzeige zurück, Drucken grau`,await p.evaluate(()=>document.getElementById('gsAusstellen').disabled));
// 4 Bargeld
await zu();await p.evaluate(()=>document.getElementById('cashDepositDialog').showModal());await p.waitForTimeout(300);
pr(`${n}: Bargeld – Übernehmen grau, Scanfeld groß`,await p.evaluate(()=>document.getElementById('applyCashDeposit').disabled&&document.getElementById('cashDepositPayload').getBoundingClientRect().height>=120));
if(process.env.BILDER)await p.screenshot({path:`${tag}_4a_bargeld.png`});
const code=await p.evaluate(()=>{const pl={format:'KC_CASH_TRANSFER',version:4,transferId:'TEST-'+Date.now(),time:new Date().toISOString(),effectiveDate:localBusinessDate(),breakdown:{150:1},looseTotal:150,rollTotal:0,total:150,type:'opening',registerId:'KASSE-01',operator:'Kassenwart Test'};pl.checksum=checksumObject(pl);return 'KCASH1:'+btoa(unescape(encodeURIComponent(JSON.stringify(pl))))});
await p.fill('#cashDepositPayload',code);await p.waitForTimeout(200);
const v=await p.evaluate(()=>({t:document.getElementById('kcBgVorschau').textContent,aus:document.getElementById('applyCashDeposit').disabled}));
pr(`${n}: Bargeld – Vorschau 150,00 € vor dem Übernehmen`,/150,00/.test(v.t)&&!v.aus,v.t);
if(process.env.BILDER)await p.screenshot({path:`${tag}_4b_bargeld.png`});
await k('#applyCashDeposit');await p.waitForTimeout(300);
pr(`${n}: Bargeld übernommen (vorhandene Funktion)`,/150,00/.test(await p.evaluate(()=>(document.getElementById('cashDepositResult').textContent+' '+(document.getElementById('cashDepositErgebnis')?.textContent||'')))),await p.evaluate(()=>document.getElementById('cashDepositResult').textContent.slice(0,90)));
await zu();await p.evaluate(()=>document.getElementById('cashDepositDialog').showModal());await p.waitForTimeout(200);
await p.fill('#kcKurz1','2');await p.fill('#kcKurz2','1');await p.fill('#kcKurz3','060000');await p.fill('#kcKurz4','9');await p.waitForTimeout(150);
const kf=await p.evaluate(()=>({aus:document.getElementById('applyCashShortCode').disabled,t:document.getElementById('kcKurzText').textContent}));
let q=0;'21060000'.split('').forEach((z,i)=>q+=Number(z)*(i+2));const pz=String(q%10);
pr(`${n}: Kurzcode mit falscher Prüfziffer gesperrt`,pz==='9'?true:kf.aus&&/stimmt nicht/.test(kf.t),kf.t);
await p.fill('#kcKurz4',pz);await p.waitForTimeout(150);
const kr=await p.evaluate(()=>({aus:document.getElementById('applyCashShortCode').disabled,t:document.getElementById('kcKurzText').textContent,alt:document.getElementById('cashShortCodeInput').value}));
pr(`${n}: Kurzcode richtig → Nachfüllung 600,00 € Kasse 1, frei`,!kr.aus&&/600,00/.test(kr.t)&&kr.alt==='2-1-060000-'+pz,kr.t);
if(process.env.BILDER)await p.screenshot({path:`${tag}_4c_bargeld.png`});
await k('#applyCashShortCode');await p.waitForTimeout(300);
pr(`${n}: Kurzcode übernommen (vorhandene Funktion)`,/600,00/.test(await p.evaluate(()=>document.getElementById('cashShortCodeResult').textContent+' '+(document.getElementById('cashDepositErgebnis')?.textContent||''))),await p.evaluate(()=>document.getElementById('cashShortCodeResult').textContent.slice(0,90)));
pr(`${n}: keine JS-Fehler`,!js.filter(x=>!/access control|kc-sync|Load failed|Failed to fetch/.test(x)).length,js.join('|').slice(0,200));
await ctx.close();}
await b.close();s.close();console.log(f?f+' FEHLER':'Alles OK');process.exit(f?1:0)})();
