/* Netzsperre für Node-Prozesse in Tests (KC-TESTS-OHNE-ECHTSERVER): echte Supabase-/Cloudflare-/GitHub-Server sind
 * nicht erreichbar – fetch, WebSocket und Namensauflösung (http/https/net) werfen sofort einen Fehler.
 * Einbinden: NODE_OPTIONS="--require <pfad>/netzsperre-node.cjs" (der Ende-zu-Ende-Test macht das für seine Kindprozesse). */
'use strict';
const dns = require('dns');
const GESPERRT = /(^|\.)(supabase\.co|supabase\.com|workers\.dev|speed\.cloudflare\.com|api\.github\.com)$/i;
const gesperrt = (host) => GESPERRT.test(String(host || '').replace(/\.$/, ''));
const fehler = (host) => Object.assign(new Error(`netzsperre: ${host} ist im Test gesperrt`), { code: 'ENOTFOUND' });
const lookup = dns.lookup;
dns.lookup = function (host, opt, cb) {
  if (gesperrt(host)) { const f = typeof opt === 'function' ? opt : cb; process.nextTick(() => f(fehler(host))); return {}; }
  return lookup.apply(this, arguments);
};
if (dns.promises && dns.promises.lookup) {
  const pl = dns.promises.lookup;
  dns.promises.lookup = (host, ...r) => (gesperrt(host) ? Promise.reject(fehler(host)) : pl(host, ...r));
}
const hostVon = (u) => { try { return new URL(typeof u === 'string' ? u : (u && u.url) || String(u)).hostname; } catch (e) { return ''; } };
if (typeof globalThis.fetch === 'function') {
  const f = globalThis.fetch;
  globalThis.fetch = (u, ...r) => (gesperrt(hostVon(u)) ? Promise.reject(new TypeError('fetch failed', { cause: fehler(hostVon(u)) })) : f(u, ...r));
}
if (typeof globalThis.WebSocket === 'function') {
  const W = globalThis.WebSocket;
  globalThis.WebSocket = class extends W { constructor(u, ...r) { if (gesperrt(hostVon(u))) throw fehler(hostVon(u)); super(u, ...r); } };
}
