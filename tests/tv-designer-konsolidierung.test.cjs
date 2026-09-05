/* Nachweis der TV-Editor-Zusammenfuehrung.
   Tritt an die Stelle der 29 dauerhaft roten Alttests (siehe tests/altlast-tv-designer/).
   Jene pruefen Moduldateien, die es nicht mehr gibt. Dieser Test prueft das Gegenteil und
   damit das, was heute stimmen MUSS:
     1. die alten Module sind wirklich verschwunden,
     2. nichts im Programm verweist noch auf sie (haengender Verweis = weisse Seite),
     3. die Nachfolger sind vorhanden und eingebunden,
     4. jedes eingebundene Skript existiert auch wirklich.
   Punkt 4 ist der eigentliche Wert: er faengt kuenftig genau den Fehler ab, der die 29
   Alttests ueberhaupt erst entstehen liess. */
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
let fehler = 0;
const pruefe = (name, bedingung, zusatz = '') => {
  console.log(`${bedingung ? '  OK  ' : 'FEHLER'}  ${name}${zusatz ? '  [' + zusatz + ']' : ''}`);
  if (!bedingung) fehler++;
};

// --- 1. Die zusammengefuehrten Altmodule duerfen nicht mehr da sein -----------------------
const ABGELOEST = [
  'tv-weihnachtsmarkt-presentation.js', 'tv-unified-editor.js', 'tv-shared-renderer-v02946.js',
  'tv-object-context-menu-v02944.js', 'tv-display-matrix-adapter.js', 'tv-slide-numbers-v02945.js',
  'tv-content-object-core-v02940.js', 'tv-editor-runtime-repair-v02953.js',
  'tv-custom-text-editor-v02954.js', 'tv-render-consolidation-v02955.js',
  'tv-text-input-performance-v02939.js', 'tv-editor-shell-v02935.js',
  'werne-program-archive-v02943.js', 'program-import-core-v010.js', 'event-program-export-v010.js',
  'tv-export-center-extension.js',
];
const nochDa = ABGELOEST.filter((m) => fs.existsSync(path.join(WURZEL, 'pc-manager', m)));
pruefe('Die abgelösten Altmodule sind entfernt', nochDa.length === 0, nochDa.join(', '));

// --- 2. Kein HTML bindet noch ein Altmodul ein --------------------------------------------
const htmlDateien = [];
(function sammle(d) {
  for (const e of fs.readdirSync(d, {withFileTypes: true})) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.git|altlast/.test(e.name)) sammle(p); }
    else if (e.name.endsWith('.html')) htmlDateien.push(p);
  }
})(WURZEL);
const haengend = [];
for (const datei of htmlDateien) {
  const txt = fs.readFileSync(datei, 'utf8');
  for (const m of ABGELOEST) if (txt.includes(m)) haengend.push(`${path.relative(WURZEL, datei)} -> ${m}`);
}
pruefe('Keine Seite bindet noch ein abgelöstes Modul ein', haengend.length === 0, haengend.slice(0, 3).join(' | '));

// --- 3. Die Nachfolger sind vorhanden -----------------------------------------------------
const NACHFOLGER = ['pc-manager/kc-object-studio.js', 'pc-manager/tv-designer/index.html',
  'pc-manager/tv-designer/app.js', 'pc-manager/tv-designer/kc-tv-player.js'];
const fehlende = NACHFOLGER.filter((n) => !fs.existsSync(path.join(WURZEL, n)));
pruefe('Die Nachfolger sind vorhanden', fehlende.length === 0, fehlende.join(', '));

const managerHtml = fs.readFileSync(path.join(WURZEL, 'pc-manager/index.html'), 'utf8');
pruefe('Der PC-Manager bindet das Objekt-Studio ein', managerHtml.includes('kc-object-studio.js'));

// Der Kopf von kc-object-studio.js haelt fest, was es ersetzt - das ist die Begruendung
// dafuer, dass die Alttests stillgelegt werden durften.
const studio = fs.readFileSync(path.join(WURZEL, 'pc-manager/kc-object-studio.js'), 'utf8');
pruefe('Das Objekt-Studio dokumentiert, welche Module es ersetzt', /Ersetzt:/.test(studio.slice(0, 1200)));
pruefe('Die Aufgabe des früheren Textobjekt-Editors steckt jetzt im Objekt-Studio',
  /customTextObjects/.test(studio) && /createCustomText/.test(studio));

// --- 4. JEDES eingebundene Skript und Stylesheet muss existieren --------------------------
// Genau hier entstand der Schaden: geloeschte Dateien blieben eingebunden.
const tot = [];
let geprueft = 0;
for (const datei of htmlDateien) {
  const txt = fs.readFileSync(datei, 'utf8');
  const basis = path.dirname(datei);
  for (const m of txt.matchAll(/(?:src|href)\s*=\s*["']([^"'#?]+)["']/g)) {
    const ref = m[1];
    if (/^(https?:|data:|mailto:|javascript:|\/\/)/.test(ref)) continue;
    geprueft++;
    const ziel = ref.startsWith('/') ? path.join(WURZEL, ref) : path.join(basis, ref);
    if (!fs.existsSync(ziel)) tot.push(`${path.relative(WURZEL, datei)} -> ${ref}`);
  }
}
pruefe('Jeder Verweis in jeder Seite zeigt auf eine vorhandene Datei',
  tot.length === 0, tot.length ? tot.slice(0, 4).join(' | ') : `${geprueft} Verweise in ${htmlDateien.length} Seiten`);

// --- 5. Die stillgelegten Tests sind nachvollziehbar abgelegt ------------------------------
const altlast = path.join(WURZEL, 'tests/altlast-tv-designer');
pruefe('Die stillgelegten Alttests liegen mit Begründung im eigenen Ordner',
  fs.existsSync(path.join(altlast, 'LIESMICH.md')));
if (fs.existsSync(altlast)) {
  const anzahl = fs.readdirSync(altlast).filter((f) => f.endsWith('.test.cjs')).length;
  pruefe('Es sind die erwarteten 29 Alttests', anzahl === 29, `${anzahl} Dateien`);
}

console.log(fehler ? `\n${fehler} FEHLER` : '\nAlles grün.');
process.exit(fehler ? 1 : 0);
