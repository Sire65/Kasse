/* Aenderungen vom 26.09.2026 (Rabatt-Dialog neu mit 20-Cent-Rundung, digitaler Bon, Verkaufszeiten im
   Info-Dialog, neue Pfandbilder, App-Hoehe) - zusammengefuehrt am 28.09.2026. Prueft Live UND Schulung
   und dass die neueren Funktionen vom 23./24.09. (X-Bericht, Helfer, Zahlenfeld, Kombis) erhalten sind. */
try{require.resolve('playwright')}catch(e){console.log('  ueberspringen: Playwright nicht installiert');process.exit(0)}
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const WURZEL=path.join(__dirname,'..'),BILDER=process.env.KC_SCREENSHOTS||'';
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const s=http.createServer((q,r)=>{const p=path.join(WURZEL,decodeURIComponent(q.url.split('?')[0]));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end('x')}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(d)})});
let fehler=0;const pruefe=(n,b,z='')=>{console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'  ['+z+']':''}`);if(!b)fehler++};
(async()=>{await new Promise(r=>s.listen(8871,r));const b=await chromium.launch();
for(const PFAD of ['/pos/index.html','/schulung/pos/index.html']){console.log('== '+PFAD);
const ctx=await b.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});const p=await ctx.newPage();
const fehlerSeite=[];p.on('pageerror',e=>{fehlerSeite.push(e.message);console.log('PAGEERROR:',e.message)});
await p.addInitScript(()=>{if(!sessionStorage.getItem('i')){sessionStorage.setItem('i','1');localStorage.setItem('kc_master_v040',JSON.stringify({registerId:'KASSE-01',pinLockEnabled:false}));localStorage.setItem('kc_offers_v100','[]')}});
await p.goto('http://127.0.0.1:8871'+PFAD);await p.waitForTimeout(2500);
await p.evaluate(()=>{const k=[...document.querySelectorAll('button')].find(x=>/KASSE STARTEN/i.test(x.textContent));if(k)k.click()});await p.waitForTimeout(600);
await p.evaluate(()=>{const k=[...document.querySelectorAll('button')].find(x=>/^OK$/.test(x.textContent.trim())&&x.offsetParent);if(k)k.click()});await p.waitForTimeout(600);
// App-Hoehe
const h=await p.evaluate(()=>({h:document.documentElement.style.getPropertyValue('--app-height'),w:document.documentElement.style.getPropertyValue('--app-width'),init:typeof window.AdaptiveLayoutCore?.init,ver:window.AdaptiveLayoutCore?.version}));
pruefe('--app-height/--app-width gesetzt, Layout-Core 1.0.1',h.h==='800px'&&h.w==='1280px'&&h.ver==='1.0.1',JSON.stringify(h));
// Pfandbilder
const bilder=await p.evaluate(async()=>{const ids=['zangeplus','zangeminus','glaszangebundleminus'];const r={};for(const id of ids){const pr=PRODUCTS.find(x=>x.id===id);const img=new Image();img.src=pr.image;await new Promise(f=>{img.onload=img.onerror=f});r[id]=pr.image.split('/').pop()+':'+img.naturalWidth}return r});
pruefe('Neue Pfandbilder gesetzt und ladbar',Object.values(bilder).every(v=>/(feuerzangenpfand|feuerzangerueckgabe|glas_feuerzangerueckgabe)_version_3\.webp:[1-9]/.test(v)),JSON.stringify(bilder));
// Rabatt: Warenkorb Gluehwein rot (mit Pfand) x3
await p.evaluate(()=>{const pr=productsForSale().find(x=>x.id==='grot');for(let i=0;i<3;i++)addConfiguredProduct(pr,null)});await p.waitForTimeout(200);
const vorher=await p.evaluate(()=>({gross:grossTotal(),basis:discountBase()}));
await p.evaluate(()=>document.getElementById('discountBtn').click());await p.waitForTimeout(300);
const d1=await p.evaluate(()=>({offen:document.getElementById('discountDialog').open,schritt2:document.getElementById('discountStepPercent').disabled,uebernehmen:document.getElementById('applyDiscountBtn').disabled,anzahl:document.getElementById('discountSummaryCount').textContent,summe:document.getElementById('discountSummaryTotal').textContent}));
pruefe('Rabatt-Dialog: offen, Schritt 2 + Übernehmen ausgegraut',d1.offen&&d1.schritt2&&d1.uebernehmen,JSON.stringify(d1));
await p.evaluate(()=>document.querySelector('[data-discount-reason="Stammgast"]').click());await p.waitForTimeout(200);
const d2=await p.evaluate(()=>({prozent:document.getElementById('discountCustomPercent').value,schritt2:document.getElementById('discountStepPercent').disabled,uebernehmen:document.getElementById('applyDiscountBtn').disabled,ende:document.getElementById('discountPreview').textContent}));
pruefe('Stammgast setzt 10 % vor und schaltet frei',d2.prozent==='10'&&!d2.schritt2&&!d2.uebernehmen,JSON.stringify(d2));
if(BILDER)await p.screenshot({path:path.join(BILDER,'zip-rabatt'+(PFAD.includes('schulung')?'-schulung':'')+'.png')});
await p.evaluate(()=>document.querySelector('[data-discount-percent="3"]').click());await p.waitForTimeout(150);
await p.evaluate(()=>document.getElementById('applyDiscountBtn').click());await p.waitForTimeout(300);
const r=await p.evaluate(()=>({total:total(),gross:grossTotal(),rabatt:discountAmount(),basis:discountBase()}));
const endeBasis=Math.round((r.basis-r.rabatt)*100);
pruefe('3 %: Endbetrag der rabattfähigen Summe auf 20 Cent AUFgerundet (zugunsten der Kasse)',endeBasis%20===0&&r.rabatt<=r.basis*0.03+1e-9&&r.rabatt>=0,JSON.stringify(r));
// Verkauf + digitaler Bon AUS (Standard): kein QR
await p.evaluate(()=>document.getElementById('payBtn').click());await p.waitForTimeout(700);
const bonAus=await p.evaluate(()=>({qr:!!document.getElementById('kcDigitalerBon'),leer:state.cart.length===0,letzter:readTransactions().slice(-1)[0]?.discount?.reason}));
pruefe('Digitaler Bon standardmäßig AUS: kein QR, Verkauf durch',!bonAus.qr&&bonAus.leer&&bonAus.letzter==='Stammgast',JSON.stringify(bonAus));
// Digitaler Bon AN
await p.evaluate(()=>{state.master.digitalBonEnabled=true});
await p.evaluate(()=>{addConfiguredProduct(productsForSale().find(x=>x.id==='grot'),null)});await p.waitForTimeout(150);
const t0=Date.now();await p.evaluate(()=>document.getElementById('payBtn').click());await p.waitForTimeout(500);
const bonAn=await p.evaluate(()=>{const b=document.getElementById('kcDigitalerBon');const c=b?.querySelector('canvas');let dunkel=0;if(c){const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=0;i<d.length;i+=4)if(d[i]<100)dunkel++}return {da:!!b,dunkel,leer:state.cart.length===0,klickbar:(()=>{const t=document.querySelector('.product-tile').getBoundingClientRect();const o=document.elementFromPoint(t.left+t.width/2,t.top+t.height/2);return !!o?.closest('.product-tile')})()}});
pruefe('Digitaler Bon AN: QR erscheint (gezeichnet), Kasse sofort weiter bedienbar',bonAn.da&&bonAn.dunkel>500&&bonAn.leer&&bonAn.klickbar,JSON.stringify(bonAn));
if(BILDER)await p.screenshot({path:path.join(BILDER,'zip-digitalbon'+(PFAD.includes('schulung')?'-schulung':'')+'.png')});
await p.evaluate(()=>document.querySelector('#kcDigitalerBon [data-schliessen]').click());
// Info-Dialog: Verkaufszeiten-Knopf
await p.evaluate(()=>openProductInfo?openProductInfo('grot'):null).catch(()=>{});
let info=await p.evaluate(()=>({offen:document.getElementById('productInfoDialog')?.open,knopf:!!document.getElementById('productInfoSalesBtn')}));
if(!info.offen){await p.evaluate(()=>document.querySelector('.product-tile-wrap [class*="info"]')?.click());await p.waitForTimeout(300);info=await p.evaluate(()=>({offen:document.getElementById('productInfoDialog')?.open,knopf:!!document.getElementById('productInfoSalesBtn')}))}
if(info.offen){await p.evaluate(()=>document.getElementById('productInfoSalesBtn').click());await p.waitForTimeout(400)}
const vz=await p.evaluate(()=>({kurve:[...document.querySelectorAll('dialog[open]')].map(d=>d.id)}));
pruefe('Info-Dialog hat Knopf „Verkaufszeiten heute“ und er öffnet die Auswertung',info.offen&&info.knopf&&vz.kurve.some(id=>/sales|kurve/i.test(id)),JSON.stringify({info,vz}));
// X-Bericht / Helfer (neuere GitHub-Funktionen) noch vorhanden
const alt=await p.evaluate(()=>({xb:typeof xBerichtAbschnitte,helfer:typeof openHelfer,zf:typeof openZahlenfeld,beleg:typeof belegBediener,kombi:PACKAGES.some(k=>k.id==='PKG-GKM-GR')}));
pruefe('Neuere GitHub-Funktionen erhalten (X-Bericht, Helfer, Zahlenfeld, Bediener-Beleg, Kombis)',alt.xb==='function'&&alt.helfer==='function'&&alt.zf==='function'&&alt.beleg==='function'&&alt.kombi,JSON.stringify(alt));
pruefe('Keine Seitenfehler',fehlerSeite.length===0,fehlerSeite.join(' | '));
await ctx.close()}
await b.close();s.close();console.log(fehler?`\n${fehler} FEHLER`:'\nAlles OK');process.exit(fehler?1:0)})();
