/* Preistabellen einpassen, damit keine Zeile abgeschnitten wird.   03.09.2026
 *
 * DER BEFUND
 * Auf drei Preisfolien wird die Tabelle unten abgeschnitten - schon im unveränderten
 * Freitagsstand, gemessen an der laufenden Vorführung:
 *
 *     Folie 3 (Getränke alkoholisch)   braucht 493 px, hat 362   → 130 px fehlen
 *     Folie 4 (Getränke alkoholfrei)   braucht 294 px, hat 202   →  93 px fehlen
 *     Folie 5 (Speisen Teil 1)         braucht 444 px, hat 282   → 162 px fehlen
 *
 * Sichtbar heißt das: „Roter Feger mit Schuß" steht nur zur Hälfte da, und die Zeile
 * „Alle Preise zzgl. 2,00 Euro Pfand je Glas / Feuerzange" fehlt ganz. Ausgerechnet der
 * Hinweis, der dem Gast sagt, was er wirklich zahlt. Auf Folie 5 fehlt die Mettwurst-Zeile.
 *
 * WARUM ES NIEMAND GEMERKT HAT
 * Ein Kasten mit overflow:hidden sieht immer ordentlich aus. Er zeigt keine Lücke, keinen
 * Fehler, keinen Hinweis - er hört einfach auf. Deshalb prüft die Vorführungsprüfung jetzt
 * den wahren Platzbedarf (scrollHeight) und nicht das Aussehen.
 *
 * WAS DIESE DATEI TUT - UND WAS AUSDRÜCKLICH NICHT
 * Sie macht die Tabelle nur so hoch, wie ihr Inhalt braucht, und höchstens bis knapp über
 * das, was darunter liegt (Hinweiszeile, sonst Laufschrift). Erst wenn das nicht reicht,
 * verkleinert sie die Schrift - in Ein-Pixel-Schritten und nur so weit wie nötig.
 * Nach der Messung reicht bei allen drei Folien die Höhe allein; die Schrift bleibt bei 36 px.
 *
 * Sie verschiebt nichts, löscht nichts und ändert keine Farbe. Sie hängt sich von außen an
 * den Player, ohne ihn anzufassen: Fällt sie aus, läuft die Vorführung genau wie vorher.
 * Wer sie nicht will, nimmt die eine Skriptzeile aus KC_TV_START.html wieder heraus.
 */
'use strict';
(function () {
  const VERSION = '0.1.0';
  /* Die Laufschrift beginnt bei 665 und ist ein eigener, deckender Balken. Bis 663 darf ein
     Kasten also reichen, ohne dass etwas darunter verschwindet. Mit 655 fehlten der
     Mitmach-Zeile genau drei Pixel - zu wenig, um es zu sehen, genug, um die Unterlängen
     abzuschneiden. */
  const UNTERKANTE = 663;
  const LUFT = 8;

  function einpassen() {
    const buehne = document.getElementById('tvStage');
    if (!buehne) return;

    /* ZWEI MASSSYSTEME NICHT MISCHEN - daran ist der erste Anlauf gescheitert.
       Die Bühne wird per CSS-transform skaliert. getBoundingClientRect() liefert dann die
       Maße AUF DEM BILDSCHIRM (mitskaliert), offsetTop/clientHeight/scrollHeight dagegen die
       Maße IM LAYOUT (unskaliert). Ich hatte beides gemischt und durch den Maßstab geteilt,
       was schon unskaliert war - die Tabelle wuchs daraufhin über den Bildrand hinaus und
       legte sich auf den Allergenhinweis. Hier wird jetzt ausschließlich mit offsetTop,
       clientHeight und scrollHeight gerechnet, also durchgehend im Layoutmaß. */
    const alle = [...buehne.querySelectorAll('.tvItem')];

    alle.forEach((el) => {
      /* Nicht nur Tabellen: Auf der Mitmach-Folie fehlten drei Pixel an der letzten Zeile -
         zu wenig, um es zu sehen, genug, um die Unterlängen abzuschneiden. Textkästen werden
         deshalb genauso behandelt; bei ihnen wird nur die Höhe angepasst, nie die Schrift. */
      if (/icker/i.test(el.className)) return;
      const oben = el.offsetTop, links = el.offsetLeft, breit = el.offsetWidth;

      let grenze = UNTERKANTE;
      alle.forEach((x) => {
        if (x === el) return;
        /* Die Laufschrift ist KEINE Grenze im üblichen Sinn: Sie ist ein eigener, deckender
           Balken, und UNTERKANTE hält ohnehin Abstand zu ihr. Zählte sie mit, verlöre jeder
           Kasten darüber zusätzlich acht Pixel - genau daran fehlten der Mitmach-Zeile drei. */
        if (/icker/i.test(x.className)) return;
        if (x.offsetTop <= oben) return;
        const waagerechtImWeg = x.offsetLeft < links + breit && x.offsetLeft + x.offsetWidth > links;
        if (waagerechtImWeg) grenze = Math.min(grenze, x.offsetTop - LUFT);
      });

      const platz = Math.max(60, grenze - oben);
      if (el.scrollHeight > el.clientHeight) {
        el.style.height = Math.min(el.scrollHeight, platz) + 'px';
      }
      /* Reicht die Höhe noch nicht, werden die ZELLEN kleiner - Schritt für Schritt.
         Zwei Umwege lagen davor, beide lehrreich:
           1. Schriftgröße am Kasten setzen: wirkungslos, weil jede Zelle ihre eigene Größe
              mitbringt und die Angabe am Elternteil überschreibt.
           2. transform:scale() auf die Tabelle: sieht richtig aus, ändert aber die
              LAYOUT-Höhe nicht - scrollHeight bleibt gleich groß. Die Prüfung hätte also
              weiter Alarm geschlagen, und schlimmer: Sie hätte den Erfolg gar nicht messen
              können. Was man nicht messen kann, hat man nicht behoben.
         Zellengrößen ändern das Layout wirklich - und damit stimmt auch wieder, was die
         Prüfung sieht. */
      const zellen = [...el.querySelectorAll('th, td')];
      if (!zellen.length) return;   /* reiner Text: die Höhe muss reichen, die Schrift bleibt */
      let runde = 0;
      while (el.scrollHeight > el.clientHeight + 1 && runde++ < 20 && zellen.length) {
        let kleinste = 99;
        zellen.forEach((z) => {
          const jetzt = parseFloat(z.style.fontSize || getComputedStyle(z).fontSize) || 30;
          const neu = Math.max(16, jetzt - 1);
          z.style.fontSize = neu + 'px';
          kleinste = Math.min(kleinste, neu);
        });
        if (kleinste <= 16) break;
      }
      if (runde > 1) el.dataset.kcVerkleinert = String(runde - 1);
    });
  }

  /* Der Player zeichnet die Folie bei jedem Wechsel neu. Statt in seinen Ablauf einzugreifen,
     wird die Bühne beobachtet - so bleibt der Freitagsstand unberührt. */
  function verdrahten() {
    const buehne = document.getElementById('tvStage');
    if (!buehne) { setTimeout(verdrahten, 200); return; }
    new MutationObserver(() => setTimeout(einpassen, 0)).observe(buehne, { childList: true });
    addEventListener('resize', () => setTimeout(einpassen, 60));
    einpassen();
    console.info('KC TV-Tabellen (' + VERSION + ') bereit – Preistabellen werden eingepasst.');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verdrahten);
  else verdrahten();

  window.KCTVTabellen = { version: VERSION, einpassen };
})();
