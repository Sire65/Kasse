// KC Sync Betriebs-Gate B – Backup/Restore, grundlegend überarbeitet.
//
// Befunde B3-K02/B3-K03 aus der Baustufe-3-Gesamtabnahme:
// - Checkpoint+Rohkopie war KEINE garantiert konsistente Momentaufnahme (eine laufende
//   Verbindung konnte zwischen Checkpoint und Kopie erneut schreiben; das Checkpoint-Ergebnis
//   wurde nie ausgewertet). Jetzt: VACUUM INTO - SQLites eigener, echter Mechanismus für eine
//   konsistente Punkt-in-Zeit-Momentaufnahme in einem einzigen atomaren Vorgang.
// - Restore überschrieb die Zieldatei direkt und prüfte nur, ob PRAGMA integrity_check eine
//   Ausnahme wirft, nicht den tatsächlichen Rückgabewert. Ein Abbruch mitten im Restore konnte
//   eine vorher intakte Installation zerstören. Jetzt: vollständig in ein TEMPORÄRES Ziel
//   restaurieren, Ergebnis exakt auf "ok" prüfen, Begleitdateien verpflichtend, ERST DANACH
//   atomar (Umbenennen, nicht Kopieren) an die eigentliche Zielposition verschieben.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const { protectSecretFile } = require('./manager-companion/secure-file');

function sha256File(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }

// Berechnet den Auditketten-Anker (Anzahl + letzter Hash) exakt nach derselben Regel wie
// manager-companion/index.js (_writeAuditLog/verifyAuditChain): Alt-Zeilen ohne Hash (aus der
// Zeit vor Baustufe 3) werden übersprungen, ohne den Kettenstand zu beeinflussen. Wird hier
// wiederverwendet, um den Anker direkt aus einer Datenbankdatei (z. B. einem frischen Backup-
// Snapshot) neu abzuleiten, statt eine möglicherweise zeitlich abweichende Kopie zu übernehmen.
function computeAuditAnchor(dbPath) {
  const db = new DatabaseSync(dbPath);
  try {
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_audit_log'").get();
    if (!tableExists) return null;
    const rows = db.prepare('SELECT entry_hash FROM admin_audit_log WHERE entry_hash IS NOT NULL ORDER BY id ASC').all();
    if (!rows.length) return null; // noch kein hash-verketteter Eintrag vorhanden, legitim kein Anker nötig
    return { count: rows.length, lastHash: rows[rows.length - 1].entry_hash };
  } finally {
    db.close();
  }
}

