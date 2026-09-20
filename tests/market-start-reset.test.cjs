const fs=require('fs');
function ok(v,msg){if(!v)throw new Error(msg);}
const html=fs.readFileSync('market-start-reset/index.html','utf8');
const js=fs.readFileSync('market-start-reset/app.js','utf8');
const manager=fs.readFileSync('pc-manager/index.html','utf8');
const pos=fs.readFileSync('pos/index.html','utf8');
const mb=fs.readFileSync('money-butler/index.html','utf8');

for(const marker of ['MARKTSTART 2026','previewBtn','executeBtn','Geschützte Datenbereiche']){
  ok(html.includes(marker),'HTML-Marker fehlt: '+marker);
}
for(const marker of ['POS_KEYS','MANAGER_KEYS','PROTECTED_KEYS','clearTxStores','kc_pos_transactions_v1','market_start_local_reset','kc_market_start_local_audit_v1']){
  ok(js.includes(marker),'Reset-Marker fehlt: '+marker);
}
for(const marker of ['kc_transactions_v040','kc_closings','kcm_closings','kcm_cashcounts','kcm_sales']){
  ok(js.includes(marker),'Bewegungs-Key fehlt: '+marker);
}
for(const protectedKey of ['kc_products_v050','kc_groups_v050','kc_master_v040','kcm_articles','kcm_accounts','kc_cash_measure_settings_v1']){
  ok(js.includes(protectedKey),'Geschützter Key fehlt aus Schutzliste: '+protectedKey);
}

const posBlock=(js.match(/const POS_KEYS=\[([\s\S]*?)\];/)||[])[1]||'';
const managerBlock=(js.match(/const MANAGER_KEYS=\[([\s\S]*?)\];/)||[])[1]||'';
for(const forbidden of ['kc_products_v050','kc_groups_v050','kc_master_v040','kcm_articles','kcm_accounts','kc_cash_measure_settings_v1']){
  ok(!posBlock.includes(forbidden)&&!managerBlock.includes(forbidden),'Geschützter Key steht in Löschliste: '+forbidden);
}
ok(js.includes("if(!previewReady||$('confirmText').value!==CONFIRM)return"),'Vorschau-/Bestätigungsschutz fehlt');
ok(js.includes("CONFIRM='MARKTSTART 2026'"),'Exakter Bestätigungstext fehlt');
ok(js.includes("createObjectStore('transactions'"),'POS IndexedDB-Schema-Schutz fehlt');
ok(js.includes("createObjectStore('trainingTransactions'"),'Training IndexedDB-Schema-Schutz fehlt');
ok(manager.includes("../market-start-reset/?source=manager"),'Manager-Link fehlt');
ok(pos.includes("../market-start-reset/?source=pos"),'POS-Link fehlt');
ok(mb.includes("../market-start-reset/?source=money-butler"),'Money-Butler-Link fehlt');
ok(!manager.includes('</button>\\n'), 'Manager enthält versehentlich literales \\n');
ok(!mb.includes('</button>\\n'), 'Money Butler enthält versehentlich literales \\n');

console.log('KC Marktstart 2026 Local Reset Regression: PASS');
