import fs from 'node:fs';

const app = fs.readFileSync('app.js', 'utf8');
const sw = fs.readFileSync('service-worker.js', 'utf8');
const has = (text, pattern) => pattern.test(text);
const rows = [];
const add = (id, status, detail) => rows.push({ id, status, detail });

const offlineShell = has(sw, /caches\.open\(/) && has(sw, /app\.js/) && has(sw, /index\.html/);
const localSales = has(app, /const TRANSACTION_KEY=/) && has(app, /saveTransactions\(/);
const reconnectHook = has(app, /navigator\.onLine|pendingSync|syncQueue|outbox|reconcile/i);
const uniqueTransactions = has(app, /transactionId:crypto\.randomUUID\(\)/) && has(app, /registerId/);
const identityHash = has(app, /transactionIdentity\(/) && has(app, /recordHash/);
const encryptedRecovery = has(app, /KC_ENCRYPTED_V1/) && has(app, /exportEncryptedSales/) && has(app, /buildConfigPackage/);
const gatewayIntegrated = has(app, /kc-failover-gateway|workers\.dev/i);
const cloudRestore = has(app, /restoreFromCloud|downloadSnapshot|cloud restore/i);

add(4, offlineShell && localSales ? (reconnectHook ? 'PASS' : 'PARTIAL') : 'FAIL', reconnectHook ? 'Offline operation and reconnect hooks found' : 'Offline shell/local sales found; automatic reconnect upload queue not found');
add(5, uniqueTransactions && localSales ? 'PASS' : 'FAIL', 'Surviving register can keep independent UUID transactions');
add(6, identityHash && localSales ? (reconnectHook ? 'PASS' : 'PARTIAL') : 'FAIL', reconnectHook ? 'Offline identities plus reconciliation hooks found' : 'Local identities/hashes exist; automatic merge/reconciliation not found');
add(7, encryptedRecovery ? (cloudRestore ? 'PASS' : 'PARTIAL') : 'FAIL', cloudRestore ? 'Automatic replacement-device restore found' : 'Encrypted manual recovery exists; automatic current-state restore not found');
add(8, gatewayIntegrated ? 'PARTIAL' : 'FAIL', gatewayIntegrated ? 'Gateway reference exists; bypass behavior still requires runtime test' : 'Failover gateway is not integrated into POS runtime');
add(9, offlineShell && localSales ? 'PASS' : 'FAIL', 'Software side can run cached and persist sales locally; battery/power hardware needs physical test');
add(10, identityHash && reconnectHook ? 'PASS' : 'FAIL', reconnectHook ? 'Automated reconciliation hooks found' : 'Identity/hash exist but automatic post-outage reconciliation path not found');

console.log('=== KC SUPER-GAU CLIENT TEST MATRIX ===');
for (const row of rows) console.log(`${row.status}|${row.id}|${row.detail}`);
console.log('=== END MATRIX ===');

const hardFailures = rows.filter(r => r.status === 'FAIL');
if (hardFailures.length) process.exitCode = 2;
