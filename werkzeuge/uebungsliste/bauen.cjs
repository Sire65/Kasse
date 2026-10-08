// Uebungsliste Kassen-Training erzeugen: node werkzeuge/uebungsliste/bauen.cjs (braucht Playwright/Chromium).
// Schreibt schulung/uebungsliste/index.html (Webseite zum Ankreuzen) und das Druck-PDF daneben.
// Aufgaben stehen in daten.js - nach jeder Aenderung an der Kasse die Schritte erneut durchspielen.
// Gestaltung wie die Unterlagen in der Club-App (Kurzanleitung Bilderrechner, Club-App-Anleitung):
// Kochmuetze + "Koecheclub Werne" in #173765, Ueberschriften #2e7d32, Grau #5b6572, Schrift Carlito.
const fs=require('fs'),path=require('path');const pw=require('playwright');const D=require('./daten.js');
const ZIEL=path.join(__dirname,'..','..','schulung','uebungsliste');fs.mkdirSync(ZIEL,{recursive:true});
const VERSION='Version 1',STAND='07.10.2026',KASSE='Bilderrechner V0.31.3.6';
const b64=f=>'data:image/png;base64,'+fs.readFileSync(path.join(__dirname,f)).toString('base64');
const LOGO=b64('logo.png'),HUT=b64('hut.png');
for(const f of ['logo.png','hut.png'])fs.copyFileSync(path.join(__dirname,f),path.join(ZIEL,f));
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const fett=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
const gesamt=D.reduce((n,s)=>n+s.aufgaben.length,0);
let nr=0;const bereiche=[];
const stufen=D.map(st=>{const von=nr+1;const html=st.aufgaben.map(a=>{nr++;const lage=a.k.startsWith('(');return `<div class="aufgabe">
  <div class="nr">${nr}</div>
  <div class="zt">
   <h4 class="${lage?'lage':''}"><span class="was">${lage?'Lage':'Kunde sagt'}</span>${esc(lage?a.k.slice(1,-1):'„'+a.k+'“')}${a.neu?' <span class="ge">ZUSÄTZLICH</span>':''}</h4>
   <ol>${a.s.map(x=>`<li>${fett(x)}</li>`).join('')}</ol>
   ${a.w?`<div class="wege"><b>Andere Wege:</b><ul>${a.w.map(x=>`<li>${fett(x)}</li>`).join('')}</ul></div>`:''}
   <div class="kontrolle"><b>Kontrolle:</b> ${fett(a.e)}</div>
  </div>
  <div class="gewusst"><div class="t">Gewusst?</div><label data-nr="${nr}" data-w="ja"><span class="box"></span>Ja</label><label data-nr="${nr}" data-w="nein"><span class="box"></span>Nein</label></div>
 </div>`}).join('');bereiche.push([st.stufe,von,nr]);
 return `<section class="stufe"><h2>${esc(st.stufe)} <span class="schwer">Schwierigkeit ${'●'.repeat(st.punkte)}${'○'.repeat(5-st.punkte)}</span></h2>${html}</section>`}).join('');
