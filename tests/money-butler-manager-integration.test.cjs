const fs=require('fs');
const path=require('path');

function read(p){return fs.readFileSync(path.join(__dirname,'..',p),'utf8');}
function ok(v,msg){if(!v)throw new Error(msg);}

const manager=read('pc-manager/index.html');
const mb=read('money-butler/index.html');

ok(manager.includes('data-view="cashprep">Money Butler</button>'),'Money-Butler Menüpunkt fehlt im PC-Manager');
ok(manager.includes('id="moneyButlerIntegrated"'),'Eingebetteter Money Butler fehlt');
ok(manager.includes('src="../money-butler/index.html"'),'PC-Manager nutzt nicht die aktuelle gemeinsame Money-Butler-App');
ok(manager.includes('Manager-Notfallwerkzeug / bisherige Bargeldmaske'),'Bestehender Manager-Fallback wurde nicht erhalten');
ok(manager.includes('Money-Butler Eingang'),'Money-Butler Eingang im PC-Manager fehlt');
ok(manager.includes('id="incomingCashCode"'),'QR/KCASH1-Eingang fehlt');
ok(manager.includes('id="incomingCashShortCode"'),'Kurzcode-Eingang fehlt');
ok(manager.includes('id="communicatorCashFile"'),'Datei/KC-Communicator-Eingang fehlt');

for(const label of ['Gestern','Heute','Morgen','Übergabe vorbereiten']){
  ok(mb.includes(label),'Neue Money-Butler-Funktion fehlt: '+label);
}
for(const method of ['qr','shortcode','file','communicator']){
  ok(mb.includes(`data-handover-method="${method}"`),'Übergabeweg fehlt: '+method);
}
ok(mb.includes('id="handoverConfirmationWanted"'),'Bestätigungsabfrage fehlt im gemeinsamen Money Butler');
ok(mb.includes('Bestätigung anfordern, dass das Geld angekommen ist'),'Bestätigungstext fehlt');

console.log('PC-Manager nutzt den neuen gemeinsamen Money Butler inklusive 4 Übergabewegen und Bestätigung: OK');
