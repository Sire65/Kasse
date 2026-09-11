#!/usr/bin/env node
// KC Sync – Marktag-Automatikstart (Version 2 - mit automatischer Kopplung).
//
// GEFUNDENE LÜCKE (User-Meldung: "Verkäufe erscheinen weder in der Datenbank noch im
// Live-Monitor"): die erste Fassung dieses Programms startete zwar Manager und alle
// Kassen-Companions, koppelte sie aber nie miteinander. Ohne Kopplung (eigener,
// vertrauensbildender Schritt mit Fingerabdruck-Bestätigung) verwirft der Kassen-Companion
// JEDE Übertragung an den Manager stillschweigend - weder die eigentliche Buchung noch die
// Live-Anzeige kommen dadurch je an.
//
// Diese Fassung läuft deshalb anders als die erste: Manager und alle Kassen-Companions laufen
// jetzt im SELBEN Prozess (statt als getrennte Kindprozesse) - dadurch kann dieses Programm
// nach dem Start jeder Kasse direkt einen frischen Kopplungs-Nachweis vom Manager anfordern
// und die Kasse damit automatisch koppeln lassen, ganz ohne manuellen Zwischenschritt. Bereits
// früher gekoppelte Kassen (eigene Datenbank von einem vorherigen Markttag) werden erkannt und
// NICHT erneut gekoppelt - die Kopplung bleibt über Neustarts hinweg bestehen.
//
// Verwendung:  node markttag-start.js
// Beenden:     Strg+C in diesem Fenster (beendet alles sauber zusammen)

'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { ManagerCompanion } = require('./manager-companion');
const { DeviceCompanion } = require('./device-companion');
const vorpruefungen = require('./vorpruefungen');

const HIER = __dirname;
const KONFIG_DATEI = path.join(HIER, 'markttag-kassen.json');
const DATEN_ORDNER = path.join(HIER, 'markttag-daten');
const MANAGER_PORT_WUNSCH = 8543;
const WEBSERVER_PORT_WUNSCH = 8090;
const ERSTER_KASSEN_PORT_WUNSCH = 47500;

// Kurzcode fuer die manuelle Kopplung (11.09.2026, Betreiber: sehr alte Tablets - z.B. Samsung
// SM-T535, Android 5.0.2 - koennen per Kamera keinen QR-Code lesen und kaemen ohne das gar nicht
// erst in die Kasse. Die echte Kopplungs-URL enthaelt ein langes Zugangs-Token und laesst sich
// nicht von Hand abtippen. Deshalb bekommt jede Kasse zusaetzlich einen kurzen Ersatzcode, den
// der Webserver (serve-frontend.js) auf die echte URL umleitet - siehe dort "/k/<CODE>".
// Alphabet bewusst ohne 0/O/1/I/L - genau die Zeichen, die beim Abtippen/Fotografieren am
// leichtesten verwechselt werden. Vorgabe des Betreibers: kurz, gut lesbar, nicht kompliziert.
const KURZCODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function erzeugeKurzcode(laenge, vorhandene) {
  const crypto = require('crypto');
  for (let versuch = 0; versuch < 50; versuch++) {
    let code = '';
    for (let i = 0; i < laenge; i++) code += KURZCODE_ALPHABET[crypto.randomInt(KURZCODE_ALPHABET.length)];
    if (!vorhandene || !vorhandene.has(code)) return code;
  }
  return String(Date.now()).slice(-6);   // extrem unwahrscheinlicher Rueckfall
}

// Prüft, ob ein Port gerade frei ist (echter Bindungsversuch, nicht nur eine Vermutung).
function portIstFrei(port) {
  return new Promise((resolve) => {
    const test = require('net').createServer();
    test.once('error', () => resolve(false));
    test.once('listening', () => { test.close(() => resolve(true)); });
    test.listen(port, '0.0.0.0');
  });
}

// Sucht ab dem Wunschport aufwärts den ersten tatsächlich freien Port (bis zu 50 Versuche) -
// löst das wiederkehrende "Port bereits belegt"-Problem auf manchen Rechnern dauerhaft, ohne
// dass jemand von Hand einen neuen Port suchen und in den Dateien eintragen muss.
async function findeFreienPort(wunschPort, label) {
  for (let versuch = 0; versuch < 50; versuch++) {
    const kandidat = wunschPort + versuch;
    if (await portIstFrei(kandidat)) {
      if (versuch > 0) console.log(`[Marktag-Start] ${label}: Port ${wunschPort} war belegt, verwende stattdessen ${kandidat}.`);
      return kandidat;
    }
  }
  throw new Error(`${label}: kein freier Port zwischen ${wunschPort} und ${wunschPort + 49} gefunden.`);
}

