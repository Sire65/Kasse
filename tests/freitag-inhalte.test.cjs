/* Dauerprüfung für die Freitagsinhalte.   Stand 03.09.2026
 *
 * WOZU DAS HIER STEHT
 * An diesem Abend sind an vier Stellen Angaben auseinandergelaufen, ohne dass sich etwas
 * gemeldet hätte: Mitgliedernamen, Getränkepreise, ein Artikel, den es nicht mehr gibt, und
 * die Position der Überschrift. Jede dieser Stellen gab es MEHRFACH im Paket - in der Kasse,
 * im Manager, in vier Präsentationen. Wer eine ändert und die anderen vergisst, merkt es
 * nicht; auf dem Fernseher steht dann etwas anderes als an der Kasse.
 *
 * Diese Datei prüft genau das: Stimmen alle Quellen noch überein? Sie prüft NICHT, ob ein
 * Preis "richtig" ist - das weiß nur der Verein. Sie prüft, ob überall dasselbe steht.
 *
 * Aufruf:  node tests/freitag-inhalte.test.cjs
 * Mit --gegenprobe wird absichtlich Unsinn eingeschleust; dann MÜSSEN Prüfungen rot werden.
 * Eine Prüfung, die nie rot werden kann, ist keine.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const P = (p) => path.join(WURZEL, p);
const GEGENPROBE = process.argv.includes('--gegenprobe');

let gruen = 0; const rot = [];
const pruefe = (name, bedingung, zusatz) => {
  if (bedingung) { gruen++; return; }
  rot.push(name + (zusatz ? '  →  ' + zusatz : ''));
};

/* ------------------------------------------------------------------ Quellen einlesen */
function stammdaten() {
  const t = fs.readFileSync(P('pos/app.js'), 'utf8');
  const i = t.indexOf('DEFAULT_PRODUCTS');
  let d = 0, s = t.indexOf('[', i), e = s;
  for (let k = s; k < t.length; k++) { if (t[k] === '[') d++; if (t[k] === ']') { d--; if (!d) { e = k; break; } } }
  const liste = eval(t.slice(s, e + 1));
  const m = new Map();
  liste.forEach((p) => { if (p && p.id && !m.has(p.id)) m.set(p.id, p); });
  return m;
}

function v4() {
  const t = fs.readFileSync(P('pc-manager/tv-designer/kasse-presentation-data.js'), 'utf8');
  return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
}

const TV_ORDNER = P('tv-content/weihnachtsmarkt-2026');
const kctvDateien = () => fs.readdirSync(TV_ORDNER).filter((f) => f.endsWith('.kctv'));
const kctv = (f) => JSON.parse(fs.readFileSync(path.join(TV_ORDNER, f), 'utf8'));

function mitglieder() {
  const t = fs.readFileSync(P('pc-manager/kc-mitgliedsdaten.js'), 'utf8');
  const namen = [...t.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]);
  return namen;
}

const STAMM = stammdaten();
const MITGLIEDER = mitglieder();
const V4 = v4();

/* Für die Gegenprobe wird NUR im Arbeitsspeicher manipuliert - nie in einer Datei. */
if (GEGENPROBE) {
  STAMM.get('grot').price = 9.99;
  MITGLIEDER.push('Heinz Lunemann');
  V4.slides[14].items.find((x) => x.type === 'text').y = 400;
}

