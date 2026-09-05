/* Wächter gegen das Muster "dieselbe Sache an mehreren Stellen gepflegt".
 *
 * ANLASS 02.09.2026: In der Futura Academy lag die Spieleliste DREIMAL vor - einmal richtig
 * und zweimal als veraltete Abschrift. Sechs Spiele fehlten dadurch monatelang, ein Titel war
 * falsch, und NIRGENDS erschien ein Fehler. Der Betreiber hat es gemerkt, nicht das Programm.
 *
 * Diese Prüfung sucht dasselbe Muster in der Kassen-Suite. Sie ändert nichts und räumt nichts
 * auf - sie schlägt an, sobald zwei Stellen, die dasselbe sagen müssen, es nicht mehr tun.
 * Aufräumen (eine gemeinsame Quelle bauen) ist eine eigene Entscheidung; kurz vor einer
 * Vorführung ist ein Wächter das Richtige, kein Umbau an der Verbindungsstrecke.
 *
 * Gelesen wird der Quelltext, nicht der laufende Browser: Es geht um Übereinstimmung zwischen
 * Dateien, nicht um Verhalten. Für Verhalten sind die anderen Reihen zuständig.
 */
const fs = require('fs'), path = require('path');
const WURZEL = path.resolve(__dirname, '..');
const AUS = new Set(['node_modules', '.git', 'altlast-tv-designer', 'tests']);

let ok = 0; const fehler = [];
const p = (name, bedingung, detail = '') => {
  if (bedingung) { ok++; console.log(`  OK    ${name}${detail ? '   [' + detail + ']' : ''}`); }
  else { fehler.push(`${name}${detail ? ' – ' + detail : ''}`); console.log(`  FEHLER ${name}${detail ? '   [' + detail + ']' : ''}`); }
};

function alleDateien(endungen) {
  const raus = [];
  (function lauf(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (AUS.has(e.name)) continue;
      const voll = path.join(d, e.name);
      if (e.isDirectory()) { lauf(voll); continue; }
      if (endungen.some((x) => e.name.endsWith(x))) raus.push(voll);
    }
  })(WURZEL);
  return raus;
}
const rel = (x) => path.relative(WURZEL, x);

const jsDateien = alleDateien(['.js', '.cjs', '.mjs']);
const htmlDateien = alleDateien(['.html']);
console.log(`Grundlage: ${jsDateien.length} JavaScript-Dateien, ${htmlDateien.length} Seiten\n`);

// ---------------------------------------------------------------- 1. Manager-Dienst-Port
console.log('== Der Port des Manager-Dienstes ==');
// Der Port steht an über einem Dutzend Stellen im Klartext - als Konstante, in URLs und in
// Meldungstexten. Weicht eine davon ab, schlägt die Verbindung fehl, ohne dass jemand sieht
// warum: die Kasse meldet nur "Dienst antwortet nicht".
const endpunkte = new Map();   // Pfad -> Menge der Ports, unter denen er angesprochen wird
for (const f of jsDateien) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/127\.0\.0\.1:(\d{4,5})(\/[a-zA-Z0-9\/-]+)/g)) {
    const pfad = m[2];
    if (!endpunkte.has(pfad)) endpunkte.set(pfad, new Map());
    const wo = endpunkte.get(pfad);
    if (!wo.has(m[1])) wo.set(m[1], []);
    wo.get(m[1]).push(rel(f));
  }
}
const uneinheitlich = [...endpunkte].filter(([, ports]) => ports.size > 1);
p('Es gibt genug Endpunkte zum Vergleichen', endpunkte.size >= 8, `${endpunkte.size} verschiedene Endpunkte`);
p('Jeder Endpunkt wird immer unter demselben Port angesprochen', uneinheitlich.length === 0,
  uneinheitlich.length
    ? uneinheitlich.slice(0, 3).map(([pfad, ports]) => `${pfad}: ${[...ports.keys()].join(' vs ')}`).join(' | ')
    : `${endpunkte.size} Endpunkte geprüft`);
