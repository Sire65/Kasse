const fs=require('fs');
const path=require('path');
function read(p){return fs.readFileSync(path.join(__dirname,'..',p),'utf8');}
function ok(v,msg){if(!v)throw new Error(msg);}

const app=read('money-butler/app.js');
const html=read('money-butler/index.html');
const bridge=read('money-butler/kc-communicator-bridge.js');
const intake=read('pc-manager/kc-money-butler-cloud-intake.js');
const manager=read('pc-manager/app.js');

const expected=['value:2,grams:8.50','value:1,grams:7.50','value:.5,grams:7.80','value:.2,grams:5.74','value:.1,grams:4.10','value:.05,grams:3.92','value:.02,grams:3.06','value:.01,grams:2.30'];
const settingsSource=read('shared/kc-cash-measure-settings.js');
for(const marker of expected) ok(settingsSource.includes(marker),'Offizielles Münzgewicht fehlt: '+marker);
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

const sharedSettings=read('shared/kc-cash-measure-settings.js');
const closingUi=read('shared/kc-closing-count-ui.js');
const posIndex=read('pos/index.html');
const trainingIndex=read('schulung/pos/index.html');
const companionDb=read('markt-kasse-suite/backend-source/manager-companion/db.js');
const companion=read('markt-kasse-suite/backend-source/manager-companion/index.js');
const closingMgr=read('pc-manager/kc-abschluesse-manager.js');

ok(html.includes('id="settingsBtn"'),'Zahnrad/Voreinstellungen fehlt');
for(const tab of ['coins','rolls','notes','tests']) ok(html.includes('data-settings-tab="'+tab+'"'),'Einstellungsreiter fehlt: '+tab);
ok(html.includes('data-entry-mode="count"')&&html.includes('data-entry-mode="weigh"'),'Frontschalter Zählen/Wiegen fehlt');
ok(sharedSettings.includes("const KEY='kc_cash_measure_settings_v1'"),'Gemeinsamer Bargeld-Voreinstellungsschlüssel fehlt');
ok(sharedSettings.includes("{value:2,grams:8.50"),'Offizieller 2-Euro-Standard fehlt im gemeinsamen Modul');
ok(sharedSettings.includes("grams:null"),'Optionale eigene Rollen-/Scheingewichte fehlen');
ok(app.includes('runConnectionTests'),'Testcenter-Logik fehlt');
for(const label of ['Datenbank / KC Cloud','KC Communicator','PC Manager / Finance Bridge','KC Verwaltung / Tagesabschlüsse']) ok(app.includes(label),'Testcenter-Prüfung fehlt: '+label);
for(const idx of [posIndex,trainingIndex]){
  ok(idx.includes('data-closing-count-mode="defer"'),'Kassenabschluss Option Später fehlt');
  ok(idx.includes('data-closing-count-mode="count"'),'Kassenabschluss Option Zählen fehlt');
  ok(idx.includes('data-closing-count-mode="weigh"'),'Kassenabschluss Option Wiegen fehlt');
}
ok(closingUi.includes("format:'KC_CASH_COUNT'"),'Separate Ist-Zählung aus Kassenabschluss fehlt');
ok(closingUi.includes("measurements:data.measurements"),'Rohmesswerte werden nicht übertragen');
ok(companionDb.includes("cash_count_json"),'Companion speichert Ist-Zählung nicht getrennt');
ok(companion.includes("cashCount:"),'Companion liefert Ist-Zählung nicht an PC Manager');
ok(closingMgr.includes("ingestCashCountPayload?.(abschluss.cashCount"),'PC Manager übernimmt Kassen-Ist-Zählung nicht automatisch');
