/* Pfand-Plus-Kacheln unter "Sonstiges" (30.09.2026)
   Betreiber: "Pack die beiden Plus-Positionen in der Pfandgruppe unter Sonstiges, sonst vertut man sich zu schnell."
   Geprueft in Kasse und Schulung, frisches Geraet UND Geraet mit bereits gespeicherter Artikelliste:
   - Pfand-Gruppe zeigt nur noch die Rueckgaben, Glaspfand/Feuerzangenpfand stehen unter Sonstiges.
   - Warengruppe bleibt "Pfand": gebuchte Position zaehlt als Pfand, kein Rabatt darauf.
   - "+"-Pfand an den Getraenken unveraendert.
   - Einmalige Umstellung: eine spaetere eigene Einstellung im Artikelstamm wird nicht ueberschrieben. */
try{require.resolve('playwright')}catch(e){console.log('  ueberspringen: Playwright nicht installiert');process.exit(0)}
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const W=path.join(__dirname,'..');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.svg':'image/svg+xml','.jpg':'image/jpeg'};
const s=http.createServer((q,r)=>{const p=path.join(W,decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kasse/,''));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(d)})});
let fehler=0;const pruefe=(n,b,z='')=>{console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'  ['+z+']':''}`);if(!b)fehler++};
// Artikelliste wie auf einem Geraet, das schon laeuft: Plus-Pfand noch ohne neue Felder
const quelle=fs.readFileSync(path.join(W,'pos/app.js'),'utf8');
const altListe=[{id:'grot',name:'Glühwein rot',price:3.5,category:'Getränke',depositComponents:[{id:'glass',name:'Glaspfand',price:2}]},
 {id:'glasplus',name:'Glaspfand',price:2,category:'Pfand',manualDeposit:true},{id:'zangeplus',name:'Feuerzangenpfand',price:2,category:'Pfand',manualDeposit:true},
 {id:'glasminus',name:'Glasrückgabe',price:-2,category:'Pfand'},{id:'zangeminus',name:'Feuerzange Rückgabe',price:-2,category:'Pfand'},
 {id:'glaszangebundleminus',name:'Glas + Feuerzange Rückgabe',price:-4,category:'Pfand'},{id:'becher',name:'Außer-Haus-Becher',price:1,category:'Sonstiges'}];
(async()=>{await new Promise(r=>s.listen(8919,r));const b=await chromium.launch();
try{
 for(const seite of ['pos','schulung/pos'])for(const geraet of ['frisch','bestehend']){
  const ctx=await b.newContext({viewport:{width:1280,height:800}});const p=await ctx.newPage();
  await p.addInitScript(([geraet,alt])=>{if(sessionStorage.getItem('t'))return;sessionStorage.setItem('t','1');localStorage.setItem('kc_master_v040',JSON.stringify({registerId:'KASSE-01',pinLockEnabled:false}));if(geraet==='bestehend')localStorage.setItem('kc_products_v050',JSON.stringify(alt))},[geraet,altListe]);
  await p.goto(`http://127.0.0.1:8919/Kasse/${seite}/index.html`);await p.waitForTimeout(3000);
  const n=`${seite} (${geraet})`;
  const zeige=kat=>p.evaluate(k=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());state.activeCategory=k;state.productPage=0;renderCategories();renderProducts();return allProductsForCategory?allProductsForCategory().map(x=>x.id):productsForSale().filter(x=>productInCategory(x,k)).map(x=>x.id)},kat);
  const pfand=await zeige('Pfand');
  pruefe(`${n}: Pfand-Gruppe zeigt nur Rückgaben`,!pfand.includes('glasplus')&&!pfand.includes('zangeplus')&&pfand.includes('glasminus')&&pfand.includes('zangeminus'),pfand.join(','));
  const kacheln=await p.evaluate(()=>[...document.querySelectorAll('#productGrid .product-tile')].map(t=>t.getAttribute('aria-label')||t.textContent.trim()).join('|'));
  pruefe(`${n}: auch als Kacheln keine Plus-Pfand-Kachel in Pfand`,!/Glaspfand|Feuerzangenpfand/.test(kacheln.replace(/Glas \+ Feuerzange Rückgabe|Feuerzange Rückgabe/g,'')),kacheln.slice(0,160));
  const sonst=await zeige('Sonstiges');
  pruefe(`${n}: Glaspfand und Feuerzangenpfand unter Sonstiges`,sonst.includes('glasplus')&&sonst.includes('zangeplus'),sonst.join(','));
  const pos=await p.evaluate(()=>{state.cart=[];const pr=PRODUCTS.find(x=>x.id==='glasplus');addConfiguredProduct(pr,null);const it=state.cart[state.cart.length-1];return {kat:it&&it.category,preis:it&&it.price,warengruppe:pr.category}});
  pruefe(`${n}: gebuchte Position bleibt Pfand (+2,00)`,pos.kat==='Pfand'&&pos.preis===2&&pos.warengruppe==='Pfand',JSON.stringify(pos));
  const rabatt=await p.evaluate(()=>typeof discountBase==='function'?discountBase():null);
  pruefe(`${n}: kein Rabatt auf Pfand`,rabatt===0,String(rabatt));
  const gl=await p.evaluate(()=>{state.cart=[];addConfiguredProduct(productsForSale().find(x=>x.id==='grot'),null);return state.cart.map(i=>i.name+':'+(i.deposits||i.depositComponents||[]).length).join(',')});
  pruefe(`${n}: Getränk bringt sein Pfand weiter automatisch mit`,/Glühwein rot:[1-9]/.test(gl)||/Glaspfand/.test(gl),gl);
  // Betreiber stellt es im Artikelstamm zurueck -> bleibt nach Neustart so
  await p.evaluate(()=>{const pr=PRODUCTS.find(x=>x.id==='glasplus');pr.hideInOwnCategory=false;pr.displayCategories=[];localStorage.setItem('kc_products_v050',JSON.stringify(PRODUCTS))});
  await p.reload();await p.waitForTimeout(2500);
  const nachher=await zeige('Pfand');
  pruefe(`${n}: eigene Einstellung wird beim Neustart nicht überschrieben`,nachher.includes('glasplus')&&!nachher.includes('zangeplus'),nachher.join(','));
  await ctx.close();
 }
}catch(err){console.log('ABBRUCH:',err&&err.stack||err);fehler++}
await b.close();s.close();console.log(fehler?`\n${fehler} FEHLER`:'\nAlles OK');process.exit(fehler?1:0)})();
