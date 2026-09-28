/* Einfacher Nachbau des Mini-PC-TSE-Dienstes - NUR fuer Tests der Kassenseite.
   Haelt sich an die abgestimmte Schnittstelle (/health, /signieren, /warteschlange,
   /warteschlange/verarbeiten). Modus umschaltbar:
     ok        TSE da, /signieren liefert 200 + Signatur
     tse_weg   Dienst antwortet schnell 503 {grund:"tse_nicht_erreichbar", inWarteschlangeGestellt:true}
     haengt    Dienst nimmt Anfragen an, antwortet aber nie (simuliert haengenden Mini-PC)
   Ausserdem: CORS inkl. Preflight (OPTIONS) - das braucht der echte Dienst genauso, sonst
   blockt der Browser der Kasse jede Anfrage mit Authorization-Header. */
'use strict';
const http = require('http');
const crypto = require('crypto');

function starteMock(port, { token = 'geheim-123' } = {}) {
  const zustand = { modus: 'ok', anfragen: [], signiert: new Map(), warteschlange: [], zaehler: 1000, tnr: 5000 };
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
    'Access-Control-Allow-Private-Network': 'true'
  };
  const antworte = (res, code, obj) => { res.writeHead(code, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  const signiere = (d) => {
    if (zustand.signiert.has(d.transaktionId)) return zustand.signiert.get(d.transaktionId); // idempotent
    const s = { ok: true, signatur: crypto.createHash('sha256').update(JSON.stringify(d)).digest('base64'), signaturzaehler: ++zustand.zaehler, transaktionsnummer: ++zustand.tnr, tseSeriennummer: 'MOCK-SWISSBIT-0001' };
    zustand.signiert.set(d.transaktionId, s);
    return s;
  };
  const server = http.createServer((req, res) => {
    let roh = '';
    req.on('data', (c) => { roh += c; });
    req.on('end', () => {
      const pfad = req.url.split('?')[0];
      let body = null; try { body = roh ? JSON.parse(roh) : null; } catch (e) { body = { kaputt: roh }; }
      zustand.anfragen.push({ methode: req.method, pfad, auth: req.headers.authorization || null, body, zeit: Date.now() });
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
      if (zustand.modus === 'haengt') return; // nie antworten
      if (pfad === '/health' && req.method === 'GET') return antworte(res, 200, { ok: true, tseVerfuegbar: zustand.modus === 'ok', warteschlangeLaenge: zustand.warteschlange.length });
      if (req.headers.authorization !== 'Bearer ' + token) return antworte(res, 401, { ok: false, grund: 'nicht_autorisiert' });
      if (pfad === '/signieren' && req.method === 'POST') {
        if (zustand.modus === 'tse_weg') {
          if (!zustand.warteschlange.includes(body.transaktionId) && !zustand.signiert.has(body.transaktionId)) { zustand.warteschlange.push(body.transaktionId); zustand.wsDaten = { ...(zustand.wsDaten || {}), [body.transaktionId]: body }; }
          return antworte(res, 503, { ok: false, grund: 'tse_nicht_erreichbar', inWarteschlangeGestellt: true });
        }
        zustand.warteschlange = zustand.warteschlange.filter((id) => id !== body.transaktionId);
        return antworte(res, 200, signiere(body));
      }
      if (pfad === '/warteschlange' && req.method === 'GET') return antworte(res, 200, { ok: true, offen: zustand.warteschlange.slice() });
      if (pfad === '/warteschlange/verarbeiten' && req.method === 'POST') {
        let verarbeitet = 0;
        if (zustand.modus === 'ok') { for (const id of zustand.warteschlange) { signiere(zustand.wsDaten[id]); verarbeitet++; } zustand.warteschlange = []; }
        return antworte(res, 200, { ok: true, verarbeitet, weiterhinOffen: zustand.warteschlange.length });
      }
      antworte(res, 404, { ok: false, grund: 'unbekannt' });
    });
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r({ server, zustand, token, schliessen: () => new Promise((z) => { server.closeAllConnections?.(); server.close(() => z()); }) })));
}

module.exports = { starteMock };
if (require.main === module) {
  const port = Number(process.argv[2] || 8765);
  starteMock(port).then(({ token }) => console.log(`TSE-Mock laeuft auf http://127.0.0.1:${port} (Token: ${token})`));
}
