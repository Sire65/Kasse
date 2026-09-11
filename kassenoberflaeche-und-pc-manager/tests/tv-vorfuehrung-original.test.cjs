/* Läuft die ORIGINALPRÄSENTATION wirklich - so, wie sie morgen laufen muss?   03.09.2026
 *
 * ANLASS (Betreiber): "meine alte Präsentation ist auch noch da und lauffähig? die muss ich
 * morgen zeigen. mit Schneefall, Laufschrift, keine verschobenen Texte, alles gerade und
 * ordentlich."
 *
 * Bisher habe ich seine Präsentation nur als DATEN geprüft - Namen, Preise, Positionen im
 * JSON. Das sagt nichts darüber, was der Beamer zeigt. Diese Prüfung startet deshalb die
 * echte TV-Vorführung im Browser, blättert jede einzelne der 37 Folien durch und misst am
 * gezeichneten Bild:
 *
 *   1. Kommt jede Folie überhaupt?
 *   2. Läuft auf jeder die Laufschrift - und bewegt sie sich wirklich?
 *   3. Schneit es auf der Willkommensfolie, und gibt es zum Schluss Feuerwerk?
 *   4. Steht alles GERADE: Überschriften auf einer Linie, nichts verschoben?
 *   5. Überlappt kein Text einen anderen, ragt nichts aus dem Bild?
 *   6. Sind alle Bilder wirklich geladen?
 *   7. Keine Skriptfehler, und läuft die Musik?
 *
 * Aufruf:  node tests/tv-vorfuehrung-original.test.cjs
 */
'use strict';
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

/* Die Prüfung lässt sich auch auf ein anderes Paket richten - gebraucht, um zu klären,
   ob ein Fund SCHON VORHER da war oder von meiner eigenen Änderung stammt:
     KC_PAKET=/pfad/zum/unberuehrten/stand node tests/tv-vorfuehrung-original.test.cjs */
const WURZEL = process.env.KC_PAKET || path.join(__dirname, '..');
const PORT = Number(process.env.KC_PORT || 8494);
const SCHUSS = process.env.KC_BILDER || path.join(__dirname, 'tuev', 'vorfuehrung-bilder');
/* Und auf eine EINZELNE Datei - die HTML-Fassung der Originalpräsentation, in der alles
   eingebettet ist. Sie wird über denselben kleinen Server ausgeliefert, damit die Prüfung
   ein und dieselbe bleibt: Was hier grün wird, ist am selben Maßstab gemessen wie das
   Studio, nicht an einem zweiten, milderen.
     KC_SEITE=/home/claude/KC_Original_Praesentation_EINE_DATEI.html node tests/... */
const EINZELSEITE = process.env.KC_SEITE || '';

let gruen = 0; const rot = [];
const p = (name, ok, zusatz) => { if (ok) gruen++; else rot.push(name + (zusatz ? '   [' + zusatz + ']' : '')); };

const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.bin': 'image/webp' };

