(()=>{
"use strict";
const VERSION="0.2.0",KEY="kc_audit_events_v021";
const sanitize=v=>{if(v==null)return v;if(typeof v==="string")return v.slice(0,500);if(Array.isArray(v))return v.slice(0,50).map(sanitize);if(typeof v==="object"){const o={};for(const [k,x] of Object.entries(v)){if(/pin|password|secret|token|credential/i.test(k))continue;o[k]=sanitize(x)}return o}return v};
function read(){try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}}
function append(event={}){const row={auditId:event.auditId||crypto.randomUUID(),time:event.time||new Date().toISOString(),actor:event.actor||"unknown",role:event.role||"unknown",deviceId:event.deviceId||null,registerId:event.registerId||null,sessionId:event.sessionId||null,action:event.action||"unknown",entity:event.entity||null,entityId:event.entityId||null,result:event.result||"success",reason:event.reason||null,before:sanitize(event.before),after:sanitize(event.after),metadata:sanitize(event.metadata)};const rows=read();rows.push(row);localStorage.setItem(KEY,JSON.stringify(rows.slice(-10000)));return row}
function query(filter={}){return read().filter(x=>Object.entries(filter).every(([k,v])=>v==null||x[k]===v))}
function exportJson(){return{format:"KC_AUDIT_V1",version:VERSION,createdAt:new Date().toISOString(),events:read()}}
window.KCAuditCore=Object.freeze({VERSION,KEY,append,read,query,exportJson,sanitize});
})();
