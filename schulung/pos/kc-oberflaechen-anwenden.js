/* KC Oberflächen ANWENDEN — die Kasse baut sich nach dem gewählten Aufbau um.   07.09.2026
 *
 * ANLASS (Betreiber): "Aufbau Kasse" - beide iPads gleich.
 * Bis heute nahm pos/kc-oberflaechen-pos.js die Aufbauten des Baukastens nur an und merkte
 * sich die Wahl; umgebaut wurde nichts. Diese Datei ist der dort angekündigte "nächste,
 * größere Schritt".
 *
 * WIE DER UMBAU FUNKTIONIERT - und warum gerade so
 * Die Kasse wird NICHT neu gezeichnet. Die vorhandenen Bereiche (Kopfzeile, Warengruppen,
 * Artikelfläche, Bon, Geldwahl, Ziffernblock, Knöpfe) werden in Rahmen UMGEHÄNGT, die in
 * einem CSS-Raster liegen (12 x 8 wie im Baukasten). Die Knoten selbst bleiben dieselben -
 * dadurch bleiben alle Klick-Verdrahtungen, Renderer und IDs aus app.js unangetastet. Ein
 * Baustein, den die Kasse (noch) keinem Bereich zuordnen kann, wird als beschrifteter
 * Platzhalter sichtbar gezeichnet - eine Lücke, die man sieht, ist eine Aufgabe.
 *
 * ZWEI SEITEN: Seite 1 ("kasse") liegt im Hauptraster. Seite 2 ("zahlen") ist eine Vollbild-
 * Ebene darüber, die die Rückgeld-Taste öffnet; ihre Bausteine holen sich dieselben Knoten
 * (Geldwahl, Ziffernblock, Zahlungsarten). Wird ein Bon abgeschlossen, schließt sie sich.
 *
 * ZURÜCK: "Standard" hängt alles an die ursprüngliche Stelle zurück - ohne Neuladen.
 */
