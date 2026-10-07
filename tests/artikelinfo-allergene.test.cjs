/* Artikel-Info: Allergene werden angezeigt (07.10.2026)
   Gefunden beim Durchspielen der Uebungsliste ("Ein Kunde fragt, ob im Gluehwein Allergene drin sind"):
   sanitizeProduct machte aus den strukturierten Artikelinformationen Text - im Info-Fenster stand bei
   jedem Artikel "Allergene [object Object]" und "nicht vollstaendig geprueft".
   Geprueft in Kasse und Schulung: frisches Geraet und Geraet mit bereits verdorbenen gespeicherten Daten.
   - Gluehwein rot: "Schwefeldioxid / Sulfite: Enthalten", Kurzinformation, kein "[object Object]", kein Hinweis
     "nicht vollstaendig geprueft" (der Artikel ist freigegeben)
   - Gruenkohl (Allergene als Text): Text bleibt ("Kann Senf und Sellerie enthalten")
   - Produktdatenblatt zeigt die Naehrwerte und Sulfite als "Enthalten" */
const pw=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const W=path.join(__dirname,'..');const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const s=http.createServer((q,r)=>{const p=path.join(W,decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kasse/,''));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(d)})});
let f=0;const pr=(n,b,z='')=>{console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'  ['+z+']':''}`);if(!b)f++};
const ENGINE=process.env.E||'chromium',PORT=Number(process.env.P||8973);
(async()=>{await new Promise(r=>s.listen(PORT,r));const b=await pw[ENGINE].launch();
try{
for(const seite of ['pos','schulung/pos'])for(const verdorben of [false,true]){
 const p=await b.newPage();const js=[];p.on('pageerror',e=>js.push(e.message));
 await p.addInitScript(v=>{if(sessionStorage.getItem('x'))return;sessionStorage.setItem('x','1');localStorage.setItem('kc_master_v040',JSON.stringify({registerId:'KASSE-01',pinLockEnabled:false}));
  if(v)localStorage.setItem('kc_products_v050',JSON.stringify([{id:'grot',name:'Glühwein rot',price:3.5,category:'Getränke',image:'assets/gluehwein_version_3.png',info:{ingredients:'Rotwein, Zucker, Gewürze',allergens:'[object Object]',contents:'',important:'Alkoholhaltig.',notes:''}},{id:'gruenkohl',name:'Grünkohl',price:5.5,category:'Speisen',image:'assets/gruenkohl_version_3.png',info:{allergens:'Kann Senf und Sellerie enthalten',important:'Heiß ausgegeben.'}}]))},verdorben);
 await p.goto(`http://127.0.0.1:${PORT}/Kasse/${seite}/index.html`);await p.waitForTimeout(3000);
 const n=`${ENGINE} ${seite} ${verdorben?'verdorbene Daten':'frisch'}`;
 const info=async id=>{await p.evaluate(id=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());openProductInfo(id)},id);await p.waitForTimeout(200);return p.evaluate(()=>document.getElementById('productInfoContent').innerText.replace(/\s+/g,' '))};
 const g=await info('grot');
 pr(`${n}: Glühwein zeigt „Schwefeldioxid / Sulfite: Enthalten“`,/Schwefeldioxid \/ Sulfite: Enthalten/.test(g)&&!/object Object/.test(g)&&/Heißer roter Glühwein/.test(g)&&!/nicht vollständig geprüft/.test(g),g.slice(0,200));
 const k=await info('gruenkohl');
 pr(`${n}: Grünkohl zeigt den Allergen-Text`,/Kann Senf und Sellerie enthalten/.test(k)&&!/object Object/.test(k),k.slice(0,160));
 const d=await p.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());openProductInfo('grot');document.getElementById('productInfoDetailsBtn').click();const e=document.getElementById('productDetailsContent');return e?e.innerText.replace(/\s+/g,' '):''});
 pr(`${n}: Datenblatt mit Sulfite „Enthalten“ und Nährwerten`,/Sulfite\s*Enthalten/.test(d)&&/85/.test(d),d.slice(0,160));
 pr(`${n}: keine JS-Fehler`,!js.filter(x=>!/access control|kc-sync|Load failed|Failed to fetch/.test(x)).length,js.join('|').slice(0,200));
 await p.close()}
}catch(e){console.log('ABBRUCH:',e&&e.stack||e);f++}
await b.close();s.close();console.log(f?f+' FEHLER':'Alles OK');process.exit(f?1:0)})();
