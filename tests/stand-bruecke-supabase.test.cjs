/* KS-04 – Supabase-Seite der Stand-Brücke (supabase/migrations/20261113_kc_stand_bruecke.sql), echt in PostgreSQL.
 * Läuft nur mit Datenbank: KC_TEST_PG (siehe tests/supabase-nachbau/postgrest-nachbau.cjs) und npm-Paket "pg".
 * Geprüft: Rechte (Admin / fremder Verein / anonym / Stand), Stand-Geheimnis, erlaubte Pfade, doppelte Ereignisse,
 * Aufträge abholen/quittieren, Abmelden.
 */
'use strict';
const path = require('path');
if (!process.env.KC_TEST_PG) { console.log('  ueberspringen: KC_TEST_PG nicht gesetzt (Test-PostgreSQL mit Grundlage + Migration)'); process.exit(0); }
let starteNachbau;
try { ({ starteNachbau } = require('./supabase-nachbau/postgrest-nachbau.cjs')); } catch (e) { console.log('  ueberspringen: npm-Paket "pg" fehlt'); process.exit(0); }
let ok = 0, rot = 0;
const p = (n, b, z = '') => { b ? ok++ : rot++; console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z !== '' ? '   [' + String(z).slice(0, 160) + ']' : ''}`); };

(async () => {
  const sb = await starteNachbau();
  const ADMIN = '11111111-1111-4111-8111-111111111111', FREMD = '22222222-2222-4222-8222-222222222222', KEIN = '33333333-3333-4333-8333-333333333333';
  const rpc = async (fn, args, token = sb.publishableKey) => {
    const a = await fetch(`${sb.url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: sb.publishableKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
    return { status: a.status, json: await a.json().catch(() => null) };
  };
  try {
    await sb.sql("delete from public.kc_stand; delete from public.kc_manager_memberships");
    await sb.sql("insert into public.kc_manager_memberships values ($1,'KC_WERNE','admin',true), ($2,'ANDERER_VEREIN','admin',true), ($3,'KC_WERNE','member',true)", [ADMIN, FREMD, KEIN]);

    const an = await rpc('kc_stand_anlegen', { p_name: 'Weihnachtsmarkt' }, `test-admin:${ADMIN}`);
    p('Admin legt einen Stand an und bekommt Stand-ID + Geheimnis', an.status === 200 && /^[0-9a-f-]{36}$/.test(an.json.standId) && /^[0-9a-f]{64}$/.test(an.json.geheimnis));
    const { standId, geheimnis } = an.json;
    const roh = await sb.sql('select geheimnis_hash from public.kc_stand where id = $1', [standId]);
    p('Geheimnis liegt nur als Hash in der Datenbank', roh[0].geheimnis_hash !== geheimnis && roh[0].geheimnis_hash.length === 64);
    p('Nicht-Admin (Mitglied) darf keinen Stand anlegen', (await rpc('kc_stand_anlegen', { p_name: 'x' }, `test-admin:${KEIN}`)).status === 403);
    p('Anonym darf keinen Stand anlegen', (await rpc('kc_stand_anlegen', { p_name: 'x' })).status >= 400);

    // Stand meldet
    const ev = [1, 2, 3].map((i) => ({ quelleId: i, art: i === 3 ? 'sold_out_changed' : 'sale', kasse: 'KASSE-01', payload: { registerId: 'KASSE-01', bon: i }, zeitpunkt: new Date().toISOString() }));
    const m1 = await rpc('kc_stand_melden', { p_stand: standId, p_geheimnis: geheimnis, p_ereignisse: ev, p_spiegel: { '/kassen-verbindungen': { kassen: [{ kasse: 'KASSE-01' }] }, '/kassen/datenschluessel': { geheim: 1 } }, p_info: { version: 'test' } });
    p('Stand meldet 3 Ereignisse + Spiegel', m1.status === 200 && m1.json.angenommenBis === 3, JSON.stringify(m1.json));
    const m2 = await rpc('kc_stand_melden', { p_stand: standId, p_geheimnis: geheimnis, p_ereignisse: ev });
    const anzahl = (await sb.sql('select count(*)::int n from public.kc_stand_ereignis where stand_id = $1', [standId]))[0].n;
    p('Doppelt gemeldete Ereignisse werden nicht doppelt gespeichert (Nachreichen ist sicher)', m2.status === 200 && anzahl === 3, `${anzahl}`);
    const spiegelPfade = (await sb.sql('select pfad from public.kc_stand_spiegel where stand_id = $1', [standId])).map((z) => z.pfad);
    p('Spiegel: nur erlaubte Pfade, Datenschlüssel werden NICHT gespeichert', spiegelPfade.join() === '/kassen-verbindungen', spiegelPfade.join());
    p('Falsches Geheimnis wird abgewiesen', (await rpc('kc_stand_melden', { p_stand: standId, p_geheimnis: 'falsch', p_ereignisse: [] })).status === 401);

    // Admin liest
    const liste = await rpc('kc_stand_liste', {}, `test-admin:${ADMIN}`);
    p('Admin sieht seinen Stand mit „zuletzt gemeldet“', liste.json.length === 1 && liste.json[0].sekundenSeitMeldung !== null && liste.json[0].info.version === 'test');
    p('Admin eines ANDEREN Vereins sieht ihn nicht', JSON.stringify((await rpc('kc_stand_liste', {}, `test-admin:${FREMD}`)).json) === '[]');
    const start = await rpc('kc_stand_ereignisse', { p_stand: standId, p_nach_id: null }, `test-admin:${ADMIN}`);
    p('Startpunkt: nur letzte ID, keine Ereignisse', start.json.ereignisse.length === 0 && start.json.letzteId > 0);
    const alle = await rpc('kc_stand_ereignisse', { p_stand: standId, p_nach_id: 0 }, `test-admin:${ADMIN}`);
    p('Admin liest die Ereignisse in Reihenfolge', alle.json.ereignisse.map((e) => e.payload.bon).join() === '1,2,3');
    p('Fremder Verein darf die Ereignisse nicht lesen', (await rpc('kc_stand_ereignisse', { p_stand: standId, p_nach_id: 0 }, `test-admin:${FREMD}`)).status === 400);
    p('Anonym darf die Ereignisse nicht lesen', (await rpc('kc_stand_ereignisse', { p_stand: standId, p_nach_id: 0 })).status >= 400);
    const sp = await rpc('kc_stand_spiegel', { p_stand: standId, p_pfad: '/kassen-verbindungen' }, `test-admin:${ADMIN}`);
    p('Admin liest den Spiegel samt Alter', sp.json.vorhanden && sp.json.inhalt.kassen[0].kasse === 'KASSE-01' && sp.json.sekundenAlt >= 0);

    // Aufträge
    p('Auftrag mit nicht erlaubtem Pfad wird abgelehnt', (await rpc('kc_stand_auftrag_anlegen', { p_stand: standId, p_pfad: '/kassen/datenschluessel', p_koerper: {} }, `test-admin:${ADMIN}`)).status === 400);
    p('Fremder Verein darf keinen Auftrag anlegen', (await rpc('kc_stand_auftrag_anlegen', { p_stand: standId, p_pfad: '/master-data/push', p_koerper: {} }, `test-admin:${FREMD}`)).status === 400);
    const au = await rpc('kc_stand_auftrag_anlegen', { p_stand: standId, p_pfad: '/master-data/push', p_koerper: { articles: [{ id: 'grot', price: 3.7 }] } }, `test-admin:${ADMIN}`);
    p('Admin legt Auftrag „Stammdaten senden“ an', au.status === 200 && au.json.auftragId > 0);
    p('Auftrag steht auf „wartet“', (await rpc('kc_stand_auftrag', { p_auftrag: au.json.auftragId }, `test-admin:${ADMIN}`)).json.status === 'wartet');
    const m3 = await rpc('kc_stand_melden', { p_stand: standId, p_geheimnis: geheimnis });
    p('Stand bekommt den Auftrag beim nächsten Melden', m3.json.auftraege.length === 1 && m3.json.auftraege[0].koerper.articles[0].price === 3.7);
    p('Auftrag steht danach auf „abgeholt“', (await rpc('kc_stand_auftrag', { p_auftrag: au.json.auftragId }, `test-admin:${ADMIN}`)).json.status === 'abgeholt');
    const m4 = await rpc('kc_stand_melden', { p_stand: standId, p_geheimnis: geheimnis });
    p('Noch nicht quittierter Auftrag kommt erneut (geht bei Absturz nicht verloren)', m4.json.auftraege.length === 1);
    p('Quittieren mit falschem Geheimnis abgewiesen', (await rpc('kc_stand_auftrag_erledigt', { p_stand: standId, p_geheimnis: 'x', p_auftrag: au.json.auftragId, p_status: 200, p_antwort: {} })).status === 401);
    const q = await rpc('kc_stand_auftrag_erledigt', { p_stand: standId, p_geheimnis: geheimnis, p_auftrag: au.json.auftragId, p_status: 200, p_antwort: { revision: 5 } });
    p('Stand quittiert den Auftrag', q.json.quittiert === true);
    const st = (await rpc('kc_stand_auftrag', { p_auftrag: au.json.auftragId }, `test-admin:${ADMIN}`)).json;
    p('Zuhause sieht „erledigt“ mit der Antwort des Stands', st.status === 'erledigt' && st.statusCode === 200 && st.antwort.revision === 5);
    p('Erledigter Auftrag kommt nicht noch einmal', (await rpc('kc_stand_melden', { p_stand: standId, p_geheimnis: geheimnis })).json.auftraege.length === 0);

    // Abmelden
    p('Admin meldet den Stand ab', (await rpc('kc_stand_abmelden', { p_stand: standId }, `test-admin:${ADMIN}`)).json.abgemeldet === true);
    p('Abgemeldeter Stand kann nichts mehr melden', (await rpc('kc_stand_melden', { p_stand: standId, p_geheimnis: geheimnis })).status === 401);
    p('Direkter Tabellenzugriff ist für anon gesperrt', await sb.sql("set role anon; select 1 from public.kc_stand limit 1").then(() => false, () => true).finally(() => sb.sql('reset role')));
  } catch (e) { rot++; console.log('FEHLER  Abbruch: ' + (e && e.stack || e)); }
  finally { await sb.schliessen(); }
  console.log(`\nStand-Brücke Supabase-Seite (KS-04): ${ok}/${ok + rot} bestanden`);
  process.exit(rot ? 1 : 0);
})();
