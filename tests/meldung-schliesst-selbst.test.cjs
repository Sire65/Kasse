// 09.10.2026 (Betreiber: "Meldungen nach der Buchung sollen von alleine weggehen" - "Bau ein in beide"):
// Rueckgeld, Personal, Helfer und Konto schliessen nach 4 Sekunden (gruene Leiste), Fertig sofort;
// die Auszahlung bleibt stehen. Im Browser in Kasse und Schulung geprueft (auch: Auszahlung direkt nach
// einem selbst schliessenden Fenster bleibt offen).
const fs = require('fs'), assert = require('assert');
for (const pfad of ['pos/app.js', 'schulung/pos/app.js']) {
  const s = fs.readFileSync(pfad, 'utf8');
  assert(s.includes('function showMessageAuto(t,v,txt,sekunden=4){'), pfad + ': showMessageAuto fehlt');
  assert(s.includes('function showMessage(t,v,txt){{const d=el("messageDialog");if(d){d._kcAuto=null;'), pfad + ': normale Meldung beendet den Zeitgeber nicht');
  for (const t of ['type==="personal")showMessageAuto(', 'type==="helfer")showMessageAuto(', 'requireChangeFlow===true)showMessageAuto(', 'else showMessageAuto(training?"Training abgeschlossen":"Verkauf abgeschlossen"', 'showMessageAuto("Auf Konto gebucht"'])
    assert(s.includes(t), pfad + ': ' + t);
  assert(s.includes('else if(isPayout)showMessage(training?"Training abgeschlossen":"Auszahlung"'), pfad + ': Auszahlung darf nicht von allein schliessen');
}
console.log('meldung-schliesst-selbst: ok');
