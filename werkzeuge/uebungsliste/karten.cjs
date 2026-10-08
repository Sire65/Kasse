// Karteikarten zum Kassen-Training erzeugen: node werkzeuge/uebungsliste/karten.cjs
// Vorderseite = Aufgabe, Rueckseite = Loesung. A4 beidseitig drucken ("an der langen Kante wenden"),
// je Blatt 4 Karten 95 x 130 mm mit Schnittmarken. Die Rueckseiten sind dafuer gespiegelt angeordnet
// (linke Karte vorne = rechte Karte hinten), damit jede Loesung genau hinter ihrer Aufgabe liegt.
// Gleiche Aufgaben (daten.js) und Gestaltung wie die Uebungsliste bzw. die Club-App-Unterlagen.
const fs=require('fs'),path=require('path');const pw=require('playwright');const D=require('./daten.js');
const ZIEL=path.join(__dirname,'..','..','schulung','uebungsliste');
const VERSION='Version 1',STAND='07.10.2026';
const b64=f=>'data:image/png;base64,'+fs.readFileSync(path.join(__dirname,f)).toString('base64');
const LOGO=b64('logo.png'),HUT=b64('hut.png');
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const fett=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
// Karten sammeln
let nr=0;const karten=[];
D.forEach(st=>st.aufgaben.forEach(a=>{nr++;karten.push({nr,stufe:st.stufe,punkte:st.punkte,...a})}));
const gesamt=karten.length;
// Masse (mm): Karte 95 x 130, Abstand 8, auf A4 zentriert
const KB=95,KH=130,AB=8,X0=(210-2*KB-AB)/2,Y0=(297-2*KH-AB)/2;
const pos=(i,rueck)=>{const r=Math.floor(i/2),c=i%2;const cc=rueck?1-c:c;return {x:X0+cc*(KB+AB),y:Y0+r*(KH+AB)}};
const marken=()=>{let h='';const xs=[X0,X0+KB,X0+KB+AB,X0+2*KB+AB],ys=[Y0,Y0+KH,Y0+KH+AB,Y0+2*KH+AB];
 // kurze Linien ausserhalb der Karten: senkrecht oben/unten bzw. im Zwischenraum, waagerecht links/rechts
 xs.forEach(x=>{h+=`<i class="m v" style="left:${x}mm;top:${Y0-6}mm;height:4.5mm"></i><i class="m v" style="left:${x}mm;top:${Y0+2*KH+AB+1.5}mm;height:4.5mm"></i><i class="m v" style="left:${x}mm;top:${Y0+KH+1.5}mm;height:${AB-3}mm"></i>`});
 ys.forEach(y=>{h+=`<i class="m h" style="top:${y}mm;left:${X0-6}mm;width:4.5mm"></i><i class="m h" style="top:${y}mm;left:${X0+2*KB+AB+1.5}mm;width:4.5mm"></i><i class="m h" style="top:${y}mm;left:${X0+KB+1.5}mm;width:${AB-3}mm"></i>`});return h};
const kopf=k=>`<div class="kk"><img src="${LOGO}"><span>Kassen-Training</span><em>${esc(k.stufe.split(' · ')[0])} · ${'●'.repeat(k.punkte)}${'○'.repeat(5-k.punkte)}</em></div>`;
const vorne=k=>{const lage=k.k.startsWith('(');return `${kopf(k)}<div class="vinhalt"><div class="nrgross">${k.nr}</div><div class="thema">${esc(k.stufe.split(' · ')[1])}</div>
 <div class="was ${lage?'lage':''}">${lage?'Lage':'Kunde sagt'}</div><div class="satz ${lage?'lage':''}">${esc(lage?k.k.slice(1,-1):'„'+k.k+'“')}</div>${k.neu?'<span class="ge">ZUSÄTZLICH</span>':''}</div>
 <div class="kf">Was tippst du an der Kasse? · Lösung auf der Rückseite ↻</div>`};
const hinten=k=>`${kopf(k)}<div class="hinhalt"><div class="ltitel"><span class="nr">${k.nr}</span>Lösung</div><ol>${k.s.map(x=>`<li>${fett(x)}</li>`).join('')}</ol>${k.w?`<div class="wege"><b>Andere Wege:</b><ul>${k.w.map(x=>`<li>${fett(x)}</li>`).join('')}</ul></div>`:''}<div class="kontrolle"><b>Kontrolle:</b> ${fett(k.e)}</div></div>
 <div class="kf"><b style="color:#2e7d32">✓ Gewusst</b> → Stapel „Kann ich“ &nbsp;·&nbsp; <b style="color:#c62828">✗ Nicht gewusst</b> → Stapel „Üben“</div>`;
