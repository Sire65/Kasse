/* KS-02 – jede Fehlermeldung ist eindeutig und hat einen Lösungsvorschlag.
 *
 * Für jeden typischen Fehler am Stand wird der ECHTE Start (run-manager-service.js) ausgelöst und
 * geprüft: Steht im schwarzen Fenster WAS los ist, WARUM und eine LÖSUNG in Schritten? Und läuft
 * alles weiter, was weiterlaufen kann?
 *   1. Manager-Port belegt (zweites Fenster)         -> START ABGEBROCHEN mit Lösung
 *   2. Port einer einzelnen Kasse belegt             -> nur diese Kasse betroffen, die anderen laufen
 *   3. Kassenliste kaputt                             -> Manager läuft, klare Anleitung zur Liste
 *   4. Datenordner nicht anlegbar                     -> klare Meldung, Manager läuft
 *   5. Kassen-Dienst stürzt immer wieder ab           -> Meldung „stürzt wiederholt ab“ mit Lösung
 *   6. PC-Manager-Zettelseite zeigt Ursache + Lösungsschritte
 *   7. Bausteine: jeder Fehlertyp liefert Titel, Ursache und mindestens einen Lösungsschritt
 */
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http'), net = require('net');
const { spawn } = require('child_process');
const WURZEL = path.join(__dirname, '..');
const BACKEND = path.join(WURZEL, 'markt-kasse-suite', 'backend-source');
for (const m of ['ws', 'selfsigned', 'bonjour-service']) {
  try { require.resolve(m, { paths: [BACKEND] }); } catch (e) { console.log(`  ueberspringen: ${m} fehlt - einmal "npm install" in markt-kasse-suite/backend-source`); process.exit(0); }
}
const { erklaere, alsKasten } = require(path.join(BACKEND, 'fehlerhilfe.js'));
let ok = 0, rot = 0;
const p = (n, b, z = '') => { b ? ok++ : rot++; console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z !== '' ? '   [' + String(z).slice(0, 160) + ']' : ''}`); };
const MGR_PORT = 8573, WEB_PORT = 8893;
const ARBEIT = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-fehler-'));
const VERBINDUNGSDATEI = path.join(WURZEL, 'pc-manager', 'kassen-verbindungen.json');
const vorher = fs.existsSync(VERBINDUNGSDATEI) ? fs.readFileSync(VERBINDUNGSDATEI) : null;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const portFrei = (port) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.listen(port, '0.0.0.0', () => s.close(() => r(true))); });
const belege = (port) => new Promise((r) => { const s = http.createServer((q, a) => a.end('alt')); s.listen(port, '0.0.0.0', () => r(s)); });
const holen = (url) => new Promise((r) => { http.get(url, (res) => { let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => { try { r(JSON.parse(d)); } catch (e) { r(null); } }); }).on('error', () => r(null)); });

// Eine Meldung ist gut, wenn sie Titel, Ursache und nummerierte Lösungsschritte hat.
const kastenGut = (log, titelMuster) => {
  const i = log.search(titelMuster);
  if (i < 0) return false;
  const rest = log.slice(i, i + 2500);
  return /Ursache: \S/.test(rest) && /Lösung: 1\) \S/.test(rest);
};
const meldungGut = (m) => m && m.titel && m.ursache && Array.isArray(m.loesung) && m.loesung.length > 0 && m.loesung.every((s) => s && s.length > 10);

async function starte(name, env = {}, { bis = /\[Marktag-Start\]/, sekunden = 70 } = {}) {
  const kind = spawn(process.execPath, [path.join(BACKEND, 'run-manager-service.js'), '--db', path.join(ARBEIT, `${name}-manager.sqlite`), '--port', String(MGR_PORT), '--webserver-port', String(WEB_PORT)], {
    cwd: BACKEND, env: { ...process.env, KC_KASSEN_DATEN: path.join(ARBEIT, `${name}-kassen`), ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  kind.stdout.on('data', (d) => { log += d; }); kind.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < sekunden * 4 && !bis.test(log) && kind.exitCode === null; i++) await warte(250);
  await warte(300);
  return { kind, log: () => log };
}
async function stoppe(lauf) {
  if (!lauf || lauf.kind.exitCode !== null) return;
  const weg = new Promise((r) => lauf.kind.once('exit', r));
  lauf.kind.kill('SIGINT'); await Promise.race([weg, warte(15000)]);
  if (lauf.kind.exitCode === null) lauf.kind.kill('SIGKILL');
  await warte(500);
}

(async () => {
  let lauf = null; const offen = [];
  try {
    for (const port of [MGR_PORT, WEB_PORT, 47392, 47500, 47501, 47502]) {
      if (!(await portFrei(port))) { console.log(`Port ${port} ist belegt - Test kann nicht laufen.`); process.exit(1); }
    }

    // ---- 7. Bausteine ----
    const faelle = [
      [Object.assign(new Error('listen EADDRINUSE: address already in use 0.0.0.0:8543'), { code: 'EADDRINUSE' }), { port: 8543, was: 'Manager-Dienst starten' }, /Port 8543 ist belegt/, /Task-Manager/],
      [Object.assign(new Error('EACCES: permission denied, mkdir'), { code: 'EACCES' }), { pfad: 'C:\\Programme\\KC' }, /Keine Schreibberechtigung/, /Dokumente/],
      [Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' }), {}, /Festplatte ist voll/, /Papierkorb/],
      [new Error('database is locked'), {}, /von einem anderen Programm geöffnet/, /Task-Manager/],
      [new Error('database disk image is malformed'), {}, /beschädigt/, /NICHTS löschen/],
      [new Error('manager_identity_mismatch'), { kasse: 'KASSE-02' }, /KASSE-02: Kopplung mit dem Manager ist fehlgeschlagen/, /neu starten/],
      [new Error('connect ECONNREFUSED 127.0.0.1:8543'), { was: 'Manager' }, /antwortet nicht/, /Virenscanner/],
      [new Error('etwas völlig Neues'), { was: 'Start' }, /unerwarteter Fehler/, /Foto/],
    ];
    for (const [fehler, kontext, titel, loesung] of faelle) {
      const m = erklaere(fehler, kontext);
      p(`Baustein: „${fehler.message.slice(0, 40)}“ -> ${m.titel}`, meldungGut(m) && titel.test(m.titel) && m.loesung.some((s) => loesung.test(s)));
    }
    p('Baustein: Kasten zeigt Was / Ursache / Lösung / Technik', /FEHLER: .+\n!! {3}Ursache: .+\n!! {3}Lösung: 1\) /.test(alsKasten(erklaere(faelle[0][0], faelle[0][1]))));

    // ---- 1. Manager-Port belegt ----
    console.log('\n-- 1: Manager-Port belegt (zweites Fenster) --');
    offen.push(await belege(MGR_PORT));
    lauf = await starte('eins', {}, { bis: /START ABGEBROCHEN/ });
    await new Promise((r) => (lauf.kind.exitCode !== null ? r() : lauf.kind.once('exit', r)));
    p('1: Start bricht ab und sagt es deutlich', /\[Marktag-Start\] START ABGEBROCHEN/.test(lauf.log()) && lauf.kind.exitCode === 1, `Code ${lauf.kind.exitCode}`);
    p('1: Kasten nennt den Port, die Ursache und die Lösung in Schritten', kastenGut(lauf.log(), new RegExp(`Port ${MGR_PORT} ist belegt`)) && /Task-Manager/.test(lauf.log()));
    p('1: kein roher Stacktrace als einzige Auskunft', !/^\s+at .+\(.+:\d+:\d+\)$/m.test(lauf.log()));
    offen.pop().close(); await warte(300); lauf = null;

    // ---- 2. Port einer Kasse belegt ----
    console.log('\n-- 2: Port von KASSE-02 belegt --');
    offen.push(await belege(47501));
    lauf = await starte('zwei');
    p('2: Start läuft durch mit BEREIT MIT WARNUNGEN', /BEREIT MIT WARNUNGEN/.test(lauf.log()));
    p('2: Kasten nennt KASSE-02, Port 47501, Ursache und Lösung', kastenGut(lauf.log(), /KASSE-02: Port 47501 ist belegt/));
    const s2 = await holen(`http://127.0.0.1:${WEB_PORT}/kc-kassen-start/status`);
    p('2: KASSE-01 und KASSE-03 laufen trotzdem', s2 && s2.kassen.find((k) => k.id === 'KASSE-01').dienst === 'laeuft' && s2.kassen.find((k) => k.id === 'KASSE-03').dienst === 'laeuft');
    p('2: Status liefert die Meldung strukturiert (Titel, Ursache, Lösungsschritte)', s2 && s2.meldungen.length >= 1 && s2.meldungen.every(meldungGut));
    // 6. Zettel-Seite zeigt Ursache und Lösungsschritte
    let seite = null;
    try {
      const { chromium } = require('playwright');
      const b = await chromium.launch();
      seite = await (await b.newContext()).newPage();
      await seite.goto(`http://127.0.0.1:${WEB_PORT}/pc-manager/kassen-zettel.html`);
      await seite.waitForSelector('.warnung ol li', { timeout: 10000 });
      const text = await seite.locator('#meldungen').innerText();
      p('6: PC-Manager-Zettelseite zeigt Titel, Ursache und nummerierte Lösung', /KASSE-02: Port 47501 ist belegt/.test(text) && /Ursache:/.test(text) && /Lösung:/.test(text) && (await seite.locator('.warnung ol li').count()) >= 3);
      await b.close();
    } catch (e) { if (!/Cannot find module 'playwright'/.test(e.message)) { rot++; console.log('FEHLER  6: ' + e.message); } }
    // Selbstheilung: blockierendes Programm schliessen -> KASSE-02 laeuft von selbst an, Meldung weg.
    offen.pop().close();
    let geheilt = null;
    for (let i = 0; i < 50; i++) { await warte(1000); geheilt = await holen(`http://127.0.0.1:${WEB_PORT}/kc-kassen-start/status`); if (geheilt && geheilt.kassen.find((k) => k.id === 'KASSE-02').dienst === 'laeuft') break; }
    p('2: Port wieder frei -> KASSE-02 läuft von selbst an (ohne Neustart des Fensters)', geheilt && geheilt.kassen.find((k) => k.id === 'KASSE-02').dienst === 'laeuft');
    p('2: und die Warnung ist wieder verschwunden', geheilt && !geheilt.meldungen.some((m) => /KASSE-02/.test(m.titel)));
    p('2: Fenster meldet „Problem hat sich erledigt“', /KASSE-02: Kassen-Dienst läuft jetzt – das Problem hat sich erledigt/.test(lauf.log()));
    await stoppe(lauf); lauf = null; await warte(300);

    // ---- 3. Kassenliste kaputt ----
    console.log('\n-- 3: Kassenliste kaputt --');
    const kaputt = path.join(ARBEIT, 'liste.json'); fs.writeFileSync(kaputt, '["KASSE-01", "KASSE-02",]');
    lauf = await starte('drei', { KC_KASSEN_LISTE: kaputt });
    p('3: Manager läuft trotzdem (BEREIT MIT WARNUNGEN)', /BEREIT MIT WARNUNGEN/.test(lauf.log()));
    p('3: Kasten sagt, welche Datei kaputt ist, und wie sie richtig aussieht', kastenGut(lauf.log(), /Kassenliste markttag-kassen\.json ist fehlerhaft/) && /\["KASSE-01", "KASSE-02", "KASSE-03"\]/.test(lauf.log()));
    await stoppe(lauf); lauf = null;

    // ---- 4. Datenordner nicht anlegbar ----
    console.log('\n-- 4: Datenordner nicht anlegbar --');
    const datei = path.join(ARBEIT, 'ist-eine-datei'); fs.writeFileSync(datei, 'x');
    lauf = await starte('vier', { KC_KASSEN_DATEN: path.join(datei, 'unterordner') });
    p('4: Manager läuft trotzdem (BEREIT MIT WARNUNGEN)', /BEREIT MIT WARNUNGEN/.test(lauf.log()));
    p('4: Kasten: Tablet-Kassen NICHT gestartet, Ursache und Lösung', kastenGut(lauf.log(), /Tablet-Kassen NICHT gestartet/));
    await stoppe(lauf); lauf = null;

    // ---- 5. Kassen-Dienst stürzt immer wieder ab ----
    console.log('\n-- 5: Kassen-Dienst stürzt wiederholt ab --');
    lauf = await starte('fuenf');
    for (let n = 0; n < 3; n++) {
      let s = null;
      for (let i = 0; i < 80; i++) { s = await holen(`http://127.0.0.1:${WEB_PORT}/kc-kassen-start/status`); const k = s && s.kassen[0]; if (k && k.dienst === 'laeuft' && k.pid && k.neustarts === n) break; await warte(500); }
      process.kill(s.kassen[0].pid, 'SIGKILL');
      await warte(300);
    }
    let s5 = null;
    for (let i = 0; i < 20; i++) { s5 = await holen(`http://127.0.0.1:${WEB_PORT}/kc-kassen-start/status`); if (s5 && s5.meldungen.some((m) => /stürzt wiederholt ab/.test(m.titel))) break; await warte(500); }
    const m5 = s5 && s5.meldungen.find((m) => /stürzt wiederholt ab/.test(m.titel));
    p('5: Meldung „KASSE-01: Kassen-Dienst stürzt wiederholt ab“ mit Ursache und Lösung', meldungGut(m5) && /^KASSE-01/.test(m5.titel), m5 && m5.titel);
    p('5: steht auch im schwarzen Fenster als Kasten', kastenGut(lauf.log(), /KASSE-01: Kassen-Dienst stürzt wiederholt ab/));
    let wieder = null;
    for (let i = 0; i < 40; i++) { wieder = await holen(`http://127.0.0.1:${WEB_PORT}/kc-kassen-start/status`); if (wieder && wieder.kassen[0].dienst === 'laeuft') break; await warte(500); }
    p('5: der Wächter gibt nicht auf – Dienst läuft danach wieder', wieder && wieder.kassen[0].dienst === 'laeuft');
    await stoppe(lauf); lauf = null;

    p('am Ende: alle Ports frei', (await portFrei(47500)) && (await portFrei(47501)) && (await portFrei(47502)) && (await portFrei(WEB_PORT)) && (await portFrei(MGR_PORT)));
  } catch (e) {
    rot++; console.log('FEHLER  Abbruch: ' + (e && e.stack || e)); if (lauf) console.log(lauf.log().slice(-2500));
  } finally {
    await stoppe(lauf);
    offen.forEach((s) => s.close());
    if (vorher) fs.writeFileSync(VERBINDUNGSDATEI, vorher); else fs.rmSync(VERBINDUNGSDATEI, { force: true });
    fs.rmSync(ARBEIT, { recursive: true, force: true });
  }
  console.log(`\nFehlermeldungen mit Lösung (KS-02): ${ok}/${ok + rot} bestanden`);
  process.exit(rot ? 1 : 0);
})();
