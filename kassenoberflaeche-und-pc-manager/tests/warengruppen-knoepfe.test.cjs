/* Warengruppen-Knoepfe: Symbol, Name, Anzahl - und vor allem LESBARKEIT.
   Wuensche vom Stand: Farben nicht so dunkel, Symbole groesser und erkennbar, Anzahl ganz
   rechts aussen und schmal. Geprueft wird in BEIDEN Ansichten (Standard und kc-layout-neu),
   weil frueher immer nur eine von beiden verbessert wurde. */
try{require.resolve('playwright')}catch(e){console.log('  ueberspringen: Playwright nicht installiert');process.exit(0)}
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');

const WURZEL=path.join(__dirname,'..');
const TYPEN={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  const p=path.join(WURZEL,decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p,(err,daten)=>{
    if(err){res.writeHead(404);return res.end('weg')}
    res.writeHead(200,{'Content-Type':TYPEN[path.extname(p)]||'application/octet-stream'});
    res.end(daten);
  });
});
let fehler=0;
const pruefe=(name,bedingung,zusatz='')=>{console.log(`${bedingung?'  OK  ':'FEHLER'}  ${name}${zusatz?'  ['+zusatz+']':''}`);if(!bedingung)fehler++};

(async()=>{
  await new Promise(r=>server.listen(8476,r));
  const browser=await chromium.launch();
  const p=await browser.newPage({viewport:{width:1900,height:1030}});
  p.on('pageerror',e=>console.log('PAGEERROR:',e.message));
  await p.addInitScript(()=>localStorage.setItem('kc_master_v040',JSON.stringify({registerId:'KASSE-01',pinLockEnabled:false})));
  // WICHTIG (beim TÜV-Lauf aufgefallen): ohne diese Zeile war der Test ZEITABHÄNGIG.
  // Zwischen 17 und 18 Uhr laeuft die Happy-Hour-Beispielaktion; dann erscheint eine
  // zusaetzliche Warengruppe und die Preise sind 10 % niedriger - der Test wurde rot,
  // obwohl das Programm richtig arbeitete. Aktionen werden deshalb ausgeschaltet.
  await p.addInitScript(()=>localStorage.setItem('kc_offers_v100','[]'));
  await p.goto('http://127.0.0.1:8476/pos/index.html');
  await p.waitForTimeout(1600);
  await p.evaluate(()=>{const k=[...document.querySelectorAll('button')].find(x=>/KASSE STARTEN/i.test(x.textContent));if(k)k.click()});
  await p.waitForTimeout(900);

  for (const ansicht of ['neu','standard']) {
    if(ansicht==='standard')await p.evaluate(()=>document.body.classList.remove('kc-layout-neu'));
    await p.waitForTimeout(500);
    const daten=await p.evaluate(()=>{
      // Helligkeit nach derselben Gewichtung wie im Programm.
      const hell=(farbe)=>{const t=farbe.match(/\d+/g);return t?0.299*t[0]+0.587*t[1]+0.114*t[2]:null};
      return [...document.querySelectorAll('#categories button')].map(n=>{
        const st=getComputedStyle(n),r=n.getBoundingClientRect();
        const bild=n.querySelector('.kategorie-bild'),name=n.querySelector('.kategorie-name'),zahl=n.querySelector('.category-count');
        const zr=zahl?zahl.getBoundingClientRect():null;
        const kinder=[...n.children].map(x=>x.className);
        return {gruppe:n.dataset.cat,aktiv:n.classList.contains('active'),
                svg:!!bild,symbolBreite:bild?Math.round(bild.getBoundingClientRect().width):0,
                emoji:/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(n.textContent||''),
                name:name?name.textContent:null,
                zahlIstLetztes:kinder[kinder.length-1]==='category-count',
                zahlBreite:zr?Math.round(zr.width):0,
                zahlAbstandRechts:zr?Math.round(r.right-zr.right):null,
                helligkeitFlaeche:hell(st.backgroundColor),helligkeitSchrift:hell(st.color)};
      });
    });
    pruefe(`${ansicht}: alle Gruppen haben ein gezeichnetes Symbol`,daten.every(d=>d.svg),`${daten.filter(d=>d.svg).length}/${daten.length}`);
    pruefe(`${ansicht}: kein Emoji mehr im Knopf`,daten.every(d=>!d.emoji));
    pruefe(`${ansicht}: Symbol ist deutlich groesser als vorher (>=28px)`,daten.every(d=>d.symbolBreite>=28),`kleinstes ${Math.min(...daten.map(d=>d.symbolBreite))}px`);
    pruefe(`${ansicht}: der Gruppenname steht auf dem Knopf`,daten.every(d=>d.name&&d.name===d.gruppe));
    pruefe(`${ansicht}: die Anzahl ist das letzte Element (ganz rechts)`,daten.every(d=>d.zahlIstLetztes));
    pruefe(`${ansicht}: die Anzahl bleibt schmal (<=34px)`,daten.every(d=>d.zahlBreite<=34),`breiteste ${Math.max(...daten.map(d=>d.zahlBreite))}px`);
    // Der eigentliche Punkt: Symbol und Schrift muessen sich von der Flaeche abheben.
    const kontrast=daten.map(d=>Math.abs(d.helligkeitFlaeche-d.helligkeitSchrift));
    pruefe(`${ansicht}: Schrift/Symbol heben sich klar von der Fläche ab`,kontrast.every(k=>k>=90),`geringster Abstand ${Math.round(Math.min(...kontrast))}`);
    // Nicht ausgewaehlte Gruppen sollen hell sein, die ausgewaehlte darf kraeftig bleiben.
    const ruhend=daten.filter(d=>!d.aktiv);
    pruefe(`${ansicht}: nicht gewählte Gruppen sind hell`,ruhend.every(d=>d.helligkeitFlaeche>150),`dunkelste ${Math.round(Math.min(...ruhend.map(d=>d.helligkeitFlaeche)))}`);
  }

  // --- Artikelkacheln: Rand in der Warengruppenfarbe, Balken deckt NICHT den Grossteil ---
  // Wunsch vom Stand: der dunkle Balken darf nicht den Grossteil des Artikels bedecken.
  const kacheln=await p.evaluate(()=>{
    const gruppe=getComputedStyle(document.querySelector('#categories button.active')).getPropertyValue('--group-color').trim();
    return [...document.querySelectorAll('.product-tile')].slice(0,6).map(n=>{
      const st=getComputedStyle(n),nach=getComputedStyle(n,'::after'),r=n.getBoundingClientRect();
      const rand=st.getPropertyValue('--gruppen-rand').trim();
      const oben=parseFloat(nach.top)||0;
      return {randBreite:parseFloat(st.borderTopWidth),randFarbe:rand,gruppenFarbe:gruppe,
              anteilVerdeckt:Math.round((1-oben/r.height)*100),hoehe:Math.round(r.height)};
    });
  });
  pruefe('Kacheln haben einen sichtbaren Rand',kacheln.every(k=>k.randBreite>=3),`schmalster ${Math.min(...kacheln.map(k=>k.randBreite))}px`);
  pruefe('Der Rand trägt die Warengruppenfarbe',kacheln.every(k=>k.randFarbe&&k.randFarbe===k.gruppenFarbe),`${kacheln[0].randFarbe} / Gruppe ${kacheln[0].gruppenFarbe}`);
  pruefe('Der dunkle Balken bedeckt weniger als die Hälfte der Kachel',kacheln.every(k=>k.anteilVerdeckt<50),`größter Anteil ${Math.max(...kacheln.map(k=>k.anteilVerdeckt))}%`);

  await browser.close();
  server.close();
  console.log(fehler?`\n${fehler} FEHLER`:'\nAlles grün.');
  process.exit(fehler?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
