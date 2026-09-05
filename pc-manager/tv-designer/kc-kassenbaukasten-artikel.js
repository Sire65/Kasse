/* KC Kassenbaukasten, Teil 4: echte Artikel in der Vorschau, Darstellung der Kacheln,
 * Info-Ecke und die Info-Seite.   03.09.2026
 *
 * ANLASS (Betreiber): "Die Artikeltasten sind in der Bauphase ja erst nur Platzhalter. Wie
 * können die Artikelbilder rein? Oder ein anderer Bauer möchte nur Farben und Texte mit Preis.
 * Müssen die Artikeltasten mit Info-Ecke oben links extra im Baukasten liegen? Idee: rechte
 * Maustaste und Info-Dreieck einbauen. Dahinter muss dann ein Infotext bzw. eine Infoseite
 * liegen, die später noch gefüllt wird."
 *
 * DIE EINE REGEL, AUF DIE HIER ALLES ANKOMMT
 * Der Baukasten LIEST das Sortiment und speichert davon NICHTS. Im Aufbau steht "hier ist die
 * Artikelfläche, Darstellung = Bild+Name+Preis, 4 Spalten" - kein Artikelname, kein Preis, kein
 * Bild. Sonst hätten wir eine zweite Artikelliste neben den Stammdaten, und die Stammdaten
 * gehören dem Verein. Genau diese Sorte zweiter Quelle war in dieser Woche dreimal die Ursache
 * eines Fehlers, den niemand gemeldet bekam.
 *
 * WOHER DIE ARTIKEL KOMMEN
 * 1. Aus dem Speicher der Kasse (kc_products_v050) - das ist das LEBENDE Sortiment mit allem,
 *    was der Verein geändert hat. Geht nur, wenn die Kasse auf diesem Rechner schon offen war.
 * 2. Sonst aus der Kassendatei selbst (pos/app.js, DEFAULT_PRODUCTS) - der Auslieferungsstand.
 * Welcher der beiden Wege es war, steht im Baukasten sichtbar dran. Eine Vorschau, die nicht
 * sagt, woher sie kommt, ist eine Behauptung.
 */
