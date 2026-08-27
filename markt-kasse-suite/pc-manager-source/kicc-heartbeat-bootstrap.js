(function(){
  'use strict';
  const VERSION=(window.KC_PC_MANAGER_VERSION||window.KC_VERSION||document.documentElement.dataset.version||'unknown');
  const BUILD=(window.KC_PC_MANAGER_BUILD||document.documentElement.dataset.build||VERSION);
  window.KICC_PROGRAM_HEARTBEAT_CONFIG={
    programId:'kc-pc-manager',
    name:'KC PC Manager',
    deviceType:'PC_MANAGER',
    version:String(VERSION),
    build:String(BUILD),
    intervalMs:30000,
    endpoint:window.KICC_PROGRAM_HEARTBEAT_ENDPOINT||'https://ptblnpiroqftcvlsrhac.supabase.co/functions/v1/kicc-program-heartbeat',
    async getAuth(){
      try{
        if(typeof window.KICC_AUTH?.getProgramHeartbeatBridgeAuth==='function')return await window.KICC_AUTH.getProgramHeartbeatBridgeAuth()||{};
      }catch{}
      try{
        const session=await window.KCSupabase?.auth?.getSession?.();
        const token=session?.data?.session?.access_token||session?.session?.access_token||null;
        if(token)return {authorization:`Bearer ${token}`};
      }catch{}
      return {};
    }
  };
})();
