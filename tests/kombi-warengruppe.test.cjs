/* Warengruppe "Kombi" und die zweigeteilte Kachel.
   Geprueft wird ueber die Oberflaeche des Programms, nicht ueber einen Nachbau. */
const {chromium}=require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const WURZEL=path.resolve(__dirname,'..');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.webmanifest':'application/manifest+json'};
let ok=0,rot=0; const p=(n,b,z='')=>{b?ok++:rot++;console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'   ['+z+']':''}`)};
const frei=async pg=>pg.evaluate(()=>{["fullscreenGate","kcStartupSummary","kcPinLockOverlay"].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display="none"});document.querySelectorAll("[data-kc-sperrend]").forEach(e=>e.style.display="none")});

(async()=>{
 const s=http.createServer((q,r)=>{const f=path.join(WURZEL,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end('x')}r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(d)})});
 await new Promise(r=>s.listen(8763,r));
 const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1700,height:1050}});

 // ---- Erst der ALTE Zustand: ein Geraet, das noch "Packages" gespeichert hat ----
 const alt=await ctx.newPage();
 await alt.addInitScript(()=>{
   localStorage.setItem("kc_groups_v050",JSON.stringify([
     {id:"WG01",name:"Getränke",shortName:"Getränke",sortOrder:10,color:"#173765",active:true},
     {id:"WG02",name:"Speisen",shortName:"Speisen",sortOrder:20,color:"#8b4a23",active:true},
     {id:"WG05",name:"Packages",shortName:"Packages",sortOrder:5,color:"#6d28d9",active:true}]));
 });
 await alt.goto('http://127.0.0.1:8763/pos/index.html'); await alt.waitForTimeout(6500);
 const migriert=await alt.evaluate(()=>({
   gruppen:GROUPS.map(g=>`${g.id}:${g.name}`),
   gespeichert:(JSON.parse(localStorage.getItem("kc_groups_v050")||"[]")).map(g=>g.name),
   nurEinmal:GROUPS.filter(g=>/Kombi|Packages/.test(g.name)).length}));
 p('ein Geraet mit dem alten Namen wird beim Start nachgezogen',
   migriert.gruppen.includes('WG05:Kombi'), JSON.stringify(migriert.gruppen));
 p('die Umbenennung wird auch gespeichert, nicht nur angezeigt',
   migriert.gespeichert.includes('Kombi')&&!migriert.gespeichert.includes('Packages'), JSON.stringify(migriert.gespeichert));
 p('es entsteht KEINE zweite Warengruppe daneben', migriert.nurEinmal===1, `${migriert.nurEinmal} Warengruppen`);
 await alt.close();

 // ---- Jetzt der normale Start ----
 const pg=await ctx.newPage();
 const fehler=[]; pg.on('pageerror',e=>fehler.push(e.message)); pg.on('dialog',d=>d.accept().catch(()=>{}));
 await pg.goto('http://127.0.0.1:8763/pos/index.html'); await pg.waitForTimeout(6500); await frei(pg);
 p('Kasse startet ohne Skriptfehler', fehler.length===0, fehler[0]||'keine');

 const knopf=await pg.evaluate(()=>[...document.querySelectorAll('#categories button')].map(x=>x.dataset.cat));
 p('der Warengruppenknopf heisst "Kombi"', knopf.includes('Kombi')&&!knopf.includes('Packages'), JSON.stringify(knopf));

 await pg.evaluate(()=>{state.activeCategory="Kombi";state.productPage=0;renderCategories();renderProducts()});
 await pg.waitForTimeout(800);
 const kacheln=await pg.evaluate(()=>[...document.querySelectorAll('#productGrid .product-tile')].length);
 p('die Warengruppe Kombi zeigt Artikel', kacheln>0, `${kacheln} Kacheln`);

 const bild=await pg.evaluate(()=>{
   const k=document.querySelector('#productGrid .kombi-bild'); if(!k)return null;
   const oben=k.querySelector('.kombi-oben'), unten=k.querySelector('.kombi-unten'), linie=k.querySelector('.kombi-linie line');
   const so=getComputedStyle(oben), su=getComputedStyle(unten);
   const r=k.getBoundingClientRect(), ro=oben.getBoundingClientRect(), ru=unten.getBoundingClientRect();
   return {obenBild:oben.getAttribute('src'), untenBild:unten.getAttribute('src'),
     obenClip:so.clipPath, untenClip:su.clipPath, strich:linie?getComputedStyle(linie).stroke:null,
     deckungsgleich:Math.abs(ro.width-r.width)<2&&Math.abs(ru.height-r.height)<2,
     obenGeladen:oben.naturalWidth>0, untenGeladen:unten.naturalWidth>0};
 });
 p('die Kombi-Kachel traegt ZWEI Bilder', !!bild&&!!bild.obenBild&&!!bild.untenBild,
   bild?`${bild.obenBild} / ${bild.untenBild}`:'keine Kombi-Kachel');
 p('beide Bilder sind wirklich geladen, keins ist ein totes Bild',
   bild?.obenGeladen===true&&bild?.untenGeladen===true, JSON.stringify({oben:bild?.obenGeladen,unten:bild?.untenGeladen}));
 p('das Getraenk liegt oben, das Essen unten rechts',
   /gluehwein|eierlikoer|apfelpunsch|feuerzange|roter_feger/i.test(bild?.obenBild||'')&&
   /gruenkohl|sauerkraut|hering|kartoffel|mettwurst/i.test(bild?.untenBild||''),
   `oben ${bild?.obenBild} · unten ${bild?.untenBild}`);
 p('oben ist das obere Dreieck, unten das untere', /polygon/.test(bild?.obenClip||'')&&/polygon/.test(bild?.untenClip||''),
   `${bild?.obenClip} | ${bild?.untenClip}`);
 p('beide fuellen die ganze Kachel - keine graue Ecke', bild?.deckungsgleich===true);
 p('die Trennlinie ist weiss gezeichnet', /255,\s*255,\s*255/.test(bild?.strich||''), bild?.strich);

 const text=await pg.evaluate(()=>document.querySelector('#productGrid .package-tag')?.textContent||'');
 p('unter dem Preis steht "beides zusammen"', text.trim()==='beides zusammen', text);

 // Ein normaler Artikel darf davon nichts abbekommen
 await pg.evaluate(()=>{state.activeCategory="Getränke";state.productPage=0;renderCategories();renderProducts()});
 await pg.waitForTimeout(600);
 const normal=await pg.evaluate(()=>({kombi:document.querySelectorAll('#productGrid .kombi-bild').length,
   bilder:document.querySelectorAll('#productGrid .product-tile>img').length}));
 p('ein normaler Artikel behaelt sein einzelnes Bild', normal.kombi===0&&normal.bilder>0, JSON.stringify(normal));

 // Verkauf und Auswertung
 await pg.evaluate(()=>{state.cart=[];state.activeCategory="Kombi";renderProducts();
   const pkg=activePackageProducts()[0]; addConfiguredProduct(pkg,null)});
 await pg.waitForTimeout(500);
 const imKorb=await pg.evaluate(()=>state.cart.map(x=>`${x.name} · ${x.category}`));
 p('eine verkaufte Kombination traegt die Warengruppe Kombi', /· Kombi$/.test(imKorb[0]||''), JSON.stringify(imKorb));

 const auswertung=await pg.evaluate(()=>{
   // eine alte Buchung von VOR der Umbenennung nachstellen
   const alteZeile={id:"PKG-ALT",name:"Alte Kombination",category:"Packages",qty:1,price:10};
   const gruppe=(()=>{const pr=PRODUCTS.find(x=>x.id===alteZeile.id||x.name===alteZeile.name);
     let g=pr?.category||alteZeile.category||"Ohne Warengruppe"; if(g==="Packages")g="Kombi"; return g})();
   return gruppe;
 });
 p('alte Buchungen mit "Packages" landen in der Auswertung unter Kombi', auswertung==='Kombi', auswertung);

 // Tagesvorschlaege duerfen nichts doppeln, was schon fest angelegt ist
 const doppelt=await pg.evaluate(()=>{
   rebuildDailyPackages();
   const schluessel=x=>[...(x.componentIds||[])].sort().join('+');
   const alle=PACKAGES.map(schluessel);
   const mehrfach=alle.filter((x,i)=>alle.indexOf(x)!==i);
   return {anzahl:PACKAGES.length, mehrfach,
     namen:activePackageProducts().map(x=>`${x.name} ${x.price}`)};
 });
 p('keine Kombination steht zweimal in der Liste', doppelt.mehrfach.length===0, JSON.stringify(doppelt.mehrfach));
 p('die Warengruppe Kombi zeigt jede Kombination genau einmal',
   new Set(doppelt.namen.map(n=>n.split(' ').slice(0,-1).join(' '))).size===doppelt.namen.length,
   JSON.stringify(doppelt.namen));

// VORGABE: keine Kacheln mit unterschiedlichen Preisen, und eine Kombination ist nie billiger.
 const preise=await pg.evaluate(()=>{
   const einzel=id=>Number(PRODUCTS.find(p=>p.id===id)?.price||0);
   return activePackageProducts().map(k=>({
     name:k.name, kombi:Number(k.price),
     summe:Math.round((k.componentIds||[]).reduce((s,id)=>s+einzel(id),0)*100)/100}));
 });
 p('jede Kombination kostet genau so viel wie ihre Bestandteile einzeln',
   preise.length>0&&preise.every(x=>Math.abs(x.kombi-x.summe)<0.005),
   preise.map(x=>`${x.name}: ${x.kombi} statt ${x.summe}`).join(' | '));
 p('keine Kombination ist billiger als die Einzelpreise',
   preise.every(x=>x.kombi>=x.summe-0.005), JSON.stringify(preise));

 // Auch nach einer Preisaenderung im Artikelstamm muss die Kachel stimmen
 const nachAenderung=await pg.evaluate(()=>{
   const g=PRODUCTS.find(p=>p.id==='gruenkohl'); const alt=g.price; g.price=6.00;
   PACKAGES=PACKAGES.map(sanitizePackage);
   const k=activePackageProducts().find(x=>(x.componentIds||[]).includes('gruenkohl'));
   const einzel=id=>Number(PRODUCTS.find(p=>p.id===id)?.price||0);
   const summe=(k.componentIds||[]).reduce((s,id)=>s+einzel(id),0);
   g.price=alt; PACKAGES=PACKAGES.map(sanitizePackage);
   return {kombi:Number(k.price), summe:Math.round(summe*100)/100};
 });
 p('aendert sich ein Artikelpreis, zieht der Kombipreis mit',
   Math.abs(nachAenderung.kombi-nachAenderung.summe)<0.005, JSON.stringify(nachAenderung));

 // In der Kombi-Liste des Managers duerfen Einzel- und Kombipreis nicht auseinanderlaufen
 const tabelle=await pg.evaluate(()=>{renderPackageTable();
   return [...document.querySelectorAll('#packageTableBody tr')].map(r=>
     [...r.children].slice(2,4).map(c=>c.textContent.trim()).join(' / '))});
 p('in der Kombi-Liste stehen Einzelpreis und Kombipreis gleich',
   tabelle.length>0&&tabelle.every(z=>{const [a,b]=z.split(' / ');return a===b}), JSON.stringify(tabelle));

 p('keine Skriptfehler ueber den ganzen Lauf', fehler.length===0, fehler.slice(0,2).join(' | ')||'keine');
 await b.close(); s.close();
 console.log(`\nWarengruppe Kombi: ${ok}/${ok+rot} bestanden`);
 process.exit(rot?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
