// Uebungsliste Kassen-Training erzeugen: node werkzeuge/uebungsliste/bauen.cjs (braucht Playwright/Chromium).
// Schreibt schulung/uebungsliste/index.html (Webseite zum Ankreuzen) und das Druck-PDF daneben.
// Aufgaben stehen in daten.js - nach jeder Aenderung an der Kasse die Schritte erneut durchspielen.
const fs=require('fs');const pw=require('playwright');const D=require('./daten.js');
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const fett=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
let nr=0;const gesamt=D.reduce((n,s)=>n+s.aufgaben.length,0);
const stufen=D.map(st=>`<section class="stufe" style="--f:${st.farbe}">
 <h2><span class="balken">${'<i class="an"></i>'.repeat(st.punkte)}${'<i></i>'.repeat(5-st.punkte)}</span>${esc(st.stufe)}</h2>
 ${st.aufgaben.map(a=>{nr++;const rolle=a.k.startsWith('(');return `<article class="aufgabe">
  <div class="nr">${nr}</div>
  <div class="inhalt">
   <div class="kunde ${rolle?'lage':''}">${rolle?'<span class="was">Lage</span>':'<span class="was">Kunde sagt</span>'}${esc(rolle?a.k.slice(1,-1):'„'+a.k+'“')}${a.neu?'<span class="neu">zusätzlich</span>':''}</div>
   <ol>${a.s.map(x=>`<li>${fett(x)}</li>`).join('')}</ol>
   <div class="kontrolle"><span>✓ Kontrolle:</span> ${fett(a.e)}</div>
  </div>
  <div class="gewusst"><div class="t">Gewusst?</div><label data-nr="${nr}" data-w="ja"><span class="box"></span>Ja</label><label data-nr="${nr}" data-w="nein"><span class="box"></span>Nein</label></div>
 </article>`}).join('')}
</section>`).join('');
const html=`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Übungsliste Kasse</title><style>
@page{size:A4;margin:11mm 11mm 13mm}
*{box-sizing:border-box}body{font-family:Carlito,'Liberation Sans',sans-serif;color:#111827;font-size:10.6pt;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.kopf{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #173765;padding-bottom:6px;margin-bottom:8px}
.kopf h1{font-size:21pt;margin:0;color:#173765}.kopf .u{font-size:10pt;color:#475569}
.kopf .r{text-align:right;font-size:9.5pt;color:#475569;line-height:1.35}
.einleitung{display:grid;grid-template-columns:1.25fr 1fr;gap:8px;margin-bottom:8px}
.kasten{border:1.5px solid #cbd5e1;border-radius:8px;padding:7px 10px;background:#f8fafc;font-size:9.8pt;line-height:1.35}
.kasten h3{margin:0 0 3px;font-size:10.8pt;color:#173765}.kasten ol,.kasten ul{margin:2px 0 0 16px;padding:0}.kasten li{margin:1px 0}
.namen{display:grid;grid-template-columns:1fr 1fr 0.7fr;gap:10px;margin:2px 0 8px;font-size:9.8pt}.namen div{border-bottom:1px solid #94a3b8;padding:12px 0 1px;color:#475569}
.stufe h2{font-size:12.5pt;margin:10px 0 5px;color:#fff;background:var(--f);padding:4px 10px;border-radius:6px;display:flex;align-items:center;gap:10px;break-after:avoid}
.balken{display:inline-flex;gap:2px}.balken i{width:7px;height:12px;border-radius:2px;background:rgba(255,255,255,.35)}.balken i.an{background:#fff}
.aufgabe{display:grid;grid-template-columns:30px 1fr 74px;gap:8px;border:1.3px solid #d1d5db;border-left:5px solid var(--f);border-radius:7px;padding:6px 8px;margin-bottom:5px;break-inside:avoid;background:#fff}
.nr{width:26px;height:26px;border-radius:50%;background:var(--f);color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:11pt}
.kunde{font-size:11.2pt;font-weight:700;margin-bottom:3px;line-height:1.25}.kunde .was{display:inline-block;font-size:7.6pt;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#fff;background:#173765;border-radius:3px;padding:1px 5px;margin-right:6px;vertical-align:2px}
.kunde.lage{font-style:italic;font-weight:700;color:#334155}.kunde.lage .was{background:#64748b}
.neu{font-size:7.4pt;font-weight:700;color:#7c2d12;background:#ffedd5;border:1px solid #fdba74;border-radius:3px;padding:0 4px;margin-left:6px;vertical-align:2px;font-style:normal}
ol{margin:0 0 3px 16px;padding:0}ol li{margin:0.5px 0;line-height:1.28}ol b,.kontrolle b{color:#0b3a75}
.kontrolle{font-size:9.6pt;background:#ecfdf5;border-radius:4px;padding:2px 6px;color:#14532d;line-height:1.28}.kontrolle span{font-weight:700}
.gewusst{border-left:1.5px dashed #cbd5e1;padding-left:7px;display:flex;flex-direction:column;justify-content:center;gap:5px}
.gewusst .t{font-size:8.6pt;font-weight:700;color:#475569}.gewusst label{display:flex;align-items:center;gap:6px;font-weight:700;font-size:10.5pt}
.box{width:17px;height:17px;border:2px solid #111827;border-radius:3px;display:inline-block;background:#fff}
.auswertung{break-inside:avoid;margin-top:10px;border:2px solid #173765;border-radius:8px;padding:9px 12px}
.leiste{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:#173765;color:#fff;padding:8px 12px;border-radius:0 0 10px 10px;margin:0 -2px 10px;font-size:11pt}
.leiste a,.leiste button{font:inherit;font-weight:700;color:#173765;background:#fff;border:0;border-radius:6px;padding:6px 12px;text-decoration:none;cursor:pointer}
.leiste .stand{margin-right:auto}
.gewusst label{cursor:pointer;user-select:none;-webkit-user-select:none;padding:3px 0}
.gewusst label.an[data-w="ja"] .box{background:#16a34a;border-color:#16a34a;box-shadow:inset 0 0 0 3px #fff}
.gewusst label.an[data-w="nein"] .box{background:#dc2626;border-color:#dc2626;box-shadow:inset 0 0 0 3px #fff}
.aufgabe.ok{background:#f0fdf4}.aufgabe.nok{background:#fef2f2}
@media screen{body{max-width:900px;margin:0 auto;padding:0 10px 30px;background:#eef2f7}.aufgabe,.kasten{background:#fff}}
@media screen and (max-width:640px){.einleitung{grid-template-columns:1fr}.aufgabe{grid-template-columns:26px 1fr;}.gewusst{grid-column:1/-1;border-left:0;border-top:1.5px dashed #cbd5e1;padding:6px 0 0;flex-direction:row;align-items:center;gap:18px}.kopf{flex-direction:column;align-items:flex-start;gap:4px}.kopf .r{text-align:left}.namen{grid-template-columns:1fr}}
@media print{.leiste{display:none}}
.auswertung h3{margin:0 0 6px;color:#173765}.zeile{display:flex;gap:18px;font-size:11pt;margin-bottom:8px}.linie{border-bottom:1px solid #94a3b8;height:20px;margin-bottom:4px}
</style></head><body>
<div class="kopf"><div><h1>Kassen-Training – Übungsliste</h1><div class="u">Köcheclub Werne · Weihnachtsmarkt 2026 · zu zweit üben: eine Person kassiert, eine ist der Kunde</div></div>
<div class="r">Bilderrechner V0.31.3.6 · Oberfläche KC003<br>Stand 07.10.2026 · ${gesamt} Aufgaben<br>jede Aufgabe in der Kasse durchgespielt</div></div>
<div class="einleitung">
 <div class="kasten"><h3>So wird geübt</h3><ol>
  <li><b>Kunde</b> hält diese Liste und liest „Kunde sagt“ vor – <b>nicht</b> die Lösung.</li>
  <li><b>Bedienung</b> erledigt den Vorgang an der Kasse.</li>
  <li>Der Kunde vergleicht mit den Schritten und der <b>Kontrolle</b> und kreuzt an: <b>Gewusst? Ja / Nein</b>.</li>
  <li>Bei „Nein“: gemeinsam die Schritte durchgehen und die Aufgabe wiederholen.</li>
  <li>Danach Rollen tauschen. Die Aufgaben werden von oben nach unten schwerer.</li></ol>
  <p style="margin:4px 0 0"><b>Geübt wird in der Schulungs-Kasse</b> (Schulungs-Link bzw. QR-Code): dort zählt nichts zum Umsatz.</p></div>
 <div class="kasten"><h3>Gut zu wissen</h3><ul>
  <li>Glaspfand (2,00 €) kommt bei Getränken <b>von selbst</b> dazu.</li>
  <li>Bei der halben Portion wird das Pfand <b>nie</b> halbiert.</li>
  <li>Auf Pfand gibt es <b>nie</b> Rabatt.</li>
  <li>Mengenknöpfe erst <b>nach</b> dem Artikel antippen.</li>
  <li>Nach Helfer, Personal und Auszahlung erscheint ein Fenster – mit <b>Fertig</b> schließen.</li>
  <li>„Lage“ = kein Kundensatz, sondern eine Situation am Stand.</li></ul></div>
</div>
<div class="namen"><div>Bedienung:</div><div>Kunde:</div><div>Datum:</div></div>
${stufen}
<div class="auswertung"><h3>Auswertung</h3>
 <div class="zeile"><span>Gewusst <b>Ja</b>: <b class="zJa">______</b> von ${gesamt}</span><span>Gewusst <b>Nein</b>: <b class="zNein">______</b></span><span>Wiederholt am: ____________</span></div>
 <div style="font-weight:700;margin-bottom:2px">Was war schwierig? Was fehlt in der Liste?</div><div class="linie"></div><div class="linie"></div><div class="linie"></div></div>
</body></html>`;
const ZIEL=require('path').join(__dirname,'..','..','schulung','uebungsliste');fs.writeFileSync(require('path').join(__dirname,'uebungsliste.html'),html);
const leiste=`<div class="leiste"><span class="stand">Gewusst: <b class="zJa">0</b> Ja · <b class="zNein">0</b> Nein · <span class="zOffen">${gesamt}</span> offen</span><a href="Kassen-Training_Uebungsliste.pdf" download>PDF herunterladen</a><button type="button" id="neu">Neu beginnen</button></div>`;
const skript=`<script>
(function(){var K='kc.uebungsliste.v1',st={};try{st=JSON.parse(localStorage.getItem(K)||'{}')||{}}catch(e){st={}}
function speichern(){try{localStorage.setItem(K,JSON.stringify(st))}catch(e){}}
function zeigen(){var ja=0,nein=0;document.querySelectorAll('.gewusst label').forEach(function(l){var an=st[l.dataset.nr]===l.dataset.w;l.classList.toggle('an',an)});
 document.querySelectorAll('.aufgabe').forEach(function(a){var l=a.querySelector('.gewusst label');var w=l&&st[l.dataset.nr];a.classList.toggle('ok',w==='ja');a.classList.toggle('nok',w==='nein')});
 Object.keys(st).forEach(function(k){if(st[k]==='ja')ja++;else if(st[k]==='nein')nein++});
 document.querySelectorAll('.zJa').forEach(function(e){e.textContent=ja});document.querySelectorAll('.zNein').forEach(function(e){e.textContent=nein});document.querySelectorAll('.zOffen').forEach(function(e){e.textContent=${gesamt}-ja-nein})}
document.addEventListener('click',function(ev){var l=ev.target.closest&&ev.target.closest('.gewusst label');if(l){ev.preventDefault();st[l.dataset.nr]=st[l.dataset.nr]===l.dataset.w?undefined:l.dataset.w;if(!st[l.dataset.nr])delete st[l.dataset.nr];speichern();zeigen()}
 if(ev.target.id==='neu'&&confirm('Alle Kreuze löschen und neu beginnen?')){st={};speichern();zeigen();window.scrollTo(0,0)}});
zeigen()})();
<\/script>`;
const web=html.replace('<body>','<body>'+leiste).replace('</body>',skript+'</body>').replace('<title>Übungsliste Kasse</title>','<meta name="viewport" content="width=device-width,initial-scale=1"><title>Kassen-Training · Übungsliste</title>');
fs.writeFileSync(require('path').join(ZIEL,'index.html'),web);
(async()=>{const b=await pw.chromium.launch();const p=await b.newPage();await p.goto('file://'+require('path').join(__dirname,'uebungsliste.html'));await p.waitForTimeout(500);
 await p.pdf({path:require('path').join(ZIEL,'Kassen-Training_Uebungsliste.pdf'),format:'A4',printBackground:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="font-family:Carlito,sans-serif;font-size:8.5pt;color:#64748b;width:100%;text-align:center">Kassen-Training · Übungsliste · Seite <span class="pageNumber"></span> von <span class="totalPages"></span></div>',margin:{top:'11mm',bottom:'13mm',left:'11mm',right:'11mm'}});
 await b.close();console.log('PDF fertig')})();
