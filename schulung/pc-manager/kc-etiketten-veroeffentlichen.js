/* KC PC-Manager · Artikelstand für die Preisetiketten der Club-App veröffentlichen           Build 1.0.0
 * KC-CLUB-PREISETIKETTEN (12.11.2026, Betreiber: „die Club-App muss auch die aktuellen Preise übernehmen“; Wahl: PC-Manager veröffentlicht
 * und im Dialog von Hand änderbar).
 *
 * Die aktuellen Preise pflegt allein der PC-Manager; an die Kassen gehen sie über das lokale Netz (Manager-Companion), nicht ins Internet.
 * Damit die Club-App (Büro → 🖨️ Drucker → 🏷️ Preisetiketten) dieselben Preise druckt, schickt der Manager den verkaufbaren Artikelstand
 * (Name, Artikelnummer, Preis, Pfand, Warengruppe, Allergene, Zusatzstoffe, Alkohol, Foto-Pfad) nach Supabase:
 *   - automatisch nach „📤 … an alle Kassen senden“ (wenn bei Supabase angemeldet),
 *   - und per Knopf „🏷️ Für Preisetiketten in der Club-App veröffentlichen“.
 * Je Verein EINE Zeile (kc_etikett_artikel_stand), jedes Mal ersetzt – ca. 20 Artikel, wenige KB, eine Abfrage.
 * Schulungs-PC-Manager: veröffentlicht NIE (Übungsdaten dürfen die echten Etiketten nicht überschreiben).
 * Fehlende Angaben bleiben leer (null) – die Club-App druckt sie rot als „nicht erfasst“ (UNKNOWN nie als OK).
 */
(function (global) {
  'use strict';
  const ORG_ID = 'KC_WERNE', FUNKTION = 'kc_etikett_artikel_veroeffentlichen';
  const SCHULUNG = /\/schulung\//.test(global.location?.pathname || '');

  // gleiche Regeln wie werkzeuge/etiketten/artikelstamm.cjs (Kesselschild-Etiketten)
  // Pfand wie der Etikettendruck des Managers: zuerst die Pfandgruppen des Artikels, sonst seine Pfandbestandteile (Kassenformat)
  function pfandVon(x) {
    const gruppen = Array.isArray(global.depositGroups) ? global.depositGroups : [];
    const ausGruppen = (x.depositGroupIds || []).map((id) => gruppen.find((g) => g.id === id)).filter(Boolean)
      .map((g) => ({name: g.name || 'Pfand', betrag: Number(g.amount ?? g.price ?? g.value)})).filter((k) => k.betrag > 0);
    return ausGruppen.length ? ausGruppen : (x.depositComponents || []).filter((k) => Number(k?.price) > 0).map((k) => ({name: k.name || 'Pfand', betrag: Number(k.price)}));
  }
  function artikelListe(quelle) {
    const alsText = (a) => (global.KCAllergene?.alsText ? global.KCAllergene.alsText(a) : '') || '';
    // 12.11.2026 (Wunsch Betreiber „auch Pfand und Sonstiges, z. B. Außer-Haus-Becher“): alle Artikel mit fünfstelliger Nummer und Preis ≠ 0 (Rückgaben negativ)
    return (Array.isArray(quelle) ? quelle : []).filter((x) => x && x.active !== false && Number(x.price) !== 0 && /^\d{5}$/.test(String(x.barcode || '')))
      .map((x) => {
        const info = x.info || {}, zusatz = String(info.additives || '').trim(), bild = String(x.image || '');
        return {
          id: x.id, name: x.name, nummer: String(x.barcode), preis: Number(x.price),
          pfand: pfandVon(x),
          kategorie: x.category || '', sortierung: Number.isFinite(Number(x.sortOrder)) ? Number(x.sortOrder) : 999, farbe: x.color || '#173765',
          allergene: alsText(info.allergens) || String(info.legacyAllergens || '').trim() || null, allergeneGeprueft: info.status === 'approved',
          zusatz: /^(keine angaben?|unbekannt|-)?$/i.test(zusatz) ? null : zusatz,
          alkohol: /alkohol(?!fre)/i.test(String(info.important || '') + ' ' + String(info.shortDescription || '')),
          // Fotos aus dem Kassenprogramm (assets/…) – ein selbst hochgeladenes Foto (data:) geht nicht mit (zu groß); die Club-App nimmt dann das Kassenbild
          bild: bild && !bild.startsWith('data:') ? 'pos/' + bild.replace(/^\.?\//, '') : null,
        };
      });
  }

  async function veroeffentlichen() {
    if (SCHULUNG) return {ok: false, grund: 'Schulung – es wird nichts veröffentlicht'};
    if (!global.KCSupabase?.istAngemeldet?.()) return {ok: false, grund: 'nicht bei Supabase angemeldet'};
    const liste = artikelListe(global.articles || []);
    if (!liste.length) return {ok: false, grund: 'keine verkaufbaren Artikel'};
    try {
      const r = await global.KCSupabase.rufeFunktionAuf(FUNKTION, {p_org_id: ORG_ID, p_artikel: liste});
      return r?.ok ? {ok: true, anzahl: r.anzahl} : {ok: false, grund: r?.grund || 'unbekannt'};
    } catch (e) { return {ok: false, grund: String(e?.message || e).slice(0, 120)}; }
  }

  function knopfVerbinden() {
    const k = document.getElementById('etikettenVeroeffBtn'), feld = document.getElementById('masterDataPushStatus');
    if (!k) return;
    if (SCHULUNG) { k.disabled = true; k.title = 'In der Schulung wird nichts veröffentlicht'; return; }
    k.addEventListener('click', async () => {
      k.disabled = true; if (feld) feld.textContent = 'Preisetiketten: wird veröffentlicht …';
      const r = await veroeffentlichen(); k.disabled = false;
      if (feld) feld.textContent = r.ok ? `Preisetiketten: ${r.anzahl} Artikel mit aktuellen Preisen für die Club-App veröffentlicht.`
        : `Preisetiketten: nicht veröffentlicht (${r.grund}).`;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', knopfVerbinden); else knopfVerbinden();
  global.KCEtikettenStand = {veroeffentlichen, artikelListe};
})(window);
