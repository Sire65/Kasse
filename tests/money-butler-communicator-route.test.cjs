const fs=require('fs');
const path=require('path');

function read(rel){return fs.readFileSync(path.join(__dirname,'..',rel),'utf8');}
function ok(cond,msg){if(!cond)throw new Error(msg);}

const mbHtml=read('money-butler/index.html');
const mbBridge=read('money-butler/kc-communicator-bridge.js');
const managerHtml=read('pc-manager/index.html');
const managerApp=read('pc-manager/app.js');
const defs=read('pc-manager/kc-communication-adapters.js');

ok(mbHtml.includes('Über KC Communicator an PC-Manager'),'Money Butler Communicator button missing');
ok(mbHtml.includes('kc-communication-client.js'),'Money Butler communication client not loaded');
ok(mbHtml.includes('kc-communicator-bridge.js'),'Money Butler bridge not loaded');
ok(mbHtml.includes('V0.24.0'),'Money Butler version not current');

ok(mbBridge.includes("sourceProgram:SOURCE"),'Money Butler source program missing');
ok(mbBridge.includes("'kc-money-butler'"),'Money Butler source id missing');
ok(mbBridge.includes("emitEvent('cash_transfer_ready'"),'cash_transfer_ready event missing');
ok(mbBridge.includes('uploadAttachment(file'),'Money Butler .kccash attachment upload missing');
ok(mbBridge.includes("handoverRoute:'money-butler->kc-communicator->pc-manager'"),'handover route marker missing');
ok(mbBridge.includes("payload.scope==='split'||payload.scope==='shared'"),'shared/split target routing missing');
ok(mbBridge.includes("?Array.from(payload.registerIds||[])"),'multi-register target ids missing');
ok(!/mailto:/i.test(mbBridge),'Money Butler must not bypass KC Communicator with mailto');
ok(!/smtp/i.test(mbBridge),'Money Butler must not contain SMTP delivery');

ok(defs.includes("cash_transfer_ready:{required:['registerId','amount'],recipient:'central'}"),'central cash_transfer_ready definition missing');

ok(managerHtml.includes('KC Communicator Eingang'),'PC Manager Communicator intake missing');
ok(managerHtml.includes('communicatorCashFile'),'PC Manager communicator file input missing');
ok(managerApp.includes('decodeCommunicatorCashFile'),'PC Manager communicator cash validation missing');
ok(managerApp.includes('queueCashTransferPayload'),'PC Manager cash forward helper missing');
ok(managerApp.includes('127.0.0.1:8543/api/v1/cash-transfer/queue'),'PC Manager must forward through existing local cash queue');
ok(managerApp.includes('Vom KC Communicator übernommen'),'PC Manager communicator acceptance status missing');

console.log('Money Butler Communicator route: 20/20 checks passed');
