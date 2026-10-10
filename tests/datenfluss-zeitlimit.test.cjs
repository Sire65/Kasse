/* PC-Manager Datenfluss-Melder (10.10.2026, Geschwindigkeitspruefung): Meldungen an Supabase brechen
   nach 8 s ab, statt bei haengender Verbindung offen zu bleiben und sich aufzustauen. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const W=path.join(__dirname,'..');
for(const base of ['pc-manager','schulung/pc-manager']){
  const quelle=fs.readFileSync(path.join(W,base,'kc-datenfluss-melder.js'),'utf8');
  assert((quelle.match(/signal: zeitlimit\(\)/g)||[]).length===2,base+': beide Supabase-Aufrufe haben ein Zeitlimit');
  assert(/const ZEITLIMIT_MS = 8000;/.test(quelle),base+': Zeitlimit 8 s');
  assert(fs.readFileSync(path.join(W,base,'index.html'),'utf8').includes('kc-datenfluss-melder.js?build=1.0.1'),base+': Buildkennung');
}
(async()=>{
  const quelle=fs.readFileSync(path.join(W,'pc-manager/kc-datenfluss-melder.js'),'utf8');
  const signale=[];let uhr=[];
  const haengt=(url,opt)=>new Promise((_,nein)=>{signale.push(opt&&opt.signal);if(opt&&opt.signal)opt.signal.addEventListener('abort',()=>nein(new Error('Zeitlimit')))});
  const win={fetch:haengt,location:{href:'http://localhost/',host:'localhost'},addEventListener(){},KC_VERSION:'test'};
  win.window=win;
  const ctx={window:win,fetch:haengt,localStorage:{getItem:()=>null,setItem(){}},crypto:{randomUUID:()=>'00000000-0000'},navigator:{onLine:true},
    document:{querySelector:()=>null,documentElement:{dataset:{}}},URL,JSON,Object,String,Math,Date,Promise,Error,AbortController,AbortSignal,
    setInterval:()=>0,setTimeout:(f,ms)=>{if(ms===4000)uhr.push(f);else setTimeout(f,ms)},console};
  vm.runInNewContext(quelle,ctx);
  assert(uhr.length===1,'Lebenszeichen ist geplant');
  const wach=setInterval(()=>{},500);const t0=Date.now();await uhr[0]();clearInterval(wach);
  const dauer=Date.now()-t0;
  assert(signale.length===1&&signale[0],'Lebenszeichen sendet mit Abbruchsignal');
  const z=win.KCDatenfluss.zustand().heartbeat;
  assert(z.ok===false&&/Zeitlimit|abort|timeout/i.test(z.fehler),'haengende Verbindung wird als Fehler vermerkt: '+JSON.stringify(z));
  assert(dauer>=7500&&dauer<12000,'Abbruch nach etwa 8 s (gemessen '+dauer+' ms)');
  console.log('datenfluss-zeitlimit: ok ('+dauer+' ms)');
})().catch(e=>{console.error(e);process.exit(1)});
