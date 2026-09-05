// Wetter im laufenden Betrieb aktualisieren - für den Mini-PC am Fernseher.
//
// BISHER: Das Wetter wurde im PC-Manager geholt und ins Paket geschrieben. Der Fernseher
// zeigte damit die Vorhersage vom Zeitpunkt der Erstellung. Läuft der Markt mehrere Tage,
// steht am Sonntag die Vorhersage von Donnerstag auf dem Bildschirm - ein Gast liest Schnee,
// während es regnet.
//
// JETZT: Hängt ein Rechner mit Internet am Fernseher, holt der Abspieler die Vorhersage selbst
// und frischt sie stündlich auf. Öfter wäre sinnlos: die Vorhersage ändert sich nicht im
// Minutentakt, und jeder Abruf ist eine weitere Fehlerquelle.
//
// WAS BEI NETZAUSFALL PASSIERT - der wichtigere Teil: Es wird NICHTS gelöscht und nichts leer
// angezeigt. Die zuletzt geholte Vorhersage bleibt stehen, und wenn es auch die nicht gibt,
// die aus dem Paket. Eine leere oder fehlerhafte Wetterfolie sähe am Stand nach einem Defekt
// aus; ein etwas älterer Stand fällt niemandem auf und ist immer noch richtig genug.
(function (global) {
  'use strict';

  const SPEICHER = 'kc_tv_wetter_stand_v1';
  const ABSTAND_MS = 60 * 60 * 1000;          // einmal pro Stunde
  const ERSTER_VERSUCH_MS = 8000;             // nach dem Start kurz warten, bis das Bild steht
  const WIEDERHOLUNG_MS = 10 * 60 * 1000;     // nach einem Fehlschlag früher erneut versuchen

  const paket = () => global.currentTvPackageData || null;

  // Wettercodes von Open-Meteo in kurze deutsche Beschreibungen. Bewusst wenige Begriffe:
  // auf einem Fernseher aus fünf Metern zählt Lesbarkeit, nicht meteorologische Genauigkeit.
  function beschreibung(code) {
    const c = Number(code);
    if (c === 0) return {text: 'Klar', symbol: '☀️'};
    if (c <= 2) return {text: 'Leicht bewölkt', symbol: '⛅'};
    if (c === 3) return {text: 'Bewölkt', symbol: '☁️'};
    if (c <= 48) return {text: 'Nebel', symbol: '🌫️'};
    if (c <= 57) return {text: 'Nieselregen', symbol: '🌦️'};
    if (c <= 67) return {text: 'Regen', symbol: '🌧️'};
    if (c <= 77) return {text: 'Schnee', symbol: '🌨️'};
    if (c <= 82) return {text: 'Schauer', symbol: '🌦️'};
    if (c <= 86) return {text: 'Schneeschauer', symbol: '🌨️'};
    return {text: 'Gewitter', symbol: '⛈️'};
  }

  const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  function letzterStand() {
    try { return JSON.parse(localStorage.getItem(SPEICHER) || 'null'); } catch (e) { return null; }
  }

  async function holeWetter() {
    const w = paket()?.weather;
    if (!w) return false;
    const breite = Number(w.latitude) || 51.6645;    // Werne
    const laenge = Number(w.longitude) || 7.6342;
    const tage = Math.max(1, Math.min(7, Number(w.days) || 2));
    const adresse = 'https://api.open-meteo.com/v1/forecast'
      + `?latitude=${breite}&longitude=${laenge}`
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min'
      + `&timezone=Europe%2FBerlin&forecast_days=${tage}`;
    const antwort = await fetch(adresse, {signal: AbortSignal.timeout(12000)});
    if (!antwort.ok) throw new Error('Wetterdienst antwortete mit ' + antwort.status);
    const daten = await antwort.json();
    const t = daten?.daily;
    if (!t?.time?.length) throw new Error('Keine Vorhersage erhalten');

    const zeilen = t.time.map((tag, i) => {
      const b = beschreibung(t.weather_code?.[i]);
      const d = new Date(tag + 'T12:00:00');
      return {
        date: tag,
        day: WOCHENTAGE[d.getDay()],
        summary: b.text,
        icon: b.symbol,
        max: Math.round(Number(t.temperature_2m_max?.[i] ?? 0)),
        min: Math.round(Number(t.temperature_2m_min?.[i] ?? 0)),
      };
    });
    const stand = {geholtAm: new Date().toISOString(), ort: w.location || 'Werne', zeilen};
    try { localStorage.setItem(SPEICHER, JSON.stringify(stand)); } catch (e) { /* Speicher voll */ }
    uebernehmen(stand);
    return true;
  }

  // Den geholten Stand in das laufende Paket schreiben. Die Wetterfolie liest von dort - so
  // muss an der Anzeige selbst nichts geändert werden.
  function uebernehmen(stand) {
    const p = paket();
    if (!p?.weather || !stand?.zeilen?.length) return;
    p.weather.lastData = stand.zeilen;
    p.weather.lastFetch = stand.geholtAm;
    // Die Partikeleffekte richten sich nach der Vorhersage (siehe dynamic-content-resolver.js).
    global.KCDynamicContent?.apply?.();
  }

  async function versuch() {
    try {
      await holeWetter();
      setTimeout(versuch, ABSTAND_MS);
    } catch (e) {
      // Kein Netz oder Dienst gestört: den letzten bekannten Stand behalten und früher
      // erneut versuchen. Ausdrücklich KEIN Leeren der Anzeige.
      console.warn('Wetter konnte nicht aktualisiert werden - letzter Stand bleibt:', e.message);
      setTimeout(versuch, WIEDERHOLUNG_MS);
    }
  }

  function start() {
    // Erst den gespeicherten Stand zeigen, dann auffrischen. Dadurch steht auch ohne Netz
    // sofort etwas da, statt auf einen Abruf zu warten, der vielleicht scheitert.
    const alt = letzterStand();
    if (alt) uebernehmen(alt);
    setTimeout(versuch, ERSTER_VERSUCH_MS);
  }

  global.KCTVWetter = {holeWetter, letzterStand, uebernehmen, beschreibung};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window);
