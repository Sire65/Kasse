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

  // ===== A2: eingebaute Präsentation „Version A“ (Umfragesieger Weihnachtsmarkt 2026) =====
  {
    const anzeige = fs.readFileSync(path.join(WURZEL, 'tv-player', 'fernseher.html'), 'utf8');
    const datei = path.join(WURZEL, 'tv-player', 'weihnachtsmarkt-2026-version-a.html');
    p('A2: Fernseher nimmt Version A als eingebaute Präsentation', anzeige.includes("'weihnachtsmarkt-2026-version-a.html'") && anzeige.includes("zeige(VERSION_A + '?fernseher=1', 'version-a')"));
    p('A2: Fernseher blendet Bedienleiste, Umfrage-Knopf und Build-Hinweis aus', /#tvControls,#tvBigDone,#kcBuildLabel\{display:none!important\}/.test(anzeige));
    p('A2: Version-A-Datei liegt im TV-Player', fs.existsSync(datei));
    if (fs.existsSync(datei)) {
      const a = fs.readFileSync(datei, 'utf8');
      p('A2: Version A hält am Fernseher auf der Schlussfolie nicht an', !a.includes('if(isLast&&playing)tvTogglePause();'));
      p('A2: Version A kennt den Fernsehmodus (?fernseher=1)', a.includes('window.KC_FERNSEHMODUS=/[?&]fernseher=1(&|$)/.test(location.search)') && a.includes('id="kcBuildLabel"'));
      p('A2: am Fernseher keine gespeicherte Designer-Präsentation statt Version A', a.indexOf("k==='fs3.kcTvPresentation'?null") > -1 && a.indexOf("k==='fs3.kcTvPresentation'?null") < a.indexOf("localStorage.getItem('fs3.kcTvPresentation')"));
      p('A2: Endversion: Preislisten mit Allergenen und Pfandregel, kein Umfrage-Knopf mehr', a.includes('"originalRole":"kcPreise"') && a.includes('Pfand: 2,00 € je Glas') && !a.includes('abstimmung.html?seen=A') && a.includes('Endversion · '));
      p('A2: Wetter: Regenwahrscheinlichkeit, alle 30 Minuten neu, Ausfall behält letzte Daten', a.includes('precipitation_probability_max&timezone') && a.includes('loadWeather();setInterval(loadWeather,1800000);') && a.includes('if(weather.today&&weather.today.rain)return;'));
      p('A2: Wetterfolien zeigen echte Werte statt Platzhalter', a.includes('{{weather.today.temp}}') && a.includes('{{weather.day4.minmax}}') && !a.includes('Wetterlage wird aktualisiert') && a.includes('Daten: Open-Meteo.com'));
      p('A2: Rezeptfolie zeigt das Kassenfoto vom Eierlikörpunsch', a.includes('"name": "Foto Eierlikörpunsch"') || a.includes('"name":"Foto Eierlikörpunsch"'));
      const projekt = JSON.parse(a.slice(a.indexOf('window.KC_DESIGNER_MARKET_PRESENTATION=') + 39, a.indexOf('};', a.indexOf('window.KC_DESIGNER_MARKET_PRESENTATION=')) + 1).replace(/\bB\[(\d+)\]/g, '0'));
      const mitglieder = projekt.slides.filter((s) => s.memberMeta);
      const sichtbar = mitglieder.filter((s) => s.rotation && s.rotation.enabled !== false).map((s) => s.memberMeta.name);
      p('A2: Endversion: nur Mitglieder mit Zustimmung sichtbar (Klaus Zander, Steven Linley nicht)', sichtbar.length === 9 && !sichtbar.includes('Klaus Zander') && !sichtbar.includes('Steven Linley'), sichtbar.join(', '));
      const namen = mitglieder.filter((s) => s.rotation && s.rotation.enabled !== false).map((s) => (s.items.find((i) => i.originalRole === 'memberName') || {}).text);
      p('A2: ohne Fotos (18.11.2026): Mitglieder nur mit Vornamen, keine Fotos', namen.every((n) => n && !/\s/.test(n.replace('Hans-Joachim', 'X'))) && mitglieder.every((s) => !s.items.some((i) => i.originalRole === 'photo')), namen.join(', '));
      const mannschaft = projekt.slides.find((s) => s.name === 'Unsere Mannschaft');
      p('A2: Mannschaftsfolie nur Text „seit 1991 in Werne“, kein Gruppenbild', mannschaft && !mannschaft.items.some((i) => i.type === 'image' && i.originalRole === 'photo') && mannschaft.items.some((i) => i.text === 'Seit 1991 in Werne\nseit 1995 auf dem Weihnachtsmarkt') && mannschaft.items.some((i) => i.text === 'Gemeinsam kochen, gemeinsam helfen'));
      const logoOriginal = 'data:image/webp;base64,' + fs.readFileSync(path.join(WURZEL, 'media', 'kc-kochmuetze-weiss.webp')).toString('base64');
      p('A2: Mannschaftsfolie zeigt die offizielle Kochmütze (Original-Datei, unverändert)', mannschaft.items.some((i) => i.name === 'KC-Logo Kochmütze' && i.src === logoOriginal));
      p('A2: Rezeptfolie: Eierlikörpunsch als Freisteller ohne Rahmen', a.includes('data:image/png;base64,') && (projekt.slides.find((s) => s.name === 'Rezept vom Köcheclub') || { items: [] }).items.some((i) => i.name === 'Foto Eierlikörpunsch' && i.fit === 'contain' && !i.strokeWidth));
      // 18.11.2026: auf allen Folien nur Schnee, Regen oder Sonne (echtes Wetter), keine anderen Effekte; Schlussfolie Feuerwerk
      const schluss = projekt.slides[projekt.slides.length - 1];
      // Wetterfolien mit Kacheln: Wetter nur in den Kacheln, kein Effekt über die ganze Folie
      const kachelFolien = projekt.slides.filter((s) => s.items.some((i) => /^wetter-/.test(i.originalRole || '')));
      p('A2: Wetterfolien: Regen/Schnee nur in den Kacheln, nicht über die ganze Folie', kachelFolien.length === 2 && kachelFolien.every((s) => !s.effectLayer.weatherAuto && ['type', 'type2', 'type3'].every((k) => s.effectLayer[k] === 'none')));
      p('A2: Regen dezent (nur jeder dritte Tropfen, schwach)', a.includes('.tvFx.rain{opacity:.32!important}.tvFx.rain i:not(:nth-child(3n)){display:none}') && !a.includes('.tvFx.rain i,.tvFx.storm i{zoom:1.7}'));
      const andere = projekt.slides.filter((s) => s !== schluss && !kachelFolien.includes(s) && !(s.effectLayer && s.effectLayer.weatherAuto && ['type', 'type2', 'type3'].every((k) => s.effectLayer[k] === 'none'))).map((s) => s.name);
      p('A2: Effekte nur Schnee, Regen, Sonne nach echtem Wetter (alle Folien außer Schluss), Schlussfolie Feuerwerk', andere.length === 0 && schluss.effectLayer.type === 'fireworks' && !schluss.effectLayer.weatherAuto && a.includes("fx.weatherAuto?[kcWetterEffekt()]") && a.includes("a==='sun'?'sun':'none'") && !/function kcWetterEffekt\(\)\{[^}]*glitter/.test(a), andere.join(', '));
      p('A2: Wetterkacheln zeigen das Wetter ihres Tages', a.includes('"originalRole":"wetter-tomorrow"') && a.includes('"originalRole":"wetter-day4"') && a.includes('kind:kcKachelArt(data.daily.weather_code[n])') && a.includes('.kcKw'));
      const ohneFotoNamen = mitglieder.filter((s) => s.rotation && s.rotation.enabled !== false).map((s) => { const n = s.items.find((i) => i.originalRole === 'memberName'), q = s.items.find((i) => i.originalRole === 'memberQuote'); return n.x === q.x && n.w === q.w; });
      p('A2: Vornamen-Feld genau so breit wie der Spruch', ohneFotoNamen.every(Boolean));
      p('A2: Rückblick heißt 2025, leere Impressionen ausgeblendet', projekt.slides.filter((s) => /^Rückblick/.test(s.name)).every((s) => /2025/.test(s.name) && !s.items.some((i) => /2024/.test(i.text || ''))) && projekt.slides.filter((s) => /^Impressionen \d/.test(s.name)).every((s) => s.rotation.enabled === false));
      // 19.11.2026 (Betreiber: „alles zu klein … Allergene in Klammern dahinter, kleine Legende, erste Spalte breiter, Pünktchen zum Preis“):
      // Preisfolien als Speisekarten-Tafel – keine Tabelle/Allergenkasten mehr, Kennzeichen je Gericht, Legende nur der benutzten Zeichen
      const preisFolien = projekt.slides.filter((s) => /^Preisliste/.test(s.name));
      const tafeln = preisFolien.map((s) => { const t = s.items.find((i) => i.originalRole === 'kcPreise'); return t ? JSON.parse(t.text.slice(t.text.indexOf('@@PL@@') + 6)) : null; });
      const allePosten = tafeln.filter(Boolean).flatMap((t) => t.posten);
      const kz = (n) => (allePosten.find((x) => x.name === n) || {}).kz;
      p('A2: Preisfolien als Speisekarte: Kennzeichen in Klammern, Legende, Preise mit Komma, keine Tabelle/Allergenkasten',
        tafeln.length === 4 && tafeln.every(Boolean) && preisFolien.every((s) => !s.items.some((i) => i.type === 'table' || i.originalRole === 'allergenHinweis'))
        && kz('Grünkohl a la Köcheclub mit Mettendchen') === 'A, I, J, 2, 3' && kz('Kartoffeln mit Kartoffelcreme') === 'C, G, J, 2' && kz('Eierlikörpunsch') === 'C, G, L'
        && allePosten.every((x) => /^\d+,\d\d €$/.test(x.preis)) && !allePosten.some((x) => /Aufpreis außer Haus|Mettwurst/.test(x.name))
        && tafeln[1].legende === 'A Gluten · I Sellerie · J Senf · 2 mit Konservierungsstoff · 3 mit Antioxidationsmittel'
        && a.includes('.kcPlPunkte{'), JSON.stringify(tafeln.map((t) => t && t.posten.length)));
      const laufschriften = projekt.slides.map((s) => s.items.find((i) => i.type === 'ticker')).filter(Boolean).map((i) => i.text);
      p('A2: Laufschrift langsamer, Themenblöcke mit Abstand, Preise je Gruppe und Allergen-Hinweis', a.includes('const TEMPO=30;') && a.includes('kcTickerPause') && laufschriften.some((t) => t.startsWith('Preise alkoholfreie Getränke:')) && laufschriften.some((t) => t.includes('wenden Sie sich gerne an die Standbesetzung')) && new Set(laufschriften).size > 5);
      p('A2: durchgehendes Laufband über allen Folien (kein Flackern beim Folienwechsel)', a.includes('band.id="kcLaufband"') && a.includes('#tvStage .tvItem.ticker{visibility:hidden!important}') && a.includes('window.KC_LAUFSCHRIFT=') && a.includes('if(t===inhalt&&band.firstChild)return;'));
      const qr = projekt.slides.flatMap((s) => s.items).filter((i) => i.name === 'official-qr-label' || i.name === 'join-copy').map((i) => i.text);
      p('A2: QR-Folien: Gesamtprogramm im Internet, E-Mail an den Clubsprecher', qr.some((t) => /Gesamtprogramm\nim Internet/.test(t)) && qr.some((t) => /dem Clubsprecher\neine E-Mail senden/.test(t)) && !qr.some((t) => /Klaus Zander/.test(t)));
      const bilder = JSON.parse(a.slice(a.indexOf('const B=[') + 8, a.indexOf('];', a.indexOf('const B=[')) + 1));
      p('A2: entfernte Fotos stecken nicht mehr unsichtbar in der Datei', bilder.filter(Boolean).length <= 6, `${bilder.filter(Boolean).length} Bilder`);
      const { uebernehmen } = require(path.join(WURZEL, 'tools', 'tv-version-a-uebernehmen.cjs'));
      let doppelt = false; try { uebernehmen(a); } catch (e) { doppelt = /bereits angepasst/.test(e.message); }
      p('A2: Werkzeug lehnt bereits angepasste Datei ab (keine Doppel-Anpassung)', doppelt);
    }
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
      await tv.goto(`http://127.0.0.1:${WEB}/tv-player/fernseher.html?pruefen=2&eingebaut=player`);
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
      await tab.waitForFunction(() => /Am PC:/.test(document.getElementById('notificationBar')?.textContent || ''), null, { timeout: 40000 }).catch(() => {});
      const kurz = await tab.locator('#notificationBar').innerText().catch(() => '');
      p('B: Tablet zeigt oben in der Meldungszeile „Am PC: KASSE-03: Port 47502 ist belegt …“', /Am PC: KASSE-03: Port 47502 ist belegt/.test(kurz), kurz);
      p('B: kein Streifen mehr unten (stört beim Kassieren)', await tab.evaluate(() => !document.getElementById('kcStandMeldungen')));
      await tab.locator('#notificationBar').dispatchEvent('click'); // PIN-Sperre/Startfenster liegen im Test noch darüber
      const lang = await tab.locator('#kcStandMeldungen').innerText();
      p('B: Antippen zeigt Ursache und Lösungsschritte', /Ursache:/.test(lang) && /Task-Manager|beenden/.test(lang));
      fremd.kill(); fremd = null;
      let weg = false;
      for (let i = 0; i < 60 && !weg; i++) { await warte(1000); await tab.evaluate(() => window.KCStandMeldungen.pruefen()); weg = await tab.evaluate(() => !window.KCStandMeldungen.letzte.length && !document.getElementById('kcStandMeldungen') && /wieder alles in Ordnung/.test(document.getElementById('notificationBar').textContent)); }
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
