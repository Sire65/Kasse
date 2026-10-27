// Karteikarten zum Bilderrechner-Training erzeugen: node werkzeuge/uebungsliste/karten.cjs
// Standard: 3 x 3 = 9 Karten je Blatt (Bilderrechner-Training_Karteikarten.pdf).
// Vorderseite = Aufgabe, Rueckseite = Loesung. A4 beidseitig drucken ("an der langen Kante wenden"),
// je Blatt SP x ZE Karten mit Schnittmarken (Standard 3 x 3). Die Rueckseiten sind dafuer gespiegelt angeordnet
// (linke Karte vorne = rechte Karte hinten), damit jede Loesung genau hinter ihrer Aufgabe liegt.
// Gleiche Aufgaben (daten.js) und Gestaltung wie die Uebungsliste bzw. die Club-App-Unterlagen.
const fs=require('fs'),path=require('path');const pw=require('playwright');const D=require('./daten.js');const exaktA4=require('./a4.cjs');
const ZIEL=path.join(__dirname,'..','..','schulung','uebungsliste');
const VERSION='Version 4.6',STAND='27.10.2026';
const b64=f=>'data:image/png;base64,'+fs.readFileSync(path.join(__dirname,f)).toString('base64');
const LOGO=b64('logo.png'),HUT=b64('hut.png');
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const fett=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
// Karten sammeln
let nr=0;const karten=[];
D.forEach(st=>st.aufgaben.forEach(a=>{nr++;karten.push({nr,stufe:st.stufe,punkte:st.punkte,niveau:a.n||st.niveau,...a})}));
// Ampel: einfach = gruen, mittel = gelb/orange, schwer = rot (oben auf jeder Karte, vorne und hinten)
const NIV={einfach:{f:'#2e7d32',t:'EINFACH',i:0},mittel:{f:'#d97706',t:'MITTEL',i:1},schwer:{f:'#c62828',t:'SCHWER',i:2}};
const ampel=k=>{const n=NIV[k.niveau];const dots=['#4ade80','#fbbf24','#f87171'].map((c,i)=>`<i style="background:${i===n.i?c:'#4b5563'};${i===n.i?'box-shadow:0 0 0 .3mm #fff':''}"></i>`).join('');return `<div class="ampel" style="background:${n.f}"><span class="lichter">${dots}</span><b>${n.t}</b><em>Bilderrechner-Training · Nr. ${k.nr}</em></div>`};
const gesamt=karten.length;
// Masse (mm): Karte 95 x 130, Abstand 8, auf A4 zentriert
// Raster: SP Karten nebeneinander, ZE untereinander (per Umgebung SP/ZE einstellbar). Karteninhalt ist fuer
// 95 mm Breite gestaltet und wird auf die tatsaechliche Kartengroesse verkleinert (Z = Massstab).
// Version 4 (Betreiber 10.10.2026: "nur 1 Schnitt zwischen den Karten"): Karten stossen ohne Zwischenraum aneinander
// (AB=0) -> je Blatt nur 8 durchgehende Schnitte. Aussen 8 mm Rand fuer die Schnittmarken; in jeder Karte bleiben
// 3 mm rundum frei (Sicherheitsrand), damit ein schiefer Schnitt oder 1-2 mm Druckversatz nie Text trifft.
// VX/VY (mm): verschiebt nur die Rueckseiten, falls ein Drucker sie immer gleich versetzt druckt.
// Version 4.4 (Betreiber 26.10.2026: "Text nicht zu nah an den Schneiderand, ich schneide manuell"): Freirand in jeder Karte
// von 3 auf 6 mm (SICHER). Reicht fuer ca. 2 mm Schnittungenauigkeit plus 1-2 mm Versatz der Rueckseite im Duplexdruck.
// Kartengroesse und "1 Schnitt zwischen den Karten" bleiben; der Inhalt wird entsprechend kleiner (Z).
const SP=Number(process.env.SP||3),ZE=Number(process.env.ZE||3),JE=SP*ZE,RAND=8,AB=0,SICHER=6,VX=Number(process.env.VX||0),VY=Number(process.env.VY||0);
const KB=(210-2*RAND-(SP-1)*AB)/SP,KH=(297-2*RAND-(ZE-1)*AB)/ZE,X0=RAND,Y0=RAND,Z=(KB-2*SICHER)/85;
const pos=(i,rueck)=>{const r=Math.floor(i/SP),c=i%SP;const cc=rueck?SP-1-c:c;return {x:X0+cc*(KB+AB)+(rueck?VX:0),y:Y0+r*(KH+AB)+(rueck?VY:0)}};
// Schnittmarken nur am Blattrand: je Schnittlinie ein Strich oben+unten bzw. links+rechts (Lineal von Strich zu Strich).
// Striche von 2 bis 7 mm vom Blattrand - auch Drucker mit 4 mm unbedruckbarem Rand zeigen davon noch genug.
const marken=(dx=0,dy=0)=>{let h='';const L=RAND-3;
 for(let c=0;c<=SP;c++){const x=X0+c*KB+dx;h+=`<i class="m v" style="left:${x}mm;top:2mm;height:${L}mm"></i><i class="m v" style="left:${x}mm;top:${297-2-L}mm;height:${L}mm"></i>`}
 for(let r=0;r<=ZE;r++){const y=Y0+r*KH+dy;h+=`<i class="m h" style="top:${y}mm;left:2mm;width:${L}mm"></i><i class="m h" style="top:${y}mm;left:${210-2-L}mm;width:${L}mm"></i>`}
 // Version 4.3 (Betreiber 22.10.2026: "ich schneide mit dem Schneidegeraet (Blatt auflegen, Messer runter) – ich brauche mehr Schnittmarken,
 // damit ich an jeder Stelle sehe, wo ich schneiden muss"): nach dem ersten Schnitt fehlten den inneren Streifen die Striche vom Blattrand.
 // Jetzt zusaetzlich (1) an JEDER Ecke jeder Karte ein Kreuz (Arme 2,5 mm – liegen im Freirand, treffen nie Text) und
 // (2) jede Schnittlinie als feine graue Strichellinie quer ueber das ganze Blatt. So sieht man auf jedem Streifen und jeder Karte, wo das Messer hin muss.
 const A=2.5,xs=[...Array(SP+1)].map((_,c)=>X0+c*KB+dx),ys=[...Array(ZE+1)].map((_,r)=>Y0+r*KH+dy);
 for(const x of xs)h+=`<i class="sl v" style="left:${x}mm;top:${Y0+dy}mm;height:${ZE*KH}mm"></i>`;
 for(const y of ys)h+=`<i class="sl h" style="top:${y}mm;left:${X0+dx}mm;width:${SP*KB}mm"></i>`;
 for(const x of xs)for(const y of ys)h+=`<i class="m v" style="left:${x}mm;top:${y-A}mm;height:${2*A}mm"></i><i class="m h" style="top:${y}mm;left:${x-A}mm;width:${2*A}mm"></i>`;
 return h};
