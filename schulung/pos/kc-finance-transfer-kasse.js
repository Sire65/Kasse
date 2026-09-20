// KC Finance Bridge - Gelduebergabe mit bewusster Bestaetigung an der Kasse.
//
// UNTERSCHEID zu kc-sync-cash-transfer.js (bestehend, bleibt unveraendert): jene Datei
// uebernimmt automatisch, ohne Rueckfrage, fuer den Fall "Money Butler direkt am Stand im
// selben WLAN". HIER geht es um den Fall "Kassenwart zuhause, kein gemeinsames Netz" - die
// Geldsumme kommt ueber die zentrale Finance Bridge (Supabase) beim PC Manager an, der sie
// erst nach eigener Pruefung "An Kasse freigeben" antippt. Der Betreiber wollte fuer DIESEN
// Weg ausdruecklich eine bewusste Bestaetigung an der Kasse (Betrag/Datum sehen, "Uebernehmen"
// oder "Spaeter"), keine automatische Buchung im Hintergrund. Eigene, komplett getrennte
// Abfrage (/api/v1/finance-transfer/pending), eigene lokale Speicherung
// (kc_finance_transfer_verarbeitet_v1) - beruehrt an keiner Stelle den bestehenden Weg.
(function (global) {
  'use strict';
  const VERARBEITET_KEY = 'kc_finance_transfer_verarbeitet_v1';
  let wartendeUebergabe = null; // {transferId, payload} - liegt an, bis Uebernehmen/Spaeter
  let pruefeGeradeSchon = false;

  function verarbeiteteIds() {
    try { return JSON.parse(localStorage.getItem(VERARBEITET_KEY) || '[]'); } catch (e) { return []; }
  }
  function merkeVerarbeitet(id) {
    const liste = verarbeiteteIds();
    if (!liste.includes(id)) { liste.push(id); localStorage.setItem(VERARBEITET_KEY, JSON.stringify(liste.slice(-500))); }
  }

  function geld(n) { return Number(n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }); }

  // KCASH1 nutzt total/effectiveDate. Ältere Finance-Bridge-Datensätze nutzten
  // amount/businessDate. Beide Formen werden akzeptiert. Bei einer Geldkassette (scope=split)
  // wird aus der kompakten Aufteilung exakt der Anteil DIESER Kasse berechnet; niemals der
  // Gesamtbetrag an beide Kassen gebucht.
  function betragFuerKasse(payload, registerId) {
    if (payload?.scope !== 'split') return Number(payload?.amount ?? payload?.total ?? 0);
    const teilung = payload?.split;
    if (!teilung || !Array.isArray(payload?.registerIds) || !payload.registerIds.includes(registerId)) return 0;
    const erste = registerId === teilung.ersteKasse;
    let summe = 0;
    const lose = payload.looseBreakdown || {};
    for (const [rawWert, rawGesamt] of Object.entries(lose)) {
      const wert = Number(rawWert), gesamt = Math.max(0, Number(rawGesamt) || 0);
      const beiErster = Math.min(Math.max(0, Number(teilung.lose?.[rawWert]) || 0), gesamt);
      const anzahl = erste ? beiErster : gesamt - beiErster;
      summe += anzahl * wert;
    }
    const rollen = payload.coinRolls || {};
    for (const [rawWert, rolle] of Object.entries(rollen)) {
      const wert = Number(rawWert), gesamt = Math.max(0, Number(rolle?.rolls) || 0);
      const coinsPerRoll = Math.max(0, Number(rolle?.coinsPerRoll) || 0);
      const beiErster = Math.min(Math.max(0, Number(teilung.rollen?.[rawWert]) || 0), gesamt);
      const anzahl = erste ? beiErster : gesamt - beiErster;
      summe += anzahl * coinsPerRoll * wert;
    }
    return +summe.toFixed(2);
  }
  function datumFuerKasse(payload, fallback) {
    return payload?.businessDate || payload?.effectiveDate || fallback;
  }

  function zeigeMeldung(transferId, payload) {
    if (document.getElementById('kcFinanceTransferOverlay')) return; // schon eine offen
    const heute = typeof localBusinessDate === 'function' ? localBusinessDate() : null;
    const eroeffnungHeuteVorhanden = typeof safeArray === 'function' && heute
      ? safeArray('kc_cash_movements').some((m) => m.type === 'opening' && m.registerId === (global.state?.master?.registerId) && (m.effectiveDate === heute))
      : false;
    const art = eroeffnungHeuteVorhanden ? 'Nachfüllung' : 'Anfangsbestand';

    const overlay = document.createElement('div');
    overlay.id = 'kcFinanceTransferOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.75);z-index:999998;display:flex;align-items:center;justify-content:center;padding:20px;font-family:system-ui,sans-serif;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:14px;padding:28px;max-width:400px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3);">
        <div style="font-size:2.6rem;">💶</div>
        <h2 style="margin:10px 0 6px;font-size:1.3rem;">Neue Kassenfüllung vom PC Manager</h2>
        <p style="color:#475569;margin:0 0 4px;">${art}: <strong>${geld(betragFuerKasse(payload, global.state?.master?.registerId || payload.registerId))}</strong></p>
        <p style="color:#475569;margin:0 0 4px;">Für: <strong>${payload.registerId || (global.state?.master?.registerId) || ''}</strong></p>
        <p style="color:#475569;margin:0 0 18px;">Datum: <strong>${datumFuerKasse(payload, heute) || ''}</strong></p>
        <div style="display:flex;gap:10px;justify-content:center;">
          <button type="button" id="kcFinanceTransferSpaeter" style="padding:12px 18px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;font-size:1rem;">Später</button>
          <button type="button" id="kcFinanceTransferUebernehmen" style="padding:12px 22px;border-radius:8px;border:0;background:#166534;color:#fff;font-weight:700;font-size:1rem;">Übernehmen</button>
        </div>
      </div>
    `;
    document.documentElement.appendChild(overlay);
    document.getElementById('kcFinanceTransferSpaeter').addEventListener('click', () => {
      overlay.remove();
      wartendeUebergabe = null;
      // Bewusst NICHT bestaetigt - der Eintrag bleibt beim naechsten Takt erneut sichtbar
      // (er wurde ja server-seitig nicht als "delivered" markiert, siehe pruefeAufUebergabe).
    });
    document.getElementById('kcFinanceTransferUebernehmen').addEventListener('click', async () => {
      overlay.querySelector('button').disabled = true;
      await uebernehmeUndBestaetige(transferId, payload, eroeffnungHeuteVorhanden);
      overlay.remove();
    });
  }

  // Bucht den Betrag in denselben Speicher wie jede andere Bargeldübergabe (kc_cash_movements) -
  // OHNE die QR-Prüfsummen-/Stückelungs-Logik von applyCashPayload(), die hier nicht passt (die
  // Finance Bridge liefert nur einen Gesamtbetrag, keine Schein-/Münz-Stückelung). Danach die
  // Kasse ueber den bewaehrten Meldeweg zurückmelden UND beim Companion als erledigt bestätigen.
  async function uebernehmeUndBestaetige(transferId, payload, warBereitsEroeffnet) {
    if (!verarbeiteteIds().includes(transferId)) {
      const heute = typeof localBusinessDate === 'function' ? localBusinessDate() : new Date().toISOString().slice(0, 10);
      const registerId = global.state?.master?.registerId || payload.registerId;
      const eintrag = {
        type: warBereitsEroeffnet ? 'topup' : 'opening',
        registerId,
        total: betragFuerKasse(payload, registerId),
        effectiveDate: datumFuerKasse(payload, heute),
        transferId,
        importSource: 'finance-bridge',
        importedAt: new Date().toISOString(),
      };
      const bewegungen = JSON.parse(localStorage.getItem('kc_cash_movements') || '[]');
      bewegungen.push(eintrag);
      localStorage.setItem('kc_cash_movements', JSON.stringify(bewegungen));
      merkeVerarbeitet(transferId);
      if (typeof setSystemHint === 'function') {
        setSystemHint(`Kassenfüllung übernommen: ${geld(eintrag.total)} (${eintrag.type === 'opening' ? 'Anfangsbestand' : 'Nachfüllung'}).`, 'ok');
      }
      // Zuverlaessig an den Manager zurueckmelden, damit die zentrale Finance Bridge (Supabase)
      // ebenfalls als "an Kasse uebergeben" markiert werden kann - derselbe Meldeweg wie
      // Verkauf/Abschluss, kein neuer Kanal.
      await global.KCMeldeweg?.ueberCompanion?.('cash_transfer_confirmed', {
        transferId,
        registerId,
        amount: eintrag.total,
        businessDate: eintrag.effectiveDate,
        confirmedAt: eintrag.importedAt,
        confirmationRequested: payload.confirmationRequested === true
      });
    }
    // ERST NACHDEM lokal gespeichert wurde (oder schon vorher gespeichert war, z.B. bei einem
    // zweiten Versuch nach einem Absturz) wird beim Companion bestaetigt - sonst koennte ein
    // Abbruch dazwischen die Uebergabe unwiderruflich verschwinden lassen, ohne dass sie
    // irgendwo gebucht wurde.
    try {
      await fetch(global.KCSyncConnection.buildUrl('/kc-sync-finance-transfer-ack'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transferId }),
      });
    } catch (e) { /* Companion gerade nicht erreichbar - naechster Takt bestaetigt erneut, schadet nicht */ }
    wartendeUebergabe = null;
  }

  async function pruefeAufUebergabe() {
    if (pruefeGeradeSchon || wartendeUebergabe || !global.KCSyncConnection) return;
    pruefeGeradeSchon = true;
    try {
      const antwort = await fetch(global.KCSyncConnection.buildUrl('/kc-sync-finance-transfer'), { signal: AbortSignal.timeout(3000) });
      if (!antwort.ok) return;
      const daten = await antwort.json();
      if (!daten?.pending) return;
      const { transferId, payload } = daten.pending;
      if (verarbeiteteIds().includes(transferId)) {
        // Bereits lokal gebucht (z.B. Seite neu geladen, bevor die Bestaetigung ankam) - nur
        // noch die Bestaetigung nachholen, keine zweite Buchung.
        await uebernehmeUndBestaetige(transferId, payload, true);
        return;
      }
      wartendeUebergabe = { transferId, payload };
      zeigeMeldung(transferId, payload);
    } catch (e) { /* Companion gerade nicht erreichbar - beim naechsten Takt erneut versuchen */ }
    finally { pruefeGeradeSchon = false; }
  }

  setInterval(pruefeAufUebergabe, 20000);
  setTimeout(pruefeAufUebergabe, 5000);
  global.KCFinanceTransferKasse = { pruefeAufUebergabe };
})(window);
