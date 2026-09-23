/* KC MarktKasse Manager V0.29.19
   Temporärer Entwicklungs-Schnellzugang.
   Aktivierung ausschließlich per Doppelklick auf die Überschrift im Entsperrdialog.
   Keine Speicherung: Nach jedem Neuladen ist der Manager wieder regulär gesperrt.
*/
(()=>{
  'use strict';
  const title=document.getElementById('authTitle');
  const dialog=document.getElementById('authDialog');
  if(!title||!dialog)return;
  function showDevelopmentBadge(){let badge=document.getElementById('devQuickAccessBadge');if(!badge){badge=document.createElement('div');badge.id='devQuickAccessBadge';badge.className='dev-quick-access-badge';badge.setAttribute('role','status');badge.innerHTML='<strong>ENTWICKLUNGSMODUS</strong><span>Manager-Schnellzugang ohne PIN aktiv · endet beim Neuladen</span>';document.body.appendChild(badge);}badge.hidden=false;}
  function unlockForDevelopment(){try{managerUnlocked=true;document.body.classList.remove('manager-locked');if(dialog.open)dialog.close();showDevelopmentBadge();const fn=pendingAuth;pendingAuth=null;if(typeof fn==='function')fn();}catch(error){console.error('Entwicklungs-Schnellzugang konnte nicht aktiviert werden.',error);alert('Der Entwicklungs-Schnellzugang konnte nicht aktiviert werden.');}}
  title.classList.add('dev-quick-access-trigger');title.title='Entwicklungsphase: Doppelklick aktiviert den temporären Schnellzugang';title.addEventListener('dblclick',event=>{event.preventDefault();event.stopPropagation();unlockForDevelopment();});
})();

/* Zusatzmodule getrennt und in fester Reihenfolge laden. Ein gemeinsamer Git-Hauptstand, keine Parallelversion. */
(()=>{
  const modules=[
    ['inventory-supabase-integration.js?build=0.1.0','data-kc-inventory-supabase'],
    ['kc-communication-client.js?build=0.2.0','data-kc-communication-client'],
    ['kc-communication-adapters.js?build=0.2.0','data-kc-communication-adapters'],
    ['kc-finance-bridge.js?build=1.0.0','data-kc-finance-bridge'],
    ['kc-supabase-tabellen.js?build=1.0.0','data-kc-supabase-tabellen'],
    ['kc-finance-uebergaben.js?build=1.0.0','data-kc-finance-uebergaben'],
    ['kc-tagesabschluss-versand.js?build=1.0.0','data-kc-tagesabschluss-versand'],
    ['time-clock-supabase-sync.js?build=1.0.0','data-kc-timeclock-sync'],
    ['kc-schulung-kachel.js?build=1.0.0','data-kc-schulung-kachel'],
    ['kc-claude-merge-ui.js?build=1.0.0','data-kc-claude-merge-ui'],
    ['kc-database-center.js?build=1.0.0','data-kc-database-center'],
    ['kc-supplier-link.js?build=1.0.0','data-kc-supplier-link']
  ];
  function loadAt(i){if(i>=modules.length)return;const [src,attr]=modules[i];if(document.querySelector(`script[${attr}]`)){loadAt(i+1);return;}const s=document.createElement('script');s.src=src;s.setAttribute(attr,'1');s.onload=()=>loadAt(i+1);s.onerror=()=>{console.error('KC Zusatzmodul konnte nicht geladen werden:',src);loadAt(i+1);};document.head.appendChild(s);}
  loadAt(0);
})();
