const fs=require('fs'),assert=require('assert');

const manager=fs.readFileSync('pc-manager/app.js','utf8');
const posSync=fs.readFileSync('pos/kc-sync-master-data.js','utf8');
const trainingSync=fs.readFileSync('schulung/pos/kc-sync-master-data.js','utf8');
const pos=fs.readFileSync('pos/app.js','utf8');
const managerCompanion=fs.readFileSync('markt-kasse-suite/backend-source/manager-companion/index.js','utf8');
const managerDb=fs.readFileSync('markt-kasse-suite/backend-source/manager-companion/db.js','utf8');
const deviceCompanion=fs.readFileSync('markt-kasse-suite/backend-source/device-companion/index.js','utf8');
const deviceDb=fs.readFileSync('markt-kasse-suite/backend-source/device-companion/db.js','utf8');

assert(manager.includes('name:"Stadtmarketing Werne"'),'Managerkonto Stadtmarketing Werne fehlt');
assert(manager.includes('body: JSON.stringify({ groups, articles, packages: [], accounts, settings })'),'Manager-Push sendet accounts nicht');
assert(manager.includes('groups,articles,accounts}'),'kcpos-Export enthält accounts nicht');

for(const [name,code] of [['POS',posSync],['Schulung',trainingSync]]){
  assert(code.includes("localStorage.setItem('kc_account_master_v029', konten)"),name+' schreibt nicht in den von AUF KONTO gelesenen Schlüssel');
}
assert(pos.includes('const KC_ACCOUNT_KEY="kc_account_master_v029"'),'Kontofunktion liest unerwarteten Schlüssel');
assert(pos.includes('allowedGroups:["Speisen","Getränke"]'),'Stadtmarketing-Fallback erlaubt Speisen/Getränke nicht');

// 28.09.2026: Die Schemata wurden bewusst weiterentwickelt (Manager d84dde7 -> 25, 8efec99 -> 26,
// c446534 -> 27; Device 5d0d61f -> 11). Geprueft wird deshalb die Mindestversion, ab der accounts_json
// existiert (Manager >= 24, Device >= 10) - accounts_json selbst wird unten weiterhin verlangt.
const schema=(code)=>{const m=/const\s+SCHEMA_VERSION\s*=\s*(\d+)\s*;/.exec(code);return m?Number(m[1]):0;};
assert(schema(managerDb)>=24,'Manager-DB Schema >= 24 fehlt (gefunden: '+schema(managerDb)+')');
assert(managerDb.includes('accounts_json'),'Manager-DB accounts_json fehlt');
assert(managerCompanion.includes('const accounts = Array.isArray(body?.accounts) ? body.accounts : []'),'Manager-Companion nimmt accounts nicht an');
assert(managerCompanion.includes('accounts_json'),'Manager-Companion persistiert/liefert accounts nicht');

assert(schema(deviceDb)>=10,'Device-DB Schema >= 10 fehlt (gefunden: '+schema(deviceDb)+')');
assert(deviceDb.includes('accounts_json'),'Device-Cache accounts_json fehlt');
assert(deviceCompanion.includes('JSON.stringify(antwort.accounts || [])'),'Device-Companion cached accounts nicht');
assert(deviceCompanion.includes("accounts: (() => { try { return JSON.parse(zeile.accounts_json || '[]'); } catch (e) { return []; } })()"),'Device-Loopback liefert accounts nicht');

console.log('PASS account-masterdata-path: Manager -> Manager Companion -> Device Companion -> AUF KONTO');
