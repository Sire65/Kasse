/* Die beiden Präsentationen gegeneinander halten.   Stand 03.09.2026
 *
 * WOZU
 * Es gibt jetzt zwei Fassungen derselben Vorführung:
 *   A) das Original des Betreibers - 37 Folien im TV-Studio (kasse-presentation-data.js),
 *   B) die HTML-Fassung mit weihnachtlichen Hintergründen - 42 Folien in EINER Datei.
 * Der Betreiber entscheidet am Freitag, welche gezeigt wird. Bis dahin - und danach - müssen
 * beide dasselbe sagen.
 *
 * Genau das ist die Stelle, an der dieses Paket den ganzen Tag über gestolpert ist: zwei
 * Quellen für dieselbe Angabe, die veraltete gewinnt, und NICHTS meldet einen Fehler. Erst
 * bei den Mitgliedernamen (vier Stellen), dann bei den Getränkepreisen (drei Stellen), dann
 * bei einer dritten Namensliste im Dienstplan. Zwei Präsentationen sind dasselbe Muster,
 * nur größer: Wer morgen einen Preis im Original korrigiert, hat ihn in der HTML-Fassung
 * NICHT korrigiert - und würde es nicht merken.
 *
 * Zwischen beiden liegt außerdem ein Zwischenstand: kc-hg/inhalt.json, ein Auszug aus dem
 * Original, aus dem die HTML-Fassung gebaut wird. Auch der kann veralten. Er wird deshalb
 * hier neu erzeugt und mit dem gespeicherten verglichen.
 *
 * WAS DIESE PRÜFUNG NICHT TUT
 * Sie sagt nicht, welcher Preis richtig ist - das weiß nur der Verein. Sie sagt, ob überall
 * derselbe steht. Und sie ändert nichts: Original, Auszug und HTML-Datei werden nur gelesen.
 *
 * Aufruf:  node tests/konsolidierung-praesentationen.test.cjs
 *          node tests/konsolidierung-praesentationen.test.cjs --gegenprobe
 * Bei der Gegenprobe wird die ORIGINALSEITE im Arbeitsspeicher verfälscht. Dann MÜSSEN die
 * Vergleiche rot werden. Eine Prüfung, die nie rot wird, ist keine - fünfmal an diesem Tag
 * hat eine Prüfung grün gemeldet, weil sie am falschen Gegenstand gemessen hat.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const WURZEL = path.join(__dirname, '..');
const P = (p) => path.join(WURZEL, p);
const GEGENPROBE = process.argv.includes('--gegenprobe');

/* Die HTML-Fassung und ihr Bauplatz liegen außerhalb des Kassenpakets - über Umgebungs-
   variablen umlenkbar, damit dieselbe Prüfung auch gegen einen anderen Stand laufen kann. */
const HTML = process.env.KC_HTML || '/home/claude/KC_Weihnachtsmarkt_2026_Praesentation.html';
const HG = process.env.KC_HG || '/home/claude/kc-hg';
const AUSZUG = path.join(HG, 'inhalt.json');
const HOLER = path.join(HG, 'inhalt-holen.cjs');

let gruen = 0; const rot = [];
const pruefe = (name, bedingung, zusatz) => {
  if (bedingung) { gruen++; return; }
  rot.push(name + (zusatz ? '  →  ' + zusatz : ''));
};

/* Vergleichsmaßstab: ohne Leerraum und ohne Trennzeichen.
   GRUND: Im Original trennen echte Zeilenumbrüche, in der HTML-Fassung <br>-Marken;
   textContent klebt die Teile zusammen. Wer auf Wortgrenzen vergleicht, meldet dann
   Unterschiede, die auf dem Bildschirm keine sind - und wird nach dem dritten Fehlalarm
   weggeklickt. Verglichen wird deshalb die Buchstabenfolge. */
const eng = (x) => String(x == null ? '' : x)
  .replace(/ /g, ' ').replace(/\s+/g, '').replace(/[·•]/g, '');
const eur = (v) => Number(String(v).replace(/[^0-9,.]/g, '').replace(',', '.'));

