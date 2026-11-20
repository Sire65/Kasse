'use strict';
// Einmaliges Prüfprogramm: Kann der Mini-PC den Datenzähler des TP-Link-Routers lesen?
// Start über KC_Router_Pruefen.cmd. Ergebnis: router-pruefung.txt im KC-Ordner (OHNE Passwort).
const fs = require('fs'), path = require('path'), readline = require('readline');
const { TpLinkMr } = require('./router-mr');

function frage(text, verdeckt = false) {
  return new Promise((ok) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (verdeckt) { rl._writeToOutput = (s) => { if (s.includes(text)) rl.output.write(text); else rl.output.write('*'); }; }
    rl.question(text, (a) => { rl.close(); if (verdeckt) process.stdout.write('\n'); ok(a); });
  });
}
const gb = (b) => (b === null || b === undefined || Number.isNaN(b)) ? '–' : (b / 1e9).toFixed(3).replace('.', ',') + ' GB';

(async () => {
  const zeilen = []; const log = (t) => { zeilen.push(t); console.log(t); };
  console.log('\nKC MarktKasse – Router prüfen (TP-Link Archer MR200)\n');
  const adresse = (await frage('Router-Adresse [192.168.1.1]: ')).trim() || '192.168.1.1';
  const passwort = await frage('Router-Admin-Passwort (wird nicht angezeigt und nirgends gespeichert): ', true);
  log(`Zeit: ${new Date().toISOString()}  Router: ${adresse}  Node: ${process.version}`);
  const r = new TpLinkMr({ adresse, passwort, protokoll: log });
  try {
    await r.anmelden();
    const d = await r.datenverbrauch();
    log('');
    log(`ERGEBNIS: Gesamtverbrauch ${gb(d.gesamtBytes)} · aktuell ${gb(d.aktuellBytes)} · Limit ${d.limitAktiv ? gb(d.limitBytes) : 'aus'} · Signal ${d.signal ?? '–'} · Anbieter ${d.anbieter ?? '–'}`);
    log('--- Rohantwort Datenzähler ---'); log(d.roh);
    // Zur Sicherheit alle Felder der beiden Bereiche (falls die Feldnamen bei dieser Firmware anders heißen)
    const alle = await r.abfrage([{ oid: 'WAN_LTE_INTF_CFG', stack: '2,0,0,0,0,0', attrs: [] }, { oid: 'LTE_NET_STATUS', stack: '2,1,0,0,0,0', attrs: [] }]);
    log('--- Alle Felder ---'); log(alle.text);
  } catch (e) {
    log('');
    log('FEHLER: ' + e.message);
  } finally {
    try { await r.abmelden(); } catch (e) { /* */ }
  }
  const datei = path.join(process.cwd(), 'router-pruefung.txt');
  fs.writeFileSync(datei, zeilen.join('\r\n') + '\r\n', 'utf8');
  console.log(`\nGespeichert: ${datei}\nDiese Datei bitte an Claude schicken (sie enthält KEIN Passwort).`);
})();
