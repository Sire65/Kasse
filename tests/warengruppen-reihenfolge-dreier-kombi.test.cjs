/* Warengruppen-Reihenfolge, Dreier-Kombi und PC-Manager als Pflegestelle (07.10.2026)
   Betreiber: "Das Ganze muss auch in den PC-Manager, weil der maszgeblich die Kassen steuert. Die Reihenfolge
   der Warengruppen muss sein: Getraenke, Essen, Pfand, Favoriten, Kombinationen, Sonstiges. Stelle noch eine
   Kombi her aus Eierpunsch / Gruenkohl / Wurst, die Wurst besser in den Vordergrund." - "Dann mache noch Kombis mit
   Gluehwein ... und bau das so, dass wenn die Kasse was schickt, nicht automatisch der PC-Manager ueberschrieben
   wird oder umgekehrt."
   Kasse und Schulung:
   - Reihenfolge Getraenke | Speisen | Pfand | Favoriten | Kombi | Sonstiges - frisch, mit alter gespeicherter
     Reihenfolge (einmalig verworfen) und mit der neuen Reihenfolge vom Manager (kennt "Kombi" nicht)
   - 10.10.2026 (Betreiber: "jede Kombi nur einmal"): Dreier-Kombis vom 07.10. entfernt, vier Kombis bleiben;
     mit Wurst zeigt das Bild Grünkohl mit Wurst, ohne Wurst nur Grünkohl
   PC-Manager (und Schulungs-Manager):
   - Pfand-Rueckgaben zusaetzlich unter Getraenke, Glas-/Zangenpfand nur unter Sonstiges, Apfelpunsch mit Schuss
   - Feld "Zusaetzlich anzeigen in": Speichern behaelt die Einstellung, Haken weg entfernt sie
   - Standard-Reihenfolge der Warengruppen wie oben */
