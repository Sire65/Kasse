// KC MarktKasse – Port-Freigabe (KS-03 „Belegte Ports selbst freiräumen – ohne Adminrechte“)
//
// Ist ein Port belegt, den das Kassensystem braucht, wird ermittelt, WER ihn belegt:
//   - ein ALTES KC-Fenster (erkennbar an run-manager-service.js, run-device-companion.js,
//     serve-frontend.js oder markttag-start.js in der Befehlszeile): wird beendet, danach wird
//     erneut versucht. Laeuft unter demselben Windows-Benutzer - Adminrechte sind nicht noetig.
//   - ein FREMDES Programm: wird NIE beendet (es koennte etwas Wichtiges sein). Die Meldung nennt
//     dann den Programmnamen, damit man weiss, was zu schliessen ist.
//   - nicht ermittelbar: wie bisher Meldung mit Loesungsweg.
// Der eigene Prozess, sein Elternprozess und seine eigenen Kindprozesse werden nie beendet.
'use strict';
const fs = require('fs');
const net = require('net');
const { spawnSync } = require('child_process');

const KC_MUSTER = /(run-manager-service|run-device-companion|serve-frontend|markttag-start)\.js/i;

function portFrei(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.listen(port, '0.0.0.0', () => s.close(() => resolve(true)));
  });
}
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Wer belegt den Port? ----------
function besitzerLinux(port) {
  const hex = port.toString(16).toUpperCase().padStart(4, '0');
  const inodes = new Set();
  for (const datei of ['/proc/net/tcp', '/proc/net/tcp6']) {
    let text = '';
    try { text = fs.readFileSync(datei, 'utf8'); } catch (e) { continue; }
    for (const zeile of text.split('\n').slice(1)) {
      const t = zeile.trim().split(/\s+/);
      if (t.length < 10) continue;
      if (t[1].split(':')[1] === hex && t[3] === '0A') inodes.add(t[9]); // 0A = LISTEN
    }
  }
  if (!inodes.size) return null;
  for (const pidName of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(pidName)) continue;
    let fds = [];
    try { fds = fs.readdirSync(`/proc/${pidName}/fd`); } catch (e) { continue; }
    for (const fd of fds) {
      let ziel = '';
      try { ziel = fs.readlinkSync(`/proc/${pidName}/fd/${fd}`); } catch (e) { continue; }
      const m = ziel.match(/^socket:\[(\d+)\]$/);
      if (m && inodes.has(m[1])) {
        const pid = Number(pidName);
        let befehl = '', name = '', eltern = null;
        try { befehl = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean).join(' '); } catch (e) { /* */ }
        try { name = fs.readFileSync(`/proc/${pid}/comm`, 'utf8').trim(); } catch (e) { /* */ }
        try { eltern = Number(fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ')[1]); } catch (e) { /* */ }
        return { pid, name, befehl, eltern };
      }
    }
  }
  return null;
}

function powershell(skript) {
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', skript],
    { encoding: 'utf8', timeout: 10000, windowsHide: true });
  return r.status === 0 ? String(r.stdout || '').trim() : '';
}

