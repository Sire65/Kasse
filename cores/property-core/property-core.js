/* PropertyCore V0.2.0 – object-to-property routing without legacy tab clicks */
(function (w) {
  'use strict';
  const definitions = Object.freeze({
    slide: { label: 'Folie bearbeiten', group: 'slide' },
    title: { label: 'Überschrift bearbeiten', group: 'text' },
    text: { label: 'Textbox bearbeiten', group: 'text' },
    price: { label: 'Preis bearbeiten', group: 'text' },
    ticker: { label: 'Laufschrift bearbeiten', group: 'ticker' },
    symbols: { label: 'Symbole bearbeiten', group: 'symbols' },
    weather: { label: 'Wetterkarten bearbeiten', group: 'weather' },
    banner: { label: 'Banner bearbeiten', group: 'banner' },
    shape: { label: 'Form bearbeiten', group: 'shape' },
    image: { label: 'Bild bearbeiten', group: 'image' },
    table: { label: 'Tabelle bearbeiten', group: 'table' }
  });
  function describe(key) { return definitions[key] || definitions.slide; }
  function open(key) {
    const definition = describe(key);
    const title = document.getElementById('tvContextTitle');
    const hint = document.getElementById('tvContextHint');
    if (title) title.textContent = definition.label;
    if (hint) hint.textContent = 'Die Werkzeuge entsprechen ausschließlich dem ausgewählten Folienobjekt.';
    return definition;
  }
  w.KCPropertyCore = { version: '0.2.0', definitions, describe, open };
})(window);
