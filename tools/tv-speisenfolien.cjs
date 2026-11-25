/* TV-Präsentation Weihnachtsmarkt 2026 – Speisenfolien „Lust auf …?“ (Betreiber 25.11.2026)
 *
 *   Überschrift „Lust auf Grünkohl?“, links das Gericht MIT Mettendchen (Scheiben obendrauf), rechts OHNE,
 *   darunter jeweils Name und Preis, unten rechts der Hinweis „Serviervorschlag“.
 *   Das Gleiche für Sauerkraut und für Kartoffeln (links mit Heringsstipp obendrauf – kein ganzer Fisch –,
 *   rechts mit Kartoffelcreme).
 *
 * Preise: aus der Kasse (pos/app.js, Artikel-IDs unten) – keine eigenen Preise in der Präsentation.
 * Fotos:  media/speisen/<datei>.webp – Freisteller (Hintergrund durchsichtig) aus den Kassenfotos
 *         pos/assets/*_version_3.png, erzeugt mit tools/tv-speisenfotos-freistellen.py.
 *         Neue Fotos (z. B. Mettendchen in Scheiben, Heringsstipp obendrauf) einfach unter demselben Dateinamen
 *         ablegen – PNG oder WebP mit durchsichtigem Hintergrund, oder JPG (wird dann mit Rahmen gezeigt) – und die
 *         Präsentation neu bauen.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');

// je Folie: links „mit“, rechts „ohne“ (Reihenfolge laut Betreiber)
const FOLIEN = [
  { id: 'gruenkohl', titel: 'Lust auf Grünkohl?', nach: 'Preisliste Speisen · Teil 1',
    links: { artikel: 'gruenkohlmett', name: 'Grünkohl mit Mettendchen', foto: 'gruenkohl-mettendchen' },
    rechts: { artikel: 'gruenkohl', name: 'Grünkohl', foto: 'gruenkohl' } },
  { id: 'sauerkraut', titel: 'Lust auf Sauerkraut?', nach: 'Lust auf Grünkohl?',
    links: { artikel: 'sauerkrautmett', name: 'Sauerkrauteintopf mit Mettendchen', foto: 'sauerkraut-mettendchen' },
    rechts: { artikel: 'sauerkraut', name: 'Sauerkrauteintopf', foto: 'sauerkraut' } },
  { id: 'kartoffeln', titel: 'Lust auf Kartoffeln?', nach: 'Preisliste Speisen · Teil 2',
    links: { artikel: 'hering', name: 'Kartoffeln mit Heringsstipp', foto: 'kartoffeln-heringsstipp' },
    rechts: { artikel: 'knirpsecreme', name: 'Kartoffeln mit Kartoffelcreme', foto: 'kartoffeln-kartoffelcreme' } },
];
const DAUER = 10;
const HINWEIS = 'Serviervorschlag';

// ---- Preise aus der Kasse ----
function kassenPreise(appJs = fs.readFileSync(path.join(WURZEL, 'pos', 'app.js'), 'utf8')) {
  const preise = {};
  for (const t of appJs.matchAll(/\{id:"([a-z0-9]+)",(?:sortOrder:\d+,)?name:"[^"]*",price:(\d+(?:\.\d+)?)/g)) preise[t[1]] = Number(t[2]);
  return preise;
}
const euro = (n) => n.toFixed(2).replace('.', ',') + ' €';

// ---- Fotos (data:-URL), Freisteller wenn mit Durchsichtigkeit ----
const TYPEN = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
function fotoLaden(name, ordner = path.join(WURZEL, 'media', 'speisen')) {
  for (const endung of Object.keys(TYPEN)) {
    const datei = path.join(ordner, name + endung);
    if (fs.existsSync(datei)) return { src: `data:${TYPEN[endung]};base64,${fs.readFileSync(datei).toString('base64')}`, frei: endung !== '.jpg' && endung !== '.jpeg', datei };
  }
  throw new Error(`Foto für die Speisenfolie fehlt: media/speisen/${name}.webp`);
}

// ---- Raster (Folie 1280×720, Laufschrift ab y=652, Inhalt endet spätestens bei y=644) ----
const SPALTE = { links: 95, rechts: 685 }; // Breite je Spalte 500
const BREITE = 500;
const FOTO_Y = 148, FOTO_H = 372;
const NAME_Y = 526, NAME_H = 50;
const PREIS_Y = 582, PREIS_H = 56;

function textItem(basis, werte) {
  return { ...basis, type: 'text', originalRole: 'text', src: '', opacity: 100, rotation: 0, wrap: true, locked: false, hidden: false,
    fontFamily: 'Arial', color: '#fff8e8', align: 'center', bold: false, fit: 'contain', textScaleMode: 'fit', minFont: 12, maxFont: 180,
    shadowEnabled: false, stroke: 'transparent', strokeWidth: 0, strokeStyle: 'solid', radius: 0, bg: 'transparent', fill: 'transparent', ...werte };
}

// Folien bauen und einsortieren. Vorlage ist die Rezeptfolie (Hintergrund, Titel, Laufschrift, Effekte werden übernommen).
function folienEinbauen(projekt, log, { preise = kassenPreise(), foto = fotoLaden } = {}) {
  const slides = projekt.slides;
  const vorlage = slides.find((s) => s.name === 'Rezept vom Köcheclub');
  if (!vorlage) throw new Error('Vorlage „Rezept vom Köcheclub“ nicht gefunden.');
  for (const f of FOLIEN) {
    if (slides.some((s) => s.name === f.titel)) continue;
    const folie = JSON.parse(JSON.stringify(vorlage));
    folie.id = `kc-speisen-${f.id}`; folie.name = f.titel; folie.duration = DAUER; folie.memberMeta = null;
    folie.rotation = { ...(folie.rotation || {}), enabled: true };
    const titel = folie.items.find((i) => i.originalRole === 'title');
    const laufschrift = folie.items.find((i) => i.type === 'ticker');
    titel.id = `${folie.id}-titel`; titel.text = f.titel;
    laufschrift.id = `${folie.id}-laufschrift`;
    const basis = { ...titel };
    const items = [titel];
    for (const seite of ['links', 'rechts']) {
      const g = f[seite], x = SPALTE[seite];
      if (preise[g.artikel] == null) throw new Error(`Preis für Kassenartikel „${g.artikel}“ nicht gefunden (pos/app.js).`);
      const bild = foto(g.foto);
      items.push({ ...basis, id: `${folie.id}-${seite}-foto`, name: `Foto ${g.name}`, type: 'image', originalRole: 'image', text: '', src: bild.src,
        x, y: FOTO_Y, w: BREITE, h: FOTO_H, fit: 'contain', bg: 'transparent', fill: 'transparent', shadowEnabled: false,
        ...(bild.frei ? { radius: 0, stroke: 'transparent', strokeWidth: 0 } : { radius: 18, stroke: '#d8b25a', strokeWidth: 3, strokeStyle: 'solid' }) });
      items.push(textItem(basis, { id: `${folie.id}-${seite}-name`, name: `Name ${g.name}`, text: g.name, x, y: NAME_Y, w: BREITE, h: NAME_H,
        font: 30, bold: true, bg: 'rgba(14,9,7,.82)', fill: 'rgba(14,9,7,.82)', radius: 12, stroke: 'rgba(217,170,58,.7)', strokeWidth: 2 }));
      items.push(textItem(basis, { id: `${folie.id}-${seite}-preis`, name: `Preis ${g.name}`, text: euro(preise[g.artikel]), x: x + 140, y: PREIS_Y, w: BREITE - 280, h: PREIS_H,
        font: 44, bold: true, color: '#ffd76a', bg: 'rgba(116,21,33,.92)', fill: 'rgba(116,21,33,.92)', radius: 28, stroke: '#d9aa3a', strokeWidth: 2 }));
    }
    items.push(textItem(basis, { id: `${folie.id}-hinweis`, name: 'Hinweis Serviervorschlag', text: HINWEIS, x: 1062, y: 610, w: 150, h: 30,
      font: 17, align: 'center', color: '#f3e9dc', textScaleMode: 'fixed', bg: 'rgba(14,9,7,.82)', fill: 'rgba(14,9,7,.82)', radius: 17,
      stroke: 'rgba(217,170,58,.55)', strokeWidth: 1 }));
    // Laufschrift zuletzt (liegt oben)
    items.push(laufschrift);
    folie.items = items;
    const nach = slides.findIndex((s) => s.name === f.nach);
    slides.splice(nach < 0 ? slides.length - 1 : nach + 1, 0, folie);
    log.push(`„${f.titel}“: ${f.links.name} ${euro(preise[f.links.artikel])} · ${f.rechts.name} ${euro(preise[f.rechts.artikel])}`);
  }
}

module.exports = { folienEinbauen, kassenPreise, fotoLaden, FOLIEN, HINWEIS };
