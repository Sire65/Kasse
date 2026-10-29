const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),http=require('http'),vm=require('vm');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..');
const core=require('../shared/kc-haendlerausweis.js');
const jahr=2026,qr=(nr='007',code='ABCD',year=jahr)=>`Koecheclub Werne Haendler-Ausweis ${year} Nr ${nr} Code ${code}`;
const rows=[{jahr,nr:'007',code:'ABCD',gesperrt:false},{jahr,nr:'008',code:'EFGH',gesperrt:true}];
const snapshot=core.paket(rows,jahr),master={eventName:'Weihnachtsmarkt 2026',haendlerausweise:snapshot};
let count=0;
function test(name,value){assert.ok(value,name);count++;console.log('OK '+name);}
test('Gültiger Ausweis',core.pruefen(qr(),master).ok);
test('Falscher Prüfcode',!core.pruefen(qr('007','ZZZZ'),master).ok);
test('Gesperrter Ausweis',!core.pruefen(qr('008','EFGH'),master).ok);
test('Falsches Marktjahr',!core.pruefen(qr('007','ABCD',2025),master).ok);
test('Musterausweis im Echtbetrieb abgelehnt',!core.pruefen(qr('000','MSTR'),master).ok);
test('Muster ausschließlich im Training',core.pruefen(qr('000','MSTR'),master,true).ok);
test('Auch im Training kein beliebiger Muster-Prüfcode',!core.pruefen(qr('000','ABCD'),master,true).ok);
test('Fehlende Liste sperrt echte Ausweise',!core.pruefen(qr(),{eventName:'Markt 2026'}).ok);
assert.throws(()=>core.paket([...rows,rows[0]],jahr));count++;

async function managerUnit(){
 let calls=[],saved=0,published=0,fail=false,leer=false,hang=false;
 const liste=Array.from({length:150},(_,i)=>({jahr,nr:String(i+1).padStart(3,'0'),code:'ABCD',gesperrt:i===5}));
 const s={eventName:'Markt 2026'};
 const win={settings:s,KCHaendlerausweis:core,saveAll:()=>saved++,KCTimeClockManager:{anKassenSenden:async()=>published++},KCSupabase:{istAngemeldet:()=>true,rufeTabelleAuf:async(q,m)=>{
  calls.push([q,m]);if(fail)throw Error('offline');if(hang)return new Promise(()=>{});if(leer)return [];const offset=Number(q.match(/offset=(\d+)/)[1]);return liste.slice(offset,offset+100);
 }}};
 vm.runInNewContext(fs.readFileSync(path.join(ROOT,'pc-manager/kc-haendlerausweise-manager.js'),'utf8'),{window:win,setInterval:()=>0,setTimeout,clearTimeout,console});
 const r=await win.KCHaendlerausweiseManager.pull({publish:true});
 test('Manager lädt alle 150 Ausweise über zwei Seiten',r.ok&&s.haendlerausweise.ausweise.length===150&&calls.length===2);
 test('Manager schreibt niemals in die Club-Tabelle',calls.every(([q,m])=>m===undefined&&q.includes('org_id=eq.KC_WERNE')));
 test('Sperre in vollständigem Stammdatenpaket enthalten',s.haendlerausweise.ausweise[5].gesperrt&&saved===1&&published===1);
 fail=true;const vorher=JSON.stringify(s.haendlerausweise);await win.KCHaendlerausweiseManager.pull();
 test('Abruffehler ersetzt die Liste nicht durch leere Freigaben',JSON.stringify(s.haendlerausweise)===vorher);
 fail=false;hang=true;const start=Date.now();const timeout=await win.KCHaendlerausweiseManager.pull();
 test('Nicht antwortender Server blockiert den Abgleich höchstens fünf Sekunden',!timeout.ok&&Date.now()-start<6500&&JSON.stringify(s.haendlerausweise)===vorher);
 hang=false;leer=true;await win.KCHaendlerausweiseManager.pull();
 test('Erfolgreiche leere Liste entfernt frühere Freigaben',s.haendlerausweise.ausweise.length===0);
}

const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const f=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]));fs.readFile(f,(e,data)=>{res.writeHead(e?404:200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});res.end(e?'':data)});});
async function scan(page,text){await page.keyboard.type(text,{delay:2});await page.keyboard.press('Enter');await page.waitForTimeout(100);}
async function close(page){await page.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.activeElement?.blur();});}

