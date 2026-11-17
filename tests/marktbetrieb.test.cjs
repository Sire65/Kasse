const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto'),vm=require('vm');
const {chromium}=require('playwright');const ROOT=path.resolve(__dirname,'..');
let n=0;function test(name,ok){assert.ok(ok,name);console.log('OK '+name);n++;}
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((q,r)=>{
 if(q.url.startsWith('/pin-fixture')){r.writeHead(200,{'Content-Type':'text/html'});return r.end('<html><body><script>window.KCKrypto={sha256Hex:async t=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t)))).map(n=>n.toString(16).padStart(2,"0")).join(""),sha256Bytes:async t=>new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t)))};window.__kcRehydrate=async()=>true;</script><script src="/pos/kc-pin-lock.js"></script></body></html>');}
 const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{r.writeHead(e?404:200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});r.end(e?'':d)});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port,url=`http://127.0.0.1:${port}`;
 const b=await chromium.launch({...(process.env.CHROME_CHANNEL?{channel:process.env.CHROME_CHANNEL}:{}),headless:true});
 try{
 // Ein Stammdaten-Fernbefehl darf im offenen Bon und im Andrang keinen Neustart auslösen.
 let poll,reloads=0;const remoteState={cart:[{id:'mettwurst'}],master:{rushMode:false},discount:{}};
 vm.runInNewContext(fs.readFileSync(path.join(ROOT,'pos/kc-sync-remote-command.js'),'utf8'),{
  window:{},state:remoteState,localStorage:{getItem:()=>null},document:{querySelector:()=>null},
  location:{reload:()=>reloads++},setInterval:f=>{poll=f},AbortSignal,
  fetch:async()=>({ok:true,json:async()=>({befehl:'reload_stammdaten'})}),console
 });
 await poll();test('Fernaktualisierung wartet auf Ende des offenen Bons',reloads===0);
 remoteState.cart=[];remoteState.master.rushMode=true;await poll();test('Fernaktualisierung unterbricht keine Stoßzeit',reloads===0);
 remoteState.master.rushMode=false;await poll();test('Vorgemerkte Fernaktualisierung läuft erst bei freier Kasse',reloads===1);
 // Unabhängig von sonstigen Startfenstern: echte PIN-Oberfläche und Browser-Sitzung.
 const c=await b.newContext(),p=await c.newPage();
 await p.clock.install({time:new Date('2026-10-31T09:00:00+01:00')});
 const hash=crypto.createHash('sha256').update('2609').digest('hex');
 await p.addInitScript(hash=>localStorage.setItem('kc_pin_lock_hash_v1',hash),hash);
 await p.goto(url+'/pin-fixture');await p.locator('#kcPinInput').waitFor();await p.waitForTimeout(120);
 await p.locator('#kcPinInput').fill('9999');await p.locator('#kcPinSubmit').click();
 await p.waitForFunction(()=>document.getElementById('kcPinError')?.textContent==='Falsche PIN.');test('Falsche Start-PIN entsperrt nicht',await p.locator('#kcPinLockOverlay').isVisible());
 await p.locator('#kcPinInput').fill('2609');await p.locator('#kcPinSubmit').click();await p.waitForFunction(()=>window.KCPinLock.isUnlocked());
 await p.clock.fastForward(6*60*1000);test('Nach Inaktivität keine erneute PIN',!await p.locator('#kcPinLockOverlay').count());
 await p.reload();test('Neuladen am selben Markttag benötigt keine zweite PIN',await p.evaluate(()=>KCPinLock.isUnlocked()&&!document.getElementById('kcPinLockOverlay')));
 await p.clock.fastForward(24*60*60*1000);await p.reload();test('Neuer Markttag fragt beim Start wieder nach PIN',await p.locator('#kcPinLockOverlay').count()===1);
 await c.close();
 for(const pre of ['', 'schulung/']){
  const ctx=await b.newContext({viewport:{width:1366,height:900},serviceWorkers:'block'}),pg=await ctx.newPage(),errors=[];pg.on('pageerror',e=>errors.push(e.message));
  await ctx.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1'&&u.port===String(port))return route.continue();return route.abort();});
  await pg.addInitScript(()=>localStorage.setItem('kc_master_v040',JSON.stringify({pinLockEnabled:false,receipt:{printMode:'nie'},trainingMode:false})));
  await pg.goto(url+'/'+pre+'pos/index.html');await pg.waitForFunction(()=>typeof state!=='undefined'&&window.KCAufbau&&typeof showScreenSaver==='function');
  await pg.evaluate(()=>{['fullscreenGate','kcStartupSummary','kcPinLockOverlay'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none'});document.querySelectorAll('[data-kc-sperrend]').forEach(e=>e.style.display='none');document.querySelectorAll('dialog[open]').forEach(d=>d.close());state.master.rushMode=false;state.master.trainingMode=false;resetScreenSaverTimer();});
  await pg.clock.install();await pg.evaluate(()=>resetScreenSaverTimer());const label=pre||'Produktion/';
  await pg.clock.fastForward(6*60*1000);test(label+' Leere Kasse dunkelt normal ab',await pg.evaluate(()=>screenSaverActive));
  await pg.mouse.click(700,400);test(label+' Aufwecken braucht keine PIN',await pg.evaluate(()=>!screenSaverActive&&!document.getElementById('kcPinLockOverlay')));
  await pg.evaluate(()=>selectProduct('mettwurst'));await pg.clock.fastForward(6*60*1000);test(label+' Offener Warenkorb wird nicht automatisch verdeckt',await pg.evaluate(()=>!screenSaverActive&&state.cart.length===1));
  await pg.evaluate(()=>showScreenSaver('manual'));const pay=await pg.locator('#payBtn').boundingBox();
  await pg.mouse.click(pay.x+pay.width/2,pay.y+pay.height/2);test(label+' Aufweck-Tipp bucht nicht versehentlich BAR',await pg.evaluate(()=>state.cart.length===1&&readTransactions().length===0&&!screenSaverActive));
  await pg.clock.fastForward(800);
  await pg.evaluate(()=>el('rushModeBtn').click());await pg.clock.fastForward(10*60*1000);await pg.evaluate(()=>showScreenSaver('manual'));
  test(label+' Stoßzeiten bleiben hell, auch bei manueller Abdunklung',await pg.evaluate(()=>state.master.rushMode&&!screenSaverActive));
  await pg.evaluate(()=>{state.given=20;state.master.requireChangeFlow=true;});await pg.evaluate(()=>checkoutSale());
  test(label+' Erfolgreicher Rückgeld-Verkauf ohne blockierenden Dialog',await pg.evaluate(()=>state.cart.length===0&&!document.querySelector('dialog[open]')&&readTransactions().length===1));
  test(label+' Bon ist vor Freigabe dauerhaft gespeichert',await pg.evaluate(async()=>{const rows=await KCTransactionStore.getAll(KCTransactionStore.STORE_SALES);return rows.length===1&&rows[0].recordHash===readTransactions()[0].recordHash}));
  // Speicherfehler simulieren: nie einen Bon als abgeschlossen zeigen, der nur im RAM liegt.
  await pg.evaluate(()=>{window.originalWrite=KCTransactionStore.replaceAll;KCTransactionStore.replaceAll=async()=>{throw Error('Test: Speicher voll')};selectProduct('mettwurst');});
  await pg.evaluate(()=>checkoutSale());test(label+' Speicherfehler erhält Warenkorb und gibt keinen falschen Erfolg',await pg.evaluate(()=>state.cart.length===1&&readTransactions().length===1&&!state.saleInProgress&&el('messageDialog').open));
  await pg.evaluate(()=>{KCTransactionStore.replaceAll=window.originalWrite;el('messageDialog').close();});await pg.evaluate(()=>checkoutSale());
  test(label+' Erneuter Versuch nach Speicherfehler erzeugt genau einen Bon',await pg.evaluate(()=>readTransactions().length===2&&state.cart.length===0));
  // Während eines langsamen Schreibens weder doppelt abschließen noch neue Artikel verlieren.
  await pg.evaluate(()=>{selectProduct('mettwurst');KCTransactionStore.replaceAll=(...a)=>new Promise(resolve=>{window.releaseWrite=()=>window.originalWrite(...a).then(resolve)});window.pendingSale=checkoutSale();});
  await pg.waitForFunction(()=>typeof window.releaseWrite==='function');
  await pg.evaluate(()=>{checkoutSale();selectProduct('mettwurst');});test(label+' Doppelter BAR-Tipp und Artikel während Speicherung gesperrt',await pg.evaluate(()=>state.cart.length===1&&state.cart[0].qty===1&&state.saleInProgress));
  await pg.evaluate(async()=>{window.releaseWrite();await window.pendingSale;KCTransactionStore.replaceAll=window.originalWrite;});
  test(label+' Langsame Speicherung erzeugt genau einen weiteren Bon',await pg.evaluate(()=>readTransactions().length===3&&!state.saleInProgress));
  const zeit=await pg.evaluate(async()=>{const start=performance.now();for(let i=0;i<50;i++){selectProduct('mettwurst');await checkoutSale();}return performance.now()-start});
  const stand=await pg.evaluate(async()=>({cache:readTransactions().length,disk:(await KCTransactionStore.getAll(KCTransactionStore.STORE_SALES)).length,dialog:!!document.querySelector('dialog[open]')}));
  test(label+' 50 schnelle Verkäufe vollständig, eindeutig und ohne Meldungsfenster',stand.cache===53&&stand.disk===53&&!stand.dialog);console.log(label+' 50 Buchungen: '+Math.round(zeit)+' ms');
  test(label+' Verbindliche Speicherung wird nicht durch Hintergrundauftrag übersprungen',await pg.evaluate(async()=>{
    const store=KCTransactionStore.STORE_TRAINING,row={transactionId:'queue-test',time:new Date().toISOString(),bon:'T-QUEUE'};
    await Promise.all([KCTransactionStore.replaceAll(store,[row],{verbindlich:true}),KCTransactionStore.replaceAll(store,[])]);
    return (await KCTransactionStore.getAll(store)).some(r=>r.transactionId==='queue-test');
  }));
  const letzteBon=await pg.evaluate(()=>Number(readTransactions().at(-1).bon));
  await pg.evaluate(()=>{const m=JSON.parse(localStorage.getItem('kc_master_v040'));m.nextBon=1;localStorage.setItem('kc_master_v040',JSON.stringify(m));});
  await pg.reload();await pg.waitForFunction(()=>typeof state!=='undefined'&&window.__kcTxHydrated);await pg.evaluate(()=>window.__kcTxHydrated);
  test(label+' Neustart erhält alle 53 Bons und korrigiert veralteten Zähler',await pg.evaluate(last=>readTransactions().length===53&&state.master.nextBon===last+1,letzteBon));
  test(label+' Keine JavaScript-Abstürze',errors.length===0);if(errors.length)console.log(errors);
  await ctx.close();
 }
 console.log(n+' Prüfungen erfolgreich.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
