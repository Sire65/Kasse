/* KC-CLUB-PREISETIKETTEN (12.11.2026, Betreiber: „die Club-App muss auch die aktuellen Preise übernehmen“): der PC-Manager veröffentlicht
   den verkaufbaren Artikelstand (Preise aus dem Manager, nicht die eingebauten) für die Preisetiketten der Club-App – per Knopf und nach
   „an alle Kassen senden“; die Schulung veröffentlicht nie. Supabase nachgestellt, kein Netz nach draußen. */
const pw = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
const T = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'};
const s = http.createServer((q, r) => { const p = path.join(W, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, {'Content-Type': T[path.extname(p)] || 'application/octet-stream'}); r.end(d); }); });
let f = 0; const pr = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) f++; };
(async () => {
  const PORT = Number(process.env.P || 8991); await new Promise((r) => s.listen(PORT, r)); const b = await pw.chromium.launch();
  try {
    for (const seite of ['pc-manager', 'schulung/pc-manager']) {
      const mc = await b.newContext({serviceWorkers: 'block'});
      await mc.route((u) => !u.href.startsWith(`http://127.0.0.1:${PORT}/`), (r) => r.abort()); // nichts nach draußen
      const m = await mc.newPage(); await m.goto(`http://127.0.0.1:${PORT}/${seite}/index.html`);
      await m.waitForFunction(() => !!window.KCEtikettenStand, null, {timeout: 15000});
      const r = await m.evaluate(async () => {
        const gerufen = [];
        window.KCSupabase = {istAngemeldet: () => true, rufeFunktionAuf: async (n, a) => { gerufen.push({n, a}); return {ok: true, anzahl: a.p_artikel.length}; }};
        const eier = articles.find((a) => a.barcode === '01006'); const alt = eier.price; eier.price = 4.8; // Preisänderung im Manager
        const erg = await window.KCEtikettenStand.veroeffentlichen(); eier.price = alt;
        return {erg, gerufen, knopf: !!document.getElementById('etikettenVeroeffBtn'), knopfAus: document.getElementById('etikettenVeroeffBtn')?.disabled};
      });
      if (seite === 'pc-manager') {
        const a = r.gerufen[0]?.a, e = a?.p_artikel?.find((x) => x.nummer === '01006');
        pr(`${seite}: veröffentlicht über ${r.gerufen[0]?.n}`, r.erg.ok && r.gerufen.length === 1 && r.gerufen[0].n === 'kc_etikett_artikel_veroeffentlichen' && a.p_org_id === 'KC_WERNE');
        const fz = a?.p_artikel?.find((x) => x.nummer === '01003');
        pr(`${seite}: Preis aus dem Manager (4,80), Warengruppe, Foto-Pfad`, e?.preis === 4.8 && e.kategorie === 'Getränke' && /^pos\/assets\//.test(e.bild || ''), JSON.stringify(e).slice(0, 160));
        pr(`${seite}: Pfand wie im Manager (Feuerzangenbowle: Glas + Feuerzange)`, fz?.pfand?.length === 2 && fz.pfand.every((k) => k.betrag === 2), JSON.stringify(fz?.pfand));
        pr(`${seite}: nur verkaufbare Artikel 01…/02…`, a.p_artikel.length > 5 && a.p_artikel.every((x) => /^0[12]/.test(x.nummer) && x.preis > 0));
        pr(`${seite}: Alkoholfrei ist kein Alkohol`, a.p_artikel.find((x) => x.nummer === '01004')?.alkohol === false && e.alkohol === true);
        pr(`${seite}: Knopf vorhanden`, r.knopf && !r.knopfAus);
      } else {
        pr(`${seite}: Schulung veröffentlicht nie`, !r.erg.ok && r.gerufen.length === 0 && r.knopf && r.knopfAus === true, JSON.stringify(r.erg));
      }
      const app = fs.readFileSync(path.join(W, seite, 'app.js'), 'utf8');
      pr(`${seite}: nach „an alle Kassen senden“ wird mitveröffentlicht`, /const etiketten = await window\.KCEtikettenStand\?\.veroeffentlichen\?\.\(\);/.test(app));
      await mc.close();
    }
  } finally { await b.close(); s.close(); }
  console.log(f ? `\n${f} FEHLER` : '\nAlles OK'); process.exit(f ? 1 : 0);
})();
