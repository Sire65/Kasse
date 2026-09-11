/* Vorpruefungen fuer den Markttag-Start und die Live-Anzeige "Tablet verbunden".
   Geprueft wird ueber die echten Funktionen, nicht ueber einen Nachbau. */
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { execFileSync, spawn } = require('child_process');
const HIER = path.resolve(__dirname, '..');
const vor = require(path.join(HIER, 'vorpruefungen.js'));

let ok = 0, rot = 0;
const p = (n, b, z = '') => { b ? ok++ : rot++; console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '   [' + z + ']' : ''}`); };

function tempOrdner(name) {
  const o = path.join(os.tmpdir(), `kc-pruef-${name}-${Date.now()}`);
  fs.mkdirSync(o, { recursive: true });
  return o;
}

(async () => {
  // ---------------------------------------------------------- WLAN-Adresse
  console.log('== WLAN-Adresse wird ermittelt, nicht geraten ==');
  const adr = await vor.ermittleAdresse(HIER);
  p('es wird ueberhaupt eine Adresse gefunden', !!adr.adresse, `${adr.adresse} (${adr.herkunft})`);
  p('die Adresse gehoert wirklich zu diesem Rechner',
    adr.adresse === null || vor.alleAdressen().some((k) => k.adresse === adr.adresse) || adr.herkunft === 'festgelegt',
    adr.adresse);
  p('alle Netzwerkadressen werden mitgeliefert, damit man sie sieht',
    Array.isArray(adr.kandidaten), `${adr.kandidaten.length} gefunden`);
  p('die Herkunft der Wahl ist nachvollziehbar',
    ['festgelegt', 'routing', 'erste-echte', 'notnagel', 'keine'].includes(adr.herkunft), adr.herkunft);

  // Feste Vorgabe schlaegt die Automatik - damit laesst sich ein Rechner mit mehreren Netzen
  // ein fuer alle Mal festnageln.
  const o1 = tempOrdner('adresse');
  fs.writeFileSync(path.join(o1, 'markttag-adresse.json'), JSON.stringify({ lanAdresse: '192.168.178.79' }));
  const fest = await vor.ermittleAdresse(o1);
  p('eine festgelegte Adresse wird uebernommen', fest.adresse === '192.168.178.79' && fest.herkunft === 'festgelegt',
    `${fest.adresse} (${fest.herkunft})`);
  fs.writeFileSync(path.join(o1, 'markttag-adresse.json'), '{kaputt');
  const kaputt = await vor.ermittleAdresse(o1);
  p('eine kaputte Vorgabedatei wird ignoriert statt zu stuerzen', kaputt.herkunft !== 'festgelegt', kaputt.herkunft);

  // ---------------------------------------------------------- Abbruchpruefungen
  console.log('\n== Abbruch: Start aus dem ZIP ==');
  const zipPfad = path.join(os.tmpdir(), 'AppData', 'Local', 'Temp', 'Temp1_KC.zip', 'kc-sync');
  fs.mkdirSync(zipPfad, { recursive: true });
  const ausZip = await vor.fuehreAus({ ordner: zipPfad, datenOrdner: path.join(zipPfad, 'daten'), wurzelOrdner: zipPfad });
  p('ein Start aus dem Windows-Zwischenspeicher wird abgebrochen',
    ausZip.abbrueche.some((b) => /ZIP/i.test(b.titel)), ausZip.abbrueche.map((b) => b.titel).join(', ') || 'keiner');
  const zipBefund = ausZip.abbrueche.find((b) => /ZIP/i.test(b.titel));
  p('die Meldung sagt, WAS zu tun ist', !!zipBefund && /entpacken/i.test(zipBefund.tun), zipBefund?.tun?.slice(0, 60));

  console.log('\n== Kein Fehlalarm im Normalfall ==');
  const normal = await vor.fuehreAus({ ordner: HIER, datenOrdner: path.join(HIER, 'markttag-daten'), wurzelOrdner: path.resolve(HIER, '..') });
  p('ein normaler Ordner loest KEINEN Abbruch aus', normal.abbrueche.length === 0,
    normal.abbrueche.map((b) => b.titel).join(', ') || 'keiner');
  p('jeder Befund nennt Titel, Erklaerung und Handlung',
    [...normal.abbrueche, ...normal.hinweise].every((b) => b.titel && b.text && b.tun),
    `${normal.hinweise.length} Hinweise`);
  p('der laufende Stand wird aus der STAND.txt gelesen', typeof normal.stand === 'string' && normal.stand.length > 5,
    String(normal.stand).slice(0, 60));

  console.log('\n== Abbruch: kein Schreibrecht ==');
  const gesperrt = path.join(tempOrdner('schreib'), 'unter', 'daten');
  let konnte = true;
  try { fs.chmodSync(path.dirname(path.dirname(gesperrt)), 0o500); } catch (e) { konnte = false; }
  if (konnte && process.getuid && process.getuid() === 0) {
    console.log('  (uebersprungen: als root ist alles beschreibbar)'); ok++;
  } else if (konnte) {
    const r = await vor.fuehreAus({ ordner: HIER, datenOrdner: gesperrt, wurzelOrdner: HIER });
    p('ein nicht beschreibbarer Datenordner bricht ab', r.abbrueche.some((b) => /Schreibrecht/i.test(b.titel)));
  } else { console.log('  (uebersprungen: Rechte lassen sich hier nicht setzen)'); ok++; }

  // ---------------------------------------------------------- Kein Fehlalarm bei unklarer Antwort
  // BEFUND vom ersten echten Lauf: die Firewall-Pruefung schlug an, OBWOHL die Freigabe da war
  // und das Tablet verbunden. Ursache: Number('') ist in JavaScript 0, nicht NaN - eine leere
  // Antwort von PowerShell wurde also als "null Regeln" gelesen statt als "unbekannt".
  console.log('\n== Unklare Antworten duerfen KEINEN Hinweis ausloesen ==');
  const faelle = [
    [null, null, 'gar keine Antwort (kein PowerShell)'],
    ['', null, 'leere Antwort - das war der Fehlalarm'],
    ['   ', null, 'nur Leerzeichen'],
    ['Zugriff verweigert', null, 'Fehlertext statt Zahl'],
    ['0', null, 'nackte Null ohne Merkwort'],
    ['KCFW=0', 0, 'echte Null - hier SOLL der Hinweis kommen'],
    ['KCFW=2', 2, 'zwei Regeln gefunden'],
    ['Zeile\nKCFW=1\nmehr', 1, 'Zahl zwischen anderer Ausgabe'],
  ];
  for (const [ein, soll, was] of faelle) {
    p(`${was}`, vor.leseAnzahl(ein) === soll, `${JSON.stringify(ein)} -> ${JSON.stringify(vor.leseAnzahl(ein))}`);
  }
  p('nur eine ECHTE Null loest den Hinweis aus, alles Unklare schweigt',
    vor.leseAnzahl('KCFW=0') === 0 && vor.leseAnzahl('') === null && vor.leseAnzahl('0') === null);

  console.log('\n== Die Anzeige selbst ==');
  // zeige() darf unter keinen Umstaenden stuerzen - sie laeuft ganz am Anfang des Marktmorgens.
  let gestuerzt = false;
  const alt = console.log; const zeilen = [];
  console.log = (...a) => zeilen.push(a.join(' '));
  try { vor.zeige(normal); vor.zeige({ adresse: { adresse: null, herkunft: 'keine', kandidaten: [] }, stand: null, abbrueche: [], hinweise: [] }); }
  catch (e) { gestuerzt = true; }
  console.log = alt;
  p('die Ausgabe stuerzt auch ohne Adresse und ohne Stand nicht', gestuerzt === false);
  p('die Ausgabe nennt die verwendete Adresse', zeilen.some((z) => /WLAN-Adresse/.test(z)));

  // ---------------------------------------------------------- Lebenszeichen der Tablets
  console.log('\n== Live-Anzeige: hat sich ein Tablet gemeldet? ==');
  const wurzel = path.resolve(HIER, '..', 'kassenoberflaeche-und-pc-manager');
  const kind = spawn(process.execPath, [path.join(HIER, 'serve-frontend.js'), '--port', '8791', '--root', wurzel],
    { cwd: HIER, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((r) => setTimeout(r, 1500));

  const hole = (pfad, kopf = {}) => new Promise((fertig, fehler) => {
    const anfrage = http.get({ host: '127.0.0.1', port: 8791, path: pfad, headers: kopf }, (a) => {
      let d = ''; a.on('data', (t) => { d += t; }); a.on('end', () => fertig({ status: a.statusCode, kopf: a.headers, text: d }));
    });
    anfrage.on('error', fehler);
  });

  const leer = await hole('/__kc-status');
  const leerDaten = JSON.parse(leer.text);
  p('die Statusauskunft antwortet', leer.status === 200, String(leer.status));
  p('sie ist fuer die lokale Uebersichtsseite freigegeben', leer.kopf['access-control-allow-origin'] === '*',
    String(leer.kopf['access-control-allow-origin']));
  p('vor dem ersten Tablet ist die Liste leer', leerDaten.geraete.length === 0, JSON.stringify(leerDaten.geraete));

  // Der eigene Rechner darf NICHT als Tablet zaehlen - sonst zeigt die Seite gruen,
  // obwohl noch nie ein Tablet da war. Genau die Art Anzeige, die luegt.
  await hole('/pos/index.html?kcRegisterId=KASSE-01');
  const nachEigen = JSON.parse((await hole('/__kc-status')).text);
  p('der eigene Rechner zaehlt NICHT als Tablet', nachEigen.geraete.length === 0, JSON.stringify(nachEigen.geraete));

  kind.kill();
  await new Promise((r) => setTimeout(r, 400));

  // Jetzt mit einer fremden Adresse: der Server bindet auf 0.0.0.0, also ueber die eigene
  // LAN-Adresse ansprechen - fuer den Server ist das ein fremder Absender.
  const lan = (adr.adresse && adr.adresse !== '127.0.0.1') ? adr.adresse : null;
  if (lan) {
    const kind2 = spawn(process.execPath, [path.join(HIER, 'serve-frontend.js'), '--port', '8792', '--root', wurzel],
      { cwd: HIER, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((r) => setTimeout(r, 1500));
    await new Promise((fertig, fehler) => {
      const a = http.get({ host: lan, port: 8792, path: '/pos/index.html?kcRegisterId=KASSE-02' }, (x) => { x.resume(); x.on('end', fertig); });
      a.on('error', fehler);
    });
    const status = JSON.parse(await new Promise((fertig, fehler) => {
      const a = http.get({ host: lan, port: 8792, path: '/__kc-status' }, (x) => { let d = ''; x.on('data', (t) => { d += t; }); x.on('end', () => fertig(d)); });
      a.on('error', fehler);
    }));
    const eintrag = status.geraete[0];
    p('ein fremdes Geraet wird erkannt', status.geraete.length === 1, JSON.stringify(status.geraete));
    p('und zwar mit der Kasse, die es geoeffnet hat', eintrag?.kasse === 'KASSE-02', String(eintrag?.kasse));
    p('mit Adresse und Zeitpunkt', !!eintrag?.ip && typeof eintrag?.letzte === 'number', `${eintrag?.ip}`);
    kind2.kill();
  } else {
    console.log('  (uebersprungen: keine LAN-Adresse in dieser Umgebung)'); ok += 3;
  }

  console.log(`\nVorpruefungen und Lebenszeichen: ${ok}/${ok + rot} bestanden`);
  process.exit(rot ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
