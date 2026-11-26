/* Interne Mengenpreisliste im PC-Manager inkl. Pfand (Betreiber 26.11.2026: „Preisliste quer, die die Mengenpreise anzeigt …
   ist intern. Die muss inklusive Pfand angezeigt werden“, KC-KASSE-PFAND-GLAS). Geprüft in PC-Manager und Schulung (ohne echten Server):
   - eine Zeile je Artikel, Beträge mit Pfand: Eierlikörpunsch 6,50 / 13,00 …, Glühwein 5,50, Feuerzangenbowle 9,00 (Glas + Zange)
   - Schuss Rum ohne Pfand (1,00), Speisen ohne Pfand, keine Extrazeile „+ Pfand“ mehr; Kopf „Preise inkl. Pfand“ */
const pw = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
const OHNE_ECHTSERVER = ['--no-proxy-server', '--host-resolver-rules=MAP *.supabase.co 0.0.0.0, MAP *.supabase.com 0.0.0.0, MAP *.workers.dev 0.0.0.0, MAP speed.cloudflare.com 0.0.0.0, MAP api.github.com 0.0.0.0'];
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const s = http.createServer((q, r) => { const p = path.join(W, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
let f = 0; const pr = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) f++; };
(async () => {
  const PORT = Number(process.env.P || 8996); await new Promise((r) => s.listen(PORT, r));
  const b = await pw.chromium.launch({ args: OHNE_ECHTSERVER });
  try {
    for (const seite of ['pc-manager', 'schulung/pc-manager']) {
      const c = await b.newContext({ serviceWorkers: 'block' });
      await c.route('**/*', (r) => (r.request().url().startsWith(`http://127.0.0.1:${PORT}/`) ? r.continue() : r.abort()));
      await c.routeWebSocket(/.*/, (ws) => ws.close());
      const p = await c.newPage(); const js = []; p.on('pageerror', (e) => js.push(e.message));
      await p.goto(`http://127.0.0.1:${PORT}/${seite}/index.html`); await p.waitForTimeout(3000);
      await p.evaluate(() => { document.getElementById('plAktualisieren')?.click(); }); await p.waitForTimeout(300);
      if (process.env.DEBUG) console.log(await p.evaluate(() => (document.getElementById('plVorschau') || {}).innerText?.slice(0, 300)));
      const z = await p.evaluate(() => { const zeilen = {}; document.querySelectorAll('#plBlatt tbody tr:not(.pl-gruppenzeile)').forEach((tr) => {
        const td = [...tr.querySelectorAll('td')]; zeilen[td[0].firstChild.textContent.trim()] = td.slice(1).map((x) => x.textContent.trim()); });
        return { zeilen, kopf: document.querySelector('#plBlatt .pl-nurintern')?.textContent || '' }; });
      const n = seite, g = (name) => z.zeilen[name] || [];
      pr(`${n}: Eierlikörpunsch 1 = 6,50, 2 = 13,00, 10 = 65,00 (inkl. Pfand)`, g('Eierlikörpunsch')[0] === '6,50' && g('Eierlikörpunsch')[1] === '13,00' && g('Eierlikörpunsch')[9] === '65,00', g('Eierlikörpunsch').slice(0, 3).join(' '));
      pr(`${n}: Glühwein rot 5,50, Feuerzangenbowle 9,00`, g('Glühwein rot')[0] === '5,50' && g('Feuerzangenbowle')[0] === '9,00', `${g('Glühwein rot')[0]} / ${g('Feuerzangenbowle')[0]}`);
      pr(`${n}: Schuss Rum ohne Pfand 1,00, Grünkohl 5,50`, g('Schuss Rum')[0] === '1,00' && g('Grünkohl')[0] === '5,50', `${g('Schuss Rum')[0]} / ${g('Grünkohl')[0]}`);
      pr(`${n}: keine Extrazeile „+ Pfand“, Kopf „Preise inkl. Pfand“`, !Object.keys(z.zeilen).some((k) => /\+ Pfand/.test(k)) && /Preise inkl\. Pfand/.test(z.kopf), z.kopf);
      pr(`${n}: keine JS-Fehler`, !js.filter((x) => !/Failed to fetch|Load failed|access control|net::ERR|4739/.test(x)).length, js.join('|').slice(0, 200));
      await c.close();
    }
  } catch (e) { console.log('ABBRUCH:', e && e.stack || e); f++; }
  await b.close(); s.close(); console.log(f ? `\n${f} FEHLER` : '\nAlles OK'); process.exit(f ? 1 : 0);
})();
