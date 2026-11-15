/* KS-01 – Bausteine des Kassen-Starts ohne Netzwerk: Kassenliste lesen, PC-Adresse wählen. */
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { leseKassenKonfig, waehleLanAdresse } = require(path.join(__dirname, '..', 'markt-kasse-suite', 'backend-source', 'kassen-start.js'));
let ok = 0, rot = 0;
const p = (n, b, z = '') => { b ? ok++ : rot++; console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '   [' + z + ']' : ''}`); };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-ks01-'));
const datei = (inhalt) => { const f = path.join(dir, `k${Math.random().toString(36).slice(2)}.json`); fs.writeFileSync(f, inhalt); return f; };
const wirft = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };

// Kassenliste
const echt = leseKassenKonfig(path.join(__dirname, '..', 'markt-kasse-suite', 'backend-source', 'markttag-kassen.json'));
p('ausgelieferte Liste: drei Kassen KASSE-01..03 (eine als schneller Ersatz)', echt.kassen.map((k) => k.id).join(',') === 'KASSE-01,KASSE-02,KASSE-03');
p('alte Form ["KASSE-01","KASSE-02"] wird weiter verstanden', leseKassenKonfig(datei('["KASSE-01","KASSE-02"]')).kassen.length === 2);
p('Datei mit BOM (Windows-Editor) wird verstanden', leseKassenKonfig(datei('﻿["KASSE-01"]')).kassen.length === 1);
p('fehlende Datei = keine Tablet-Kassen, kein Absturz', leseKassenKonfig(path.join(dir, 'gibtsnicht.json')).kassen.length === 0);
p('feste PC-Adresse kann eingetragen werden', leseKassenKonfig(datei('{"kassen":["KASSE-01"],"pcAdresse":"192.168.178.20"}')).pcAdresse === '192.168.178.20');
p('kaputtes JSON: verständliche Meldung mit Beispiel', /kein gültiges JSON.*Beispiel/.test(wirft(() => leseKassenKonfig(datei('["KASSE-01",]'))) || ''));
p('doppelte Kasse wird abgelehnt', /doppelt/.test(wirft(() => leseKassenKonfig(datei('["KASSE-01","kasse-01"]'))) || ''));
p('ungültige Kassen-ID wird abgelehnt', /keine gültige Kassen-ID/.test(wirft(() => leseKassenKonfig(datei('["KASSE 01"]'))) || ''));
p('ungültige PC-Adresse wird abgelehnt', /keine IPv4/.test(wirft(() => leseKassenKonfig(datei('{"kassen":["KASSE-01"],"pcAdresse":"fritz.box"}'))) || ''));

// PC-Adresse
const netz = (liste) => Object.fromEntries(liste.map(([name, adresse]) => [name, [{ family: 'IPv4', internal: false, address: adresse }]]));
const pc = netz([['vEthernet (WSL)', '172.25.16.1'], ['WLAN', '192.168.178.20'], ['Ethernet 2', '169.254.3.4']]);
p('WLAN-Adresse wird vor virtuellen Adaptern (WSL/Hyper-V) gewählt', waehleLanAdresse({ netze: pc }).adresse === '192.168.178.20', waehleLanAdresse({ netze: pc }).adresse);
p('Adresse der gedruckten Zettel wird bevorzugt, solange der PC sie hat', waehleLanAdresse({ netze: netz([['LAN', '192.168.178.30'], ['WLAN', '192.168.178.20']]), zettelAdresse: '192.168.178.20' }).adresse === '192.168.178.20');
const geaendert = waehleLanAdresse({ netze: pc, zettelAdresse: '192.168.178.99' });
p('PC hat andere Adresse als die Zettel: Warnung mit beiden Adressen und Abhilfe',
  /PC-ADRESSE HAT SICH GEÄNDERT/.test(geaendert.warnung) && /192\.168\.178\.99/.test(geaendert.warnung) && /DHCP-Reservierung/.test(geaendert.warnung));
p('kein Netzwerk: klare Warnung statt Adresse 127.0.0.1', waehleLanAdresse({ netze: {} }).adresse === null && /Keine WLAN/.test(waehleLanAdresse({ netze: {} }).warnung));
p('fest eingestellte, aber fremde Adresse wird gemeldet', /gehört zu keiner Netzwerkkarte/.test(waehleLanAdresse({ fest: '10.0.0.5', netze: pc }).warnung || ''));

fs.rmSync(dir, { recursive: true, force: true });
console.log(`\nKassen-Start Bausteine (KS-01): ${ok}/${ok + rot} bestanden`);
process.exit(rot ? 1 : 0);
