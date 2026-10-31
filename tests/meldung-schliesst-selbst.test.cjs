// 09.10.2026 (Betreiber: "Meldungen nach der Buchung sollen von alleine weggehen" - "Bau ein in beide"):
// Rückgeld, Personal, Helfer und Konto stehen als ruhige Statusmeldung ohne Dialog;
// die Auszahlung bleibt stehen. Im Browser in Kasse und Schulung geprueft (auch: Auszahlung direkt nach
// einem selbst schliessenden Fenster bleibt offen).
const fs = require('fs'), assert = require('assert'), vm = require('vm');
for (const pfad of ['pos/app.js', 'schulung/pos/app.js']) {
  const s = fs.readFileSync(pfad, 'utf8');
  const hints=[];
  const begin=s.indexOf('function showMessageAuto('),end=s.indexOf('\nfunction showMessage(',begin);
  const context={setSystemHint:(...args)=>hints.push(args),showMessage:()=>{throw Error('Erfolgreiche Buchung darf kein Dialogfenster öffnen')}};
  vm.runInNewContext(s.slice(begin,end)+';showMessageAuto("Rückgeld","2,00 €","Bon gespeichert");',context);
  assert(hints.length===1&&hints[0][0].includes('2,00 €')&&hints[0][1]==='ok',pfad+': Erfolg nicht als ruhige Statusmeldung angezeigt');
  assert(s.includes('function showMessage(t,v,txt){{const d=el("messageDialog");if(d){d._kcAuto=null;'), pfad + ': normale Meldung beendet den Zeitgeber nicht');
  for (const t of ['type==="personal")showMessageAuto(', 'type==="helfer")showMessageAuto(', 'requireChangeFlow===true)showMessageAuto(', 'else showMessageAuto(training?"Training abgeschlossen":"Verkauf abgeschlossen"', 'showMessageAuto("Auf Konto gebucht"'])
    assert(s.includes(t), pfad + ': ' + t);
  assert(s.includes('else if(isPayout)showMessage(training?"Training abgeschlossen":"Auszahlung"'), pfad + ': Auszahlung darf nicht von allein schliessen');
}
console.log('meldung-schliesst-selbst: ok');
