/* KC Artikelnummern - EINE Quelle fuer Kasse, PC-Manager und Etikettendruck.
 *
 * WARUM DIESE DATEI EXISTIERT
 * Die Artikelnummer steht sonst an drei Stellen: im Artikelstamm der Kasse, im
 * Artikelstamm des Managers und auf dem gedruckten Etikett. Drei Stellen heisst
 * frueher oder spaeter drei verschiedene Nummern - und dann liegt am Stand ein
 * Etikett, das die Kasse nicht kennt. Deshalb steht die Tabelle genau hier, und
 * beide Programme lesen sie beim Start.
 *
 * AUFBAU DER NUMMER  ->  5 Ziffern:  GG NNN
 *   GG   = Warengruppe (01 Getraenke, 02 Speisen, 03 Pfand, 04 Sonstiges,
 *          05 Kombi, 09 Happy Hour)
 *   NNN  = laufende Nummer innerhalb der Warengruppe
 *          001-099 = normaler Artikel
 *          101-199 = Rueckgabe / negativer Betrag (nur Warengruppe Pfand)
 *
 * NUR ZIFFERN, KEINE BUCHSTABEN. Grund: der Zahlenblock der Kasse sucht ueber
 * String(...).replace(/\D/g,"") - eine Nummer mit Buchstaben waere dort nicht
 * eingebbar. So laesst sich jeder Artikel auf drei Wegen aufrufen:
 *   1. QR-Etikett scannen        2. Zahlenblock -> ART        3. Suchfeld
 *
 * Die Artikel-ID ("grot", "gruenkohlmett", ...) bleibt unveraeltert. Sie ist der
 * technische Schluessel und haengt in Bons, Auswertungen und Bildern; sie wird
 * NICHT durch die Nummer ersetzt. Die Nummer steht im Feld "barcode", das in
 * beiden Programmen bereits vorhanden ist.
 */
(function (g) {
  'use strict';
  var VERSION = '1.0.0';

  var WARENGRUPPEN = [
    { code: '01', gruppenId: 'WG01',  name: 'Getränke' },
    { code: '02', gruppenId: 'WG02',  name: 'Speisen' },
    { code: '03', gruppenId: 'WG03',  name: 'Pfand' },
    { code: '04', gruppenId: 'WG04',  name: 'Sonstiges' },
    { code: '05', gruppenId: 'WG05',  name: 'Kombi' },
    { code: '09', gruppenId: 'WG-HH', name: 'Happy Hour' }
  ];

  /* Artikel-ID -> Artikelnummer. Eine Nummer wird NIE wiederverwendet:
     ein geloeschter Artikel gibt seine Nummer nicht frei, sonst zeigt ein altes
     Etikett spaeter auf einen fremden Artikel. */
  var NUMMERN = {
    // ---- 01 Getraenke ----
    grot:                 '01001',
    gweiss:               '01002',
    feuer:                '01003',
    apfel:                '01004',
    roterfeger:           '01005',
    eier:                 '01006',
    // ---- 02 Speisen ----
    sauerkraut:           '02001',
    sauerkrautmett:       '02002',
    gruenkohl:            '02003',
    gruenkohlmett:        '02004',
    mettwurst:            '02005',
    hering:               '02006',
    knirpsecreme:         '02007',
    knirpse:              '02008',   // stillgelegt, Nummer bleibt vergeben
    knirpseher:           '02009',   // stillgelegt, Nummer bleibt vergeben
    // ---- 03 Pfand: Ausgabe 0xx, Rueckgabe 1xx ----
    glasplus:             '03001',
    zangeplus:            '03002',
    glasminus:            '03101',
    zangeminus:           '03102',
    glaszangebundleminus: '03103',
    // ---- 04 Sonstiges ----
    wertmarke:            '04001',
    becher:               '04002',
    // ---- 05 Kombi (Essen + Getraenk zusammen) ----
    'PKG-GK-GR':          '05001',
    'PKG-GK-EI':          '05002',
    // ---- 09 Happy Hour ----
    'hh-grot':            '09001',
    'hh-gweiss':          '09002'
  };

  function fuerArtikel(id) { return NUMMERN[String(id || '')] || ''; }

  /* Kombinationen, die das Programm taeglich neu zusammenstellt, bekommen keine feste Nummer aus
     der Tabelle - sie sind morgen andere. Fuer sie ist der Bereich 05901-05999 reserviert.
     Diese Nummern gehoeren NICHT auf ein gedrucktes Etikett, weil sie nur einen Tag gelten. */
  function tagespackageNummer(laufend) {
    var n = Math.max(1, Math.min(99, Number(laufend) || 1));
    return '059' + String(n).padStart(2, '0');
  }

  function warengruppeZurNummer(nummer) {
    var code = String(nummer || '').slice(0, 2);
    for (var i = 0; i < WARENGRUPPEN.length; i++) if (WARENGRUPPEN[i].code === code) return WARENGRUPPEN[i];
    return null;
  }

  /* Traegt die Nummern in eine Artikelliste ein.
     Eine bereits von Hand vergebene, ABWEICHENDE Nummer wird nicht ueberschrieben -
     wer im Manager bewusst etwas anderes eintraegt, soll es behalten. Gemeldet wird sie. */
  function eintragen(liste) {
    var gesetzt = 0, abweichend = [], ohneNummer = [];
    (liste || []).forEach(function (a) {
      if (!a || !a.id) return;
      var soll = fuerArtikel(a.id);
      var ist = String(a.barcode || '').trim();
      if (!soll) { if (!ist) ohneNummer.push(a.id); return; }
      if (!ist) { a.barcode = soll; gesetzt++; return; }
      if (ist !== soll) abweichend.push({ id: a.id, ist: ist, soll: soll });
    });
    return { gesetzt: gesetzt, abweichend: abweichend, ohneNummer: ohneNummer };
  }

  /* Sucht einen Artikel ueber eine gescannte oder getippte Nummer.
     Erlaubt sind: die reine Nummer ("01001"), die Nummer mit Vorsatz
     ("KCA:01001", wie ihn ein spaeterer Ausweis- oder Bonscanner liefern koennte)
     und die Artikel-ID selbst. */
  function normalisiereCode(code) {
    var s = String(code || '').trim();
    if (/^KCA[:\-]/i.test(s)) s = s.replace(/^KCA[:\-]/i, '').trim();
    return s;
  }
  function findeArtikel(liste, code) {
    var s = normalisiereCode(code);
    if (!s) return null;
    var nurZiffern = s.replace(/\D/g, '');
    var treffer = null;
    (liste || []).forEach(function (a) {
      if (treffer || !a) return;
      var bc = String(a.barcode || '').trim();
      if (bc && (bc === s || (nurZiffern && bc.replace(/\D/g, '') === nurZiffern))) { treffer = a; return; }
      if (String(a.id || '') === s) { treffer = a; return; }
    });
    return treffer;
  }

  g.KCArtikelnummern = {
    VERSION: VERSION,
    WARENGRUPPEN: WARENGRUPPEN,
    NUMMERN: NUMMERN,
    fuerArtikel: fuerArtikel,
    tagespackageNummer: tagespackageNummer,
    warengruppeZurNummer: warengruppeZurNummer,
    eintragen: eintragen,
    normalisiereCode: normalisiereCode,
    findeArtikel: findeArtikel
  };
})(window);
