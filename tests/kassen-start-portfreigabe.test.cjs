/* KS-03 – belegte Ports werden freigeräumt, statt dass der Start abbricht (ohne Adminrechte).
 *
 *   A  Ein altes schwarzes Fenster läuft noch          -> wird beendet, neuer Start läuft ALLES BEREIT
 *   B  Fremdes Programm auf dem Manager-Port            -> wird NICHT beendet, Abbruch nennt das Programm
 *   C  Fremdes Programm auf dem Port von KASSE-03       -> nicht beendet, Meldung nennt es; nach dem
 *                                                          Schließen läuft KASSE-03 von selbst an
 *   D  Verwaister alter Kassen-Dienst auf KASSE-02-Port -> wird beendet, KASSE-02 läuft
 *   E  Baustein: Port-Besitzer wird samt Befehlszeile erkannt
 */
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http'), net = require('net');
const { spawn } = require('child_process');
const WURZEL = path.join(__dirname, '..');
const BACKEND = path.join(WURZEL, 'markt-kasse-suite', 'backend-source');
for (const m of ['ws', 'selfsigned', 'bonjour-service']) {
  try { require.resolve(m, { paths: [BACKEND] }); } catch (e) { console.log(`  ueberspringen: ${m} fehlt - einmal "npm install" in markt-kasse-suite/backend-source`); process.exit(0); }
}
const { portBesitzer } = require(path.join(BACKEND, 'port-freigabe.js'));
let ok = 0, rot = 0;
const p = (n, b, z = '') => { b ? ok++ : rot++; console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z !== '' ? '   [' + String(z).slice(0, 160) + ']' : ''}`); };
const MGR_PORT = 8574, WEB_PORT = 8894;
const ARBEIT = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-portfrei-'));
const DATEN = path.join(ARBEIT, 'tablet-kassen');
const VERBINDUNGSDATEI = path.join(WURZEL, 'pc-manager', 'kassen-verbindungen.json');
const vorher = fs.existsSync(VERBINDUNGSDATEI) ? fs.readFileSync(VERBINDUNGSDATEI) : null;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const portFrei = (port) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.listen(port, '0.0.0.0', () => s.close(() => r(true))); });
const holen = (url) => new Promise((r) => { http.get(url, (res) => { let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => { try { r(JSON.parse(d)); } catch (e) { r(null); } }); }).on('error', () => r(null)); });
const lebt = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return false; } };
// Ein FREMDES Programm: eigener Prozess, nichts mit KC im Befehl.
async function fremdesProgramm(port) {
  const k = spawn(process.execPath, ['-e', `require('http').createServer((q,a)=>a.end('fremd')).listen(${port},'0.0.0.0',()=>console.log('bereit'))`], { stdio: ['ignore', 'pipe', 'ignore'] });
  await new Promise((r) => k.stdout.once('data', r));
  return k;
}
async function starte(name, { bis = /\[Marktag-Start\]/, sekunden = 80, db = 'manager' } = {}) {
  const kind = spawn(process.execPath, [path.join(BACKEND, 'run-manager-service.js'), '--db', path.join(ARBEIT, `${db}.sqlite`), '--port', String(MGR_PORT), '--webserver-port', String(WEB_PORT)], {
    cwd: BACKEND, env: { ...process.env, KC_KASSEN_DATEN: DATEN }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  kind.stdout.on('data', (d) => { log += d; }); kind.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < sekunden * 4 && !bis.test(log) && kind.exitCode === null; i++) await warte(250);
  await warte(300);
  return { kind, log: () => log, name };
}
async function stoppe(lauf) {
  if (!lauf || lauf.kind.exitCode !== null) return;
  const weg = new Promise((r) => lauf.kind.once('exit', r));
  lauf.kind.kill('SIGINT'); await Promise.race([weg, warte(15000)]);
  if (lauf.kind.exitCode === null) lauf.kind.kill('SIGKILL');
  await warte(500);
}

(async () => {
  const laeufe = []; const fremde = [];
  try {
    for (const port of [MGR_PORT, WEB_PORT, 47392, 47500, 47501, 47502]) {
      if (!(await portFrei(port))) { console.log(`Port ${port} ist belegt - Test kann nicht laufen.`); process.exit(1); }
    }

    // ---- E: Baustein ----
    const f0 = await fremdesProgramm(47555); fremde.push(f0);
    const b0 = portBesitzer(47555);
    p('E: Besitzer eines Ports wird erkannt (Prozess und Befehlszeile)', b0 && b0.pid === f0.pid && /createServer/.test(b0.befehl), b0 && `${b0.pid} ${b0.name}`);
    f0.kill(); fremde.pop();

    // ---- A: altes Fenster läuft noch ----
    console.log('\n-- A: zweites Fenster, das erste läuft noch --');
    const alt = await starte('alt'); laeufe.push(alt);
    p('A: erstes Fenster läuft', /ALLES BEREIT/.test(alt.log()));
    const neu = await starte('neu'); laeufe.push(neu);
    p('A: neues Fenster beendet das alte selbst ("ALTEN Kassenfenster … beendet")', /Port 8574 \(Manager-Dienst\) ist von einem ALTEN Kassenfenster belegt/.test(neu.log()) && /Altes Kassenfenster \(Prozess \d+\) beendet – Port 8574 ist frei, Start geht weiter/.test(neu.log()));
    p('A: neues Fenster startet trotzdem komplett: ALLES BEREIT', /ALLES BEREIT/.test(neu.log()) && !/START ABGEBROCHEN/.test(neu.log()));
    await warte(1000);
    p('A: das alte Fenster ist beendet', alt.kind.exitCode !== null || alt.kind.signalCode !== null);
    const sA = await holen(`http://127.0.0.1:${WEB_PORT}/kc-kassen-start/status`);
    p('A: alle drei Kassen laufen im neuen Fenster', sA && sA.kassen.every((k) => k.dienst === 'laeuft'));
    await stoppe(neu);

    // ---- B: fremdes Programm auf dem Manager-Port ----
    console.log('\n-- B: fremdes Programm auf dem Manager-Port --');
    const fB = await fremdesProgramm(MGR_PORT); fremde.push(fB);
    const b = await starte('b', { bis: /START ABGEBROCHEN/ }); laeufe.push(b);
    p('B: Start bricht ab (fremdes Programm wird nicht angetastet)', /START ABGEBROCHEN/.test(b.log()) && lebt(fB.pid));
    p('B: Meldung nennt Programm und Prozessnummer', new RegExp(`Port ${MGR_PORT} ist belegt von „node“ \\(Prozess ${fB.pid}\\)`).test(b.log()), (b.log().match(/FEHLER: .+/) || [''])[0]);
    p('B: Lösung sagt, wie genau dieses Programm zu beenden ist', new RegExp(`„node“ \\(PID ${fB.pid}\\) → „Task beenden“`).test(b.log()));
    fB.kill(); fremde.splice(fremde.indexOf(fB), 1); await warte(500);

    // ---- C: fremdes Programm auf KASSE-03 ----
    console.log('\n-- C: fremdes Programm auf dem Port von KASSE-03 --');
    const fC = await fremdesProgramm(47502); fremde.push(fC);
    const c = await starte('c'); laeufe.push(c);
    p('C: Start läuft durch (BEREIT MIT WARNUNGEN), fremdes Programm lebt', /BEREIT MIT WARNUNGEN/.test(c.log()) && lebt(fC.pid));
    p('C: Meldung nennt KASSE-03, Port und das Programm', new RegExp(`KASSE-03: Port 47502 ist belegt von „node“ \\(Prozess ${fC.pid}\\)`).test(c.log()));
    const sC = await holen(`http://127.0.0.1:${WEB_PORT}/kc-kassen-start/status`);
    p('C: KASSE-01 und KASSE-02 laufen', sC && sC.kassen.filter((k) => k.id !== 'KASSE-03').every((k) => k.dienst === 'laeuft'));
    fC.kill(); fremde.splice(fremde.indexOf(fC), 1);
    let geheilt = null;
    for (let i = 0; i < 45; i++) { await warte(1000); geheilt = await holen(`http://127.0.0.1:${WEB_PORT}/kc-kassen-start/status`); if (geheilt && geheilt.kassen.find((k) => k.id === 'KASSE-03').dienst === 'laeuft') break; }
    p('C: Programm geschlossen -> KASSE-03 läuft von selbst an, Meldung weg', geheilt && geheilt.kassen.find((k) => k.id === 'KASSE-03').dienst === 'laeuft' && !geheilt.meldungen.some((m) => /KASSE-03/.test(m.titel)));
    await stoppe(c);

    // ---- D: verwaister alter Kassen-Dienst ----
    console.log('\n-- D: verwaister alter Kassen-Dienst auf dem Port von KASSE-02 --');
    const waise = spawn(process.execPath, [path.join(BACKEND, 'run-device-companion.js'), '--db', path.join(ARBEIT, 'waise.sqlite'), '--status-port', '47501', '--bind', '0.0.0.0'], { cwd: BACKEND, stdio: ['ignore', 'pipe', 'ignore'] });
    fremde.push(waise);
    for (let i = 0; i < 40 && (await portFrei(47501)); i++) await warte(250);
    const d = await starte('d'); laeufe.push(d);
    p('D: verwaister alter Kassen-Dienst wird erkannt und beendet', /Port 47501 \(KASSE-02\) ist von einem ALTEN Kassenfenster belegt \(Prozess \d+, run-device-companion\.js\)/.test(d.log()));
    await warte(500);
    p('D: der verwaiste Prozess ist weg', !lebt(waise.pid) || waise.exitCode !== null || waise.signalCode !== null);
    p('D: ALLES BEREIT, alle drei Kassen laufen', /ALLES BEREIT/.test(d.log()) && ((await holen(`http://127.0.0.1:${WEB_PORT}/kc-kassen-start/status`)) || { kassen: [] }).kassen.every((k) => k.dienst === 'laeuft'));
    await stoppe(d);

    p('am Ende: alle Ports frei', (await portFrei(47500)) && (await portFrei(47501)) && (await portFrei(47502)) && (await portFrei(WEB_PORT)) && (await portFrei(MGR_PORT)) && (await portFrei(47392)));
  } catch (e) {
    rot++; console.log('FEHLER  Abbruch: ' + (e && e.stack || e)); const l = laeufe[laeufe.length - 1]; if (l) console.log(l.log().slice(-2500));
  } finally {
    for (const l of laeufe) await stoppe(l);
    for (const f of fremde) { try { f.kill('SIGKILL'); } catch (e) { /* */ } }
    if (vorher) fs.writeFileSync(VERBINDUNGSDATEI, vorher); else fs.rmSync(VERBINDUNGSDATEI, { force: true });
    fs.rmSync(ARBEIT, { recursive: true, force: true });
  }
  console.log(`\nPort-Freigabe ohne Adminrechte (KS-03): ${ok}/${ok + rot} bestanden`);
  process.exit(rot ? 1 : 0);
})();
