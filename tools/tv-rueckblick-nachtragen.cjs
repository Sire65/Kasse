#!/usr/bin/env node
/* Neue Rückblick-Fotos (media/rueckblick/) in eine schon gebaute Präsentation nachtragen, ohne Neubau aus WM-Pr-s.
 * Macht dasselbe wie der Schritt im Bauwerkzeug (tools/tv-endversion-bauen.cjs): neue Rückblick-Folie(n) einsetzen,
 * Bildunterschriften neu zählen, Durchgänge neu festlegen (je Durchgang ein Rückblick-Foto) und den Spruch-Plan neu
 * berechnen. Mehrfach aufrufen schadet nicht.
 *
 * Aufruf: node tools/tv-rueckblick-nachtragen.cjs [datei.html]   (Vorgabe: tv-player/weihnachtsmarkt-2026-version-a.html)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { rueckblickEinbauen, rueckblickFotos, durchgaengeFestlegen } = require('./tv-endversion-bauen.cjs');

const datei = process.argv[2] || path.join(__dirname, '..', 'tv-player', 'weihnachtsmarkt-2026-version-a.html');
let html = fs.readFileSync(datei, 'utf8');
const anfang = 'window.KC_DESIGNER_MARKET_PRESENTATION=';
const a = html.indexOf(anfang);
const e = html.indexOf('};', a);
if (a < 0 || e < 0 || html.indexOf(anfang, a + 1) > -1) throw new Error('Projektdaten nicht eindeutig gefunden.');
const projekt = JSON.parse(html.slice(a + anfang.length, e + 1).replace(/\bB\[(\d+)\]/g, '"@@B$1@@"'));
const log = [];
rueckblickEinbauen(projekt, log, rueckblickFotos());
durchgaengeFestlegen(projekt, log);
html = html.slice(0, a + anfang.length) + JSON.stringify(projekt).replace(/"@@B(\d+)@@"/g, 'B[$1]') + html.slice(e + 1);
fs.writeFileSync(datei, html);
log.forEach((z) => console.log('  ' + z));
console.log(`Geschrieben: ${path.resolve(datei)} (${(html.length / 1048576).toFixed(1)} MB)`);
