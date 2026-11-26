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
//   sparmodus: false = alle Effekte (Schnee, Funken, Feuerwerk …) wieder an – Standard: Sparmodus an (Mini-PC entlasten).
//   einBildschirm: true = Präsentation darf auch laufen, wenn nur EIN Bildschirm da ist (Standard: nein – sonst
//   landet sie bei ausgeschaltetem Fernseher auf dem kleinen Monitor).
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync, execFile } = require('child_process');
const { meldung } = require('./fehlerhilfe');

function leseEinstellungen(datei) {
  const standard = { aktiv: false, bildschirm: 'auto', einBildschirm: false };
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

// Dieselbe Abfrage ohne zu blockieren (für die Prüfung alle 20 s - der Manager-Dienst bedient währenddessen die Kassen).
function bildschirmeWindowsAsync() {
  const skript = 'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::AllScreens | ForEach-Object { [pscustomobject]@{ name=$_.DeviceName; x=$_.Bounds.X; y=$_.Bounds.Y; breite=$_.Bounds.Width; hoehe=$_.Bounds.Height; haupt=$_.Primary } } | ConvertTo-Json -Compress';
  return new Promise((ok) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', skript], { encoding: 'utf8', timeout: 15000, windowsHide: true }, (fehler, aus) => {
      try { const d = JSON.parse(String(aus || '').trim()); ok(Array.isArray(d) ? d : [d]); } catch (e) { ok([]); }
    });
  });
}

// 26.11.2026 (Befund Stand: Fernseher kurz aus und wieder an – Windows hatte die Präsentation auf den kleinen
// Monitor geschoben, und dort blieb sie): Ein dauerhaft geöffnetes PowerShell liefert alle 20 s die Bildschirme UND
// die Lage des Fernseh-Fensters. Steht das Fenster nicht auf dem Fernseher, wird es zurückgeholt. Dauerhaft statt
// je Prüfung neu gestartet: spart auf dem Celeron spürbar Rechenzeit. Klappt das nicht, gilt der alte Weg (nur Bildschirme).
const PS_INIT = [
  "$ProgressPreference = 'SilentlyContinue'",
  'Add-Type -AssemblyName System.Windows.Forms',
  "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class KcFen { [StructLayout(LayoutKind.Sequential)] public struct R { public int L; public int T; public int Ri; public int B; } [DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr h, out R r); }'",
  "function KcPruefe([int]$kid) { $s = @([System.Windows.Forms.Screen]::AllScreens | ForEach-Object { [pscustomobject]@{ name=$_.DeviceName; x=$_.Bounds.X; y=$_.Bounds.Y; breite=$_.Bounds.Width; hoehe=$_.Bounds.Height; haupt=$_.Primary } }); $f = $null; $p = $null; if ($kid -gt 0) { $p = Get-Process -Id $kid -ErrorAction SilentlyContinue }; if (-not $p -or $p.MainWindowHandle -eq 0) { $p = Get-Process msedge,chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*KC Fernseher*' } | Select-Object -First 1 }; if ($p -and $p.MainWindowHandle -ne 0) { $r = New-Object KcFen+R; [void][KcFen]::GetWindowRect($p.MainWindowHandle, [ref]$r); $f = [pscustomobject]@{ l=$r.L; t=$r.T; r=$r.Ri; b=$r.B } }; Write-Output ('KCJSON' + (ConvertTo-Json -Compress -Depth 4 ([pscustomobject]@{ schirme=$s; fenster=$f }))) }",
  '',
].join('\r\n');

