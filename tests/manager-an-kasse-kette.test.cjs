/* Ganze Kette PC-Manager -> Kasse (07.10.2026)
   Betreiber: "Bald muss das ganze System laufen und zusammenspielen auf dem Weihnachtsmarkt."
   Der Manager-Dienst und der Kassen-Dienst speichern die Stammdaten unveraendert als JSON und reichen sie weiter
   (manager-companion master_data.articles_json / device-companion master_data_cache). Geprueft wird deshalb
   mit dem ECHTEN Paket: Im PC-Manager "Stammdaten senden" -> das gesendete Paket wird abgefangen -> die Kasse
   bekommt es beim Start als Abgleich (/kc-sync-master-data) -> was zeigt die Kasse?
   Erwartet: Getraenke enden mit den drei Pfand-Rueckgaben, Glas-/Zangenpfand nur unter Sonstiges, Apfelpunsch mit
   Schuss-Auswahl, Reihenfolge Getraenke | Speisen | Pfand | Favoriten | Kombi | Sonstiges, alle 6 Kombis bleiben
   (der Manager sendet keine Kombis), ein im Manager geaenderter Preis kommt an. */
const pw=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const W=path.join(__dirname,'..');const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const s=http.createServer((q,r)=>{const p=path.join(W,decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kasse/,''));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(d)})});
let f=0;const pr=(n,b,z='')=>{console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'  ['+z+']':''}`);if(!b)f++};
const ENGINE=process.env.E||'chromium',PORT=Number(process.env.P||8972);
const ohneLaerm=js=>js.filter(x=>!/access control|kc-sync|Load failed|Failed to fetch|127\.0\.0\.1:4739|ERR_|net::/.test(x));
(async()=>{await new Promise(r=>s.listen(PORT,r));const b=await pw[ENGINE].launch();
try{
for(const [mgr,kasse] of [['pc-manager','pos'],['schulung/pc-manager','schulung/pos']]){
 // 1. PC-Manager: Preis aendern, Stammdaten senden, Paket abfangen
 const mctx=await b.newContext({viewport:{width:1400,height:900}});const m=await mctx.newPage();const mjs=[];m.on('pageerror',e=>mjs.push(e.message));
 let paket=null;
 await mctx.route(u=>u.pathname==='/master-data/push',async route=>{paket=JSON.parse(route.request().postData()||'null');await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({revision:7})})});
 await mctx.route('**/master-data/pull*',route=>route.fulfill({status:404,body:''}));
 await m.goto(`http://127.0.0.1:${PORT}/Kasse/${mgr}/index.html`);await m.waitForTimeout(3500);
 await m.evaluate(()=>{const i=articles.findIndex(a=>a.id==='grot');loadArticle(i);el('aPrice').value='3.70';document.querySelector('#articleToolbar button[data-cmd="save"]').click()});
 await m.evaluate(()=>{managerUnlocked=true;document.getElementById('masterDataPushBtn').click()});
 for(let i=0;i<40&&!paket;i++)await m.waitForTimeout(150);
 const n0=`${ENGINE} ${mgr}`;
 pr(`${n0}: „Stammdaten senden“ liefert ein Paket`,!!paket&&Array.isArray(paket.articles)&&paket.articles.length>10,paket?paket.articles.length+' Artikel':'kein Paket');
 pr(`${n0}: keine JS-Fehler`,!ohneLaerm(mjs).length,mjs.join('|').slice(0,200));
 await mctx.close();
 if(!paket)continue;
 // 2. Kasse startet und gleicht mit genau diesem Paket ab
 const kctx=await b.newContext({viewport:{width:1280,height:800}});const p=await kctx.newPage();const js=[];p.on('pageerror',e=>js.push(e.message+' '+(e.stack||'').split('\n')[1]));const konsole=[];p.on('console',c=>{if(c.type()==='error')konsole.push(c.text())});
 await kctx.route(u=>/\/kc-sync-master-data(\?|$)/.test(u.pathname+(u.search?'?':'')),route=>route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({vorhanden:true,...paket})}));
 await p.addInitScript(()=>{if(!localStorage.getItem('kc_master_v040'))localStorage.setItem('kc_master_v040',JSON.stringify({registerId:'KASSE-01',pinLockEnabled:false}))});
 await p.goto(`http://127.0.0.1:${PORT}/Kasse/${kasse}/index.html`);await p.waitForTimeout(3500);
 const n=`${ENGINE} ${mgr} -> ${kasse}`;if(process.env.DEBUG)console.log('JS:',js.join('\n'),'\nKonsole:',konsole.join('\n').slice(0,3000));
 const liste=async g=>{await p.evaluate(g=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());const b=document.querySelector(`#categories button[data-cat="${g}"]`);b&&b.click()},g);await p.waitForTimeout(300);return p.evaluate(()=>[...document.querySelectorAll('#productGrid .product-tile-wrap')].map(w=>w.querySelector('.product-label strong').textContent+(w.querySelector('.product-variant-button')?' [+]':'')))};
 const reihe=await p.evaluate(()=>[...document.querySelectorAll('#categories button')].map(b=>b.dataset.cat).join(' | '));
 pr(`${n}: Warengruppen in der gewünschten Reihenfolge (Happy Hour aus dem Manager dahinter)`,reihe.startsWith('Getränke | Speisen | Pfand | Favoriten | Kombi | Sonstiges'),reihe);
 const g=await liste('Getränke'),pf=await liste('Pfand'),so=await liste('Sonstiges'),ko=await liste('Kombi');
 pr(`${n}: Getränke enden mit den drei Pfand-Rückgaben`,g.slice(-3).join('|')==='Glasrückgabe|Feuerzange Rückgabe|Glas + Feuerzange Rückgabe',g.join(' | '));
 pr(`${n}: Apfelpunsch mit „+“ (Schuss)`,g.includes('Apfelpunsch [+]'));
 pr(`${n}: Pfand zeigt nur die drei Rückgaben`,pf.join('|')==='Glasrückgabe|Feuerzange Rückgabe|Glas + Feuerzange Rückgabe',pf.join(' | '));
 pr(`${n}: Glas-/Zangenpfand unter Sonstiges`,so.some(x=>/^Glaspfand/.test(x))&&so.some(x=>/^Feuerzangenpfand/.test(x)),so.join(' | '));
 pr(`${n}: alle 6 Kombis bleiben (Manager sendet keine)`,ko.length===6&&ko.some(x=>/Glühwein rot \+ Grünkohl \+ Mettwurst/.test(x))&&ko.some(x=>/Eierlikörpunsch \+ Grünkohl \+ Mettwurst/.test(x)),ko.join(' | '));
 const preis=await p.evaluate(()=>(PRODUCTS.find(x=>x.id==='grot')||{}).price);
 pr(`${n}: im Manager geänderter Preis kommt an (3,70)`,preis===3.7,String(preis));
 pr(`${n}: keine JS-Fehler`,!ohneLaerm(js).length,js.join('|').slice(0,200));
 await kctx.close()}
 // 3. Alter Manager-Stand mit falschem Preis inkl. Pfand und bewusst "keine" Schuss-Auswahl
 for(const kasse of ['pos','schulung/pos']){
  const kctx=await b.newContext();const p=await kctx.newPage();const js=[];p.on('pageerror',e=>js.push(e.message));
  const daten={vorhanden:true,groups:[{id:'WG01',name:'Getränke',sortOrder:10,active:true},{id:'WG02',name:'Speisen',sortOrder:20,active:true}],
   articles:[{id:'grot',name:'Glühwein rot',category:'Getränke',price:5.5,image:'assets/gluehwein_version_3.png',optionGroup:'shot'},{id:'apfel',name:'Apfelpunsch',category:'Getränke',price:2.9,image:'assets/apfelpunsch_version_3.png',optionGroup:''},
    {id:'hering',name:'Kartoffel mit Hering',category:'Speisen',price:4.9,image:'assets/hering_kartoffeln_auth.webp'}],packages:[],accounts:[],settings:{}};
  await kctx.route(u=>/\/kc-sync-master-data(\?|$)/.test(u.pathname+(u.search?'?':'')),route=>route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(daten)}));
  await p.addInitScript(()=>{if(!localStorage.getItem('kc_master_v040'))localStorage.setItem('kc_master_v040',JSON.stringify({registerId:'KASSE-01',pinLockEnabled:false}));localStorage.setItem('kc_preis_hering_creme_v1','1')});
  await p.goto(`http://127.0.0.1:${PORT}/Kasse/${kasse}/index.html`);await p.waitForTimeout(3000);
  const r=await p.evaluate(()=>{const g=id=>PRODUCTS.find(x=>x.id===id)||{};return {grot:g('grot').price,apfel:[g('apfel').price,g('apfel').optionGroup],hering:g('hering').price}});
  const n=`${ENGINE} alter Manager-Stand -> ${kasse}`;
  pr(`${n}: falscher Preis mit Pfand 5,50 wird zu 3,50`,r.grot===3.5,JSON.stringify(r));
  pr(`${n}: Managerpreise Apfelpunsch 2,90 und Hering 4,90 bleiben`,r.apfel[0]===2.9&&r.hering===4.9,JSON.stringify(r));
  pr(`${n}: „keine Schuss-Auswahl“ aus dem Manager bleibt`,r.apfel[1]==='',JSON.stringify(r.apfel));
  pr(`${n}: keine JS-Fehler`,!ohneLaerm(js).length,js.join('|').slice(0,200));
  await kctx.close()}
}catch(e){console.log('ABBRUCH:',e&&e.stack||e);f++}
await b.close();s.close();console.log(f?f+' FEHLER':'Alles OK');process.exit(f?1:0)})();
