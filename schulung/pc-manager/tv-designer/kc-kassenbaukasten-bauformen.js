/* KC Kassenbaukasten, Teil 5: Bauformen aus MagicPOS und speedy.   03.09.2026
 *
 * ANLASS (Betreiber): "Nochmal zwei Ansichten" - zwei Bildschirmfotos von MagicPOS (Windows)
 * und von speedy auf einem Sunmi-Gerät. Danach: alle sechs Bauteile plus die zwei Baugruppen.
 *
 * WAS DIESE BILDER BEIGETRAGEN HABEN
 * Das speedy-Bild beantwortet nebenbei die offene Frage vom selben Tag, wo die Taste
 * "Bon parken" hinsoll: Sie sitzt dort unten in einer schmalen Funktionsleiste - zusammen mit
 * Belegsplitt, Einlage/Entnahme und Kasse sperren -, nicht bei den großen Sondertasten. Und
 * oben links stehen zwei Reiter "Offene Belege | Alle Belege": genau die Liste, über die man
 * einen geparkten Beleg zurückholt.
 *
 * WAS HIER NICHT DRIN IST, UND WARUM
 * Beide Systeme weisen die Mehrwertsteuer aus (MagicPOS als eigene Spalte je Position, speedy
 * als "inkl. 19 % MwSt" auf dem Beleg). In unserer Kasse kommt "MwSt" im ganzen Programm nicht
 * vor. Das ist kein Bauteil, das man dazulegt, sondern eine Frage an den Verein und seinen
 * Steuerberater. Auf Entscheidung des Betreibers vom 03.09. vorerst nicht weiterverfolgt -
 * hier steht es nur, damit es nicht verlorengeht.
 */
