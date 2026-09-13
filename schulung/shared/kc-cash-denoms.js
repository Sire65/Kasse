// Gemeinsame Stückelungs-Reihenfolge für Geldübergabe-Codes (Money Butler <-> Kasse/Manager).
//
// 12.09.2026 (Betreiber: "checke nochmal ob du alle Möglichkeiten ausgeschöpft hast, den
// QR-Code zu verkleinern, der enthielt teilweise zu viele Informationen und konnte nicht
// richtig gelesen werden"):
//
// Bisher stand jede Stückelung als eigenes JSON-Schlüssel/Wert-Paar im Code
// ({"100":2,"50":3,"20":5,...}) - bei einer realistischen Übergabe mit allen 13 Werten macht
// allein das rund 90 Zeichen aus, GRÖSSTENTEILS Wiederholung derselben, immer gleichen
// Zahlenwerte als Schlüssel. Da die Reihenfolge der Stückelungen im ganzen System ohnehin
// FEST ist (dieselbe Liste wie an der Kasse, im Manager und im Money Butler - siehe DENOMS/
// notes+coins dort), genügt es, nur die ANZAHLEN in dieser bekannten Reihenfolge zu
// übertragen - die Zuordnung "welche Zahl gehört zu welcher Stückelung" ergibt sich beim
// Empfänger allein aus der Position. Das spart bei einer vollen Stückelung gut 60-90 Zeichen,
// ohne dass eine einzige Information verloren geht.
//
// RÜCKWÄRTS-KOMPATIBEL: ändert NICHTS an bereits erzeugten/gedruckten Codes - die tragen eine
// ältere version-Nummer und werden weiterhin im alten, ausführlichen Format gelesen (siehe
// entpackeLoose/entpackeRollen: beide geben ein leeres Ergebnis zurück, wenn der Eingabewert
// gar kein Array ist - der aufrufende Code fällt dann automatisch auf das Feld
// looseBreakdown/coinRolls selbst zurück, das im alten Format weiterhin ein normales Objekt
// ist).
(function (global) {
  'use strict';

  // Dieselbe Reihenfolge wie DENOMS in money-butler/app.js und die Scheine/Münzen-Listen an
  // der Kasse. NICHT verändern, ohne alle drei Stellen gemeinsam anzupassen - die Position in
  // dieser Liste IST die Information, nicht nur eine Lesehilfe.
  const REIHENFOLGE_LOSE = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01];
  // Nur Münzen gibt es als Rolle - dieselbe Reihenfolge wie MUENZEN_JE_ROLLE an der Kasse.
  const REIHENFOLGE_ROLLEN = [2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01];

  function packeLoose(breakdown) {
    return REIHENFOLGE_LOSE.map((wert) => Number(breakdown && breakdown[wert]) || 0);
  }
  function entpackeLoose(arr) {
    const ergebnis = {};
    if (!Array.isArray(arr)) return ergebnis;
    REIHENFOLGE_LOSE.forEach((wert, i) => { if (arr[i]) ergebnis[wert] = arr[i]; });
    return ergebnis;
  }
  function packeRollen(coinRolls) {
    return REIHENFOLGE_ROLLEN.map((wert) => Number(coinRolls && coinRolls[wert] && coinRolls[wert].rolls) || 0);
  }
  // Gibt dieselbe Form zurück, die der bisherige Code an mehreren Stellen erwartet
  // (coinRolls[wert] = {rolls, coinsPerRoll, ...}) - MUENZEN_JE_ROLLE liefert coinsPerRoll.
  function entpackeRollen(arr, muenzenJeRolle) {
    const ergebnis = {};
    if (!Array.isArray(arr)) return ergebnis;
    REIHENFOLGE_ROLLEN.forEach((wert, i) => {
      const rolls = arr[i];
      if (!rolls) return;
      const coinsPerRoll = (muenzenJeRolle && muenzenJeRolle[wert]) || 0;
      const coinCount = rolls * coinsPerRoll, valuePerRoll = wert * coinsPerRoll, total = rolls * valuePerRoll;
      ergebnis[wert] = { rolls, coinsPerRoll, coinCount, valuePerRoll: +valuePerRoll.toFixed(2), total: +total.toFixed(2) };
    });
    return ergebnis;
  }

  global.KCCashDenoms = { REIHENFOLGE_LOSE, REIHENFOLGE_ROLLEN, packeLoose, entpackeLoose, packeRollen, entpackeRollen };
})(typeof window !== 'undefined' ? window : globalThis);
