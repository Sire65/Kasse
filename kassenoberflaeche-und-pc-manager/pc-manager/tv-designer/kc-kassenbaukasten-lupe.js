/* KC Kassenbaukasten, Teil 9: Die Lupe am Warenkorb.   03.09.2026
 *
 * ANLASS (Betreiber): "Bau noch eine Lupenfunktion mit ein, wenn nur Warenkorb als Bon da ist.
 * Dann Warenkorb vergrößern und bearbeiten."
 *
 * WORUM ES GEHT
 * Auf dem kleinen iPad und erst recht auf dem Handy ist der Warenkorb schmal. Gemessen am
 * 02.09.: Auf dem 9-Zoll-Gerät frisst er 17 bis 36 % der Fläche und ist trotzdem
 * unübersichtlich, die Bonschrift liegt bei 9,8 bis 10,9 px. Wer eine Menge ändern oder eine
 * Zeile löschen will, trifft schlecht.
 * Die Lupe löst das, ohne dauerhaft Platz zu kosten: Ein Griff, der Warenkorb legt sich groß
 * über die Fläche, dort wird bearbeitet - Menge, Zeile löschen, Rabatt -, ein zweiter Griff,
 * und er ist wieder klein. Kein Pixel geht im Normalbetrieb verloren.
 *
 * WARUM "WENN NUR WARENKORB ALS BON DA IST"
 * Genau so hat es der Betreiber gesagt, und es ist auch die einzige sinnvolle Lesart: Liegen
 * ZWEI Bonflächen auf einer Seite, wäre nicht bestimmt, welche sich vergrößert - und ein
 * Bedienelement, bei dem man raten muss, ist keins. Der Baukasten prüft das und sagt es am
 * Baustein, statt es beim Bauen durchgehen zu lassen und später an der Kasse zu überraschen.
 *
 * UNTERSCHIED ZUM VORHANDENEN "BEIM ANTIPPEN VERGRÖSSERN"
 * Das gibt es schon (kcZoom) - aber es vergrößert zum ANSEHEN. Die Lupe vergrößert zum
 * ARBEITEN: In der großen Ansicht sind die Bedienelemente der Zeile mit dabei. Deshalb ist es
 * eine eigene Eigenschaft und kein Sonderfall der alten.
 */
