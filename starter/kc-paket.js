'use strict';
// KC MarktKasse - Installieren, Umziehen, Aktualisieren und Zurückfallen (Selbst-Update, 23.11.2026).
//
// Ordner (Installationswurzel R, normal C:\KC-Kasse):
//   R\runtime\            Node.js (einmal eingerichtet, nie überschrieben)
//   R\node_modules\       Zusatzmodule ws, bonjour-service, selfsigned (einmal eingerichtet)
//   R\starter\            dieser Starter (wird nach erfolgreichem Update selbst erneuert)
//   R\programm\aktuell\   laufende Programmversion (mit stand-paket.json)
//   R\programm\vorher\    vorige Version - Rückfall, wenn die neue nicht startet
//   R\KC_*.cmd            Startdateien (zeigen immer auf R, bleiben über Updates gleich nutzbar)
// Daten (nie im Programmordner): %LOCALAPPDATA%\KC-MarktKasse\ - Kassen, Manager-Datenbank mit Schlüsseln,
// Einstellungen, Update-Stand.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const os = require('os');
const { spawn, spawnSync } = require('child_process');
const { istPaketDatei, WURZEL_DATEIEN, normiert, fuerPlatte, kennungVon, hatFrontMatter } = require('./kc-paket-regeln');

const QUELLE_STANDARD = 'https://sire65.github.io/Kasse/';
const MANAGER_DB = 'kc-sync-manager.sqlite';
const REIHUM = 6;

// ---------- Pfade ----------
function datenWurzel() {
  if (process.env.KC_DATEN_WURZEL) return path.resolve(process.env.KC_DATEN_WURZEL);
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, 'KC-MarktKasse');
  return path.join(os.homedir(), '.kc-marktkasse');
}
function pfade(R) {
  const p = path.join(R, 'programm');
  return { R, runtime: path.join(R, 'runtime'), module: path.join(R, 'node_modules'), starter: path.join(R, 'starter'),
    programm: p, aktuell: path.join(p, 'aktuell'), vorher: path.join(p, 'vorher'), neu: path.join(p, 'neu'), defekt: path.join(p, 'defekt'),
    daten: datenWurzel() };
}
const datenDatei = (name) => path.join(datenWurzel(), name);
function leseJson(datei, standard = null) { try { return JSON.parse(fs.readFileSync(datei, 'utf8').replace(/^\uFEFF/, '')); } catch (e) { return standard; } }
function schreibeJson(datei, daten) {
  fs.mkdirSync(path.dirname(datei), { recursive: true });
  const tmp = `${datei}.tmp`; fs.writeFileSync(tmp, JSON.stringify(daten, null, 2)); fs.renameSync(tmp, datei);
}
// Umbenennen mit Wiederholung (Virenscanner/Indexer halten Dateien unter Windows manchmal kurz fest).
function umbenennen(von, nach) {
  let letzter;
  for (let i = 0; i < 8; i++) {
    try { fs.renameSync(von, nach); return; } catch (e) { letzter = e; if (!/EPERM|EBUSY|EACCES/.test(e.code || '')) throw e; }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250 * (i + 1));
  }
  throw letzter;
}
function loeschen(p) { try { fs.rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (e) { /* */ } }

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
function dateiSha(rel, datei) { try { return sha(normiert(rel, fs.readFileSync(datei))); } catch (e) { return null; } }

// ---------- Netz ----------
function laden(url, { zeitlimitMs = 30000, umleitungen = 5 } = {}) {
  return new Promise((ok, fehler) => {
    const mod = url.startsWith('https:') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'KC-MarktKasse-Starter', 'Cache-Control': 'no-cache' }, timeout: zeitlimitMs }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && umleitungen > 0) {
        res.resume(); return ok(laden(new URL(res.headers.location, url).toString(), { zeitlimitMs, umleitungen: umleitungen - 1 }));
      }
      if (res.statusCode !== 200) { res.resume(); return fehler(new Error(`HTTP ${res.statusCode} für ${url}`)); }
      const teile = []; res.on('data', (c) => teile.push(c)); res.on('end', () => ok(Buffer.concat(teile))); res.on('error', fehler);
    });
    req.on('timeout', () => req.destroy(new Error(`Zeitüberschreitung (${Math.round(zeitlimitMs / 1000)} s) für ${url}`)));
    req.on('error', fehler);
  });
}

