/* TV-Präsentation Weihnachtsmarkt 2026: Allergen-/Zusatzstoff-Kennzeichen gegen die Kasse abgleichen (25.11.2026).
 * Quelle der Wahrheit: etiketten/artikel.json (Export aus pos/app.js). Gezählt werden nur enthaltene Allergene
 * (nicht „Spuren möglich“ – die stehen am Aushang) und kennzeichnungspflichtige Zusatzstoffe (1 Farbstoff,
 * 2 Konservierungsstoff, 3 Antioxidationsmittel). Geprüft: Preisfolien-Kennzeichen (tools/tv-preisfolien.cjs),
 * Speisenfolien „Lust auf …?“ und die gebaute Präsentation. */
'use strict';
const fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
const { KENNZEICHEN, LEGENDE } = require(path.join(W, 'tools', 'tv-preisfolien.cjs'));
const { FOLIEN } = require(path.join(W, 'tools', 'tv-speisenfolien.cjs'));
let f = 0; const p = (n, ok, z = '') => { console.log(`${ok ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!ok) f++; };

const BUCHSTABE = [[/Glutenhaltig|Gluten/, 'A'], [/Krebstier/, 'B'], [/Eier\b|Ei\b/, 'C'], [/Fisch/, 'D'], [/Erdn/, 'E'], [/Soja/, 'F'], [/Milch/, 'G'],
  [/Schalenfr/, 'H'], [/Sellerie/, 'I'], [/Senf/, 'J'], [/Sesam/, 'K'], [/Sulfit|Schwefeldioxid/, 'L'], [/Lupine/, 'M'], [/Weichtier/, 'N']];
function soll(artikel) {
  const out = new Set();
  const all = String(artikel.allergene || '');
  if (!/^Keine deklarationspflichtigen/.test(all)) for (const teil of all.split(',')) {
    if (/Spuren/.test(teil)) continue;
    for (const [re, k] of BUCHSTABE) if (re.test(teil)) out.add(k);
  }
  const z = String(artikel.zusatz || '');
  if (!/^Ohne /.test(z)) { if (/Farbstoff/.test(z)) out.add('1'); if (/Konservierungsstoff/.test(z)) out.add('2'); if (/Antioxidationsmittel/.test(z)) out.add('3'); }
  const ord = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', '1', '2', '3'];
  return [...out].sort((a, b) => ord.indexOf(a) - ord.indexOf(b)).join(', ');
}
const KASSE = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(W, 'etiketten', 'artikel.json'), 'utf8')).artikel.map((a) => [a.id, a]));
const ZUORDNUNG = { grot: 'Roter Winzerglühwein', gweiss: 'Weißer Winzerglühwein', eier: 'Eierlikörpunsch', feuer: 'Feuerzangenbowle',
  gruenkohl: 'Grünkohl a la Köcheclub', gruenkohlmett: 'Grünkohl a la Köcheclub mit Mettendchen', sauerkraut: 'Sauerkrauteintopf',
  sauerkrautmett: 'Sauerkrauteintopf mit Mettendchen', mettwurst: 'Mettendchen', knirpsecreme: 'Kartoffeln mit Kartoffelcreme',
  hering: 'Kartoffeln mit Heringsstipp', roterfeger: 'Roter Feger', apfel: 'Apfelpunsch' };
for (const [id, name] of Object.entries(ZUORDNUNG)) {
  const s = soll(KASSE[id]), ist = KENNZEICHEN[name] || '';
  p(`${name}: Kennzeichen wie Kasse`, s === ist, `Kasse „${s}“ · TV „${ist}“`);
}
const zeichen = new Set(LEGENDE.map(([k]) => k));
p('Legende erklärt jedes benutzte Kennzeichen', Object.values(KENNZEICHEN).every((kz) => kz.split(',').map((x) => x.trim()).filter(Boolean).every((k) => zeichen.has(k))));
p('Speisenfolien: jedes Gericht hat eine Kennzeichnung', FOLIEN.every((fo) => ['links', 'rechts'].every((s) => fo[s].kz in KENNZEICHEN)));

const html = fs.readFileSync(path.join(W, 'tv-player', 'weihnachtsmarkt-2026-version-a.html'), 'utf8');
const a = html.indexOf('window.KC_DESIGNER_MARKET_PRESENTATION=');
const projekt = JSON.parse(html.slice(a + 39, html.indexOf('};', a) + 1).replace(/\bB\[(\d+)\]/g, '0'));
for (const fo of FOLIEN) {
  const folie = projekt.slides.find((s) => s.name === fo.titel), t = folie ? folie.items.map((i) => i.text || '') : [];
  const kz = ['links', 'rechts'].map((s) => `(${KENNZEICHEN[fo[s].kz]})`);
  const leg = t.find((x) => /Spuren und weitere Angaben am Stand/.test(x)) || '';
  const noetig = new Set(kz.join(',').replace(/[()]/g, '').split(',').map((x) => x.trim()));
  p(`${fo.titel}: Kennzeichen beider Gerichte und Legende auf der Folie`, kz.every((k) => t.includes(k)) && [...noetig].every((k) => new RegExp('(^|· )' + k + ' ').test(leg)), leg);
}
const preis = projekt.slides.filter((s) => /^Preisliste/.test(s.name)).flatMap((s) => s.items).filter((i) => i.originalRole === 'kcPreise')
  .flatMap((i) => JSON.parse(i.text.slice(i.text.indexOf('@@PL@@') + 6)).posten);
for (const [, name] of Object.entries(ZUORDNUNG)) {
  const post = preis.find((x) => x.name === name);
  if (post) p(`Preisfolie „${name}“ zeigt die Kennzeichen`, post.kz === (KENNZEICHEN[name] || ''), post.kz);
}
const ohne = preis.filter((x) => !Object.values(ZUORDNUNG).includes(x.name)).map((x) => x.name);
console.log(`  Hinweis: ohne Abgleich (keine Angaben in der Kasse): ${ohne.join(', ') || '–'}`);
console.log(`\nTV-Allergene gegen Kasse: ${f ? f + ' FEHLER' : 'alles OK'}`);
process.exit(f ? 1 : 0);
