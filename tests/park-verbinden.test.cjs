// 07.10.2026 (Betreiber): geparkte Bons markieren, verbinden, lösen und gemeinsam holen
const fs = require('fs'), assert = require('assert');
for (const pfad of ['pos/kc-oberflaechen-anwenden.js', 'schulung/pos/kc-oberflaechen-anwenden.js']) {
  const s = fs.readFileSync(pfad, 'utf8');
  for (const t of ['function verbinden()', 'function loesen()', 'function gruppeHolen(gid, anhaengen)', 'function zeilenZusammen(zeilen)', 'data-aktion="verbinden"', 'data-aktion="loesen"', '⬇ ALLE HOLEN'])
    assert(s.includes(t), pfad + ': fehlt ' + t);
  assert(s.includes("geparkteSchreiben(gruppenBereinigen(liste))"), pfad + ': Einzelholen muss Rest-Gruppe bereinigen');
  // gleiche Positionen werden zusammengelegt, abweichende (halbe Portion, eigener Rabatt) bleiben eigene Zeilen mit eindeutiger Kennung
  const a = s.indexOf('function zeilenZusammen(zeilen)'), b = s.indexOf('\n  }\n', a) + 4;
  const zz = new Function('return ' + s.slice(a, b))();
  const z = (key, qty, extra) => Object.assign({ key, qty, price: 2, portionFactor: 1, option: null }, extra || {});
  const r = zz([z('rum', 2), z('rum', 1), z('ama', 1), z('rum', 1, { price: 1, portionFactor: 0.5 }), z('ama', 1, { positionDiscount: { percent: 10 } })]);
  assert.deepStrictEqual(r.map((x) => [x.key, x.qty]), [['rum', 3], ['ama', 1], ['rum~2', 1], ['ama~2', 1]]);
  // Gesamtzeile: Bons, Positionen (zusammengelegt), Stück, Pfand (automatisch + Pfand-Artikel), Gesamtsumme
  const f0 = s.indexOf('function parkZusammenfassung(bons)'), f1 = s.indexOf('\n  }\n', f0) + 4;
  const zf = new Function('zeilenZusammen', 'state', 'return ' + s.slice(f0, f1))(zz, { master: { depositRule: 'automatic' } });
  const gw = (qty) => z('gw', qty, { price: 4, deposits: [{ price: 2 }] });
  assert.deepStrictEqual(zf([{ summe: 12, cart: [gw(2)] }, { summe: 6, cart: [gw(1)] }, { summe: -2, cart: [z('rueck', 1, { price: -2, category: 'Pfand' })] }]),
    { bons: 3, pos: 2, stueck: 4, pfand: 4, summe: 16 });
  const g = s.indexOf('function gruppenBereinigen(liste)'), h = s.indexOf('\n  }\n', g) + 4;
  const gb = new Function('return ' + s.slice(g, h))();
  assert.deepStrictEqual(gb([{ id: 1, gruppe: 'g1' }, { id: 2 }]).map((x) => x.gruppe), [undefined, undefined], 'Gruppe mit einem Bon ist keine Gruppe');
}
for (const pfad of ['pos/kc-oberflaechen-anwenden.css', 'schulung/pos/kc-oberflaechen-anwenden.css'])
  { const c = fs.readFileSync(pfad, 'utf8'); assert(c.includes('.kc-park-gruppe') && c.includes('.kc-park-summe'), pfad + ': Gruppen-Rahmen/Gesamtzeile fehlt'); }
for (const pfad of ['pos/index.html', 'schulung/pos/index.html', 'pos/service-worker.js', 'schulung/pos/service-worker.js']) {
  const s = fs.readFileSync(pfad, 'utf8');
  assert(/kc-oberflaechen-anwenden\.js\?build=0\.9\.(1[3-9]|[2-9]\d)/.test(s) && s.includes('kc-oberflaechen-anwenden.css?build=0.9.23'), pfad + ': Buildnummer nicht erhöht');
}
console.log('park-verbinden: ok');
