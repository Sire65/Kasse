/* Nachbau der Supabase-REST-Schnittstelle für Tests: POST /rest/v1/rpc/<funktion>
 * - Authorization mit dem Publishable Key       -> Rolle anon
 * - Authorization "Bearer test-admin:<uuid>"     -> Rolle authenticated, auth.uid() = <uuid>
 * Führt die ECHTE SQL-Funktion in PostgreSQL aus (Grundlage + Migration vorher einspielen).
 * Braucht das npm-Paket "pg" und eine Datenbank (Umgebungsvariable KC_TEST_PG,
 * z. B. "postgresql://postgres@/kc_test?host=/tmp&port=54329").
 * Direkte Leitung (KC-STAND-LEITUNG, 19.11.2026): ws://…/realtime/v1/websocket wie Supabase Realtime (Phoenix vsn 1.0.0,
 * phx_join / heartbeat / broadcast). realtime.send aus grundlage-leitung.sql meldet per pg_notify, der Nachbau verteilt das
 * Signal an alle Teilnehmer des Kanals. Braucht dafür das npm-Paket "ws" (liegt in markt-kasse-suite/backend-source).
 */
'use strict';
const http = require('http');
const path = require('path');
const { Pool, Client } = require('pg');
let WebSocketServer = null;
try { ({ WebSocketServer } = require(require.resolve('ws', { paths: [path.join(__dirname, '..', '..', 'markt-kasse-suite', 'backend-source'), __dirname] }))); }
catch (e) { /* ohne "ws": keine Leitung im Nachbau - die Programme fragen dann wie ohne Leitung im Takt */ }
if (process.env.KC_NACHBAU_OHNE_LEITUNG === '1') WebSocketServer = null; // Rückfall prüfen: Leitung gibt es nicht

function starteNachbau({ port = 0, verbindung = process.env.KC_TEST_PG, publishableKey = 'sb_publishable_TEST' } = {}) {
  const pool = new Pool({ connectionString: verbindung, max: 5 });
  let erreichbar = true; // false simuliert "Supabase nicht erreichbar"
  let standOffline = false; // true: nur der Stand (Rolle anon) erreicht Supabase nicht - "kein Internet am Stand"
  const zaehler = { aufrufe: 0 };
  const server = http.createServer((req, res) => {
    const antworte = (status, daten) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(daten)); };
    if (!erreichbar) { req.socket.destroy(); return; }
    const m = req.url.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/);
    if (req.method !== 'POST' || !m) { antworte(404, { message: 'nicht gefunden' }); return; }
    const authKopf = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (standOffline && !/^test-admin:/.test(authKopf)) { req.socket.destroy(); return; }
    let koerper = '';
    req.on('data', (c) => { koerper += c; });
    req.on('end', async () => {
      zaehler.aufrufe++;
      const auth = authKopf;
      if (req.headers.apikey !== publishableKey) { antworte(401, { message: 'Invalid API key' }); return; }
      let rolle = 'anon', claims = { role: 'anon' };
      const admin = auth.match(/^test-admin:([0-9a-f-]{36})$/);
      if (admin) { rolle = 'authenticated'; claims = { role: 'authenticated', sub: admin[1] }; }
      else if (auth !== publishableKey) { antworte(401, { message: 'invalid JWT' }); return; }
      let args = {};
      try { args = JSON.parse(koerper || '{}'); } catch (e) { antworte(400, { message: 'json' }); return; }
      const namen = Object.keys(args);
      const sql = `select public.${m[1]}(${namen.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`;
      const werte = namen.map((n) => (args[n] !== null && typeof args[n] === 'object') ? JSON.stringify(args[n]) : args[n]);
      const c = await pool.connect();
      try {
        await c.query('begin');
        await c.query(`set local role ${rolle}`);
        await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
        const r = await c.query(sql, werte);
        await c.query('commit');
        antworte(200, r.rows[0].r);
      } catch (e) {
        try { await c.query('rollback'); } catch (x) { /* */ }
        const status = e.code === '42501' ? 403 : e.code === '28000' ? 401 : e.code === '42883' ? 404 : 400;
        antworte(status, { code: e.code, message: e.message });
      } finally { c.release(); }
    });
  });
  // ---- direkte Leitung (Realtime-Broadcast) ----
  const signale = []; // { topic, art, zeit } - für Prüfungen
  let wss = null, hoerer = null;
  const sockets = new Set();
  if (WebSocketServer) {
    wss = new WebSocketServer({ noServer: true });
    server.on('upgrade', (req, socket, kopf) => {
      const u = new URL(req.url, 'http://x');
      if (u.pathname !== '/realtime/v1/websocket' || u.searchParams.get('apikey') !== publishableKey || !erreichbar) { socket.destroy(); return; }
      // Browser-Verbindungen markiert der Test mit browser=1; alle anderen gelten als Stand (für „kein Internet am Stand“)
      const istStand = u.searchParams.get('browser') !== '1';
      if (istStand && standOffline) { socket.destroy(); return; }
      wss.handleUpgrade(req, socket, kopf, (ws) => {
        ws.kc = { topics: new Set(), istStand }; sockets.add(ws);
        ws.on('close', () => sockets.delete(ws));
        ws.on('message', (roh) => {
          let m; try { m = JSON.parse(String(roh)); } catch (e) { return; }
          if (m.event === 'phx_join') { ws.kc.topics.add(m.topic); ws.send(JSON.stringify({ event: 'phx_reply', topic: m.topic, ref: m.ref, payload: { status: 'ok', response: {} } })); }
          else if (m.event === 'heartbeat') ws.send(JSON.stringify({ event: 'phx_reply', topic: 'phoenix', ref: m.ref, payload: { status: 'ok', response: {} } }));
          else if (m.event === 'phx_leave') ws.kc.topics.delete(m.topic);
        });
      });
    });
    hoerer = new Client({ connectionString: verbindung });
    hoerer.on('notification', (n) => {
      let d; try { d = JSON.parse(n.payload); } catch (e) { return; }
      signale.push({ topic: d.topic, art: d.payload && d.payload.art, id: d.payload && d.payload.id, zeit: Date.now() });
      const topic = 'realtime:' + d.topic;
      for (const ws of sockets) {
        if (ws.kc.topics.has(topic) && ws.readyState === 1) ws.send(JSON.stringify({ event: 'broadcast', topic, ref: null, payload: { event: d.event, payload: d.payload, type: 'broadcast' } }));
      }
    });
  }
  const trenne = (nurStand) => { for (const ws of sockets) if (!nurStand || ws.kc.istStand) ws.terminate(); };
  const bereit = hoerer ? hoerer.connect().then(() => hoerer.query('LISTEN kc_nachbau_realtime')) : Promise.resolve();
  return bereit.then(() => new Promise((r) => server.listen(port, '127.0.0.1', () => r({
    url: `http://127.0.0.1:${server.address().port}`, publishableKey, pool, zaehler, signale, leitung: !!wss,
    setzeErreichbar(b) { erreichbar = !!b; if (!erreichbar) trenne(false); },
    setzeStandOffline(b) { standOffline = !!b; if (standOffline) trenne(true); },
    leitungsTeilnehmer: () => [...sockets].map((ws) => ({ istStand: ws.kc.istStand, topics: [...ws.kc.topics] })),
    async sql(text, werte) { return (await pool.query(text, werte)).rows; },
    async schliessen() { trenne(false); if (wss) wss.close(); await new Promise((x) => server.close(x)); if (hoerer) await hoerer.end(); await pool.end(); },
  }))));
}
module.exports = { starteNachbau };
