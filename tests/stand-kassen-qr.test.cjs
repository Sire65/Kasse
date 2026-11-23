'use strict';
// KC-STAND-KASSEN-QR (23.11.2026): Mini-PC meldet die Kassen-QR-Codes für den Adminbereich der Club-App –
// nur bei Änderung, nur mit Stand-Geheimnis, Migration ohne Rechte für anon/authenticated auf der Tabelle.
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { StandBruecke } = require('../markt-kasse-suite/backend-source/stand-bruecke');
let n = 0; const p = (t, b) => { assert.ok(b, t); n++; console.log('  OK  ' + t); };

(async () => {
  const aufrufe = [];
  const kassen = [{ id: 'KASSE-01', port: 47500, token: 'a', zettelStatus: 'gueltig' }, { id: 'KASSE-02', port: 47501, token: 'b' }, { id: 'KASSE-03', port: 47502, token: null }];
  const ks = { kassen, qrAdresse: (k) => (k.token ? `http://192.168.1.103:8090/pos/index.html?kcPort=${k.port}&kcToken=${k.token}&kcRegisterId=${k.id}` : null) };
  const b = Object.create(StandBruecke.prototype);
  Object.assign(b, { kassenStart: ks, log: () => {}, _rpc: async (z, name, args) => { aufrufe.push({ name, args }); return { gespeichert: args.p_kassen.length }; } });
  const z = { standId: 'S1', geheimnis: 'G' };
  await b._kassenQrMelden(z);
  p('erste Meldung mit Stand-Geheimnis', aufrufe.length === 1 && aufrufe[0].name === 'kc_stand_kassen_qr_melden' && aufrufe[0].args.p_geheimnis === 'G');
  p('nur Kassen mit Schlüssel, mit URL und Port', aufrufe[0].args.p_kassen.length === 2 && aufrufe[0].args.p_kassen[0].url.includes('kcToken=a') && aufrufe[0].args.p_kassen[1].port === 47501);
  await b._kassenQrMelden(z);
  p('ohne Änderung keine zweite Meldung', aufrufe.length === 1);
  kassen[1].token = 'neu';
  await b._kassenQrMelden(z);
  p('neuer Schlüssel (Gerät verloren) wird sofort gemeldet', aufrufe.length === 2 && aufrufe[1].args.p_kassen[1].url.includes('kcToken=neu'));
  const b2 = Object.create(StandBruecke.prototype);
  Object.assign(b2, { kassenStart: ks, log: () => {}, _rpc: async () => { throw Object.assign(new Error('nicht da'), { status: 404 }); } });
  let wurf = null; try { await b2._kassenQrMelden(z); } catch (e) { wurf = e; }
  p('fehlt die Funktion in Supabase: kein Absturz, kein Dauerversuch', !wurf && b2._kassenQrStand);
  const ohne = Object.create(StandBruecke.prototype); Object.assign(ohne, { _rpc: async () => { throw new Error('darf nicht'); } });
  await ohne._kassenQrMelden(z);
  p('ohne Kassen-Start nichts senden', true);

  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase/migrations/20261123_kc_stand_kassen_qr.sql'), 'utf8');
  p('Tabelle: RLS an, keine Rechte für anon/authenticated, nur service_role', /enable row level security/.test(sql) && /revoke all on public\.kc_stand_kassen_qr from public, anon, authenticated/.test(sql) && /to service_role;/.test(sql) && !/grant select[^;]*kc_stand_kassen_qr to (anon|authenticated)/.test(sql));
  p('Melden prüft zuerst das Stand-Geheimnis', /v := public\.kc_stand__pruefe\(p_stand, p_geheimnis\)/.test(sql));
  p('SECURITY DEFINER im Prüfregister', /kc_security_reviewed_exceptions/.test(sql) && /security_definer_anon_execute/.test(sql));
  console.log(`stand-kassen-qr: ${n} Prüfungen OK`);
})().catch((e) => { console.error(e); process.exit(1); });