const kopf=k=>ampel(k);
const vorne=k=>{const lage=k.k.startsWith('(');return `${kopf(k)}<div class="vkopf"><div class="nrgross">${k.nr}</div><div class="thema">${esc(k.stufe.split(' · ')[1])}</div></div><div class="vinhalt">
 <div class="was ${lage?'lage':''}">${lage?'Lage':'Kunde sagt'}</div><div class="satz ${lage?'lage':''}">${esc(lage?k.k.slice(1,-1):'„'+k.k+'“')}</div></div>
 <div class="kf">Was tippst du an der Kasse? · Lösung auf der Rückseite ↻</div>`};
const hinten=k=>`${kopf(k)}<div class="hinhalt"><div class="ltitel"><span class="nr">${k.nr}</span>Lösung</div><ol>${k.s.map(x=>`<li>${fett(x)}</li>`).join('')}</ol>${k.w?`<div class="wege"><b>Andere Wege:</b><ul>${k.w.map(x=>`<li>${fett(x)}</li>`).join('')}</ul></div>`:''}<div class="kontrolle"><b>Kontrolle:</b> ${fett(k.e)}</div></div>
 <div class="ankreuzen">${[['ok','✓','Gewusst'],['nein','✗','Nicht gewusst']].map(([c,z,t])=>`<div class="ak-reihe ${c}"><span class="ak-t"><b>${z}</b> ${t}</span><span class="ak-boxen">${'<span class="ak-b"></span>'.repeat(5)}</span></div>`).join('')}</div>
 <div class="kf stapel"><span>← <b class="g">✓</b> Stapel „Kann ich“</span><span>Stapel „Üben“ <b class="r">✗</b> →</span></div>`;
