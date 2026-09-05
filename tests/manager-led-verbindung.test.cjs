/* Die Verbindungs-LED im PC-Manager.
 *
 * VORGABE DES VEREINS: "Die gruene LED soll IMMER leuchten bei Verbindung, nicht nur bei
 * Verkauf. Bei realem Datenverkehr soll die gelbe flackern."
 *
 * BEFUND davor: die Status-LED hing am letzten Ereignis einer GEOEFFNETEN Kasse. Am Tablet
 * friert iOS die Seite im Hintergrund ein - keine Herzschlaege mehr, LED rot, obwohl die Kasse
 * gekoppelt und der Dienst erreichbar war. Der Manager sagte "nicht verbunden", waehrend alles
 * stand. Dieser Test laeuft deshalb OHNE geoeffnete Kasse.
 *
 * Der Test faelscht die Auskunft des Manager-Dienstes nicht nach, sondern liefert sie ueber
 * einen echten kleinen Server auf demselben Weg aus, den der Manager auch benutzt.
 */
const {chromium}=require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const WURZEL=path.resolve(__dirname,'..');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.webmanifest':'application/manifest+json'};
let ok=0,rot=0; const p=(n,b,z='')=>{b?ok++:rot++;console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'   ['+z+']':''}`)};

// Stellt den Manager-Dienst auf 47392 dar - nur den einen Endpunkt, den die LED braucht.
let antwortModus='gekoppelt';
function starteDienst(){
  return http.createServer((q,r)=>{
    if(!q.url.startsWith('/kassen-verbindungen')){r.writeHead(404);return r.end('x')}
    r.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
    if(antwortModus==='gekoppelt')
      return r.end(JSON.stringify({managerLaeuft:true,kassen:[
        {kasse:'KASSE-01',gekoppelt:true,zuletztGemeldet:null,zustand:'gekoppelt_ohne_meldung'},
        {kasse:'KASSE-02',gekoppelt:true,zuletztGemeldet:null,zustand:'gekoppelt_ohne_meldung'}]}));
    return r.end(JSON.stringify({managerLaeuft:true,kassen:[]}));   // nichts gekoppelt
  });
}

async function lies(pg){
  return pg.evaluate(()=>({
    status:[...document.querySelectorAll('.kc-live-led-status')].map(e=>({
      farbe:/gruen/.test(e.className)?'gruen':/gelb/.test(e.className)?'gelb':/rot/.test(e.className)?'rot':'aus',
      titel:e.title})),
    aktivitaet:[...document.querySelectorAll('.kc-live-led-activity')].length,
    liste:(document.getElementById('kcLiveStatusList')||{}).innerText||''}));
}

(async()=>{
 const web=http.createServer((q,r)=>{const f=path.join(WURZEL,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end('x')}r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(d)})});
 await new Promise(r=>web.listen(8799,'127.0.0.1',r));
 const dienst=starteDienst();
 await new Promise(r=>dienst.listen(47392,'127.0.0.1',r));

 const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1400,height:900}});
 const fehler=[]; pg.on('pageerror',e=>fehler.push(e.message));
 await pg.goto('http://127.0.0.1:8799/pc-manager/index.html'); await pg.waitForTimeout(9000);
 await pg.evaluate(()=>{document.body.classList.remove('manager-locked');
   document.querySelectorAll('dialog[open]').forEach(d=>{try{d.close()}catch(e){}})});
 await pg.waitForTimeout(2000);

 p('der Manager startet ohne Skriptfehler', fehler.length===0, fehler[0]||'keine');

 // ---- DER KERNFALL: keine Kasse geoeffnet, trotzdem verbunden ----
 const ohne=await lies(pg);
 p('es gibt fuer jede Kasse eine Status-LED', ohne.status.length>=2, `${ohne.status.length} gefunden`);
 p('die gruene LED leuchtet OHNE geoeffnete Kasse - das war die Vorgabe',
   ohne.status.slice(0,2).every(x=>x.farbe==='gruen'), JSON.stringify(ohne.status.slice(0,2)));
 p('der Tooltip sagt ehrlich, worauf sich Gruen bezieht',
   ohne.status.slice(0,2).every(x=>/[Vv]erbunden/.test(x.titel)&&/gekoppelt|Meldung/.test(x.titel)),
   ohne.status[0]?.titel);
 p('die Klartextliste sagt "Verbunden", nicht "Keine Verbindung"',
   /Verbunden/.test(ohne.liste)&&!/Keine Verbindung/.test(ohne.liste), ohne.liste.replace(/\n/g,' | '));
 p('es gibt daneben eine eigene Aktivitaets-LED fuer den Verkehr', ohne.aktivitaet>=2, `${ohne.aktivitaet}`);

 // ---- Kasse nicht gekoppelt -> rot, und zwar mit Grund ----
 antwortModus='nichts';
 await pg.waitForTimeout(7000);
 const nichts=await lies(pg);
 p('eine nicht gekoppelte Kasse wird rot', nichts.status.slice(0,2).every(x=>x.farbe==='rot'),
   JSON.stringify(nichts.status.slice(0,2)));
 p('und der Grund steht dran', /nicht mit dem Manager gekoppelt/i.test(nichts.status[0]?.titel||''),
   nichts.status[0]?.titel);

 // ---- Dienst weg -> rot, mit dem Hinweis auf das schwarze Fenster ----
 antwortModus='gekoppelt';
 // Der Manager fragt alle 5 s nach - eine offene Verbindung wuerde close() ewig warten lassen.
 try{dienst.closeAllConnections&&dienst.closeAllConnections()}catch(e){}
 dienst.close();
 await pg.waitForTimeout(8000);
 const weg=await lies(pg);
 p('faellt der Manager-Dienst aus, wird die LED rot', weg.status.slice(0,2).every(x=>x.farbe==='rot'),
   JSON.stringify(weg.status.slice(0,2)));
 p('der Tooltip nennt Port und das schwarze Fenster',
   /47392/.test(weg.status[0]?.titel||'')&&/Fenster/.test(weg.status[0]?.titel||''), weg.status[0]?.titel);
 p('auch die Klartextliste sagt es', /antwortet nicht/i.test(weg.liste), weg.liste.replace(/\n/g,' | '));

 p('keine Skriptfehler ueber den ganzen Lauf', fehler.length===0, fehler.slice(0,2).join(' | ')||'keine');
 await b.close();
 try{web.closeAllConnections&&web.closeAllConnections()}catch(e){}
 web.close();
 console.log(`\nVerbindungs-LED im Manager: ${ok}/${ok+rot} bestanden`);
 process.exit(rot?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
