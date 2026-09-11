// Happy Hour an der Kasse: den Zeitplan des PC-Managers in die Angebote der Kasse übersetzen.
//
// WARUM SO UND NICHT ANDERS
// Die Kasse hat bereits eine geprüfte Angebots- und Preislogik: sie kennt Zeitfenster, sucht
// je Artikel das günstigste laufende Angebot und - das ist das Wichtigste - sie friert den
// Preis in dem Moment ein, in dem der Artikel in den Bon wandert. Läuft die Happy Hour eine
// Sekunde später aus, behält die Zeile ihren Preis, der nächste Artikel bekommt wieder den
// regulären. Genau das wollte der Betreiber.
//
// Statt diese Logik anzufassen, übersetzt dieses Modul den Zeitplan in eben solche Angebote:
// je teilnehmendem Artikel und Zeitfenster ein Angebot mit FESTEM Preis, gültig nur an dem
// einen Tag. An der Preisfindung, am Bon und am Abschluss ändert sich damit keine Zeile.
//
// WOHER DER PLAN KOMMT
// Aus den Einstellungen, die der PC-Manager beim Stammdaten-Abgleich mitschickt
// (kc_master_v040.happyHour). Ist kein Plan hinterlegt, bleibt alles wie bisher.
(function (global) {
  'use strict';

  const VERSION = '0.1.0';
  const MASTER_KEY = 'kc_master_v040';
  let letzterTag = '';
  let letzteUnterschrift = '';

  function planHolen() {
    try {
      const master = JSON.parse(localStorage.getItem(MASTER_KEY) || '{}');
      return master && master.happyHour ? master.happyHour : null;
    } catch (e) { return null; }
  }

  function artikelHolen() {
    try { return JSON.parse(localStorage.getItem('kc_products_v050') || '[]') || []; }
    catch (e) { return []; }
  }

  // Die Angebote des Zeitplans neu setzen. Von Hand angelegte Angebote bleiben unangetastet;
  // erkannt werden die eigenen an der Markierung ausZeitplan.
  function uebernehmen(grund) {
    const HH = global.KCHappyHour;
    if (!HH) return {uebersprungen: 'gemeinsames Modul fehlt'};
    let bestand;
    try { bestand = OFFERS; } catch (e) { return {uebersprungen: 'Kasse noch nicht geladen'}; }
    if (!Array.isArray(bestand)) return {uebersprungen: 'keine Angebotsliste'};

    const plan = planHolen();
    const heute = HH.alsDatum(new Date());
    const neue = plan ? HH.alsAngebote(plan, artikelHolen(), heute) : [];

    // Ohne hinterlegten Plan wird NICHTS angefasst - eine Kasse, die noch nie einen Abgleich
    // gesehen hat, soll sich nicht plötzlich anders verhalten.
    if (!plan) return {uebersprungen: 'kein Zeitplan hinterlegt'};

    const eigene = bestand.filter((o) => o && o.ausZeitplan === true);
    const fremde = bestand.filter((o) => !o || o.ausZeitplan !== true);
    // Solange ein Zeitplan gilt, ist er die alleinige Quelle für die Happy Hour. Eine alte,
    // von Hand angelegte Happy-Hour-Aktion würde sonst daneben weiterlaufen und niemand
    // wüsste, welcher Preis nun gilt.
    const fremdeOhneAlteHappyHour = fremde.filter((o) => !(o && o.type === 'happyhour'));
    const stillgelegt = fremde.length - fremdeOhneAlteHappyHour.length;

    const unterschrift = JSON.stringify(neue.map((o) => [o.id, o.priceValue, o.startTime, o.endTime]));
    if (unterschrift === letzteUnterschrift && letzterTag === heute && eigene.length === neue.length && !stillgelegt) {
      return {unveraendert: true};
    }
    letzteUnterschrift = unterschrift;
    letzterTag = heute;

    try {
      OFFERS = [...fremdeOhneAlteHappyHour, ...neue];
      if (typeof saveOffers === 'function') saveOffers();
      if (typeof refreshOfferRuntime === 'function') refreshOfferRuntime(true);
    } catch (e) { return {fehler: e.message}; }

    return {gesetzt: neue.length, stillgelegt, tag: heute, grund};
  }

  // Einmal beim Start, danach im Takt. Der Takt ist bewusst kurz genug, dass ein Tageswechsel
  // um Mitternacht und ein frisch eingetroffener Abgleich von selbst greifen, aber lang genug,
  // dass er im Betrieb nicht auffällt.
  function start() {
    uebernehmen('Start');
    setInterval(() => uebernehmen('Takt'), 30000);
    global.KCHappyHourKasse = {version: VERSION, uebernehmen, planHolen, artikelHolen};
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window);
