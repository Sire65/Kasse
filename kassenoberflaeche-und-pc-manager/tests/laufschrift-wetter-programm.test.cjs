/* Was die Laufschrift der HTML-Fassung zeigt - gemessen, nicht behauptet.   04.09.2026
 *
 * AUFTRAG DES BETREIBERS
 *   "Die Laufschrift muss was anderes zeigen wie das heutige Wetter mit Symbolen, das
 *    heutige Programm wie z.B. 15:00 Kindersingen, 18:00 Die Band."
 *
 * ZWEI DINGE, DIE MAN LEICHT FALSCH PRÜFT
 *
 * 1. Das Wetter kommt aus dem Netz. Auf dem Prüfrechner ist die Wetteradresse gesperrt -
 *    eine Prüfung, die nur hier läuft, sähe deshalb NIE ein Symbol und würde entweder
 *    ständig rot sein oder (schlimmer) so lange abgeschwächt, bis sie nichts mehr prüft.
 *    Deshalb wird die Antwort untergeschoben: Der Browser bekommt eine erfundene, aber
 *    vollständige Wetterantwort, und dann MUSS in der Laufschrift stehen, was daraus folgt.
 *    Zusätzlich wird der Fall OHNE Netz geprüft. Dort galt zuerst die Regel "lieber ein
 *    erklärender Satz als eine Lücke". Der Betreiber hat sie am 04.09.2026 umgedreht:
 *    "wenn keine Daten wie Wetter und Programm vorhanden sind, einfach leer lassen." Der
 *    Ersatzsatz machte das Band länger - und weil die Dauer fest war, damit auch schneller.
 *    Er hatte recht: Ein Feld, das nichts weiß, soll schweigen.
 *
 * 2. Das Programm steht schon auf einer Folie ("Bühnenprogramm heute"). Diese Prüfung tippt
 *    es NICHT ab, sondern liest es aus der Originalpräsentation und verlangt es in der
 *    Laufschrift. Sonst gäbe es den Programmplan zweimal - und wer die Folie ändert, hätte
 *    die Laufschrift vergessen. Genau dieses Muster hat diese Woche bei Namen und Preisen
 *    viermal zugeschlagen.
 *
 * Aufruf:  node tests/laufschrift-wetter-programm.test.cjs
 *          node tests/laufschrift-wetter-programm.test.cjs --gegenprobe
 * Bei der Gegenprobe wird das Programm im Arbeitsspeicher verändert; dann MUSS die Prüfung
 * rot werden. Eine Prüfung, die nie rot wird, ist keine.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const WURZEL = path.join(__dirname, '..');
const HTML = process.env.KC_HTML || '/home/claude/KC_Weihnachtsmarkt_2026_Praesentation.html';
const GEGENPROBE = process.argv.includes('--gegenprobe');

let gruen = 0; const rot = []; let ohneNetz = 0;
const pruefe = (name, ok, zusatz) => {
  if (ok) { gruen++; return; }
  rot.push(name + (zusatz ? '  →  ' + zusatz : ''));
};

/* Das heutige Programm aus SEINER Präsentation - dieselbe Stelle, aus der bauen.py es holt. */
function programmZeilen() {
  const t = fs.readFileSync(path.join(WURZEL, 'pc-manager/tv-designer/kasse-presentation-data.js'), 'utf8');
  const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  const folie = j.slides.find((s) => /programm/i.test(s.name || '') && /heute/i.test(s.name || ''));
  if (!folie) return [];
  const tab = (folie.items || []).find((x) => x.type === 'table');
  if (!tab) return [];
  return (tab.tableData || []).slice(1)
    .map((z) => ({
      zeit: String((z[0] || {}).text || '').trim(),
      was: String((z[1] || {}).text || '').trim().replace(/^•\s*/, ''),
    }))
    .filter((x) => x.zeit && x.was);
}