// Erzeugt ein vollständiges, in sich konsistentes Backup-Set (Datenbank + Schlüssel + Admin-
// Token + Manifest mit Prüfsummen) an temporären Namen, und benennt ERST NACH erfolgreichem
// Abschluss aller Teile atomar in die endgültigen Zieldateien um - ein Abbruch mittendrin
// hinterlässt dadurch nie ein halb geschriebenes, scheinbar gültiges Backup.
function backupDatabase(sourcePath, backupPath) {
  if (sourcePath === ':memory:') throw new Error('backup_requires_file_database');
  const tmpDbPath = backupPath + '.tmp';
  if (fs.existsSync(tmpDbPath)) fs.unlinkSync(tmpDbPath);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });

  const db = new DatabaseSync(sourcePath);
  try {
    // VACUUM INTO schreibt eine vollständige, zu jedem Zeitpunkt in sich konsistente Kopie der
    // Datenbank in EINEM atomaren SQLite-eigenen Vorgang - kein Wettlauf mit gleichzeitigen
    // Schreibvorgängen möglich, anders als bei Checkpoint+externer Dateikopie.
    db.exec(`VACUUM INTO '${tmpDbPath.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }

  const manifest = { createdAt: new Date().toISOString(), files: {} };
  manifest.files['database'] = { sha256: sha256File(tmpDbPath) };

  const companionTmp = {};
  // Gate-B-Schlusskorrektur (Auditpunkt 2): der Anker wird NICHT von der laufenden Live-Datei
  // kopiert (das hätte einen anderen Zeitstand als der bereits eingefrorene Datenbank-Snapshot
  // haben können, falls zwischen VACUUM INTO und dieser Kopie noch ein Auditvorgang stattfand),
  // sondern direkt aus dem soeben erzeugten Snapshot selbst neu berechnet. Beide stammen dadurch
  // garantiert aus exakt demselben, bereits eingefrorenen Datenstand.
  const anchorFromSnapshot = computeAuditAnchor(tmpDbPath);
  if (anchorFromSnapshot) {
    const anchorTmp = backupPath + '.audit-anchor.json.tmp';
    fs.writeFileSync(anchorTmp, JSON.stringify(anchorFromSnapshot));
    companionTmp['.audit-anchor.json'] = anchorTmp;
    manifest.files['.audit-anchor.json'] = { sha256: sha256File(anchorTmp) };
  }
  for (const suffix of ['.key.pem', '.admin-token.txt']) {
    const src = sourcePath + suffix;
    if (fs.existsSync(src)) {
      const tmp = backupPath + suffix + '.tmp';
      fs.copyFileSync(src, tmp);
      companionTmp[suffix] = tmp;
      manifest.files[suffix] = { sha256: sha256File(tmp) };
    }
  }
  const manifestTmp = backupPath + '.manifest.json.tmp';
  fs.writeFileSync(manifestTmp, JSON.stringify(manifest, null, 2));

  // Erst JETZT, nachdem alle Teile vollständig und fehlerfrei geschrieben wurden, atomar in
  // die endgültigen Namen umbenennen (fs.renameSync ist auf demselben Dateisystem atomar).
  fs.renameSync(tmpDbPath, backupPath);
  for (const [suffix, tmp] of Object.entries(companionTmp)) fs.renameSync(tmp, backupPath + suffix);
  fs.renameSync(manifestTmp, backupPath + '.manifest.json');

  return { backedUpAt: manifest.createdAt, backupPath, companionFiles: Object.keys(companionTmp) };
}

// Stellt ein zuvor mit backupDatabase() erzeugtes Set wieder her. Restauriert vollständig in
// ein TEMPORÄRES Ziel, prüft dort den ECHTEN Rückgabewert von PRAGMA integrity_check (nicht nur
// ob eine Ausnahme geworfen wird) sowie die Prüfsummen aus dem Manifest, verlangt eine
// vorhandene Schlüsseldatei (sonst wäre das Ergebnis wegen des fail-closed-Schutzes aus D-04
// ohnehin nie startbar) - ERST wenn alle Prüfungen bestehen, wird atomar an die eigentliche
// Zielposition verschoben. Schlägt irgendein Schritt fehl, bleibt eine vorher vorhandene
// Zieldatenbank unangetastet.
function restoreDatabase(backupPath, targetPath) {
  if (!fs.existsSync(backupPath)) throw new Error('backup_file_not_found');
  const manifestPath = backupPath + '.manifest.json';
  if (!fs.existsSync(manifestPath)) throw new Error('backup_manifest_missing: kein gültiges Backup-Set (Manifest fehlt), Restore abgebrochen.');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.files?.database?.sha256 !== sha256File(backupPath)) {
    throw new Error('backup_checksum_mismatch: Datenbankdatei stimmt nicht mit dem Manifest überein, Restore abgebrochen.');
  }
  if (!manifest.files?.['.key.pem']) {
    throw new Error('backup_missing_key_file: Backup enthält keine Schlüsseldatei - eine Wiederherstellung wäre wegen des fail-closed-Schutzes (D-04) ohnehin nicht startbar, Restore abgebrochen.');
  }

  const tmpTarget = targetPath + '.restoring.tmp';
  if (fs.existsSync(tmpTarget)) fs.unlinkSync(tmpTarget);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(backupPath, tmpTarget);

  const check = new DatabaseSync(tmpTarget);
  let integrityResult;
  try {
    integrityResult = check.prepare('PRAGMA integrity_check').get();
  } finally {
    check.close();
  }
  if (integrityResult?.integrity_check !== 'ok') {
    fs.unlinkSync(tmpTarget);
    throw new Error(`backup_integrity_check_failed: ${JSON.stringify(integrityResult)} - Restore abgebrochen, Zieldatenbank NICHT veraendert.`);
  }

  const tmpCompanions = {};
  for (const suffix of ['.key.pem', '.admin-token.txt', '.audit-anchor.json']) {
    const src = backupPath + suffix;
    if (!manifest.files[suffix]) continue;
    if (!fs.existsSync(src) || sha256File(src) !== manifest.files[suffix].sha256) {
      fs.unlinkSync(tmpTarget);
      throw new Error(`backup_companion_checksum_mismatch: ${suffix} stimmt nicht mit dem Manifest ueberein, Restore abgebrochen.`);
    }
    const tmp = targetPath + suffix + '.restoring.tmp';
    fs.copyFileSync(src, tmp);
    tmpCompanions[suffix] = tmp;
  }

  // Alle Prüfungen bestanden - erst jetzt atomar an die eigentliche Zielposition verschieben.
  fs.renameSync(tmpTarget, targetPath);
  for (const [suffix, tmp] of Object.entries(tmpCompanions)) {
    fs.renameSync(tmp, targetPath + suffix);
    protectSecretFile(targetPath + suffix);
  }
  for (const suffix of ['-wal', '-shm']) {
    const p = targetPath + suffix;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  return { restoredAt: new Date().toISOString(), targetPath, restoredCompanionFiles: Object.keys(tmpCompanions) };
}

module.exports = { backupDatabase, restoreDatabase };