const karte=(inhalt,p)=>`<div class="karte" style="left:${p.x}mm;top:${p.y}mm"><div class="kin">${inhalt}</div></div>`;
let seiten='';
// Seite 1: Anleitung (A4, Stil der Club-App-Unterlagen), Seite 2 bleibt fuer den beidseitigen Druck leer
seiten+=`<div class="seite anl"><div class="akopf"><img src="${LOGO}"><b>Köcheclub Werne</b><span>Bilderrechner-Training · Karteikarten · ${VERSION}</span></div>
<div class="titelblatt"><img src="${HUT}" style="width:44pt"><div class="t1">Köcheclub Werne</div><div class="t2">Bilderrechner-Training — Karteikarten</div><div class="t3">${gesamt} Karten · ${VERSION} · Stand ${STAND} · dieselben Aufgaben wie in der Übungsliste</div></div>
<div class="bleistift"><div class="bs-icon">✏️</div><div class="bs-text"><div class="bs-titel">Bitte mit Bleistift ankreuzen!</div>
 <div>Die Kästchen <b>„Gewusst?“</b> <span class="bs-box"></span>&nbsp;<b style="color:#2e7d32">✓</b>&nbsp; <span class="bs-box"></span>&nbsp;<b style="color:#c62828">✗</b> nur mit <b>Bleistift</b> ausfüllen. Danach einfach <b>ausradieren</b> – so können die Karten immer wieder verwendet werden.</div></div></div>
<h3 class="gruen">Alleine üben mit zwei Stapeln</h3>
<div class="kasten"><ol>
 <li>Die <b>Ampel</b> oben auf jeder Karte zeigt die Schwierigkeit: <b style="color:#2e7d32">grün = einfach</b>, <b style="color:#d97706">gelb = mittel</b>, <b style="color:#c62828">rot = schwer</b>. Am besten mit den grünen anfangen.</li>
 <li>Karten mischen oder nach Nummer sortieren.</li>
 <li><b>Vorderseite</b> lesen: was sagt der Kunde, was ist die Lage?</li>
 <li>An der <b>Schulungs-Kasse</b> ausführen – oder im Kopf durchgehen, welche Knöpfe du antippst.</li>
 <li>Karte umdrehen und mit der <b>Lösung</b> auf der Rückseite vergleichen. Oben steht der einfachste Weg, unter „<b>Andere Wege</b>“ weitere, die genauso richtig sind.</li>
 <li>Unten auf der Rückseite ankreuzen: <b style="color:#2e7d32">✓ gewusst</b> oder <b style="color:#c62828">✗ nicht gewusst</b> – mit <b>Bleistift</b>, Platz für fünf Durchgänge. <b style="color:#2e7d32">Gewusst</b> → Karte auf den Stapel <b>„Kann ich“</b>. <b style="color:#c62828">Nicht gewusst</b> → auf den Stapel <b>„Üben“</b>.</li>
 <li>Wenn alle Karten durch sind: nur mit dem Stapel <b>„Üben“</b> weitermachen – so lange, bis er leer ist.</li>
 <li>Auf dem letzten Blatt: zwei <b>Stapelkarten</b> „✓ Kann ich“ und „✗ Üben“ als Trenner sowie leere Karten für <b>eigene Aufgaben</b> (mit Bleistift).</li></ol>
 <p>Zu zweit geht es auch: einer liest die Vorderseite vor wie ein Kunde, der andere kassiert.</p>
 <p>Die Schulungs-Kasse verhält sich genauso wie die echte Kasse. Ausführlich mit Bildern: <b>Kurzanleitung Bilderrechner 4.2</b> in der Club-App.</p></div>
<h3 class="gruen">Drucken und schneiden</h3>
<div class="kasten"><ul>
 <li><b>Beidseitig</b> drucken, Einstellung <b>„an der langen Kante wenden“</b>, Größe <b>100 %</b> (nicht „an Seite anpassen“).</li>
 <li>Am besten auf festerem Papier (160–200 g/m²). Seite 2 bleibt leer, damit Vorder- und Rückseiten zusammenpassen.</li>
 <li>Die Karten liegen ohne Abstand aneinander: Lineal von Strich zu Strich am Blattrand anlegen und <b>einmal durchgehend schneiden</b> – je Blatt nur ${SP+1} Schnitte längs und ${ZE+1} quer. Ergibt ${JE} Karten, ${KB.toFixed(0)} × ${KH.toFixed(0)} mm.</li>
 <li>Jede Karte hat innen ${SICHER} mm freien Rand – auch ein schiefer Schnitt oder eine leicht verschobene Rückseite trifft keinen Text.</li>
 <li><b>Schneidegerät:</b> Jede Schnittlinie ist als feine graue Strichellinie über das ganze Blatt gedruckt, an jeder Kartenecke steht ein kleines Kreuz <b>+</b>. Auch nach den ersten Schnitten siehst du auf jedem Streifen, wo das Messer hin muss.</li>
 <li>Probe: Auf Karte 1 steht vorne „Eierpunsch“ und hinten die Lösung zu Aufgabe 1.</li></ul>
 <p><b>Beachte:</b> Einige Funktionen können sich mit der Zeit noch ändern, weil ständig am Bilderrechner weiterentwickelt wird.</p></div>
<div class="afuss"><span>Köcheclub Werne · Bilderrechner-Training · Karteikarten</span><span>${VERSION} · Stand ${STAND}</span></div></div><div class="seite"><div class="leer">Diese Seite bleibt für den beidseitigen Druck leer.</div></div>`;
// Freie Plaetze auf dem letzten Blatt (Betreiber 10.10.2026: "bleibt noch Platz?"): zuerst die zwei Stapelkarten
// als Trenner, dann leere Karten fuer eigene Aufgaben (mit Bleistift beschreiben).
const rest=(JE-karten.length%JE)%JE;
const extra=[{sp:'kann'},{sp:'ueben'},{sp:'eigen'},{sp:'eigen'},{sp:'eigen'},{sp:'eigen'},{sp:'eigen'},{sp:'eigen'},{sp:'eigen'}].slice(0,rest);
const SPEZ={kann:{f:'#2e7d32',z:'✓',t:'Kann ich',x:'Hierhin kommen die Karten, die du <b>gewusst</b> hast.'},ueben:{f:'#c62828',z:'✗',t:'Üben',x:'Hierhin kommen die Karten, die du <b>noch nicht gewusst</b> hast. Mit diesem Stapel machst du weiter, bis er leer ist.'}};
const band=(f,t)=>`<div class="ampel" style="background:${f}"><b>${t}</b><em>Bilderrechner-Training</em></div>`;
const linien=n=>'<div class="linie"></div>'.repeat(n);
const sVorne=e=>e.sp==='eigen'?`${band('#173765','EIGENE AUFGABE')}<div class="eigen"><div class="was">Kunde sagt / Lage</div>${linien(6)}</div><div class="kf">Mit Bleistift ausfüllen · Lösung auf der Rückseite ↻</div>`
 :`${band(SPEZ[e.sp].f,'STAPEL')}<div class="stapelkarte" style="color:${SPEZ[e.sp].f}"><div class="sz">${SPEZ[e.sp].z}</div><div class="st">${SPEZ[e.sp].t}</div></div><div class="kf">Bilderrechner-Training · Stapelkarte</div>`;
