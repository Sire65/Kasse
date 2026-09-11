// KC Sync Baustufe 2.2 – plattformübergreifender Schutz für Geheimnis-Dateien
// (privater Schlüssel, Admin-Token). chmod(0600) schützt unter Windows NICHT - NTFS kennt
// keine POSIX-Dateirechte, chmod unter Node auf Windows setzt bestenfalls das
// Nur-Lesen-Attribut, keine echte Zugriffsliste.
'use strict';
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

// Befund T-03: die vorherige Fassung nutzte process.env.USERNAME - das ist eine Umgebungs-
// variable, die vom TATSÄCHLICHEN Prozess-Token abweichen kann (im Prüfbericht bestätigt:
// USERNAME=Koch, der Node-Prozess lief aber tatsächlich als TOWER-HANS2\CodexSandboxOffline).
// Die ACL wurde dadurch für ein FALSCHES Konto gesetzt, der eigene Prozess beim nächsten Start
// ausgesperrt. "whoami" fragt stattdessen das tatsächliche Prozess-Token ab, nicht eine
// überschreibbare/vererbte Umgebungsvariable.
function currentWindowsIdentity() {
  return execFileSync('whoami', [], { encoding: 'utf8' }).trim();
}

function protectSecretFile(filePath) {
  if (os.platform() === 'win32') {
    try {
      const user = currentWindowsIdentity();
      // Erbt keine Rechte mehr von der übergeordneten Datei/dem Ordner (/inheritance:r) und
      // gewährt ausschließlich dem tatsächlichen aktuellen Prozess-Konto Vollzugriff.
      execFileSync('icacls', [filePath, '/inheritance:r', '/grant:r', `${user}:F`], { stdio: 'ignore' });
    } catch (err) {
      return { platform: 'win32', method: 'icacls', ok: false, error: err.message };
    }
    // Befund D-04 (fail-closed): nicht blind vertrauen, dass icacls mit Exit-Code 0 auch
    // tatsächlich lesbaren Zugriff herstellt - durch eine echte Leseprobe bestätigen.
    try { fs.readFileSync(filePath); }
    catch (err) { return { platform: 'win32', method: 'icacls', ok: false, error: `ACL gesetzt, aber Leseprobe fehlgeschlagen: ${err.message}` }; }
    return { platform: 'win32', method: 'icacls', ok: true };
  }
  try {
    fs.chmodSync(filePath, 0o600);
    fs.readFileSync(filePath); // gleiche Leseprobe auch auf POSIX, für symmetrisches Vertrauen
    return { platform: os.platform(), method: 'chmod', ok: true };
  } catch (err) {
    return { platform: os.platform(), method: 'chmod', ok: false, error: err.message };
  }
}

module.exports = { protectSecretFile };
