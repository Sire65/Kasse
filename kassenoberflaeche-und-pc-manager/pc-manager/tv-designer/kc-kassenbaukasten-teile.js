/* KC Kassenbaukasten, Teil 2: Knopf-Bibliothek, Symbol-Bibliothek, Rechtsklick-Menü,
 * Rasterstufen.  02.09.2026
 *
 * ANLASS (Betreiber): "Rechte Maustaste auf jedem Einzelteil und kontextsensitives Menü mit
 * Größe, Verschieben, Duplizieren, Farbe ändern, Beschriftung ändern, Rahmenstärke, Krümmung
 * einstellen, dass es nicht ein Viereck sein muss sondern mit abgerundeten Ecken. Und eine
 * Button-Bibliothek für die kleinen Buttons wie Tür, Uhr, LED-Blöcke usw., die schon für die
 * Kopfzeile wählbar sein müssen. Eine Icon-Bibliothek, damit man das Icon auf einen Button
 * ziehen kann, damit der beschriftet ist. Und eine Rastereinstellung von ohne, fein, grob."
 *
 * WOHER DIE TEILE KOMMEN
 * Nicht ausgedacht, sondern am 02.09.2026 an der laufenden Kasse abgelesen (Inventur, 1366 x
 * 1024). Jeder Knopf hier gibt es in der echten Kasse wirklich, mit seiner echten Kennung und
 * seinem echten Maß. Seine Beispiele stehen alle darin: die Tür ist #headerExitBtn, die Uhr
 * ist #timeClockBtn, der LED-Block ist #kcLedBlock.
 * Deshalb ist diese Datei die Übersetzung der Inventur in die Bibliothek - wer später einen
 * Knopf in der Kasse umbenennt, sieht hier, wo er eingetragen ist.
 */