const pw=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const W=path.join(__dirname,'..');const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const s=http.createServer((q,r)=>{const p=path.join(W,decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kasse/,''));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(d)})});
let f=0;const pr=(n,b,z='')=>{console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'  ['+z+']':''}`);if(!b)f++};
const ENGINE=process.env.E||'chromium',PORT=Number(process.env.P||8971);
const SOLL='Getränke | Speisen | Pfand | Favoriten | Kombi | Sonstiges';
const ohneLaerm=js=>js.filter(x=>!/access control|kc-sync|Load failed|Failed to fetch|127\.0\.0\.1:4739/.test(x));
(async()=>{await new Promise(r=>s.listen(PORT,r));const b=await pw[ENGINE].launch();
try{
for(const seite of ['pos','schulung/pos'])for(const fall of ['frisch','alte Reihenfolge','Reihenfolge vom Manager']){
 const p=await b.newPage({viewport:{width:1280,height:800}});const js=[];p.on('pageerror',e=>js.push(e.message));
 await p.addInitScript(fall=>{if(sessionStorage.getItem('x'))return;sessionStorage.setItem('x','1');const m={registerId:'KASSE-01',pinLockEnabled:false};
  if(fall==='alte Reihenfolge'){m.categoryOrder=['Favoriten','WG05','WG01','WG02','WG03','WG04'];
   localStorage.setItem('kc_packages_v100',JSON.stringify([{id:'PKG-EI-GK-MW',name:'Eierlikörpunsch + Grünkohl + Mettwurst',componentIds:['eier','gruenkohl','mettwurst'],price:11.5,category:'Kombi',active:true},{id:'PKG-GR-GK-MW',name:'Glühwein rot + Grünkohl + Mettwurst',componentIds:['grot','gruenkohl','mettwurst'],price:10.5,category:'Kombi',active:true},{id:'EIGENE-TEST',name:'Test-Kombi',componentIds:['grot','mettwurst'],price:5,category:'Kombi',active:true}]))}
  if(fall==='Reihenfolge vom Manager'){m.categoryOrder=['WG01','WG02','WG03','Favoriten','WG04'];localStorage.setItem('kc_warengruppen_reihenfolge_v1','1')}
  localStorage.setItem('kc_master_v040',JSON.stringify(m))},fall);
 await p.goto(`http://127.0.0.1:${PORT}/Kasse/${seite}/index.html`);await p.waitForTimeout(3000);
 const n=`${ENGINE} ${seite} ${fall}`;
 const r=await p.evaluate(()=>[...document.querySelectorAll('#categories button')].map(b=>b.dataset.cat).join(' | '));
 pr(`${n}: Warengruppen ${SOLL}`,r===SOLL,r);
 if(fall==='frisch'){
  // 10.10.2026 (Betreiber): "jede Kombi nur einmal - Getraenk und Essen" - die Dreier-Kombis vom 07.10. sind weg.
  const k=await p.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.querySelector('#categories button[data-cat="Kombi"]').click();
   const pk=JSON.parse(localStorage.getItem('kc_packages_v100')||'[]');
   const kacheln=[...document.querySelectorAll('#productGrid .product-tile')];
   return {ids:pk.map(x=>x.id),anzahl:kacheln.length,
     bilder:kacheln.map(t=>(t.querySelector('.product-label strong')||{}).textContent+': '+(t.querySelector('.kombi-unten')||{getAttribute:()=>''}).getAttribute('src').split('/').pop()+(t.querySelector('.kombi-vorne')?' +rund':''))}});
  pr(`${n}: keine Dreier-Kombis mehr`,!k.ids.includes('PKG-EI-GK-MW')&&!k.ids.includes('PKG-GR-GK-MW'),k.ids.join(','));
  pr(`${n}: genau vier Kombis (je Getränk mit und ohne Wurst)`,k.anzahl===4,String(k.anzahl));
  pr(`${n}: mit Wurst = Bild Grünkohl mit Wurst, ohne Wurst = Grünkohl, kein runder Ausschnitt`,
   k.bilder.filter(x=>/Wurst/.test(x.split(':')[0])).every(x=>/gruenkohl_wurst_version_3/.test(x))&&k.bilder.filter(x=>!/Wurst/.test(x.split(':')[0])).every(x=>/gruenkohl_version_3/.test(x))&&!k.bilder.some(x=>/rund/.test(x)),k.bilder.join(' | '));
 }
 if(fall==='alte Reihenfolge'){
  // Tablet mit altem Stand: Dreier-Kombis gespeichert, dazu eine eigene Kombi -> nur die Dreier verschwinden.
  const k=await p.evaluate(()=>JSON.parse(localStorage.getItem('kc_packages_v100')||'[]').map(x=>x.id));
  pr(`${n}: alte Dreier-Kombis entfernt, eigene Kombi bleibt`,!k.includes('PKG-EI-GK-MW')&&!k.includes('PKG-GR-GK-MW')&&k.includes('EIGENE-TEST'),k.join(','));
 }
 pr(`${n}: keine JS-Fehler`,!ohneLaerm(js).length,js.join('|').slice(0,200));
 await p.close()}
