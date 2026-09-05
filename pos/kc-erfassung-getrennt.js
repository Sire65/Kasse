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
// Tastatur ausgefuellt werden musste. Dafuer gibt es jetzt einen Ziffernblock und vier
// Schnellbetraege. Alle Gruende sind ohnehin Knoepfe.
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
    if (modus === 'entnahme') zifferblockAnpassen();
    offenerBonHinweis(modus);
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

  // ---- Ziffernblock fuer den Entnahmebetrag ----------------------------------------------
  const SCHNELLBETRAEGE = [10, 20, 50, 100];

  function zifferblockAnpassen() {
    if (el('kcBetragBlock')) return;
    const feld = el('withdrawAmount');
    if (!feld) return;
    const block = document.createElement('div');
    block.id = 'kcBetragBlock';
    block.className = 'kc-betrag-block';
    block.innerHTML = `
      <div class="kc-betrag-schnell">
        ${SCHNELLBETRAEGE.map(b => `<button type="button" data-schnell="${b}">${b} \u20ac</button>`).join('')}
      </div>
      <div class="kc-betrag-tasten">
        ${[1,2,3,4,5,6,7,8,9].map(z => `<button type="button" data-ziffer="${z}">${z}</button>`).join('')}
        <button type="button" data-ziffer="0">0</button>
        <button type="button" data-ziffer=",">,</button>
        <button type="button" data-loeschen="1" class="kc-betrag-loeschen">\u232B</button>
      </div>`;
    feld.parentElement?.insertAdjacentElement('afterend', block);

    // WICHTIG: das Betragsfeld ist ein Zahlenfeld. Zwischenstaende wie "5," sind darin
    // ungueltig und werden vom Browser STILLSCHWEIGEND verworfen - das Feld wird dann leer.
    // Beim Tippen von 5 , 5 0 kam dadurch 50 heraus statt 5,50. Deshalb wird die Eingabe
    // hier in einem eigenen Zwischenspeicher gefuehrt und nur der gueltige Teil ins Feld
    // geschrieben.
    const setze = wert => {
      feld.value = wert;
      // Dieselben Ereignisse ausloesen, die auch beim Tippen entstehen - sonst bekommt die
      // vorhandene Logik die Aenderung nicht mit.
      feld.dispatchEvent(new Event('input', {bubbles: true}));
      feld.dispatchEvent(new Event('change', {bubbles: true}));
    };
    block.querySelectorAll('[data-schnell]').forEach(b => {
      b.onclick = () => setze(Number(b.dataset.schnell).toFixed(2));
    });
    // Zwischenspeicher der Eingabe, mit Komma wie auf dem Knopf.
    let eingabe = '';
    const uebernehmen = () => {
      // Nur den gueltigen Teil ins Zahlenfeld schreiben; ein abschliessendes Komma faellt weg.
      const zahl = eingabe.replace(',', '.').replace(/\.$/, '');
      setze(zahl);
    };
    block.querySelectorAll('[data-schnell]').forEach(b => {
      b.addEventListener('click', () => { eingabe = Number(b.dataset.schnell).toFixed(2).replace('.', ','); });
    });
    block.querySelectorAll('[data-ziffer]').forEach(b => {
      b.onclick = () => {
        const z = b.dataset.ziffer;
        // Wurde das Feld anderswo gesetzt (z.B. Schnellbetrag), den Zwischenspeicher angleichen.
        // Der Zwischenspeicher wird immer am Feld ausgerichtet - auch wenn das Feld von
        // aussen GELEERT wurde. Ohne diesen Fall lief der Speicher weiter und die naechste
        // Ziffer wurde an einen laengst geloeschten Betrag angehaengt.
        const imFeld = String(feld.value || '').replace('.', ',');
        if (imFeld !== eingabe.replace(/,$/, '')) eingabe = imFeld;
        if (z === ',') { if (eingabe.includes(',')) return; eingabe = (eingabe || '0') + ','; return uebernehmen(); }
        if (eingabe.includes(',') && eingabe.split(',')[1].length >= 2) return;  // hoechstens zwei Nachkommastellen
        eingabe += z;
        uebernehmen();
      };
    });
    block.querySelector('[data-loeschen]').onclick = () => {
      const imFeld = String(feld.value || '').replace('.', ',');
      if (imFeld !== eingabe.replace(/,$/, '')) eingabe = imFeld;
      eingabe = eingabe.slice(0, -1);
      uebernehmen();
    };
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
    el('withdrawDialog')?.addEventListener('close', () => {
      const dlg = el('withdrawDialog');
      dlg.classList.remove('kc-modus-entnahme', 'kc-modus-reklamation');
      el('kcVerrechnungHinweis')?.remove();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verdrahten);
  else verdrahten();
  global.KCErfassungGetrennt = {modusSetzen, zifferblockAnpassen};
})(window);