// ---------- Paketliste ----------
function lokaleListe(R) { return leseJson(path.join(pfade(R).aktuell, 'stand-paket.json')); }
function pruefeListe(liste) {
  if (!liste || liste.format !== 'KC_STAND_PAKET_1' || !liste.version || !liste.dateien || typeof liste.dateien !== 'object') throw new Error('Paketliste ist ungültig.');
  for (const rel of Object.keys(liste.dateien)) {
    if (rel.includes('..') || path.isAbsolute(rel) || /^[a-z]:/i.test(rel) || !istPaketDatei(rel)) throw new Error(`Paketliste enthält unzulässigen Pfad: ${rel}`);
    if (!/^[0-9a-f]{64}$/.test(String(liste.dateien[rel].s))) throw new Error(`Paketliste: Prüfsumme fehlt für ${rel}`);
  }
  return liste;
}
async function fernListe(quelle = QUELLE_STANDARD) {
  const buf = await laden(`${quelle}stand-paket.json?t=${Date.now()}`, { zeitlimitMs: 10000 });
  return pruefeListe(JSON.parse(buf.toString('utf8')));
}

// ---------- Paket in einen Ordner bauen (aus vorhandenen Dateien + Download) ----------
async function baueNeu({ R, liste, holen, log = () => {} }) {
  const P = pfade(R);
  loeschen(P.neu); fs.mkdirSync(P.neu, { recursive: true });
  const offen = [];
  for (const [rel, d] of Object.entries(liste.dateien)) {
    const ziel = path.join(P.neu, rel);
    const vorhanden = path.join(P.aktuell, rel);
    if (dateiSha(rel, vorhanden) === d.s) { fs.mkdirSync(path.dirname(ziel), { recursive: true }); fs.copyFileSync(vorhanden, ziel); }
    else offen.push(rel);
  }
  log(`Update: ${offen.length} von ${Object.keys(liste.dateien).length} Dateien neu laden …`);
  let i = 0, fertig = 0, bytes = 0;
  const arbeiter = async () => {
    while (i < offen.length) {
      const rel = offen[i++], d = liste.dateien[rel];
      let letzter = null;
      for (let versuch = 0; versuch < 3; versuch++) {
        try {
          const buf = await holen(rel);
          if (sha(normiert(rel, buf)) !== d.s) throw new Error(`Prüfsumme stimmt nicht: ${rel}`);
          const ziel = path.join(P.neu, rel);
          fs.mkdirSync(path.dirname(ziel), { recursive: true }); fs.writeFileSync(ziel, fuerPlatte(rel, buf));
          letzter = null; bytes += buf.length; break;
        } catch (e) { letzter = e; }
      }
      if (letzter) throw letzter;
      fertig++;
      if (fertig % 25 === 0 || fertig === offen.length) log(`Update: ${fertig}/${offen.length} geladen (${(bytes / 1e6).toFixed(1)} MB)`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(REIHUM, offen.length) }, arbeiter));
  // Abschlussprüfung: jede Datei der Liste liegt mit richtiger Prüfsumme in "neu"
  for (const [rel, d] of Object.entries(liste.dateien)) {
    if (dateiSha(rel, path.join(P.neu, rel)) !== d.s) throw new Error(`Abschlussprüfung: ${rel} fehlt oder ist beschädigt`);
  }
  schreibeJson(path.join(P.neu, 'stand-paket.json'), liste);
  return { geladen: offen.length, bytes };
}

// Neue Version einsetzen: aktuell → vorher, neu → aktuell. Danach Starter/Startdateien erneuern.
function tausche(R, log = () => {}) {
  const P = pfade(R);
  const hatteAktuell = fs.existsSync(P.aktuell);
  if (hatteAktuell) {
    loeschen(P.vorher);
    if (fs.existsSync(P.vorher)) throw new Error(`Alte Sicherung ${P.vorher} lässt sich nicht entfernen (Datei geöffnet?).`);
    umbenennen(P.aktuell, P.vorher);
  }
  try { umbenennen(P.neu, P.aktuell); }
  catch (e) { if (hatteAktuell && !fs.existsSync(P.aktuell)) umbenennen(P.vorher, P.aktuell); throw e; }
  starterUndStartdateienErneuern(R, log);
}
function starterUndStartdateienErneuern(R, log = () => {}) {
  const P = pfade(R);
  const quelleStarter = path.join(P.aktuell, 'starter');
  if (fs.existsSync(quelleStarter)) {
    fs.mkdirSync(P.starter, { recursive: true });
    for (const f of fs.readdirSync(quelleStarter)) {
      const q = path.join(quelleStarter, f), z = path.join(P.starter, f);
      if (fs.statSync(q).isFile() && (!fs.existsSync(z) || !fs.readFileSync(q).equals(fs.readFileSync(z)))) fs.copyFileSync(q, z);
    }
  }
  for (const f of fs.readdirSync(P.aktuell)) {
    if (!WURZEL_DATEIEN.test(f)) continue;
    const q = path.join(P.aktuell, f), z = path.join(R, f);
    if (!fs.statSync(q).isFile()) continue;
    if (!fs.existsSync(z) || !fs.readFileSync(q).equals(fs.readFileSync(z))) { try { fs.copyFileSync(q, z); } catch (e) { log(`Hinweis: ${f} konnte nicht erneuert werden (${e.message}).`); } }
  }
}