// Abgleich vom Manager: alter Stand ohne Angabe -> Kasse setzt Vorgabe wieder; bewusste leere Liste bleibt.
for(const seite of ['pos','schulung/pos'])for(const fall of ['alter Manager-Stand','bewusst keine Zusatzgruppe']){
 const p=await b.newPage({viewport:{width:1280,height:800}});const js=[];p.on('pageerror',e=>js.push(e.message));
 await p.addInitScript(fall=>{if(sessionStorage.getItem('x'))return;sessionStorage.setItem('x','1');localStorage.setItem('kc_master_v040',JSON.stringify({registerId:'KASSE-01',pinLockEnabled:false}));
  localStorage.setItem('kc_pfand_plus_unter_sonstiges_v1','1');localStorage.setItem('kc_pfand_rueckgabe_unter_getraenke_v1','1');
  const leer=fall==='bewusst keine Zusatzgruppe'?{displayCategories:[]}:{};
  localStorage.setItem('kc_products_v050',JSON.stringify([{id:'grot',name:'Glühwein rot',price:3.5,category:'Getränke',sortOrder:2,image:'assets/gluehwein_version_3.png'},
   {id:'glasplus',name:'Glaspfand',price:2,category:'Pfand',image:'assets/pfand_aufschlag_version_3.png',...leer},{id:'glasminus',name:'Glasrückgabe',price:-2,category:'Pfand',image:'assets/pfandrueckgabe_version_3.png',...leer}]))},fall);
 await p.goto(`http://127.0.0.1:${PORT}/Kasse/${seite}/index.html`);await p.waitForTimeout(3000);
 const n=`${ENGINE} ${seite} ${fall}`;
 const r=await p.evaluate(()=>{const A=JSON.parse(localStorage.getItem('kc_products_v050'));const g=id=>A.find(a=>a.id===id)||{};return {plus:[g('glasplus').displayCategories,!!g('glasplus').hideInOwnCategory],minus:g('glasminus').displayCategories}});
 if(fall==='alter Manager-Stand')pr(`${n}: Vorgaben wieder gesetzt (Glaspfand unter Sonstiges, Rückgabe auch unter Getränke)`,JSON.stringify(r)==='{"plus":[["Sonstiges"],true],"minus":["Getränke"]}',JSON.stringify(r));
 else pr(`${n}: bewusste Einstellung aus dem Manager bleibt`,JSON.stringify(r)==='{"plus":[[],false],"minus":[]}',JSON.stringify(r));
 pr(`${n}: keine JS-Fehler`,!ohneLaerm(js).length,js.join('|').slice(0,200));
 await p.close()}
// Manager im selben Browser wie die Kasse: Neustart holt keine Kassenwerte zurueck.
for(const seite of ['pc-manager','schulung/pc-manager']){
 const ctx=await b.newContext();const p=await ctx.newPage();const js=[];p.on('pageerror',e=>js.push(e.message));
 await p.addInitScript(()=>{if(sessionStorage.getItem('x'))return;sessionStorage.setItem('x','1');
  localStorage.setItem('kcm_articles',JSON.stringify([{id:'grot',name:'Glühwein rot',category:'Getränke',price:3.9,image:'assets/gluehwein_version_3.png'}]));
  localStorage.setItem('kc_products_v050',JSON.stringify([{id:'grot',name:'Glühwein rot',category:'Getränke',price:3.5},{id:'nurkasse',name:'Nur in der Kasse',category:'Sonstiges',price:1}]))});
 await p.goto(`http://127.0.0.1:${PORT}/Kasse/${seite}/index.html`);await p.waitForTimeout(3000);
 const r=await p.evaluate(()=>{const A=JSON.parse(localStorage.getItem('kcm_articles'));return {grot:(A.find(a=>a.id==='grot')||{}).price,neu:!!A.find(a=>a.id==='nurkasse')}});
 pr(`${ENGINE} ${seite}: Managerpreis bleibt (3,90), Kasse ergänzt nur Fehlendes`,r.grot===3.9&&r.neu,JSON.stringify(r));
 pr(`${ENGINE} ${seite}: keine JS-Fehler`,!ohneLaerm(js).length,js.join('|').slice(0,200));
 await ctx.close()}
