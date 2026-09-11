/* Die vier Scanner-Wege an der Kasse.
   Gescannt wird wie am Stand: der Scanner tippt den Code Zeichen fuer Zeichen wie eine
   Tastatur und schliesst mit Enter ab. Deshalb echte Tastendruecke, keine Funktionsaufrufe. */
const {chromium}=require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const WURZEL=path.resolve(__dirname,'..');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.txt':'text/plain','.webmanifest':'application/manifest+json'};
let ok=0,rot=0; const p=(n,b,z='')=>{b?ok++:rot++;console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'   ['+z+']':''}`)};

const frei=async pg=>pg.evaluate(()=>{["fullscreenGate","kcStartupSummary","kcPinLockOverlay"].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display="none"});document.querySelectorAll("[data-kc-sperrend]").forEach(e=>e.style.display="none")});
// Ein Scanner tippt wie eine Tastatur und schickt Enter hinterher.
async function scanne(pg,code){ await pg.evaluate(()=>document.activeElement&&document.activeElement.blur());
  await pg.keyboard.type(code,{delay:8}); await pg.keyboard.press('Enter'); await pg.waitForTimeout(600); }

(async()=>{
 const s=http.createServer((q,r)=>{const f=path.join(WURZEL,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end('x')}r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(d)})});
 await new Promise(r=>s.listen(8757,r));
 const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1700,height:1050}});
 const pg=await ctx.newPage();
 const fehler=[]; pg.on('pageerror',e=>fehler.push(e.message)); pg.on('dialog',d=>d.accept().catch(()=>{}));
 await pg.goto('http://127.0.0.1:8757/pos/index.html'); await pg.waitForTimeout(6500); await frei(pg);
 p('Kasse startet ohne Skriptfehler', fehler.length===0, fehler[0]||'keine');

 // =============================================================== WEG 1: Bedienerausweis
 console.log('\n== Weg 1: Mitarbeiterausweis scannen ==');
 const start=await pg.evaluate(()=>({bediener:state.master.operatorName,
   kopf:document.getElementById("operatorBtn")?.innerText.replace(/\s+/g,' ').trim()}));
 p('vor dem Scan steht "Team" im Kopf', /Team/.test(start.kopf||'')||start.bediener==='Team', `${start.bediener} / ${start.kopf}`);

 await scanne(pg,'KCOPE1:kc-0003');            // Bedienerausweis aus dem PC-Manager
 const nach1=await pg.evaluate(()=>({bediener:state.master.operatorName,
   kopf:document.getElementById("operatorBtn")?.innerText.replace(/\s+/g,' ').trim()}));
 p('nach dem Scan ist der Bediener umgesprungen', nach1.bediener==='Puhbär', nach1.bediener);
 p('der neue Bediener steht oben links im Kopf', /Puhbär/.test(nach1.kopf||''), nach1.kopf);

 await scanne(pg,'KNG|Köcheclub Werne|KC-0005|m_kc_0005');   // Mitgliedsausweis aus KC Verwaltung
 const nach2=await pg.evaluate(()=>state.master.operatorName);
 p('auch der Mitgliedsausweis aus der Verwaltung meldet an', nach2==='Bibi', nach2);

 // So, wie es beschrieben ist: erst oben links die Bedienertaste, dann scannen.
 await pg.click('#operatorBtn'); await pg.waitForTimeout(500);
 p('die Bedienerliste laesst sich oben links oeffnen',
   await pg.evaluate(()=>document.getElementById("operatorDialog")?.open===true));
 await pg.keyboard.type('KCOPE1:kc-0001',{delay:8}); await pg.keyboard.press('Enter'); await pg.waitForTimeout(700);
 const beiOffenerListe=await pg.evaluate(()=>({bediener:state.master.operatorName,
   nochOffen:document.getElementById("operatorDialog")?.open===true,
   kopf:document.getElementById("operatorBtn")?.innerText.replace(/\s+/g,' ').trim()}));
 p('der Scan wirkt auch bei geoeffneter Bedienerliste', beiOffenerListe.bediener==='Maja', beiOffenerListe.bediener);
 p('und die Liste schliesst sich danach von selbst', beiOffenerListe.nochOffen===false,
   beiOffenerListe.nochOffen?'Liste blieb offen und zeigte den alten Namen':'geschlossen');
 p('der Kopf zeigt sofort den neuen Bediener', /Maja/.test(beiOffenerListe.kopf||''), beiOffenerListe.kopf);
 await pg.evaluate(()=>document.querySelectorAll("dialog[open]").forEach(d=>{try{d.close()}catch{}}));
 await scanne(pg,'KNG|Köcheclub Werne|KC-0005|m_kc_0005');

 // Bleibt er, wenn zwischendurch etwas anderes passiert?
 await scanne(pg,'02003');
 const bleibt=await pg.evaluate(()=>state.master.operatorName);
 p('der Bediener bleibt, solange sich kein anderer anmeldet', bleibt==='Bibi', bleibt);

 await scanne(pg,'KCOPE1:gibtesnicht');
 const nachUnbekannt=await pg.evaluate(()=>({bediener:state.master.operatorName,
   meldung:(document.getElementById("messageDialog")?.open?document.getElementById("messageDialog").innerText:'').replace(/\s+/g,' ')}));
 // Die Meldung muss WIRKLICH offen stehen: der Scanner schickt hinter dem Code ein Enter,
 // und genau dieses Enter hatte den Hinweis frueher sofort wieder weggeklickt.
 p('ein unbekannter Ausweis meldet das sichtbar und wechselt NICHT',
   nachUnbekannt.bediener==='Bibi'&&/nicht bekannt|unbekannt/i.test(nachUnbekannt.meldung),
   `${nachUnbekannt.bediener} · ${nachUnbekannt.meldung.slice(0,80)}`);
 await pg.evaluate(()=>document.querySelectorAll("dialog[open]").forEach(d=>{try{d.close()}catch{}}));

// ---- Falsch eingestellter Scanner: Grossbuchstaben und zerstoerte Sonderzeichen ----
 // Ein Handscanner ist eine Tastatur. Steht sein Tastaturlayout auf einer anderen Sprache als
 // das Tablet, kommen Ziffern richtig an, Sonderzeichen aber nicht - aus "|" wird ein anderes
 // Zeichen. Manche Scanner senden ausserdem alles in Grossbuchstaben, und Caps Lock am Tablet
 // tut dasselbe. Der Ausweis muss trotzdem funktionieren, sonst steht man Freitag da.
 console.log('\n== Weg 1b: falsch eingestellter Scanner ==');
 await scanne(pg,'KCOPE1:kc-0003');
 await scanne(pg,'KCOPE1:KC-0001');
 p('Bedienerausweis in GROSSBUCHSTABEN wird trotzdem erkannt',
   await pg.evaluate(()=>state.master.operatorName==='Maja'), await pg.evaluate(()=>state.master.operatorName));

 await scanne(pg,'KNG>Köcheclub Werne>KC-0005>m_kc_0005');
 p('Mitgliedsausweis mit zerstoertem Trennzeichen wird trotzdem erkannt',
   await pg.evaluate(()=>state.master.operatorName==='Bibi'), await pg.evaluate(()=>state.master.operatorName));

 await scanne(pg,'KCOPE1:kc-0003');
 await scanne(pg,'kng|köcheclub werne|kc-0005|m_kc_0005');
 p('Mitgliedsausweis komplett in Kleinbuchstaben wird trotzdem erkannt',
   await pg.evaluate(()=>state.master.operatorName==='Bibi'), await pg.evaluate(()=>state.master.operatorName));

 await pg.evaluate(()=>document.querySelectorAll("dialog[open]").forEach(d=>{try{d.close()}catch{}}));
 await scanne(pg,'QWERTZ+#-,.MUELL');
 const salat=await pg.evaluate(()=>({bediener:state.master.operatorName,
   meldung:(document.getElementById("messageDialog")?.open?document.getElementById("messageDialog").innerText:'').replace(/\s+/g,' ')}));
 p('unlesbarer Code nennt, was tatsaechlich angekommen ist',
   /Gelesen wurde/.test(salat.meldung)&&/QWERTZ/.test(salat.meldung), salat.meldung.slice(0,110));
 p('und weist auf das Tastaturlayout hin', /Tastaturlayout/.test(salat.meldung));
 p('dabei wechselt der Bediener NICHT', salat.bediener==='Bibi', salat.bediener);
 await pg.evaluate(()=>document.querySelectorAll("dialog[open]").forEach(d=>{try{d.close()}catch{}}));

 // =============================================================== WEG 2: Artikel
 console.log('\n== Weg 2: Artikel-Barcode scannen ==');
 await pg.evaluate(()=>{state.cart=[];renderCart()});
 await scanne(pg,'01001');
 const korb1=await pg.evaluate(()=>state.cart.map(x=>`${x.name} x${x.qty}`));
 p('ein gescannter Artikel liegt SOFORT im Warenkorb', korb1.length===1&&/Glühwein rot/.test(korb1[0]), JSON.stringify(korb1));

 await scanne(pg,'01001');
 const korb2=await pg.evaluate(()=>state.cart.map(x=>`${x.name} x${x.qty}`));
 p('zweimal derselbe Code erhoeht die Menge, statt eine zweite Zeile zu bauen',
   korb2.length===1&&/x2/.test(korb2[0]), JSON.stringify(korb2));

 await scanne(pg,'02003');
 const korb3=await pg.evaluate(()=>({zeilen:state.cart.map(x=>`${x.name} x${x.qty}`),summe:state.cart.length}));
 p('ein zweiter Artikel kommt als eigene Zeile dazu', korb3.summe===2, JSON.stringify(korb3.zeilen));

 const sichtbar=await pg.evaluate(()=>[...document.querySelectorAll('#cartList .cart-row')].map(r=>r.innerText.replace(/\s+/g,' ').slice(0,40)));
 p('die Zeilen stehen auch wirklich sichtbar im Warenkorb', sichtbar.length===2, JSON.stringify(sichtbar));

 const pfand=await pg.evaluate(()=>state.cart.find(x=>x.id==='grot')?.deposits?.map(d=>`${d.name} ${d.price}`)||[]);
 p('das Pfand haengt am gescannten Artikel wie beim Antippen', pfand.length===1&&/2/.test(pfand[0]), JSON.stringify(pfand));

 // =============================================================== WEG 3: Bezahlen
 console.log('\n== Weg 3: Bezahlcode auf der gruenen Taste ==');
 const vorher=await pg.evaluate(()=>({posten:state.cart.length,bon:state.master.nextBon}));
 await scanne(pg,'CMD-CHECKOUT');
 await pg.waitForTimeout(1200);
 const nachher=await pg.evaluate(()=>({posten:state.cart.length,bon:state.master.nextBon,
   gesamt:document.getElementById("grandTotal")?.innerText.trim()}));
 p('der Bezahlcode schliesst den Verkauf sofort ab', nachher.posten===0&&nachher.bon===vorher.bon+1,
   `${vorher.posten} Posten -> ${nachher.posten}, Bon ${vorher.bon} -> ${nachher.bon}`);
 p('die Gesamtanzeige steht danach wieder auf null', /^0[,.]00/.test((nachher.gesamt||'').replace(/[^\d,.]/g,'')), nachher.gesamt);

 const gebucht=await pg.evaluate(async()=>{const t=await (window.KCTransactionStore?.readAll?.()||readTransactions());
   const letzte=t[t.length-1];return letzte?{bediener:letzte.operator,posten:(letzte.items||[]).length,weg:letzte.method||letzte.payment}:null});
 p('der Verkauf ist mit dem angemeldeten Bediener gebucht', gebucht?.bediener==='Bibi', JSON.stringify(gebucht));

 const leer=await pg.evaluate(()=>{const b=state.master.nextBon;return {b}});
 await scanne(pg,'CMD-CHECKOUT');
 const nachLeer=await pg.evaluate(()=>state.master.nextBon);
 p('bei leerem Warenkorb bucht der Bezahlcode KEINEN Leerbon', nachLeer===leer.b, `Bon blieb ${nachLeer}`);

 // =============================================================== WEG 4: Zeiterfassung
 console.log('\n== Weg 4: Uhrknopf, dann Mitarbeitercode ==');
 await pg.evaluate(()=>document.querySelectorAll("dialog[open]").forEach(d=>{try{d.close()}catch{}}));
 const uhrAbWerk=await pg.evaluate(()=>{const b=document.getElementById("timeClockBtn");
   return {da:!!b, sichtbar:!!b&&!b.hidden&&b.getBoundingClientRect().width>0}});
 p('ohne freigegebene Zeiterfassung ist der Uhrknopf bewusst ausgeblendet',
   uhrAbWerk.da===true&&uhrAbWerk.sichtbar===false, JSON.stringify(uhrAbWerk));

 // Jetzt so, wie es Freitag sein muss: der PC-Manager hat Personen an die Kasse gesendet.
 await pg.evaluate(()=>{
   const kern=window.KCTimeClockCore;
   const personen=[{id:'TC-KC-0005',displayName:'Bibi',credential:'KC-0005',type:'member',active:true}].map(kern.normalizePerson);
   localStorage.setItem('kc_time_clock_people_v1',JSON.stringify(personen));
 });
 await pg.reload(); await pg.waitForTimeout(6500); await frei(pg);
 const uhr=await pg.evaluate(()=>{const b=document.getElementById("timeClockBtn");
   return !!b&&!b.hidden&&b.getBoundingClientRect().width>0});
 p('mit uebernommenen Personen erscheint der Uhrknopf oben im Kopf', uhr===true);
 if(uhr){
   await pg.click('#timeClockBtn'); await pg.waitForTimeout(700);
   const offen=await pg.evaluate(()=>({dialog:!!document.querySelector("#tcPosDialog[open], dialog[open]"),
     fokus:document.activeElement?.id||''}));
   p('der Uhrknopf oeffnet das Zeiterfassungsfenster', offen.dialog===true, JSON.stringify(offen));
   p('der Cursor steht im Ausweisfeld - der Scanner tippt dorthin', offen.fokus==='tcPosCredential', offen.fokus||'kein Fokus');
   // Der Scanner tippt in das Ausweisfeld, genau wie am Stand.
   await pg.keyboard.type('KNG|Köcheclub Werne|KC-0005|m_kc_0005',{delay:8});
   await pg.keyboard.press('Enter'); await pg.waitForTimeout(700);
   const schritt=await pg.evaluate(()=>({
     schritt2:document.getElementById("tcPosSchritt2")?.hidden===false,
     richtung:document.getElementById("tcPosRichtung")?.textContent||'',
     name:document.getElementById("tcPosPseudonym")?.textContent||'',
     meldung:document.getElementById("tcPosMeldung")?.textContent||''}));
   p('der gescannte Ausweis fuehrt zu Kommen/Gehen', schritt.schritt2===true,
     `${schritt.name} · ${schritt.richtung} · ${schritt.meldung}`.slice(0,90));
   p('die Richtung ist benannt (kommt oder geht)', /kommt|geht/.test(schritt.richtung), schritt.richtung);
 }
 await pg.evaluate(()=>document.querySelectorAll("dialog[open]").forEach(d=>{try{d.close()}catch{}}));

 // =============================================================== Neustart
 console.log('\n== Nach einem Neustart der Kasse ==');
 await pg.reload(); await pg.waitForTimeout(6500); await frei(pg);
 const nachNeustart=await pg.evaluate(()=>({bediener:state.master.operatorName,
   kopf:document.getElementById("operatorBtn")?.innerText.replace(/\s+/g,' ').trim()}));
 p('nach einem Neustart steht wieder "Team" da', nachNeustart.bediener==='Team',
   `${nachNeustart.bediener} / ${nachNeustart.kopf}`);

 p('keine Skriptfehler ueber den ganzen Lauf', fehler.length===0, fehler.slice(0,2).join(' | ')||'keine');
 await b.close(); s.close();
 console.log(`\nScanner-Wege: ${ok}/${ok+rot} bestanden`);
 process.exit(rot?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
