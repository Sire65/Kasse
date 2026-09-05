const fs = require('fs');
const assert = require('assert');
const css = fs.readFileSync('pc-manager/styles.css','utf8');

// Grundlegender Fund beim Selbstbau-Test: .tv-preview-content bekam durch
// transform:scale(var(--tv-scale,1)) einen neuen CSS-Bezugsrahmen für seine
// absolut positionierten Kinder (Titel/Text/Preis/Laufschrift/Wetter/Banner/Form).
// Da --tv-scale in einer früheren Reparatur bereits fest auf 1 gesetzt wurde,
// hatte diese Transform keinen sichtbaren Nutzen mehr, löste aber weiterhin den
// CSS-Nebeneffekt aus: der Textbereich schrumpfte auf Null zusammen (keine
// Kinder mehr im normalen Fluss), wodurch alle Prozent-Positionen relativ zu
// einem winzigen, falschen Bezugsrahmen berechnet wurden statt zur Folie -
// freie Positionierung hatte dadurch nie eine sichtbare Wirkung.
assert(css.includes('.tv-preview-content[data-tv-object="content"]{position:absolute!important;inset:0!important;transform:none!important'),
  'Der Bezugsrahmen-Fix für die bearbeitbare Ansicht fehlt - freie Positionierung von Text/Laufschrift/Wetter/Banner/Form würde nicht wirken');
// Die einfache Miniaturansicht (ohne data-tv-object="content") darf weiterhin die alte Transform behalten
assert(css.includes('.tv-preview-content{transform:scale(var(--tv-scale,1));transform-origin:center}'),
  'Miniaturansicht darf durch den Fix nicht verändert werden');

console.log('PASS kc-object-studio-positioning-fix: Bezugsrahmen für freie Positionierung korrekt, Miniaturansicht unverändert');