const CSS=`*{box-sizing:border-box}
body{font-family:Carlito,'Liberation Sans',sans-serif;color:#111;font-size:10.5pt;line-height:1.32;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.titelblatt{text-align:center;margin-top:28pt}.t1{font-family:'Liberation Sans',sans-serif;color:#173765;font-size:26pt;margin-top:6pt}.t2{color:#5b6572;font-weight:700;font-size:15pt}.t3{color:#5b6572;font-size:8.5pt;margin-top:4pt}
h2{font-weight:400;color:#2e7d32;font-size:15pt;margin:14pt 0 4pt;break-after:avoid}
h2 .schwer{float:right;font-size:9pt;color:#5b6572;margin-top:6pt;letter-spacing:.5pt}
h3.gruen{color:#2e7d32;font-size:13.5pt;font-weight:400;margin:16pt 0 6pt}
.inhalt{list-style:none;padding-left:26pt;margin:0}.inhalt li{margin-bottom:3pt;font-size:10.5pt}.inhalt span{color:#5b6572}
.kasten{margin-top:12pt;border:1pt solid #9fd3a8;border-left:3pt solid #2e7d32;background:#e8f5ec;padding:9pt 12pt;font-size:9.8pt}.kasten p{margin:0 0 5pt}.kasten ol,.kasten ul{margin:2pt 0 4pt;padding-left:15pt}.kasten li{margin-bottom:1.5pt}
.namen{display:grid;grid-template-columns:1fr 1fr .7fr;gap:14pt;margin-top:16pt;font-size:10pt;color:#5b6572}.namen div{border-bottom:.8pt solid #9aa3ad;padding-top:14pt}
.aufgabe{display:grid;grid-template-columns:26pt 1fr 62pt;gap:10pt;padding:6pt 0;border-bottom:.5pt solid #c9ced6;break-inside:avoid}
.nr{width:22pt;height:22pt;background:#2e7d32;color:#fff;font-size:12.5pt;font-weight:700;display:flex;align-items:center;justify-content:center;border-radius:2pt;margin-top:1pt}
h4{margin:0 0 2pt;color:#173765;font-size:11.5pt;line-height:1.25}h4.lage{color:#5b6572;font-style:italic}
h4 .was{display:inline-block;font-style:normal;font-size:6.8pt;font-weight:700;letter-spacing:.3pt;text-transform:uppercase;color:#fff;background:#173765;border-radius:1.5pt;padding:.5pt 3pt;margin-right:5pt;vertical-align:2pt}h4.lage .was{background:#5b6572}
.ge{display:inline-block;color:#fff;font-size:6.5pt;font-weight:700;font-style:normal;padding:.5pt 2.5pt;border-radius:1.5pt;vertical-align:2pt;background:#c2410c}
ol{margin:1pt 0 3pt;padding-left:15pt}ol li{margin-bottom:1pt}ol b,.kontrolle b{color:#173765}
.wege{font-size:9.4pt;color:#334155;background:#f1f5f9;border-left:3pt solid #9aa3ad;padding:2pt 7pt;margin:0 0 3pt}.wege>b{color:#5b6572}.wege ul{margin:1pt 0 0;padding-left:13pt}.wege li{margin-bottom:.5pt}.wege b{color:#173765}
.kontrolle{border-left:3pt solid #2e7d32;background:#e8f5ec;padding:2pt 7pt;font-size:9.6pt}
.gewusst{border-left:.8pt dashed #c9ced6;padding-left:8pt;display:flex;flex-direction:column;justify-content:center;gap:4pt}
.gewusst .t{font-size:8.5pt;color:#5b6572;font-weight:700}.gewusst label{display:flex;align-items:center;gap:5pt;font-weight:700;font-size:10.5pt}
.box{width:13pt;height:13pt;border:1.4pt solid #111;border-radius:2pt;display:inline-block;background:#fff}
.auswertung{break-inside:avoid;margin-top:16pt;border:1pt solid #9fd3a8;border-left:3pt solid #2e7d32;background:#e8f5ec;padding:9pt 12pt}
.auswertung h3{margin:0 0 6pt;color:#2e7d32;font-weight:400;font-size:13.5pt}.zeile{display:flex;gap:20pt;margin-bottom:8pt}.linie{border-bottom:.8pt solid #9aa3ad;height:20pt}
.seitenumbruch{break-after:page}`;
const titel=`<div class="titelblatt"><img src="${HUT}" style="width:62pt" alt=""><div class="t1">Köcheclub Werne</div><div class="t2">Kassen-Training — Übungsliste</div><div class="t3">Übungsliste ${VERSION} · ${KASSE} · Oberfläche KC003 · Stand ${STAND}</div></div>
<h3 class="gruen">Inhalt</h3><ul class="inhalt">${bereiche.map(([t,v,b])=>{const [s,r]=t.split(' · ');return `<li><b>${esc(s)}</b> – ${esc(r)} <span>· Aufgabe ${v}–${b}</span></li>`}).join('')}<li><b>Auswertung</b> <span>– am Ende der Liste</span></li></ul>
<div class="kasten"><p><b>So wird geübt:</b> Zu zweit – eine Person bedient die Kasse, die andere ist der Kunde.</p><ol>
 <li>Der <b>Kunde</b> hält die Liste und liest „Kunde sagt“ vor – die Lösung nicht verraten.</li>
 <li>Die <b>Bedienung</b> erledigt den Vorgang an der Kasse.</li>
 <li>Der Kunde vergleicht mit den Schritten und der <b>Kontrolle</b> und kreuzt an: <b>Gewusst? Ja / Nein</b>.</li>
 <li>Bei „Nein“ die Schritte gemeinsam durchgehen und wiederholen. Danach Rollen tauschen.</li></ol>
 <p><b>Alleine üben:</b> Dieselben Aufgaben gibt es als <b>Karteikarten</b> – vorne die Aufgabe, hinten die Lösung. Gewusste Karten auf den Stapel <b>„Kann ich“</b>, nicht gewusste auf den Stapel <b>„Üben“</b>, dann mit dem Stapel „Üben“ weitermachen, bis er leer ist.</p>
 <p><b>Geübt wird in der Schulungs-Kasse</b> (Schulungs-Link bzw. QR-Code) – dort zählt nichts zum Umsatz. „<b>Lage</b>“ = kein Kundensatz, sondern eine Situation am Stand. <span class="ge">ZUSÄTZLICH</span> = weitere Fälle, die am Stand vorkommen können.</p></div>
<div class="kasten"><p><b>Gut zu wissen:</b></p><ul>
 <li>Glaspfand (2,00 €) kommt bei Getränken <b>von selbst</b> dazu. Bei der halben Portion wird das Pfand <b>nie</b> halbiert, auf Pfand gibt es <b>nie</b> Rabatt.</li>
 <li>Mengenknöpfe erst <b>nach</b> dem Artikel antippen.</li>
 <li>Oft führen <b>mehrere Wege</b> zum Ziel: oben steht der einfachste, darunter unter „<b>Andere Wege</b>“ weitere, die genauso richtig sind.</li>
 <li>Nach Helfer, Personal und Auszahlung erscheint ein Fenster – mit <b>Fertig</b> schließen.</li>
 <li><b>Beachte:</b> Einige Funktionen können sich mit der Zeit noch ändern, weil ständig am Bilderrechner weiterentwickelt wird.</li></ul></div>
<div class="namen"><div>Bedienung:</div><div>Kunde:</div><div>Datum:</div></div>`;
const auswertung=`<div class="auswertung"><h3>Auswertung</h3><div class="zeile"><span>Gewusst <b>Ja</b>: <b class="zJa">______</b> von ${gesamt}</span><span>Gewusst <b>Nein</b>: <b class="zNein">______</b></span><span>Wiederholt am: ____________</span></div>
 <div style="font-weight:700;margin-bottom:2pt">Was war schwierig? Was fehlt in der Liste?</div><div class="linie"></div><div class="linie"></div><div class="linie"></div></div>`;
