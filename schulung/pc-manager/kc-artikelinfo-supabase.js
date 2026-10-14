/* KC PC-Manager · Geprüfte Artikelinformationen aus Supabase übernehmen        Build 1.0.0
 * KC-ARTIKELINFO-SUPABASE (14.10.2026, Betreiber: "Ja, Rum aus Supabase übernehmen").
 *
 * In Supabase liegen geprüfte Produktinformationen (kc_manager_articles + kc_manager_article_allergens), z. B.
 * POTT Rum 40 % (geprüft 11.09.2026: Zutat, Zusatzstoffe, 14 Pflichtallergene, Nährwerte, Hersteller). Bisher las
 * kein Programm diese Tabelle - die Angaben kamen nie an der Kasse an. Jetzt holt der Manager nach der Supabase-
 * Anmeldung alle FREIGEGEBENEN Einträge (review_status = approved) und trägt sie beim zugehörigen Kassenartikel ein.
 *   - Supabase bleibt die Quelle: wird dort etwas geändert, kommt es beim nächsten Start mit.
 *   - Nur freigegebene Einträge; "in Prüfung" (z. B. Amaretto) wird NICHT übernommen.
 *   - Von Hand im Manager gepflegte Angaben werden nicht überschrieben - übernommen wird nur, wenn der Artikel noch
 *     keine eigene Information hat oder sie bereits aus Supabase stammt.
 *   - Danach mit dem vorhandenen Stammdaten-Abgleich an die Kassen (KCTimeClockManager.anKassenSenden).
 */
(function (global) {
  'use strict';
  // Supabase-Artikelcode -> Kassenartikel
  const ZUORDNUNG = {POTT_RUM_40: 'schussrum', RAVINI_AMARETTO_21_5: 'schussamaretto'};
  const STUFE = {contains: 'contained', contained: 'contained', traces: 'traces', may_contain: 'traces', not_contains: 'not-contained', not_contained: 'not-contained'};
  const QUELLE = 'Supabase (geprüfte Artikelinformation)';
  const zahl = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

  function hatEigeneInfo(i) {
    if (!i || typeof i !== 'object') return false;
    if (String(i.source || '').startsWith(QUELLE)) return false;   // stammt schon aus Supabase -> darf aktualisiert werden
    const n = i.nutrition || {};
    return [i.ingredients, i.additives, i.legacyAllergens, i.manufacturer].some((x) => String(x || '').trim())
      || (typeof i.allergens === 'string' && i.allergens.trim())
      || (i.allergens && typeof i.allergens === 'object' && Object.values(i.allergens).some((v) => v === 'contained' || v === 'traces' || v === 'not-contained'))
      || Object.values(n).some((v) => v !== null && v !== '' && v !== undefined);
  }

  function alsInfo(z, allergene) {
    const al = {};
    (allergene || []).forEach((a) => { al[a.allergen_key] = STUFE[String(a.status || '').toLowerCase()] || 'not-checked'; });
    const alk = zahl(z.alcohol_percent);
    return {
      status: 'approved', shortDescription: z.short_description || '', ingredients: z.ingredients || '',
      additives: z.additives_ingredients || '', legacyAllergens: z.legacy_allergen_text || '', allergens: al,
      important: alk ? `Alkoholhaltig (${String(alk).replace('.', ',')} % vol).` : '',
      nutrition: {energyKj: zahl(z.energy_kj), energyKcal: zahl(z.energy_kcal), fat: zahl(z.fat_g), saturates: zahl(z.saturated_fat_g),
        carbohydrate: zahl(z.carbohydrates_g), sugars: zahl(z.sugar_g), protein: zahl(z.protein_g), salt: zahl(z.salt_g)},
      nutritionBasis: z.nutrition_basis_unit || '100ml',
      manufacturer: z.manufacturer || '', supplier: z.supplier || '',
      source: `${QUELLE} ${z.article_code}: ${z.data_source || ''}`.trim(),
      approvedAt: z.approved_at ? String(z.approved_at).slice(0, 10) : '', approvedBy: z.approved_by || '',
      supabaseStand: z.updated_at || '',
    };
  }

  async function uebernehmen({still = true} = {}) {
    const sb = global.KCSupabase;
    if (!sb?.istAngemeldet?.() || !Array.isArray(global.articles)) return {uebernommen: 0, grund: 'nicht angemeldet'};
    let zeilen, allergene;
    try {
      zeilen = await sb.rufeTabelleAuf('kc_manager_articles?select=*&review_status=eq.approved&active=eq.true');
      const ids = (zeilen || []).map((z) => z.article_id).filter(Boolean);
      allergene = ids.length ? await sb.rufeTabelleAuf(`kc_manager_article_allergens?select=article_id,allergen_key,status&article_id=in.(${ids.join(',')})`) : [];
    } catch (e) { return {uebernommen: 0, grund: 'Supabase nicht erreichbar'}; }
    let uebernommen = 0; const liste = [];
    (zeilen || []).forEach((z) => {
      const artikel = global.articles.find((a) => a.id === ZUORDNUNG[z.article_code]);
      if (!artikel || hatEigeneInfo(artikel.info)) return;
      const neu = alsInfo(z, (allergene || []).filter((a) => a.article_id === z.article_id));
      if (artikel.info && artikel.info.supabaseStand === neu.supabaseStand) return;   // unverändert
      artikel.info = neu; uebernommen++; liste.push(artikel.name);
    });
    if (uebernommen) {
      try { global.saveAll?.(); } catch (e) { /* Speicher voll */ }
      try { await global.KCTimeClockManager?.anKassenSenden?.(); } catch (e) { /* nächster Abgleich nimmt es mit */ }
      if (!still) global.KCNotificationCore?.notify?.({message: `Geprüfte Artikelinformation aus Supabase übernommen: ${liste.join(', ')}`, type: 'success'});
    }
    return {uebernommen, artikel: liste};
  }

  // Nach dem Start, sobald die Supabase-Anmeldung steht (einige Versuche, dann gibt der Baustein still auf).
  let versuche = 0;
  const takt = setInterval(() => {
    versuche++;
    if (global.KCSupabase?.istAngemeldet?.()) { clearInterval(takt); uebernehmen(); }
    else if (versuche > 40) clearInterval(takt);
  }, 3000);

  global.KCArtikelinfoSupabase = {version: '1.0.0', uebernehmen, alsInfo, ZUORDNUNG};
})(window);