'use strict';
(function (global) {
  const VERSION = '0.9.0';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  /* ----------------------------------------------------- Baustein -> Bereich der Kasse
     Eine Zuordnung nennt die Knoten, die in den Rahmen des Bausteins wandern (in dieser
     Reihenfolge), und eine Klasse, die die Darstellung im Rahmen bestimmt. `alle` heißt:
     jeder Treffer des Selektors, nicht nur der erste. */
  const KOPFKNOEPFE = ['#screenLockBtn', '#cashSoundBtn', '#menuBtn', '#mirrorLayoutBtn', '#headerExitBtn'];
  const SONDER = ['#operatorBtn', '#rushModeBtn', '#staffBtn', '#trainingModeBtn', '#depositBtn', '#tipBtn', '#complaintBtn', '#printBonBtn', '#moreBtn', '#tuvButton'];
  /* Bedienblock (08.09.): Statuszeile mit Training, Stoßzeiten, Team - darunter Rückgeld-Taste
     links und die übrigen Sondertasten rechts. */
  const STATUS = ['#trainingModeTopBtn', '#rushModeBtn', '#happyHourQuickBtn', '#operatorBtn'];   /* Happy Hour mit LED (08.09.) */
  const SONDER_REST = ['#staffBtn', '#depositBtn', '#tipBtn', '#complaintBtn', '#printBonBtn', '#moreBtn', '#tuvButton'];
  const ZAHLARTEN = ['#payBtn', '#accountChargeBtn', '#keepAsTipBtn'];   /* 09.09.: BEHALTEN reist mit BAR/KONTO */
  const BON = ['.cart-area > .cart-title', '#cartList', '.cart-area > .cart-summary'];
  const ARTIKEL = ['#workspaceModePanel', '#productGrid', '.sales-area .pager'];
  const Z = {
    /* Die Meldungszeile ("Verkauf abgeschlossen", "Kasse bereit") gehört mit in den Kopf -
       ohne sie wüsste am Stand niemand, ob der letzte Schritt angekommen ist. */
    'kc-kopf-voll':       { knoten: ['header.app-header', '.mode-strip'], klasse: 'kopf' },
    'kc-kopf-kompakt':    { knoten: ['header.app-header', '.mode-message-center'], klasse: 'kopf kompakt' },   /* Logo = Admin-Zugang bleibt (08.09.) */
    'kc-gruppen-leiste':  { knoten: ['#categories'], klasse: 'gruppen leiste' },
    'kc-gruppen-spalte':  { knoten: ['#categories'], klasse: 'gruppen spalte' },
    'kc-gruppen-raster':  { knoten: ['#categories'], klasse: 'gruppen raster' },
    'kc-artikel-gross':   { knoten: ARTIKEL, klasse: 'artikel', raster: [5, 3] },
    'kc-artikel-mittel':  { knoten: ARTIKEL, klasse: 'artikel', raster: [6, 4] },
    'kc-artikel-klein':   { knoten: ARTIKEL, klasse: 'artikel', raster: [7, 4] },
    'kc-artikel-bild':    { knoten: ARTIKEL, klasse: 'artikel' },
    'kc-artikel-farbe':   { knoten: ARTIKEL, klasse: 'artikel farbe' },
    'kc-artikel-info':    { knoten: ARTIKEL, klasse: 'artikel' },
    'kc-artikel-nurtext': { knoten: ARTIKEL, klasse: 'artikel nurtext' },
    'kc-bon-ausfuehrlich': { knoten: BON, klasse: 'bon ausfuehrlich' },
    'kc-bon-kompakt':     { knoten: BON, klasse: 'bon kompakt' },
    'kc-bon-tabelle':     { knoten: BON, klasse: 'bon tabelle' },
    'kc-bon-dunkel':      { knoten: BON, klasse: 'bon dunkel' },
    'kc-zahlen-fest':     { knoten: ['.cash-card', '.change-card'], klasse: 'zahlen fest' },
    /* Zahlen-Seite v4 (08.09.): Scheine und Münzen getrennt, Korrektur, Berechnung, Beleg, Tastenzeile */
    'kc-zahlen-scheine':  { knoten: ['#banknotes'], klasse: 'zahlen scheine' },
    'kc-zahlen-muenzen':  { knoten: ['#coins'], klasse: 'zahlen muenzen' },
    'kc-zahlen-korrektur': { eigen: 'korrektur', klasse: 'zahlen korrektur' },
    'kc-berechnung':      { knoten: ['.change-card'], klasse: 'zahlen berechnung' },
    'kc-beleg':           { eigen: 'beleg', klasse: 'zahlen beleg' },
    'kc-zahlen-tasten':   { eigen: 'tasten', klasse: 'zahlen tasten' },
    'kc-zahlen-rueckgeld': { knoten: ['.change-card'], klasse: 'zahlen rueckgeld' },
    'kc-zahlen-block':    { knoten: ['.keypad-shell'], klasse: 'zahlen block' },
    'kc-zahlen-arten':    { knoten: ZAHLARTEN, klasse: 'zahlen arten' },
    'kc-zahlen-taste':    { eigen: 'zahlenTaste', klasse: 'zahlen taste' },
    'kc-bedienblock':     { eigen: 'bedienblock', klasse: 'bedienblock' },
    'kc-sonder-leiste':   { knoten: SONDER, klasse: 'sonder leiste' },
    'kc-sonder-spalte':   { knoten: SONDER, klasse: 'sonder spalte' },
    'kc-sonder-menue':    { knoten: ['#moreBtn'], klasse: 'sonder menue' },
    'kc-funktionsleiste': { knoten: SONDER, klasse: 'sonder leiste' },
    /* Einzelknöpfe */
    'kn-tuer': { knoten: ['#headerExitBtn'], klasse: 'knopf' },
    'kn-menue': { knoten: ['#menuBtn'], klasse: 'knopf' },
    'kn-sperre': { knoten: ['#screenLockBtn'], klasse: 'knopf' },
    'kn-ton': { knoten: ['#cashSoundBtn'], klasse: 'knopf' },
    'kn-spiegeln': { knoten: ['#mirrorLayoutBtn'], klasse: 'knopf' },
    'kn-leds': { knoten: ['.header-status .supabase-led-group', '.header-status .kc-sync-leds', '.header-status .kc-led-block'], klasse: 'knopf leds' },
    'kn-logo': { knoten: ['.brand-block'], klasse: 'knopf logo' },
    'kn-titel': { knoten: ['.header-info'], klasse: 'knopf titel' },
    'kn-training': { knoten: ['#trainingModeTopBtn'], klasse: 'knopf' },
    'kn-stosszeit': { knoten: ['#rushModeBtn'], klasse: 'knopf' },
    'kn-happyhour': { knoten: ['#happyHourQuickBtn'], klasse: 'knopf' },
    'kn-meldungen': { knoten: ['.mode-message-center'], klasse: 'knopf meldungen' },
    'kn-bediener': { knoten: ['#operatorBtn'], klasse: 'knopf' },
    'kn-suche': { knoten: ['.product-search-wrap'], klasse: 'knopf' },
    'kn-konto': { knoten: ['#accountChargeBtn'], klasse: 'knopf' },
    'kn-personal': { knoten: ['#staffBtn'], klasse: 'knopf' },
    'kn-pfand': { knoten: ['#depositBtn'], klasse: 'knopf' },
    'kn-trinkgeld': { knoten: ['#tipBtn'], klasse: 'knopf' },
    'kn-reklamation': { knoten: ['#complaintBtn'], klasse: 'knopf' },
    'kn-mehr': { knoten: ['#moreBtn'], klasse: 'knopf' },
    'kn-bar': { knoten: ['#payBtn'], klasse: 'knopf' },
    'kn-stimmtso': { knoten: ['#exactCashBtn'], klasse: 'knopf' },
    'kn-aufrunden': { knoten: ['#roundUpBtn'], klasse: 'knopf' },
    'kn-zurueck': { knoten: ['#undoCashBtn'], klasse: 'knopf' },
    'kn-bonloeschen': { knoten: ['#voidBonBtn'], klasse: 'knopf' },
    'kn-rabatt': { knoten: ['#discountBtn'], klasse: 'knopf' },
    'kn-menge': { knoten: ['#cartQuantityBar'], klasse: 'knopf' },
    'kn-blaettern': { knoten: ['.sales-area .pager'], klasse: 'knopf' },
    'kn-warengruppe': { knoten: ['#categories'], klasse: 'gruppen leiste' },
  };
  const TEXTTYPEN = new Set(['kc-text', 'kc-textfeld', 'text']);

  /* Wo jeder verschobene Knoten ursprünglich stand - für "Standard". */
  const heimat = new Map();
  let aktiv = null;          // die angewandte Oberfläche
  let hauptRaster = null;    // Seite 1
  let zahlenEbene = null;    // Seite 2

  function merkeHeimat(n) {
    if (!heimat.has(n)) heimat.set(n, { eltern: n.parentNode, davor: n.nextSibling });
  }
  /* Alle bisher umgehängten Knoten an ihre ursprüngliche Stelle zurück. Danach ist die Kasse
     im Bauplan wieder das Original - nur eben unsichtbar, solange der Aufbau aktiv ist. */
  function allesHeim() {
    [...heimat.entries()].reverse().forEach(([n, h]) => {
      if (h.eltern) h.eltern.insertBefore(n, h.davor && h.davor.parentNode === h.eltern ? h.davor : null);
    });
    heimat.clear();
  }

  function rasterCss(el, o) {
    el.style.gridTemplateColumns = `repeat(${o.raster.spalten}, minmax(0, 1fr))`;
    el.style.gridTemplateRows = `repeat(${o.raster.zeilen}, minmax(0, 1fr))`;
  }

  /* Baut die Rahmen einer Seite in `ziel` und hängt die Knoten hinein. Was auf dieser Seite
     keinen Baustein hat, bleibt an seiner ursprünglichen Stelle - die ist im Aufbau per CSS
     unsichtbar, der Knoten aber vorhanden, damit app.js ihn weiter bedienen kann. */
  function verteile(seite, ziel, o) {
    allesHeim();
    ziel.innerHTML = '';
    rasterCss(ziel, o);
    const bericht = { zugeordnet: 0, platzhalter: [] };
    (seite.bausteine || []).forEach((b) => {
      const z = Z[b.typ];
      const r = document.createElement('div');
      r.className = 'kc-bereich ' + (z ? z.klasse : (TEXTTYPEN.has(b.typ) ? 'text' : 'platzhalter'));
      r.dataset.typ = b.typ;
      /* Linkshänder (Betreiber 08.09.): "Ansicht ändern" spiegelt im Aufbau den ganzen Verkaufs-
         bereich - jede Spalte wird am Raster gespiegelt, Warenkorb und Artikel tauschen die Seite. */
      const spalte = document.body.classList.contains('kc-spiegel-modus') ? o.raster.spalten - b.spalte - b.spalten : b.spalte;
      r.style.gridColumn = `${spalte + 1} / span ${b.spalten}`;
      r.style.gridRow = `${b.zeile + 1} / span ${b.zeilen}`;
      if (b.farbe && (TEXTTYPEN.has(b.typ) || !z)) r.style.background = b.farbe;
      if (z && z.raster) { r.style.setProperty('--kcs', z.raster[0]); r.style.setProperty('--kcz', z.raster[1]); }
      if (z && z.knoten) {
        let n = 0;
        if (b.typ.startsWith('kc-bon-')) { parkKnopfEinbauen(); geheimwegEinbauen(); }
        z.knoten.forEach((sel) => $$(sel).forEach((k) => { merkeHeimat(k); r.appendChild(k); n++; }));
        /* Kompakter Kopf (08.09., iPad-Foto): in einer Reihe passt auf 9 Zoll nicht alles. Deshalb
           zwei Zeilen in der Reihenfolge des Betreibers: oben rechts Tür · Menü · Ansicht · Uhr ·
           Ton · Schloss · Programm; darunter Logo · Herz · LED-Blöcke und die Meldungszeile. */
        if (b.typ === 'kc-kopf-kompakt') {
          /* Runde 4 (08.09.): alles in EINER Zeile (Logo links, Rest rechts); darunter nur die
             flache Meldungszeile mit dem Pfeil-Knopf. LED-Bloecke und Logo bleiben im Kopf. */
          const z2 = document.createElement('div'); z2.className = 'kc-kopf-zeile2 nur-meldung';
          const m = $('.mode-message-center', r); if (m) z2.appendChild(m);
          r.appendChild(z2);
        }
        if (n) bericht.zugeordnet++;
        else { r.classList.add('platzhalter'); r.textContent = `${b.typ}: Bereich in dieser Kasse nicht gefunden`; bericht.platzhalter.push(b.typ); }
      } else if (z && z.eigen === 'zahlenTaste') {
        r.appendChild(zahlenTasteBauen()); bericht.zugeordnet++;
      } else if (z && z.eigen === 'korrektur') {
        /* ZURÜCK nimmt die letzte Geldtaste zurück - die Kasse führt die Eingaben als Stapel,
           jeder Tipp geht einen Schritt zurück, also auch zehn Schritte. LÖSCHEN leert alles. */
        $$('#undoCashBtn').forEach((k) => { merkeHeimat(k); k.classList.add('kc-korrektur-zurueck'); r.appendChild(k); });
        const l = document.createElement('button');
        l.type = 'button'; l.id = 'kcGegebenLoeschen'; l.className = 'kc-korrektur-loeschen';
        l.innerHTML = '<strong>⌫ LÖSCHEN</strong><small>alles Gegebene</small>';
        l.addEventListener('click', () => { try { setGiven(0); } catch (e) { /* app.js nicht bereit */ } });
        r.appendChild(l); bericht.zugeordnet++;
      } else if (z && z.eigen === 'beleg') {
        const b = document.createElement('div'); b.id = 'kcBeleg'; b.className = 'kc-beleg';
        b.innerHTML = '<div class="kc-beleg-kopf">BON</div><pre class="kc-beleg-text"></pre>';
        r.appendChild(b); belegPflegen(); bericht.zugeordnet++;
      } else if (z && z.eigen === 'tasten') {
        const zu = document.createElement('button');
        zu.type = 'button'; zu.id = 'kcZahlenZurueckTaste'; zu.className = 'kc-taste-zurueck'; zu.title = 'Zurück zur Kasse - der Bon bleibt';
        zu.innerHTML = '<span aria-hidden="true">←</span><span class="kc-nur-vorlesen">Zurück zur Kasse</span>';
        zu.addEventListener('click', () => zahlenSeite(false));
        r.appendChild(zu);
        /* #cashChangeBtn = "BAR KASSIEREN · Rückgeld geben" - erscheint nur, wenn Rückgeld ansteht;
           #payBtn = BAR mit QR für den direkten Abschluss. Beide bleiben, wie die Kasse sie kennt. */
        ['#printBonBtn', '#tipBtn', '#roundUpBtn', '#exactCashBtn', '#cashChangeBtn', '#payBtn', '#cardBtn', '#accountChargeBtn'].forEach((sel) => $$(sel).forEach((k) => { merkeHeimat(k); r.appendChild(k); }));
        bericht.zugeordnet++;
      } else if (z && z.eigen === 'bedienblock') {
        const status = document.createElement('div'); status.className = 'kc-statuszeile';
        STATUS.forEach((sel) => $$(sel).forEach((k) => { merkeHeimat(k); status.appendChild(k); }));
        teamTextPflegen();
        const unten = document.createElement('div'); unten.className = 'kc-bedien-unten';
        unten.appendChild(zahlenTasteBauen());
        const sonder = document.createElement('div'); sonder.className = 'kc-bedien-sonder';
        SONDER_REST.forEach((sel) => $$(sel).forEach((k) => { merkeHeimat(k); sonder.appendChild(k); }));
        unten.appendChild(sonder);
        r.appendChild(status); r.appendChild(unten); bericht.zugeordnet++;
      } else if (TEXTTYPEN.has(b.typ)) {
        r.textContent = b.text || ''; bericht.zugeordnet++;
      } else {
        r.textContent = `${b.typ} – noch nicht an die Kasse angebunden`;
        bericht.platzhalter.push(b.typ);
      }
      ziel.appendChild(r);
    });
    return bericht;
  }

  /* Team-Taste: "Team · aktiv" (Team ist der Hauptbenutzer, auf den alles gebucht wird),
     sonst "Name · aktiv" (08.09., Betreiber). Folgt dem Namen, den die Kasse setzt. */
  function teamTextPflegen() {
    const b = $('#operatorBtn'); if (!b) return;
    const name = ($('#operatorBtnName') || {}).textContent || 'Team';
    const zustand = ($('#operatorConfirmState') || {}).textContent || 'aktiv';
    const t = `${name.trim()} · ${zustand.trim()}`;
    if (b.dataset.kcText !== t) b.dataset.kcText = t;
  }
  function zahlenTasteBauen() {
    const k = document.createElement('button');
    k.type = 'button'; k.id = 'kcZahlenTaste'; k.className = 'kc-zahlen-taste';
    k.innerHTML = '<strong>💶 RÜCKGELD</strong><small>Zahlen-Seite öffnen</small>';
    k.addEventListener('click', () => zahlenSeite(true));
    return k;
  }

  function seiteFinden(o, art) { return (o.seiten || []).find((s) => s.art === art) || null; }

  /* ------------------------------------------------------------------- Seite 2 */
  function zahlenSeite(auf) {
    if (!aktiv || !zahlenEbene) return false;
    const s2 = seiteFinden(aktiv, 'zahlen');
    if (auf) {
      if (!s2) return false;
      const raster = $('.kc-aufbau-raster', zahlenEbene);
      verteile(s2, raster, aktiv);
      zahlenEbene.hidden = false;
      document.body.classList.add('kc-zahlenseite-offen');
      $('#kcZahlenZurueck', zahlenEbene).hidden = !!$('#kcZahlenZurueckTaste', raster);
      belegPflegen();
    } else {
      zahlenEbene.hidden = true;
      document.body.classList.remove('kc-zahlenseite-offen');
      verteile(seiteFinden(aktiv, 'kasse') || { bausteine: [] }, hauptRaster, aktiv);
      nachbauen();
    }
    return true;
  }

  /* Nach dem Umhängen muss die Kasse ihre Flächen neu berechnen (Artikel je Seite usw.). */
  /* Pfand-Farbe aus der Warengruppen-Leiste holen -> Kacheln mit Pfand bekommen sie als Rahmen */
  function pfandFarbeSetzen() {
    const b = $('#categories button[data-cat="Pfand"]'); if (!b) return;
    const f = b.style.getPropertyValue('--group-flaeche') || getComputedStyle(b).backgroundColor;
    if (f) document.documentElement.style.setProperty('--kc-pfand-farbe', f.trim());
  }
  function nachbauen() {
    pfandFarbeSetzen();
    try { if (typeof global.renderProducts === 'function') global.renderProducts(); } catch (e) { /* app.js noch nicht so weit */ }
    try { if (typeof global.renderProductPager === 'function') global.renderProductPager(); } catch (e) { /* s.o. */ }
    scrollpfeilPruefen();
    bonAnzeigePflegen();
    belegPflegen();
    teamTextPflegen();
  }

  /* Scrollpfeil für die fließende Artikelfläche: erscheint nur, wenn unten noch Kacheln sind,
     und verschwindet am Ende. Ein Tipp darauf blättert um eine Sichthöhe weiter. */
  function scrollpfeilPruefen() {
    $$('.kc-bereich.artikel').forEach((r) => {
      const g = $('#productGrid', r);
      if (!g) return;
      let pfeil = $('.kc-scrollpfeil', r);
      if (!r.classList.contains('fliessend')) { if (pfeil) pfeil.hidden = true; return; }
      if (!pfeil) {
        pfeil = document.createElement('button');
        pfeil.type = 'button'; pfeil.className = 'kc-scrollpfeil'; pfeil.setAttribute('aria-label', 'Weitere Artikel');
        pfeil.innerHTML = '▼<small>mehr</small>';
        pfeil.addEventListener('click', () => g.scrollBy({ top: g.clientHeight - 40, behavior: 'smooth' }));
        r.appendChild(pfeil);
        g.addEventListener('scroll', () => scrollpfeilPruefen(), { passive: true });
      }
      const rest = g.scrollHeight - g.clientHeight - g.scrollTop;
      pfeil.hidden = rest <= 8;
    });
  }

  /* ------------------------------------------------------------- Artikel je Seite
     app.js zählt die Kacheln je Seite selbst (fest in der Standardansicht, gemessen in der
     neuen Ansicht). Im Aufbau gilt, was der Baustein sagt - oder, wenn er nichts sagt, was
     in den Rahmen passt. productsPerPage ist eine globale Funktion und wird hier umhüllt. */
  const urProductsPerPage = global.productsPerPage;
  function aufbauProductsPerPage() {
    if (aktiv && hauptRaster) {
      const r = $('.kc-bereich.artikel', document.body.classList.contains('kc-zahlenseite-offen') ? zahlenEbene : hauptRaster) || $('.kc-bereich.artikel', hauptRaster);
      if (r) {
        const s = parseInt(r.style.getPropertyValue('--kcs'), 10);
        const z = parseInt(r.style.getPropertyValue('--kcz'), 10);
        if (s && z) return s * z;
        /* Ohne festes Raster (Text-/Farbkacheln) wird FLIESSEND gezeigt - 08.09.2026 (Betreiber):
           "max. 3 Kacheln nebeneinander, die nächsten darunter, und wenn unten weitere kommen,
           ein Scrollbalken oder ein Scrollpfeil." Also: höchstens 3 Spalten, alle Artikel auf
           einer Seite, die Fläche scrollt, kein Blättern. */
        const g = $('#productGrid', r);
        if (g) {
          const f = g.getBoundingClientRect();
          const abstand = parseFloat(getComputedStyle(g).gap) || 8;
          const sp = Math.min(3, Math.max(1, Math.floor((f.width + abstand) / (140 + abstand))));
          r.classList.add('fliessend');
          r.style.setProperty('--kcs', sp);
          return 9999;
        }
      }
    }
    return typeof urProductsPerPage === 'function' ? urProductsPerPage() : 6;
  }
  if (typeof urProductsPerPage === 'function') global.productsPerPage = aufbauProductsPerPage;

  /* ------------------------------------------------------------------ Anwenden */
  function anwenden(id) {
    const P = global.KCOberflaechen;
    if (!P) return { ok: false, grund: 'kc-oberflaechen-pos.js fehlt' };
    if (id) {
      P.waehlen(id);
      try { localStorage.removeItem('kc.kassenoberflaeche.standard.v1'); } catch (e) { /* egal */ }
    }
    const o = P.gewaehlte();
    if (!o) return zuruecksetzen();
    if (!hauptRaster) {
      hauptRaster = document.createElement('div');
      hauptRaster.id = 'kcAufbau'; hauptRaster.className = 'kc-aufbau-raster';
      const shell = $('.app-shell') || document.body;
      shell.insertBefore(hauptRaster, shell.firstChild);
    }
    if (!zahlenEbene) {
      zahlenEbene = document.createElement('div');
      zahlenEbene.id = 'kcZahlenEbene'; zahlenEbene.hidden = true;
      zahlenEbene.innerHTML = '<div class="kc-aufbau-raster"></div><button type="button" id="kcZahlenZurueck" class="kc-zahlen-zurueck">↩ ZURÜCK ZUR KASSE</button>';
      document.body.appendChild(zahlenEbene);
      $('#kcZahlenZurueck', zahlenEbene).addEventListener('click', () => zahlenSeite(false));
      /* Bon abgeschlossen -> Seite 2 zu. Die Knöpfe werden per Capture belauscht, damit es
         gleich bleibt, egal wohin sie umgehängt werden. */
      document.addEventListener('click', (e) => {
        const t = e.target && e.target.closest && e.target.closest('#exactCashBtn, #cashChangeBtn, #payBtn');
        if (t && !zahlenEbene.hidden) setTimeout(() => { if (!global.state || !global.state.cart || !global.state.cart.length) zahlenSeite(false); }, 350);
      }, true);
    }
    aktiv = o;
    document.body.classList.add('kc-aufbau');
    document.body.classList.toggle('kc-aufbau-ohne-zahlenseite', !seiteFinden(o, 'zahlen'));
    const b = verteile(seiteFinden(o, 'kasse') || { bausteine: [] }, hauptRaster, o);
    hauptRaster.dataset.oberflaeche = o.id;
    // 10.09.2026 (Betreiber: "unauffällig einen Code einbauen der die Nummer der Oberfläche
    // zeigt, damit man nicht immer fragen muss, welche es ist"): kleine Kennung unten in der
    // Fußzeile - die einzige Stelle, die bei JEDER der (aktuell 19) Vorlagen unverändert
    // gleich bleibt und garantiert nichts überdeckt (sie gehört nicht zum Baukasten-Raster,
    // liegt fest außerhalb davon).
    const nummerFeld = document.getElementById('kcAufbauNummer');
    if (nummerFeld) { nummerFeld.hidden = !o.kcNummer; nummerFeld.textContent = o.kcNummer || ''; }
    const nummerMuetze = document.getElementById('kcAufbauNummerMuetze');
    if (nummerMuetze) { nummerMuetze.hidden = !o.kcNummer; nummerMuetze.textContent = o.kcNummer || ''; }
    nachbauen();
    console.info(`KC Aufbau (${VERSION}): „${o.name}“ angewandt – ${b.zugeordnet} Bereiche, ${b.platzhalter.length} Platzhalter${b.platzhalter.length ? ' (' + b.platzhalter.join(', ') + ')' : ''}.`);
    return { ok: true, oberflaeche: o.id, ...b };
  }

  function zuruecksetzen() {
    if (zahlenEbene) { zahlenEbene.hidden = true; document.body.classList.remove('kc-zahlenseite-offen'); }
    allesHeim();
    if (hauptRaster) hauptRaster.innerHTML = '';
    aktiv = null;
    document.body.classList.remove('kc-aufbau', 'kc-aufbau-ohne-zahlenseite');
    const nummerFeld = document.getElementById('kcAufbauNummer');
    if (nummerFeld) nummerFeld.hidden = true;
    const nummerMuetze = document.getElementById('kcAufbauNummerMuetze');
    if (nummerMuetze) nummerMuetze.hidden = true;
    // "Standard (wie bisher)" ist ebenfalls eine bewusste manuelle Wahl. Die alte
    // KC-Auswahl wird entfernt und ein eigener Standard-Marker gesetzt. Ohne Marker bedeutet
    // "keine ID" weiterhin: frisches Geraet -> passende KC003/KC004-Ansicht automatisch waehlen.
    try {
      localStorage.removeItem('kc.kassenoberflaeche.gewaehlt.v1');
      localStorage.setItem('kc.kassenoberflaeche.standard.v1', '1');
    } catch (e) { /* egal */ }
    nachbauen();
    return { ok: true, oberflaeche: null };
  }

  /* ----------------------------------------------------------------- Warenkorb parken
     08.09.2026 (Betreiber): "ein blaues P für Warenkorb parken; wenn geparkte Körbe da sind,
     das P mit rotem Hintergrund und einer kleinen Zahl; eine Seite, die die einzelnen
     geparkten Bons wieder in den Warenkorb holt." Der Knopf sitzt neben dem Warenkorb-Symbol
     in der Bon-Kopfzeile. Geparkte Körbe überleben ein Neuladen (localStorage). */
  const PARK_LAGER = 'kc.geparkte-bons.v1';
  function geparkte() { try { return JSON.parse(localStorage.getItem(PARK_LAGER) || '[]') || []; } catch (e) { return []; } }
  function geparkteSchreiben(liste) { try { localStorage.setItem(PARK_LAGER, JSON.stringify(liste)); } catch (e) { /* voll */ } parkKnopfPflegen(); }
  function kasseState() { try { return state; } catch (e) { return null; } }
  function kasseSumme(cart) {
    try { const st = kasseState(); const alt = st.cart; st.cart = cart; const t = total(); st.cart = alt; return t; } catch (e) { return 0; }
  }
  function neuZeichnen() {
    try { renderCart(); } catch (e) { /* egal */ }
    try { renderProducts(); } catch (e) { /* egal */ }
    try { updateChange(); } catch (e) { /* egal */ }
  }
  function parken() {
    const st = kasseState(); if (!st || !st.cart || !st.cart.length) return false;
    const eintrag = { id: 'p' + Date.now().toString(36), zeit: new Date().toISOString(), bon: (() => { try { return bonText(); } catch (e) { return ''; } })(),
      cart: JSON.parse(JSON.stringify(st.cart)), discount: JSON.parse(JSON.stringify(st.discount || {})), summe: (() => { try { return total(); } catch (e) { return 0; } })(),
      bediener: (st.master && st.master.operatorName) || '' };
    const liste = geparkte(); liste.push(eintrag); geparkteSchreiben(liste);
    st.cart = []; try { resetDiscount(); } catch (e) { /* egal */ } try { setGiven(0); } catch (e) { /* egal */ }
    st.selectedCartKey = null; neuZeichnen();
    try { notify && notify('success', `Bon geparkt (${liste.length} geparkt)`); } catch (e) { /* egal */ }
    return true;
  }
  function holen(id, anhaengen) {
    const st = kasseState(); if (!st) return false;
    const liste = geparkte(); const i = liste.findIndex((x) => x.id === id); if (i < 0) return false;
    const e = liste[i];
    if (st.cart.length && !anhaengen) return 'voll';
    st.cart = anhaengen ? st.cart.concat(e.cart) : e.cart;
    if (!anhaengen && e.discount) st.discount = e.discount;
    if (!st.cart.length) { /* nichts */ } else if (!st.cartStartedAt) st.cartStartedAt = e.zeit;
    liste.splice(i, 1); geparkteSchreiben(liste);
    neuZeichnen(); parkSeite(false);
    try { notify && notify('success', 'Geparkter Bon zurückgeholt'); } catch (e2) { /* egal */ }
    return true;
  }
  function verwerfen(id) { geparkteSchreiben(geparkte().filter((x) => x.id !== id)); parkSeiteZeichnen(); }
  let parkEbene = null;
  function parkSeite(auf) {
    if (!parkEbene) {
      parkEbene = document.createElement('div'); parkEbene.id = 'kcParkEbene'; parkEbene.hidden = true;
      parkEbene.innerHTML = '<div class="kc-park-kopf"><strong>Geparkte Bons</strong><button type="button" id="kcParkZu" class="kc-park-zu">↩ ZURÜCK ZUR KASSE</button></div><div class="kc-park-liste"></div>';
      document.body.appendChild(parkEbene);
      $('#kcParkZu', parkEbene).addEventListener('click', () => parkSeite(false));
      parkEbene.addEventListener('click', (ev) => {
        const b = ev.target.closest('button[data-park]'); if (!b) return;
        const id = b.dataset.park, was = b.dataset.was;
        if (was === 'verwerfen') {
          /* zweistufig ohne Browser-Dialog: erster Tipp fragt, zweiter verwirft */
          if (b.dataset.sicher) { verwerfen(id); return; }
          b.dataset.sicher = '1'; b.textContent = 'WIRKLICH?'; setTimeout(() => { if (b.isConnected) { delete b.dataset.sicher; b.textContent = '🗑'; } }, 4000);
          return;
        }
        const erg = holen(id, was === 'anhaengen');
        if (erg === 'voll') { const k = $(`[data-park="${id}"][data-was="anhaengen"]`, parkEbene); if (k) k.hidden = false; const h = $('.kc-park-hinweis', parkEbene); if (h) h.textContent = 'Der Warenkorb ist nicht leer - „Anhängen" fügt die Positionen dazu.'; }
      });
    }
    parkEbene.hidden = !auf;
    if (auf) parkSeiteZeichnen();
  }
  function parkSeiteZeichnen() {
    if (!parkEbene) return;
    const geld = (v) => { try { return money(v); } catch (e) { return v + ' €'; } };
    const l = geparkte();
    const st = kasseState(); const voll = !!(st && st.cart && st.cart.length);
    $('.kc-park-liste', parkEbene).innerHTML = (l.length ? l.map((e) => {
      const z = new Date(e.zeit); const uhr = z.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const pos = e.cart.map((x) => `${x.qty}× ${x.name}`).join(' · ');
      return `<div class="kc-park-karte"><div class="kc-park-info"><b>${uhr} Uhr</b> · ${e.cart.length} Pos. · <b>${geld(e.summe)}</b>${e.bediener ? ' · ' + e.bediener : ''}<div class="kc-park-pos">${pos}</div></div>
        <div class="kc-park-tasten"><button type="button" class="kc-park-holen" data-park="${e.id}" data-was="holen">⬇ HOLEN</button><button type="button" class="kc-park-anhaengen" data-park="${e.id}" data-was="anhaengen" ${voll ? '' : 'hidden'}>＋ ANHÄNGEN</button><button type="button" class="kc-park-weg" data-park="${e.id}" data-was="verwerfen">🗑</button></div></div>`;
    }).join('') : '<div class="kc-park-leer">Keine geparkten Bons.</div>') + `<div class="kc-park-hinweis">${voll ? 'Der Warenkorb ist nicht leer - „Anhängen" fügt die Positionen dazu, „Holen" geht nur bei leerem Warenkorb.' : ''}</div>`;
  }
  function parkKnopfEinbauen() {
    const kopf = $('.cart-title .cart-heading'); if (!kopf || $('#kcParkBtn', kopf)) return;
    const k = document.createElement('button');
    k.type = 'button'; k.id = 'kcParkBtn'; k.className = 'kc-park-knopf'; k.title = 'Warenkorb parken · geparkte Bons';
    k.innerHTML = '<b>P</b><i class="kc-park-zahl" hidden></i>';
    k.addEventListener('click', () => {
      const st = kasseState(); const n = geparkte().length;
      /* Mit Positionen im Korb: parken. Bei leerem Korb: die Liste der geparkten Bons. */
      if (st && st.cart && st.cart.length) parken(); else parkSeite(true);
    });
    kopf.appendChild(k); parkKnopfPflegen();
  }
  function parkKnopfPflegen() {
    const k = $('#kcParkBtn'); if (!k) return;
    const n = geparkte().length; const z = $('.kc-park-zahl', k);
    let leer = true; try { leer = !(state.cart && state.cart.length); } catch (e) { leer = true; }
    k.classList.toggle('mit-bons', n > 0); z.hidden = !n; z.textContent = n;
    /* 08.09. (Betreiber): grau, solange nichts im Warenkorb liegt und nichts geparkt ist */
    k.classList.toggle('leer', leer && n === 0);
  }

  /* ------------------------------------------------------ Geheimweg zu den Kassenfunktionen
     08.09.2026 (Betreiber): Im Mehr-Fenster darf jeder Gutschein, Währungsrechner usw. sehen;
     Tagesabschluss & Co. verraten, dass es keine Bilderkasse ist - die kommen nur über einen
     Geheimweg: Warenkorb-Symbol 6 Sekunden gedrückt halten, dann vierstellige PIN. Hat nichts
     mit dem Admin-Bereich zu tun. Ohne gesetzte PIN wird beim ersten Mal eine festgelegt. */
  const VERSTECKT = ['opening', 'closing', 'cashdeposit', 'withdraw', 'vorfuehrung', 'central', 'rush', 'training'];
  const PIN_LAGER = 'kc.kassenfunktionen.pin.v1', OFFEN_MS = 5 * 60 * 1000;
  let offenBis = 0, fehlversuche = 0, sperreBis = 0;
  function pinGesetzt() { try { return !!localStorage.getItem(PIN_LAGER); } catch (e) { return false; } }
  function pinPruefen(p) { try { return localStorage.getItem(PIN_LAGER) === pinHash(p); } catch (e) { return false; } }
  function pinHash(p) { let h = 5381; for (const c of String(p)) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return 'h' + (h >>> 0).toString(16); }
  function kassenfunktionenPflegen() {
    const offen = Date.now() < offenBis;
    document.body.classList.toggle('kc-kassenfunktionen-offen', offen);
    if (offen) setTimeout(kassenfunktionenPflegen, Math.min(OFFEN_MS, offenBis - Date.now() + 50));
  }
  let pinEbene = null, pinPuffer = '', pinModus = 'pruefen', pinErst = '';
  function pinSeite(auf) {
    if (!pinEbene) {
      pinEbene = document.createElement('div'); pinEbene.id = 'kcPinEbene'; pinEbene.className = 'kc-ebene'; pinEbene.hidden = true;
      pinEbene.innerHTML = '<div class="kc-pin-karte"><div class="kc-pin-titel"></div><div class="kc-pin-punkte"></div><div class="kc-pin-tasten">' + ['1','2','3','4','5','6','7','8','9','⌫','0','✕'].map((t) => `<button type="button" data-pin="${t}">${t}</button>`).join('') + '</div><div class="kc-pin-hinweis"></div></div>';
      document.body.appendChild(pinEbene);
      pinEbene.addEventListener('click', (ev) => { const b = ev.target.closest('button[data-pin]'); if (!b) return; pinTaste(b.dataset.pin); });
    }
    pinEbene.hidden = !auf; if (!auf) return;
    pinPuffer = ''; pinErst = ''; pinModus = pinGesetzt() ? 'pruefen' : 'neu';
    pinZeichnen('');
  }
  function pinZeichnen(hinweis) {
    $('.kc-pin-titel', pinEbene).textContent = pinModus === 'pruefen' ? 'PIN' : (pinModus === 'neu' ? 'Neue PIN festlegen' : 'PIN wiederholen');
    $('.kc-pin-punkte', pinEbene).textContent = '●'.repeat(pinPuffer.length) + '○'.repeat(4 - pinPuffer.length);
    $('.kc-pin-hinweis', pinEbene).textContent = hinweis || '';
  }
  function pinTaste(t) {
    if (t === '✕') { pinSeite(false); return; }
    if (t === '⌫') { pinPuffer = pinPuffer.slice(0, -1); pinZeichnen(''); return; }
    if (Date.now() < sperreBis) { pinZeichnen('Bitte kurz warten.'); return; }
    if (pinPuffer.length >= 4) return;
    pinPuffer += t; pinZeichnen('');
    if (pinPuffer.length < 4) return;
    if (pinModus === 'neu') { pinErst = pinPuffer; pinPuffer = ''; pinModus = 'wiederholen'; pinZeichnen(''); return; }
    if (pinModus === 'wiederholen') {
      if (pinPuffer !== pinErst) { pinModus = 'neu'; pinPuffer = ''; pinErst = ''; pinZeichnen('Stimmte nicht überein - noch einmal.'); return; }
      try { localStorage.setItem(PIN_LAGER, pinHash(pinPuffer)); } catch (e) { /* voll */ }
      offenBis = Date.now() + OFFEN_MS; kassenfunktionenPflegen(); pinSeite(false); mehrOeffnen(); return;
    }
    if (pinPruefen(pinPuffer)) { fehlversuche = 0; offenBis = Date.now() + OFFEN_MS; kassenfunktionenPflegen(); pinSeite(false); mehrOeffnen(); }
    else { fehlversuche++; pinPuffer = ''; if (fehlversuche >= 3) { sperreBis = Date.now() + 60000; fehlversuche = 0; pinSeite(false); } else pinZeichnen(''); }
  }
  /* 08.09. (Betreiber): nach langem Druck + PIN eine EIGENE Seite "Kassenfunktionen", nicht das
     Mehr-Fenster. Die Tasten lösen dieselben Knöpfe aus, die im Mehr-Fenster versteckt sind. */
  const FUNKTIONEN = [
    ['opening', '🔓', 'Eröffnung', 'Kasse für den Tag eröffnen'], ['closing', '🧾', 'Tagesabschluss', 'Kasse abschließen und melden'],
    ['cashdeposit', '💶', 'Bargeldübergabe', 'Übergabe per QR/Kurzcode annehmen'], ['withdraw', '📤', 'Entnahme', 'Geld aus der Kasse nehmen'],
    ['vorfuehrung', '🎬', 'Vorführdaten', 'Daten für die Vorführung'], ['central', '🛰', 'Servicefreigabe', 'Fernzugriff freigeben'],
    ['rush', '⚡', 'Stoßbetrieb', 'Stoßzeiten-Modus schalten'], ['training', '🎓', 'Training', 'Trainingsmodus schalten'],
  ];
  let funkEbene = null;
  function funktionenSeite(auf) {
    if (!funkEbene) {
      funkEbene = document.createElement('div'); funkEbene.id = 'kcFunktionenEbene'; funkEbene.className = 'kc-ebene'; funkEbene.hidden = true;
      funkEbene.innerHTML = '<div class="kc-ebene-kopf"><strong>Kassenfunktionen</strong><button type="button" class="kc-ebene-zu">↩ ZURÜCK ZUR KASSE</button></div><div class="kc-ebene-inhalt"><div class="kc-funk-raster">' +
        FUNKTIONEN.map(([a, i, t, u]) => `<button type="button" class="kc-funk" data-funk="${a}"><span class="kc-funk-icon">${i}</span><b>${t}</b><small>${u}</small></button>`).join('') + '</div><p class="kc-park-hinweis">Diese Seite bleibt 5 Minuten nach der PIN erreichbar; danach fragt der Geheimweg erneut.</p></div>';
      document.body.appendChild(funkEbene);
      $('.kc-ebene-zu', funkEbene).addEventListener('click', () => funktionenSeite(false));
      funkEbene.addEventListener('click', (ev) => {
        const b = ev.target.closest('button[data-funk]'); if (!b) return;
        const ziel = $(`#moreDialog .more-grid button[data-action="${b.dataset.funk}"]`);
        funktionenSeite(false);
        if (ziel) ziel.click();
      });
    }
    funkEbene.hidden = !auf;
  }
  function mehrOeffnen() { funktionenSeite(true); }
  /* NOTFALLZUGANG (08.09., Betreiber): "Wenn der vierstellige Code weg ist, muss die geheime
     Seite trotzdem erreichbar sein - über den PC-Manager oder den geheimen Admin-Bereich."
     1. Admin-Bereich der Kasse (Master-PIN): Knopf "Kassen-PIN zurücksetzen" - danach fragt der
        Geheimweg beim nächsten Mal wieder nach einer neuen PIN.
     2. PC-Manager: Fernbefehl "kassen_pin_zuruecksetzen" (kc-sync-remote-command.js), gleiche Wirkung. */
  function kassenPinZuruecksetzen(quelle) {
    try { localStorage.removeItem(PIN_LAGER); } catch (e) { /* egal */ }
    offenBis = 0; fehlversuche = 0; sperreBis = 0; kassenfunktionenPflegen();
    try { setSystemHint && setSystemHint(`Kassen-PIN zurückgesetzt (${quelle}) - beim nächsten Geheimweg wird eine neue festgelegt`); } catch (e) { /* egal */ }
    return true;
  }
  function notfallKnopfEinbauen() {
    const dlg = $('#adminHomeDialog'); if (!dlg || $('#kcKassenPinReset', dlg)) return;
    const vorbild = $('#sharedCashControlOpen', dlg) || $('[data-admin-target="security"]', dlg); if (!vorbild) return;
    const b = document.createElement('button'); b.type = 'button'; b.id = 'kcKassenPinReset';
    b.textContent = 'Kassen-PIN (Geheimweg) zurücksetzen';
    b.addEventListener('click', () => { kassenPinZuruecksetzen('Admin-Bereich'); b.textContent = 'Kassen-PIN zurückgesetzt ✓'; setTimeout(() => { b.textContent = 'Kassen-PIN (Geheimweg) zurücksetzen'; }, 3000); });
    vorbild.parentNode.insertBefore(b, vorbild.nextSibling);
  }
  function geheimwegEinbauen() {
    const sym = $('.cart-title .cart-heading-icon'); if (!sym || sym.dataset.kcGeheim) return; sym.dataset.kcGeheim = '1';
    let t = null, lang = false;
    const los = () => { clearTimeout(t); lang = false; t = setTimeout(() => { lang = true; pinSeite(true); }, 6000); };
    const stop = () => clearTimeout(t);
    sym.addEventListener('pointerdown', los); ['pointerup', 'pointerleave', 'pointercancel'].forEach((e) => sym.addEventListener(e, stop));
    /* kurzer Tipp = Sammelbestellung */
    /* WICHTIG (09.09.2026, echter Fund): app.js hat auf demselben Symbol schon eine eigene,
       ältere Funktion ("Warenkorb erweitern", body.kc-cart-expanded mit einer Favoritenleiste
       auf z-index 9001) - ohne Gegenmaßnahme feuerten beide Klick-Behandlungen gleichzeitig,
       und die alte Leiste legte sich über die Sammelbestellung. Capture-Phase + sofortiges
       Stoppen NUR im Aufbau, damit die alte Funktion diesen Klick gar nicht erst sieht; die
       Standardansicht (kc-aufbau nicht gesetzt) bleibt davon unberührt. */
    sym.addEventListener('click', (ev) => {
      if (!document.body.classList.contains('kc-aufbau')) return;
      ev.stopImmediatePropagation(); ev.preventDefault();
      if (document.body.classList.contains('kc-cart-expanded')) document.body.classList.remove('kc-cart-expanded');
      if (!lang) sammelSeite(true);
      lang = false;
    }, true);
    sym.style.cursor = 'pointer'; sym.style.touchAction = 'none';
  }

  /* ------------------------------------------------------------ Sammelbestellung
     08.09. (Betreiber): "Wenn der Warenkorb angetippt wird, ein Fenster über die ganze Breite:
     links die Warengruppen, rechts die Artikel. Alle auf einmal antippen, Angetippte markiert,
     zweimal antippen = zweimal übernehmen, Varianten mit auswählen. Unten Alle übernehmen,
     Abbruch, Zurück-Pfeil wie auf Seite 2." Übernahme läuft über addConfiguredProduct - derselbe
     Weg wie ein Kacheltipp, mit Pfand, Angebot und Variante. */
  let sammelEbene = null, sammelWahl = {};   /* schluessel -> anzahl */
  // 10.09.2026 (Betreiber: "bei Klick alle dazugehoerigen einklappen mit Effekt als wenn ein
  // Lamellenvorhang sich schliesst, einer nach dem anderen"): Gruppenname -> eingeklappt (true/false).
  let sammelEingeklappt = {};
  const SAMMEL_ANSICHT_LAGER = 'kc.sammel.ansicht.v1';
  let sammelAnsicht = (() => { try { return localStorage.getItem(SAMMEL_ANSICHT_LAGER) || 'bild'; } catch (e) { return 'bild'; } })();
  /* Dieselbe Kontrastregel wie im Rest der Kasse (app.js: farbeZuRgb/farbHelligkeit) - eigene,
     kleine Nachbildung hier, damit dieses Modul nicht auf app.js-Interna angewiesen ist. */
  function sammelKontrast(farbe) {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(farbe || '').trim());
    let r = 49, g = 93, b = 141;   /* Vorgabe: #315d8d, dieselbe wie bei den Artikelkarten heute */
    if (m) { const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]; r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16); }
    const hell = 0.299 * r + 0.587 * g + 0.114 * b;
    return hell > 150 ? '#111827' : '#ffffff';
  }
  /* OPTIONS/PRODUCTS sind in app.js const/let auf oberster Ebene - kein window.*, aber per Name erreichbar */
  const kOPT = () => { try { return OPTIONS || {}; } catch (e) { return {}; } };
  const kPROD = () => { try { return PRODUCTS || []; } catch (e) { return []; } };
  function sammelSchluessel(p, o) { return p.id + '|' + (o ? o.id : ''); }
  function sammelGruppen() { try { return categories(); } catch (e) { return []; } }
  function sammelArtikel(gruppe) {
    let st; try { st = state; } catch (e) { return []; }
    const alt = st.activeCategory; st.activeCategory = gruppe;
    let liste = []; try { liste = allProductsForCategory(); } catch (e) { liste = []; }
    st.activeCategory = alt; return liste;
  }
  function sammelSeite(auf) {
    if (!sammelEbene) {
      sammelEbene = document.createElement('div'); sammelEbene.id = 'kcSammelEbene'; sammelEbene.className = 'kc-ebene'; sammelEbene.hidden = true;
      // 10.09.2026 (Betreiber: "unten die Buttons schmal, dafuer nebeneinander, einer der MEHR
      // heisst - dort die Bild/Farbe/Text-Knoepfe hin, damit sie unten keine Zeile verbrauchen"):
      // aus zwei Zeilen (Ansicht-Wahl oben, Aktionen unten) wird eine einzige, kompakte Zeile -
      // Bild/Farbe/Text wandern in ein kleines Einblendfeld, das der MEHR-Knopf oeffnet.
      sammelEbene.innerHTML = '<div class="kc-sammel-kopf"><strong>Sammelbestellung</strong><span class="kc-sammel-stand"></span></div><div class="kc-sammel-mitte"><div class="kc-sammel-artikel"></div></div>'
        + '<div class="kc-sammel-fuss"><div class="kc-sammel-mehr-popup" id="kcSammelMehrPopup" hidden><button type="button" data-sammel-ansicht="bild"><span class="kc-sammel-vorschau vs-bild"></span>Bild</button><button type="button" data-sammel-ansicht="farbe"><span class="kc-sammel-vorschau vs-farbe"></span>Farbe</button><button type="button" data-sammel-ansicht="text"><span class="kc-sammel-vorschau vs-text"></span>Text</button></div><button type="button" class="kc-taste-zurueck" data-sammel="zurueck" title="Zurück - Auswahl bleibt"><span aria-hidden="true">←</span></button><button type="button" class="kc-sammel-abbruch" data-sammel="abbruch">✕ ABBRUCH</button><button type="button" class="kc-sammel-uebernehmen" data-sammel="uebernehmen">✓ ÜBERNEHMEN</button><button type="button" class="kc-sammel-bar" data-sammel="bar">💶 BAR</button><button type="button" class="kc-sammel-rueckgeld" data-sammel="rueckgeld">↪ RÜCKGELD</button><button type="button" class="kc-sammel-mehr" data-sammel="mehr" aria-haspopup="true" aria-expanded="false">⋯ MEHR</button></div>';
      document.body.appendChild(sammelEbene);
      // 09.09.2026: die Gruppenliste links samt Zu-/Aufklappen entfaellt - alle Spalten sind
      // jetzt immer gleichzeitig sichtbar, daher auch kein langer Druck zum Zuklappen mehr.
      sammelEbene.addEventListener('click', (ev) => {
        const av = ev.target.closest('button[data-sammel-ansicht]'); if (av) { sammelAnsicht = av.dataset.sammelAnsicht; try { localStorage.setItem(SAMMEL_ANSICHT_LAGER, sammelAnsicht); } catch (e) { /* voll */ } sammelMehrSchliessen(); sammelZeichnen(); return; }
        const m = ev.target.closest('button[data-sammel-minus]'); if (m) { ev.stopPropagation(); ev.preventDefault(); const k = m.dataset.sammelMinus; if (sammelWahl[k] > 0) sammelWahl[k]--; if (!sammelWahl[k]) delete sammelWahl[k]; sammelZeichnen(); return; }
        const kopf = ev.target.closest('[data-sammel-kopf]'); if (kopf) { sammelGruppeUmschalten(kopf.dataset.sammelKopf); return; }
        const a = ev.target.closest('[data-sammel-key]'); if (a) { const k = a.dataset.sammelKey; sammelWahl[k] = (sammelWahl[k] || 0) + 1; sammelZeichnen(); return; }
        const f = ev.target.closest('button[data-sammel]'); if (!f) return;
        if (f.dataset.sammel === 'zurueck') sammelSeite(false);
        else if (f.dataset.sammel === 'abbruch') { sammelWahl = {}; sammelSeite(false); }
        else if (f.dataset.sammel === 'uebernehmen') { sammelUebernehmen(); sammelSeite(false); }
        /* 08.09. (Betreiber): direkt aus der Sammelbestellung kassieren bzw. abschließen */
        else if (f.dataset.sammel === 'bar') { sammelUebernehmen(); sammelSeite(false); setTimeout(() => { const b = $('#payBtn'); if (b) b.click(); }, 150); }
        else if (f.dataset.sammel === 'rueckgeld') { sammelUebernehmen(); sammelSeite(false); setTimeout(() => zahlenSeite(true), 150); }
        // 10.09.2026: MEHR oeffnet/schliesst das kleine Einblendfeld mit Bild/Farbe/Text.
        else if (f.dataset.sammel === 'mehr') { sammelMehrUmschalten(f); }
      });
      // Ausserhalb des Einblendfelds antippen schliesst es wieder (nicht ueber den obigen
      // Click-Handler, da dieser bei jedem Kartentipp sonst mitpruefen muesste).
      sammelEbene.addEventListener('click', (ev) => {
        const popup = $('#kcSammelMehrPopup', sammelEbene); if (!popup || popup.hidden) return;
        if (ev.target.closest('#kcSammelMehrPopup') || ev.target.closest('[data-sammel="mehr"]')) return;
        sammelMehrSchliessen();
      });
    }
    sammelEbene.hidden = !auf;
    if (auf) sammelZeichnen();
  }
  // 10.09.2026 (Betreiber: "bei Klick alle dazugehoerigen einklappen mit Effekt als wenn ein
  // Lamellenvorhang sich schliesst, einer nach dem anderen"): beim Einklappen wird NICHT sofort
  // neu gezeichnet (das wuerde die Karten schlagartig entfernen, keine Animation moeglich).
  // Stattdessen wird jede vorhandene Karte einzeln mit steigender Verzoegerung eingeklappt
  // (Lamellen-Optik: von oben nach unten, eine nach der anderen), und erst wenn die letzte
  // fertig ist, wird der endgueltige (leere) Zustand gezeichnet. Aufklappen ist bewusst sofort -
  // der Betreiber wollte den Effekt nur fuers Schliessen.
  function sammelGruppeUmschalten(gruppe) {
    const spalte = sammelEbene && sammelEbene.querySelector(`.kc-sammel-spalte[data-sammel-gruppe="${CSS.escape(gruppe)}"]`);
    if (!spalte) { sammelEingeklappt[gruppe] = !sammelEingeklappt[gruppe]; sammelZeichnen(); return; }
    if (sammelEingeklappt[gruppe]) { sammelEingeklappt[gruppe] = false; sammelZeichnen(); return; }
    const karten = [...spalte.querySelectorAll('.kc-sammel-karte')];
    if (!karten.length) { sammelEingeklappt[gruppe] = true; sammelZeichnen(); return; }
    const SCHRITT = 45;   /* ms zwischen den einzelnen Lamellen */
    karten.forEach((karte, i) => {
      karte.style.transitionDelay = (i * SCHRITT) + 'ms';
      karte.classList.add('kc-sammel-schliessen');
    });
    const gesamtdauer = (karten.length - 1) * SCHRITT + 260;   /* letzte Verzoegerung + eigene Dauer */
    setTimeout(() => { sammelEingeklappt[gruppe] = true; sammelZeichnen(); }, gesamtdauer);
  }
  // 10.09.2026: das kleine Einblendfeld mit Bild/Farbe/Text - oeffnet ueber dem MEHR-Knopf,
  // schliesst bei erneutem Antippen, bei Auswahl einer Ansicht oder bei Tipp ausserhalb.
  function sammelMehrUmschalten(knopf) {
    const popup = $('#kcSammelMehrPopup', sammelEbene); if (!popup) return;
    const auf = popup.hidden;
    popup.hidden = !auf;
    knopf.setAttribute('aria-expanded', auf ? 'true' : 'false');
  }
  function sammelMehrSchliessen() {
    const popup = $('#kcSammelMehrPopup', sammelEbene); if (!popup) return;
    popup.hidden = true;
    const knopf = $('[data-sammel="mehr"]', sammelEbene); if (knopf) knopf.setAttribute('aria-expanded', 'false');
  }
  function sammelZeichnen() {
    if (!sammelEbene) return;
    const geld = (v) => { try { return money(v); } catch (e) { return v + ' €'; } };
    const gruppen = sammelGruppen();
    // 09.09.2026 (Betreiber): "Die WG-Gruppen sollen sich so den kompletten Bildschirm teilen,
    // dass genau die 5 oder 6 nebeneinanderpassen. Die Artikel-Knoepfe duerfen dabei nur so
    // gross sein wie die WG-Knoepfe, dann gibt es ein Raster, alle auf gleicher Linie." Ersetzt
    // die vorherige Aufteilung (schmale Gruppenliste links + breite, aufklappbare Abschnitte
    // rechts, die viel Scrollen brauchte) durch gleich breite Spalten, EINE je Warengruppe,
    // alle gleichzeitig sichtbar - keine Liste zum Anwaehlen mehr noetig, kein Zu-/Aufklappen.
    $('.kc-sammel-artikel', sammelEbene).innerHTML = gruppen.map((g) => {
      const b = $(`#categories button[data-cat="${CSS.escape(g)}"]`);
      const st = b ? b.getAttribute('style') || '' : '';
      const sym = b ? (b.querySelector('.kategorie-symbol') || {}).innerHTML || '' : '';
      const artikel = sammelArtikel(g);
      const anz = Object.keys(sammelWahl).filter((k) => {
        const p = kPROD().find((x) => x.id === k.split('|')[0]);
        return p && (p.category === g || (Array.isArray(p.displayCategories) && p.displayCategories.includes(g)));
      }).reduce((n, k) => n + sammelWahl[k], 0);
      // 10.09.2026 (Betreiber: "den Info-Button weg, der tut es da nicht"): bestätigt - das "i" hatte
      // NIE einen Klick-Handler (aria-hidden="true" schon von Anfang an), reine Dekoration ohne
      // jede Funktion. Entfernt.
      const karte = (p, o) => { const k = sammelSchluessel(p, o); const n = sammelWahl[k] || 0;
        const gruppenButton = $(`#categories button[data-cat="${CSS.escape(g)}"]`);
        const gruppenFarbe = gruppenButton ? (gruppenButton.style.getPropertyValue('--group-color') || '#315d8d') : '#315d8d';
        const farbe = p.color || gruppenFarbe || '#315d8d';
        const textfarbe = sammelAnsicht === 'farbe' ? sammelKontrast(farbe) : '';
        const bild = sammelAnsicht === 'bild' && p.image ? `<img src="${p.image}" alt="">` : '';
        const name = o ? (o.label || o.name) : p.name;
        const preis = Number(p.price || 0) + Number(o?.price || 0);
        const pfand = Array.isArray(p.depositComponents) ? p.depositComponents.reduce((sum, d) => sum + Number(d.price || 0), 0) : 0;
        return `<div role="button" tabindex="0" data-sammel-key="${k}" class="kc-sammel-karte ansicht-${sammelAnsicht}${n ? ' gewaehlt' : ''}${o ? ' variante' : ''}" style="--tile-color:${farbe};${textfarbe ? `--tile-text:${textfarbe};` : ''}">${bild}<span class="kc-sammel-name">${name}</span><span class="kc-sammel-preis">${geld(preis)}</span>${pfand > 0 ? `<span class="kc-sammel-pfand">+ ${geld(pfand)} Pfand</span>` : ''}${n ? `<b class="kc-sammel-anzahl">${n}×</b><button type="button" class="kc-sammel-minus" data-sammel-minus="${k}" aria-label="Einen weniger">−</button>` : ''}</div>`;
      };
      const karten = artikel.map((p) => {
        const opt = p.optionGroup && kOPT()[p.optionGroup];
        if (opt) return `<div class="kc-sammel-gruppe-var"><div class="kc-sammel-var-titel">${p.name}</div>${opt.choices.map((o) => karte(p, o)).join('')}</div>`;
        return karte(p, null);
      }).join('') || '<p class="kc-sammel-leer">Keine Artikel</p>';
      const eingeklappt = !!sammelEingeklappt[g];
      // 10.09.2026: Kopf ist jetzt anklickbar (Ein-/Ausklappen der Gruppe), niedriger (Zeile statt
      // gestapelt), mit kleinem Pfeil als Zustandsanzeige.
      return `<div class="kc-sammel-spalte${eingeklappt ? ' eingeklappt' : ''}" style="${st}" data-sammel-gruppe="${g.replace(/"/g, '&quot;')}"><button type="button" class="kc-sammel-spalte-kopf" data-sammel-kopf="${g.replace(/"/g, '&quot;')}"><span class="kc-sammel-sym">${sym}</span><b>${g}</b>${anz ? `<i class="kc-sammel-zahl">${anz}</i>` : ''}<span class="kc-sammel-pfeil" aria-hidden="true">${eingeklappt ? '▸' : '▾'}</span></button><div class="kc-sammel-spalte-karten">${eingeklappt ? '' : karten}</div></div>`;
    }).join('');
    const gesamtAnz = Object.values(sammelWahl).reduce((n, v) => n + v, 0);
    $('.kc-sammel-stand', sammelEbene).textContent = gesamtAnz ? `${gesamtAnz} Artikel markiert` : 'Artikel antippen - jeder Tipp zaehlt einen dazu';
    // 10.09.2026 (Betreiber: "im Button 'Alles uebernehmen' die Anzahl X uebernehmen eintragen"):
    const uebernehmenBtn = $('.kc-sammel-uebernehmen', sammelEbene);
    if (uebernehmenBtn) uebernehmenBtn.textContent = gesamtAnz ? `✓ ${gesamtAnz} ÜBERNEHMEN` : '✓ ÜBERNEHMEN';
    ['.kc-sammel-uebernehmen', '.kc-sammel-bar', '.kc-sammel-rueckgeld'].forEach((sel) => { const b = $(sel, sammelEbene); if (b) b.disabled = !gesamtAnz; });
    // 10.09.2026: Bild/Farbe/Text sitzen jetzt im MEHR-Einblendfeld, nicht mehr in einer eigenen Zeile.
    $$('#kcSammelMehrPopup > button', sammelEbene).forEach((b) => b.classList.toggle('aktiv', b.dataset.sammelAnsicht === sammelAnsicht));
  }
  function sammelUebernehmen() {
    let n = 0;
    Object.entries(sammelWahl).forEach(([k, anz]) => {
      const [pid, oid] = k.split('|');
      const p = (() => { try { return productsForSale().find((x) => x.id === pid); } catch (e) { return null; } })() || kPROD().find((x) => x.id === pid);
      if (!p) return;
      const opt = oid && p.optionGroup && kOPT()[p.optionGroup] ? (kOPT()[p.optionGroup].choices.find((o) => o.id === oid) || null) : null;
      for (let i = 0; i < anz; i++) { try { addConfiguredProduct(p, opt); n++; } catch (e) { /* Artikel nicht mehr verkaufbar */ } }
    });
    sammelWahl = {};
    try { renderCart(); } catch (e) { /* egal */ }
    try { setSystemHint(`${n} Artikel aus der Sammelbestellung übernommen`); } catch (e) { /* egal */ }
    return n;
  }

  /* -------------------------------------------------------- Wahl im Mehr-Fenster */
  function wahlEinbauen() {
    const P = global.KCOberflaechen;
    const grid = $('#moreDialog .more-grid');
    if (!P || !grid || $('#kcAufbauWahl')) return;
    const box = document.createElement('label');
    box.className = 'kc-aufbau-wahl';
    box.innerHTML = '<span>Oberfläche <small class="kc-aufbau-stand">' + (typeof KC_AUFBAU_STAND !== 'undefined' ? KC_AUFBAU_STAND : '') + ' · Modul ' + VERSION + '</small></span><select id="kcAufbauWahl"></select>';
    grid.parentNode.insertBefore(box, grid);
    const sel = $('#kcAufbauWahl', box);
    const fuellen = () => {
      const g = P.gewaehlteId();
      sel.innerHTML = '<option value="">Standard (wie bisher)</option>' +
        P.liste().map((o) => `<option value="${o.id}"${o.id === g ? ' selected' : ''}>${o.kcNummer ? o.kcNummer + ' · ' : ''}${o.name} · ${o.geraet}</option>`).join('');
    };
    fuellen();
    sel.addEventListener('change', () => { sel.value ? anwenden(sel.value) : zuruecksetzen(); });
    sel.addEventListener('focus', fuellen);
  }

  /* 08.09.2026 (Betreiber): "Die Ansichten, die wir durchspielen, sollen als mögliche Ansicht
     gespeichert sein, damit man an der Kasse wechseln kann." Die Vorlagen des Designers liegen
     deshalb als kc-oberflaechen-vorlagen.json bei (bei jedem Bau aus dem Designer erzeugt) und
     werden beim Start in die Sammlung der Kasse einsortiert - eigene Übergaben bleiben erhalten,
     gleiche IDs werden durch die neuere Vorlage ersetzt. */
  function eingebauteVorlagenLaden() {
    const P = global.KCOberflaechen;
    if (!P || !global.fetch) return Promise.resolve(false);
    return fetch('kc-oberflaechen-vorlagen.json?build=' + Date.now()).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j || !j.oberflaechen) return false;
      const e = P.uebernehmen(j, false);
      return !!(e && e.ok);
    }).catch(() => false);
  }

  /* Hinweisleiste am Start, solange noch keine Oberfläche gewählt ist - damit niemand den
     neuen Stand für "nicht angekommen" hält (08.09.). Ein Tipp öffnet das Mehr-Fenster. */
  function hinweisNeueOberflaeche() {
    const P = global.KCOberflaechen;
    if (!P || P.gewaehlte() || $('#kcAufbauHinweis')) return;
    const h = document.createElement('button'); h.type = 'button'; h.id = 'kcAufbauHinweis'; h.className = 'kc-aufbau-hinweis';
    h.innerHTML = '<b>Neue Oberfläche verfügbar (' + (typeof KC_AUFBAU_STAND !== 'undefined' ? KC_AUFBAU_STAND : 'Aufbau') + ')</b> – hier tippen, dann unter „Oberfläche“ wählen. Ohne Wahl bleibt die Standardansicht.';
    h.addEventListener('click', () => { h.remove(); mehrOeffnen(); const s = $('#kcAufbauWahl'); if (s) s.focus(); });
    document.body.appendChild(h);
    setTimeout(() => { if (h.isConnected) h.remove(); }, 45000);
  }
  /* Sichtbare Höhe messen (iPad-Safari ohne Vollbild): visualViewport ist die Fläche ohne
     Browserleisten. Bei jeder Änderung neu setzen - Leisten blenden sich beim Wischen ein/aus. */
  function hoeheSetzen() {
    const h = (global.visualViewport && global.visualViewport.height) || global.innerHeight;
    if (h) document.documentElement.style.setProperty('--kc-vh', Math.round(h) + 'px');
  }
  hoeheSetzen();
  global.addEventListener('resize', hoeheSetzen);
  if (global.visualViewport) { global.visualViewport.addEventListener('resize', hoeheSetzen); global.visualViewport.addEventListener('scroll', hoeheSetzen); }
  global.addEventListener('orientationchange', () => setTimeout(hoeheSetzen, 300));

  /* 08.09. (Betreiber): "Schließen in den Fenstern nach oben neben die Überschrift, nicht als
     Zeile unten" - jedes Fenster ohne Kreuz oben bekommt eins. Wirkt wie der Schließen-Knopf. */
  function kreuzOben(dlg) {
    if (!dlg || dlg.querySelector('.dialog-close-x, .kc-dialog-x')) return;
    const x = document.createElement('button'); x.type = 'button'; x.className = 'kc-dialog-x'; x.setAttribute('aria-label', 'Schließen'); x.textContent = '×';
    x.addEventListener('click', () => { const u = [...dlg.querySelectorAll('button')].find((b) => /^(schlie(ß|ss)en|abbrechen|zurück|fertig)$/i.test(b.textContent.trim())); if (u) u.click(); else dlg.close(); });
    (dlg.querySelector('form') || dlg).prepend(x);
  }
  function kreuzeEinbauen() { $$('dialog').forEach(kreuzOben); }

  function start() {
    const P = global.KCOberflaechen;
    notfallKnopfEinbauen();
    kreuzeEinbauen();
    eingebauteVorlagenLaden().then(() => {
      wahlEinbauen();
      if (P && P.gewaehlte()) { anwenden(); return; }
      // Eine bewusst gewaehlte Standardansicht bleibt auch nach Neustart Standard.
      // Nur ein wirklich frisches Geraet ohne Auswahl UND ohne Standard-Marker nutzt Auto-KC003/004.
      let standardManuell = false;
      try { standardManuell = localStorage.getItem('kc.kassenoberflaeche.standard.v1') === '1'; } catch (e) { /* egal */ }
      if (standardManuell) { zuruecksetzen(); return; }
      // Montag-Freigabe: auf iPads ohne gespeicherte Auswahl den bewaehrten
      // Koecheclub-Aufbau passend zur Breite starten. "Standard" und KC001-KC019
      // bleiben ueber die Oberflaechenauswahl jederzeit manuell erreichbar.
      const passt = (id) => P && P.liste().some((o) => o.id === id);
      const breit = global.innerWidth || document.documentElement.clientWidth || 1024;
      const vorschlagId = breit >= 1200 ? 'vorlage-vl-koecheclub-gross' : 'vorlage-vl-koecheclub-9';
      if (P && passt(vorschlagId)) anwenden(vorschlagId);
      else setTimeout(hinweisNeueOberflaeche, 4000);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  /* ------------------------------------------------------------- Bon-Anzeige im Aufbau
     08.09.2026 (Betreiber): "Im Warenkorb statt Glaspfand nur Pfand, statt Feuerzangenpfand nur
     Zangenpfand - NICHT im PC-Manager, im Bondruck darf es normal bleiben." Deshalb hier reine
     Anzeigeregel über den gerenderten Bon; Stammdaten und Beleg bleiben unangetastet.
     Dazu die Positionszeile unten: "Pos.: 3 | Ges.: 7 | Pfand 3 | % 1". */
  const PFAND_KURZ = { 'Glaspfand': 'Pfand', 'Feuerzangenpfand': 'Zangenpfand', 'Becherpfand': 'Pfand', 'Flaschenpfand': 'Pfand', 'Tassenpfand': 'Pfand' };
  function pfandKurz(text) {
    return String(text).replace(/[A-Za-zÄÖÜäöüß]+pfand/g, (w) => PFAND_KURZ[w] || w);
  }
  let pflegeLaeuft = false;
  function bonAnzeigePflegen() {
    if (!aktiv || pflegeLaeuft) return;
    pflegeLaeuft = true;
    try { bonAnzeigePflegenInnen(); } finally { pflegeLaeuft = false; }
  }
  function bonAnzeigePflegenInnen() {
    $$('#cartList .cart-deposit').forEach((el) => {
      el.childNodes.forEach((n) => { if (n.nodeType === 3 && /pfand/i.test(n.nodeValue)) { const k = pfandKurz(n.nodeValue); if (k !== n.nodeValue) n.nodeValue = k; } });
    });
    const meta = $('.cart-summary .summary-meta');
    if (!meta) return;
    let zeile = $('#kcPosZeile', meta);
    if (!zeile) { zeile = document.createElement('span'); zeile.id = 'kcPosZeile'; zeile.className = 'kc-pos-zeile'; meta.insertBefore(zeile, meta.firstChild); }
    /* `state` ist in app.js ein let auf oberster Ebene - kein window.state, aber aus einem
       weiteren klassischen Skript über den Namen erreichbar. */
    let cart = [];
    try { cart = (typeof state !== 'undefined' && state && state.cart) || []; } catch (e) { cart = []; }
    const pos = cart.length, ges = cart.reduce((n, x) => n + (Number(x.qty) || 0), 0);
    /* 08.09. (Betreiber): "Pfand" = Stückzahl der Pfandartikel, nicht Positionen */
    const pfand = cart.filter((x) => (x.deposits || []).length).reduce((n, x) => n + (Number(x.qty) || 0), 0);
    let gesamt = 0; try { gesamt = total(); } catch (e) { gesamt = 0; }
    document.body.classList.toggle('kc-bon-leer', cart.length === 0);
    parkKnopfPflegen();
    /* 08.09. (Betreiber): im Trainingsmodus steht in der GESAMT-Zeile "🎓 TRAININGSMODUS 🎓" statt
       GESAMT; Wort wird erst kleiner, wenn der Betrag daneben keinen Platz mehr hat. */
    let training = false; try { training = !!(state.master && state.master.trainingMode); } catch (e) { training = false; }
    document.body.classList.toggle('kc-training', training);
    const lab = $('.kc-bereich.bon .grand-total-label');
    if (lab) {
      const t = training ? '🎓 TRAININGSMODUS 🎓' : 'GESAMT';
      if (lab.dataset.kcText !== t) lab.dataset.kcText = t;
      lab.classList.remove('kc-klein');
      const gt = lab.closest('.grand-total'); const wert = gt && gt.querySelector('strong');
      if (gt && wert && lab.scrollWidth + wert.getBoundingClientRect().width + 24 > gt.clientWidth) lab.classList.add('kc-klein');
      /* Auszahlungs-Klasse erst unten gesetzt - Pfeilfeld also NACH der Klasse pflegen (s.u.). */
      lab.dataset.kcGtRef = '';
    }
    document.body.classList.toggle('kc-bon-auszahlung', cart.length > 0 && gesamt < 0);
    pfeilfeldPflegen($('.kc-bereich.bon .grand-total'));
    /* BAR-Taste zeigt den Betrag: "BAR 9,00 €" bzw. "AUSZAHLUNG 2,00 €" */
    const pl = $('#payBtn .pay-label');
    if (pl) { const geldT = (v) => { try { return money(Math.abs(v)); } catch (e) { return Math.abs(v).toFixed(2) + ' €'; } }; const t = cart.length ? (gesamt < 0 ? 'AUSZAHLUNG ' + geldT(gesamt) : 'BAR ' + geldT(gesamt)) : 'BAR'; if (pl.dataset.kcBetrag !== t) { pl.dataset.kcBetrag = t; } }
    const rabatt = cart.filter((x) => x.positionDiscount && x.positionDiscount.percent).length;
    /* Trinkgeld heute sichtbar machen - am Tablet war der Hinweis nach dem Buchen zu unauffällig
       ("Trinkgeld klappt nicht", 08.09.): es war gebucht, nur nirgends zu sehen. */
    let tg = 0; try { const heute = localBusinessDate(); tg = tipRecords().filter((t) => String(t.businessDate || t.date || t.time || '').slice(0, 10) === heute).reduce((n, t) => n + (Number(t.amount) || 0), 0); } catch (e) { tg = 0; }
    const html = `<b>Pos.:</b> ${pos} <i>|</i> <b>Ges.:</b> ${ges} <i>|</i> <b>Pfand</b> ${pfand} <i>|</i> <b>%</b> ${rabatt}${tg ? ` <i>|</i> <b>Trinkgeld heute</b> ${(() => { try { return money(tg); } catch (e) { return tg + ' €'; } })()}` : ''}`;
    /* Vergleich über eine Merkkopie, NICHT über innerHTML: der Browser serialisiert das
       geschützte Leerzeichen aus money() als &nbsp; - dann wäre es "immer anders" und der
       eigene Beobachter liefe endlos (08.09., Kasse hing nach STIMMT SO mit Trinkgeld). */
    if (zeile.dataset.kcHtml !== html) { zeile.dataset.kcHtml = html; zeile.innerHTML = html; }
    belegPflegen();
  }

  /* ------------------------------------------------------------- Beleg wie im Ausdruck
     24 Zeichen breit wie der Bondrucker; Pfand hier in voller Länge (Betreiber: im Druck darf es
     normal bleiben). Gerechnet wird mit denselben Funktionen wie an der Kasse. */
  const BREITE = 24;
  const zeile = (l, r) => { l = String(l); r = String(r); const platz = BREITE - r.length; return (l.length > platz ? l.slice(0, Math.max(0, platz - 1)) + '…' : l).padEnd(platz) + r; };
  const mitte = (t) => { t = String(t).slice(0, BREITE); const p = Math.floor((BREITE - t.length) / 2); return ' '.repeat(Math.max(0, p)) + t; };
  function belegText() {
    let st; try { st = state; } catch (e) { return ''; }
    if (!st) return '';
    const m = st.master || {}, rc = m.receipt || {}, geld = (v) => { try { return money(v); } catch (e) { return String(v); } };
    const z = [];
    (rc.head || m.clubName || 'Köcheclub').split('\n').filter(Boolean).forEach((t) => z.push(mitte(t)));
    z.push('-'.repeat(BREITE));
    (st.cart || []).forEach((x) => {
      const einzel = (Number(x.price) || 0) + (x.option && Number(x.option.price) || 0);
      const faktor = Number(x.portionFactor || 1);
      z.push(zeile(`${x.qty}x ${x.name}${faktor === 0.5 ? ' ½' : ''}`, geld(einzel * faktor * x.qty)));
      if (x.option && x.option.name) z.push(zeile('   ' + x.option.name, ''));
      (x.deposits || []).forEach((d) => z.push(zeile('   ' + d.name, geld((Number(d.price) || 0) * x.qty))));
      if (x.positionDiscount && x.positionDiscount.percent) { let r = 0; try { r = positionDiscountAmount(x); } catch (e) { /* egal */ } z.push(zeile(`   Rabatt ${x.positionDiscount.percent} %`, '-' + geld(r))); }
    });
    z.push('-'.repeat(BREITE));
    let summe = 0, rabatt = 0, gegeben = Number(st.given) || 0;
    try { summe = total(); rabatt = globalDiscountAmount(); } catch (e) { /* egal */ }
    if (rabatt > 0) z.push(zeile('Rabatt', '-' + geld(rabatt)));
    z.push(zeile('SUMME', geld(summe)));
    if (gegeben > 0) { z.push(zeile('Gegeben', geld(gegeben))); z.push(zeile(summe < 0 ? 'Auszahlung' : 'Rückgeld', geld(summe < 0 ? -summe : Math.max(0, gegeben - summe)))); }
    z.push('-'.repeat(BREITE));
    if (m.trainingMode) z.push(mitte('** TRAININGSMODUS **'));
    (rc.foot || 'Vielen Dank - bis bald!').split('\n').filter(Boolean).forEach((t) => z.push(mitte(t)));
    return z.join('\n');
  }
  function belegPflegen() {
    const b = $('#kcBeleg .kc-beleg-text'); if (!b) return;
    const t = belegText(); if (b.textContent !== t) b.textContent = t;
    rueckgeldPfeilePflegen();
    const card = $('.kc-bereich.berechnung .change-card');
    if (card) {
      let pz = $('#kcPosZeileZahlen', card);
      if (!pz) { pz = document.createElement('div'); pz.id = 'kcPosZeileZahlen'; pz.className = 'kc-pos-zeile-zahlen'; card.insertBefore(pz, card.firstChild); }
      const q = $('#kcPosZeile'); const html = q ? (q.dataset.kcHtml || q.innerHTML) : '';
      if (pz.dataset.kcHtml !== html) { pz.dataset.kcHtml = html; pz.innerHTML = html; }
    }
  }

  /* Laufpfeile zwischen Wort und Betrag der GESAMT-Zeile (09.09.2026). Eigenes Feld im
     Flex-Layout - keine feste Pixelposition, also nie mehr über dem Text. Bei wenig Platz
     werden es automatisch weniger Pfeile statt sie zu quetschen oder zu überlappen. */
  function pfeilfeldPflegen(gt) {
    if (!gt) return;
    let feld = gt.querySelector('.kc-pfeilfeld');
    if (!feld) { feld = document.createElement('span'); feld.className = 'kc-pfeilfeld'; feld.setAttribute('aria-hidden', 'true');
      const lab = gt.querySelector('.grand-total-label'); if (lab && lab.nextSibling) gt.insertBefore(feld, lab.nextSibling); else gt.appendChild(feld); }
    const lab = gt.querySelector('.grand-total-label'); const wert = gt.querySelector('strong');
    if (!lab || !wert) return;
    const frei = gt.clientWidth - lab.getBoundingClientRect().width - wert.getBoundingClientRect().width - 24;
    const anzahl = frei >= 130 ? 4 : frei >= 100 ? 3 : frei >= 70 ? 2 : frei >= 40 ? 1 : 0;
    const pfeil = document.body.classList.contains('kc-bon-auszahlung') ? '▶' : '◀';
    const schluessel = anzahl + pfeil;   /* Zahl UND Richtung - sonst bleibt bei reinem Richtungswechsel der alte Pfeil stehen */
    if (feld.dataset.kcStand === schluessel) return;
    feld.dataset.kcStand = schluessel; feld.dataset.kcAnzahl = anzahl;
    feld.innerHTML = Array.from({ length: anzahl }, () => `<span>${pfeil}</span>`).join('');
  }

  /* 09.09.2026 (Betreiber): Laufpfeile auch auf der Zahlen-Seite - neben RÜCKGELD/AUSZAHLUNG,
     nach demselben Muster wie beim GESAMT der Bon-Zeile. app.js setzt beim Neuberechnen schon
     die Klassen payment-insufficient/payment-sufficient/payment-payout auf .change-card - hier
     nur ausgelesen, keine App-Logik verändert. Noch Geld noetig (insufficient) -> Pfeile nach
     links (Geld kommt zur Kasse); Rückgeld faellig ODER Auszahlung -> Pfeile nach rechts (Geld
     geht zum Kunden). Kein Betrag erfasst: keine Pfeile.
  */
  function rueckgeldPfeilePflegen() {
    const card = $('.kc-bereich.berechnung .change-card'); if (!card) return;
    const kopf = $('.change-card-head', card); if (!kopf) return;
    let feld = $('.kc-pfeilfeld', kopf);
    if (!feld) { feld = document.createElement('span'); feld.className = 'kc-pfeilfeld kc-pfeilfeld-klein'; feld.setAttribute('aria-hidden', 'true'); kopf.appendChild(feld); }
    const insufficient = card.classList.contains('payment-insufficient');
    const auszahlend = card.classList.contains('payment-sufficient') || card.classList.contains('payment-payout');
    const richtung = insufficient ? '◀' : auszahlend ? '▶' : null;
    const schluessel = richtung || 'aus';
    if (feld.dataset.kcStand === schluessel) return;
    feld.dataset.kcStand = schluessel;
    feld.innerHTML = richtung ? Array.from({ length: 2 }, () => `<span>${richtung}</span>`).join('') : '';
    feld.classList.toggle('kc-pfeilfeld-rot', richtung === '▶');
  }

  /* Wenn app.js die Artikel neu zeichnet (Warengruppe gewechselt, Suche), stimmt der Pfeil nicht mehr. */
  const beobachter = new MutationObserver(() => scrollpfeilPruefen());
  const bonBeobachter = new MutationObserver(() => { if (!pflegeLaeuft) bonAnzeigePflegen(); });
  function beobachten() {
    const g = $('#productGrid'); if (g) beobachter.observe(g, { childList: true });
    const c = $('#cartList'); if (c) bonBeobachter.observe(c, { childList: true, subtree: true, characterData: true });
    const m = $('.cart-summary'); if (m) bonBeobachter.observe(m, { childList: true, subtree: true, characterData: true });
    const ob = $('#operatorBtn'); if (ob) new MutationObserver(() => teamTextPflegen()).observe(ob, { childList: true, subtree: true, characterData: true });
    /* Trainingsmodus an/aus: Klassen am Body wechseln -> GESAMT-Zeile nachziehen */
    new MutationObserver(() => { if (!pflegeLaeuft) bonAnzeigePflegen(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const g2 = $('#givenDisplay'); if (g2) new MutationObserver(() => { if (!pflegeLaeuft) belegPflegen(); }).observe(g2, { childList: true, characterData: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', beobachten); else beobachten();

  /* Spiegel-Klasse kommt vom Ansicht-Umschalter (kc-ansicht-umschalter.js) - bei Wechsel neu verteilen */
  let spiegelWar = document.body.classList.contains('kc-spiegel-modus');
  new MutationObserver(() => {
    const jetzt = document.body.classList.contains('kc-spiegel-modus');
    if (jetzt === spiegelWar || !aktiv) { spiegelWar = jetzt; return; }
    spiegelWar = jetzt;
    if (document.body.classList.contains('kc-zahlenseite-offen')) verteile(seiteFinden(aktiv, 'zahlen'), $('.kc-aufbau-raster', zahlenEbene), aktiv);
    else { verteile(seiteFinden(aktiv, 'kasse') || { bausteine: [] }, hauptRaster, aktiv); nachbauen(); }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  global.KCAufbau = { version: VERSION, funktionenSeite, sammelSeite, sammelUebernehmen, sammelWahl: () => sammelWahl, anwenden, zuruecksetzen, zahlenSeite, aktive: () => aktiv, ZUORDNUNG: Z, parken, holen, geparkte, parkSeite, pinSeite, VERSTECKT, kassenPinZuruecksetzen };
})(window);
