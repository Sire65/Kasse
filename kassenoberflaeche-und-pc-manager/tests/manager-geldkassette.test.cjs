/* Geldkassette im PC-Manager: sie muss GENAU dasselbe tun wie im Money Butler.
   Hintergrund (User): faellt der Kassenwart aus, uebernimmt der PC-Manager die Aufgabe.
   Geprueft wird deshalb nicht nur "es geht", sondern dass beide Seiten denselben Bereich
   zeigen und denselben Code erzeugen - und dass eine echte Kasse ihn annimmt. */
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
const heute=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
let fehler=0;
const pruefe=(name,bedingung,zusatz='')=>{console.log(`${bedingung?'  OK  ':'FEHLER'}  ${name}${zusatz?'  ['+zusatz+']':''}`);if(!bedingung)fehler++};

(async()=>{
  await new Promise(r=>server.listen(8474,r));
  const browser=await chromium.launch();

  const pm=await browser.newPage({viewport:{width:1250,height:1100}});
  pm.on('pageerror',e=>console.log('PM PAGEERROR:',e.message));
  await pm.goto('http://127.0.0.1:8474/pc-manager/index.html');
  await pm.waitForTimeout(1200);

  // Der Manager liegt hinter der Anmeldung; fuer den Test wird der Bargeldbereich sichtbar
  // gemacht. Geprueft wird die Kassette, nicht die Anmeldung (die hat eigene Tests).
  await pm.evaluate(()=>{
    const ziel=document.getElementById('cashKassetteSection');
    for(let n=ziel;n&&n!==document.body;n=n.parentElement){n.hidden=false;n.classList.remove('hidden');n.style.setProperty('display','block','important');}
  });

  const zielOption=await pm.evaluate(()=>!![...document.getElementById('cashRegister').options].find(o=>o.value==='KASSETTE'));
  pruefe('Kassetten-Ziel steht im PC-Manager zur Auswahl',zielOption);

  const stand=await pm.evaluate(t=>{
    document.getElementById('cashRegister').value='KASSETTE';
    document.getElementById('cashEffectiveDate').value=t;
    const setze=(wahl,menge)=>{const n=document.querySelector(wahl);if(n){n.value=String(menge);n.dispatchEvent(new Event('input',{bubbles:true}))}};
    setze('[data-denom="50"]',4); setze('[data-denom="20"]',6); setze('[data-denom="2"]',10);
    const rolle=document.querySelector('[data-cash-roll-value="1"]');
    if(rolle){rolle.value='2';rolle.dispatchEvent(new Event('input',{bubbles:true}));}
    document.getElementById('cashRegister').dispatchEvent(new Event('change',{bubbles:true}));
    return {zeilen:document.querySelectorAll('#cashKassetteAufteilung .kckass-zeile').length,
            bereichSichtbar:!document.getElementById('cashKassetteSection').hidden};
  },heute());
  pruefe('Aufteilungsbereich erscheint bei Ziel Geldkassette',stand.bereichSichtbar);
  pruefe('Aufteilungsliste zeigt dieselben Zeilen wie im Money Butler (.kckass-zeile)',stand.zeilen===4,`${stand.zeilen} Zeilen`);

  // Bewusst ungleich aufteilen und den Code ueber die echte Manager-Funktion bauen.
  const ergebnis=await pm.evaluate(()=>{
    const erstes=document.querySelector('#cashKassetteAufteilung [data-kckass-wert="50"]');
    erstes.value='4';erstes.dispatchEvent(new Event('input',{bubbles:true}));
    const {payload,teile,fehler}=baueCashTransferPayload();
    if(fehler)return {fehler};
    return {code:'KCASH1:'+btoa(unescape(encodeURIComponent(JSON.stringify(payload)))),
            version:payload.version,scope:payload.scope,ersteKasse:payload.split&&payload.split.ersteKasse,
            registerIds:payload.registerIds,total:payload.total,
            anteile:teile?{a:teile['KASSE-01'].total,b:teile['KASSE-02'].total}:null};
  });
  pruefe('Manager baut einen Kassetten-Code',!ergebnis.fehler,ergebnis.fehler||'');
  pruefe('Code ist Version 5 mit scope "split"',ergebnis.version===5&&ergebnis.scope==='split');
  pruefe('Beide Kassen stehen im Code',JSON.stringify(ergebnis.registerIds)==='["KASSE-01","KASSE-02"]');
  pruefe('Nur der Anteil der ersten Kasse ist im Code',ergebnis.ersteKasse==='KASSE-01');
  pruefe('Anteile ergeben den Kassettenbetrag',ergebnis.anteile&&Math.abs(ergebnis.anteile.a+ergebnis.anteile.b-ergebnis.total)<0.005,
    ergebnis.anteile?`${ergebnis.anteile.a} + ${ergebnis.anteile.b} = ${ergebnis.total}`:'');
  await pm.close();

  // Der Code aus dem MANAGER muss an den echten Kassen genauso funktionieren.
  async function kasseLiest(registerId){
    const seite=await browser.newPage({viewport:{width:1200,height:900}});
    await seite.addInitScript(id=>localStorage.setItem('kc_master_v040',JSON.stringify({registerId:id,pinLockEnabled:false})),registerId);
    await seite.goto('http://127.0.0.1:8474/pos/index.html');
    await seite.waitForTimeout(900);
    const raus=await seite.evaluate(text=>{
      try{const p=applyCashPayload(text,'test-manager');return{ok:true,total:p.total,registerId:p.registerId}}
      catch(e){return{ok:false,fehler:e.message}}
    },ergebnis.code);
    await seite.close();
    return raus;
  }
  const k1=await kasseLiest('KASSE-01'),k2=await kasseLiest('KASSE-02');
  pruefe('Kasse 1 nimmt den Manager-Code an',k1.ok,k1.fehler||'');
  pruefe('Kasse 1 bucht ihren Anteil',Math.abs(k1.total-ergebnis.anteile.a)<0.005,`${k1.total} statt ${ergebnis.anteile.a}`);
  pruefe('Kasse 2 nimmt denselben Code an',k2.ok,k2.fehler||'');
  pruefe('Kasse 2 bucht ihren Anteil',Math.abs(k2.total-ergebnis.anteile.b)<0.005,`${k2.total} statt ${ergebnis.anteile.b}`);
  pruefe('Zusammen der Kassettenbetrag, nichts doppelt',Math.abs(k1.total+k2.total-ergebnis.total)<0.005);

  await browser.close();
  server.close();
  console.log(fehler?`\n${fehler} FEHLER`:'\nAlles grün.');
  process.exit(fehler?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
