/* Händlerausweise: öffentliche Ausgabeliste, niemals Server-Geheimnisse. */
(function(global){
  'use strict';
  const SCHEMA='KC_HAENDLERAUSWEISE_V1';
  const FORMAT=/^Koecheclub Werne Haendler-Ausweis (\d{4}) Nr (\d{3}) Code ([A-HJ-NP-Z2-9]{4})$/;
  function marktjahr(settings={}){
    return Number(String(settings.eventName||'').match(/\b(20\d{2})\b/)?.[1]||new Date().getFullYear());
  }
  function paket(rows,jahr){
    if(!Array.isArray(rows))throw new Error('Keine vollständige Ausweisliste erhalten');
    const seen=new Set();
    const ausweise=rows.map(r=>{
      const nr=String(r.nr||''),code=String(r.code||'');
      if(Number(r.jahr)!==jahr||!/^\d{3}$/.test(nr)||nr==='000'||! /^[A-HJ-NP-Z2-9]{4}$/.test(code)||typeof r.gesperrt!=='boolean'||seen.has(nr))throw new Error('Ungültige Ausweisliste');
      seen.add(nr);return {jahr,nr,code,gesperrt:r.gesperrt};
    });
    return {schema:SCHEMA,jahr,ausweise,abgerufenAm:new Date().toISOString()};
  }
  function pruefen(text,settings={},training=false){
    const m=FORMAT.exec(String(text||'').trim());
    const nein=grund=>({ok:false,grund});
    if(!m)return nein('Kein Köcheclub-Händler-Ausweis');
    const jahr=Number(m[1]),nr=m[2],code=m[3];
    if(jahr!==marktjahr(settings))return nein(`Ausweis aus ${jahr} – für diesen Markt nicht gültig`);
    if(nr==='000')return training&&code==='MSTR'?{ok:true,jahr,nr,code,muster:true,percent:10}:nein('Musterausweis – nur im Trainingsmodus gültig');
    const liste=settings.haendlerausweise;
    if(liste?.schema!==SCHEMA||liste.jahr!==jahr||!Array.isArray(liste.ausweise))return nein('Ausweisliste fehlt – bitte Stammdaten mit dem PC-Manager abgleichen');
    const ausweis=liste.ausweise.find(r=>r.jahr===jahr&&r.nr===nr&&r.code===code);
    if(!ausweis)return nein('Ausweis unbekannt – bitte nachfragen');
    if(ausweis.gesperrt!==false)return nein('Ausweis gesperrt – bitte nachfragen');
    return {ok:true,jahr,nr,code,muster:false,percent:10};
  }
  global.KCHaendlerausweis={version:'1.0.0',SCHEMA,FORMAT,marktjahr,paket,pruefen};
  if(typeof module!=='undefined')module.exports=global.KCHaendlerausweis;
})(typeof window!=='undefined'?window:globalThis);
