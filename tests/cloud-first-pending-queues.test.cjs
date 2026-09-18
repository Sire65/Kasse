const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

const serving=fs.readFileSync(path.join(root,'pc-manager/recipe-serving-materials-supabase.js'),'utf8');
assert.match(serving,/PENDING_STORE='kcm_serving_materials_pending_v1'/);
assert.match(serving,/if\(!navigator\.onLine\)\{if\(now!==lastSnapshot\)capturePending/);
assert.match(serving,/if\(pending\(\)\)return/);
assert.match(serving,/await pull\(\);\s*if\(!restorePendingLocal\(\)\)return false;\s*await push\(\);/);
assert.match(serving,/global\.addEventListener\('online',\(\)=>\{ready=false;syncNow\(false\)\}\)/);

const ui=fs.readFileSync(path.join(root,'pc-manager/recipe-serving-materials.js'),'utf8');
assert.match(ui,/Lokale Offline-Änderung vorhanden/);
assert.match(ui,/servingPendingRestore/);
assert.match(ui,/servingPendingPush/);

const inventory=fs.readFileSync(path.join(root,'pc-manager/inventory-supabase-integration.js'),'utf8');
assert.match(inventory,/id="sbFlushQueue"/);
assert.match(inventory,/async function flushQueueConfirmed/);
assert.doesNotMatch(inventory,/flush\(\)\.then\(loadCounts\)/);
assert.doesNotMatch(inventory,/async function loadCounts\(\)[\s\S]{0,250}await flush\(\)/);

console.log('Cloud-first Pending-Schutz: Ausgabegefäße und Inventur senden Warteschlangen nicht automatisch.');
