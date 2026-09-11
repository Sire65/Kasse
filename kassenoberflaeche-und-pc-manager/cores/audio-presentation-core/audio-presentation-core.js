(function(g){'use strict';
let player=null,current='';
function normalize(p){p.audio=p.audio||{};return Object.assign({enabled:false,type:'music',src:'',volume:.55,loop:true,autoplay:true},p.audio);}
function stop(){if(player){player.pause();player.removeAttribute('src');player.load();player=null;current='';}}
function play(p,{base='../'}={}){const a=normalize(p);if(!a.enabled||!a.src){stop();return null;}const src=/^(data:|blob:|https?:|\/)/i.test(a.src)?a.src:base+a.src.replace(/^\.\//,'');if(!player){player=new Audio();player.preload='auto';}player.volume=Math.max(0,Math.min(1,+a.volume||0));player.loop=a.loop!==false;if(current!==src){player.src=src;current=src;}if(a.autoplay!==false){const promise=player.play();promise?.catch(()=>{});}return player;}
async function library(url='../media/audio/audio-library.json'){try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)return[];const d=await r.json();return Array.isArray(d.tracks)?d.tracks:[];}catch{return[];}}
g.KCAudioPresentationCore=Object.freeze({version:'0.1.0',normalize,play,stop,library});
})(window);