/* ------------------------------------------------------------------ Quellen einlesen */
function original() {
  const t = fs.readFileSync(P('pc-manager/tv-designer/kasse-presentation-data.js'), 'utf8');
  return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
}
function stammdaten() {
  const t = fs.readFileSync(P('pos/app.js'), 'utf8');
  const i = t.indexOf('DEFAULT_PRODUCTS');
  let d = 0; const s = t.indexOf('[', i); let e = s;
  for (let k = s; k < t.length; k++) { if (t[k] === '[') d++; if (t[k] === ']') { d--; if (!d) { e = k; break; } } }
  const m = new Map();
  eval(t.slice(s, e + 1)).forEach((p) => { if (p && p.id && !m.has(p.id)) m.set(p.id, p); });
  return m;
}
function mitgliedsnamen() {
  const t = fs.readFileSync(P('pc-manager/kc-mitgliedsdaten.js'), 'utf8');
  return [...t.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]);
}

/* Der Auszug wird aus dem Original neu erzeugt - in eine EIGENE Datei, damit der
   gespeicherte Auszug die Vergleichsgrundlage bleibt und nicht sein eigenes Ergebnis. */
function auszugNeu() {
  const ziel = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kc-konsol-')), 'inhalt.json');
  execFileSync(process.execPath, [HOLER], { env: { ...process.env, KC_INHALT_ZIEL: ziel }, stdio: 'ignore' });
  return JSON.parse(fs.readFileSync(ziel, 'utf8'));
}

const V4 = original();
const STAMM = stammdaten();
const MITGLIEDER = mitgliedsnamen();
const AUSZUG_GESPEICHERT = JSON.parse(fs.readFileSync(AUSZUG, 'utf8'));

/* Aus dem Original die Vergleichswerte je Folie ziehen - dieselbe Sicht, die auch der
   Auszug erzeugt, aber hier unabhängig davon aus der Originaldatei. */
function sichtAufsOriginal(j) {
  return j.slides.map((s, n) => {
    const items = s.items || [];
    const ersterText = items.find((x) => x.type === 'text');
    const tab = items.find((x) => x.type === 'table');
    const ticker = items.find((x) => x.type === 'ticker');
    const namens = (name) => { const it = items.find((x) => x.name === name); return it ? String(it.text || '') : ''; };
    const e = {
      nr: n + 1, name: s.name || '', titel: ersterText ? String(ersterText.text || '') : '',
      laufschrift: ticker ? String(ticker.text || '') : '',
      effekt: (s.effectLayer && s.effectLayer.type) || 'none',
    };
    if (s.memberMeta) {
      e.art = 'mitglied'; e.mitglied = s.memberMeta.name;
      e.spruch = namens('member-quote'); e.hinweis = namens('reserve-note');
    } else if (tab) {
      e.art = 'tabelle';
      e.zeilen = (tab.tableData || []).map((z) => z.map((c) => String((c && c.text) || '')))
        .filter((z) => z.some((c) => c.trim()));
    } else {
      e.art = 'text';
      e.absaetze = items.filter((x) => x.type === 'text' && x !== ersterText)
        .map((x) => String(x.text || '')).filter(Boolean);
    }
    return e;
  });
}

/* Für die Gegenprobe wird NUR im Arbeitsspeicher verfälscht - nie in einer Datei.
   Verfälscht wird die ORIGINALSEITE: Die HTML-Datei liegt fertig auf der Platte, also muss
   der Vergleich anschlagen, sobald das Original von ihr abweicht. Genau das ist der Fall,
   den es morgen zu fangen gilt. */
if (GEGENPROBE) {
  const mitgliedsfolie = V4.slides.find((s) => s.memberMeta);
  mitgliedsfolie.memberMeta.name = 'Heinz Lunemann';
  const zitat = (mitgliedsfolie.items || []).find((x) => x.name === 'member-quote');
  if (zitat) zitat.text = 'Ein Spruch, den niemand gesagt hat.';
  const preisfolie = V4.slides.find((s) => (s.items || []).some((x) => x.type === 'table'
    && (x.tableData || []).some((z) => /Glühwein/i.test(String((z[0] || {}).text || '')))));
  const zeile = preisfolie.items.find((x) => x.type === 'table').tableData
    .find((z) => /Glühwein/i.test(String((z[0] || {}).text || '')));
  zeile[zeile.length - 1].text = '9,99';
  const textfolie = V4.slides.find((s) => !s.memberMeta && (s.items || []).filter((x) => x.type === 'text').length > 1);
  textfolie.items.filter((x) => x.type === 'text')[1].text = 'Ein Absatz, der so nirgends steht.';
  const ticker = (V4.slides[0].items || []).find((x) => x.type === 'ticker');
  if (ticker) ticker.text = 'Laufschrift verstellt';
  STAMM.get('grot').price = 9.99;
  MITGLIEDER.push('Heinz Lunemann');
}