// Doppelstart-Schutz.
//
// BEFUND aus dem Betrieb: laeuft bereits ein Markttag-Fenster und jemand startet ein zweites,
// weicht die Portsuche oben stillschweigend auf andere Ports aus. Dann laufen ZWEI Manager
// nebeneinander: die Kassen melden an den einen, der PC-Manager im Browser fragt den anderen -
// Ergebnis "Noch nie verbunden" bei laufendem Betrieb. Der Fehler ist von aussen nicht
// erkennbar und hat einen ganzen Abend gekostet.
//
// Deshalb wird vor dem Start geprueft, ob die Standard-Ports schon belegt sind. Wenn ja, ist
// mit hoher Wahrscheinlichkeit bereits ein Fenster offen - dann wird abgebrochen statt
// danebengestartet.
// Gegenstueck zu portIstFrei: hier wird geprueft, ob dort tatsaechlich JEMAND ANTWORTET.
// "Port belegt" und "Dienst erreichbar" sind zwei verschiedene Fragen - die zweite ist die,
// auf die es bei einer Erfolgsmeldung ankommt.
function portAntwortet(port, host = '127.0.0.1') {
  return new Promise((fertig) => {
    const netz = require('net');
    const verbindung = netz.connect({ port, host });
    let erledigt = false;
    const ende = (wert) => { if (erledigt) return; erledigt = true; try { verbindung.destroy(); } catch (e) {} fertig(wert); };
    verbindung.on('connect', () => ende(true));
    verbindung.on('error', () => ende(false));
    setTimeout(() => ende(false), 1500);
  });
}

async function pruefeObSchonLaeuft(managerPort, webserverPort) {
  const belegt = [];
  if (!(await portIstFrei(webserverPort))) belegt.push(`Webserver (${webserverPort})`);
  if (!(await portIstFrei(47392))) belegt.push('Manager-Live-Kanal (47392)');
  if (!belegt.length) return;
  console.log('');
  console.log('[Marktag-Start] ABBRUCH: Es läuft offenbar bereits ein Markttag-Fenster.');
  console.log(`[Marktag-Start] Belegt: ${belegt.join(', ')}`);
  console.log('');
  console.log('  Ein zweiter Start würde einen ZWEITEN Manager erzeugen. Die Kassen melden dann');
  console.log('  an den einen, der PC-Manager zeigt den anderen an - und es sieht so aus, als');
  console.log('  wäre keine Kasse verbunden, obwohl alles läuft.');
  console.log('');
  console.log('  So geht es weiter:');
  console.log('   1. Das bereits offene schwarze Fenster suchen und weiterverwenden.');
  console.log('   2. Wenn keines mehr offen ist: im Task-Manager (Strg+Umschalt+Esc) unter');
  console.log('      "Details" alle Einträge "node.exe" beenden und dann neu starten.');
  console.log('');
  process.exit(1);
}

function ladeKassenListe() {
  if (fs.existsSync(KONFIG_DATEI)) {
    try {
      const liste = JSON.parse(fs.readFileSync(KONFIG_DATEI, 'utf-8'));
      if (Array.isArray(liste) && liste.length) return liste;
    } catch (e) {
      console.error(`[Marktag-Start] ${KONFIG_DATEI} ist beschädigt, verwende Standardliste (KASSE-01, KASSE-02).`);
    }
  }
  return ['KASSE-01', 'KASSE-02'];
}

// BEFUND 01.09.2026: hier wurde die Adresse GERATEN - genommen wurde die erste IPv4, die das
// Betriebssystem meldet. Auf einem Rechner mit VirtualBox, Hyper-V, Docker oder VPN ist das oft
// 192.168.56.1: dann zeigen ALLE QR-Codes auf eine Adresse, die kein Tablet erreicht, und
// nichts sagt es. Die Auswahl steckt jetzt in vorpruefungen.js und fragt die Routing-Tabelle
// des Systems, statt zu raten; das Ergebnis wird im Fenster genannt.

let VORPRUEFUNG = null;   // wird in main() gefuellt und spaeter fuer die Uebersichtsseite gebraucht