const karte=(inhalt,p)=>`<div class="karte" style="left:${p.x}mm;top:${p.y}mm"><div class="kin">${inhalt}</div></div>`;
let seiten='';
// Seite 1: Anleitung (A4, Stil der Club-App-Unterlagen), Seite 2 bleibt fuer den beidseitigen Druck leer
seiten+=`<div class="seite anl"><div class="akopf"><img src="${LOGO}"><b>Köcheclub Werne</b><span>Kassen-Training · Karteikarten · ${VERSION}</span></div>
<div class="titelblatt"><img src="${HUT}" style="width:62pt"><div class="t1">Köcheclub Werne</div><div class="t2">Kassen-Training — Karteikarten</div><div class="t3">${gesamt} Karten · ${VERSION} · Stand ${STAND} · dieselben Aufgaben wie in der Übungsliste</div></div>
<h3 class="gruen">Alleine üben mit zwei Stapeln</h3>
<div class="kasten"><ol>
 <li>Karten gut mischen oder nach Nummer sortieren (die Nummern werden von 1 bis ${gesamt} schwieriger).</li>
 <li><b>Vorderseite</b> lesen: was sagt der Kunde, was ist die Lage?</li>
 <li>An der <b>Schulungs-Kasse</b> ausführen – oder im Kopf durchgehen, welche Knöpfe du antippst.</li>
 <li>Karte umdrehen und mit der <b>Lösung</b> auf der Rückseite vergleichen. Oben steht der einfachste Weg, unter „<b>Andere Wege</b>“ weitere, die genauso richtig sind.</li>
 <li><b style="color:#2e7d32">Gewusst</b> → Karte auf den Stapel <b>„Kann ich“</b>. <b style="color:#c62828">Nicht gewusst</b> → auf den Stapel <b>„Üben“</b>.</li>
 <li>Wenn alle Karten durch sind: nur mit dem Stapel <b>„Üben“</b> weitermachen – so lange, bis er leer ist.</li></ol>
 <p>Zu zweit geht es auch: einer liest die Vorderseite vor wie ein Kunde, der andere kassiert.</p></div>
<h3 class="gruen">Drucken und schneiden</h3>
<div class="kasten"><ul>
 <li><b>Beidseitig</b> drucken, Einstellung <b>„an der langen Kante wenden“</b>, Größe <b>100 %</b> (nicht „an Seite anpassen“).</li>
 <li>Am besten auf festerem Papier (160–200 g/m²). Seite 2 bleibt leer, damit Vorder- und Rückseiten zusammenpassen.</li>
 <li>Entlang der kurzen Striche (Schnittmarken) schneiden – je Blatt 4 Karten, 95 × 130 mm.</li>
 <li>Probe: Auf Karte 1 steht vorne „Eierpunsch“ und hinten die Lösung zu Aufgabe 1.</li></ul>
 <p><b>Beachte:</b> Einige Funktionen können sich mit der Zeit noch ändern, weil ständig am Bilderrechner weiterentwickelt wird.</p></div>
</div><div class="seite"><div class="leer">Diese Seite bleibt für den beidseitigen Druck leer.</div></div>`;
for(let i=0;i<karten.length;i+=4){const gruppe=karten.slice(i,i+4);
 seiten+=`<div class="seite">${marken()}${gruppe.map((k,j)=>karte(vorne(k),pos(j,false))).join('')}</div>`;
 seiten+=`<div class="seite">${marken()}${gruppe.map((k,j)=>karte(hinten(k),pos(j,true))).join('')}</div>`;}
