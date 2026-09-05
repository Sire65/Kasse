/* KC Kassenbaukasten, Teil 6: Vorlagen — fertige Oberflächen zum Auswählen.   03.09.2026
 *
 * ANLASS (Betreiber): "Evtl. noch bei Objekten, so wie Hintergründe, fertige Vorlagen, wo schon
 * verschiedene Layout-Vorlagen zur Verfügung stehen. Dann wähle ich erst eine Vorlage und kann
 * dann die vorgefertigten Felder füllen."
 *
 * WARUM EIN EIGENES REGAL UND NICHT DAS VORHANDENE
 * Der Designer hat ein Vorlagenregal (#templateLibrary) - aber darin liegen Folienvorlagen für
 * die TV-Anzeige. Im Kassenmodus ist es ausgeblendet, und das bleibt auch so: Eine
 * Weihnachtsmarkt-Folie hilft beim Bau einer Kasse nicht. Hier steht stattdessen ein eigenes
 * Regal mit VOLLSTÄNDIGEN Oberflächen.
 *
 * WAS EINE VORLAGE IST
 * Nicht ein Block, sondern der ganze Aufbau: Kassenseite und Zahlenseite, fertig aufgeteilt.
 * Man wählt sie aus und füllt danach die vorbereiteten Felder - genau der Ablauf, den der
 * Betreiber beschrieben hat.
 *
 * "UNSERE OBERFLÄCHE HEUTE" IST NACHGEMESSEN, NICHT NACHGEBAUT
 * Die erste Vorlage ist die Aufteilung der laufenden Kasse. Ich habe sie am 03.09.2026 bei
 * 1366 x 1024 ausgemessen und in Rasterfelder umgerechnet, statt sie aus dem Gedächtnis
 * nachzubauen:
 *     Kopfzeile      0,0    1366 x 65    -> 12 x 1
 *     Warengruppen  14,126   776 x 70    ->  7 x 1
 *     Artikelfläche 14,200   776 x 469   ->  7 x 4
 *     Warenkorb    800,126   562 x 606   ->  5 x 5
 *     Scheine       15,771   377 x 60    ->  3 x 1
 *     Ziffernblock 649,789   255 x 197   ->  2 x 2
 *     Hauptaktionen915,747   443 x 243   ->  4 x 2
 * Nur so ist der Vergleich mit den anderen Vorlagen ehrlich.
 */
