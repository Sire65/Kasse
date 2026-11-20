/* Money Butler: Tasten erst frei, wenn der Schritt Sinn ergibt; Empfangsbestätigung Pflicht; kein Doppelversand. */
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
  await new Promise(r=>server.listen(8472,r));
  const browser=await chromium.launch();

  // --- 1. Money Butler: Kassetteninhalt erfassen und aufteilen ---------------------------
  const mb=await browser.newPage({viewport:{width:1280,height:1400}});
  // 28.09.2026: Seit 306f00f/7911a20/d4e5dc3 (25.09.) hat Money Butler eine Pflichtanmeldung
  // (money-butler/kc-auth.js, Supabase); ohne Anmeldung bleibt .app per .mb-auth-locked unsichtbar.
  // Die Sperre wird NICHT umgangen: der Test meldet sich ueber das echte Anmeldeformular an, die
  // Supabase-Antworten kommen von hier (Test-Sitzung, Rolle "manager" = Kassenwart). Kein echter
  // Netzwerkzugriff - alles ausser dem lokalen Testserver wird abgebrochen.
  await mb.route(u=>!/^http:\/\/127\.0\.0\.1:8472\//.test(u.href),async route=>{
    const url=new URL(route.request().url());
    const antwort=(daten,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(daten)});
    if(!/\.supabase\.co$/.test(url.hostname))return route.abort();
    const jetzt=Math.floor(Date.now()/1000);
    if(url.pathname==='/auth/v1/token')return antwort({access_token:'test-zugang',refresh_token:'test-erneuern',token_type:'bearer',expires_in:3600,expires_at:jetzt+3600,user:{id:'test-user',email:'kassenwart@test.invalid'}});
    if(url.pathname==='/auth/v1/user')return antwort({id:'test-user',email:'kassenwart@test.invalid'});
    if(url.pathname==='/functions/v1/kc-money-butler-account-bootstrap')return antwort({orgId:'KC_WERNE',personId:'test-person',appId:'KC_MONEY_BUTLER',coreRole:'member',accessRole:'manager',displayName:'Test Kassenwart'});
    return antwort({error:'im Test nicht vorgesehen'},404);
  });
  await mb.goto('http://127.0.0.1:8472/money-butler/index.html');
  await mb.waitForSelector('#mbAuthForm',{state:'visible'});
  pruefe('Money Butler zeigt ohne Anmeldung die Anmeldesperre',await mb.evaluate(()=>document.body.classList.contains('mb-auth-locked')));
  await mb.fill('#mbAuthEmail','kassenwart@test.invalid');
  await mb.fill('#mbAuthPassword','test-passwort');
  await mb.click('#mbAuthSubmit');
  await mb.waitForFunction(()=>!document.body.classList.contains('mb-auth-locked')&&!document.body.classList.contains('mb-auth-pending'),null,{timeout:10000});
  pruefe('Anmeldung ueber das Formular gibt die Oberflaeche frei',(await mb.textContent('#mbAuthUserStatus')).includes('Kassenwart'),await mb.textContent('#mbAuthUserStatus'));

  const dis=(sel)=>mb.$eval(sel,b=>b.disabled);
  const schritt=()=>mb.textContent('#mbSchritt');
  pruefe('Schritt-Hinweis ist sichtbar',!!(await schritt()),await schritt());
  pruefe('Ohne Datum/Betrag: „Übergabe vorbereiten“ gesperrt',await dis('#generate'));
  pruefe('Ohne Vorbereitung: alle Übertragungswege gesperrt',await mb.$$eval('[data-handover-method]',bs=>bs.every(b=>b.disabled)));
  await mb.selectOption('#register','KASSE-01');
  await mb.fill('#effectiveDate',heute());
  pruefe('Nur Datum: weiterhin gesperrt',await dis('#generate'),await schritt());
  await mb.fill('[data-value="20"]','3');
  await mb.waitForTimeout(100);
  pruefe('Datum + Betrag: „Übergabe vorbereiten“ frei',!(await dis('#generate')),await schritt());
  pruefe('Vor dem Vorbereiten: Wege noch gesperrt',await dis('[data-handover-method="communicator"]'));
  await mb.click('#generate');
  await mb.waitForTimeout(200);
  pruefe('Nach dem Vorbereiten: QR/Datei/Communicator frei',!(await dis('[data-handover-method="qr"]'))&&!(await dis('[data-handover-method="file"]'))&&!(await dis('[data-handover-method="communicator"]')),await schritt());
  pruefe('Kurzcode bei Geldübergabe gesperrt (keine Bestätigung möglich)',await dis('[data-handover-method="shortcode"]'));
  await mb.click('[data-money-section="handover"] .section-lock').catch(()=>{});
  await mb.$eval('[data-handover-method="communicator"]',b=>b.click());
  await mb.waitForTimeout(100);
  const haken=await mb.$eval('#handoverConfirmationWanted',c=>({an:c.checked,gesperrt:c.disabled}));
  pruefe('Empfangsbestätigung ist Pflicht (angehakt + gesperrt)',haken.an&&haken.gesperrt,JSON.stringify(haken));
  await mb.click('#handoverStartCancel');
  // Änderung nach dem Vorbereiten -> vorbereitete Übergabe verfällt
  await mb.fill('[data-value="20"]','4');
  await mb.waitForTimeout(100);
  pruefe('Betrag geändert: vorbereitete Übergabe verfällt, Wege wieder gesperrt',await dis('[data-handover-method="communicator"]')&&(await mb.$eval('#payload',t=>t.value))==='',await schritt());
  await mb.click('#generate');await mb.waitForTimeout(100);
  // Senden simulieren (Communicator-Antwort aus dem Test): danach kein zweites Senden derselben Übergabe
  await mb.evaluate(()=>{const k=window.KCMoneyButlerCommunicator;window.__orig=k.senden;});
  await mb.evaluate(async()=>{
    // nur die Sende-Funktion ersetzen, die Schrittfolge-Hülle bleibt aktiv
    const komm=window.KCMoneyButlerCommunicator;const huelle=komm.senden;
    // Original unter der Hülle durch Erfolgsfall ersetzen: Hülle ruft original.apply -> wir ersetzen über __schrittfolge nicht;
    // daher Erfolg direkt über die Hülle mit simuliertem Netzwerk:
    window.KCMoneyButlerAuth={...window.KCMoneyButlerAuth,getAccessToken:async()=>'t'};
    window.KCCommunicationClient=class{constructor(){}async uploadAttachment(){return{id:'a1'}}async emitEvent(){return{ok:true}}async _request(){return{ok:true}}};
  });
  await mb.$eval('[data-handover-method="communicator"]',b=>b.click());
  await mb.click('#handoverStartButton');
  await mb.waitForTimeout(400);
  pruefe('Nach dem Senden: Wege und „Vorbereiten“ gesperrt (kein Doppelversand)',await dis('[data-handover-method="communicator"]')&&await dis('#generate'),await schritt());
  pruefe('Hinweis zeigt „Gesendet“',/Gesendet/.test(await schritt()),await schritt());
  await mb.click('#reset');await mb.waitForTimeout(100);
  pruefe('Nach „Zurücksetzen“: wieder bei Schritt 1',/Schritt 1/.test(await schritt())&&await dis('#generate'),await schritt());
  // Zählung: Kurzcode frei, kein Bestätigungszwang
  await mb.click('[data-type="count"]');await mb.fill('#effectiveDate',heute());await mb.fill('[data-value="10"]','1');await mb.waitForTimeout(100);
  await mb.click('#generate');await mb.waitForTimeout(100);
  pruefe('Bei Zählung ist der Kurzcode frei',!(await dis('[data-handover-method="shortcode"]')));
  await browser.close();server.close();
  console.log(fehler?`\n${fehler} FEHLER`:'\nMoney Butler Schrittfolge: alles grün');
  process.exit(fehler?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
