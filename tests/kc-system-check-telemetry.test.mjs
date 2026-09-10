import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const flow = fs.readFileSync('pc-manager/kc-datenfluss-melder.js','utf8');
const monitor = fs.readFileSync('pc-manager/kc-live-monitor.js','utf8');
const managerHtml = fs.readFileSync('pc-manager/index.html','utf8');
const posLive = fs.readFileSync('pos/kc-sync-live-event.js','utf8');

test('PC Manager lädt den echten Datenfluss-Melder',()=>{
  assert.match(managerHtml,/kc-datenfluss-melder\.js/);
  assert.match(flow,/const PROGRAMM = 'pc-manager'/);
  assert.match(flow,/const MONEY_BUTLER = 'money-butler'/);
});

test('Money Butler wird nur im echten cashprep-Bereich als Quelle markiert',()=>{
  assert.match(flow,/data-view-panel=\\?"cashprep\\?"/);
  assert.match(flow,/classList\.contains\('active'\)/);
  assert.match(flow,/return MONEY_BUTLER/);
  assert.match(flow,/return PROGRAMM/);
});

test('Telemetrie erzeugt keinen eigenen Scheinverkehr',()=>{
  assert.match(flow,/const originalFetch = global\.fetch\.bind\(global\)/);
  assert.match(flow,/originalFetch\(`\$\{SUPABASE_URL\}\/realtime\/v1\/api\/broadcast`/);
  assert.match(flow,/originalFetch\(`\$\{SUPABASE_URL\}\/functions\/v1\/kicc-program-heartbeat`/);
});

test('Kassen-Liveereignisse werden real Kasse -> PC Manager gezählt',()=>{
  assert.match(monitor,/KCDatenfluss\?\.kasse\(registerId, evt\)/);
  assert.match(flow,/zaehle\(von, PROGRAMM, bytes, false\)/);
  assert.match(posLive,/setInterval\(sendeLebenszeichen, 30000\)/);
  assert.match(posLive,/sendLiveEvent\('heartbeat'/);
});

test('Unklare Kassen-ID wird nicht künstlich als Kasse 01 ausgegeben',()=>{
  assert.match(flow,/const von = n \? `kasse-\$\{n\[1\]\.padStart\(2, '0'\)\}` : null/);
  assert.match(flow,/if \(!von\) return/);
});
