/* KC-TV-HINTERGRUND (20.11.2026, Wunsch Hansi): Windows-Hintergrund am Stand-PC/Fernseher = Rathaus-Bild der
 * Präsentation statt Windows-Standardbild. Ohne Windows geprüft (Quelltext). */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const W = path.join(__dirname, '..');
const lies = (p) => fs.readFileSync(path.join(W, p), 'utf8');
let ok = 0;
const p = (name, b) => { assert.ok(b, name); ok++; console.log('  OK  ' + name); };

const ps = lies('tools/kc-tv-hintergrund.ps1');
const cmd = lies('KC_MiniPC_Einrichten.cmd');
const bild = 'media/backgrounds/rathaus-werne-weihnachtsmarkt-v2.jpg';
p('Rathaus-Bild der Präsentation liegt im Paket', fs.statSync(path.join(W, bild)).size > 100000);
p('dasselbe Bild nutzt die Präsentation', lies('tools/tv-endversion-bauen.cjs').includes('rathaus-werne-weihnachtsmarkt-v2.jpg'));
p('Skript nimmt dieses Bild', ps.includes("'media\\backgrounds\\rathaus-werne-weihnachtsmarkt-v2.jpg'"));
p('Bild wird außerhalb des Kassen-Ordners abgelegt (überlebt neue ZIP)', ps.includes("$env:LOCALAPPDATA 'KC-MarktKasse'"));
p('Hintergrund wird dauerhaft gesetzt (SPI 20, Flags 3)', ps.includes('SystemParametersInfo(20, 0, $datei, 3)'));
p('Ausfüllen statt Kacheln', ps.includes("WallpaperStyle -Value '10'") && ps.includes("TileWallpaper -Value '0'"));
p('keine Adminrechte, nur aktueller Benutzer (HKCU)', !/HKLM|RunAs|Start-Process/.test(ps));
p('Einrichtung ruft das Skript auf, Fehler werden gemeldet', cmd.includes('-File "%~dp0tools\\kc-tv-hintergrund.ps1" || set "KC_FEHLER=1"'));
p('Einrichtung zählt 4 Schritte', (cmd.match(/\[\d\/4\]/g) || []).length === 4 && !cmd.includes('/3]'));
p('Einrichtung bleibt CRLF', /\r\n/.test(cmd) && !/[^\r]\n/.test(cmd));
p('Skript-Here-String korrekt geschlossen', /@'\r?\n[\s\S]*\r?\n'@/.test(ps));
console.log(`tv-hintergrund: ${ok} Prüfungen OK`);
