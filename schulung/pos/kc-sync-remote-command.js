// KC Sync – prüft periodisch, ob vom Manager aus ein Fernbefehl für diese Kasse ausgelöst wurde
// (z.B. "Stammdaten sofort neu laden", "Sperren bei Diebstahl", "Datenbank leeren"). Die Kasse
// muss dafür NICHT direkt erreichbar sein - sie fragt selbst regelmäßig beim eigenen, lokalen
// Companion nach, ob dort inzwischen etwas für sie hinterlegt wurde.
(function (global) {
  'use strict';
  const URL_BEFEHL = (global.KCSyncConnection?.buildUrl('/kc-sync-pending-command')) || 'http://127.0.0.1:47391/kc-sync-pending-command';
  const SPERR_SCHLUESSEL = 'kc_geraet_gesperrt_v1';

  // Ganz am Anfang geprüft, VOR allem anderen (auch vor app.js) - eine bereits gesperrte Kasse
  // zeigt die Sperr-Meldung sofort wieder, auch nach einem Neuladen/Neustart des Browsers.
  // Kann NUR durch den "entsperren"-Fernbefehl aufgehoben werden, nicht lokal am Gerät.
  function zeigeSperrmeldung() {
    if (document.getElementById('kcGeraetGesperrtOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'kcGeraetGesperrtOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:#7f1d1d;color:#fff;z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px;font-family:system-ui,sans-serif;';
    overlay.innerHTML = `
      <div style="font-size:4rem;">🔒</div>
      <h1 style="font-size:1.8rem;margin:16px 0 8px;">Dieses Gerät wurde gesperrt</h1>
      <p style="max-width:480px;font-size:1.05rem;opacity:.9;">Bitte beim Betreiber melden. Diese Sperre kann nur vom Manager aus wieder aufgehoben werden.</p>
    `;
    document.documentElement.appendChild(overlay);
    // Bedienung der eigentlichen Seite dahinter vollständig unterbinden.
    document.addEventListener('keydown', (e) => e.stopPropagation(), true);
    document.addEventListener('click', (e) => { if (e.target !== overlay && !overlay.contains(e.target)) { e.stopPropagation(); e.preventDefault(); } }, true);
  }
  if (localStorage.getItem(SPERR_SCHLUESSEL) === '1') {
    if (document.body) zeigeSperrmeldung();
    else document.addEventListener('DOMContentLoaded', zeigeSperrmeldung);
  }

  async function leereVerkaufsdatenbank() {
    // Löscht Verkaufs-/Kassendaten (IndexedDB + zugehörige localStorage-Verlaufsdaten) - NICHT
    // die Kopplung/den Zugangs-Schlüssel selbst, damit die Kasse danach weiterhin erreichbar
    // bleibt (z.B. um sie anschließend auch zu sperren oder wieder normal zu nutzen).
    //
    // BEFUND bei der Durchsicht: die Liste war stehengeblieben. Es fehlten die seither
    // dazugekommenen Ablagen - die Warteschlange der noch nicht gemeldeten Buchungen, die
    // Zeitbuchungen, die Gutscheine, die Ausverkauft-Markierungen. Nach dem "Leeren" wären
    // ausgerechnet die zuletzt kassierten Verkäufe als lesbare Warteschlange liegengeblieben.
    try { indexedDB.deleteDatabase('kc_pos_transactions_v1'); } catch (e) { /* ignorieren */ }
    [
      'kc_cash_movements', 'kc_cash_import_audit', 'kc_cash_used_transfers', 'kc_closings',
      'kc_discount_audit_v020', 'kc_voids_v040', 'kc_cash_withdrawals_v018', 'kc_tip_records',
      'kc_sync_offene_buchungen_v1',      // noch nicht gemeldete Verkäufe - lagen im Klartext
      'kc_closings_gemeldet_v1',
      'kc_time_clock_events_v1', 'kc_time_clock_gemeldet_v1', 'kc_time_clock_people_v1',
      'kc_vouchers_v1', 'kc_ausverkauft_v1', 'kc_bargeld_uebergaben_v1',
    ].forEach((schluessel) => { try { localStorage.removeItem(schluessel); } catch (e) { /* ignorieren */ } });
  }

  // Das Gerät unbrauchbar machen - für den Diebstahlfall.
  //
  // Der entscheidende Teil ist der KARTENSCHLÜSSEL: ohne ihn nützt selbst eine gefundene
  // Startkarte nichts mehr, denn der Datenschlüssel wird daraus berechnet. Ein Gerät ohne
  // Kartenschlüssel kann seine eigenen alten Verkäufe nicht mehr lesen - und neue Schlüssel
  // bekommt es nicht, weil dafür die Kopplung gültig sein muss, die der Manager widerrufen hat.
  async function macheGeraetUnbrauchbar() {
    await leereVerkaufsdatenbank();
    ['kc_kartenschluessel_v1', 'kc_schluessel_ausgabe_v1', 'kc_sync_connection_v1', 'kc_master_v040']
      .forEach((schluessel) => { try { localStorage.removeItem(schluessel); } catch (e) { /* ignorieren */ } });
    try { sessionStorage.clear(); } catch (e) { /* ignorieren */ }
    localStorage.setItem(SPERR_SCHLUESSEL, '1');
  }

  async function pruefeAufBefehl() {
    try {
      const antwort = await fetch(URL_BEFEHL, { signal: AbortSignal.timeout(2000) });
      if (!antwort.ok) return;
      const daten = await antwort.json();
      if (daten.befehl === 'reload_stammdaten') {
        console.log('Kasse wird aufgefrischt …');
        location.reload();
      } else if (daten.befehl === 'sperren') {
        localStorage.setItem(SPERR_SCHLUESSEL, '1');
        zeigeSperrmeldung();
      } else if (daten.befehl === 'entsperren') {
        localStorage.removeItem(SPERR_SCHLUESSEL);
        location.reload();
      } else if (daten.befehl === 'datenbank_leeren') {
        await leereVerkaufsdatenbank();
        location.reload();
      } else if (daten.befehl === 'geraet_verloren') {
        // Letzte Stufe: Gerät als verloren gemeldet. Alles löschen, was jemandem nützen könnte,
        // und sperren. Wirkt nur, wenn sich das Gerät noch einmal meldet - der eigentliche
        // Schutz ist der Kartenwechsel im Manager, der auch ohne das Gerät sofort greift.
        await macheGeraetUnbrauchbar();
        location.reload();
      } else if (daten.befehl === 'abschluss_melden') {
        // Auf Anfrage wird ein FERTIGER Abschluss erneut gesichert - aber NIE einer gebaut.
        // Den Abschluss zu machen bleibt eine bewusste Handlung am Stand; ein auf Zuruf
        // erzeugter Zwischenstand saehe wie eine fertige Tageszahl aus und waere nach dem
        // naechsten Verkauf still falsch. Gibt es fuer heute noch keinen, geht eine
        // ausdrueckliche Meldung "noch nicht gemacht" zurueck - besser als gar keine Antwort,
        // sonst sucht jemand den Fehler an der falschen Stelle.
        const vorhanden = global.KCAbschlussSicherung?.letzterAbschlussHeute?.();
        if (vorhanden) {
          await global.KCAbschlussSicherung.meldeAbschluss(vorhanden);
        } else {
          global.KCSyncLiveEvent?.send?.('abschluss_status', {
            registerId: global.KCSyncConnection?.config?.registerId || null,
            status: 'noch_nicht_gemacht',
          });
        }
        // Bewusst ohne jede Anzeige an der Kasse: die Bedienung soll davon nichts merken.
      }
    } catch (e) { /* Companion gerade nicht erreichbar - beim nächsten Versuch erneut prüfen */ }
  }

  setInterval(pruefeAufBefehl, 20000);
})(window);
