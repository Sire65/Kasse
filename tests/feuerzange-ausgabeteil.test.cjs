/* Feuerzangenbowle: zwei Ausgabe-Teile – Glas UND Feuerzange (Betreiber 18.11.2026: „als Ausgabegefäß muss noch die Feuerzange
   bei Feuerzangenbowle dazu gepackt werden, also 2 Teile“).
   Geprüft in PC-Manager und Schulungs-PC-Manager (ohne echten Server, Netzsperre):
   - frisch: Feuerzangenbowle zeigt Glas als Ausgabegefäß und darunter die Feuerzange (Bild, Mehrweg, Pfand 2,00 €)
   - Reihenfolge wie aus Supabase (Feuerzange zuerst): Glas bleibt das Ausgabegefäß
   - Gefäß wechseln: die Feuerzange bleibt erhalten (früher ersetzte der Wechsel alle Teile) */
const pw = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
const OHNE_ECHTSERVER = ['--no-proxy-server', '--host-resolver-rules=MAP *.supabase.co 0.0.0.0, MAP *.supabase.com 0.0.0.0, MAP *.workers.dev 0.0.0.0, MAP speed.cloudflare.com 0.0.0.0, MAP api.github.com 0.0.0.0'];
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const s = http.createServer((q, r) => { const p = path.join(W, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
let f = 0; const pr = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) f++; };

(async () => {
  const PORT = Number(process.env.P || 8993); await new Promise((r) => s.listen(PORT, r));
  const b = await pw.chromium.launch({ args: OHNE_ECHTSERVER });
  try {
    for (const seite of ['pc-manager', 'schulung/pc-manager']) for (const fall of ['frisch', 'Supabase-Reihenfolge']) {
      const c = await b.newContext({ serviceWorkers: 'block' });
      await c.route('**/*', (r) => (r.request().url().startsWith(`http://127.0.0.1:${PORT}/`) ? r.continue() : r.abort()));
      await c.routeWebSocket(/.*/, (ws) => ws.close());
      const p = await c.newPage(); const js = []; p.on('pageerror', (e) => js.push(e.message));
      await p.addInitScript((umgedreht) => { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', '1');
        if (umgedreht) localStorage.setItem('kcm_recipe_serving_materials_v1', JSON.stringify({ feuer: [
          { materialId: 'SERVING-FEUERZANGE-WM', qtyPerPortion: 1, role: 'Zubehör' }, { materialId: 'SERVING-GLASS-020-WM', qtyPerPortion: 1, role: 'Ausgabegefäß' }] })); }, fall !== 'frisch');
      await p.goto(`http://127.0.0.1:${PORT}/${seite}/index.html`); await p.waitForTimeout(2500);
      const n = `${seite} ${fall}`;
      const zeigen = () => p.evaluate(() => { const id = document.getElementById('aId'); id.value = 'feuer'; id.dispatchEvent(new Event('input', { bubbles: true })); id.dispatchEvent(new Event('change', { bubbles: true })); });
      await zeigen(); await p.waitForTimeout(900);
      const lesen = () => p.evaluate(() => { const box = document.getElementById('recipeServingMaterialBody'); const sel = document.getElementById('servingMaterialSelect');
        return { gefaess: sel ? sel.value : '', zubehoer: [...(box ? box.querySelectorAll('.serving-zubehoer') : [])].map((x) => x.dataset.material + '|' + x.textContent.replace(/\s+/g, ' ') + '|' + (x.querySelector('img') || {}).src + '|' + ((x.querySelector('img') || {}).naturalWidth || 0)),
          teile: (window.KCServingMaterials.assignments().feuer || []).map((x) => x.materialId) }; });
      let e = await lesen();
      pr(`${n}: Glas ist das Ausgabegefäß`, e.gefaess === 'SERVING-GLASS-020-WM', e.gefaess);
      const z = e.zubehoer[0] || '';
      pr(`${n}: Feuerzange als zweites Teil mit Bild, Mehrweg und Pfand 2,00 €`, e.zubehoer.length === 1 && z.startsWith('SERVING-FEUERZANGE-WM|') && /Pfand 2,00 €/.test(z) && /feuerzange_ausgabe\.webp\|\d+$/.test(z) && !/\|0$/.test(z), z.slice(0, 160));
      // Gefäß wechseln und zurück: Feuerzange bleibt
      await p.evaluate(() => { const sel = document.getElementById('servingMaterialSelect'); sel.value = 'CONSUMABLE-BOWL-BAGASSE-500-WM'; sel.dispatchEvent(new Event('change', { bubbles: true })); });
      await p.waitForTimeout(200);
      await p.evaluate(() => { const sel = document.getElementById('servingMaterialSelect'); sel.value = 'SERVING-GLASS-020-WM'; sel.dispatchEvent(new Event('change', { bubbles: true })); });
      await p.waitForTimeout(200); e = await lesen();
      pr(`${n}: nach Gefäßwechsel bleibt die Feuerzange (2 Teile)`, e.teile.length === 2 && e.teile.includes('SERVING-FEUERZANGE-WM') && e.teile.includes('SERVING-GLASS-020-WM') && e.gefaess === 'SERVING-GLASS-020-WM', e.teile.join(', '));
      // 19.11.2026 (Betreiber: „Feuerzange aus der Combo-Box ja, aber sie tauchte nicht als zweite Sache daneben auf“):
      // Hauptauswahl bietet keine Feuerzange mehr an; „＋ Teil hinzufügen“ legt sie als zweites Teil dazu; „✕ entfernen“ nimmt sie weg
      const angebot = await p.evaluate(() => [...document.querySelectorAll('#servingMaterialSelect option')].map((o) => o.value));
      pr(`${n}: Ausgabegefäß-Auswahl ohne Feuerzange`, !angebot.includes('SERVING-FEUERZANGE-WM') && angebot.includes('SERVING-GLASS-020-WM'), angebot.join(', '));
      await p.evaluate(() => { const id = document.getElementById('aId'); id.value = 'eier'; id.dispatchEvent(new Event('input', { bubbles: true })); id.dispatchEvent(new Event('change', { bubbles: true })); });
      await p.waitForTimeout(500);
      const eierVor = await p.evaluate(() => ({ gefaess: document.getElementById('servingMaterialSelect')?.value, add: !!document.getElementById('servingAddPart') }));
      pr(`${n}: Eierlikörpunsch hat das Glas, „＋ Teil hinzufügen“ ist da`, eierVor.gefaess === 'SERVING-GLASS-020-WM' && eierVor.add, JSON.stringify(eierVor));
      await p.evaluate(() => { document.getElementById('servingAddPartSelect').value = 'SERVING-FEUERZANGE-WM'; document.getElementById('servingAddPart').click(); });
      await p.waitForTimeout(300);
      const eierMit = await p.evaluate(() => ({ gefaess: document.getElementById('servingMaterialSelect')?.value, teile: [...document.querySelectorAll('.serving-zubehoer')].map((x) => x.dataset.material) }));
      pr(`${n}: „＋ Teil hinzufügen“ zeigt die Feuerzange als zweites Teil, Glas bleibt`, eierMit.gefaess === 'SERVING-GLASS-020-WM' && eierMit.teile.join() === 'SERVING-FEUERZANGE-WM', JSON.stringify(eierMit));
      await p.evaluate(() => document.querySelector('[data-remove-part="SERVING-FEUERZANGE-WM"]').click());
      await p.waitForTimeout(300);
      const eierOhne = await p.evaluate(() => (window.KCServingMaterials.assignments().eier || []).map((x) => x.materialId));
      pr(`${n}: „✕ entfernen“ nimmt die Feuerzange wieder weg`, eierOhne.join() === 'SERVING-GLASS-020-WM', eierOhne.join());
      if (seite === 'pc-manager' && fall === 'frisch') {
        // Speichern löscht entfernte Teile auch in Supabase (nachgebildet, kein echter Server)
        const anfragen = [];
        await c.route(/supabase\.co\/rest\/v1\/kc_manager_(recipe_)?serving_materials/, (r) => { anfragen.push(r.request().method() + ' ' + decodeURIComponent(r.request().url().split('/rest/v1/')[1])); r.fulfill({ status: 204, body: '' }); });
        await p.evaluate(async () => { window.KCSupabase = { istAngemeldet: () => true, holeZugriffsToken: () => 'TEST_ANMELDUNG', konfig: { url: 'https://ptblnpiroqftcvlsrhac.supabase.co', publishableKey: 'TEST_PUBLIC' } };
          await window.KCServingMaterialsSupabase.push(); });
        const del = anfragen.find((x) => x.startsWith('DELETE ') && /product_code=eq\.eier/.test(x));
        pr(`${n}: Speichern löscht entfernte Teile in Supabase (Eierlikörpunsch: alles außer Glas)`, !!del && /material_id=not\.in\.\("SERVING-GLASS-020-WM"\)/.test(del), del || anfragen.join(' | ').slice(0, 200));
      }
      pr(`${n}: keine JS-Fehler`, !js.filter((x) => !/Failed to fetch|Load failed|access control|net::ERR|4739/.test(x)).length, js.join('|').slice(0, 200));
      await c.close();
    }
  } catch (e) { console.log('ABBRUCH:', e && e.stack || e); f++; }
  await b.close(); s.close(); console.log(f ? `\n${f} FEHLER` : '\nAlles OK'); process.exit(f ? 1 : 0);
})();
