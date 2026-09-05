/* Demodaten im PC-Manager: erzeugen, anzeigen, restlos wieder entfernen.
   Wunsch des Users: Werte in den Auswertungen ohne Einlesen, hinterher wieder loeschbar.
   Geprueft wird deshalb BEIDES - dass die Grafiken danach etwas zeigen UND dass nach dem
   Entfernen nichts uebrig bleibt. Ausserdem: jeder Datensatz muss markiert sein, sonst liesse
   er sich spaeter nicht sauber von echtem Umsatz trennen. */
try{require.resolve('playwright')}catch(e){console.log('  ueberspringen: Playwright nicht installiert');process.exit(0)}
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const WURZEL=path.join(__dirname,'..');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const s=http.createServer((q,r)=>{const p=path.join(WURZEL,decodeURIComponent(q.url.split('?')[0]));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);return r.end('x')}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(d)})});
let fehler=0;const pruefe=(n,b,z='')=>{console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'  ['+z+']':''}`);if(!b)fehler++};
(async()=>{await new Promise(r=>s.listen(8477,r));const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1500,height:1000},deviceScaleFactor:1.5});
p.on('pageerror',e=>console.log('PAGEERROR:',e.message));
p.on('dialog',d=>d.accept());
await p.goto('http://127.0.0.1:8477/pc-manager/index.html');await p.waitForTimeout(1600);
// Anmeldung fuer den Test umgehen (hat eigene Tests) und Sperrfenster schliessen
await p.evaluate(()=>{managerUnlocked=true;document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  document.querySelectorAll('*').forEach(n=>{const f=getComputedStyle(n).filter;if(f&&f!=='none')n.style.setProperty('filter','none','important')});});
await p.waitForTimeout(300);
const vorher=await p.evaluate(()=>({umsatz:document.getElementById('kpiRevenue').textContent,verkaeufe:document.getElementById('kpiSales').textContent,
  trinkgeld:document.getElementById('kpiTips').textContent,sales:sales.length}));
console.log('  vorher:',JSON.stringify(vorher));
await p.evaluate(()=>document.getElementById('demoDatenErzeugen').click());
await p.waitForTimeout(1500);
const nachher=await p.evaluate(()=>({umsatz:document.getElementById('kpiRevenue').textContent,verkaeufe:document.getElementById('kpiSales').textContent,
  trinkgeld:document.getElementById('kpiTips').textContent,kassen:document.getElementById('kpiActiveRegisters').textContent,
  sales:sales.length,abschluesse:closings.length,bewegungen:cashMovementsLog.length,
  hinweis:!!document.getElementById('kcDemoHinweis'),
  alleMarkiert:sales.every(x=>x.demo===true)}));
console.log('  nachher:',JSON.stringify(nachher));
pruefe('Umsatz ist jetzt größer als null',!/^0,00/.test(nachher.umsatz),nachher.umsatz);
pruefe('Verkäufe werden gezählt',Number(nachher.verkaeufe)>0,nachher.verkaeufe);
pruefe('Trinkgeld ist gefüllt',!/^0,00/.test(nachher.trinkgeld),nachher.trinkgeld);
pruefe('Tagesabschlüsse angelegt',nachher.abschluesse>0,String(nachher.abschluesse));
pruefe('Bargeldbewegungen angelegt',nachher.bewegungen>0,String(nachher.bewegungen));
pruefe('Warnhinweis im Dashboard sichtbar',nachher.hinweis);
pruefe('Jeder Datensatz ist als Demo markiert',nachher.alleMarkiert);
// Grafiken: haben die Zeichenflaechen ueberhaupt Inhalt?
const gemalt=await p.evaluate(()=>{
  const messe=id=>{const c=document.getElementById(id);const x=c.getContext('2d');const d=x.getImageData(0,0,c.width,c.height).data;
    let bunt=0;for(let i=0;i<d.length;i+=4)if(d[i+3]>0)bunt++;return Math.round(bunt/(c.width*c.height)*100)};
  return {kasse:messe('registerChart'),gruppe:messe('groupChart'),artikel:messe('articleChart'),stunde:messe('hourChart')};
});
console.log('  Grafiken gefüllt (% der Fläche):',JSON.stringify(gemalt));
pruefe('Alle vier Grafiken zeigen etwas',Object.values(gemalt).every(v=>v>2),JSON.stringify(gemalt));
await p.locator('[data-view-panel="dashboard"]').screenshot({path:'/tmp/kc-manager-demodaten.png'});
// Entfernen
await p.evaluate(()=>document.getElementById('demoDatenEntfernen').click());
await p.waitForTimeout(1200);
const leer=await p.evaluate(()=>({umsatz:document.getElementById('kpiRevenue').textContent,sales:sales.length,
  abschluesse:closings.length,bewegungen:cashMovementsLog.length,hinweis:!!document.getElementById('kcDemoHinweis')}));
console.log('  nach dem Entfernen:',JSON.stringify(leer));
pruefe('Nach dem Entfernen ist alles wieder leer',leer.sales===vorher.sales&&leer.abschluesse===0&&leer.bewegungen===0);
pruefe('Warnhinweis ist wieder weg',!leer.hinweis);
await b.close();s.close();
console.log(fehler?`\n${fehler} FEHLER`:'\nAlles grün.');process.exit(fehler?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
