(function(global){
  'use strict';
  const LOCAL_KEY='kc_cash_measure_settings_v1';
  const LAST_KEY='kcm_cash_measure_central_last_v1';
  const el=id=>document.getElementById(id);

  function client(){
    if(typeof global.KCCommunicationClient!=='function')return null;
    return new global.KCCommunicationClient({
      sourceProgram:'kc-bilderrechner',
      getAccessToken:async()=>global.KCSupabase?.holeZugriffsToken?.()||null
    });
  }
  async function pull({publish=true,manual=false}={}){
    const c=client();
    if(!c){if(manual)console.warn('Zentrale Gewichtseinstellungen: Communication Client fehlt.');return false;}
    try{
      const data=await c._request('kc-finance-bridge',{action:'cash_measure_settings_get'});
      if(!data?.settings)return false;
      const incoming=JSON.stringify(data.settings);
      const current=JSON.stringify(global.settings?.cashMeasureSettings||null);
      localStorage.setItem(LOCAL_KEY,incoming);
      if(current===incoming)return true;

      if(global.settings)global.settings.cashMeasureSettings=data.settings;
      global.saveAll?.();
      localStorage.setItem(LAST_KEY,JSON.stringify({updatedAt:data.updatedAt||new Date().toISOString()}));

      if(publish){
        const body={
          groups:Array.isArray(global.groups)?global.groups:[],
          articles:Array.isArray(global.articles)?global.articles:[],
          packages:[],
          accounts:(()=>{try{return JSON.parse(localStorage.getItem('kcm_accounts')||'[]')}catch{return []}})(),
          settings:global.settings||{}
        };
        const response=await fetch('http://127.0.0.1:47392/master-data/push',{
          method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
          signal:AbortSignal.timeout(4500)
        });
        if(!response.ok)throw new Error('Manager-Companion antwortete mit '+response.status);
      }
      global.dispatchEvent(new CustomEvent('kc-cash-measure-settings-updated',{detail:data.settings}));
      return true;
    }catch(e){
      if(manual)console.warn('Zentrale Gewichtseinstellungen konnten nicht synchronisiert werden:',e?.message||e);
      return false;
    }
  }

  document.querySelectorAll('[data-view="closing"],[data-view="settings"]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>pull({publish:true}),250)));
  setTimeout(()=>pull({publish:true}),2200);
  global.KCCashMeasureCentralSync={pull};
})(window);
