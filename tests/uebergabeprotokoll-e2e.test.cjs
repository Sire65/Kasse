/* Übergabeprotokoll - der VOLLSTÄNDIGE Weg, echt geprüft:
     Weg 1  Money Butler erzeugt und meldet selbst -> Manager-Dienst -> Archiv im PC-Manager
     Weg 2  Beleg vom Papier (QR-Text) im Manager nachgetragen
   Braucht Playwright und den Manager-Companion. Fehlt eines davon, wird übersprungen. */
// Der Companion braucht seine eigenen Abhaengigkeiten (npm install im Backend-Ordner). Fehlen
// sie oder fehlt Playwright, wird der Test uebersprungen statt rot zu werden - er prueft die
// Verkettung, nicht die Installation.
let ManagerCompanion;
try{
  require('playwright');
  ({ManagerCompanion}=require('../../kc-sync-installation-und-backend/manager-companion'));
}catch(e){
  console.log('  ueberspringen: Playwright oder Manager-Companion nicht einsatzbereit ('+e.message.split('\n')[0]+')');
  process.exit(0);
}
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const os=require('os');
const WURZEL=path.join(__dirname,'..');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png'};
const srv=http.createServer((q,r)=>{const p=path.join(WURZEL,decodeURIComponent(q.url.split('?')[0]));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end('x')}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(d)})});
const heute=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
let fehler=0;const pruefe=(n,b,z='')=>{console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'  ['+z+']':''}`);if(!b)fehler++};
(async()=>{
 const dbPfad=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'kce2e-')),'mgr.sqlite');
 const mgr=new ManagerCompanion({dbPath:dbPfad});
 const info=await mgr.start();
 const port=47392; // fester Loopback-Kanal des Managers
 console.log('Manager-Dienst läuft, Loopback-Port',port);
 
 await new Promise(r=>srv.listen(8473,r));
 const b=await chromium.launch();

 // --- Money Butler: Kassette erzeugen; der Beleg soll SELBST beim Dienst ankommen ---
 const mb=await b.newPage({viewport:{width:1150,height:1300}});
 mb.on('pageerror',e=>console.log('MB PAGEERROR:',e.message));
 await mb.goto('http://127.0.0.1:8473/money-butler/index.html');
 await mb.selectOption('#register','KASSETTE');await mb.fill('#effectiveDate',heute());
 await mb.fill('[data-value="50"]','4');await mb.fill('[data-value="20"]','6');
 await mb.click('[data-money-section="rolls"] .section-lock');await mb.fill('[data-roll-value="1"]','2');
 await mb.waitForTimeout(250);await mb.click('#generate');await mb.waitForTimeout(1200);
 const belegText=await mb.evaluate(()=>KCUebergabeprotokoll.lokalLesen()[0]);
 pruefe('Money Butler hat einen Beleg erzeugt',!!belegText&&!!belegText.id,belegText&&belegText.id.slice(0,8));

 const imDienst=await new Promise((res,rej)=>{http.get({hostname:'127.0.0.1',port,path:'/bargeld/protokolle'},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)});
 pruefe('Weg 1: Beleg ist OHNE Zutun im Manager-Dienst angekommen',imDienst.protokolle.length===1&&imDienst.protokolle[0].id===belegText.id,`${imDienst.protokolle.length} Beleg(e)`);
 pruefe('Aufteilung ist im Dienst vollständig',!!imDienst.protokolle[0]?.k1,JSON.stringify(imDienst.protokolle[0]?.k1?.lose||{}));
 pruefe('Herkunft festgehalten',imDienst.protokolle[0]?.quelle==='money-butler',String(imDienst.protokolle[0]?.quelle));

 // --- PC-Manager: Archiv zeigt den Beleg ---
 const pm=await b.newPage({viewport:{width:1250,height:1000}});
 pm.on('pageerror',e=>console.log('PM PAGEERROR:',e.message));
 await pm.goto('http://127.0.0.1:8473/pc-manager/index.html');
 await pm.waitForTimeout(1200);
 // Der PC-Manager liegt hinter der Anmeldung des geschuetzten Bereichs. Fuer den Test wird
 // der Bereich "Money Butler" direkt sichtbar gemacht - geprueft wird das Archiv, nicht die
 // Anmeldung (die hat ihre eigenen Tests).
 await pm.evaluate(()=>{
   const karte=document.getElementById('mgrProtokollKarte');
   for(let n=karte;n&&n!==document.body;n=n.parentElement){n.hidden=false;n.classList.remove('hidden');n.style.setProperty('display','block','important');n.style.setProperty('visibility','visible','important');n.style.setProperty('opacity','1','important');}
 });
 await pm.waitForTimeout(1200);
 const belegeSichtbar=await pm.locator('.kcprot-beleg').count();
 pruefe('Archiv im PC-Manager zeigt den Beleg',belegeSichtbar===1,`${belegeSichtbar} Zeile(n)`);
 const zeile=belegeSichtbar?await pm.locator('.kcprot-beleg summary').first().innerText():'';
 console.log('      Archivzeile:',zeile.replace(/\n/g,' | '));

 // --- Weg 2: Beleg vom Papier nachtragen (Text aus dem QR) ---
 // Dafür einen ZWEITEN Beleg im Butler erzeugen, ohne dass der Dienst ihn bekommt.
 const zweiterCode=await mb.evaluate(()=>{
   const p={transferId:'PAPIER-1',type:'opening',effectiveDate:document.getElementById('effectiveDate').value,
            scope:'split',registerIds:['KASSE-01','KASSE-02'],split:{ersteKasse:'KASSE-01',lose:{50:1},rollen:{}},total:100,note:'vom Papier'};
   return KCUebergabeprotokoll.erzeugen(p,{looseBreakdown:{50:2},coinRolls:{}});
 });
 await pm.evaluate(c=>{document.getElementById('mgrProtokollEingabe').value=c;document.getElementById('mgrProtokollUebernehmen').click()},zweiterCode);
 await pm.waitForTimeout(1200);
 const meldung=await pm.textContent('#mgrProtokollMeldung');
 pruefe('Weg 2: nachgetragener Beleg wird übernommen',/übernommen/.test(meldung||''),(meldung||'').slice(0,80));
 pruefe('Archiv zeigt jetzt beide Belege',await pm.locator('.kcprot-beleg').count()===2);

 // --- Beschädigter Beleg muss abgewiesen werden ---
 await pm.evaluate(c=>{document.getElementById('mgrProtokollEingabe').value=c;document.getElementById('mgrProtokollUebernehmen').click()},zweiterCode.slice(0,-6)+'AAAAAA');
 await pm.waitForTimeout(800);
 const fehlerMeldung=await pm.textContent('#mgrProtokollMeldung');
 const klasse=await pm.getAttribute('#mgrProtokollMeldung','class');
 pruefe('Beschädigter Beleg wird abgewiesen',/kcprot-fehler/.test(klasse||''),(fehlerMeldung||'').slice(0,70));
 pruefe('Nach der Abweisung stehen weiterhin nur 2 Belege im Archiv',await pm.locator('.kcprot-beleg').count()===2);

 // Fuer das Foto den Einrichtungsdialog wegnehmen, der sonst ueber der Seite liegt.
 await pm.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());
   document.querySelectorAll('.modal,.overlay,.backdrop').forEach(n=>n.style.setProperty('display','none','important'));
   // Der Manager legt einen Weichzeichner ueber die Seite, solange die Anmeldung offen ist.
   document.querySelectorAll('*').forEach(n=>{const f=getComputedStyle(n).filter;if(f&&f!=='none')n.style.setProperty('filter','none','important');});});
 await pm.waitForTimeout(400);
 await pm.locator('#mgrProtokollKarte').screenshot({path:'/tmp/kc-protokoll-archiv.png'});
 await b.close();srv.close();await mgr.stop();
 console.log(fehler?`\n${fehler} FEHLER`:'\nAlles grün.');
 process.exit(fehler?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
