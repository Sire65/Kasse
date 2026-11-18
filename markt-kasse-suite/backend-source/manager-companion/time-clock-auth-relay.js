'use strict';
const RPC_URL = 'https://ptblnpiroqftcvlsrhac.supabase.co/rest/v1/rpc/';
function authenticatedClockTransport({token,publishableKey,fetchImpl=fetch}) {
 if (!token || !publishableKey) throw new Error('Bitte im PC-Manager bei Supabase anmelden.');
 async function rpc(name,body) {
  const response=await fetchImpl(RPC_URL+name,{method:'POST',headers:{apikey:publishableKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(response.status===401||response.status===403?'Die Manager-Anmeldung muss erneuert oder freigegeben werden.':'Das zentrale Stempelbuch ist derzeit nicht erreichbar.');
  return response.json();
 }
 return {send:events=>rpc('kc_dp_stempel_kasse_melden',{p_org_id:'KC_WERNE',p_ereignisse:events}),readState:()=>rpc('kc_dp_stempel_kasse_stand',{p_org_id:'KC_WERNE'})};
}
module.exports={authenticatedClockTransport};
