const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),http=require('http');
const ROOT=path.resolve(__dirname,'..'),{chromium}=require('playwright');
const now='2026-10-31T11:00:00+01:00',sale=(id,time,items,extra={})=>({transactionId:id,time:`2026-10-31T${time}:00+01:00`,type:'sale',items,...extra});
const rows=[
 sale('a','10:30',[{id:'grot',qty:2,price:3,category:'Getränke'}]),
 sale('b','10:40',[{id:'grot',qty:2,price:3,category:'Getränke'}]),
 sale('c','10:50',[{id:'grot',qty:1,price:1.5,portionFactor:0.5,category:'Getränke'}]),
 sale('combo','10:55',[{id:'combo',isPackage:true,qty:1,price:8,category:'Kombi',components:[{id:'grot',price:3},{id:'essen',price:5}]}]),
 sale('personal','10:45',[{id:'grot',qty:99,price:3,category:'Getränke'}],{type:'personal'}),
 sale('storno','10:56',[{id:'grot',qty:-1,price:3,category:'Getränke'}],{type:'reversal',originalType:'sale'}),
 sale('reklamation','10:57',[{id:'REFUND-grot',qty:1,price:-3,category:'Reklamation',refund:true,complaint:{sourceProductId:'grot'}}]),
 sale('andere','10:58',[{id:'essen',qty:4,price:5,category:'Speisen'},{id:'glas',qty:20,price:2,category:'Pfand'}]),
 sale('zukunft','11:01',[{id:'grot',qty:1000,price:3,category:'Getränke'}]),
 {transactionId:'alt',time:'2026-10-29T10:00:00+01:00',items:[{id:'grot',qty:6,price:3}]},
 {transactionId:'anderer-tag',time:'2026-10-30T10:00:00+01:00',items:[{id:'essen',qty:5,price:5}]}
];
class FixedDate extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return new Date(now).getTime();}}
const state={master:{trainingMode:false}},window={};let trainingRows=[];
vm.runInNewContext(fs.readFileSync(path.join(ROOT,'pos/kc-verkaufskurve.js'),'utf8'),{window,state,Date:FixedDate,document:{getElementById:()=>null},readTransactions:()=>rows,readTrainingTransactions:()=>trainingRows,console});
let count=0;const test=(name,ok)=>{assert.ok(ok,name);count++;console.log('OK '+name)};
const d=window.KCVerkaufskurve.daten('grot');
test('Nettoabsatz mit halber Portion, Kombi, Storno und Reklamation korrekt',d.stueck===3.5);
test('Halbpreis wird nicht doppelt halbiert; Kombiwert anteilig',d.betrag===10.5);
test('Pfand und Personal ausgeschlossen, Kombis im Nenner entfaltet',d.tagesStueck===8.5&&Math.abs(d.anteil-3.5/8.5)<.0001);
test('Vergleichstag gehört zum ausgewählten Artikel',d.letzterTag==='2026-10-29');
test('Hochrechnung auf nächste Stunde transparent berechnet',d.prognose===7&&d.minuten===30);
test('Ohne Verkäufe keine erfundene Prognose',window.KCVerkaufskurve.daten('unbekannt').prognose===null);
test('Kurve bei Rückgaben ohne NaN/Infinity',!/NaN|Infinity/.test(window.KCVerkaufskurve.infoHtml('grot')));
state.master.trainingMode=true;trainingRows=[sale('training','10:30',[{id:'grot',qty:2,price:3}],{training:true})];
test('Training verwendet getrennte Trainingsverkäufe',window.KCVerkaufskurve.daten('grot').stueck===2);
test('Weniger als drei Bons reicht nicht für Prognose',window.KCVerkaufskurve.daten('grot').prognose===null);
test('Storno einer Reklamation hebt deren Mengenabzug auf',window.KCVerkaufskurve.stueckIn({id:'REFUND-grot',qty:-1,price:-3,refund:true,complaint:{sourceProductId:'grot'}},'grot')===1);

const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const f=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]));fs.readFile(f,(e,data)=>{res.writeHead(e?404:200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});res.end(e?'':data)});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port,b=await chromium.launch({headless:true,...(process.env.CHROME_CHANNEL?{channel:process.env.CHROME_CHANNEL}:{})});
try{for(const pre of ['', 'schulung/']){
 const ctx=await b.newContext({viewport:{width:1024,height:768},serviceWorkers:'block'}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await ctx.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'&&u.port===String(port)?route.continue():route.abort()});
 await p.addInitScript(()=>localStorage.setItem('kc_master_v040',JSON.stringify({pinLockEnabled:false})));
 await p.goto(`http://127.0.0.1:${port}/${pre}pos/index.html`);await p.waitForFunction(()=>window.KCVerkaufskurve?.infoHtml&&window.KCAufbau);await p.clock.setFixedTime(new Date(now));await p.evaluate(()=>window.__kcTxHydrated);
 await p.evaluate(({rows,pre})=>{_txCache=rows;_trainingTxCache=rows.map(t=>({...t,training:true}));state.master.trainingMode=!!pre;['fullscreenGate','kcStartupSummary'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none'});document.querySelectorAll('[data-kc-sperrend]').forEach(e=>e.style.display='none');}, {rows,pre});
 await p.locator('[data-info-id="grot"]').first().click();
 test(pre+' Info-Klick zeigt Absatz und Prognose direkt',await p.locator('#productInfoContent').innerText().then(t=>t.includes('3,5 Portionen heute')&&t.includes('ca. 7 Portionen')));
 test(pre+' Kleine Kurve direkt im Infofenster',await p.locator('#productInfoContent svg').count()===1);
 test(pre+' Prognose ohne Scrollen sichtbar',await p.locator('#productInfoContent .kc-prognose').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}));
 fs.mkdirSync(path.join(ROOT,'test-results'),{recursive:true});await p.screenshot({path:path.join(ROOT,'test-results',pre?'info-schulung.png':'info-kasse.png')});
 await p.locator('#productInfoSalesBtn').click();await p.locator('#salesTimeDialog svg').waitFor();
 test(pre+' Große Kurve öffnet ohne gestapelte Dialoge',await p.locator('dialog[open]').count()===1&&await p.locator('#salesTimeDialog').isVisible());
 test(pre+' Große Kurve zeigt ebenfalls Prognose',await p.locator('#salesTimeList').innerText().then(t=>t.includes('Prognose nächste 60 Minuten')));
 test(pre+' Keine Skriptfehler',errors.length===0);await ctx.close();
}console.log(count+' Prüfungen erfolgreich.');}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
