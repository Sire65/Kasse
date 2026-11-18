/* Rezepturen im PC-Manager über die Supabase-Anmeldung oben rechts laden (18.11.2026).
   Anlass: Betreiber „habe auf aktualisieren geklickt, aber es kommt nix bei Grünkohl“. Das Rezeptmodul las Supabase nur im
   alten Teammodus (kcm_sync) und brach sonst still ab; mit nur öffentlichem Schlüssel lieferte Supabase (RLS) still eine
   leere Liste.
   Geprüft (Supabase nachgebildet – der Browser erreicht den echten Server nicht, Netzsperre + Abschirmung):
   - angemeldet: „Aus Supabase laden“ zeigt beim Artikel gruenkohlmett alle 13 Zutaten aus Supabase, mit Anmelde-Token
   - nicht angemeldet: klare Meldung statt Stille, lokaler Stand bleibt
   - Supabase liefert 0 Rezepturen: Meldung, lokaler Stand wird NICHT geleert */
const pw = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
const OHNE_ECHTSERVER = ['--no-proxy-server', '--host-resolver-rules=MAP *.supabase.co 0.0.0.0, MAP *.supabase.com 0.0.0.0, MAP *.workers.dev 0.0.0.0, MAP speed.cloudflare.com 0.0.0.0, MAP api.github.com 0.0.0.0'];
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const s = http.createServer((q, r) => { const p = path.join(W, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
let f = 0; const pr = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) f++; };

const ZUTATEN = ['Grünkohl, tiefgekühlt', 'Kartoffelwürfel, gegart', 'Bauchspeck, gewürfelt', 'Zwiebeln, gewürfelt', 'Schmelzflocken', 'Zucker', 'Senf, 10-kg-Eimer',
  'Salz', 'Pfeffer', 'CHEF Gemüsefond (Nestlé Professional)', 'Kassler, gewürfelt', 'Trinkwasser', 'Mettendchen, geräuchert (roh)'];
const KOPF = [{ recipe_id: 'r-gm', org_id: 'KC_WERNE', product_code: 'gruenkohlmett', name: 'Grünkohl Eintopf mit Mettendchen', version: '1.0.0', status: 'draft',
  output_amount: 0, output_unit: 'kg', portion_amount: 250, portion_unit: 'g', reserve_percent: 0, active: true }];
const ZEILEN = ZUTATEN.map((name, n) => ({ ingredient_id: 'z' + n, recipe_id: 'r-gm', line_no: n + 1, name, amount: n ? 0 : 10, unit: 'kg', loss_percent: 0, public_ingredient: true }));

(async () => {
  const PORT = Number(process.env.P || 8994); await new Promise((r) => s.listen(PORT, r));
  const b = await pw.chromium.launch({ args: OHNE_ECHTSERVER });
  try {
    for (const fall of ['angemeldet', 'nicht angemeldet', 'leere Antwort']) {
      const c = await b.newContext({ serviceWorkers: 'block' }); const p = await c.newPage(); const js = []; p.on('pageerror', (e) => js.push(e.message));
      const anfragen = [];
      await c.route('**/*', (r) => {
        const url = r.request().url();
        if (url.startsWith(`http://127.0.0.1:${PORT}/`)) return r.continue();
        if (/supabase\.co\/rest\/v1\/kc_manager_recipe/.test(url)) {
          anfragen.push({ url, auth: r.request().headers().authorization });
          const leer = fall === 'leere Antwort';
          return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(/recipe_ingredients/.test(url) ? (leer ? [] : ZEILEN) : (leer ? [] : KOPF)) });
        }
        return r.abort();
      });
      await c.routeWebSocket(/.*/, (ws) => ws.close());
      await p.addInitScript(() => { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', '1'); localStorage.setItem('kcm_articles', '[]'); });
      await p.goto(`http://127.0.0.1:${PORT}/pc-manager/index.html`); await p.waitForTimeout(2500);
      const vorher = await p.evaluate(() => (JSON.parse(localStorage.getItem('kcm_recipes_v1') || '[]').find((x) => x.productId === 'gruenkohlmett') || {}).ingredients?.length || 0);
      await p.evaluate((angemeldet) => {
        window.KCSupabase = { istAngemeldet: () => angemeldet, holeZugriffsToken: () => (angemeldet ? 'TEST_ANMELDUNG' : null),
          konfig: { url: 'https://ptblnpiroqftcvlsrhac.supabase.co', publishableKey: 'TEST_PUBLIC' } };
        document.getElementById('aId').value = 'gruenkohlmett'; document.getElementById('aName').value = 'Grünkohl + Mettwurst';
        document.getElementById('recipeCloudReload').click();
      }, fall !== 'nicht angemeldet');
      await p.waitForTimeout(1200);
      const e = await p.evaluate(() => ({ status: document.getElementById('recipeStatus').textContent,
        zutaten: [...document.querySelectorAll('#recipeRows tr')].map((tr) => tr.querySelector('input')?.value).filter(Boolean),
        gespeichert: (JSON.parse(localStorage.getItem('kcm_recipes_v1') || '[]').find((x) => x.productId === 'gruenkohlmett') || {}).ingredients?.length || 0 }));
      if (fall === 'angemeldet') {
        pr('angemeldet: Supabase mit Anmelde-Token gefragt (nicht nur öffentlicher Schlüssel)', anfragen.length >= 2 && anfragen.every((a) => a.auth === 'Bearer TEST_ANMELDUNG'), anfragen.map((a) => a.auth).join(','));
        pr('angemeldet: Grünkohl + Mettwurst zeigt alle 13 Zutaten aus Supabase, mit Mettendchen', e.zutaten.length === 13 && e.zutaten.includes('Mettendchen, geräuchert (roh)') && e.zutaten.includes('Schmelzflocken'), `${e.zutaten.length}: ${e.zutaten.slice(-3).join(', ')}`);
        pr('angemeldet: Meldung „Supabase zuerst geladen“', /Supabase zuerst geladen/.test(e.status), e.status.slice(0, 90));
      } else if (fall === 'nicht angemeldet') {
        pr('nicht angemeldet: klare Meldung statt Stille', /bitte oben rechts bei Supabase anmelden/.test(e.status), e.status.slice(0, 90));
        pr('nicht angemeldet: keine Anfrage an Supabase, lokaler Stand bleibt', anfragen.length === 0 && e.gespeichert === vorher && vorher > 0, `vorher ${vorher}, danach ${e.gespeichert}`);
      } else {
        pr('leere Antwort: Meldung „keine Rezepturen geliefert“', /keine Rezepturen geliefert/.test(e.status), e.status.slice(0, 90));
        pr('leere Antwort: lokaler Stand wird NICHT geleert', e.gespeichert === vorher && vorher > 0, `vorher ${vorher}, danach ${e.gespeichert}`);
      }
      pr(`${fall}: keine JS-Fehler`, !js.filter((x) => !/Failed to fetch|Load failed|access control|net::ERR/.test(x)).length, js.join('|').slice(0, 200));
      await c.close();
    }
  } catch (e) { console.log('ABBRUCH:', e && e.stack || e); f++; }
  await b.close(); s.close(); console.log(f ? `\n${f} FEHLER` : '\nAlles OK'); process.exit(f ? 1 : 0);
})();