// ---------- Druck (PDF) ----------
const druck=`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Kassen-Training · Übungsliste</title><style>@page{size:A4}${CSS}</style></head><body>${titel}<div class="seitenumbruch"></div>${stufen}${auswertung}</body></html>`;
const druckDatei=path.join(__dirname,'.druck.html');fs.writeFileSync(druckDatei,druck);
// ---------- Webseite ----------
const WEB=`.leiste{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:#fff;border-bottom:1.5px solid #173765;padding:8px 2px 7px;margin-bottom:6px}
.leiste img{width:34px}.leiste .name{color:#173765;font-weight:700;font-size:12pt}.leiste .stand{margin-left:auto;color:#5b6572;font-size:10.5pt}
.leiste a,.leiste button{font:inherit;font-weight:700;font-size:10pt;color:#fff;background:#173765;border:0;border-radius:5px;padding:6px 11px;text-decoration:none;cursor:pointer}.leiste button{background:#5b6572}
.gewusst label{cursor:pointer;user-select:none;-webkit-user-select:none;padding:3px 0}
.gewusst label.an[data-w="ja"] .box{background:#2e7d32;border-color:#2e7d32;box-shadow:inset 0 0 0 2.5px #fff}
.gewusst label.an[data-w="nein"] .box{background:#c62828;border-color:#c62828;box-shadow:inset 0 0 0 2.5px #fff}
.aufgabe.ok{background:#f1f8f2}.aufgabe.nok{background:#fdf1f1}
body{max-width:860px;margin:0 auto;padding:0 14px 40px;background:#fff}
@media (max-width:640px){.aufgabe{grid-template-columns:24pt 1fr}.gewusst{grid-column:2;border-left:0;border-top:.8pt dashed #c9ced6;padding:5px 0 0;flex-direction:row;align-items:center;gap:18px}.namen{grid-template-columns:1fr}h2 .schwer{float:none;display:block;margin-top:0}.leiste .stand{width:100%;order:3;margin-left:0}}
@media print{.leiste{display:none}body{max-width:none;padding:0}}`;
const leiste=`<div class="leiste"><img src="logo.png" alt=""><span class="name">Köcheclub Werne</span><span class="stand">Gewusst: <b class="zJa">0</b> Ja · <b class="zNein">0</b> Nein · <span class="zOffen">${gesamt}</span> offen</span><a href="Kassen-Training_Uebungsliste.pdf" download>PDF</a><a href="Kassen-Training_Karteikarten.pdf" download>Karteikarten</a><a href="Kassen-Training_Karteikarten_klein.pdf" download>Karten klein</a><button type="button" id="neu">Neu beginnen</button></div>`;
const skript=`<script>
(function(){var K='kc.uebungsliste.v1',st={};try{st=JSON.parse(localStorage.getItem(K)||'{}')||{}}catch(e){st={}}
function speichern(){try{localStorage.setItem(K,JSON.stringify(st))}catch(e){}}
function zeigen(){var ja=0,nein=0;document.querySelectorAll('.gewusst label').forEach(function(l){l.classList.toggle('an',st[l.dataset.nr]===l.dataset.w)});
 document.querySelectorAll('.aufgabe').forEach(function(a){var l=a.querySelector('.gewusst label');var w=l&&st[l.dataset.nr];a.classList.toggle('ok',w==='ja');a.classList.toggle('nok',w==='nein')});
 Object.keys(st).forEach(function(k){if(st[k]==='ja')ja++;else if(st[k]==='nein')nein++});
 document.querySelectorAll('.zJa').forEach(function(e){e.textContent=ja});document.querySelectorAll('.zNein').forEach(function(e){e.textContent=nein});document.querySelectorAll('.zOffen').forEach(function(e){e.textContent=${gesamt}-ja-nein})}
document.addEventListener('click',function(ev){var l=ev.target.closest&&ev.target.closest('.gewusst label');if(l){ev.preventDefault();if(st[l.dataset.nr]===l.dataset.w)delete st[l.dataset.nr];else st[l.dataset.nr]=l.dataset.w;speichern();zeigen()}
 if(ev.target.id==='neu'&&confirm('Alle Kreuze löschen und neu beginnen?')){st={};speichern();zeigen();window.scrollTo(0,0)}});
zeigen()})();
<\/script>`;
const web=`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kassen-Training · Übungsliste</title><link rel="icon" href="logo.png"><style>${CSS}${WEB}</style></head><body>${leiste}${titel.replace(HUT,'hut.png')}${stufen}${auswertung}${skript}</body></html>`;
fs.writeFileSync(path.join(ZIEL,'index.html'),web);
(async()=>{const b=await pw.chromium.launch();const p=await b.newPage();await p.goto('file://'+druckDatei);await p.waitForTimeout(500);
 await p.pdf({path:path.join(ZIEL,'Kassen-Training_Uebungsliste.pdf'),format:'A4',printBackground:true,displayHeaderFooter:true,
  headerTemplate:`<div style="font-family:Carlito,sans-serif;width:100%;margin:0 19mm;display:flex;align-items:flex-end;border-bottom:1.1pt solid #173765;padding-bottom:4pt;-webkit-print-color-adjust:exact"><img src="${LOGO}" style="width:31pt;margin-right:6pt"><b style="color:#173765;font-size:11pt">Köcheclub Werne</b><span style="margin-left:auto;color:#5b6572;font-size:9pt">Kassen-Training · Übungsliste · ${VERSION}</span></div>`,
  footerTemplate:`<div style="font-family:Carlito,sans-serif;width:100%;text-align:center;color:#5b6572;font-size:9pt">Seite <span class="pageNumber" style="color:#111;font-size:10.5pt"></span> von <span class="totalPages" style="color:#111;font-size:10.5pt"></span></div>`,
  margin:{top:'22mm',bottom:'17mm',left:'19mm',right:'19mm'}});
 await b.close();fs.unlinkSync(druckDatei);console.log('fertig: Webseite + PDF in',ZIEL)})();
