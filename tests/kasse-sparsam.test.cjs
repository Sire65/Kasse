/* KC-KASSE-SPARSAM (18.11.2026) – weniger Supabase-Abfragen, ohne Netz und ohne Browser geprüft:
 *  - Fernmodus: Spiegel 25 s zwischengespeichert, gleichzeitige gleiche Anfragen zusammengefasst, Auftragsrückfrage
 *    mit wachsender Pause, FernSocket 10 s / 60 s verborgen, Standliste 60 s
 *  - Stand-Brücke: anpassender Takt (5 s / 30 s), große Übersichten nur alle 5 Minuten
 *  - Dienstplan: unveränderter Plan wird nicht erneut weitergegeben
 *  - Stempel: mehrere Buchungen in einem Aufruf, Rückfall auf einzeln bei Ablehnung
 *  - Migration 20261118_kc_stand_sparsam.sql: Rechte wie Ursprung, kein Aufräumen im Melden, Zeitplan
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const W = path.join(__dirname, '..');
const lies = (p) => fs.readFileSync(path.join(W, p), 'utf8');
let ok = 0;
const p = (name, b) => { assert.ok(b, name); ok++; console.log('  OK  ' + name); };

(async () => {
  // ---------- Fernmodus: Zwischenspeicher und Auftragsrückfrage ----------
  {
    const src = lies('pc-manager/kc-fernmodus.js');
    const aufrufe = [];
    let auftragStatus = 0;
    const timers = [];
    const ctx = {
      console, JSON, Math, Date, Promise, Map, URLSearchParams, Error, TypeError, Response, AbortSignal,
      localStorage: { getItem: () => JSON.stringify({ standId: 'S1', name: 'Test' }), setItem() {} },
      document: { body: null, hidden: false, addEventListener() {}, removeEventListener() {}, getElementById: () => null },
      // Pausen nur aufzeichnen und sofort ausführen; lange Takte (Standliste, Socket) gar nicht ausführen
      setTimeout: (f, ms) => { timers.push(ms); return ms >= 10000 ? 0 : setTimeout(f, 0); },
      clearTimeout,
    };
    ctx.window = ctx;
    ctx.fetch = async (url) => (String(url).includes('/kc-kassen-start/modus') ? new Response(JSON.stringify({ modus: 'zuhause' })) : new Response('{}'));
    ctx.WebSocket = function () {};
    ctx.KCSupabase = {
      istAngemeldet: () => true,
      rufeFunktionAuf: async (name, args) => {
        aufrufe.push(name);
        await new Promise((r) => setTimeout(r, 5));
        if (name === 'kc_stand_spiegel') return { vorhanden: true, inhalt: { kassen: [] }, sekundenAlt: 3, sekundenSeitMeldung: 4 };
        if (name === 'kc_stand_liste') return [{ standId: 'S1', name: 'Test', sekundenSeitMeldung: 1 }];
        if (name === 'kc_stand_auftrag_anlegen') return { auftragId: 7 };
        if (name === 'kc_stand_auftrag') { auftragStatus++; return { status: auftragStatus >= 3 ? 'erledigt' : 'wartet', statusCode: 200, antwort: { ok: 1 } }; }
        if (name === 'kc_stand_ereignisse') return args.p_nach_id === null ? { letzteId: 12, ereignisse: [] }
          : { ereignisse: [{ id: 11, art: 'sale', payload: { bon: 1 }, zeitpunkt: 'a' }, { id: 12, art: 'storno', payload: { bon: 2 }, zeitpunkt: 'b' }], sekundenSeitMeldung: 2 };
        throw new Error('unerwartet ' + name);
      },
    };
    vm.createContext(ctx);
    vm.runInContext(src, ctx);
    await ctx.KCFernmodus.bestimmeModus();
    aufrufe.length = 0;
    const [a, b] = await Promise.all([ctx.fetch('http://127.0.0.1:47392/kassen-verbindungen'), ctx.fetch('http://127.0.0.1:47392/kassen-verbindungen')]);
    await ctx.fetch('http://127.0.0.1:47392/kassen-verbindungen');
    p('Fernmodus: drei Lesungen desselben Spiegels = eine Supabase-Abfrage', aufrufe.filter((n) => n === 'kc_stand_spiegel').length === 1 && a.status === 200 && b.status === 200);
    await ctx.fetch('http://127.0.0.1:47392/sold-out-status-alle');
    p('Fernmodus: anderer Pfad wird eigens gelesen', aufrufe.filter((n) => n === 'kc_stand_spiegel').length === 2);
    const verlauf = await (await ctx.fetch('http://127.0.0.1:47392/live-event-log?limit=50')).json();
    p('Fernmodus: Verlauf aus den Ereignissen, neueste zuerst, gleiches Format wie am Stand',
      verlauf.events.length === 2 && verlauf.events[0].type === 'storno' && verlauf.events[0].receivedAt === 'b' && verlauf.events[1].payload.bon === 1);
    timers.length = 0; aufrufe.length = 0;
    const r = await ctx.fetch('http://127.0.0.1:47392/sold-out-status/setzen', { method: 'POST', body: JSON.stringify({ articleId: 'x', soldOut: true }) });
    const pausen = timers.filter((ms) => ms > 0 && ms < 10000);
    p('Fernmodus: Auftrag erledigt nach 3 Rückfragen mit wachsender Pause (1 s, 2 s, 4 s)', r.status === 200 && pausen.join() === '1000,2000,4000' && auftragStatus === 3);
    await ctx.fetch('http://127.0.0.1:47392/kassen-verbindungen');
    p('Fernmodus: nach erledigtem Auftrag wird der Spiegel frisch gelesen', aufrufe.filter((n) => n === 'kc_stand_spiegel').length === 1);
    p('Fernmodus: Rückfragen höchstens 7 (vorher 15), zusammen 39 s', /AUFTRAG_PAUSEN_MS = \[1000, 2000, 4000, 8000, 8000, 8000, 8000\]/.test(src));
    p('Fernmodus: FernSocket 10 s sichtbar / 60 s verborgen, Fehler-Backoff, Standliste 60 s',
      /SOCKET_TAKT_MS = 10000, SOCKET_TAKT_VERBORGEN_MS = 60000/.test(src) && /Math\.pow\(2/.test(src) && /setTimeout\(runde, STAND_LISTE_MS\)/.test(src) && /STAND_LISTE_MS = 60000/.test(src));
  }

  // ---------- Stand-Brücke ----------
  {
    const { StandBruecke, SPIEGEL } = require('../markt-kasse-suite/backend-source/stand-bruecke');
    const abstand = Object.fromEntries(SPIEGEL.map(([k, , a]) => [k, a || 0]));
    p('Stand-Brücke: /verbindungsqualitaet nur alle 5 min und höchstens 100 Einträge',
      abstand['/verbindungsqualitaet'] === 300000 && SPIEGEL.find(([k]) => k === '/verbindungsqualitaet')[1] === '/verbindungsqualitaet?limit=100');
    p('Stand-Brücke: /live-event-log nur noch alle 5 min', abstand['/live-event-log'] === 300000);
    p('Stand-Brücke: Kassen-Übersicht und Ausverkauft weiter bei jedem Spiegel-Takt', abstand['/kassen-verbindungen'] === 0 && abstand['/sold-out-status-alle'] === 0);
    const b = new StandBruecke({ manager: {}, datenOrdner: path.join(W, 'nicht-vorhanden'), log() {}, fehlerLog() {} });
    p('Stand-Brücke: ohne Neues alle 30 s', b._naechsterTakt() === 30000);
    b._zuletztAktiv = Date.now() - 10000;
    p('Stand-Brücke: nach Verkauf/Auftrag in der letzten Minute alle 5 s', b._naechsterTakt() === 5000);
    // Spiegel-Abstände: zweite Sammlung kurz danach lässt die 5-Minuten-Pfade aus
    const geholt = [];
    const http = require('node:http');
    const srv = http.createServer((req, res) => { geholt.push(req.url); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"x":1}'); });
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    const b2 = new StandBruecke({ manager: { db: { prepare() { throw new Error('keine Tabelle'); } } }, datenOrdner: path.join(W, 'nicht-vorhanden'), livePort: srv.address().port, log() {}, fehlerLog() {} });
    const s1 = await b2._spiegelSammeln();
    for (const k of s1.__geprueft) b2._spiegelZuletzt.set(k, Date.now());
    const vorher = geholt.length; await b2._spiegelSammeln();
    const zweite = geholt.slice(vorher);
    srv.close();
    p('Stand-Brücke: zweiter Spiegel kurz danach ohne /verbindungsqualitaet und /live-event-log',
      geholt.includes('/verbindungsqualitaet?limit=100') && !zweite.some((u) => /verbindungsqualitaet|live-event-log/.test(u)) && zweite.includes('/kassen-verbindungen'));
  }

  // ---------- Dienstplan ----------
  {
    const src = lies('pc-manager/kc-dienstplan-manager.js');
    let pushes = 0, plan = [{ person_id: 'P1', work_date: '2026-12-04', start_time: '12:00:00', end_time: '18:00:00', updated_at: '2026-11-01T00:00:00Z' }];
    const ctx = { window: { KCSupabase: { istAngemeldet: () => true, rufeTabelleAuf: async (q) => (q.startsWith('kc_dp_plan_published') ? plan : [{ person_id: 'P1', alias_name: 'Einhorn' }]) } },
      document: { readyState: 'loading', addEventListener() {} }, fetch: async () => { pushes++; return { ok: true }; },
      setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, Date, JSON, console };
    vm.createContext(ctx); vm.runInContext(src, ctx);
    const D = ctx.window.KCDienstplanManager;
    await D.holeUndVeroeffentliche(); const r2 = await D.holeUndVeroeffentliche();
    p('Dienstplan: unveränderter Plan wird nicht erneut an Manager/Stand gegeben', pushes === 1 && r2.unveraendert === true);
    plan = [{ ...plan[0], end_time: '19:00:00' }];
    await D.holeUndVeroeffentliche();
    p('Dienstplan: geänderter Plan wird sofort weitergegeben', pushes === 2);
    await D.holeUndVeroeffentliche({ erzwingen: true });
    p('Dienstplan: erzwungen geht immer', pushes === 3);
  }

  // ---------- Stempel: gebündelt ----------
  {
    const { DatabaseSync } = require('node:sqlite');
    const { TimeClockCloudQueue } = require('../markt-kasse-suite/backend-source/manager-companion/time-clock-cloud-queue');
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE time_clock_events (event_id TEXT PRIMARY KEY,person_id TEXT,kind TEXT,recorded_at TEXT,effective_at TEXT,register_id TEXT,event_name TEXT,correction_reason TEXT,shift_reason TEXT,voided_at TEXT)');
    const ins = db.prepare('INSERT INTO time_clock_events VALUES (?,?,?,?,?,?,?,?,?,?)');
    for (let i = 1; i <= 5; i++) ins.run('Z' + i, 'P', i % 2 ? 'in' : 'out', `2026-12-02T0${i}:00:00Z`, `2026-12-02T0${i}:00:00Z`, 'K', 'KC-WM-2026', '', '', null);
    const aufrufe = [];
    const send = async (events) => { aufrufe.push(events.length); return { ok: true, contract: 'KC_DP_STEMPEL_KASSE_V1', accepted: events.map((e) => e.id) }; };
    const q = new TimeClockCloudQueue({ db, send, people: () => [{ id: 'P', credential: 'KC-1' }] });
    const r = await q.flush();
    p('Stempel: 5 Buchungen in EINEM Aufruf quittiert', r.ok && r.acknowledged === 5 && aufrufe.join() === '5' && q.pending().length === 0);
    db.prepare("UPDATE time_clock_events SET shift_reason='neu'").run();
    const aufrufe2 = [];
    const q2 = new TimeClockCloudQueue({ db, people: () => [{ id: 'P', credential: 'KC-1' }], send: async (events) => {
      aufrufe2.push(events.length);
      if (events.some((e) => e.id === 'Z3')) { const f = new Error('abgelehnt'); f.eventRejected = true; throw f; }
      return { ok: true, contract: 'KC_DP_STEMPEL_KASSE_V1', accepted: events.map((e) => e.id) };
    } });
    const r2 = await q2.flush();
    p('Stempel: lehnt die Zentrale das Bündel ab, einzeln weiter – nur die abgelehnte bleibt offen',
      !r2.ok && r2.acknowledged === 4 && aufrufe2.join() === '5,1,1,1,1,1' && q2.pending().map((x) => x.event.id).join() === 'Z3');
    db.close();
  }

  // ---------- Takte im PC-Manager ----------
  {
    const st = lies('pc-manager/kc-manager-supabase-status.js');
    p('Verbindungsprobe: ausgelassen, solange die direkte Leitung steht – spätestens alle 10 min',
      /KCDirekteLeitungManager\?\.steht\?\.\(\) && seit < 600000\) return;/.test(st));
    const ts = lies('pc-manager/time-clock-supabase-sync.js');
    p('Stempel-Abgleich: voller Abgleich nur sichtbar/offene Buchungen, sonst höchstens alle 5 min',
      /setInterval\(takt,30000\)/.test(ts) && /300000/.test(ts) && /cloud-status/.test(ts) && !/setInterval\(refresh,30000\)/.test(ts));
  }

  // ---------- Migration ----------
  {
    const alt = lies('supabase/migrations/20261113_kc_stand_bruecke.sql');
    const neu = lies('supabase/migrations/20261118_kc_stand_sparsam.sql');
    const code = neu.split('\n').filter((z) => !z.trim().startsWith('--')).join('\n');
    p('Migration: keine neue Tabelle, security definer bleibt', !/create table/i.test(code) && /kc_stand_melden[\s\S]*?language plpgsql volatile security definer set search_path = ''/.test(code));
    p('Migration: Melden räumt nicht mehr auf, Zeitplan kc-stand-aufraeumen 03:15 UTC',
      !/delete from/i.test(code.split('create or replace function public.kc_stand__aufraeumen')[0]) && /cron\.schedule\('kc-stand-aufraeumen', '15 3 \* \* \*'/.test(code));
    p('Migration: Rechte für kc_stand_melden wie Ursprung (anon, authenticated)',
      /grant execute on function public\.kc_stand_melden\(uuid, text, jsonb, jsonb, jsonb\),[\s\S]*?to anon, authenticated;/.test(alt)
      && /revoke all on function public\.kc_stand_melden\(uuid, text, jsonb, jsonb, jsonb\) from public;/.test(code)
      && /grant execute on function public\.kc_stand_melden\(uuid, text, jsonb, jsonb, jsonb\) to anon, authenticated;/.test(code));
    p('Migration: Aufräum-Funktion für niemanden außer dem Zeitplan', /revoke all on function public\.kc_stand__aufraeumen\(\) from public, anon, authenticated;/.test(code));
    p('Migration: Aufträge nur neu oder nach 60 s erneut', /abgeholt_am is null or abgeholt_am < now\(\) - interval '60 seconds'/.test(code));
    p('Migration: Rückweg beschrieben', /Rückweg/.test(neu));
  }
  console.log(`\nKC-KASSE-SPARSAM: ${ok} Prüfungen bestanden`);
  process.exit(0);
})().catch((e) => { console.error('FEHLER ', e && e.stack || e); process.exit(1); });
