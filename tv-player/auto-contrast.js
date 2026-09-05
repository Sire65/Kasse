(()=>{'use strict';
function parse(v){const a=[];for(const m of (v||'').matchAll(/#([0-9a-f]{3,8})\b|rgba?\(([^)]+)\)/gi)){if(m[1]){let h=m[1];if(h.length===3||h.length===4)h=[...h].map(x=>x+x).join('');a.push([parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)])}else a.push(m[2].split(',').map(Number).slice(0,3))}return a}
function l(c){return c.map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)}
function apply(){const e=document.getElementById('screen');if(!e)return;const cs=getComputedStyle(e),c=[...parse(cs.backgroundImage),...parse(cs.backgroundColor)],dark=e.classList.contains('theme-light')||((c.reduce((s,x)=>s+l(x),0)/(c.length||1))>.48);e.classList.toggle('kc-auto-dark-text',dark);e.classList.toggle('kc-auto-light-text',!dark)}
document.addEventListener('DOMContentLoaded',()=>{const e=document.getElementById('screen');if(e)new MutationObserver(apply).observe(e,{attributes:true,attributeFilter:['class','style'],childList:true});apply()});
})();