// Die beiden Dienste sauber auseinanderhalten: /kc-sync-* gehört zum Sync-Dienst der Kasse,
// alles andere zum Manager-Dienst. Das ist die Trennung, die im Betrieb wirklich zählt.
const syncPorts = new Set(), managerPorts = new Set();
for (const [pfad, ports] of endpunkte) {
  for (const port of ports.keys()) (pfad.startsWith('/kc-sync-') ? syncPorts : managerPorts).add(port);
}
p('Der Sync-Dienst der Kasse läuft auf genau einem Port', syncPorts.size === 1, [...syncPorts].join(', '));
p('Die übrigen Dienste vermischen sich nicht mit dem Sync-Port',
  ![...syncPorts].some((x) => managerPorts.has(x)) || managerPorts.size === 0,
  `Sync ${[...syncPorts].join(',')} · übrige ${[...managerPorts].join(',')}`);

// ---------------------------------------------------------------- 2. Zuschaltbare TV-Objekte
console.log('\n== Zuschaltbare TV-Objekte ==');
// Diese Liste sagt, welche Objekte auf einer Folie einzeln ein- und ausgeschaltet werden
// können. Sie steht im Studio (wo man sie schaltet) UND im Schutzmodul (das sie ausblendet).
// Laufen die beiden auseinander, bietet das Studio etwas an, das der Schutz wegnimmt - oder
// umgekehrt, und dann steht am Freitag etwas auf dem Fernseher, was niemand dort haben will.
// Die Liste heisst an den beiden Stellen UNTERSCHIEDLICH ("optional" im Studio,
// "ZUSCHALTBAR" im Schutzmodul) - deshalb wird nicht nach dem Namen gesucht, sondern nach
// der Liste selbst. Genau solche Namensunterschiede sind der Grund, warum doppelt gepflegte
// Listen so lange unentdeckt bleiben.
function listeAus(datei) {
  const s = fs.readFileSync(path.join(WURZEL, datei), 'utf8');
  const m = s.match(/\[\s*'ticker'\s*,\s*'weather'[^\]]*\]/);
  if (!m) return null;
  return m[0].match(/'([^']+)'/g).map((x) => x.slice(1, -1)).sort();
}
const studio = listeAus('pc-manager/kc-object-studio.js');
const schutz = listeAus('pc-manager/presentation-professional-guard.js');
p('Das Studio führt eine Liste zuschaltbarer Objekte', Array.isArray(studio) && studio.length > 0,
  (studio || []).join(', '));
p('Das Schutzmodul führt dieselbe Liste', Array.isArray(schutz) && schutz.length > 0,
  (schutz || []).join(', '));
p('Beide Listen sind wortgleich',
  JSON.stringify(studio) === JSON.stringify(schutz),
  JSON.stringify(studio) === JSON.stringify(schutz) ? `${(studio || []).length} Einträge`
    : `Studio: ${(studio || []).join(', ')} | Schutz: ${(schutz || []).join(', ')}`);

// ---------------------------------------------------------------- 3. Vorführdaten
console.log('\n== Vorführdaten von Kasse und PC-Manager ==');
// Am Freitag wird zwischen Kasse und Manager hin- und hergeschaltet. Zeigen beide Daten, die
// nichts miteinander zu tun haben, fällt das beim ersten Nachrechnen auf. Geprüft wird
// deshalb nicht "gleich groß", sondern: sind die Bons der Kasse WIRKLICH ein Ausschnitt aus
// dem, was der Manager zeigt?
const lade = (x) => JSON.parse(fs.readFileSync(path.join(WURZEL, x), 'utf8'));
let managerBons = [], kassenBons = [];
try { managerBons = lade('pc-manager/vorfuehrung/daten.json'); } catch (e) {}
try { kassenBons = lade('pos/vorfuehrung/daten.json'); } catch (e) {}
p('Beide Vorführdatensätze sind vorhanden', managerBons.length > 0 && kassenBons.length > 0,
  `Manager ${managerBons.length} Bons, Kasse ${kassenBons.length} Bons`);
const mIds = new Set(managerBons.map((x) => String(x.transactionId)));
const fehlend = kassenBons.filter((x) => !mIds.has(String(x.transactionId)));
p('Jeder Bon der Kasse steht auch beim Manager', fehlend.length === 0,
  fehlend.length ? `${fehlend.length} Bons kennt der Manager nicht` : `${kassenBons.length} von ${kassenBons.length} wiedergefunden`);