/* ================================================================== 1. Die Namen */
{
  const ALT = ['Katzig', 'Kazig', 'Fridbert', 'Fred Köhling', 'Nachname ergänzen', 'Name Mitglied 1',
    'Steven Linkey',
    // Nachgereicht vom Betreiber am 03.09.2026: Sie heisst Scharnetzki, nicht Brösel.
    'Christina Brösel',
    // Aus den beiden Reserve-Folien sind Christina Scharnetzki und Leon Wördemann geworden.
    'Reserve 1', 'Reserve 2'];
  const dateien = [];
  (function sammle(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      if (e.name === 'node_modules' || e.name.startsWith('.')) return;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) sammle(p);
      else if (/\.(js|json|kctv|html)$/.test(e.name)) dateien.push(p);
    });
  })(WURZEL);

  ALT.forEach((wort) => {
    const treffer = dateien.filter((f) => { try { return fs.readFileSync(f, 'utf8').includes(wort); } catch { return false; } });
    pruefe('Alte Schreibweise „' + wort + '“ kommt nirgends mehr vor', treffer.length === 0,
      treffer.slice(0, 3).map((f) => path.relative(WURZEL, f)).join(', '));
  });

  pruefe('Mitgliedsdaten führen 18 Personen', MITGLIEDER.length === 18, MITGLIEDER.length + ' gefunden');
  ['Ruth Kazik', 'Karla Kazik', 'Friedbert Köhling', 'Christina Scharnetzki', 'Leon Wördemann'].forEach((n) => {
    pruefe('„' + n + '“ steht in den Mitgliedsdaten', MITGLIEDER.includes(n));
  });

  /* Heinz Lunemann darf auf keiner Liste und keiner Folie auftauchen. */
  pruefe('Heinz Lunemann steht nicht in den Mitgliedsdaten', !MITGLIEDER.some((n) => /Lunemann/i.test(n)));
  kctvDateien().forEach((f) => {
    pruefe('Heinz Lunemann kommt in ' + f.replace('Weihnachtsmarkt_Werne_2026_', '') + ' nicht vor',
      !/Lunemann/i.test(fs.readFileSync(path.join(TV_ORDNER, f), 'utf8')));
  });

  /* Jeder Name aus den Mitgliedsdaten muss in der Mitgliederschau der TV-Fassung stehen. */
  const bearbeitbar = kctv('Weihnachtsmarkt_Werne_2026_Bearbeitbar.kctv');
  const gezeigt = bearbeitbar.slides.filter((s) => s.type === 'member').map((s) => s.title);
  MITGLIEDER.forEach((n) => pruefe('„' + n + '“ hat eine Folie in der TV-Fassung', gezeigt.includes(n)));
}

/* ================================================================== 2. Die Preise */
{
  const eur = (v) => Number(String(v).replace(/[^0-9,.]/g, '').replace(',', '.'));

  /* 2a. Was der Gast zahlt - Artikelpreis plus Pfand, gegen die Bestätigung des Betreibers. */
  const GAST = { grot: 5.50, gweiss: 5.50, eier: 6.50, apfel: 4.50, roterfeger: 4.50, feuer: 9.00 };
  Object.entries(GAST).forEach(([id, soll]) => {
    const p = STAMM.get(id);
    if (!p) { pruefe('Artikel „' + id + '“ ist in der Kasse vorhanden', false); return; }
    const pfand = (p.depositComponents || []).reduce((n, x) => n + Number(x.price || 0), 0);
    pruefe('Gast zahlt für ' + p.name + ' ' + soll.toFixed(2).replace('.', ',') + ' €',
      Math.abs(Number(p.price) + pfand - soll) < 0.001,
      'gerechnet: ' + Number(p.price).toFixed(2) + ' + ' + pfand.toFixed(2) + ' Pfand');
  });

  /* 2b. Jede Preiszeile in jeder TV-Fassung gegen den Kassenstamm - und die Anzeigetabelle
         gegen die Artikelliste derselben Folie (die zweite Quelle innerhalb einer Folie). */
  kctvDateien().forEach((f) => {
    const kurz = f.replace('Weihnachtsmarkt_Werne_2026_', '').replace('.kctv', '');
    (kctv(f).slides || []).forEach((sl) => {
      const items = sl.catalogTable && sl.catalogTable.items;
      if (!items) return;
      const rows = (sl.tableObject && sl.tableObject.rows) || [];
      items.forEach((it) => {
        const id = (it.ids || []).find((k) => STAMM.has(k));
        pruefe(kurz + ': „' + it.name + '“ hat eine gültige Artikelkennung', !!id, (it.ids || []).join('/'));
        if (!id) return;
        const st = STAMM.get(id);
        pruefe(kurz + ': „' + it.name + '“ zeigt den Kassenpreis',
          Math.abs(Number(st.price) - it.price) < 0.001, 'Folie ' + it.price + ' vs Kasse ' + st.price);
        pruefe(kurz + ': „' + it.name + '“ ist in der Kasse nicht abgeschaltet', st.active !== false);
        const r = rows.find((x) => x[0] === it.name);
        pruefe(kurz + ': „' + it.name + '“ hat eine Zeile in der Anzeigetabelle', !!r);
        if (r) pruefe(kurz + ': Anzeigetabelle und Artikelliste sind sich einig bei „' + it.name + '“',
          Math.abs(eur(r[r.length - 1]) - it.price) < 0.001, r[r.length - 1] + ' vs ' + it.price);
      });
    });
  });

  /* 2c. Die Preisfolien im Original. */
  const V4PREISE = {
    'Roter Winzerglühwein': 3.50, 'Weißer Winzerglühwein': 3.50, 'Eierlikörpunsch': 4.50,
    'Feuerzangenbowle': 5.00, 'Roter Feger': 2.50, 'Apfelpunsch': 2.50,
    'Grünkohl a la Köcheclub': 5.50, 'Grünkohl a la Köcheclub mit Mettwurst': 7.00,
    'Sauerkrauteintopf': 5.50, 'Sauerkrauteintopf mit Mettwurst': 7.00, 'Mettenchen': 1.50,
    'Kartoffel mit Kartoffelcreme': 3.50, 'Kartoffel mit Hering': 4.50,
  };
  let gefunden = 0;
  V4.slides.forEach((s) => (s.items || []).forEach((it) => {
    if (it.type !== 'table' || !it.tableData) return;
    it.tableData.slice(1).forEach((z) => {
      const name = String(z[0] && z[0].text || '').trim();
      if (V4PREISE[name] === undefined) return;
      gefunden++;
      pruefe('Original, Preisfolie: „' + name + '“ steht mit ' + V4PREISE[name].toFixed(2).replace('.', ',') + ' €',
        Math.abs(eur(z[z.length - 1].text) - V4PREISE[name]) < 0.001, 'steht: ' + z[z.length - 1].text);
    });
  }));
  pruefe('Alle 13 Preiszeilen im Original gefunden', gefunden >= 13, gefunden + ' gefunden');
}