'use strict';
(function () {
  const VERSION = '0.6.0';

  /* Die Zahlenseite ist bei allen Vorlagen gleich aufgebaut - sie hängt nicht am Geschmack,
     sondern an der Rechenaufgabe: Rückgeld sehen, Geld auswählen, Betrag eintippen, Zahlart. */
  /* GEFUNDEN 03.09.2026 durch die Prüfung der Übergabe: Diese Zahlenseite ist auf 12 × 8
     Felder gerechnet. Auf dem Handy (6 × 12) ragte "Aufrunden" rechts heraus - die Vorlage
     ließ sich anlegen, war aber nicht übergabereif. Aufgefallen ist es nicht beim Hinsehen,
     sondern weil die Übergabe jede Oberfläche nachrechnet, bevor sie sie annimmt.
     Deshalb hat das Handy jetzt seine eigene Zahlenseite - sechs Spalten hoch statt zwölf
     breit. Wieder derselbe Satz: Ein Handy ist kein kleines iPad. */
  const ZAHLENSEITE_HANDY = [
    ['kc-zahlen-rueckgeld', 0, 0, 6, 2],
    ['kc-zahlen-scheine', 0, 2, 6, 4],
    ['kc-zahlen-block', 0, 6, 3, 4],
    ['kc-zahlen-arten', 3, 6, 3, 2],
    ['kn-bar', 3, 8, 3, 2],
    ['kn-stimmtso', 0, 10, 6, 1],
    ['kn-aufrunden', 0, 11, 6, 1],
  ];
  const ZAHLENSEITE = [
    ['kc-zahlen-rueckgeld', 0, 0, 12, 2],
    ['kc-zahlen-scheine', 0, 2, 7, 4],
    ['kc-zahlen-block', 7, 2, 5, 3],
    ['kc-zahlen-arten', 7, 5, 5, 1],
    ['kn-bar', 0, 6, 4, 2],
    ['kn-stimmtso', 4, 6, 4, 2],
    ['kn-aufrunden', 8, 6, 4, 2],
  ];

  const VORLAGEN = [
    ['vl-heute', 'Unsere Oberfläche heute', 'ipad-gross-quer',
      'Die Aufteilung der laufenden Kasse, am 03.09. nachgemessen. Der Ausgangspunkt zum Vergleichen.',
      [
        ['kc-kopf-voll', 0, 0, 12, 1],
        ['kc-gruppen-leiste', 0, 1, 7, 1],
        ['kc-artikel-mittel', 0, 2, 7, 4],
        ['kc-bon-ausfuehrlich', 7, 1, 5, 5],
        ['kc-zahlen-fest', 0, 6, 6, 2],
        ['kc-zahlen-block', 6, 6, 2, 2],
        ['kc-sonder-leiste', 8, 6, 4, 2],
      ]],
    ['vl-streifen', 'Bon als schmaler Streifen oben', 'ipad-gross-quer',
      'Nach QuickBon: der Bon als Bildstreifen, die ganze Fläche für die Artikel.',
      [
        ['kc-bon-streifen', 0, 0, 8, 1],
        ['kc-summe-haken', 8, 0, 4, 1],
        ['kc-artikel-bild', 0, 1, 12, 5],
        ['kc-gruppen-leiste', 0, 6, 8, 2],
        ['kc-sammelkachel', 8, 6, 2, 2],
        ['kc-funktionsraster', 10, 6, 2, 2],
      ]],
    ['vl-kassierer', 'Kassierer-Ansicht mit Bontabelle', 'pc-manager',
      'Nach MagicPOS: Bon als Tabelle mit PLU und Preisen, Ziffernblock daneben, Verwaltung rechts.',
      [
        ['kc-bon-kassierer', 0, 0, 5, 3],
        ['kc-bon-blaettern', 5, 0, 1, 3],
        ['kc-zahlen-block', 6, 0, 3, 3],
        ['kc-verwaltungsspalte', 9, 0, 3, 5],
        ['kc-artikel-bild', 0, 3, 6, 5],
        ['kc-gruppen-raster', 6, 3, 3, 5],
      ]],
    ['vl-belegleiste', 'Beleg links, Funktionen unten', 'ipad-gross-quer',
      'Nach speedy: schmaler Beleg links, Funktionsleiste am unteren Rand - dort sitzt auch „Bon parken“.',
      [
        ['kc-belegreiter', 0, 0, 4, 1],
        ['kc-bon-kompakt', 0, 1, 3, 4],
        ['kc-zahlen-block', 0, 5, 3, 2],
        ['kc-artikel-bild', 3, 1, 9, 5],
        ['kc-gruppen-leiste', 3, 6, 9, 1],
        ['kc-funktionsleiste', 0, 7, 12, 1],
      ]],
    ['vl-9quer', '9 Zoll quer · platzsparend', 'ipad-9-quer',
      'Für das kleine iPad: dunkles Bonfeld statt breiter Liste, Artikel bekommen zwei Drittel.',
      [
        ['kc-kopf-kompakt', 8, 0, 4, 1],
        ['kc-gruppen-leiste', 0, 0, 8, 1],
        ['kc-artikel-bild', 0, 1, 8, 6],
        ['kc-bon-dunkel', 8, 1, 4, 4],
        ['kc-zahlen-block', 8, 5, 4, 2],
        ['kc-funktionsleiste', 0, 7, 12, 1],
      ]],
    /* NACHGETRAGEN 03.09.2026: das Handy. Eigenes Grundraster 6 x 12 - deshalb steht hier
       eine EIGENE Aufteilung und nicht die zusammengeschobene Tabletfassung. Ein Handy hält
       man in einer Hand und bedient es mit dem Daumen: Der Bon gehört nach oben ins Blickfeld,
       die Artikel in die Mitte, alles zum Antippen in die untere Hälfte. */
    ['vl-handy', 'Handy hochkant', 'handy-hoch',
      'Für das Handy: Bon oben, Artikel in der Mitte, alles zum Antippen unten in Daumennähe.',
      [
        ['kc-bon-dunkel', 0, 0, 6, 2],
        ['kc-gruppen-leiste', 0, 2, 6, 1],
        ['kc-artikel-bild', 0, 3, 6, 5],
        ['kc-zahlen-block', 0, 8, 3, 3],
        ['kc-sonder-leiste', 3, 8, 3, 3],
        ['kc-funktionsleiste', 0, 11, 6, 1],
      ]],
    ['vl-9hoch', '9 Zoll hochkant', 'ipad-9-hoch',
      'Hochkant: Artikel oben, Bon dunkel darunter, Zahlen unten. Das Format, an dem die jetzige Oberfläche gescheitert ist.',
      [
        ['kc-gruppen-leiste', 0, 0, 12, 1],
        ['kc-artikel-bild', 0, 1, 12, 3],
        ['kc-bon-dunkel', 0, 4, 12, 2],
        ['kc-zahlen-block', 0, 6, 5, 2],
        ['kc-sonder-leiste', 5, 6, 7, 1],
        ['kc-funktionsleiste', 5, 7, 7, 1],
      ]],
  ];

  const K = () => window.KCKassenbaukasten;
  /* Welche Zahlenseite zu einem Gerät passt - nach seiner Klasse, nicht nach seinem Namen. */
  const zahlenseiteFuer = (geraetId) => {
    const g = K().GERAETE.find((x) => x.id === geraetId);
    return K().KLASSE && K().KLASSE(g) === 'handy' ? ZAHLENSEITE_HANDY : ZAHLENSEITE;
  };
  const melden = (t) => { if (typeof status === 'function') status(t); };

  /* ------------------------------------------------------------------ Miniaturbild
     Eine Vorlage wählt man mit den Augen. Ein Regal aus Textzeilen wäre kein Regal, sondern
     eine Liste - deshalb wird jede Vorlage als kleines Bild ihrer eigenen Aufteilung gezeichnet,
     aus denselben Angaben, aus denen sie später gebaut wird. Damit kann das Bild nicht
     danebenliegen: Es gibt keine zweite Beschreibung, die veralten könnte. */
  function miniatur(teile, geraet) {
    const bild = document.createElement('div');
    bild.className = 'kc-vorlagenbild';
    /* Das Bild muss im Raster DES GERÄTS gezeichnet werden. Sonst sähe die Handyvorlage aus,
       als ragte sie unten heraus - sie hat zwölf Zeilen, nicht acht. */
    const g = K().GERAETE.find((x) => x.id === geraet);
    const [gs, gz] = K().GRUNDRASTER ? K().GRUNDRASTER(g) : [12, 8];
    bild.style.gridTemplateColumns = `repeat(${gs}, 1fr)`;
    bild.style.gridTemplateRows = `repeat(${gz}, 1fr)`;
    if (g && g.hoehe > g.breite) bild.classList.add('hoch');
    teile.forEach(([typ, sp, z, spalten, zeilen]) => {
      const meta = K().nachTyp(typ);
      const kasten = document.createElement('i');
      kasten.style.gridColumn = `${sp + 1} / span ${spalten}`;
      kasten.style.gridRow = `${z + 1} / span ${zeilen}`;
      kasten.style.background = (meta && meta.farbe) || '#8394a6';
      kasten.title = (meta && meta.beschriftung) || typ;
      bild.appendChild(kasten);
    });
    return bild;
  }

  /* ------------------------------------------------------------------ Vorlage einsetzen */
  function einsetzenVorlage(id) {
    const v = VORLAGEN.find((x) => x[0] === id);
    if (!v) return;
    const [, name, geraet, , teile] = v;
    if (!confirm(`Vorlage „${name}“ einsetzen?\n\nDie jetzigen Seiten dieses Projekts werden dabei ersetzt.`)) return;

    const seite = (n, art) => ({
      id: (typeof uid === 'function') ? uid('slide') : 'slide-' + art,
      name: n, kcSeite: art, items: [], bg: '#f3f6f9', duration: 8, transition: 'none',
    });
    project.slides = [seite('Kasse', 'kasse'), seite('Zahlen', 'zahlen')];
    activeSlideId = project.slides[0].id;
    selected = null;
    if (typeof selectedIds !== 'undefined' && selectedIds.clear) selectedIds.clear();

    /* Erst das Gerät, dann die Bausteine: Die Rasterfelder werden beim Einsetzen in Pixel
       umgerechnet, und die hängen an der Flächengröße. Andersherum stünde die Vorlage kurz
       auf der falschen Fläche - sichtbar würde das nicht, die Zahlen wären trotzdem falsch. */
    project.kasse = { geraet: geraet || project.kasse?.geraet || 'ipad-gross-quer' };
    K().geraetSetzen(project.kasse.geraet);

    const vorher = activeSlideId;
    try {
      activeSlideId = project.slides[0].id;
      teile.forEach(([typ, sp, z, spalten, zeilen]) => K().einsetzen(typ, sp, z, [spalten, zeilen]));
      activeSlideId = project.slides[1].id;
      zahlenseiteFuer(geraet).forEach(([typ, sp, z, spalten, zeilen]) => K().einsetzen(typ, sp, z, [spalten, zeilen]));
    } finally { activeSlideId = vorher; }

    activeSlideId = project.slides[0].id;
    if (typeof renderSlides === 'function') renderSlides();
    render();
    K().bibliothekFiltern();
    melden(`Vorlage „${name}“ eingesetzt – ${teile.length} Felder auf der Kassenseite, ${zahlenseiteFuer(geraet).length} auf der Zahlenseite. Jetzt füllen.`);
  }

  /* ------------------------------------------------------------------ Das Regal */
  function regalBauen() {
    if (document.getElementById('kcVorlagenRegal')) return true;
    const kasten = document.getElementById('toolbox');
    if (!kasten || !kasten.parentElement) return false;

    const regal = document.createElement('section');
    regal.id = 'kcVorlagenRegal';
    regal.className = 'kc-vorlagenregal';
    regal.innerHTML = '<h3>Vorlagen · fertige Oberflächen</h3>'
      + '<p class="kc-vorlagen-hinweis">Erst eine Vorlage wählen, dann die vorbereiteten Felder füllen.</p>';

    VORLAGEN.forEach(([id, name, geraet, beschreibung, teile]) => {
      const karte = document.createElement('button');
      karte.type = 'button';
      karte.className = 'kc-vorlagenkarte';
      karte.dataset.vorlage = id;
      karte.appendChild(miniatur(teile, geraet));
      const text = document.createElement('span');
      const g = K().GERAETE.find((x) => x.id === geraet);
      text.innerHTML = `<b></b><small></small><em></em>`;
      text.querySelector('b').textContent = name;
      text.querySelector('small').textContent = beschreibung;
      text.querySelector('em').textContent = g ? `${g.name} · ${g.breite} × ${g.hoehe}` : '';
      karte.appendChild(text);
      karte.onclick = () => einsetzenVorlage(id);
      regal.appendChild(karte);
    });

    kasten.parentElement.insertBefore(regal, kasten);
    return true;
  }

  function sichtbarkeit() {
    const regal = document.getElementById('kcVorlagenRegal');
    if (regal) regal.hidden = (project.mode || '') !== 'kasse';
  }

  function bereit() {
    return window.KCKassenbaukasten && window.KCKassenBauformen && window.KCKassenArtikel
      && document.getElementById('toolbox') && typeof render === 'function';
  }

  function starte() {
    if (!bereit()) return false;
    if (!regalBauen()) return false;
    const echtesRender = render;
    render = function () { echtesRender.apply(this, arguments); sichtbarkeit(); };
    sichtbarkeit();
    console.info(`KC Kassenbaukasten Teil 6 (${VERSION}) bereit – ${VORLAGEN.length} Vorlagen.`);
    return true;
  }

  let versuche = 0;
  const wecker = setInterval(() => { if (starte() || ++versuche > 200) clearInterval(wecker); }, 100);

  window.KCKassenVorlagen = { version: VERSION, VORLAGEN, ZAHLENSEITE, ZAHLENSEITE_HANDY, zahlenseiteFuer, einsetzenVorlage };
})();
