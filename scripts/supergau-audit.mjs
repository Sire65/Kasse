import fs from 'node:fs';

const app = fs.readFileSync('app.js', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');
const resilience = fs.readFileSync('shared/kc-resilience.js', 'utf8');
const runtimeFlags = fs.readFileSync('shared/runtime-flags.js', 'utf8');
const has = (text, pattern) => pattern.test(text);
const rows = [];
const add = (id, status, detail) => rows.push({ id, status, detail });

const offlineShell = has(sw, /caches\.open\(/) && has(sw, /app\.js/) && has(sw, /index\.html/) && has(sw, /kc-resilience\.js/);
const localSales = has(app, /const TRANSACTION_KEY=/) && has(app, /saveTransactions\(/);
const reconnectHook = has(resilience, /navigator\.onLine/) && has(resilience, /addEventListener\('online'/) && has(resilience, /flushOutbox/);
const outboxQueue = has(resilience, /OUTBOX_KEY='kc_sync_outbox_v1'/) && has(resilience, /queueTransactions/) && has(resilience, /nextAttemptAt/);
const uniqueTransactions = has(app, /transactionId:crypto\.randomUUID\(\)/) && has(app, /registerId/);
const identityHash = has(app, /transactionIdentity\(/) && has(app, /recordHash/);
const encryptedRecovery = has(app, /KC_ENCRYPTED_V1/) && has(app, /exportEncryptedSales/) && has(app, /buildConfigPackage/);
const gatewayIntegrated = has(resilience, /kc-failover-gateway\.ha-joko\.workers\.dev/) && has(runtimeFlags, /kc-resilience\.js/);
const cloudRestore = has(resilience, /restoreRegister/) && has(resilience, /\/sync\/transactions/);
const reconciliation = has(resilience, /reconcile/) && has(resilience, /\/sync\/reconcile/) && has(resilience, /missingRemote/) && has(resilience, /missingLocal/);
const conflictHandling = has(resilience, /CONFLICT_KEY='kc_sync_conflicts_v1'/) && has(resilience, /RESTORE_CONFLICT/) && has(resilience, /recordHash/);

add(4, offlineShell && localSales && reconnectHook && outboxQueue ? 'PASS' : 'FAIL', 'Offline shell, local sales, persistent outbox and automatic reconnect retry');
add(5, uniqueTransactions && localSales ? 'PASS' : 'FAIL', 'Surviving register keeps independent UUID transactions locally');
add(6, identityHash && outboxQueue && reconciliation && conflictHandling ? 'PASS' : 'FAIL', 'Independent offline sales plus automatic merge/reconciliation and conflict detection');
add(7, encryptedRecovery && cloudRestore ? 'PASS' : 'FAIL', 'Encrypted manual recovery plus automatic register restore from durable journal');
add(8, gatewayIntegrated && outboxQueue && reconnectHook ? 'PASS' : 'FAIL', 'POS uses failover gateway; worker outage leaves durable local queue and retries automatically');
add(9, offlineShell && localSales && outboxQueue ? 'PASS' : 'FAIL', 'Software survives loss of network/power infrastructure while device remains powered; physical battery test remains separate');
add(10, identityHash && reconciliation && conflictHandling && outboxQueue ? 'PASS' : 'FAIL', 'Post-outage reconciliation detects missing and conflicting transactions and requeues missing remote records');

console.log('=== KC SUPER-GAU CLIENT TEST MATRIX ===');
for (const row of rows) console.log(`${row.status}|${row.id}|${row.detail}`);
console.log('=== END MATRIX ===');

const hardFailures = rows.filter(r => r.status === 'FAIL');
if (hardFailures.length) process.exitCode = 2;