class PowerShellDauer {
  constructor(starter = spawn) { this.starter = starter; this.kind = null; this.puffer = ''; this.warten = null; }
  _start() {
    const k = this.starter('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', '-'], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    this.kind = k; this.puffer = '';
    k.on('error', () => { if (this.kind === k) this.kind = null; this._fertig(null); });
    k.on('exit', () => { if (this.kind === k) this.kind = null; this._fertig(null); });
    if (k.stdin) { k.stdin.on('error', () => {}); k.stdin.write(PS_INIT + '\r\n'); }
    if (k.stdout) {
      k.stdout.setEncoding('utf8');
      k.stdout.on('data', (d) => {
        this.puffer = (this.puffer + d).slice(-200000);
        let i;
        while ((i = this.puffer.indexOf('\n')) >= 0) {
          const zeile = this.puffer.slice(0, i).trim(); this.puffer = this.puffer.slice(i + 1);
          if (zeile.startsWith('KCJSON')) { let v = null; try { v = JSON.parse(zeile.slice(6)); } catch (e) { v = null; } this._fertig(v); }
        }
      });
    }
  }
  _fertig(v) { const w = this.warten; this.warten = null; if (w) w(v); }
  frage(pid) {
    return new Promise((ok) => {
      if (this.warten) { ok(null); return; }
      if (!this.kind) this._start();
      if (!this.kind || !this.kind.stdin) { ok(null); return; }
      const t = setTimeout(() => { if (this.warten) { this.warten = null; this.stop(); ok(null); } }, 20000); if (t.unref) t.unref();
      this.warten = (v) => { clearTimeout(t); ok(v); };
      try { this.kind.stdin.write(`KcPruefe ${Number(pid) || 0}\r\n`); } catch (e) { this._fertig(null); }
    });
  }
  stop() { try { if (this.kind) this.kind.kill(); } catch (e) { /* weg */ } this.kind = null; }
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
  // --disable-search-engine-choice-screen (25.11.2026): Chrome zeigt in einem neuen Profil sonst die Suchmaschinen-Auswahl
  // (chrome://settings/search) vor der Präsentation; Edge ignoriert den Schalter.
  const a = ['--kiosk', url, '--edge-kiosk-type=fullscreen', '--no-first-run', '--no-default-browser-check', '--disable-search-engine-choice-screen',
    '--disable-features=Translate,msEdgeSidebarV2', '--autoplay-policy=no-user-gesture-required',
    '--disable-session-crashed-bubble', '--hide-crash-restore-bubble', `--user-data-dir=${profil}`];
  if (bildschirm) a.push(`--window-position=${bildschirm.x + 20},${bildschirm.y + 20}`);
  return a;
}

class Fernseher {
  constructor({ einstellungsDatei, datenOrdner, webserverPort, log = console.log, fehlerLog = console.error,
    plattform = process.platform, bildschirmeErmitteln = bildschirmeWindows, browserFinden = findeBrowser, starter = spawn, wachTakt = 20000, bildschirmeErmittelnAsync = null, ausNachPruefungen = 3 } = {}) {
    // 25.11.2026 (Betreiber-Protokoll am Stand: „Fernseher ist aus“ / „Fernseher erkannt“ im 20-s-Wechsel): EINE Abfrage mit
    // weniger Bildschirmen schloss die Präsentation sofort – auch eine gescheiterte PowerShell-Abfrage (0 Bildschirme) oder
    // ein kurzer HDMI-Aussetzer. Jetzt: 0 Bildschirme = Abfrage unklar, nichts tun; geschlossen wird erst, wenn der
    // Fernseher bei ausNachPruefungen Prüfungen hintereinander fehlt (Standard 3 = rund eine Minute).
    this.ausNachPruefungen = Math.max(1, ausNachPruefungen);
    this._fehltSeit = 0; this._psFehler = 0;
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
    this.wachTakt = wachTakt;
    this.bildschirmeErmittelnAsync = bildschirmeErmittelnAsync
      || (bildschirmeErmitteln === bildschirmeWindows ? (pid) => this._windowsAbfrage(pid) : async () => bildschirmeErmitteln());
  }

  // "rand": Sicherheitsrand in Prozent (0-10) gegen Overscan - viele Fernseher schneiden die Bildränder ab.
  get url() {
    const rand = Math.max(0, Math.min(10, Number(this.einstellungen.rand) || 0));
    // Sparmodus (25.11.2026): Standard an - Dauer-Effekte aus, damit der kleine Mini-PC Luft für Kassen und PC-Manager hat.
    const teile = [];
    if (rand) teile.push(`rand=${rand}`);
    if (this.einstellungen.sparmodus !== false) teile.push('spar=1');
    return `http://127.0.0.1:${this.webserverPort}/tv-player/fernseher.html${teile.length ? `?${teile.join('&')}` : ''}`;
  }

