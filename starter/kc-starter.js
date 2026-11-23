#!/usr/bin/env node
'use strict';
// KC MarktKasse - Starter. Wird von KC_Manager_Start.cmd / KC_Zuhause_Start.cmd aufgerufen.
//
//   node kc-starter.js installieren --quelle <entpackter ZIP-Ordner> --ziel C:\KC-Kasse [--modus stand|zuhause]
//   node kc-starter.js start --modus stand|zuhause [weitere Argumente für das Programm]
//   node kc-starter.js status
//
// Ablauf beim Start: 1) alte Anordnung umziehen (einmalig)  2) neue Version laden, wenn erlaubt (Marktsperre!)
// 3) Programm starten  4) meldet es sich nicht „bereit“, zurück auf die vorige Version  5) ohne Internet: vorhandene Version.
const fs = require('fs');
const path = require('path');
const K = require('./kc-paket');

const R = path.resolve(process.env.KC_INSTALL_DIR || path.join(__dirname, '..'));

function log(t) { console.log(`[KC Starter] ${t}`); }
function kasten(titel, zeilen) {
  console.log('');
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.log(` ${titel}`);
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  for (const z of zeilen) console.log(` ${z}`);
  console.log('');
}
function args(argv) {
  const o = { rest: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--quelle') o.quelle = argv[++i];
    else if (a === '--ziel') o.ziel = argv[++i];
    else if (a === '--modus') o.modus = argv[++i];
    else if (a === '--zuhause') o.modus = 'zuhause';
    else if (a === '--ohne-update') o.ohneUpdate = true;
    else if (a === '--open-manager') { /* setzt der Starter selbst */ }
    else o.rest.push(a);
  }
  if (o.modus !== 'zuhause') o.modus = 'stand';
  return o;
}
function statusSchreiben(extra) {
  const st = K.leseJson(K.datenDatei('update-stand.json'), {}) || {};
  K.schreibeJson(K.datenDatei('update-stand.json'), { ...st, ...extra });
}

// Wartet auf Tastendruck (nur in einem echten Fenster), damit Fehlermeldungen lesbar bleiben.
function tasteDruecken(text = 'Zum Schließen eine Taste drücken.') {
  if (!process.stdin.isTTY || process.env.KC_KEINE_PAUSE) return Promise.resolve();
  console.log(text);
  return new Promise((ok) => {
    try { process.stdin.setRawMode(true); } catch (e) { /* */ }
    process.stdin.resume(); process.stdin.once('data', () => { try { process.stdin.setRawMode(false); } catch (e) { /* */ } process.stdin.pause(); ok(); });
  });
}

async function installieren(o) {
  const quelle = path.resolve(o.quelle || path.join(__dirname, '..'));
  const ziel = path.resolve(o.ziel || R);
  log(`Installation aus ${quelle}`);
  log(`Ziel: ${ziel}`);
  fs.mkdirSync(ziel, { recursive: true });
  const gleich = quelle.toLowerCase() === ziel.toLowerCase();
  if (!gleich) {
    K.alteAnordnungAufraeumen(ziel, log);                         // vorher alte Anordnung im Ziel umziehen
    // War der entpackte Ordner selbst schon in Betrieb (alte Anordnung mit Datenbank), dessen Daten übernehmen.
    K.datenUmziehen(path.join(quelle, 'markt-kasse-suite', 'backend-source'), log);
  }
  const liste = K.installiereAus({ quelle, R: ziel, log });
  if (gleich) K.alteAnordnungAufraeumen(ziel, log);               // ZIP direkt in C:\KC-Kasse entpackt
  K.verknuepfungenEinrichten(ziel, o.modus, log);
  statusSchreiben({ installiert: new Date().toISOString(), programm: liste.version, installOrdner: ziel });
  log(`Fertig installiert (Version ${liste.version}). Ab jetzt immer über die Verknüpfung auf dem Desktop starten.`);
  return 0;
}

function pruefeInstallation() {
  const P = K.pfade(R);
  const skript = path.join(P.aktuell, 'markt-kasse-suite', 'backend-source', 'run-manager-service.js');
  if (fs.existsSync(skript)) return null;
  if (fs.existsSync(path.join(P.vorher, 'markt-kasse-suite', 'backend-source', 'run-manager-service.js'))) {
    K.zurueckfallen(R, 'Programmordner „aktuell“ unvollständig', log);
    return fs.existsSync(skript) ? null : 'Programmordner fehlt';
  }
  return 'Programmordner fehlt';
}

