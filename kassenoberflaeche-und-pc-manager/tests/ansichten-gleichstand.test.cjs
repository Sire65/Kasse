/* ANSICHTEN-GLEICHSTAND: alles, was verbessert wurde, muss in BEIDEN Kassenansichten da sein.

   WARUM DIESER TEST EXISTIERT
   Es gibt zwei Kassenansichten: die Standardansicht und die kompakte Ansicht (Body-Klasse
   kc-layout-neu). Mehrfach wurde eine Verbesserung nur in EINER von beiden gebaut - die
   Warengruppen-Knoepfe, die Anzahl-Anzeige, der Zeilenumbruch in den Stosszeiten. Der User
   arbeitet auf der STANDARDANSICHT; genau dort fehlten die Verbesserungen dann.
   Dieser Test misst dieselben Eigenschaften in beiden Ansichten und schlaegt aus, sobald
   eine von beiden zurueckfaellt. Er ersetzt kein Auge, aber er faengt das Muster ab. */
try { require.resolve('playwright'); } catch (e) { console.log('  ueberspringen: Playwright nicht installiert'); process.exit(0); }
const {chromium} = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const WURZEL = path.join(__dirname, '..');
const TYPEN = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml'};
const server = http.createServer((q, r) => {
  const p = path.join(WURZEL, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p, (e, d) => {
    if (e) { r.writeHead(404); return r.end('weg'); }
    r.writeHead(200, {'Content-Type': TYPEN[path.extname(p)] || 'application/octet-stream'});
    r.end(d);
  });
});
let fehler = 0;
const pruefe = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) fehler++; };

// Alles, was in einer Ansicht gemessen wird - fuer beide identisch.
const aufnehmen = (seite) => seite.evaluate(() => {
  const sichtbar = (n) => { if (!n) return false; const s = getComputedStyle(n), r = n.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
  const gruppen = [...document.querySelectorAll('#categories button')].map((n) => ({
    name: !!n.querySelector('.kategorie-name'),
    symbol: !!n.querySelector('.kategorie-bild'),
    anzahl: !!n.querySelector('.category-count'),
    anzahlZuletzt: [...n.children].pop()?.className === 'category-count',
    emoji: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(n.textContent || ''),
  }));
  const kacheln = [...document.querySelectorAll('.product-tile')];
  const rechtecke = kacheln.map((t) => t.getBoundingClientRect());
  let ueberlappungen = 0;
  for (let i = 0; i < rechtecke.length; i++) for (let j = i + 1; j < rechtecke.length; j++) {
    const a = rechtecke[i], b = rechtecke[j];
    if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 4 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 4) ueberlappungen++;
  }
  const ersteKachel = kacheln[0];
  const gitter = document.getElementById('productGrid');
  return {
    gruppen,
    gruppenLeisteHoehe: Math.round((document.getElementById('categories') || {getBoundingClientRect: () => ({height: 0})}).getBoundingClientRect().height),
    kachelZahl: kacheln.length,
    ueberlappungen,
    kachelRand: ersteKachel ? parseFloat(getComputedStyle(ersteKachel).borderTopWidth) : 0,
    kachelRandFarbe: ersteKachel ? getComputedStyle(ersteKachel).getPropertyValue('--gruppen-rand').trim() : '',
    // WICHTIG beim Messen: die gerade angetippte Kachel wird zur Rueckmeldung leicht
    // vergroessert (transform: scale) und ragt dadurch ein paar Pixel heraus - in der
    // kompakten Ansicht um 9 px. Das ist gewollte Optik, kein Layoutfehler. Deshalb wird
    // die Vergroesserung fuer die Messung kurz abgeschaltet und danach wiederhergestellt.
    kachelnAusserhalb: (() => {
      if (!gitter) return -1;
      // Ohne das Abschalten der Uebergangsanimation liefert die Messung noch den ALTEN,
      // vergroesserten Wert - die Aenderung wuerde erst in 0,1 s wirksam.
      const vorher = kacheln.map((t) => [t.style.transform, t.style.transition]);
      kacheln.forEach((t) => { t.style.transition = 'none'; t.style.transform = 'none'; });
      const g = gitter.getBoundingClientRect();
      const zahl = kacheln.filter((t) => { const r = t.getBoundingClientRect(); return r.bottom > g.bottom + 2 || r.top < g.top - 2; }).length;
      kacheln.forEach((t, i) => { t.style.transform = vorher[i][0]; t.style.transition = vorher[i][1]; });
      return zahl;
    })(),
    barKnopfDa: !!document.getElementById('cashChangeBtn'),
    barKnopfSichtbarOhneGeld: sichtbar(document.getElementById('cashChangeBtn')),
    modusText: (document.getElementById('modeStatus') || {}).innerText || '',
    qrModul: typeof (window.KCQrCode || {}).zeichne === 'function',
  };
});

