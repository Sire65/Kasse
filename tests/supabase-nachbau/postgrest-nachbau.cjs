/* Nachbau der Supabase-REST-Schnittstelle für Tests: POST /rest/v1/rpc/<funktion>
 * - Authorization mit dem Publishable Key       -> Rolle anon
 * - Authorization "Bearer test-admin:<uuid>"     -> Rolle authenticated, auth.uid() = <uuid>
 * Führt die ECHTE SQL-Funktion in PostgreSQL aus (Grundlage + Migration vorher einspielen).
 * Braucht das npm-Paket "pg" und eine Datenbank (Umgebungsvariable KC_TEST_PG,
 * z. B. "postgresql://postgres@/kc_test?host=/tmp&port=54329").
 */
'use strict';
const http = require('http');
const { Pool } = require('pg');

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
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r({
    url: `http://127.0.0.1:${server.address().port}`, publishableKey, pool, zaehler,
    setzeErreichbar(b) { erreichbar = !!b; },
    setzeStandOffline(b) { standOffline = !!b; },
    async sql(text, werte) { return (await pool.query(text, werte)).rows; },
    async schliessen() { await new Promise((x) => server.close(x)); await pool.end(); },
  })));
}
module.exports = { starteNachbau };
