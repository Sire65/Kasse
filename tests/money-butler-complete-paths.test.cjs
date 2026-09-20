const fs=require('fs');
const path=require('path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const ok=(v,m)=>{if(!v)throw new Error(m);};

const mbHtml=read('money-butler/index.html');
const mbApp=read('money-butler/app.js');
const mbComm=read('money-butler/kc-communicator-bridge.js');
const mgrHtml=read('pc-manager/index.html');
const mgrApp=read('pc-manager/app.js');
const cloud=read('pc-manager/kc-money-butler-cloud-intake.js');
const pos=read('pos/app.js');
const direct=read('pos/kc-sync-cash-transfer.js');
const finance=read('pos/kc-finance-transfer-kasse.js');
const financeTrain=read('schulung/pos/kc-finance-transfer-kasse.js');
const notifier=read('pc-manager/kc-cash-confirmation-notifier.js');
const companion=read('markt-kasse-suite/backend-source/manager-companion/index.js');

for(const method of ['qr','shortcode','file','communicator'])ok(mbHtml.includes(`data-handover-method="${method}"`),'Money Butler method missing: '+method);
ok(mbHtml.includes('Übergabe vorbereiten'),'Preparation button missing');
ok(mbHtml.includes('handoverConfirmationWanted'),'Confirmation checkbox missing');
ok(mbApp.includes('payload.confirmationRequested=true'),'Confirmation flag missing');
ok(mbApp.includes('confirm.disabled=method==="shortcode"'),'Shortcode confirmation must remain disabled');

ok(mbComm.includes('cashPayload:payload'),'Communicator must carry structured KCASH1 payload');
ok(mbComm.includes("emitEvent('cash_transfer_ready'"),'Communicator ready event missing');
ok(mbComm.includes('uploadAttachment(file'),'Communicator .kccash fallback attachment missing');

ok(mgrHtml.includes('incomingCashCode'),'Manager QR/KCASH1 intake missing');
ok(mgrHtml.includes('incomingCashShortCode'),'Manager shortcode intake missing');
ok(mgrHtml.includes('communicatorCashFile'),'Manager file intake missing');
ok(mgrApp.includes('decodeCommunicatorCashFile'),'Manager full payload validation missing');
ok(mgrApp.includes('decodeIncomingCashShortCode'),'Manager shortcode validation missing');
ok(mgrApp.includes('queueCashTransferPayload'),'Manager common forwarding path missing');
ok(mgrApp.includes('payload.confirmationRequested===true'),'Confirmation routing missing');
ok(mgrApp.includes('/api/v1/finance-transfer/queue'),'Finance queue missing');
ok(mgrApp.includes('/api/v1/cash-transfer/queue'),'Normal queue missing');
ok(mgrApp.includes('payload.scope==="split"||payload.scope==="shared"'),'Multi-register routing missing');

ok(cloud.includes("action:'cash_transfer_list'"),'Automatic KC Communicator/Finance Bridge pickup missing');
ok(cloud.includes("['pending_manager','manager_received']"),'Crash-safe cloud status pickup missing');
ok(cloud.includes("action:'cash_transfer_mark'"),'Cloud status marking missing');
ok(cloud.includes("'handed_to_register'"),'Cloud handed-to-register mark missing');
ok(cloud.includes('queueCashTransferPayload(payload)'),'Cloud intake must reuse Manager queue path');
ok(cloud.includes("p.format!=='KC_CASH_TRANSFER'"),'Cloud payload format validation missing');
ok(cloud.includes('Prüfsumme der Cloud-Geldübergabe ist falsch'),'Cloud checksum validation missing');

ok(pos.includes('return applyCashPayload(text,"manual-shortcode")'),'POS shortcode must reuse applyCashPayload');
ok(pos.includes('rejected-duplicate'),'POS duplicate guard missing');
ok(pos.includes('rejected-wrong-register'),'POS register guard missing');
ok(pos.includes('rejected-wrong-effective-date'),'POS date guard missing');
ok(direct.includes("applyCashPayload(codeText, 'manager-direct')"),'Normal Manager delivery must reuse applyCashPayload');

ok(finance.includes('function betragFuerKasse'),'Finance split calculation missing');
ok(finance.includes("payload?.amount ?? payload?.total"),'Finance amount compatibility missing');
ok(finance.includes("payload?.businessDate || payload?.effectiveDate"),'Finance date compatibility missing');
ok(finance.includes("Betrag für diese Kasse ist ungültig"),'Finance invalid-share guard missing');
ok(finance.includes("'cash_transfer_confirmed'"),'Finance confirmation event missing');
ok(finance===financeTrain,'Live/training Finance Bridge must stay identical');

ok(companion.includes("INSERT INTO cash_transfer_queue"),'Companion normal queue missing');
ok(companion.includes("INSERT INTO finance_bridge_transfers"),'Companion finance queue missing');
ok(companion.includes("UPDATE finance_bridge_transfers SET delivered = 1"),'Finance ACK missing');
ok(notifier.includes("b.confirmationRequested!==true"),'Push must only be sent on request');
ok(notifier.includes("channels:['push']"),'Push channel missing');
ok(notifier.includes("recipientLabels:['Kassenwart','Admin']"),'Kassenwart/Admin recipients missing');
ok(notifier.includes('SENT_KEY'),'Notifier duplicate guard missing');

console.log('Money Butler complete transfer paths: 43/43 checks passed');