const PROGRAMM = programmZeilen();
if (GEGENPROBE && PROGRAMM.length) {
  PROGRAMM[0].was = 'Kindersingen mit dem Blockflötenkreis';
  PROGRAMM[0].zeit = '15:00';
}

/* Eine erfundene, aber vollständige Wetterantwort. Die Schlüssel stammen aus dem offenen
   Wetterdienst; 71 = Schnee, 3 = bewölkt - beides muss als Symbol UND als Wort ankommen. */
const WETTERANTWORT = {
  current: { temperature_2m: 2.4, weather_code: 71 },
  daily: {
    time: ['2026-12-05', '2026-12-06', '2026-12-07', '2026-12-08', '2026-12-09', '2026-12-10'],
    weather_code: [71, 3, 0, 61, 95, 2],
    temperature_2m_max: [3, 5, 6, 7, 8, 9],
    temperature_2m_min: [-2, -1, 0, 1, 2, 3],
  },
};

(async () => {
  if (!fs.existsSync(HTML)) { rot.push('Die HTML-Fassung liegt nicht unter ' + HTML); return fertig(); }
  const browser = await chromium.launch();

  /* ---------------------------------------------- 1. Ohne Netz: leer, nicht "leider" */
  {
    const seite = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await seite.route('**/api.open-meteo.com/**', (r) => r.abort());
    await seite.goto('file://' + HTML);
    await seite.waitForTimeout(2500);
    const stand = await seite.evaluate(() => {
      const band = document.querySelector('.laufschrift');
      const wetterfelder = [...document.querySelectorAll('.laufschrift .teil.wetter')];
      return {
        text: band.textContent,
        geladen: window.KCWetter && window.KCWetter.geladen,
        sichtbare: wetterfelder.filter((n) => !n.hidden).length,
        felder: wetterfelder.length,
        tempo: tempoMessen(),
      };
      function tempoMessen() {
        const l = document.querySelector('.laufschrift .band-lauf');
        const st = getComputedStyle(l);
        const strecke = parseFloat(st.getPropertyValue('--strecke'));
        return { strecke: Math.round(strecke), dauer: parseFloat(st.animationDuration),
          proSekunde: Math.round(strecke / parseFloat(st.animationDuration)) };
      }
    });
    pruefe('Ohne Netz meldet sich das Wetter als nicht geladen', stand.geladen === false);
    /* BETREIBER, 04.09.2026: "wenn keine Daten wie Wetter und Programm vorhanden sind,
       einfach leer lassen." Vorher stand hier ein Ersatzsatz; er machte das Band länger und
       sagte nichts aus. Jetzt MUSS das Feld verschwinden - und zwar wirklich verschwinden,
       nicht nur leer sein: Ein leeres Feld ließe sein Trennzeichen stehen. */
    pruefe('Ohne Netz ist kein Wetterfeld sichtbar', stand.sichtbare === 0,
      stand.sichtbare + ' von ' + stand.felder + ' sichtbar');
    pruefe('Ohne Netz steht KEIN Ersatztext im Band',
      !/nicht erreichbar|wird geladen|keine Daten/i.test(stand.text), stand.text.slice(0, 90));
    pruefe('Ohne Netz steht das Programm trotzdem im Band',
      PROGRAMM.every((p) => stand.text.includes(p.was)),
      PROGRAMM.map((p) => p.was).find((w) => !stand.text.includes(w)));
    /* Und der Lauf bleibt gleich schnell - er hängt nicht mehr an der Textlänge. */
    pruefe('Ohne Netz läuft das Band mit dem eingestellten Tempo',
      stand.tempo.proSekunde >= 45 && stand.tempo.proSekunde <= 60,
      stand.tempo.proSekunde + ' px/s');
    ohneNetz = stand.tempo.proSekunde;
    await seite.close();
  }

  /* ---------------------------------------------- 2. Mit untergeschobener Wetterantwort */
  {
    const seite = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await seite.route('**/api.open-meteo.com/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(WETTERANTWORT),
    }));
    await seite.goto('file://' + HTML);
    await seite.waitForTimeout(2500);
    const stand = await seite.evaluate(() => ({
      text: document.querySelector('.laufschrift span').textContent,
      geladen: window.KCWetter && window.KCWetter.geladen,
      laufschriften: [...document.querySelectorAll('section.folie')]
        .map((s) => { const n = s.querySelector('.laufschrift span'); return n ? n.textContent : null; }),
    }));
    const mit = stand.laufschriften.filter(Boolean);

    pruefe('Mit Antwort meldet sich das Wetter als geladen', stand.geladen === true);
    /* Symbol UND Wort - ein Symbol allein sagt einem Gast wenig, ein Wort allein war die
       alte Laufschrift. Der Betreiber wollte ausdrücklich Symbole. */
    [['Schneesymbol', '🌨️'], ['Wetterlage in Worten', 'Schnee'],
      ['aktuelle Temperatur', '2 °C'], ['Ausblick auf morgen', 'morgen'],
      ['Symbol für morgen', '☁️'], ['Wetterlage morgen', 'Bewölkt'],
      ['Spanne für morgen', '-1–5 °C']].forEach(([was, teil]) => {
      pruefe('Die Laufschrift zeigt ' + was + ' („' + teil + '“)', stand.text.includes(teil));
    });
    pruefe('Die Laufschrift nennt Werne beim Namen', /Wetter Werne/.test(stand.text));

    /* Das Programm - Zeit und Programmpunkt, aus seiner Folie gelesen. */
    pruefe('Es gibt überhaupt Programmzeilen zum Vergleichen', PROGRAMM.length >= 1,
      PROGRAMM.length + ' Zeilen');
    pruefe('Die Laufschrift kündigt das Bühnenprogramm an', /Heute auf der Bühne/.test(stand.text));
    PROGRAMM.forEach((p) => {
      pruefe('Programmpunkt „' + p.was.slice(0, 40) + '“ steht in der Laufschrift',
        stand.text.includes(p.was));
      const zeit = p.zeit.replace(/\s*Uhr\s*$/, '');
      pruefe('Uhrzeit „' + zeit + '“ steht in der Laufschrift', stand.text.includes(zeit));
    });

    /* Und zwar auf JEDER Folie, die eine Laufschrift hat - nicht nur auf der ersten. */
    pruefe('Es gibt Folien mit Laufschrift', mit.length >= 30, mit.length + ' Folien');
    pruefe('Das Wetter steht auf allen Folien mit Laufschrift',
      mit.every((t) => t.includes('Schnee')),
      mit.filter((t) => !t.includes('Schnee')).length + ' ohne Wetter');
    pruefe('Das Programm steht auf allen Folien mit Laufschrift',
      PROGRAMM.length === 0 || mit.every((t) => t.includes(PROGRAMM[0].was)),
      mit.filter((t) => !t.includes(PROGRAMM[0].was)).length + ' ohne Programm');
    /* Der Satz des Betreibers bleibt vorn - das Wetter hängt sich an, es verdrängt nicht. */
    pruefe('Der eigene Satz des Betreibers steht weiterhin vorn',
      /^Köcheclub Werne/.test(stand.text.trim()), stand.text.slice(0, 40));

    /* BETREIBER, 04.09.2026: "die Laufschrift ist zu schnell, bau langsamer."
       Die Ursache war nicht die Dauer, sondern die Rechnung: Vorher lief der Text in fester
       Zeit einmal um seine eigene Breite - je mehr drinstand, desto SCHNELLER lief er. Mit
       Wetter und Programm wurde er dadurch spürbar schneller als vorher. Geprüft wird
       deshalb nicht die Dauer, sondern die Geschwindigkeit, und dass sie NICHT davon
       abhängt, wie viel im Band steht. */
    const baender = await seite.evaluate(() => [...document.querySelectorAll('.laufschrift')].map((band) => {
      const l = band.querySelector('.band-lauf'); const st = getComputedStyle(l);
      const strecke = parseFloat(st.getPropertyValue('--strecke'));
      const erstes = l.querySelector('.stueck');
      return { strecke: Math.round(strecke), dauer: parseFloat(st.animationDuration),
        proSekunde: Math.round(strecke / parseFloat(st.animationDuration)),
        stueckBreite: Math.round(erstes.getBoundingClientRect().width),
        stuecke: l.querySelectorAll('.stueck').length,
        bandBreite: Math.round(band.getBoundingClientRect().width) };
    }));
    pruefe('Alle Bänder sind eingerichtet', baender.length >= 30 && baender.every((b) => b.strecke > 0),
      baender.filter((b) => !b.strecke).length + ' ohne Strecke');
    const tempi = [...new Set(baender.map((b) => b.proSekunde))];
    pruefe('Alle Bänder laufen gleich schnell', tempi.length === 1, tempi.join(', ') + ' px/s');
    pruefe('Das Band läuft gemächlich (45–60 px/s)',
      tempi[0] >= 45 && tempi[0] <= 60, tempi[0] + ' px/s');
    pruefe('Mit Wetter läuft es genauso schnell wie ohne', tempi[0] === ohneNetz,
      'mit ' + tempi[0] + ' px/s, ohne ' + ohneNetz + ' px/s');
    /* Nahtlos heißt: verschoben wird um genau EIN Stück, und es sind genug Stücke da, um
       die Breite zu füllen. Sonst springt der Lauf beim Neuanfang - genau das hat der
       Betreiber als "überlappt manchmal" gesehen. */
    pruefe('Verschoben wird um genau ein Textstück',
      baender.every((b) => Math.abs(b.strecke - b.stueckBreite) <= 1),
      baender.filter((b) => Math.abs(b.strecke - b.stueckBreite) > 1).length + ' abweichend');
    pruefe('Es sind genug Stücke da, um die Breite zu füllen',
      baender.every((b) => b.stuecke * b.stueckBreite >= b.bandBreite + b.stueckBreite),
      baender.filter((b) => b.stuecke * b.stueckBreite < b.bandBreite + b.stueckBreite).length + ' zu kurz');

    /* Effekte: der Betreiber wollte sie sehen. Gezählt, nicht besichtigt. */
    const effekte = await seite.evaluate(() => {
      const z = {};
      document.querySelectorAll('section.folie .fx').forEach((e) => {
        const art = e.className.replace('fx', '').trim();
        z[art] = (z[art] || 0) + 1;
      });
      return { arten: z, leer: [...document.querySelectorAll('section.folie .fx')].filter((e) => !e.children.length).length };
    });
    ['schnee', 'regen', 'glitzer', 'sterne', 'feuerwerk'].forEach((art) => {
      pruefe('Der Effekt „' + art + '“ kommt vor', (effekte.arten[art] || 0) >= 1,
        (effekte.arten[art] || 0) + '×');
    });
    pruefe('Jede Effektschicht hat auch Teilchen - keine ist leer', effekte.leer === 0,
      effekte.leer + ' leer');
    await seite.close();
  }

  await browser.close();
  fertig();
})().catch((e) => { console.error(e); process.exit(1); });

function fertig() {
  console.log('\nLaufschrift: Wetter und Programm');
  console.log('  grün: ' + gruen + '   rot: ' + rot.length);
  if (rot.length) { console.log('\n  Abweichungen:'); rot.forEach((r) => console.log('   • ' + r)); }
  if (GEGENPROBE) {
    console.log('\n  Gegenprobe: ' + (rot.length >= 2 ? 'bestanden – die Prüfung schlägt an.'
      : 'DURCHGEFALLEN – die Verfälschung wurde nicht bemerkt.'));
    process.exit(rot.length >= 2 ? 0 : 1);
  }
  process.exit(rot.length ? 1 : 0);
}
