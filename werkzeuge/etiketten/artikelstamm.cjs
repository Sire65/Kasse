// Gemeinsamer Kern: Artikelstamm der Kasse lesen, wie er am Stand gilt (pos/app.js -> PRODUCTS, Allergen-Texte aus shared/kc-allergene.js).
// Genutzt von kesselschild.cjs (Etiketten-PDF) und artikel-export.cjs (etiketten/artikel.json fuer die Preisetiketten der Club-App).
// Alle aktiven Artikel mit fuenfstelliger Artikelnummer und Preis ungleich 0 – Getraenke 01…, Speisen 02…, Pfand 03… (Rueckgabe mit
// Minus-Preis), Sonstiges 04… (z. B. Ausser-Haus-Becher), Packages 05… (12.11.2026, Wunsch Betreiber „auch Pfand und Sonstiges“).
// Fuer das Kesselschild-Werkzeug ohne Artikelauswahl bleibt es bei Getraenken/Speisen (nur01und02).
async function artikelstammLesen(b, port, ids = [], {nur01und02 = false} = {}) {
  const ctx = await b.newContext({serviceWorkers: 'block'}); const p = await ctx.newPage();
  await p.addInitScript(() => localStorage.setItem('kc_master_v040', JSON.stringify({registerId: 'ETIKETT', pinLockEnabled: false})));
  await p.goto(`http://127.0.0.1:${port}/pos/index.html`); await p.waitForFunction(() => typeof PRODUCTS !== 'undefined' && PRODUCTS.length && window.KCAllergene, null, {timeout: 20000});
  const artikel = await p.evaluate(([ids, nur12]) => PRODUCTS.filter((x) => x.active !== false && Number(x.price) !== 0 && (nur12 ? Number(x.price) > 0 && /^0[12]/.test(String(x.barcode || '')) : /^\d{5}$/.test(String(x.barcode || ''))) && (!ids.length || ids.includes(x.id)))
    .map((x) => {
      const pfand = (x.depositComponents || []).filter((k) => Number(k?.price) > 0).map((k) => ({name: k.name || 'Pfand', betrag: Number(k.price)}));
      const info = x.info || {};
      const zusatz = String(info.additives || '').trim();
      return {id: x.id, name: x.name, preis: Number(x.price), pfand, nummer: String(x.barcode), bild: x.image, farbe: x.color || '#173765',
        kategorie: x.category || '', sortierung: Number.isFinite(Number(x.sortOrder)) ? Number(x.sortOrder) : 999,
        allergene: window.KCAllergene.alsText(info.allergens) || String(info.legacyAllergens || '').trim(),
        allergeneGeprueft: info.status === 'approved',
        zusatz: /^(keine angaben?|unbekannt|-)?$/i.test(zusatz) ? null : zusatz,
        // 29.10.2026: „Alkoholfrei (0 % vol)“ / „Alkoholfreier …“ ist KEIN Alkohol (vorher stand beim Apfelpunsch „Enthält Alkohol“)
        alkohol: /alkohol(?!fre)/i.test(String(info.important || '') + ' ' + String(info.shortDescription || ''))};
    }), [ids, nur01und02]);
  await ctx.close();
  return artikel;
}
module.exports = {artikelstammLesen};
