/* Dienstplan-Export: die PROBLEMFÄLLE müssen mitgehen.
   Befund des Users: "ein Mitglied vergisst morgens das Einbuchen und bucht nur den Feierabend,
   ein anderes bucht sich ein und vergisst den Feierabend - das sind die Fälle, die beim
   Einlesen in den Istplan aufgedeckt werden müssen." Vorher wurden genau die herausgefiltert:
   halbe Paare fehlten, ein "Gehen" ohne "Kommen" verschwand sogar spurlos.
   Zusätzlich geprüft: die Mitgliedsnummer wandert mit - KC DP3 ordnet bevorzugt darüber zu. */
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
  await new Promise(r=>server.listen(8478,r));
  const browser=await chromium.launch();
  const p=await browser.newPage({viewport:{width:1400,height:900}});
  p.on('pageerror',e=>console.log('PAGEERROR:',e.message));
  await p.goto('http://127.0.0.1:8478/pc-manager/index.html');
  await p.waitForTimeout(1500);

  // Drei Personen, drei Fälle: vollständig, nur Kommen, nur Gehen.
  const ergebnis=await p.evaluate(()=>{
    const leute=[
      {id:'P1',displayName:'Anne Beispiel',credential:'KC-0007'},
      {id:'P2',displayName:'Bernd Beispiel',credential:'KC-0008'},
      {id:'P3',displayName:'Carla Beispiel',credential:'KC-0009'},
    ];
    const t=(stunde,minute)=>new Date(2026,10,28,stunde,minute).toISOString();
    const ereignisse=[
      {personId:'P1',kind:'in', effectiveAt:t(16,0)},
      {personId:'P1',kind:'out',effectiveAt:t(21,30)},   // vollständig
      {personId:'P2',kind:'in', effectiveAt:t(16,15)},   // Feierabend vergessen
      {personId:'P3',kind:'out',effectiveAt:t(21,45)},   // Einbuchen vergessen
    ];
    return window.KCTimeClockManager.dienstplanZeilen(ereignisse,leute);
  });

  const nach=(status)=>ergebnis.zeilen.filter(z=>z.status===status);
  pruefe('Alle drei Buchungen sind im Export',ergebnis.zeilen.length===3,`${ergebnis.zeilen.length} Zeilen`);
  pruefe('Die vollständige Buchung hat Kommen und Gehen',nach('vollstaendig').length===1&&nach('vollstaendig')[0].start&&nach('vollstaendig')[0].end,
    JSON.stringify(nach('vollstaendig')[0]||{}));
  pruefe('"Feierabend vergessen" geht MIT (Gehen leer)',nach('nur_kommen').length===1&&nach('nur_kommen')[0].start&&!nach('nur_kommen')[0].end,
    JSON.stringify(nach('nur_kommen')[0]||{}));
  pruefe('"Einbuchen vergessen" geht MIT (Kommen leer)',nach('nur_gehen').length===1&&!nach('nur_gehen')[0].start&&nach('nur_gehen')[0].end,
    JSON.stringify(nach('nur_gehen')[0]||{}));
  pruefe('Beide Lücken werden gemeldet',ergebnis.luecken.length===2,`${ergebnis.luecken.length}`);
  pruefe('Jede Zeile trägt die Mitgliedsnummer',ergebnis.zeilen.every(z=>/^KC-\d+$/.test(z.memberNo)),
    ergebnis.zeilen.map(z=>z.memberNo).join(', '));
  pruefe('Jede Zeile hat ein Datum',ergebnis.zeilen.every(z=>/^\d{4}-\d{2}-\d{2}$/.test(z.date)),
    ergebnis.zeilen.map(z=>z.date).join(', '));

  // Zweiter Fall aus der Praxis: zweimal einbuchen ohne Gehen dazwischen.
  const doppelt=await p.evaluate(()=>{
    const leute=[{id:'P9',displayName:'Doppel Test',credential:'KC-0099'}];
    const t=(h)=>new Date(2026,10,28,h,0).toISOString();
    return window.KCTimeClockManager.dienstplanZeilen(
      [{personId:'P9',kind:'in',effectiveAt:t(16)},{personId:'P9',kind:'in',effectiveAt:t(18)}],leute);
  });
  pruefe('Zweimaliges Einbuchen verliert keine Zeile',doppelt.zeilen.length===2,`${doppelt.zeilen.length} Zeilen`);

  await browser.close();
  server.close();
  console.log(fehler?`\n${fehler} FEHLER`:'\nAlles grün.');
  process.exit(fehler?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
