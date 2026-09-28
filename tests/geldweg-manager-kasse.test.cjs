/* Geldweg PC-Manager -> Manager-Dienst -> Kasse, echt (Befund 28.09.2026).
   Der PC-Manager (normaler Browser) schickte Geld-Uebergaben an den HTTPS-Kanal 8543 - dort kam
   jede Anfrage mit 400 zurueck (apiVersion fehlte), "An Kasse freigeben" traf auf 47392 eine
   fehlende Route (404). Geprueft wird der ganze Weg mit dem echten Dienst und der echten
   Manager-Seite im Browser: ablegen (normal und mit Bestaetigung), dann holt eine echt
   gekoppelte Kasse beide ueber ihren gesicherten Kanal ab. */
const path=require('path'),fs=require('fs'),os=require('os'),http=require('http'),https=require('https');
const WURZEL=path.join(__dirname,'..'),BACKEND=path.join(WURZEL,'markt-kasse-suite','backend-source');
try{require.resolve('playwright')}catch(e){console.log('  ueberspringen: Playwright nicht installiert');process.exit(0)}
for(const m of ['ws','selfsigned','bonjour-service']){try{require.resolve(m,{paths:[BACKEND]})}catch(e){console.log(`  ueberspringen: ${m} fehlt - einmal "npm install" in markt-kasse-suite/backend-source`);process.exit(0)}}
const {chromium}=require('playwright');const {ManagerCompanion}=require(path.join(BACKEND,'manager-companion'));
let fehler=0;const pruefe=(n,b,z='')=>{console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'  ['+z+']':''}`);if(!b)fehler++};
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const web=http.createServer((q,r)=>{const p=path.join(WURZEL,decodeURIComponent(q.url.split('?')[0]));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end('x')}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(d)})});
function kasse(port,methode,pfad,body,credential){return new Promise(r=>{const q=https.request({hostname:'127.0.0.1',port,path:pfad,method:methode,rejectUnauthorized:false,headers:{'Content-Type':'application/json',...(credential?{'x-kc-credential':credential}:{})}},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{let j=null;try{j=JSON.parse(d)}catch(e){}r({status:res.statusCode,body:j})})});q.on('error',e=>r({status:0,fehler:e.message}));q.end(body?JSON.stringify(body):undefined)})}
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kc-geldweg-'));
  const mgr=new ManagerCompanion({dbPath:path.join(dir,'manager.sqlite')});
  const HTTPS_PORT=8561;await mgr.start(HTTPS_PORT);
  await new Promise(r=>web.listen(8897,r));
  const b=await chromium.launch();
  try{
    const p=await (await b.newContext({serviceWorkers:'block'})).newPage();
    p.on('pageerror',e=>{});
    await p.goto('http://127.0.0.1:8897/pc-manager/index.html');
    await p.waitForFunction(()=>typeof queueCashTransferPayload==='function',null,{timeout:20000});
    // 1. Normale Geldbefuellung und 2. eine mit Bestaetigung - ueber die echte Manager-Funktion
    const normal=await p.evaluate(()=>queueCashTransferPayload({transferId:'MB-NORMAL-1',registerId:'kasse-01',amount:150,confirmationRequested:false}).then(z=>({ok:true,z}),e=>({ok:false,fehler:String(e.message||e)})));
    pruefe('Manager legt normale Geld-Übergabe ab (vorher: 400)',normal.ok,JSON.stringify(normal));
    const mitBest=await p.evaluate(()=>queueCashTransferPayload({transferId:'MB-BEST-1',registerId:'kasse-01',amount:80,confirmationRequested:true}).then(z=>({ok:true,z}),e=>({ok:false,fehler:String(e.message||e)})));
    pruefe('Manager legt Übergabe mit Bestätigung ab (vorher: 400)',mitBest.ok,JSON.stringify(mitBest));
    // 3. Genau der Aufruf von "An Kasse freigeben" (kc-finance-uebergaben.js)
    const frei=await p.evaluate(()=>fetch('http://127.0.0.1:47392/api/v1/finance-transfer/queue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transferId:'FB-1',registerLabel:'kasse-01',payload:{amount:40}})}).then(r=>r.status,e=>'fehler '+e.message));
    pruefe('"An Kasse freigeben" wird angenommen (vorher: 404)',frei===200,String(frei));
    // 4. Fremde Geraete duerfen nicht ablegen: die Route bleibt nur lokal
    const quellen=Object.values(os.networkInterfaces()).flat().filter(x=>x&&x.family==='IPv4'&&!x.internal).map(x=>x.address);
    if(quellen.length){
      const fremd=await new Promise(r=>{const q=http.request({hostname:quellen[0],port:47392,path:'/api/v1/cash-transfer/queue',method:'POST',localAddress:quellen[0],headers:{'Content-Type':'application/json'}},res=>{res.resume();r(res.statusCode)});q.on('error',e=>r('nicht erreichbar'));q.end(JSON.stringify({transferId:'X',registerLabel:'kasse-01',payload:{}}))});
      pruefe('Von einer Netzwerkadresse aus abgelehnt (nur lokal)',fremd===403||fremd==='nicht erreichbar',String(fremd));
    }
    // 5. Eine echt gekoppelte Kasse holt beide Wege ab
    const token=mgr.issuePairingToken();
    const paar=await kasse(HTTPS_PORT,'POST','/api/v1/pair',{apiVersion:'1.0',pairingToken:token,deviceInstanceId:'geraet-test-1',registerLabel:'kasse-01'});
    pruefe('Kasse koppelt sich',paar.status===200&&!!paar.body?.credentialId,String(paar.status));
    const cred=paar.body?.credentialId;
    const bar=await kasse(HTTPS_PORT,'GET','/api/v1/cash-transfer/pending',null,cred);
    pruefe('Kasse sieht die normale Geld-Übergabe',bar.status===200&&JSON.stringify(bar.body).includes('MB-NORMAL-1'),JSON.stringify(bar.body).slice(0,140));
    const fin=await kasse(HTTPS_PORT,'GET','/api/v1/finance-transfer/pending',null,cred);
    pruefe('Kasse sieht die Übergabe mit Bestätigung',fin.status===200&&/MB-BEST-1|FB-1/.test(JSON.stringify(fin.body)),JSON.stringify(fin.body).slice(0,140));
  }catch(err){console.log('ABBRUCH:',err&&err.stack||err);fehler++}
  await b.close();web.close();try{await mgr.stop?.()}catch(e){}
  console.log(fehler?`\n${fehler} FEHLER`:'\nAlles OK');process.exit(fehler?1:0);
})();
