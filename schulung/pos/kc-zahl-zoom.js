// Vergrößerte Zahlabwicklung - NUR beim Herausgeben von Rückgeld.
//
// WOZU: Der Bediener tippt den gegebenen Betrag über Scheine und Münzen ein. Genau dort
// passieren die Fehler - 10 ct und 20 ct sehen sich auf kleinen Knöpfen ähnlich, und was
// danebengetippt wird, fehlt am Abend in der Kasse. Deshalb werden für diesen Moment die
// Geldknöpfe, der Rückgeldbetrag und der Warenkorb groß.
//
// AUSDRÜCKLICH KEINE ANDERE ANSICHT: Die gewählte Anordnung (Normal/Schmal/Linkshändig)
// bleibt darunter unverändert und ist danach sofort wieder da. Es wird nur vergrößert.
//
// WARUM MIT VERZÖGERUNG: Wer eine 2-Euro-Münze antippt und direkt danach auf Trinkgeld geht,
// zählt kein Geld ab - da darf nichts aufspringen und sofort wieder zuklappen. Deshalb wird
// nach dem ersten Antippen kurz abgewartet. Kommt gleich die nächste Handlung, passiert nichts.
// Der Preis dafür: der allererste Schein wird noch auf den normalen Knöpfen getippt. Das ist
// bewusst so - ein Zucken bei jedem Trinkgeld wäre schlimmer.
//
// Die Artikeltasten verschwinden solange: wer beim Geldzählen danebentippt, hat sonst gleich
// den nächsten Artikel im Korb.
(function (global) {
  'use strict';

  const KLASSE = 'kc-zahl-zoom';
  const WARTEZEIT_MS = 1000;
  let zeitgeber = null;

  const aktiv = () => document.body.classList.contains(KLASSE);

  function oeffne() {
    if (aktiv()) return;
    document.body.classList.add(KLASSE);
  }
  function schliesse() {
    clearTimeout(zeitgeber);
    zeitgeber = null;
    document.body.classList.remove(KLASSE);
  }

  // Nach einer Geldeingabe: abwarten, ob wirklich weitergezählt wird.
  // BEFUND aus dem Durchlauf: hier wurde der Zustand der Kasse über window.state gelesen -
  // den gibt es dort aber nicht. `state` ist in app.js mit const angelegt und hängt nicht am
  // Fenster. Die Prüfung schlug deshalb immer fehl und es ging NIE auf. Der Aufrufer gibt die
  // zwei Angaben jetzt einfach mit; raten muss hier niemand.
  function nachGeldeingabe(stand) {
    if (aktiv()) return;                       // schon offen - nichts zu tun
    clearTimeout(zeitgeber);
    zeitgeber = setTimeout(() => {
      // Nur öffnen, wenn immer noch Geld im Spiel ist und der Bon nicht schon abgeschlossen
      // wurde. Sonst geht es genau in dem Moment auf, in dem der Verkauf endet.
      if (!stand || !stand.positionen || !(toCentsSicher(stand.gegeben) > 0)) return;
      oeffne();
    }, WARTEZEIT_MS);
  }

  // Jede andere Handlung bricht das Aufgehen ab - Trinkgeld, Abschließen, Rabatt, Storno.
  function abbrechen() {
    clearTimeout(zeitgeber);
    zeitgeber = null;
  }

  function toCentsSicher(wert) {
    return Math.round(Number(wert || 0) * 100);
  }

  global.KCZahlZoom = {oeffne, schliesse, nachGeldeingabe, abbrechen, aktiv};

  function verdrahten() {
    // Andere Knöpfe im Zahlbereich brechen das Aufgehen ab.
    ['tipBtn', 'exactCashBtn', 'roundUpBtn', 'payBtn', 'discountBtn', 'staffBtn', 'cardBtn']
      .forEach((id) => document.getElementById(id)?.addEventListener('click', abbrechen, {capture: true}));
    // Nach dem Abschluss sofort zu - ohne dass jemand etwas schließen muss.
    document.addEventListener('kc:sale-completed', schliesse);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verdrahten);
  else verdrahten();
})(window);
