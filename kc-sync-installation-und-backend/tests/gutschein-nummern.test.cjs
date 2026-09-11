// Gutscheinnummern: zentrale Vergabe und Prüfsignatur.
//
// Geprüft wird gegen den echten Manager-Companion mit echter Datenbank, nicht gegen Attrappen:
//   - die Nummer kommt fortlaufend aus dem Manager (nicht mehr aus dem localStorage der Kasse)
//   - der Code trägt eine Signatur, die ohne das Geheimnis des Managers nicht zu bilden ist
//   - eine erfundene oder veränderte Nummer fällt auf
//   - eine Meldung wird trotz auffälliger Signatur NIE verworfen, sondern nur markiert
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { ManagerCompanion } = require('../manager-companion');
const { DeviceCompanion } = require('../device-companion');
const { SCHEMA_VERSION, openManagerDb } = require('../manager-companion/db.js');
const sig = require('../manager-companion/kc-gutschein-signatur.js');

function tmpDb(name) { return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kcgs-')), name); }

function loopback(port, pfad, method, body) {
  return new Promise((resolve, reject) => {
    const daten = body ? JSON.stringify(body) : null;
    const req = http.request({ hostname: '127.0.0.1', port, path: pfad, method,
      headers: { 'Content-Type': 'application/json' } }, (res) => {
      let roh = ''; res.on('data', (c) => (roh += c));
      res.on('end', () => { try { resolve({ status: res.statusCode, body: roh ? JSON.parse(roh) : null }); }
                            catch (e) { resolve({ status: res.statusCode, body: roh }); } });
    });
    req.on('error', reject);
    if (daten) req.write(daten);
    req.end();
  });
}

const jahr = new Date().getFullYear();

function gutscheinMeldung(code, qr, betrag) {
  return { code, qr, kind: 'gutschein', amount: betrag, balance: betrag,
           issuedAt: new Date().toISOString(),
           expiresAt: new Date(Date.now() + 3 * 365 * 864e5).toISOString(),
           registerId: 'KASSE-01', redemptions: [] };
}

async function run() {
  let passed = 0;
  async function test(name, fn) {
    try { await fn(); passed++; console.log(`PASS  ${name}`); }
    catch (err) { console.error(`FAIL  ${name}\n      ${err.stack || err.message}`); process.exitCode = 1; }
  }

  await test('Schema kennt Nummernvorrat und Geheimnis, Version ist mitgezogen', async () => {
    const mgr = new ManagerCompanion({ dbPath: tmpDb('schema.sqlite') });
    await mgr.start();
    try {
      assert.strictEqual(mgr.db.prepare('PRAGMA user_version').get().user_version, SCHEMA_VERSION);
      for (const tabelle of ['voucher_numbers', 'voucher_secrets']) {
        assert.ok(mgr.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tabelle),
          `Tabelle ${tabelle} fehlt`);
      }
      const spalten = mgr.db.prepare('PRAGMA table_info(vouchers)').all().map((s) => s.name);
      assert.ok(spalten.includes('signature_ok'), 'Spalte signature_ok fehlt an vouchers');
    } finally { await mgr.stop(); }
  });

  await test('Nummern laufen fortlaufend und werden nie doppelt vergeben', () => {
    const db = openManagerDb(tmpDb('vergabe.sqlite'));
    const ersteRunde = sig.nummernVergeben(db, 3, 'KASSE-01');
    const zweiteRunde = sig.nummernVergeben(db, 3, 'KASSE-02');
    assert.deepStrictEqual(ersteRunde.map((n) => n.nummer),
      [`KC-${jahr}-0001`, `KC-${jahr}-0002`, `KC-${jahr}-0003`]);
    assert.deepStrictEqual(zweiteRunde.map((n) => n.nummer),
      [`KC-${jahr}-0004`, `KC-${jahr}-0005`, `KC-${jahr}-0006`]);
    const alle = [...ersteRunde, ...zweiteRunde].map((n) => n.nummer);
    assert.strictEqual(new Set(alle).size, 6, 'Eine Nummer wurde zweimal vergeben');
    db.close();
  });

  await test('Zwei Kassen bekommen getrennte Nummern - der alte Fehler kann nicht wiederkommen', () => {
    const db = openManagerDb(tmpDb('zweikassen.sqlite'));
    const a = sig.nummernVergeben(db, 5, 'KASSE-01').map((n) => n.nummer);
    const b = sig.nummernVergeben(db, 5, 'KASSE-02').map((n) => n.nummer);
    assert.strictEqual(a.filter((n) => b.includes(n)).length, 0, 'Beide Kassen haben dieselbe Nummer bekommen');
    db.close();
  });

  await test('Eigener Code wird als gültig erkannt', () => {
    const db = openManagerDb(tmpDb('gueltig.sqlite'));
    const [n] = sig.nummernVergeben(db, 1, 'KASSE-01');
    const ergebnis = sig.pruefe(db, n.qr);
    assert.strictEqual(ergebnis.gueltig, true, 'Eigener Code wurde abgelehnt');
    assert.strictEqual(ergebnis.nummer, n.nummer);
    db.close();
  });

  await test('Erfundene Nummer mit fremder Signatur fällt auf', () => {
    const db = openManagerDb(tmpDb('erfunden.sqlite'));
    const [n] = sig.nummernVergeben(db, 1, 'KASSE-01');
    const signatur = n.qr.split(':')[3];
    const gefaelscht = `KCG1:KC-${jahr}-9999:S1:${signatur}`;
    assert.strictEqual(sig.pruefe(db, gefaelscht).gueltig, false);
    assert.strictEqual(sig.pruefe(db, gefaelscht).grund, 'signatur');
    db.close();
  });

  await test('Signatur aus einem fremden Geheimnis fällt auf', () => {
    const eigen = openManagerDb(tmpDb('eigen.sqlite'));
    const fremd = openManagerDb(tmpDb('fremd.sqlite'));
    // Der Angreifer kennt Format, Jahr und Nummer - nur das Geheimnis nicht.
    const [beiFremd] = sig.nummernVergeben(fremd, 1, 'KASSE-01');
    sig.nummernVergeben(eigen, 1, 'KASSE-01');
    assert.strictEqual(sig.pruefe(eigen, beiFremd.qr).gueltig, false);
    eigen.close(); fremd.close();
  });

  await test('1000 geratene Signaturen zur echten Nummer treffen nicht', () => {
    const db = openManagerDb(tmpDb('raten.sqlite'));
    const [n] = sig.nummernVergeben(db, 1, 'KASSE-01');
    let treffer = 0;
    for (let i = 0; i < 1000; i++) {
      const zufall = sig.base32(crypto.randomBytes(15));
      if (sig.pruefe(db, `KCG1:${n.nummer}:S1:${zufall}`).gueltig) treffer++;
    }
    assert.strictEqual(treffer, 0);
    db.close();
  });

  await test('Schlüsselwechsel entwertet die alten Gutscheine nicht', () => {
    const db = openManagerDb(tmpDb('wechsel.sqlite'));
    const [alt] = sig.nummernVergeben(db, 1, 'KASSE-01');          // noch mit S1
    db.prepare('INSERT INTO voucher_secrets (generation, secret, created_at) VALUES (?, ?, ?)')
      .run('S2', crypto.randomBytes(32).toString('base64'), new Date().toISOString());
    const [neu] = sig.nummernVergeben(db, 1, 'KASSE-01');          // jetzt mit S2
    assert.ok(neu.qr.includes(':S2:'), 'Neue Nummer nutzt nicht die neue Generation');
    assert.strictEqual(sig.pruefe(db, alt.qr).gueltig, true, 'Alter Gutschein ist nach dem Wechsel wertlos');
    assert.strictEqual(sig.pruefe(db, neu.qr).gueltig, true);
    db.close();
  });

  await test('Gescannter Code und abgetippte Nummer führen zum selben Gutschein', () => {
    const db = openManagerDb(tmpDb('abtippen.sqlite'));
    const [n] = sig.nummernVergeben(db, 1, 'KASSE-01');
    assert.strictEqual(sig.nummerAus(n.qr), n.nummer);
    assert.strictEqual(sig.nummerAus(n.nummer.toLowerCase()), n.nummer);
    assert.strictEqual(sig.nummerAus('irgendwas'), null);
    db.close();
  });

  await test('Meldung mit gültiger Signatur wird als geprüft markiert und verbraucht die Nummer', async () => {
    const mgr = new ManagerCompanion({ dbPath: tmpDb('melden.sqlite') });
    const info = await mgr.start();
    const port = info.localStatusPort || mgr.localStatusPort || 47392;
    try {
      const [n] = sig.nummernVergeben(mgr.db, 1, 'KASSE-01');
      const antwort = await loopback(port, '/gutscheine/melden', 'POST',
        { gutscheine: [gutscheinMeldung(n.nummer, n.qr, 20)] });
      assert.strictEqual(antwort.status, 200);
      const zeile = mgr.db.prepare('SELECT signature_ok, balance FROM vouchers WHERE code = ?').get(n.nummer);
      assert.strictEqual(zeile.signature_ok, 1, 'Gültige Signatur wurde nicht als geprüft vermerkt');
      assert.strictEqual(zeile.balance, 20);
      const nummer = mgr.db.prepare('SELECT used FROM voucher_numbers WHERE code = ?').get(n.nummer);
      assert.strictEqual(nummer.used, 1, 'Die vergebene Nummer wurde nicht als verbraucht markiert');
    } finally { await mgr.stop(); }
  });

  await test('Gefälschte Meldung wird markiert, aber NICHT verworfen - der Restwert bleibt erhalten', async () => {
    const mgr = new ManagerCompanion({ dbPath: tmpDb('faelschung.sqlite') });
    const info = await mgr.start();
    const port = info.localStatusPort || mgr.localStatusPort || 47392;
    try {
      const erfunden = `KC-${jahr}-7777`;
      const antwort = await loopback(port, '/gutscheine/melden', 'POST',
        { gutscheine: [gutscheinMeldung(erfunden, `KCG1:${erfunden}:S1:AAAAAAAAAAAAAAAAAAAAAAAA`, 50)] });
      assert.strictEqual(antwort.status, 200, 'Die Meldung wurde abgewiesen - Restwerte dürfen nie verlorengehen');
      const zeile = mgr.db.prepare('SELECT signature_ok, balance FROM vouchers WHERE code = ?').get(erfunden);
      assert.ok(zeile, 'Der auffällige Gutschein steht gar nicht in der Datenbank');
      assert.strictEqual(zeile.signature_ok, 0, 'Der auffällige Gutschein ist nicht als solcher markiert');
      assert.strictEqual(zeile.balance, 50, 'Der Restwert wurde nicht mitgeführt');
    } finally { await mgr.stop(); }
  });

  await test('Alte GS-Nummern ohne Code bleiben gültig und werden nicht als Fälschung markiert', async () => {
    const mgr = new ManagerCompanion({ dbPath: tmpDb('altbestand.sqlite') });
    const info = await mgr.start();
    const port = info.localStatusPort || mgr.localStatusPort || 47392;
    try {
      const alt = gutscheinMeldung('GS-2026-0007-42', undefined, 15);
      const antwort = await loopback(port, '/gutscheine/melden', 'POST', { gutscheine: [alt] });
      assert.strictEqual(antwort.status, 200);
      const zeile = mgr.db.prepare('SELECT signature_ok, balance FROM vouchers WHERE code = ?').get('GS-2026-0007-42');
      assert.strictEqual(zeile.signature_ok, null, 'Ein Gutschein aus der Zeit vor der Umstellung gilt fälschlich als Fälschung');
      assert.strictEqual(zeile.balance, 15);
    } finally { await mgr.stop(); }
  });

  // Der eigentliche Weg am Markttag: Manager -> Companion (Vorrat) -> Kasse (eine Nummer).
  // Genau hier lag der alte Fehler bei Zeiterfassung und Gutscheinen - gemeldet wurde an den
  // Loopback-Kanal des Managers, den ein Tablet im WLAN nie erreicht. Der Vorrat laeuft
  // deshalb ueber den Companion auf dem Geraet selbst.
  await test('Ganze Kette: Manager vergibt, Companion bevorratet, Kasse holt eine Nummer', async () => {
    const mgr = new ManagerCompanion({ dbPath: tmpDb('kette-mgr.sqlite') });
    const info = await mgr.start();
    const dev = new DeviceCompanion({ dbPath: tmpDb('kette-dev.sqlite') });
    await dev.pair({ pairingToken: mgr.issuePairingToken(), expectedFingerprint: mgr.identity.fingerprint,
      host: '127.0.0.1', port: info.port });
    const server = await dev.startLocalStatusServer(0);   // 0 = freien Port vom System geben lassen
    const lokalerPort = server.address().port;
    try {
      const vorher = dev.db.prepare('SELECT COUNT(*) AS n FROM voucher_number_stock').get().n;
      assert.strictEqual(vorher, 0, 'Der Vorrat war vor dem Sync nicht leer');

      await dev.sync();
      const nachher = dev.db.prepare('SELECT COUNT(*) AS n FROM voucher_number_stock').get().n;
      assert.ok(nachher > 0, 'Der Companion hat keinen Nummernvorrat vom Manager geholt');

      // Und jetzt so, wie die Kasse es tut.
      const erste = await loopback(lokalerPort, '/kc-sync-voucher-number', 'GET');
      assert.strictEqual(erste.status, 200);
      assert.ok(sig.NUMMER_MUSTER.test(erste.body.nummer), `Nummer hat das falsche Format: ${erste.body.nummer}`);
      assert.strictEqual(sig.pruefe(mgr.db, erste.body.qr).gueltig, true,
        'Der an die Kasse gegebene Code besteht die Pruefung im Manager nicht');

      // Dieselbe Nummer darf kein zweites Mal herauskommen.
      const zweite = await loopback(lokalerPort, '/kc-sync-voucher-number', 'GET');
      assert.notStrictEqual(zweite.body.nummer, erste.body.nummer, 'Dieselbe Nummer wurde zweimal ausgegeben');
      assert.strictEqual(zweite.body.vorrat, nachher - 2, 'Der Vorrat wurde nicht korrekt heruntergezaehlt');
    } finally {
      try { server.close(); } catch (e) { /* egal */ }
      await mgr.stop();
    }
  });

  console.log(`\n${passed} Test(s) bestanden.`);
}

run();