const ORIGINAL = sichtAufsOriginal(V4);
const NACH_NR = new Map(ORIGINAL.map((f) => [f.nr, f]));

/* ================================================================== Lauf */
(async () => {
  /* ---------------------------------------------- 1. Der Zwischenstand ist kein eigener Stand */
  {
    const neu = auszugNeu();
    pruefe('Der Auszug hat so viele Folien wie das Original',
      neu.folien.length === V4.slides.length, neu.folien.length + ' vs ' + V4.slides.length);
    /* Der gespeicherte Auszug muss dem frisch gezogenen entsprechen. Weicht er ab, ist die
       HTML-Fassung aus einem alten Stand des Originals gebaut - und niemand sähe es. */
    const a = JSON.stringify(AUSZUG_GESPEICHERT.folien);
    const b = JSON.stringify(neu.folien);
    pruefe('Der gespeicherte Auszug ist auf dem Stand des Originals', a === b,
      a === b ? '' : 'kc-hg/inhalt.json ist veraltet – bauen.py neu laufen lassen');
    if (a !== b) {
      neu.folien.forEach((f, i) => {
        const alt = AUSZUG_GESPEICHERT.folien[i];
        if (JSON.stringify(alt) !== JSON.stringify(f)) rot.push('  Auszug weicht ab bei Folie ' + f.nr + ' · ' + f.name);
      });
    }
  }

  /* ---------------------------------------------- 2. Die HTML-Fassung im echten Browser lesen */
  if (!fs.existsSync(HTML)) {
    rot.push('Die HTML-Fassung liegt nicht unter ' + HTML);
    return fertig();
  }
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const seite = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const skriptfehler = [];
  seite.on('pageerror', (e) => skriptfehler.push(String(e).slice(0, 160)));
  await seite.goto('file://' + HTML);
  await seite.waitForTimeout(1500);
  /* Gelesen wird textContent, NICHT innerText.
     GEFUNDEN beim ersten Lauf: Mit innerText meldete diese Prüfung, in der HTML-Fassung
     fehlten ALLE 18 Sprüche. Sie fehlten nicht - innerText liefert für alles, was gerade
     nicht sichtbar ist, eine leere Zeichenkette, und sichtbar ist immer nur die aktuelle
     Folie. Wieder eine Prüfung, die am falschen Gegenstand gemessen hat. */
  const HTML_FOLIEN = await seite.evaluate(() => [...document.querySelectorAll('section.folie')].map((sec) => ({
    quelle: sec.dataset.quelle || '',
    h1: [...sec.querySelectorAll('h1')].map((x) => x.textContent),
    h2: [...sec.querySelectorAll('h2')].map((x) => x.textContent),
    absaetze: [...sec.querySelectorAll('p')].map((x) => x.textContent).filter((x) => x.trim()),
    zitat: [...sec.querySelectorAll('blockquote')].map((x) => x.textContent),
    unterschrift: [...sec.querySelectorAll('figcaption')].map((x) => x.textContent),
    wetter: [...sec.querySelectorAll('.wetterkarte')].map((x) => x.textContent),
    tabelle: [...sec.querySelectorAll('table')].map((t) => [...t.querySelectorAll('tr')]
      .map((r) => [...r.querySelectorAll('th,td')].map((c) => c.textContent))),
    laufschrift: (sec.querySelector('.laufschrift span') || { textContent: '' }).textContent,
    effekt: [...sec.querySelectorAll('.fx')].map((x) => x.className.replace('fx', '').trim()).join(' '),
  })));
  const ganzerText = await seite.evaluate(() => document.body.innerHTML
    .replace(/data:[^"')]+/g, '').replace(/<[^>]+>/g, ' '));
  await browser.close();

  pruefe('Die HTML-Fassung wirft keine Skriptfehler', skriptfehler.length === 0, skriptfehler[0]);

  /* ---------------------------------------------- 3. Jede Folie des Originals kommt genau einmal vor */
  /* Drei Sorten Folien, und jede muss sich benennen lassen:
       "7"                 eine Folie aus dem Original
       "bild:kc-besuch"    ein fertiges Bild des Betreibers
       "titel:impressionen" eine Kapitelfolie, die es nur in dieser Fassung gibt
     Wer nicht trennt, hält eine Kapitelfolie für eine Originalfolie - Number("titel:...")
     ist NaN, und der Vergleich liefe still ins Leere statt anzuschlagen. */
  const ausOriginal = HTML_FOLIEN.filter((f) => /^\d+$/.test(f.quelle));
  const bildfolien = HTML_FOLIEN.filter((f) => f.quelle.startsWith('bild:'));
  const kapitelfolien = HTML_FOLIEN.filter((f) => f.quelle.startsWith('titel:'));
  pruefe('Jede Folie ist einer der drei Sorten zuzuordnen',
    ausOriginal.length + bildfolien.length + kapitelfolien.length === HTML_FOLIEN.length,
    HTML_FOLIEN.filter((f) => !/^\d+$/.test(f.quelle) && !/^(bild|titel):/.test(f.quelle))
      .map((f) => f.quelle).join(', '));
  pruefe('Jede Folie trägt eine Rückverfolgung auf ihre Quelle',
    HTML_FOLIEN.every((f) => f.quelle), HTML_FOLIEN.filter((f) => !f.quelle).length + ' ohne data-quelle');
  pruefe('Die HTML-Fassung zeigt alle ' + ORIGINAL.length + ' Folien des Originals',
    ausOriginal.length === ORIGINAL.length, ausOriginal.length + ' gefunden');
  ORIGINAL.forEach((o) => {
    const treffer = ausOriginal.filter((f) => Number(f.quelle) === o.nr);
    pruefe('Folie ' + o.nr + ' („' + o.name + '“) kommt genau einmal vor', treffer.length === 1,
      treffer.length + '×');
  });
  /* Die fünf zusätzlichen Bildfolien sind gewollt - der Betreiber hat sie nachgereicht.
     Gewollt heißt: benannt und gezählt, nicht stillschweigend geduldet. */
  const ERWARTETE_BILDFOLIEN = ['kc-stand-2024', 'kc-kueche-2024', 'kc-gluehweinliste',
    'kc-besuch', 'kc-unterstuetzung'];
  pruefe('Genau die fünf nachgereichten Bildfolien kommen dazu',
    bildfolien.length === ERWARTETE_BILDFOLIEN.length, bildfolien.length + ' Bildfolien');
  ERWARTETE_BILDFOLIEN.forEach((b) => pruefe('Bildfolie „' + b + '“ ist enthalten',
    bildfolien.some((f) => f.quelle === 'bild:' + b)));
  const ERWARTETE_KAPITEL = ['impressionen'];
  pruefe('Genau die vorgesehenen Kapitelfolien kommen dazu',
    kapitelfolien.length === ERWARTETE_KAPITEL.length, kapitelfolien.length + ' Kapitelfolien');
  ERWARTETE_KAPITEL.forEach((k) => pruefe('Kapitelfolie „' + k + '“ ist enthalten',
    kapitelfolien.some((f) => f.quelle === 'titel:' + k)));
  const soll = ORIGINAL.length + ERWARTETE_BILDFOLIEN.length + ERWARTETE_KAPITEL.length;
  pruefe('Die HTML-Fassung hat ' + soll + ' Folien (' + ORIGINAL.length + ' + '
    + ERWARTETE_BILDFOLIEN.length + ' + ' + ERWARTETE_KAPITEL.length + ')',
    HTML_FOLIEN.length === soll, HTML_FOLIEN.length + '');

  /* ---------------------------------------------- 3b. Anfang und Ende
     BEFUND DES BETREIBERS, 04.09.2026: "bei der neuen Präsentation beginnt falsch. die muss
     auch mit der Begrüßungsfolie beginnen." Die vier Fotos standen auf Platz 2 bis 5 - die
     Begrüßung war zwar die erste Folie, aber danach kam der Rückblick, bevor sich der Club
     überhaupt vorgestellt hatte. Reihenfolge lässt sich nicht "sehen und für gut befinden";
     sie muss geprüft werden wie ein Preis. */
  pruefe('Die Vorführung beginnt mit der Begrüßungsfolie des Originals',
    HTML_FOLIEN[0] && HTML_FOLIEN[0].quelle === '1',
    'erste Folie: ' + (HTML_FOLIEN[0] || {}).quelle);
  pruefe('Auf die Begrüßung folgt kein Bilderblock, sondern Inhalt aus dem Original',
    HTML_FOLIEN[1] && /^\d+$/.test(HTML_FOLIEN[1].quelle),
    'zweite Folie: ' + (HTML_FOLIEN[1] || {}).quelle);
  pruefe('Die Vorführung endet mit der Dankesfolie des Originals',
    HTML_FOLIEN[HTML_FOLIEN.length - 1].quelle === String(ORIGINAL.length),
    'letzte Folie: ' + HTML_FOLIEN[HTML_FOLIEN.length - 1].quelle);
  /* BETREIBER, 04.09.2026: "die Folie der Kollege braucht Hilfe vor die Folie mit der
     Mitmachfolie". Erst der Hilferuf, dann das Angebot mitzumachen - vorher stand die
     Antwort vor der Frage. Auch das ist Reihenfolge, also geprüft und nicht besichtigt. */
  {
    const hilfe = HTML_FOLIEN.findIndex((f) => f.quelle === 'bild:kc-unterstuetzung');
    const mitmach = ORIGINAL.findIndex((f) => /mitmachen/i.test(f.name));
    const nummer = mitmach >= 0 ? String(ORIGINAL[mitmach].nr) : '';
    const wo = HTML_FOLIEN.findIndex((f) => f.quelle === nummer);
    pruefe('„Dieser Mann braucht Unterstützung“ steht unmittelbar vor der Mitmach-Folie',
      hilfe >= 0 && wo >= 0 && wo === hilfe + 1,
      'Hilfe auf Platz ' + (hilfe + 1) + ', Mitmachen auf Platz ' + (wo + 1));
  }

  /* Die Impressionen sind ein BLOCK: Kapitelfolie, dann die Fotos, ohne etwas dazwischen. */
  {
    const k = HTML_FOLIEN.findIndex((f) => f.quelle === 'titel:impressionen');
    const danach = HTML_FOLIEN.slice(k + 1, k + 4).map((f) => f.quelle);
    pruefe('Hinter der Kapitelfolie „Impressionen“ stehen nur Fotos',
      k > 0 && danach.length === 3 && danach.every((q) => q.startsWith('bild:')),
      danach.join(', '));
  }

  /* ---------------------------------------------- 4. Inhalt Zeichen für Zeichen */
  ausOriginal.forEach((h) => {
    const o = NACH_NR.get(Number(h.quelle));
    if (!o) return;
    const wo = 'Folie ' + o.nr + ' („' + o.name + '“)';
    const allesSichtbar = eng([...h.h1, ...h.h2, ...h.absaetze, ...h.zitat, ...h.wetter,
      ...h.unterschrift].join(''));

    if (o.art === 'mitglied') {
      pruefe(wo + ': derselbe Name in beiden Fassungen', eng(h.h2[0]) === eng(o.mitglied),
        'HTML „' + (h.h2[0] || '') + '“ vs Original „' + o.mitglied + '“');
      pruefe(wo + ': derselbe Spruch in beiden Fassungen', eng(h.zitat[0]) === eng(o.spruch),
        'HTML „' + String(h.zitat[0] || '').slice(0, 60) + '“ vs Original „' + String(o.spruch).slice(0, 60) + '“');
      if (o.hinweis) {
        pruefe(wo + ': der Hinweis „' + o.hinweis + '“ steht auch in der HTML-Fassung',
          allesSichtbar.includes(eng(o.hinweis)), 'HTML: ' + h.unterschrift.join(' '));
      }
    } else if (o.art === 'tabelle') {
      const htmlZeilen = (h.tabelle[0] || [])
        .map((z) => z.map((c) => eng(c).replace(/€$/, '')).filter(Boolean).join('|'))
        .filter(Boolean);
      const origZeilen = o.zeilen.map((z) => z.map(eng).filter(Boolean).join('|')).filter(Boolean);
      pruefe(wo + ': gleich viele Tabellenzeilen', htmlZeilen.length === origZeilen.length,
        'HTML ' + htmlZeilen.length + ' vs Original ' + origZeilen.length);
      origZeilen.forEach((z, i) => pruefe(wo + ': Tabellenzeile ' + (i + 1) + ' stimmt überein',
        htmlZeilen[i] === z, 'HTML „' + String(htmlZeilen[i] || '').slice(0, 70) + '“ vs Original „' + z.slice(0, 70) + '“'));
    } else {
      /* Folie 7 ist auch im Original ein reines Bild ohne Text - dann gibt es nichts zu
         vergleichen, und eine Prüfung darauf wäre eine erfundene Anforderung. */
      if (eng(o.titel)) {
        pruefe(wo + ': dieselbe Überschrift', allesSichtbar.includes(eng(o.titel)),
          'HTML „' + (h.h1[0] || '') + '“ vs Original „' + o.titel + '“');
      }
      (o.absaetze || []).forEach((a) => {
        if (!eng(a)) return;
        pruefe(wo + ': der Absatz „' + String(a).replace(/\s+/g, ' ').slice(0, 45) + '…“ steht auch in der HTML-Fassung',
          allesSichtbar.includes(eng(a)));
      });
    }
  });

  /* ---------------------------------------------- 5. Laufschrift */
  /* ERST FALSCH GEPRÜFT, DANN KORRIGIERT - das gehört hierher:
     Hier stand "das Original führt überall dieselbe Laufschrift". Das war eine erfundene
     Anforderung. Der Betreiber hat der Schlussfolie mit Absicht eine eigene gegeben:
     "Wir freuen uns auf ein Wiedersehen in 2027." Eine Prüfung, die Absicht als Fehler
     meldet, erzieht dazu, die Absicht wegzuräumen. Geprüft wird stattdessen, dass JEDE
     Fassung der Laufschrift auch in der HTML-Datei ankommt - genau daran ist die
     Wiedersehenszeile vorher verschwunden. */
  const laufschriftOriginal = ORIGINAL.map((f) => f.laufschrift).filter(Boolean);
  const fassungen = [...new Set(laufschriftOriginal)];
  pruefe('Jede Folie des Originals trägt eine Laufschrift',
    laufschriftOriginal.length === ORIGINAL.length,
    laufschriftOriginal.length + ' von ' + ORIGINAL.length);
  fassungen.forEach((t) => pruefe('Die Laufschrift „' + t.slice(0, 45) + '“ steht auch in der HTML-Fassung',
    ausOriginal.some((h) => eng(h.laufschrift).includes(eng(t)))));
  ausOriginal.forEach((h) => {
    const o = NACH_NR.get(Number(h.quelle));
    if (!o || !o.laufschrift) return;
    pruefe('Folie ' + o.nr + ': dieselbe Laufschrift in beiden Fassungen',
      eng(h.laufschrift).includes(eng(o.laufschrift)),
      'HTML „' + String(h.laufschrift).slice(0, 50) + '“');
  });

  /* ---------------------------------------------- 6. Effekte */
  {
    const schneeOriginal = ORIGINAL.filter((f) => f.effekt === 'snow').map((f) => f.nr);
    const feuerOriginal = ORIGINAL.filter((f) => f.effekt === 'fireworks').map((f) => f.nr);
    pruefe('Das Original hat Schneefall', schneeOriginal.length > 0);
    pruefe('Das Original hat ein Feuerwerk', feuerOriginal.length > 0);
    pruefe('Die HTML-Fassung hat Schneefall', HTML_FOLIEN.some((f) => /schnee/.test(f.effekt)));
    pruefe('Die HTML-Fassung hat ein Feuerwerk', HTML_FOLIEN.some((f) => /feuerwerk/.test(f.effekt)));
    const letzte = HTML_FOLIEN[HTML_FOLIEN.length - 1];
    pruefe('Das Feuerwerk liegt in beiden Fassungen auf der letzten Folie',
      /feuerwerk/.test(letzte.effekt) && feuerOriginal.includes(ORIGINAL.length),
      'HTML: ' + letzte.effekt + ' · Original: Folie ' + feuerOriginal.join(','));
  }

  /* ---------------------------------------------- 7. Beide Fassungen gegen die Stammdaten */
  {
    /* 7a. Namen: Jede Mitgliederfolie der HTML-Fassung muss einen Namen tragen, der in den
       Mitgliedsdaten steht - und jeder der 18 Namen muss vorkommen. */
    const htmlNamen = ausOriginal
      .filter((h) => NACH_NR.get(Number(h.quelle)) && NACH_NR.get(Number(h.quelle)).art === 'mitglied')
      .map((h) => String(h.h2[0] || '').trim());
    pruefe('Die HTML-Fassung zeigt 18 Mitgliederfolien', htmlNamen.length === 18, htmlNamen.length + '');
    htmlNamen.forEach((n) => pruefe('„' + n + '“ steht auch in den Mitgliedsdaten',
      MITGLIEDER.some((m) => eng(m) === eng(n))));
    MITGLIEDER.forEach((m) => pruefe('„' + m + '“ hat eine Folie in der HTML-Fassung',
      htmlNamen.some((n) => eng(n) === eng(m))));

    /* 7b. Preise: Jede Preiszeile der HTML-Fassung gegen den Kassenstamm. Der Gast liest auf
       der Leinwand den Artikelpreis; das Pfand steht als eigene Zeile darunter. */
    const ZUORDNUNG = {
      'RoterWinzerglühwein': 'grot', 'WeißerWinzerglühwein': 'gweiss', 'Eierlikörpunsch': 'eier',
      'Feuerzangenbowle': 'feuer', 'Grünkohlalacuisine': null,
      'Kartoffelmitkartoffelcreme': 'knirpsecreme', 'KartoffelmitHering': 'hering',
    };
    let verglichen = 0;
    ausOriginal.forEach((h) => {
      const o = NACH_NR.get(Number(h.quelle));
      if (!o || o.art !== 'tabelle') return;
      (h.tabelle[0] || []).forEach((z) => {
        const name = eng(z[0]);
        const id = ZUORDNUNG[name];
        if (!id || !STAMM.has(id)) return;
        verglichen++;
        const soll = Number(STAMM.get(id).price);
        pruefe('HTML-Fassung, Folie ' + o.nr + ': „' + String(z[0]).trim() + '“ zeigt den Kassenpreis',
          Math.abs(eur(z[z.length - 1]) - soll) < 0.001,
          'Folie ' + z[z.length - 1] + ' vs Kasse ' + soll.toFixed(2));
      });
    });
    pruefe('Es wurden Preiszeilen gegen die Kasse geprüft', verglichen >= 5, verglichen + ' Zeilen');

    /* 7c. Was nicht mehr vorkommen darf - in der HTML-Datei genauso wenig wie im Original. */
    [['Heinz Lunemann', /Lunemann/i], ['Kartoffelknirpse', /Knirpse(?!creme)/],
      ['Tzatziki', /Tzatziki/i], ['die alte Schreibweise „Kazig“', /Kaz[ig]g/],
      ['„Reserve 1/2“', /Reserve\s*[12]/]].forEach(([was, muster]) => {
      pruefe('„' + was + '“ kommt in der HTML-Fassung nicht vor', !muster.test(ganzerText));
    });
  }

  fertig();
})().catch((e) => { console.error(e); process.exit(1); });

function fertig() {
  console.log('\nKonsolidierung der beiden Präsentationen');
  console.log('  Original:      ' + ORIGINAL.length + ' Folien (kasse-presentation-data.js)');
  console.log('  HTML-Fassung:  ' + path.basename(HTML));
  console.log('\n  grün: ' + gruen + '   rot: ' + rot.length);
  if (rot.length) { console.log('\n  Abweichungen:'); rot.forEach((r) => console.log('   • ' + r)); }
  if (GEGENPROBE) {
    /* Bei der Gegenprobe ist ROT das erwartete Ergebnis. */
    console.log('\n  Gegenprobe: ' + (rot.length >= 5 ? 'bestanden – die Prüfung schlägt an.'
      : 'DURCHGEFALLEN – die Verfälschung wurde nicht bemerkt.'));
    process.exit(rot.length >= 5 ? 0 : 1);
  }
  process.exit(rot.length ? 1 : 0);
}
