/* KC-STAND-LEITUNG (19.11.2026) – Signale der direkten Leitung aus supabase/migrations/20261119_kc_stand_leitung.sql,
 * echt in PostgreSQL (Nachbau: tests/supabase-nachbau, einrichten mit tests/supabase-nachbau/einrichten.cjs).
 * Läuft nur mit KC_TEST_PG und den npm-Paketen "pg" und "ws". Geprüft:
 *   Stand bekommt seinen Kanal (nur nach Prüfung des Geheimnisses), neuer Auftrag → „auftrag“ + ID an den Stand-Kanal,
 *   Melden mit neuen Ereignissen → „stand“, mit Spiegel → „stand-spiegel“, doppelt gemeldete Ereignisse → kein Signal,
 *   Quittieren → „auftrag-erledigt“, Stempel → EIN „stempel“ je Transaktion, Sparbremse 70 %/95 %, Rechte, Prüfregister,
 *   Leitung über den WebSocket-Nachbau (phx_join → broadcast).
 */
'use strict';
if (!process.env.KC_TEST_PG) { console.log('  ueberspringen: KC_TEST_PG nicht gesetzt (Test-PostgreSQL, siehe tests/supabase-nachbau/einrichten.cjs)'); process.exit(0); }
let starteNachbau;
try { ({ starteNachbau } = require('./supabase-nachbau/postgrest-nachbau.cjs')); } catch (e) { console.log('  ueberspringen: npm-Paket "pg" fehlt'); process.exit(0); }
let ok = 0, rot = 0;
const p = (n, b, z = '') => { b ? ok++ : rot++; console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z !== '' ? '   [' + String(z).slice(0, 200) + ']' : ''}`); };
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const sb = await starteNachbau();
  const ADMIN = '11111111-1111-4111-8111-111111111111';
  const rpc = async (fn, args, token = sb.publishableKey) => {
    const a = await fetch(`${sb.url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: sb.publishableKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
    return { status: a.status, json: await a.json().catch(() => null) };
  };
  const signaleSeit = async (n, ms = 400) => { await warte(ms); return sb.signale.slice(n); };
  try {
    if (!(await sb.sql("select 1 from pg_proc where proname = 'kc_stand__kanal'")).length) { console.log('  ueberspringen: 20261119_kc_stand_leitung.sql nicht eingespielt'); process.exit(0); }
    await sb.sql('delete from public.kc_stand; delete from public.kc_manager_memberships; delete from public.kc_club_rt_zaehler; delete from public.kc_dp_stempel');
    await sb.sql("insert into public.kc_manager_memberships values ($1,'KC_WERNE','admin',true)", [ADMIN]);
    const MANAGER = (await sb.sql("select public.kc_rt_programm_kanal_intern('manager','KC_WERNE') k"))[0].k;
    const an = await rpc('kc_stand_anlegen', { p_name: 'Leitungstest' }, `test-admin:${ADMIN}`);
    const { standId, geheimnis } = an.json;

    // Kanal
    const m0 = await rpc('kc_stand_melden', { p_stand: standId, p_geheimnis: geheimnis });
    const kanal = m0.json && m0.json.kanal;
    p('Stand bekommt seinen Kanal aus kc_stand_melden (nicht erratbar, nicht der Manager-Kanal)', /^kc-rt-[0-9a-f]{32}$/.test(kanal || '') && kanal !== MANAGER, kanal);
    p('Falsches Geheimnis: kein Kanal, abgewiesen', (await rpc('kc_stand_melden', { p_stand: standId, p_geheimnis: 'falsch' })).status === 401);
    p('Kanal ist nicht direkt abrufbar (anon / angemeldet)', (await rpc('kc_stand__kanal', { p_stand: standId })).status >= 400 && (await rpc('kc_stand__kanal', { p_stand: standId }, `test-admin:${ADMIN}`)).status >= 400);

    // Leitung über den WebSocket-Nachbau: Stand hört auf seinem Kanal
    const empfangen = [];
    const ws = new WebSocket(`${sb.url.replace('http', 'ws')}/realtime/v1/websocket?apikey=${sb.publishableKey}&vsn=1.0.0`);
    await new Promise((r, f) => { ws.onopen = r; ws.onerror = f; });
    ws.onmessage = (e) => empfangen.push(JSON.parse(e.data));
    ws.send(JSON.stringify({ topic: 'realtime:' + kanal, event: 'phx_join', payload: { config: { broadcast: { self: false }, private: false } }, ref: '1' }));
    await warte(200);
    p('Leitung: Anmeldung am Stand-Kanal bestätigt', empfangen.some((m) => m.event === 'phx_reply' && m.topic === 'realtime:' + kanal && m.payload.status === 'ok'));

    // Auftrag → Signal an den Stand
    let n = sb.signale.length;
    const au = await rpc('kc_stand_auftrag_anlegen', { p_stand: standId, p_pfad: '/sold-out-status/setzen', p_koerper: { articleId: 'grot', soldOut: true } }, `test-admin:${ADMIN}`);
    let neu = await signaleSeit(n);
    p('Neuer Auftrag → Signal „auftrag“ mit Auftrags-ID an den Stand-Kanal', neu.length === 1 && neu[0].topic === kanal && neu[0].art === 'auftrag' && neu[0].id === au.json.auftragId, JSON.stringify(neu));
    const b = empfangen.find((m) => m.event === 'broadcast');
    p('… kommt über die Leitung an, ohne Inhalt (nur Art + ID)', !!b && b.payload.event === 'neu' && JSON.stringify(Object.keys(b.payload.payload).sort()) === '["art","id"]', JSON.stringify(b));

    // Melden → Signale an den Manager-Kanal
    n = sb.signale.length;
    const ev = [{ quelleId: 1, art: 'sale', kasse: 'KASSE-01', payload: { registerId: 'KASSE-01' }, zeitpunkt: new Date().toISOString() }];
    const m1 = await rpc('kc_stand_melden', { p_stand: standId, p_geheimnis: geheimnis, p_ereignisse: ev, p_spiegel: { '/kassen-verbindungen': { kassen: [] } } });
    neu = await signaleSeit(n);
    p('Melden mit neuem Ereignis + Spiegel → „stand“ und „stand-spiegel“ an den Manager-Kanal', neu.length === 2 && neu.every((s) => s.topic === MANAGER) && neu.map((s) => s.art).sort().join() === 'stand,stand-spiegel', JSON.stringify(neu));
    p('… und der Stand bekommt den Auftrag', m1.json.auftraege.length === 1);
    n = sb.signale.length;
    await rpc('kc_stand_melden', { p_stand: standId, p_geheimnis: geheimnis, p_ereignisse: ev });
    p('Doppelt gemeldetes Ereignis, kein Spiegel → kein Signal', (await signaleSeit(n)).length === 0);

    // Quittieren
    n = sb.signale.length;
    await rpc('kc_stand_auftrag_erledigt', { p_stand: standId, p_geheimnis: geheimnis, p_auftrag: au.json.auftragId, p_status: 200, p_antwort: { gesetzt: true } });
    neu = await signaleSeit(n);
    p('Quittieren → „auftrag-erledigt“ an den Manager-Kanal', neu.length === 1 && neu[0].art === 'auftrag-erledigt' && neu[0].topic === MANAGER, JSON.stringify(neu));
    n = sb.signale.length;
    await rpc('kc_stand_auftrag_erledigt', { p_stand: standId, p_geheimnis: geheimnis, p_auftrag: au.json.auftragId, p_status: 200, p_antwort: {} });
    p('Zweites Quittieren desselben Auftrags → kein Signal', (await signaleSeit(n)).length === 0);

    // Stempel: viele Buchungen in einer Transaktion → ein Signal
    n = sb.signale.length;
    await sb.sql("do $$ begin insert into public.kc_dp_stempel (org_id, member_no, art) values ('KC_WERNE','1','in'); insert into public.kc_dp_stempel (org_id, member_no, art) values ('KC_WERNE','2','in'); update public.kc_dp_stempel set art = 'out' where member_no = '1'; end $$");
    neu = await signaleSeit(n);
    p('Stempel: 3 Anweisungen in einer Transaktion → EIN „stempel“ an den Manager-Kanal', neu.length === 1 && neu[0].art === 'stempel' && neu[0].topic === MANAGER, JSON.stringify(neu));

    // Sparbremse
    const monat = (await sb.sql("select to_char(now() at time zone 'Europe/Berlin','YYYY-MM') m"))[0].m;
    await sb.sql('insert into public.kc_club_rt_zaehler (monat, anzahl) values ($1, 1500000) on conflict (monat) do update set anzahl = 1500000', [monat]);
    n = sb.signale.length;
    await rpc('kc_stand_melden', { p_stand: standId, p_geheimnis: geheimnis, p_ereignisse: [{ ...ev[0], quelleId: 2 }] });
    const au2 = await rpc('kc_stand_auftrag_anlegen', { p_stand: standId, p_pfad: '/master-data/push', p_koerper: {} }, `test-admin:${ADMIN}`);
    neu = await signaleSeit(n);
    p('Über 70 % des Kontingents: kein „stand“ mehr, „auftrag“ weiter', neu.length === 1 && neu[0].art === 'auftrag', JSON.stringify(neu));
    await sb.sql('update public.kc_club_rt_zaehler set anzahl = 1950000 where monat = $1', [monat]);
    n = sb.signale.length;
    await rpc('kc_stand_auftrag_anlegen', { p_stand: standId, p_pfad: '/master-data/push', p_koerper: {} }, `test-admin:${ADMIN}`);
    p('Über 95 %: gar keine Signale mehr – der Auftrag wird trotzdem angelegt', (await signaleSeit(n)).length === 0 && au2.status === 200);
    await sb.sql('delete from public.kc_club_rt_zaehler');

    // Rechte / Prüfregister
    const recht = async (fn, rolle) => (await sb.sql(`select has_function_privilege('${rolle}', p.oid, 'execute') r from pg_proc p where proname = $1`, [fn]))[0].r;
    let intern = true;
    for (const fn of ['kc_stand__kanal', 'kc_stand__zaehlen', 'kc_stand__signal_manager', 'kc_stand__auftrag_signal', 'kc_stand__stempel_signal'])
      for (const r of ['anon', 'authenticated']) if (await recht(fn, r)) intern = false;
    p('Neue Hilfsfunktionen: weder anon noch authenticated', intern);
    p('kc_stand_melden / kc_stand_auftrag_erledigt: anon + authenticated wie bisher', (await recht('kc_stand_melden', 'anon')) && (await recht('kc_stand_auftrag_erledigt', 'authenticated')));
    const reg = (await sb.sql("select count(*)::int n from public.kc_security_reviewed_exceptions where object_name in ('kc_stand_melden','kc_stand_auftrag_erledigt') and active"))[0].n;
    p('Prüfregister: kc_stand_melden / kc_stand_auftrag_erledigt (anon + authenticated) eingetragen', reg === 4, String(reg));
    ws.close();
  } catch (e) { rot++; console.log('FEHLER  Abbruch: ' + (e && e.stack || e)); }
  finally { await sb.schliessen(); }
  console.log(`\nStand-Leitung Supabase-Seite (KC-STAND-LEITUNG): ${ok}/${ok + rot} bestanden`);
  process.exit(rot ? 1 : 0);
})();