/* ================================================================== 3. Kartoffelknirpse */
{
  pruefe('Kartoffelknirpse ist nicht mehr in der Kasse', !STAMM.has('knirpse'));
  pruefe('Knirpse mit Heringsstipp ist nicht mehr in der Kasse', !STAMM.has('knirpseher'));
  const orte = ['pos/app.js', 'pc-manager/app.js', 'shared/pos-catalog-registry-v02946.js',
    'pc-manager/tv-designer/kasse-presentation-data.js',
    'pc-manager/tv-designer/assets/kasse-presentation/KC_Weihnachtsmarkt_2026_Designer.json',
    'tv-content/weihnachtsmarkt-2026/presentation.js'];
  /* Kommentare zählen nicht mit. GEFUNDEN beim ersten Lauf: Die Prüfung schlug an, weil in
     den Erklärzeilen, die ich selbst geschrieben hatte, das Wort vorkommt. Ein Hinweis im
     Kommentar erscheint nicht auf dem Bildschirm - eine Prüfung, die ihn beanstandet,
     erzieht nur dazu, Erklärungen wegzulassen. */
  const ohneKommentare = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const knirpseReste = (t) => {
    const c = ohneKommentare(t);
    /* Die Kennung knirpsecreme gehört zu "Kartoffel mit Kartoffelcreme" und bleibt. */
    return (c.match(/[Kk]nirpse/g) || []).length - (c.match(/knirpsecreme/g) || []).length;
  };
  /* Und die Aufräumzeile zählt auch nicht mit: Sie NENNT die beiden Kennungen, um sie aus
     einer schon gespeicherten Artikelliste zu entfernen. Ohne sie behielte eine Kasse, die
     die Artikel im Speicher hat, sie für immer. Eine Prüfung, die genau die Zeile
     beanstandet, die das Problem löst, wäre verkehrt herum. */
  const ohneAufraeumzeile = (t) => t.replace(/for\(const weg of \["knirpse","knirpseher"\][^\n]*/g, '');
  orte.forEach((o) => {
    const n = knirpseReste(ohneAufraeumzeile(fs.readFileSync(P(o), 'utf8')));
    pruefe('Kein Knirpse-Rest in ' + o, n <= 0, n + ' Nennung(en)');
  });
  /* Der eigentliche Nachweis für Kasse und Manager: kein Artikel trägt den Namen mehr. */
  [...STAMM.values()].forEach((p) => {
    pruefe('Kein Artikel heißt noch „' + p.name + '“ mit Knirpse', !/knirpse/i.test(p.name));
  });
  kctvDateien().forEach((f) => {
    const n = knirpseReste(fs.readFileSync(path.join(TV_ORDNER, f), 'utf8'));
    pruefe('Kein Knirpse-Rest in ' + f.replace('Weihnachtsmarkt_Werne_2026_', ''), n <= 0, n + ' Nennung(en)');
  });
  pruefe('Tzatziki ist aus der Kasse verschwunden', !/tzatziki/i.test(fs.readFileSync(P('pos/app.js'), 'utf8')));
  pruefe('Roter Feger hat die Schuss-Auswahl', (STAMM.get('roterfeger') || {}).optionGroup === 'shot');
}

/* ================================================================== 4. Die Überschriften */
{
  const ZIEL = { x: 80, y: 25, w: 1120, h: 120 };
  const RAHMEN = ['Grafik 12', 'Grafik 14'];
  const trifft = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  V4.slides.forEach((s, n) => {
    const nr = n + 1;
    const titel = (s.items || []).find((x) => x.type === 'text');
    if (!titel) return;
    if (nr > 1) {
      pruefe('Folie ' + nr + ': Überschrift steht auf der Ziellinie',
        titel.x === ZIEL.x && titel.y === ZIEL.y && titel.w === ZIEL.w && titel.h === ZIEL.h,
        titel.x + ',' + titel.y + ' ' + titel.w + 'x' + titel.h);
    }
    /* Und nirgends darf der Titel etwas verdecken. */
    (s.items || []).forEach((x) => {
      if (x === titel || x.type === 'ticker' || RAHMEN.includes(x.name)) return;
      pruefe('Folie ' + nr + ': Überschrift verdeckt „' + x.name + '“ nicht', !trifft(titel, x),
        'Titel ' + titel.y + '–' + (titel.y + titel.h) + ', ' + x.name + ' ab ' + x.y);
    });
    /* Nichts darf aus der Fläche laufen oder unter die Laufschrift rutschen. */
    (s.items || []).forEach((x) => {
      pruefe('Folie ' + nr + ': „' + x.name + '“ liegt in der Fläche',
        x.x >= 0 && x.y >= 0 && x.x + x.w <= V4.page.width && x.y + x.h <= V4.page.height,
        x.x + ',' + x.y + ' ' + x.w + 'x' + x.h);
      if (x.type === 'ticker') return;
      pruefe('Folie ' + nr + ': „' + x.name + '“ bleibt über der Laufschrift', x.y + x.h <= 665,
        'endet bei ' + (x.y + x.h));
    });
  });
}

/* ================================================================== 5. Nichts kaputtgemacht */
{
  ['pos/app.js', 'pc-manager/app.js', 'pc-manager/kc-mitgliedsdaten.js',
    'pc-manager/tv-designer/kasse-presentation-data.js', 'tv-content/weihnachtsmarkt-2026/presentation.js',
    'shared/pos-catalog-registry-v02946.js', 'github-review-site/presentation-source.js',
    'cores/sales-inventory-analysis-core/sales-inventory-analysis-core.js'].forEach((o) => {
    let ok = true;
    try { new (require('vm').Script)(fs.readFileSync(P(o), 'utf8')); } catch (e) { ok = false; }
    pruefe('Datei ist syntaktisch in Ordnung: ' + o, ok);
  });
  kctvDateien().forEach((f) => {
    let ok = true;
    try { kctv(f); } catch (e) { ok = false; }
    pruefe('Gültiges JSON: ' + f.replace('Weihnachtsmarkt_Werne_2026_', ''), ok);
  });
}

/* ------------------------------------------------------------------------- Ergebnis */
console.log('\n' + (GEGENPROBE ? 'GEGENPROBE (absichtlich verstellt)' : 'Prüflauf Freitagsinhalte'));
console.log('  grün: ' + gruen + '   rot: ' + rot.length);
if (rot.length) { console.log('\n  Beanstandungen:'); rot.slice(0, 25).forEach((r) => console.log('   ✗ ' + r)); if (rot.length > 25) console.log('   … und ' + (rot.length - 25) + ' weitere'); }
if (GEGENPROBE) {
  const gutSo = rot.length >= 3;
  console.log('\n  ' + (gutSo ? '✓ Die Gegenprobe schlägt an - die Prüfungen können rot werden.' : '✗ Die Gegenprobe schlägt NICHT an - die Prüfungen taugen nichts!'));
  process.exit(gutSo ? 0 : 1);
}
process.exit(rot.length ? 1 : 0);
