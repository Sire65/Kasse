const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'cores/time-clock-core/time-clock-core.js'), 'utf8'), context);
vm.runInNewContext(fs.readFileSync(path.join(root, 'shared/time-clock-duty-roster-adapter-v010.js'), 'utf8'), context);
const core = context.window.KCTimeClockCore;

assert.equal(core.version, '0.1.0');
const member = core.normalizePerson({id:'M-1',displayName:'Test Mitglied',birthCode:'010170',credential:'TC-ABC'});
const helper = core.normalizePerson({id:'H-1',type:'helper',displayName:'Aushilfe',credential:'TC-HILFE',hourlyRate:14,
  validFrom:'2026-11-01T00:00:00Z',validUntil:'2026-12-31T23:59:59Z'});
assert.equal(core.identify([member], '010170', '2026-12-01').person.id, 'M-1');
assert.equal(core.identify([helper], 'TC-HILFE', '2027-01-01').code, 'CREDENTIAL_EXPIRED');

const incoming = core.createEvent({personId:member.id,kind:'in',effectiveAt:'2026-12-01T10:00:00Z',recordedAt:'2026-12-01T10:00:00Z',registerId:'K1'}, []);
assert.throws(() => core.createEvent({personId:member.id,kind:'in',registerId:'K1'}, [incoming]), /bereits angemeldet/);
const outgoing = core.createEvent({personId:member.id,kind:'out',effectiveAt:'2026-12-01T15:30:00Z',recordedAt:'2026-12-01T15:30:00Z',registerId:'K2'}, [incoming]);
assert.throws(() => core.createEvent({personId:helper.id,kind:'in',effectiveAt:'2026-12-01T09:00:00Z',recordedAt:'2026-12-01T09:20:00Z',registerId:'K1'}, []), /Korrekturgrund/);

const merge = core.mergeEvents([incoming], [incoming, outgoing]);
assert.equal(merge.added, 1);
assert.equal(merge.events.length, 2);
const summary = core.summarize(merge.events, [member]);
assert.equal(summary[0].hours, 5.5);
assert.equal(summary[0].present, false);

const config = core.makeConfigPackage({enabled:true,eventId:'WM-2026'}, [member,helper]);
assert.equal(config.schema, 'KC_TIME_CLOCK_CONFIG_V1');
assert.equal(config.people.length, 2);
assert.equal(core.makeEventDelta(merge.events, 'K1').schema, 'KC_TIME_CLOCK_EVENT_DELTA_V1');

const compared = context.window.KCTimeClockDutyRosterAdapter.compare(summary, [{personId:'M-1',hours:5}]);
assert.equal(compared[0].varianceHours, .5);
assert.equal(compared[0].rosterMatch, true);

const managerIndex = fs.readFileSync(path.join(root, 'pc-manager/index.html'), 'utf8');
const posIndex = fs.readFileSync(path.join(root, 'pos/index.html'), 'utf8');
assert.match(managerIndex, /time-clock-core\/time-clock-core\.js/);
assert.match(managerIndex, /time-clock-manager\.js/);
assert.match(posIndex, /time-clock-pos\.js/);
assert.match(posIndex, /time-clock-pos\.css/);
assert.ok(fs.existsSync(path.join(root, 'cores/time-clock-core/studio-catalog-entry.json')));
assert.ok(fs.existsSync(path.join(root, 'cores/time-clock-core/tuv-rules.json')));

console.log('TimeClockCore, Aushilfen, Delta-Abgleich und Dienstplan-Ist-Schnittstelle: OK');
