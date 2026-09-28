/* TSE-Relay (Entwicklung) - Kassenseite, echt im Browser gegen einen Nachbau des Mini-PC-Dienstes.
   Wichtigste Regel des Betreibers: ausgeschaltet darf sich an der Kasse NICHTS aendern, und auch
   eingeschaltet darf ein haengender/fehlender Mini-PC den Verkauf nie aufhalten. */
try{require.resolve('playwright')}catch(e){console.log('  ueberspringen: Playwright nicht installiert');process.exit(0)}
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const {starteMock}=require('./tse-relay-mock.cjs');
const WURZEL=path.join(__dirname,'..');
const BILDER=process.env.KC_TSE_SCREENSHOTS||'';
const KASSE_PORT=8741,MOCK_PORT=8742,MOCK=`http://127.0.0.1:${MOCK_PORT}`;
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const s=http.createServer((q,r)=>{const p=path.join(WURZEL,decodeURIComponent(q.url.split('?')[0]));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end('x')}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(d)})});
let fehler=0;const pruefe=(n,b,z='')=>{console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'  ['+z+']':''}`);if(!b)fehler++};
const bild=async(p,name)=>{if(BILDER)await p.screenshot({path:path.join(BILDER,name)})};

async function neueKasse(b,master,viewport={width:1280,height:800}){
  const ctx=await b.newContext({viewport,serviceWorkers:'block'});
  const p=await ctx.newPage();
  p.on('pageerror',e=>console.log('PAGEERROR:',e.message));
  await p.addInitScript((m)=>{if(!sessionStorage.getItem('kc_test_init')){sessionStorage.setItem('kc_test_init','1');localStorage.setItem('kc_master_v040',JSON.stringify(m));localStorage.setItem('kc_offers_v100','[]')}},master);
  await p.goto(`http://127.0.0.1:${KASSE_PORT}/pos/index.html`);await p.waitForTimeout(1400);
  await p.evaluate(()=>{const k=[...document.querySelectorAll('button')].find(x=>/KASSE STARTEN/i.test(x.textContent));if(k)k.click()});
  await p.waitForTimeout(1200);
  return {ctx,p};
}
// Echter Verkauf ueber die Oberflaeche: Artikel antippen, BAR DIREKT. Gemessen wird, wie lange
// es dauert, bis die Abschlussmeldung steht und der Bon leer ist.
async function verkaufen(p){
  await p.evaluate(()=>document.querySelector('.product-tile')?.click());
  await p.waitForTimeout(250);
  // Die Zeit wird IM Browser gemessen (Klick bis: Bon leer + Datensatz gespeichert), damit
  // Playwright-Umlaufzeiten nicht mitzaehlen. BAR DIREKT schliesst still ab (ohne Meldungsfenster).
  const dauer=await p.evaluate(()=>new Promise((fertig,fehl)=>{
    const tr=()=>state.master.trainingMode?readTrainingTransactions():readTransactions();
    const vorher=tr().length,t0=performance.now();
    document.getElementById('payBtn').click();
    const warte=()=>{if(tr().length>vorher&&state.cart.length===0&&!state.saleInProgress)return fertig(Math.round(performance.now()-t0));if(performance.now()-t0>5000)return fehl(new Error('Verkauf nicht abgeschlossen'));setTimeout(warte,5)};warte();
  }));
  const rec=await p.evaluate(()=>{const r=state.master.trainingMode?readTrainingTransactions():readTransactions();return r[r.length-1]});
  await p.evaluate(()=>{const d=document.getElementById('messageDialog');if(d?.open)d.close();document.getElementById('kcBonFrage')?.remove()});
  return {dauer,rec};
}
const tseSpeicher=p=>p.evaluate(()=>({sig:JSON.parse(localStorage.getItem('kc_tse_signaturen_v1')||'null'),offen:JSON.parse(localStorage.getItem('kc_tse_offen_v1')||'null'),hinweis:document.getElementById('kcTseHinweis')?.textContent||null}));
const ledger=p=>p.evaluate(async()=>inspectLedger(readTransactions(),'Umsatz'));

