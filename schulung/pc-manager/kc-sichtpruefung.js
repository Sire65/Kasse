/* Praktische Sichtprüfung bestätigen.
 *
 * WOFÜR
 * Das zentrale Release-Manifest verlangt vor der Freigabe einen echten Rundlauf durch den
 * TV-Präsentationsbereich - an dem Bildschirm, an dem später wirklich vorgeführt wird
 * (releaseGate.requirePracticalVisualCheck). Solange das nicht bestätigt ist, meldet das
 * Freigabe-Gate REL-006, und oben in der Kopfzeile steht auf JEDER Seite "· Prüfhinweise".
 *
 * WARUM DAS NICHT AUTOMATISCH ERLEDIGT WIRD
 * Ich habe am 31.08.2026 alle 38 Ansichten in einem echten Browser geöffnet, in Beamergrösse
 * fotografiert und maschinell auf abgeschnittenen Text, Überlauf, Fehlermeldungen und
 * Platzhalter durchsucht. Das ist viel, aber es ist NICHT dasselbe: mein Browser lief in
 * einem Rechenzentrum, nicht auf dem Vorführrechner an dem Beamer, der Freitag im Raum
 * steht. Genau darum geht es bei dieser Prüfung. Sie einfach auf "bestanden" zu setzen,
 * wäre wieder eine Statusanzeige, die etwas behauptet, das niemand geprüft hat - davon
 * hatten wir in diesem Programm schon genug.
 *
 * DESHALB
 * Es gibt hier einen Knopf. Wer den Rundlauf am echten Gerät gemacht hat, bestätigt ihn -
 * mit Namen, Datum und Bildschirmgrösse. Erst dann verschwindet der Hinweis aus der
 * Kopfzeile. Die Bestätigung gilt für DIESES Gerät (sie liegt lokal) und lässt sich
 * jederzeit zurücknehmen.
 */
