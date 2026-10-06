// Getrennte Fenster fuer Entnahme und Reklamation.
//
// GRUNDGEDANKE: Die Buchungslogik bleibt VOLLSTAENDIG unangetastet. Beides schreibt weiter in
// dieselbe Liste, damit Kassenabschluss, Datenexport und die Auswertung im PC-Manager
// ("Entnahmen / Reklamationen") ohne Aenderung weiterlaufen. Getrennt wird nur die BEDIENUNG:
// je nach Zweck werden am vorhandenen Fenster die Teile ausgeblendet, die nicht dazugehoeren.
// Das ist sicherer, als eine zweite Buchungsstrecke danebenzustellen - dort koennten sich
// Abweichungen einschleichen, die erst beim Kassensturz auffallen.
//
// Vorher sah der Bediener beim Reklamieren zuerst "Bargeldentnahme", ein Betragsfeld und sechs
// Entnahmegruende - und erst danach das, was er eigentlich braucht.
//
// TIPPEN VERMEIDEN: Der Betrag bei der Entnahme war das einzige Feld, das zwingend ueber die
// Tastatur ausgefuellt werden musste. Dafuer gibt es einen Ziffernblock und Schnellbetraege.
// Alle Gruende sind ohnehin Knoepfe.
// 30.09.2026 (Betreiber: "zu unuebersichtlich mit den vielen Zahlen"): Der Ziffernblock ist nicht
// mehr dauernd offen, sondern klappt klein auf, wenn man ins Betragsfeld tippt (OK / daneben tippen
// schliesst ihn). Schnellbetraege in einer Reihe von klein nach gross, ab 0,50 EUR (WC-Geld).
(function (global) {
  'use strict';

  const el = id => document.getElementById(id);

  function modusSetzen(modus) {
    const dlg = el('withdrawDialog');
    if (!dlg) return;
    dlg.classList.toggle('kc-modus-entnahme', modus === 'entnahme');
    dlg.classList.toggle('kc-modus-reklamation', modus === 'reklamation');
    const titel = dlg.querySelector('h2');
    if (titel) titel.textContent = modus === 'reklamation' ? 'Reklamation' : 'Bargeldentnahme';
    const hinweis = dlg.querySelector('.withdraw-card > p');
    if (hinweis) {
      hinweis.textContent = modus === 'reklamation'
        ? 'Zur\u00fcckgegebene Artikel und Grund ausw\u00e4hlen. Jede Reklamation wird protokolliert.'
        : 'Jede Entnahme wird mit Zeit, Bediener und Kasse protokolliert.';
    }
    if (modus === 'entnahme') {
      zifferblockAnpassen();
      // Frisch geoeffnet (app.js leert das Betragsfeld): auch Muenzen/Scheine zuruecksetzen.
      if (!(Number(el('withdrawAmount')?.value) > 0)) geldZuruecksetzen(); else geldAnzeigen();
    }
    grundNachOben(modus === 'entnahme');
    const betrag = el('withdrawAmount');
    if (betrag) betrag.setAttribute('inputmode', modus === 'entnahme' ? 'none' : 'decimal');
    if (modus !== 'entnahme' && el('kcZiffernFeld')) el('kcZiffernFeld').hidden = true;
    offenerBonHinweis(modus);
    if (modus !== 'entnahme' && el('saveWithdrawal') && el('saveWithdrawal').textContent !== 'WIRD GESPEICHERT \u2026') el('saveWithdrawal').disabled = false;
    speichernPruefen();
  }

  // Liegt beim Reklamieren ein offener Bon auf der Kasse, wird die Reklamation mit diesem Bon
  // VERRECHNET statt als Auszahlung gebucht (Umtausch statt Geld raus). Das war bisher im Code
  // versteckt - hier wird es dem Bediener vorher gesagt, damit die Buchung nicht ueberrascht.
  function offenerBonHinweis(modus) {
    const dlg = el('withdrawDialog');
    let hinweis = el('kcVerrechnungHinweis');
    const offenerBon = modus === 'reklamation' && typeof global.lineUnit === 'function'
      && Array.isArray(global.state?.cart) && global.state.cart.some(i => global.lineUnit(i) > 0);
    if (!offenerBon) { if (hinweis) hinweis.remove(); return; }
    if (!hinweis) {
      hinweis = document.createElement('p');
      hinweis.id = 'kcVerrechnungHinweis';
      hinweis.className = 'kc-verrechnung-hinweis';
      const panel = el('complaintPanel');
      panel?.parentElement?.insertBefore(hinweis, panel);
    }
    hinweis.textContent = '\u2139 Es liegt ein offener Bon vor \u2013 die R\u00fcckgabe wird mit diesem Bon verrechnet, es wird kein Bargeld ausgezahlt.';
  }

  // ---- Betrag: Muenzen und Scheine wie im Money Butler ----------------------------------
  // 02.10.2026 (Betreiber: "wie Money Butler die Muenzen und Scheine anzeigen ordentlich aufgereiht,
  // Gruende als farbige Buttons, Button ausgegraut bis Sachen gewaehlt wurden, Bon/Quittung groesser"):
  // Die echten Bilder aus assets/ (dieselben wie im Money Butler). Jedes Antippen zaehlt dazu,
  // ein Zaehler zeigt, wie oft. Krumme Betraege weiter ueber das kleine Ziffernfeld ("Anderer Betrag").
  // Gebucht wird unveraendert ueber das Betragsfeld #withdrawAmount und app.js.
  const GELD = [
    {wert: 0.5, bild: 'assets/muenze_0.5.webp', art: 'muenze', name: '50 Cent'},
    {wert: 1, bild: 'assets/muenze_1.webp', art: 'muenze', name: '1 Euro'},
    {wert: 2, bild: 'assets/muenze_2.webp', art: 'muenze', name: '2 Euro'},
    {wert: 5, bild: 'assets/schein_5.jpg', art: 'schein', name: '5 Euro'},
    {wert: 10, bild: 'assets/schein_10.jpg', art: 'schein', name: '10 Euro'},
    {wert: 20, bild: 'assets/schein_20.jpg', art: 'schein', name: '20 Euro'},
    {wert: 50, bild: 'assets/schein_50.jpg', art: 'schein', name: '50 Euro'},
    {wert: 100, bild: 'assets/schein_100.jpg', art: 'schein', name: '100 Euro'}
  ];
  const HOECHSTBETRAG = 9999.99;
  const euro = b => (Math.round(b * 100) / 100).toFixed(2).replace('.', ',') + ' €';
  const kurz = b => (b % 1 ? b.toFixed(2).replace('.', ',') : String(b)) + ' €';
  let stapel = [];   // angetippte Muenzen/Scheine in Reihenfolge
  let basis = 0;     // ueber das Ziffernfeld eingegebener Betrag
  let geldAnzeigen = () => {};
  let geldZuruecksetzen = () => {};

  // 02.10.2026 (iPad-Befund des Betreibers: Muenzen standen untereinander): Das Geraet hatte schon dieses
  // Programm, aber noch die ALTE Stildatei aus dem Offline-Speicher - dort sind alle Knoepfe im Betragsbereich
  // 100 % breit. Deshalb bringt diese Datei ihre Gestaltung selbst mit: Programm und Aussehen kommen immer
  // aus derselben Datei und koennen nicht mehr auseinanderlaufen.
  const GELD_STIL = `/* ===== 02.10.2026 Entnahme wie Money Butler (Betreiber): echte Muenzen/Scheine, farbige Gruende,
   Speichern grau bis Betrag + Grund gewaehlt, Bon/Quittung als grosser Knopf. Nur Bedienung -
   Buchung, Protokoll und Beleg unveraendert (app.js). Gilt nur im Entnahme-Modus. ===== */
#withdrawDialog:not(.kc-modus-entnahme) #kcBetragBlock .kc-geld-bereich { display: none !important; }
#withdrawDialog.kc-modus-entnahme .kc-betrag-label, #withdrawDialog.kc-modus-entnahme #withdrawAmount { position: absolute !important; width: 1px !important; height: 1px !important; overflow: hidden !important; clip: rect(0 0 0 0) !important; opacity: 0 !important; pointer-events: none !important; }
#withdrawDialog.kc-modus-entnahme .withdraw-amount-field > legend { display: none !important; }
#withdrawDialog.kc-modus-entnahme .withdraw-amount-field { border: 0 !important; padding: 0 !important; margin: 0 !important; }
#withdrawDialog #kcBetragBlock .kc-geld-bereich { display: grid; gap: 8px; margin: 6px 0 10px; }
#withdrawDialog #kcBetragBlock .kc-geld-kopf { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; gap: 8px; align-items: stretch; }
#withdrawDialog #kcBetragBlock button.kc-geld-summe { height: 60px !important; display: flex !important; align-items: center; justify-content: space-between; gap: 12px; padding: 0 16px !important; border: 3px solid #1f2937 !important; border-radius: 12px !important; background: #fff !important; color: #111827 !important; text-align: left; cursor: pointer; }
#withdrawDialog #kcBetragBlock .kc-geld-summe b { font-size: 30px; font-weight: 900; white-space: nowrap; }
#withdrawDialog #kcBetragBlock .kc-geld-summe small { font-size: 13px; font-weight: 700; color: #4b5563; text-align: right; line-height: 1.2; }
#withdrawDialog #kcBetragBlock .kc-geld-summe.kc-geld-leer b { color: #9ca3af; }
#withdrawDialog #kcBetragBlock button.kc-geld-knopf { width: auto !important; height: 60px !important; padding: 0 14px !important; border: 2px solid #cbd5e1 !important; border-radius: 12px !important; background: #f8fafc !important; color: #334155 !important; font-size: 15px !important; font-weight: 800 !important; white-space: nowrap; }
#withdrawDialog #kcBetragBlock button.kc-geld-knopf:disabled { opacity: .45; }
#withdrawDialog #kcBetragBlock .kc-geld-schale { display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: #f4f1ea; border: 1px solid #e5dccb; border-radius: 14px; }
#withdrawDialog #kcBetragBlock button.kc-geld { position: relative; flex: 0 0 auto; width: auto !important; height: auto !important; padding: 0 !important; border: 0 !important; background: transparent !important; box-shadow: none !important; line-height: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
#withdrawDialog #kcBetragBlock button.kc-geld img { display: block; pointer-events: none; user-select: none; -webkit-user-select: none; }
#withdrawDialog #kcBetragBlock .kc-geld-muenze img { border-radius: 50%; filter: drop-shadow(0 3px 3px rgba(0,0,0,.3)); }
#withdrawDialog #kcBetragBlock [data-geld="0.5"] img { width: 62px; height: 62px; }
#withdrawDialog #kcBetragBlock [data-geld="1"] img { width: 68px; height: 68px; }
#withdrawDialog #kcBetragBlock [data-geld="2"] img { width: 74px; height: 74px; }
#withdrawDialog #kcBetragBlock [data-geld="2"] { margin-right: 10px; }
#withdrawDialog #kcBetragBlock [data-geld="5"] { margin-left: 4px; }
#withdrawDialog #kcBetragBlock button.kc-geld-schein { flex: 1 1 0 !important; min-width: 0 !important; max-width: 132px; }
#withdrawDialog #kcBetragBlock .kc-geld-schein img { max-width: 100%; }
#withdrawDialog #kcBetragBlock .kc-geld-schein img { width: 100%; height: auto; aspect-ratio: 480 / 246; object-fit: cover; border-radius: 6px; box-shadow: 0 3px 6px rgba(0,0,0,.3); }
#withdrawDialog #kcBetragBlock button.kc-geld:active img, #withdrawDialog #kcBetragBlock button.kc-geld.kc-geld-tipp img { animation: kcGeldTipp .18s ease-out; }
@keyframes kcGeldTipp { 0% { transform: scale(1); } 50% { transform: scale(.9); } 100% { transform: scale(1); } }
#withdrawDialog #kcBetragBlock .kc-geld-zahl { position: absolute; top: -8px; right: -8px; min-width: 28px; height: 28px; padding: 0 6px; box-sizing: border-box; border-radius: 14px; background: #111827; color: #fff; border: 2px solid #fff; font: 900 14px/24px Arial, sans-serif; text-align: center; z-index: 2; }
#withdrawDialog #kcBetragBlock .kc-geld-zahl[hidden] { display: none !important; }
#withdrawDialog #kcBetragBlock .kc-geld-hinweis { margin: 0 !important; font-size: 12.5px; color: #6b7280; }
/* Gruende: grosse farbige Knoepfe, gewaehlter Grund hervorgehoben, die anderen blass */
#withdrawDialog.kc-modus-entnahme #withdrawReasonButtons { gap: 10px !important; }
#withdrawDialog.kc-modus-entnahme #withdrawReasonButtons > button { height: 66px !important; border: 0 !important; border-radius: 12px !important; color: #fff !important; font-size: 13.5px !important; font-weight: 900 !important; line-height: 1.2 !important; box-shadow: 0 2px 4px rgba(0,0,0,.18) !important; transition: opacity .15s; }
#withdrawDialog.kc-modus-entnahme [data-withdraw-reason="Einkauf Lebensmittel"] { background: #2e7d32 !important; }
#withdrawDialog.kc-modus-entnahme [data-withdraw-reason="Einkauf Reinigungsmittel"] { background: #00838f !important; }
#withdrawDialog.kc-modus-entnahme [data-withdraw-reason="Essen Personal"] { background: #ef6c00 !important; }
#withdrawDialog.kc-modus-entnahme [data-withdraw-reason="Getränke Personal"] { background: #6a1b9a !important; }
#withdrawDialog.kc-modus-entnahme [data-withdraw-reason="WC-Geld"] { background: #1565c0 !important; }
#withdrawDialog.kc-modus-entnahme [data-withdraw-reason="Sonstiges"] { background: #546e7a !important; }
#withdrawDialog.kc-modus-entnahme #withdrawReasonButtons > button.active { outline: 4px solid #111827 !important; outline-offset: 2px; }
#withdrawDialog.kc-modus-entnahme #withdrawReasonButtons > button.active::before { content: "\\2713  "; }
#withdrawDialog.kc-modus-entnahme.kc-grund-gewaehlt #withdrawReasonButtons > button:not(.active) { opacity: .42; }
#withdrawDialog.kc-modus-entnahme .withdraw-reason-field { margin-top: 6px !important; padding: 8px 8px 10px !important; }
/* Bon / Quittung als grosser Knopf */
#withdrawDialog.kc-modus-entnahme #withdrawReceiptToggle { height: 62px !important; font-size: 20px !important; font-weight: 900 !important; border: 3px solid #94a3b8 !important; border-radius: 12px !important; background: #f8fafc !important; color: #1f2937 !important; }
/* 0.2.3 (Betreiber 06.10.2026): Klickkaestchen ☐/☑ deutlich groesser */
#withdrawDialog.kc-modus-entnahme #withdrawReceiptToggle { height: 72px !important; }
#withdrawDialog.kc-modus-entnahme #withdrawReceiptToggle::first-letter { font-size: 40px; line-height: 0; color: #0f172a; }
#withdrawDialog.kc-modus-entnahme #withdrawReceiptToggle.active::first-letter { color: #15803d; }
#withdrawDialog.kc-modus-entnahme #withdrawReceiptToggle.active { background: #dcfce7 !important; border-color: #16a34a !important; color: #14532d !important; }
#withdrawDialog.kc-modus-entnahme #withdrawNote { height: 46px !important; font-size: 17px !important; border-radius: 10px !important; }
/* Speichern grau, bis Betrag und Grund gewaehlt sind */
#withdrawDialog.kc-modus-entnahme #saveWithdrawal { height: 62px !important; font-size: 20px !important; font-weight: 900 !important; border-radius: 12px !important; }
#withdrawDialog.kc-modus-entnahme #saveWithdrawal:disabled { background: #e5e7eb !important; color: #9ca3af !important; border-color: #e5e7eb !important; box-shadow: none !important; cursor: not-allowed; }
#withdrawDialog .kc-speichern-hinweis { margin: 8px 0 4px !important; padding: 8px 12px; border-radius: 10px; background: #f1f5f9; color: #475569; font-size: 14px; font-weight: 700; text-align: center; }
#withdrawDialog .kc-speichern-hinweis.kc-bereit { background: #dcfce7; color: #14532d; }
#withdrawDialog .kc-speichern-hinweis[hidden] { display: none !important; }
`;
  function stilEinbauen() {
    if (el('kcGeldStil')) return;
    const st = document.createElement('style');
    st.id = 'kcGeldStil';
    st.textContent = GELD_STIL;
    (document.head || document.documentElement).appendChild(st);
  }

  function zifferblockAnpassen() {
    stilEinbauen();
    if (el('kcBetragBlock')) return;
    const feld = el('withdrawAmount');
    if (!feld) return;
    const block = document.createElement('div');
    block.id = 'kcBetragBlock';
    block.className = 'kc-betrag-block';
    block.innerHTML = `
      <div class="kc-geld-bereich">
        <div class="kc-geld-kopf">
          <button type="button" id="kcGeldSumme" class="kc-geld-summe" aria-live="polite"><b>0,00 €</b><small>noch kein Betrag</small></button>
          <button type="button" data-geld-zurueck="1" class="kc-geld-knopf">↶ Letzte zurück</button>
          <button type="button" data-geld-anders="1" class="kc-geld-knopf">⌨ Anderer Betrag</button>
          <button type="button" data-geld-leeren="1" class="kc-geld-knopf"><span class="kc-muell">🗑</span> Leeren</button>
        </div>
        <div class="kc-geld-schale" role="group" aria-label="Münzen und Scheine antippen">
          ${GELD.map(g => `<button type="button" class="kc-geld kc-geld-${g.art}" data-geld="${g.wert}" aria-label="${g.name} dazuzählen"><img src="${g.bild}" alt="${g.name}" draggable="false"><span class="kc-geld-zahl" hidden></span></button>`).join('')}
        </div>
        <p class="kc-geld-hinweis">Jedes Antippen zählt dazu. Krumme Beträge über „⌨ Anderer Betrag“.</p>
      </div>
      <div id="kcZiffernFeld" class="kc-ziffern-feld" hidden>
        <div class="kc-betrag-tasten">
          ${[1,2,3,4,5,6,7,8,9].map(z => `<button type="button" data-ziffer="${z}">${z}</button>`).join('')}
          <button type="button" data-ziffer=",">,</button>
          <button type="button" data-ziffer="0">0</button>
          <button type="button" data-loeschen="1" class="kc-betrag-loeschen">⌫</button>
        </div>
        <button type="button" data-ziffern-ok="1" class="kc-ziffern-ok">OK</button>
      </div>`;
    feld.parentElement?.insertAdjacentElement('afterend', block);
    // Das alte Betragsfeld bleibt (app.js bucht daraus), wird im Entnahme-Modus aber nur noch versteckt gefuehrt.
    feld.closest('label')?.classList.add('kc-betrag-label');
    const summeKnopf = block.querySelector('#kcGeldSumme');

    // WICHTIG: das Betragsfeld ist ein Zahlenfeld. Zwischenstaende wie "5," sind darin
    // ungueltig und werden vom Browser STILLSCHWEIGEND verworfen - das Feld wird dann leer.
    // Deshalb wird die Ziffernfeld-Eingabe in einem eigenen Zwischenspeicher gefuehrt.
    const setze = wert => {
      // Schulung (30.09.2026 gefunden): app.js merkt sich den Betrag dort in einer eigenen
      // Variable und gibt "Entnahme speichern" erst frei, wenn sie gesetzt ist.
      if (typeof global.bargeldentnahmeBetragSetzen === 'function') {
        try { global.bargeldentnahmeBetragSetzen(Math.round((Number(wert) || 0) * 100)); } catch (e) { /* Feld bleibt massgeblich */ }
      }
      feld.value = wert;
      feld.dispatchEvent(new Event('input', {bubbles: true}));
      feld.dispatchEvent(new Event('change', {bubbles: true}));
      geldAnzeigen();
    };
    const summe = () => Math.round((basis + stapel.reduce((a, b) => a + b, 0)) * 100) / 100;
    const ausSumme = () => { const s = summe(); setze(s > 0 ? s.toFixed(2) : ''); };

    geldAnzeigen = () => {
      const s = Number(feld.value) || 0;
      const zaehl = {};
      stapel.forEach(w => { zaehl[w] = (zaehl[w] || 0) + 1; });
      block.querySelectorAll('[data-geld]').forEach(b => {
        const n = zaehl[b.dataset.geld] || 0, z = b.querySelector('.kc-geld-zahl');
        z.hidden = !n; z.textContent = n ? n + '×' : '';
        b.classList.toggle('kc-geld-gezaehlt', !!n);
      });
      const teile = GELD.slice().reverse().filter(g => zaehl[g.wert]).map(g => `${zaehl[g.wert]}× ${kurz(g.wert)}`);
      if (basis > 0) teile.push(`${euro(basis)} eingegeben`);
      summeKnopf.querySelector('b').textContent = euro(s);
      summeKnopf.querySelector('small').textContent = s > 0 ? (teile.join(' · ') || 'eingegeben') : 'noch kein Betrag – Münzen und Scheine antippen';
      summeKnopf.classList.toggle('kc-geld-leer', !(s > 0));
      block.querySelector('[data-geld-zurueck]').disabled = !stapel.length && !(basis > 0);
      block.querySelector('[data-geld-leeren]').disabled = !(s > 0);
      speichernPruefen();
    };
    geldZuruecksetzen = () => { stapel = []; basis = 0; eingabe = ''; geldAnzeigen(); };

    block.querySelectorAll('[data-geld]').forEach(b => {
      b.onclick = () => {
        const w = Number(b.dataset.geld);
        // Stand des Feldes uebernehmen, falls es von aussen gesetzt wurde (z.B. leer beim Oeffnen).
        if (!(Number(feld.value) > 0)) { stapel = []; basis = 0; }
        if (summe() + w > HOECHSTBETRAG) return;
        stapel.push(w); eingabe = '';
        schliessen();
        ausSumme();
        b.classList.remove('kc-geld-tipp'); void b.offsetWidth; b.classList.add('kc-geld-tipp');
      };
    });
    block.querySelector('[data-geld-zurueck]').onclick = () => {
      if (stapel.length) stapel.pop(); else basis = 0;
      eingabe = ''; ausSumme();
    };
    block.querySelector('[data-geld-leeren]').onclick = () => { stapel = []; basis = 0; eingabe = ''; schliessen(); setze(''); };

    // Ziffernfeld (Anderer Betrag): die erste Ziffer ersetzt den bisherigen Betrag.
    let eingabe = '', frisch = false;
    const uebernehmen = () => {
      const zahl = eingabe.replace(',', '.').replace(/\.$/, '');
      stapel = []; basis = Number(zahl) || 0;
      setze(zahl);
    };
    block.querySelectorAll('[data-ziffer]').forEach(b => {
      b.onclick = () => {
        const z = b.dataset.ziffer;
        if (frisch) { eingabe = ''; frisch = false; }
        if (z === ',') { if (eingabe.includes(',')) return; eingabe = (eingabe || '0') + ','; return uebernehmen(); }
        if (eingabe.includes(',') && eingabe.split(',')[1].length >= 2) return;  // hoechstens zwei Nachkommastellen
        if (Number((eingabe + z).replace(',', '.')) > HOECHSTBETRAG) return;
        eingabe += z;
        uebernehmen();
      };
    });
    block.querySelector('[data-loeschen]').onclick = () => {
      if (frisch) { eingabe = String(feld.value || '').replace('.', ','); frisch = false; }
      eingabe = eingabe.slice(0, -1);
      uebernehmen();
    };

    const ziffern = block.querySelector('#kcZiffernFeld');
    // Ausgerichtet an der Betragsanzeige (bei Platzmangel darueber), nie vom Fensterrand abgeschnitten.
    const ausrichten = () => {
      ziffern.style.position = 'fixed';
      ziffern.style.right = 'auto'; ziffern.style.bottom = 'auto';
      const anker = summeKnopf.getBoundingClientRect().width ? summeKnopf : feld;
      const f = anker.getBoundingClientRect(), z = ziffern.getBoundingClientRect();
      const hoehe = global.innerHeight || document.documentElement.clientHeight;
      const breite = global.innerWidth || document.documentElement.clientWidth;
      let oben = f.bottom + 6;
      if (oben + z.height > hoehe - 6) oben = Math.max(6, f.top - z.height - 6);
      ziffern.style.top = Math.round(oben) + 'px';
      ziffern.style.left = Math.round(Math.min(Math.max(6, f.left), breite - z.width - 6)) + 'px';
    };
    const oeffnen = () => {
      if (!el('withdrawDialog')?.classList.contains('kc-modus-entnahme')) return;
      frisch = true;
      ziffern.hidden = false;
      ausrichten();
    };
    const schliessen = () => { ziffern.hidden = true; frisch = false; };
    feld.addEventListener('click', oeffnen);
    summeKnopf.onclick = oeffnen;
    block.querySelector('[data-geld-anders]').onclick = oeffnen;
    block.querySelector('[data-ziffern-ok]').onclick = schliessen;
    el('withdrawDialog')?.addEventListener('click', ev => {
      if (!ziffern.hidden && ev.target !== feld && !ziffern.contains(ev.target)
          && !ev.target.closest?.('#kcGeldSumme,[data-geld-anders]')) schliessen();
    });
    el('withdrawDialog')?.addEventListener('close', schliessen);
    geldAnzeigen();
  }

  // 0.2.3 (Betreiber 06.10.2026): "Zuerst oben den Grund waehlen, dann den Betrag" - in der Kasse
  // stand der Betrag oben, in der Schulung schon der Grund. Bei der Entnahme steht der Grund jetzt
  // ueberall oben; in jedem anderen Modus die bisherige Reihenfolge (Betrag, dann Grund).
  // Steht der Grund im HTML schon vor dem Betrag (Schulung), wird nichts verschoben.
  function grundNachOben(oben) {
    const grund = document.querySelector('#withdrawDialog .withdraw-reason-field');
    const label = el('withdrawAmount')?.closest('label');
    if (!grund || !label || label.parentElement !== grund.parentElement) return;
    const block = el('kcBetragBlock');
    const betragZuerst = !!(label.compareDocumentPosition(grund) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (oben && betragZuerst) label.insertAdjacentElement('beforebegin', grund);
    else if (!oben && !betragZuerst) ((block && block.parentElement === label.parentElement) ? block : label).insertAdjacentElement('afterend', grund);
  }

  // ---- "Entnahme speichern" erst, wenn Betrag UND Grund gewaehlt sind ------------------------
  // Nur die Bedienung: app.js prueft beim Speichern weiterhin selbst. Im Reklamationsmodus bleibt
  // alles wie bisher.
  function speichernPruefen() {
    const dlg = el('withdrawDialog'), knopf = el('saveWithdrawal');
    if (!dlg || !knopf) return;
    let hinweis = el('kcSpeichernHinweis');
    const grund = dlg.querySelector('[data-withdraw-reason].active');
    dlg.classList.toggle('kc-grund-gewaehlt', !!grund && dlg.classList.contains('kc-modus-entnahme'));
    if (!dlg.classList.contains('kc-modus-entnahme')) { if (hinweis) hinweis.hidden = true; return; }
    if (!hinweis) {
      hinweis = document.createElement('p');
      hinweis.id = 'kcSpeichernHinweis';
      hinweis.className = 'kc-speichern-hinweis';
      dlg.querySelector('.dialog-actions')?.insertAdjacentElement('beforebegin', hinweis);
    }
    const betrag = Number(el('withdrawAmount')?.value) || 0;
    const fehlt = [grund ? '' : 'Grund', betrag > 0 ? '' : 'Betrag'].filter(Boolean);
    if (knopf.textContent !== 'WIRD GESPEICHERT …') knopf.disabled = fehlt.length > 0;
    hinweis.hidden = false;
    hinweis.classList.toggle('kc-bereit', !fehlt.length);
    const bon = el('withdrawReceiptToggle')?.classList.contains('active');
    hinweis.textContent = fehlt.length
      ? `Bitte zuerst ${fehlt.join(' und ')} wählen – dann lässt sich die Entnahme speichern.`
      : `✓ ${euro(betrag)} · ${grund.dataset.withdrawReason}${bon ? ' · mit Bon' : ''} – bereit zum Speichern`;
  }

  function verdrahten() {
    const reklaKnopf = el('complaintBtn');
    if (reklaKnopf && !reklaKnopf.dataset.kcGetrennt) {
      reklaKnopf.dataset.kcGetrennt = '1';
      // Nach dem vorhandenen Klick den Modus setzen: der Knopf oeffnet das Fenster und waehlt
      // den Grund "Reklamation" bereits selbst aus - das bleibt genau so.
      reklaKnopf.addEventListener('click', () => setTimeout(() => modusSetzen('reklamation'), 90), true);
    }
    document.querySelectorAll('.more-grid button[data-action="withdraw"]').forEach(b => {
      if (b.dataset.kcGetrennt) return;
      b.dataset.kcGetrennt = '1';
      b.addEventListener('click', () => setTimeout(() => modusSetzen('entnahme'), 90), true);
    });
    document.querySelectorAll('.more-grid button[data-action="reklamation"]').forEach(b => {
      if (b.dataset.kcGetrennt) return;
      b.dataset.kcGetrennt = '1';
      b.addEventListener('click', () => setTimeout(() => modusSetzen('reklamation'), 140), true);
    });
    // Wird der Grund im Entnahmefenster gewechselt, bleibt es eine Entnahme - ausser der
    // Bediener waehlt ausdruecklich Reklamation.
    document.querySelectorAll('[data-withdraw-reason]').forEach(b => {
      if (b.dataset.kcGetrennt) return;
      b.dataset.kcGetrennt = '1';
      b.addEventListener('click', () => setTimeout(() =>
        modusSetzen(b.dataset.withdrawReason === 'Reklamation' ? 'reklamation' : 'entnahme'), 60));
    });
    // Grund / Bon gewaehlt -> Speichern-Knopf und Hinweis nachziehen (nach dem Klick in app.js).
    document.querySelectorAll('[data-withdraw-reason]').forEach(b => b.addEventListener('click', () => setTimeout(speichernPruefen, 80)));
    el('withdrawReceiptToggle')?.addEventListener('click', () => setTimeout(speichernPruefen, 0));
    // 0.2.3 (Betreiber 06.10.2026: "heute wurde der gruene Knopf nicht aktiv"): nach JEDEM Tipp im
    // Entnahmefenster und bei jeder Betragsaenderung neu pruefen - egal ueber welchen Weg der Betrag
    // kam (Muenzen, Ziffernfeld, Schnelltasten). Nur Bedienung; app.js prueft beim Speichern selbst.
    const wd = el('withdrawDialog');
    if (wd && !wd.dataset.kcPruefen) {
      wd.dataset.kcPruefen = '1';
      wd.addEventListener('click', () => setTimeout(speichernPruefen, 120));
      el('withdrawAmount')?.addEventListener('input', () => setTimeout(speichernPruefen, 0));
      el('withdrawAmount')?.addEventListener('change', () => setTimeout(speichernPruefen, 0));
    }
    // Notiz: Bildschirmtastatur erlaubt; das Feld rutscht in die Mitte, damit es sichtbar bleibt.
    const notiz = el('withdrawNote');
    if (notiz && !notiz.dataset.kcTastatur) {
      notiz.dataset.kcTastatur = '1';
      notiz.setAttribute('inputmode', 'text');
      notiz.setAttribute('enterkeyhint', 'done');
      notiz.addEventListener('focus', () => setTimeout(() => notiz.scrollIntoView({block: 'center', behavior: 'smooth'}), 350));
    }
    el('withdrawDialog')?.addEventListener('close', () => {
      const dlg = el('withdrawDialog');
      dlg.classList.remove('kc-modus-entnahme', 'kc-modus-reklamation', 'kc-grund-gewaehlt');
      el('kcVerrechnungHinweis')?.remove();
      if (el('kcSpeichernHinweis')) el('kcSpeichernHinweis').hidden = true;
      if (el('saveWithdrawal') && el('saveWithdrawal').textContent !== 'WIRD GESPEICHERT \u2026') el('saveWithdrawal').disabled = false;
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verdrahten);
  else verdrahten();
  global.KCErfassungGetrennt = {modusSetzen, zifferblockAnpassen, speichernPruefen};
})(window);
