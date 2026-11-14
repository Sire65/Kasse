/* KS-05 – Fernseher am Stand: Präsentation startet von selbst, „An den Fernseher senden“, Störungen auf den Tablets.
 *   A  Bausteine (Windows nachgestellt): Fernseher an HDMI + Monitor an VGA -> Präsentation auf dem Fernseher;
 *      nur ein Bildschirm -> PC-Manager nicht davor; Edge fehlt -> Meldung mit Lösung; Absturz -> Neustart;
 *      bewusst geschlossen -> bleibt zu.
 *   B  Echter Start: TV-Player im Fernsehmodus ohne Paket (eingebaute Präsentation, keine Bedienleiste),
 *      „📺 An den Fernseher senden“ im PC-Manager -> Fernseher zeigt sie, Änderung ohne Neustart,
 *      Sicherheit (Paket nur am PC selbst), Störung am PC -> Hinweis mit Lösung auf dem Tablet.
 */
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http'), net = require('net');
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const WURZEL = path.join(__dirname, '..');
const BACKEND = path.join(WURZEL, 'markt-kasse-suite', 'backend-source');
const { Fernseher } = require(path.join(BACKEND, 'fernseher.js'));
let ok = 0, rot = 0;
const p = (n, b, z = '') => { b ? ok++ : rot++; console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z !== '' ? '   [' + String(z).slice(0, 180) + ']' : ''}`); };
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const ARBEIT = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-fernseher-'));
const einst = (o) => { const f = path.join(ARBEIT, `e${Math.random().toString(36).slice(2)}.json`); fs.writeFileSync(f, JSON.stringify({ fernseher: o })); return f; };
const MONITOR = { name: '\\\\.\\DISPLAY1', x: 0, y: 0, breite: 1280, hoehe: 1024, haupt: true };
const TV = { name: '\\\\.\\DISPLAY2', x: 1280, y: 0, breite: 1920, hoehe: 1080, haupt: false };

function nachbauStarter() {
  const aufrufe = [];
  const starter = (exe, args) => { const k = new EventEmitter(); k.kill = () => k.emit('exit', 0); aufrufe.push({ exe, args, kind: k }); return k; };
  return { starter, aufrufe };
}

(async () => {
  // ================= A: Bausteine =================
  console.log('-- A: Bausteine --');
  {
    const s = nachbauStarter(); const log = [];
    const f = new Fernseher({ einstellungsDatei: einst({ aktiv: true, bildschirm: 'auto' }), datenOrdner: ARBEIT, webserverPort: 8090, plattform: 'win32',
      bildschirmeErmitteln: () => [MONITOR, TV], browserFinden: () => 'C:\\Edge\\msedge.exe', starter: s.starter, log: (x) => log.push(x), fehlerLog: (x) => log.push(x) });
    const r = f.start();
    const a = s.aufrufe[0] && s.aufrufe[0].args;
    p('A: Fernseher + Monitor: Edge startet im Kiosk-Vollbild mit der Präsentation', r.gestartet && a.includes('--kiosk') && a.includes('http://127.0.0.1:8090/tv-player/fernseher.html') && a.includes('--edge-kiosk-type=fullscreen'));
    p('A: … auf dem Fernseher (nicht Hauptanzeige), nicht auf dem Monitor', a.includes('--window-position=1300,20'), a.find((x) => x.startsWith('--window-position')));
    p('A: … mit eigenem Browser-Profil im Datenordner (Einstellungen greifen sicher)', a.some((x) => x === `--user-data-dir=${path.join(ARBEIT, 'fernseher-browser')}`));
    p('A: zwei Bildschirme -> PC-Manager darf normal geöffnet werden', r.einBildschirm === false && log.some((x) => /PC-Manager und dieses Fenster bleiben auf der Hauptanzeige/.test(x)));
    s.aufrufe[0].kind.emit('exit', 0);
    await warte(50);
    p('A: Fernsehbild bewusst geschlossen -> bleibt zu, mit Hinweis wie man es wieder öffnet', s.aufrufe.length === 1 && log.some((x) => /wurde geschlossen\. Wieder öffnen/.test(x)));
    p('A: „An den Fernseher senden“ öffnet ein geschlossenes Fernsehbild wieder', f.sicherstellen() === true && s.aufrufe.length === 2);
    s.aufrufe[1].kind.emit('exit', 1);
    p('A: Absturz -> Meldung „wird in 10 s neu gestartet“', log.some((x) => /unerwartet beendet \(Code 1\) – wird in 10 s neu gestartet/.test(x)));
    await warte(10300);
    p('A: … und nach 10 s läuft der Browser wieder', s.aufrufe.length === 3);
    f.stop();
  }
  {
    const s = nachbauStarter(); const log = [];
    const f = new Fernseher({ einstellungsDatei: einst({ aktiv: true }), datenOrdner: ARBEIT, webserverPort: 8090, plattform: 'win32',
      bildschirmeErmitteln: () => [TV], browserFinden: () => 'C:\\Edge\\msedge.exe', starter: s.starter, log: (x) => log.push(x) });
    const r = f.start();
    p('A: nur EIN Bildschirm: Präsentation im Vollbild, PC-Manager wird nicht davor geöffnet', r.gestartet && r.einBildschirm && log.some((x) => /PC-Manager wird nicht davor geöffnet/.test(x)));
    f.stop();
  }
  {
    const s = nachbauStarter();
    const f = new Fernseher({ einstellungsDatei: einst({ aktiv: true, bildschirm: 1 }), datenOrdner: ARBEIT, webserverPort: 8090, plattform: 'win32',
      bildschirmeErmitteln: () => [MONITOR, TV], browserFinden: () => 'C:\\Edge\\msedge.exe', starter: s.starter });
    f.start();
    p('A: Bildschirm fest einstellbar („bildschirm“: 1)', s.aufrufe[0].args.includes('--window-position=20,20'));
    f.stop();
  }
  {
    const f = new Fernseher({ einstellungsDatei: einst({ aktiv: true }), datenOrdner: ARBEIT, webserverPort: 8090, plattform: 'win32', bildschirmeErmitteln: () => [TV], browserFinden: () => null });
    const r = f.start();
    p('A: Edge fehlt -> Meldung mit Ursache und Lösung (inkl. Adresse zum Öffnen von Hand)', !r.gestartet && r.meldung && r.meldung.loesung.some((x) => /tv-player\/fernseher\.html/.test(x)));
  }
  {
    const s = nachbauStarter();
    const f = new Fernseher({ einstellungsDatei: einst({ aktiv: false }), datenOrdner: ARBEIT, webserverPort: 8090, plattform: 'win32', starter: s.starter });
    p('A: „aktiv“: false -> kein Fernseher-Start', !f.start().gestartet && s.aufrufe.length === 0);
  }

  // ================= B: echter Start =================
  console.log('\n-- B: echter Start --');
  let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('  (B übersprungen: Playwright fehlt)'); }
  for (const m of ['ws', 'selfsigned', 'bonjour-service']) { try { require.resolve(m, { paths: [BACKEND] }); } catch (e) { chromium = null; } }
  const MGR = 8576, WEB = 8897;
  const lan = Object.values(os.networkInterfaces()).flat().find((e) => e && e.family === 'IPv4' && !e.internal);
  const VERBINDUNGSDATEI = path.join(WURZEL, 'pc-manager', 'kassen-verbindungen.json');
  const vorher = fs.existsSync(VERBINDUNGSDATEI) ? fs.readFileSync(VERBINDUNGSDATEI) : null;
  let lauf = null, browser = null, fremd = null;
  if (chromium) {
    try {
      // fremdes Programm auf dem Port von KASSE-03 -> Störung, die auf dem Tablet erscheinen muss
      fremd = spawn(process.execPath, ['-e', "require('http').createServer((q,a)=>a.end('x')).listen(47502,'0.0.0.0',()=>console.log('ok'))"], { stdio: ['ignore', 'pipe', 'ignore'] });
      await new Promise((r) => fremd.stdout.once('data', r));
      lauf = spawn(process.execPath, [path.join(BACKEND, 'run-manager-service.js'), '--db', path.join(ARBEIT, 'm.sqlite'), '--port', String(MGR), '--webserver-port', String(WEB)], {
        cwd: BACKEND, env: { ...process.env, KC_KASSEN_DATEN: path.join(ARBEIT, 'kassen') }, stdio: ['ignore', 'pipe', 'pipe'] });
      let log = ''; lauf.stdout.on('data', (d) => { log += d; }); lauf.stderr.on('data', (d) => { log += d; });
      for (let i = 0; i < 300 && !/\[Marktag-Start\]/.test(log); i++) await warte(250);
      p('B: Start nennt die Fernseher-Adresse', log.includes(`Fernseher-Präsentation: http://127.0.0.1:${WEB}/tv-player/fernseher.html`));
      p('B: (Linux) Hinweis „Automatischer Start nur unter Windows“ statt Fehler', /\[Fernseher\] Automatischer Start nur unter Windows/.test(log));

      browser = await chromium.launch();
      const tv = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
      const tvFehler = []; tv.on('pageerror', (e) => tvFehler.push(e.message));
      await tv.goto(`http://127.0.0.1:${WEB}/tv-player/fernseher.html?pruefen=2`);
      await tv.waitForFunction(() => window.KCFernsehAnzeige && window.KCFernsehAnzeige.herkunft(), null, { timeout: 15000 });
      await tv.waitForFunction(() => { const f = window.KCFernsehAnzeige.rahmen(); return f && f.contentWindow && f.contentWindow.KCFernseher && f.contentWindow.KCFernseher.herkunft; }, null, { timeout: 15000 }).catch(() => {});
      const ohne = await tv.evaluate(() => { const f = window.KCFernsehAnzeige.rahmen(); return { h: window.KCFernsehAnzeige.herkunft(), innen: f.contentWindow.KCFernseher && f.contentWindow.KCFernseher.herkunft, text: f.contentDocument.getElementById('screen').innerText, leiste: getComputedStyle(f.contentDocument.getElementById('control')).display }; });
      p('B: noch nichts gesendet: eingebaute Weihnachtsmarkt-Präsentation läuft', ohne.h === 'player' && ohne.innen === 'eingebaut', JSON.stringify({ h: ohne.h, i: ohne.innen }));
      p('B: … nie „TV-Paket bitte einlesen“ vor den Kunden, keine Bedienleiste', !/TV-Paket bitte einlesen/.test(ohne.text) && ohne.leiste === 'none');
      p('B: kein Mauszeiger auf dem Fernseher', await tv.evaluate(() => getComputedStyle(document.body).cursor === 'none'));
      await tv.evaluate(() => { window.__nichtNeuGeladen = true; });

      // PC-Manager -> TV-Designer -> „An den Fernseher senden“
      const pcCtx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
      const pc = await pcCtx.newPage();
      const pcFehler = []; pc.on('pageerror', (e) => pcFehler.push(e.message));
      await pc.goto(`http://127.0.0.1:${WEB}/pc-manager/index.html`);
      await pc.waitForFunction(() => window.KCFernseherManager, null, { timeout: 30000 });
      p('B: Knopf „📺 An den Fernseher senden“ ist im PC-Manager (TV-Seite) da', (await pc.locator('#tvDashFernseher').count()) === 1);
      const [designer] = await Promise.all([pcCtx.waitForEvent('page'), pc.evaluate(() => { window.open('tv-designer/index.html', 'kcTvDesigner'); })]);
      const dFehler = []; designer.on('pageerror', (e) => dFehler.push(e.message));
      await designer.waitForFunction(() => window.KCFernseherSenden && typeof buildStandaloneProgram === 'function' && typeof project !== 'undefined' && project.slides && project.slides.length, null, { timeout: 30000 });
      p('B: Knopf „📺 An den Fernseher senden“ ist im TV-Designer da', (await designer.locator('#tvFernseherSendenBtn').count()) === 1);
      const e1 = await designer.evaluate(async () => { project.name = 'FERNSEHER-TEST 1'; return window.KCFernseherSenden.senden(); });
      p('B: Designer sendet über den PC-Manager („spätestens in 30 Sekunden“)', e1.ok && /spätestens in 30 Sekunden/.test(e1.text), e1.text);
      const datei = path.join(ARBEIT, 'kassen', 'tv-programm.html');
      p('B: HTML-Programm liegt im Datenordner des Stands', fs.existsSync(datei) && /FERNSEHER-TEST 1/.test(fs.readFileSync(datei, 'utf8')));
      await tv.waitForFunction(() => window.KCFernsehAnzeige.herkunft() === 'designer', null, { timeout: 15000 }).catch(() => {});
      const d1 = await tv.evaluate(() => { const f = window.KCFernsehAnzeige.rahmen(); const c = f.contentDocument.querySelector('.controls'); return { h: window.KCFernsehAnzeige.herkunft(), titel: f.contentDocument.title, leiste: c ? getComputedStyle(c).display : 'fehlt', seite: !!f.contentDocument.getElementById('page'), inhalt: (f.contentDocument.getElementById('page') || { children: [] }).children.length }; });
      p('B: Fernseher zeigt die Designer-Präsentation (ohne Klick)', d1.h === 'designer' && d1.seite && /FERNSEHER-TEST 1/.test(d1.titel), JSON.stringify(d1));
      p('B: … mit echtem Folieninhalt (nicht leer)', d1.inhalt > 0, `${d1.inhalt} Elemente`);
      p('B: … ohne Bedienleiste (‹ Pause ›)', d1.leiste === 'none');
      await designer.evaluate(async () => { project.name = 'FERNSEHER-TEST 2'; await window.KCFernseherSenden.senden(); });
      await tv.waitForFunction(() => /FERNSEHER-TEST 2/.test(window.KCFernsehAnzeige.rahmen().contentDocument.title), null, { timeout: 15000 }).catch(() => {});
      p('B: geänderte Präsentation erscheint ohne Neustart des Fernsehers', await tv.evaluate(() => /FERNSEHER-TEST 2/.test(window.KCFernsehAnzeige.rahmen().contentDocument.title) && window.__nichtNeuGeladen === true));

      // Sicherheit
      const vonAussen = (methode, pfad) => new Promise((r) => { const q = http.request({ hostname: lan.address, port: WEB, path: pfad, method: methode, localAddress: lan.address, headers: { 'X-KC-Aktion': '1', 'Content-Type': 'application/json' } }, (res) => { res.resume(); r(res.statusCode); }); q.on('error', () => r(0)); q.end(methode === 'POST' ? '{"schema":"KC-TV-1","slides":[{}]}' : undefined); });
      p('B: Präsentation (kann Mitgliederfotos enthalten) übers WLAN NICHT abrufbar', (await vonAussen('GET', '/kc-kassen-start/tv-programm')) === 403 && (await vonAussen('GET', '/kc-kassen-start/tv-paket')) === 403);
      p('B: Präsentation übers WLAN NICHT überschreibbar', (await vonAussen('POST', '/kc-kassen-start/tv-programm')) === 403 && (await vonAussen('POST', '/kc-kassen-start/tv-paket')) === 403);
      p('B: Stand-Meldungen (ohne Geheimnisse) sind für die Tablets erreichbar', (await vonAussen('GET', '/kc-kassen-start/stand-meldungen')) === 200);

      // Störung am PC -> Tablet
      const st = await new Promise((r) => http.get(`http://127.0.0.1:${WEB}/kc-kassen-start/status`, (res) => { let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => r(JSON.parse(d))); }));
      const tab = await (await browser.newContext({ viewport: { width: 1180, height: 820 } })).newPage();
      await tab.goto(st.kassen[0].qrAdresse);
      await tab.waitForFunction(() => window.KCStandMeldungen, null, { timeout: 30000 });
      await tab.evaluate(() => window.KCStandMeldungen.pruefen());
      await tab.waitForSelector('#kcStandMeldungen', { state: 'visible', timeout: 15000 }).catch(() => {});
      const kurz = await tab.locator('#kcStandMeldungen').innerText().catch(() => '');
      p('B: Tablet zeigt „Am PC: KASSE-03: Port 47502 ist belegt …“', /Am PC: KASSE-03: Port 47502 ist belegt/.test(kurz), kurz);
      await tab.locator('#kcStandMeldungen').dispatchEvent('click'); // PIN-Sperre/Startfenster liegen im Test noch darüber
      const lang = await tab.locator('#kcStandMeldungen').innerText();
      p('B: Antippen zeigt Ursache und Lösungsschritte', /Ursache:/.test(lang) && /Task-Manager|beenden/.test(lang));
      fremd.kill(); fremd = null;
      let weg = false;
      for (let i = 0; i < 60 && !weg; i++) { await warte(1000); await tab.evaluate(() => window.KCStandMeldungen.pruefen()); weg = !(await tab.locator('#kcStandMeldungen').isVisible()); }
      p('B: Störung behoben -> Hinweis verschwindet von selbst', weg);
      p('keine Skriptfehler (Fernseher, PC-Manager, Designer)', !tvFehler.length && !pcFehler.length && !dFehler.length, [...tvFehler, ...pcFehler, ...dFehler].slice(0, 2).join(' | ') || 'keine');
    } catch (e) { rot++; console.log('FEHLER  Abbruch: ' + (e && e.stack || e)); }
    finally {
      if (browser) await browser.close();
      if (fremd) fremd.kill();
      if (lauf && lauf.exitCode === null) { const w = new Promise((r) => lauf.once('exit', r)); lauf.kill('SIGINT'); await Promise.race([w, warte(15000)]); }
      if (vorher) fs.writeFileSync(VERBINDUNGSDATEI, vorher); else fs.rmSync(VERBINDUNGSDATEI, { force: true });
    }
  }
  fs.rmSync(ARBEIT, { recursive: true, force: true });
  console.log(`\nFernseher am Stand (KS-05): ${ok}/${ok + rot} bestanden`);
  process.exit(rot ? 1 : 0);
})();
