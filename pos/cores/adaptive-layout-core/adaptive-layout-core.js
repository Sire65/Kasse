/* AdaptiveLayoutCore V1.0.1 Architecture Candidate
 * Framework service core: detects viewport/input profiles and applies layout classes.
 * It never changes business data or sales logic.
 *
 * 25.09.2026 (Betreiber: "altes Samsung-Tablet SM-T535, Android 5.0.2, wieder dasselbe
 * Geraet"): ES5-sicher wiederhergestellt. Eine fruehere Sitzung (11./12.09.2026) hatte diese
 * Datei bereits einmal auf ES5 umgeschrieben - bei einer spaeteren Ueberarbeitung (die
 * "V1.0.0 Architecture Candidate"-Fassung) wurde versehentlich wieder moderne Syntax
 * eingefuehrt (const/let, Pfeilfunktionen, optional chaining, Objekt-Spread,
 * Template-Strings). Fuer Android 5.0.2 ist das kritisch: der WebView-Browser dieser
 * Android-Version basiert auf einem sehr alten Chromium-Stand ohne ES2015-Unterstuetzung -
 * ein einziges "const" oder "=>" in dieser Datei fuehrt zu einem Parse-Fehler, der das
 * GESAMTE Skript unbrauchbar macht (nicht nur die betroffene Zeile). Deshalb hier
 * durchgehend: var statt const/let, function(){} statt Pfeilfunktionen, kein "?.", keine
 * Template-Strings, kein Objekt-Spread.
 */
(function(){
  "use strict";
  var VERSION="1.0.1";
  var scheduled=false;
  var lastProfile="";

  function mq(q){
    try{
      if(window.matchMedia){return !!window.matchMedia(q).matches}
      return false;
    }catch(e){return false}
  }

  function viewport(){
    var vv=window.visualViewport;
    var vvWidth=vv?vv.width:0;
    var vvHeight=vv?vv.height:0;
    var width=Math.round(vvWidth||window.innerWidth||document.documentElement.clientWidth||0);
    var height=Math.round(vvHeight||window.innerHeight||document.documentElement.clientHeight||0);
    return {
      width:width,
      height:height,
      orientation:(width>=height)?"landscape":"portrait",
      ratio:height?(width/height):1
    };
  }

  function detect(){
    var vp=viewport();
    var coarse=mq("(pointer: coarse)")||Number(navigator.maxTouchPoints||0)>0;
    var touch=coarse||("ontouchstart" in window);
    var profile="desktop";
    if(touch&&vp.orientation==="landscape"&&vp.width>=900&&vp.width<=1440&&vp.height<=1050){profile="tablet-landscape"}
    else if(touch&&vp.orientation==="portrait"&&vp.width<=1024){profile="tablet-portrait"}
    else if(vp.width<1100||vp.height<760){profile="desktop-compact"}
    var density=(vp.height<720)?"very-compact":((vp.height<900)?"compact":"comfortable");
    return {
      width:vp.width,height:vp.height,orientation:vp.orientation,ratio:vp.ratio,
      touch:touch,coarse:coarse,profile:profile,density:density
    };
  }

  function applyNow(){
    scheduled=false;
    var p=detect();
    var body=document.body;
    var html=document.documentElement;
    html.style.setProperty("--app-height",p.height+"px");
    html.style.setProperty("--app-width",p.width+"px");
    var alle=["tablet-fit","tablet-portrait","adaptive-desktop-compact","adaptive-compact","adaptive-very-compact"];
    for(var i=0;i<alle.length;i++){body.classList.remove(alle[i])}
    if(p.profile==="tablet-landscape"){body.classList.add("tablet-fit")}
    if(p.profile==="tablet-portrait"){body.classList.add("tablet-portrait")}
    if(p.profile==="desktop-compact"){body.classList.add("adaptive-desktop-compact")}
    if(p.density==="compact"){body.classList.add("adaptive-compact")}
    if(p.density==="very-compact"){body.classList.add("adaptive-very-compact")}
    if(body.dataset){body.dataset.layoutProfile=p.profile;body.dataset.layoutDensity=p.density}
    else{body.setAttribute("data-layout-profile",p.profile);body.setAttribute("data-layout-density",p.density)}
    lastProfile=p.profile+":"+p.density+":"+p.width+"x"+p.height;
    try{
      window.dispatchEvent(new CustomEvent("adaptive-layout-change",{detail:p}));
    }catch(e){/* kein CustomEvent auf diesem Geraet - Rest der Funktion hat trotzdem gewirkt */}
    return p;
  }

  function recalculate(){
    if(scheduled){return}
    scheduled=true;
    if(window.requestAnimationFrame){
      window.requestAnimationFrame(function(){window.requestAnimationFrame(applyNow)});
    }else{
      setTimeout(applyNow,32);
    }
  }

  function init(){
    applyNow();
    window.addEventListener("resize",recalculate,false);
    if(window.visualViewport&&window.visualViewport.addEventListener){
      window.visualViewport.addEventListener("resize",recalculate,false);
    }
    window.addEventListener("orientationchange",recalculate,false);
    document.addEventListener("fullscreenchange",recalculate,false);
  }

  window.AdaptiveLayoutCore={
    version:VERSION,
    init:init,
    detect:detect,
    viewport:viewport,
    recalculate:recalculate,
    profile:function(){return detect().profile},
    lastProfile:function(){return lastProfile}
  };
})();
