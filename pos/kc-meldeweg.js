// Meldeweg der Kasse zum Manager - EINE Stelle fuer alle Meldungen.
//
// BEFUND, der zu dieser Datei gefuehrt hat: Zeiterfassung und Gutscheine meldeten direkt an
// http://<host>:47392. Das ist der Loopback-Kanal des MANAGERS - er lauscht auf 127.0.0.1 und
// weist alles ab, was nicht vom selben Rechner kommt. Solange die Kasse im Browser auf dem
// Manager-PC lief, ging es; von einem echten Tablet im WLAN kam NIE etwas an. Verloren ging
// dabei nichts (die Kasse behaelt ihre Daten und meldet endlos nach), aber im Manager
// erschien auch nichts.
//
// RICHTIGER WEG, den alles andere laengst nutzt: der Kassen-Companion laeuft auf dem GERAET
// SELBST. Er nimmt die Meldung entgegen, schreibt sie in seine Outbox und uebertraegt sie
// authentifiziert und verschluesselt an den Manager - mit Wiederholung, Duplikatschutz und
// Sequenzpruefung. Genau der Kanal, ueber den auch jeder Verkauf laeuft.
//
// UNSICHTBAR: nach aussen ist davon nichts zu sehen. Keine Fenster, keine Knoepfe, und in der
// Statuszeile stehen nur neutrale Worte ("Sicherung"), nie ein Hinweis auf einen Manager.
(function (global) {
  'use strict';

  // Der alte, nur-lokale Weg bleibt als zweiter Versuch bestehen: laeuft die Kasse doch auf
  // dem Manager-PC und ist dort kein Companion gestartet, geht es so trotzdem durch.
  function nurLokalerWeg(pfad) {
    const host = global.KCSyncConnection?.config?.host || '127.0.0.1';
    return `http://${host}:47392${pfad}`;
  }

  // Meldung ueber den Companion in die Outbox geben.
  // Rueckgabe: true, wenn der Companion die Uebernahme ausdruecklich bestaetigt hat.
  async function ueberCompanion(typ, inhalt) {
    const bauen = global.KCSyncConnection?.buildUrl;
    if (typeof bauen !== 'function') return false;
    try {
      const antwort = await fetch(bauen('/kc-sync-record-event'), {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({type: typ, payload: inhalt}),
        signal: AbortSignal.timeout(4000),
      });
      if (!antwort.ok) return false;
      return (await antwort.json())?.recorded === true;
    } catch (e) { return false; }
  }

  // Zweiter Versuch ueber den alten Weg - nur sinnvoll, wenn beides auf demselben Rechner laeuft.
  async function ueberLokalenKanal(pfad, inhalt) {
    try {
      const antwort = await fetch(nurLokalerWeg(pfad), {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(inhalt), signal: AbortSignal.timeout(4000),
      });
      if (!antwort.ok) return null;
      return await antwort.json();
    } catch (e) { return null; }
  }

  // Erst der zuverlaessige Weg, dann der alte. Nur wenn EINER von beiden bestaetigt, gilt die
  // Meldung als angekommen - sonst wird beim naechsten Takt erneut versucht.
  async function melde(typ, pfad, inhalt) {
    if (await ueberCompanion(typ, inhalt)) return {ok: true, weg: 'companion'};
    const antwort = await ueberLokalenKanal(pfad, inhalt);
    if (antwort) return {ok: true, weg: 'lokal', antwort};
    return {ok: false, weg: null};
  }

  global.KCMeldeweg = {melde, ueberCompanion};
})(window);
