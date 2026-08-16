window.KC_RUNTIME_FLAGS = Object.freeze({
  publicBeta: true,
  testPhaseToolGuidance: false,
  managementAccess: false,
  diagnosticsForMembers: false
});

(()=>{
  const loadManagerMirror=()=>{
    if(document.querySelector('script[data-kc-manager-mirror]'))return;
    const script=document.createElement('script');
    script.src='shared/manager-mirror.js';
    script.dataset.kcManagerMirror='1';
    script.async=true;
    document.head.appendChild(script);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadManagerMirror,{once:true});
  else loadManagerMirror();
})();
