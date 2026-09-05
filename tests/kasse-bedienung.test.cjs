/* Zwei Beanstandungen vom Stand, echt nachgeprueft:
   (2) Beim Rueckgeld muss der normale BAR-Knopf neben "STIMMT SO" stehen - und beim normalen
       Kassieren ohne Geldeingabe darf sich an der Zeile nichts aendern.
   (3) Das Startfenster darf die Kasse nicht sperren, wenn sie einsatzfaehig ist. */
try{require.resolve('playwright')}catch(e){console.log('  ueberspringen: Playwright nicht installiert');process.exit(0)}
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const WURZEL=path.join(__dirname,'..');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const s=http.createServer((q,r)=>{const p=path.join(WURZEL,decodeURIComponent(q.url.split('?')[0]));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end('x')}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(d)})});
let fehler=0;const pruefe=(n,b,z='')=>{console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'  ['+z+']':''}`);if(!b)fehler++};
(async()=>{await new Promise(r=>s.listen(8475,r));const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1280,height:800}});
p.on('pageerror',e=>console.log('PAGEERROR:',e.message));
await p.addInitScript(()=>localStorage.setItem('kc_master_v040',JSON.stringify({registerId:'KASSE-01',pinLockEnabled:false})));
// WICHTIG (beim TÜV-Lauf aufgefallen): ohne diese Zeile war der Test ZEITABHÄNGIG.
// Zwischen 17 und 18 Uhr laeuft die Happy-Hour-Beispielaktion; dann erscheint eine
// zusaetzliche Warengruppe und die Preise sind 10 % niedriger - der Test wurde rot,
// obwohl das Programm richtig arbeitete. Aktionen werden deshalb ausgeschaltet.
await p.addInitScript(()=>localStorage.setItem('kc_offers_v100','[]'));
await p.goto('http://127.0.0.1:8475/pos/index.html');await p.waitForTimeout(1400);
await p.evaluate(()=>{const k=[...document.querySelectorAll('button')].find(x=>/KASSE STARTEN/i.test(x.textContent));if(k)k.click()});
await p.waitForTimeout(1500);

// --- Startfenster darf nicht sperren, wenn die Kasse einsatzfaehig ist ---
const start=await p.evaluate(()=>{
  const o=[...document.querySelectorAll('div')].find(d=>d.dataset&&d.dataset.kcSperrend!==undefined);
  if(!o)return {da:false};
  const st=getComputedStyle(o);
  return {da:true,sperrend:o.dataset.kcSperrend==='1',zeiger:st.pointerEvents,inset:st.inset,hintergrund:st.backgroundColor};
});
pruefe('Startfenster ist da',start.da);
pruefe('Startfenster sperrt NICHT (Kasse ist einsatzfähig)',start.da&&!start.sperrend&&start.zeiger==='none',JSON.stringify(start));
// Ist die Kasse dahinter wirklich bedienbar?
const klickbar=await p.evaluate(()=>{const t=document.querySelector('.product-tile');if(!t)return null;const r=t.getBoundingClientRect();
  const oben=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return oben?oben.closest('.product-tile')!==null:false});
pruefe('Artikelkachel ist trotz Startfenster anklickbar',klickbar===true);
await p.waitForTimeout(6200);
const weg=await p.evaluate(()=>![...document.querySelectorAll('div')].some(d=>d.dataset&&d.dataset.kcSperrend!==undefined));
pruefe('Startfenster schließt sich von selbst',weg);

// --- BAR-Knopf im Rueckgeldfall ---
await p.evaluate(()=>{document.querySelector('.product-tile')?.click()});
await p.waitForTimeout(300);
// WICHTIG: hier wird die TATSAECHLICHE Sichtbarkeit gemessen, nicht das hidden-Attribut.
// Genau daran ist die erste Fassung vorbeigelaufen: display:flex ueberstimmte [hidden], der
// Knopf stand mit altem Betrag auf dem Schirm, und der Test war trotzdem gruen.
const ohneGeld=await p.evaluate(()=>{const n=document.getElementById('cashChangeBtn');const r=n.getBoundingClientRect();
  return {attribut:n.hidden,wirklichSichtbar:getComputedStyle(n).display!=='none'&&r.height>0,zeile:document.getElementById('cashFinishRow').className}});
pruefe('Ohne Geldeingabe ist der BAR-Knopf WIRKLICH unsichtbar',ohneGeld.attribut===true&&ohneGeld.wirklichSichtbar===false&&!/mit-rueckgeld/.test(ohneGeld.zeile),JSON.stringify(ohneGeld));
await p.evaluate(()=>{const z=[...document.querySelectorAll('#banknotes button')].find(x=>/10/.test(x.getAttribute('data-value')||x.textContent));if(z)z.click()});
await p.waitForTimeout(400);
const mitGeld=await p.evaluate(()=>{
  const n=document.getElementById('cashChangeBtn'),r=n.getBoundingClientRect(),e=document.getElementById('exactCashBtn').getBoundingClientRect();
  return {sichtbar:!n.hidden&&r.width>0,text:n.innerText.replace(/\n/g,' · '),breite:Math.round(r.width),hoehe:Math.round(r.height),
          exactHoehe:Math.round(e.height),gleicheHoehe:Math.abs(r.height-e.height)<2,
          nebeneinander:Math.abs(r.top-e.top)<3};
});
pruefe('BAR-Knopf erscheint beim Rückgeld',mitGeld.sichtbar,mitGeld.text);
pruefe('BAR-Knopf steht neben "STIMMT SO", gleiche Höhe',mitGeld.nebeneinander&&mitGeld.gleicheHoehe,`${mitGeld.hoehe}px vs ${mitGeld.exactHoehe}px`);
// Das Rueckgeld wird AUSGERECHNET, nicht eingetippt.
// GRUND (03.09.2026): Hier stand fest "2,50" - richtig, solange der Gluehwein 5,50 kostete.
// Nach der Preiskorrektur waren es 4,50, und der Test meldete einen Fehler, obwohl die Kasse
// richtig gerechnet hatte. Ein Test, der einen Preis ein zweites Mal festhaelt, veraltet mit
// dem ersten Preisbeschluss des Vereins.
const erwartetesRueckgeld=await p.evaluate(()=>{
  const summe=parseFloat(String(document.getElementById('grandTotal').innerText).replace(/[^0-9,]/g,'').replace(',','.'));
  return (10-summe).toFixed(2).replace('.',',');
});
pruefe(`Rückgeldbetrag steht auf dem Knopf (${erwartetesRueckgeld} € bei 10,00 € gegeben)`,
  mitGeld.text.includes(erwartetesRueckgeld),mitGeld.text);
await p.screenshot({path:'/tmp/kc-kasse-rueckgeld.png'});
// Abschluss ueber den neuen Knopf muss echt buchen
// Die Bons liegen in der IndexedDB, nicht im localStorage - geprueft wird deshalb am
// sichtbaren Ergebnis: Abschlussmeldung und geleerter Bon.
await p.evaluate(()=>document.getElementById('cashChangeBtn').click());
await p.waitForTimeout(1500);
const zwischen=await p.evaluate(()=>{
  const d=document.querySelector('dialog[open]');
  return {dialog:d?d.id+' :: '+d.innerText.replace(/\n/g,' | ').slice(0,120):null,
          wagen:document.getElementById('cartList').children.length,
          gesamt:document.getElementById('grandTotal').textContent};
});
console.log('      nach Klick:',JSON.stringify(zwischen));
pruefe('Neuer BAR-Knopf schließt den Bon wirklich ab',/Verkauf abgeschlossen/.test(zwischen.dialog||'')&&/^0,00/.test((zwischen.gesamt||'').trim()),zwischen.dialog||'keine Meldung');
// --- Stoßzeiten: die Warengruppen duerfen nicht zusammengedrueckt werden --------------
// Der Fehler trat NUR auf, wenn die Modus-Zeile eingeblendet ist (Stoßzeiten/Training) und
// die Zeilen der Verkaufsflaeche nach Position vergeben wurden - deshalb wird hier beides
// gemessen: mit und ohne das neue Layout-Modul.
for (const modul of [true,false]) {
  await p.goto('http://127.0.0.1:8475/pos/index.html');
  await p.waitForTimeout(1400);
  await p.evaluate(()=>{const k=[...document.querySelectorAll('button')].find(x=>/KASSE STARTEN/i.test(x.textContent));if(k)k.click()});
  await p.waitForTimeout(800);
  if(!modul)await p.evaluate(()=>document.body.classList.remove('kc-layout-neu'));
  await p.evaluate(()=>{const k=[...document.querySelectorAll('button')].find(x=>/Stoßzeiten/i.test(x.textContent));if(k)k.click()});
  await p.waitForTimeout(800);
  const m=await p.evaluate(()=>{
    const tabs=document.getElementById('categories'),grid=document.getElementById('productGrid');
    const t=tabs.getBoundingClientRect(),g=grid.getBoundingClientRect();
    const ersterKnopf=tabs.querySelector('button');
    const kb=ersterKnopf?ersterKnopf.getBoundingClientRect():null;
    return {stoss:document.body.classList.contains('rush-mode'),tabsHoehe:Math.round(t.height),
            knopfHoehe:kb?Math.round(kb.height):0,knopfUnten:kb?Math.round(kb.bottom):0,gridOben:Math.round(g.top)};
  });
  pruefe(`Stoßzeiten aktiv (${modul?'mit':'ohne'} neues Layout)`,m.stoss);
  pruefe(`Warengruppen behalten ihre Höhe (${modul?'mit':'ohne'} neues Layout)`,m.tabsHoehe>=m.knopfHoehe&&m.knopfHoehe>20,`Zeile ${m.tabsHoehe}px, Knopf ${m.knopfHoehe}px`);
  pruefe(`Artikelfläche liegt UNTER den Warengruppen (${modul?'mit':'ohne'} neues Layout)`,m.gridOben>=m.knopfUnten-1,`Knopf bis ${m.knopfUnten}, Fläche ab ${m.gridOben}`);
}

// --- Kopfzeile: gleiche Knopfgroesse, LEDs in EINER Reihe -----------------------------
// Gilt fuer die Standardansicht (ohne kc-layout-neu) - dort hatte der Spiegeln-Knopf eine
// andere Groesse und stand ganz vorne, und die vier LEDs bildeten einen 2x2-Block.
await p.goto('http://127.0.0.1:8475/pos/index.html');
await p.waitForTimeout(1400);
await p.evaluate(()=>{const k=[...document.querySelectorAll('button')].find(x=>/KASSE STARTEN/i.test(x.textContent));if(k)k.click()});
await p.waitForTimeout(800);
await p.evaluate(()=>document.body.classList.remove('kc-layout-neu'));
await p.waitForTimeout(500);
const kopf=await p.evaluate(()=>{
  const knopf=id=>{const n=document.getElementById(id);if(!n)return null;const r=n.getBoundingClientRect();
    return {b:Math.round(r.width),h:Math.round(r.height),x:Math.round(r.left)}};
  const punkte=[...document.querySelectorAll('.supabase-led,.kc-sync-led')]
    .map(n=>Math.round(n.getBoundingClientRect().top));
  return {spiegeln:knopf('mirrorLayoutBtn'),menue:knopf('menuBtn'),ausgang:knopf('headerExitBtn'),
          sperre:knopf('screenLockBtn'),reihen:[...new Set(punkte)],anzahlLeds:punkte.length};
});
pruefe('Spiegeln-Knopf ist so groß wie die anderen',kopf.spiegeln&&kopf.spiegeln.b===kopf.sperre.b&&kopf.spiegeln.h===kopf.sperre.h,
  `${kopf.spiegeln?kopf.spiegeln.b+'x'+kopf.spiegeln.h:'?'} vs ${kopf.sperre.b}x${kopf.sperre.h}`);
pruefe('Spiegeln-Knopf steht zwischen Menü und Programm verlassen',
  kopf.spiegeln.x>kopf.menue.x&&kopf.spiegeln.x<kopf.ausgang.x,
  `Menü ${kopf.menue.x} < Spiegeln ${kopf.spiegeln.x} < Ausgang ${kopf.ausgang.x}`);
pruefe('Alle LEDs liegen in EINER Reihe',kopf.reihen.length===1,`${kopf.anzahlLeds} LEDs auf ${kopf.reihen.length} Höhe(n)`);

await b.close();s.close();
console.log(fehler?`\n${fehler} FEHLER`:'\nAlles grün.');
process.exit(fehler?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
