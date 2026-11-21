/* Geldkassette: Vorschlag verteilt nach BETRAG (Betreiber 21.11.2026: einzelne Scheine landeten alle bei Kasse 2). Vorlage: Tasten erst frei, wenn der Schritt Sinn ergibt; Empfangsbestätigung Pflicht; kein Doppelversand. */
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
  await new Promise(r=>server.listen(8474,r));
  const browser=await chromium.launch();

  // --- 1. Money Butler: Kassetteninhalt erfassen und aufteilen ---------------------------
  const mb=await browser.newPage({viewport:{width:1280,height:1400}});
  // 28.09.2026: Seit 306f00f/7911a20/d4e5dc3 (25.09.) hat Money Butler eine Pflichtanmeldung
  // (money-butler/kc-auth.js, Supabase); ohne Anmeldung bleibt .app per .mb-auth-locked unsichtbar.
  // Die Sperre wird NICHT umgangen: der Test meldet sich ueber das echte Anmeldeformular an, die
  // Supabase-Antworten kommen von hier (Test-Sitzung, Rolle "manager" = Kassenwart). Kein echter
  // Netzwerkzugriff - alles ausser dem lokalen Testserver wird abgebrochen.
  await mb.route(u=>!/^http:\/\/127\.0\.0\.1:8474\//.test(u.href),async route=>{
    const url=new URL(route.request().url());
    const antwort=(daten,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(daten)});
    if(!/\.supabase\.co$/.test(url.hostname))return route.abort();
    const jetzt=Math.floor(Date.now()/1000);
    if(url.pathname==='/auth/v1/token')return antwort({access_token:'test-zugang',refresh_token:'test-erneuern',token_type:'bearer',expires_in:3600,expires_at:jetzt+3600,user:{id:'test-user',email:'kassenwart@test.invalid'}});
    if(url.pathname==='/auth/v1/user')return antwort({id:'test-user',email:'kassenwart@test.invalid'});
    if(url.pathname==='/functions/v1/kc-money-butler-account-bootstrap')return antwort({orgId:'KC_WERNE',personId:'test-person',appId:'KC_MONEY_BUTLER',coreRole:'member',accessRole:'manager',displayName:'Test Kassenwart'});
    return antwort({error:'im Test nicht vorgesehen'},404);
  });
  await mb.goto('http://127.0.0.1:8474/money-butler/index.html');
  await mb.waitForSelector('#mbAuthForm',{state:'visible'});
  pruefe('Money Butler zeigt ohne Anmeldung die Anmeldesperre',await mb.evaluate(()=>document.body.classList.contains('mb-auth-locked')));
  await mb.fill('#mbAuthEmail','kassenwart@test.invalid');
  await mb.fill('#mbAuthPassword','test-passwort');
  await mb.click('#mbAuthSubmit');
  await mb.waitForFunction(()=>!document.body.classList.contains('mb-auth-locked')&&!document.body.classList.contains('mb-auth-pending'),null,{timeout:10000});
  pruefe('Anmeldung ueber das Formular gibt die Oberflaeche frei',(await mb.textContent('#mbAuthUserStatus')).includes('Kassenwart'),await mb.textContent('#mbAuthUserStatus'));


  const geld=(t)=>Number(String(t).replace(/[^0-9,]/g,'').replace(',','.'));
  async function fall(name, werte, maxDiff){
    await mb.click('#reset'); await mb.selectOption('#register','KASSETTE'); await mb.fill('#effectiveDate',heute());
    for(const [w,n] of Object.entries(werte)) await mb.fill(`[data-value="${w}"]`,String(n));
    await mb.waitForTimeout(200);
    const k1=geld(await mb.textContent('[data-kckass-summe="1"]')), k2=geld(await mb.textContent('[data-kckass-summe="2"]'));
    pruefe(`${name}: beide Kassen bekommen Geld, Unterschied ≤ ${maxDiff} €`, k1>0&&k2>0&&Math.abs(k1-k2)<=maxDiff+0.001, `K1 ${k1} / K2 ${k2}`);
    await mb.click('#generate'); await mb.waitForTimeout(200);
    pruefe(`${name}: Übergabe lässt sich vorbereiten (keine Meldung „bekommt nichts“)`, (await mb.$eval('#payload',t=>t.value)).startsWith('KCASH1:'));
  }
  mb.on('dialog', d=>{ pruefe('Kein Warnfenster beim Vorbereiten', false, d.message()); d.dismiss(); });
  await fall('Je ein 100/50/20/10-€-Schein', {'100':1,'50':1,'20':1,'10':1}, 20);
  await fall('Ein 50er und zwei 20er', {'50':1,'20':2}, 10);
  await fall('Gemischt wie am Stand', {'50':2,'20':4,'10':6,'2':5}, 2);
  await fall('Ein einzelner 20-€-Schein + 2 × 10 €', {'20':1,'10':2}, 0);
  await mb.click('#reset'); await mb.selectOption('#register','KASSETTE'); await mb.fill('#effectiveDate',heute());
  await mb.fill('[data-value="20"]','1'); await mb.fill('[data-value="10"]','1'); await mb.waitForTimeout(200);
  const hinweis=await mb.$eval('[data-kckass-info]',e=>e.hidden?'':e.textContent);
  pruefe('Hinweis, wenn sich ein Schein nicht teilen lässt (1×20 € + 1×10 €)', /nicht genau hälftig/i.test(hinweis)&&/20/.test(hinweis)&&/wechseln/.test(hinweis), hinweis.slice(0,140));
  await mb.fill('[data-value="10"]','2'); await mb.waitForTimeout(200);
  pruefe('Kein Hinweis, wenn es genau aufgeht (1×20 € + 2×10 €)', await mb.$eval('[data-kckass-info]',e=>e.hidden));
  await mb.click('[data-kckass="k1"]'); await mb.waitForTimeout(100);
  pruefe('„Alles an KASSE-01“ funktioniert weiter', geld(await mb.textContent('[data-kckass-summe="2"]'))===0);
  await mb.click('[data-kckass="halb"]'); await mb.waitForTimeout(100);
  pruefe('„Vorschlag: gleich viel Geld“ stellt den Ausgleich wieder her', Math.abs(geld(await mb.textContent('[data-kckass-summe="1"]'))-geld(await mb.textContent('[data-kckass-summe="2"]')))<=2);
  await browser.close();server.close();
  console.log(fehler?`\n${fehler} FEHLER`:'\nGeldkassette Vorschlag: alles grün');process.exit(fehler?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
