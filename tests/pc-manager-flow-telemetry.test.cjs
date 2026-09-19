'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','pc-manager','kc-manager-supabase-status.js'),'utf8');

test('flow telemetry follows successful RPC guard',()=>{
 const start=source.indexOf('async function rufeFunktionAuf');
 const guard=source.indexOf('if (!antwort.ok)',start);
 const call=source.indexOf("void meldeEchtenDatenfluss('rpc'",guard);
 assert.ok(start>=0&&guard>start&&call>guard);
});

test('telemetry posts directly without wrapper recursion',()=>{
 const start=source.indexOf('async function meldeEchtenDatenfluss');
 const end=source.indexOf('// Ruft eine Postgres-Funktion',start);
 const fn=source.slice(start,end);
 assert.ok(fn.includes('/rest/v1/rpc/kicc_report_program_flow'));
 assert.ok(!fn.includes('rufeFunktionAuf('));
 assert.ok(fn.includes('catch (e)'));
});

test('flow identity is PC Manager to KC Core Supabase',()=>{
 assert.ok(source.includes("p_program_id: 'kc-pc-manager'"));
 assert.ok(source.includes("p_source_id: 'pc-manager'"));
 assert.ok(source.includes("p_target_id: 'supabase-kc-core'"));
});

test('manager script remains valid JavaScript',()=>{
 assert.doesNotThrow(()=>new vm.Script(source));
});
