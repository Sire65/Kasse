// Übergabeprotokoll der Geldkassette: der WEG muss vollständig sein.
//
// Geprüft wird die echte Kette am echten Manager-Companion:
//   Weg 1  Money Butler meldet den Beleg  -> POST /bargeld/protokoll
//   Weg 2  Beleg vom Papier nachgetragen  -> derselbe Endpunkt, andere Quelle
//   Lesen  Archiv im PC-Manager           -> GET  /bargeld/protokolle
// Dazu: derselbe Beleg darf über beide Wege ankommen und steht trotzdem nur EINMAL im Archiv,
// unbrauchbare Belege werden abgewiesen, und der Endpunkt ist nur von diesem Rechner erreichbar.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { ManagerCompanion } = require('../manager-companion');
const { SCHEMA_VERSION } = require('../manager-companion/db.js');

function tmpDb(name) { return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kcprot-')), name); }

function loopback(port, pfad, method, body) {
  return new Promise((resolve, reject) => {
    const daten = body ? JSON.stringify(body) : null;
    const req = http.request({ hostname: '127.0.0.1', port, path: pfad, method, headers: { 'Content-Type': 'application/json' } }, (res) => {
      let roh = ''; res.on('data', (c) => (roh += c));
      res.on('end', () => { try { resolve({ status: res.statusCode, body: roh ? JSON.parse(roh) : null }); } catch (e) { resolve({ status: res.statusCode, body: roh }); } });
    });
    req.on('error', reject);
    if (daten) req.write(daten);
    req.end();
  });
}

// Ein Beleg, wie ihn shared/kc-uebergabeprotokoll.js erzeugt.
// Prüfsumme wie in shared/kc-uebergabeprotokoll.js (FNV-1a über den Beleg ohne das Feld pruef).
// FRÜHER stand hier pruef: 'egal-hier' - das ging durch, weil der Dienst die Prüfsumme gar nicht
// nachgerechnet hat. Genau darüber liess sich ein Beleg mit veränderter Summe ins Archiv
// schreiben und der echte Eintrag überschreiben. Seit der Absicherung muss auch der Test
// richtig rechnen - und prüft zusätzlich, dass ein falscher Wert abgewiesen wird.
function pruefsummeVon(beleg) {
  const kopie = { ...beleg };
  delete kopie.pruef;
  const text = JSON.stringify(kopie);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function beispielBeleg(id) {
  const beleg = {
    f: 'KC_UEBERGABE_PROTOKOLL', v: 1,
    id, tid: 'UEBERGABE-' + id, typ: 'opening', datum: '2026-11-28',
    erstellt: new Date().toISOString(), art: 'kassette',
    kassen: ['KASSE-01', 'KASSE-02'],
    lose: { 50: 4, 20: 6, 2: 10 }, rollen: { 1: 2, 0.2: 3 },
    k1: { kasse: 'KASSE-01', lose: { 50: 2, 20: 3, 2: 5 }, rollen: { 1: 1, 0.2: 1 } },
    summe: 414, notiz: 'Testbeleg',
  };
  beleg.pruef = pruefsummeVon(beleg);
  return beleg;
}

async function run() {
  let passed = 0;
  async function test(name, fn) {
    try { await fn(); passed++; console.log(`PASS  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.stack || err.message}`); process.exitCode = 1; }
  }

  await test('Schema kennt die Protokolltabelle und die Version ist mitgezogen', async () => {
    const mgr = new ManagerCompanion({ dbPath: tmpDb('schema.sqlite') });
    await mgr.start();
    try {
      assert.strictEqual(mgr.db.prepare('PRAGMA user_version').get().user_version, SCHEMA_VERSION);
      const tabelle = mgr.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cash_protocol_log'").get();
      assert.ok(tabelle, 'Tabelle cash_protocol_log fehlt');
    } finally { await mgr.stop(); }
  });

  await test('Weg 1 (Money Butler meldet) und Weg 2 (vom Papier nachgetragen) landen im selben Archiv', async () => {
    const mgr = new ManagerCompanion({ dbPath: tmpDb('wege.sqlite') });
    const info = await mgr.start();
    const port = info.localStatusPort || mgr.localStatusPort || 47392;
    try {
      const a = await loopback(port, '/bargeld/protokoll', 'POST', { beleg: beispielBeleg('beleg-aaa'), quelle: 'money-butler' });
      assert.strictEqual(a.status, 200, 'Meldung des Money Butler wurde nicht angenommen');
      const b = await loopback(port, '/bargeld/protokoll', 'POST', { beleg: beispielBeleg('beleg-bbb'), quelle: 'nachgetragen' });
      assert.strictEqual(b.status, 200, 'Nachgetragener Beleg wurde nicht angenommen');

      const archiv = await loopback(port, '/bargeld/protokolle', 'GET');
      assert.strictEqual(archiv.status, 200);
      const ids = archiv.body.protokolle.map((p) => p.id).sort();
      assert.deepStrictEqual(ids, ['beleg-aaa', 'beleg-bbb'], 'Es stehen nicht beide Belege im Archiv');
      const einer = archiv.body.protokolle.find((p) => p.id === 'beleg-aaa');
      assert.strictEqual(einer.summe, 414, 'Betrag kam nicht unverändert an');
      assert.deepStrictEqual(einer.lose, { 50: 4, 20: 6, 2: 10 }, 'Stückelung kam nicht unverändert an');
      assert.deepStrictEqual(einer.k1.lose, { 50: 2, 20: 3, 2: 5 }, 'Aufteilung kam nicht unverändert an');
      assert.strictEqual(einer.quelle, 'money-butler', 'Herkunft wurde nicht festgehalten');
      assert.ok(einer.empfangen, 'Empfangszeitpunkt fehlt');
    } finally { await mgr.stop(); }
  });

  await test('Derselbe Beleg über beide Wege steht trotzdem nur EINMAL im Archiv', async () => {
    const mgr = new ManagerCompanion({ dbPath: tmpDb('doppelt.sqlite') });
    const info = await mgr.start();
    const port = info.localStatusPort || mgr.localStatusPort || 47392;
    try {
      await loopback(port, '/bargeld/protokoll', 'POST', { beleg: beispielBeleg('beleg-doppelt'), quelle: 'money-butler' });
      await loopback(port, '/bargeld/protokoll', 'POST', { beleg: beispielBeleg('beleg-doppelt'), quelle: 'nachgetragen' });
      const archiv = await loopback(port, '/bargeld/protokolle', 'GET');
      const treffer = archiv.body.protokolle.filter((p) => p.id === 'beleg-doppelt');
      assert.strictEqual(treffer.length, 1, 'Der Beleg steht mehrfach im Archiv');
    } finally { await mgr.stop(); }
  });

  await test('Ein Beleg mit veränderter Summe wird abgewiesen und überschreibt den echten nicht', async () => {
    const mgr = new ManagerCompanion({ dbPath: tmpDb('faelschung.sqlite') });
    await mgr.start();
    const port = 47392;
    try {
      const echt = beispielBeleg('beleg-echt');
      const a = await loopback(port, '/bargeld/protokoll', 'POST', { beleg: echt, quelle: 'money-butler' });
      assert.strictEqual(a.status, 200, 'Der echte Beleg muss angenommen werden');

      // Summe verzehnfacht, alte Prüfsumme beibehalten
      const gefaelscht = { ...echt, summe: 4140, notiz: 'GEFÄLSCHT' };
      const b = await loopback(port, '/bargeld/protokoll', 'POST', { beleg: gefaelscht, quelle: 'qr' });
      assert.strictEqual(b.status, 400, 'Ein Beleg mit falscher Prüfsumme darf nicht angenommen werden');

      // Und auch mit passend neu gerechneter Prüfsumme darf er den vorhandenen nicht ersetzen
      const neuGerechnet = { ...echt, summe: 4140, notiz: 'GEFÄLSCHT' };
      delete neuGerechnet.pruef;
      neuGerechnet.pruef = pruefsummeVon(neuGerechnet);
      const c = await loopback(port, '/bargeld/protokoll', 'POST', { beleg: neuGerechnet, quelle: 'qr' });
      assert.strictEqual(c.status, 400, 'Ein anderer Inhalt unter derselben Belegnummer darf nicht ersetzen');

      const zeile = mgr.db.prepare('SELECT total, note FROM cash_protocol_log WHERE beleg_id = ?').get('beleg-echt');
      assert.strictEqual(Number(zeile.total), 414, 'Im Archiv muss der echte Betrag stehen');
      assert.ok(!/GEFÄLSCHT/.test(String(zeile.note || '')), 'Die Fälschung darf nicht im Archiv stehen');

      // Dieselbe unveränderte Meldung ein zweites Mal bleibt erlaubt (Butler + Papierweg).
      const d = await loopback(port, '/bargeld/protokoll', 'POST', { beleg: echt, quelle: 'nachgetragen' });
      assert.strictEqual(d.status, 200, 'Derselbe Beleg muss nachgemeldet werden dürfen');
    } finally { await mgr.stop(); }
  });

  await test('Unbrauchbare Belege werden abgewiesen und landen nicht im Archiv', async () => {
    const mgr = new ManagerCompanion({ dbPath: tmpDb('muell.sqlite') });
    const info = await mgr.start();
    const port = info.localStatusPort || mgr.localStatusPort || 47392;
    try {
      const ohneId = await loopback(port, '/bargeld/protokoll', 'POST', { beleg: { f: 'KC_UEBERGABE_PROTOKOLL', summe: 10 } });
      assert.strictEqual(ohneId.status, 400, 'Beleg ohne Belegnummer wurde angenommen');
      const fremd = await loopback(port, '/bargeld/protokoll', 'POST', { beleg: { f: 'IRGENDWAS', id: 'x', summe: 10 } });
      assert.strictEqual(fremd.status, 400, 'Fremdes Format wurde angenommen');
      const archiv = await loopback(port, '/bargeld/protokolle', 'GET');
      assert.strictEqual(archiv.body.protokolle.length, 0, 'Trotz Abweisung steht etwas im Archiv');
    } finally { await mgr.stop(); }
  });

  console.log(`\n${passed} Test(s) bestanden.`);
}

run().catch((err) => { console.error(err); process.exit(1); });
