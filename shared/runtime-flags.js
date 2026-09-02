window.KC_RUNTIME_FLAGS = Object.freeze({
  publicBeta: true,
  testPhaseToolGuidance: false,
  managementAccess: false,
  diagnosticsForMembers: false
});

(()=>{
  const add=(src,key)=>{if(document.querySelector(`script[data-${key}]`))return;const s=document.createElement('script');s.src=src;s.dataset[key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]='1';s.async=true;document.head.appendChild(s);};
  const css=(href,key)=>{if(document.querySelector(`link[data-${key}]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=href;l.dataset[key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]='1';document.head.appendChild(l);};
  const loadManagerMirror=()=>{
    add('shared/kc-resilience.js','kc-resilience');
    add('shared/kicc-heartbeat.js','kicc-heartbeat');
    add('integration/demo-sales-seeder.js','kc-demo-sales-seeder');
    if(document.querySelector('script[data-kc-manager-mirror]'))return;
    const script=document.createElement('script');
    script.src='shared/manager-mirror.js';script.dataset.kcManagerMirror='1';script.async=true;
    script.addEventListener('load',()=>{
      add('shared/manager-mirror-sim.js','kc-manager-mirror-sim');
      add('shared/manager-mirror-status.js','kc-manager-mirror-status');
      css('shared/manager-mirror-core.css','kc-manager-mirror-core-css');
      add('shared/manager-mirror-core.js','kc-manager-mirror-core');
      css('shared/manager-dp-errors.css','kc-manager-dp-errors-css');
      add('shared/manager-dp-errors.js','kc-manager-dp-errors');
    },{once:true});
    document.head.appendChild(script);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadManagerMirror,{once:true});else loadManagerMirror();
})();
