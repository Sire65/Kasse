// 08.10.2026 (Betreiber: "Teilzahlung mit einbauen"): deckt das Gutschein-Guthaben den Bon nicht,
// wird es als feste Minus-Zeile angerechnet; der Rest wird normal kassiert, das Guthaben erst beim
// Abschluss abgezogen. Umsatz = ganzer Bon, Bargeld = nur der Rest.
// Im Browser durchgespielt (Kasse und Schulung): 18,00 € Bon, 3,50 € Gutschein -> 14,50 € bar,
// Guthaben 0, Abschluss-Umsatz 18,00 €, Bargeld 14,50 €; Zeile loeschen -> Guthaben bleibt;
// Gutschein hoeher als Bon -> Abschluss verweigert; zwei Gutscheine nacheinander.
const fs = require('fs'), assert = require('assert');
for (const pfad of ['pos/app.js', 'schulung/pos/app.js']) {
  const s = fs.readFileSync(pfad, 'utf8');
  for (const f of ['function gutscheinZeile(x){', 'function kcGutscheinImBon(code){', 'function kcGutscheinAnrechnen(code,betrag){', 'function kcGutscheinZeilenPruefen(type){'])
    assert(s.includes(f), pfad + ': ' + f + ' fehlt');
  assert(s.includes('lockedQuantity:true,voucherCredit:{code:String(code)}'), pfad + ': Gutscheinzeile nicht mengenfest');
  const cs = s.slice(s.indexOf('async function completeSale('));
  assert(/if\(!state\.cart\.length\)return keinBonMeldung\(\);\n  \{const gsFehler=kcGutscheinZeilenPruefen\(type\)/.test(cs), pfad + ': Pruefung vor dem Abschluss fehlt');
  const iVermerk = cs.indexOf('rec.voucherPayments=gs.map'), iHash = cs.indexOf('rec.recordHash=await sha256Hex'), iAbbuch = cs.indexOf('window.KCGutschein.einloesen(v.code,v.amount');
  assert(iVermerk > 0 && iVermerk < iHash && iHash < iAbbuch, pfad + ': Vermerk vor Hash, Abbuchung nach dem Speichern');
  assert(cs.slice(iAbbuch - 120, iAbbuch).includes('if(!training&&rec.voucherPayments'), pfad + ': Training darf kein Guthaben verbrauchen');
  assert(s.includes('+(t.voucherPayments||[]).reduce((s,v)=>s+Number(v.amount||0),0)'), pfad + ': Gutschein-Anteil fehlt im Umsatz');
  for (const f of ['function applyQuickQuantity(q){', 'function applyQuantity(q){']) { const i = s.indexOf(f); assert(i > 0 && s.slice(i, i + 220).includes('gutscheinZeile(item)'), pfad + ': ' + f + ' nicht gesperrt'); }
}
for (const pfad of ['pos/kc-gutschein.js', 'schulung/pos/kc-gutschein.js']) {
  const s = fs.readFileSync(pfad, 'utf8');
  assert(!s.includes('Teilzahlung ist noch nicht eingebaut'), pfad + ': alte Sperre noch drin');
  assert(s.includes('global.kcGutscheinAnrechnen(g.code, g.balance)'), pfad + ': Teilzahlung nicht angebunden');
  assert(s.includes("global.kcGutscheinImBon(g.code) > 0"), pfad + ': doppelte Verwendung nicht verhindert');
}
for (const pfad of ['pos/index.html', 'schulung/pos/index.html', 'pos/service-worker.js', 'schulung/pos/service-worker.js']) {
  const s = fs.readFileSync(pfad, 'utf8');
  assert(s.includes('app.js?build=0.31.3.6-r60') && s.includes('kc-gutschein.js?build=0.2.2'), pfad + ': Build r60 / Gutschein 0.2.2 fehlt');
}
console.log('gutschein-teilzahlung: ok');
