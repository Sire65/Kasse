/* Money Butler · Schrittfolge (20.11.2026)                                          Build 1.0.0
 *
 * Wunsch des Betreibers: Der Weg soll abgesichert sein - Tasten sind ausgegraut, bis sie Sinn ergeben.
 *   Schritt 1  Ziel, Datum und Beträge eingeben       -> „Übergabe vorbereiten“ erst dann frei
 *   Schritt 2  „Übergabe vorbereiten“                 -> erst danach sind die Übertragungswege frei
 *   Schritt 3  Übertragungsweg wählen und starten
 *   Gesendet   Für dieselbe Übergabe ist kein zweites Senden möglich (keine Doppelbuchung von Geld).
 * Wird nach dem Vorbereiten noch etwas geändert (Betrag, Datum, Kasse, Vorgang, Notiz), verfällt die
 * vorbereitete Übergabe sofort - es kann nie ein alter Stand verschickt werden.
 *
 * Empfangsbestätigung ist PFLICHT bei Anfangsbestand und Nachfüllung: der Haken ist gesetzt und
 * gesperrt. Der Kurzcode kann keine Bestätigung transportieren und ist deshalb bei Geldübergaben
 * gesperrt (bei Zählungen wird kein Geld übergeben - dort bleibt er frei).
 *
 * Nutzt die Werte aus app.js (currentPayload, currentType, getData, isBusinessDate, clearTransferOutput).
 */
(function () {
  'use strict';
  const el = (id) => document.getElementById(id);
  if (!el('generate') || typeof getData !== 'function') return;
  let gesendet = null;

  const stil = document.createElement('style');
  stil.textContent = '#generate:disabled,.handover-method:disabled{opacity:.42;filter:grayscale(1);cursor:not-allowed}'
    + '.mb-schritt{margin:6px 0 0;padding:9px 12px;border-radius:8px;background:#eef3f7;color:#0b315d;font-weight:600;font-size:.9rem}'
    + '.mb-schritt.gut{background:#e7f6ec;color:#166534}.mb-schritt.warn{background:#fff6dc;color:#664400}'
    + '.handover-method small.mb-sperre{color:#9a3412;font-weight:600}';
  document.head.appendChild(stil);

  const hinweis = document.createElement('p');
  hinweis.id = 'mbSchritt'; hinweis.className = 'mb-schritt'; hinweis.setAttribute('aria-live', 'polite');
  el('generate').closest('.actions')?.insertAdjacentElement('afterend', hinweis);

  const istGeld = () => currentType !== 'count';
  function eingabe() {
    let d = { total: 0 }; try { d = getData(); } catch (e) { /* noch nicht bereit */ }
    const datum = el('effectiveDate')?.value || '';
    const datumOk = typeof isBusinessDate === 'function' ? isBusinessDate(datum) : !!datum;
    const betragOk = istGeld() ? Number(d.total) > 0 : Number(d.total) >= 0;
    return { datumOk, betragOk };
  }
  function zeige(text, art) { hinweis.textContent = text; hinweis.className = 'mb-schritt' + (art ? ' ' + art : ''); }

  function aktualisieren() {
    const { datumOk, betragOk } = eingabe();
    const vorbereitet = !!currentPayload;
    el('generate').disabled = !(datumOk && betragOk) || !!gesendet;
    document.querySelectorAll('[data-handover-method]').forEach((b) => {
      const kurzcodeGesperrt = b.dataset.handoverMethod === 'shortcode' && istGeld();
      b.disabled = !vorbereitet || !!gesendet || kurzcodeGesperrt;
      let sperre = b.querySelector('small.mb-sperre');
      if (kurzcodeGesperrt) {
        if (!sperre) { sperre = document.createElement('small'); sperre.className = 'mb-sperre'; b.appendChild(sperre); }
        sperre.textContent = 'Nicht bei Geldübergaben – keine Empfangsbestätigung möglich';
      } else if (sperre) sperre.remove();
    });
    if (gesendet) return zeige(`✓ Gesendet: ${gesendet}. Für eine neue Übergabe „Zurücksetzen“ drücken oder Eingaben ändern.`, 'gut');
    if (!datumOk && !betragOk) return zeige('Schritt 1: Kasse, Vorgang, Datum („Gültig für“) und Beträge eingeben.');
    if (!datumOk) return zeige('Schritt 1: Bitte noch das Datum („Gültig für“) wählen.', 'warn');
    if (!betragOk) return zeige('Schritt 1: Bitte noch Scheine/Münzen eingeben.', 'warn');
    if (!vorbereitet) return zeige('Schritt 2: „Übergabe vorbereiten“ drücken.');
    return zeige('Schritt 3: Unten den Übertragungsweg wählen und starten.', 'gut');
  }

  // Jede Änderung nach dem Vorbereiten macht die vorbereitete Übergabe ungültig.
  function geaendert(ev) {
    const t = ev.target;
    if (!t || t.closest?.('#handoverStartDialog') || t.id === 'payload') return;
    const relevant = t.closest?.('[data-money-section], .choice-row, .date-quick-row, .entry-mode-switch, #register, #effectiveDate, #note');
    if (!relevant) return;
    if (currentPayload || gesendet) {
      try { clearTransferOutput(); } catch (e) { /* */ }
      gesendet = null;
    }
    setTimeout(aktualisieren, 0);
  }
  document.addEventListener('input', geaendert, true);
  document.addEventListener('change', geaendert, true);
  document.addEventListener('click', (ev) => {
    if (ev.target?.closest?.('[data-type], .date-quick, [data-entry-mode]')) geaendert(ev);
  }, true);
  el('reset')?.addEventListener('click', () => { gesendet = null; setTimeout(aktualisieren, 0); });
  el('generate').addEventListener('click', () => setTimeout(aktualisieren, 0));

  // Empfangsbestätigung als Pflicht: nach dem Öffnen des Start-Fensters Haken setzen und sperren.
  document.querySelectorAll('[data-handover-method]').forEach((b) => b.addEventListener('click', () => {
    const haken = el('handoverConfirmationWanted'); if (!haken) return;
    if (istGeld()) {
      haken.checked = true; haken.disabled = true;
      const h = el('handoverConfirmationHint');
      if (h) h.textContent = 'Pflicht: Die Kasse muss den Eingang des Geldes bestätigen. Erst dann gilt die Übergabe als angekommen.';
    }
  }));

  // Nach erfolgreichem Senden über KC Communicator: dieselbe Übergabe nicht ein zweites Mal senden.
  const komm = window.KCMoneyButlerCommunicator;
  if (komm && typeof komm.senden === 'function' && !komm.__schrittfolge) {
    const original = komm.senden;
    komm.senden = async function () {
      const ergebnis = await original.apply(this, arguments);
      if (ergebnis) {
        gesendet = `${el('handoverTotal')?.textContent || ''} an ${el('handoverRegister')?.textContent || ''}`;
        setTimeout(aktualisieren, 0);
      }
      return ergebnis;
    };
    komm.__schrittfolge = true;
  }

  aktualisieren();
  window.KCMoneyButlerSchrittfolge = { aktualisieren, version: '1.0.0' };
})();
