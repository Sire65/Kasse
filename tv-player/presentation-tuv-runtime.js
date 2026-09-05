(function(){'use strict';let box;
function getProject(){try{return typeof data!=='undefined'&&data?data:{slides:[]}}catch(e){return{slides:[]}}}
function run(){const r=KCPresentationTUV.inspect(getProject(),KCPresentationTUV.environment());window.__kcTvRuntimeTuv=r;if(box){box.textContent=`TV-TÜV ${r.status} · ${r.activeSlideCount} Folien · ${r.counts.error} Fehler · ${r.counts.warning} Hinweise`;box.style.background=r.status==='PASS'?'#14532ddd':r.status==='CONDITIONAL'?'#92400edd':'#7f1d1ddd'}return r}
window.addEventListener('DOMContentLoaded',()=>{box=document.createElement('div');box.className='kc-tuv-runtime';document.body.appendChild(box);document.addEventListener('keydown',e=>{if(e.key==='F8'){e.preventDefault();run();box.classList.toggle('show')}});run();setInterval(run,30000)});
})();
