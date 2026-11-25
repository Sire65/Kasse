'use strict';
// Selbst-Update der Kassen-PCs (23.11.2026): Installation aus der ZIP, Umzug der alten Anordnung, Update mit
// Prüfsummen, Abbruch bei falscher Prüfsumme, ohne Internet, Marktsperre/Freigabe, Rückfall bei kaputter Version,
// Startdateien (ZIP/Temp/Autostart, Klammern im Pfad, CRLF). Läuft unter Linux mit nachgebautem Server.
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), crypto = require('crypto');
const { spawnSync, spawn } = require('child_process');

const WURZEL = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-starter-'));
process.env.KC_DATEN_WURZEL = path.join(tmp, 'daten');
process.env.KC_UPDATE_PAUSE_MS = '50';
const K = require('../starter/kc-paket');
const Regeln = require('../starter/kc-paket-regeln');

let fehler = 0, nr = 0;
function p(name, ok, extra) { nr++; console.log(`${ok ? 'OK    ' : 'FEHLER'} ${name}${extra ? `  [${extra}]` : ''}`); if (!ok) fehler++; }
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const schreib = (d, rel, inhalt) => { const f = path.join(d, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, inhalt); };
const lies = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return null; } };
function datenLeeren() { fs.rmSync(process.env.KC_DATEN_WURZEL, { recursive: true, force: true }); }

