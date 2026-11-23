/* KC-FERNMODUS-PLATZ (20.11.2026, Wunsch Hansi): Der gelbe Entwicklungs-Hinweis unten rechts darf die
 * Fernmodus-Meldung nicht verdecken – sie rückt darüber. Ohne Browser geprüft (Quelltext + kleiner DOM-Nachbau). */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const W = path.join(__dirname, '..');
const lies = (p) => fs.readFileSync(path.join(W, p), 'utf8');
let ok = 0;
const p = (name, b) => { assert.ok(b, name); ok++; console.log('  OK  ' + name); };

const fern = lies('pc-manager/kc-fernmodus.js');
const dev = lies('pc-manager/dev-quick-access.js');
const html = lies('pc-manager/index.html');
p('Fernmodus richtet sich nach jedem Zeichnen neu aus', /el\.innerHTML = inhalt;\n\s*bannerPlatz\(\);/.test(fern));
p('Fernmodus hört auf das Hinweis-Signal', fern.includes("addEventListener('kc-hinweis-unten-rechts', bannerPlatz)"));
p('Entwicklungs-Hinweis meldet sich beim Erscheinen', dev.includes("dispatchEvent(new CustomEvent('kc-hinweis-unten-rechts'))"));
p('Build-Kennungen erhöht', html.includes('kc-fernmodus.js?build=1.0.2') && html.includes('dev-quick-access.js?build=0.29.20'));
p('Schnellzugang bleibt nur per Doppelklick und ohne Speicherung', dev.includes("addEventListener('dblclick'") && !/localStorage|sessionStorage/.test(dev.split('/* Zusatzmodule')[0]));

// bannerPlatz im Nachbau ausführen
const fn = fern.match(/  function bannerPlatz\(\) \{[\s\S]*?\n  \}\n/)[0];
const banner = { style: { bottom: '12px' } };
let hinweis = null;
const document = { getElementById: (id) => (id === 'kcFernmodusBanner' ? banner : id === 'devQuickAccessBadge' ? hinweis : null) };
const bannerPlatz = new Function('document', fn + 'return bannerPlatz;')(document);
bannerPlatz(); p('ohne Hinweis bleibt die Meldung unten (12px)', banner.style.bottom === '12px');
hinweis = { hidden: false, offsetHeight: 62 }; bannerPlatz();
p('mit Hinweis rückt die Meldung darüber', banner.style.bottom === '86px');
hinweis.hidden = true; bannerPlatz(); p('Hinweis weg → Meldung wieder unten', banner.style.bottom === '12px');
console.log(`fernmodus-platz: ${ok} Prüfungen OK`);