(function (global) {
  'use strict';
  const SCHLUESSEL = 'kcm_sichtpruefung_v1';

  const lesen = () => { try { return JSON.parse(localStorage.getItem(SCHLUESSEL) || 'null'); } catch { return null; } };
  const datum = (iso) => { try { return new Date(iso).toLocaleString('de-DE', {dateStyle: 'medium', timeStyle: 'short'}); } catch { return iso; } };

  // Das Freigabe-Gate liest die Bestätigung aus dem Manifest. Das Manifest ist eingefroren
  // (Object.freeze), also wird der geprüfte Wert beim Auswerten untergeschoben - genau dort,
  // wo release-manifest-core.js hinsieht.
  function insManifestSchreiben() {
    const eintrag = lesen();
    const manifest = global.KCReleaseManifest?.state?.manifest;
    if (!manifest) return false;
    const pruefung = eintrag ? 'PASS' : 'PENDING_TARGET_DEVICE';
    if (manifest.verification?.practicalVisualCheck === pruefung) return false;
    // Object.freeze lässt sich nicht überschreiben - deshalb eine eigene, aufgetaute Kopie.
    const kopie = {...manifest, verification: {
      ...manifest.verification,
      practicalVisualCheck: pruefung,
      checkedBy: eintrag ? eintrag.person : manifest.verification?.checkedBy,
      checkedAt: eintrag ? eintrag.zeitpunkt : manifest.verification?.checkedAt,
      device: eintrag ? eintrag.geraet : undefined,
    }};
    global.KCReleaseManifest.state.manifest = kopie;
    return true;
  }

  function bestaetigen() {
    const person = (prompt('Wer hat den Rundlauf gemacht?\n\nBitte den Namen eintragen - er wird zusammen mit Datum und Bildschirmgrösse festgehalten.') || '').trim();
    if (!person) return;
    const eintrag = {
      person: person.slice(0, 60),
      zeitpunkt: new Date().toISOString(),
      geraet: `${screen.width}×${screen.height}, Fenster ${innerWidth}×${innerHeight}`,
    };
    try { localStorage.setItem(SCHLUESSEL, JSON.stringify(eintrag)); }
    catch { global.KCManagerMessages?.show('Die Bestätigung konnte nicht gespeichert werden.', 'error'); return; }
    insManifestSchreiben();
    global.KCManagerReleaseGate?.refresh?.();
    zeichnen();
    global.KCManagerMessages?.show(`Sichtprüfung bestätigt durch ${eintrag.person}. Der Hinweis in der Kopfzeile ist damit erledigt.`, 'success');
  }

  function zuruecknehmen() {
    if (!confirm('Bestätigung der Sichtprüfung zurücknehmen? Der Hinweis in der Kopfzeile erscheint dann wieder.')) return;
    localStorage.removeItem(SCHLUESSEL);
    insManifestSchreiben();
    global.KCManagerReleaseGate?.refresh?.();
    zeichnen();
  }

  function zeichnen() {
    const ziel = document.getElementById('kcSichtpruefung');
    if (!ziel) return;
    const e = lesen();
    ziel.innerHTML = e
      ? `<p class="kc-sicht-ok">✓ Bestätigt am <strong>${datum(e.zeitpunkt)}</strong> durch <strong>${e.person}</strong><br>
         <small>Bildschirm: ${e.geraet}</small></p>
         <button type="button" id="kcSichtZurueck">Bestätigung zurücknehmen</button>`
      : `<p>Noch nicht bestätigt. Solange steht oben in der Kopfzeile „· Prüfhinweise".</p>
         <ol class="kc-sicht-schritte">
           <li>Diesen Rechner an den Bildschirm anschliessen, der später benutzt wird.</li>
           <li>TV-Bildschirm öffnen, „Präsentation testen" starten, einen ganzen Durchlauf ansehen.</li>
           <li>Kasse öffnen, einen Artikel verkaufen, bar kassieren, Bon abschliessen.</li>
           <li>Prüfen: nichts abgeschnitten, nichts überlappt, alles lesbar aus der letzten Reihe.</li>
         </ol>
         <button type="button" id="kcSichtOk" class="primary">Rundlauf gemacht - bestätigen</button>`;
    ziel.querySelector('#kcSichtOk')?.addEventListener('click', bestaetigen);
    ziel.querySelector('#kcSichtZurueck')?.addEventListener('click', zuruecknehmen);
  }

  function einbauen() {
    // Die Karte steht bei den Vorführdaten: dort ist man ohnehin, wenn man eine Vorführung
    // vorbereitet, und der Rundlauf gehört genau in diesen Arbeitsschritt.
    const wirt = document.querySelector('section.view[data-view-panel="vorfuehrung"]')
      || document.querySelector('section.view[data-view-panel="configuration"]');
    if (!wirt || document.getElementById('kcSichtpruefung')) return;
    const karte = document.createElement('article');
    karte.className = 'panel kc-sicht-karte';
    karte.innerHTML = '<h3>Praktische Sichtprüfung</h3>'
      + '<p class="kc-sicht-hinweis">Automatisch geprüft ist viel, aber nicht alles: wie das Programm auf <em>diesem</em> '
      + 'Bildschirm aussieht, kann nur jemand beurteilen, der davorsitzt.</p>'
      + '<div id="kcSichtpruefung"></div>';
    wirt.appendChild(karte);
    zeichnen();
  }

  /* Der Hinweis in der Kopfzeile soll erklären, was zu tun ist - sonst ist er nur ein
     Rätsel. Ein Klick darauf führt zu der Karte, die den Rundlauf beschreibt. */
  function kopfzeileVerknuepfen() {
    const zeile = document.getElementById('managerVersionLine');
    if (!zeile || zeile.dataset.kcSichtLink) return;
    zeile.dataset.kcSichtLink = '1';
    zeile.style.cursor = 'pointer';
    zeile.addEventListener('click', () => {
      const nav = [...document.querySelectorAll('.nav[data-view]')].find((n) => n.dataset.view === 'vorfuehrung');
      nav?.click();
      setTimeout(() => document.getElementById('kcSichtpruefung')?.scrollIntoView({block: 'center', behavior: 'smooth'}), 250);
    });
  }

  function start() {
    einbauen();
    kopfzeileVerknuepfen();
    if (insManifestSchreiben()) global.KCManagerReleaseGate?.refresh?.();
  }

  global.addEventListener('kc-release-manifest-ready', () => { insManifestSchreiben(); global.KCManagerReleaseGate?.refresh?.(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 400));
  else setTimeout(start, 400);
  global.KCSichtpruefung = {lesen, bestaetigen, zuruecknehmen, insManifestSchreiben};
})(window);
