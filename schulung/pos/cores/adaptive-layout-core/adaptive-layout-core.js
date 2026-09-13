/* AdaptiveLayoutCore V1.0.0 Architecture Candidate
 * Framework service core: detects viewport/input profiles and applies layout classes.
 * It never changes business data or sales logic.
 */
(function(){
  "use strict";
  const VERSION="1.0.0";
  let scheduled=false,lastProfile="";
  const mq=q=>{try{return !!window.matchMedia?.(q).matches}catch{return false}};
  function viewport(){
    const vv=window.visualViewport;
    const width=Math.round(vv?.width||window.innerWidth||document.documentElement.clientWidth||0);
    const height=Math.round(vv?.height||window.innerHeight||document.documentElement.clientHeight||0);
    return {width,height,orientation:width>=height?"landscape":"portrait",ratio:height?width/height:1};
  }
  function detect(){
    const vp=viewport();
    const coarse=mq("(pointer: coarse)")||Number(navigator.maxTouchPoints||0)>0;
    const touch=coarse||("ontouchstart" in window);
    let profile="desktop";
    if(touch&&vp.orientation==="landscape"&&vp.width>=900&&vp.width<=1440&&vp.height<=1050) profile="tablet-landscape";
    else if(touch&&vp.orientation==="portrait"&&vp.width<=1024) profile="tablet-portrait";
    else if(vp.width<1100||vp.height<760) profile="desktop-compact";
    const density=vp.height<720?"very-compact":vp.height<900?"compact":"comfortable";
    return {...vp,touch,coarse,profile,density};
  }
  function applyNow(){
    scheduled=false;
    const p=detect(),body=document.body,html=document.documentElement;
    html.style.setProperty("--app-height",`${p.height}px`);
    html.style.setProperty("--app-width",`${p.width}px`);
    ["tablet-fit","tablet-portrait","adaptive-desktop-compact","adaptive-compact","adaptive-very-compact"].forEach(c=>body.classList.remove(c));
    if(p.profile==="tablet-landscape") body.classList.add("tablet-fit");
    if(p.profile==="tablet-portrait") body.classList.add("tablet-portrait");
    if(p.profile==="desktop-compact") body.classList.add("adaptive-desktop-compact");
    if(p.density==="compact") body.classList.add("adaptive-compact");
    if(p.density==="very-compact") body.classList.add("adaptive-very-compact");
    body.dataset.layoutProfile=p.profile;
    body.dataset.layoutDensity=p.density;
    lastProfile=`${p.profile}:${p.density}:${p.width}x${p.height}`;
    window.dispatchEvent(new CustomEvent("adaptive-layout-change",{detail:p}));
    return p;
  }
  function recalculate(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>requestAnimationFrame(applyNow));
  }
  function init(){
    applyNow();
    window.addEventListener("resize",recalculate,{passive:true});
    window.visualViewport?.addEventListener("resize",recalculate,{passive:true});
    window.addEventListener("orientationchange",recalculate,{passive:true});
    document.addEventListener("fullscreenchange",recalculate);
  }
  window.AdaptiveLayoutCore={version:VERSION,init,detect,viewport,recalculate,profile:()=>detect().profile,lastProfile:()=>lastProfile};
})();
