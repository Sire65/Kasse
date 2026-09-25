const fs=require('fs');
const path=require('path');

function read(rel){return fs.readFileSync(path.join(__dirname,'..',rel),'utf8');}
function ok(cond,msg){if(!cond)throw new Error(msg);}

const html=read('money-butler/index.html');
const auth=read('money-butler/kc-auth.js');
const app=read('money-butler/app.js');
const bridge=read('money-butler/kc-communicator-bridge.js');
const intake=read('pc-manager/kc-money-butler-cloud-intake.js');

ok(html.includes('V0.27.0'),'Produktiver Money Butler muss V0.27.0 sein');
ok(html.includes('kc-auth.js?build=0.27.0'),'Produktiver Auth-Build nicht aktuell');
ok(html.indexOf('kc-auth.js?build=0.27.0')<html.indexOf('app.js'),'Auth muss vor app.js geladen werden');
ok(html.includes('mbAuthActivateToggle'),'Erstzugang fehlt');
ok(html.includes('Auf diesem Gerät angemeldet bleiben'),'Persistente Anmeldung fehlt');

for(const legacy of [
  'kc_money_butler_communication_token_v1',
  'Zugriffstoken des Kassenwarts',
  'handoverCommToken',
  'commTokenSave',
  'id="commToken"'
]){
  ok(!html.includes(legacy)&&!auth.includes(legacy)&&!app.includes(legacy)&&!bridge.includes(legacy),'Legacy-Token-Rest gefunden: '+legacy);
}

ok(auth.includes('kc-money-butler-account-bootstrap'),'Sicherer Account-Bootstrap fehlt');
ok(auth.includes('async function signUp'),'Erstzugang-Registrierung fehlt');
ok(bridge.includes("sourceProgram:SOURCE"),'KC-Communicator-Quelle fehlt');
ok(bridge.includes("'kc-money-butler'"),'Money-Butler Source-ID fehlt');
ok(intake.includes('pending_manager'),'PC-Manager Cloud-Eingang fehlt');

console.log('Money Butler Konsolidierung: 14/14 Schutzprüfungen bestanden');