const sHinten=e=>e.sp==='eigen'?`${band('#173765','EIGENE AUFGABE')}<div class="eigen"><div class="ltitel">Lösung</div>${linien(8)}</div>`
 :`${band(SPEZ[e.sp].f,'STAPEL')}<div class="stapelkarte klein" style="color:${SPEZ[e.sp].f}"><div class="sz">${SPEZ[e.sp].z}</div><div class="st">${SPEZ[e.sp].t}</div><p>${SPEZ[e.sp].x}</p></div>`;
const alle=[...karten,...extra];
for(let i=0;i<alle.length;i+=JE){const gruppe=alle.slice(i,i+JE);
 seiten+=`<div class="seite">${marken()}${gruppe.map((k,j)=>karte(k.sp?sVorne(k):vorne(k),pos(j,false))).join('')}</div>`;
 seiten+=`<div class="seite">${marken(VX,VY)}${gruppe.map((k,j)=>karte(k.sp?sHinten(k):hinten(k),pos(j,true))).join('')}</div>`;}
const CSS=`@page{size:A4;margin:0}.bleistift{display:flex;align-items:center;gap:12pt;margin:10pt 0 4pt;padding:11pt 14pt;border:1.6pt solid #173765;border-radius:6pt;background:linear-gradient(90deg,#fff7d6,#fffbe9);box-shadow:0 1.5pt 0 #d97706 inset}.bs-icon{font-size:30pt;line-height:1;transform:rotate(-8deg)}.bs-titel{font-size:15.5pt;font-weight:700;color:#173765;margin-bottom:3pt}.bs-text{font-size:11pt;line-height:1.38}.bs-box{display:inline-block;width:10pt;height:10pt;border:1.3pt solid #111;border-radius:1.5pt;vertical-align:-1pt;background:#fff}*{box-sizing:border-box}html,body{margin:0}
body{font-family:Carlito,'Liberation Sans',sans-serif;color:#111;font-size:10pt;line-height:1.3;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.seite{width:210mm;height:297mm;position:relative;overflow:hidden;break-after:page}
.m{position:absolute;background:#111;z-index:3}.m.v{width:.25mm;margin-left:-.125mm}.m.h{height:.25mm;margin-top:-.125mm}
.sl{position:absolute;z-index:2}.sl.v{width:0;border-left:.18mm dashed #8a929c;margin-left:-.09mm}.sl.h{height:0;border-top:.18mm dashed #8a929c;margin-top:-.09mm}
.karte{position:absolute;width:${KB}mm;height:${KH}mm;overflow:hidden}
.kin{position:absolute;left:${SICHER/Z}mm;top:${SICHER/Z}mm;width:85mm;height:${(KH-2*SICHER)/Z}mm;zoom:${Z};display:flex;flex-direction:column}
.ampel{display:flex;align-items:center;gap:2mm;color:#fff;border-radius:1mm;padding:1.4mm 2.2mm;margin-bottom:1mm}.ampel b{font-size:13pt;letter-spacing:.6pt}.ampel em{margin-left:auto;font-style:normal;font-size:10pt;opacity:.95;white-space:nowrap}.lichter{display:inline-flex;gap:1.1mm;background:#1f2937;padding:.9mm 1.4mm;border-radius:2mm}.lichter i{width:2.6mm;height:2.6mm;border-radius:50%;display:block}
.ankreuzen{border-top:.25mm solid #c9ced6;padding-top:1.6mm;margin-top:1mm;display:flex;flex-direction:column;gap:1mm}.ak-reihe{display:flex;align-items:center;justify-content:space-between;font-size:12pt;font-weight:700;color:#173765}.ak-reihe.ok b{color:#2e7d32}.ak-reihe.nein b{color:#c62828}.ak-boxen{display:inline-flex;gap:2.2mm}.ak-b{display:inline-block;width:5.8mm;height:5.8mm;border:.45mm solid #2e7d32;border-radius:.8mm;background:#fff}.ak-reihe.nein .ak-b{border-color:#c62828}
.kk{display:flex;align-items:flex-end;gap:2mm;border-bottom:.35mm solid #173765;padding-bottom:1.2mm}.kk img{width:9mm}.kk span{color:#173765;font-weight:700;font-size:9.5pt}.kk em{margin-left:auto;font-style:normal;color:#5b6572;font-size:8pt;letter-spacing:.2pt}
.vinhalt{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:2mm 1mm}
.nrgross{width:19mm;height:19mm;background:#173765;color:#fff;font-size:28pt;font-weight:700;display:flex;align-items:center;justify-content:center;border-radius:1mm;margin-bottom:2.5mm}
.vkopf{display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:3mm}.vkopf .nrgross{margin-bottom:1.5mm}.thema{color:#2e7d32;font-size:14pt;min-height:2.5em;display:flex;align-items:center}
.was{font-size:10pt;font-weight:700;letter-spacing:.3pt;text-transform:uppercase;color:#fff;background:#173765;border-radius:.6mm;padding:.3mm 1.5mm;margin-bottom:2mm}.was.lage{background:#5b6572}
.satz{font-weight:700;color:#173765;line-height:1.22}.satz.lage{color:#5b6572;font-style:italic}
.ge{display:inline-block;color:#fff;font-size:10pt;font-weight:700;padding:.3mm 1.2mm;border-radius:.6mm;background:#c2410c;margin-top:3mm}
.eigen{flex:1;display:flex;flex-direction:column;padding-top:3mm}.eigen .was{align-self:flex-start;margin-bottom:2mm}.eigen .ltitel{margin-bottom:1mm}.linie{flex:1;border-bottom:.3mm solid #9aa3ad}.stapelkarte{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.stapelkarte .sz{font-size:70pt;font-weight:700;line-height:1}.stapelkarte .st{font-size:30pt;font-weight:700}.stapelkarte.klein .sz{font-size:40pt}.stapelkarte.klein .st{font-size:22pt;margin-bottom:4mm}.stapelkarte p{color:#334155;font-size:14pt;line-height:1.35;margin:0 2mm}
.kf{border-top:.2mm solid #c9ced6;padding-top:1.2mm;color:#5b6572;font-size:10pt;text-align:center}.kf.stapel{border-top:0;padding-top:.8mm;display:flex;justify-content:space-between;font-size:9.5pt}.kf .g{color:#2e7d32}.kf .r{color:#c62828}
.hinhalt{flex:1;min-height:0;padding-top:2.5mm;overflow:hidden}
.ltitel{color:#2e7d32;font-size:13pt;margin-bottom:2mm;display:flex;align-items:center;gap:2mm}.ltitel .nr{width:7.5mm;height:7.5mm;background:#173765;color:#fff;font-weight:700;font-size:11pt;display:flex;align-items:center;justify-content:center;border-radius:.6mm}
ol{margin:0 0 .6em;padding-left:1.35em}ol li{margin-bottom:1.6mm}ol b,.kontrolle b{color:#173765}
.wege{font-size:.86em;color:#334155;background:#f1f5f9;border-left:.9mm solid #9aa3ad;padding:1.2mm 2.2mm;margin:0 0 2.2mm}.wege>b{color:#5b6572}.wege ul{margin:.6mm 0 0;padding-left:4mm}.wege li{margin-bottom:.6mm}.wege b{color:#173765}
.kontrolle{border-left:.9mm solid #2e7d32;background:#e8f5ec;padding:1.5mm 2.4mm;font-size:.93em}
.anl{padding:0}.akopf{position:absolute;left:19mm;right:19mm;top:8.5mm;height:11mm;border-bottom:.4mm solid #173765;display:flex;align-items:flex-end;padding-bottom:1.5mm}.akopf img{width:11mm;margin-right:2mm}.akopf b{color:#173765;font-size:11pt}.akopf span{margin-left:auto;color:#5b6572;font-size:9pt}
.afuss{position:absolute;left:19mm;right:19mm;bottom:8mm;border-top:.4mm solid #173765;padding-top:1.5mm;display:flex;justify-content:space-between;color:#5b6572;font-size:9pt}
.anl .titelblatt,.anl h3,.anl .kasten,.anl .bleistift{margin-left:19mm;margin-right:19mm}
.titelblatt{text-align:center;padding-top:23mm}.t1{font-family:'Liberation Sans',sans-serif;color:#173765;font-size:26pt;margin-top:6pt}.t2{color:#5b6572;font-weight:700;font-size:15pt}.t3{color:#5b6572;font-size:8.5pt;margin-top:4pt}
h3.gruen{color:#2e7d32;font-size:13.5pt;font-weight:400;margin-top:9pt;margin-bottom:5pt}
.kasten{border:1pt solid #9fd3a8;border-left:3pt solid #2e7d32;background:#e8f5ec;padding:8pt 12pt;font-size:10pt}.kasten ol,.kasten ul{margin:0 0 4pt;padding-left:16pt}.kasten li{margin-bottom:3pt}.kasten p{margin:4pt 0 0}
.leer{position:absolute;top:140mm;width:100%;text-align:center;color:#9aa3ad;font-size:9pt}`;
const html=`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Bilderrechner-Training · Karteikarten</title><style>${CSS}</style></head><body>${seiten}</body></html>`;
const datei=path.join(__dirname,'.karten.html');fs.writeFileSync(datei,html);
(async()=>{const b=await pw.chromium.launch();const p=await b.newPage();await p.goto('file://'+datei);await p.waitForTimeout(500);
 // Version 4: Schrift fuellt die Karte. Groesste Schrift suchen, die noch ganz hineinpasst (Halbierungssuche):
 // Rueckseite ganze Loesung 12,3-19 pt, Vorderseite der Kundensatz 14-40 pt (Angaben vor der Verkleinerung um Z).
 const ergebnis=await p.evaluate(()=>{
  // Version 4.4: auch die Breite pruefen - sonst wird ein langes Wort (z. B. TRAININGSMODUS) am rechten Rand abgeschnitten.
  const passt=h=>h.scrollHeight<=h.clientHeight+1&&h.scrollWidth<=h.clientWidth+1;
  const suche=(h,ziel,min,max)=>{let lo=min,hi=max;ziel.style.fontSize=lo+'pt';if(!passt(h))return {f:lo,voll:true};
   while(hi-lo>0.2){const m=(lo+hi)/2;ziel.style.fontSize=m+'pt';if(passt(h))lo=m;else hi=m}ziel.style.fontSize=lo+'pt';return {f:lo,voll:false}};
  const r={hinten:[],vorne:[],voll:[]};
  document.querySelectorAll('.hinhalt').forEach(h=>{const x=suche(h,h,12.3,19);r.hinten.push(x.f);if(x.voll)r.voll.push('hinten '+h.querySelector('.nr')?.textContent)});
  document.querySelectorAll('.vinhalt').forEach(h=>{const x=suche(h,h.querySelector('.satz'),14,32);r.vorne.push(x.f);if(x.voll)r.voll.push('vorne '+h.querySelector('.nrgross')?.textContent)});
  return r});
 // Version 4.5 (Betreiber 27.10.2026: "die erste Seite passt nicht auf eine Seite und hat unten keinen Rand"): Titel weiter nach oben
 // (Abstand 38 -> 24 mm, Muetze 62 -> 44 pt, Zwischenueberschriften etwas enger - nur Seite 1).
 // Version 4.6 (Betreiber 27.10.2026: "nenne das ganze Bilderrechner-Training, nicht Kasse. Auf der ersten Seite eine Fusszeile"):
 // Name Bilderrechner-Training auf allen Seiten; Seite 1 mit Fusszeile im Stil der Kopfzeile (dafuer Titel 23 mm, Kaesten 10 pt, Abstaende etwas enger). Pruefung: der Inhalt endet mindestens
 // 4 mm ueber der Fusszeile, sonst Abbruch.
 // 4.6: der laengere Name darf das Ampel-Band nicht umbrechen oder ueberlaufen (alle Baender gleich hoch, Text passt hinein)
 const band=await p.evaluate(()=>{const b=[...document.querySelectorAll('.ampel')];const h=new Set(b.map(x=>Math.round(x.getBoundingClientRect().height)));
  return {hoehen:[...h],voll:b.filter(x=>x.scrollWidth>x.clientWidth+1).length}});
 if(band.hoehen.length>1||band.voll)throw new Error(`Ampel-Band bricht um oder laeuft ueber: Hoehen ${band.hoehen.join('/')}, zu voll ${band.voll}`);
 const anl=await p.evaluate(()=>{const s=document.querySelector('.seite.anl'),o=s.getBoundingClientRect().top,mm=v=>(v-o)*25.4/96;
  return {unten:Math.max(...[...s.children].filter(e=>!e.matches('.akopf,.afuss')).map(e=>mm(e.getBoundingClientRect().bottom))),fuss:mm(s.querySelector('.afuss').getBoundingClientRect().top)}});
 if(anl.unten>anl.fuss-4)throw new Error(`Seite 1 (Anleitung) zu lang: Inhalt endet ${anl.unten.toFixed(1)} mm, Fusszeile beginnt ${anl.fuss.toFixed(1)} mm`);
 console.log(`Seite 1: Inhalt endet bei ${anl.unten.toFixed(1)} mm, Fusszeile ab ${anl.fuss.toFixed(1)} mm (Abstand ${(anl.fuss-anl.unten).toFixed(1)} mm)`);
 const pt=v=>(v*Z).toFixed(1);
 if(ergebnis.voll.length)console.log('ZU VOLL:',ergebnis.voll.join(', '));
 console.log(`Raster ${SP}x${ZE} = ${JE} je Blatt, Karte ${KB.toFixed(1)} x ${KH.toFixed(1)} mm, Rand ${RAND} mm, Freirand ${SICHER} mm, Rueckseiten-Versatz ${VX}/${VY} mm`);
 console.log(`Loesung ${pt(Math.min(...ergebnis.hinten))}-${pt(Math.max(...ergebnis.hinten))} pt, Kundensatz ${pt(Math.min(...ergebnis.vorne))}-${pt(Math.max(...ergebnis.vorne))} pt (gedruckt)`);
 const ausgabe=process.env.OUT||path.join(ZIEL,'Bilderrechner-Training_Karteikarten.pdf');
 await p.pdf({path:ausgabe,width:'210mm',height:'297mm',printBackground:true,margin:{top:0,bottom:0,left:0,right:0}});
 console.log('A4 exakt:',exaktA4(ausgabe),'Seiten');
 await b.close();fs.unlinkSync(datei);console.log('fertig: Karteikarten-PDF in',ZIEL,'·',gesamt,'Karten')})();
