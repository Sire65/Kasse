// KC MarktKasse – Tastaturlayout-Reparatur für gescannte Codes.
//
// WARUM ES DAS GIBT
// Ein Barcode-Scanner ist eine Tastatur. Er drückt Tasten, er sendet keinen Text. Welcher
// Buchstabe daraus wird, entscheidet das GERÄT. Steht der Scanner ab Werk auf "American
// English Keyboard" (so ist der HW0010 ausgeliefert) und das Tablet auf Deutsch, kommt an der
// Kasse etwas anderes an, als auf dem Etikett steht.
//
// BELEG VOM 01.09.2026, 22:25 UHR (Bildschirmfoto des Betreibers): "Gelesen wurde: ß??".
// Rechts neben der Null liegt auf der amerikanischen Tastatur das Minuszeichen, auf der
// deutschen das ß. Aus "-" wird "ß", aus "_" wird "?". Genau das war zu sehen.
//
// Und es erklärt, warum es NUR TEILWEISE hakte: Artikelnummern sind reine Ziffern, und Ziffern
// liegen auf beiden Layouts gleich - die kamen an. Ausweiscodes enthalten "-", "_", ":" und "|"
// - die kamen als Buchstabensalat an.
//
// WAS DIESE DATEI TUT
// Die Vertauschung ist keine Zufallsstörung, sondern eine feste Tabelle. Sie lässt sich
// zurückrechnen. Trifft ein gescannter Code nichts, wird die Rückrechnung probiert; trifft sie,
// wird der Vorgang NORMAL ausgeführt - und die Kasse sagt einmal dazu, dass der Scanner falsch
// eingestellt ist.
//
// BEWUSSTE ENTSCHEIDUNG, damit das nicht zur Rate-Maschine wird: die Rückrechnung entscheidet
// nie selbst, ob etwas "gemeint" war. Sie liefert nur eine zweite Schreibweise; ob die zu einem
// Artikel oder Bediener gehört, entscheidet weiterhin allein die Kasse mit ihrer eigenen Liste.
// Trifft auch die zweite Schreibweise nichts, bleibt es bei "Code nicht erkannt".
(function (global) {
  'use strict';

  // Was das deutsche Gerät anzeigt  ->  welche Taste der Scanner amerikanisch gemeint hat.
  // Nur Zeichen, die sich zwischen den beiden Layouts tatsaechlich unterscheiden.
  const DE_NACH_US = {
    'ß': '-', '?': '_',
    'ö': ';', 'Ö': ':',
    'ä': "'", 'Ä': '"',
    'ü': '[', 'Ü': '{',
    '+': ']', '*': '}',
    '#': '\\', "'": '|',
    '-': '/', '_': '?',
    'z': 'y', 'Z': 'Y', 'y': 'z', 'Y': 'Z',
    '&': '^', '/': '&', '(': '*', ')': '(', '=': ')',
    '"': '@', '§': '#', ';': '<', ':': '>',
    '´': '=', '`': '+',
  };
  // Die Gegenrichtung: Scanner steht auf Deutsch, Geraet auf Englisch.
  const US_NACH_DE = {};
  for (const [de, us] of Object.entries(DE_NACH_US)) if (!(us in US_NACH_DE)) US_NACH_DE[us] = de;

  function uebersetze(text, tabelle) {
    return String(text == null ? '' : text).split('').map((z) => (z in tabelle ? tabelle[z] : z)).join('');
  }

  // Alle Schreibweisen eines gelesenen Codes, die ernsthaft in Frage kommen - der gelesene
  // selbst zuerst. Die Reihenfolge ist wichtig: was unveraendert passt, gewinnt immer.
  function schreibweisen(code) {
    const roh = String(code == null ? '' : code);
    const liste = [roh];
    const a = uebersetze(roh, DE_NACH_US);
    const b = uebersetze(roh, US_NACH_DE);
    if (a !== roh) liste.push(a);
    if (b !== roh && b !== a) liste.push(b);
    return liste;
  }

  // Sucht mit jeder Schreibweise, bis eine trifft. `finde` ist die Suchfunktion der Kasse -
  // diese Datei kennt weder Artikel noch Bediener und soll sie auch nicht kennen.
  // Rueckgabe: {treffer, code, repariert} - `repariert` heisst: nur die zurueckgerechnete
  // Schreibweise hat gepasst, der Scanner steht also falsch.
  function findeMitReparatur(code, finde) {
    const wege = schreibweisen(code);
    for (let i = 0; i < wege.length; i += 1) {
      let treffer = null;
      try { treffer = finde(wege[i]); } catch (e) { treffer = null; }
      if (treffer) return { treffer, code: wege[i], repariert: i > 0 };
    }
    return { treffer: null, code: wege[0], repariert: false };
  }

  // Sieht ein gelesener Text nach Layout-Schaden aus? Nur fuer die Formulierung der Meldung -
  // eine Vermutung, die als Vermutung auftritt und nie eine Buchung ausloest.
  const VERDAECHTIG = /[ßöÖäÄüÜ§´`]/;
  function riechtNachLayout(code) { return VERDAECHTIG.test(String(code || '')); }

  const HINWEIS = 'Der Scanner sendet amerikanische Tastenbelegung, das Gerät ist deutsch eingestellt. '
    + 'Zu tun: im Scanner-Heft auf Seite 12 den Code „German Keyboard" scannen. '
    + 'Bis dahin rechnet die Kasse es selbst zurück — Ziffern-Codes waren nie betroffen.';

  global.KCTastaturlayout = { schreibweisen, findeMitReparatur, riechtNachLayout, uebersetze,
    DE_NACH_US, US_NACH_DE, HINWEIS };
})(typeof window !== 'undefined' ? window : globalThis);