function prozessWindows(pid) {
  const json = powershell(`$p = Get-CimInstance Win32_Process -Filter "ProcessId=${Number(pid)}"; if ($p) { [pscustomobject]@{ name = $p.Name; befehl = $p.CommandLine; eltern = $p.ParentProcessId } | ConvertTo-Json -Compress }`);
  try { const d = JSON.parse(json); return { pid: Number(pid), name: d.name || '', befehl: d.befehl || '', eltern: Number(d.eltern) || null }; }
  catch (e) {
    // Rückfall ohne Befehlszeile: nur der Name - dann wird sicherheitshalber NICHT beendet.
    const r = spawnSync('tasklist', ['/FI', `PID eq ${Number(pid)}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', timeout: 8000, windowsHide: true });
    const name = (String(r.stdout || '').match(/^"([^"]+)"/) || [])[1] || '';
    return { pid: Number(pid), name, befehl: '', eltern: null };
  }
}

function besitzerWindows(port) {
  let pid = Number(powershell(`(Get-NetTCPConnection -LocalPort ${Number(port)} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess`)) || 0;
  if (!pid) {
    const r = spawnSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8', timeout: 8000, windowsHide: true });
    for (const zeile of String(r.stdout || '').split(/\r?\n/)) {
      const t = zeile.trim().split(/\s+/);
      if (t.length >= 5 && /LISTEN/i.test(t[3]) && new RegExp(`:${Number(port)}$`).test(t[1])) { pid = Number(t[4]); break; }
    }
  }
  return pid ? prozessWindows(pid) : null;
}

function besitzerMac(port) {
  const r = spawnSync('lsof', ['-nP', `-iTCP:${Number(port)}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8', timeout: 8000 });
  const pid = Number(String(r.stdout || '').trim().split('\n')[0]) || 0;
  if (!pid) return null;
  const ps = spawnSync('ps', ['-o', 'ppid=,comm=', '-p', String(pid)], { encoding: 'utf8' });
  const cmd = spawnSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8' });
  const [eltern, ...name] = String(ps.stdout || '').trim().split(/\s+/);
  return { pid, name: name.join(' '), befehl: String(cmd.stdout || '').trim(), eltern: Number(eltern) || null };
}

function portBesitzer(port) {
  try {
    if (process.platform === 'win32') return besitzerWindows(port);
    if (process.platform === 'linux') return besitzerLinux(port);
    if (process.platform === 'darwin') return besitzerMac(port);
  } catch (e) { /* nicht ermittelbar */ }
  return null;
}

function programmName(b) {
  if (!b) return 'unbekanntes Programm';
  const n = (b.name || '').trim();
  return n || (b.befehl || '').split(/[\\/ ]/).filter(Boolean).pop() || `Prozess ${b.pid}`;
}

function istEigener(b) {
  if (!b) return true;
  return b.pid === process.pid || b.pid === process.ppid || b.eltern === process.pid;
}

function beende(pid) {
  if (process.platform === 'win32') {
    // /T: das alte Fenster samt seiner Kassen-Dienste und seines Webservers beenden.
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { encoding: 'utf8', timeout: 10000, windowsHide: true });
    return;
  }
  try { process.kill(pid, 'SIGTERM'); } catch (e) { /* schon weg */ }
}

// Stellt sicher, dass ein Port frei ist. Ergebnis:
//   { frei: true, beendet: [ {pid, name, befehl} ] }   – frei (ggf. nachdem alte KC-Fenster beendet wurden)
//   { frei: false, besitzer: {pid, name, befehl, istKc}, grund }
async function sicherePortFrei(port, { log = () => {}, wofuer = '', versuche = 3, warteMs = 8000 } = {}) {
  const beendet = [];
  for (let runde = 0; runde <= versuche; runde++) {
    if (await portFrei(port)) return { frei: true, beendet };
    const b = portBesitzer(port);
    if (!b) {
      // Nicht ermittelbar (oder gerade im Schliessen): kurz warten und erneut pruefen.
      await warte(1000);
      if (await portFrei(port)) return { frei: true, beendet };
      if (runde === versuche) return { frei: false, besitzer: null, grund: 'nicht_ermittelbar' };
      continue;
    }
    b.istKc = KC_MUSTER.test(b.befehl || '');
    if (istEigener(b)) return { frei: false, besitzer: b, grund: 'eigener_prozess' };
    if (!b.istKc) return { frei: false, besitzer: b, grund: 'fremd' };
    const skript = (b.befehl.match(KC_MUSTER) || [])[0] || 'KC';
    log(`[Port-Freigabe] Port ${port}${wofuer ? ` (${wofuer})` : ''} ist von einem ALTEN Kassenfenster belegt (Prozess ${b.pid}, ${skript}) – wird beendet …`);
    beende(b.pid);
    beendet.push({ pid: b.pid, name: programmName(b), skript });
    const bis = Date.now() + warteMs;
    while (Date.now() < bis) {
      await warte(300);
      if (await portFrei(port)) {
        log(`[Port-Freigabe] Altes Kassenfenster (Prozess ${b.pid}) beendet – Port ${port} ist frei, Start geht weiter.`);
        return { frei: true, beendet };
      }
    }
    // Hat SIGTERM nicht gereicht (Linux/Mac): hart beenden und nochmals versuchen.
    if (process.platform !== 'win32') { try { process.kill(b.pid, 'SIGKILL'); } catch (e) { /* weg */ } }
  }
  const b = portBesitzer(port);
  return { frei: await portFrei(port), besitzer: b, grund: 'laesst_sich_nicht_beenden', beendet };
}

// Fehler-Objekt für erklaere(): Port belegt, mit Angabe des Programms.
function belegtFehler(port, ergebnis) {
  return Object.assign(new Error(`Port ${port} ist bereits belegt`), { code: 'EADDRINUSE', port, belegtVon: ergebnis && ergebnis.besitzer ? { ...ergebnis.besitzer, programm: programmName(ergebnis.besitzer), grund: ergebnis.grund } : null });
}

module.exports = { sicherePortFrei, portBesitzer, portFrei, belegtFehler, programmName, KC_MUSTER };
