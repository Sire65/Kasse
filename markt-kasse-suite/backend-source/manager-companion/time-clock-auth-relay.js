'use strict';
const RPC_URL = 'https://ptblnpiroqftcvlsrhac.supabase.co/rest/v1/rpc/';
function authenticatedClockTransport({token,publishableKey,fetchImpl=fetch}) {
 if (!token || !publishableKey) throw new Error('Bitte im PC-Manager bei Supabase anmelden.');
 async function rpc(name,body) {
  const response=await fetchImpl(RPC_URL+name,{method:'POST',headers:{apikey:publishableKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!response.ok){
   if(response.status===401)throw new Error('Bitte die Supabase-Anmeldung im PC-Manager erneuern.');
   if(response.status===403)throw new Error('Dieses Konto benötigt eine aktive DP2-Planer- oder Administratorfreigabe.');
   const data=await response.json().catch(()=>({}));
   const rejected=['P0002','P0003','23505'].includes(data.code)||String(data.code||'').startsWith('22');
   const error=new Error(rejected?'Eine Buchung benötigt eine Prüfung von Mitgliedsnummer und Uhrzeit im PC-Manager.':'Das zentrale Stempelbuch ist derzeit nicht erreichbar.');
   error.eventRejected=rejected;
   throw error;
  }
  return response.json();
 }
 return {send:events=>rpc('kc_dp_stempel_kasse_melden',{p_org_id:'KC_WERNE',p_ereignisse:events}),readState:()=>rpc('kc_dp_stempel_kasse_stand',{p_org_id:'KC_WERNE'})};
}
module.exports={authenticatedClockTransport};
