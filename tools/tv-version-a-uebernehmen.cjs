#!/usr/bin/env node
/* Weihnachtsmarkt-Präsentation „Version A“ (Mitglieder-Umfrage Sept. 2026: 7 von 12 Stimmen für A)
 * als eingebaute Fernseher-Präsentation in die Kasse übernehmen.
 *
 * Quelle: index.html aus dem GitHub-Repo Sire65/WM-Pr-s. (eine einzige, eigenständige HTML-Datei).
 * Ziel:   tv-player/weihnachtsmarkt-2026-version-a.html
 *
 * Für den Fernseher am Stand werden drei kleine Stellen angepasst (nur wenn die Seite mit
 * ?fernseher=1 geöffnet wird – auf GitHub Pages und im normalen Browser bleibt alles wie bisher):
 *   1. Auf der Schlussfolie NICHT anhalten (die Pause war nur für die Umfrage gedacht),
 *      die Präsentation läuft in Dauerschleife weiter.
 *   2. Bedienleiste, „Fertig – zur Umfrage“-Knopf und Build-Hinweis ausblenden.
 *   3. Kein Mauszeiger.
 *   4. Keine im Browser gespeicherte Präsentation übernehmen (gleicher Speicherschlüssel wie der TV-Designer).
 *
 * Aufruf:  node tools/tv-version-a-uebernehmen.cjs <Pfad zur index.html von WM-Pr-s.>
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ZIEL = path.join(__dirname, '..', 'tv-player', 'weihnachtsmarkt-2026-version-a.html');

// Am Fernseher NIE eine im Browser gespeicherte Präsentation nehmen: der TV-Designer der Kasse
// speichert unter demselben Schlüssel (fs3.kcTvPresentation) auf derselben Adresse.
const FERNSEHMODUS_KOPF = '<script>window.KC_FERNSEHMODUS=/[?&]fernseher=1(&|$)/.test(location.search);'
  + "if(window.KC_FERNSEHMODUS){document.documentElement.classList.add('kcFernsehmodus');"
  + "try{var kcGet=Storage.prototype.getItem;Storage.prototype.getItem=function(k){return k==='fs3.kcTvPresentation'?null:kcGet.call(this,k)}}catch(e){}}</script>"
  + '<style>.kcFernsehmodus #tvControls,.kcFernsehmodus #tvBigDone,.kcFernsehmodus #kcBuildLabel{display:none!important}'
  + '.kcFernsehmodus,.kcFernsehmodus *{cursor:none!important}</style>';

const ERSETZUNGEN = [
  { name: 'Fernsehmodus-Schalter im Kopf',
    alt: '<meta charset="utf-8">',
    neu: '<meta charset="utf-8">' + FERNSEHMODUS_KOPF },
  { name: 'Schlussfolie hält am Fernseher nicht an', optional: true, // in der Endversion schon entfernt
    alt: 'if(isLast&&playing)tvTogglePause();',
    neu: 'if(isLast&&playing&&!window.KC_FERNSEHMODUS)tvTogglePause();' },
  { name: 'Build-Hinweis ausblendbar',
    alt: '<div style="position:fixed;right:28px;bottom:28px;z-index:99999;',
    neu: '<div id="kcBuildLabel" style="position:fixed;right:28px;bottom:28px;z-index:99999;' },
];

function uebernehmen(html) {
  if (html.includes('KC_FERNSEHMODUS')) throw new Error('Die Quelle ist bereits angepasst – bitte die Original-index.html aus WM-Pr-s. nehmen.');
  for (const e of ERSETZUNGEN) {
    const anzahl = html.split(e.alt).length - 1;
    if (anzahl === 0 && e.optional) continue;
    if (anzahl !== 1) throw new Error(`Stelle „${e.name}“ ${anzahl}× statt 1× gefunden – Quelle hat sich geändert, bitte das Werkzeug anpassen.`);
    html = html.replace(e.alt, () => e.neu);
  }
  return html;
}

if (require.main === module) {
  const quelle = process.argv[2];
  if (!quelle) { console.error('Aufruf: node tools/tv-version-a-uebernehmen.cjs <index.html von WM-Pr-s.>'); process.exit(1); }
  const html = uebernehmen(fs.readFileSync(quelle, 'utf8'));
  fs.writeFileSync(ZIEL, html);
  console.log(`Version A übernommen: ${path.relative(process.cwd(), ZIEL)} (${(html.length / 1048576).toFixed(1)} MB)`);
}

module.exports = { uebernehmen, ZIEL };
