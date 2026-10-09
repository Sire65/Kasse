// 09.10.2026 (Betreiber): Reklamation mit Warengruppen und Bildkacheln wie auf der Kassenseite, Antippen zaehlt
// Stueck, "+ Rum" / "+ Amaretto", mehrere Artikel in einem Vorgang. Im Browser durchgespielt (Kasse und Schulung):
// 2 x Gluehwein rot + 1 x Gluehwein rot mit Rum, Kalt, Auszahlung -> Minus-Zeilen 7,00 + 4,50 = 11,50 €,
// erwarteter Bestand -11,50 €; Ersatz 2 x Gruenkohl+Mettwurst -> 0-€-Bon mit Menge 2.
const fs = require('fs'), assert = require('assert');
for (const pfad of ['pos/kc-reklamation.js', 'schulung/pos/kc-reklamation.js']) {
  const s = fs.readFileSync(pfad, 'utf8');
  assert(s.includes("version: '0.2.0'"), pfad + ': Version');
  assert(s.includes('class="kc-rek-k-bild"><img src="${esc(bild(p))}"'), pfad + ': Bildkacheln fehlen');
  assert(s.includes('data-rek-plus="${esc(p.id)}|${esc(c.id)}"'), pfad + ': Schuss-Knoepfe fehlen');
  assert(s.includes('kc-rek-k-zahl'), pfad + ': Zaehler auf der Kachel fehlt');
  assert(s.includes("p.category !== 'Pfand'") && s.includes('!p.isFreieZahlung'), pfad + ': Pfand/freie Betraege nicht ausgeblendet');
  assert(s.includes('await kcReklamationBuchenPosten('), pfad + ': bucht nicht mehrere Posten');
}
for (const pfad of ['pos/app.js', 'schulung/pos/app.js']) {
  const s = fs.readFileSync(pfad, 'utf8');
  assert(s.includes('async function kcReklamationBuchenPosten(posten,grund,ergebnis,bonReferenz){'), pfad + ': Buchung fehlt');
  assert(s.includes('async function kcReklamationBuchen(produktId,grund,ergebnis,bonReferenz){'), pfad + ': alter Weg entfernt');
  assert(s.includes('price:-Math.abs(preis),category:"Reklamation"') && s.includes(',qty,option:null,deposits:[],refund:true,lockedQuantity:true'), pfad + ': Auszahlung ohne Menge');
  assert(s.includes('amount:0,amountCents:0,erstattungImBon:+betrag.toFixed(2),reason:"Reklamation"'), pfad + ': Bargeld doppelt');
}
for (const pfad of ['pos/index.html', 'schulung/pos/index.html', 'pos/service-worker.js', 'schulung/pos/service-worker.js']) {
  const s = fs.readFileSync(pfad, 'utf8');
  assert(s.includes('kc-reklamation.js?build=0.2.0') && s.includes('app.js?build=0.31.3.6-r59'), pfad + ': Build fehlt');
}
console.log('reklamation-mehrere-artikel: ok');
