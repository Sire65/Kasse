#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const here = __dirname;
const checks = [];
function check(id, ok, detail, severity='REQUIRED') {
  checks.push({ id, ok: Boolean(ok), severity, detail });
}
function file(name) { return fs.existsSync(path.join(here, name)); }
function https(value) { return /^https:\/\//i.test(String(value || '').trim()); }

check('device-companion-source', file('device-companion.js'), 'device-companion.js vorhanden');
check('manager-companion-source', file('manager-companion.js'), 'manager-companion.js vorhanden');
check('runtime-telemetry', file('kicc-runtime-telemetry.js'), 'KICC Runtime-Telemetrie vorhanden');
check('device-runner', file('run-device-companion.js'), 'Bilderkassen-Runner vorhanden');
check('manager-runner', file('run-manager-service.js'), 'PC-Manager-Runner vorhanden');
check('heartbeat-endpoint', https(process.env.KICC_PROGRAM_HEARTBEAT_ENDPOINT), 'HTTPS Heartbeat-Endpoint konfiguriert');
check('heartbeat-auth', Boolean(process.env.KICC_PROGRAM_HEARTBEAT_AUTHORIZATION), 'Heartbeat-Authorization gesetzt');
check('flow-endpoint', https(process.env.KICC_PROGRAM_FLOW_ENDPOINT), 'HTTPS Flow-Endpoint konfiguriert');
check('flow-auth', Boolean(process.env.KICC_PROGRAM_FLOW_AUTHORIZATION || process.env.KICC_PROGRAM_HEARTBEAT_AUTHORIZATION), 'Flow-Authorization gesetzt');
check('kasse-version', Boolean(process.env.KC_KASSE_VERSION), 'KC_KASSE_VERSION gesetzt', 'RECOMMENDED');
check('manager-version', Boolean(process.env.KC_PC_MANAGER_VERSION), 'KC_PC_MANAGER_VERSION gesetzt', 'RECOMMENDED');

const missingRequired = checks.filter(x => x.severity === 'REQUIRED' && !x.ok);
const missingRecommended = checks.filter(x => x.severity === 'RECOMMENDED' && !x.ok);
const sourceMissing = checks.filter(x => ['device-companion-source','manager-companion-source'].includes(x.id) && !x.ok);
const status = missingRequired.length === 0 ? 'READY' : sourceMissing.length ? 'BLOCKED' : 'PREPARED';
const report = {
  schema: 'KC_MARKTKASSE_KICC_READINESS_V1',
  measuredAt: new Date().toISOString(),
  status,
  productionRootTouched: false,
  checks,
  missingRequired: missingRequired.map(x => x.id),
  missingRecommended: missingRecommended.map(x => x.id),
  nextAction: sourceMissing.length
    ? 'Fehlende Companion-Quelldateien aus dem Originalpaket restaurieren.'
    : missingRequired.length
      ? 'Endpoint/Auth-Konfiguration ergänzen und erneut prüfen.'
      : 'Heartbeat- und Flow-Ende-zu-Ende-Test durchführen.'
};
console.log(JSON.stringify(report, null, 2));
process.exitCode = status === 'READY' ? 0 : status === 'PREPARED' ? 1 : 2;