// Rückfall: aktuell (kaputt) → defekt, vorher → aktuell. Die kaputte Version wird gemerkt und nicht wieder installiert.
function zurueckfallen(R, grund, log = () => {}) {
  const P = pfade(R);
  if (!fs.existsSync(P.vorher)) return false;
  const kaputt = lokaleListe(R);
  loeschen(P.defekt);
  if (fs.existsSync(P.aktuell)) umbenennen(P.aktuell, P.defekt);
  try { umbenennen(P.vorher, P.aktuell); }
  catch (e) { if (!fs.existsSync(P.aktuell) && fs.existsSync(P.defekt)) umbenennen(P.defekt, P.aktuell); throw e; }
  starterUndStartdateienErneuern(R, log);
  const st = leseJson(datenDatei('update-stand.json'), {}) || {};
  st.defekteVersionen = [...new Set([...(st.defekteVersionen || []), kaputt && kaputt.version].filter(Boolean))].slice(-10);
  st.letzterRueckfall = { zeit: new Date().toISOString(), version: kaputt && kaputt.version, grund: String(grund).slice(0, 500) };
  schreibeJson(datenDatei('update-stand.json'), st);
  log(`Rückfall: Version ${kaputt && kaputt.version} startete nicht – zurück auf die vorige Version.`);
  return true;
}

// ---------- Update-Regeln (Marktsperre) ----------
const heuteIso = (d = new Date()) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
function updateRegeln(R) {
  const standard = leseJson(path.join(pfade(R).aktuell, 'starter', 'update-standard.json'), {}) || {};
  const eigen = leseJson(datenDatei('update-einstellungen.json'), {}) || {};
  return { ...standard, ...eigen };
}
// Ergebnis: { erlaubt, grund }
function updateErlaubt(R, modus, jetzt = new Date()) {
  if (process.env.KC_UPDATE === 'aus') return { erlaubt: false, grund: 'Updates abgeschaltet (KC_UPDATE=aus).' };
  if (modus === 'zuhause') return { erlaubt: true, grund: '' };
  const r = updateRegeln(R), h = heuteIso(jetzt);
  const gesperrt = r.marktsperreVon && r.marktsperreBis && h >= r.marktsperreVon && h <= r.marktsperreBis;
  if (!gesperrt) return { erlaubt: true, grund: '' };
  const frei = leseJson(datenDatei('update-freigabe.json'), null);
  if (frei && frei.bis && h <= frei.bis) return { erlaubt: true, grund: `Marktsperre – freigegeben bis ${frei.bis}` };
  return { erlaubt: false, grund: `Marktsperre bis ${r.marktsperreBis}: Updates nur nach Freigabe im PC-Manager.` };
}