(async()=>{
 await managerUnit();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 const browser=await chromium.launch({...(process.env.CHROME_CHANNEL?{channel:process.env.CHROME_CHANNEL}:{}),headless:true});
 try{
 for(const prefix of ['', 'schulung/']){
  // Echte Manageroberfläche: Club-Abfrage ersetzen, dann den echten Sendeknopf betätigen.
  const mc=await browser.newContext({serviceWorkers:'block'}),mp=await mc.newPage();let paket=null;
  await mc.route('**/*',route=>{const u=new URL(route.request().url());
   if(u.pathname==='/master-data/push'){paket=JSON.parse(route.request().postData());return route.fulfill({status:200,contentType:'application/json',body:'{"revision":9}'});}
   if(u.hostname==='127.0.0.1'&&u.port===String(port))return route.continue();return route.abort();
  });
  await mp.goto(`http://127.0.0.1:${port}/${prefix}pc-manager/index.html`);
  await mp.waitForFunction(()=>window.KCHaendlerausweiseManager&&window.settings&&typeof requireAuth==='function');
  await mp.evaluate(rows=>{window.KCSupabase={istAngemeldet:()=>true,rufeTabelleAuf:async()=>rows};managerUnlocked=true;document.getElementById('masterDataPushBtn').click();},rows);
  await mp.waitForFunction(()=>document.getElementById('masterDataPushStatus').textContent.includes('Gesendet'));
  test((prefix||'Produktion/')+' Manager sendet vollständige Ausweisliste im Stammdatenpaket',paket?.settings?.haendlerausweise?.ausweise?.length===2&&paket.settings.haendlerausweise.ausweise[1].gesperrt===true);
  await mc.close();
  const ctx=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block'}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await ctx.route('**/*',route=>{const u=new URL(route.request().url());
   if(u.pathname==='/kc-sync-master-data')return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({vorhanden:true,...paket})});
   if(u.hostname==='127.0.0.1'&&u.port===String(port))return route.continue();
   return route.abort();
  });
  await page.addInitScript(m=>localStorage.setItem('kc_master_v040',JSON.stringify({...m,pinLockEnabled:false,trainingMode:false})),master);
  await page.goto(`http://127.0.0.1:${port}/${prefix}pos/index.html`);
  await page.waitForFunction(()=>typeof state!=='undefined'&&typeof haendlerScan==='function'&&window.KCAufbau);
  await page.waitForTimeout(1200);
  await page.evaluate(()=>{['fullscreenGate','kcStartupSummary','kcPinLockOverlay'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none'});document.querySelectorAll('[data-kc-sperrend]').forEach(e=>e.style.display='none');state.master.trainingMode=false;});
  await close(page);
  const label=prefix||'Produktion/';
  await scan(page,qr());
  test(label+' Scan vor erstem Artikel bleibt erhalten',await page.evaluate(()=>state.discount.percent===10&&state.cart.length===0&&state.discount.haendlerausweis.nr==='007'));
  test(label+' Gesamtrabatt wird unten angezeigt',await page.locator('#haendlerAusweisStatus').isVisible());
  await page.locator('#discountBtn').click();
  await page.evaluate(()=>{discountDraftPercent=12;renderDiscountDraft();el('applyDiscountBtn').click();});
  test(label+' Rabatt ist schon vor dem ersten Artikel änderbar',await page.evaluate(()=>state.discount.percent===12&&!!state.discount.haendlerausweis));
  await page.evaluate(()=>{selectProduct('feuer');selectProduct('mettwurst');});
  test(label+' Später hinzugefügte Artikel erhalten Gesamtrabatt ohne Positionsrabatt',await page.evaluate(()=>state.discount.percent===12&&globalDiscountAmount()>0&&state.cart.every(i=>!i.positionDiscount)&&state.discount.keys.length===0));
  const basis=await page.evaluate(()=>({base:discountBase(),amount:globalDiscountAmount(),gross:grossTotal(),due:total(),deposit:state.cart.reduce((s,i)=>s+i.deposits.reduce((s,d)=>s+d.price,0)*i.qty,0)}));
  test(label+' Pfand bleibt vollständig erhalten',basis.deposit>0&&Math.abs(basis.gross-basis.base-basis.deposit)<.001&&Math.abs(basis.due-(basis.gross-basis.amount))<.001);
  await page.evaluate(()=>{openDiscountDialog();discountDraftPercent=15;renderDiscountDraft();el('applyDiscountBtn').click();});
  test(label+' Gesamtrabatt bleibt änderbar und für alle neuen Artikel aktiv',await page.evaluate(()=>{selectProduct('mettwurst');return state.discount.percent===15&&state.discount.keys.length===0&&!!state.discount.haendlerausweis}));
  await page.locator('#payBtn').evaluate(e=>e.focus());
  await scan(page,qr());test(label+' Wiederholter Scan überschreibt manuelle 15 % nicht',await page.evaluate(()=>state.discount.percent===15));
  test(label+' Leerzeichen im QR lösen fokussierten BAR-Knopf nicht aus',await page.evaluate(()=>state.cart.length>0&&readTransactions().length===0));
  test(label+' Wiederholter Scan zeigt den Warenkorb ohne Dialog',await page.evaluate(()=>!document.querySelector('dialog[open]')));
  await page.screenshot({path:path.join(ROOT,`haendler-${prefix?'schulung':'produktion'}.png`),fullPage:true});
  await scan(page,qr('008','EFGH'));test(label+' Gesperrter Scan gewährt keinen neuen Rabatt',await page.evaluate(()=>state.discount.percent===15&&el('messageDialog').open));await close(page);
  await scan(page,qr('007','ZZZZ'));test(label+' Falscher Prüfcode wird abgelehnt',await page.evaluate(()=>el('messageDialog').open));await close(page);
  await scan(page,qr('007','ABCD',2025));test(label+' Falsches Jahr wird abgelehnt',await page.evaluate(()=>el('messageDialog').open));await close(page);
  await page.evaluate(()=>{state.given=total();});
  const result=await page.evaluate(()=>completeSale('cash',{silent:true,directSettlement:true}));
  test(label+' Verkauf beendet Händlerstatus und Rabatt',await page.evaluate(()=>state.cart.length===0&&state.discount.percent===0&&!state.discount.haendlerausweis));
  const bon=await page.evaluate(()=>readTransactions().at(-1));
  test(label+' Bon protokolliert einen Gesamtrabatt mit Ausweisnummer',!!bon&&bon.discount.percent===15&&bon.discount.haendlerausweis.nr==='007'&&bon.items.filter(i=>i.discountLine).length===1&&bon.items.some(i=>i.name.includes('Händler-Ausweis Nr. 007')));
  await close(page);await page.evaluate(()=>selectProduct('mettwurst'));test(label+' Nächster Kunde hat keinen Händlerrabatt',await page.evaluate(()=>discountAmount()===0));
  await page.evaluate(()=>{resetDiscount();state.cart=[];renderCart();});
  await scan(page,qr('000','MSTR'));test(label+' Muster im Echtbetrieb abgelehnt',await page.evaluate(()=>state.discount.percent===0&&el('messageDialog').open));await close(page);
  await page.evaluate(()=>setTrainingMode(true));await scan(page,qr('000','MSTR'));
  test(label+' Muster im Training akzeptiert',await page.evaluate(()=>state.discount.percent===10&&state.discount.haendlerausweis.muster));
  await page.evaluate(()=>setTrainingMode(false));test(label+' Wechsel in Echtbetrieb entfernt Musterrabatt',await page.evaluate(()=>state.discount.percent===0));
  await scan(page,qr());await page.evaluate(()=>voidBon());test(label+' Abbruch bei leerem Korb löscht Vormerkung',await page.evaluate(()=>state.discount.percent===0));
  // Real scan while cursor is in the search input; original input must be restored.
  await page.evaluate(()=>window.KCAufbau?.zahlenSeite(false));
  const input=page.locator('#productSearchInput');
  if(await input.count()){
   await input.evaluate(e=>{e.value='';e.focus()});await scan(page,qr());
   test(label+' Scan trotz Fokus im Suchfeld',await page.evaluate(()=>state.discount.percent===10&&el('productSearchInput').value===''));
  }
  await page.evaluate(()=>{const m=JSON.parse(localStorage.getItem('kc_master_v040'));m.haendlerausweise.ausweise[0].gesperrt=true;localStorage.setItem('kc_master_v040',JSON.stringify(m));selectProduct('mettwurst');});
  await close(page);await page.evaluate(()=>completeSale('cash',{silent:true}));
  test(label+' Neue Sperre verhindert Abschluss mit vorgemerkt gültigem Ausweis',await page.evaluate(()=>state.cart.length>0&&state.discount.percent===0&&el('messageDialog').open));
  test(label+' Keine JavaScript-Laufzeitfehler',!errors.length);if(errors.length)console.log(errors);
  await ctx.close();
 }
 console.log(`\n${count} Prüfungen erfolgreich.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
