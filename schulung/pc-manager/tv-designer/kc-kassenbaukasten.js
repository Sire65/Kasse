/* KC Kassenbaukasten - Arbeitsmodus "Kassenoberfläche" im Designer.
 * Baustufe 1, 02.09.2026
 *
 * ANLASS (Betreiber): "Schau dir den Designer an. Dort gibt es eine Combobox für
 * Präsentationen und GUI. Wenn ich oben z. B. Tablet aussuche und die Größe von 9 Zoll, wird
 * mir eine solche Fläche angeboten mit den Maßen, Rastern, Bereichen etc. Und die
 * Objektbibliothek wechselt auf Kassenoberfläche und bietet nur die Sachen an, die für die
 * Seite erlaubt sind. Und auch clevere Objekte anbieten - welche die sich einklappen, oder
 * wegdrehen, oder bei Anklicken zoomen. Und es sollte sofort eine Unterseite mit angelegt
 * werden als zweite Seite mit den Zahlfunktionen. Normales Textfeld zum Aufziehen muss auch
 * vorhanden sein, um etwas frei zu beschriften."
 *
 * WARUM DIESE DATEI SEPARAT LIEGT
 * app.js ist 187 KB und trägt die ganze TV- und Präsentationsarbeit. Zwei Tage vor der
 * Vorführung schneide ich da nicht hinein. Der Designer hat ein eingeführtes Muster für
 * Erweiterungen: v027-enhancements.js und die beiden v0282-Dateien werden NACH app.js
 * geladen und greifen auf dessen Bindungen zu. Diese Datei folgt demselben Muster. Wird sie
 * nicht geladen, ist der Designer exakt wie vorher.
 *
 * DIE EINE ENTSCHEIDUNG, AUF DIE ES ANKOMMT
 * Der Designer setzt Objekte FREI auf die Fläche, in Pixeln. Für eine Folie ist das richtig -
 * eine Folie ist immer gleich groß. Eine Kasse ist es nicht: sie muss auf 1366x1024 UND auf
 * 768x1024 laufen. Genau daran ist die jetzige Oberfläche gescheitert - gemessen am
 * 02.09.2026: auf dem 9-Zoll-iPad hochkant ist die Artikelfläche 4 Pixel hoch, weil feste
 * Anteile sich gegenseitig auffressen.
 * Deshalb rasten die Bausteine hier in BEREICHE ein (Spalten und Zeilen), und gespeichert
 * wird nicht "x=312px", sondern "Spalte 5 bis 9, Zeile 2 bis 6". Aus solchen Angaben kann
 * die Kasse dasselbe Layout auf jeder Größe neu aufbauen. Gezogen wird trotzdem frei mit der
 * Maus - das Einrasten passiert beim Loslassen.
 */
