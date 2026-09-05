/* Die Kasse über die WLAN-Adresse - so, wie das Tablet sie aufruft.
 *
 * WARUM DIESER TEST EXISTIERT
 * Alle bisherigen Prüfungen liefen über 127.0.0.1. Das ist ein "sicherer Kontext": dort gibt
 * der Browser crypto.subtle frei. Das Tablet ruft die Kasse aber über die WLAN-Adresse auf
 * (http://192.168.178.79:8090) - und DORT ist crypto.subtle undefined. Am 01.09.2026 ist genau
 * daran die PIN-Sperre gescheitert: vier Ziffern, Knopf gedrückt, nichts passierte.
 * Dieser Test läuft deshalb bewusst über die LAN-Adresse dieses Rechners.
 */
const {chromium}=require('playwright');
const http=require('http'), fs=require('fs'), path=require('path'), os=require('os');
const WURZEL=path.resolve(__dirname,'..');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.webmanifest':'application/manifest+json'};
let ok=0,rot=0; const p=(n,b,z='')=>{b?ok++:rot++;console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'   ['+z+']':''}`)};

function lanAdresse(){
  for(const liste of Object.values(os.networkInterfaces()))
    for(const e of liste||[]) if(e.family==='IPv4'&&!e.internal) return e.address;
  return null;
}
async function bisZurPinSperre(pg, sekunden=25){
  for(let i=0;i<sekunden*2;i++){
    const da=await pg.evaluate(()=>{
      const g=document.getElementById('fullscreenGate'); if(g&&!g.hidden)g.hidden=true;
      const okk=document.getElementById('kcStartupOk');
      if(okk){let n=okk;while(n&&getComputedStyle(n).position!=='fixed')n=n.parentElement;(n||okk).remove()}
      return !!document.getElementById('kcPinLockOverlay');
    });
    if(da)return true;
    await pg.waitForTimeout(500);
  }
  return false;
}

(async()=>{
 const adresse=lanAdresse();
 if(!adresse){console.log('Keine LAN-Adresse - dieser Test braucht eine.');process.exit(1)}
 const s=http.createServer((q,r)=>{const f=path.join(WURZEL,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end('x')}r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(d)})});
 await new Promise(r=>s.listen(8797,'0.0.0.0',r));
 const b=await chromium.launch();
 const ctx=await b.newContext({viewport:{width:1080,height:810},hasTouch:true});
 const pg=await ctx.newPage();
 const fehler=[]; pg.on('pageerror',e=>fehler.push(e.message));
 await pg.goto(`http://${adresse}:8797/pos/index.html`); await pg.waitForTimeout(7000);

 const lage=await pg.evaluate(()=>({sicher:window.isSecureContext, subtle:typeof crypto.subtle,
   krypto:!!window.KCKrypto}));
 p('dieser Lauf ist wirklich ein UNSICHERER Kontext - wie auf dem Tablet',
   lage.sicher===false && lage.subtle==='undefined', JSON.stringify(lage));
 p('das Ersatzmodul kc-krypto ist geladen', lage.krypto===true);
 p('die Kasse startet trotzdem ohne Skriptfehler', fehler.length===0, fehler[0]||'keine');

 // Der Hashwert MUSS derselbe sein wie mit crypto.subtle - sonst schliesst eine am PC
 // gesetzte PIN am Tablet nicht mehr auf.
 const hash=await pg.evaluate(async()=>({
   gerechnet:await window.KCKrypto.sha256Hex('1234'),
   direkt:window.KCKrypto._gerechnet('1234'),
   leer:await window.KCKrypto.sha256Hex(''),
 }));
 // Bekannte Prüfwerte aus dem Standard (FIPS 180-4)
 p('SHA-256 von "1234" stimmt mit dem offiziellen Pruefwert ueberein',
   hash.gerechnet==='03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', hash.gerechnet);
 p('SHA-256 vom leeren Text stimmt ebenfalls',
   hash.leer==='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', hash.leer);
 p('beide Wege liefern dasselbe', hash.gerechnet===hash.direkt);

 // ---- Und jetzt der eigentliche Fall vom 01.09.: PIN setzen ueber die WLAN-Adresse ----
 const da=await bisZurPinSperre(pg);
 p('die PIN-Sperre erscheint', da===true);
 if(da){
   for(const z of ['1','2','3','4']) await pg.click(`[data-pin-taste="${z}"]`);
   p('die vier Ziffern stehen im Feld',
     await pg.evaluate(()=>document.getElementById('kcPinInput').value==='1234'));
   await pg.click('#kcPinSubmit'); await pg.waitForTimeout(1500);
   const nachher=await pg.evaluate(()=>({
     offen:!!document.getElementById('kcPinLockOverlay'),
     meldung:document.getElementById('kcPinError')?.textContent||'(Fenster zu)',
     gespeichert:!!localStorage.getItem('kc_pin_lock_hash_v1')}));
   p('der gruene Knopf legt die PIN WIRKLICH fest', nachher.offen===false,
     `${nachher.meldung} · gespeichert: ${nachher.gespeichert}`);
   p('und die PIN ist gespeichert', nachher.gespeichert===true);

   // Neustart: dieselbe PIN muss aufschliessen
   await pg.reload(); await pg.waitForTimeout(6000);
   const wieder=await bisZurPinSperre(pg);
   p('nach einem Neustart wird wieder gefragt', wieder===true);
   if(wieder){
     for(const z of ['1','2','3','4']) await pg.click(`[data-pin-taste="${z}"]`);
     await pg.click('#kcPinSubmit'); await pg.waitForTimeout(1500);
     p('dieselbe PIN schliesst ueber die WLAN-Adresse auf',
       await pg.evaluate(()=>!document.getElementById('kcPinLockOverlay')),
       await pg.evaluate(()=>document.getElementById('kcPinError')?.textContent||'(zu)'));
   }
   // Eine falsche PIN muss auch sichtbar abgelehnt werden
   await pg.evaluate(()=>{const o=document.getElementById('kcPinLockOverlay');if(o)o.remove()});
   await pg.reload(); await pg.waitForTimeout(6000);
   if(await bisZurPinSperre(pg)){
     for(const z of ['9','9','9','9']) await pg.click(`[data-pin-taste="${z}"]`);
     await pg.click('#kcPinSubmit'); await pg.waitForTimeout(1200);
     const falsch=await pg.evaluate(()=>document.getElementById('kcPinError')?.textContent||'');
     p('eine falsche PIN sagt das auch', /Falsche PIN/i.test(falsch), falsch);
     for(const z of ['1','2','3','4']) await pg.click(`[data-pin-taste="${z}"]`);
     await pg.click('#kcPinSubmit'); await pg.waitForTimeout(1200);
   }
 }

 // ---- Kassieren ueber die WLAN-Adresse: das ist die Freitagsfrage ----
 await pg.evaluate(()=>{["fullscreenGate","kcStartupSummary"].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display="none"});
   document.querySelectorAll("[data-kc-sperrend]").forEach(e=>e.style.display="none")});
 await pg.evaluate(()=>{state.cart=[];renderCart()});
 await pg.evaluate(()=>document.activeElement&&document.activeElement.blur());
 await pg.keyboard.type('01001',{delay:8}); await pg.keyboard.press('Enter'); await pg.waitForTimeout(800);
 p('ein gescannter Artikel landet auch ueber die WLAN-Adresse im Bon',
   await pg.evaluate(()=>state.cart.length===1), await pg.evaluate(()=>JSON.stringify(state.cart.map(x=>x.name))));

 const vorher=await pg.evaluate(()=>state.master.nextBon);
 await pg.evaluate(()=>document.activeElement&&document.activeElement.blur());
 await pg.keyboard.type('CMD-CHECKOUT',{delay:8}); await pg.keyboard.press('Enter'); await pg.waitForTimeout(2000);
 const gebucht=await pg.evaluate(async()=>{
   const t=await (window.KCTransactionStore?.readAll?.()||readTransactions());
   return {posten:state.cart.length, bon:state.master.nextBon, anzahl:t.length,
     letzte:t.length?(t[t.length-1].items||[]).length:0};
 });
 p('der Verkauf laesst sich abschliessen', gebucht.posten===0 && gebucht.bon===vorher+1,
   `Bon ${vorher} -> ${gebucht.bon}`);
 p('und er ist WIRKLICH gespeichert - das ist die Freitagsfrage',
   gebucht.anzahl>0 && gebucht.letzte>0, `${gebucht.anzahl} Buchungen, letzte mit ${gebucht.letzte} Posten`);

 p('keine Skriptfehler ueber den ganzen Lauf', fehler.length===0, fehler.slice(0,2).join(' | ')||'keine');
 await b.close(); s.close();
 console.log(`\nKasse ueber die WLAN-Adresse: ${ok}/${ok+rot} bestanden`);
 process.exit(rot?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
