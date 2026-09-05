(function(g){'use strict';
const clone=v=>structuredClone?structuredClone(v):JSON.parse(JSON.stringify(v));
function diff(before=[],after=[]){const by=new Map(before.map(x=>[x.id,x])),out=[];after.forEach((s,i)=>{const old=by.get(s.id);if(!old)out.push({kind:'added',slideId:s.id,index:i,title:s.title||''});else if(JSON.stringify(old)!==JSON.stringify(s))out.push({kind:'changed',slideId:s.id,index:i,title:s.title||'',before:old,after:s});by.delete(s.id)});by.forEach(s=>out.push({kind:'deleted',slideId:s.id,title:s.title||'',before:s}));return out;}
function createLogEntry(kind,detail,user){return{id:crypto.randomUUID?.()||('log-'+Date.now()),at:new Date().toISOString(),kind,detail,user:user||''};}
g.KCMobilePresentationExchangeCore=Object.freeze({version:'0.1.0',clone,diff,createLogEntry});
})(window);