async function main() {
  // Vor allem anderen: laeuft schon ein Fenster? Zwei Manager nebeneinander sind der
  // gefaehrlichste Zustand, weil alles zu laufen scheint und trotzdem nichts zusammenpasst.
  await pruefeObSchonLaeuft(MANAGER_PORT_WUNSCH, WEBSERVER_PORT_WUNSCH);

  // Vorpruefungen. Ein ABBRUCH bedeutet: es wuerde sonst SPAETER still schiefgehen und der
  // Zusammenhang waere dann nicht mehr erkennbar. Hinweise halten den Start nicht auf.
  VORPRUEFUNG = await vorpruefungen.fuehreAus({ ordner: HIER, datenOrdner: DATEN_ORDNER, wurzelOrdner: path.resolve(HIER, '..') });
  vorpruefungen.zeige(VORPRUEFUNG);
  if (VORPRUEFUNG.abbrueche.length) {
    console.log('[Marktag-Start] ABBRUCH - siehe oben. Es wurde nichts gestartet und nichts veraendert.');
    process.exit(1);
  }
  const kassenListe = ladeKassenListe();
  fs.mkdirSync(DATEN_ORDNER, { recursive: true });
  console.log(`[Marktag-Start] ${kassenListe.length} Kasse(n) konfiguriert: ${kassenListe.join(', ')}`);
  console.log(`[Marktag-Start] (Anpassbar in ${path.basename(KONFIG_DATEI)} - einfach Kassen-IDs als Liste eintragen.)`);

  // 1. Manager-Companion (im selben Prozess, direkter Objektzugriff für die Kopplung)
  const managerDb = path.join(DATEN_ORDNER, 'manager.sqlite');
  const mgr = new ManagerCompanion({ dbPath: managerDb });
  const MANAGER_PORT = await findeFreienPort(MANAGER_PORT_WUNSCH, 'Manager');
  await mgr.start(MANAGER_PORT);
  console.log(`[Marktag-Start] Manager läuft (https://127.0.0.1:${MANAGER_PORT}).`);

  // 2. Für jede Kasse: eigener Companion + automatische Kopplung, falls noch nicht gekoppelt
  const kassenInfo = [];
  let naechsterKassenPort = ERSTER_KASSEN_PORT_WUNSCH;
  for (let i = 0; i < kassenListe.length; i++) {
    const id = kassenListe[i];
    const port = await findeFreienPort(naechsterKassenPort, id);
    naechsterKassenPort = port + 1; // die nächste Kasse sucht ab hier weiter, keine Dopplungen
    const db = path.join(DATEN_ORDNER, `kasse-${id.replace(/[^A-Za-z0-9_-]+/g, '_')}.sqlite`);
    const dev = new DeviceCompanion({ dbPath: db });
    await dev.startLocalStatusServer(port, { bindAddress: '0.0.0.0' });

    if (!dev.pinned.credentialId) {
      const token = mgr.issuePairingToken();
      await dev.pair({ pairingToken: token, expectedFingerprint: mgr.identity.fingerprint, host: '127.0.0.1', port: MANAGER_PORT, registerLabel: id });
      console.log(`[Marktag-Start] ${id}: neu gekoppelt.`);
    } else {
      console.log(`[Marktag-Start] ${id}: bereits gekoppelt (von einem früheren Markttag).`);
    }

    kassenInfo.push({ id, port, dev });
    // Derselbe periodische Sync, den der eigenständige run-device-companion.js auch hat -
    // fehlte bisher hier, da diese Kassen im selben Prozess laufen (für die automatische
    // Kopplung), nicht über das einzelne Startskript.
    dev._syncTimer = setInterval(async () => { try { await dev.sync(); } catch (e) { /* nächster Versuch beim nächsten Zyklus */ } }, 15000);
  }
  console.log('[Marktag-Start] Alle Kassen-Companions laufen und sind gekoppelt.');

  // 3. Webserver für die eigentlichen Seiten (pos/, pc-manager/ usw.) - eigener Kindprozess,
  // da rein statisch und unabhängig vom Rest.
  const wurzelOrdner = path.join(HIER, '..', 'kassenoberflaeche-und-pc-manager');
  const WEBSERVER_PORT = await findeFreienPort(WEBSERVER_PORT_WUNSCH, 'Webserver');

  // Kurzcodes fuer die manuelle Kopplung VOR dem Webserver-Start erzeugen und in eine Datei
  // schreiben, die serve-frontend.js (eigener Kindprozess, kein gemeinsamer Speicher) beim
  // eigenen Start einliest.
  const kurzcodeVergabe = new Map();
  for (const k of kassenInfo) kurzcodeVergabe.set(k.id, erzeugeKurzcode(6, new Set(kurzcodeVergabe.values())));
  const kurzcodePfadDatei = path.join(DATEN_ORDNER, 'markttag-kurzcodes.json');
  const kurzcodeZiele = {};
  for (const k of kassenInfo) {
    const code = kurzcodeVergabe.get(k.id);
    kurzcodeZiele[code] = `/pos/index.html?kcPort=${k.port}&kcToken=${encodeURIComponent(k.dev.kasseAccessToken)}&kcRegisterId=${encodeURIComponent(k.id)}`;
  }
  fs.writeFileSync(kurzcodePfadDatei, JSON.stringify(kurzcodeZiele, null, 2), 'utf-8');

  const webserverProzess = spawn(process.execPath, ['serve-frontend.js', '--port', String(WEBSERVER_PORT), '--root', wurzelOrdner, '--kurzcodes', kurzcodePfadDatei], { cwd: HIER, stdio: ['ignore', 'pipe', 'pipe'] });
  webserverProzess.stdout.on('data', (d) => process.stdout.write(`[Webserver] ${d}`));
  webserverProzess.stderr.on('data', (d) => process.stderr.write(`[Webserver] ${d}`));
  await new Promise((resolve) => setTimeout(resolve, 1500));
  console.log('[Marktag-Start] Webserver läuft.');

  // 4. Übersichtsseite mit QR-Codes erzeugen
  const lanAdresse = VORPRUEFUNG?.adresse?.adresse || '127.0.0.1';
  const kassenMitAdresse = kassenInfo.map((k) => ({
    id: k.id,
    url: `http://${lanAdresse}:${WEBSERVER_PORT}/pos/index.html?kcPort=${k.port}&kcToken=${encodeURIComponent(k.dev.kasseAccessToken)}&kcRegisterId=${encodeURIComponent(k.id)}`,
    kurzcode: kurzcodeVergabe.get(k.id),
  }));
  const kurzUrl = `http://${lanAdresse}:${WEBSERVER_PORT}/k`;
  const managerUrl = `https://${lanAdresse}:${MANAGER_PORT}/`;
  // BEFUND aus dem Betrieb: hier stand die WLAN-Adresse. Der PC-Manager laeuft aber IMMER auf
  // demselben Rechner wie sein Dienst, und seine Live-Anzeige spricht diesen fest ueber
  // 127.0.0.1 an. Wird die Manager-Seite ueber die WLAN-Adresse geoeffnet, blockiert der
  // Browser den Zugriff auf 127.0.0.1 - Ergebnis: Kassen-LEDs bleiben grau, Live-Monitor leer,
  // obwohl alles laeuft. Genau dieses Bild hat den Betreiber einen Abend gekostet.
  // Deshalb wird fuer den Manager immer die lokale Adresse ausgegeben.
  const pcManagerUrl = `http://127.0.0.1:${WEBSERVER_PORT}/pc-manager/index.html`;
  const uebersichtHtml = baueUebersichtsseite(kassenMitAdresse, pcManagerUrl, managerUrl, MANAGER_PORT,
    MANAGER_PORT_WUNSCH, lanAdresse, WEBSERVER_PORT, VORPRUEFUNG, kurzUrl);
  const uebersichtPfad = path.join(DATEN_ORDNER, 'markttag-uebersicht.html');
  fs.writeFileSync(uebersichtPfad, uebersichtHtml, 'utf-8');
  // BEFUND 01.09.2026: hier stand "ALLES BEREIT", ohne dass der Live-Kanal je geprueft wurde.
  // Kam er nicht hoch (der Fehler wurde im Manager verschluckt), meldete das Fenster trotzdem
  // Erfolg - und im PC-Manager blieben die Kassen-LEDs grau. Man sucht dann am falschen Ende.
  // Jetzt wird nachgesehen, ob der Kanal WIRKLICH antwortet, bevor Erfolg gemeldet wird.
  // BEFUND 02.09.2026: der Port allein ist KEIN Beweis. Antwortet er, kann das auch ein
  // Ueberbleibsel eines frueheren Starts sein - und schlaegt der eigene Live-Kanal fehl
  // (mgr.liveMonitorFehler), meldete das Fenster trotzdem Erfolg. Beides muss stimmen:
  // unser Kanal ist gestartet UND der Port antwortet.
  const liveKanalOffen = !mgr.liveMonitorFehler && (await portAntwortet(47392));
  if (!liveKanalOffen) {
    console.log('');
    console.log('[Marktag-Start] ACHTUNG: Der Live-Kanal auf Port 47392 antwortet NICHT.');
    if (mgr.liveMonitorFehler) console.log(`[Marktag-Start] Grund: ${mgr.liveMonitorFehler}`);
    console.log('[Marktag-Start] Folge: Im PC-Manager bleiben die Kassen-LEDs grau und der');
    console.log('[Marktag-Start] Live-Monitor leer. Kassieren, Bons und Abschluesse gehen trotzdem -');
    console.log('[Marktag-Start] das ist ein Anzeigekanal, kein Verkaufsweg.');
    console.log('[Marktag-Start] Meist belegt ein noch laufendes aelteres Fenster den Port.');
    console.log('[Marktag-Start] Zu tun: alle schwarzen Fenster schliessen, kurz warten, neu starten.');
  }
  console.log(liveKanalOffen
    ? `\n[Marktag-Start] ALLES BEREIT (Manager, alle Kassen gekoppelt, Webserver, Live-Kanal).`
    : `\n[Marktag-Start] BEREIT ZUM KASSIEREN - aber OHNE Live-Kanal (siehe Hinweis oben).`);
  console.log(`[Marktag-Start] Übersicht mit QR-Codes: ${uebersichtPfad}`);
  console.log(`[Marktag-Start] PC-Manager direkt: ${pcManagerUrl}\n`);

  // Kassenadressen fuer die Seite "Verbindung pruefen" im Manager bereitstellen.
  // Grund: Schluessel und Ports wechseln bei JEDEM Start. Wer eine gemerkte Adresse
  // wiederverwendet, landet bei einer Kasse, die es so nicht mehr gibt - und sucht dann den
  // Fehler an der falschen Stelle. Hier stehen immer die aktuellen.
  try {
    const ziel = path.join(wurzelOrdner, 'pc-manager', 'kassen-verbindungen.json');
    fs.writeFileSync(ziel, JSON.stringify({
      erzeugtAm: new Date().toISOString(),
      webserverPort: WEBSERVER_PORT,
      lanAdresse,
      kassen: kassenInfo.map((k) => ({id: k.id, name: k.id, port: k.port, token: k.dev.kasseAccessToken})),
      // Damit das Pruefenster im Manager nicht raten muss, WARUM Port 47392 schweigt: hier
      // steht, was das schwarze Fenster beim Start selbst festgestellt hat. Ein Browser kann
      // einen fehlgeschlagenen Verbindungsversuch nicht von einem abgewiesenen unterscheiden -
      // diese Zeile schon.
      liveKanal: {
        laeuft: liveKanalOffen,
        fehler: mgr.liveMonitorFehler || null,
        gestartetUm: new Date().toISOString(),
      },
    }, null, 2));
  } catch (e) {
    console.log('[Marktag-Start] Hinweis: Kassenadressen konnten nicht für den Manager hinterlegt werden:', e.message);
  }

  if (process.platform === 'win32') {
    // "start" behandelt das erste (unquotierte) Argument als Fenstertitel - ohne einen
    // eigenen, leeren Titel wird ein Pfad mit Leerzeichen an der ersten Lücke falsch
    // zerschnitten und nur ein Teil davon geöffnet. windowsVerbatimArguments bedeutet: Node
    // setzt KEINE eigenen Anführungszeichen mehr, deshalb hier von Hand gesetzt.
    spawn('cmd', ['/c', 'start', '""', `"${uebersichtPfad}"`], { detached: true, stdio: 'ignore', windowsVerbatimArguments: true }).unref();
  } else {
    const öffnen = process.platform === 'darwin' ? 'open' : 'xdg-open';
    spawn(öffnen, [uebersichtPfad], { shell: true, detached: true, stdio: 'ignore' }).unref();
  }

  function beenden(signal) {
    console.log(`\n[Marktag-Start] ${signal} - beende alle Programme …`);
    try { webserverProzess.kill('SIGTERM'); } catch (e) { /* bereits beendet */ }
    for (const k of kassenInfo) { try { clearInterval(k.dev._syncTimer); k.dev.stopLocalStatusServer(); } catch (e) { /* bereits beendet */ } }
    try { mgr.stop(); } catch (e) { /* bereits beendet */ }
    setTimeout(() => process.exit(0), 500);
  }
  process.on('SIGINT', () => beenden('SIGINT'));
  process.on('SIGTERM', () => beenden('SIGTERM'));
}

