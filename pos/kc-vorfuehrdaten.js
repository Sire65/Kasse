// Vorführdaten für die Kasse (Präsentation).
// Drei Markttage, rund 1.680 Buchungen - genug, damit Bonsuche, Tagesabschluss und
// Auswertungen etwas zu zeigen haben.
//
// BEFUND vom 31.08.2026 - DIESER KNOPF WAR KAPUTT UND HAT ES VERSCHWIEGEN:
// Die Buchungen wurden nach localStorage ("kc_transactions_v040") geschrieben. Genau von
// dort liest die Kasse aber seit der Umstellung auf IndexedDB NICHT mehr - die beiden
// Stellen, die localStorage überhaupt noch anfassen (migrateTransactions und
// hydrateTransactionCache), laufen jeweils nur EIN EINZIGES MAL je Gerät und sind auf
// jedem eingerichteten Gerät längst abgehakt.
// Gemessen: der Knopf meldete "1682 Vorführbuchungen geladen", danach standen in der Kasse
// 0 Buchungen, der Tagesabschluss zeigte 0,00 €. Auf einer Präsentation vor Publikum wäre
// das der denkbar schlechteste Moment für so eine Überraschung gewesen.
//
// JETZT: geschrieben wird über saveTransactions() - dieselbe Funktion, die auch ein echter
// Verkauf benutzt. Sie aktualisiert den Zwischenspeicher SOFORT und legt die Daten dauerhaft
// in IndexedDB ab. Gesichert und wiederhergestellt wird ebenfalls über diesen Weg, damit ein
// echter Bestand nicht verloren gehen kann.
(function (global) {
  'use strict';
  const SICHERUNG = 'kc_transactions_vor_vorfuehrung';
  const MARKE = 'kc_vorfuehrdaten_aktiv';

  // Die Kasse liest ihre Buchungen über readTransactions() (Zwischenspeicher, gespeist aus
  // IndexedDB). Beides sind echte Funktionsdeklarationen in app.js und hängen damit am
  // Fenster - anders als die mit "let" deklarierten Listen, die von außen unerreichbar sind.
  const lesen = () => (typeof global.readTransactions === 'function' ? global.readTransactions() : []);

  // Schreiben UND auf das Ende des Schreibvorgangs warten.
  //
  // ZWEITER BEFUND beim Nachmessen: saveTransactions() legt die Daten nur in den
  // Zwischenspeicher und stösst die dauerhafte Speicherung im HINTERGRUND an. Das direkt
  // darauf folgende location.reload() riss den Schreibvorgang mittendrin ab - nach dem
  // Neuladen war wieder alles leer. Deshalb wird hier zusätzlich auf das Versprechen von
  // KCTransactionStore.replaceAll gewartet, bevor die Seite neu geladen wird.
  async function schreiben(zeilen) {
    if (typeof global.saveTransactions !== 'function') return false;
    global.saveTransactions(zeilen);
    const speicher = global.KCTransactionStore;
    if (speicher && typeof speicher.replaceAll === 'function') {
      try { await speicher.replaceAll(speicher.STORE_SALES, zeilen); }
      catch (e) { throw new Error('Die Buchungen liessen sich nicht dauerhaft speichern: ' + e.message); }
    }
    return true;
  }

  async function laden() {
    try {
      const daten = await (await fetch('vorfuehrung/daten.json', {cache: 'no-store'})).json();
      if (!Array.isArray(daten) || !daten.length) throw new Error('Die Datei enthält keine Buchungen.');
      if (typeof global.saveTransactions !== 'function') {
        throw new Error('Die Kasse ist noch nicht vollständig geladen. Bitte einen Moment warten und erneut versuchen.');
      }
      // Den ECHTEN aktuellen Bestand sichern - nicht den (längst unbenutzten) localStorage-Rest.
      if (!localStorage.getItem(MARKE)) {
        try { localStorage.setItem(SICHERUNG, JSON.stringify(lesen())); }
        catch (e) {
          // Der Bestand passt nicht mehr in den Browserspeicher. Dann lieber gar nicht laden,
          // als einen echten Kassenbestand ohne Rückweg zu überschreiben.
          throw new Error('Der aktuelle Kassenbestand ließ sich nicht sichern - es wurde nichts geladen. Bitte zuerst einen Tagesabschluss machen.');
        }
      }
      await schreiben(daten);
      localStorage.setItem(MARKE, new Date().toISOString());
      const summe = daten.reduce((s, x) => s + Number(x.total || x.due || 0), 0);
      const tage = new Set(daten.map((x) => String(x.time || '').slice(0, 10))).size;
      alert(`${daten.length} Vorführbuchungen geladen: ${tage} Markttage, zusammen `
        + `${summe.toLocaleString('de-DE', {style: 'currency', currency: 'EUR'})}.\n\n`
        + 'Die Kasse wird jetzt neu geladen.');
      location.reload();
    } catch (fehler) {
      alert(`Vorführdaten konnten nicht geladen werden: ${fehler.message}`);
    }
  }

  async function entfernen() {
    if (typeof global.saveTransactions !== 'function') {
      alert('Die Kasse ist noch nicht vollständig geladen. Bitte einen Moment warten und erneut versuchen.');
      return;
    }
    let vorher = [];
    try { vorher = JSON.parse(localStorage.getItem(SICHERUNG) || '[]'); } catch (e) { vorher = []; }
    await schreiben(Array.isArray(vorher) ? vorher : []);
    localStorage.removeItem(SICHERUNG);
    localStorage.removeItem(MARKE);
    alert(`Vorführdaten entfernt. Der vorherige Stand ist wiederhergestellt (${vorher.length} Buchungen).`);
    location.reload();
  }

  function verdrahten() {
    document.querySelectorAll('.more-grid button[data-action="vorfuehrung"]').forEach((b) => {
      if (b.dataset.fertig) return;
      b.dataset.fertig = '1';
      b.addEventListener('click', () => {
        document.getElementById('moreDialog')?.close();
        const aktiv = localStorage.getItem(MARKE);
        setTimeout(() => {
          if (aktiv) { if (confirm('Vorführdaten sind geladen. Jetzt entfernen und den vorherigen Stand wiederherstellen?')) entfernen(); }
          else if (confirm('Vorführdaten für eine Präsentation laden? Der aktuelle Stand wird gesichert und lässt sich wiederherstellen.')) laden();
        }, 150);
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verdrahten);
  else verdrahten();
  global.KCVorfuehrdaten = {laden, entfernen, aktiv: () => !!localStorage.getItem(MARKE)};
})(window);
