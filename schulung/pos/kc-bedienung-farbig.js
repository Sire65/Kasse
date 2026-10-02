// KC Bedienung farbig – Weitere Funktionen, Rabatt, Gutschein und Bargeldeinzahlung     02.10.2026
//
// ANLASS (Betreiber, Entwuerfe abgestimmt: "ja alles so bauen"): dieselbe Bedienung wie bei der neuen
// Entnahme – grosse farbige Knoepfe, Geld als echte Scheine, Hauptknopf grau bis alles gewaehlt ist.
//
// GRUNDREGEL: Nur Aussehen und Bedienung. Alle Buchungen laufen unveraendert ueber die vorhandenen
// Funktionen und Knoepfe (app.js, kc-gutschein.js). Diese Datei verschiebt keine Knoepfe aus ihren
// Behaeltern, ersetzt keine Klick-Funktionen und schreibt nichts in den Speicher.
// Die Gestaltung bringt die Datei selbst mit (<style id="kcFarbStil">) – Lehre aus dem iPad-Befund:
// Programm und Aussehen sollen nie aus verschiedenen Dateistaenden kommen.
(function (global) {
  'use strict';
  const el = id => document.getElementById(id);
  const geld = b => (Math.round(Number(b) * 100) / 100).toFixed(2).replace('.', ',') + ' €';
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const spaeter = fn => setTimeout(fn, 0);

  const STIL = `
/* ---- Weitere Funktionen ---- */
#moreDialog .more-grid { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 10px !important; }
#moreDialog .more-grid > .kc-mg-titel { grid-column: 1 / -1; margin: 8px 0 -2px; font: 800 13px/1.2 Arial, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: #4a5260; }
#moreDialog .more-grid > .kc-mg-titel[hidden] { display: none !important; }
#moreDialog .more-grid > button { min-height: 56px !important; border-radius: 12px !important; font-size: 16px !important; font-weight: 800 !important; }
#moreDialog .more-grid > button.kc-mg-geld { min-height: 66px !important; color: #fff !important; border: 0 !important; box-shadow: 0 2px 4px rgba(0,0,0,.2) !important; text-shadow: 0 1px 2px rgba(0,0,0,.3); }
#moreDialog .more-grid > button.kc-mg-info { background: #eef2f6 !important; color: #1f2937 !important; border: 2px solid #dbe2ea !important; }
#moreDialog .more-grid > button.kc-mg-kasse { background: #37474f !important; color: #fff !important; border: 0 !important; }
#moreDialog .more-grid > button[data-action="withdraw"] { background: #2e7d32 !important; }
#moreDialog .more-grid > button[data-action="tip"] { background: #ad1457 !important; }
#moreDialog .more-grid > button[data-action="deposit"] { background: #00838f !important; }
#moreDialog .more-grid > button[data-action="gutschein"] { background: #6a1b9a !important; }
#moreDialog .more-grid > button[data-action="wertmarke"] { background: #b26a00 !important; }
#moreDialog .more-grid > button[data-action="helfer"] { background: #1565c0 !important; }
#moreDialog .more-grid > button[data-action="reklamation"] { background: #c62828 !important; }
#moreDialog .more-grid > button[data-action="tip"]::before { content: "\\1F49D  "; }
#moreDialog .more-grid > button[data-action="deposit"]::before { content: "\\267B\\FE0F  "; }
#moreDialog .more-grid > button.kc-mg-fuss { min-height: 56px !important; }
#moreDialog .more-grid > button[value="close"] { grid-column: 3; background: #eef0f3 !important; color: #111827 !important; border: 0 !important; font-size: 19px !important; }
#moreDialog .more-grid > #layoutQuickToggle { grid-column: 1 / span 2; min-height: 44px !important; background: transparent !important; border: 0 !important; color: #64748b !important; font-size: 14px !important; font-weight: 600 !important; justify-content: flex-start; text-align: left; }
#moreDialog .more-grid > .kc-mg-wahl { order: 95; grid-column: 1 / -1; margin: 4px 0 0 !important; font-size: 13px !important; font-weight: 600; color: #64748b; }
#moreDialog .more-grid > .kc-mg-wahl select { flex: 0 1 320px !important; font-size: 14px !important; padding: 6px !important; }
/* ---- Rabatt ---- */
#discountDialog #discountReasonButtons { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 10px !important; }
#discountDialog [data-discount-reason] { min-height: 70px !important; height: auto !important; border: 0 !important; border-radius: 12px !important; color: #fff !important; font-size: 14px !important; font-weight: 900 !important; line-height: 1.15 !important; display: flex !important; flex-direction: column; align-items: center; justify-content: center; gap: 2px; box-shadow: 0 2px 4px rgba(0,0,0,.2) !important; text-shadow: 0 1px 2px rgba(0,0,0,.3); padding: 6px 4px !important; transition: opacity .15s; }
#discountDialog [data-discount-reason]::before { font-size: 22px; line-height: 1; text-shadow: none; }
#discountDialog [data-discount-reason][data-discount-preset]::after { content: "Vorschlag " attr(data-discount-preset) " %"; font-size: 11px; font-weight: 700; opacity: .9; }
#discountDialog [data-discount-reason="Bekannter"] { background: #2e7d32 !important; } #discountDialog [data-discount-reason="Bekannter"]::before { content: "\\1F91D"; }
#discountDialog [data-discount-reason="Marktbeschicker"] { background: #b26a00 !important; } #discountDialog [data-discount-reason="Marktbeschicker"]::before { content: "\\1F3AA"; }
#discountDialog [data-discount-reason="Stammgast"] { background: #1565c0 !important; } #discountDialog [data-discount-reason="Stammgast"]::before { content: "\\2B50"; }
#discountDialog [data-discount-reason="Reklamation"] { background: #c62828 !important; } #discountDialog [data-discount-reason="Reklamation"]::before { content: "\\21A9"; }
#discountDialog [data-discount-reason="Kulanz"] { background: #ad1457 !important; } #discountDialog [data-discount-reason="Kulanz"]::before { content: "\\1F49B"; }
#discountDialog [data-discount-reason="Sonstiges"] { background: #546e7a !important; } #discountDialog [data-discount-reason="Sonstiges"]::before { content: "\\22EF"; }
#discountDialog [data-discount-reason].active { outline: 4px solid #111827 !important; outline-offset: 2px; }
#discountDialog.kc-rb-gewaehlt [data-discount-reason]:not(.active) { opacity: .42; }
#discountDialog [data-discount-percent] { min-height: 56px !important; border-radius: 12px !important; font-size: 19px !important; font-weight: 900 !important; }
#discountDialog [data-discount-percent].active { background: #1f2937 !important; color: #fff !important; border-color: #111827 !important; }
#discountDialog #discountStepPercent:disabled { opacity: .35; }
#discountDialog #applyDiscountBtn { min-height: 62px !important; font-size: 19px !important; font-weight: 900 !important; border-radius: 12px !important; }
#discountDialog #applyDiscountBtn:disabled { background: #e5e7eb !important; color: #9ca3af !important; border-color: #e5e7eb !important; box-shadow: none !important; }
#discountDialog .kc-rb-hinweis { margin: 8px 0 4px; padding: 8px 12px; border-radius: 10px; background: #f1f5f9; color: #475569; font: 700 14px/1.3 Arial, sans-serif; text-align: center; }
#discountDialog .kc-rb-hinweis.kc-bereit { background: #dcfce7; color: #14532d; }
/* ---- Gutschein ---- */
#gutscheinDialog .kc-gs-reiter { display: grid !important; grid-template-columns: repeat(3, 1fr); gap: 0 !important; border: 2px solid #6a1b9a; border-radius: 12px; overflow: hidden; margin: 10px 0 6px; }
#gutscheinDialog .kc-gs-reiter > button { min-height: 52px !important; border: 0 !important; border-radius: 0 !important; background: #fff !important; color: #6a1b9a !important; font-size: 17px !important; font-weight: 900 !important; }
#gutscheinDialog .kc-gs-reiter > button.aktiv { background: #6a1b9a !important; color: #fff !important; }
#gutscheinDialog .kc-gs-reiter > [data-gs-reiter="verkauf"]::before { content: "\\1F381  "; }
#gutscheinDialog .kc-gs-reiter > [data-gs-reiter="einloesen"]::before { content: "\\1F504  "; }
#gutscheinDialog .kc-gs-reiter > [data-gs-reiter="liste"]::before { content: "\\1F4CB  "; }
#gutscheinDialog #gsBetraege { display: flex !important; gap: 14px !important; padding: 12px 14px; background: #f4f1ea; border: 1px solid #e5dccb; border-radius: 14px; }
#gutscheinDialog #gsBetraege > button { flex: 1 1 0 !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; border: 0 !important; background: transparent !important; box-shadow: none !important; line-height: 0; position: relative; }
#gutscheinDialog #gsBetraege > button img { width: 100%; height: auto; display: block; border-radius: 7px; box-shadow: 0 3px 6px rgba(0,0,0,.3); pointer-events: none; }
#gutscheinDialog #gsBetraege > button .kc-gs-text { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
#gutscheinDialog #gsBetraege > button.aktiv img { outline: 4px solid #111827; outline-offset: 3px; }
#gutscheinDialog #gsBetraege > button.aktiv::after { content: "\\2713"; position: absolute; top: -10px; right: -10px; width: 30px; height: 30px; border-radius: 15px; background: #111827; color: #fff; border: 2px solid #fff; font: 900 16px/26px Arial, sans-serif; text-align: center; box-sizing: border-box; }
#gutscheinDialog .kc-gs-zeile { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; margin-top: 12px; }
#gutscheinDialog .kc-gs-anzeige { height: 60px; border: 3px solid #1f2937; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; font: 900 28px Arial, sans-serif; color: #111827; }
#gutscheinDialog .kc-gs-anzeige small { font-size: 13px; font-weight: 700; color: #6b7280; }
#gutscheinDialog .kc-gs-anzeige.leer { color: #9ca3af; }
#gutscheinDialog .kc-gs-anders { height: 60px; padding: 0 16px; border: 2px solid #cbd5e1 !important; border-radius: 12px !important; background: #f8fafc !important; color: #1f2937 !important; font-size: 16px !important; font-weight: 800 !important; }
#gutscheinDialog section[data-gs-bereich="verkauf"]:not(.kc-gs-frei-offen) > label.kc-gs-frei, #gutscheinDialog section[data-gs-bereich="verkauf"]:not(.kc-gs-frei-offen) > #gsZiffern { display: none !important; }
#gutscheinDialog section[data-gs-bereich="verkauf"].kc-gs-frei-offen > #gsZiffern { max-width: 420px; }
#gutscheinDialog #gsAusstellen { min-height: 64px !important; font-size: 20px !important; font-weight: 900 !important; border-radius: 12px !important; display: flex !important; flex-direction: column; align-items: center; justify-content: center; width: 100%; }
#gutscheinDialog #gsAusstellen small { font-size: 13px; font-weight: 700; margin-top: 2px; }
#gutscheinDialog #gsAusstellen:disabled { background: #e5e7eb !important; color: #9ca3af !important; border-color: #e5e7eb !important; box-shadow: none !important; }
/* ---- Bargeldeinzahlung ---- */
#cashDepositDialog #cashDepositPayload { width: 100% !important; box-sizing: border-box; min-height: 150px; border: 3px dashed #94a3b8 !important; border-radius: 16px !important; background: #f8fafc !important; font-size: 16px; padding: 14px; resize: none; }
#cashDepositDialog #cashDepositPayload:focus { border-color: #2563eb !important; outline: none; background: #eff6ff !important; }
#cashDepositDialog .kc-bg-vorschau { margin-top: 10px; padding: 14px 16px; border-radius: 14px; font: 700 15px/1.35 Arial, sans-serif; }
#cashDepositDialog .kc-bg-vorschau[hidden] { display: none !important; }
#cashDepositDialog .kc-bg-vorschau.ok { background: #f0fdf4; border: 2px solid #16a34a; color: #14532d; }
#cashDepositDialog .kc-bg-vorschau.ok b { display: block; font-size: 32px; font-weight: 900; }
#cashDepositDialog .kc-bg-vorschau.fehler { background: #fef2f2; border: 2px solid #dc2626; color: #7f1d1d; }
#cashDepositDialog #applyCashDeposit { width: 100%; min-height: 64px !important; font-size: 20px !important; font-weight: 900 !important; border-radius: 12px !important; margin-top: 10px; }
#cashDepositDialog #applyCashDeposit:disabled, #cashDepositDialog #applyCashShortCode:disabled { background: #e5e7eb !important; color: #9ca3af !important; border-color: #e5e7eb !important; box-shadow: none !important; }
#cashDepositDialog .kc-bg-kurz { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 8px 0; padding: 12px 14px; border: 2px solid #e2e8f0; border-radius: 12px; }
#cashDepositDialog .kc-bg-kurz > span { font: 800 15px Arial, sans-serif; color: #334155; margin-right: 6px; }
#cashDepositDialog .kc-bg-kurz input { height: 50px; border: 2px solid #cbd5e1; border-radius: 10px; text-align: center; font: 900 24px Arial, sans-serif; color: #111827; box-sizing: border-box; }
#cashDepositDialog .kc-bg-kurz input:focus { border-color: #2563eb; outline: none; }
#cashDepositDialog .kc-bg-kurz i { font-style: normal; font-size: 22px; color: #94a3b8; }
#cashDepositDialog #cashShortCodeInput { position: absolute !important; width: 1px !important; height: 1px !important; opacity: 0 !important; pointer-events: none !important; }
#cashDepositDialog #applyCashShortCode { min-height: 50px !important; padding: 0 18px !important; border-radius: 10px !important; font-size: 16px !important; font-weight: 800 !important; background: #1565c0 !important; color: #fff !important; border: 0 !important; margin-left: auto; }
#cashDepositDialog .kc-bg-kurz-text { width: 100%; font: 700 14px Arial, sans-serif; color: #475569; }
#cashDepositDialog .kc-bg-kurz-text.ok { color: #14532d; } #cashDepositDialog .kc-bg-kurz-text.fehler { color: #b91c1c; }
#cashDepositDialog button[value="close"] { min-height: 56px !important; min-width: 220px; border-radius: 12px !important; font-size: 18px !important; font-weight: 800 !important; background: #eef0f3 !important; border: 0 !important; margin-top: 10px; }
`;

  function stilEinbauen() {
    if (el('kcFarbStil')) return;
    const st = document.createElement('style');
    st.id = 'kcFarbStil';
    st.textContent = STIL;
    (document.head || document.documentElement).appendChild(st);
  }

  // ---- 1. Weitere Funktionen: nach Bereichen ordnen ------------------------------------------
  // Die Knoepfe bleiben in .more-grid (dort haengen die Klick-Funktionen); geordnet wird ueber
  // CSS-Reihenfolge und eingeschobene Ueberschriften.
  const GRUPPEN = [
    {titel: '💶 Geld', klasse: 'kc-mg-geld', start: 10, wer: ['withdraw', 'tip', 'deposit', 'gutschein', 'wertmarke', 'helfer']},
    {titel: '↩ Rückgabe', klasse: 'kc-mg-geld', start: 20, wer: ['reklamation']},
    {titel: '🔐 Kasse', klasse: 'kc-mg-kasse', start: 30, wer: ['opening', 'closing', 'cashdeposit', 'rush', 'training', 'central', 'vorfuehrung']},
    {titel: '🧾 Bon und Übersicht', klasse: 'kc-mg-info', start: 40, wer: ['lastbon', 'xbericht', '#accountBalanceOpen', 'currency', 'operator']}
  ];
  function mehrOrdnen() {
    const raster = document.querySelector('#moreDialog .more-grid');
    if (!raster) return;
    if (!raster.dataset.kcGeordnet) {
      raster.dataset.kcGeordnet = '1';
      GRUPPEN.forEach((g, gi) => {
        const t = document.createElement('div');
        t.className = 'kc-mg-titel'; t.dataset.gruppe = String(gi); t.textContent = g.titel;
        t.style.order = String(g.start - 1);
        raster.appendChild(t);
        g.wer.forEach((w, i) => {
          const b = w.startsWith('#') ? el(w.slice(1)) : raster.querySelector(`:scope > button[data-action="${w}"]`);
          if (!b) return;
          b.style.order = String(g.start + i);
          b.classList.add(g.klasse);
          b.dataset.kcGruppe = String(gi);
        });
      });
      raster.querySelectorAll(':scope > button').forEach(b => {
        if (b.dataset.kcGruppe) return;
        b.style.order = '90'; b.classList.add('kc-mg-fuss');
      });
      const zu = raster.querySelector(':scope > button[value="close"]');
      if (zu) zu.style.order = '99';
    }
    {
      // Technik-Auswahl ("Oberflaeche · Modul") klein ganz ans Ende - im Raster, damit sie mitscrollt.
      const wahl = document.querySelector('#moreDialog .kc-aufbau-wahl');
      if (wahl && wahl.parentElement !== raster) { wahl.classList.add('kc-mg-wahl'); raster.appendChild(wahl); }
    }
    // Ueberschriften nur, wenn in der Gruppe gerade etwas zu sehen ist
    raster.querySelectorAll(':scope > .kc-mg-titel').forEach(t => {
      const sichtbar = [...raster.querySelectorAll(`:scope > button[data-kc-gruppe="${t.dataset.gruppe}"]`)]
        .some(b => !b.hidden && getComputedStyle(b).display !== 'none');
      t.hidden = !sichtbar;
    });
  }

  // ---- 2. Rabatt: Hinweis auf dem Weg zum Uebernehmen -----------------------------------------
  function rabattPruefen() {
    const dlg = el('discountDialog');
    if (!dlg) return;
    const grund = dlg.querySelector('[data-discount-reason].active');
    dlg.classList.toggle('kc-rb-gewaehlt', !!grund);
    let h = el('kcRabattHinweis');
    if (!h) {
      h = document.createElement('p');
      h.id = 'kcRabattHinweis'; h.className = 'kc-rb-hinweis';
      dlg.querySelector('.dialog-actions')?.insertAdjacentElement('beforebegin', h);
    }
    const prozent = dlg.querySelector('[data-discount-percent].active')?.dataset.discountPercent
      || String(el('discountCustomPercent')?.value || '').trim();
    const bereit = !!grund && el('applyDiscountBtn') && !el('applyDiscountBtn').disabled;
    const zahl = t => Number(String(t || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    const vorher = zahl(el('discountSummaryTotal')?.textContent), nachher = zahl(el('discountPreview')?.textContent);
    h.classList.toggle('kc-bereit', bereit);
    h.textContent = !grund ? 'Bitte zuerst wählen, für wen der Rabatt ist.'
      : !bereit ? 'Bitte noch den Prozentsatz wählen.'
      : `✓ ${grund.textContent.replace(/\s+/g, ' ').trim()} · ${String(prozent).replace('.', ',')} % · −${geld(Math.max(0, vorher - nachher))}`;
  }

  // ---- 3. Gutschein: echte Scheine, Ziffernfeld nur bei "Anderer Betrag" -----------------------
  function gutscheinBetragsKnoepfe() {
    document.querySelectorAll('#gsBetraege > [data-gs-betrag]').forEach(b => {
      if (b.querySelector('img')) return;
      const w = b.dataset.gsBetrag;
      const text = b.textContent.trim();
      b.innerHTML = `<img src="assets/schein_${w}.jpg" alt="" draggable="false"><span class="kc-gs-text">${esc(text)}</span>`;
      b.setAttribute('aria-label', `Gutschein über ${text}`);
    });
  }
  function gutscheinAufbauen() {
    const bereich = document.querySelector('#gutscheinDialog section[data-gs-bereich="verkauf"]');
    if (!bereich || el('kcGsAnzeige')) return;
    const zeile = document.createElement('div');
    zeile.className = 'kc-gs-zeile';
    zeile.innerHTML = '<div id="kcGsAnzeige" class="kc-gs-anzeige leer" aria-live="polite"><span>0,00 €</span><small>noch kein Betrag</small></div>'
      + '<button type="button" id="kcGsAnders" class="kc-gs-anders">⌨ Anderer Betrag</button>';
    el('gsBetraege')?.insertAdjacentElement('afterend', zeile);
    el('kcGsAnders').onclick = () => {
      bereich.classList.toggle('kc-gs-frei-offen');
      if (bereich.classList.contains('kc-gs-frei-offen')) el('gsFreiBetrag')?.scrollIntoView({block: 'nearest'});
    };
    const knopf = el('gsAusstellen');
    if (knopf && !knopf.querySelector('small')) knopf.innerHTML = '<span>Gutschein ausstellen und drucken</span><small></small>';
  }
  function gutscheinPruefen() {
    const anzeige = el('kcGsAnzeige');
    if (!anzeige) return;
    const frei = Number(String(el('gsFreiBetrag')?.value || '').replace(',', '.'));
    const aktiv = document.querySelector('#gsBetraege > [data-gs-betrag].aktiv');
    const betrag = frei > 0 ? frei : (aktiv ? Number(aktiv.dataset.gsBetrag) : 0);
    anzeige.classList.toggle('leer', !(betrag > 0));
    anzeige.querySelector('span').textContent = geld(betrag);
    anzeige.querySelector('small').textContent = betrag > 0 ? (frei > 0 ? 'eingegeben' : 'Gutschein über') : 'noch kein Betrag';
    const knopf = el('gsAusstellen'), klein = knopf?.querySelector('small');
    if (knopf) knopf.disabled = !(betrag > 0) || betrag > 500;
    if (klein) {
      const bis = new Date(); bis.setFullYear(bis.getFullYear() + Number(global.KCGutschein?.GUELTIG_JAHRE || 3));
      klein.textContent = betrag > 500 ? 'Höchstbetrag ist 500,00 €'
        : betrag > 0 ? `${geld(betrag)} · gültig bis ${bis.toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric'})}`
        : 'Bitte zuerst einen Betrag wählen';
    }
  }

  // ---- 4. Bargeldeinzahlung: grosses Scanfeld, Vorschau vor dem Uebernehmen, Kurzcode in Kaestchen --
  function bargeldAufbauen() {
    const dlg = el('cashDepositDialog'), feld = el('cashDepositPayload');
    if (!dlg || !feld || el('kcBgVorschau')) return;
    const titel = dlg.querySelector('h2');
    if (titel) titel.textContent = '💶 Bargeld vom Kassenwart übernehmen';
    const erst = dlg.querySelector('p:not([id])');
    if (erst) erst.textContent = 'Übergabecode einlesen – Betrag und Kasse werden vor dem Übernehmen angezeigt.';
    feld.setAttribute('placeholder', '📷 Jetzt den QR-Code mit dem Scanner einlesen – das Feld wartet bereits.');
    feld.setAttribute('rows', '4');
    const v = document.createElement('div');
    v.id = 'kcBgVorschau'; v.className = 'kc-bg-vorschau'; v.hidden = true; v.setAttribute('aria-live', 'polite');
    feld.insertAdjacentElement('afterend', v);
    feld.addEventListener('input', bargeldVorschau);
    // Kurzcode: vier Kaestchen, die das vorhandene Feld fuellen
    const alt = el('cashShortCodeInput');
    if (alt) {
      const box = document.createElement('div');
      box.className = 'kc-bg-kurz';
      box.innerHTML = '<span>⌨ Kein Scanner?</span>'
        + '<input id="kcKurz1" inputmode="numeric" maxlength="1" style="width:52px" aria-label="Vorgangsart (1 oder 2)"><i>–</i>'
        + '<input id="kcKurz2" inputmode="numeric" maxlength="1" style="width:52px" aria-label="Kasse"><i>–</i>'
        + '<input id="kcKurz3" inputmode="numeric" maxlength="6" style="width:140px" aria-label="Betrag in Cent (6 Ziffern)"><i>–</i>'
        + '<input id="kcKurz4" inputmode="numeric" maxlength="1" style="width:52px" aria-label="Prüfziffer">'
        + '<p id="kcKurzText" class="kc-bg-kurz-text">Format z. B. 2 – 1 – 060000 – 4 (vom Übergabebeleg)</p>';
      alt.insertAdjacentElement('beforebegin', box);
      // Der alte Erklaertext steht jetzt in den Kaestchen selbst.
      [...dlg.querySelectorAll('p')].filter(x => /Kurzcode von Hand/.test(x.textContent)).forEach(x => { x.hidden = true; });
      const knopf = el('applyCashShortCode');
      if (knopf) box.insertBefore(knopf, el('kcKurzText'));
      const felder = [1, 2, 3, 4].map(i => el('kcKurz' + i));
      felder.forEach((f, i) => f.addEventListener('input', () => {
        f.value = f.value.replace(/\D/g, '').slice(0, Number(f.getAttribute('maxlength')));
        if (f.value.length === Number(f.getAttribute('maxlength')) && felder[i + 1]) felder[i + 1].focus();
        kurzcodePruefen();
      }));
    }
  }
  function bargeldVorschau() {
    const feld = el('cashDepositPayload'), v = el('kcBgVorschau'), knopf = el('applyCashDeposit');
    if (!feld || !v) return;
    const text = feld.value.trim();
    // Ohne die Lesefunktion aus app.js keine Vorschau und keine Sperre - dann bleibt alles wie bisher.
    if (typeof global.decodeCashPayload !== 'function') { v.hidden = true; if (knopf) knopf.disabled = false; return; }
    if (!text) { v.hidden = true; if (knopf) knopf.disabled = true; return; }
    try {
      const p = global.decodeCashPayload(text);
      if (p?.format !== 'KC_CASH_TRANSFER') throw new Error('Der Code ist keine Bargeldübergabe.');
      if (typeof global.checksumObject === 'function' && (!p.checksum || global.checksumObject(p) !== p.checksum)) throw new Error('Prüfsumme falsch – bitte erneut scannen.');
      const art = p.type === 'opening' ? 'Anfangsbestand' : 'Nachfüllung';
      const kasse = p.registerId || (Array.isArray(p.registerIds) ? p.registerIds.join(' + ') : '');
      const von = p.operator || p.createdBy || p.issuedBy || '';
      const tag = p.effectiveDate ? String(p.effectiveDate).split('-').reverse().join('.') : '';
      v.className = 'kc-bg-vorschau ok';
      v.innerHTML = `✅ Code erkannt – ${esc(art)}<b>${geld(p.total)}</b>${esc([kasse, tag && 'für ' + tag, von && 'von ' + von].filter(Boolean).join(' · '))}`;
      if (knopf) knopf.disabled = false;
    } catch (e) {
      v.className = 'kc-bg-vorschau fehler';
      v.textContent = '❌ ' + (e && e.message ? e.message : 'Code nicht lesbar – bitte erneut scannen.');
      if (knopf) knopf.disabled = true;
    }
    v.hidden = false;
  }
  function kurzcodePruefen() {
    const felder = [1, 2, 3, 4].map(i => el('kcKurz' + i));
    if (felder.some(f => !f)) return;
    const [a, b, c, d] = felder.map(f => f.value);
    const alt = el('cashShortCodeInput'), knopf = el('applyCashShortCode'), text = el('kcKurzText');
    const komplett = a.length === 1 && b.length === 1 && c.length === 6 && d.length === 1;
    if (alt) alt.value = komplett ? `${a}-${b}-${c}-${d}` : '';
    let ok = false;
    if (komplett) {
      const ziffern = a + b + c;
      let q = 0; for (let i = 0; i < ziffern.length; i++) q += Number(ziffern[i]) * (i + 2);
      ok = /^[12]$/.test(a) && /^[1-9]$/.test(b) && Number(c) > 0 && String(q % 10) === d;
      text.className = 'kc-bg-kurz-text ' + (ok ? 'ok' : 'fehler');
      text.textContent = ok
        ? `✓ ${a === '1' ? 'Anfangsbestand' : 'Nachfüllung'} ${geld(Number(c) / 100)} für ${b === '9' ? 'mehrere Kassen gemeinsam' : 'Kasse ' + b}`
        : 'Prüfziffer oder Angabe stimmt nicht – bitte den Code noch einmal genau ablesen.';
    } else {
      text.className = 'kc-bg-kurz-text';
      text.textContent = 'Format z. B. 2 – 1 – 060000 – 4 (vom Übergabebeleg)';
    }
    if (knopf) knopf.disabled = !ok;
  }

  // ---- Verdrahten: nur Beobachter, keine fremden Klick-Funktionen ersetzen -----------------------
  function beimOeffnen(dlgId, fn) {
    const dlg = el(dlgId);
    if (!dlg || dlg.dataset.kcFarbig) return;
    dlg.dataset.kcFarbig = '1';
    new MutationObserver(() => { if (dlg.open) spaeter(fn); }).observe(dlg, {attributes: true, attributeFilter: ['open']});
    dlg.addEventListener('click', () => spaeter(fn));
    dlg.addEventListener('input', () => spaeter(fn));
    if (dlg.open) spaeter(fn);
  }
  function verdrahten() {
    stilEinbauen();
    beimOeffnen('moreDialog', mehrOrdnen);
    beimOeffnen('discountDialog', rabattPruefen);
    const gs = el('gutscheinDialog');
    if (gs) {
      gutscheinAufbauen();
      const betraege = el('gsBetraege');
      if (betraege) new MutationObserver(() => { gutscheinBetragsKnoepfe(); gutscheinPruefen(); }).observe(betraege, {childList: true});
      gutscheinBetragsKnoepfe();
      beimOeffnen('gutscheinDialog', () => { gutscheinAufbauen(); gutscheinBetragsKnoepfe(); gutscheinPruefen(); });
      // Nach dem Ausstellen setzt kc-gutschein.js die Auswahl zurueck - Anzeige nachziehen.
      el('gsAusstellen')?.addEventListener('click', () => setTimeout(gutscheinPruefen, 50));
      gs.addEventListener('close', () => document.querySelector('#gutscheinDialog section[data-gs-bereich="verkauf"]')?.classList.remove('kc-gs-frei-offen'));
    }
    if (el('cashDepositDialog')) {
      bargeldAufbauen();
      beimOeffnen('cashDepositDialog', () => {
        bargeldVorschau(); kurzcodePruefen();
        const f = el('cashDepositPayload');
        if (f && document.activeElement !== f && !String(document.activeElement?.id || '').startsWith('kcKurz')) f.focus({preventScroll: true});
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verdrahten);
  else verdrahten();
  global.KCBedienungFarbig = {mehrOrdnen, rabattPruefen, gutscheinPruefen, bargeldVorschau, kurzcodePruefen};
})(window);
