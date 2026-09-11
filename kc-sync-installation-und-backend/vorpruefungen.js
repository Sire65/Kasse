// KC Sync – Vorprüfungen für den Markttag-Start.
//
// WARUM DIESE DATEI EXISTIERT
// Am Marktmorgen, im Dunkeln, mit kalten Fingern, ist die schlechteste Zeit, um einen Fehler
// zu suchen, der still passiert ist. Alle Prüfungen hier haben genau einen Zweck: aus einem
// stillen Fehler eine Meldung machen, die in EINEM Satz sagt, was zu tun ist.
//
// ZWEI KLASSEN, und der Unterschied ist wichtig:
//   ABBRUCH  - der Start verweigert sich. Nur, wenn es sonst SPÄTER still schiefgeht und der
//              Zusammenhang dann nicht mehr erkennbar wäre.
//   HINWEIS  - der Start läuft weiter, sagt es aber deutlich.
//
// GRUNDREGEL: unbekannt ist KEIN Alarm. Kann eine Prüfung ihre Antwort nicht sicher
// ermitteln (kein PowerShell, Richtlinie verbietet es, fremdes System), schweigt sie.
// Ein Fehlalarm am Marktmorgen ist schlimmer als gar keine Prüfung - man steht davor,
// versteht ihn nicht, und traut ab dann keiner Meldung mehr.
'use strict';
const os = require('os');
const fs = require('fs');
const path = require('path');
const dgram = require('dgram');
const { execFileSync } = require('child_process');

const WINDOWS = process.platform === 'win32';

// ---------------------------------------------------------------- Hilfsmittel

// Führt einen Windows-Befehl aus und gibt null zurück, wenn irgendetwas nicht klappt.
// Bewusst mit kurzer Zeitgrenze: eine hängende Abfrage darf den Marktstart nicht aufhalten.
function windowsAntwort(datei, argumente, sekunden = 6) {
  if (!WINDOWS) return null;
  try {
    return String(execFileSync(datei, argumente, {
      timeout: sekunden * 1000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
    })).trim();
  } catch (e) { return null; }
}
function powershell(befehl, sekunden = 8) {
  return windowsAntwort('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', befehl], sekunden);
}

// ---------------------------------------------------------------- WLAN-Adresse

// BEFUND 01.09.2026: die Adresse wurde GERATEN - genommen wurde schlicht die erste IPv4, die
// das Betriebssystem meldet. Auf einem Rechner mit VirtualBox, Hyper-V, Docker, WSL oder einem
// VPN ist das oft 192.168.56.1 oder 172.17.0.1. Dann zeigen ALLE QR-Codes auf eine Adresse,
// die kein Tablet je erreicht - und nichts sagt es. Der Stand sieht aus wie ein Firewall- oder
// WLAN-Problem und ist keines.
//
// Jetzt wird die Adresse nicht geraten, sondern das Betriebssystem selbst gefragt: über welche
// eigene Adresse würdest du hinausfunken? Dazu wird ein UDP-Socket auf eine Adresse "verbunden"
// - dabei wird KEIN Paket gesendet, es wird nur die Routing-Tabelle befragt.
function adresseUeberRouting() {
  return new Promise((fertig) => {
    let erledigt = false;
    const ende = (wert) => { if (erledigt) return; erledigt = true; try { socket.close(); } catch (e) {} fertig(wert); };
    let socket;
    try { socket = dgram.createSocket('udp4'); } catch (e) { return fertig(null); }
    socket.on('error', () => ende(null));
    setTimeout(() => ende(null), 400);
    try {
      // 192.0.2.1 ist eine Adresse aus dem für Beispiele reservierten Bereich - dorthin geht
      // garantiert kein echter Verkehr, die Frage nach dem Weg beantwortet das System trotzdem.
      socket.connect(53, '192.0.2.1', () => { try { ende(socket.address().address); } catch (e) { ende(null); } });
    } catch (e) { ende(null); }
  });
}

