/* Pfandzeilen in den Vorführdaten nachtragen - einmalig ausführbares Werkzeug.
 *
 * BEFUND vom 31.08.2026
 * In beiden Vorführdatensätzen war die BONSUMME um den Pfand höher als die Summe der
 * einzelnen Positionen, ohne dass eine Pfandzeile dagestanden hätte:
 *      Kasse:   Bons 28.375,00 €   Positionen 21.905,00 €   Lücke 6.470,00 €
 *      Manager: Bons 107.750,00 €  Positionen 83.332,00 €   Lücke 24.418,00 €
 * Die Kasse rechnet den Pfand nämlich automatisch auf den Bon, und der Ersteller der
 * Vorführdaten hat den Aufschlag in "total" übernommen, aber keine Zeile dafür geschrieben.
 *
 * Warum das vor einer Vorführung zählt: die Auswertungen im PC-Manager rechnen mit den
 * POSITIONEN (Preis x Menge), der Kassenabschluss dagegen mit der BONSUMME. Beides stand
 * damit unterschiedlich im Raum, ohne dass man die Differenz hätte erklären können. Genau
 * so etwas fällt auf, wenn jemand im Publikum nachrechnet - und der Vorwurf wäre dann,
 * dass "das Programm falsch rechnet", obwohl nur die Vorführdaten unvollständig waren.
 *
 * WAS ES TUT
 * Es prüft je Bon, wie gross die Lücke ist, und trägt genau die Pfandzeilen nach, die sie
 * erklären - nach derselben Regel, die die Kasse selbst anwendet (Glaspfand 2,00 € je
 * Getränk im Glas, Feuerzangenpfand zusätzlich 2,00 € bei der Feuerzangenbowle).
 * Bons, deren Lücke sich damit NICHT erklären lässt, werden gemeldet und nicht angefasst.
 *
 * AUSFÜHREN:  node pc-manager/vorfuehrung/erzeuge-pfandzeilen.cjs
 */
const fs = require('fs');
const path = require('path');

const DATEIEN = [
  path.resolve(__dirname, '../../pos/vorfuehrung/daten.json'),
  path.resolve(__dirname, 'daten.json'),
];

// Pfand je Artikel - identisch zu den Artikelstammdaten der Kasse (pos/app.js).
// Die Artikelnummern sind die ECHTEN aus den Stammdaten (glasplus / zangeplus). Mit einer
// erfundenen Nummer findet die Auswertung den Artikel nicht und schreibt den Umsatz unter
// "Sonstiges" statt unter "Pfand" - genau das ist am 01.09.2026 passiert.
const GLAS = {id: 'glasplus', name: 'Glaspfand', preis: 2};
const ZANGE = {id: 'zangeplus', name: 'Feuerzangenpfand', preis: 2};
const PFAND = {
  grot:   [GLAS],
  gweiss: [GLAS],
  apfel:  [GLAS],
  eier:   [GLAS],
  feuer:  [GLAS, ZANGE],
};
const cent = (n) => Math.round(n * 100) / 100;

for (const datei of DATEIEN) {
  const bons = JSON.parse(fs.readFileSync(datei, 'utf8'));
  let ergaenzt = 0, zeilen = 0, ungeklaert = 0, betrag = 0;

  for (const bon of bons) {
    const positionen = bon.items || [];
    if (positionen.some((p) => /pfand/i.test(p.name || ''))) continue;      // schon vorhanden
    const summe = cent(positionen.reduce((s, p) => s + Number(p.price) * Number(p.qty), 0));
    const luecke = cent(Number(bon.total || 0) - summe);
    if (luecke <= 0) continue;

    // Aus den verkauften Artikeln ergibt sich, welcher Pfand anfallen MUSS.
    const gesammelt = new Map();
    for (const p of positionen) {
      for (const pf of (PFAND[p.id] || [])) {
        const e = gesammelt.get(pf.name) || {id: pf.id, name: pf.name, preis: pf.preis, menge: 0};
        e.menge += Number(p.qty);
        gesammelt.set(pf.name, e);
      }
    }
    const erwartet = cent([...gesammelt.values()].reduce((s, e) => s + e.preis * e.menge, 0));
    if (erwartet !== luecke) { ungeklaert++; continue; }                    // nicht raten

    for (const e of gesammelt.values()) {
      positionen.push({id: e.id, name: e.name, category: 'Pfand', price: e.preis, qty: e.menge});
      zeilen++; betrag = cent(betrag + e.preis * e.menge);
    }
    bon.items = positionen;
    ergaenzt++;
  }

  fs.writeFileSync(datei, JSON.stringify(bons));
  const bonSumme = cent(bons.reduce((s, b) => s + Number(b.total || 0), 0));
  const posSumme = cent(bons.reduce((s, b) => s + (b.items || []).reduce((t, p) => t + p.price * p.qty, 0), 0));
  console.log(path.basename(path.dirname(datei)).padEnd(12)
    + ` Bons ergänzt: ${String(ergaenzt).padStart(5)}   Pfandzeilen: ${String(zeilen).padStart(5)}`
    + `   Pfand gesamt: ${betrag.toFixed(2)} EUR   ungeklärt: ${ungeklaert}`);
  console.log('             Probe:  Bonsummen ' + bonSumme.toFixed(2) + '  =  Positionssummen ' + posSumme.toFixed(2)
    + (bonSumme === posSumme ? '   -> stimmt überein' : '   -> WEICHT AB um ' + cent(bonSumme - posSumme).toFixed(2)));
}
