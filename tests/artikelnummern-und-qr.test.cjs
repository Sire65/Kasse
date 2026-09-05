/* Artikelnummern, QR-Etikett und die drei Wege zum Artikel.
   Geprueft wird ueber die Funktionen des Programms, nicht ueber einen Nachbau. */
const {chromium}=require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const WURZEL=path.resolve(__dirname,'..');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.txt':'text/plain','.webmanifest':'application/manifest+json','.md':'text/plain'};
let ok=0,rot=0; const p=(n,b,z='')=>{b?ok++:rot++;console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'   ['+z+']':''}`)};
const frei=async pg=>pg.evaluate(()=>{["fullscreenGate","kcStartupSummary","kcPinLockOverlay"].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display="none"});document.querySelectorAll("[data-kc-sperrend]").forEach(e=>e.style.display="none")});

(async()=>{
 const s=http.createServer((q,r)=>{const f=path.join(WURZEL,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end('x')}r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(d)})});
 await new Promise(r=>s.listen(8751,r));
 const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1700,height:1100}});
 const fehler=[]; pg.on('pageerror',e=>fehler.push(e.message)); pg.on('dialog',d=>d.accept().catch(()=>{}));

 // ---------------------------------------------------------------- Kasse
 await pg.goto('http://127.0.0.1:8751/pos/index.html'); await pg.waitForTimeout(6000); await frei(pg);
 p('Kasse startet ohne Skriptfehler', fehler.length===0, fehler[0]||'keine');

 const tab=await pg.evaluate(()=>({
   geladen:!!window.KCArtikelnummern,
   anzahl:Object.keys(window.KCArtikelnummern?.NUMMERN||{}).length,
   doppelt:(()=>{const v=Object.values(window.KCArtikelnummern?.NUMMERN||{});return v.filter((x,i)=>v.indexOf(x)!==i)})(),
   nurZiffern:Object.values(window.KCArtikelnummern?.NUMMERN||{}).every(x=>/^[0-9]{5}$/.test(x))
 }));
 p('die gemeinsame Nummerntabelle ist geladen', tab.geladen);
 p('jede Nummer ist genau einmal vergeben', tab.doppelt.length===0, tab.doppelt.join(',')||'keine Doppelung');
 p('jede Nummer besteht aus fuenf Ziffern', tab.nurZiffern===true, `${tab.anzahl} Nummern`);

 const stamm=await pg.evaluate(()=>{
   const liste=productsForSale();
   const ohne=liste.filter(x=>!String(x.barcode||"").trim()).map(x=>x.id);
   const gruppePasst=liste.filter(x=>String(x.barcode||"").trim()).every(x=>{
     const wg=window.KCArtikelnummern.warengruppeZurNummer(x.barcode);
     return wg && (wg.name===x.category || x.category==="Favoriten");
   });
   return {anzahl:liste.length, ohne, gruppePasst,
     grot:liste.find(x=>x.id==="grot")?.barcode, glasminus:liste.find(x=>x.id==="glasminus")?.barcode};
 });
 p('jeder verkaufbare Artikel hat eine Nummer', stamm.ohne.length===0, stamm.ohne.join(', ')||`${stamm.anzahl} Artikel`);
 p('die ersten zwei Ziffern sind die Warengruppe', stamm.gruppePasst===true);
 p('Gluehwein rot traegt 01001', stamm.grot==='01001', stamm.grot);
 p('Glasrueckgabe traegt eine Rueckgabenummer 031xx', /^031\d\d$/.test(stamm.glasminus||''), stamm.glasminus);

 // Weg 1: Scanner (Tastatur-Emulation, Code + Enter)
 await pg.evaluate(()=>{state.cart=[];renderCart&&renderCart()});
 await pg.evaluate(()=>document.activeElement.blur());
 for(const z of '02003') await pg.keyboard.press(`Digit${z}`);
 await pg.keyboard.press('Enter'); await pg.waitForTimeout(800);
 const gescannt=await pg.evaluate(()=>({
   gewaehlt:state.lastSelectedProduct?.id||state.pendingProduct?.id||null,
   imKorb:(state.cart||[]).map(x=>x.name)}));
 p('gescannte Nummer 02003 fuehrt zu Gruenkohl',
   gescannt.gewaehlt==='gruenkohl'||gescannt.imKorb.some(n=>/Grünkohl/.test(n)),
   JSON.stringify(gescannt));

 // Weg 2: Suchfeld (dort landet der Scanner, wenn der Cursor im Feld steht)
 const suche=await pg.evaluate(()=>{
   const f=document.getElementById("productSearchInput"); if(!f)return{fehlt:true};
   f.value="01001"; f.dispatchEvent(new Event("input",{bubbles:true}));
   const treffer=allProductsForCategory().map(x=>x.id);
   f.value="02006"; f.dispatchEvent(new Event("input",{bubbles:true}));
   const treffer2=allProductsForCategory().map(x=>x.id);
   f.value=""; f.dispatchEvent(new Event("input",{bubbles:true}));
   return {treffer,treffer2};
 });
 p('Suchfeld findet ueber die Artikelnummer 01001', suche.treffer?.includes('grot'), JSON.stringify(suche.treffer));
 p('Suchfeld findet ueber die Artikelnummer 02006', suche.treffer2?.includes('hering'), JSON.stringify(suche.treffer2));
 p('Suchfeld liefert genau einen Treffer je Nummer', suche.treffer?.length===1&&suche.treffer2?.length===1,
   `${suche.treffer?.length} / ${suche.treffer2?.length}`);

 // Weg 3: Zahlenblock
 const block=await pg.evaluate(()=>{
   const treffer={};
   for(const nr of ['01001','02003','03001','04001']){
     const q=String(nr).replace(/[,.]/g,"");
     const prod=window.KCArtikelnummern.findeArtikel(productsForSale(),q);
     treffer[nr]=prod?prod.id:null;
   }
   return treffer;
 });
 p('Zahlenblock: 01001 = Gluehwein rot', block['01001']==='grot', block['01001']);
 p('Zahlenblock: 02003 = Gruenkohl', block['02003']==='gruenkohl', block['02003']);
 p('Zahlenblock: 03001 = Glaspfand', block['03001']==='glasplus', block['03001']);
 p('Zahlenblock: 04001 = Wertmarke', block['04001']==='wertmarke', block['04001']);

 const unbekannt=await pg.evaluate(()=>window.KCArtikelnummern.findeArtikel(productsForSale(),'07777'));
 p('eine unbekannte Nummer liefert keinen Artikel', unbekannt===null);

 const vorsatz=await pg.evaluate(()=>window.KCArtikelnummern.findeArtikel(productsForSale(),'KCA:01002')?.id);
 p('ein Code mit Vorsatz KCA: wird ebenfalls erkannt', vorsatz==='gweiss', String(vorsatz));

 p('Kasse: keine Skriptfehler ueber den ganzen Lauf', fehler.length===0, fehler.slice(0,2).join(' | ')||'keine');

 // ---------------------------------------------------------------- PC-Manager
 const fehlerM=[]; const pm=await b.newPage({viewport:{width:1700,height:1100}});
 pm.on('pageerror',e=>fehlerM.push(e.message)); pm.on('dialog',d=>d.accept().catch(()=>{}));
 await pm.goto('http://127.0.0.1:8751/pc-manager/index.html'); await pm.waitForTimeout(5000);
 p('Manager startet ohne Skriptfehler', fehlerM.length===0, fehlerM[0]||'keine');

 // BEKANNTER ALTBESTAND: "mett" (Mettwurst 3,50) stammt aus den alten Vorgabedaten des
 // Managers. Die Kasse fuehrt Mettwurst unter "mettwurst" zu 1,50 als Beilage. Beide stehen
 // heute in der Preisliste des Managers - mit zwei verschiedenen Preisen unter demselben
 // Namen. Der Artikel wird hier bewusst NICHT geloescht (Stammdaten aendert nur der Verein),
 // aber er bekommt auch keine Artikelnummer, damit ihn niemand versehentlich bedruckt.
 // Der Test laesst genau diesen einen bekannten Fall zu und wird rot, sobald ein zweiter
 // Artikel ohne Nummer dazukommt.
 const ALTBESTAND=['mett'];
 const mStamm=await pm.evaluate(()=>{
   const ohne=articles.filter(a=>a.active!==false&&!String(a.barcode||"").trim()).map(a=>a.id);
   const namen={};articles.forEach(a=>{(namen[a.name]=namen[a.name]||[]).push(a.id)});
   const doppelt=Object.entries(namen).filter(([,ids])=>ids.length>1).map(([n,ids])=>`${n}: ${ids.join(' + ')}`);
   const map={}; articles.forEach(a=>{if(a.barcode)map[a.id]=a.barcode});
   return {anzahl:articles.length, ohne, doppelt, map};
 });
 const unerwartet=mStamm.ohne.filter(id=>!ALTBESTAND.includes(id));
 p('Manager: aktive Artikel tragen eine Nummer (ausser bekanntem Altbestand)',
   unerwartet.length===0, unerwartet.join(', ')||`${mStamm.anzahl} Artikel, Altbestand: ${mStamm.ohne.join(', ')||'keiner'}`);
 p('Manager: kein NEUER doppelter Artikelname',
   mStamm.doppelt.length<=1&&(mStamm.doppelt[0]||'').startsWith('Mettwurst'),
   mStamm.doppelt.join(' | ')||'keine Doppelung');
 p('Manager und Kasse geben Gluehwein rot dieselbe Nummer',
   mStamm.map.grot===stamm.grot, `Manager ${mStamm.map.grot} / Kasse ${stamm.grot}`);

 // Etikett mit QR erzeugen
 const etikett=await pm.evaluate(()=>{
   const sel=document.getElementById("labelArticle"); if(!sel)return{fehlt:true};
   const i=articles.findIndex(a=>a.id==="grot"); if(i<0)return{keinArtikel:true};
   sel.value=String(i); document.getElementById("labelCodeType").value="qr";
   document.getElementById("labelId").checked=true;
   renderLabelPreview();
   const v=document.getElementById("labelPreview");
   const img=v.querySelector("img.label-code");
   return {text:v.innerText, qr:!!img&&String(img.src).startsWith("data:image"), qrLaenge:img?String(img.src).length:0};
 });
 p('Etikett enthaelt einen echten QR-Code', etikett.qr===true, `${etikett.qrLaenge} Zeichen Bilddaten`);
 p('Etikett zeigt die Artikelnummer, nicht die technische ID',
   /01001/.test(etikett.text||'')&&!/Art\.-Nr\. grot/.test(etikett.text||''), (etikett.text||'').replace(/\n/g,' | ').slice(0,120));

 // Pfand und Allergene auf dem Etikett - beides stand vorher unter Umstaenden gar nicht drauf.
 const pflicht=await pm.evaluate(()=>{
   const i=articles.findIndex(a=>a.id==="feuer"); if(i<0)return{fehlt:true};
   // Pfand so setzen, wie die Kasse es fuehrt (depositComponents statt depositGroupIds)
   articles[i].depositComponents=[{id:"glass",name:"Glaspfand",price:2},{id:"tong",name:"Feuerzangenpfand",price:2}];
   articles[i].info=Object.assign({},articles[i].info,{legacyAllergens:"Enthält Sulfite"});
   document.getElementById("labelArticle").value=String(i);
   ["labelAllergens","labelDeposit"].forEach(x=>document.getElementById(x).checked=true);
   renderLabelPreview();
   return {text:document.getElementById("labelPreview").innerText};
 });
 p('Etikett druckt das Pfand aus den Kassen-Pfandbestandteilen',
   /Glaspfand 2,00/.test(pflicht.text||'')&&/Feuerzangenpfand 2,00/.test(pflicht.text||''),
   (pflicht.text||'').replace(/\n/g,' | ').slice(0,140));
 p('Etikett druckt Allergene auch als Freitext',
   /Allergene:.*Sulfite/.test(pflicht.text||''), (pflicht.text||'').replace(/\n/g,' | ').slice(0,140));

 p('Manager: keine Skriptfehler ueber den ganzen Lauf', fehlerM.length===0, fehlerM.slice(0,2).join(' | ')||'keine');

 await b.close(); s.close();
 console.log(`\nArtikelnummern und QR: ${ok}/${ok+rot} bestanden`);
 process.exit(rot?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
