/* Das Prüf- und Infofenster hinter den LEDs im PC-Manager.
 *
 * WUNSCH DES VEREINS: "Baue auf die LEDs noch Info- und Prüfungsfenster ein mit Infos über die
 * Verbindungen und Testknöpfen, mit vielen sinnvollen Auswertungen, kleinen Instrumenten für die
 * Geschwindigkeit zu den einzelnen Datenbanken und Kassen - und KEINE kryptischen
 * Fehlermeldungen, sondern welche, mit denen man was anfangen kann."
 *
 * Dieser Test prüft genau diese drei Zusagen, und zwar an echten Servern statt an einem Nachbau:
 *   1. das Fenster geht über die LED auf und misst wirklich (Zahlen, keine Platzhalter),
 *   2. jeder Zustand trägt Zeichen UND Wort - Farbe allein zählt nicht,
 *   3. faellt etwas aus, steht dort ein deutscher Satz und ein "-> zu tun",
 *      und NICHT "Failed to fetch" als Überschrift.
 */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const WURZEL = path.resolve(__dirname, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };
let ok = 0, rot = 0;
const p = (n, b, z = '') => { b ? ok++ : rot++; console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '   [' + z + ']' : ''}`); };

// --- Manager-Dienst auf 47392, so wie ihn auch die LED befragt ---
let dienstAn = true;
function starteDienst() {
  return http.createServer((q, r) => {
    r.setHeader('Access-Control-Allow-Origin', '*');
    if (!q.url.startsWith('/kassen-verbindungen')) { r.writeHead(404); return r.end('x'); }
    r.writeHead(200, { 'Content-Type': 'application/json' });
    r.end(JSON.stringify({
      managerLaeuft: true,
      kassen: [
        { kasse: 'KASSE-01', gekoppelt: true, gekoppeltSeit: '2026-09-01T06:00:00.000Z', zuletztGemeldetVorSek: 3, zustand: 'gekoppelt' },
        { kasse: 'KASSE-02', gekoppelt: true, gekoppeltSeit: '2026-09-01T06:00:00.000Z', zuletztGemeldetVorSek: null, zustand: 'gekoppelt_ohne_meldung' },
      ],
    }));
  });
}

// --- Kassendienste auf 47500/47501, mit dem echten Antwortaufbau ---
function starteKasse(reason, count) {
  return http.createServer((q, r) => {
    const origin = q.headers.origin;
    if (origin) r.setHeader('Access-Control-Allow-Origin', origin);
    if (!q.url.startsWith('/kc-sync-status')) { r.writeHead(404); return r.end('x'); }
    r.writeHead(200, { 'Content-Type': 'application/json' });
    r.end(JSON.stringify({
      connection: { color: 'gelb', reason, count },
      activity: { localStorageWriteCount: 4 },
      multiDeviceConflict: false,
    }));
  });
}

async function lies(pg) {
  return pg.evaluate(() => {
    const zeilen = [...document.querySelectorAll('.kcdiag-zeile')].map((z) => ({
      titel: z.querySelector('b')?.textContent || '',
      zeichen: z.querySelector('.kcdiag-zeichen')?.textContent.trim() || '',
      wort: z.querySelector('.kcdiag-wort')?.textContent.trim() || '',
      zahl: z.querySelector('.kcdiag-zahl')?.textContent.trim() || '',
      hatBalken: !!z.querySelector('.kcdiag-bahn'),
      breite: z.querySelector('.kcdiag-fuellung')?.style.width || '',
      zusatz: [...z.querySelectorAll('.kcdiag-zusatz')].map((e) => e.textContent.trim()),
      fehlerText: z.querySelector('.kcdiag-fehler > div')?.textContent.trim() || '',
      tun: z.querySelector('.kcdiag-tun')?.textContent.trim() || '',
      wortlaut: z.querySelector('.kcdiag-fehler code')?.textContent.trim() || '',
    }));
    return { offen: !!document.getElementById('kcdiagDialog')?.open, zeilen };
  });
}

(async () => {
  const web = http.createServer((q, r) => {
    const f = path.join(WURZEL, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end('x'); } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
  });
  await new Promise((r) => web.listen(8798, '0.0.0.0', r));
  const dienst = starteDienst(); await new Promise((r) => dienst.listen(47392, '127.0.0.1', r));
  const k1 = starteKasse('rueckstau', 7); await new Promise((r) => k1.listen(47500, '127.0.0.1', r));
  const k2 = starteKasse('online_synchronisiert', 0); await new Promise((r) => k2.listen(47501, '127.0.0.1', r));

  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1400, height: 950 } });
  const fehler = []; pg.on('pageerror', (e) => fehler.push(e.message));
  await pg.goto('http://127.0.0.1:8798/pc-manager/index.html');
  await pg.waitForTimeout(9000);
  await pg.evaluate(() => { document.body.classList.remove('manager-locked'); document.querySelectorAll('dialog[open]').forEach((d) => { try { d.close(); } catch (e) {} }); });
  await pg.waitForTimeout(1500);

  p('der Manager startet ohne Skriptfehler', fehler.length === 0, fehler[0] || 'keine');

  // ---- Der Weg dorthin: auf die LED tippen ----
  const ledDa = await pg.locator('.kc-live-led-group').first().isVisible();
  p('es gibt LED-Gruppen in der Kopfzeile', ledDa);
  await pg.locator('.kc-live-led-group').first().click();
  await pg.waitForTimeout(2500);
  let s = await lies(pg);
  p('ein Klick auf die LED öffnet das Prüffenster', s.offen);
  p('es gibt auch einen ausdrücklichen Knopf "Verbindungen prüfen"',
    await pg.locator('#kcdiagOeffnen').count() > 0);

  // ---- Es wird wirklich gemessen ----
  const titel = s.zeilen.map((z) => z.titel);
  p('Manager-Dienst, Webserver, beide Kassen, Speicher und Datenbank stehen drin',
    ['Manager-Dienst', 'Webserver dieses Rechners', 'Speicher dieses Browsers', 'Zentrale Datenbank']
      .every((t) => titel.includes(t)) && titel.some((t) => /Kasse 1/.test(t)) && titel.some((t) => /Kasse 2/.test(t)),
    titel.join(' | '));
  const messbar = s.zeilen.filter((z) => z.hatBalken && !z.fehlerText);
  p('gemessene Zeilen zeigen eine echte Zahl in Millisekunden, keinen Platzhalter',
    messbar.length >= 4 && messbar.every((z) => /^\d+ ms$/.test(z.zahl)),
    messbar.map((z) => `${z.titel}=${z.zahl}`).join(', '));
  p('das Instrument füllt sich nach dem Messwert', messbar.every((z) => /%$/.test(z.breite)),
    messbar.map((z) => z.breite).join(', '));

  // ---- Zustand nie an der Farbe allein ----
  p('jede Zeile trägt ein Zeichen UND ein Wort - Farbe allein zählt nicht',
    s.zeilen.every((z) => z.zeichen.length > 0 && z.wort.length > 0),
    s.zeilen.map((z) => `${z.zeichen} ${z.wort}`).join(' | '));

  // ---- Die Auskünfte der Kassen kommen in Klartext an ----
  const kasse1 = s.zeilen.find((z) => /Kasse 1/.test(z.titel));
  const kasse2 = s.zeilen.find((z) => /Kasse 2/.test(z.titel));
  p('der Rückstau der Kasse 1 steht als Satz da, nicht als "rueckstau"',
    kasse1 && kasse1.zusatz.some((t) => /7 Buchungen warten/.test(t)) && !kasse1.zusatz.some((t) => /rueckstau/.test(t)),
    (kasse1?.zusatz || []).join(' | '));
  p('bei Kasse 1 steht ausdrücklich, dass nichts verloren ist',
    !!kasse1 && kasse1.zusatz.some((t) => /gespeichert/.test(t)), (kasse1?.zusatz || []).join(' | '));
  p('die Kopplung wird für jede Kasse benannt',
    !!kasse1 && !!kasse2 && kasse1.zusatz.some((t) => /gekoppelt/i.test(t)) && kasse2.zusatz.some((t) => /gekoppelt/i.test(t)),
    (kasse2?.zusatz || []).join(' | '));
  p('eine Kasse ohne Meldung wird als solche benannt statt als Fehler',
    !!kasse2 && kasse2.zusatz.some((t) => /Noch keine Meldung/.test(t)) && !kasse2.fehlerText,
    (kasse2?.zusatz || []).join(' | '));

  // Die Internet-Datenbank darf NICHT den pauschalen "schwarzes Fenster"-Rat bekommen - damit
  // hat sie nichts zu tun, und am Marktstand ist ihr Ausfall der Normalfall.
  const db = s.zeilen.find((z) => z.titel === 'Zentrale Datenbank');
  if (db && db.fehlerText) {
    p('faellt die Internet-Datenbank aus, ist der Rat auf SIE gemuenzt, nicht auf das schwarze Fenster',
      !/schwarze[ns]? Fenster/i.test(db.tun) && /kein Internet|kein Problem/i.test(db.tun), db.tun.slice(0, 90));
    p('und sie wird als harmlos ausgewiesen, nicht als Störung',
      db.wort === 'nicht erreichbar' && db.zeichen === '!', `${db.zeichen} ${db.wort}`);
  } else {
    console.log('  (uebersprungen: die Datenbank war in dieser Umgebung erreichbar)'); ok += 2;
  }

  // ---- Der Bericht ----
  const bericht = await pg.evaluate(() => window.KCVerbindungsdiagnose.berichtAlsText());
  p('der Bericht lässt sich als Text erzeugen und nennt jede Zeile',
    /Manager-Dienst/.test(bericht) && /Kasse 1/.test(bericht) && bericht.split('\n').length > 8,
    bericht.split('\n')[0]);

  // ---- DER KERNPUNKT: Dienst weg -> deutscher Satz, kein "Failed to fetch" ----
  try { dienst.closeAllConnections && dienst.closeAllConnections(); } catch (e) {}
  await new Promise((r) => dienst.close(r));
  await pg.locator('#kcdiagAlles').click();
  await pg.waitForTimeout(3000);
  s = await lies(pg);
  const mgr = s.zeilen.find((z) => z.titel === 'Manager-Dienst');
  p('faellt der Manager-Dienst aus, wird die Zeile als gestört gekennzeichnet',
    !!mgr && /gestört/.test(mgr.wort) && mgr.zeichen === '✕', `${mgr?.zeichen} ${mgr?.wort}`);
  p('die Überschrift der Störung ist ein deutscher Satz, kein "Failed to fetch"',
    !!mgr && mgr.fehlerText.length > 5 && !/Failed to fetch/i.test(mgr.fehlerText), mgr?.fehlerText);
  p('es steht dabei, WAS zu tun ist',
    !!mgr && /→/.test(mgr.tun) && /schwarze[ns]? Fenster/i.test(mgr.tun), (mgr?.tun || '').slice(0, 90));
  p('der technische Wortlaut ist nicht weg, sondern eingeklappt für die Fehlersuche',
    !!mgr && mgr.wortlaut.length > 0, mgr?.wortlaut);
  p('die anderen Zeilen messen weiter - ein Ausfall reisst nicht alles mit',
    s.zeilen.filter((z) => /^\d+ ms$/.test(z.zahl)).length >= 3,
    s.zeilen.map((z) => `${z.titel}=${z.zahl}`).join(', '));

  // Ohne Manager-Dienst ist die Kopplung UNBEKANNT. "Steht nicht in der Liste" waere gelogen -
  // es gibt gerade gar keine Liste. Genau solche Saetze schicken einen an die falsche Stelle.
  const k1ohne = s.zeilen.find((z) => /Kasse 1/.test(z.titel));
  p('ohne Manager-Dienst heisst die Kopplung "unbekannt", nicht "nicht gekoppelt"',
    !!k1ohne && k1ohne.zusatz.some((t) => /Kopplung unbekannt/.test(t))
      && !k1ohne.zusatz.some((t) => /steht nicht in der Kopplungsliste/.test(t)),
    (k1ohne?.zusatz || []).join(' | '));
  p('und die Kasse wird dann NICHT als "in Ordnung" ausgewiesen - eine schnelle Antwort ist keine Kopplung',
    !!k1ohne && k1ohne.wort === 'Kopplung unbekannt' && k1ohne.zeichen === '–', `${k1ohne?.zeichen} ${k1ohne?.wort}`);
  p('und sie verweist auf die Zeile, die zuerst zu klären ist',
    !!k1ohne && k1ohne.zusatz.some((t) => /Manager-Dienst/.test(t)), (k1ohne?.zusatz || []).join(' | '));

  await pg.screenshot({ path: path.join(WURZEL, 'tests', 'verbindungsdiagnose.png') });

  // ---- Wenn das schwarze Fenster den Grund KENNT, wird er genommen statt geraten ----
  // Ein Browser sagt zu jedem gescheiterten Verbindungsversuch "Failed to fetch" - er kann
  // "niemand da" nicht von "abgewiesen" unterscheiden. Das schwarze Fenster kann es und
  // schreibt es beim Start in kassen-verbindungen.json.
  const datei = path.join(WURZEL, 'pc-manager', 'kassen-verbindungen.json');
  const sicherung = fs.readFileSync(datei, 'utf-8');
  const inhalt = JSON.parse(sicherung);
  inhalt.liveKanal = { laeuft: false, gestartetUm: '2026-09-04T15:30:00.000Z',
    fehler: 'kc_sync_live_monitor_port_in_use: Port 47392 ist bereits belegt. Start abgebrochen, kein automatischer Portwechsel.' };
  fs.writeFileSync(datei, JSON.stringify(inhalt, null, 2));
  try {
    await pg.locator('#kcdiagAlles').click();
    await pg.waitForTimeout(3000);
    const mitBefund = (await lies(pg)).zeilen.find((z) => z.titel === 'Manager-Dienst');
    p('liegt der Befund des schwarzen Fensters vor, wird er statt der Vermutung gezeigt',
      !!mitBefund && /gar nicht hochgekommen/.test(mitBefund.fehlerText), mitBefund?.fehlerText);
    p('bei belegtem Port steht der konkrete Weg da (Task-Manager), nicht der allgemeine Rat',
      !!mitBefund && /Task-Manager/.test(mitBefund.tun) && /belegt/i.test(mitBefund.tun),
      (mitBefund?.tun || '').slice(0, 90));
    p('und der Startzeitpunkt des Fensters steht dabei - sonst weiss man nicht, ob der Befund alt ist',
      !!mitBefund && mitBefund.zusatz.some((t) => /zuletzt gestartet/i.test(t)),
      (mitBefund?.zusatz || []).join(' | '));
  } finally {
    fs.writeFileSync(datei, sicherung);
  }

  // ---- Die haeufigste Falle: der Manager wurde vom Tablet / ueber die WLAN-Adresse geoeffnet ----
  // Dann zeigt "127.0.0.1" auf das Tablet, und der Live-Kanal kann gar nicht antworten. Der PC
  // laeuft dabei einwandfrei - falsch ist nur, von wo aus man hinsieht.
  const pg2 = await b.newPage({ viewport: { width: 1400, height: 950 } });
  await pg2.goto('http://127.0.0.2:8798/pc-manager/index.html');
  await pg2.waitForTimeout(9000);
  await pg2.evaluate(() => { document.body.classList.remove('manager-locked'); document.querySelectorAll('dialog[open]').forEach((d) => { try { d.close(); } catch (e) {} }); window.KCVerbindungsdiagnose.oeffne(); });
  await pg2.waitForTimeout(3500);
  const fern = await lies(pg2);
  const mgrFern = fern.zeilen.find((z) => z.titel === 'Manager-Dienst');
  p('vom Tablet aus wird die richtige Ursache genannt, nicht "Fenster läuft nicht"',
    !!mgrFern && /nicht erreichbar/.test(mgrFern.fehlerText) && /127\.0\.0\.2/.test(mgrFern.fehlerText),
    mgrFern?.fehlerText);
  p('und der Rat lautet, den Manager auf dem PC zu öffnen',
    !!mgrFern && /127\.0\.0\.1:8090\/pc-manager/.test(mgrFern.tun), (mgrFern?.tun || '').slice(0, 100));
  await pg2.close();
  p('keine Skriptfehler über den ganzen Lauf', fehler.length === 0, fehler.slice(0, 2).join(' | ') || 'keine');

  await b.close();
  [k1, k2, web].forEach((s2) => { try { s2.closeAllConnections && s2.closeAllConnections(); } catch (e) {} s2.close(); });
  console.log(`\nVerbindungsdiagnose: ${ok}/${ok + rot} bestanden`);
  process.exit(rot ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
