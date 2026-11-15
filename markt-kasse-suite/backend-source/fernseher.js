// KC MarktKasse – Fernseher am Stand (KS-05 „Präsentation startet von selbst“)
//
// Beim Start des schwarzen Fensters wird die TV-Präsentation automatisch im Vollbild auf dem
// Fernseher geöffnet (Edge im Kiosk-Modus, ohne Maus, ohne Klick):
//   • ZWEI Bildschirme (Fernseher an HDMI + Monitor an VGA, Windows „Erweitern“):
//       Präsentation auf dem Bildschirm, der NICHT Hauptanzeige ist (= Fernseher),
//       PC-Manager und schwarzes Fenster bleiben auf dem Monitor (Hauptanzeige).
//   • EIN Bildschirm (nur Fernseher): Präsentation im Vollbild; der PC-Manager wird beim Start
//       NICHT davor geöffnet. Störungen erscheinen zusätzlich auf den Tablets.
// Wächter: stürzt der Browser ab, startet er nach 10 s neu. Wird das Fernsehbild bewusst
// geschlossen, bleibt es zu (sonst käme man nie an den Desktop) – Hinweis im Fenster.
// Einstellungen: stand-einstellungen.json → { "fernseher": { "aktiv": true, "bildschirm": "auto" } }
//   bildschirm: "auto" | Nummer (1, 2 …) laut Windows-Anzeigeeinstellungen.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { meldung } = require('./fehlerhilfe');

function leseEinstellungen(datei) {
  const standard = { aktiv: false, bildschirm: 'auto' };
  try {
    const roh = JSON.parse(fs.readFileSync(datei, 'utf8').replace(/^\uFEFF/, ''));
    return { ...standard, ...(roh && roh.fernseher || {}) };
  } catch (e) { return standard; }
}

// Bildschirme unter Windows (ohne Zusatzprogramme, ohne Adminrechte).
function bildschirmeWindows() {
  const skript = 'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::AllScreens | ForEach-Object { [pscustomobject]@{ name=$_.DeviceName; x=$_.Bounds.X; y=$_.Bounds.Y; breite=$_.Bounds.Width; hoehe=$_.Bounds.Height; haupt=$_.Primary } } | ConvertTo-Json -Compress';
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', skript], { encoding: 'utf8', timeout: 15000, windowsHide: true });
  try { const d = JSON.parse(String(r.stdout || '').trim()); return Array.isArray(d) ? d : [d]; } catch (e) { return []; }
}

function waehleBildschirm(bildschirme, einstellung) {
  if (!bildschirme.length) return null;
  const nr = Number(einstellung);
  if (Number.isInteger(nr) && nr >= 1 && nr <= bildschirme.length) return bildschirme[nr - 1];
  return bildschirme.find((b) => !b.haupt) || bildschirme[0];
}

