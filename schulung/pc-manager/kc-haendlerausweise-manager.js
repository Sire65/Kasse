/* Nur lesend; der Club-Server stellt aus und sperrt. Vollständige Momentaufnahme je Marktjahr. */
(function(global){
  'use strict';
  let laufend=null;
  async function mitZeitlimit(promise){
    let timer;
    try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Zeitlimit beim Listenabruf')),5000);})]);}
    finally{clearTimeout(timer);}
  }
  async function laden(){
    const sb=global.KCSupabase,core=global.KCHaendlerausweis,s=global.settings;
    if(!sb?.istAngemeldet?.()||!core||!s)return {ok:false,grund:'Bitte im PC-Manager anmelden'};
    try{
      const jahr=core.marktjahr(s),rows=[];
      // Kleine Seiten: auch bei mehr als 100 Ausweisen niemals eine abgeschnittene Liste senden.
      for(let offset=0;offset<1000;offset+=100){
        const page=await mitZeitlimit(sb.rufeTabelleAuf(`kc_club_haendlerausweise?select=jahr,nr,code,gesperrt&org_id=eq.KC_WERNE&jahr=eq.${jahr}&order=nr.asc&limit=100&offset=${offset}`));
        if(!Array.isArray(page))throw new Error('Keine Ausweisliste erhalten');
        rows.push(...page);
        if(page.length<100)break;
      }
      const neu=core.paket(rows,jahr),alt=s.haendlerausweise;
      const geaendert=alt?.jahr!==jahr||JSON.stringify(alt?.ausweise)!==JSON.stringify(neu.ausweise);
      s.haendlerausweise=neu;
      global.saveAll?.();
      return {ok:true,anzahl:rows.length,geaendert};
    }catch(e){return {ok:false,grund:'Händlerausweisliste nicht aktualisiert – bisheriger Stand bleibt erhalten'};}
  }
  function pull({publish=false}={}){
    if(laufend)return laufend;
    laufend=laden().then(async r=>{
      if(r.ok&&r.geaendert&&publish)await global.KCTimeClockManager?.anKassenSenden?.();
      return r;
    }).finally(()=>{laufend=null});
    return laufend;
  }
  // Nach der Anmeldung und danach regelmäßig, damit Sperren den nächsten Abgleich erreichen.
  let angemeldet=false;
  setInterval(()=>{
    const jetzt=!!global.KCSupabase?.istAngemeldet?.();
    if(jetzt&&!angemeldet)pull({publish:true});
    angemeldet=jetzt;
  },3000);
  setInterval(()=>pull({publish:true}),5*60*1000);
  global.KCHaendlerausweiseManager={pull};
})(window);