const VIRTUELL = /virtualbox|vmware|hyper-v|docker|wsl|vethernet|loopback|tap|tun|vpn|zerotier|tailscale|npcap/i;

function alleAdressen() {
  const liste = [];
  for (const [name, eintraege] of Object.entries(os.networkInterfaces())) {
    for (const e of eintraege || []) {
      if (e.family !== 'IPv4' || e.internal) continue;
      liste.push({ name, adresse: e.address, maske: e.netmask, verdaechtig: VIRTUELL.test(name) });
    }
  }
  return liste;
}

// Feste Vorgabe des Betreibers, falls der Rechner mehrere Netze hat und man es ein für alle
// Mal festlegen will: markttag-adresse.json mit {"lanAdresse":"192.168.178.79"}.
function festgelegteAdresse(ordner) {
  try {
    const datei = path.join(ordner, 'markttag-adresse.json');
    if (!fs.existsSync(datei)) return null;
    const wert = JSON.parse(fs.readFileSync(datei, 'utf-8')).lanAdresse;
    return (typeof wert === 'string' && /^\d+\.\d+\.\d+\.\d+$/.test(wert.trim())) ? wert.trim() : null;
  } catch (e) { return null; }
}

async function ermittleAdresse(ordner) {
  const kandidaten = alleAdressen();
  const fest = festgelegteAdresse(ordner);
  if (fest) return { adresse: fest, herkunft: 'festgelegt', kandidaten };
  const geroutet = await adresseUeberRouting();
  if (geroutet && geroutet !== '0.0.0.0' && kandidaten.some((k) => k.adresse === geroutet)) {
    return { adresse: geroutet, herkunft: 'routing', kandidaten };
  }
  // Rückfall: die erste unverdächtige Adresse, erst danach überhaupt eine verdächtige.
  const echt = kandidaten.find((k) => !k.verdaechtig);
  if (echt) return { adresse: echt.adresse, herkunft: 'erste-echte', kandidaten };
  if (kandidaten.length) return { adresse: kandidaten[0].adresse, herkunft: 'notnagel', kandidaten };
  return { adresse: null, herkunft: 'keine', kandidaten };
}

// ---------------------------------------------------------------- Einzelprüfungen