const kassenNummern = new Set(kassenBons.map((x) => x.registerId));
const managerNummern = new Set(managerBons.map((x) => x.registerId));
p('Die Kasse zeigt ihre eigene Kasse, der Manager alle',
  kassenNummern.size === 1 && managerNummern.size > kassenNummern.size,
  `Kasse: ${[...kassenNummern].join(', ')} | Manager: ${[...managerNummern].join(', ')}`);
// Bon für Bon vergleichen statt Summe gegen Summe: eine gleiche Endsumme kann auch aus
// zwei verschiedenen Fehlern entstehen, die sich gegenseitig aufheben.
const nachId = new Map(managerBons.map((x) => [String(x.transactionId), x]));
const abweichend = kassenBons.filter((x) => {
  const m = nachId.get(String(x.transactionId));
  return m && Math.abs((Number(x.total) || 0) - (Number(m.total) || 0)) > 0.005;
});
p('Jeder einzelne Bon trägt in beiden Fassungen denselben Betrag', abweichend.length === 0,
  abweichend.length ? `${abweichend.length} Bons weichen ab, z. B. ${abweichend[0].transactionId}`
                    : `${kassenBons.length} Bons einzeln verglichen`);
const doppelteIds = kassenBons.length - new Set(kassenBons.map((x) => String(x.transactionId))).size;
p('Keine Bonnummer ist doppelt vergeben', doppelteIds === 0, `${doppelteIds} Doppelte`);

// ---------------------------------------------------------------- 4. Tote Verweise
console.log('\n== Verweise in allen Seiten ==');
const tot = [];
let verweise = 0;
for (const f of htmlDateien) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/(?:src|href)="([^"#?][^"]*)"/g)) {
    const u = m.group?.(1) ?? m[1];
    if (/^(https?:|\/\/|data:|mailto:|javascript:)/.test(u)) continue;
    verweise++;
    const ziel = path.resolve(path.dirname(f), u.split('?')[0].split('#')[0]);
    if (!fs.existsSync(ziel)) tot.push(`${rel(f)} -> ${u}`);
  }
}
p('Kein Verweis zeigt auf eine Datei, die es nicht gibt', tot.length === 0,
  tot.slice(0, 3).join(' | ') || `${verweise} Verweise in ${htmlDateien.length} Seiten geprüft`);

// ---------------------------------------------------------------- 5. Doppelte Dateien
console.log('\n== Gleiche Datei an mehreren Orten ==');
const crypto = require('crypto');
const nachInhalt = new Map();
for (const f of jsDateien) {
  const roh = fs.readFileSync(f);
  if (roh.length < 400) continue;
  const h = crypto.createHash('sha256').update(roh).digest('hex');
  (nachInhalt.get(h) || nachInhalt.set(h, []).get(h)).push(rel(f));
}
const doppelt = [...nachInhalt.values()].filter((v) => v.length > 1);
p('Keine JavaScript-Datei liegt inhaltsgleich mehrfach im Paket', doppelt.length === 0,
  doppelt.length ? doppelt.slice(0, 2).map((v) => v.join(' = ')).join(' | ')
                 : `${jsDateien.length} Dateien verglichen`);

// ---------------------------------------------------------------- 6. Versionsangaben
console.log('\n== Versionsangabe der Suite ==');
// Die Version steht in mehreren Schaufenstern. Zeigt eines eine andere, weiß hinterher
// niemand mehr, welcher Stand eigentlich läuft.
const versionen = new Map();
for (const f of [...jsDateien, ...htmlDateien]) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/KC_SUITE_VERSION\s*=\s*['"]([^'"]+)['"]/g)) {
    (versionen.get(m[1]) || versionen.set(m[1], []).get(m[1])).push(rel(f));
  }
}
p('Die Suite nennt überall dieselbe Version', versionen.size <= 1,
  versionen.size ? [...versionen.keys()].join(' vs ') : 'keine zentrale Versionsangabe gefunden');

console.log(`\nKonsolidierung - eine Quelle je Sache: ${ok}/${ok + fehler.length} bestanden`);
process.exit(fehler.length ? 1 : 0);
