/* Kundenbon: Artikelpreis und Pfand getrennt, mit Zwischensummen Waren / Pfand / SUMME (Betreiber 26.11.2026, KC-KASSE-BON-PFAND)
   und Auszahlungen immer rot (KC-KASSE-AUSZAHLUNG-ROT). Geprüft in Kasse und Schulungskasse (ohne echten Server, Netzsperre):
   - Verkauf Glühwein rot, 2 × Feuerzangenbowle, Grünkohl, Glasrückgabe → Bon: Glühwein 3,50 + Glaspfand 2,00, Feuerzangenbowle 10,00
     + Glaspfand 2 × 2,00 + Feuerzangenpfand 2 × 2,00, Grünkohl 5,50, Glasrückgabe −2,00; Waren 19,00, Pfand 8,00, SUMME 27,00 = gebucht
   - digitaler Bon (QR) mit derselben Aufteilung
   - alter Bon ohne Pfand-Angaben druckt wie bisher (keine Zwischensummen)
   - Pfandrückgabe allein → Meldung „Auszahlung“ im roten Fenster */
const pw = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
const OHNE_ECHTSERVER = ['--no-proxy-server', '--host-resolver-rules=MAP *.supabase.co 0.0.0.0, MAP *.supabase.com 0.0.0.0, MAP *.workers.dev 0.0.0.0, MAP speed.cloudflare.com 0.0.0.0, MAP api.github.com 0.0.0.0'];
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const s = http.createServer((q, r) => { const p = path.join(W, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
let f = 0; const pr = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) f++; };
(async () => {
  const PORT = Number(process.env.P || 8995); await new Promise((r) => s.listen(PORT, r));
  const b = await pw.chromium.launch({ args: OHNE_ECHTSERVER });
  try {
    for (const seite of ['pos', 'schulung/pos']) {
      const c = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
      await c.route('**/*', (r) => (r.request().url().startsWith(`http://127.0.0.1:${PORT}/`) ? r.continue() : r.abort()));
      await c.routeWebSocket(/.*/, (ws) => ws.close());
      const p = await c.newPage(); const js = []; p.on('pageerror', (e) => js.push(e.message));
      await p.addInitScript(() => localStorage.setItem('kc_master_v040', JSON.stringify({ registerId: 'KASSE-01', pinLockEnabled: false })));
      await p.goto(`http://127.0.0.1:${PORT}/${seite}/index.html`); await p.waitForTimeout(2500);
      await p.getByText('KASSE STARTEN').click().catch(() => {}); await p.waitForTimeout(800);
      const n = seite;
      // Verkauf mit Pfand und Rückgabe, bar und passend bezahlt
      const r = await p.evaluate(async () => {
        document.querySelectorAll('dialog[open]').forEach((d) => d.close());
        state.cart = []; const add = (id, k = 1) => { for (let i = 0; i < k; i++) addConfiguredProduct(PRODUCTS.find((x) => x.id === id), null); };
        add('grot'); add('feuer', 2); add('gruenkohl'); add('glasminus');
        const soll = +grossTotal().toFixed(2); state.given = soll;
        await completeSale('cash', { silent: true });
        const rec = readTransactions().at(-1); const html = bonSeite(rec, false), text = digitalBonText(rec);
        const d = document.createElement('div'); d.innerHTML = html.slice(html.indexOf('<main'), html.indexOf('</main>') + 7);
        const zeilen = [...d.querySelectorAll('tr')].map((tr) => [...tr.children].map((x) => x.textContent).join(' ').replace(/\s+/g, ' ').trim());
        const summen = [...d.querySelectorAll('.line')].map((x) => [...x.children].map((y) => y.textContent).join(' ').replace(/\s+/g, ' ').trim());
        // alter Bon ohne Pfand-Angaben (wie vor dieser Änderung gespeichert)
        const altItems = rec.items.filter((i) => !/pfand|rückgabe/i.test(i.category + ' ' + i.name)).map((i) => ({ ...i, deposits: undefined })), alt = { ...rec, items: altItems, due: altItems.reduce((a, i) => a + i.lineTotal, 0) }, altHtml = bonSeite(alt, false);
        return { soll, due: rec.due, zeilen, summen, text, altWaren: /<span>Waren<\/span>/.test(altHtml) };
      });
      const hat = (t) => r.zeilen.some((z) => z.replace(/ /g, ' ').includes(t));
      pr(`${n}: Glühwein 3,50, darunter + Glaspfand 2,00`, hat('1× Glühwein rot 3,50 €') && hat('+ Glaspfand 2,00 €'), r.zeilen.slice(0, 3).join(' | '));
      pr(`${n}: Feuerzangenbowle 10,00 + Glaspfand 2 × 2,00 + Feuerzangenpfand 2 × 2,00`, hat('2× Feuerzangenbowle 10,00 €') && r.zeilen.some((z) => /\+ Glaspfand 2 × 2,00 € 4,00 €/.test(z.replace(/ /g, ' '))) && r.zeilen.some((z) => /\+ Feuerzangenpfand 2 × 2,00 € 4,00 €/.test(z.replace(/ /g, ' '))), r.zeilen.join(' | ').slice(0, 300));
      pr(`${n}: Grünkohl 5,50 ohne Pfand, Glasrückgabe −2,00`, hat('1× Grünkohl 5,50 €') && r.zeilen.some((z) => /Glasrückgabe\s+[−-]\s?2,00/.test(z.replace(/ /g, ' '))), r.zeilen.join(' | ').slice(0, 300));
      const sm = r.summen.join(' | ').replace(/ /g, ' ');
      pr(`${n}: Zwischensummen Waren 19,00 · Pfand 8,00 · SUMME 27,00 = gebucht`, /Waren 19,00 €/.test(sm) && /Pfand 8,00 €/.test(sm) && /SUMME 27,00 €/.test(sm) && r.soll === 27 && r.due === 27, `${sm} · gebucht ${r.due}`);
      pr(`${n}: digitaler Bon mit derselben Aufteilung`, /1x Glühwein rot 3,50/.test(r.text.replace(/ /g, ' ')) && /\+ Glaspfand 2,00/.test(r.text.replace(/ /g, ' ')) && /Waren 19,00/.test(r.text.replace(/ /g, ' ')) && /Pfand 8,00/.test(r.text.replace(/ /g, ' ')) && /SUMME 27,00/.test(r.text.replace(/ /g, ' ')), r.text.replace(/\n/g, ' | ').slice(0, 260));
      pr(`${n}: alter Bon ohne Pfand-Angaben druckt wie bisher`, r.altWaren === false);
      // Auszahlung: nur Glasrückgabe → rotes Fenster „Auszahlung“
      const a = await p.evaluate(async () => {
        document.querySelectorAll('dialog[open]').forEach((d) => d.close());
        state.cart = []; addConfiguredProduct(PRODUCTS.find((x) => x.id === 'glasminus'), null); state.given = 0;
        await completeSale('cash', {}); await new Promise((ok) => setTimeout(ok, 300));
        const d = document.getElementById('messageDialog'); const farbe = getComputedStyle(document.getElementById('messageValue')).color;
        return { offen: d.open, rot: d.classList.contains('kc-auszahlung'), titel: document.getElementById('messageTitle').textContent, wert: document.getElementById('messageValue').textContent, farbe };
      });
      pr(`${n}: Pfandrückgabe → Meldung „Auszahlung“ im roten Fenster`, a.offen && a.rot && /Auszahlung/.test(a.titel) && /2,00/.test(a.wert) && a.farbe === 'rgb(196, 23, 23)', JSON.stringify(a));
      pr(`${n}: keine JS-Fehler`, !js.filter((x) => !/Failed to fetch|Load failed|access control|net::ERR|4739/.test(x)).length, js.join('|').slice(0, 200));
      await c.close();
    }
  } catch (e) { console.log('ABBRUCH:', e && e.stack || e); f++; }
  await b.close(); s.close(); console.log(f ? `\n${f} FEHLER` : '\nAlles OK'); process.exit(f ? 1 : 0);
})();