'use strict';
(function () {
  const VERSION = '0.4.1';
  const SPEICHER_SCHLUESSEL = 'kc_products_v050';
  const KASSENPFAD = '../../pos/';

  /* Farben je Warengruppe. Gebraucht für die Kacheln der 9 Artikel, denen in den Stammdaten
     keine eigene Farbe hinterlegt ist. Abgeleitet heißt: nicht erfunden, sondern aus der
     Warengruppe des Artikels gebildet - und im Baukasten wird es auch so angezeigt. */
  const WARENGRUPPENFARBE = {
    'Getränke': '#8a3324', 'Speisen': '#3f5f36', 'Pfand': '#4a4f63', 'Sonstiges': '#5b4a6b',
  };
  const ERSATZFARBE = '#6b7280';

  let SORTIMENT = [];
  let HERKUNFT = 'noch nicht geladen';

  /* ------------------------------------------------------------------ Sortiment lesen */
  function ausSpeicher() {
    try {
      const roh = localStorage.getItem(SPEICHER_SCHLUESSEL);
      if (!roh) return null;
      const liste = JSON.parse(roh);
      return Array.isArray(liste) && liste.length ? liste : null;
    } catch (e) { return null; }
  }

  async function ausKassendatei() {
    /* Die Kassendatei wird NICHT ausgeführt, sondern als Text geholt und nur die Artikelliste
       daraus herausgeschnitten - mit Klammerzählung, nicht mit einem Suchmuster: Ein Muster
       über 29 verschachtelte Datensätze zu legen geht so lange gut, bis jemand eine Klammer
       mehr schreibt. */
    try {
      const text = await (await fetch(`${KASSENPFAD}app.js`)).text();
      const marke = 'const DEFAULT_PRODUCTS=';
      const anfang = text.indexOf(marke);
      if (anfang < 0) return null;
      let i = anfang + marke.length, tiefe = 0, start = i;
      for (; i < text.length; i++) {
        const c = text[i];
        if (c === '[') tiefe++;
        else if (c === ']') { tiefe--; if (!tiefe) { i++; break; } }
      }
      const liste = new Function(`return ${text.slice(start, i)}`)();
      return Array.isArray(liste) && liste.length ? liste : null;
    } catch (e) { return null; }
  }

  async function sortimentLaden() {
    const ausKasse = ausSpeicher();
    if (ausKasse) {
      SORTIMENT = ausKasse;
      HERKUNFT = `aus dem Speicher der Kasse · ${ausKasse.length} Artikel`;
    } else {
      const ausDatei = await ausKassendatei();
      if (ausDatei) {
        SORTIMENT = ausDatei;
        HERKUNFT = `aus der Kassendatei (Auslieferungsstand) · ${ausDatei.length} Artikel`;
      } else {
        SORTIMENT = [];
        HERKUNFT = 'nicht erreichbar – die Kacheln bleiben Platzhalter';
      }
    }
    herkunftAnzeigen();
    if (typeof render === 'function') render();
  }

  const warengruppen = () => [...new Set(SORTIMENT.map((a) => a.category).filter(Boolean))];
  const artikelDerGruppe = (g) => SORTIMENT.filter((a) => !g || g === '(alle)' || a.category === g);

  /* Farbe eines Artikels - und ob sie aus den Stammdaten kommt oder abgeleitet ist. */
  function farbeVon(artikel) {
    if (artikel && artikel.color) return { farbe: artikel.color, abgeleitet: false };
    const g = WARENGRUPPENFARBE[artikel && artikel.category];
    return { farbe: g || ERSATZFARBE, abgeleitet: true };
  }
  const hatInfo = (a) => Boolean(a && a.info && Object.keys(a.info).length);
  const bildPfad = (a) => (a && a.image ? (/^(https?:|data:|\/)/.test(a.image) ? a.image : KASSENPFAD + a.image) : '');

  /* ------------------------------------------------------------- Darstellung und Info-Ecke */
  const DARSTELLUNGEN = [
    ['bild', 'Bild + Name + Preis'],
    ['farbe', 'Farbe + Name + Preis'],
    ['symbol', 'Symbol + Name + Preis'],
    ['text-preis', 'Nur Name + Preis (groß)'],
    ['text', 'Nur Name'],
  ];

  /* Symbol statt Foto - gesehen bei roc.Kasse (Bildschirmfoto vom 03.09.), dort als
     Strichzeichnung. Bei schlechtem Licht und mit Handschuhen liest sich ein klares Zeichen
     schneller als das Foto eines Glases; auf einem Weihnachtsmarkt im Dunkeln ist das kein
     Schönheitsthema.
     WICHTIG UND EHRLICH: In den Stammdaten steht kein Symbol. Jedes Zeichen hier ist vom
     Baukasten AUS DEM NAMEN UND DER WARENGRUPPE abgeleitet - genau wie die fehlenden Farben.
     Deshalb sagt der Baustein das auch dazu. Wer die Symbole wirklich haben will, trägt sie in
     den Stammdaten ein; dann kommen sie von dort. */
  const SYMBOL_REGELN = [
    [/pfand|rückgabe|ruckgabe|becher/i, '♻'],
    [/wertmarke/i, '📄'],
    [/glühwein|gluehwein|punsch|feger|bowle|likör|likoer/i, '🍹'],
    [/kohl|kraut|kartoffel|mett|hering|knirps|eintopf|creme|wurst/i, '🍽'],
  ];
  const SYMBOL_JE_GRUPPE = { 'Getränke': '🥂', 'Speisen': '🍽', 'Pfand': '♻', 'Sonstiges': '•••' };
  function symbolVon(a) {
    const name = String((a && a.name) || '');
    for (const [muster, zeichen] of SYMBOL_REGELN) if (muster.test(name)) return zeichen;
    return SYMBOL_JE_GRUPPE[a && a.category] || '●';
  }

  /* Die zweite Ecke: "hier steckt eine Untergruppe dahinter" - bei roc.Kasse ein kleiner Pfeil
     oben rechts an jeder Kachel. Dieselbe Stelle wie die Info-Ecke, andere Bedeutung; deshalb
     warnt der Baustein, wenn beide auf derselben Seite sitzen. */
  const UNTERECKEN = [
    ['keine', 'keine'],
    ['or', 'Pfeil oben rechts'],
    ['ol', 'Pfeil oben links'],
  ];
  const INFOECKEN = [
    ['keine', 'keine'],
    ['ol', 'Dreieck oben links'],
    ['or', 'Dreieck oben rechts'],
    ['knopf', 'runder Knopf (wie heute)'],
  ];
  const istArtikelflaeche = (typ) => String(typ || '').startsWith('kc-artikel');

  /* ---------------------------------------------------------------- Die Vorschau zeichnen */
  function vorschauZeichnen() {
    if ((project.mode || '') !== 'kasse') return;
    (currentItems() || []).forEach((item) => {
      if (!istArtikelflaeche(item.type)) return;
      const el = document.querySelector(`.designer-item[data-id="${item.id}"]`);
      if (!el) return;

      const darstellung = item.kcDarstellung || 'bild';
      const ecke = item.kcInfoEcke || 'keine';
      const unterEcke = item.kcUnterEcke || 'keine';
      const gruppe = item.kcWarengruppe || '(alle)';
      const liste = artikelDerGruppe(gruppe);

      /* Spalten und Zeilen aus der Größe des Bausteins - ein Baustein über 6 Rasterspalten
         zeigt mehr Kacheln als einer über 2. So sieht man beim Ziehen sofort, wie viel
         wirklich hineinpasst; genau darum ging es beim 9-Zoll-iPad. */
      const spalten = Math.max(1, Math.min(8, Math.round((item.kc?.spalten || 4) / 1.5)));
      const zeilen = Math.max(1, Math.min(8, Math.round((item.kc?.zeilen || 4) / 1.5)));
      const anzahl = spalten * zeilen;

      let netz = el.querySelector('.kc-artikelnetz');
      if (!netz) {
        netz = document.createElement('div');
        netz.className = 'kc-artikelnetz';
        el.insertBefore(netz, el.firstChild);
      }
      netz.style.gridTemplateColumns = `repeat(${spalten}, 1fr)`;
      netz.dataset.darstellung = darstellung;

      let ohneInfo = 0, abgeleitete = 0;
      /* Die Kacheln werden als echte Elemente gebaut, nicht als zusammengeklebter Text.
         GRUND, aus Erfahrung von heute: In der Textfassung stand der Bildpfad in einem
         style-Attribut, und die Anführungszeichen um url("...") haben das Attribut vorzeitig
         beendet - die Kachel blieb grau, ohne dass irgendetwas einen Fehler meldete. Erst der
         Abruf des Bildes hat es gezeigt. Mit createElement gibt es diese Falle nicht, und
         Artikelnamen mit Sonderzeichen können nebenbei auch nichts mehr anrichten. */
      netz.textContent = '';
      liste.slice(0, anzahl).forEach((a) => {
        const { farbe, abgeleitet } = farbeVon(a);
        if (abgeleitet) abgeleitete++;
        const info = hatInfo(a);
        if (!info) ohneInfo++;

        const kachel = document.createElement('span');
        kachel.className = 'kc-ak' + (abgeleitet && darstellung === 'farbe' ? ' abgeleitet' : '');
        if (darstellung === 'symbol') {
          kachel.style.background = farbe;
          const z = document.createElement('span');
          z.className = 'kc-ak-symbol';
          z.textContent = symbolVon(a);
          kachel.appendChild(z);
        } else if (darstellung === 'bild' && a.image) {
          kachel.style.backgroundImage = `url("${bildPfad(a)}")`;
          kachel.style.backgroundSize = 'cover';
          kachel.style.backgroundPosition = 'center';
        } else {
          kachel.style.background = farbe;
        }

        if (ecke !== 'keine') {
          const e = document.createElement('b');
          e.className = ecke === 'knopf'
            ? 'kc-ak-knopf' + (info ? '' : ' leer')
            : `kc-ak-ecke ${ecke}` + (info ? '' : ' leer');
          e.textContent = info ? 'i' : '?';
          e.title = info ? 'Infotext vorhanden' : 'Für diesen Artikel ist noch kein Infotext hinterlegt';
          kachel.appendChild(e);
        }

        if (unterEcke !== 'keine') {
          const u = document.createElement('b');
          u.className = `kc-ak-unter ${unterEcke}`;
          u.textContent = '↥';
          u.title = 'Hinter dieser Kachel steckt eine Untergruppe';
          kachel.appendChild(u);
        }

        const text = document.createElement('span');
        text.className = 'kc-ak-text';
        const name = document.createElement('span');
        name.className = 'kc-ak-name';
        name.textContent = a.name || '';
        text.appendChild(name);
        if (darstellung !== 'text') {
          const preis = document.createElement('span');
          preis.className = 'kc-ak-preis';
          preis.textContent = typeof a.price === 'number'
            ? `${a.price.toFixed(2).replace('.', ',')} €` : '';
          text.appendChild(preis);
        }
        kachel.appendChild(text);
        netz.appendChild(kachel);
      });

      /* Die Fußnote sagt, was die Vorschau verschweigt: fehlende Infotexte und abgeleitete
         Farben. Ohne sie sähe der Aufbau vollständiger aus, als das Sortiment ist. */
      const teile = [`${Math.min(anzahl, liste.length)} von ${liste.length}`];
      if (ohneInfo && ecke !== 'keine') teile.push(`Info fehlt bei ${ohneInfo}`);
      if (abgeleitete && darstellung === 'farbe') teile.push(`Farbe abgeleitet bei ${abgeleitete}`);
      if (darstellung === 'symbol') teile.push('Symbole abgeleitet – nicht in den Stammdaten');
      if (unterEcke !== 'keine' && unterEcke === ecke) teile.push('⚠ beide Ecken auf derselben Seite');
      let fuss = el.querySelector('.kc-artikelfuss');
      if (!fuss) { fuss = document.createElement('i'); fuss.className = 'kc-artikelfuss'; el.appendChild(fuss); }
      fuss.textContent = SORTIMENT.length ? teile.join(' · ') : 'Sortiment nicht erreichbar';
    });
  }

  function herkunftAnzeigen() {
    const huelle = document.getElementById('kcGeraetHuelle');
    if (!huelle) return;
    let feld = document.getElementById('kcSortimentHerkunft');
    if (!feld) {
      feld = document.createElement('span');
      feld.id = 'kcSortimentHerkunft';
      feld.className = 'kc-herkunft';
      huelle.appendChild(feld);
    }
    feld.textContent = `Sortiment: ${HERKUNFT}`;
    feld.classList.toggle('fehlt', !SORTIMENT.length);
  }

  /* ------------------------------------------------------------------------ Info-Seite */
  const INFOTEILE = [
    ['kc-info-titel', 'Artikelname als Überschrift', [6, 1]],
    ['kc-info-bild', 'Artikelbild', [3, 3]],
    ['kc-info-kurz', 'Kurzbeschreibung', [3, 1]],
    ['kc-info-zutaten', 'Zutaten', [3, 2]],
    ['kc-info-allergene', 'Allergene', [3, 2]],
    ['kc-info-wichtig', 'Wichtiger Hinweis', [6, 1]],
    ['kc-info-naehrwerte', 'Nährwerttabelle', [6, 2]],
    ['kc-info-schliessen', 'Schließen', [2, 1]],
  ];

  function infoSeiteAnlegen() {
    const vorhanden = project.slides.find((s) => s.kcSeite === 'info');
    if (vorhanden) {
      activeSlideId = vorhanden.id;
      if (typeof renderSlides === 'function') renderSlides();
      render();
      window.KCKassenbaukasten.bibliothekFiltern();
      melden('Die Info-Seite ist schon angelegt – hier ist sie.');
      return vorhanden;
    }
    const seite = {
      id: (typeof uid === 'function') ? uid('slide') : 'slide-info',
      name: 'Info', kcSeite: 'info', items: [], bg: '#f3f6f9', duration: 8, transition: 'none',
    };
    project.slides.push(seite);
    const vorher = activeSlideId;
    activeSlideId = seite.id;
    try {
      const K = window.KCKassenbaukasten;
      K.einsetzen('kc-info-titel', 0, 0, [6, 1]);
      K.einsetzen('kc-info-bild', 0, 1, [3, 3]);
      K.einsetzen('kc-info-kurz', 3, 1, [3, 1]);
      K.einsetzen('kc-info-zutaten', 3, 2, [3, 2]);
      K.einsetzen('kc-info-allergene', 0, 4, [3, 2]);
      K.einsetzen('kc-info-wichtig', 3, 4, [3, 1]);
      K.einsetzen('kc-info-naehrwerte', 3, 5, [3, 1]);
      K.einsetzen('kc-info-schliessen', 0, 6, [2, 1]);
    } finally { activeSlideId = vorher; }
    activeSlideId = seite.id;
    if (typeof renderSlides === 'function') renderSlides();
    render();
    window.KCKassenbaukasten.bibliothekFiltern();
    melden('Info-Seite angelegt – das Fenster hinter der Info-Ecke. Der Text kommt aus den Stammdaten.');
    return seite;
  }

  /* --------------------------------------------------------- Erweiterung des Rechtsklicks */
  function menueErweitern() {
    const menue = document.getElementById('kcKontextMenue');
    if (!menue || menue.dataset.kcArtikel) return;
    menue.dataset.kcArtikel = '1';
    new MutationObserver(() => { if (!menue.hidden) block(); }).observe(menue, { childList: true });
    block();
  }

  function block() {
    const menue = document.getElementById('kcKontextMenue');
    if (!menue || menue.querySelector('.kc-kontext-artikel')) return;
    const item = (currentItems() || []).find((x) => x.id === selected);
    if (!item || !istArtikelflaeche(item.type)) return;      // nur an der Artikelfläche
    const aktionen = menue.querySelector('.kc-kontext-aktionen');
    if (!aktionen) return;

    const div = document.createElement('div');
    div.className = 'kc-kontext-block kc-kontext-artikel';
    div.innerHTML = `
      <b>Artikelkacheln</b>
      <label>Darstellung
        <select data-kc-art="kcDarstellung">
          ${DARSTELLUNGEN.map(([w, t]) => `<option value="${w}"${(item.kcDarstellung || 'bild') === w ? ' selected' : ''}>${t}</option>`).join('')}
        </select></label>
      <label>Info-Ecke
        <select data-kc-art="kcInfoEcke">
          ${INFOECKEN.map(([w, t]) => `<option value="${w}"${(item.kcInfoEcke || 'keine') === w ? ' selected' : ''}>${t}</option>`).join('')}
        </select></label>
      <label>Untergruppen-Ecke
        <select data-kc-art="kcUnterEcke">
          ${UNTERECKEN.map(([w, t]) => `<option value="${w}"${(item.kcUnterEcke || 'keine') === w ? ' selected' : ''}>${t}</option>`).join('')}
        </select></label>
      <label>Warengruppe
        <select data-kc-art="kcWarengruppe">
          <option value="(alle)">(alle)</option>
          ${warengruppen().map((g) => `<option value="${g}"${item.kcWarengruppe === g ? ' selected' : ''}>${g}</option>`).join('')}
        </select></label>
      <button class="kc-infoseite-knopf" data-kc-infoseite="1">Info-Seite öffnen / anlegen</button>`;
    aktionen.parentElement.insertBefore(div, aktionen);
    const b = menue.getBoundingClientRect();
    if (b.bottom > innerHeight - 8) menue.style.top = `${Math.max(8, innerHeight - b.height - 12)}px`;

    div.onchange = (e) => {
      const feld = e.target.dataset.kcArt;
      if (!feld) return;
      const i = (currentItems() || []).find((x) => x.id === selected);
      if (!i) return;
      i[feld] = e.target.value;
      render();
    };
    div.onclick = (e) => {
      if (!e.target.dataset.kcInfoseite) return;
      menue.hidden = true;
      infoSeiteAnlegen();
    };
  }

  /* ------------------------------------------------------------------------- Anlaufen */
  const melden = (t) => { if (typeof status === 'function') status(t); };

  function bereit() {
    return window.KCKassenbaukasten && window.KCKassenteile
      && document.getElementById('kcKontextMenue') && typeof MODE_TOOLS === 'object';
  }

  function starte() {
    if (!bereit()) return false;
    const K = window.KCKassenbaukasten;

    /* 1. Fertige Kachel-Varianten in die Bibliothek - zum schnellen Greifen. Ändern lässt
          sich danach alles über die rechte Maustaste; das ist dasselbe Verhältnis wie
          zwischen Baugruppen und Einzelteilen. */
    const VARIANTEN = [
      ['kc-artikel-bild', 'Artikelkacheln mit Bild', { darstellung: 'bild', ecke: 'keine' }],
      ['kc-artikel-farbe', 'Artikelkacheln Farbe + Name + Preis', { darstellung: 'farbe', ecke: 'keine' }],
      ['kc-artikel-info', 'Artikelkacheln mit Info-Ecke', { darstellung: 'bild', ecke: 'ol' }],
      /* HIESS BIS 03.09.2026 'kc-artikel-gross' - und damit genauso wie ein Baustein aus
         Teil 1 ("Artikel groß"). Die Registrierung hat den älteren Eintrag überschrieben, und
         in der Bibliothek stand derselbe Typ zweimal mit verschiedener Bedeutung. Gefunden hat
         das nicht mein Auge, sondern der Konsolidierungslauf, der doppelte Werkzeugtypen zählt.
         Dieselbe Sorte "zwei Quellen für eine Sache", die diese Woche schon mehrfach zugeschlagen
         hat - diesmal von mir selbst gebaut. Neuer, eindeutiger Name: */
      ['kc-artikel-nurtext', 'Artikelkacheln nur Name + Preis (groß)', { darstellung: 'text-preis', ecke: 'keine' }],
    ];
    VARIANTEN.forEach(([typ, beschriftung, v]) => {
      K.bausteinRegistrieren(typ, {
        beschriftung, felder: [6, 5], farbe: '#2a4d68', seite: 'kasse',
        hinweis: `${beschriftung} – zeigt die echten Artikel; änderbar über die rechte Maustaste`,
        istArtikel: true, vorgabe: v,
      });
      defaults[typ] = { text: beschriftung, w: 510, h: 425, color: '#ffffff', bg: '#2a4d68', align: 'center' };
    });

    /* 2. Die Bausteine der Info-Seite. */
    INFOTEILE.forEach(([typ, beschriftung, felder]) => {
      K.bausteinRegistrieren(typ, {
        beschriftung, felder, farbe: '#3d4f66', seite: 'info',
        hinweis: `${beschriftung} – Anordnung wird hier gebaut, der Text kommt aus den Stammdaten`,
      });
      defaults[typ] = { text: beschriftung, w: felder[0] * 85, h: felder[1] * 85,
        color: '#ffffff', bg: '#3d4f66', align: 'center' };
    });

    /* 3. In die Bibliothek einhängen - die Varianten zu den Artikeln, die Infoteile eigen. */
    const liste = MODE_TOOLS.kasse || [];
    if (!liste.some(([t]) => /^Artikelkacheln/.test(t))) {
      const stelle = liste.findIndex(([t]) => /^Artikel/.test(t));
      liste.splice(stelle < 0 ? liste.length : stelle + 1, 0,
        ['Artikelkacheln · fertige Varianten', VARIANTEN.map(([t, b]) => [t, b])],
        ['Info-Seite · Bausteine', INFOTEILE.map(([t, b]) => [t, b])]);
    }

    /* 4. Beim Einsetzen einer Variante deren Vorgaben mitgeben. */
    const echtesAddItem = addItem;
    addItem = function (typ) {
      const meta = K.nachTyp(typ);
      const neu = echtesAddItem.apply(this, arguments);
      if (neu && meta && meta.vorgabe) {
        neu.kcDarstellung = meta.vorgabe.darstellung;
        neu.kcInfoEcke = meta.vorgabe.ecke;
        render();
      }
      return neu;
    };

    /* 5. Nach jedem Zeichnen die Vorschau in die Artikelflächen legen. */
    const echtesRender = render;
    render = function () {
      echtesRender.apply(this, arguments);
      try { vorschauZeichnen(); } catch (e) { /* eine kaputte Vorschau darf den Designer nicht anhalten */ }
    };

    /* 6. Die drei Bauformen von QuickBon.
          ANLASS (Betreiber, 03.09.2026): "Ja, QuickBon auch." Aus den Bildschirmfotos vom
          03.09. abgesehen - das sind keine neuen Funktionen, sondern eine andere ANORDNUNG
          derselben Sachen. Genau darum geht es beim 9-Zoll-iPad: Unser Warenkorb frisst dort
          17 bis 36 % der Fläche (gemessen am 02.09.) und ist trotzdem unübersichtlich.
          Das speedy-Bild vom Betreiber zeigt dieselbe Idee - auch dort ist der Beleg nur ein
          schmaler Streifen. */
    const QB_TEILE = [
      ['kc-bon-streifen', 'Bon als schmaler Bildstreifen', [8, 1], '#7a5230',
        'Die gebuchten Artikel als Miniaturbilder in einer Zeile statt als Liste'],
      ['kc-summe-haken', 'Summe groß + Haken zum Abschließen', [4, 1], '#1e6848',
        'Große Summe und ein runder Knopf zum Abschließen, rechts neben dem Streifen'],
      ['kc-funktionsraster', 'Funktionsraster 3 × 3', [2, 2], '#4e2d4e',
        'Neun kleine Knöpfe in einem Block - der Ersatz für eine breite Kopfzeile'],
      ['kc-sammelkachel', 'Sammelkachel mit Vorschau', [2, 2], '#3d6b8f',
        'Eine Kachel zeigt sechs Miniaturbilder der Artikel dahinter'],
    ];
    QB_TEILE.forEach(([typ, beschriftung, felder, farbe, hinweis]) => {
      K.bausteinRegistrieren(typ, { beschriftung, felder, farbe, seite: 'kasse', hinweis });
      defaults[typ] = { text: beschriftung, w: felder[0] * 85, h: felder[1] * 85,
        color: '#ffffff', bg: farbe, align: 'center' };
    });

    const QB_GRUPPEN = [
      ['bg-qb-streifen', '▤ QuickBon: Bon als Streifen oben', {
        seite: 'kasse', felder: [12, 7],
        hinweis: 'Schmaler Bonstreifen mit Summe oben, darunter die ganze Fläche für Artikel',
        teile: [['kc-bon-streifen', 0, 0, 8, 1], ['kc-summe-haken', 8, 0, 4, 1],
          ['kc-artikel-bild', 0, 1, 12, 6]],
      }],
      ['bg-qb-funktionen', '▦ QuickBon: Funktionsraster + Sammelkachel', {
        seite: 'kasse', felder: [4, 2],
        hinweis: 'Der Block unten rechts: selten Gebrauchtes gebündelt statt in der Kopfzeile',
        teile: [['kc-sammelkachel', 0, 0, 2, 2], ['kc-funktionsraster', 2, 0, 2, 2]],
      }],
      ['bg-qb-komplett', '▣ QuickBon: ganze Oberfläche', {
        seite: 'kasse', felder: [12, 8],
        hinweis: 'Die vollständige Anordnung zum Vergleichen - Streifen oben, Artikel groß, Funktionen unten rechts',
        teile: [['kc-bon-streifen', 0, 0, 8, 1], ['kc-summe-haken', 8, 0, 4, 1],
          ['kc-artikel-bild', 0, 1, 12, 5],
          ['kc-sammelkachel', 8, 6, 2, 2], ['kc-funktionsraster', 10, 6, 2, 2],
          ['kc-gruppen-leiste', 0, 6, 8, 2]],
      }],
    ];
    QB_GRUPPEN.forEach(([id, beschriftung, meta]) => K.baugruppeRegistrieren(id, { beschriftung, ...meta }));
    const bgGruppe = (MODE_TOOLS.kasse || []).find(([t]) => /^Baugruppen/.test(t));
    if (bgGruppe && !bgGruppe[1].some(([t]) => t === 'bg-qb-komplett')) {
      bgGruppe[1].push(...QB_GRUPPEN.map(([id, b]) => [id, b]));
    }

    menueErweitern();
    herkunftAnzeigen();
    sortimentLaden();
    console.info(`KC Kassenbaukasten Teil 4 (${VERSION}) bereit – echte Artikel, Darstellungen, Info-Ecke, Info-Seite.`);
    return true;
  }

  let versuche = 0;
  const wecker = setInterval(() => { if (starte() || ++versuche > 160) clearInterval(wecker); }, 100);

  window.KCKassenArtikel = {
    version: VERSION,
    sortiment: () => SORTIMENT,
    herkunft: () => HERKUNFT,
    farbeVon, hatInfo, bildPfad, warengruppen,
    DARSTELLUNGEN, INFOECKEN, UNTERECKEN, INFOTEILE, symbolVon,
    infoSeiteAnlegen, sortimentLaden,
  };
})();