async function starten(o) {
  console.log('==============================================================');
  console.log(` KC MARKTKASSE - ${o.modus === 'zuhause' ? 'PC-MANAGER ZU HAUSE' : 'START AM STAND'}`);
  console.log('==============================================================');
  // 1) Einmaliger Umzug aus der alten Anordnung (alles direkt in C:\KC-Kasse)
  try { K.alteAnordnungAufraeumen(R, log); } catch (e) { log(`Hinweis beim Umzug: ${e.message}`); }
  const fehlt = pruefeInstallation();
  if (fehlt) {
    kasten('PROGRAMM FEHLT', [`Im Ordner ${R}\\programm\\aktuell liegt kein KC-Programm.`,
      'Lösung: Die ZIP neu herunterladen, entpacken und dort KC_Manager_Start.cmd doppelklicken -',
      'das Programm wird dann automatisch nach C:\\KC-Kasse installiert.']);
    await tasteDruecken(); return 1;
  }
  // 2) Update
  let upd = { aktualisiert: false, hinweis: 'Update übersprungen' };
  if (!o.ohneUpdate) {
    log('Suche nach neuer Version …');
    upd = await K.aktualisieren({ R, modus: o.modus, log });
    if (upd.aktualisiert) log(`Neue Version: ${upd.hinweis}`);
    else if (upd.verfuegbar) log(`Neue Version ${upd.fern} liegt bereit – ${upd.hinweis}`);
    else log(upd.hinweis === 'aktuell' ? `Programm ist aktuell (${upd.lokal}).` : upd.hinweis);
  }
  // 3) Starten, 4) bei Fehlschlag nach einem Update zurückfallen
  let lauf = await einmalStarten(o);
  if (!lauf.bereit && upd.aktualisiert) {
    beenden(lauf.kind);
    kasten('NEUE VERSION STARTET NICHT', ['Es wird automatisch die vorige Version gestartet.', 'Die neue Version wird übersprungen, bis eine reparierte erscheint.']);
    if (K.zurueckfallen(R, lauf.grund || 'nicht bereit', log)) {
      const zweiter = await einmalStarten(o);
      if (!zweiter.bereit) {
        // Auch die vorige Version startet nicht -> es liegt nicht an der Version (z. B. Port belegt). Neue Version wiederherstellen.
        beenden(zweiter.kind);
        rueckfallZuruecknehmen(); lauf = await einmalStarten(o);
      } else lauf = zweiter;
    }
  }
  statusSchreiben({ letzterStart: new Date().toISOString(), letzterStartBereit: !!lauf.bereit, programm: (K.lokaleListe(R) || {}).version || null });
  const ende = await lauf.ende;
  const code = ende.code == null ? 1 : ende.code;
  if (code !== 0) {
    console.log('');
    console.log(`Das Programm wurde mit Fehlercode ${code} beendet. Ursache und Lösung stehen oben im Kasten mit den Ausrufezeichen.`);
    await tasteDruecken();
  }
  return code;
}

function beenden(kind) { try { if (kind && kind.exitCode == null) kind.kill(); } catch (e) { /* */ } }

function rueckfallZuruecknehmen() {
  const P = K.pfade(R);
  if (!fs.existsSync(P.defekt)) return;
  K.umbenennen(P.aktuell, P.vorher); K.umbenennen(P.defekt, P.aktuell);
  K.starterUndStartdateienErneuern(R, log);
  const st = K.leseJson(K.datenDatei('update-stand.json'), {}) || {};
  const v = (K.lokaleListe(R) || {}).version;
  st.defekteVersionen = (st.defekteVersionen || []).filter((x) => x !== v);
  st.letzterRueckfall = null;
  K.schreibeJson(K.datenDatei('update-stand.json'), st);
  log('Auch die vorige Version startet nicht – der Fehler liegt nicht an der Version. Die neue Version bleibt.');
}

async function einmalStarten(o) {
  const lauf = K.programmStarten({ R, modus: o.modus, args: o.rest, bereitZeitMs: Number(process.env.KC_BEREIT_ZEIT_MS) || 240000 });
  const b = await lauf.bereit;
  let grund = '';
  if (!b.bereit) grund = b.zeitueberschreitung ? 'keine Bereit-Meldung in der Wartezeit' : (b.fehler || `beendet mit Code ${b.code}`);
  return { bereit: b.bereit, grund, kind: lauf.kind, ende: lauf.ende };
}

async function main() {
  const [befehl, ...rest] = process.argv.slice(2);
  const o = args(rest);
  // Strg+C beendet das Programm (gleiches Fenster) - der Starter wartet dessen Ende ab.
  process.on('SIGINT', () => {});
  try {
    if (befehl === 'installieren') return await installieren(o);
    if (befehl === 'start') return await starten(o);
    if (befehl === 'status') { console.log(JSON.stringify(K.leseJson(K.datenDatei('update-stand.json'), {}), null, 2)); return 0; }
    console.log('Aufruf: kc-starter.js start --modus stand|zuhause  |  installieren --quelle <Ordner> --ziel <Ordner>');
    return 2;
  } catch (e) {
    kasten('STARTER-FEHLER', [String(e && e.message || e), '', 'Lösung: Fenster schließen und erneut starten. Bleibt der Fehler:',
      'Foto von diesem Fenster an den Betreuer schicken.']);
    await tasteDruecken();
    return 1;
  }
}

if (require.main === module) main().then((c) => process.exit(c));
module.exports = { main, args };
