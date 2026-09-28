/* Pruefkette nach Neustart (Befund 28.09.2026).
   IndexedDB lieferte die Bons nach einem Neustart sortiert nach der zufaelligen transactionId.
   Folge: inspectLedger meldete "Pruefkette ist unterbrochen", und der naechste Verkauf haengte
   sich an einen zufaelligen Vorgaenger. Geprueft wird echt im Browser, mehrfach (der Fehler war
   zufallsabhaengig), in Live und Schulung - und die Sortierung selbst mit Beispieldaten. */
try{require.resolve('playwright')}catch(e){console.log('  ueberspringen: Playwright nicht installiert');process.exit(0)}
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path'),vm=require('vm');
const WURZEL=path.join(__dirname,'..');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const s=http.createServer((q,r)=>{const p=path.join(WURZEL,decodeURIComponent(q.url.split('?')[0]));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end('x')}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(d)})});
let fehler=0;const pruefe=(n,b,z='')=>{console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'  ['+z+']':''}`);if(!b)fehler++};

// --- 1. Sortierung mit Beispieldaten (ohne Browser) ---------------------------------------
{
  const fenster={};vm.runInNewContext(fs.readFileSync(path.join(WURZEL,'pos/kc-transaction-store.js'),'utf8'),{window:fenster,crypto:{},TextEncoder,TextDecoder,localStorage:{getItem:()=>null}});
  const sortiere=fenster.KCTransactionStore.inBuchungsreihenfolge;
  const z=i=>`2026-09-28T10:00:0${i}.000Z`;
  const kette=[{recordHash:'a',previousHash:null,time:z(1),bon:1},{recordHash:'b',previousHash:'a',time:z(2),bon:2},{recordHash:'c',previousHash:'b',time:z(3),bon:3},{recordHash:'d',previousHash:'c',time:z(4),bon:4}];
  const gemischt=[kette[2],kette[0],kette[3],kette[1]];
  pruefe('Intakte Kette wird in Kettenreihenfolge gebracht',sortiere(gemischt).map(r=>r.bon).join()==='1,2,3,4');
  // Uhr wurde zwischendurch zurueckgestellt: Kette schlaegt Zeit
  const uhr=[{...kette[0]},{...kette[1],time:z(0)},{...kette[2]}];
  pruefe('Kette hat Vorrang vor der Uhrzeit (Uhr zurückgestellt)',sortiere([uhr[2],uhr[1],uhr[0]]).map(r=>r.bon).join()==='1,2,3');
  const alt=[{bon:'A2',time:z(2)},{bon:'A1',time:z(1)}];
  pruefe('Alt-Datensätze ohne Prüfsumme vorne, nach Zeit',sortiere([kette[1],alt[0],kette[0],alt[1]]).map(r=>r.bon).join()==='A1,A2,1,2');
  const gabel=[...kette,{recordHash:'e',previousHash:'a',time:z(5),bon:5}];
  pruefe('Beschädigte Kette (Abzweigung): nach Zeit, nichts geht verloren',sortiere([gabel[4],gabel[2],gabel[0],gabel[3],gabel[1]]).map(r=>r.bon).join()==='1,2,3,4,5');
  pruefe('Leere/kurze Listen unverändert',sortiere([]).length===0&&sortiere([kette[0]]).length===1);
}

// --- 2. Echt im Browser ---------------------------------------------------------------------
async function verkaufen(p,n){for(let i=0;i<n;i++){await p.evaluate(()=>{addConfiguredProduct(productsForSale().find(x=>x.id==='grot'),null)});await p.evaluate(()=>completeSale('cash',{silent:true}))}}
const kettePruefen=p=>p.evaluate(async()=>{const r=readTransactions();return {n:r.length,erg:await inspectLedger(r,'Umsatz'),bons:r.map(x=>x.bon).join(',')}});
(async()=>{await new Promise(r=>s.listen(8881,r));const b=await chromium.launch();
try{
for(const PFAD of ['/pos/index.html','/schulung/pos/index.html']){
  console.log('== '+PFAD);
  for(let lauf=1;lauf<=3;lauf++){
    const ctx=await b.newContext({serviceWorkers:'block',viewport:{width:1280,height:800}});const p=await ctx.newPage();
    p.on('pageerror',e=>console.log('PAGEERROR:',e.message));
    await p.addInitScript(()=>{if(!sessionStorage.getItem('i')){sessionStorage.setItem('i','1');localStorage.setItem('kc_master_v040',JSON.stringify({registerId:'KASSE-01',pinLockEnabled:false,trainingMode:false}));localStorage.setItem('kc_offers_v100','[]')}});
    await p.goto('http://127.0.0.1:8881'+PFAD);await p.waitForFunction(()=>window.__kcTxHydrated,null,{timeout:15000});await p.evaluate(()=>window.__kcTxHydrated);
    await verkaufen(p,5);
    const vor=await kettePruefen(p);
    await p.waitForTimeout(800); // IndexedDB-Schreibvorgang im Hintergrund
    await p.reload();await p.waitForFunction(()=>window.__kcTxHydrated,null,{timeout:15000});await p.evaluate(()=>window.__kcTxHydrated);
    const nach=await kettePruefen(p);
    pruefe(`Lauf ${lauf}: nach Neustart gleiche Reihenfolge, Prüfkette ok`,nach.n===5&&nach.bons===vor.bons&&nach.erg.status==='pass',`${nach.bons} · ${nach.erg.message}`);
    await verkaufen(p,2);
    const weiter=await p.evaluate(async()=>{const r=readTransactions();return {erg:await inspectLedger(r,'Umsatz'),anVorgaenger:r[5].previousHash===r[4].recordHash}});
    pruefe(`Lauf ${lauf}: nächster Verkauf hängt am echten letzten Bon, Kette weiter ok`,weiter.anVorgaenger&&weiter.erg.status==='pass',weiter.erg.message);
    await p.waitForTimeout(800);await p.reload();await p.waitForFunction(()=>window.__kcTxHydrated,null,{timeout:15000});await p.evaluate(()=>window.__kcTxHydrated);
    const zwei=await kettePruefen(p);
    pruefe(`Lauf ${lauf}: auch nach zweitem Neustart ok (7 Bons)`,zwei.n===7&&zwei.erg.status==='pass',`${zwei.bons} · ${zwei.erg.message}`);
    await ctx.close();
  }
}
}catch(err){console.log('ABBRUCH:',err&&err.stack||err);fehler++}
await b.close();s.close();console.log(fehler?`\n${fehler} FEHLER`:'\nAlles OK');process.exit(fehler?1:0)})();