'use strict';
(function () {
  const VERSION = '0.9.0';
  const istBon = (typ) => String(typ || '').startsWith('kc-bon-');

  const K = () => window.KCKassenbaukasten;
  const melden = (t) => { if (typeof status === 'function') status(t); };

  /* Wie viele Bonflächen liegen auf der aktuellen Seite? */
  const bonflaechen = () => (currentItems() || []).filter((i) => istBon(i.type));

  /* ------------------------------------------------------- Die Auswahl im Verhaltensfeld
     Sie wird an das vorhandene Feld angehängt, nicht danebengestellt: Die Lupe ist eine
     Eigenschaft eines Bausteins wie Einklappen und Wegdrehen auch. */
  function feldErgaenzen() {
    const panel = document.getElementById('kcCleverPanel');
    if (!panel || panel.dataset.kcLupe) return false;
    panel.dataset.kcLupe = '1';
    const label = document.createElement('label');
    label.className = 'kc-lupen-wahl';
    label.innerHTML = '<input type="checkbox" data-kc-clever="kcLupe"> Lupe zum Bearbeiten '
      + '<small>Warenkorb legt sich groß über die Fläche – dort Menge ändern, Zeile löschen, Rabatt</small>';
    panel.appendChild(label);
    return true;
  }

  /* Nur an Bonflächen anbieten. An einer Artikelfläche wäre die Lupe sinnlos, und eine
     Auswahl, die nichts tut, ist schlimmer als keine. */
  function feldPflegen() {
    const label = document.querySelector('.kc-lupen-wahl');
    if (!label) return;
    const item = (currentItems() || []).find((x) => x.id === selected);
    const passt = item && istBon(item.type);
    label.hidden = !passt;
    if (!passt) return;
    const kasten = label.querySelector('input');
    kasten.checked = !!item.kcLupe;
    /* Der Hinweis, wenn die Bedingung des Betreibers nicht erfüllt ist. */
    let warnung = label.querySelector('.kc-lupen-warnung');
    const mehrere = bonflaechen().length > 1;
    if (mehrere && !warnung) {
      warnung = document.createElement('em');
      warnung.className = 'kc-lupen-warnung';
      label.appendChild(warnung);
    }
    if (warnung) {
      warnung.hidden = !mehrere;
      warnung.textContent = mehrere
        ? `⚠ Auf dieser Seite liegen ${bonflaechen().length} Bonflächen – die Lupe braucht genau eine, sonst ist nicht bestimmt, welche sich vergrößert.`
        : '';
    }
  }

  /* ------------------------------------------------------------- Der Griff am Baustein */
  function griffeZeichnen() {
    if ((project.mode || '') !== 'kasse') return;
    (currentItems() || []).forEach((item) => {
      const el = document.querySelector(`.designer-item[data-id="${item.id}"]`);
      if (!el) return;
      const alt = el.querySelector('.kc-lupen-griff');
      if (!item.kcLupe || !istBon(item.type)) { if (alt) alt.remove(); return; }
      if (alt) return;
      const griff = document.createElement('b');
      griff.className = 'kc-lupen-griff';
      griff.textContent = '🔍';
      griff.title = 'Warenkorb vergrößern und bearbeiten';
      el.appendChild(griff);
    });
  }

  /* --------------------------------------------------------------- Die große Ansicht
     Bewusst mit den Bedienelementen der Zeile: Die Lupe soll zum ARBEITEN vergrößern.
     Die Zeilen sind eine Vorführung mit den echten Artikeln aus den Stammdaten - gespeichert
     wird davon nichts, wie überall im Baukasten. */
  function grossZeigen(item) {
    let fenster = document.getElementById('kcLupenFenster');
    if (!fenster) {
      fenster = document.createElement('div');
      fenster.id = 'kcLupenFenster';
      fenster.className = 'kc-lupenfenster';
      document.body.appendChild(fenster);
      fenster.addEventListener('click', (e) => {
        if (e.target.dataset.kcLupeZu || e.target === fenster) fenster.hidden = true;
      });
    }
    const sortiment = (window.KCKassenArtikel?.sortiment() || []).slice(0, 5);
    const zeilen = sortiment.length ? sortiment : [{ name: 'Beispielartikel', price: 0 }];
    const summe = zeilen.reduce((n, a) => n + (Number(a.price) || 0), 0);
    fenster.innerHTML = `
      <div class="kc-lupen-kasten">
        <div class="kc-lupen-kopf">
          <b>Warenkorb – vergrößert zum Bearbeiten</b>
          <button type="button" data-kc-lupe-zu="1">Schließen</button>
        </div>
        <div class="kc-lupen-zeilen">
          ${zeilen.map((a, n) => `
            <div class="kc-lupen-zeile">
              <span class="kc-lupen-menge">${n === 1 ? 2 : 1} ×</span>
              <span class="kc-lupen-name">${(a.name || '').replace(/[<>]/g, '')}</span>
              <span class="kc-lupen-preis">${(Number(a.price) || 0).toFixed(2).replace('.', ',')} €</span>
              <span class="kc-lupen-tasten"><i>−</i><i>+</i><i>%</i><i class="weg">🗑</i></span>
            </div>`).join('')}
        </div>
        <div class="kc-lupen-fuss">
          <span>${zeilen.length} Positionen</span>
          <b>${summe.toFixed(2).replace('.', ',')} €</b>
        </div>
        <p class="kc-lupen-hinweis">Vorführung im Baukasten: So sähe der vergrößerte Warenkorb
        aus. An der Kasse wird hier wirklich bearbeitet – Menge, Rabatt, Zeile löschen.</p>
      </div>`;
    fenster.hidden = false;
    melden(`Lupe am „${item.kcName || item.type}“ – so sieht der vergrößerte Warenkorb aus.`);
  }

  /* Der Griff darf NICHT selbst zuhören.
     GEFUNDEN 03.09.2026: Ein Listener direkt am Griff kam nie zum Zug. Der Designer zeichnet
     beim Antippen eines Bausteins die Fläche neu (renderProps/renderLayers), dabei wird der
     Griff durch einen frischen ersetzt - und der Klick landet auf einem Element, das es nicht
     mehr gibt. Dasselbe hatte das Rechtsklick-Menü am 02.09. Deshalb hört die BÜHNE zu, in der
     abfangenden Phase, und sucht das Teil über die Kennung statt über das Element. */
  function buehneVerdrahten() {
    const buehne = document.getElementById('stage');
    if (!buehne || buehne.dataset.kcLupeVerdrahtet) return;
    buehne.dataset.kcLupeVerdrahtet = '1';
    const fangen = (e) => {
      const griff = e.target.closest && e.target.closest('.kc-lupen-griff');
      if (!griff) return;
      /* NUR die Weitergabe anhalten, NICHT das Standardverhalten.
         GEFUNDEN 03.09.2026: Hier stand zusätzlich preventDefault() - und damit ging der Griff
         gar nicht auf. Chrome unterdrückt nach einem verhinderten pointerdown die daraus
         abgeleiteten Mausereignisse, also auch den Klick, auf den ich warte. Der Griff lag
         nachweislich unter dem Zeiger, die Ereigniskette war nur eine Stufe vorher gekappt -
         von mir selbst. */
      e.stopPropagation(); e.stopImmediatePropagation();
      /* Ausgelöst wird beim LOSLASSEN, nicht beim Klick.
         GEFUNDEN 03.09.2026: Auf "click" zu warten ging nicht - pointerdown und pointerup
         kamen nachweislich an, ein click entstand nie. Für ein Gerät, das mit dem Finger
         bedient wird, ist das Loslassen ohnehin der richtige Auslöser: Es gibt dort keinen
         Klick, nur eine Berührung, die endet. */
      if (e.type !== 'pointerup') return;
      const el = griff.closest('.designer-item');
      const item = el && (currentItems() || []).find((i) => i.id === el.dataset.id);
      if (item) grossZeigen(item);
    };
    ['pointerdown', 'pointerup', 'click'].forEach((n) => buehne.addEventListener(n, fangen, true));
  }

  function bereit() {
    return window.KCKassenbaukasten && document.getElementById('kcCleverPanel')
      && document.getElementById('stage')
      && typeof render === 'function';
  }

  function starte() {
    if (!bereit()) return false;
    feldErgaenzen();
    buehneVerdrahten();
    const echtesRender = render;
    render = function () {
      echtesRender.apply(this, arguments);
      try { feldPflegen(); griffeZeichnen(); } catch (e) { /* nie den Designer anhalten */ }
    };
    feldPflegen(); griffeZeichnen();
    console.info(`KC Kassenbaukasten Teil 9 (${VERSION}) bereit – Lupe am Warenkorb.`);
    return true;
  }

  let versuche = 0;
  const wecker = setInterval(() => { if (starte() || ++versuche > 240) clearInterval(wecker); }, 100);

  window.KCKassenLupe = { version: VERSION, istBon, bonflaechen, grossZeigen };
})();
