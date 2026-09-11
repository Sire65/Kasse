// EIN Umschalter für alle Ansichten - ersetzt vier verschiedene Wege.
//
// VORGEFUNDEN: Die Ansicht ließ sich an vier Stellen verstellen - der Knopf ⇄ in der Kopfzeile
// (Spiegelung), ein Schalter in den Einstellungen hinter dem Admin-Zugang, ein zweiter Schalter
// für dasselbe im Mehr-Fenster (weil der erste zu umständlich war), und indirekt über
// "STIMMT SO", das die große Warenkorb-Ansicht mit aufrief. Wer sich verstellt hatte, musste
// erst herausfinden, an welcher der Stellen er es wieder geradebiegt.
//
// JETZT: ein Knopf, der durchschaltet.
//     Normal  →  Schmal  →  Linkshändig  →  Normal
// Normal zuerst, weil es der Alltag ist; Linkshändig zuletzt, weil es am seltensten gebraucht
// wird. Der Knopf zeigt, wo man GERADE ist - nicht, wohin es als Nächstes geht: wer einmal zu
// oft drückt, soll ablesen können, wo er gelandet ist, statt weiterzuraten.
//
// LANGES DRÜCKEN führt aus jedem Zustand zurück auf Normal. Am Stand ist dieser Rückweg mehr
// wert als die Umschaltung selbst.
//
// BEIM START IMMER NORMAL: An der Kasse stehen jeden Tag andere Leute. Eine gespeicherte
// Vorliebe des Vortags wäre für den Nächsten eine Anordnung, die er nicht gewählt hat und
// nicht loswird. Innerhalb der Schicht bleibt die Wahl erhalten.
(function (global) {
  'use strict';

  const ANSICHTEN = [
    {id: 'normal', name: 'Normal',      neuesLayout: true,  spiegel: false},
    {id: 'schmal', name: 'Schmal',      neuesLayout: false, spiegel: false},
    {id: 'links',  name: 'Linkshändig', neuesLayout: true,  spiegel: true},
  ];
  const SITZUNG_KEY = 'kc_ansicht_sitzung_v1';
  let index = 0;

  function anwenden(neuerIndex, merken) {
    index = ((neuerIndex % ANSICHTEN.length) + ANSICHTEN.length) % ANSICHTEN.length;
    const a = ANSICHTEN[index];
    document.body.classList.toggle('kc-layout-neu', a.neuesLayout);
    document.body.classList.toggle('kc-spiegel-modus', a.spiegel);
    // In die gespeicherte Einstellung schreiben, damit die Schalter in Einstellungen und
    // Mehr-Fenster dasselbe anzeigen und nicht auseinanderlaufen.
    try {
      const master = JSON.parse(localStorage.getItem('kc_master_v040') || '{}');
      master.neuesLayout = a.neuesLayout;
      localStorage.setItem('kc_master_v040', JSON.stringify(master));
      localStorage.setItem('kc_spiegel_modus_v1', a.spiegel ? '1' : '0');
    } catch (e) { /* Speicher gesperrt - wirkt dann nur bis zum Neuladen */ }
    if (merken !== false) { try { sessionStorage.setItem(SITZUNG_KEY, a.id); } catch (e) {} }
    zeichne();
    global.KCLayoutNeu?.ledsAktualisieren?.();
  }

  const weiter = () => anwenden(index + 1);
  const zurueckAufNormal = () => anwenden(0);

  function zeichne() {
    const a = ANSICHTEN[index];
    const knopf = document.getElementById('mirrorLayoutBtn');
    if (knopf) {
      // Vier Pfeile IM KREIS: "durchschalten". Vier Pfeile nach außen heißen in fast jedem
      // Programm "Vollbild" - und einen Vollbild-Hinweis gibt es hier bereits.
      knopf.innerHTML = '<span class="kc-ansicht-symbol" aria-hidden="true">🔄</span>';
      knopf.title = `Ansicht: ${a.name} · tippen zum Wechseln · gedrückt halten für Normal`;
      knopf.setAttribute('aria-label', `Ansicht ${a.name}, tippen zum Wechseln`);
      knopf.classList.toggle('active', index !== 0);
    }
    // Kleiner Hinweis in der Kopfzeile - NUR wenn man nicht auf Normal steht. Im Alltag steht
    // dort nichts, dadurch fällt es auf, wenn doch etwas dasteht.
    let hinweis = document.getElementById('kcAnsichtHinweis');
    if (index === 0) { hinweis?.remove(); return; }
    if (!hinweis) {
      hinweis = document.createElement('span');
      hinweis.id = 'kcAnsichtHinweis';
      hinweis.className = 'kc-ansicht-hinweis';
      document.getElementById('registerName')?.parentElement?.appendChild(hinweis);
    }
    hinweis.textContent = a.name;
  }

  function verdrahten() {
    const knopf = document.getElementById('mirrorLayoutBtn');
    if (!knopf || knopf.dataset.kcAnsicht) return;
    knopf.dataset.kcAnsicht = '1';

    // Langes Drücken: zurück auf Normal. Funktioniert mit Finger und Maus.
    let halteZeit = null, langGedrueckt = false;
    const start = () => { langGedrueckt = false; halteZeit = setTimeout(() => { langGedrueckt = true; zurueckAufNormal(); }, 700); };
    const ende = () => clearTimeout(halteZeit);
    ['mousedown', 'touchstart'].forEach((e) => knopf.addEventListener(e, start, {passive: true}));
    ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach((e) => knopf.addEventListener(e, ende, {passive: true}));
    knopf.addEventListener('click', (e) => {
      e.preventDefault(); e.stopImmediatePropagation();
      if (langGedrueckt) { langGedrueckt = false; return; }
      weiter();
    }, true);

    // Die beiden alten Schalter zeigen jetzt auf dieselbe Stelle, statt eigene Wege zu gehen.
    // Ganz entfernen wäre schlechter: wer sie kennt, würde sie suchen.
    const alt = document.getElementById('layoutQuickToggle');
    if (alt && !alt.dataset.kcAnsicht) {
      alt.dataset.kcAnsicht = '1';
      alt.addEventListener('click', (e) => { e.preventDefault(); e.stopImmediatePropagation(); weiter(); }, true);
    }
    const einstellung = document.getElementById('neuesLayoutToggle');
    if (einstellung && !einstellung.dataset.kcAnsicht) {
      einstellung.dataset.kcAnsicht = '1';
      einstellung.addEventListener('change', () => anwenden(einstellung.checked ? 0 : 1), true);
    }
  }

  function start() {
    verdrahten();
    // Beim Start immer Normal - es sei denn, in DIESER Sitzung wurde schon gewählt.
    let startIndex = 0;
    try {
      const gemerkt = sessionStorage.getItem(SITZUNG_KEY);
      const gefunden = ANSICHTEN.findIndex((a) => a.id === gemerkt);
      if (gefunden >= 0) startIndex = gefunden;
    } catch (e) { /* egal */ }
    anwenden(startIndex, false);
  }

  global.KCAnsicht = {
    weiter, zurueckAufNormal, aktuelle: () => ANSICHTEN[index], setze: (id) => {
      const i = ANSICHTEN.findIndex((a) => a.id === id);
      if (i >= 0) anwenden(i);
    },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window);
