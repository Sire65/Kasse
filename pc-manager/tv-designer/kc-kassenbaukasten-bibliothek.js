/* KC Kassenbaukasten, Teil 7: Die Bibliothek bedienbar machen.   03.09.2026
 *
 * ANLASS (Betreiber): "Prüfe auch die Anordnung und Bedienung der Objektbibliothek, ob alles
 * per Drag and Drop auf die Fläche kommt."
 *
 * WAS DIE MESSUNG ERGAB
 * Ziehen funktioniert - aber nur aus der EINEN Gruppe, die gerade offen ist.
 * Der Designer macht aus der Bibliothek eine Ziehharmonika (v027-enhancements.js): Beim Aufbau
 * bekommt jede Gruppe außer der ersten die Klasse "collapsed", und styles.css blendet deren
 * Inhalt mit `display:none !important` aus. Für die TV-Anzeige mit vier Gruppen ist das
 * sinnvoll. Im Kassenmodus stehen 19 Gruppen mit 137 Bauteilen darin - dort bedeutet dieselbe
 * Regel: 18 Gruppen sind zu, und man muss jede einzeln aufklappen, um überhaupt an ein Teil zu
 * kommen. Das ist der Grund, warum mein eigener Zieh-Versuch aus fast jeder Gruppe ins Leere
 * lief; die Werkzeuge waren wirklich nicht da.
 *
 * WAS HIER GESCHIEHT
 * 1. Im Kassenmodus sind alle Gruppen zunächst OFFEN. Eine Teilebibliothek ist kein Menü.
 * 2. Was der Bauende zuklappt, bleibt zu - auch nach dem nächsten Neuzeichnen und dem nächsten
 *    Start. Sonst müsste er sein Aufräumen bei jedem Klick wiederholen.
 * 3. Sobald im Suchfeld etwas steht, werden alle Gruppen aufgeklappt. Eine Suche, die Treffer
 *    in zugeklappten Gruppen versteckt, ist schlimmer als keine Suche.
 * Am TV-Modus ändert sich nichts.
 */
'use strict';
(function () {
  const VERSION = '0.7.0';
  const LAGER = 'kc.kassenbaukasten.gruppen.zu.v1';

  const zuGeklappt = () => {
    try { return new Set(JSON.parse(localStorage.getItem(LAGER) || '[]')); } catch (e) { return new Set(); }
  };
  const merken = (menge) => {
    try { localStorage.setItem(LAGER, JSON.stringify([...menge])); } catch (e) { /* egal */ }
  };

  const imKassenmodus = () => (typeof project === 'object' && (project.mode || '') === 'kasse');
  const titelVon = (g) => (g.querySelector(':scope > h3')?.textContent || '').trim();
  const suchtGerade = () => Boolean((document.getElementById('librarySearch')?.value || '').trim());

  function gruppenOrdnen() {
    if (!imKassenmodus()) return;
    const zu = zuGeklappt();
    const suche = suchtGerade();
    document.querySelectorAll('#toolbox .toolGroup').forEach((g) => {
      const titel = titelVon(g);
      if (!titel) return;
      /* Bei aktiver Suche wird aufgeklappt, egal was gemerkt ist - aber das Gemerkte wird
         dabei NICHT überschrieben: Nach dem Leeren des Suchfelds steht alles wieder so, wie
         der Bauende es hinterlassen hat. */
      const sollZu = !suche && zu.has(titel);
      g.classList.toggle('collapsed', sollZu);
      const kopf = g.querySelector(':scope > h3');
      if (kopf) kopf.setAttribute('aria-expanded', String(!sollZu));
    });
  }

  function kopfzeilenVerdrahten() {
    document.querySelectorAll('#toolbox .toolGroup > h3').forEach((h) => {
      if (h.dataset.kcMerker) return;
      h.dataset.kcMerker = '1';
      /* In der abfangenden Phase, damit die Umschaltung des Designers zwar weiter läuft, der
         neue Zustand aber auch gemerkt wird. Beides soll gelten. */
      h.addEventListener('click', () => {
        if (!imKassenmodus()) return;
        setTimeout(() => {
          const g = h.closest('.toolGroup');
          const titel = titelVon(g);
          const zu = zuGeklappt();
          if (g.classList.contains('collapsed')) zu.add(titel); else zu.delete(titel);
          merken(zu);
        }, 0);
      });
    });
  }

  function suchfeldAnpassen() {
    const s = document.getElementById('librarySearch');
    if (!s || s.dataset.kcAngepasst) return;
    s.dataset.kcAngepasst = '1';
    s.addEventListener('input', () => { setTimeout(gruppenOrdnen, 60); });
  }

  /* Beim Wechsel in den Kassenmodus einmal die Vorgabe setzen: alles offen, außer was der
     Bauende selbst zugeklappt hat. */
  function starten() {
    kopfzeilenVerdrahten();
    suchfeldAnpassen();
    gruppenOrdnen();
  }

  function bereit() {
    return window.KCKassenbaukasten && document.getElementById('toolbox')
      && typeof render === 'function' && typeof project === 'object';
  }

  function starte() {
    if (!bereit()) return false;
    const echtesRender = render;
    render = function () { echtesRender.apply(this, arguments); starten(); };
    /* Die Bibliothek wird auch ohne render() neu aufgebaut (renderModeTools) - deshalb
       zusätzlich beobachten statt sich auf einen einzigen Weg zu verlassen. */
    const box = document.getElementById('toolbox');
    new MutationObserver(() => { if (imKassenmodus()) starten(); }).observe(box, { childList: true });
    starten();
    console.info(`KC Kassenbaukasten Teil 7 (${VERSION}) bereit – Bibliothek offen und gemerkt.`);
    return true;
  }

  let versuche = 0;
  const wecker = setInterval(() => { if (starte() || ++versuche > 220) clearInterval(wecker); }, 100);

  window.KCKassenBibliothek = {
    version: VERSION, gruppenOrdnen, zuGeklappt, alleAufklappen: () => { merken(new Set()); gruppenOrdnen(); },
  };
})();