// Windows entpackt eine ZIP zum Öffnen in einen Wegwerf-Ordner unter AppData\Local\Temp.
// Wer von dort startet, bekommt einen laufenden Marktstand - aber Datenbank, Kopplungen und
// Zugangsschlüssel liegen im Papierkorb-Ordner. Beim nächsten Start ist alles weg, und der
// Zusammenhang ist dann nicht mehr erkennbar. Deshalb ABBRUCH, nicht Hinweis.
function pruefeZipStart(ordner) {
  const p = ordner.replace(/\//g, '\\');
  const ausTemp = /\\AppData\\Local\\Temp\\/i.test(p) || /\\Temp\d*_/i.test(p) || /\.zip\\/i.test(p);
  if (!ausTemp) return null;
  return {
    art: 'abbruch', titel: 'Aus dem ZIP gestartet',
    text: 'Dieser Ordner liegt im Zwischenspeicher von Windows - das passiert, wenn man die ZIP nur '
        + 'anklickt statt sie zu entpacken. Der Marktstand würde laufen, aber Datenbank, Kopplungen und '
        + 'Zugangsschlüssel lägen im Papierkorb-Ordner und wären beim nächsten Start weg.',
    tun: 'Die ZIP mit Rechtsklick -> "Alle extrahieren" in einen richtigen Ordner entpacken und von DORT starten.',
    wert: ordner,
  };
}

function pruefeSchreibrecht(ordner) {
  try {
    // BEFUND beim Selbsttest: hier wurde der Datenordner ANGELEGT, um das Schreiben zu pruefen.
    // Bei einem Abbruch stand danach die Meldung "es wurde nichts veraendert" - und im Ordner
    // lag ein neues, leeres Verzeichnis. Eine Meldung, die nicht ganz stimmt, ist genau das,
    // was man am Marktmorgen nicht gebrauchen kann. Deshalb wird jetzt dort geschrieben, wo es
    // ohnehin schon etwas gibt: im Datenordner, wenn er existiert - sonst in seinem Elternordner.
    const ziel = fs.existsSync(ordner) ? ordner : path.dirname(ordner);
    const probe = path.join(ziel, '.kc-schreibprobe');
    fs.writeFileSync(probe, 'ok'); fs.unlinkSync(probe);
    return null;
  } catch (e) {
    return {
      art: 'abbruch', titel: 'Kein Schreibrecht in diesem Ordner',
      text: 'Der Marktstand kann seine Datenbank hier nicht anlegen.',
      tun: 'Den Ordner an einen Ort kopieren, an dem geschrieben werden darf - z. B. unter Dokumente.',
      wert: String(e.message || e),
    };
  }
}

function pruefeAdresse(befund) {
  if (!befund.adresse) {
    return {
      art: 'abbruch', titel: 'Keine WLAN-Adresse gefunden',
      text: 'Dieser Rechner hat keine erreichbare Netzwerkadresse. Ohne die kann kein Tablet ihn finden.',
      tun: 'WLAN einschalten und mit demselben Netz verbinden, in dem auch die Tablets sind.',
      wert: '-',
    };
  }
  const echte = befund.kandidaten.filter((k) => !k.verdaechtig);
  if (befund.kandidaten.length > 1) {
    return {
      art: 'hinweis', titel: 'Dieser Rechner hat mehrere Netzwerkadressen',
      text: `Verwendet wird ${befund.adresse}. Zur Auswahl standen: `
          + befund.kandidaten.map((k) => `${k.adresse} (${k.name}${k.verdaechtig ? ', virtuell' : ''})`).join(', ')
          + '. Steht auf den QR-Codes eine Adresse, die das Tablet nicht erreicht, ist es diese hier.',
      tun: 'Zum Festlegen eine Datei markttag-adresse.json anlegen mit: {"lanAdresse":"'
          + (echte[0]?.adresse || befund.adresse) + '"}',
      wert: befund.adresse,
    };
  }
  return null;
}

// Liest die Zahl hinter dem Merkwort KCFW=. Alles andere - leere Ausgabe, Fehlertext,
// Buchstabensalat - bedeutet "unbekannt" und fuehrt zu KEINEM Hinweis.
function leseAnzahl(antwort) {
  if (antwort === null || antwort === undefined) return null;
  const treffer = String(antwort).match(/KCFW=(\d+)/);
  if (!treffer) return null;
  const n = Number(treffer[1]);
  return Number.isFinite(n) ? n : null;
}

// Die Firewall-Abfrage kann nur sagen, ob eine REGEL existiert - nicht, ob das Tablet
// wirklich durchkommt. Deshalb Hinweis, nie Abbruch, und im Zweifel Schweigen.
//
// BEFUND 01.09.2026, beim ersten echten Lauf beim Verein: die Prüfung schlug an, OBWOHL die
// Freigabe da war und das Tablet nachweislich verbunden - also genau der Fehlalarm, den diese
// Datei ausdrücklich vermeiden soll. Zwei Ursachen, beide meine:
//   1. `Number('')` ist in JavaScript **0**, nicht NaN. Lieferte PowerShell gar keine Ausgabe
//      (Befehl lief, druckte aber nichts), wurde daraus "null Regeln gefunden" statt
//      "konnte ich nicht ermitteln". Deshalb steht die Zahl jetzt hinter einem Merkwort:
//      fehlt das Merkwort, ist die Antwort unbrauchbar - und dann wird geschwiegen.
//   2. Der Pfadvergleich war auf das Zeichen genau. Windows speichert in der Regel aber
//      durchaus eine andere Schreibweise (Kurzpfad, anderes Laufwerk, zweite Node-Installation).
//      Verglichen wird jetzt nur noch auf "...\node.exe". Lieber einmal zu viel erkannt als
//      ein Fehlalarm: die Prüfung soll erinnern, nicht rechthaben.
// BEFUND 01.09.2026, ZWEITER Lauf beim Verein: der Hinweis kam ERNEUT, obwohl die Freigabe von
// Hand angelegt war und das Tablet nachweislich ueber das WLAN kassiert hat. Die Abfrage lieferte
// also eine ECHTE Null - sie findet die vorhandene Regel nicht, aus einem Grund, den ich von hier
// aus nicht nachstellen kann (kein Windows).
//
// ENTSCHEIDUNG: eine Pruefung, die zweimal in Folge falsch Alarm schlaegt, ist schlechter als gar
// keine - sie schickt am Marktmorgen jemanden auf eine Suche, die es nicht braucht, und macht auf
// Dauer ALLE Meldungen unglaubwuerdig. Sie schweigt deshalb jetzt standardmaessig. Wer sie haben
// will, legt neben diese Datei eine markttag-pruefungen.json an mit: {"firewallPruefung": true}
// Die eigentliche Hilfe bleibt unveraendert da: Firewall-Freigabe-einrichten.cmd.
function firewallPruefungGewuenscht(ordner) {
  try {
    const roh = fs.readFileSync(path.join(ordner, 'markttag-pruefungen.json'), 'utf-8');
    return JSON.parse(roh).firewallPruefung === true;
  } catch (e) { return false; }
}

function pruefeFirewall(ordner) {
  if (!WINDOWS) return null;
  if (!firewallPruefungGewuenscht(ordner)) return null;
  const nodePfad = process.execPath;
  const antwort = powershell(
    '$n=@(Get-NetFirewallApplicationFilter -All -ErrorAction SilentlyContinue | '
    + "Where-Object { $_.Program -like '*\\node.exe' } | Get-NetFirewallRule -ErrorAction SilentlyContinue | "
    + "Where-Object { $_.Direction -eq 'Inbound' -and $_.Action -eq 'Allow' -and $_.Enabled -eq 'True' }).Count; "
    + "Write-Output ('KCFW=' + $n)");
  const anzahl = leseAnzahl(antwort);
  if (anzahl === null || anzahl > 0) return null;   // unbekannt oder vorhanden -> schweigen
  return {
    art: 'hinweis', titel: 'Keine Firewall-Freigabe für Node.js gefunden',
    text: 'Ohne Freigabe blockiert Windows die Tablets stillschweigend - der Rechner selbst kann die '
        + 'Kasse dann öffnen, ein Tablet nicht. Eine Rückfrage erscheint nicht, wenn die Benachrichtigungen '
        + 'der Firewall abgeschaltet sind.',
    tun: 'Die Datei "Firewall-Freigabe-einrichten.cmd" mit Rechtsklick -> "Als Administrator ausführen" starten. '
        + 'Sie legt genau eine Regel an und sagt vorher, welche.',
    wert: nodePfad,
  };
}

function pruefeNetzwerkprofil() {
  if (!WINDOWS) return null;
  const antwort = powershell('(Get-NetConnectionProfile -ErrorAction SilentlyContinue | '
    + 'Select-Object -ExpandProperty NetworkCategory) -join ","');
  if (antwort === null || !antwort) return null;
  if (!/public/i.test(antwort)) return null;
  return {
    art: 'hinweis', titel: 'Ein Netzwerk steht auf "Öffentlich"',
    text: 'Im öffentlichen Profil blockiert Windows JEDE eingehende Verbindung - unabhängig davon, was in '
        + 'der Firewall freigegeben ist.',
    tun: 'Einstellungen -> Netzwerk und Internet -> auf den Netzwerknamen klicken -> "Privates Netzwerk".',
    wert: antwort,
  };
}

function pruefeEnergiesparen() {
  if (!WINDOWS) return null;
  const antwort = windowsAntwort('powercfg.exe', ['/query', 'SCHEME_CURRENT', 'SUB_SLEEP', 'STANDBYIDLE'], 6);
  if (antwort === null) return null;
  const treffer = antwort.match(/Wechselstrom[^\n]*:\s*(0x[0-9a-f]+)/i) || antwort.match(/AC Power Setting Index:\s*(0x[0-9a-f]+)/i);
  if (!treffer) return null;
  const sekunden = parseInt(treffer[1], 16);
  if (!Number.isFinite(sekunden) || sekunden === 0) return null;   // 0 = nie schlafen, alles gut
  return {
    art: 'hinweis', titel: `Der Rechner schläft nach ${Math.round(sekunden / 60)} Minuten ein`,
    text: 'Im Schlaf sind Manager, Kassenverbindung und Webserver weg. Die Tablets verlieren die Verbindung '
        + 'mitten im Betrieb, und niemand sieht warum.',
    tun: 'Energieeinstellungen -> "Energiesparmodus nach" auf "Nie" stellen, solange der Markt läuft.',
    wert: `${sekunden} s`,
  };
}

// Ohne Internet lässt sich die Uhr nicht gegen eine echte Zeit prüfen. Was ohne Internet geht:
// mit den Dateien im eigenen Ordner vergleichen. Ist die Systemzeit ÄLTER als die neueste
// Datei, geht die Uhr nachweislich falsch - und Bons tragen Zeitstempel.
function pruefeSystemuhr(ordner) {
  try {
    let neueste = 0;
    for (const name of fs.readdirSync(ordner)) {
      try { neueste = Math.max(neueste, fs.statSync(path.join(ordner, name)).mtimeMs); } catch (e) {}
    }
    if (!neueste) return null;
    const abweichung = neueste - Date.now();
    if (abweichung < 60 * 60 * 1000) return null;   // bis zu einer Stunde: Zeitzone/Rundung, kein Alarm
    return {
      art: 'hinweis', titel: 'Die Uhr dieses Rechners geht nach',
      text: `Dateien in diesem Ordner sind neuer als die Systemzeit (um ${Math.round(abweichung / 3600000)} Stunden). `
          + 'Bons, Tagesabschlüsse und die Zeiterfassung tragen diese Uhrzeit.',
      tun: 'Datum und Uhrzeit von Windows richtigstellen, bevor der erste Bon gebucht wird.',
      wert: new Date().toLocaleString('de-DE'),
    };
  } catch (e) { return null; }
}

function pruefeSpeicherort(ordner) {
  const p = ordner.replace(/\//g, '\\');
  if (/^\\\\/.test(p)) {
    return {
      art: 'hinweis', titel: 'Der Ordner liegt auf einer Netzwerkfreigabe',
      text: 'Die Datenbank des Marktstands über das Netz zu schreiben ist langsam und bricht ab, sobald die '
          + 'Verbindung wackelt.',
      tun: 'Den Ordner auf die eingebaute Festplatte kopieren und von dort starten.',
      wert: ordner,
    };
  }
  if (/onedrive|dropbox|google ?drive|nextcloud/i.test(p)) {
    return {
      art: 'hinweis', titel: 'Der Ordner liegt in einem Cloud-Ordner',
      text: 'Die Cloud synchronisiert die Datenbank mitten im Betrieb - das kann sie beschädigen.',
      tun: 'Den Ordner an einen Ort außerhalb der Cloud kopieren und von dort starten.',
      wert: ordner,
    };
  }
  if (WINDOWS && /^[A-Z]:/i.test(p)) {
    const buchstabe = p[0].toUpperCase();
    const wurzel = powershell(`(Get-PSDrive -Name ${buchstabe} -ErrorAction SilentlyContinue).DisplayRoot`);
    if (wurzel) {
      return {
        art: 'hinweis', titel: `Laufwerk ${buchstabe}: ist ein Netzlaufwerk`,
        text: `${buchstabe}: zeigt auf ${wurzel}. Die Datenbank läuft dann über das Netz - langsam, und sie bricht ab, `
            + 'sobald die Verbindung wackelt.',
        tun: 'Den Ordner auf die eingebaute Festplatte kopieren und von dort starten.',
        wert: wurzel,
      };
    }
  }
  return null;
}

function pruefeSpeicherplatz(ordner) {
  try {
    if (typeof fs.statfsSync !== 'function') return null;
    const s = fs.statfsSync(ordner);
    const freiMb = Math.round((s.bavail * s.bsize) / (1024 * 1024));
    if (freiMb > 500) return null;
    return {
      art: 'hinweis', titel: `Nur noch ${freiMb} MB frei`,
      text: 'Läuft der Platz während des Marktes voll, lassen sich Bons nicht mehr speichern.',
      tun: 'Platz schaffen, bevor der Markt beginnt.',
      wert: `${freiMb} MB`,
    };
  } catch (e) { return null; }
}

// Welcher Stand läuft hier eigentlich? Genau der Fehler vom 01.09.2026: gestartet wurde
// versehentlich eine ältere ZIP, und der fehlende Inhalt sah aus wie ein Verbindungsproblem.
function leseStand(wurzelOrdner) {
  for (const kandidat of [path.join(wurzelOrdner, 'STAND.txt'), path.join(wurzelOrdner, '..', 'STAND.txt')]) {
    try {
      const zeilen = fs.readFileSync(kandidat, 'utf-8').split(/\r?\n/).filter((z) => z.trim());
      if (zeilen.length) return zeilen.slice(0, 2).join(' · ');
    } catch (e) {}
  }
  return null;
}

// ---------------------------------------------------------------- Zusammenlauf

async function fuehreAus({ ordner, datenOrdner, wurzelOrdner }) {
  const adresse = await ermittleAdresse(ordner);
  const befunde = [
    pruefeZipStart(ordner),
    pruefeSchreibrecht(datenOrdner),
    pruefeAdresse(adresse),
    pruefeFirewall(ordner),
    pruefeNetzwerkprofil(),
    pruefeEnergiesparen(),
    pruefeSystemuhr(ordner),
    pruefeSpeicherort(ordner),
    pruefeSpeicherplatz(ordner),
  ].filter(Boolean);
  return {
    adresse,
    stand: leseStand(wurzelOrdner || ordner),
    abbrueche: befunde.filter((b) => b.art === 'abbruch'),
    hinweise: befunde.filter((b) => b.art === 'hinweis'),
  };
}

function zeige(ergebnis) {
  const linie = '─'.repeat(74);
  console.log('');
  console.log(linie);
  if (ergebnis.stand) console.log(`  STAND: ${ergebnis.stand}`);
  console.log(`  WLAN-Adresse dieses Rechners: ${ergebnis.adresse.adresse || 'keine'}`
    + (ergebnis.adresse.herkunft === 'festgelegt' ? '  (in markttag-adresse.json festgelegt)' : ''));
  console.log(linie);
  for (const b of ergebnis.abbrueche) {
    console.log('');
    console.log(`  ✖ ABBRUCH: ${b.titel}`);
    console.log(`    ${b.text}`);
    console.log(`    -> ${b.tun}`);
  }
  for (const b of ergebnis.hinweise) {
    console.log('');
    console.log(`  ! ${b.titel}`);
    console.log(`    ${b.text}`);
    console.log(`    -> ${b.tun}`);
  }
  if (!ergebnis.abbrueche.length && !ergebnis.hinweise.length) {
    console.log('  ✓ Alle Vorprüfungen ohne Beanstandung.');
  }
  console.log(linie);
  // Keine Warnung, nur die Anlaufstelle fuer den einen Fall, in dem sie gebraucht wird - und
  // zwar an einem echten Symptom festgemacht, nicht an einer Vermutung ueber die Firewall.
  console.log('  Falls ein Tablet die Kasse NICHT laden kann (der PC selbst aber schon):');
  console.log('  "Firewall-Freigabe-einrichten.cmd" per Rechtsklick als Administrator starten.');
  console.log('');
}

module.exports = { fuehreAus, zeige, ermittleAdresse, alleAdressen, leseAnzahl };
