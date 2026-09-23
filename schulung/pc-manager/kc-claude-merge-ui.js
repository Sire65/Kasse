// UI-Bruecke fuer den am 11.09.2026 gelieferten Claude-Zusammenfuehrungsstand.
// Fuegt nur die dort neuen Oberflaechen ein; bestehende Manager-Bereiche bleiben unveraendert.
(function(){
'use strict';
function inject(){
  const content=document.querySelector('.content'); if(!content)return;
  // 1) Einfache Datenbankansicht.
  if(!document.querySelector('[data-view-panel="datenbank"]')){
    const refNav=document.querySelector('[data-view="zentral"]')||document.querySelector('.nav-submenu .nav:last-child');
    if(refNav){const b=document.createElement('button');b.className='nav';b.type='button';b.dataset.view='datenbank';b.textContent='Datenbank';refNav.parentNode.insertBefore(b,refNav);b.addEventListener('click',()=>{document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.view').forEach(x=>{const on=x.dataset.viewPanel==='datenbank';x.classList.toggle('active',on);x.hidden=!on;});setTimeout(()=>window.KCSupabaseTabellen?.tabellenListeLaden?.(),80);});}
    const s=document.createElement('section');s.className='view';s.dataset.viewPanel='datenbank';s.hidden=true;s.innerHTML='<div class="page-head"><div><h1>Datenbank</h1><p>Einfache Ansicht der Supabase-Tabellen – ansehen, ändern, löschen. Schema, RLS und SQL bleiben im Supabase Studio.</p></div></div><article class="secure-card"><div class="db-kopf"><label>Tabelle<select id="dbTabelle"><option value="">– zuerst öffnen zum Laden –</option></select></label> <button type="button" id="dbLaden" class="primary">Zeilen laden</button></div><p id="dbMeldung" class="db-meldung"></p><div id="dbErgebnis"></div></article>';
    content.appendChild(s);
  }
  // 2) Money-Butler: von zuhause eingegangene Uebergaben.
  const cash=document.querySelector('[data-view-panel="cashprep"]');
  if(cash&&!document.getElementById('ftKarte')){
    const card=document.createElement('article');card.className='secure-card';card.id='ftKarte';card.innerHTML='<h3>Von zuhause eingegangene Geldübergaben</h3><p class="hint">Money Butler legt Übergaben zentral ab. Erst nach „Übernehmen“ und „An Kasse freigeben“ erreichen sie die Zielkasse.</p><div class="kcbs-filter"><button type="button" id="ftAktualisieren">Aktualisieren</button></div><p id="ftMeldung" class="tc-status"></p><div id="ftListe"></div>';
    const hint=cash.querySelector('#managerCashTestHint'); if(hint)hint.after(card); else cash.querySelector('.page-head')?.after(card);
  }
  // 3) Tagesabschluss-Versand.
  const closing=document.querySelector('[data-view-panel="closing"]');
  if(closing&&!document.getElementById('sendClosingReports')){
    const host=document.getElementById('mgrAbschluesse')?.closest('article')||closing.querySelector('article.secure-card');
    if(host){const d=document.createElement('div');d.innerHTML='<div class="kcbs-filter" style="margin-top:10px"><button type="button" id="sendClosingReports" class="primary">✉ An Kassenwart senden (neue Abschlüsse)</button></div><p id="closingSendResult" class="tc-status"></p>';host.append(...d.childNodes);}
  }
}
function wire(){inject();document.getElementById('ftAktualisieren')?.addEventListener('click',()=>window.KCFinanceUebergaben?.listeLaden?.(true));document.getElementById('sendClosingReports')?.addEventListener('click',()=>window.KCTagesabschlussVersand?.tagesabschluesseHolenUndVersenden?.(true));document.getElementById('dbLaden')?.addEventListener('click',()=>window.KCSupabaseTabellen?.zeilenLaden?.());}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(wire,0));else setTimeout(wire,0);
})();