const CSS=`@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0}
body{font-family:Carlito,'Liberation Sans',sans-serif;color:#111;font-size:10pt;line-height:1.3;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.seite{width:210mm;height:297mm;position:relative;overflow:hidden;break-after:page}
.m{position:absolute;background:#111}.m.v{width:.25mm}.m.h{height:.25mm}
.karte{position:absolute;width:${KB}mm;height:${KH}mm;border:.2mm dotted #c9ced6;overflow:hidden}
.kin{position:absolute;inset:4mm 5mm;display:flex;flex-direction:column}
.kk{display:flex;align-items:flex-end;gap:2mm;border-bottom:.35mm solid #173765;padding-bottom:1.2mm}.kk img{width:9mm}.kk span{color:#173765;font-weight:700;font-size:9.5pt}.kk em{margin-left:auto;font-style:normal;color:#5b6572;font-size:8pt;letter-spacing:.2pt}
.vinhalt{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:2mm 1mm}
.nrgross{width:15mm;height:15mm;background:#2e7d32;color:#fff;font-size:21pt;font-weight:700;display:flex;align-items:center;justify-content:center;border-radius:1mm;margin-bottom:2.5mm}
.thema{color:#2e7d32;font-size:10.5pt;margin-bottom:5mm}
.was{font-size:7.5pt;font-weight:700;letter-spacing:.3pt;text-transform:uppercase;color:#fff;background:#173765;border-radius:.6mm;padding:.3mm 1.5mm;margin-bottom:2mm}.was.lage{background:#5b6572}
.satz{font-size:14.5pt;font-weight:700;color:#173765;line-height:1.25}.satz.lage{color:#5b6572;font-style:italic;font-size:13pt}
.ge{display:inline-block;color:#fff;font-size:7pt;font-weight:700;padding:.3mm 1.2mm;border-radius:.6mm;background:#c2410c;margin-top:3mm}
.kf{border-top:.2mm solid #c9ced6;padding-top:1.2mm;color:#5b6572;font-size:7.6pt;text-align:center}
.hinhalt{flex:1;padding-top:2.5mm;overflow:hidden}
.ltitel{color:#2e7d32;font-size:13pt;margin-bottom:2mm;display:flex;align-items:center;gap:2mm}.ltitel .nr{width:7.5mm;height:7.5mm;background:#2e7d32;color:#fff;font-weight:700;font-size:11pt;display:flex;align-items:center;justify-content:center;border-radius:.6mm}
ol{margin:0 0 2.5mm;padding-left:4.5mm}ol li{margin-bottom:1.6mm}ol b,.kontrolle b{color:#173765}
.wege{font-size:.86em;color:#334155;background:#f1f5f9;border-left:.9mm solid #9aa3ad;padding:1.2mm 2.2mm;margin:0 0 2.2mm}.wege>b{color:#5b6572}.wege ul{margin:.6mm 0 0;padding-left:4mm}.wege li{margin-bottom:.6mm}.wege b{color:#173765}
.kontrolle{border-left:.9mm solid #2e7d32;background:#e8f5ec;padding:1.5mm 2.4mm;font-size:.93em}
.anl{padding:0}.akopf{position:absolute;left:19mm;right:19mm;top:8.5mm;height:11mm;border-bottom:.4mm solid #173765;display:flex;align-items:flex-end;padding-bottom:1.5mm}.akopf img{width:11mm;margin-right:2mm}.akopf b{color:#173765;font-size:11pt}.akopf span{margin-left:auto;color:#5b6572;font-size:9pt}
.anl .titelblatt,.anl h3,.anl .kasten{margin-left:19mm;margin-right:19mm}
.titelblatt{text-align:center;padding-top:38mm}.t1{font-family:'Liberation Sans',sans-serif;color:#173765;font-size:26pt;margin-top:6pt}.t2{color:#5b6572;font-weight:700;font-size:15pt}.t3{color:#5b6572;font-size:8.5pt;margin-top:4pt}
h3.gruen{color:#2e7d32;font-size:13.5pt;font-weight:400;margin-top:16pt;margin-bottom:6pt}
.kasten{border:1pt solid #9fd3a8;border-left:3pt solid #2e7d32;background:#e8f5ec;padding:9pt 12pt;font-size:10.3pt}.kasten ol,.kasten ul{margin:0 0 4pt;padding-left:16pt}.kasten li{margin-bottom:3pt}.kasten p{margin:4pt 0 0}
.leer{position:absolute;top:140mm;width:100%;text-align:center;color:#9aa3ad;font-size:9pt}`;
const html=`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Kassen-Training · Karteikarten</title><style>${CSS}</style></head><body>${seiten}</body></html>`;
const datei=path.join(__dirname,'.karten.html');fs.writeFileSync(datei,html);
(async()=>{const b=await pw.chromium.launch();const p=await b.newPage();await p.goto('file://'+datei);await p.waitForTimeout(500);
 // Passt jede Loesung auf die Karte? Sonst Schrift dieser Karte verkleinern.
 const zuVoll=await p.evaluate(()=>{const z=[];document.querySelectorAll('.hinhalt,.vinhalt').forEach(h=>{let f=h.classList.contains('hinhalt')?12:10;h.style.fontSize=f+'pt';while(h.scrollHeight>h.clientHeight+1&&f>7.5){f-=0.25;h.style.fontSize=f+'pt';}if(f<(h.classList.contains('hinhalt')?12:10))z.push(h.querySelector('.nr,.nrgross')?.textContent+':'+f+'pt');if(h.scrollHeight>h.clientHeight+1)z.push('ZU VOLL '+h.querySelector('.nr,.nrgross')?.textContent)});return z});
 console.log('verkleinert:',zuVoll.join(' ')||'keine');
 await p.pdf({path:path.join(ZIEL,'Kassen-Training_Karteikarten.pdf'),width:'210mm',height:'297mm',printBackground:true,margin:{top:0,bottom:0,left:0,right:0}});
 await b.close();fs.unlinkSync(datei);console.log('fertig: Karteikarten-PDF in',ZIEL,'·',gesamt,'Karten')})();