  // Ergebnis: { gestartet, einBildschirm, wartet, meldung }
  // 24.11.2026 (Betreiber: „Der TV war nicht an, jetzt läuft die Präsentation auf dem kleinen Bildschirm – das darf nicht
  // passieren“): Die Präsentation startet NUR, wenn ein zweiter Bildschirm (der Fernseher) da ist. Alle 20 s wird
  // nachgesehen: Fernseher an -> Präsentation startet dort von selbst; Fernseher aus -> Präsentation wird geschlossen
  // (sonst schiebt Windows sie auf den kleinen Monitor). Nur mit "einBildschirm": true in stand-einstellungen.json
  // darf sie auch auf einem einzigen Bildschirm laufen.
  start() {
    if (!this.einstellungen.aktiv) return { gestartet: false, einBildschirm: false, wartet: false, meldung: null };
    if (this.plattform !== 'win32') {
      this.log(`[Fernseher] Automatischer Start nur unter Windows. Präsentation von Hand: ${this.url}`);
      return { gestartet: false, einBildschirm: false, wartet: false, meldung: null };
    }
    const browser = this.browserFinden();
    if (!browser) {
      const m = meldung('fernseher-browser', 'Fernseher: Präsentation startet nicht – Microsoft Edge wurde nicht gefunden',
        'Für das Vollbild auf dem Fernseher wird Microsoft Edge (oder Google Chrome) gebraucht.',
        ['Microsoft Edge über Windows Update installieren bzw. reparieren.', `Bis dahin die Präsentation von Hand öffnen: ${this.url} und F11 drücken.`]);
      this.zustand.meldung = m;
      return { gestartet: false, einBildschirm: false, wartet: false, meldung: m };
    }
    this._browser = browser;
    const n = this._pruefen();
    if (!this._wache) {
      this._wache = setInterval(async () => {
        if (this._prueftGerade || this._stopp) return;
        this._prueftGerade = true;
        try { this._pruefen(await this.bildschirmeErmittelnAsync(this._kind && this.zustand.laeuft ? this._kind.pid : 0)); } catch (e) { /* nächster Takt */ } finally { this._prueftGerade = false; }
      }, this.wachTakt);
      if (this._wache.unref) this._wache.unref();
    }
    if (this.zustand.laeuft) {
      this.log(n <= 1
        ? '[Fernseher] Präsentation läuft im Vollbild auf dem einzigen Bildschirm („einBildschirm“ eingestellt). PC-Manager wird nicht davor geöffnet.'
        : `[Fernseher] Präsentation läuft auf ${this.zustand.ziel}. PC-Manager und dieses Fenster bleiben auf der Hauptanzeige.`);
    }
    return { gestartet: this.zustand.laeuft, einBildschirm: n <= 1, wartet: !!this.zustand.wartet, meldung: null };
  }

  // Dauer-PowerShell (Bildschirme + Fensterlage); nach 2 Fehlschlägen dauerhaft der alte Weg (nur Bildschirme).
  async _windowsAbfrage(pid) {
    if (!this._psKaputt) {
      if (!this._ps) this._ps = new PowerShellDauer();
      const r = await this._ps.frage(pid);
      if (r && r.schirme) {
        this._psFehler = 0;
        const liste = Array.isArray(r.schirme) ? r.schirme : [r.schirme];
        liste.fenster = r.fenster || null;
        return liste;
      }
      if (++this._psFehler >= 2) { this._psKaputt = true; this._ps.stop(); }
    }
    return bildschirmeWindowsAsync();
  }

  // Präsentation steht auf dem falschen Bildschirm (Windows hat sie beim Aus/Ein des Fernsehers verschoben): schließen
  // und nach dem Beenden auf dem Fernseher neu starten.
  _zurueckHolen(grund) {
    if (!this._kind || !this.zustand.laeuft) return;
    this.log(`[Fernseher] ${grund} – Präsentation wird auf den Fernseher zurückgeholt.`);
    this._absichtlichZu = true; this._danachStarten = true;
    try { this._kind.kill(); } catch (e) { /* weg */ }
    this.zustand.laeuft = false;
    this.zustand.zurueckgeholt = (this.zustand.zurueckgeholt || 0) + 1;
  }

  _erlaubt(n) { return n >= 2 || this.einstellungen.einBildschirm === true; }