// ---------- Ablauf: prüfen und ggf. aktualisieren ----------
async function aktualisieren({ R, modus = 'stand', quelle = process.env.KC_UPDATE_QUELLE || QUELLE_STANDARD, log = () => {}, holen } = {}) {
  const P = pfade(R);
  const stand = leseJson(datenDatei('update-stand.json'), {}) || {};
  const lokal = lokaleListe(R);
  const ergebnis = { geprueft: new Date().toISOString(), lokal: lokal && lokal.version, fern: null, aktualisiert: false, verfuegbar: false, hinweis: '' };
  try {
    const fern = await fernListe(quelle);
    ergebnis.fern = fern.version;
    if (lokal && lokal.kennung === fern.kennung) { ergebnis.hinweis = 'aktuell'; }
    else if ((stand.defekteVersionen || []).includes(fern.version)) { ergebnis.hinweis = `Version ${fern.version} ist als defekt markiert und wird übersprungen.`; }
    else {
      ergebnis.verfuegbar = true;
      const erlaubt = updateErlaubt(R, modus);
      if (!erlaubt.erlaubt) { ergebnis.hinweis = erlaubt.grund; }
      else {
        const lade = holen || ((rel) => laden(`${quelle}${rel.split('/').map(encodeURIComponent).join('/')}?v=${encodeURIComponent(fern.version)}`));
        const r = await baueNeu({ R, liste: fern, holen: lade, log });
        tausche(R, log);
        ergebnis.aktualisiert = true; ergebnis.verfuegbar = false; ergebnis.geladen = r.geladen;
        ergebnis.hinweis = `aktualisiert von ${ergebnis.lokal || '–'} auf ${fern.version} (${r.geladen} Dateien)`;
        try { fs.unlinkSync(datenDatei('update-freigabe.json')); } catch (e) { /* keine Freigabe */ }
      }
    }
  } catch (e) {
    loeschen(P.neu);
    ergebnis.fehler = String(e && e.message || e);
    ergebnis.hinweis = /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|Zeitüberschreitung|ENETUNREACH|socket hang up/i.test(ergebnis.fehler)
      ? 'Kein Internet – es startet die vorhandene Version.' : `Update nicht möglich: ${ergebnis.fehler}`;
  }
  schreibeJson(datenDatei('update-stand.json'), { ...stand, ...ergebnis, programm: (lokaleListe(R) || {}).version || null });
  return ergebnis;
}

