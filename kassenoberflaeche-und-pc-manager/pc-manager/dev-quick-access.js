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

  function showDevelopmentBadge(){
    let badge=document.getElementById('devQuickAccessBadge');
    if(!badge){
      badge=document.createElement('div');
      badge.id='devQuickAccessBadge';
      badge.className='dev-quick-access-badge';
      badge.setAttribute('role','status');
      badge.innerHTML='<strong>ENTWICKLUNGSMODUS</strong><span>Manager-Schnellzugang ohne PIN aktiv · endet beim Neuladen</span>';
      document.body.appendChild(badge);
    }
    badge.hidden=false;
  }

  function unlockForDevelopment(){
    try{
      managerUnlocked=true;
      document.body.classList.remove('manager-locked');
      if(dialog.open)dialog.close();
      showDevelopmentBadge();
      const fn=pendingAuth;
      pendingAuth=null;
      if(typeof fn==='function')fn();
    }catch(error){
      console.error('Entwicklungs-Schnellzugang konnte nicht aktiviert werden.',error);
      alert('Der Entwicklungs-Schnellzugang konnte nicht aktiviert werden.');
    }
  }

  title.classList.add('dev-quick-access-trigger');
  title.title='Entwicklungsphase: Doppelklick aktiviert den temporären Schnellzugang';
  title.addEventListener('dblclick',event=>{
    event.preventDefault();
    event.stopPropagation();
    unlockForDevelopment();
  });
})();
