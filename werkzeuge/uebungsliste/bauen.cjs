// Uebungsliste Kassen-Training erzeugen: node werkzeuge/uebungsliste/bauen.cjs (braucht Playwright/Chromium).
// Schreibt schulung/uebungsliste/index.html (Webseite zum Ankreuzen), karten.html (Karten online) und das Druck-PDF daneben.
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
const NIV={einfach:['#2e7d32','einfach',0],mittel:['#d97706','mittel',1],schwer:['#c62828','schwer',2]};
// Einheitliches Zeichen fuer die Schwierigkeit (wie auf den Karteikarten): farbiges Feld mit drei Ampel-Lichtern + Wort
const ampelChip=n=>{const v=NIV[n];return `<span class="ampelchip" style="background:${v[0]}"><span class="lichter">${['#4ade80','#fbbf24','#f87171'].map((c,i)=>`<i style="background:${i===v[2]?c:'#4b5563'}"></i>`).join('')}</span>${v[1]}</span>`};
const stufen=D.map(st=>{const von=nr+1;const html=st.aufgaben.map(a=>{nr++;const lage=a.k.startsWith('(');const nv=NIV[a.n||st.niveau];return `<div class="aufgabe">
  <div class="nr">${nr}</div>
  <div class="zt">
   <h4 class="${lage?'lage':''}">${ampelChip(a.n||st.niveau)}<span class="was">${lage?'Lage':'Kunde sagt'}</span>${esc(lage?a.k.slice(1,-1):'„'+a.k+'“')}${a.neu?' <span class="ge">ZUSÄTZLICH</span>':''}</h4>
   <ol>${a.s.map(x=>`<li>${fett(x)}</li>`).join('')}</ol>
   ${a.w?`<div class="wege"><b>Andere Wege:</b><ul>${a.w.map(x=>`<li>${fett(x)}</li>`).join('')}</ul></div>`:''}
   <div class="kontrolle"><b>Kontrolle:</b> ${fett(a.e)}</div>
  </div>
  <div class="gewusst"><div class="t">Gewusst?</div><label data-nr="${nr}" data-w="ja"><span class="box"></span>Ja</label><label data-nr="${nr}" data-w="nein"><span class="box"></span>Nein</label></div>
 </div>`}).join('');bereiche.push([st.stufe,von,nr]);
 return `<section class="stufe"><h2>${esc(st.stufe)}</h2>${html}</section>`}).join('');
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
.ampelchip{display:inline-flex;align-items:center;gap:3pt;color:#fff;font-style:normal;font-size:6.8pt;font-weight:700;letter-spacing:.3pt;text-transform:uppercase;border-radius:1.5pt;padding:.8pt 3.5pt .8pt 1.5pt;margin-right:4pt;vertical-align:1.5pt;line-height:1}
.ampelchip .lichter{display:inline-flex;gap:1.3pt;background:#1f2937;border-radius:4pt;padding:1pt 1.8pt}.ampelchip .lichter i{width:4.6pt;height:4.6pt;border-radius:50%;display:block}
h2 .schwer .ampelchip{font-size:8.5pt;padding:1.5pt 5pt 1.5pt 2pt}h2 .schwer .ampelchip .lichter i{width:6pt;height:6pt}
.nr{width:24pt;height:26pt;background:#173765;color:#fff;font-size:12.5pt;font-weight:700;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:2pt;margin-top:1pt;line-height:1}.nr small{font-size:5.6pt;font-weight:700;text-transform:uppercase;letter-spacing:.2pt;margin-top:1.5pt}
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
 <p><b>Alleine üben:</b> Dieselben Aufgaben gibt es als <b>Karteikarten</b> – vorne die Aufgabe, hinten die Lösung. Oder am Handy/Tablet: <b>Karten online</b> (Knopf oben) – Karte antippen, Lösung ansehen, „Gewusst“ oder „Nicht gewusst“ antippen. Gewusste Karten auf den Stapel <b>„Kann ich“</b>, nicht gewusste auf den Stapel <b>„Üben“</b>, dann mit dem Stapel „Üben“ weitermachen, bis er leer ist.</p>
 <p><b>Geübt wird in der Schulungs-Kasse</b> (Schulungs-Link bzw. QR-Code) – dort zählt nichts zum Umsatz. „<b>Lage</b>“ = kein Kundensatz, sondern eine Situation am Stand. <span class="ge">ZUSÄTZLICH</span> = weitere Fälle, die am Stand vorkommen können.</p></div>
<div class="kasten"><p><b>Gut zu wissen:</b></p><ul>
 <li>Glaspfand (2,00 €) kommt bei Getränken <b>von selbst</b> dazu. Bei der halben Portion wird das Pfand <b>nie</b> halbiert, auf Pfand gibt es <b>nie</b> Rabatt.</li>
 <li>Die <b>Ampel</b> zeigt die Schwierigkeit: <b style="color:#2e7d32">grün = einfach</b>, <b style="color:#d97706">gelb = mittel</b>, <b style="color:#c62828">rot = schwer</b>.</li>
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
const leiste=`<div class="leiste"><img src="logo.png" alt=""><span class="name">Köcheclub Werne</span><span class="stand">Gewusst: <b class="zJa">0</b> Ja · <b class="zNein">0</b> Nein · <span class="zOffen">${gesamt}</span> offen</span><a href="Kassen-Training_Uebungsliste.pdf" download>PDF</a><a href="Kassen-Training_Karteikarten.pdf" download>Karteikarten</a><a href="karten.html">Karten online</a><button type="button" id="neu">Neu beginnen</button></div>`;
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
// ---------- Karten online (karten.html): eine Karte nach der anderen, Ampel oben, hinten Gewusst / Nicht gewusst ----------
// Speichert im selben Feld wie die Uebungsliste (kc.uebungsliste.v1) - was hier angetippt wird, steht auch dort angekreuzt.
const KNIV={einfach:['#2e7d32','EINFACH',0],mittel:['#d97706','MITTEL',1],schwer:['#c62828','SCHWER',2]};
let knr=0;const KARTEN=[];D.forEach(st=>st.aufgaben.forEach(a=>{knr++;const lage=a.k.startsWith('(');KARTEN.push({nr:knr,n:a.n||st.niveau,
 thema:st.stufe.split(' · ')[1],lage,satz:lage?a.k.slice(1,-1):'„'+a.k+'“',neu:!!a.neu,
 s:a.s.map(fett),w:(a.w||[]).map(fett),e:fett(a.e)})}));
const KCSS=`*{box-sizing:border-box}html,body{margin:0}
body{font-family:Carlito,'Liberation Sans',Calibri,sans-serif;color:#111;background:#eef1f5;font-size:17px;line-height:1.38;-webkit-text-size-adjust:100%}
.kopf{position:sticky;top:0;z-index:5;background:#fff;border-bottom:2px solid #173765;padding:8px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.kopf img{width:34px}.kopf .name{color:#173765;font-weight:700}.kopf a{margin-left:auto;color:#fff;background:#173765;border-radius:6px;padding:6px 10px;text-decoration:none;font-weight:700;font-size:14px}
main{max-width:560px;margin:0 auto;padding:10px 12px 40px}
.filter{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 8px}
.filter button,.modus button{font:inherit;font-size:15px;font-weight:700;border:2px solid #c9ced6;background:#fff;color:#334155;border-radius:20px;padding:5px 12px;cursor:pointer}
.filter button.an{color:#fff;border-color:transparent}.filter button[data-f=alle].an{background:#173765}.filter button[data-f=einfach].an{background:#2e7d32}.filter button[data-f=mittel].an{background:#d97706}.filter button[data-f=schwer].an{background:#c62828}
.mini{display:inline-flex;gap:2px;background:#1f2937;border-radius:8px;padding:3px 4px;margin-right:5px;vertical-align:-1px}.mini i{width:8px;height:8px;border-radius:50%;background:#4b5563;display:block}
.modus{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.modus button.an{background:#173765;color:#fff;border-color:#173765}
.zaehler{display:flex;gap:8px;margin-bottom:10px;font-size:15px}.zaehler div{flex:1;background:#fff;border-radius:8px;padding:6px 8px;text-align:center;border:1px solid #d5dae1}.zaehler b{display:block;font-size:22px;line-height:1.1}
.z-ja b{color:#2e7d32}.z-nein b{color:#c62828}.z-offen b{color:#5b6572}
.karte{background:#fff;border-radius:12px;box-shadow:0 2px 10px rgba(23,55,101,.18);overflow:hidden;min-height:330px;display:flex;flex-direction:column}
.ampel{display:flex;align-items:center;gap:10px;color:#fff;padding:8px 12px}
.lichter{display:inline-flex;gap:4px;background:#1f2937;border-radius:12px;padding:4px 6px}.lichter i{width:13px;height:13px;border-radius:50%;display:block;background:#4b5563}
.ampel b{letter-spacing:1px}.ampel em{margin-left:auto;font-style:normal;font-size:14px;opacity:.95}
.inhalt{padding:14px 16px;flex:1}
.thema{color:#5b6572;font-size:14px;margin-bottom:10px}
.was{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#fff;background:#173765;border-radius:3px;padding:1px 6px}.was.lage{background:#5b6572}
.satz{font-size:24px;color:#173765;margin:10px 0;line-height:1.28}.satz.lage{color:#5b6572;font-style:italic;font-size:21px}
.ge{display:inline-block;color:#fff;font-size:11px;font-weight:700;padding:1px 5px;border-radius:3px;background:#c2410c}
.l-titel{color:#2e7d32;font-size:19px;margin-bottom:4px}ol{margin:4px 0 8px;padding-left:22px}ol li{margin-bottom:4px}ol b,.kontrolle b,.wege li b{color:#173765}
.wege{font-size:15.5px;color:#334155;background:#f1f5f9;border-left:4px solid #9aa3ad;padding:5px 9px;margin:0 0 8px}.wege ul{margin:2px 0 0;padding-left:18px}
.kontrolle{border-left:4px solid #2e7d32;background:#e8f5ec;padding:5px 9px;font-size:16px}
.knoepfe{display:flex;gap:8px;padding:12px}
.knoepfe button{flex:1;font:inherit;font-weight:700;font-size:18px;border:0;border-radius:10px;padding:14px 8px;cursor:pointer;color:#fff;touch-action:manipulation}
.b-zeigen{background:#173765}.b-ja{background:#2e7d32}.b-nein{background:#c62828}
.status{margin:0 16px;font-size:14px;font-weight:700}.status.ja{color:#2e7d32}.status.nein{color:#c62828}
.nav{display:flex;align-items:center;justify-content:space-between;margin-top:10px;gap:8px}
.nav button{font:inherit;font-weight:700;font-size:15px;border:0;border-radius:8px;padding:9px 14px;background:#5b6572;color:#fff;cursor:pointer}.nav span{color:#5b6572;font-size:15px}
.leer{background:#fff;border-radius:12px;padding:26px 18px;text-align:center;color:#173765;font-size:19px}.leer small{display:block;color:#5b6572;font-size:15px;margin-top:6px}
.unten{margin-top:18px;text-align:center}.unten button{font:inherit;font-size:14px;background:none;border:0;color:#5b6572;text-decoration:underline;cursor:pointer}
.hinweis{font-size:13.5px;color:#5b6572;margin-top:14px;text-align:center}`;
const KJS=`(function(){var KARTEN=${JSON.stringify(KARTEN).replace(/</g,'\\u003c')};
var NIV=${JSON.stringify(KNIV)};var LICHT=['#4ade80','#fbbf24','#f87171'];
var K='kc.uebungsliste.v1',st={};try{st=JSON.parse(localStorage.getItem(K)||'{}')||{}}catch(e){st={}}
var filter='alle',modus='alle',idx=0,offen=false,liste=[];
function sp(){try{localStorage.setItem(K,JSON.stringify(st))}catch(e){}}
function $(s){return document.querySelector(s)}
function bauListe(){liste=KARTEN.filter(function(k){return (filter==='alle'||k.n===filter)&&(modus==='alle'||(modus==='ueben'?st[k.nr]==='nein':!st[k.nr]))})}
function ampel(k){var n=NIV[k.n];var d=LICHT.map(function(c,i){return '<i style="background:'+(i===n[2]?c:'#4b5563')+'"></i>'}).join('');
 return '<div class="ampel" style="background:'+n[0]+'"><span class="lichter">'+d+'</span><b>'+n[1]+'</b><em>Karte '+k.nr+' von '+KARTEN.length+'</em></div>'}
function zeigen(){var alle=KARTEN.filter(function(k){return filter==='alle'||k.n===filter}),ja=0,nein=0;
 alle.forEach(function(k){if(st[k.nr]==='ja')ja++;else if(st[k.nr]==='nein')nein++});
 $('.z-ja b').textContent=ja;$('.z-nein b').textContent=nein;$('.z-offen b').textContent=alle.length-ja-nein;
 document.querySelectorAll('.filter button').forEach(function(b){b.classList.toggle('an',b.dataset.f===filter)});
 document.querySelectorAll('.modus button').forEach(function(b){b.classList.toggle('an',b.dataset.m===modus)});
 var box=$('#karte');if(!liste.length){box.innerHTML='<div class="leer">'+(modus==='ueben'?'🎉 Stapel „Üben“ ist leer!':modus==='offen'?'🎉 Alle Karten sind durch!':'Keine Karten.')+'<small>'+(modus!=='alle'?'Oben „Alle Karten“ wählen oder unten neu beginnen.':'')+'</small></div>';$('#pos').textContent='0 / 0';return}
 if(idx>=liste.length)idx=0;var k=liste[idx],s=st[k.nr];
 var h='<div class="karte">'+ampel(k)+'<div class="inhalt">';
 if(!offen)h+='<div class="thema">'+k.thema+'</div><span class="was'+(k.lage?' lage':'')+'">'+(k.lage?'Lage':'Kunde sagt')+'</span><div class="satz'+(k.lage?' lage':'')+'">'+k.satz.replace(/</g,'&lt;')+'</div>'+(k.neu?'<span class="ge">ZUSÄTZLICH</span>':'');
 else h+='<div class="l-titel">Lösung</div><ol>'+k.s.map(function(x){return '<li>'+x+'</li>'}).join('')+'</ol>'+(k.w.length?'<div class="wege"><b>Andere Wege:</b><ul>'+k.w.map(function(x){return '<li>'+x+'</li>'}).join('')+'</ul></div>':'')+'<div class="kontrolle"><b>Kontrolle:</b> '+k.e+'</div>';
 h+='</div>'+(s?'<div class="status '+s+'">'+(s==='ja'?'✓ Zuletzt: gewusst':'✗ Zuletzt: nicht gewusst')+'</div>':'');
 h+=offen?'<div class="knoepfe"><button type="button" class="b-ja" data-a="ja">✓ Gewusst</button><button type="button" class="b-nein" data-a="nein">✗ Nicht gewusst</button></div>':'<div class="knoepfe"><button type="button" class="b-zeigen" data-a="zeigen">Lösung zeigen ↻</button></div>';
 box.innerHTML=h+'</div>';$('#pos').textContent=(idx+1)+' / '+liste.length}
function neu(){bauListe();zeigen()}
document.addEventListener('click',function(ev){var t=ev.target.closest&&ev.target.closest('button');if(!t)return;
 if(t.dataset.f){filter=t.dataset.f;idx=0;offen=false;neu();return}
 if(t.dataset.m){modus=t.dataset.m;idx=0;offen=false;neu();return}
 var a=t.dataset.a;if(a==='zeigen'){offen=true;zeigen();return}
 if(a==='ja'||a==='nein'){var k=liste[idx];st[k.nr]=a;sp();offen=false;var vorher=liste.length;bauListe();if(liste.length===vorher)idx++;zeigen();window.scrollTo(0,0);return}
 if(t.id==='zurueck'){idx=(idx-1+liste.length)%Math.max(liste.length,1);offen=false;zeigen()}
 if(t.id==='weiter'){idx=(idx+1)%Math.max(liste.length,1);offen=false;zeigen()}
 if(t.id==='mischen'){for(var i=liste.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),x=liste[i];liste[i]=liste[j];liste[j]=x}idx=0;offen=false;zeigen()}
 if(t.id==='reset'&&confirm('Alle Ergebnisse löschen und neu beginnen? (Gilt auch für die Übungsliste.)')){st={};sp();idx=0;offen=false;neu()}});
neu()})();`;
const kartenWeb=`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kassen-Training · Karten</title><link rel="icon" href="logo.png"><style>${KCSS}</style></head><body>
<div class="kopf"><img src="logo.png" alt=""><span class="name">Köcheclub Werne · Karten</span><a href="index.html">Übungsliste</a></div>
<main><div class="filter"><button type="button" data-f="alle">Alle</button><button type="button" data-f="einfach"><span class="mini"><i style="background:#4ade80"></i><i></i><i></i></span>Einfach</button><button type="button" data-f="mittel"><span class="mini"><i></i><i style="background:#fbbf24"></i><i></i></span>Mittel</button><button type="button" data-f="schwer"><span class="mini"><i></i><i></i><i style="background:#f87171"></i></span>Schwer</button></div>
<div class="modus"><button type="button" data-m="alle">Alle Karten</button><button type="button" data-m="offen">Noch offen</button><button type="button" data-m="ueben">Stapel „Üben“</button></div>
<div class="zaehler"><div class="z-ja"><b>0</b>Kann ich</div><div class="z-nein"><b>0</b>Üben</div><div class="z-offen"><b>0</b>offen</div></div>
<div id="karte"></div>
<div class="nav"><button type="button" id="zurueck">‹ Zurück</button><span id="pos"></span><button type="button" id="mischen">Mischen</button><button type="button" id="weiter">Weiter ›</button></div>
<div class="hinweis">Geübt wird in der <b>Schulungs-Kasse</b> – dort zählt nichts zum Umsatz. Ergebnisse bleiben auf diesem Gerät gespeichert und stehen auch in der Übungsliste.</div>
<div class="unten"><button type="button" id="reset">Neu beginnen</button></div></main>
<script>${KJS}<\/script></body></html>`;
fs.writeFileSync(path.join(ZIEL,'karten.html'),kartenWeb);
(async()=>{const b=await pw.chromium.launch();const p=await b.newPage();await p.goto('file://'+druckDatei);await p.waitForTimeout(500);
 await p.pdf({path:path.join(ZIEL,'Kassen-Training_Uebungsliste.pdf'),format:'A4',printBackground:true,displayHeaderFooter:true,
  headerTemplate:`<div style="font-family:Carlito,sans-serif;width:100%;margin:0 19mm;display:flex;align-items:flex-end;border-bottom:1.1pt solid #173765;padding-bottom:4pt;-webkit-print-color-adjust:exact"><img src="${LOGO}" style="width:31pt;margin-right:6pt"><b style="color:#173765;font-size:11pt">Köcheclub Werne</b><span style="margin-left:auto;color:#5b6572;font-size:9pt">Kassen-Training · Übungsliste · ${VERSION}</span></div>`,
  footerTemplate:`<div style="font-family:Carlito,sans-serif;width:100%;text-align:center;color:#5b6572;font-size:9pt">Seite <span class="pageNumber" style="color:#111;font-size:10.5pt"></span> von <span class="totalPages" style="color:#111;font-size:10.5pt"></span></div>`,
  margin:{top:'22mm',bottom:'17mm',left:'19mm',right:'19mm'}});
 await b.close();fs.unlinkSync(druckDatei);console.log('fertig: Webseite + PDF in',ZIEL)})();
