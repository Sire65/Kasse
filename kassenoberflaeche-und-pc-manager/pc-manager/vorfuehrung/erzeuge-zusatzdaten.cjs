/* Vorführdaten anreichern - einmalig ausführbares Werkzeug, kein Teil des laufenden Programms.
 *
 * WARUM
 * Die Vorführdaten enthielten 6.395 Bons über zwölf Markttage, aber alles auf EINER Kasse und
 * ohne Trinkgeld, ohne Tagesabschlüsse, ohne Bargeldbewegungen. In einer Vorführung fällt das
 * auf: im Kopf steht "Kassen: 2", in der Auswertung steht "aktive Kassen: 1", die
 * Trinkgeld-Kennzahl bleibt auf 0,00 € und der Kassenabschluss ist leer.
 *
 * WAS ES TUT
 *  - verteilt die Bons auf Kasse 1 und Kasse 2 (fest nach Bonnummer, also bei jedem Lauf gleich)
 *  - leitet daraus Trinkgelder, Tagesabschlüsse und Bargeldbewegungen ab
 *  - die Summen werden AUS DEN BONS gerechnet, nicht erfunden - sonst geht beim Nachrechnen
 *    in der Vorführung etwas nicht auf, und genau das würde jemand bemerken
 *
 * AUSFÜHREN:  node pc-manager/vorfuehrung/erzeuge-zusatzdaten.cjs
 */
const fs = require('fs');
const path = require('path');

const ORDNER = __dirname;
const SALES = path.join(ORDNER, 'daten.json');
const ZUSATZ = path.join(ORDNER, 'zusatz.json');

// Fester Zufallsgeber: derselbe Bon bekommt immer dasselbe Ergebnis.
const streuung = (text) => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const cent = (n) => Math.round(n * 100) / 100;
const tagVon = (zeile) => String(zeile.time || '').slice(0, 10);

const bons = JSON.parse(fs.readFileSync(SALES, 'utf8'));
if (!Array.isArray(bons) || !bons.length) { console.error('Keine Bons gefunden.'); process.exit(1); }

// --- 1. Auf zwei Kassen verteilen -------------------------------------------------------
// Rund 40 % gehen auf Kasse 2. Ein Bon bleibt dabei immer ganz auf einer Kasse.
let aufZwei = 0;
for (const b of bons) {
  const zweite = streuung(String(b.bon) + tagVon(b)) < 0.4;
  b.registerId = zweite ? 'KASSE-02' : 'KASSE-01';
  b.registerName = zweite ? 'Kasse 2' : 'Kasse 1';
  if (zweite) aufZwei++;
}

// --- 2. Trinkgeld ------------------------------------------------------------------------
// Etwa jeder achte Bon wird aufgerundet. Beträge zwischen 10 und 90 Cent.
const trinkgelder = [];
for (const b of bons) {
  const w = streuung('tip' + b.bon + b.registerId);
  if (w >= 0.125) continue;
  const betrag = cent(0.1 + Math.floor(streuung('betrag' + b.bon) * 9) * 0.1);
  trinkgelder.push({
    registerId: b.registerId, registerName: b.registerName, operator: b.operator,
    bonNumber: b.bon, time: b.time, amount: betrag, source: 'aufrunden', vorfuehrung: true,
  });
}

// --- 3. Tagesabschlüsse und Bargeldbewegungen --------------------------------------------
// Je Markttag und Kasse einer. Die Zahlen stammen aus den Bons desselben Tages.
const jeTagKasse = new Map();
for (const b of bons) {
  const schluessel = `${tagVon(b)}|${b.registerId}`;
  if (!jeTagKasse.has(schluessel)) jeTagKasse.set(schluessel, {tag: tagVon(b), kasse: b.registerId, name: b.registerName, umsatz: 0, bons: 0, letzte: b.time});
  const e = jeTagKasse.get(schluessel);
  e.umsatz += Number(b.total || 0);
  e.bons++;
  if (b.time > e.letzte) e.letzte = b.time;
}
const abschluesse = [], bewegungen = [];
for (const [, e] of jeTagKasse) {
  const trinkgeld = cent(trinkgelder.filter((t) => t.registerId === e.kasse && String(t.time).slice(0, 10) === e.tag).reduce((s, t) => s + t.amount, 0));
  const anfang = e.kasse === 'KASSE-01' ? 200 : 150;                 // Wechselgeld aus der Kassette
  const auszahlung = cent(Math.floor(streuung('aus' + e.tag + e.kasse) * 40));
  bewegungen.push({
    transferId: `VF-${e.tag}-${e.kasse}`, registerId: e.kasse, registerName: e.name,
    type: 'opening', effectiveDate: e.tag, time: `${e.tag}T15:30:00.000Z`,
    total: anfang, looseTotal: anfang, rollTotal: 0, note: 'Vorführdaten', vorfuehrung: true,
  });
  abschluesse.push({
    closingId: `VF-ABSCHLUSS-${e.kasse}-${e.tag}`, format: 'KC_CASH_CLOSING', version: 3,
    registerId: e.kasse, registerName: e.name, operator: 'Team',
    createdAt: e.letzte, effectiveDate: e.tag,
    cashIn: anfang, cashSales: cent(e.umsatz), cashTips: trinkgeld, cashOut: auszahlung,
    expectedCash: cent(anfang + e.umsatz + trinkgeld - auszahlung),
    bonCount: e.bons, staffTotal: 0, staffCount: 0, note: 'Vorführdaten', vorfuehrung: true,
  });
}

fs.writeFileSync(SALES, JSON.stringify(bons));
fs.writeFileSync(ZUSATZ, JSON.stringify({trinkgelder, abschluesse, bewegungen}));

const summe = cent(bons.reduce((s, b) => s + Number(b.total || 0), 0));
console.log(`Bons:            ${bons.length}  (davon ${aufZwei} auf Kasse 2)`);
console.log(`Markttage:       ${new Set(bons.map(tagVon)).size}`);
console.log(`Umsatz gesamt:   ${summe.toLocaleString('de-DE', {style: 'currency', currency: 'EUR'})}`);
console.log(`Trinkgelder:     ${trinkgelder.length}  (${cent(trinkgelder.reduce((s, t) => s + t.amount, 0)).toFixed(2)} EUR)`);
console.log(`Tagesabschluss:  ${abschluesse.length}`);
console.log(`Bargeldbewegung: ${bewegungen.length}`);
