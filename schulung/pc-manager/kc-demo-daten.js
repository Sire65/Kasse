// Demodaten für den PC-Manager: erzeugte Umsätze, damit Auswertungen und Grafiken etwas zeigen.
//
// ZWECK (User): "Ich muss Daten drin haben, damit die Auswertungen und Grafiken auch Werte
// anzeigen" - ausdrücklich ohne Einlesen einer Datei, und hinterher wieder löschbar.
//
// WICHTIG - das hier sind ERFUNDENE Zahlen in einem Kassensystem. Damit sie niemals mit echtem
// Umsatz verwechselt oder versehentlich mitgezählt werden können, gilt:
//   1. JEDER erzeugte Datensatz trägt die Markierung demo:true und eine eigene Herkunft.
//   2. Entfernt wird genau daran - es kann also kein echter Datensatz mitgelöscht werden.
//   3. Solange Demodaten vorhanden sind, steht ein deutlich sichtbarer Hinweis im Dashboard.
//   4. Nichts davon wird an den Manager-Dienst oder in die Cloud gemeldet; es bleibt in der
//      Ablage dieses Rechners.
(function (global) {
  'use strict';

  const MARKE = 'demo';                 // Feldname auf jedem erzeugten Datensatz
  const HERKUNFT = 'demodaten';         // zusätzlich als Quelle hinterlegt
  const TAGE = 4;                       // so viele Markttage werden erzeugt
  const el = (id) => document.getElementById(id);

  // Ein fester Zufallsgeber: dieselbe Eingabe ergibt dieselben Zahlen. Dadurch sehen die
  // Auswertungen bei jedem Erzeugen gleich aus - man vergleicht sonst Äpfel mit Birnen.
  function zufall(saat) {
    let z = saat >>> 0;
    return () => {
      z = (z * 1664525 + 1013904223) >>> 0;
      return z / 4294967296;
    };
  }
  const ausListe = (liste, w) => liste[Math.floor(w() * liste.length)];
  const zwischen = (w, min, max) => min + Math.floor(w() * (max - min + 1));

  function tagAlsText(datum) {
    return `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}-${String(datum.getDate()).padStart(2, '0')}`;
  }

  // --- Erzeugen --------------------------------------------------------------------------
  // Gearbeitet wird mit den ECHTEN Warengruppen, Artikeln, Kassen und Bedienern aus diesem
  // Manager - erfundene Artikelnamen würden in den Auswertungen sofort auffallen und die
  // Warengruppen-Grafik bliebe leer.
  function erzeuge(bestand) {
    const w = zufall(20261128);
    const artikel = (bestand.articles || []).filter((a) => Number(a.price) > 0);
    if (!artikel.length) return {fehler: 'Es sind keine Artikel mit Preis angelegt - ohne Artikel lassen sich keine Umsätze erzeugen.'};
    const kassen = (bestand.registers || []).filter((r) => r.active !== false);
    const zielKassen = kassen.length ? kassen : [{id: 'KASSE-01', name: 'Kasse 1'}, {id: 'KASSE-02', name: 'Kasse 2'}];
    const bediener = (bestand.operators || []).filter(Boolean);
    const zielBediener = bediener.length ? bediener : ['Team'];
    const zahlarten = ['cash', 'cash', 'cash', 'cash', 'cash-exact', 'card', 'voucher'];

    const verkaeufe = [], trinkgelder = [], abschluesse = [], bewegungen = [];
    let bonNummer = 1;

    for (let t = TAGE - 1; t >= 0; t--) {
      const tag = new Date();
      tag.setDate(tag.getDate() - t);
      const datum = tagAlsText(tag);

      zielKassen.forEach((kasse, kassenIndex) => {
        // Anfangsbestand des Tages - damit auch die Bargeldbewegungen etwas zeigen.
        const anfang = 180 + kassenIndex * 30;
        bewegungen.push({
          [MARKE]: true, source: HERKUNFT,
          transferId: `DEMO-${datum}-${kasse.id}`,
          registerId: kasse.id, registerName: kasse.name,
          type: 'opening', effectiveDate: datum,
          time: new Date(tag.getFullYear(), tag.getMonth(), tag.getDate(), 16, 30).toISOString(),
          total: anfang, looseTotal: anfang, rollTotal: 0, note: 'Demodaten',
        });

        // Der Abend läuft nicht gleichmäßig: gegen 19 Uhr ist am meisten los. Ohne diesen
        // Verlauf wäre die Grafik "Umsatz nach Uhrzeit" eine langweilige gerade Linie.
        const gewichtProStunde = {16: 0.4, 17: 0.8, 18: 1.3, 19: 1.6, 20: 1.2, 21: 0.7};
        let tagesUmsatz = 0, tagesTrinkgeld = 0;

        Object.entries(gewichtProStunde).forEach(([stunde, gewicht]) => {
          const bons = Math.max(1, Math.round(zwischen(w, 6, 11) * gewicht));
          for (let b = 0; b < bons; b++) {
            const zeit = new Date(tag.getFullYear(), tag.getMonth(), tag.getDate(),
              Number(stunde), zwischen(w, 0, 59), zwischen(w, 0, 59));
            const anzahlPositionen = zwischen(w, 1, 3);
            const positionen = [];
            for (let i = 0; i < anzahlPositionen; i++) {
              const a = ausListe(artikel, w);
              positionen.push({id: a.id, name: a.name, qty: zwischen(w, 1, 3), price: Number(a.price)});
            }
            const summe = positionen.reduce((s, p) => s + p.qty * p.price, 0);
            tagesUmsatz += summe;
            const zahlart = ausListe(zahlarten, w);
            const bediener1 = ausListe(zielBediener, w);
            verkaeufe.push({
              [MARKE]: true, source: HERKUNFT,
              transactionId: `DEMO-${kasse.id}-${datum}-${bonNummer}`,
              bon: String(bonNummer).padStart(6, '0'),
              registerId: kasse.id, registerName: kasse.name,
              operator: bediener1, method: zahlart, payment: zahlart,
              time: zeit.toISOString(), items: positionen, total: +summe.toFixed(2),
            });
            // Etwa jeder achte Bon wird aufgerundet - so ist die Trinkgeld-Kennzahl nicht null.
            if (w() < 0.12) {
              const betrag = +(zwischen(w, 10, 90) / 100).toFixed(2);
              tagesTrinkgeld += betrag;
              trinkgelder.push({
                [MARKE]: true, source: HERKUNFT,
                registerId: kasse.id, registerName: kasse.name, operator: bediener1,
                bonNumber: String(bonNummer).padStart(6, '0'),
                time: zeit.toISOString(), amount: betrag, source2: 'aufrunden',
              });
            }
            bonNummer++;
          }
        });

        const auszahlungen = +(zwischen(w, 0, 40)).toFixed(2);
        abschluesse.push({
          [MARKE]: true, source: HERKUNFT,
          closingId: `DEMO-ABSCHLUSS-${kasse.id}-${datum}`,
          format: 'KC_CASH_CLOSING', version: 3,
          registerId: kasse.id, registerName: kasse.name, operator: ausListe(zielBediener, w),
          createdAt: new Date(tag.getFullYear(), tag.getMonth(), tag.getDate(), 21, 40).toISOString(),
          cashIn: anfang, cashSales: +tagesUmsatz.toFixed(2), cashTips: +tagesTrinkgeld.toFixed(2),
          cashOut: auszahlungen,
          expectedCash: +(anfang + tagesUmsatz + tagesTrinkgeld - auszahlungen).toFixed(2),
          staffTotal: 0, staffCount: 0, note: 'Demodaten',
        });
      });
    }
    return {verkaeufe, trinkgelder, abschluesse, bewegungen};
  }

  // --- Zählen und Entfernen ---------------------------------------------------------------
  const istDemo = (x) => !!(x && x[MARKE]);
  function zaehle(bestand) {
    return {
      verkaeufe: (bestand.sales || []).filter(istDemo).length,
      trinkgelder: (bestand.tips || []).filter(istDemo).length,
      abschluesse: (bestand.closings || []).filter(istDemo).length,
      bewegungen: (bestand.cashMovements || []).filter(istDemo).length,
    };
  }
  const vorhanden = (bestand) => Object.values(zaehle(bestand)).some((n) => n > 0);

  // --- Hinweis im Dashboard ---------------------------------------------------------------
  // Solange erfundene Zahlen in den Auswertungen stecken, muss das unübersehbar sein.
  function zeigeHinweis(bestand) {
    let balken = el('kcDemoHinweis');
    if (!vorhanden(bestand)) { if (balken) balken.remove(); return; }
    if (!balken) {
      balken = document.createElement('p');
      balken.id = 'kcDemoHinweis';
      balken.className = 'kc-demo-hinweis';
      const ziel = document.querySelector('[data-view-panel="dashboard"] .kpis');
      if (ziel && ziel.parentNode) ziel.parentNode.insertBefore(balken, ziel);
    }
    const z = zaehle(bestand);
    balken.innerHTML = `<strong>Achtung: Demodaten aktiv.</strong> Die Auswertungen enthalten `
      + `${z.verkaeufe} erfundene Verkäufe, ${z.abschluesse} Tagesabschlüsse und ${z.bewegungen} Bargeldbewegungen. `
      + `Das sind KEINE echten Umsätze. Vor dem Markttag über „Demodaten entfernen" wieder herausnehmen.`;
  }

  global.KCDemoDaten = {erzeuge, zaehle, vorhanden, istDemo, zeigeHinweis, MARKE, HERKUNFT, TAGE};
})(window);
