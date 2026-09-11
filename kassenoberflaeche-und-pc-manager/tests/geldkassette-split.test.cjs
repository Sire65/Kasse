/* Echter End-zu-Ende-Test der Geldkassette:
   Money Butler erfasst EINE Kassette, teilt sie auf, und BEIDE echten Kassenseiten
   lesen denselben Code ein - jede darf nur ihren eigenen Anteil bekommen. */
/* Regressionstest Geldkassette (Money Butler -> beide Kassen).
   Braucht Playwright. Ist es nicht installiert, wird der Test uebersprungen statt rot zu werden. */
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
function pruefe(name,bedingung,zusatz=''){
  console.log(`${bedingung?'  OK  ':'FEHLER'}  ${name}${zusatz?'  ['+zusatz+']':''}`);
  if(!bedingung)fehler++;
}

(async()=>{
  await new Promise(r=>server.listen(8471,r));
  const browser=await chromium.launch();

  // --- 1. Money Butler: Kassetteninhalt erfassen und aufteilen ---------------------------
  const mb=await browser.newPage({viewport:{width:1280,height:1400}});
  await mb.goto('http://127.0.0.1:8471/money-butler/index.html');
  await mb.selectOption('#register','KASSETTE');
  await mb.fill('#effectiveDate',heute());
  // 2x 50, 4x 20, 6x 10, 5x 2 EUR lose + 2 Rollen 1 EUR + 3 Rollen 20 ct
  const lose={'50':2,'20':4,'10':6,'2':5};
  for(const [wert,anzahl] of Object.entries(lose))await mb.fill(`[data-value="${wert}"]`,String(anzahl));
  await mb.click('[data-money-section="rolls"] .section-lock');
  await mb.fill('[data-roll-value="1"]','2');
  await mb.fill('[data-roll-value="0.2"]','3');
  await mb.waitForTimeout(200);

  const gesamtErwartet=2*50+4*20+6*10+5*2+2*(1*25)+3*(0.2*40);
  const gesamtAngezeigt=await mb.textContent('#total');
  pruefe('Kassettenbetrag stimmt',gesamtAngezeigt.includes('324,00'),`${gesamtAngezeigt} / erwartet ${gesamtErwartet}`);

  const zeilen=await mb.locator('.kckass-zeile').count();
  pruefe('Aufteilungsliste zeigt alle 6 Sorten',zeilen===6,`${zeilen} Zeilen`);
  await mb.screenshot({path:'/tmp/kc-kassette-bild-1-aufteilung-vorschlag.png',fullPage:true});

  // Bewusst ungleich aufteilen: die 50er komplett an Kasse 1
  await mb.fill('.kckass-zeile[data-wert="50"] input','2');
  await mb.waitForTimeout(150);
  const anteil1=await mb.textContent('[data-kckass-summe="1"]'),anteil2=await mb.textContent('[data-kckass-summe="2"]');
  console.log(`      Anteil Kasse 1: ${anteil1}   Anteil Kasse 2: ${anteil2}`);
  await mb.screenshot({path:'/tmp/kc-kassette-bild-2-aufteilung-ungleich.png',fullPage:true});

  await mb.click('#generate');
  await mb.waitForTimeout(300);
  const code=await mb.inputValue('#payload');
  const kurzcode=await mb.textContent('#kurzcode');
  const ziel=await mb.textContent('#handoverRegister');
  pruefe('Code wurde erzeugt',code.startsWith('KCASH1:'));
  pruefe('Zwei Kurzcodes (je Kasse einer)',/Kasse 1:.*Kasse 2:/.test(kurzcode),kurzcode);
  console.log(`      Ziel-Anzeige: ${ziel}`);
  await mb.screenshot({path:'/tmp/kc-kassette-bild-3-uebergabe.png',fullPage:true});

  const nutzlast=JSON.parse(Buffer.from(code.slice(7),'base64').toString('utf8'));
  pruefe('Payload trägt scope "split"',nutzlast.scope==='split');
  pruefe('Payload trägt beide Kassen',JSON.stringify(nutzlast.registerIds)==='["KASSE-01","KASSE-02"]');
  pruefe('Payload trägt nur den Anteil der ersten Kasse (Platzgründe)',!!nutzlast.split&&nutzlast.split.ersteKasse==='KASSE-01'&&nutzlast.shares===undefined);
  pruefe('Code passt in den QR-Code',code.length<2300,`${code.length} Zeichen`);
  // Massgeblich ist, was der Money Butler dem Kassenwart ANGEZEIGT hat.
  const zahl=t=>Number(String(t).replace(/[^0-9,]/g,'').replace(',','.'));
  const s1=zahl(anteil1),s2=zahl(anteil2);
  pruefe('Angezeigte Anteile ergeben den Kassettenbetrag',Math.abs(s1+s2-nutzlast.total)<0.005,`${s1} + ${s2} = ${nutzlast.total}`);

  // --- 2. Echte Kassenseite, beide Kassen lesen DENSELBEN Code -------------------------
  async function kasseLiest(registerId){
    const seite=await browser.newPage({viewport:{width:1280,height:900}});
    await seite.addInitScript(id=>{
      localStorage.setItem('kc_master_v040',JSON.stringify({registerId:id,pinLockEnabled:false}));
    },registerId);
    await seite.goto('http://127.0.0.1:8471/pos/index.html');
    await seite.waitForTimeout(900);
    const ergebnis=await seite.evaluate(text=>{
      const raus={};
      try{const p=applyCashPayload(text,'test-kassette');raus.ok=true;raus.total=p.total;raus.registerId=p.registerId;raus.transferId=p.transferId;raus.kassetteTotal=p.kassetteTotal}
      catch(e){raus.ok=false;raus.fehler=e.message}
      // zweiter Versuch mit demselben Code muss abgewiesen werden
      try{applyCashPayload(text,'test-kassette');raus.zweitesMal='angenommen'}
      catch(e){raus.zweitesMal=e.message}
      raus.bewegungen=JSON.parse(localStorage.getItem('kc_cash_movements')||'[]')
        .map(m=>({registerId:m.registerId,total:m.total,scope:m.scope,poolId:m.poolId}));
      return raus;
    },code);
    await seite.close();
    return ergebnis;
  }

  const k1=await kasseLiest('KASSE-01');
  const k2=await kasseLiest('KASSE-02');
  const k3=await kasseLiest('KASSE-03');

  pruefe('Kasse 1 nimmt an',k1.ok===true,k1.fehler||'');
  pruefe('Kasse 1 bucht GENAU den angezeigten Anteil',Math.abs(k1.total-s1)<0.005,`gebucht ${k1.total}, angezeigt ${s1}`);
  pruefe('Kasse 1 bucht auf die eigene Kassen-ID',k1.registerId==='KASSE-01');
  pruefe('Kasse 1 merkt sich den Kassettenbetrag',Math.abs(k1.kassetteTotal-nutzlast.total)<0.005);
  pruefe('Kasse 1 weist denselben Code beim zweiten Mal ab',/bereits|Anfangsbestand übernommen/.test(k1.zweitesMal||''),k1.zweitesMal);
  pruefe('Kasse 1 hat genau eine Bewegung',k1.bewegungen.length===1,JSON.stringify(k1.bewegungen));

  pruefe('Kasse 2 nimmt denselben Code an',k2.ok===true,k2.fehler||'');
  pruefe('Kasse 2 bucht GENAU den angezeigten Anteil',Math.abs(k2.total-s2)<0.005,`gebucht ${k2.total}, angezeigt ${s2}`);
  pruefe('Kasse 2 bucht auf die eigene Kassen-ID',k2.registerId==='KASSE-02');
  pruefe('Kasse 2 weist denselben Code beim zweiten Mal ab',/bereits|Anfangsbestand übernommen/.test(k2.zweitesMal||''),k2.zweitesMal);

  pruefe('Zusammen gebucht = Kassettenbetrag, nichts doppelt',Math.abs((k1.total+k2.total)-nutzlast.total)<0.005,`${k1.total} + ${k2.total} = ${nutzlast.total}`);
  pruefe('Fremde Kasse (KASSE-03) wird abgewiesen',k3.ok===false&&/keinen Anteil/.test(k3.fehler||''),k3.fehler);


  // --- 2b. Warnungen: nur im Abschluss, nie auf der Verkaufsoberflaeche -----------------
  async function abschlussHinweis(kasse,codeEinlesen){
    const seite=await browser.newPage({viewport:{width:1000,height:900}});
    await seite.addInitScript(id=>localStorage.setItem('kc_master_v040',JSON.stringify({registerId:id,registerName:id==='KASSE-01'?'Kasse 1':'Kasse 2',pinLockEnabled:false})),kasse);
    await seite.goto('http://127.0.0.1:8471/pos/index.html');
    await seite.waitForTimeout(900);
    if(codeEinlesen)await seite.evaluate(t=>applyCashPayload(t,'test'),codeEinlesen);
    // Waehrend des Betriebs darf nichts zu sehen sein - erst im Abschlussfenster.
    const vorherSichtbar=await seite.locator('#closingOpeningHint').isVisible();
    await seite.evaluate(()=>openClosingDialog());
    await seite.waitForTimeout(250);
    const sichtbar=await seite.locator('#closingOpeningHint').isVisible();
    const klasse=await seite.getAttribute('#closingOpeningHint','class');
    const text=sichtbar?(await seite.textContent('#closingOpeningHint')).trim():'';
    await seite.close();
    return {vorherSichtbar,sichtbar,klasse,text};
  }
  const ohne=await abschlussHinweis('KASSE-02',null);
  pruefe('Auf der Verkaufsoberflaeche ist KEIN Hinweis zu sehen',ohne.vorherSichtbar===false);
  pruefe('Fehlender Anfangsbestand wird im Abschluss gemeldet',ohne.sichtbar&&/closing-hinweis-offen/.test(ohne.klasse||''),ohne.text.slice(0,70));
  const mit=await abschlussHinweis('KASSE-01',code);
  pruefe('Kassetten-Anteil wird im Abschluss ausgewiesen',mit.sichtbar&&/closing-hinweis-info/.test(mit.klasse||''),mit.text.slice(0,70));
  pruefe('Butler warnt sichtbar vor dem Einlesen an nur einer Kasse',await mb.locator('#kassetteHinweis').isVisible());


  // --- 2c. QR-Codes muessen scharf gerastert sein ---------------------------------------
  // Ohne Zusatzpaket geprueft: die Bildgroesse muss ein ganzzahliges Vielfaches der Modulzahl
  // sein und je Modul mindestens 4 Pixel haben. Genau daran ist die alte Fassung gescheitert -
  // der Code sah aus wie ein QR-Code, war aber nicht mehr einlesbar.
  const raster=await mb.evaluate(()=>{
    const messen=(canvasId,text)=>{
      const c=document.getElementById(canvasId);
      const qr=qrcode(0,'M');qr.addData(text);qr.make();
      const gesamt=qr.getModuleCount()+8;
      return {breite:c.width,gesamt,zelle:c.width/gesamt};
    };
    return {
      uebergabe:messen('qrCanvas',document.getElementById('payload').value),
      protokollBreite:document.getElementById('protokollQrCanvas')?.width||0,
    };
  });
  pruefe('Übergabe-QR: ganzzahlige Modulgröße',Number.isInteger(raster.uebergabe.zelle),`${raster.uebergabe.breite}px / ${raster.uebergabe.gesamt} Module = ${raster.uebergabe.zelle}`);
  pruefe('Übergabe-QR: mindestens 4 Pixel je Modul',raster.uebergabe.zelle>=4,`${raster.uebergabe.zelle} px`);
  pruefe('Protokoll-QR wird gezeichnet',raster.protokollBreite>0,`${raster.protokollBreite}px`);

  // --- 3. Einzelübergabe muss unverändert weiter funktionieren -------------------------
  await mb.selectOption('#register','KASSE-02');
  await mb.waitForTimeout(150);
  const kassetteWeg=await mb.locator('#kassetteSection').isHidden();
  pruefe('Aufteilung ist bei Einzelziel ausgeblendet',kassetteWeg);
  await mb.click('#generate');
  await mb.waitForTimeout(250);
  const einzelCode=await mb.inputValue('#payload');
  const einzel=JSON.parse(Buffer.from(einzelCode.slice(7),'base64').toString('utf8'));
  pruefe('Einzelübergabe hat KEIN split',einzel.scope===undefined&&einzel.registerId==='KASSE-02');
  const einzelK2=await kasseLiest('KASSE-02');
  pruefe('Einzelübergabe wird von Kasse 2 angenommen',einzelK2.ok===true,einzelK2.fehler||'');

  // --- 4. Abendzählung sperrt das Kassetten-Ziel ---------------------------------------
  await mb.click('.choice[data-type="count"]');
  await mb.waitForTimeout(150);
  const gesperrt=await mb.evaluate(()=>document.querySelector('#register option[value="KASSETTE"]').disabled);
  pruefe('Kassetten-Ziel ist bei der Abendzählung gesperrt',gesperrt);

  await mb.close();
  await browser.close();
  server.close();
  console.log(fehler?`\n${fehler} FEHLER`:'\nAlles grün.');
  process.exit(fehler?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