'use strict';
(function () {
  const VERSION = '0.5.1';

  /* Die sechs Bauteile. Jedes ist auf einem der beiden Bilder zu sehen; woher es stammt,
     steht im Hinweis, damit später nachvollziehbar ist, warum es hier liegt. */
  const BAUTEILE = [
    ['kc-bon-kassierer', '🧾 Bon als Kassierer-Tabelle', [5, 3], '#7a5230',
      'MagicPOS: Spalten PLU · Produktname · Menge · Einzelpreis · Gesamtpreis · MwSt – die Sicht des Kassierers statt der des Gastes'],
    ['kc-bon-blaettern', '⏫ Blättern im Bon (4 Pfeiltasten)', [1, 3], '#7a5230',
      'MagicPOS: Anfang, hoch, runter, Ende – für lange Bons auf kleinem Bildschirm, ohne Wischen'],
    ['kc-funktionsleiste', '▭ Funktionsleiste unten', [12, 1], '#4e2d4e',
      'speedy: Belegsplitt · Beleg parken · Einlage/Entnahme · Kasse sperren – gebündelt am unteren Rand'],
    ['kc-belegreiter', '🗂 Reiter „Offene Belege | Alle Belege“', [3, 1], '#123a5c',
      'speedy: der Weg zu den geparkten Belegen, ganz oben links'],
    ['kc-verwaltungsspalte', '⚙ Verwaltungsspalte', [3, 5], '#4a4f63',
      'MagicPOS: Bonnachdruck · Hausverbrauch · Kassenlade öffnen · Abrechnen · Leergut – an einer Stelle'],
    ['kc-gruppen-raster', '▦ Warengruppen als zweispaltiges Raster', [3, 5], '#2f6f4f',
      'MagicPOS: mehr Warengruppen auf gleicher Fläche als in einer Leiste'],
    /* Diese beiden kamen am 03.09. aus den Bildern von roc.Kasse und Hypersoft dazu. */
    ['kc-bon-dunkel', '🖤 Bonfeld dunkel mit großer Summe', [4, 5], '#111827',
      'roc.Kasse: dunkles Feld, große helle Summe – Antwort auf den gemessenen Befund vom 02.09.: Bonschrift 9,8–10,9 px, Kontrast 4,4:1'],
    ['kc-bediener-foto', '👤 Bedienerfeld mit Mitgliedsfoto', [2, 1], '#123a5c',
      'Hypersoft: Bediener mit Foto – bei uns mit den eigenen Mitgliedsavataren'],
  ];

  /* Die zwei Bauformen zum Nebeneinanderstellen. Absichtlich beide über die volle Fläche:
     Beim Vergleichen geht es nicht um einzelne Knöpfe, sondern um die Aufteilung. */
  const BAUFORMEN = [
    ['bg-magicpos', '🖥 MagicPOS: Kassierer-Ansicht', {
      seite: 'kasse', felder: [12, 8],
      hinweis: 'Bon als Tabelle links, Ziffernblock in der Mitte, Verwaltung rechts, Artikel unten',
      teile: [
        ['kc-bon-kassierer', 0, 0, 5, 3],
        ['kc-bon-blaettern', 5, 0, 1, 3],
        ['kc-zahlen-block', 6, 0, 3, 3],
        ['kc-verwaltungsspalte', 9, 0, 3, 5],
        ['kc-artikel-bild', 0, 3, 6, 5],
        ['kc-gruppen-raster', 6, 3, 3, 5],
      ],
    }],
    ['bg-speedy', '🖥 speedy: Beleg links + Funktionsleiste unten', {
      seite: 'kasse', felder: [12, 8],
      hinweis: 'Schmaler Beleg links mit Ziffernblock, Artikel groß, Warengruppen und Funktionen unten',
      teile: [
        ['kc-belegreiter', 0, 0, 4, 1],
        ['kc-bon-kompakt', 0, 1, 3, 4],
        ['kc-zahlen-block', 0, 5, 3, 2],
        ['kc-artikel-bild', 3, 1, 9, 5],
        ['kc-gruppen-leiste', 3, 6, 9, 1],
        ['kc-funktionsleiste', 0, 7, 12, 1],
      ],
    }],
  ];

  function bereit() {
    return window.KCKassenbaukasten && window.KCKassenArtikel
      && typeof MODE_TOOLS === 'object' && typeof defaults === 'object';
  }

  function starte() {
    if (!bereit()) return false;
    const K = window.KCKassenbaukasten;

    BAUTEILE.forEach(([typ, beschriftung, felder, farbe, hinweis]) => {
      K.bausteinRegistrieren(typ, { beschriftung, felder, farbe, seite: 'kasse', hinweis });
      defaults[typ] = { text: beschriftung, w: felder[0] * 85, h: felder[1] * 85,
        color: '#ffffff', bg: farbe, align: 'center' };
    });
    BAUFORMEN.forEach(([id, beschriftung, meta]) => K.baugruppeRegistrieren(id, { beschriftung, ...meta }));

    const liste = MODE_TOOLS.kasse || [];
    if (!liste.some(([t]) => /^Aus anderen Kassen/.test(t))) {
      const stelle = liste.findIndex(([t]) => /^Baugruppen/.test(t));
      liste.splice(stelle + 1, 0, ['Aus anderen Kassen · Bauteile', BAUTEILE.map(([t, b]) => [t, b])]);
    }
    const bgGruppe = liste.find(([t]) => /^Baugruppen/.test(t));
    if (bgGruppe && !bgGruppe[1].some(([t]) => t === 'bg-magicpos')) {
      bgGruppe[1].push(...BAUFORMEN.map(([id, b]) => [id, b]));
    }

    /* Vorschau für die zwei Bauteile, bei denen das Aussehen die ganze Aussage ist:
       Ein dunkles Bonfeld, das im Baukasten wie jeder andere Kasten aussieht, zeigt nicht,
       worum es geht. Deshalb wird hier wirklich dunkel gezeichnet und die Summe wirklich groß
       gesetzt - sonst könnte man den Vorschlag am Bildschirm nicht beurteilen. */
    const echtesRender = render;
    render = function () {
      echtesRender.apply(this, arguments);
      if ((project.mode || '') !== 'kasse') return;
      try {
        (currentItems() || []).forEach((item) => {
          const el = document.querySelector(`.designer-item[data-id="${item.id}"]`);
          if (!el) return;
          if (item.type === 'kc-bon-dunkel' && !el.querySelector('.kc-dunkelbon')) {
            const k = document.createElement('div');
            k.className = 'kc-dunkelbon';
            k.innerHTML = '<span class="kc-db-zeile">1 × Glühwein rot<b>5,50</b></span>'
              + '<span class="kc-db-zeile">2 × Kartoffelknirpse<b>7,00</b></span>'
              + '<span class="kc-db-summe">12,50 €</span>';
            el.insertBefore(k, el.firstChild);
          }
          if (item.type === 'kc-bediener-foto' && !el.querySelector('.kc-bedienerfeld')) {
            const k = document.createElement('div');
            k.className = 'kc-bedienerfeld';
            const bild = document.createElement('img');
            bild.src = '../../avatar-core/assets/chef/chef_male_neutral.webp';
            bild.alt = '';
            bild.onerror = () => { bild.remove(); };
            const txt = document.createElement('span');
            txt.innerHTML = '<b>Bediener</b><small>Mitglied · aktiv</small>';
            k.append(bild, txt);
            el.insertBefore(k, el.firstChild);
          }
        });
      } catch (e) { /* eine kaputte Vorschau darf den Designer nicht anhalten */ }
    };

    if (typeof renderModeTools === 'function' && (project.mode || '') === 'kasse') {
      renderModeTools();
      K.bibliothekFiltern();
    }
    console.info(`KC Kassenbaukasten Teil 5 (${VERSION}) bereit – Bauformen aus MagicPOS und speedy.`);
    return true;
  }

  let versuche = 0;
  const wecker = setInterval(() => { if (starte() || ++versuche > 180) clearInterval(wecker); }, 100);

  window.KCKassenBauformen = { version: VERSION, BAUTEILE, BAUFORMEN };
})();