  // Bildschirme ansehen und Präsentation passend starten/schließen. Liefert die Zahl der Bildschirme.
  _pruefen(liste) {
    let bildschirme = [];
    if (Array.isArray(liste)) bildschirme = liste;
    else { try { bildschirme = this.bildschirmeErmitteln() || []; } catch (e) { bildschirme = []; } }
    const n = bildschirme.length;
    this.zustand.bildschirme = n;
    if (!this._erlaubt(n)) {
      if (this.zustand.laeuft && this._kind) {
        if (n === 0) return n;   // Abfrage gescheitert – kein Beleg, dass der Fernseher aus ist
        if (++this._fehltSeit < this.ausNachPruefungen) return n;   // kurzer Aussetzer? erst bei wiederholtem Fehlen schließen
        this._fehltSeit = 0;
        this._absichtlichZu = true;
        try { this._kind.kill(); } catch (e) { /* weg */ }
        this.zustand.laeuft = false;
        this.log(`[Fernseher] Fernseher ist aus (Windows meldet ${n} Bildschirm${n === 1 ? '' : 'e'}, ${this.ausNachPruefungen}× hintereinander) – Präsentation geschlossen (sie soll nicht auf dem kleinen Monitor laufen). Sie startet wieder, sobald der Fernseher an ist.`);
      } else if (!this.zustand.wartet) {
        this.log(n === 0
          ? '[Fernseher] Bildschirme nicht erkennbar – Präsentation wartet (nicht auf dem kleinen Monitor). Fernseher einschalten, sie startet dann von selbst.'
          : '[Fernseher] Fernseher nicht erkannt (aus oder Kabel lose) – Präsentation wartet und startet von selbst, sobald er an ist.');
      }
      this.zustand.wartet = true;
      return n;
    }
    this._fehltSeit = 0;
    // Läuft die Präsentation, aber ihr Fenster steht nicht auf dem Fernseher? Dann zurückholen.
    if (this.zustand.laeuft && liste && liste.fenster && this._ziel) {
      const tv = bildschirme.find((b) => b.name === this._ziel.name) || waehleBildschirm(bildschirme, this.einstellungen.bildschirm);
      const f = liste.fenster, mx = (Number(f.l) + Number(f.r)) / 2, my = (Number(f.t) + Number(f.b)) / 2;
      const drauf = tv && mx >= tv.x && mx < tv.x + tv.breite && my >= tv.y && my < tv.y + tv.hoehe;
      if (!drauf) { this._ziel = tv || this._ziel; this._zurueckHolen('Präsentation stand nicht auf dem Fernseher (Fernseher war kurz aus?)'); return n; }
    }
    const warteteVorher = !!this.zustand.wartet;
    this.zustand.wartet = false;
    if (!this.zustand.laeuft && !this._vomNutzerGeschlossen && !this._stopp) {
      const ziel = waehleBildschirm(bildschirme, this.einstellungen.bildschirm);
      this._ziel = ziel;
      this.zustand.ziel = ziel ? `${ziel.name} (${ziel.breite}×${ziel.hoehe})` : 'unbekannt';
      if (this._gestartetMal || warteteVorher) this.log(`[Fernseher] Fernseher erkannt – Präsentation startet auf ${this.zustand.ziel}.`);
      this._starteBrowser();
    }
    return n;
  }

  _starteBrowser() {
    this._gestartetMal = true;
    const profil = path.join(this.datenOrdner, 'fernseher-browser');
    try { fs.mkdirSync(profil, { recursive: true }); } catch (e) { /* Browser legt es selbst an */ }
    const kind = this.starter(this._browser, browserArgumente({ url: this.url, profil, bildschirm: this._ziel }), { stdio: 'ignore', windowsHide: false, detached: false });
    this._kind = kind;
    this.zustand.laeuft = true;
    kind.on('error', (e) => { if (this._kind === kind) this.zustand.laeuft = false; this.fehlerLog(`[Fernseher] Browser startet nicht: ${e.message}`); });
    kind.on('exit', (code) => {
      if (this._kind === kind) this.zustand.laeuft = false;
      if (this._stopp) return;
      if (this._absichtlichZu) {   // Fernseher aus bzw. falscher Bildschirm - wir haben selbst geschlossen
        this._absichtlichZu = false;
        if (this._danachStarten) { this._danachStarten = false; const t = setTimeout(() => { if (!this._stopp && !this.zustand.laeuft) this._pruefen(); }, 2000); if (t.unref) t.unref(); }
        return;
      }
      if (code === 0) {
        this._vomNutzerGeschlossen = true;
        this.log('[Fernseher] Fernsehbild wurde geschlossen. Wieder öffnen: schwarzes Fenster neu starten oder im PC-Manager „📺 An den Fernseher senden“.');
        return;
      }
      this.zustand.neustarts++;
      if (this.zustand.neustarts > 5) { this.fehlerLog('[Fernseher] Browser stürzt immer wieder ab – kein weiterer Neustart. Lösung: PC neu starten.'); return; }
      this.fehlerLog(`[Fernseher] Browser unerwartet beendet (Code ${code}) – wird in 10 s neu gestartet.`);
      const t = setTimeout(() => { if (!this._stopp && !this.zustand.laeuft) this._pruefen(); }, 10000); if (t.unref) t.unref();
    });
  }

  // „An den Fernseher senden“, wenn das Fernsehbild gerade zu ist: wieder öffnen (nur, wenn der Fernseher da ist).
  sicherstellen() {
    if (!this.einstellungen.aktiv || this.plattform !== 'win32' || !this._browser || this.zustand.laeuft) return false;
    this._vomNutzerGeschlossen = false;
    this._pruefen();
    return this.zustand.laeuft;
  }

  status() { return { ...this.zustand, url: this.url }; }

  stop() {
    this._stopp = true;
    if (this._wache) clearInterval(this._wache);
    if (this._ps) this._ps.stop();
    try { if (this._kind && this.zustand.laeuft) this._kind.kill(); } catch (e) { /* weg */ }
  }
}

module.exports = { Fernseher, leseEinstellungen, waehleBildschirm, browserArgumente, findeBrowser, bildschirmeWindowsAsync, PowerShellDauer, PS_INIT };
