// KC Kasse – Spiegel-Modus für Linkshänder: dreht nur die Position von Verkaufsfläche und
// Warenkorb um (nicht Kopf-/Meldungszeile). Die eigentliche Spiegelung passiert komplett in
// styles.css (body.kc-spiegel-modus) - dieses Skript setzt nur die Klasse und merkt sich die
// Einstellung, damit sie einen Neustart der Seite übersteht.
(function (global) {
  'use strict';
  const SCHLUESSEL = 'kc_spiegel_modus_v1';
  const btn = document.getElementById('mirrorLayoutBtn');
  if (!btn) return;

  function anwenden(aktiv) {
    document.body.classList.toggle('kc-spiegel-modus', aktiv);
    btn.setAttribute('aria-pressed', aktiv ? 'true' : 'false');
    btn.classList.toggle('active', aktiv);
  }

  anwenden(localStorage.getItem(SCHLUESSEL) === '1');

  // FRUEHER belegte dieses Modul den Knopf selbst. Seit es EINEN Umschalter fuer alle drei
  // Ansichten gibt (kc-ansicht-umschalter.js), waeren das zwei Reaktionen auf denselben Klick -
  // die Spiegelung waere bei jedem Durchschalten zusaetzlich umgesprungen. Das Setzen der
  // Klasse und das Merken uebernimmt jetzt der Umschalter; dieses Modul stellt beim Laden nur
  // noch den gespeicherten Stand her.
  global.KCSpiegelModus = {anwenden};
})(window);