(async () => {
  fs.mkdirSync(SCHUSS, { recursive: true });
  const server = http.createServer((req, res) => {
    if (EINZELSEITE && req.url.split('?')[0] === '/einzeldatei.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      fs.createReadStream(EINZELSEITE).pipe(res);
      return;
    }
    const datei = path.join(WURZEL, decodeURIComponent(req.url.split('?')[0]));
    if (!datei.startsWith(WURZEL) || !fs.existsSync(datei) || fs.statSync(datei).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(datei).pipe(res);
  }).listen(PORT);

  const browser = await chromium.launch();
  const seite = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const fehler = [];
  seite.on('pageerror', (e) => fehler.push(String(e).slice(0, 160)));
  const fehlendeBilder = [];
  seite.on('response', (r) => { if (r.status() >= 400 && /\.(png|jpe?g|webp|bin|mp3)/i.test(r.url())) fehlendeBilder.push(r.url().split('/').pop() + ' → ' + r.status()); });

  await seite.goto(EINZELSEITE ? `http://127.0.0.1:${PORT}/einzeldatei.html`
    : `http://127.0.0.1:${PORT}/pc-manager/tv-designer/KC_TV_START.html`);
  await seite.waitForTimeout(2500);

  /* Sie soll von selbst laufen - fürs Prüfen halten wir sie an und blättern von Hand. */
  await seite.evaluate(() => { const b = document.getElementById('tvPause'); if (b && b.textContent === 'Pause') b.click(); });
  await seite.waitForTimeout(400);

  const grund = await seite.evaluate(() => ({
    folien: (window.KC_DESIGNER_MARKET_PRESENTATION || {}).slides?.length || 0,
    name: (window.KC_DESIGNER_MARKET_PRESENTATION || {}).name || '',
    buehne: !!document.getElementById('tvStage'),
  }));
  console.log('Präsentation: „' + grund.name + '“ mit ' + grund.folien + ' Folien');
  p('Die Originalpräsentation ist geladen', grund.folien === 37, grund.folien + ' Folien');
  p('Die Vorführfläche ist da', grund.buehne);

  const titelPositionen = new Map();
  const laufschriftPositionen = new Map();
  let mitSchnee = 0, mitFeuerwerk = 0;
  const laufschriftFarben = new Map();

  /* WEITERGEBLÄTTERT WIRD ÜBER DEN KNOPF - und danach wird nachgesehen, ob die Folie WIRKLICH
     gewechselt hat.
     GEFUNDEN 03.09.2026: Mein erster Anlauf rief goToSlide() auf. Die Funktion liegt aber im
     inneren Bereich des Players, nicht am Fenster - der Aufruf lief ins Leere, die Vorführung
     blieb auf Folie 1 stehen, und 378 Prüfungen meldeten brav "grün", weil sie 37-mal dieselbe
     Folie gemessen haben. Deshalb wird jetzt der Zähler mitgelesen: Steht dort nicht die
     erwartete Nummer, ist der Lauf ungültig - eine Prüfung, die nicht weiterblättert, prüft
     nichts. */
  for (let n = 0; n < grund.folien; n++) {
    if (n > 0) {
      await seite.click('#tvNext');
      await seite.waitForTimeout(340);
    }
    const zaehler = await seite.evaluate(() => document.getElementById('tvCounter').textContent);
    const gezeigt = Number((zaehler.match(/Folie\s+(\d+)/) || [])[1] || 0);
    p('Folie ' + (n + 1) + ': die Vorführung ist wirklich dort angekommen', gezeigt === n + 1,
      'Zähler sagt: ' + zaehler);
    if (gezeigt !== n + 1) break;

    const m = await seite.evaluate(() => {
      const buehne = document.getElementById('tvStage');
      const br = buehne.getBoundingClientRect();
      /* Die Bühne wird skaliert - alles wird auf die Originalgröße 1280x720 zurückgerechnet,
         damit die Zahlen zu den Folienmaßen passen und nicht zur Fenstergröße. */
      const s = br.width / 1280;
      const kasten = (el) => { const r = el.getBoundingClientRect();
        return { x: (r.left - br.left) / s, y: (r.top - br.top) / s, b: r.width / s, h: r.height / s }; };
      const stuecke = [...buehne.querySelectorAll('.tvItem, [class*="tvItem"]')];
      const alle = stuecke.length ? stuecke : [...buehne.children].filter((c) => !c.classList.contains('tvBackground'));
      const beschreibe = (el) => ({
        k: kasten(el),
        text: (el.innerText || '').trim().slice(0, 40),
        klasse: el.className,
        sichtbar: getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 2,
        /* Wieviel vom Inhalt wird durch overflow:hidden weggeschnitten?
           Das ist die eigentliche Frage bei "alles ordentlich": Ein Kasten kann sauber im Bild
           liegen und trotzdem die halbe Preisliste verschlucken. Die Laufschrift ist ausgenommen -
           die läuft absichtlich über den Rand hinaus, das ist ihr Wesen. */
        beschnitten: /icker/i.test(el.className) ? 0
          : Math.max(0, el.scrollHeight - el.clientHeight, el.scrollWidth - el.clientWidth),
      });
      const laufschrift = buehne.querySelector('.tvTicker, [class*="icker"]');
      const schnee = buehne.querySelector('[class*="snow"], [class*="Snow"], .tvEffect');
      return {
        anzahl: alle.length,
        teile: alle.map(beschreibe).filter((x) => x.sichtbar),
        laufschrift: laufschrift ? { k: kasten(laufschrift), text: (laufschrift.innerText || '').trim().slice(0, 60),
          bewegt: !!getComputedStyle(laufschrift.firstElementChild || laufschrift).animationName &&
                  getComputedStyle(laufschrift.firstElementChild || laufschrift).animationName !== 'none' } : null,
        effekt: schnee ? schnee.className : '',
        effektAlle: [...buehne.querySelectorAll('[class*="ffect"], [class*="snow"], [class*="firework"]')].map((e) => e.className).join(' '),
        laufschriftFarbe: laufschrift ? getComputedStyle(laufschrift.firstElementChild || laufschrift).color : '',
        bilder: [...buehne.querySelectorAll('img')].map((b) => ({ ok: b.complete && b.naturalWidth > 0, src: b.src.split('/').pop() })),
        hintergrund: getComputedStyle(buehne.querySelector('.tvBackground') || buehne).backgroundImage,
      };
    });

    await seite.screenshot({ path: path.join(SCHUSS, 'folie-' + String(n + 1).padStart(2, '0') + '.png') });

    p('Folie ' + (n + 1) + ': zeigt Inhalt', m.teile.length > 0, m.anzahl + ' Bausteine');

    /* --- Laufschrift --- */
    p('Folie ' + (n + 1) + ': Laufschrift ist da', !!m.laufschrift, m.laufschrift ? '' : 'fehlt');
    if (m.laufschrift) {
      p('Folie ' + (n + 1) + ': Laufschrift trägt Text', m.laufschrift.text.length > 5, m.laufschrift.text);
      const schl = `${Math.round(m.laufschrift.k.x)},${Math.round(m.laufschrift.k.y)} ${Math.round(m.laufschrift.k.b)}x${Math.round(m.laufschrift.k.h)}`;
      laufschriftPositionen.set(schl, (laufschriftPositionen.get(schl) || 0) + 1);
    }

    /* --- Alles gerade: nichts ragt aus dem Bild --- */
    m.teile.forEach((t) => {
      p('Folie ' + (n + 1) + ': „' + (t.text || t.klasse).slice(0, 18) + '“ liegt im Bild',
        t.k.x >= -2 && t.k.y >= -2 && t.k.x + t.k.b <= 1282 && t.k.y + t.k.h <= 722,
        `${Math.round(t.k.x)},${Math.round(t.k.y)} ${Math.round(t.k.b)}x${Math.round(t.k.h)}`);
    });

    /* --- Nichts wird abgeschnitten --- */
    m.teile.forEach((tl) => {
      p('Folie ' + (n + 1) + ': „' + (tl.text || tl.klasse).slice(0, 20) + '“ ist nicht abgeschnitten',
        tl.beschnitten <= 2, tl.beschnitten + ' px fehlen');
    });

    /* --- Kein Text liegt auf einem anderen --- */
    const texte = m.teile.filter((t) => t.text && !/icker/i.test(t.klasse));
    for (let a = 0; a < texte.length; a++) {
      for (let b = a + 1; b < texte.length; b++) {
        const A = texte[a].k, B = texte[b].k;
        const ueberschneidung = Math.max(0, Math.min(A.x + A.b, B.x + B.b) - Math.max(A.x, B.x))
                              * Math.max(0, Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y));
        const kleiner = Math.min(A.b * A.h, B.b * B.h);
        p('Folie ' + (n + 1) + ': „' + texte[a].text.slice(0, 14) + '“ und „' + texte[b].text.slice(0, 14) + '“ liegen nicht übereinander',
          kleiner === 0 || ueberschneidung / kleiner < 0.12,
          Math.round(100 * ueberschneidung / Math.max(1, kleiner)) + ' % Überdeckung');
      }
    }

    /* --- Überschrift: steht sie auf allen Folien an derselben Stelle? --- */
    /* Die Laufschrift zählt hier NICHT als Überschrift.
       Folie 7 („Unser Tipp") ist ein fertiges Bild ohne eigenen Text - dort war das oberste
       Textstück die Laufschrift am unteren Rand, und die Prüfung meldete eine "verschobene
       Überschrift", die es nie gab. */
    const titel = m.teile.filter((t) => t.text && !/icker/i.test(t.klasse) && t.k.y < 600)
      .sort((a, b) => a.k.y - b.k.y)[0];
    if (titel && n > 0) {
      const schl = `${Math.round(titel.k.x)},${Math.round(titel.k.y)}`;
      titelPositionen.set(schl, (titelPositionen.get(schl) || 0) + 1);
    }

    if (/snow|schnee/i.test(m.effekt + ' ' + m.effektAlle)) mitSchnee++;
    if (/firework|feuerwerk/i.test(m.effekt + ' ' + m.effektAlle)) mitFeuerwerk++;
    if (m.laufschriftFarbe) laufschriftFarben.set(m.laufschriftFarbe, (laufschriftFarben.get(m.laufschriftFarbe) || 0) + 1);

    m.bilder.forEach((b) => p('Folie ' + (n + 1) + ': Bild „' + b.src + '“ ist geladen', b.ok));
    p('Folie ' + (n + 1) + ': hat einen Hintergrund', /url\(/.test(m.hintergrund), m.hintergrund.slice(0, 40));
  }

  /* --- Die Zusagen des Betreibers, zusammengefasst --- */
  console.log('\nLaufschrift-Positionen: ' + [...laufschriftPositionen.entries()].map(([k, v]) => k + ' auf ' + v + ' Folien').join(' | '));
  p('Die Laufschrift steht auf ALLEN Folien an derselben Stelle', laufschriftPositionen.size === 1,
    [...laufschriftPositionen.keys()].join(' / '));

  console.log('Überschriften-Positionen: ' + [...titelPositionen.entries()].map(([k, v]) => k + ' × ' + v).join(' | '));
  p('Die Überschriften stehen auf einer Linie (Folie 1 darf abweichen)', titelPositionen.size === 1,
    [...titelPositionen.entries()].map(([k, v]) => k + '×' + v).join(' / '));

  console.log('Laufschrift-Farben: ' + [...laufschriftFarben.entries()].map(([k, v]) => k + ' × ' + v).join(' | '));
  p('Es schneit mindestens auf einer Folie', mitSchnee > 0, mitSchnee + ' Folien mit Schnee');
  p('Zum Schluss gibt es Feuerwerk', mitFeuerwerk > 0, mitFeuerwerk + ' Folien mit Feuerwerk');

  /* Die Laufschrift laeuft ROT, nicht in dem Gold, das in der Praesentation eingestellt ist:
     kc-tv-player.css erzwingt color:#ff3b30 fuer die Laufschrift. Das ist eine bewusste
     Gestaltung im Freitagsstand (Leuchtschrift wie bei einem Nachrichtenband) und kein Fehler -
     der Kontrast liegt bei 5,85:1 und damit ueber der Grenze. Festgehalten wird es trotzdem,
     damit eine spaetere Aenderung auffaellt statt still zu geschehen. */
  p('Die Laufschrift hat auf allen Folien dieselbe Farbe', laufschriftFarben.size === 1,
    [...laufschriftFarben.keys()].join(' / '));

  p('Kein Bild und kein Ton fehlt (keine 404)', fehlendeBilder.length === 0, fehlendeBilder.slice(0, 4).join(' | '));

  /* --- Musik --- */
  await seite.mouse.click(800, 400);
  await seite.waitForTimeout(1600);
  const ton = await seite.evaluate(() => { const a = window.KCTVMusik && window.KCTVMusik.spieler;
    return a ? { da: true, laeuft: !a.paused, zeit: a.currentTime, laut: a.volume } : { da: false }; });
  p('Die Musik läuft', ton.da && ton.laeuft && ton.zeit > 0.2, JSON.stringify(ton));

  p('Keine Skriptfehler in der ganzen Vorführung', fehler.length === 0, fehler.slice(0, 3).join(' | '));

  await browser.close();
  server.close();

  console.log('\nVorführung der Originalpräsentation: ' + gruen + ' grün, ' + rot.length + ' rot');
  rot.slice(0, 25).forEach((r) => console.log('   ✗ ' + r));
  if (rot.length > 25) console.log('   … und ' + (rot.length - 25) + ' weitere');
  console.log('Bildschirmabzüge: tests/tuev/vorfuehrung-bilder/');
  process.exit(rot.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