// ---------- Installation aus einem entpackten ZIP-Ordner ----------
function wandere(wurzel, rel = '', aus = []) {
  for (const f of fs.readdirSync(path.join(wurzel, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${f.name}` : f.name;
    if (f.isDirectory()) {
      if (f.name === 'node_modules' || f.name.startsWith('.')) continue;
      if (!rel && /^(programm|runtime|alt)$/i.test(f.name)) continue;   // Ordner einer Installation, nie Teil des Pakets
      wandere(wurzel, r, aus);
    } else if (f.isFile() && istPaketDatei(r) && r !== 'stand-paket.json') aus.push(r);
  }
  return aus;
}
function installiereAus({ quelle, R, log = () => {} }) {
  const P = pfade(R);
  if (!fs.existsSync(path.join(quelle, 'markt-kasse-suite', 'backend-source', 'run-manager-service.js'))) {
    throw new Error(`Im Ordner ${quelle} liegt kein vollständiges KC-Programm (markt-kasse-suite fehlt). Bitte die ZIP vollständig entpacken.`);
  }
  const quellListe = leseJson(path.join(quelle, 'stand-paket.json'), null);
  const dateien = wandere(quelle);
  loeschen(P.neu); fs.mkdirSync(P.neu, { recursive: true });
  const liste = { format: 'KC_STAND_PAKET_1', version: (quellListe && quellListe.version) || `zip-${heuteIso()}`, kennung: null, erstellt: new Date().toISOString(), dateien: {} };
  for (const rel of dateien) {
    const q = path.join(quelle, rel), z = path.join(P.neu, rel);
    const buf = fs.readFileSync(q);
    if (hatFrontMatter(buf)) continue;
    fs.mkdirSync(path.dirname(z), { recursive: true });
    fs.writeFileSync(z, fuerPlatte(rel, buf));
    const n = normiert(rel, buf);
    liste.dateien[rel] = { s: sha(n), g: n.length };
  }
  // Kennung aus den TATSÄCHLICHEN Dateien - stimmt sie mit der Liste im Netz überein, ist kein Update nötig.
  liste.kennung = kennungVon(liste.dateien);
  if (quellListe && quellListe.kennung && quellListe.kennung !== liste.kennung) liste.version = `${quellListe.version}+zip`;
  schreibeJson(path.join(P.neu, 'stand-paket.json'), liste);
  tausche(R, log);
  log(`Installiert: ${Object.keys(liste.dateien).length} Dateien nach ${P.aktuell} (Version ${liste.version}).`);
  return liste;
}

// ---------- Umzug: alte Anordnung (alles direkt in C:\KC-Kasse) → neue Ordner ----------
// Daten (Manager-Datenbank samt Schlüssel, Zentral-Zugang, Fernseher-Einstellungen) wandern in den Datenordner,
// Zusatzmodule nach R\node_modules, das alte Programm nach R\alt\... (nichts wird gelöscht).
function datenUmziehen(altBackend, log = () => {}) {
  const daten = datenWurzel(), managerOrdner = path.join(daten, 'manager');
  let bewegt = 0;
  if (fs.existsSync(path.join(altBackend, MANAGER_DB)) && !fs.existsSync(path.join(managerOrdner, MANAGER_DB))) {
    fs.mkdirSync(managerOrdner, { recursive: true });
    for (const f of fs.readdirSync(altBackend)) {
      if (!f.startsWith(MANAGER_DB)) continue;
      fs.copyFileSync(path.join(altBackend, f), path.join(managerOrdner, f)); bewegt++;
    }
    log(`Umzug: Manager-Datenbank und Schlüssel (${bewegt} Dateien) → ${managerOrdner}`);
  }
  const zz = path.join(altBackend, 'zentral-zugang.json');
  if (fs.existsSync(zz) && !fs.existsSync(path.join(daten, 'zentral-zugang.json'))) { fs.mkdirSync(daten, { recursive: true }); fs.copyFileSync(zz, path.join(daten, 'zentral-zugang.json')); log('Umzug: zentral-zugang.json → Datenordner'); }
  const se = path.join(altBackend, 'stand-einstellungen.json');
  if (fs.existsSync(se) && !fs.existsSync(path.join(daten, 'stand-einstellungen.json'))) { fs.mkdirSync(daten, { recursive: true }); fs.copyFileSync(se, path.join(daten, 'stand-einstellungen.json')); log('Umzug: stand-einstellungen.json (z. B. Fernseher-Rand) → Datenordner'); }
  return bewegt;
}
const RESERVIERT = /^(runtime|node_modules|starter|programm|alt|package\.json|package-lock\.json|KC_[^\\/]+\.(cmd|ps1)|START_HIER\.(txt|cmd)|[^\\/]+\.pdf|\.kc_setup_ok|router-pruefung\.txt)$/i;
function alteAnordnungAufraeumen(R, log = () => {}) {
  const altBackend = path.join(R, 'markt-kasse-suite', 'backend-source');
  if (!fs.existsSync(path.join(altBackend, 'run-manager-service.js'))) return false;
  datenUmziehen(altBackend, log);
  const P = pfade(R);
  if (!fs.existsSync(path.join(P.module, 'ws')) && fs.existsSync(path.join(altBackend, 'node_modules', 'ws'))) {
    fs.cpSync(path.join(altBackend, 'node_modules'), P.module, { recursive: true }); log('Umzug: Zusatzmodule → R\\node_modules (kein neuer Download nötig)');
  }
  const ziel = path.join(R, 'alt', `flach-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`);
  fs.mkdirSync(ziel, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(R)) {
    if (RESERVIERT.test(f)) continue;
    try { umbenennen(path.join(R, f), path.join(ziel, f)); n++; } catch (e) { log(`Hinweis: ${f} bleibt liegen (${e.code || e.message}).`); }
  }
  log(`Aufgeräumt: ${n} alte Einträge nach ${ziel} verschoben (nichts gelöscht).`);
  return true;
}

// ---------- Windows: Verknüpfungen, alte Autostart-Kopien ----------
function powershell(skript) {
  return spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', skript], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
}
function verknuepfungenEinrichten(R, modus, log = () => {}) {
  if (process.platform !== 'win32') return { uebersprungen: true };
  const startdatei = path.join(R, modus === 'zuhause' ? 'KC_Zuhause_Start.cmd' : 'KC_Manager_Start.cmd');
  const name = modus === 'zuhause' ? 'KC Manager zu Hause' : 'KC Kasse starten';
  const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const autostart = modus === 'stand';
  const skript = [
    '$ErrorActionPreference="Stop"', '$sh=New-Object -ComObject WScript.Shell',
    '$desk=[Environment]::GetFolderPath("Desktop")', '$start=[Environment]::GetFolderPath("Startup")',
    `function L($ordner){ $l=$sh.CreateShortcut((Join-Path $ordner ${q(name + '.lnk')})); $l.TargetPath=${q(startdatei)}; $l.WorkingDirectory=${q(R)}; $l.Save() }`,
    'L $desk',
    // Autostart: alte Kopien (KC*.cmd/.bat) und alte KC-Verknüpfungen entfernen, eine richtige anlegen
    autostart ? 'Get-ChildItem -LiteralPath $start -Force | Where-Object { $_.Name -like "KC*" -or $_.Name -like "*Manager_Start*" } | Remove-Item -Force' : '',
    autostart ? 'L $start' : '',
    'Write-Output "OK"',
  ].filter(Boolean).join('; ');
  const r = powershell(skript);
  const ok = r.status === 0 && /OK/.test(r.stdout || '');
  log(ok ? `Verknüpfung „${name}“ auf dem Desktop${autostart ? ' und im Autostart' : ''} eingerichtet.` : `Hinweis: Verknüpfungen konnten nicht angelegt werden (${(r.stderr || r.error || '').toString().trim().slice(0, 200)}).`);
  return { ok };
}

// ---------- Programm starten, auf "bereit" achten ----------
function programmUmgebung(R, modus) {
  const P = pfade(R), daten = datenWurzel(), liste = lokaleListe(R) || {};
  const env = { ...process.env, KC_INSTALL_DIR: R, KC_PROGRAMM_VERSION: liste.version || 'unbekannt', KC_PC_MANAGER_VERSION: liste.version || 'unbekannt',
    KC_SYNC_MANAGER_DB_PATH: process.env.KC_SYNC_MANAGER_DB_PATH || path.join(daten, 'manager', MANAGER_DB),
    KC_ZENTRAL_ZUGANG: process.env.KC_ZENTRAL_ZUGANG || path.join(daten, 'zentral-zugang.json'),
    KC_UPDATE_STAND: datenDatei('update-stand.json') };
  // Fernseher-Einstellungen (z. B. Rand) gehören in den Datenordner - beim ersten Mal die Vorgabe kopieren.
  const eigeneEinst = path.join(daten, 'stand-einstellungen.json');
  const vorgabe = path.join(P.aktuell, 'markt-kasse-suite', 'backend-source', 'stand-einstellungen.json');
  try { if (!fs.existsSync(eigeneEinst) && fs.existsSync(vorgabe)) { fs.mkdirSync(daten, { recursive: true }); fs.copyFileSync(vorgabe, eigeneEinst); } } catch (e) { /* dann Vorgabe */ }
  if (fs.existsSync(eigeneEinst)) env.KC_STAND_EINSTELLUNGEN = eigeneEinst;
  fs.mkdirSync(path.dirname(env.KC_SYNC_MANAGER_DB_PATH), { recursive: true });
  if (modus === 'zuhause') env.KC_MODUS = 'zuhause';
  return env;
}
const BEREIT = /\[(Marktag-Start|Zuhause-Start)\] (ALLES BEREIT|BEREIT)/;
function programmStarten({ R, modus, args = [], node = process.execPath, bereitZeitMs = 240000, ausgabe = process.stdout, fehlerAusgabe = process.stderr }) {
  const P = pfade(R);
  const skript = path.join(P.aktuell, 'markt-kasse-suite', 'backend-source', 'run-manager-service.js');
  const argv = [skript, '--open-manager', ...(modus === 'zuhause' ? ['--zuhause'] : []), ...args];
  const kind = spawn(node, argv, { cwd: path.dirname(skript), env: programmUmgebung(R, modus), stdio: ['inherit', 'pipe', 'pipe'], windowsHide: false });
  let bereit = false, rest = '';
  const versprechen = new Promise((ok) => {
    const t = setTimeout(() => { if (!bereit) ok({ bereit: false, zeitueberschreitung: true, kind }); }, bereitZeitMs); if (t.unref) t.unref();
    kind.stdout.on('data', (d) => {
      ausgabe.write(d);
      if (!bereit) { rest = (rest + d.toString()).slice(-4000); if (BEREIT.test(rest)) { bereit = true; clearTimeout(t); ok({ bereit: true, kind }); } }
    });
    kind.stderr.on('data', (d) => fehlerAusgabe.write(d));
    kind.on('exit', (code, signal) => { clearTimeout(t); if (!bereit) ok({ bereit: false, code, signal, kind }); });
    kind.on('error', (e) => { clearTimeout(t); ok({ bereit: false, fehler: e.message, kind }); });
  });
  const ende = new Promise((ok) => kind.on('exit', (code, signal) => ok({ code, signal })));
  return { kind, bereit: versprechen, ende };
}

module.exports = { umbenennen, QUELLE_STANDARD, datenWurzel, pfade, datenDatei, leseJson, schreibeJson, laden, fernListe, lokaleListe, pruefeListe,
  baueNeu, tausche, zurueckfallen, updateErlaubt, updateRegeln, aktualisieren, installiereAus, alteAnordnungAufraeumen, datenUmziehen,
  verknuepfungenEinrichten, programmStarten, programmUmgebung, normiert, fuerPlatte, heuteIso, starterUndStartdateienErneuern };
