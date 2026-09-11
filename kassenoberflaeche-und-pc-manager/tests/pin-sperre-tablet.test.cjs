/* PIN-Sperre auf dem Tablet: eigener Ziffernblock, keine Bildschirmtastatur noetig,
   und das Fenster liegt oben - nicht dort, wo eine Tastatur es zudecken wuerde. */
const {chromium, devices}=require('playwright');
const http=require('http'), fs=require('fs'), path=require('path');
const WURZEL=path.resolve(__dirname,'..');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.webmanifest':'application/manifest+json'};
let ok=0,rot=0; const p=(n,b,z='')=>{b?ok++:rot++;console.log(`${b?'  OK  ':'FEHLER'}  ${n}${z?'   ['+z+']':''}`)};

// Die Startfenster kommen NACHEINANDER (Vollbild-Hinweis, dann Systempruefung) - und die
// PIN-Sperre erscheint mit Absicht erst, wenn beide weg sind. Deshalb wird hier so lange
// weggeraeumt, bis sie da ist, statt einmal blind zu warten.
async function bisZurPinSperre(pg, sekunden=25){
  for(let i=0;i<sekunden*2;i++){
    const da=await pg.evaluate(()=>{
      const g=document.getElementById('fullscreenGate'); if(g&&!g.hidden)g.hidden=true;
      const ok=document.getElementById('kcStartupOk');
      if(ok){let n=ok;while(n&&getComputedStyle(n).position!=='fixed')n=n.parentElement;(n||ok).remove()}
      return !!document.getElementById('kcPinLockOverlay');
    });
    if(da)return true;
    await pg.waitForTimeout(500);
  }
  return false;
}

(async()=>{
 const s=http.createServer((q,r)=>{const f=path.join(WURZEL,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end('x')}r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(d)})});
 await new Promise(r=>s.listen(8775,r));
 const b=await chromium.launch();
 // iPad quer, mit Fingerbedienung
 const ctx=await b.newContext({viewport:{width:1080,height:810},hasTouch:true,isMobile:false});
 const pg=await ctx.newPage();
 const fehler=[]; pg.on('pageerror',e=>fehler.push(e.message));
 await pg.goto('http://127.0.0.1:8775/pos/index.html'); await pg.waitForTimeout(7000);

 const da=await bisZurPinSperre(pg);
 p('die PIN-Sperre erscheint', da===true);
 if(!da){console.log('\nAbbruch: keine Sperre');await b.close();s.close();process.exit(1)}

 const lage=await pg.evaluate(()=>{
   const o=document.getElementById('kcPinLockOverlay');
   const box=o.firstElementChild.getBoundingClientRect();
   const feld=document.getElementById('kcPinInput').getBoundingClientRect();
   return {oben:Math.round(box.top), feldUnterkante:Math.round(feld.bottom), hoehe:window.innerHeight,
     ausrichtung:getComputedStyle(o).alignItems, scrollbar:getComputedStyle(o).overflow};
 });
 // Die Bildschirmtastatur eines iPads belegt rund die untere Haelfte. Alles, was zum Tippen
 // gebraucht wird, muss oberhalb davon liegen.
 p('das Fenster sitzt oben, nicht mittig', lage.ausrichtung==='flex-start', lage.ausrichtung);
 p('das Eingabefeld liegt in der oberen Bildschirmhaelfte',
   lage.feldUnterkante < lage.hoehe*0.5, `Unterkante ${lage.feldUnterkante} von ${lage.hoehe}`);
 p('das Fenster ist scrollbar, falls es doch einmal eng wird', /auto|scroll/.test(lage.scrollbar), lage.scrollbar);

 const block=await pg.evaluate(()=>{
   const knoepfe=[...document.querySelectorAll('[data-pin-taste]')];
   const feld=document.getElementById('kcPinInput');
   return {anzahl:knoepfe.length, ziffern:knoepfe.map(k=>k.dataset.pinTaste).join(''),
     kleinste:Math.min(...knoepfe.map(k=>k.getBoundingClientRect().height)),
     tastaturAus:feld.getAttribute('inputmode')};
 });
 p('es gibt einen eigenen Ziffernblock', block.anzahl===11, `${block.anzahl} Tasten: ${block.ziffern}`);
 p('die Tasten sind mit dem Daumen zu treffen (mind. 60 px)', block.kleinste>=60, `${block.kleinste} px`);
 p('die Bildschirmtastatur wird gar nicht erst geoeffnet', block.tastaturAus==='none', String(block.tastaturAus));

 // PIN mit dem Ziffernblock setzen - genau wie am Stand, ohne Tastatur
 for(const z of ['2','6','0','9']) await pg.click(`[data-pin-taste="${z}"]`);
 const eingabe=await pg.evaluate(()=>document.getElementById('kcPinInput').value);
 p('der Ziffernblock schreibt in das Feld', eingabe==='2609', eingabe);

 await pg.click('[data-pin-taste="⌫"]');
 p('die Löschtaste nimmt die letzte Ziffer weg',
   await pg.evaluate(()=>document.getElementById('kcPinInput').value==='260'),
   await pg.evaluate(()=>document.getElementById('kcPinInput').value));
 await pg.click('[data-pin-taste="9"]');

 await pg.click('#kcPinSubmit'); await pg.waitForTimeout(1200);
 p('mit dem Knopf laesst sich die PIN festlegen - ganz ohne Tastatur',
   await pg.evaluate(()=>!document.getElementById('kcPinLockOverlay')));

 // Und beim naechsten Sperren muss dieselbe PIN wieder aufschliessen
 await pg.evaluate(()=>{localStorage.removeItem('kc_nichts');});
 await pg.reload(); await pg.waitForTimeout(6000);
 const wieder=await bisZurPinSperre(pg);
 p('nach einem Neustart wird wieder nach der PIN gefragt', wieder===true);
 if(wieder){
   for(const z of ['2','6','0','9']) await pg.click(`[data-pin-taste="${z}"]`);
   await pg.click('#kcPinSubmit'); await pg.waitForTimeout(1200);
   p('dieselbe PIN schliesst wieder auf', await pg.evaluate(()=>!document.getElementById('kcPinLockOverlay')));
   const text=await pg.evaluate(()=>document.getElementById('kcPinError')?.textContent||'(Fenster zu)');
   p('keine Fehlermeldung dabei', /Fenster zu/.test(text)||text.trim()==='', text);
 }

 p('keine Skriptfehler ueber den ganzen Lauf', fehler.length===0, fehler.slice(0,2).join(' | ')||'keine');
 await pg.screenshot({path:path.join(WURZEL,'tests','pin-sperre-tablet.png')});
 await b.close(); s.close();
 console.log(`\nPIN-Sperre auf dem Tablet: ${ok}/${ok+rot} bestanden`);
 process.exit(rot?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