function findeBrowser(env = process.env) {
  const kandidaten = [
    path.join(env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(env.ProgramFiles || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe') : null,
  ].filter(Boolean);
  return kandidaten.find((k) => { try { return fs.existsSync(k); } catch (e) { return false; } }) || null;
}

function browserArgumente({ url, profil, bildschirm }) {
  const a = ['--kiosk', url, '--edge-kiosk-type=fullscreen', '--no-first-run', '--no-default-browser-check',
    '--disable-features=Translate,msEdgeSidebarV2', '--autoplay-policy=no-user-gesture-required',
    '--disable-session-crashed-bubble', '--hide-crash-restore-bubble', `--user-data-dir=${profil}`];
  if (bildschirm) a.push(`--window-position=${bildschirm.x + 20},${bildschirm.y + 20}`);
  return a;
}

class Fernseher {
  constructor({ einstellungsDatei, datenOrdner, webserverPort, log = console.log, fehlerLog = console.error,
    plattform = process.platform, bildschirmeErmitteln = bildschirmeWindows, browserFinden = findeBrowser, starter = spawn } = {}) {
    this.einstellungen = leseEinstellungen(einstellungsDatei);
    this.datenOrdner = datenOrdner;
    this.webserverPort = webserverPort;
    this.log = log; this.fehlerLog = fehlerLog;
    this.plattform = plattform;
    this.bildschirmeErmitteln = bildschirmeErmitteln;
    this.browserFinden = browserFinden;
    this.starter = starter;
    this.zustand = { aktiv: !!this.einstellungen.aktiv, laeuft: false, bildschirme: 0, ziel: null, meldung: null, neustarts: 0 };
    this._stopp = false;
  }

  get url() { return `http://127.0.0.1:${this.webserverPort}/tv-player/fernseher.html`; }

  // Ergebnis: { gestartet, einBildschirm, meldung }
  start() {
    if (!this.einstellungen.aktiv) return { gestartet: false, einBildschirm: false, meldung: null };
    if (this.plattform !== 'win32') {
      this.log(`[Fernseher] Automatischer Start nur unter Windows. Präsentation von Hand: ${this.url}`);
      return { gestartet: false, einBildschirm: false, meldung: null };
    }
    const browser = this.browserFinden();
    if (!browser) {
      const m = meldung('fernseher-browser', 'Fernseher: Präsentation startet nicht – Microsoft Edge wurde nicht gefunden',
        'Für das Vollbild auf dem Fernseher wird Microsoft Edge (oder Google Chrome) gebraucht.',
        ['Microsoft Edge über Windows Update installieren bzw. reparieren.', `Bis dahin die Präsentation von Hand öffnen: ${this.url} und F11 drücken.`]);
      this.zustand.meldung = m;
      return { gestartet: false, einBildschirm: false, meldung: m };
    }
    const bildschirme = this.bildschirmeErmitteln();
    this.zustand.bildschirme = bildschirme.length;
    const ziel = waehleBildschirm(bildschirme, this.einstellungen.bildschirm);
    this.zustand.ziel = ziel ? `${ziel.name} (${ziel.breite}×${ziel.hoehe})` : 'unbekannt';
    this._browser = browser;
    this._ziel = ziel;
    this._starteBrowser();
    const einBildschirm = bildschirme.length <= 1;
    this.log(einBildschirm
      ? '[Fernseher] Präsentation läuft im Vollbild. Nur EIN Bildschirm: der PC-Manager wird nicht davor geöffnet (Tipp: zweiten Monitor an VGA, Windows „Erweitern“).'
      : `[Fernseher] Präsentation läuft auf ${this.zustand.ziel}. PC-Manager und dieses Fenster bleiben auf der Hauptanzeige.`);
    return { gestartet: true, einBildschirm, meldung: null };
  }

  _starteBrowser() {
    const profil = path.join(this.datenOrdner, 'fernseher-browser');
    try { fs.mkdirSync(profil, { recursive: true }); } catch (e) { /* Browser legt es selbst an */ }
    const kind = this.starter(this._browser, browserArgumente({ url: this.url, profil, bildschirm: this._ziel }), { stdio: 'ignore', windowsHide: false, detached: false });
    this._kind = kind;
    this.zustand.laeuft = true;
    kind.on('error', (e) => { this.zustand.laeuft = false; this.fehlerLog(`[Fernseher] Browser startet nicht: ${e.message}`); });
    kind.on('exit', (code) => {
      this.zustand.laeuft = false;
      if (this._stopp) return;
      if (code === 0) {
        this.log('[Fernseher] Fernsehbild wurde geschlossen. Wieder öffnen: schwarzes Fenster neu starten oder im PC-Manager „📺 An den Fernseher senden“.');
        return;
      }
      this.zustand.neustarts++;
      if (this.zustand.neustarts > 5) { this.fehlerLog('[Fernseher] Browser stürzt immer wieder ab – kein weiterer Neustart. Lösung: PC neu starten.'); return; }
      this.fehlerLog(`[Fernseher] Browser unerwartet beendet (Code ${code}) – wird in 10 s neu gestartet.`);
      const t = setTimeout(() => { if (!this._stopp) this._starteBrowser(); }, 10000); if (t.unref) t.unref();
    });
  }

  // „An den Fernseher senden“, wenn das Fernsehbild gerade zu ist: wieder öffnen.
  sicherstellen() {
    if (!this.einstellungen.aktiv || this.plattform !== 'win32' || !this._browser || this.zustand.laeuft) return false;
    this._starteBrowser();
    return true;
  }

  status() { return { ...this.zustand, url: this.url }; }

  stop() {
    this._stopp = true;
    try { if (this._kind && this.zustand.laeuft) this._kind.kill(); } catch (e) { /* weg */ }
  }
}

module.exports = { Fernseher, leseEinstellungen, waehleBildschirm, browserArgumente, findeBrowser };
