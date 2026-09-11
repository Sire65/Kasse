// KC Sync – eigenständige Gegenprobe für GF-N01 und GF-N02
//
// Zweck: unabhängige Prüfung, OHNE der Aussage von Claude zu vertrauen, dass diese beiden
// Punkte aus dem Gate-B-Schlussprüfbericht tatsächlich behoben sind. Bildet exakt die in den
// Berichten beschriebenen Gegenproben nach:
//
//   GF-N01: "Legacy-Auditzeile ohne Hash plus erster neuer Hash-Eintrag bleibt gültig."
//           Vorher gemeldet: { ok:false, brokenAtId:2 }
//           Erwartet nach der Korrektur: { ok:true }
//
//   GF-N02: "Audit-Schreibvorgang während Backup ergibt nach Restore eine zum Snapshot
//           passende Kette und einen passenden Anker."
//           Vorher gemeldet: { ok:false, reason:'tail_mismatch', expected:{count:2}, actualCount:1 }
//           Erwartet nach der Korrektur: { ok:true }
//
// Verwendung:
//   cd kc_sync_stage1
//   npm ci
//   node gate-b-gegenprobe-audit.cjs
//
// Das Skript gibt bei jedem Schritt das TATSÄCHLICHE Ergebnisobjekt aus (nicht nur ok/nicht ok),
// damit auch eine eventuell weiterhin bestehende Abweichung sofort sichtbar ist. Exitcode 0 nur,
// wenn BEIDE Gegenproben bestehen.

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ManagerCompanion } = require('./manager-companion');
const { backupDatabase, restoreDatabase } = require('./backup');

function tmp(name) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gate-b-gegenprobe-')), name);
}

let failures = 0;

async function gfN01() {
  console.log('\n=== GF-N01: Legacy-Auditzeile ohne Hash + erster neuer Hash-Eintrag ===');
  const dbPath = tmp('gfn01.sqlite');
  const mgr = new ManagerCompanion({ dbPath });
  await mgr.start();

  // Eine "legitime Altzeile" wie aus der Zeit vor der Hashketten-Einführung: entry_hash NULL.
  mgr.db.prepare(
    "INSERT INTO admin_audit_log (action, target_device_instance_id, remote_address, result, at) VALUES ('legacy_zeile', NULL, NULL, 'ok', ?)"
  ).run(new Date().toISOString());

  // Der erste NEUE, hash-verkettete Eintrag danach - genau das im Bericht beschriebene Szenario.
  mgr._writeAuditLog('erster_neuer_eintrag', 'dev-x', '127.0.0.1', 'ok');

  const result = mgr.verifyAuditChain();
  console.log('Ergebnis:', JSON.stringify(result));
  await mgr.stop();

  if (result.ok === true) {
    console.log('GF-N01: BESTANDEN');
  } else {
    console.log('GF-N01: NICHT BESTANDEN - erwartet { ok: true }, erhalten:', JSON.stringify(result));
    failures++;
  }
}

async function gfN02() {
  console.log('\n=== GF-N02: Audit-Schreibvorgang während des Backup-Fensters ===');
  const dbPath = tmp('gfn02.sqlite');
  const mgr = new ManagerCompanion({ dbPath });
  await mgr.start();

  mgr._writeAuditLog('vor_dem_backup', 'dev-x', '127.0.0.1', 'ok');
  const backupPath = tmp('gfn02.sqlite.bak');
  backupDatabase(dbPath, backupPath);

  // Der im Bericht beschriebene Fall: ein Audit-Schreibvorgang, der zeitlich unmittelbar nach
  // dem Snapshot auf der weiterlaufenden Live-Datenbank stattfindet - genau das Szenario, das
  // zuvor Snapshot und Anker auseinanderdriften ließ.
  mgr._writeAuditLog('waehrend_oder_nach_dem_backup', 'dev-y', '127.0.0.1', 'ok');
  await mgr.stop();

  const restoreTarget = tmp('gfn02-restored.sqlite');
  restoreDatabase(backupPath, restoreTarget);
  const mgrRestored = new ManagerCompanion({ dbPath: restoreTarget });
  await mgrRestored.start();

  const result = mgrRestored.verifyAuditChain();
  const entryCount = mgrRestored.auditLog().length;
  console.log('Ergebnis:', JSON.stringify(result), '| Einträge in der wiederhergestellten Datenbank:', entryCount);
  await mgrRestored.stop();

  if (result.ok === true && entryCount === 1) {
    console.log('GF-N02: BESTANDEN (Snapshot und Anker passen zusammen, enthalten exakt den Stand zum Backup-Zeitpunkt)');
  } else {
    console.log('GF-N02: NICHT BESTANDEN - erwartet { ok: true } und genau 1 Eintrag, erhalten:', JSON.stringify(result), 'Einträge:', entryCount);
    failures++;
  }
}

(async () => {
  await gfN01();
  await gfN02();
  console.log('\n=== Gesamtergebnis ===');
  if (failures === 0) {
    console.log('Beide Gegenproben BESTANDEN.');
    process.exitCode = 0;
  } else {
    console.log(`${failures} von 2 Gegenproben NICHT bestanden.`);
    process.exitCode = 1;
  }
})().catch((err) => {
  console.error('Unerwarteter Fehler beim Ausführen der Gegenprobe:', err);
  process.exitCode = 1;
});