(async () => {
  await new Promise((r) => server.listen(8479, r));
  const browser = await chromium.launch();
  const messwerte = {};

  for (const ansicht of ['standard', 'neu']) {
    const p = await browser.newPage({viewport: {width: 1900, height: 1030}});
    p.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
    await p.addInitScript(() => {
      localStorage.setItem('kc_master_v040', JSON.stringify({registerId: 'KASSE-01', pinLockEnabled: false}));
      // Aktionen aus: sonst haengt das Ergebnis an der Uhrzeit (Happy Hour 17-18 Uhr).
      localStorage.setItem('kc_offers_v100', '[]');
    });
    await p.goto('http://127.0.0.1:8479/pos/index.html');
    await p.waitForTimeout(1600);
    await p.evaluate(() => { const k = [...document.querySelectorAll('button')].find((x) => /KASSE STARTEN/i.test(x.textContent)); if (k) k.click(); });
    await p.waitForTimeout(900);
    await p.evaluate((a) => { document.body.classList.toggle('kc-layout-neu', a === 'neu'); }, ansicht);
    await p.waitForTimeout(600);
    await p.click('.product-tile');
    await p.waitForTimeout(400);
    // Zeiger wegbewegen: unter dem Mauszeiger wird die Kachel vergroessert dargestellt
    // (:hover mit transform). Das ist gewollte Rueckmeldung, verfaelscht aber jede Messung.
    await p.mouse.move(4, 4);
    await p.waitForTimeout(350);
    messwerte[ansicht] = await aufnehmen(p);
    await p.close();
  }

  for (const ansicht of ['standard', 'neu']) {
    const m = messwerte[ansicht];
    pruefe(`${ansicht}: jede Warengruppe hat Symbol, Namen und Anzahl`,
      m.gruppen.length > 0 && m.gruppen.every((g) => g.name && g.symbol && g.anzahl),
      `${m.gruppen.filter((g) => g.name && g.symbol && g.anzahl).length}/${m.gruppen.length}`);
    pruefe(`${ansicht}: die Anzahl steht ganz rechts`, m.gruppen.every((g) => g.anzahlZuletzt));
    pruefe(`${ansicht}: keine Farb-Emoji mehr in den Knöpfen`, m.gruppen.every((g) => !g.emoji));
    pruefe(`${ansicht}: die Warengruppenleiste hat Höhe`, m.gruppenLeisteHoehe > 20, `${m.gruppenLeisteHoehe} px`);
    pruefe(`${ansicht}: keine zwei Artikelkacheln überlappen sich`, m.ueberlappungen === 0, `${m.ueberlappungen}`);
    pruefe(`${ansicht}: keine Kachel ragt aus der Artikelfläche`, m.kachelnAusserhalb === 0, `${m.kachelnAusserhalb}`);
    pruefe(`${ansicht}: die Kacheln tragen den Farbrand der Warengruppe`,
      m.kachelRand >= 3 && !!m.kachelRandFarbe, `${m.kachelRand} px, Farbe "${m.kachelRandFarbe}"`);
    pruefe(`${ansicht}: der BAR-Knopf für das Rückgeld ist vorhanden`, m.barKnopfDa);
    pruefe(`${ansicht}: und ohne Geldeingabe unsichtbar`, m.barKnopfSichtbarOhneGeld === false);
    pruefe(`${ansicht}: die Modusanzeige nennt den Normalbetrieb`, /normal/i.test(m.modusText), m.modusText);
    pruefe(`${ansicht}: der gemeinsame QR-Zeichner ist geladen`, m.qrModul);
  }

  // Der eigentliche Punkt: die beiden Ansichten dürfen in diesen Eigenschaften nicht auseinanderlaufen.
  const s = messwerte.standard, n = messwerte.neu;
  pruefe('Beide Ansichten zeigen gleich viele Warengruppen', s.gruppen.length === n.gruppen.length, `${s.gruppen.length} / ${n.gruppen.length}`);
  pruefe('Beide Ansichten zeigen gleich viele Artikel', s.kachelZahl === n.kachelZahl, `${s.kachelZahl} / ${n.kachelZahl}`);
  pruefe('Beide Ansichten haben den Kachel-Farbrand',
    (s.kachelRand >= 3) === (n.kachelRand >= 3), `${s.kachelRand} / ${n.kachelRand}`);
  pruefe('Beide Ansichten sind frei von Überlappungen', s.ueberlappungen === 0 && n.ueberlappungen === 0);

  await browser.close();
  server.close();
  console.log(fehler ? `\n${fehler} FEHLER` : '\nAlles grün.');
  process.exit(fehler ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