'use strict';
(function () {
  const VERSION = '0.1.0';

  /* ------------------------------------------------------------------ Geräte
     Angaben in CSS-Pixeln - in der Größe, in der die Seite wirklich rechnet, nicht in Zoll.
     Genau die vier Formate, die auch die Prüfreihe tests/tuev/reihe-ipad.cjs misst; so
     bedeuten Werkstatt und Prüfstand dasselbe. */
  const GERAETE = [
    { id: 'ipad-gross-quer', name: 'iPad groß · quer', breite: 1366, hoehe: 1024 },
    { id: 'ipad-gross-hoch', name: 'iPad groß · hoch', breite: 1024, hoehe: 1366 },
    { id: 'ipad-9-quer', name: 'iPad 9 Zoll · quer', breite: 1024, hoehe: 768 },
    { id: 'ipad-9-hoch', name: 'iPad 9 Zoll · hoch', breite: 768, hoehe: 1024 },
    { id: 'pc-manager', name: 'PC-Manager · Bildschirm', breite: 1600, hoehe: 1000 },
    /* NACHGETRAGEN 03.09.2026 (Betreiber): "Evtl. noch anbieten, einen Handy-Bildschirm zu
       designen, als weitere Oberfläche zu den iPads."
       WICHTIG - und das ist keine Kleinigkeit: Ein Handy ist kein kleines iPad. Auf 390 x 844
       hochkant wäre ein Feld des 12x8-Rasters 32 px breit und 105 px hoch - damit lässt sich
       nichts bauen, was man mit dem Daumen trifft. Deshalb bringt jedes Gerät sein eigenes
       GRUNDRASTER mit: Tablets 12 x 8, Handy hochkant 6 x 12, Handy quer 12 x 6.
       Folge, die ausgesprochen gehört: Ein für das iPad gebauter Aufbau lässt sich NICHT
       unverändert auf das Handy übernehmen. Das Handy braucht eine eigene Oberfläche - genau
       dafür kann die Kasse ja mehrere hinterlegen. Beim Wechsel der Geräteklasse wird deshalb
       gefragt, statt still umzurechnen. */
    { id: 'handy-hoch', name: 'Handy · hoch', breite: 390, hoehe: 844, raster: [6, 12], klasse: 'handy' },
    { id: 'handy-quer', name: 'Handy · quer', breite: 844, hoehe: 390, raster: [12, 6], klasse: 'handy' },
  ];
  const GRUNDRASTER = (g) => (g && g.raster) || [12, 8];
  const KLASSE = (g) => (g && g.klasse) || 'tablet';

  /* ------------------------------------------------------------- Das Bereichsraster
     12 Spalten und 8 Zeilen. Zwölf, weil sich das ohne Rest in Hälften, Drittel und Viertel
     teilen lässt - damit sind "Bon nimmt ein Drittel" und "halbe halbe" beide sauber
     darstellbar. Acht Zeilen, weil eine Kopfzeile etwa eine Zeile hoch ist und man dann noch
     sieben zum Verteilen hat. */
  /* 02.09.2026, Nachtrag (Betreiber): "Eine Rastereinstellung von ohne, fein, grob usw. -
     dann rasten die Bausteine oder Baugruppen fest ein." Deshalb keine feste Zahl mehr,
     sondern Stufen. 12x8 bleibt die Grundstufe (zwölf teilt sich in Hälften, Drittel und
     Viertel; acht Zeilen lassen oben Platz für eine Kopfzeile). */
  /* Die Stufen sind VIELFACHE des Grundrasters, keine festen Zahlen mehr. Für die Tablets
     bleibt dadurch alles wie bisher (grob 6x4, normal 12x8, fein 24x16); das Handy bekommt
     6x12 / 3x6 / 12x24 - dieselbe Abstufung, auf seinem eigenen Grundraster. */
  const RASTERSTUFEN = [
    { id: 'ohne', name: 'ohne Raster (frei)', faktor: 0 },
    { id: 'grob', name: 'grob', faktor: 0.5 },
    { id: 'normal', name: 'normal', faktor: 1 },
    { id: 'fein', name: 'fein', faktor: 2 },
  ];
  let SPALTEN = 12, ZEILEN = 8, RASTERSTUFE = 'normal';

  /* --------------------------------------------------------------- Die Bausteine
     'seite' sagt, auf welcher Seite ein Baustein erlaubt ist: 'kasse' = Hauptseite,
     'zahlen' = die Unterseite, 'beide' = überall. Genau das meinte der Betreiber mit
     "nur die Sachen anbieten, die für die Seite erlaubt sind".
     'felder' ist die Standardgröße in Rasterfeldern [Spalten, Zeilen]. */
  const BAUSTEINE = [
    ['Kopfzeile', [
      ['kc-kopf-voll', 'Kopfzeile vollständig', { seite: 'kasse', felder: [12, 1], farbe: '#123a5c' }],
      ['kc-kopf-kompakt', 'Kopfzeile nur rechts', { seite: 'kasse', felder: [4, 1], farbe: '#123a5c' }],
    ]],
    ['Warengruppen', [
      ['kc-gruppen-leiste', 'Warengruppen als Leiste', { seite: 'kasse', felder: [8, 1], farbe: '#2f6f4f' }],
      ['kc-gruppen-spalte', 'Warengruppen als Spalte', { seite: 'kasse', felder: [2, 6], farbe: '#2f6f4f' }],
    ]],
    ['Artikel', [
      ['kc-artikel-gross', 'Artikel groß (5×3)', { seite: 'kasse', felder: [8, 4], farbe: '#3d6b8f' }],
      ['kc-artikel-mittel', 'Artikel mittel (6×4)', { seite: 'kasse', felder: [8, 4], farbe: '#3d6b8f' }],
      ['kc-artikel-klein', 'Artikel klein (7×4)', { seite: 'kasse', felder: [8, 4], farbe: '#3d6b8f' }],
    ]],
    ['Bon', [
      ['kc-bon-ausfuehrlich', 'Bon ausführlich (mit Bild)', { seite: 'kasse', felder: [4, 5], farbe: '#7a5230' }],
      ['kc-bon-kompakt', 'Bon kompakt', { seite: 'kasse', felder: [4, 5], farbe: '#7a5230' }],
      ['kc-bon-tabelle', 'Bon als Tabelle', { seite: 'kasse', felder: [4, 5], farbe: '#7a5230' }],
    ]],
    ['Zahlen', [
      ['kc-zahlen-fest', 'Zahlbereich fest im Bild', { seite: 'kasse', felder: [8, 2], farbe: '#1e6848' }],
      ['kc-zahlen-taste', 'Rückgeld-Taste (öffnet Seite 2)', { seite: 'kasse', felder: [2, 1], farbe: '#1e6848' }],
      ['kc-zahlen-scheine', 'Scheine und Münzen', { seite: 'zahlen', felder: [7, 3], farbe: '#1e6848' }],
      /* KORRIGIERT 03.09.2026: stand als 'zahlen'. Das war schlicht falsch - die laufende
         Kasse hat einen Ziffernblock (.keypad, 255 x 197) samt Reiterzeile auf der
         HAUPTSEITE, nicht erst auf der Zahlseite. Aufgefallen beim Nachbau der MagicPOS-
         Ansicht, die genau das auch so macht. Eine Werkstatt, die etwas verbietet, was das
         echte Werkstück hat, führt in die Irre. */
      ['kc-zahlen-block', 'Ziffernblock', { seite: 'beide', felder: [3, 4], farbe: '#1e6848' }],
      ['kc-zahlen-arten', 'Zahlungsarten (Bar, EC, Konto)', { seite: 'zahlen', felder: [3, 2], farbe: '#1e6848' }],
      ['kc-zahlen-rueckgeld', 'Rückgeld-Anzeige', { seite: 'zahlen', felder: [5, 2], farbe: '#1e6848' }],
    ]],
    ['Sondertasten', [
      ['kc-sonder-spalte', 'Sondertasten als Spalte', { seite: 'beide', felder: [2, 5], farbe: '#6b3f6b' }],
      ['kc-sonder-leiste', 'Sondertasten als Leiste', { seite: 'beide', felder: [6, 1], farbe: '#6b3f6b' }],
      ['kc-sonder-menue', 'Sondertasten hinter „Mehr“', { seite: 'beide', felder: [2, 1], farbe: '#6b3f6b' }],
    ]],
    ['Frei beschriften', [
      /* Der Betreiber ausdrücklich: "Normales Textfeld zum Aufziehen muss auch vorhanden
         sein." Das ist der vorhandene Texttyp des Designers - kein eigener Nachbau. */
      ['text', 'T  Textfeld'],
      ['rounded-rectangle', '▢  Fläche / Rahmen'],
    ]],
  ];

  /* ------------------------------------------------------------- Baugruppen
     ANLASS (Betreiber): "In der Objektbibliothek müssen auch schon fertige Blöcke liegen wie
     Warengruppen-Blöcke, Warenkorb-Blöcke, Tastenblöcke, Rückgeld-Blöcke klein und groß -
     dass man nicht jedes Einzelteil bauen muss, sondern Baugruppen."

     Eine Baugruppe setzt MEHRERE Bausteine in einem Rutsch an ihre Plätze und bindet sie
     zusammen, sodass sie sich gemeinsam schieben lassen. Die Plätze stehen relativ zum
     Absetzpunkt - eine Baugruppe lässt sich also überall hinlegen und behält ihre innere
     Ordnung.
     'teile' ist [Typ, Spaltenversatz, Zeilenversatz, Spalten, Zeilen]. */
  const BAUGRUPPEN = [
    ['bg-warengruppen-links', '▤ Warengruppen links + Artikel', {
      seite: 'kasse', felder: [8, 7], hinweis: 'Warengruppen als Spalte, daneben die Artikel',
      teile: [
        ['kc-gruppen-spalte', 0, 0, 2, 7],
        ['kc-artikel-mittel', 2, 0, 6, 7],
      ],
    }],
    ['bg-warengruppen-oben', '▤ Warengruppen oben + Artikel', {
      seite: 'kasse', felder: [8, 7], hinweis: 'Warengruppen als Leiste, darunter die Artikel',
      teile: [
        ['kc-gruppen-leiste', 0, 0, 8, 1],
        ['kc-artikel-mittel', 0, 1, 8, 6],
      ],
    }],
    ['bg-warenkorb-gross', '🧾 Warenkorb-Block groß', {
      seite: 'kasse', felder: [4, 7], hinweis: 'Ausführlicher Bon mit Bild, darunter die Sondertasten',
      teile: [
        ['kc-bon-ausfuehrlich', 0, 0, 4, 6],
        ['kc-sonder-leiste', 0, 6, 4, 1],
      ],
    }],
    ['bg-warenkorb-klein', '🧾 Warenkorb-Block klein', {
      seite: 'kasse', felder: [4, 5], hinweis: 'Kompakter Bon - mehr Positionen im Bild',
      teile: [
        ['kc-bon-kompakt', 0, 0, 4, 4],
        ['kc-zahlen-taste', 0, 4, 4, 1],
      ],
    }],
    ['bg-warenkorb-tabelle', '🧾 Warenkorb-Block als Tabelle', {
      seite: 'kasse', felder: [4, 5], hinweis: 'Wie bei den gekauften Kassen: schmale Zeilen, viele Positionen',
      teile: [
        ['kc-bon-tabelle', 0, 0, 4, 4],
        ['kc-zahlen-taste', 0, 4, 4, 1],
      ],
    }],
    ['bg-rueckgeld-klein', '💶 Rückgeld-Block klein', {
      seite: 'zahlen', felder: [7, 2], hinweis: 'Rückgeld-Anzeige und Zahlungsarten nebeneinander',
      teile: [
        ['kc-zahlen-rueckgeld', 0, 0, 5, 2],
        ['kc-zahlen-arten', 5, 0, 2, 2],
      ],
    }],
    ['bg-rueckgeld-gross', '💶 Rückgeld-Block groß', {
      seite: 'zahlen', felder: [12, 6], hinweis: 'Rückgeld, Scheine und Münzen, Ziffernblock und Zahlungsarten',
      teile: [
        ['kc-zahlen-rueckgeld', 0, 0, 7, 2],
        ['kc-zahlen-scheine', 0, 2, 7, 4],
        ['kc-zahlen-block', 7, 0, 3, 6],
        ['kc-zahlen-arten', 10, 0, 2, 6],
      ],
    }],
    ['bg-tasten-spalte', '⌨ Tastenblock rechts', {
      seite: 'beide', felder: [2, 6], hinweis: 'Sondertasten als Spalte, darunter „Mehr“',
      teile: [
        ['kc-sonder-spalte', 0, 0, 2, 5],
        ['kc-sonder-menue', 0, 5, 2, 1],
      ],
    }],
    ['bg-zahlbereich-unten', '💶 Zahlbereich fest unten', {
      seite: 'kasse', felder: [12, 2], hinweis: 'Der klassische Aufbau: Zahlbereich immer im Bild',
      teile: [
        ['kc-zahlen-fest', 0, 0, 9, 2],
        ['kc-sonder-spalte', 9, 0, 3, 2],
      ],
    }],
    ['bg-kopf-schmal', '▬ Kopfzeile schmal + Warengruppen', {
      seite: 'kasse', felder: [12, 2], hinweis: 'Nur die wichtigsten Knöpfe oben rechts, daneben die Warengruppen',
      teile: [
        ['kc-gruppen-leiste', 0, 0, 8, 1],
        ['kc-kopf-kompakt', 8, 0, 4, 1],
      ],
    }],
  ];
  const NACH_GRUPPE = new Map(BAUGRUPPEN.map(([id, b, meta]) => [id, { beschriftung: b, ...meta }]));

  /* Nachschlagewerk: Typ -> Angaben. */
  const NACH_TYP = new Map();
  BAUSTEINE.forEach(([, liste]) => liste.forEach(([typ, beschriftung, meta]) => {
    if (meta) NACH_TYP.set(typ, { beschriftung, ...meta });
  }));

  /* ------------------------------------------------------- Warten, bis app.js da ist
     Diese Datei wird nach app.js geladen, aber der Designer baut manches erst nach dem
     ersten render(). Deshalb wird geduldig gewartet, statt etwas zu erzwingen. */
  function bereit() {
    return typeof MODE_TOOLS === 'object' && typeof defaults === 'object'
      && typeof project === 'object' && typeof render === 'function'
      && document.getElementById('modeSelect');
  }

  function starte() {
    if (!bereit()) return false;

    /* 1. Die Bausteine als Standardgrößen eintragen. Ohne Eintrag in defaults tut addItem()
          gar nichts - das ist die Stelle, an der ein neuer Typ sonst stillschweigend
          verschwindet. */
    const feldBreite = () => Math.round(project.page.width / SPALTEN);
    const feldHoehe = () => Math.round(project.page.height / ZEILEN);
    NACH_TYP.forEach((meta, typ) => {
      defaults[typ] = {
        text: meta.beschriftung,
        w: meta.felder[0] * 85,     // vorläufig; beim Einfügen wird auf das Raster gerechnet
        h: meta.felder[1] * 85,
        color: '#ffffff',
        bg: meta.farbe,
        align: 'center',
      };
    });

    /* 2. Die Bibliothek für den neuen Modus. */
    MODE_TOOLS.kasse = [
      ['Baugruppen · fertige Blöcke', BAUGRUPPEN.map(([id, b]) => [id, b])],
      ...BAUSTEINE.map(([titel, liste]) => [titel, liste.map(([t, b]) => [t, b])]),
    ];

    /* 3. Der Modus in die vorhandene Combobox. */
    const modus = document.getElementById('modeSelect');
    if (!modus.querySelector('option[value="kasse"]')) {
      const o = document.createElement('option');
      o.value = 'kasse';
      o.textContent = 'Kassenoberfläche';
      modus.insertBefore(o, modus.firstChild);
    }

    /* 4. Die Gerätewahl daneben. Sie erscheint nur im Kassenmodus - im TV-Modus hat eine
          iPad-Größe nichts zu suchen. */
    if (!document.getElementById('kcGeraetWahl')) {
      const huelle = document.createElement('label');
      huelle.id = 'kcGeraetHuelle';
      huelle.className = 'kc-geraet-huelle';
      huelle.innerHTML = '<span>Gerät</span><select id="kcGeraetWahl"></select>'
        + '<span class="kc-geraet-masse" id="kcGeraetMasse"></span>';
      modus.parentElement.insertBefore(huelle, modus.nextSibling);
      const wahl = huelle.querySelector('#kcGeraetWahl');
      wahl.innerHTML = GERAETE.map((g) => `<option value="${g.id}">${g.name}</option>`).join('');
      wahl.onchange = () => geraetSetzen(wahl.value);
    }

    /* 4b. Ein Knopf für einen sauberen Start. WICHTIG: Der Moduswechsel allein wirft NICHTS
           weg - wer aus einer Präsentation heraus umschaltet, behält seine Folien. Wer eine
           Kassenoberfläche von vorn bauen will, drückt hier. Ein Moduswechsel, der ungefragt
           sechs Folien löscht, wäre der schlimmste Fehler, den diese Werkstatt machen kann. */
    if (!document.getElementById('kcNeuerAufbau')) {
      const knopf = document.createElement('button');
      knopf.id = 'kcNeuerAufbau';
      knopf.className = 'kc-neuer-aufbau';
      knopf.type = 'button';
      knopf.textContent = 'Neue Kassenoberfläche';
      knopf.title = 'Legt ein leeres Projekt mit zwei Seiten an: Kasse und Zahlen';
      knopf.onclick = () => neuerAufbau();
      document.getElementById('kcGeraetHuelle').appendChild(knopf);
    }

    /* 4c. Die "cleveren" Eigenschaften. Der Betreiber wollte Bausteine, die sich einklappen,
           wegdrehen oder beim Antippen zoomen. Das sind Eigenschaften EINES Bausteins, keine
           eigenen Bausteintypen - sonst hätte man jeden Baustein dreimal in der Bibliothek. */
    if (!document.getElementById('kcCleverPanel')) {
      const panel = document.createElement('div');
      panel.id = 'kcCleverPanel';
      panel.className = 'kc-clever-panel';
      panel.hidden = true;
      panel.innerHTML = '<h3>Verhalten des Bausteins</h3>'
        + '<label><input type="checkbox" data-kc-clever="kcKlappbar"> Einklappbar '
        + '<small>Nimmt zusammengeklappt nur eine Zeile ein</small></label>'
        + '<label><input type="checkbox" data-kc-clever="kcDrehen"> Wegdrehen '
        + '<small>Dreht zur Seite und gibt den Platz frei</small></label>'
        + '<label><input type="checkbox" data-kc-clever="kcZoom"> Beim Antippen vergrößern '
        + '<small>Legt sich groß über die Fläche, bis man wieder tippt</small></label>';
      const ziel = document.getElementById('toolbox');
      if (ziel && ziel.parentElement) ziel.parentElement.insertBefore(panel, ziel);
      /* Damit es beim Auswählen eines Bausteins auch wirklich zu sehen ist, wandert der
         Werkzeugbereich im Kassenmodus nach oben - die TV-Schnellstile darunter stören dort
         nur, siehe CSS. */
      panel.dataset.kcAngelegt = '1';
      panel.addEventListener('change', (e) => {
        const feld = e.target.dataset?.kcClever;
        if (!feld) return;
        const item = (currentItems() || []).find((x) => x.id === selected);
        if (!item) return;
        item[feld] = e.target.checked;
        render();
      });
    }

    /* 5. Beim Moduswechsel: Fläche einrichten, Unterseite anlegen, Bibliothek filtern. */
    const modusAlt = modus.onchange;
    modus.onchange = (e) => {
      if (typeof modusAlt === 'function') modusAlt.call(modus, e);
      if (project.mode === 'kasse') kassenmodusEinrichten();
      huelleZeigen();
    };

    /* 5b. addItem() umschließen. Klickt oder zieht jemand eine Baugruppe, wird nicht EIN
           Kasten eingefügt, sondern ihre Teile an ihre Plätze - zusammengebunden, sodass sie
           sich gemeinsam schieben lassen. Für alle anderen Typen bleibt alles wie gehabt. */
    const echtesAddItem = addItem;
    addItem = function (typ, x = 40, y = 40) {
      if (!NACH_GRUPPE.has(typ)) return echtesAddItem.apply(this, arguments);
      const meta = NACH_GRUPPE.get(typ);
      const bw = project.page.width / SPALTEN, bh = project.page.height / ZEILEN;
      /* Absetzpunkt in Rasterfelder umrechnen und so weit hereinholen, dass die ganze
         Baugruppe auf die Fläche passt - sonst hängt die Hälfte draußen. */
      let spalte = Math.max(0, Math.min(SPALTEN - meta.felder[0], Math.round(x / bw)));
      let zeile = Math.max(0, Math.min(ZEILEN - meta.felder[1], Math.round(y / bh)));
      const gruppe = (typeof uid === 'function') ? uid('grp') : 'grp' + Date.now();
      const gesetzt = [];
      meta.teile.forEach(([teilTyp, sv, zv, sp, ze]) => {
        const item = einsetzen(teilTyp, spalte + sv, zeile + zv, [sp, ze]);
        if (item) { item.groupId = gruppe; item.kcBaugruppe = typ; gesetzt.push(item); }
      });
      if (typeof status === 'function') {
        status(`Baugruppe „${meta.beschriftung}“ eingefügt – ${gesetzt.length} Bausteine, zusammengebunden.`);
      }
      render();
      return gesetzt[0] || null;
    };

    /* 6. render() umschließen: vor jedem Zeichnen die Bausteine ins Raster rücken und das
          Raster sichtbar machen. Das Original bleibt unangetastet und wird aufgerufen. */
    const echtesRender = render;
    render = function () {
      if ((project.mode || '') === 'kasse') rasterAusrichten();
      echtesRender.apply(this, arguments);
      if ((project.mode || '') === 'kasse') {
        rasterZeichnen(); bausteineBeschriften(); cleverPanelZeigen(); hinweisSetzen();
      }
      huelleZeigen();
    };

    /* 7. Wird ein Projekt geladen, das schon im Kassenmodus ist, sofort einrichten. */
    if ((project.mode || '') === 'kasse') kassenmodusEinrichten();
    huelleZeigen();
    console.info(`KC Kassenbaukasten ${VERSION} bereit - Modus "Kassenoberfläche" verfügbar.`);
    return true;
  }

  /* --------------------------------------------------------------- Gerät wählen */
  function geraetSetzen(id, ohneNachfrage) {
    const g = GERAETE.find((x) => x.id === id) || GERAETE[0];
    const alt = GERAETE.find((x) => x.id === project.kasse?.geraet);
    /* Wechsel der GERÄTEKLASSE: Tablet und Handy rechnen mit verschiedenen Grundrastern.
       Ein iPad-Aufbau lässt sich deshalb nicht unverändert aufs Handy übernehmen - er würde
       stillschweigend umgerechnet und käme verzerrt heraus. Also fragen, statt zu raten. */
    if (!ohneNachfrage && alt && KLASSE(alt) !== KLASSE(g)
        && project.slides.some((se) => (se.items || []).some((i) => NACH_TYP.has(i.type)))) {
      const [as, az] = GRUNDRASTER(alt), [ns, nz] = GRUNDRASTER(g);
      const weiter = confirm(
        `${alt.name} rechnet mit ${as} × ${az} Feldern, ${g.name} mit ${ns} × ${nz}.\n\n`
        + 'Ein Handy ist kein kleines iPad: Der Aufbau wird beim Wechsel umgerechnet und kommt '
        + 'dabei verzerrt heraus. Besser ist eine eigene Oberfläche für das Handy – die Kasse '
        + 'kann mehrere hinterlegen.\n\nTrotzdem umrechnen?');
      if (!weiter) {
        const wahl = document.getElementById('kcGeraetWahl');
        if (wahl && alt) wahl.value = alt.id;
        return;
      }
    }
    /* Das Grundraster des neuen Geräts gilt ab jetzt - die Stufe (grob/normal/fein) bleibt. */
    const stufe = RASTERSTUFEN.find((x) => x.id === RASTERSTUFE);
    const ziel = stufenRaster(stufe, g);
    if (ziel && (ziel[0] !== SPALTEN || ziel[1] !== ZEILEN)) {
      const fSp = ziel[0] / SPALTEN, fZ = ziel[1] / ZEILEN;
      project.slides.forEach((seite) => (seite.items || []).forEach((i) => {
        if (!NACH_TYP.has(i.type) || !i.kc) return;
        i.kc = {
          spalte: Math.round(i.kc.spalte * fSp), zeile: Math.round(i.kc.zeile * fZ),
          spalten: Math.max(1, Math.round(i.kc.spalten * fSp)),
          zeilen: Math.max(1, Math.round(i.kc.zeilen * fZ)),
        };
      }));
      SPALTEN = ziel[0]; ZEILEN = ziel[1];
    }
    project.page.width = g.breite;
    project.page.height = g.hoehe;
    project.kasse = project.kasse || {};
    project.kasse.geraet = g.id;
    const masse = document.getElementById('kcGeraetMasse');
    if (masse) masse.textContent = `${g.breite} × ${g.hoehe}`;
    /* Beim Wechsel der Fläche gilt ausdrücklich das Raster. Ohne diese Zeile hielte der
       nächste Durchlauf die alten Pixel für eine Mausbewegung und würde den ganzen Aufbau
       verschieben - so ist es beim ersten Bauen tatsächlich passiert. */
    project.slides.forEach((seite) => (seite.items || []).forEach((i) => {
      if (NACH_TYP.has(i.type) && i.kc) i.kcGesetzt = `${i.x}|${i.y}|${i.w}|${i.h}`;
    }));
    if (typeof status === 'function') status(`Fläche auf ${g.name} gesetzt (${g.breite} × ${g.hoehe})`);
    render();
  }

  /* app.js kennt nur drei Modi und schreibt sonst den TV-Text über die Bibliothek. */
  function hinweisSetzen() {
    const h = document.getElementById('modeNotice');
    if (!h) return;
    const seite = currentSlide?.()?.kcSeite || 'kasse';
    h.textContent = seite === 'zahlen'
      ? 'Zahlen-Seite: Scheine, Münzen, Ziffernblock und Zahlungsarten. Öffnet sich an der Kasse über die Rückgeld-Taste.'
      : 'Kassenoberfläche: Bausteine ins Bereichsraster ziehen. Gespeichert wird der Rasterplatz, nicht die Pixel – derselbe Aufbau läuft dadurch auf jedem Gerät.';
  }

  function huelleZeigen() {
    const h = document.getElementById('kcGeraetHuelle');
    if (!h) return;
    const an = (project.mode || '') === 'kasse';
    h.hidden = !an;
    document.body.classList.toggle('kc-kassenmodus', an);
    const wahl = document.getElementById('kcGeraetWahl');
    if (an && wahl && project.kasse?.geraet) wahl.value = project.kasse.geraet;
    const masse = document.getElementById('kcGeraetMasse');
    if (an && masse) masse.textContent = `${project.page.width} × ${project.page.height}`;
  }

  /* ------------------------------------------------- Kassenmodus einrichten */
  function kassenmodusEinrichten() {
    project.kasse = project.kasse || {};
    if (!project.kasse.geraet) geraetSetzen('ipad-9-quer');   // die kritische Größe zuerst
    else geraetSetzen(project.kasse.geraet);

    /* Die Unterseite. Der Betreiber: "Es sollte sofort eine Unterseite mit angelegt werden
       als zweite Seite mit den Zahlfunktionen." Sie wird EINMAL angelegt und danach an ihrem
       Namen wiedererkannt - nicht bei jedem Moduswechsel neu, sonst sammeln sich Seiten an. */
    const hatZahlseite = project.slides.some((s) => s.kcSeite === 'zahlen');
    if (!hatZahlseite) {
      const zahlseite = JSON.parse(JSON.stringify(project.slides[0]));
      zahlseite.id = (typeof uid === 'function') ? uid('slide') : 'slide-zahlen';
      zahlseite.name = 'Zahlen';
      zahlseite.kcSeite = 'zahlen';
      zahlseite.items = [];
      project.slides.push(zahlseite);
      if (project.slides[0]) project.slides[0].kcSeite = 'kasse';
      /* Die Zahlseite bekommt gleich die üblichen Bausteine - eine leere zweite Seite hilft
         niemandem, und so sieht man sofort, wofür sie da ist. */
      zahlseiteFuellen(zahlseite);
      if (typeof renderSlides === 'function') renderSlides();
      if (typeof status === 'function') status('Zweite Seite „Zahlen“ mit den Zahlfunktionen angelegt.');
    }
    bibliothekFiltern();
  }

  /* Einen Baustein an Rasterkoordinaten setzen (Spalte, Zeile, [Spalten, Zeilen]). */
  function einsetzen(typ, spalte, zeile, felder) {
    if (typeof addItem !== 'function') return null;
    addItem(typ, 0, 0);
    const liste = currentItems();
    const neu = liste[liste.length - 1];
    if (!neu) return null;
    const meta = NACH_TYP.get(typ);
    const bw = project.page.width / SPALTEN, bh = project.page.height / ZEILEN;
    neu.kc = { spalte, zeile,
      spalten: felder?.[0] || meta?.felder?.[0] || 3,
      zeilen: felder?.[1] || meta?.felder?.[1] || 2 };
    /* Pixel gleich mitsetzen UND als "selbst geschrieben" markieren - sonst hält der nächste
       Durchlauf die Nullposition für eine Mausbewegung und zieht den Baustein nach oben
       links. Genau dieser Fehler ist beim ersten Bauen aufgetreten. */
    neu.x = Math.round(neu.kc.spalte * bw);
    neu.y = Math.round(neu.kc.zeile * bh);
    neu.w = Math.round(neu.kc.spalten * bw);
    neu.h = Math.round(neu.kc.zeilen * bh);
    neu.kcGesetzt = `${neu.x}|${neu.y}|${neu.w}|${neu.h}`;
    return neu;
  }

  /* ------------------------------------------------- Bibliothek nach Seite filtern
     Auf der Zahlseite sollen keine Artikelkacheln angeboten werden und umgekehrt. Gefiltert
     wird die schon gezeichnete Werkzeugliste - so bleibt die Zeichenlogik von app.js
     unangetastet. */
  function bibliothekFiltern() {
    if ((project.mode || '') !== 'kasse') return;
    const seite = currentSlide?.()?.kcSeite || 'kasse';
    document.querySelectorAll('#toolbox .tool').forEach((b) => {
      const meta = NACH_TYP.get(b.dataset.type) || NACH_GRUPPE.get(b.dataset.type);
      /* "beide" heißt Kasse UND Zahlen - nicht "auf jeder Seite". Als am 03.09. die
         Info-Seite dazukam, erbte sie stillschweigend alle Zahltasten: Auf der Infoseite eines
         Glühweins wurden Geldscheine angeboten. Niemand meldet so etwas; man sieht es nur,
         wenn man hinschaut. Deshalb steht die Liste jetzt ausgeschrieben da. */
      const gilt = meta && meta.seite === 'beide' ? ['kasse', 'zahlen'] : [meta && meta.seite];
      const erlaubt = !meta || gilt.includes(seite);
      b.hidden = !erlaubt;
      b.title = erlaubt ? (meta?.hinweis || meta?.beschriftung || b.textContent)
        : `Auf dieser Seite nicht vorgesehen (gehört zu: ${meta.seite})`;
    });
    document.querySelectorAll('#toolbox .toolGroup').forEach((g) => {
      g.hidden = ![...g.querySelectorAll('.tool')].some((b) => !b.hidden);
    });
  }

  /* ------------------------------------------------------------- Raster
     Beim Zeichnen werden alle Bausteine auf Rasterfelder gerundet. Wer mit der Maus zieht,
     zieht frei; beim nächsten Zeichnen rastet der Baustein ein. Die Rasterangabe (Spalte,
     Zeile, Breite, Höhe in Feldern) ist das, was gespeichert wird - die Pixel sind nur die
     Darstellung auf dieser einen Fläche. */
  /* WELCHES IST DIE WAHRHEIT - das Raster oder die Pixel?
     Beim ersten Bauen war das nicht entschieden, und mein eigener Test hat sofort zwei
     Fehler gezeigt: alle Bausteine landeten auf Spalte 1/Zeile 1, und beim Wechsel des
     Geräts verrutschte der ganze Aufbau. Beides dieselbe Ursache - die Pixel wurden ins
     Raster zurückgerechnet, auch wenn gar niemand etwas verschoben hatte.

     Die Regel lautet jetzt: DAS RASTER IST DIE WAHRHEIT. Die Pixel sind nur die Darstellung
     auf dieser einen Fläche. Aus dem Raster werden die Pixel gerechnet - nicht umgekehrt.
     Nur wenn jemand einen Baustein wirklich mit der Maus bewegt hat, wird das Raster neu
     aus den Pixeln bestimmt. Erkannt wird das daran, dass die Pixel von dem abweichen, was
     zuletzt selbst geschrieben wurde. */
  /* Solange gezogen wird, wird NICHT eingerastet.
     Gemessen am 02.09.2026: Schieben ging, aber die Anfasser zum Größerziehen taten nichts.
     Ursache: Beim Ziehen zeichnet der Designer nach jedem Mausschritt neu; mein Einrasten
     schrieb dabei die Maße sofort wieder auf das Raster zurück und riss dem Anfasser den
     Boden unter den Füßen weg. Jetzt gilt: frei ziehen, beim Loslassen einrasten - so, wie
     man es von einer Werkstatt erwartet. */
  let zieht = false;
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest('#stage')) zieht = true;
  }, true);
  document.addEventListener('pointerup', () => {
    if (!zieht) return;
    zieht = false;
    if ((project.mode || '') === 'kasse') render();   // jetzt einrasten
  }, true);
  document.addEventListener('pointercancel', () => { zieht = false; }, true);

  function rasterAusrichten() {
    if (zieht) return;                                 // mitten im Ziehen: Finger weg
    if (RASTERSTUFE === 'ohne') return;                // frei gesetzt, nichts einrasten
    const bw = project.page.width / SPALTEN, bh = project.page.height / ZEILEN;
    (currentItems() || []).forEach((item) => {
      if (!NACH_TYP.has(item.type)) return;      // freie Texte und Flächen bleiben frei
      const meta = NACH_TYP.get(item.type);

      if (!item.kc) {
        /* Frisch eingefügt und noch ohne Rasterplatz: aus der jetzigen Lage bestimmen. */
        item.kc = ausPixeln(item, bw, bh, meta);
      } else if (verschoben(item)) {
        /* Von Hand bewegt oder in der Größe geändert: neuer Rasterplatz. */
        item.kc = ausPixeln(item, bw, bh, meta);
      }

      /* In jedem Fall: die Pixel AUS dem Raster setzen. Damit bleibt derselbe Aufbau bei
         jeder Flächengröße derselbe - das ist der ganze Zweck der Übung. */
      const k = item.kc;
      k.spalte = Math.max(0, Math.min(SPALTEN - 1, k.spalte));
      k.zeile = Math.max(0, Math.min(ZEILEN - 1, k.zeile));
      k.spalten = Math.max(1, Math.min(k.spalten, SPALTEN - k.spalte));
      k.zeilen = Math.max(1, Math.min(k.zeilen, ZEILEN - k.zeile));
      item.x = Math.round(k.spalte * bw);
      item.y = Math.round(k.zeile * bh);
      item.w = Math.round(k.spalten * bw);
      item.h = Math.round(k.zeilen * bh);
      item.kcGesetzt = `${item.x}|${item.y}|${item.w}|${item.h}`;
      if (!item.kcName) item.kcName = meta.beschriftung;
    });
  }

  /* Hat jemand den Baustein bewegt? Verglichen wird mit der Lage, die zuletzt selbst
     geschrieben wurde. Weicht sie ab, war es die Maus. */
  function verschoben(item) {
    return item.kcGesetzt !== `${item.x}|${item.y}|${item.w}|${item.h}`;
  }

  function ausPixeln(item, bw, bh, meta) {
    const spalte = Math.max(0, Math.min(SPALTEN - 1, Math.round(item.x / bw)));
    const zeile = Math.max(0, Math.min(ZEILEN - 1, Math.round(item.y / bh)));
    let spalten = Math.max(1, Math.round(item.w / bw));
    let zeilen = Math.max(1, Math.round(item.h / bh));
    if (!item.w || !item.h) { spalten = meta.felder[0]; zeilen = meta.felder[1]; }
    return { spalte, zeile,
      spalten: Math.min(spalten, SPALTEN - spalte),
      zeilen: Math.min(zeilen, ZEILEN - zeile) };
  }

  /* Die Rasterstufe wechseln. Wichtig: Die Bausteine sollen dabei STEHEN BLEIBEN. Wer von
     grob auf fein stellt, will feiner justieren können - nicht seinen Aufbau neu sortiert
     bekommen. Deshalb werden die Rasterplätze auf die neue Stufe umgerechnet, nicht die
     Pixel neu gesetzt. */
  /* Wie viele Felder eine Stufe auf dem AKTUELLEN Gerät bedeutet. */
  function stufenRaster(stufe, geraet) {
    if (!stufe || !stufe.faktor) return null;
    const [gs, gz] = GRUNDRASTER(geraet || GERAETE.find((x) => x.id === project.kasse?.geraet));
    return [Math.max(2, Math.round(gs * stufe.faktor)), Math.max(2, Math.round(gz * stufe.faktor))];
  }

  function rasterStufeSetzen(id) {
    const stufe = RASTERSTUFEN.find((x) => x.id === id) || RASTERSTUFEN[2];
    const altSp = SPALTEN, altZ = ZEILEN;
    RASTERSTUFE = stufe.id;
    const neuesRaster = stufenRaster(stufe);
    if (neuesRaster) {
      const [nsp, nz] = neuesRaster;
      const fSp = nsp / altSp, fZ = nz / altZ;
      project.slides.forEach((seite) => (seite.items || []).forEach((i) => {
        if (!NACH_TYP.has(i.type) || !i.kc) return;
        i.kc = {
          spalte: Math.round(i.kc.spalte * fSp), zeile: Math.round(i.kc.zeile * fZ),
          spalten: Math.max(1, Math.round(i.kc.spalten * fSp)),
          zeilen: Math.max(1, Math.round(i.kc.zeilen * fZ)),
        };
      }));
      SPALTEN = nsp; ZEILEN = nz;
    }
    project.kasse = project.kasse || {};
    project.kasse.rasterstufe = stufe.id;
    if (typeof status === 'function') {
      status(neuesRaster ? `Raster: ${stufe.name} (${SPALTEN} × ${ZEILEN})` : `Raster: ${stufe.name}`);
    }
    render();
  }

  /* Das Raster sichtbar machen - sonst rastet etwas ein und niemand weiß, woran. */
  function rasterZeichnen() {
    const buehne = document.getElementById('stage') || window.stage;
    if (!buehne) return;
    let netz = buehne.querySelector('.kc-raster');
    if (!netz) {
      netz = document.createElement('div');
      netz.className = 'kc-raster';
      buehne.insertBefore(netz, buehne.firstChild);
    }
    netz.hidden = RASTERSTUFE === 'ohne';
    if (netz.hidden) return;
    netz.style.setProperty('--kc-spalte', `${project.page.width / SPALTEN}px`);
    netz.style.setProperty('--kc-zeile', `${project.page.height / ZEILEN}px`);
  }

  /* Jeder Baustein bekommt eine Ecke mit seinem Rasterplatz - damit man beim Bauen sieht,
     was gespeichert wird, statt es raten zu müssen. */
  function bausteineBeschriften() {
    document.querySelectorAll('.designer-item').forEach((el) => {
      const item = (currentItems() || []).find((x) => x.id === el.dataset.id);
      if (!item || !item.kc) return;
      el.classList.add('kc-baustein');
      let marke = el.querySelector('.kc-marke');
      if (!marke) {
        marke = document.createElement('span');
        marke.className = 'kc-marke';
        el.appendChild(marke);
      }
      const eigenschaften = [];
      if (item.kcKlappbar) eigenschaften.push('einklappbar');
      if (item.kcDrehen) eigenschaften.push('wegdrehen');
      if (item.kcZoom) eigenschaften.push('Zoom');
      marke.textContent = `Sp ${item.kc.spalte + 1}–${item.kc.spalte + item.kc.spalten}`
        + ` · Z ${item.kc.zeile + 1}–${item.kc.zeile + item.kc.zeilen}`
        + (eigenschaften.length ? ` · ${eigenschaften.join(', ')}` : '');
    });
  }

  /* Ein sauberes Kassenprojekt: zwei Seiten, sonst nichts. */
  function neuerAufbau() {
    if (!confirm('Neue Kassenoberfläche anlegen?\n\nDie jetzigen Seiten dieses Projekts werden dabei ersetzt.')) return;
    const seite = (name, kcSeite) => ({
      id: (typeof uid === 'function') ? uid('slide') : 'slide-' + kcSeite,
      name, kcSeite, items: [], bg: '#f3f6f9', duration: 8, transition: 'none',
    });
    project.slides = [seite('Kasse', 'kasse'), seite('Zahlen', 'zahlen')];
    activeSlideId = project.slides[0].id;
    selected = null;
    if (typeof selectedIds !== 'undefined' && selectedIds.clear) selectedIds.clear();
    project.kasse = { geraet: project.kasse?.geraet || 'ipad-9-quer' };
    zahlseiteFuellen(project.slides[1]);
    /* Ein brauchbarer Anfang auf der Hauptseite - ein leeres Raster hilft niemandem beim
       Anfangen, und wegschieben ist leichter als hinstellen. */
    const vorher = activeSlideId;
    try {
      activeSlideId = project.slides[0].id;
      einsetzen('kc-kopf-kompakt', 8, 0, [4, 1]);
      einsetzen('kc-gruppen-spalte', 0, 1, [2, 7]);
      einsetzen('kc-artikel-mittel', 2, 1, [6, 5]);
      einsetzen('kc-bon-kompakt', 8, 1, [4, 6]);
      einsetzen('kc-zahlen-taste', 2, 6, [3, 2]);
      einsetzen('kc-sonder-leiste', 5, 6, [3, 2]);
    } finally { activeSlideId = vorher; }
    geraetSetzen(project.kasse.geraet);
    if (typeof renderSlides === 'function') renderSlides();
    render();
    bibliothekFiltern();
    if (typeof status === 'function') status('Neue Kassenoberfläche mit zwei Seiten angelegt.');
  }

  /* Die Zahlseite mit den üblichen Bausteinen bestücken. */
  function zahlseiteFuellen(seite) {
    const vorher = activeSlideId;
    try {
      activeSlideId = seite.id;
      einsetzen('kc-zahlen-rueckgeld', 0, 0, [7, 2]);
      einsetzen('kc-zahlen-scheine', 0, 2, [7, 4]);
      einsetzen('kc-zahlen-block', 7, 0, [3, 4]);
      einsetzen('kc-zahlen-arten', 10, 0, [2, 4]);
      einsetzen('kc-sonder-leiste', 0, 6, [12, 2]);
    } finally { activeSlideId = vorher; }
  }

  /* Das Verhaltensfeld folgt der Auswahl. */
  function cleverPanelZeigen() {
    const panel = document.getElementById('kcCleverPanel');
    if (!panel) return;
    const item = (currentItems() || []).find((x) => x.id === selected);
    const passt = item && NACH_TYP.has(item.type);
    panel.hidden = !passt;
    if (!passt) return;
    panel.querySelectorAll('[data-kc-clever]').forEach((k) => {
      k.checked = !!item[k.dataset.kcClever];
    });
  }

  /* --------------------------------------------------- Aufbau ausgeben
     Das Ergebnis der Werkstatt: eine kurze Beschreibung in Rasterkoordinaten, aus der die
     Kasse ihr Layout aufbauen kann. Bewusst KEINE Pixel - siehe Kopf dieser Datei. */
  function aufbauAlsText() {
    const seiten = project.slides.map((s) => ({
      name: s.name,
      seite: s.kcSeite || 'kasse',
      bausteine: (s.items || []).filter((i) => NACH_TYP.has(i.type)).map((i) => ({
        typ: i.type,
        spalte: i.kc?.spalte ?? 0, zeile: i.kc?.zeile ?? 0,
        spalten: i.kc?.spalten ?? 1, zeilen: i.kc?.zeilen ?? 1,
        klappbar: !!i.kcKlappbar, drehen: !!i.kcDrehen, zoom: !!i.kcZoom,
      })),
      freieTexte: (s.items || []).filter((i) => i.type === 'text').map((i) => ({
        text: i.text, x: i.x, y: i.y, w: i.w, h: i.h,
      })),
    }));
    return {
      version: VERSION, raster: { spalten: SPALTEN, zeilen: ZEILEN },
      geraet: project.kasse?.geraet || '', flaeche: { breite: project.page.width, hoehe: project.page.height },
      seiten,
    };
  }

  /* Nach außen sichtbar - für die Prüfreihen und später für die Kasse selbst. */
  window.KCKassenbaukasten = {
    version: VERSION, GERAETE, BAUSTEINE, BAUGRUPPEN, SPALTEN, ZEILEN,
    nachTyp: (t) => NACH_TYP.get(t) || null,
    geraetSetzen, aufbauAlsText, bibliothekFiltern, kassenmodusEinrichten, neuerAufbau,
  RASTERSTUFEN, rasterStufeSetzen, einsetzen, GRUNDRASTER, KLASSE,
  raster: () => ({ spalten: SPALTEN, zeilen: ZEILEN, stufe: RASTERSTUFE }),
  bausteinRegistrieren: (typ, meta) => { NACH_TYP.set(typ, meta); },
  bausteinListe: () => NACH_TYP,
  /* Eigene Baugruppen (Teil 3) tragen sich hier ein. Sie müssen im selben Nachschlagewerk
     stehen wie die mitgelieferten, sonst kennt die Seitenfilterung sie nicht und bietet eine
     Zahl-Baugruppe auch auf der Artikelseite an. */
  baugruppeRegistrieren: (id, meta) => { NACH_GRUPPE.set(id, meta); },
  baugruppeVergessen: (id) => NACH_GRUPPE.delete(id),
  nachGruppe: (id) => NACH_GRUPPE.get(id) || null,
  };

  /* Die Seitenwahl wechselt die erlaubten Bausteine mit. */
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.slideCard')) return;
    setTimeout(bibliothekFiltern, 60);
  }, true);

  /* Geduldig warten, bis app.js fertig ist. Höchstens zehn Sekunden - danach wäre etwas
     anderes kaputt, und ein endloser Wecker würde das nur verschleiern. */
  let versuche = 0;
  const wecker = setInterval(() => {
    if (starte() || ++versuche > 100) clearInterval(wecker);
  }, 100);
})();
