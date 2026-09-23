/* TV-Studio: Auftritt und Einpassen.
 *
 * ZWEI BEFUNDE aus der Sichtprüfung vom 31.08.2026 (Vorbereitung der Präsentation):
 *
 * 1. FREMDER PRODUKTNAME
 *    Oben links stand "Framework Studio 3.x · Visual Designer V0.28.2 Candidate". Das ist
 *    der Arbeitsname des Bausteins, nicht der Name des Programms. Wer in der Vorführung
 *    "Präsentation bearbeiten" anklickt, landet plötzlich in einem fremd benannten
 *    Programm - und fragt sich zu Recht, was das ist und wem es gehört. Auch das Wort
 *    "Candidate" hat vor Publikum nichts verloren.
 *    Der Name wird deshalb hier zuletzt gesetzt. Warum hier und nicht an der Quelle: die
 *    Zeichenfolge steht an ACHT Stellen in v027-enhancements.js, jede in einem eigenen
 *    sofort ausgeführten Block, und jede überschreibt die vorherige. Eine Änderung an nur
 *    einer Stelle hätte gar nichts bewirkt.
 *
 * 2. FOLIE PASSTE NICHT INS BILD
 *    Die Arbeitsfläche startete auf 100 % Zoom. Die Folie ist 1920x1080 gross, die Fläche
 *    dazwischen war 1100 px breit - im Bild stand "Herzlich willkom" und der Rest lag
 *    ausserhalb. Beim ersten Öffnen wird jetzt so eingezoomt, dass die ganze Folie zu
 *    sehen ist; ausserdem gibt es dafür einen Knopf "Einpassen".
 *    Der eingestellte Zoom des Benutzers wird NICHT überschrieben - eingepasst wird nur
 *    beim ersten Öffnen und auf Knopfdruck.
 */
(function () {
  'use strict';
  const NAME = 'KC MarktKasse · TV-Studio';

  function benennen() {
    document.title = NAME;
    const marke = document.querySelector('.brandBlock strong');
    if (marke) marke.textContent = NAME;
    const zusatz = document.querySelector('.brandBlock span');
    if (zusatz) {
      // Versionsnummer behalten, das Wort "Candidate" und den fremden Namen entfernen.
      const nummer = (zusatz.textContent || '').match(/V\d+(\.\d+)*/);
      zusatz.textContent = nummer ? `Bildschirm-Gestaltung ${nummer[0]}` : 'Bildschirm-Gestaltung';
    }
  }

  function flaeche() { return document.getElementById('stage') || document.querySelector('.stage'); }

  function einpassen() {
    const buehne = flaeche();
    if (!buehne) return false;
    const rahmen = buehne.parentElement;
    if (!rahmen) return false;
    // Ungezoomte Eigengrösse der Folie ermitteln - offsetWidth ist von zoom unabhängig.
    const breite = buehne.offsetWidth, hoehe = buehne.offsetHeight;
    const platzB = rahmen.clientWidth - 28, platzH = rahmen.clientHeight - 28;
    if (!(breite > 0 && hoehe > 0 && platzB > 0 && platzH > 0)) return false;
    let z = Math.floor(Math.min(platzB / breite, platzH / hoehe) * 100 / 5) * 5;
    z = Math.max(25, Math.min(100, z));           // nie über 100 % hineinzoomen
    const bereich = document.getElementById('zoomRange');
    const prozent = document.getElementById('zoomPercent');
    if (bereich) { bereich.value = String(z); bereich.dispatchEvent(new Event('input', {bubbles: true})); }
    else { buehne.style.zoom = String(z / 100); }
    if (prozent) prozent.value = String(z);
    return true;
  }

  function knopfBauen() {
    const leiste = document.querySelector('.zoomControls');
    if (!leiste || leiste.querySelector('[data-kc-einpassen]')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.kcEinpassen = '1';
    b.textContent = 'Einpassen';
    b.title = 'Die ganze Folie in die Arbeitsfläche einpassen';
    b.onclick = einpassen;
    leiste.insertBefore(b, leiste.firstChild);
  }

  function start() {
    benennen();
    knopfBauen();
    // Erst einpassen, wenn die Arbeitsfläche wirklich Platz hat (Aufbau läuft asynchron).
    let versuche = 0;
    const takt = setInterval(() => { if (einpassen() || ++versuche > 20) clearInterval(takt); }, 150);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  // Die Umbenennung wird von den älteren Bausteinen sonst nachträglich wieder überschrieben.
  setTimeout(benennen, 300);
  setTimeout(benennen, 1200);
  window.KCStudioAuftritt = {einpassen, benennen};
})();
