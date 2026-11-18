'use strict';
const assert=require('node:assert/strict');
const {authenticatedClockTransport}=require('../markt-kasse-suite/backend-source/manager-companion/time-clock-auth-relay');
(async()=>{
 assert.throws(()=>authenticatedClockTransport({token:'',publishableKey:'test-public'}),/anmelden/);
 const calls=[];
 const transport=authenticatedClockTransport({token:'test-session',publishableKey:'test-public',fetchImpl:async(url,options)=>{
  calls.push({url,options});return {ok:true,json:async()=>({ok:true})};
 }});
 await transport.send([{id:'ZEIT-TEST'}]);await transport.readState();
 assert.equal(calls.length,2);
 for(const call of calls){assert(call.url.startsWith('https://ptblnpiroqftcvlsrhac.supabase.co/rest/v1/rpc/'));assert.equal(call.options.headers.Authorization,'Bearer test-session');assert.equal(JSON.parse(call.options.body).p_org_id,'KC_WERNE');}
 assert(!JSON.stringify(calls.map(c=>JSON.parse(c.options.body))).includes('test-session'));
 await assert.rejects(()=>authenticatedClockTransport({token:'test-session',publishableKey:'test-public',fetchImpl:async()=>({ok:false,status:401})}).readState(),/Anmeldung/);
 const source=require('node:fs').readFileSync('markt-kasse-suite/backend-source/manager-companion/index.js','utf8');
 const start=source.indexOf("      if (url.pathname === '/zeiterfassung/cloud-senden'");
 const stop=source.indexOf("      if (req.method === 'GET' && url.pathname === '/zeiterfassung/cloud-status'",start);
 const handler=require('node:vm').runInNewContext('(function(req,res){const url=new URL(req.url,"http://localhost");'+source.slice(start,stop)+'})',{URL,require:()=>({authenticatedClockTransport:()=>({send:async()=>({ok:true})})})});
 async function request(headers,remote='127.0.0.1'){
  const req=new (require('node:events').EventEmitter)();Object.assign(req,{method:'POST',url:'/zeiterfassung/cloud-senden',headers,socket:{remoteAddress:remote}});
  let status;
  return new Promise(resolve=>{
   const res={setHeader(){},writeHead(code){status=code;},end(body){resolve({status,body});}};
   handler.call({timeClockCloud:{flush:async()=>({ok:true}),status:()=>({pending:0})}},req,res);
   req.emit('data',JSON.stringify({publishableKey:'test-public'}));req.emit('end');
  });
 }
 assert.equal((await request({})).status,401);
 assert.equal((await request({authorization:'Bearer test-session',origin:'https://foreign.invalid'})).status,403);
 assert.equal((await request({authorization:'Bearer test-session'},'192.0.2.1')).status,403);
 assert.equal((await request({authorization:'Bearer test-session',origin:'http://127.0.0.1:8765'})).status,200);
 console.log('PASS authenticated relay: fixed project, current session, exact organization, no credential in payload, expired session rejected.');
})().catch(e=>{console.error(e);process.exitCode=1});