function baueUebersichtsseite(kassen, pcManagerUrl, managerUrl, tatsaechlicherManagerPort, gewuenschterManagerPort,
                              lanAdresse, webserverPort, pruefung, kurzUrl) {
  const portWeichtAb = tatsaechlicherManagerPort !== gewuenschterManagerPort;
  const statusUrl = `http://${lanAdresse}:${webserverPort}/__kc-status`;
  const entschaerfen = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const standZeile = pruefung && pruefung.stand
    ? `<div class="stand">Laufender Stand: ${entschaerfen(pruefung.stand)}</div>` : '';
  const hinweisBlock = (pruefung && pruefung.hinweise && pruefung.hinweise.length)
    ? `<div class="pruefung"><h3>${pruefung.hinweise.length} Hinweis(e) aus der Vorpr\u00fcfung</h3><ul>`
      + pruefung.hinweise.map((h) => `<li><b>${entschaerfen(h.titel)}</b><br>${entschaerfen(h.text)}<br>&rarr; ${entschaerfen(h.tun)}</li>`).join('')
      + '</ul></div>' : '';
  const kassenBloecke = kassen.map((k, i) => `
    <div class="kasse-block" data-kasse="${k.id}">
      <h2>${k.id}</h2>
      <canvas id="qr${i}" width="220" height="220"></canvas>
      <div class="geraet-status wartet" id="status${i}">wartet auf Tablet …</div>
      <p class="url">${k.url}</p>
      <div class="kurzcode-box">
        <small>Kamera geht nicht? Kurzcode:</small>
        <div class="kurzcode">${entschaerfen(k.kurzcode)}</div>
      </div>
    </div>`).join('');
  const skripte = kassen.map((k, i) => `drawRealQR(document.getElementById('qr${i}'), ${JSON.stringify(k.url)});`).join('\n');
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Marktag-Übersicht - KC Sync</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:1000px;margin:30px auto;padding:0 20px;color:#1c2430}
  h1{font-size:1.6rem} .hinweis{background:#e8f5e9;padding:14px 18px;border-radius:8px;margin-bottom:24px}
  .grid{display:flex;flex-wrap:wrap;gap:24px}
  .kasse-block{border:1px solid #ddd;border-radius:10px;padding:18px;text-align:center;width:260px}
  .kasse-block h2{margin-top:0}
  .url{font-family:monospace;font-size:.72rem;word-break:break-all;color:#666;margin-top:10px}
  .manager-link{margin-top:30px;padding:16px;background:#f0f7ff;border-radius:8px}
  .manager-link a{color:#1677b8;font-weight:700}
  .port-anzeige{margin-top:14px;padding:14px 18px;border-radius:8px;font-weight:700;font-size:1.05rem}
  .port-normal{background:#e8f5e9;color:#166534}
  .port-abweichung{background:#fff3cd;color:#92400e;border:2px solid #f59e0b}
  .geraet-status{margin-top:12px;padding:9px 8px;border-radius:8px;font-weight:800;font-size:.92rem;line-height:1.3}
  .geraet-status.wartet{background:#eef2f6;color:#5b6572}
  .geraet-status.da{background:#e8f5e9;color:#166534}
  .geraet-status small{display:block;font-weight:600;font-size:.78rem;margin-top:2px}
  .pruefung{margin:0 0 24px;padding:14px 18px;border-radius:8px;background:#fffbeb;border:2px solid #f59e0b;color:#7c2d12}
  .pruefung h3{margin:0 0 8px;font-size:1rem}
  .pruefung li{margin-bottom:8px;line-height:1.45}
  .stand{margin-bottom:14px;font-size:.85rem;color:#5b6572;font-family:monospace}
  .fremd{margin-top:26px;padding:12px 16px;border-radius:8px;background:#f6f8fa;color:#5b6572;font-size:.86rem;line-height:1.5}
  .kurzcode-box{margin-top:12px;padding:9px 8px;border-radius:8px;background:#fff7e6;border:2px dashed #d49200}
  .kurzcode-box small{display:block;color:#7c4a03;font-size:.74rem}
  .kurzcode{font-family:monospace;font-size:1.5rem;font-weight:800;letter-spacing:.12em;color:#1c2430}
  .kurzanleitung{margin:0 0 24px;padding:14px 18px;border-radius:8px;background:#fff7e6;border:2px solid #d49200;color:#5b3a00}
  .kurzanleitung h3{margin:0 0 8px;font-size:1rem}
  .kurzanleitung .kurz-adresse{font-family:monospace;font-size:1.15rem;font-weight:800;background:#fff;padding:4px 9px;border-radius:6px;display:inline-block}
</style></head>
<body>
  <h1>Alles bereit für den Markttag</h1>
  <div class="port-anzeige ${portWeichtAb ? 'port-abweichung' : 'port-normal'}">
    ${portWeichtAb
      ? `⚠️ Manager-Port: ${tatsaechlicherManagerPort} (Port ${gewuenschterManagerPort} war belegt, ausgewichen!) - falls du eine Portweiterleitung für den Fernzugriff eingerichtet hast, bitte auf ${tatsaechlicherManagerPort} anpassen.`
      : `✓ Manager-Port: ${tatsaechlicherManagerPort} (wie erwartet - eine Portweiterleitung auf diesen Port bleibt gültig)`}
  </div>
  ${standZeile}
  ${hinweisBlock}
  <div class="hinweis">Auf jedem Tablet den QR-Code der jeweiligen Kasse scannen (Kamera-App oder Browser-Scanner) - öffnet die Kasse direkt, fertig verbunden und gekoppelt. Kein Tippen nötig.
  <br><b>Diese Seite gehört zu diesem Rechner.</b> Die QR-Codes zeigen auf ${lanAdresse} - nur Codes von DIESER Seite scannen, kein Foto und keinen Ausdruck von woanders.</div>
  <div class="kurzanleitung">
    <h3>📋 Alte Tablets ohne Kamera-Scan - Kopplung per Kurzcode</h3>
    <p>Auf dem Tablet im Browser <span class="kurz-adresse">${kurzUrl}</span> aufrufen, den vierstelligen bis sechsstelligen Kurzcode der jeweiligen Kasse eintippen (siehe gelbes Feld unter der Kasse) und bestätigen - öffnet dieselbe Kasse wie der QR-Code. Der Kurzcode gilt auch zum Ausdrucken oder Abfotografieren.</p>
  </div>
  <div class="grid">${kassenBloecke}</div>
  <div class="kasse" style="border:2px dashed #166534">
    <h2>🧾 Tagesabschluss-Karte</h2>
    <p>Diese Karte an der Kasse einlesen (Scanner) - öffnet abends direkt den Tagesabschluss, ohne Warenkorb-Halten oder PIN. Einmal ausdrucken, dauerhaft griffbereit halten. Funktioniert an jeder Kasse.</p>
    <canvas id="qrTagesabschluss" width="220" height="220"></canvas>
  </div>
  <div class="kasse" style="border:2px dashed #b45309">
    <h2>🎓 Schulung – beliebig viele Tablets</h2>
    <p>Jedes Übungstablet scannt diesen Code. Trainingsmodus fest an, kein Umsatz, keine Bonnummern, keine Kopplung nötig.</p>
    <canvas id="qrSchulung" width="220" height="220"></canvas>
    <p><small><span id="schulungUrl"></span></small></p>
    <p><small>Verbundene Übungstablets: <span id="schulungListe">–</span></small></p>
  </div>
  <div class="manager-link">
    <p>PC-Manager auf diesem Rechner öffnen: <a href="${pcManagerUrl}" target="_blank">${pcManagerUrl}</a><br><small>Der Manager läuft nur auf diesem Rechner – bitte nicht über die WLAN-Adresse aufrufen, sonst bleiben die Kassen-Anzeigen leer.</small></p>
    <p><small>Verschlüsselte Manager-Verbindung (für Fortgeschrittene/Diagnose): ${managerUrl}</small></p>
  </div>
  <div class="fremd" id="fremdeGeraete" style="display:none"></div>
  <script src="../../kassenoberflaeche-und-pc-manager/pc-manager/vendor/qrcode-generator.js"></script>
  <script>
    function drawRealQR(canvas,text){const qr=qrcode(0,"M");qr.addData(text);qr.make();const ctx=canvas.getContext("2d"),modules=qr.getModuleCount(),quiet=4,cell=canvas.width/(modules+quiet*2);ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#000";for(let row=0;row<modules;row++)for(let col=0;col<modules;col++)if(qr.isDark(row,col))ctx.fillRect(Math.floor((col+quiet)*cell),Math.floor((row+quiet)*cell),Math.ceil(cell),Math.ceil(cell))}
    // 09.09.2026 BEHOBEN (echter Fund): STATUS_URL/KASSEN standen vorher erst weiter UNTEN im
    // Skript, wurden aber schon vom Tagesabschluss-/Schulungs-Teil darueber benutzt - das liess
    // das gesamte restliche Seiten-Skript mit einem Fehler abbrechen ("vor der Definition
    // benutzt"). Dadurch blieben die Verbindungsanzeigen neben den Kassen-QR-Codes leer/leer
    // aussehend, obwohl die QR-Codes selbst (noch davor im Skript) meist schon gezeichnet waren.
    // Jetzt stehen beide const-Zeilen ganz vorne, bevor irgendein Code sie braucht.
    const STATUS_URL = ${JSON.stringify(statusUrl)};
    const KASSEN = ${JSON.stringify(kassen.map((k) => k.id))};
    ${skripte}
    // Schulungs-QR (08.09.2026): dieselbe Kasse, aber ?schulung=1 - siehe pos/kc-schulung.js
    (function(){drawRealQR(document.getElementById('qrTagesabschluss'),'KCTAGESABSCHLUSS')})();
    (function(){const u=STATUS_URL.slice(0, STATUS_URL.indexOf('/__kc-status'))+'/pos/index.html?schulung=1';document.getElementById('schulungUrl').textContent=u;drawRealQR(document.getElementById('qrSchulung'),u);
      async function liste(){try{const r=await fetch(STATUS_URL.slice(0, STATUS_URL.indexOf('/__kc-status'))+'/schulung/liste');const j=await r.json();document.getElementById('schulungListe').textContent=(j.geraete||[]).length?j.geraete.map(g=>g.kennung+(g.name?' ('+g.name+')':'')).join(', '):'noch keins'}catch(e){}}
      liste();setInterval(liste,10000)})();

    // LEBENSZEICHEN DER TABLETS.
    // Jede Vorpruefung am PC ist nur ein Indiz. Ob ein Tablet wirklich durchkommt, weiss allein
    // das Tablet - deshalb fragt diese Seite den Webserver, wer sich gemeldet hat.
    function zeitTexte(ms){const s=Math.round(ms/1000);if(s<60)return 'vor '+s+' s';const m=Math.round(s/60);return 'vor '+m+' min';}
    async function statusHolen(){
      let daten=null;
      try{ const a=await fetch(STATUS_URL,{cache:'no-store'}); if(a.ok) daten=await a.json(); }catch(e){}
      const fremde=(daten&&daten.geraete)||[];
      KASSEN.forEach((id,i)=>{
        const feld=document.getElementById('status'+i); if(!feld)return;
        const g=fremde.find(x=>x.kasse===id);
        if(g){
          feld.className='geraet-status da';
          feld.innerHTML='✓ Tablet verbunden<small>'+g.ip+' · letzte Anfrage '+zeitTexte((daten.jetzt||Date.now())-g.letzte)+'</small>';
        }else{
          feld.className='geraet-status wartet';
          feld.textContent='wartet auf Tablet …';
        }
      });
      const ohne=fremde.filter(x=>!x.kasse||!KASSEN.includes(x.kasse));
      const box=document.getElementById('fremdeGeraete');
      if(box){
        box.style.display=ohne.length?'block':'none';
        box.innerHTML=ohne.length
          ? 'Weitere Geräte haben den Rechner erreicht, aber keine Kasse geöffnet: '
            + ohne.map(x=>x.ip).join(', ')
            + '. Das heißt: WLAN und Firewall stimmen — es wurde nur (noch) kein Kassen-QR-Code gescannt.'
          : '';
      }
    }
    statusHolen(); setInterval(statusHolen, 2000);
  </script>
</body></html>`;
}

main().catch((err) => { console.error('[Marktag-Start] Fehler beim Start:', err.message); process.exit(1); });