for(const seite of ['pc-manager','schulung/pc-manager'])for(const alt of [false,true]){
 const ctx=await b.newContext({viewport:{width:1400,height:900}});const p=await ctx.newPage();const js=[];p.on('pageerror',e=>js.push(e.message));
 await p.addInitScript(alt=>{if(sessionStorage.getItem('x'))return;sessionStorage.setItem('x','1');
   if(alt){localStorage.setItem('kcm_settings',JSON.stringify({clubName:'Test',categoryOrder:['Favoriten','WG01','WG02','WG03']}));
     localStorage.setItem('kcm_articles',JSON.stringify([{id:'apfel',name:'Apfelpunsch',category:'Getränke',price:2.5,image:'assets/apfelpunsch_version_3.png'},{id:'glasminus',name:'Glasrückgabe',category:'Pfand',price:-2,image:'assets/pfandrueckgabe_version_3.png'},{id:'zangeminus',name:'Feuerzange Rückgabe',category:'Pfand',price:-2},{id:'glaszangebundleminus',name:'Glas + Feuerzange Rückgabe',category:'Pfand',price:-4},{id:'glasplus',name:'Glaspfand',category:'Pfand',price:2}]))}},alt);
 await p.goto(`http://127.0.0.1:${PORT}/Kasse/${seite}/index.html`);await p.waitForTimeout(3500);
 const n=`${ENGINE} ${seite} ${alt?'Altbestand':'frisch'}`;
 const d=await p.evaluate(()=>{const A=JSON.parse(localStorage.getItem('kcm_articles'));const g=id=>A.find(a=>a.id===id)||{};const st=JSON.parse(localStorage.getItem('kcm_settings')||'{}');
   return {apfel:g('apfel').optionGroup,glas:[g('glasminus').displayCategories,g('glasminus').sortOrder,g('glasminus').category],zange:g('zangeminus').displayCategories,bundle:g('glaszangebundleminus').displayCategories,plus:[g('glasplus').displayCategories,g('glasplus').hideInOwnCategory],order:(st.categoryOrder||[]).map(k=>k==='Favoriten'?k:(groups.find(x=>x.id===k)||{}).name||k)}});
 pr(`${n}: Apfelpunsch mit Schuss Rum/Amaretto`,d.apfel==='shot');
 pr(`${n}: Pfand-Rückgaben auch unter Getränke, Gruppe bleibt Pfand`,JSON.stringify(d.glas)==='[["Getränke"],9100,"Pfand"]'&&JSON.stringify(d.zange)==='["Getränke"]'&&JSON.stringify(d.bundle)==='["Getränke"]',JSON.stringify(d.glas));
 if(alt)pr(`${n}: Glaspfand nur unter Sonstiges`,JSON.stringify(d.plus)==='[["Sonstiges"],true]',JSON.stringify(d.plus));
 pr(`${n}: Reihenfolge Getränke, Speisen, Pfand, Favoriten …`,d.order.slice(0,4).join()==='Getränke,Speisen,Pfand,Favoriten',d.order.join(' | '));
 const sp=await p.evaluate(()=>{const i=articles.findIndex(a=>a.id==='glasminus');loadArticle(i);const box=[...document.querySelectorAll('#aAlsoIn [data-also-in]')];const vorher=box.filter(c=>c.checked).map(c=>c.dataset.alsoIn);const eigen=box.find(c=>c.dataset.alsoIn==='Pfand');
   document.querySelector('#articleToolbar button[data-cmd="save"]').click();const a=JSON.parse(localStorage.getItem('kcm_articles')).find(x=>x.id==='glasminus');return {vorher,eigenGesperrt:eigen?eigen.disabled:'fehlt',nachher:a.displayCategories,sort:a.sortOrder}});
 pr(`${n}: Artikel speichern behält „auch unter Getränke“`,JSON.stringify(sp.vorher)==='["Getränke"]'&&JSON.stringify(sp.nachher)==='["Getränke"]'&&sp.sort===9100&&sp.eigenGesperrt===true,JSON.stringify(sp));
 const ab=await p.evaluate(()=>{const i=articles.findIndex(a=>a.id==='glasminus');loadArticle(i);document.querySelector('#aAlsoIn [data-also-in="Getränke"]').checked=false;document.querySelector('#articleToolbar button[data-cmd="save"]').click();return JSON.parse(localStorage.getItem('kcm_articles')).find(x=>x.id==='glasminus').displayCategories});
 pr(`${n}: Haken weg -> nicht mehr unter Getränke`,Array.isArray(ab)&&ab.length===0,JSON.stringify(ab));
 pr(`${n}: keine JS-Fehler`,!ohneLaerm(js).length,js.join('|').slice(0,200));
 await ctx.close()}
}catch(e){console.log('ABBRUCH:',e&&e.stack||e);f++}
await b.close();s.close();console.log(f?f+' FEHLER':'Alles OK');process.exit(f?1:0)})();
