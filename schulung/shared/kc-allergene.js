/* Allergene lesbar machen - eine Stelle für Kasse und PC-Manager.
 *
 * BEFUND vom 31.08.2026 (Sichtprüfung vor der Präsentation):
 * Auf dem Artikel-Etikett im PC-Manager stand wörtlich
 *      Allergene: [object Object]
 * Grund: das Feld info.allergens gibt es in ZWEI Formen.
 *   - alt / von Hand gepflegt:  "Enthält Sulfite"            (einfacher Text)
 *   - neu / aus der Rezeptur:   {sulphites:"contained", ...}  (die 14 Pflichtallergene)
 * Das Informationsfenster der Kasse konnte beide Formen, das Etikett und die Artikelliste
 * dagegen setzten den Wert einfach in den Text ein - bei der zweiten Form kommt dabei
 * "[object Object]" heraus. Auf einem gedruckten Etikett am Stand ist das nicht nur
 * peinlich, es ist eine fehlende Pflichtangabe.
 *
 * Diese Datei macht aus BEIDEN Formen denselben lesbaren Satz. Genannt werden nur
 * "enthalten" und "Spuren möglich" - "nicht enthalten" und "nicht geprüft" gehören nicht
 * auf ein Etikett, sie machen es nur lang und unklar.
 */
(function (global) {
  'use strict';

  const NAMEN = {
    gluten: 'Glutenhaltiges Getreide', crustaceans: 'Krebstiere', eggs: 'Eier', fish: 'Fisch',
    peanuts: 'Erdnüsse', soy: 'Soja', milk: 'Milch', nuts: 'Schalenfrüchte', celery: 'Sellerie',
    mustard: 'Senf', sesame: 'Sesam', sulphites: 'Schwefeldioxid / Sulfite', lupin: 'Lupinen',
    molluscs: 'Weichtiere',
  };
  const STUFEN = {contained: 'enthalten', traces: 'Spuren möglich'};

  // Liefert einen lesbaren Text oder '' - nie "[object Object]", nie "undefined".
  function alsText(wert) {
    if (!wert) return '';
    if (typeof wert === 'string') return wert.trim();
    if (Array.isArray(wert)) return wert.map((x) => String(x).trim()).filter(Boolean).join(', ');
    if (typeof wert !== 'object') return '';
    const teile = [];
    for (const [schluessel, stufe] of Object.entries(wert)) {
      if (!STUFEN[stufe]) continue;                       // nur enthalten / Spuren möglich
      const name = NAMEN[schluessel] || schluessel;
      teile.push(stufe === 'contained' ? name : `${name} (Spuren möglich)`);
    }
    return teile.join(', ');
  }

  // Für das Etikett: wenn nichts hinterlegt ist, lieber gar keine Zeile drucken.
  const vorhanden = (wert) => alsText(wert).length > 0;

  const modul = {alsText, vorhanden, NAMEN, STUFEN};
  if (typeof module !== 'undefined' && module.exports) module.exports = modul;
  if (global) global.KCAllergene = modul;
})(typeof window !== 'undefined' ? window : null);
