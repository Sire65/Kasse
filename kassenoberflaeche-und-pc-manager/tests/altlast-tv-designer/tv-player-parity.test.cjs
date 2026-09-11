const fs = require('fs'), assert = require('assert');
const html = fs.readFileSync('tv-player/index.html', 'utf8');
const parity = fs.readFileSync('tv-player/tv-object-parity-v1.js', 'utf8');
const appjs = fs.readFileSync('tv-player/app.js', 'utf8');
const tableExt = fs.readFileSync('tv-player/table-object-extension.js', 'utf8');
const managerApp = fs.readFileSync('pc-manager/app.js', 'utf8');
const exportCenter = fs.readFileSync('pc-manager/tv-export-center-extension.js', 'utf8');
const styles = fs.readFileSync('tv-player/styles.css', 'utf8');

// Player lädt die Paritäts-Erweiterung und das DisplayMatrix-Modul.
assert(html.includes('tv-object-parity-v1.js'), 'Paritäts-Erweiterung nicht im Player eingebunden');
assert(html.includes('display-matrix-module.js'), 'DisplayMatrix-Modul nicht im Player eingebunden');

// Beide Manager-Exportfunktionen erzeugen dasselbe, vom Player akzeptierte Schema.
assert(managerApp.includes('schema:TV_SCHEMA'), 'exportTvPackage() erzeugt kein Schema-Feld mehr');
assert(exportCenter.includes(`schema:'kcm-tv-package-v2'`), 'tvPackage() erzeugt nicht mehr das kompatible Schema');
assert(appjs.includes('"kcm-tv-package-v2"'), 'Player akzeptiert das Schema kcm-tv-package-v2 nicht (mehr)');

// Programmarchiv-Daten werden für den dynamischen Ticker mitexportiert.
assert(managerApp.includes('eventProgramSnapshot'), 'exportTvPackage() liefert keine Programm-Zusammenfassung mehr');
assert(exportCenter.includes('eventProgramSnapshot'), 'tvPackage() liefert keine Programm-Zusammenfassung mehr');

// Tabellen-Erweiterung liest die tatsächlich gesetzte Variable.
assert(tableExt.includes('window.currentTvSlideData'), 'Tabellen-Erweiterung liest wieder eine falsche Variable');

// Dynamischer Ticker: LED-/LCD-Matrix muss denselben aufgelösten Text bekommen wie
// der normale Ticker, nicht erneut slide.ticker direkt (Regressionsschutz für den
// von Codex gefundenen Bug: Wetter-/Programmtext ging in der Matrix verloren).
assert(/function applyMatrix\(ticker, slide, text\)/.test(parity), 'applyMatrix() nimmt den aufgelösten Text nicht mehr entgegen');
assert(!/function applyMatrix[\s\S]{0,400}slide\.ticker/.test(parity), 'applyMatrix() liest slide.ticker wieder direkt statt den aufgelösten Text zu nutzen');
assert(parity.includes('applyMatrix(ticker, slide, tickerText)'), 'enhance() reicht den aufgelösten Ticker-Text nicht an applyMatrix() weiter');

// Erste Folie beim Seitenstart (gespeichertes Paket) darf nicht ohne Medien/
// Wetter/Rahmen/Matrix bleiben, nur weil app.js vor dieser Datei show() aufruft.
assert(/if\s*\(\s*window\.currentTvSlideData\s*\)\s*enhance\(\)/.test(parity), 'Erste Folie beim Seitenstart wird nicht sofort nachträglich angereichert');

// Medien (Bild/Video), Wetterkarten und Objekt-Rahmen sind im Player vorhanden.
assert(parity.includes('ensureMedia'), 'Medien-Darstellung (Bild/Video) fehlt im Player');
assert(parity.includes('ensureWeather'), 'Wetterkarten-Darstellung fehlt im Player');
assert(parity.includes('applyObjectStyles'), 'Objekt-Rahmen/Sichtbarkeit fehlt im Player');
assert(styles.includes('.tv-slide-media'), 'CSS für importierte Medien fehlt im Player');

// Große Importe (z.B. Videos) dürfen bei überschrittenem Speicherlimit die
// Wiedergabe nicht mehr komplett blockieren, nur die dauerhafte Speicherung.
assert(/try\s*\{\s*localStorage\.setItem\(KEY,JSON\.stringify\(d\)\)\s*\}\s*catch/.test(appjs), 'localStorage-Fehler beim Import blockiert wieder die gesamte Wiedergabe');
assert(/let persisted=true;try\{localStorage\.setItem\(KEY,JSON\.stringify\(d\)\)\}catch\(storageErr\)\{persisted=false\}/.test(appjs), 'Wiedergabe läuft bei Speicherfehler nicht trotzdem im aktuellen Speicher weiter');
assert(/catch\(storageErr\)\{persisted=false\}[\s\S]{0,600}show\(\)\}catch\(err\)/.test(appjs), 'show() wird nach einem Speicherfehler nicht mehr aufgerufen');

console.log('PASS tv-player-parity: Schema-Kompatibilität, dynamischer Ticker in der Matrix, Sofort-Anreicherung beim Start, Medien/Wetter/Rahmen vorhanden, Speicherfehler blockiert Wiedergabe nicht mehr');
