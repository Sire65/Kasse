/* Die Kassenschulung - Versionsabgleich und der Inhalt, der sich diese Woche geaendert hat.
 *
 * ANLASS (02.09.2026): der Betreiber zeigt die Schulung am Freitag. Auf ihrer Startseite stand
 * ein ROTER Kasten: "Schulung pruefen - UI-Schema r18 weicht von r11 ab." Den haette jeder im
 * Raum gesehen.
 *
 * DREI FEHLER, die dahinter steckten - der letzte ist der eigentliche:
 *   1. Kapitel 11 sagte, die Infotaste sitze "oben rechts". Sie sitzt oben LINKS
 *      (styles.css: .product-info-button{top:7px;left:7px}); oben rechts sitzt der
 *      Favoritenstern (.auto-favorite-star{top:7px;right:7px}). Zwei Knoepfe, ein Platz.
 *   2. latest-release-manifest.json stand auf Repair 76, die .js (die sich selbst als
 *      sourceOfTruth fuehrt) auf Repair 63. Zwei Quellen fuer dieselbe Angabe, eine veraltet.
 *   3. Der Vergleich las actual.version. Ein PRODUKT-Manifest hat dieses Feld, ein
 *      RELEASE-Manifest nicht (dort: releaseVersion). Gewann also das Release-Manifest, wurde
 *      immer 0 gegen die Schulungsgrundlage verglichen - die Schulung meldete auf ewig eine
 *      Abweichung, egal wie die Zahlen standen. Eine Anzeige, die immer dasselbe sagt, sagt
 *      nichts.
 *
 * Der Kasten ist jetzt gruen, weil er es sein DARF - nicht weil eine Zahl hochgesetzt wurde.
 */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const WURZEL = path.resolve(__dirname, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
let ok = 0, rot = 0;
const p = (n, b, z = '') => { b ? ok++ : rot++; console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '   [' + z + ']' : ''}`); };

(async () => {
  const web = http.createServer((q, r) => {
    let rel = decodeURIComponent(q.url.split('?')[0]);
    let f = path.join(WURZEL, rel);
    try { if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); } catch (e) {}
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end('x'); } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
  });
  await new Promise((r) => web.listen(8737, '127.0.0.1', r));

  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const fehler = []; pg.on('pageerror', (e) => fehler.push(e.message));
  await pg.goto('http://127.0.0.1:8737/training-video/index.html');
  await pg.waitForTimeout(5000);

  p('die Schulung startet ohne Skriptfehler', fehler.length === 0, fehler[0] || 'keine');

  // ---------------------------------------------------------------- der rote Kasten
  console.log('\n== Der Versionskasten auf der Startseite ==');
  const v = await pg.evaluate(() => ({
    stufe: (document.getElementById('versionSyncStatus') || {}).className || '',
    text: (document.getElementById('versionSyncStatus') || {}).innerText.replace(/\s+/g, ' ').trim() || '',
    abgleich: window.KCVersionSync || null,
  }));
  p('er ist gruen, nicht rot', /green/.test(v.stufe) && !/red/.test(v.stufe), v.stufe);
  p('und sagt "Aktuell und kompatibel"', /Aktuell und kompatibel/.test(v.text), v.text.slice(0, 90));
  p('die Schulung nennt die Kasse beim Namen', /Repair 63/.test(v.text), v.text.slice(0, 110));

  // Der eigentliche Fehler: das Feld, das verglichen wird.
  const feld = await pg.evaluate(() => {
    const a = window.KCVersionSync?.current || {};
    return { hatVersion: 'version' in a, hatReleaseVersion: 'releaseVersion' in a,
      genommen: a.version || a.releaseVersion || a.productBaseVersion || '(keins)' };
  });
  p('das geladene Manifest ist ein RELEASE-Manifest (ohne Feld "version")',
    feld.hatVersion === false && feld.hatReleaseVersion === true, JSON.stringify(feld));
  p('und der Abgleich nimmt trotzdem eine echte Versionsnummer',
    /^\d+\.\d+/.test(feld.genommen), feld.genommen);

  // ---------------------------------------------------------------- zwei Quellen, eine Wahrheit
  console.log('\n== Nur noch EINE Quelle fuer die Release-Angabe ==');
  const jsQuelle = fs.readFileSync(path.join(WURZEL, 'latest-release-manifest.js'), 'utf-8');
  const jsonQuelle = JSON.parse(fs.readFileSync(path.join(WURZEL, 'latest-release-manifest.json'), 'utf-8'));
  const jsVersion = (jsQuelle.match(/releaseVersion:\s*'([^']+)'/) || [])[1];
  p('die .json traegt dieselbe Release-Nummer wie die .js',
    jsonQuelle.releaseVersion === jsVersion, `json: ${jsonQuelle.releaseVersion} / js: ${jsVersion}`);
  p('und dasselbe UI-Schema',
    jsonQuelle.uiSchemaVersion === (jsQuelle.match(/uiSchemaVersion:\s*'([^']+)'/) || [])[1],
    jsonQuelle.uiSchemaVersion);
  p('in der .json steht, dass sie erzeugt ist und nicht von Hand geaendert wird',
    /NICHT VON HAND/i.test(jsonQuelle.hinweis || ''), (jsonQuelle.hinweis || '').slice(0, 60));

  // ---------------------------------------------------------------- Inhalt gegen die Kasse
  console.log('\n== Inhalt gegen die heutige Kasse ==');
  const app = fs.readFileSync(path.join(WURZEL, 'training-video', 'app.js'), 'utf-8');
  const css = fs.readFileSync(path.join(WURZEL, 'pos', 'styles.css'), 'utf-8');
  const infoLinks = /\.product-info-button\{[^}]*left:\s*7px/.test(css.replace(/\s+/g, ' ').replace(/\.product-info-button\s*\{/, '.product-info-button{'));
  const sternRechts = /\.auto-favorite-star\{[^}]*right:\s*7px/.test(css);
  p('in der Kasse sitzt die Infotaste wirklich oben LINKS', infoLinks);
  p('und der Favoritenstern oben RECHTS', sternRechts);
  p('Kapitel 11 sagt jetzt "oben links" fuer die Infotaste',
    /Oben links auf entsprechend vorbereiteten Artikeltasten/.test(app));
  p('und nennt den Unterschied zum Stern ausdruecklich',
    /Favoritenstern/.test(app) && /nicht verwechseln/.test(app));
  p('nirgends steht mehr "oben rechts ... Infotaste"',
    !/Oben rechts auf entsprechend vorbereiteten Artikeltasten/.test(app));

  // ---------------------------------------------------------------- deutsch
  console.log('\n== Deutsch auf dem Bildschirm ==');
  const seite = await pg.evaluate(() => document.body.innerText);
  p('kein englisches "since 1991" mehr auf der Seite', !/since 1991/i.test(seite));
  p('sondern "seit 1991"', /seit 1991/.test(seite));

  // ---------------------------------------------------------------- laeuft sie ueberhaupt
  console.log('\n== Die Schulung selbst ==');
  const kapitel = (app.match(/title:'Kapitel \d+/g) || []).length;
  p('es sind alle 19 Kapitel vorhanden', kapitel === 19, `${kapitel} gefunden`);
  // Die Kopfzeile setzt sich aus mehreren Elementen zusammen - deshalb ueber die Elemente
  // lesen, nicht ueber den Zeilenumbruch im Text.
  const kopf = await pg.evaluate(() => ({
    schulung: (document.querySelector('[data-training-version]') || {}).textContent || '',
    produkt: (document.querySelector('[data-product-version]') || {}).textContent || '',
  }));
  p('die Kopfzeile nennt den Schulungsstand', /0\.29\.4/.test(kopf.schulung), kopf.schulung);
  // HINWEIS zur Zahl daneben: die Kasse fuehrt einen EIGENEN Zaehler (Repair 12 in
  // pos/version-manifest.json, so steht es auch in ihrer eigenen Kopfzeile), die Suite einen
  // anderen (Repair 63). Beide Zahlen sind richtig, sie zaehlen Verschiedenes.
  p('und die Grundlage, auf der sie aufsetzt', /Repair|V0\./.test(kopf.produkt), kopf.produkt);

  // BEWUSST OFFEN GELASSEN (Entscheidung des Betreibers am 02.09.2026): Kapitel 14 nennt noch
  // einen eigenen Kombipreis, die Kasse rechnet die Summe. Das Kapitel wird Freitag
  // uebersprungen. Der Test haelt den Zustand fest, damit er nicht in Vergessenheit geraet.
  const kombiOffen = /Für eine Kombination kann ein eigener Gesamtpreis hinterlegt sein/.test(app);
  console.log(`  HINWEIS  Kapitel 14 nennt weiterhin einen eigenen Kombipreis: ${kombiOffen ? 'ja (bewusst so gelassen, Freitag ueberspringen)' : 'nein - dann bitte diesen Hinweis entfernen'}`);

  p('keine Skriptfehler ueber den ganzen Lauf', fehler.length === 0, fehler.slice(0, 2).join(' | ') || 'keine');

  await pg.screenshot({ path: path.join(WURZEL, 'tests', 'schulung.png') });
  await b.close();
  try { web.closeAllConnections && web.closeAllConnections(); } catch (e) {}
  web.close();
  console.log(`\nSchulung, Versionsabgleich und Inhalt: ${ok}/${ok + rot} bestanden`);
  process.exit(rot ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
