/* Kasse: 📅 Dienstplan-Knopf bleibt in jeder Oberfläche mit Kopfzeile sichtbar – auch auf dem iPad (Betreiber 26.11.2026: „Auf Kasse 3 fehlt
   oben in der Kopfzeile der Knopf für den Dienstplan“). Ursache: der Kopf ist rechtsbündig und schneidet links ab; der 📅 hatte keinen festen Platz.
   Geprüft: alle Oberflächen in Kasse und Schulung, iPad quer/hoch und 1366 × 1024 – wo die Tür (🚪) zu sehen ist, ist auch der 📅 ganz zu sehen. */
const pw = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
const OHNE_ECHTSERVER = ['--no-proxy-server', '--host-resolver-rules=MAP *.supabase.co 0.0.0.0, MAP *.supabase.com 0.0.0.0, MAP *.workers.dev 0.0.0.0, MAP speed.cloudflare.com 0.0.0.0, MAP api.github.com 0.0.0.0'];
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const s = http.createServer((q, r) => { const p = path.join(W, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
let f = 0; const pr = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) f++; };
(async () => {
  const PORT = Number(process.env.P || 8994); await new Promise((r) => s.listen(PORT, r));
  const b = await pw.chromium.launch({ args: OHNE_ECHTSERVER });
  try {
    for (const seite of ['pos', 'schulung/pos']) for (const [w, h] of [[1180, 820], [1024, 768], [1366, 1024]]) {
      const c = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
      await c.route('**/*', (r) => (r.request().url().startsWith(`http://127.0.0.1:${PORT}/`) ? r.continue() : r.abort()));
      await c.routeWebSocket(/.*/, (ws) => ws.close());
      const p = await c.newPage(); const js = []; p.on('pageerror', (e) => js.push(e.message));
      await p.addInitScript(() => localStorage.setItem('kc_master_v040', JSON.stringify({ registerId: 'KASSE-03', pinLockEnabled: false })));
      await p.goto(`http://127.0.0.1:${PORT}/${seite}/index.html`); await p.waitForTimeout(2500);
      await p.getByText('KASSE STARTEN').click().catch(() => {}); await p.waitForTimeout(1000);
      const r = await p.evaluate(async () => {
        const P = window.KCOberflaechen, liste = P && (P.alle ? P.alle() : P.liste ? P.liste() : []) || [], fehlt = []; let mitKopf = 0;
        const sicht = (el) => { if (!el) return false; const r = el.getBoundingClientRect(), box = el.parentElement.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.left >= box.left - 1 && r.right <= box.right + 1 && r.left >= 0 && r.right <= innerWidth; };
        for (const o of liste) { window.KCAufbau.anwenden(o.id); await new Promise((ok) => setTimeout(ok, 250));
          if (!sicht(document.getElementById('headerExitBtn'))) continue; mitKopf++;
          if (!sicht(document.getElementById('dienstplanBtn'))) fehlt.push(o.id); }
        return { anzahl: liste.length, mitKopf, fehlt };
      });
      pr(`${seite} ${w}×${h}: 📅 in allen ${r.mitKopf} Oberflächen mit Kopfzeile sichtbar`, r.mitKopf > 5 && !r.fehlt.length, r.fehlt.join(', '));
      pr(`${seite} ${w}×${h}: keine JS-Fehler`, !js.filter((x) => !/Failed to fetch|Load failed|access control|net::ERR|4739/.test(x)).length, js.join('|').slice(0, 200));
      await c.close();
    }
  } catch (e) { console.log('ABBRUCH:', e && e.stack || e); f++; }
  await b.close(); s.close(); console.log(f ? `\n${f} FEHLER` : '\nAlles OK'); process.exit(f ? 1 : 0);
})();
