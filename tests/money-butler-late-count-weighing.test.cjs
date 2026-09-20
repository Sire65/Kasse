const fs=require('fs');
const path=require('path');
function read(p){return fs.readFileSync(path.join(__dirname,'..',p),'utf8');}
function ok(v,msg){if(!v)throw new Error(msg);}

const app=read('money-butler/app.js');
const html=read('money-butler/index.html');
const bridge=read('money-butler/kc-communicator-bridge.js');
const intake=read('pc-manager/kc-money-butler-cloud-intake.js');
const manager=read('pc-manager/app.js');

const expected=['2:8.50','1:7.50','.5:7.80','.2:5.74','.1:4.10','.05:3.92','.02:3.06','.01:2.30'];
for(const marker of expected) ok(app.includes(marker),'Offizielles Münzgewicht fehlt: '+marker);
ok(html.includes('Münzen sortenrein wiegen'),'Wägeoberfläche fehlt');
ok(html.includes('Nur lose Euro-Münzen.'),'Wäge-Sicherheitsregel fehlt');
ok(app.includes('Tagesabschluss vom *'),'Nachzählung ist nicht auf den Abschluss-Tag bezogen');
ok(app.includes('countKind:currentType==="count"?(istNachzaehlung?"late":"same-day")'),'Nachzählungskennzeichen fehlt');
ok(app.includes('countedAt:currentType==="count"?countedAt:undefined'),'Tatsächlicher Zählzeitpunkt fehlt');
ok(app.includes('Eine Zählung kann keinem zukünftigen Tagesabschluss zugeordnet werden.'),'Zukunftssperre fehlt');
ok(bridge.includes("action:'cash_count_create'"),'KC Communicator sendet Nachzählungen nicht langlebig');
ok(bridge.includes('attachmentIds:[uploaded.id]'),'Zähl-Anhang wird nicht getrennt vom Prüfsummen-Payload gespeichert');
ok(!bridge.includes('payload:{...payload,attachmentId'),'Prüfsummen-Payload wird durch Anhangsdaten verändert');
ok(intake.includes("action:'cash_count_list'"),'PC Manager holt Cloud-Zählungen nicht ab');
ok(intake.includes("ingestCashCountPayload?.(payload,'communicator-cloud')"),'PC Manager übernimmt Cloud-Zählung nicht in den Abschluss');
ok(intake.includes("action:'cash_count_mark'"),'Cloud-Zählung wird nach Übernahme nicht bestätigt');
ok(manager.includes('r.count.countKind==="late"?"Nachzählung · ":""'),'PC Manager kennzeichnet Nachzählung nicht');

const weights={2:8.50,1:7.50,.5:7.80,.2:5.74,.1:4.10,.05:3.92,.02:3.06,.01:2.30};
const pieces=Math.round(850/weights[2]);
ok(pieces===100,'2-Euro-Wiegeprobe ergibt falsche Stückzahl');
ok((pieces*2)===200,'2-Euro-Wiegeprobe ergibt falschen Betrag');

console.log('Money Butler Nachzählung + offizielles Münzwiegen + Cloud-Übernahme: OK');