'use strict';
(function () {
  const VERSION = '0.2.2';

  /* ------------------------------------------------ Die kleinen Knöpfe (aus der Inventur)
     'echt' nennt die Kennung in der laufenden Kasse - damit später niemand raten muss,
     welcher Baustein welchem Knopf entspricht.
     'felder' ist die Standardgröße in Rasterfeldern. Die meisten sind 1x1: ein Knopf. */
  const KNOEPFE = [
    ['Kopfzeile · Knöpfe', [
      ['kn-tuer', '🚪 Tür / Programm verlassen', { echt: '#headerExitBtn', mass: '40×40' }],
      ['kn-uhr', '◷ Uhr / Zeiterfassung', { echt: '#timeClockBtn', mass: '40×40' }],
      ['kn-leds', '🟢 LED-Block (Gerät · Sicherung · Online)', { echt: '#kcLedBlock', mass: '182×40', felder: [2, 1] }],
      ['kn-menue', '☰ Menü', { echt: '#menuBtn', mass: '40×40' }],
      ['kn-sperre', '🔒 Bildschirmsperre', { echt: '#screenLockBtn', mass: '40×40' }],
      ['kn-ton', '🔊 Ton ein und aus', { echt: '#cashSoundBtn', mass: '40×40' }],
      ['kn-programm', '📅 Programmstatus', { echt: '#kcProgramStatusBtn', mass: '40×40' }],
      ['kn-spiegeln', '🔄 Ansicht spiegeln', { echt: '#mirrorLayoutBtn', mass: '40×40' }],
      ['kn-bediener', '👤 Bediener / Team', { echt: '#operatorBtn', mass: '112×42', felder: [2, 1] }],
      ['kn-logo', '🍳 Clublogo', { echt: '#clubLogo', mass: '62×42' }],
      ['kn-titel', '▬ Titelzeile Köcheclub', { echt: '#secretTrigger', mass: '210×57', felder: [3, 1] }],
    ]],
    ['Kopfzeile · Betriebsarten', [
      ['kn-training', '🎓 Trainingsmodus', { echt: '#trainingModeTopBtn', mass: '133×42', felder: [2, 1] }],
      ['kn-stosszeit', '⏱ Stoßzeiten', { echt: '#rushModeBtn', mass: '100×42', felder: [2, 1] }],
      ['kn-happyhour', '🍹 Happy Hour', { echt: '#happyHourQuickBtn', mass: '108×42', felder: [2, 1] }],
      ['kn-meldungen', '↶ Meldungen', { echt: '#messageHistoryBtn', mass: '40×38' }],
    ]],
    ['Sondertasten (die großen)', [
      ['kn-konto', '📄 Auf Konto', { echt: '#accountChargeBtn', mass: '94×119' }],
      ['kn-personal', '👥 Personal', { echt: '#staffBtn', mass: '94×119' }],
      ['kn-pfand', '♻ Pfandrückgabe', { echt: '#depositBtn', mass: '94×119' }],
      ['kn-trinkgeld', '💝 Trinkgeld', { echt: '#tipBtn', mass: '94×119' }],
      ['kn-reklamation', '↩ Reklamation', { echt: '#complaintBtn', mass: '94×119' }],
      ['kn-mehr', '••• Mehr', { echt: '#moreBtn', mass: '94×119' }],
    ]],
    ['Zahlen · Einzelteile', [
      ['kn-bar', '💶 BAR abschließen', { echt: '#payBtn', mass: '142×243', felder: [2, 3], seite: 'beide' }],
      ['kn-stimmtso', '✓ Stimmt so', { echt: '#exactCashBtn', mass: '229×54', felder: [3, 1], seite: 'beide' }],
      ['kn-aufrunden', '⤴ Aufrunden', { echt: '#roundUpBtn', mass: '144×54', felder: [2, 1], seite: 'beide' }],
      ['kn-schein', '💵 Geldschein', { echt: '.banknote-button', mass: '73×60', seite: 'beide' }],
      ['kn-muenze', '🪙 Münze', { echt: '.coin-button', mass: '89×38', seite: 'beide' }],
      ['kn-zurueck', '↶ Geldwahl zurück', { echt: '#undoCashBtn', mass: '69×34', seite: 'beide' }],
      ['kn-ziffer', '⌨ Zifferntaste', { echt: '.keypad button', mass: '58×44', seite: 'beide' }],
      ['kn-okkey', '✓ OK-Taste am Ziffernblock', { echt: '.ok-key', mass: '58×44', seite: 'beide' }],
      /* Ebenfalls nachgetragen: die Reiterzeile über dem Ziffernblock. Sie kann mehr, als
         ich beim ersten Ablesen gesehen habe - sechs Betriebsarten: Bargeld, Menge, Rabatt,
         Artikel, Bon und Preis. "Preis" ist unsere freie Preiseingabe; bei den fremden
         Kassen heißt so etwas "Diverse Artikel". */
      ['kn-zahlartreiter', '💶 Reiterzeile (Bargeld · Menge · Rabatt · Artikel · Bon · Preis)',
        { echt: '.keypad-mode-row', mass: '255×34', felder: [3, 1], seite: 'beide' }],
    ]],
    ['Warenkorb · Einzelteile', [
      ['kn-menge', '#️⃣ Mengentaste', { echt: '.cart-quantity-bar button', mass: '52×34' }],
      ['kn-rueckgaengig', '↶ Menge rückgängig', { echt: '#undoQuantityBtn', mass: '42×34' }],
      ['kn-bonloeschen', '🗑 Ganzen Bon löschen', { echt: '#voidBonBtn', mass: '470×23', felder: [4, 1] }],
      ['kn-rabatt', '🏷 Rabatt', { echt: '#discountBtn', mass: '92×34', felder: [2, 1] }],
      ['kn-posrabatt', '🏷 Positionsrabatt', { echt: '.position-discount-button', mass: '88×32', felder: [2, 1] }],
      ['kn-zeileloeschen', '🗑 Zeile löschen', { echt: '.delete-row', mass: '32×32' }],
      ['kn-mehrmengen', '… Weitere Mengen', { echt: '#moreQuantityBtn', mass: '52×34' }],
    ]],
    ['Artikel · Einzelteile', [
      ['kn-artikelkachel', '🖼 Einzelne Artikelkachel', { echt: '.product-tile', mass: '187×230', felder: [2, 2] }],
      ['kn-varianten', '➕ Variantenknopf', { echt: '.product-variant-button', mass: '50×50' }],
      ['kn-info', 'ℹ Artikelinfo', { echt: '.product-info-button', mass: '48×48' }],
      ['kn-blaettern', '‹ › Seite blättern', { echt: '#productPagePrev', mass: '112×52', felder: [2, 1] }],
      ['kn-warengruppe', '▤ Einzelne Warengruppe', { echt: '.category-tabs button', mass: '116×66', felder: [2, 1] }],
      /* NACHGETRAGEN 03.09.2026: Beim Vergleich mit fremden Kassen aufgefallen, dass unsere
         eigene Artikelsuche in der Inventur vom 02.09. fehlte - sie ist da, ich hatte sie
         übersehen. Sie sitzt in .product-search-wrap (280 × 42) über der Artikelfläche. */
      ['kn-suche', '🔍 Artikelsuche', { echt: '#productSearchInput', mass: '150×38', felder: [2, 1] }],
    ]],
  ];

  /* ================================================== GEPLANT - noch nicht in der Kasse
     ANLASS 03.09.2026 (Betreiber, nach dem Vergleich mit fremden Kassen): "Bon parken" ist
     die einzige Funktion, die uns wirklich fehlt. Entschieden: vorerst NUR als Bauteil im
     Baukasten, damit sich im Layout ansehen lässt, wo die Taste hin soll. An der Kasse selbst
     wird nichts geändert.

     WARUM EINE EIGENE LISTE UND NICHT UNTEN BEI DEN ANDEREN
     Alles in KNOEPFE ist an der laufenden Kasse abgelesen und trägt seine echte Kennung. Ein
     geplantes Teil hat keine. Stünde es zwischen den anderen, wäre nach ein paar Wochen nicht
     mehr zu unterscheiden, was gebaut ist und was gewünscht - und genau diese Sorte
     Vermischung war diese Woche schon zweimal die Ursache eines Fehlers. Deshalb: eigene
     Liste, eigene Gruppe in der Bibliothek, eigene Farbe auf der Fläche, Zeichen ⧗ davor.

     Festgelegt am 03.09.2026:
     - Der geparkte Bon bleibt auf dem Gerät, auf dem er geparkt wurde. Nicht synchronisiert:
       Läge er auf beiden Kassen, könnten ihn zwei Leute zurückholen und doppelt abschließen.
     - Er bekommt keine Bonnummer, geht nicht in die Kette, zählt nicht in den Umsatz. Erst
       beim Abschließen wird ein Bon daraus.
     - Am Stand wird erst gezahlt, dann ausgegeben (vom Betreiber bestätigt). Ein geparkter Bon
       ist damit nur ein Merkzettel - Verwerfen kostet nichts und storniert nichts, weil nie
       etwas verkauft wurde.
     - Kein automatisches Verfallen. Was von selbst verschwindet, meldet keinen Fehler. */
  const GEPLANT = [
    ['pl-parken', '⧗ 🅿 Bon parken / geparkte Bons',
      { felder: [1, 1], seite: 'kasse',
        zweck: 'Eine Taste, zwei Bedeutungen: Liegt etwas im Korb, parkt sie ihn. Ist der Korb leer, zeigt sie die geparkten Bons mit Zähler.' }],
    ['pl-parkstreifen', '⧗ 🅿 Streifen der geparkten Bons',
      { felder: [4, 1], seite: 'kasse',
        zweck: 'Schmale Zeile über dem Warenkorb, die nur erscheint, wenn wirklich etwas geparkt liegt - sonst null Pixel. Beschriftet sich selbst: Uhrzeit, Positionen, Summe, erster Artikel.' }],
  ];

  /* ----------------------------------------------- Die Symbole (aus derselben Inventur)
     Alle Zeichen, die in der laufenden Kasse tatsächlich vorkommen. Nichts Erfundenes -
     wer hier ein Symbol wählt, sieht dasselbe wie am Marktstand. */
  const SYMBOLE = [
    ['🚪', 'Tür / verlassen'], ['◷', 'Uhr / Zeit'], ['🔒', 'Sperre'], ['🔊', 'Ton'],
    ['📅', 'Programm / Termin'], ['☰', 'Menü'], ['🔄', 'Spiegeln / Wechsel'], ['👤', 'Person'],
    ['👥', 'Personal'], ['📄', 'Konto / Beleg'], ['♻', 'Pfand'], ['💝', 'Trinkgeld'],
    ['↩', 'Reklamation'], ['🏷', 'Rabatt'], ['🗑', 'Löschen'], ['↶', 'Rückgängig'],
    ['🛒', 'Warenkorb'], ['💶', 'Bargeld'], ['⌫', 'Zeichen löschen'], ['✓', 'Bestätigen'],
    ['⤴', 'Aufrunden'], ['➕', 'Hinzufügen'], ['ℹ', 'Auskunft'], ['●', 'Zustand / Punkt'],
    ['🍳', 'Küche'], ['🎓', 'Schulung'], ['⏱', 'Stoßzeit'], ['🍹', 'Happy Hour'],
    ['🥂', 'Gläser'], ['🍽', 'Speisen'], ['🔴', 'Rot'], ['🟢', 'Grün'], ['🟡', 'Gelb'],
    ['‹', 'zurück'], ['›', 'weiter'], ['•••', 'mehr'],
  ];

  /* ------------------------------------------------------------------ Warten auf Teil 1 */
  function bereit() {
    return window.KCKassenbaukasten && typeof MODE_TOOLS === 'object'
      && typeof defaults === 'object' && document.getElementById('modeSelect');
  }

  function starte() {
    if (!bereit()) return false;
    const K = window.KCKassenbaukasten;

    /* 1. Die Knöpfe als Bausteine anmelden - sie rasten wie alle anderen ins Raster ein. */
    KNOEPFE.forEach(([, liste]) => liste.forEach(([typ, beschriftung, meta]) => {
      const felder = meta.felder || [1, 1];
      K.bausteinRegistrieren(typ, {
        beschriftung, felder, farbe: '#41556b',
        seite: meta.seite || 'kasse', hinweis: `${meta.echt} · ${meta.mass} in der echten Kasse`,
        echt: meta.echt, mass: meta.mass, istKnopf: true,
      });
      defaults[typ] = { text: beschriftung, w: felder[0] * 85, h: felder[1] * 85,
        color: '#ffffff', bg: '#41556b', align: 'center' };
    }));

    /* 1b. Die geplanten Teile - gleiche Mechanik, aber eigene Farbe und eigener Hinweis.
           Sie lassen sich bauen wie alles andere; nur steht überall dran, dass es sie an der
           Kasse noch nicht gibt. */
    GEPLANT.forEach(([typ, beschriftung, meta]) => {
      K.bausteinRegistrieren(typ, {
        beschriftung, felder: meta.felder, farbe: '#8a6c1f',
        seite: meta.seite, hinweis: `GEPLANT – in der Kasse noch nicht vorhanden. ${meta.zweck}`,
        geplant: true, zweck: meta.zweck, istKnopf: true,
      });
      defaults[typ] = { text: beschriftung, w: meta.felder[0] * 85, h: meta.felder[1] * 85,
        color: '#ffffff', bg: '#8a6c1f', align: 'center' };
    });

    /* 2. In die Bibliothek einhängen - hinter die Baugruppen, vor die freien Elemente. */
    const bestand = MODE_TOOLS.kasse || [];
    const frei = bestand.filter(([t]) => /Frei beschriften/.test(t));
    const rest = bestand.filter(([t]) => !/Frei beschriften/.test(t));
    MODE_TOOLS.kasse = [
      ...rest,
      ...KNOEPFE.map(([titel, liste]) => [titel, liste.map(([t, b]) => [t, b])]),
      ['Geplant · noch nicht in der Kasse', GEPLANT.map(([t, b]) => [t, b])],
      ['Symbole · auf einen Knopf ziehen', SYMBOLE.map(([z, n]) => [`sym-${z}`, `${z}  ${n}`])],
      ...frei,
    ];

    /* 3. Symbole sind KEINE Bausteine - sie beschriften einen vorhandenen Knopf.
          Deshalb wird addItem für sie abgefangen: nichts einfügen, sondern das ausgewählte
          Teil beschriften. Zusätzlich lassen sie sich auf ein Teil ziehen. */
    const echtesAddItem = addItem;
    addItem = function (typ, x, y) {
      if (!String(typ).startsWith('sym-')) return echtesAddItem.apply(this, arguments);
      const zeichen = String(typ).slice(4);
      /* GEFUNDEN 03.09.2026: Hier stand nur "nimm das ausgewählte Teil". Damit landete ein
         Symbol, das man auf einen bestimmten Knopf ZIEHT, trotzdem auf dem zuletzt
         ausgewählten - der Zielort wurde stillschweigend ignoriert. Aufgefallen ist es erst,
         als ich das Ziehen mit der echten Maus gemessen habe; mit einem Funktionsaufruf
         hätte es immer richtig ausgesehen.
         Der Designer übergibt beim Ziehen die Stelle auf der Fläche (x, y). Also wird zuerst
         dort nachgesehen, welcher Baustein darunter liegt, und nur ohne Stelle - beim Klicken
         in der Bibliothek - gilt die Auswahl. */
      let item = null;
      if (Number.isFinite(x) && Number.isFinite(y)) {
        item = (currentItems() || []).find((i) => x >= i.x && x <= i.x + i.w
          && y >= i.y && y <= i.y + i.h) || null;
        if (item) selected = item.id;
      }
      if (!item) item = (currentItems() || []).find((i) => i.id === selected);
      if (!item) {
        if (typeof status === 'function') status('Erst einen Knopf auswählen, dann das Symbol anklicken – oder das Symbol direkt auf den Knopf ziehen.');
        return null;
      }
      symbolSetzen(item, zeichen);
      return item;
    };

    function symbolSetzen(item, zeichen) {
      item.kcSymbol = zeichen;
      const ohne = String(item.text || '').replace(/^[^\p{L}\p{N}]+\s*/u, '').trim();
      item.text = `${zeichen} ${ohne}`.trim();
      render();
      if (typeof status === 'function') status(`Symbol ${zeichen} gesetzt.`);
    }

    /* Ziehen: Das Symbol wird auf der Fläche über einem Teil losgelassen. */
    const buehne = document.getElementById('stage');
    if (buehne && !buehne.dataset.kcSymbolZiel) {
      buehne.dataset.kcSymbolZiel = '1';
      buehne.addEventListener('dragover', (e) => { if (istSymbolZug(e)) e.preventDefault(); });
      buehne.addEventListener('drop', (e) => {
        const typ = e.dataTransfer?.getData('text/plain') || '';
        if (!typ.startsWith('sym-')) return;
        e.preventDefault(); e.stopPropagation();
        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.designer-item');
        const item = el && (currentItems() || []).find((i) => i.id === el.dataset.id);
        if (!item) { if (typeof status === 'function') status('Das Symbol muss auf einem Knopf losgelassen werden.'); return; }
        selected = item.id;
        symbolSetzen(item, typ.slice(4));
      }, true);
    }
    function istSymbolZug(e) {
      return [...(e.dataTransfer?.types || [])].includes('text/plain');
    }

    /* 4. Die Rasterstufe neben die Gerätewahl. */
    if (!document.getElementById('kcRasterWahl')) {
      const huelle = document.getElementById('kcGeraetHuelle');
      if (huelle) {
        const feld = document.createElement('span');
        feld.className = 'kc-raster-wahl';
        feld.innerHTML = '<span>Raster</span><select id="kcRasterWahl"></select>';
        huelle.insertBefore(feld, huelle.querySelector('#kcNeuerAufbau'));
        const w = feld.querySelector('select');
        w.innerHTML = K.RASTERSTUFEN.map((r) => `<option value="${r.id}">${r.name}</option>`).join('');
        w.value = K.raster().stufe;
        w.onchange = () => K.rasterStufeSetzen(w.value);
      }
    }

    /* 5. Das Rechtsklick-Menü. */
    menueAufbauen();

    console.info(`KC Kassenbaukasten Teil 2 (${VERSION}) bereit – Knöpfe, Symbole, Rechtsklick-Menü, Rasterstufen.`);
    return true;
  }

  /* ================================================================= Rechtsklick-Menü */
  function menueAufbauen() {
    if (document.getElementById('kcKontextMenue')) return;
    const menue = document.createElement('div');
    menue.id = 'kcKontextMenue';
    menue.className = 'kc-kontext';
    menue.hidden = true;
    document.body.appendChild(menue);

    /* WICHTIG: in der ABFANGENDEN Phase (true), nicht in der aufsteigenden.
       Der Designer hat ein eigenes Rechtsklick-Menü an der Fläche (stage.oncontextmenu).
       Das läuft vor einem Listener am document - und zeichnet dabei die Fläche neu. Danach
       ist das angeklickte Element nicht mehr im Dokument, und meine Prüfung "liegt das Teil
       auf der Fläche?" schlug fehl: Das Menü ging einfach nicht auf, ohne jede Fehlermeldung.
       Zwei Stunden Suche wert - deshalb steht es hier.
       In der abfangenden Phase komme ich zuerst dran, halte das Ereignis an und öffne mein
       Menü. Das alte Menü bleibt für die anderen Arbeitsmodi unverändert bestehen. */
    document.addEventListener('contextmenu', (e) => {
      if ((project.mode || '') !== 'kasse') return;
      const el = e.target.closest('.designer-item');
      if (!el || !el.closest('#stage')) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const id = el.dataset.id;              // die Kennung merken, nicht das Element
      const x = e.clientX, y = e.clientY;
      selected = id;
      render();                               // zeichnet neu - el ist danach ungültig
      menueZeigen(x, y);
    }, true);
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('#kcKontextMenue')) menue.hidden = true;
    }, true);

    /* GEFUNDEN BEIM PRÜFEN, 02.09.2026 - und der unangenehmste Fund des Tages:
       Der Designer beendet das Ziehen nur, wenn das Loslassen auf der FLÄCHE ankommt
       (stage.pointerup setzt drag = null). Mein Menü öffnet sich aber genau unter dem Zeiger,
       und liegt darüber - das Loslassen der rechten Maustaste landet also auf dem Menü, nicht
       auf der Fläche. Der Designer blieb dadurch im Zustand "wird gerade gezogen".
       Folge: Danach genügte es, die Maus über die Fläche zu BEWEGEN, ohne jede gedrückte
       Taste - und die zuletzt angefassten Bauteile wanderten mit, teils auf veraltete
       Startwerte, also mit einem Sprung. Nichts meldete einen Fehler.
       Deshalb hier: Jedes Loslassen im ganzen Fenster beendet das Ziehen. Das ist dieselbe
       Wirkung wie beim Designer selbst, nur nicht auf die Fläche beschränkt. */
    document.addEventListener('pointerup', () => {
      if (typeof drag !== 'undefined' && drag) drag = null;
    }, true);
    document.addEventListener('pointercancel', () => {
      if (typeof drag !== 'undefined' && drag) drag = null;
    }, true);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') menue.hidden = true; });
  }

  function aktuell() { return (currentItems() || []).find((i) => i.id === selected) || null; }

  function menueZeigen(x, y) {
    const menue = document.getElementById('kcKontextMenue');
    const item = aktuell();
    if (!item) return;
    const K = window.KCKassenbaukasten;
    const meta = K.nachTyp(item.type);
    const r = K.raster();
    const kc = item.kc || { spalte: 0, zeile: 0, spalten: 1, zeilen: 1 };

    menue.innerHTML = `
      <div class="kc-kontext-kopf">${(meta?.beschriftung || item.type)}
        ${meta?.echt ? `<small>${meta.echt} · ${meta.mass}</small>` : ''}</div>

      <div class="kc-kontext-block"><b>Größe</b>
        <label>Spalten <input type="number" min="1" max="${r.spalten || 48}" value="${kc.spalten}" data-kc="spalten"></label>
        <label>Zeilen <input type="number" min="1" max="${r.zeilen || 32}" value="${kc.zeilen}" data-kc="zeilen"></label>
      </div>

      <div class="kc-kontext-block"><b>Verschieben</b>
        <label>Spalte <input type="number" min="1" max="${r.spalten || 48}" value="${kc.spalte + 1}" data-kc="spalte"></label>
        <label>Zeile <input type="number" min="1" max="${r.zeilen || 32}" value="${kc.zeile + 1}" data-kc="zeile"></label>
        <div class="kc-kontext-pfeile">
          <button data-kc-move="0,-1" title="nach oben">↑</button>
          <button data-kc-move="-1,0" title="nach links">←</button>
          <button data-kc-move="1,0" title="nach rechts">→</button>
          <button data-kc-move="0,1" title="nach unten">↓</button>
        </div>
      </div>

      <div class="kc-kontext-block"><b>Aussehen</b>
        <label>Farbe <input type="color" value="${farbeAls(item.bg || '#41556b')}" data-kc="bg"></label>
        <label>Rahmenfarbe <input type="color" value="${farbeAls(item.stroke || '#0d2b45')}" data-kc="stroke"></label>
        <label>Rahmenstärke <input type="range" min="0" max="12" value="${item.strokeWidth ?? 0}" data-kc="strokeWidth">
          <output>${item.strokeWidth ?? 0} px</output></label>
        <label>Krümmung der Ecken <input type="range" min="0" max="48" value="${item.radius ?? 10}" data-kc="radius">
          <output>${item.radius ?? 10} px</output></label>
      </div>

      <div class="kc-kontext-block"><b>Beschriftung</b>
        <input type="text" value="${String(item.text || '').replace(/"/g, '&quot;')}" data-kc="text" placeholder="Beschriftung">
      </div>

      <div class="kc-kontext-aktionen">
        <button data-kc-tun="duplizieren">Duplizieren</button>
        <button data-kc-tun="vorn">Nach vorn</button>
        <button data-kc-tun="hinten">Nach hinten</button>
        <button data-kc-tun="loeschen" class="rot">Löschen</button>
      </div>`;

    menue.hidden = false;
    /* Ins Bild rücken - ein Menü, das halb außerhalb liegt, ist keins. */
    const b = menue.getBoundingClientRect();
    menue.style.left = `${Math.min(x, innerWidth - b.width - 12)}px`;
    menue.style.top = `${Math.min(y, innerHeight - b.height - 12)}px`;

    menue.oninput = (e) => {
      const feld = e.target.dataset.kc;
      if (!feld) return;
      const i = aktuell(); if (!i) return;
      const wert = e.target.type === 'number' || e.target.type === 'range' ? Number(e.target.value) : e.target.value;
      if (['spalte', 'zeile', 'spalten', 'zeilen'].includes(feld)) {
        i.kc = i.kc || { spalte: 0, zeile: 0, spalten: 1, zeilen: 1 };
        i.kc[feld] = (feld === 'spalte' || feld === 'zeile') ? Math.max(0, wert - 1) : Math.max(1, wert);
        /* NICHT kcGesetzt leeren. Das hatte ich zuerst getan, in der Meinung "Pixel neu aus
           dem Raster rechnen lassen" - es bewirkt das Gegenteil: rasterAusrichten() liest ein
           leeres kcGesetzt als "die Maus hat das Teil bewegt" und bestimmt den Rasterplatz neu
           AUS den alten Pixeln. Der eben eingestellte Wert war damit sofort wieder weg, ohne
           Meldung. Richtig ist, kcGesetzt stehen zu lassen: Dann gilt das Raster als Wahrheit
           und die Pixel werden daraus gerechnet - genau das, was hier gewollt ist. */
      } else {
        i[feld] = wert;
        if (feld === 'bg') i.fill = wert;
      }
      const aus = e.target.parentElement.querySelector('output');
      if (aus) aus.textContent = `${wert} px`;
      render();
    };

    menue.onclick = (e) => {
      const schritt = e.target.dataset.kcMove;
      const tun = e.target.dataset.kcTun;
      const i = aktuell(); if (!i) return;
      if (schritt) {
        const [ds, dz] = schritt.split(',').map(Number);
        i.kc.spalte = Math.max(0, i.kc.spalte + ds);
        i.kc.zeile = Math.max(0, i.kc.zeile + dz);
        /* kcGesetzt bleibt stehen - siehe oben. */
        render(); menueZeigen(parseInt(menue.style.left), parseInt(menue.style.top));
        return;
      }
      if (!tun) return;
      if (tun === 'duplizieren') {
        const kopie = JSON.parse(JSON.stringify(i));
        kopie.id = (typeof uid === 'function') ? uid('el') : 'el' + Date.now();
        kopie.kc = { ...i.kc, spalte: i.kc.spalte + i.kc.spalten };
        /* kcGesetzt wird mitkopiert und bleibt stehen: Die Kopie hat noch die Pixel des
           Originals, gilt damit als "nicht bewegt", und ihr neuer Rasterplatz (eine Breite
           weiter rechts) wird in Pixel umgesetzt. Mit geleertem kcGesetzt landete die Kopie
           exakt auf dem Original - unsichtbar, weil deckungsgleich. */
        delete kopie.groupId;      // die Kopie steht für sich, sonst wandert sie mit dem Original mit
        currentItems().push(kopie);
        selected = kopie.id;
      }
      if (tun === 'loeschen') {
        const liste = currentItems();
        liste.splice(liste.indexOf(i), 1);
        selected = null;
      }
      if (tun === 'vorn' || tun === 'hinten') {
        const liste = currentItems();
        liste.splice(liste.indexOf(i), 1);
        if (tun === 'vorn') liste.push(i); else liste.unshift(i);
      }
      menue.hidden = true;
      render();
    };
  }

  const farbeAls = (w) => {
    const s = String(w || '');
    if (/^#[0-9a-f]{6}$/i.test(s)) return s;
    const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return '#41556b';
    return '#' + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('');
  };

  /* Rahmen und Rundung auf die Bausteine anwenden. app.js macht das nur für seine eigenen
     Formen (applyShapeStyle prüft eine feste Typenliste) - die Kassenbausteine stehen dort
     nicht drin und blieben deshalb immer eckig und rahmenlos. */
  const echtesRender2 = render;
  render = function () {
    echtesRender2.apply(this, arguments);
    if ((project.mode || '') !== 'kasse') return;
    (currentItems() || []).forEach((item) => {
      const el = document.querySelector(`.designer-item[data-id="${item.id}"]`);
      if (!el) return;
      if (item.radius != null) el.style.borderRadius = `${item.radius}px`;
      if (item.strokeWidth) el.style.border = `${item.strokeWidth}px ${item.strokeStyle || 'solid'} ${item.stroke || '#0d2b45'}`;
    });
  };

  let versuche = 0;
  const wecker = setInterval(() => { if (starte() || ++versuche > 120) clearInterval(wecker); }, 100);
  window.KCKassenteile = { version: VERSION, KNOEPFE, SYMBOLE, GEPLANT };
})();
