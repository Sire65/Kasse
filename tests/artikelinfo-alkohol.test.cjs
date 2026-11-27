/* KC-ARTIKELINFO-ALKOHOL (27.11.2026, Betreiber: „bei Eierlikörpunsch enthält Alkohol eintragen“):
 * Eierlikörpunsch und Feuerzangenbowle tragen im PC-Manager „Alkoholhaltig.“ - damit Etiketten, Kundenliste und Aushang der
 * Club-App „Enthält Alkohol“ zeigen (KCEtikettenStand.artikelListe -> alkohol). Geprüft im echten PC-Manager und im
 * Schulungs-PC-Manager (ohne Server, Netzsperre):
 *   1. frisches Gerät -> beide alkoholhaltig
 *   2. alter Stand: Feuerzangenbowle ohne Hinweis (wie bisher veröffentlicht) -> wird ergänzt, Allergene/Zusatzstoffe bleiben
 *   3. eigener Hinweistext ohne „Alkohol“ bleibt erhalten, „Alkoholhaltig.“ davor; vorhandener Alkohol-Hinweis bleibt unverändert
 *   4. andere Artikel (Roter Feger alkoholfrei) unverändert; Nachtrag nur einmal */
const pw = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
const OHNE_ECHTSERVER = ['--no-proxy-server', '--host-resolver-rules=MAP *.supabase.co 0.0.0.0, MAP *.supabase.com 0.0.0.0, MAP *.workers.dev 0.0.0.0, MAP speed.cloudflare.com 0.0.0.0, MAP api.github.com 0.0.0.0'];
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const s = http.createServer((q, r) => { const p = path.join(W, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
let f = 0; const pr = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) f++; };
(async () => {
  const PORT = Number(process.env.P || 8997); await new Promise((r) => s.listen(PORT, r));
  const b = await pw.chromium.launch({ args: OHNE_ECHTSERVER });
  try {
    for (const seite of ['pc-manager', 'schulung/pc-manager']) {
      const neu = async (vorbereiten, daten) => {
        const c = await b.newContext({ serviceWorkers: 'block' });
        await c.route('**/*', (r) => (r.request().url().startsWith(`http://127.0.0.1:${PORT}/`) ? r.continue() : r.abort()));
        await c.routeWebSocket(/.*/, (ws) => ws.close());
        const p = await c.newPage(); const js = []; p.on('pageerror', (e) => js.push(e.message)); p.on('dialog', (d) => d.accept());
        if (vorbereiten) await p.addInitScript(vorbereiten, daten);
        await p.goto(`http://127.0.0.1:${PORT}/${seite}/index.html`);
        await p.waitForFunction(() => Array.isArray(window.articles || (typeof articles !== 'undefined' && articles)), null, { timeout: 30000 });
        await p.waitForTimeout(800);
        return { c, p, js };
      };
      const lese = (p) => p.evaluate(() => { const liste = window.KCEtikettenStand?.artikelListe ? window.KCEtikettenStand.artikelListe(articles) : [];
        const st = (id) => { const a = articles.find((x) => x.id === id) || {}; const e = liste.find((x) => x.id === id) || {}; return { important: (a.info || {}).important || '', alkohol: e.alkohol, allergene: e.allergene || '', zusatz: e.zusatz || '' }; };
        return { eier: st('eier'), feuer: st('feuer'), feger: st('roterfeger'), merk: localStorage.getItem('kcm_artikelinfo_alkohol_v1') }; });

      // 1. frisches Gerät
      let g = await neu(null); let r = await lese(g.p);
      pr(`${seite}: frisch – Eierlikörpunsch „Enthält Alkohol“`, r.eier.alkohol === true, r.eier.important);
      pr(`${seite}: frisch – Feuerzangenbowle „Enthält Alkohol“`, r.feuer.alkohol === true, r.feuer.important);
      pr(`${seite}: frisch – Roter Feger bleibt alkoholfrei`, r.feger.alkohol === false, r.feger.important);
      const frischFeuer = r.feuer; const vorher = await g.p.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]))));
      pr(`${seite}: keine Skriptfehler`, !g.js.length, g.js.join('|').slice(0, 200));
      await g.c.close();

      // 2./3. alter Stand: Feuerzangenbowle ohne Hinweis, Eierlikörpunsch mit eigenem Text ohne „Alkohol“
      g = await neu((alt) => { if (sessionStorage.getItem('vorbereitet')) return; sessionStorage.setItem('vorbereitet', '1');
        // kompletter Gerätespeicher eines echten Laufs (alle früheren Nachträge erledigt), nur der neue Nachtrag noch offen
        const speicher = JSON.parse(alt); for (const [k, v] of Object.entries(speicher)) localStorage.setItem(k, v);
        const L = JSON.parse(speicher.kcm_articles);
        for (const a of L) { if (a.id === 'feuer') a.info = { ...(a.info || {}), important: '' }; if (a.id === 'eier') a.info = { ...(a.info || {}), important: 'Mit Sahnehaube.' }; }
        localStorage.setItem('kcm_articles', JSON.stringify(L));
        localStorage.removeItem('kcm_artikelinfo_alkohol_v1'); }, vorher);
      r = await lese(g.p);
      pr(`${seite}: alter Stand – Feuerzangenbowle bekommt „Alkoholhaltig.“`, r.feuer.alkohol === true && r.feuer.important === 'Alkoholhaltig.', r.feuer.important);
      pr(`${seite}: alter Stand – Allergene/Zusatzstoffe der Feuerzangenbowle bleiben`, r.feuer.allergene === frischFeuer.allergene && r.feuer.zusatz === frischFeuer.zusatz && /Sulfite/.test(r.feuer.zusatz), r.feuer.zusatz.slice(0, 60));
      pr(`${seite}: eigener Hinweis bleibt, „Alkoholhaltig.“ davor`, r.eier.important === 'Alkoholhaltig. Mit Sahnehaube.' && r.eier.alkohol === true, r.eier.important);
      pr(`${seite}: Nachtrag als erledigt vermerkt`, r.merk === '1');
      // einmalig: Hinweis von Hand wieder entfernt -> bleibt so (Betreiber entscheidet)
      await g.p.evaluate(() => { const a = articles.find((x) => x.id === 'eier'); a.info.important = 'Mit Sahnehaube.'; localStorage.setItem('kcm_articles', JSON.stringify(articles)); });
      await g.p.reload(); await g.p.waitForTimeout(1200);
      r = await lese(g.p);
      pr(`${seite}: Nachtrag läuft nur einmal (spätere Handänderung bleibt)`, r.eier.important === 'Mit Sahnehaube.', r.eier.important);
      await g.c.close();
    }
  } catch (e) { console.log('ABBRUCH:', e && e.stack || e); f++; }
  await b.close(); s.close(); console.log(f ? `\n${f} FEHLER` : '\nAlles OK'); process.exit(f ? 1 : 0);
})();
