// 4G-Zähler am Stand: Einrichten (erst testen, dann speichern), Lesen, Weitergabe an die Stand-Brücke, nie das Passwort.
const fs = require('fs'), os = require('os'), path = require('path');
const { RouterZaehler } = require('../markt-kasse-suite/backend-source/router-zaehler.js');
let fehler = 0; const ok = (b, t, z = '') => { console.log(`${b ? 'OK    ' : 'FEHLER'} ${t}${z ? '  [' + z + ']' : ''}`); if (!b) fehler++; };
const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-router-'));
class FakeRouter {
  constructor(o) { this.o = o; FakeRouter.letzte = o; }
  async anmelden() { if (this.o.passwort !== 'richtig') throw new Error('Anmeldung am Router abgelehnt: Passwort falsch'); }
  async datenverbrauch() { return { gesamtBytes: 2144000000, aktuellBytes: 100, limitBytes: null, limitAktiv: false, signal: 3, anbieter: 'o2 - de', roh: 'x' }; }
  async abmelden() { FakeRouter.abgemeldet = true; }
}
(async () => {
  const z = new RouterZaehler({ datenOrdner: ordner, Router: FakeRouter, log: () => {} });
  ok(!z.eingerichtet() && z.kurz() === null, 'Ohne Einrichtung: nichts eingerichtet, nichts an die Brücke');
  let f = null; try { await z.einrichten({ passwort: 'falsch', volumenGB: 100 }); } catch (e) { f = e.message; }
  ok(/Passwort falsch/.test(f || '') && !fs.existsSync(path.join(ordner, 'router-zugang.json')), 'Falsches Passwort: klare Meldung, nichts gespeichert', f);
  const s = await z.einrichten({ passwort: 'richtig', volumenGB: '100' });
  ok(s.eingerichtet && s.letzter.gesamtBytes === 2144000000, 'Richtiges Passwort: getestet, gespeichert, Zähler gelesen');
  ok(FakeRouter.abgemeldet === true, 'Nach dem Lesen am Router abgemeldet');
  ok(!JSON.stringify(z.status()).includes('richtig') && !JSON.stringify(z.kurz()).includes('richtig'), 'Status/Brücke enthalten nie das Passwort');
  const k = z.kurz(); ok(k.volumenGB === 100 && k.gesamtBytes === 2144000000 && k.anbieter === 'o2 - de', 'Kurzfassung für zu Hause vollständig', JSON.stringify(k));
  // Stand-Brücke nimmt den Zähler in "info" mit
  const { StandBruecke } = require('../markt-kasse-suite/backend-source/stand-bruecke.js');
  const sb = Object.create(StandBruecke.prototype); sb.version = 't'; sb.manager = {}; sb.zustand = { rueckstand: 0 }; sb.routerZaehler = z;
  ok(sb._info().router && sb._info().router.gesamtBytes === 2144000000, 'Stand-Brücke meldet den 4G-Verbrauch nach Hause');
  z.volumenSetzen(50); ok(z.kurz().volumenGB === 50, 'Datenvolumen änderbar');
  z.entfernen(); ok(!z.eingerichtet() && !fs.existsSync(path.join(ordner, 'router-zugang.json')), 'Entfernen löscht das gespeicherte Passwort');
  z.stop(); fs.rmSync(ordner, { recursive: true, force: true });
  console.log(fehler ? `\n${fehler} FEHLER` : '\nRouter-Zähler: alles bestanden'); process.exit(fehler ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
