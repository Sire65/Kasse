'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ManagerCompanion } = require('../manager-companion');
const { DeviceCompanion } = require('../device-companion');

function fakeRes() {
  return { status:null, body:null, writeHead(s){this.status=s;}, end(t){this.body=t?JSON.parse(t):null;} };
}
function push(manager, body) {
  const res=fakeRes();
  manager._dienstplanPush({socket:{remoteAddress:'127.0.0.1'}},res,body);
  assert.equal(res.status,200);
  return res.body;
}

(async()=>{
  const plan=[{pseudonym:'Einhorn',date:'2026-12-04',start:'12:00',end:'18:00',area:'Kasse'}];
  const meta={eventId:'KC-WM-2026',sourceUpdatedAt:'2026-09-23T05:01:00.000Z'};

  const manager=new ManagerCompanion({dbPath:':memory:'});
  const first=push(manager,{...meta,schichten:plan});
  assert.equal(first.revision,1);
  assert.equal(first.unchanged,false);
  const second=push(manager,{...meta,schichten:plan});
  assert.equal(second.revision,1,'Identischer Plan darf Revision nicht erhoehen.');
  assert.equal(second.unchanged,true);
  const third=push(manager,{...meta,schichten:[{...plan[0],end:'19:00'}]});
  assert.equal(third.revision,2,'Inhaltliche Aenderung muss Revision erhoehen.');
  manager.db.close();

  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kc-dienstplan-'));
  const dbPath=path.join(dir,'device.sqlite');
  const d1=new DeviceCompanion({dbPath});
  d1.db.prepare("UPDATE device_identity SET credential_id=?, pinned_fingerprint=? WHERE id=1").run('cred_test.secret','sha256:test');
  d1.knownManagerHost={host:'manager.test',port:47392};
  d1._request=async()=>({
    schichten:plan,revision:7,eventId:'KC-WM-2026',
    sourceUpdatedAt:'2026-09-23T05:01:00.000Z',
    updatedAt:'2026-09-23T05:02:00.000Z'
  });
  await d1._syncDienstplan();
  let row=d1.db.prepare('SELECT schichten_json,revision,event_id,source_updated_at,manager_updated_at,cached_at FROM dienstplan_cache WHERE id=1').get();
  assert.equal(row.revision,7);
  assert.equal(row.event_id,'KC-WM-2026');
  assert.equal(row.source_updated_at,'2026-09-23T05:01:00.000Z');
  assert.equal(row.manager_updated_at,'2026-09-23T05:02:00.000Z');
  assert.deepEqual(JSON.parse(row.schichten_json),plan);
  assert.ok(row.cached_at);
  d1.db.close();

  const d2=new DeviceCompanion({dbPath});
  row=d2.db.prepare('SELECT schichten_json,revision,event_id FROM dienstplan_cache WHERE id=1').get();
  assert.equal(row.revision,7);
  assert.equal(row.event_id,'KC-WM-2026');
  assert.deepEqual(JSON.parse(row.schichten_json),plan);
  d2.db.prepare("UPDATE device_identity SET credential_id=?, pinned_fingerprint=? WHERE id=1").run('cred_test.secret','sha256:test');
  d2.knownManagerHost={host:'manager.test',port:47392};
  d2._request=async()=>{throw new Error('offline');};
  await assert.rejects(()=>d2._syncDienstplan(),/offline/);
  row=d2.db.prepare('SELECT schichten_json,revision FROM dienstplan_cache WHERE id=1').get();
  assert.equal(row.revision,7);
  assert.deepEqual(JSON.parse(row.schichten_json),plan);
  d2.db.close();

  fs.rmSync(dir,{recursive:true,force:true});
  console.log('dienstplan-bridge-v2: OK');
})().catch(err=>{console.error(err);process.exit(1);});
