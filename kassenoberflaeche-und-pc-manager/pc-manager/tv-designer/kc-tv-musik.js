/* Hintergrundmusik für die TV-Vorführung.   03.09.2026
 *
 * ANLASS (Betreiber): "was ist mit weihnachtlicher Musik im Hintergrund, ist das möglich so
 * kurzfristig?" - Ja. Der Audio-Baustein war längst da und wurde vom USB-Player auch benutzt;
 * die Studio-Vorführung, auf der die Originalpräsentation läuft, hat ihn nur nie eingebunden.
 * Es fehlten also nicht die Technik, sondern eine Skriptzeile und die Musikdatei.
 *
 * WARUM EINE EIGENE DATEI UND KEIN EINGRIFF IN DEN PLAYER
 * Der Player ist Freitagsstand. Diese Datei hängt sich an, ohne ihn anzufassen: Sie liest die
 * Einstellung aus der Präsentation und startet den Ton. Fällt sie aus, läuft die Vorführung
 * weiter - nur eben still.
 *
 * DIE BROWSERREGEL, an der so etwas sonst scheitert
 * Kein Browser lässt Ton von selbst losgehen; es braucht eine Bedienung. Ein Versuch beim
 * Laden wird also meistens abgelehnt - deshalb wird zusätzlich auf die erste Berührung,
 * den ersten Klick und den ersten Tastendruck gewartet. Und weil "es kommt kein Ton" der
 * ärgerlichste Fehler auf einer Vorführung ist, sagt ein kleiner Hinweis am Bildschirmrand
 * ausdrücklich, dass noch einmal getippt werden muss - statt still zu bleiben.
 */
'use strict';
(function () {
  const VERSION = '0.1.0';
  const BASIS = '../../';   /* von pc-manager/tv-designer/ aus zum Paketverzeichnis */

  function einstellung() {
    /* Die laufende Präsentation zuerst - der Player hat sie unter demselben Namen wie das Studio. */
    try {
      const gespeichert = JSON.parse(localStorage.getItem('fs3.kcTvPresentation') || 'null');
      if (gespeichert && gespeichert.audio) return gespeichert.audio;
    } catch (e) { /* kaputter Speicherstand darf die Vorführung nicht anhalten */ }
    const p = window.KC_DESIGNER_MARKET_PRESENTATION;
    return (p && p.audio) || null;
  }

  function hinweisZeigen(text) {
    let n = document.getElementById('kcMusikHinweis');
    if (!n) {
      n = document.createElement('div');
      n.id = 'kcMusikHinweis';
      n.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:9999;background:rgba(5,1,1,.92);'
        + 'color:#ffd76a;border:1px solid #d9aa3a;border-radius:8px;padding:10px 14px;'
        + 'font:600 16px/1.35 "Segoe UI",Arial,sans-serif;max-width:min(520px,70vw);box-shadow:0 4px 18px rgba(0,0,0,.5)';
      document.body.appendChild(n);
    }
    n.textContent = text;
    n.hidden = false;
  }
  function hinweisWeg() { const n = document.getElementById('kcMusikHinweis'); if (n) n.hidden = true; }

  function starte() {
    const a = einstellung();
    if (!a || !a.enabled || !a.src) return;                 /* Musik ist nicht eingeschaltet */
    if (!window.KCAudioPresentationCore) {
      console.warn('KC TV-Musik: Der Audio-Baustein ist nicht eingebunden - kein Ton.');
      return;
    }
    const spieler = window.KCAudioPresentationCore.play({ audio: a }, { base: BASIS });
    if (!spieler) return;
    /* Der Spieler wird hier festgehalten und nach aussen gegeben.
       GRUND: Der Audio-Baustein legt ihn mit "new Audio()" an - das Element haengt NICHT im
       Seitenbaum. Wer nachsehen will, ob wirklich Ton kommt, findet ueber die Seite nichts und
       glaubt, es laufe nichts. Genau darauf ist meine erste Pruefung hereingefallen. Ueber
       KCTVMusik.spieler laesst sich der Ton pruefen, statt ihn zu vermuten. */
    window.KCTVMusik.spieler = spieler;

    let laeuft = false;
    const pruefen = () => {
      if (!spieler.paused && spieler.currentTime > 0) { laeuft = true; hinweisWeg(); }
    };
    spieler.addEventListener('playing', pruefen);

    /* Erster Versuch ohne Bedienung - klappt, wenn die Seite aus einem Klick heraus geöffnet wurde. */
    const versuch = () => {
      const p = spieler.play();
      if (p && p.catch) p.catch(() => { if (!laeuft) hinweisZeigen('🎵 Musik ist bereit – einmal auf den Bildschirm tippen, dann läuft sie.'); });
    };
    versuch();
    setTimeout(pruefen, 600);

    /* Und auf die erste Bedienung, egal welche. Danach nie wieder. */
    const beiBedienung = () => {
      versuch();
      setTimeout(() => { pruefen(); if (laeuft) abmelden(); }, 300);
    };
    const arten = ['pointerdown', 'click', 'keydown', 'touchstart'];
    const abmelden = () => arten.forEach((n) => document.removeEventListener(n, beiBedienung, true));
    arten.forEach((n) => document.addEventListener(n, beiBedienung, true));

    console.info('KC TV-Musik (' + VERSION + ') bereit – ' + a.src);
  }

  /* Erst anmelden, dann starten - starte() legt den Spieler hier ab. */
  window.KCTVMusik = { version: VERSION, einstellung, starte, spieler: null };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', starte);
  else starte();
})();