(async()=>{
  await new Promise(r=>s.listen(KASSE_PORT,r));
  const mock=await starteMock(MOCK_PORT);
  const b=await chromium.launch();
  try{
  // ---------------- 1. Standard: Schalter AUS -> exakt nichts ----------------
  {
    const {ctx,p}=await neueKasse(b,{registerId:'KASSE-01',pinLockEnabled:false,tseRelayAdresse:MOCK});
    const vorher=mock.zustand.anfragen.length;
    pruefe('Standard: tseEntwicklungAktiv ist false',await p.evaluate(()=>state.master.tseEntwicklungAktiv===false));
    const v=await verkaufen(p);
    await p.waitForTimeout(2500);
    const sp=await tseSpeicher(p);
    pruefe('Schalter aus: Verkauf läuft normal durch',!!v.rec&&v.rec.type==='sale',`Bon ${v.rec&&v.rec.bon}`);
    pruefe('Schalter aus: KEINE einzige Anfrage an den Mini-PC',mock.zustand.anfragen.length===vorher,`${mock.zustand.anfragen.length-vorher} Anfragen`);
    pruefe('Schalter aus: nichts in localStorage angelegt',sp.sig===null&&sp.offen===null);
    pruefe('Schalter aus: kein Hinweis im Kopfbereich',sp.hinweis===null);
    pruefe('Schalter aus: Bon hat kein tse-Feld',!('tse' in v.rec));
    await ctx.close();
  }
  // ---------------- 2. Schalter AN, Mini-PC ok -> Signatur ----------------
  mock.zustand.modus='ok';
  const master={registerId:'KASSE-01',pinLockEnabled:false,tseEntwicklungAktiv:true,tseRelayAdresse:MOCK+'/'};
  {
    const {ctx,p}=await neueKasse(b,master);
    await p.evaluate(()=>{localStorage.setItem('kc_tse_relay_token_v1','geheim-123')});
    const start=mock.zustand.anfragen.length;
    const v=await verkaufen(p);
    await p.waitForTimeout(800);
    const sp=await tseSpeicher(p);
    const req=mock.zustand.anfragen.slice(start).find(a=>a.pfad==='/signieren'&&a.methode==='POST');
    pruefe('AN + ok: POST /signieren kam an',!!req);
    pruefe('Bearer-Token wird mitgeschickt',req&&req.auth==='Bearer geheim-123',req&&req.auth);
    const erwartet={transaktionId:v.rec.transactionId,kasseId:'KASSE-01',vorgangsart:'Kassenbeleg-V1',startzeit:v.rec.startTime,endzeit:v.rec.endTime,betragCent:v.rec.dueCents};
    pruefe('Anfrage-Body genau nach Schnittstelle',req&&JSON.stringify(req.body)===JSON.stringify(erwartet),req&&JSON.stringify(req.body));
    const e=sp.sig&&sp.sig[v.rec.transactionId];
    pruefe('Signatur gespeichert (eigene Liste, per transactionId)',e&&e.status==='signiert'&&!!e.signatur&&e.tseSeriennummer==='MOCK-SWISSBIT-0001'&&Number.isFinite(e.signaturzaehler)&&Number.isFinite(e.transaktionsnummer),JSON.stringify(e).slice(0,120));
    pruefe('nichts offen, kein Hinweis',Array.isArray(sp.offen)&&sp.offen.length===0&&sp.hinweis===null);
    const l=await ledger(p);
    pruefe('Bon-Prüfkette bleibt gültig (inspectLedger)',l.status==='pass',l.message);
    await ctx.close();
  }
  // ---------------- 3. Mini-PC haengt -> Verkauf trotzdem sofort, nach 2 s "ausstehend" ----------------
  mock.zustand.modus='haengt';
  let offeneIds=[];
  {
    const {ctx,p}=await neueKasse(b,master);
    await p.evaluate(()=>{localStorage.setItem('kc_tse_relay_token_v1','geheim-123')});
    const v=await verkaufen(p);
    pruefe('Hängender Mini-PC: Verkaufsabschluss trotzdem sofort',v.dauer<700,`${v.dauer} ms bis Meldung + leerer Bon`);
    // Sofort weiterkassieren, während die erste Anfrage noch haengt
    const v2=await verkaufen(p);
    pruefe('Nächster Verkauf direkt danach ebenfalls sofort',v2.dauer<700,`${v2.dauer} ms`);
    const sofort=await tseSpeicher(p);
    pruefe('Während die Anfrage läuft: noch kein Hinweis (kein Aufblinken)',sofort.hinweis===null,String(sofort.hinweis));
    await p.waitForTimeout(2600);
    const sp=await tseSpeicher(p);
    pruefe('Nach Timeout (2 s): beide als "ausstehend" markiert',sp.sig&&sp.sig[v.rec.transactionId]?.status==='ausstehend'&&sp.sig[v2.rec.transactionId]?.status==='ausstehend');
    pruefe('Nach Timeout: beide in der Offen-Liste',sp.offen&&sp.offen.length===2,sp.offen&&sp.offen.map(o=>o.letzterFehler).join(', '));
    pruefe('Hinweis im Kopfbereich zeigt 2',sp.hinweis==='TSE ⏳ 2',String(sp.hinweis));
    const kopf=await p.evaluate(()=>{const h=document.getElementById('kcTseHinweis').getBoundingClientRect(),k=document.querySelector('.app-header').getBoundingClientRect();return {imKopf:h.top>=k.top&&h.bottom<=k.bottom,h:Math.round(h.height)}});
    pruefe('Hinweis sitzt im Kopfbereich und ist klein',kopf.imKopf&&kopf.h<24,JSON.stringify(kopf));
    if(BILDER)await p.waitForFunction(()=>![...document.querySelectorAll('div')].some(d=>d.dataset&&d.dataset.kcSperrend!==undefined),null,{timeout:12000}).catch(()=>{});
    await bild(p,'tse-3-hinweis-gesamt.png');
    if(BILDER){const k=await p.evaluate(()=>{const r=document.querySelector('.app-header').getBoundingClientRect();return {x:Math.max(0,r.left-10),y:0,width:Math.min(r.width+20,1280-Math.max(0,r.left-10)),height:r.bottom+20}});await p.screenshot({path:path.join(BILDER,'tse-3-hinweis-kopfbereich.png'),clip:k})}
    offeneIds=[v.rec.transactionId,v2.rec.transactionId];
    // ---------------- 4. TSE weg (503) -> Relay-Warteschlange ----------------
    mock.zustand.modus='tse_weg';
    const t0=Date.now();
    const v3=await verkaufen(p);
    await p.waitForTimeout(600);
    const sp3=await tseSpeicher(p);
    const e3=sp3.offen.find(o=>o.transaktionId===v3.rec.transactionId);
    pruefe('503 (TSE weg): Verkauf sofort',v3.dauer<700,`${v3.dauer} ms`);
    pruefe('503: ausstehend + inRelayWarteschlange gemerkt',e3&&e3.inRelayWarteschlange===true&&e3.letzterFehler==='tse_nicht_erreichbar',JSON.stringify(e3));
    pruefe('Hinweis zeigt 3',sp3.hinweis==='TSE ⏳ 3',String(sp3.hinweis));
    offeneIds.push(v3.rec.transactionId);
    // Nachtrage-Runde, waehrend TSE noch weg: nichts wird signiert, nichts geht verloren
    const r=await p.evaluate(()=>KCTseRelay.nachtragen());
    pruefe('Nachtragen bei TSE weg: erreichbar, aber nichts signiert',r&&r.erreichbar===true&&r.tseVerfuegbar===false&&r.signiert===0&&r.offen===3,JSON.stringify(r));
    // ---------------- 5. Neustart der Kasse (Seite neu laden, Speicher bleibt wie am Geraet) ----------------
    mock.zustand.modus='ok';
    const start=mock.zustand.anfragen.length;
    await p.reload();
    const p5=p;
    await p5.waitForTimeout(700);
    const nachNeustart=await tseSpeicher(p5);
    pruefe('Nach Neustart: offene Liste ist noch da (3)',nachNeustart.offen&&nachNeustart.offen.length===3);
    // Automatik: 1,5 s nach dem Start laeuft die erste Nachtrage-Runde von selbst
    await p5.waitForFunction(()=>JSON.parse(localStorage.getItem('kc_tse_offen_v1')||'[]').length===0,null,{timeout:8000}).catch(()=>{});
    const sp5=await tseSpeicher(p5);
    const neu=mock.zustand.anfragen.slice(start).map(a=>a.methode+' '+a.pfad).filter(x=>!x.startsWith('OPTIONS'));
    pruefe('Automatisch nachgetragen: alle 3 signiert',offeneIds.every(id=>sp5.sig[id]?.status==='signiert'),offeneIds.map(id=>sp5.sig[id]?.status).join(','));
    pruefe('Offen-Liste leer, Hinweis weg',sp5.offen.length===0&&sp5.hinweis===null);
    pruefe('Ablauf: /health → /warteschlange/verarbeiten → /warteschlange → /signieren',neu[0]==='GET /health'&&neu[1]==='POST /warteschlange/verarbeiten'&&neu[2]==='GET /warteschlange'&&neu.slice(3).every(x=>x==='POST /signieren'),neu.join(' | '));
    const sigAusRelay=mock.zustand.signiert.get(offeneIds[2]);
    pruefe('Signatur des per Warteschlange nachsignierten Vorgangs stimmt mit dem Dienst überein',sigAusRelay&&sp5.sig[offeneIds[2]].signatur===sigAusRelay.signatur);
    // Jeder einzelne Bon muss unveraendert sein (eigene Pruefsumme stimmt, kein tse-Feld).
    // HINWEIS: die Ketten-Reihenfolge nach einem Neuladen wird hier bewusst NICHT geprueft -
    // das Original laedt die Bons nach dem Neustart in zufaelliger Reihenfolge aus der IndexedDB
    // (Befund 27.09.2026, unabhaengig vom TSE-Relay, siehe Pruefbericht).
    const einzel=await p5.evaluate(async()=>{const rows=readTransactions();let ok=0;for(const r of rows){if(await sha256Hex(canonicalTransaction(r))===r.recordHash&&!('tse' in r))ok++}return {ok,gesamt:rows.length}});
    pruefe('Alle Bons unverändert (Prüfsumme je Bon stimmt, kein tse-Feld)',einzel.gesamt===3&&einzel.ok===3,JSON.stringify(einzel));
    await ctx.close();
  }
  // ---------------- 6. Dienst gar nicht da (Port zu) + Training ----------------
  {
    const {ctx,p}=await neueKasse(b,{...master,tseRelayAdresse:'http://127.0.0.1:8799'});
    const v=await verkaufen(p);
    await p.waitForTimeout(800);
    const sp=await tseSpeicher(p);
    pruefe('Dienst aus: Verkauf sofort, Vorgang ausstehend',v.dauer<700&&sp.offen.length===1,`${v.dauer} ms, ${sp.offen[0]?.letzterFehler}`);
    await p.evaluate(()=>{state.master.trainingMode=true});
    const vorherOffen=sp.offen.length;
    await verkaufen(p);
    await p.waitForTimeout(800);
    const spT=await tseSpeicher(p);
    pruefe('Trainingsbon wird nie signiert/gemerkt',spT.offen.length===vorherOffen);
    await ctx.close();
  }
  // ---------------- 7. Einstellungen: eigener Entwicklungsbereich ----------------
  {
    const {ctx,p}=await neueKasse(b,{registerId:'KASSE-01',pinLockEnabled:false},{width:1280,height:1500});
    await p.evaluate(()=>{beginAdminSession('test','Test');document.querySelectorAll('dialog[open]').forEach(d=>d.close())});
    await p.waitForTimeout(300);
    await p.evaluate(()=>{openSettings()});await p.waitForTimeout(300);
    await p.evaluate(()=>document.querySelector('[data-settings-tab="tse-entwicklung"]').click());await p.waitForTimeout(300);
    const ui=await p.evaluate(()=>{const panel=document.querySelector('[data-settings-panel="tse-entwicklung"]');const tip=document.getElementById('showTipToggle').closest('[data-settings-panel]').dataset.settingsPanel;
      return {sichtbar:panel.getBoundingClientRect().height>0,schalter:document.getElementById('tseEntwicklungAktivToggle').checked,
        getrenntVonTasten:tip!=='tse-entwicklung'&&!panel.contains(document.getElementById('showTipToggle')),text:panel.innerText.slice(0,80)}});
    pruefe('Entwicklungsbereich sichtbar, getrennt von den Kassentasten',ui.sichtbar&&ui.getrenntVonTasten,ui.text);
    pruefe('Schalter standardmäßig aus',ui.schalter===false);
    await p.fill('#tseRelayAdresseSetting',MOCK);
    await p.click('#tseRelayTestBtn');await p.waitForTimeout(600);
    const test=await p.evaluate(()=>document.getElementById('tseRelayStatus').textContent);
    pruefe('Verbindung testen (ungespeicherte Adresse)',/Mini-PC erreichbar/.test(test),test);
    await p.evaluate(()=>{document.querySelector('[data-settings-tab="tse-entwicklung"]').scrollIntoView({inline:'center',block:'nearest'});document.querySelector('[data-settings-panel="tse-entwicklung"] h3').scrollIntoView({block:'start'})});
    await bild(p,'tse-7-einstellungen.png');
    if(BILDER){
      // Nur fuers Foto: den Scrollbereich des Dialogs aufziehen, damit der ganze Bereich drauf ist.
      await p.evaluate(()=>{let n=document.querySelector('[data-settings-panel="tse-entwicklung"]');while(n&&n!==document.body){const st=getComputedStyle(n);if(/auto|scroll|hidden/.test(st.overflowY)||st.maxHeight!=='none'){n.style.overflow='visible';n.style.maxHeight='none';n.style.height='auto'}n=n.parentElement}});
      await p.locator('[data-settings-panel="tse-entwicklung"]').screenshot({path:path.join(BILDER,'tse-7-entwicklungsbereich.png')});
    }
    await p.check('#tseEntwicklungAktivToggle');await p.fill('#tseRelayTokenSetting','geheim-123');
    await p.click('#saveTestSettings');await p.waitForTimeout(300);
    const gespeichert=await p.evaluate(()=>({aktiv:state.master.tseEntwicklungAktiv,adr:state.master.tseRelayAdresse,
      tokenImMaster:JSON.stringify(state.master).includes('geheim-123')||(localStorage.getItem('kc_master_v040')||'').includes('geheim-123'),token:localStorage.getItem('kc_tse_relay_token_v1')}));
    pruefe('Speichern: Schalter + Adresse in state.master',gespeichert.aktiv===true&&gespeichert.adr===MOCK,JSON.stringify(gespeichert));
    pruefe('Passwort NICHT in state.master, nur eigener Schlüssel',!gespeichert.tokenImMaster&&gespeichert.token==='geheim-123');
    await ctx.close();
  }
  // ---------------- 8. Der 30-Sekunden-Takt traegt ohne Neustart nach ----------------
  {
    mock.zustand.modus='haengt';
    const {ctx,p}=await neueKasse(b,master);
    await p.evaluate(()=>{localStorage.setItem('kc_tse_relay_token_v1','geheim-123')});
    await p.waitForTimeout(2000); // erste Runde nach dem Start ist vorbei (nichts offen)
    const v=await verkaufen(p);
    await p.waitForTimeout(2600);
    const vor=await tseSpeicher(p);
    pruefe('Takt: Vorgang zunächst offen',vor.offen.length===1&&vor.hinweis==='TSE ⏳ 1',String(vor.hinweis));
    mock.zustand.modus='ok';
    const t0=Date.now();
    await p.waitForFunction(()=>JSON.parse(localStorage.getItem('kc_tse_offen_v1')||'[]').length===0,null,{timeout:35000}).catch(()=>{});
    const nach=await tseSpeicher(p);
    pruefe('Takt: innerhalb von 30 s automatisch nachgetragen, Hinweis weg',nach.offen.length===0&&nach.sig[v.rec.transactionId]?.status==='signiert'&&nach.hinweis===null,`${Math.round((Date.now()-t0)/1000)} s`);
    // Schalter im laufenden Betrieb aus -> Takt stoppt, keine Anfragen mehr
    await p.evaluate(()=>{state.master.tseEntwicklungAktiv=false;saveMaster();KCTseRelay.einstellungenGeaendert()});
    const n0=mock.zustand.anfragen.length;
    await p.evaluate(()=>{localStorage.setItem('kc_tse_offen_v1',JSON.stringify([{transaktionId:'x',kasseId:'KASSE-01',vorgangsart:'Kassenbeleg-V1',startzeit:'',endzeit:'',betragCent:1,seit:new Date().toISOString(),versuche:1}]))});
    await verkaufen(p);
    await p.waitForTimeout(31500);
    const aus=await tseSpeicher(p);
    pruefe('Schalter im Betrieb ausgeschaltet: keine Anfragen mehr, kein Hinweis',mock.zustand.anfragen.length===n0&&aus.hinweis===null,`${mock.zustand.anfragen.length-n0} Anfragen`);
    await ctx.close();
  }
  }catch(err){console.log('ABBRUCH:',err&&err.stack||err);fehler++}
  await b.close();await mock.schliessen();s.close();
  console.log(fehler?`\n${fehler} FEHLER`:'\nAlles OK');process.exit(fehler?1:0);
})();
