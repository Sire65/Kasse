'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'pc-manager', 'kc-dienstplan-manager.js'), 'utf8');
const queries = [];
let pushed = null;
const context = {
  window: {
    KCSupabase: {
      istAngemeldet: () => true,
      rufeTabelleAuf: async (q) => {
        queries.push(q);
        if (q.startsWith('kc_dp_plan_published')) return [
          { person_id: 'P1', work_date: '2026-12-04', start_time: '12:00:00', end_time: '18:00:00', break_minutes: 0, zone: 'V', area: 'Kasse' },
          { person_id: 'P2', work_date: '2026-12-04', start_time: '16:00:00', end_time: '20:00:00', break_minutes: 0, zone: 'H', area: 'Bereitschaft' },
        ];
        return [{ person_id: 'P1', alias_name: 'Einhorn' }, { person_id: 'P2', alias_name: 'Puhbär' }];
      },
    },
  },
  document: { readyState: 'loading', addEventListener: () => {} },
  fetch: async (_url, options) => {
    pushed = JSON.parse(options.body);
    return { ok: true };
  },
  setInterval: () => 1,
  clearInterval: () => {},
  setTimeout: () => 1,
  encodeURIComponent,
  Date,
  console,
};
vm.createContext(context);
vm.runInContext(source, context);

(async () => {
  const result = await context.window.KCDienstplanManager.holeUndVeroeffentliche();
  assert.equal(result.ok, true);
  assert.equal(result.eventId, 'KC-WM-2026');
  assert.ok(queries[0].includes('event_id=eq.KC-WM-2026'), 'PC-Manager muss nach der Veranstaltung filtern.');
  assert.deepEqual(pushed.schichten.map((s) => s.pseudonym), ['Einhorn', 'Puhbär']);
  assert.equal(pushed.schichten[1].area, 'Bereitschaft');
  assert.equal(pushed.eventId, 'KC-WM-2026');
  console.log('dienstplan-pc-manager-v2: OK');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
