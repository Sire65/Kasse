/* KC-ARTIKELINFO-SUPABASE (14.10.2026, Betreiber: "Ja, Rum aus Supabase uebernehmen"): der PC-Manager holt nach der
   Supabase-Anmeldung die FREIGEGEBENEN Artikelinformationen (kc_manager_articles + Allergene) und traegt sie beim
   Kassenartikel ein; "in Pruefung" wird nicht uebernommen; von Hand gepflegte Angaben bleiben; danach gehen sie mit
   dem Stammdaten-Abgleich an die Kasse (dort sichtbar inkl. Naehrwerte). Supabase nachgestellt (Werte wie dort). */
const pw = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
const T = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'};
const s = http.createServer((q, r) => { const p = path.join(W, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, {'Content-Type': T[path.extname(p)] || 'application/octet-stream'}); r.end(d); }); });
let f = 0; const pr = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) f++; };
const RUM = {article_id: 'r1', article_code: 'POTT_RUM_40', review_status: 'approved', active: true, ingredients: 'Rum', additives_ingredients: 'Keine deklarationspflichtigen Zusatzstoffe in den geprüften Primär-/Handelsdaten ausgewiesen.',
  legacy_allergen_text: 'Keine deklarationspflichtigen Big-14-Allergene laut geprüfter Produktinformation.', manufacturer: 'H.H. Pott Nfgr.', short_description: 'POTT Echter Übersee-Rum 40 % vol.', data_source: 'POTT/REWE', alcohol_percent: '40.00',
  nutrition_basis_unit: '100ml', energy_kj: '916.00', energy_kcal: '221.00', fat_g: '0.000', saturated_fat_g: '0.000', carbohydrates_g: '0.000', sugar_g: '0.000', protein_g: '0.000', salt_g: '0.000', approved_at: '2026-09-11T13:25:58Z', approved_by: 'Hans / Admin', updated_at: '2026-09-11T13:25:58Z'};
(async () => {
  const PORT = Number(process.env.P || 8989); await new Promise((r) => s.listen(PORT, r)); const b = await pw.chromium.launch();
  try {
    for (const seite of ['pc-manager', 'schulung/pc-manager']) {
      const mc = await b.newContext({serviceWorkers: 'block'}); let push = null;
      await mc.route(/127\.0\.0\.1:4739[12]/, (r) => r.abort());
      await mc.route(/127\.0\.0\.1:47392\/master-data\/push/, (r) => { push = JSON.parse(r.request().postData()); r.fulfill({status: 200, contentType: 'application/json', body: '{"revision":3}'}); });
      const m = await mc.newPage(); await m.goto(`http://127.0.0.1:${PORT}/${seite}/index.html`);
      await m.waitForFunction(() => !!window.KCArtikelinfoSupabase, null, {timeout: 15000});
      const frage = [];
      const r = await m.evaluate(async (RUM) => {
        window.__fragen = [];
        window.KCSupabase = {istAngemeldet: () => true, rufeTabelleAuf: async (pfad) => { window.__fragen.push(pfad);
          if (pfad.startsWith('kc_manager_articles')) return /review_status=eq\.approved/.test(pfad) ? [RUM] : [RUM, {article_id: 'a1', article_code: 'RAVINI_AMARETTO_21_5', review_status: 'in_review'}];
          if (pfad.startsWith('kc_manager_article_allergens')) return ['gluten', 'eggs', 'milk', 'sulphites', 'nuts'].map((k) => ({article_id: 'r1', allergen_key: k, status: 'not_contains'}));
          return []; }};
        const am = articles.find((a) => a.id === 'schussamaretto'); am.info = {};
        const erg = await window.KCArtikelinfoSupabase.uebernehmen();
        const zweit = await window.KCArtikelinfoSupabase.uebernehmen();
        const rum = articles.find((a) => a.id === 'schussrum').info;
        // von Hand gepflegt -> bleibt
        const am2 = articles.find((a) => a.id === 'schussamaretto');
        return {erg, zweit, rum, amaretto: am2.info, fragen: window.__fragen};
      }, RUM);
      await m.waitForTimeout(500);
      pr(`${seite}: Rum übernommen (freigegeben), Amaretto (in Prüfung) nicht`, r.erg.uebernommen === 1 && r.erg.artikel.includes('Schuss Rum') && !(r.amaretto && r.amaretto.ingredients), JSON.stringify(r.erg));
      pr(`${seite}: nur freigegebene Einträge abgefragt`, r.fragen.some((p) => /review_status=eq\.approved/.test(p)));
      pr(`${seite}: Rum – Zutat, Zusatzstoffe, Allergene "nicht enthalten", 221 kcal / 916 kJ, Hersteller, 40 % vol`,
        r.rum.ingredients === 'Rum' && /Keine deklarationspflichtigen Zusatzstoffe/.test(r.rum.additives) && r.rum.allergens.eggs === 'not-contained' && r.rum.nutrition.energyKcal === 221 && r.rum.nutrition.energyKj === 916 && /Pott/.test(r.rum.manufacturer) && /40 % vol/.test(r.rum.important) && r.rum.status === 'approved', JSON.stringify(r.rum).slice(0, 180));
      pr(`${seite}: zweiter Lauf ändert nichts (unverändert)`, r.zweit.uebernommen === 0);
      // von Hand gepflegte Angabe bleibt
      const hand = await m.evaluate(async () => { const a = articles.find((x) => x.id === 'schussrum'); a.info = {ingredients: 'Von Hand gepflegt', source: 'Verein'}; await window.KCArtikelinfoSupabase.uebernehmen(); return a.info.ingredients; });
      pr(`${seite}: von Hand gepflegte Angaben werden nicht überschrieben`, hand === 'Von Hand gepflegt');
      if (seite === 'pc-manager') {
        pr('Manager: danach an die Kassen gesendet (Rum-Info im Stammdaten-Abgleich)', !!push && push.articles.find((a) => a.id === 'schussrum')?.info?.nutrition?.energyKcal === 221);
        const kc = await b.newContext({serviceWorkers: 'block'});
        await kc.route(/\/kc-sync-master-data(\?|$)/, (rt) => rt.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(Object.assign({vorhanden: true, revision: 3}, push || {}))}));
        const k = await kc.newPage(); await k.addInitScript(() => localStorage.setItem('kc_master_v040', JSON.stringify({registerId: 'KASSE-01', pinLockEnabled: false})));
        await k.goto(`http://127.0.0.1:${PORT}/pos/index.html`); await k.waitForTimeout(4500);
        const ki = await k.evaluate(() => PRODUCTS.find((x) => x.id === 'schussrum')?.info || {});
        pr('Kasse: Schuss Rum mit Zutat, Allergen-Hinweis und 221 kcal', ki.ingredients === 'Rum' && /Keine deklarationspflichtigen Big-14/.test(ki.legacyAllergens || '') && ki.nutrition?.energyKcal === 221);
        await kc.close();
      }
      await mc.close();
    }
  } finally { await b.close(); s.close(); }
  console.log(f ? `\n${f} FEHLER` : '\nAlles OK'); process.exit(f ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
