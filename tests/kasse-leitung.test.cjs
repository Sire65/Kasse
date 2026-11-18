/* KC-STAND-LEITUNG (19.11.2026) – direkte Leitung für Stand-Brücke, Fernmodus und Stempel, ohne Netz geprüft
 * (WebSocket und Supabase nachgebildet):
 *  - Stand-Brücke: Leitung zum Stand-Kanal aus der Antwort von kc_stand_melden, Signal „auftrag“ weckt sofort,
 *    Ruhetakt 60 s mit Leitung / 30 s ohne / 5 s bei Neuem, Abbruch → Rückfall, Abmelden trennt
 *  - Fernmodus: mit Leitung Spiegel 60 s, „stand-spiegel“ leert, Auftrag wartet auf „auftrag-erledigt“ (eine Rückfrage)
 *  - PC-Manager-Leitung reicht stand/stand-spiegel/auftrag-erledigt/stempel weiter; Stempel-Abgleich auf Signal
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const W = path.join(__dirname, '..');
const lies = (p) => fs.readFileSync(path.join(W, p), 'utf8');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0;
const p = (name, b, z = '') => { assert.ok(b, name + (z ? ' [' + z + ']' : '')); ok++; console.log('  OK  ' + name + (z ? '   [' + z + ']' : '')); };

(async () => {
  // ---------- Stand-Brücke ----------
  {
    const sockets = [];
    class FakeWS {
      constructor(url) { this.url = url; this.readyState = 0; this.gesendet = []; sockets.push(this); setTimeout(() => { this.readyState = 1; this.onopen && this.onopen(); }, 5); }
      send(t) { this.gesendet.push(JSON.parse(t)); }
      close() { if (this.readyState === 3) return; this.readyState = 3; setTimeout(() => this.onclose && this.onclose(), 1); }
      antworte(d) { this.onmessage && this.onmessage({ data: JSON.stringify(d) }); }
    }
    const echtWS = globalThis.WebSocket;
    globalThis.WebSocket = FakeWS;
    const { StandBruecke } = require('../markt-kasse-suite/backend-source/stand-bruecke');
    const logs = [];
    const b = new StandBruecke({ manager: {}, datenOrdner: path.join(W, 'nicht-vorhanden'), log: (t) => logs.push(t), fehlerLog() {} });
    p('Stand-Brücke ohne Leitung: ruhig alle 30 s', b._naechsterTakt() === 30000);
    const z = { url: 'https://beispiel.invalid', publishableKey: 'sb_publishable_TEST' };
    b._leitungPruefen(z, null);
    p('Ohne Kanal (alte Datenbank ohne 20261119) keine Leitung', !b._leitung && sockets.length === 0);
    b._leitungPruefen(z, 'kc-rt-standkanal');
    await warte(40);
    const ws = sockets[0];
    p('Leitung zur Supabase-Adresse des Stands (wss, öffentlicher Schlüssel)', !!ws && ws.url === 'wss://beispiel.invalid/realtime/v1/websocket?apikey=sb_publishable_TEST&vsn=1.0.0', ws && ws.url);
    const join = ws.gesendet.find((m) => m.event === 'phx_join');
    p('Anmeldung am Stand-Kanal', !!join && join.topic === 'realtime:kc-rt-standkanal');
    ws.antworte({ event: 'phx_reply', topic: 'realtime:kc-rt-standkanal', payload: { status: 'ok' } });
    p('Leitung steht → ruhig nur alle 60 s, Meldung im schwarzen Fenster', b.leitungSteht() && b._naechsterTakt() === 60000 && logs.some((t) => /Direkte Leitung steht/.test(t)));
    b._weckFlag = false; // „nachholen“ nach dem Verbinden hat geweckt - für die nächste Prüfung zurücksetzen
    let geweckt = false; const t0 = Date.now();
    const w = b._warten(60000).then(() => { geweckt = Date.now() - t0 < 1000; });
    ws.antworte({ event: 'broadcast', topic: 'realtime:kc-rt-standkanal', payload: { event: 'neu', payload: { art: 'auftrag', id: 7 } } });
    await w;
    p('Signal „auftrag“ beendet die 60-s-Pause sofort und schaltet auf 5 s', geweckt && b._naechsterTakt() === 5000);
    b._zuletztAktiv = 0;
    b._leitungPruefen(z, 'kc-rt-standkanal');
    p('Gleicher Kanal: keine zweite Leitung', sockets.length === 1);
    ws.close(); await warte(20);
    p('Leitung bricht ab → zurück auf 30 s, Meldung im schwarzen Fenster', !b.leitungSteht() && b._naechsterTakt() === 30000 && logs.some((t) => /Direkte Leitung unterbrochen/.test(t)));
    await warte(1200);
    p('Neuverbinden nach kurzer Pause (wachsende Pause im Baustein)', sockets.length === 2);
    p('Status zeigt Leitung und Signale', b.status().leitung === false && b.status().leitungSignale === 1);
    b.stop();
    p('Stopp trennt die Leitung', !b._leitung);
    globalThis.WebSocket = echtWS;
  }

  // ---------- Fernmodus mit Leitung ----------
  {
    const src = lies('pc-manager/kc-fernmodus.js');
    const aufrufe = []; let erledigtNach = 0; const timers = [];
    const ctx = {
      console, JSON, Math, Date, Promise, Map, Set, URLSearchParams, Error, TypeError, Response, AbortSignal,
      localStorage: { getItem: () => JSON.stringify({ standId: 'S1', name: 'Test' }), setItem() {} },
      document: { body: null, hidden: false, addEventListener() {}, removeEventListener() {}, getElementById: () => null },
      setTimeout: (f, ms) => { timers.push(ms); return ms >= 60000 ? 0 : setTimeout(f, ms); }, clearTimeout,
    };
    ctx.window = ctx;
    ctx.fetch = async (url) => (String(url).includes('/kc-kassen-start/modus') ? new Response(JSON.stringify({ modus: 'zuhause' })) : new Response('{}'));
    ctx.WebSocket = function () {};
    ctx.KCDirekteLeitungManager = { steht: () => true };
    ctx.KCSupabase = {
      istAngemeldet: () => true,
      rufeFunktionAuf: async (name) => {
        aufrufe.push(name);
        if (name === 'kc_stand_spiegel') return { vorhanden: true, inhalt: { kassen: [] }, sekundenAlt: 1, sekundenSeitMeldung: 1 };
        if (name === 'kc_stand_liste') return [{ standId: 'S1', name: 'Test', sekundenSeitMeldung: 1 }];
        if (name === 'kc_stand_auftrag_anlegen') return { auftragId: 9 };
        if (name === 'kc_stand_auftrag') return { status: Date.now() >= erledigtNach ? 'erledigt' : 'abgeholt', statusCode: 200, antwort: {} };
        throw new Error('unerwartet ' + name);
      },
    };
    vm.createContext(ctx); vm.runInContext(src, ctx);
    await ctx.KCFernmodus.bestimmeModus();
    aufrufe.length = 0;
    await ctx.fetch('http://127.0.0.1:47392/kassen-verbindungen');
    ctx.Date = Date;
    await ctx.fetch('http://127.0.0.1:47392/kassen-verbindungen');
    p('Mit Leitung: Spiegel wird zwischengespeichert', aufrufe.filter((n) => n === 'kc_stand_spiegel').length === 1);
    ctx.KCFernmodus.signal('stand-spiegel');
    await ctx.fetch('http://127.0.0.1:47392/kassen-verbindungen');
    p('Signal „stand-spiegel“ → nächste Lesung holt frisch', aufrufe.filter((n) => n === 'kc_stand_spiegel').length === 2);
    p('Mit Leitung: Sicherheitsabfrage Spiegel 60 s / verborgen 5 min, Standliste 5 min, Live-Monitor 60 s / 5 min',
      /LEITUNG_SPIEGEL_MS = 60000, LEITUNG_SPIEGEL_VERBORGEN_MS = 300000/.test(src) && /LEITUNG_SOCKET_MS = 60000, LEITUNG_SOCKET_VERBORGEN_MS = 300000/.test(src) && /LEITUNG_STAND_LISTE_MS = 300000/.test(src));
    p('Signal „stand“: Live-Monitor höchstens alle 5 s, bei verborgener Seite erst beim Sichtbarwerden',
      /SIGNAL_ABSTAND_MS = 5000/.test(src) && /art === 'nachholen'\) && !verborgen\(\) && !socketWecker/.test(src) && /if \(verborgen\(\)\) spiegelVeraltet = true; else spiegelLeeren\(\);/.test(src));
    aufrufe.length = 0; erledigtNach = Date.now() + 300;
    setTimeout(() => ctx.KCFernmodus.signal('auftrag-erledigt'), 400);
    const t0 = Date.now();
    const r = await ctx.fetch('http://127.0.0.1:47392/sold-out-status/setzen', { method: 'POST', body: '{"articleId":"x"}' });
    const dauer = Date.now() - t0;
    p('Auftrag mit Leitung: wartet auf „auftrag-erledigt“, dann EINE Rückfrage', r.status === 200 && aufrufe.filter((n) => n === 'kc_stand_auftrag').length === 1 && dauer < 1500, `${dauer} ms, ${aufrufe.join()}`);
    ctx.KCDirekteLeitungManager = { steht: () => false };
    aufrufe.length = 0; timers.length = 0; erledigtNach = 0;
    await ctx.fetch('http://127.0.0.1:47392/sold-out-status/setzen', { method: 'POST', body: '{}' });
    p('Ohne Leitung: Rückfrage wie Stufe A (erst nach 1 s)', timers.filter((ms) => ms > 0 && ms < 60000)[0] === 1000 && aufrufe.filter((n) => n === 'kc_stand_auftrag').length === 1);
  }

  // ---------- PC-Manager-Leitung und Stempel ----------
  {
    const m = lies('pc-manager/kc-direkte-leitung-manager.js');
    p('PC-Manager-Leitung reicht stand / stand-spiegel / auftrag-erledigt an den Fernmodus weiter',
      /art === 'stand' \|\| art === 'stand-spiegel' \|\| art === 'auftrag-erledigt'\) global\.KCFernmodus\?\.signal\?\.\(art\)/.test(m));
    p('… stempel an den Stempel-Abgleich, nach dem Verbinden „nachholen“', /art === 'stempel'\) einmal\('stempel', \(\) => global\.KCTimeClockCloudStatus\?\.signal\?\.\(\)/.test(m) && /KCFernmodus\?\.signal\?\.\('nachholen'\)/.test(m));
    p('Schulungs-Manager hat dieselbe Fassung', m === lies('schulung/pc-manager/kc-direkte-leitung-manager.js'));
    const ts = lies('pc-manager/time-clock-supabase-sync.js');
    p('Stempel-Abgleich: mit Leitung kein 30-s-Abgleich bei offener Seite, Signal holt sofort (höchstens alle 5 s)',
      /\(sichtbar\(\)&&!leitungSteht\(\)\)\|\|Date\.now\(\)-zuletztVoll>=300000/.test(ts) && /function signal\(\)\{if\(Date\.now\(\)-zuletztVoll<5000\)return;/.test(ts) && /KCTimeClockCloudStatus=\{refresh,signal\}/.test(ts));
  }

  // ---------- Migration ----------
  {
    const sql = lies('supabase/migrations/20261119_kc_stand_leitung.sql');
    const code = sql.split('\n').filter((z) => !z.trim().startsWith('--')).join('\n');
    p('Migration: nur Broadcast (realtime.send), keine Postgres-Changes, keine neue Tabelle', /realtime\.send\(/.test(code) && !/supabase_realtime|alter publication|create table/i.test(code));
    p('Migration: Signale nur mit Art (Auftrag zusätzlich ID)', [...code.matchAll(/realtime\.send\((jsonb_build_object\([^)]*\))/g)].every((x) => /^jsonb_build_object\('art', (p_art|'auftrag', 'id', new\.id)\)$/.test(x[1])));
    p('Migration: neue Hilfsfunktionen für public/anon/authenticated gesperrt, service_role erlaubt',
      /revoke all on function public\.kc_stand__kanal\(uuid\), public\.kc_stand__zaehlen\(integer, bigint\), public\.kc_stand__signal_manager\(text, text\),\s+public\.kc_stand__auftrag_signal\(\), public\.kc_stand__stempel_signal\(\) from public, anon, authenticated;/.test(code)
      && /to service_role;/.test(code));
    p('Migration: Stand-Funktionen mit Rechten wie bisher + Prüfregister', /grant execute on function public\.kc_stand_melden\(uuid, text, jsonb, jsonb, jsonb\),\s+public\.kc_stand_auftrag_erledigt\(uuid, text, bigint, integer, jsonb\) to anon, authenticated;/.test(code)
      && /kc_security_reviewed_exceptions/.test(code) && /security_definer_anon_execute/.test(code));
    p('Migration: Sparbremse 70 % für stand/stand-spiegel, 95 % sonst', /p_art in \('stand', 'stand-spiegel'\)[\s\S]*1400000/.test(code) && /1900000/.test(code));
    p('Migration: Kanal per HMAC aus dem Vault-Geheimnis, Rückweg beschrieben', /extensions\.hmac\('stand:'/.test(code) && /kc_club_rt_geheimnis/.test(code) && /Rückweg/.test(sql));
  }
  console.log(`\nKC-STAND-LEITUNG: ${ok} Prüfungen bestanden`);
  process.exit(0);
})().catch((e) => { console.error('FEHLER ', e && e.stack || e); process.exit(1); });
