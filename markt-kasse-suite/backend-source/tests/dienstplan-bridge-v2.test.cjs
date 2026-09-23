'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ManagerCompanion } = require('../manager-companion');
const { DeviceCompanion } = require('../device-companion');

function fakeRes() {
  return {
    status: null,
    body: null,
    writeHead(status) { this.status = status; },
    end(text) { this.body = text ? JSON.parse(text) : null; },
  };
}

function pushPlan(manager, schichten) {
  const res = fakeRes();
  manager._dienstplanPush(
    { socket: { remoteAddress: '127.0.0.1' } },
    res,
    { eventId: 'KC-WM-2026', schichten }
  );
  assert.equal(res.status, 200);
  return res.body;
}

(async () => {
  // 1) Manager: identischer Snapshot darf den Planstand nicht kuenstlich aendern.
  const manager = new ManagerCompanion({ dbPath: ':memory:' });
  const planA = [{ pseudonym: 'Einhorn', date: '2026-12-04', start: '12:00', end: '18:00', area: 'Kasse' }];
  const first = pushPlan(manager, planA);
  assert.equal(first.revision, 1);
  assert.equal(first.unchanged, false);
  const firstUpdatedAt = first.updatedAt;

  const second = pushPlan(manager, planA);
  assert.equal(second.revision, 1);
  assert.equal(second.unchanged, true);
  assert.equal(second.updatedAt, firstUpdatedAt);

  const third = pushPlan(manager, [{ ...planA[0], end: '19:00' }]);
  assert.equal(third.revision, 2);
  assert.equal(third.unchanged, false);
  manager.db.close();

  // 2) Kassen-Companion: Dienstplan ueberlebt einen Prozess-/Companion-Neustart.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-dienstplan-'));
  const dbPath = path.join(tmpDir, 'device.sqlite');
  const device1 = new DeviceCompanion({ dbPath });
  device1.db.prepare(
    "UPDATE device_identity SET credential_id = ?, pinned_fingerprint = ? WHERE id = 1"
  ).run('cred_test.secret', 'sha256:test');
  device1.knownManagerHost = { host: 'manager.test', port: 47392 };
  device1._request = async () => ({
    schichten: planA,
    revision: 7,
    updatedAt: '2026-09-23T04:15:00.000Z',
  });
  await device1._syncDienstplan();

  let row = device1.db.prepare(
    'SELECT schichten_json, revision, updated_at, fetched_at FROM dienstplan_cache WHERE id = 1'
  ).get();
  assert.equal(row.revision, 7);
  assert.equal(row.updated_at, '2026-09-23T04:15:00.000Z');
  assert.deepEqual(JSON.parse(row.schichten_json), planA);
  assert.ok(row.fetched_at);
  device1.db.close();

  const device2 = new DeviceCompanion({ dbPath });
  row = device2.db.prepare(
    'SELECT schichten_json, revision, updated_at, fetched_at FROM dienstplan_cache WHERE id = 1'
  ).get();
  assert.equal(row.revision, 7);
  assert.deepEqual(JSON.parse(row.schichten_json), planA);

  // 3) Ein fehlgeschlagener neuer Abruf darf den persistenten Stand nicht loeschen.
  device2.db.prepare(
    "UPDATE device_identity SET credential_id = ?, pinned_fingerprint = ? WHERE id = 1"
  ).run('cred_test.secret', 'sha256:test');
  device2.knownManagerHost = { host: 'manager.test', port: 47392 };
  device2._request = async () => { throw new Error('offline'); };
  await assert.rejects(() => device2._syncDienstplan(), /offline/);
  row = device2.db.prepare('SELECT schichten_json, revision FROM dienstplan_cache WHERE id = 1').get();
  assert.equal(row.revision, 7);
  assert.deepEqual(JSON.parse(row.schichten_json), planA);
  device2.db.close();

  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(dbPath + suffix); } catch (_) {}
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log('dienstplan-bridge-v2: OK');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
