/* Pfand-Rueckgaben auch unter Getraenke, Apfelpunsch mit "+" (07.10.2026)
   Betreiber: "Baue mir noch die 3 Pfandartikel Glas, Zange, beides kombiniert in die Gruppe Getraenke unten drunter.
   Den Rest so lassen, und bei Apfelpunsch muss noch ein Pluszeichen wegen Amaretto und Rum dazu."
   Geprueft in Kasse und Schulung, KC003 und Standard, frisches Geraet und Geraet mit gespeichertem Altbestand:
   - Getraenke enden mit Glasrueckgabe, Feuerzange Rueckgabe, Glas + Feuerzange Rueckgabe (nach Schuss Rum/Amaretto)
   - Pfand zeigt weiter genau diese drei, Warengruppe bleibt "Pfand"
   - Apfelpunsch hat den +-Knopf, der die Schuss-Auswahl (ohne / Rum / Amaretto) oeffnet */
const pw=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const W=path.join(__dirname,'..');const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const s=http.createServer((q,r)=>{const p=path.join(W,decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kasse/,''));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(d)})});
let f=0;const pr=(n,b,z='')=>{console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'  ['+z+']':''}`);if(!b)f++};
const ENGINE=process.env.E||'chromium',PORT=Number(process.env.P||8979);
const PFAND=['Glasrückgabe','Feuerzange Rückgabe','Glas + Feuerzange Rückgabe'];
const ALT=[{id:'apfel',name:'Apfelpunsch',price:2.5,category:'Getränke',image:'assets/apfelpunsch_version_3.png',depositComponents:[{id:'glass',name:'Glaspfand',price:2}]},{id:'grot',name:'Glühwein rot',price:3.5,category:'Getränke',sortOrder:2,optionGroup:'shot',image:'assets/gluehwein_version_3.png'},{id:'glasminus',name:'Glasrückgabe',price:-2,category:'Pfand',image:'assets/pfandrueckgabe_version_3.png'},{id:'zangeminus',name:'Feuerzange Rückgabe',price:-2,category:'Pfand',image:'assets/feuerzangerueckgabe_version_3.webp'},{id:'glaszangebundleminus',name:'Glas + Feuerzange Rückgabe',price:-4,category:'Pfand',image:'assets/glas_feuerzangerueckgabe_version_3.webp'}];
(async()=>{await new Promise(r=>s.listen(PORT,r));const b=await pw[ENGINE].launch();
try{
for(const seite of ['pos','schulung/pos'])for(const ober of ['KC003','Standard'])for(const alt of [false,true]){
 const p=await b.newPage({viewport:{width:1280,height:800}});const js=[];p.on('pageerror',e=>js.push(e.message));
 await p.addInitScript(([o,alt,ALT])=>{if(sessionStorage.getItem('x'))return;sessionStorage.setItem('x','1');localStorage.setItem('kc_master_v040',JSON.stringify({registerId:'KASSE-01',pinLockEnabled:false}));if(o==='Standard'){localStorage.setItem('kc.kassenoberflaeche.standard.v1','1');localStorage.removeItem('kc.kassenoberflaeche.gewaehlt.v1')}if(alt)localStorage.setItem('kc_products_v050',JSON.stringify(ALT))},[ober,alt,ALT]);
 await p.goto(`http://127.0.0.1:${PORT}/Kasse/${seite}/index.html`);await p.waitForTimeout(3000);
 const zu=()=>p.evaluate(()=>{const g=document.getElementById('fullscreenGate');if(g)g.hidden=true;document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.querySelectorAll('#kcStartupCheck,.kc-startup-check').forEach(x=>x.remove())});await zu();
 if(ober==='KC003'){await p.evaluate(()=>{document.getElementById('moreDialog').showModal();const sel=document.getElementById('kcAufbauWahl');if(!sel)return;sel.dispatchEvent(new Event('focus'));const opt=[...sel.options].find(x=>x.textContent.startsWith('KC003'));if(opt){sel.value=opt.value;sel.dispatchEvent(new Event('change'))}});await p.waitForTimeout(800);await p.waitForLoadState();await p.waitForTimeout(3000);await zu()}
 const liste=async g=>{await p.evaluate(g=>{const b=[...document.querySelectorAll('.category-tabs button')].find(x=>x.textContent.includes(g)&&x.getBoundingClientRect().width>0);b&&b.click()},g);await p.waitForTimeout(300);return p.evaluate(()=>[...document.querySelectorAll('#productGrid .product-tile-wrap')].map(w=>w.querySelector('.product-label strong').textContent))};
 const n=`${ENGINE} ${seite} ${ober} ${alt?'Altbestand':'frisch'}`;
 const pf=await liste('Pfand');const getr=await liste('Getränke');
 pr(`${n}: Getränke enden mit den drei Pfand-Rückgaben`,JSON.stringify(getr.slice(-3))===JSON.stringify(PFAND),getr.join(' | '));
 if(!alt)pr(`${n}: Pfand-Rückgaben stehen nach Schuss Rum/Amaretto`,getr.indexOf('Glasrückgabe')>getr.indexOf('Schuss Amaretto')&&getr.indexOf('Schuss Amaretto')>0);
 pr(`${n}: Pfandgruppe unverändert`,JSON.stringify(pf)===JSON.stringify(PFAND),pf.join(' | '));
 const w=await p.evaluate(()=>JSON.parse(localStorage.getItem('kc_products_v050')).filter(x=>/minus$/.test(x.id)).map(x=>x.category));
 pr(`${n}: Warengruppe der Rückgaben bleibt „Pfand“`,w.length>=3&&w.every(c=>c==='Pfand'),w.join(','));
 const plus=await p.evaluate(()=>{const b=document.querySelector('.product-variant-button[data-variant-id="apfel"]');if(!b)return '';b.click();return document.getElementById('optionButtons')?.textContent||''});
 pr(`${n}: Apfelpunsch-„+“ öffnet Schuss Rum / Schuss Amaretto`,/Schuss Rum/.test(plus)&&/Schuss Amaretto/.test(plus)&&/Ohne Schuss/.test(plus));
 pr(`${n}: keine JS-Fehler`,!js.filter(x=>!/access control|kc-sync|Load failed|Failed to fetch/.test(x)).length,js.join('|').slice(0,200));
 await p.close()}
}catch(e){console.log('ABBRUCH:',e&&e.stack||e);f++}
await b.close();s.close();console.log(f?f+' FEHLER':'Alles OK');process.exit(f?1:0)})();