// Ein kleines Programm: meldet sich bereit (oder nicht) und schreibt seine Umgebung auf.
function programm(version, { bereit = true, code = 0 } = {}) {
  return `const fs=require('fs'),path=require('path');
fs.writeFileSync(path.join(process.env.KC_DATEN_WURZEL,'lauf-${version}.json'),JSON.stringify({argv:process.argv.slice(2),db:process.env.KC_SYNC_MANAGER_DB_PATH,zz:process.env.KC_ZENTRAL_ZUGANG,se:process.env.KC_STAND_EINSTELLUNGEN,v:process.env.KC_PROGRAMM_VERSION,modus:process.env.KC_MODUS||null}));
${bereit ? "console.log('[Marktag-Start] ALLES BEREIT');" : "console.error('[Marktag-Start] START ABGEBROCHEN');"}
setTimeout(()=>process.exit(${code}),300);`;
}
function paketBauen(dir, version, dateien) {
  fs.rmSync(dir, { recursive: true, force: true });
  const liste = { format: 'KC_STAND_PAKET_1', version, dateien: {} };
  for (const [rel, inhalt] of Object.entries(dateien)) {
    const buf = Buffer.from(inhalt);
    schreib(dir, rel, buf);
    const n = Regeln.normiert(rel, buf);
    liste.dateien[rel] = { s: sha(n), g: n.length };
  }
  liste.kennung = Regeln.kennungVon(liste.dateien);
  fs.writeFileSync(path.join(dir, 'stand-paket.json'), JSON.stringify(liste));
  return liste;
}
// Nachgebautes GitHub Pages: liefert Dateien aus einem Ordner, zählt Abrufe, kann einzelne Dateien verfälschen.
function server(dir) {
  const s = { abrufe: [], falsch: new Set() };
  s.http = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
    s.abrufe.push(rel);
    const f = path.join(s.dir || dir, rel);
    if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200); res.end(s.falsch.has(rel) ? 'verfaelscht' : fs.readFileSync(f));
  });
  return new Promise((ok) => s.http.listen(0, '127.0.0.1', () => { s.url = `http://127.0.0.1:${s.http.address().port}/`; ok(s); }));
}
function starterLauf(R, args, env = {}) {
  return new Promise((ok) => {
    const k = spawn(process.execPath, [path.join(R, 'starter', 'kc-starter.js'), ...args],
      { env: { ...process.env, KC_INSTALL_DIR: R, KC_KEINE_PAUSE: '1', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let aus = ''; k.stdout.on('data', (d) => { aus += d; }); k.stderr.on('data', (d) => { aus += d; });
    k.on('exit', (code) => ok({ code, aus }));
  });
}
function knoten(args, env = {}) {
  return new Promise((ok) => {
    const k = spawn(process.execPath, args, { env: { ...process.env, KC_KEINE_PAUSE: '1', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = ''; k.stdout.on('data', (d) => { stdout += d; }); k.stderr.on('data', (d) => { stderr += d; });
    k.on('exit', (status) => ok({ status, stdout, stderr }));
  });
}
function starterKopieren(R) {
  for (const f of fs.readdirSync(path.join(WURZEL, 'starter'))) schreib(R, `starter/${f}`, fs.readFileSync(path.join(WURZEL, 'starter', f)));
}
const BACKEND = 'markt-kasse-suite/backend-source';

(async () => {
  // ---------- 1. Regeln und Paketliste ----------
  p('Paket enthält POS, PC-Manager, Backend, Starter, Startdateien', ['pos/index.html', 'pc-manager/index.html', `${BACKEND}/run-manager-service.js`, 'starter/kc-starter.js', 'KC_Manager_Start.cmd', 'KC_Einrichtung.ps1', 'tools/kc-tv-hintergrund.ps1'].every(Regeln.istPaketDatei));
  p('Paket enthält NICHT: Mitglieder-Adressen, Tests, Schulung, Doku, Module, Geheimnisse, Daten',
    !['pc-manager/kc-mitgliedsdaten.js', `${BACKEND}/tests/x.test.cjs`, 'schulung/pos/index.html', 'README.md', `${BACKEND}/node_modules/ws/index.js`,
      `${BACKEND}/kc-sync-manager.sqlite`, `${BACKEND}/kc-sync-manager.sqlite.admin-token.txt`, `${BACKEND}/kc-sync-manager.sqlite.key.pem`, `${BACKEND}/zentral-zugang.json`, 'tests/a.test.cjs', 'supabase/migrations/x.sql', 'pos/.geheim'].some(Regeln.istPaketDatei));
  p('Zeilenenden: CRLF und LF ergeben dieselbe Prüfsumme (.cmd)', sha(Regeln.normiert('A.cmd', Buffer.from('a\r\nb\r\n'))) === sha(Regeln.normiert('A.cmd', Buffer.from('a\nb\n'))));
  p('Andere Dateien bleiben unverändert (Bilder, JS)', Regeln.normiert('x.png', Buffer.from('a\r\n')).toString() === 'a\r\n');
  const repoListe = JSON.parse(fs.readFileSync(path.join(WURZEL, 'stand-paket.json'), 'utf8'));
  p('stand-paket.json passt zum Repository (sonst: node tools/stand-paket.js)', repoListe.kennung === require('../tools/stand-paket').erzeuge().kennung, repoListe.version);
  p('stand-paket.json: Kennung = Fingerabdruck der Dateien', Regeln.kennungVon(repoListe.dateien) === repoListe.kennung);
  p('stand-paket.json: keine Mitgliederdaten, keine Tests', !Object.keys(repoListe.dateien).some((f) => /kc-mitgliedsdaten|\/tests\//.test(f)));
  let abgelehnt = 0;
  for (const boese of ['../windows/x.js', 'C:/x.js', '/etc/passwd', 'pc-manager/kc-mitgliedsdaten.js']) {
    try { K.pruefeListe({ format: 'KC_STAND_PAKET_1', version: 'x', dateien: { [boese]: { s: 'a'.repeat(64), g: 1 } } }); } catch (e) { abgelehnt++; }
  }
  p('Paketliste mit unzulässigen Pfaden wird abgelehnt', abgelehnt === 4);

  // ---------- 2. Installation aus der echten ZIP (Repository-Stand, Startdateien mit CRLF) ----------
  const zip = path.join(tmp, 'Kasse-main (1)');   // Klammern im Ordnernamen wie beim Betreiber
  for (const rel of Object.keys(repoListe.dateien)) {
    const buf = fs.readFileSync(path.join(WURZEL, rel));
    schreib(zip, rel, Regeln.fuerPlatte(rel, Regeln.normiert(rel, buf)));   // wie in der GitHub-ZIP unter Windows
  }
  fs.copyFileSync(path.join(WURZEL, 'stand-paket.json'), path.join(zip, 'stand-paket.json'));
  schreib(zip, 'schulung/pos/index.html', 'nicht im Paket');
  schreib(zip, 'pc-manager/kc-mitgliedsdaten.js', 'GEHEIM');
  const R1 = path.join(tmp, 'KC-Kasse');
  datenLeeren();
  const inst = K.installiereAus({ quelle: zip, R: R1 });
  p('Installation: Programm liegt in programm\\aktuell', fs.existsSync(path.join(R1, 'programm/aktuell', BACKEND, 'run-manager-service.js')));
  p('Installation: dieselbe Kennung wie GitHub - kein unnötiges Update danach', inst.kennung === repoListe.kennung && inst.version === repoListe.version, `${inst.kennung} / ${repoListe.kennung}`);
  p('Installation: Starter und Startdateien in der Wurzel', fs.existsSync(path.join(R1, 'starter/kc-starter.js')) && fs.existsSync(path.join(R1, 'KC_Manager_Start.cmd')) && fs.existsSync(path.join(R1, 'KC_Einrichtung.ps1')));
  p('Installation: Startdateien mit CRLF (sicher für cmd.exe)', /\r\n/.test(lies(path.join(R1, 'KC_Manager_Start.cmd'))) && !/[^\r]\n/.test(lies(path.join(R1, 'KC_Manager_Start.cmd'))));
  p('Installation: Schulung und Mitglieder-Adressen NICHT kopiert', !fs.existsSync(path.join(R1, 'programm/aktuell/schulung')) && !fs.existsSync(path.join(R1, 'programm/aktuell/pc-manager/kc-mitgliedsdaten.js')));
  const s0 = await server(path.join(tmp, 'leer'));
  fs.mkdirSync(path.join(tmp, 'leer'), { recursive: true });
  fs.copyFileSync(path.join(WURZEL, 'stand-paket.json'), path.join(tmp, 'leer', 'stand-paket.json'));
  const e0 = await K.aktualisieren({ R: R1, quelle: s0.url });
  p('Nach der Installation: Update-Prüfung sagt „aktuell“, lädt nichts', e0.hinweis === 'aktuell' && s0.abrufe.length === 1, `${e0.hinweis}, ${s0.abrufe.length} Abrufe`);
  s0.http.close();

  // ---------- 3. Umzug der alten Anordnung (alles direkt in C:\KC-Kasse) ----------
  datenLeeren();
  const R2 = path.join(tmp, 'alt-KC-Kasse');
  schreib(R2, `${BACKEND}/run-manager-service.js`, 'alt');
  for (const f of ['kc-sync-manager.sqlite', 'kc-sync-manager.sqlite-wal', 'kc-sync-manager.sqlite.admin-token.txt', 'kc-sync-manager.sqlite.key.pem', 'kc-sync-manager.sqlite.audit-anchor.json']) schreib(R2, `${BACKEND}/${f}`, `inhalt:${f}`);
  schreib(R2, `${BACKEND}/zentral-zugang.json`, '{"url":"x"}');
  schreib(R2, `${BACKEND}/stand-einstellungen.json`, '{"fernseher":{"aktiv":true,"rand":4}}');
  schreib(R2, `${BACKEND}/node_modules/ws/package.json`, '{}');
  schreib(R2, 'runtime/node.exe', 'node');
  schreib(R2, 'pos/index.html', 'alt');
  schreib(R2, 'KC_Manager_Start.cmd', 'alt');
  K.alteAnordnungAufraeumen(R2);
  const M = path.join(process.env.KC_DATEN_WURZEL, 'manager');
  p('Umzug: Manager-Datenbank mit WAL, Token, Schlüssel, Prüfanker im Datenordner', ['kc-sync-manager.sqlite', 'kc-sync-manager.sqlite-wal', 'kc-sync-manager.sqlite.admin-token.txt', 'kc-sync-manager.sqlite.key.pem', 'kc-sync-manager.sqlite.audit-anchor.json'].every((f) => lies(path.join(M, f)) === `inhalt:${f}`));
  p('Umzug: Zentral-Zugang und Fernseher-Rand übernommen', lies(path.join(process.env.KC_DATEN_WURZEL, 'zentral-zugang.json')) === '{"url":"x"}' && /"rand":4/.test(lies(path.join(process.env.KC_DATEN_WURZEL, 'stand-einstellungen.json'))));
  p('Umzug: Zusatzmodule nach R\\node_modules (kein neuer Download)', fs.existsSync(path.join(R2, 'node_modules/ws/package.json')));
  const altOrdner = fs.readdirSync(path.join(R2, 'alt'));
  p('Umzug: altes Programm nach alt\\ verschoben, nichts gelöscht', altOrdner.length === 1 && fs.existsSync(path.join(R2, 'alt', altOrdner[0], 'pos/index.html')) && fs.existsSync(path.join(R2, 'alt', altOrdner[0], BACKEND, 'kc-sync-manager.sqlite')));
  p('Umzug: Laufzeit und Startdatei bleiben an ihrem Platz', fs.existsSync(path.join(R2, 'runtime/node.exe')) && fs.existsSync(path.join(R2, 'KC_Manager_Start.cmd')) && !fs.existsSync(path.join(R2, 'markt-kasse-suite')));
  fs.writeFileSync(path.join(M, 'kc-sync-manager.sqlite'), 'NEUER STAND');
  schreib(R2, `${BACKEND}/run-manager-service.js`, 'nochmal alt'); schreib(R2, `${BACKEND}/kc-sync-manager.sqlite`, 'ALT');
  K.alteAnordnungAufraeumen(R2);
  p('Umzug zweimal: vorhandene Daten im Datenordner werden NIE überschrieben', lies(path.join(M, 'kc-sync-manager.sqlite')) === 'NEUER STAND');

  // ---------- 4. Update übers Netz ----------
  datenLeeren();
  const R3 = path.join(tmp, 'R3'), q1 = path.join(tmp, 'v1'), q2 = path.join(tmp, 'v2');
  const basis = { [`${BACKEND}/run-manager-service.js`]: programm('v1'), 'pos/a.js': 'A1', 'pos/b.js': 'B1', 'KC_Manager_Start.cmd': '@echo off\necho v1\n' };
  paketBauen(q1, 'v1', basis);
  K.installiereAus({ quelle: q1, R: R3 });
  const v2 = paketBauen(q2, 'v2', { ...basis, [`${BACKEND}/run-manager-service.js`]: programm('v2'), 'pos/b.js': 'B2', 'pos/neu.js': 'N2', 'KC_Manager_Start.cmd': '@echo off\necho v2\n' });
  const s = await server(q2);
  const e1 = await K.aktualisieren({ R: R3, quelle: s.url });
  const geladen = s.abrufe.filter((x) => x !== 'stand-paket.json').sort();
  p('Update: neue Version eingesetzt', e1.aktualisiert === true && K.lokaleListe(R3).version === 'v2', e1.hinweis);
  p('Update: nur geänderte Dateien geladen', JSON.stringify(geladen) === JSON.stringify(['KC_Manager_Start.cmd', `${BACKEND}/run-manager-service.js`, 'pos/b.js', 'pos/neu.js'].sort()), geladen.join(','));
  p('Update: Inhalte richtig', lies(path.join(R3, 'programm/aktuell/pos/b.js')) === 'B2' && lies(path.join(R3, 'programm/aktuell/pos/a.js')) === 'A1');
  p('Update: vorige Version liegt in programm\\vorher', lies(path.join(R3, 'programm/vorher/pos/b.js')) === 'B1');
  p('Update: Startdatei in der Wurzel erneuert (mit CRLF)', lies(path.join(R3, 'KC_Manager_Start.cmd')) === '@echo off\r\necho v2\r\n');
  p('Update: Stand im Datenordner vermerkt', (K.leseJson(K.datenDatei('update-stand.json')) || {}).programm === 'v2');

  // ---------- 5. Falsche Prüfsumme, kein Internet ----------
  paketBauen(q1, 'v3', { ...basis, 'pos/a.js': 'A3' });
  s.dir = q1; s.falsch.add('pos/a.js'); s.abrufe.length = 0;
  const e2 = await K.aktualisieren({ R: R3, quelle: s.url });
  p('Falsche Prüfsumme: Update abgebrochen, laufende Version unverändert', !e2.aktualisiert && /Prüfsumme/.test(e2.fehler || '') && K.lokaleListe(R3).version === 'v2' && lies(path.join(R3, 'programm/aktuell/pos/a.js')) === 'A1', e2.hinweis);
  p('Falsche Prüfsumme: halbfertiger Ordner aufgeräumt', !fs.existsSync(path.join(R3, 'programm/neu')));
  p('Falsche Prüfsumme: 3 Versuche, dann Abbruch', s.abrufe.filter((x) => x === 'pos/a.js').length === 3);
  s.falsch.clear();
  const e3 = await K.aktualisieren({ R: R3, quelle: 'http://127.0.0.1:1/' });
  p('Ohne Internet: vorhandene Version startet, klare Meldung', !e3.aktualisiert && /Kein Internet/.test(e3.hinweis) && K.lokaleListe(R3).version === 'v2', e3.hinweis);

  // Netz beim Start noch nicht bereit: erste Abrufe scheitern, ein späterer klappt (Befund Mini-PC 24.11.)
  const sWack = await server(q2); let fehlschlaege = 2;
  const altHandler = sWack.http.listeners('request')[0];
  sWack.http.removeAllListeners('request');
  sWack.http.on('request', (req, res) => { if (fehlschlaege > 0 && req.url.startsWith('/stand-paket.json')) { fehlschlaege--; req.socket.destroy(); return; } altHandler(req, res); });
  const meldungen = [];
  const e4 = await K.aktualisieren({ R: R3, quelle: sWack.url, log: (t) => meldungen.push(t) });
  p('Netz erst nach 2 Fehlversuchen da: Update klappt trotzdem', !e4.fehler && meldungen.filter((t) => /neuer Versuch/.test(t)).length === 2, e4.hinweis);
  sWack.http.close();

  // ---------- 6. Marktsperre ----------
  schreib(R3, 'programm/aktuell/starter/update-standard.json', fs.readFileSync(path.join(WURZEL, 'starter/update-standard.json')));
  const markttag = new Date('2026-12-06T10:00:00+01:00'), vorher = new Date('2026-12-03T10:00:00+01:00'), nachher = new Date('2026-12-15T10:00:00+01:00');
  p('Marktsperre: am Markttag kein Update am Stand', K.updateErlaubt(R3, 'stand', markttag).erlaubt === false);
  p('Marktsperre: vorher/nachher erlaubt', K.updateErlaubt(R3, 'stand', vorher).erlaubt && K.updateErlaubt(R3, 'stand', nachher).erlaubt);
  p('Marktsperre gilt nicht zu Hause', K.updateErlaubt(R3, 'zuhause', markttag).erlaubt === true);
  K.schreibeJson(K.datenDatei('update-freigabe.json'), { bis: '2026-12-06' });
  p('Freigabe: gilt am freigegebenen Tag', K.updateErlaubt(R3, 'stand', markttag).erlaubt === true);
  p('Freigabe: verfällt am nächsten Tag', K.updateErlaubt(R3, 'stand', new Date('2026-12-07T10:00:00+01:00')).erlaubt === false);
  fs.unlinkSync(K.datenDatei('update-freigabe.json'));
  const UI = require('../markt-kasse-suite/backend-source/update-info');
  process.env.KC_UPDATE_STAND = K.datenDatei('update-stand.json'); process.env.KC_INSTALL_DIR = R3; process.env.KC_PROGRAMM_VERSION = 'v2';
  const ui = UI.updateInfo(markttag);
  p('PC-Manager-Info: Version und Marktsperre', ui.verwaltet && ui.version === 'v2' && ui.sperre && ui.sperre.aktiv === true && ui.sperre.bis === '2026-12-14');
  UI.freigeben();
  p('PC-Manager: „Update freigeben“ schreibt die Freigabe für heute', (K.leseJson(K.datenDatei('update-freigabe.json')) || {}).bis === UI.heuteIso());
  fs.unlinkSync(K.datenDatei('update-freigabe.json'));
  delete process.env.KC_UPDATE_STAND; delete process.env.KC_INSTALL_DIR; delete process.env.KC_PROGRAMM_VERSION;
  p('Ohne Starter gestartet: „nicht verwaltet“, kein Fehler', UI.updateInfo().verwaltet === false);

  // ---------- 7. Starter als Ganzes: Rückfall bei kaputter Version ----------
  datenLeeren();
  const R4 = path.join(tmp, 'R4 (mit Klammer)'), g1 = path.join(tmp, 'gut'), k2 = path.join(tmp, 'kaputt');
  paketBauen(g1, 'gut-1', { [`${BACKEND}/run-manager-service.js`]: programm('gut-1'), [`${BACKEND}/stand-einstellungen.json`]: '{"fernseher":{"aktiv":true}}' });
  K.installiereAus({ quelle: g1, R: R4 }); starterKopieren(R4);
  paketBauen(k2, 'kaputt-2', { [`${BACKEND}/run-manager-service.js`]: programm('kaputt-2', { bereit: false, code: 1 }) });
  const s2 = await server(k2);
  const l1 = await starterLauf(R4, ['start', '--modus', 'stand'], { KC_UPDATE_QUELLE: s2.url });
  const st1 = K.leseJson(K.datenDatei('update-stand.json')) || {};
  p('Rückfall: kaputte Version geladen, startete nicht, vorige läuft wieder', l1.code === 0 && K.lokaleListe(R4).version === 'gut-1' && fs.existsSync(path.join(process.env.KC_DATEN_WURZEL, 'lauf-kaputt-2.json')) && fs.existsSync(path.join(process.env.KC_DATEN_WURZEL, 'lauf-gut-1.json')), l1.aus.split('\n').filter((z) => /Starter|Rückfall|NEUE/.test(z)).join(' | '));
  p('Rückfall: kaputte Version gemerkt', (st1.defekteVersionen || []).includes('kaputt-2') && st1.letzterRueckfall && st1.letzterRueckfall.version === 'kaputt-2');
  s2.abrufe.length = 0;
  const l2 = await starterLauf(R4, ['start', '--modus', 'stand'], { KC_UPDATE_QUELLE: s2.url });
  p('Rückfall: kaputte Version wird beim nächsten Start übersprungen', l2.code === 0 && s2.abrufe.length === 1 && K.lokaleListe(R4).version === 'gut-1', s2.abrufe.join(','));
  const lauf = K.leseJson(path.join(process.env.KC_DATEN_WURZEL, 'lauf-gut-1.json')) || {};
  p('Programm bekommt Datenpfade aus dem Datenordner (Datenbank, Zentral-Zugang, Fernseher)', lauf.db === path.join(process.env.KC_DATEN_WURZEL, 'manager', 'kc-sync-manager.sqlite')
    && lauf.zz === path.join(process.env.KC_DATEN_WURZEL, 'zentral-zugang.json') && lauf.se === path.join(process.env.KC_DATEN_WURZEL, 'stand-einstellungen.json') && lauf.v === 'gut-1', JSON.stringify(lauf));
  p('Fernseher-Einstellungen: Vorgabe beim ersten Start in den Datenordner kopiert', /"aktiv":true/.test(lies(path.join(process.env.KC_DATEN_WURZEL, 'stand-einstellungen.json')) || ''));
  p('Programm wird mit --open-manager gestartet', (lauf.argv || []).includes('--open-manager'));
  s2.http.close();

  // Beide Versionen starten nicht (z. B. Port belegt) -> nicht die Version beschuldigen
  datenLeeren();
  const R5 = path.join(tmp, 'R5'), b1 = path.join(tmp, 'b1'), b2 = path.join(tmp, 'b2');
  paketBauen(b1, 'alt-1', { [`${BACKEND}/run-manager-service.js`]: programm('alt-1', { bereit: false, code: 1 }) });
  K.installiereAus({ quelle: b1, R: R5 }); starterKopieren(R5);
  paketBauen(b2, 'neu-2', { [`${BACKEND}/run-manager-service.js`]: programm('neu-2', { bereit: false, code: 1 }) });
  const s3 = await server(b2);
  const l3 = await starterLauf(R5, ['start', '--modus', 'stand'], { KC_UPDATE_QUELLE: s3.url });
  const st3 = K.leseJson(K.datenDatei('update-stand.json')) || {};
  p('Beide starten nicht: neue Version bleibt, wird nicht als kaputt markiert, Fehlercode an das Fenster', l3.code === 1 && K.lokaleListe(R5).version === 'neu-2' && !(st3.defekteVersionen || []).includes('neu-2'), `Code ${l3.code}`);
  s3.http.close();

  // Zu Hause: --zuhause, keine Marktsperre
  datenLeeren();
  const l4 = await starterLauf(R4, ['start', '--modus', 'zuhause', '--ohne-update']);
  const lz = K.leseJson(path.join(process.env.KC_DATEN_WURZEL, 'lauf-gut-1.json')) || {};
  p('Zu Hause: Programm mit --zuhause gestartet', l4.code === 0 && (lz.argv || []).includes('--zuhause') && lz.modus === 'zuhause');

  // Programmordner fehlt -> klare Meldung statt Absturz
  const R6 = path.join(tmp, 'R6'); starterKopieren(R6);
  const l5 = await starterLauf(R6, ['start']);
  p('Programmordner fehlt: klare Meldung, Fehlercode 1', l5.code === 1 && /PROGRAMM FEHLT/.test(l5.aus));

  // Installieren über die Befehlszeile (wie KC_Manager_Start.cmd aus dem entpackten Ordner)
  datenLeeren();
  const q7 = path.join(tmp, 'zip7'), R7 = path.join(tmp, 'ziel7');
  paketBauen(q7, 'z-7', { [`${BACKEND}/run-manager-service.js`]: programm('z-7') }); starterKopieren(q7);
  const l6 = spawnSync(process.execPath, [path.join(q7, 'starter/kc-starter.js'), 'installieren', '--quelle', q7, '--ziel', R7], { encoding: 'utf8', env: { ...process.env, KC_KEINE_PAUSE: '1' } });
  p('Installieren per Befehl: Ziel eingerichtet, Starter kopiert', l6.status === 0 && fs.existsSync(path.join(R7, 'starter/kc-starter.js')) && /^z-7/.test(K.lokaleListe(R7).version), (l6.stdout + l6.stderr).slice(-200));
  const l7 = spawnSync(process.execPath, [path.join(q7, 'starter/kc-starter.js'), 'installieren', '--quelle', path.join(tmp, 'gibtsnicht'), '--ziel', R7], { encoding: 'utf8', env: { ...process.env, KC_KEINE_PAUSE: '1' } });
  p('Installieren aus unvollständigem Ordner: klare Meldung', l7.status === 1 && /vollständig entpacken|ZIP vollständig/.test(l7.stdout));

  // ---------- 7b. Kleine Installations-ZIP: Programm aus dem Netz ----------
  datenLeeren();
  const qn = path.join(tmp, 'netz'), R8 = path.join(tmp, 'netz-ziel');
  paketBauen(qn, 'netz-1', { [`${BACKEND}/run-manager-service.js`]: programm('netz-1'), 'pos/x.js': 'X', 'KC_Manager_Start.cmd': '@echo off\n' });
  const sn = await server(qn);
  const klein = path.join(tmp, 'klein'); starterKopieren(klein); schreib(klein, 'KC_Manager_Start.cmd', 'x');
  const l8 = await knoten([path.join(klein, 'starter/kc-starter.js'), 'installieren', '--quelle', klein, '--ziel', R8], { KC_UPDATE_QUELLE: sn.url });
  p('Kleine ZIP: Programm aus dem Netz installiert', l8.status === 0 && K.lokaleListe(R8).version === 'netz-1' && lies(path.join(R8, 'programm/aktuell/pos/x.js')) === 'X', (l8.stdout + l8.stderr).slice(-600));
  p('Kleine ZIP: Starter und Startdatei in der Wurzel', fs.existsSync(path.join(R8, 'starter/kc-starter.js')) && lies(path.join(R8, 'KC_Manager_Start.cmd')) === '@echo off\r\n');
  sn.http.close();
  const l9 = await knoten([path.join(klein, 'starter/kc-starter.js'), 'installieren', '--quelle', klein, '--ziel', path.join(tmp, 'netz-ziel2')], { KC_UPDATE_QUELLE: 'http://127.0.0.1:1/' });
  p('Kleine ZIP ohne Internet: klare Meldung', l9.status === 1 && /Internetverbindung prüfen/.test(l9.stdout), l9.stdout.slice(-160));
  let platzFehler = '';
  try { K.platzPruefen(tmp, { dateien: { a: { g: 1e15 } } }); } catch (e) { platzFehler = e.message; }
  p('Zu wenig Speicherplatz: klare Meldung vor dem Laden', /Zu wenig Speicherplatz/.test(platzFehler) && /Downloads/.test(platzFehler));
  const iz = require('../tools/installer-zip');
  const izGroesse = fs.statSync(iz.ZIEL).size;
  const izListe = spawnSync('unzip', ['-l', iz.ZIEL], { encoding: 'utf8' }).stdout || '';
  p('Installations-ZIP: klein und vollständig', izGroesse < 200 * 1024 && ['KC_Manager_Start.cmd', 'KC_Zuhause_Start.cmd', 'KC_Einrichtung.ps1', 'starter/kc-starter.js', 'starter/kc-paket.js', 'starter/kc-paket-regeln.js', 'LIES_MICH.txt'].every((f) => izListe.includes(f)), `${(izGroesse / 1024).toFixed(0)} KB`);
  p('Installations-ZIP: passt zum aktuellen Starter (sonst: node tools/installer-zip.js)', iz.bauen().geaendert === false);

  // ---------- 8. Startdateien ----------
  const cmd = lies(path.join(WURZEL, 'KC_Manager_Start.cmd'));
  const zeilen = cmd.replace(/\r/g, '').split('\n');
  const blockZeilen = []; let tiefe = 0;
  for (const z of zeilen) {
    if (/^\s*(rem|echo|::)/i.test(z)) continue;
    if (tiefe > 0 && /%/.test(z)) blockZeilen.push(z);
    tiefe += (z.match(/\(\s*$/) ? 1 : 0); if (/^\s*\)/.test(z)) tiefe--;
  }
  p('KC_Manager_Start.cmd: keine ( … )-Blöcke (Klammern im Ordnernamen)', !zeilen.some((z) => !/^\s*(rem|echo)/i.test(z) && /\(\s*$/.test(z)) && blockZeilen.length === 0);
  p('KC_Manager_Start.cmd: Programmaufrufe enden mit „& exit /b“ (Datei darf erneuert werden)', zeilen.filter((z) => /kc-starter\.js" start/.test(z)).every((z) => /& exit \/b\s*$/.test(z)) && zeilen.filter((z) => /kc-starter\.js" start/.test(z)).length >= 2);
  p('KC_Manager_Start.cmd: erkennt Start aus ZIP/Temp und Autostart-Kopie', /\.zip\\=/.test(cmd) && /\\Temp1_=/.test(cmd) && /AppData\\Local\\Temp=/.test(cmd) && /Programs\\Startup=/.test(cmd));
  p('Startdateien und Einrichtung nur ASCII (keine Umlaut-Fehler unter Windows)', ['KC_Manager_Start.cmd', 'KC_Zuhause_Start.cmd', 'KC_Einrichtung.ps1', 'KC_Router_Pruefen.cmd', 'KC_MiniPC_Einrichten.cmd'].every((f) => !/[^\x00-\x7F]/.test(lies(path.join(WURZEL, f)))));
  p('.gitattributes: Startdateien mit CRLF', /\*\.cmd text eol=crlf/.test(lies(path.join(WURZEL, '.gitattributes'))) && /\*\.ps1 text eol=crlf/.test(lies(path.join(WURZEL, '.gitattributes'))));
  const ps1 = lies(path.join(WURZEL, 'KC_Einrichtung.ps1'));
  p('Einrichtung: Parameter -Ziel, Module nach <Ziel>\\node_modules, Prüfsumme für Node', /param\(\[string\]\$Ziel\)/.test(ps1) && /\$ZielModule = Join-Path \$Ziel 'node_modules'/.test(ps1) && /SHA256/.test(ps1));
  p('Einrichtung: Modulversionen wie im Backend', (() => { const pk = JSON.parse(lies(path.join(WURZEL, BACKEND, 'package.json'))).dependencies; return Object.entries(pk).every(([n, v]) => ps1.includes(`'${n}' = '${v}'`)); })());
  p('Zuhause-Start ruft den Manager-Start mit --zuhause', /KC_Manager_Start\.cmd" --zuhause %\* & exit \/b/.test(lies(path.join(WURZEL, 'KC_Zuhause_Start.cmd'))));

  // PC-Manager öffnet sich sicher (25.11.2026): Edge/Chrome direkt auf dem Hauptbildschirm, dazu Desktop-Verknüpfung
  const rms = lies(path.join(WURZEL, BACKEND, 'run-manager-service.js'));
  p('PC-Manager: wird mit Edge/Chrome direkt geöffnet (neues Fenster, Hauptbildschirm), „start“ nur als Rückfall', /const browser = findeBrowser\(\);[\s\S]{0,200}'--new-window', '--window-position=40,40'/.test(rms));
  p('PC-Manager: Desktop-Verknüpfung „KC PC-Manager“ wird bei jedem Start angelegt, falls sie fehlt', typeof K.pcManagerVerknuepfung === 'function' && K.pcManagerVerknuepfung() === false && /K\.pcManagerVerknuepfung\(log\)/.test(lies(path.join(WURZEL, 'starter/kc-starter.js'))));

  // Kassen-Tablets: neue Version übernehmen
  const sw = lies(path.join(WURZEL, 'pos/service-worker.js')), idx = lies(path.join(WURZEL, 'pos/index.html'));
  const pv = lies(path.join(WURZEL, 'pos/kc-programm-version.js'));
  p('Tablets: Versionsabfrage eingebunden und offline verfügbar', /kc-programm-version\.js\?build=1\.0\.0/.test(idx) && /kc-programm-version\.js\?build=1\.0\.0/.test(sw));
  p('Tablets: Neuladen nur bei leerem Bon, ohne offenes Fenster, nach Ruhepause', /state\.cart\.length === 0/.test(pv) && /dialog\[open\]/.test(pv) && /RUHE_MS/.test(pv));

  console.log(fehler ? `\nKC-Starter: ${fehler} von ${nr} FEHLGESCHLAGEN` : `\nKC-Starter: alle ${nr} bestanden`);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(fehler ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
