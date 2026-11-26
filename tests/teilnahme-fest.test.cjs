// 26.11.2026 (Betreiber): KC-0004 und KC-0013 sind für den Weihnachtsmarkt 2026 fest „nicht verfügbar“ –
// steht im Programm (nicht im Browser-Speicher), gilt also auch nach jedem Update. Aufruf: node tests/teilnahme-fest.test.cjs
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'pc-manager', 'time-clock-manager.js'), 'utf8');
const block = src.slice(src.indexOf('const TEILNAHME_FEST = {'), src.indexOf('const festVon ='));
const FEST = new Function(block.replace('const TEILNAHME_FEST =', 'return') )();
assert.deepStrictEqual(Object.keys(FEST['WM-2026']).sort(), ['KC-0004', 'KC-0013'], 'zwei feste Einträge');
for (const k of ['KC-0004', 'KC-0013']) assert.strictEqual(FEST['WM-2026'][k].status, 'nein', 'nicht verfügbar');
const festVon = new Function('TEILNAHME_FEST', 'veranstaltung', 'schluessel', src.slice(src.indexOf('const festVon ='), src.indexOf('const teilnahmeVon =')) + 'return festVon;');
for (const ev of ['WM-2026', 'KC-WM-2026', 'kc-wm-2026']) assert.ok(festVon(FEST, () => ev, (p) => p.credential)({ credential: 'KC-0013' }), 'gilt für ' + ev);
assert.strictEqual(festVon(FEST, () => 'WM-2027', (p) => p.credential)({ credential: 'KC-0013' }), null, 'nur dieser Weihnachtsmarkt');
assert.ok(/const teilnahmeVon = \(person\) => festVon\(person\)\?\.status \|\|/.test(src), 'feste Vorgabe geht vor dem Browser-Speicher');
assert.ok(/if \(festVon\(person\)\) status = festVon\(person\)\.status;/.test(src), 'Auswahl ändert die feste Vorgabe nicht');
assert.ok(/festVon\(person\) \? 'disabled title="Fest eingetragen/.test(src) && /🔒 fest/.test(src), 'in der Liste gesperrt und markiert');
console.log('teilnahme-fest: ok');
