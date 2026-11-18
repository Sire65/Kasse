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
  const BESTAETIGT_KEY = 'kc_finance_transfer_bestaetigt_v1';
  let wartendeUebergabe = null; // {transferId, payload} - liegt an, bis Uebernehmen/Spaeter
  let pruefeGeradeSchon = false;

  function verarbeiteteIds() {
    try { return JSON.parse(localStorage.getItem(VERARBEITET_KEY) || '[]'); } catch (e) { return []; }
  }
  function merkeVerarbeitet(id) {
    const liste = verarbeiteteIds();
    if (!liste.includes(id)) { liste.push(id); localStorage.setItem(VERARBEITET_KEY, JSON.stringify(liste.slice(-500))); }
  }
  function bestaetigteIds() {
    try { return JSON.parse(localStorage.getItem(BESTAETIGT_KEY) || '[]'); } catch (e) { return []; }
  }
  function merkeBestaetigt(id) {
    const liste = bestaetigteIds();
    if (!liste.includes(id)) { liste.push(id); localStorage.setItem(BESTAETIGT_KEY, JSON.stringify(liste.slice(-500))); }
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

  function aktuelleKasse(payload={}) {
    try { if(typeof state!=='undefined'&&state.master?.registerId)return state.master.registerId; } catch {}
    if(global.state?.master?.registerId)return global.state.master.registerId;
    if(global.KCSyncConnection?.config?.registerId)return global.KCSyncConnection.config.registerId;
    try { return JSON.parse(localStorage.getItem('kc_master_v040')||'{}').registerId||payload.registerId; } catch { return payload.registerId; }
  }
  function buchungsId(transferId,payload){return payload.scope==='split'?`${payload.transferId||transferId.split('#')[0]}#${aktuelleKasse(payload)}`:payload.transferId||transferId;}
  function bewegung(transferId,payload){return JSON.parse(localStorage.getItem('kc_cash_movements')||'[]').find(m=>m.transferId===buchungsId(transferId,payload)&&m.registerId===aktuelleKasse(payload));}
  function beschaeftigt(){
    try { const s=typeof state!=='undefined'?state:global.state;return !!(s?.cart?.length||s?.saleInProgress||s?.master?.rushMode||s?.discount?.haendlerausweis||document.querySelector?.('dialog[open],#kcPinLockOverlay,#kcStartkarteOverlay')); }catch{return true;}
  }
  function pruefeZielDatum(payload){
    const id=aktuelleKasse(payload),heute=typeof localBusinessDate==='function'?localBusinessDate():new Date().toISOString().slice(0,10);
    const erlaubt=payload.scope==='split'||payload.scope==='shared'?payload.registerIds?.includes(id):payload.registerId===id;
    if(!id||!erlaubt)throw new Error('Geldübergabe gehört nicht zu dieser Kasse.');
    if(datumFuerKasse(payload)!==heute)throw new Error('Geldübergabe ist für einen anderen Geschäftstag vorgesehen.');
    return id;
  }

  function zeigeMeldung(transferId, payload) {
    if (document.getElementById('kcFinanceTransferOverlay')) return; // schon eine offen
    const heute = typeof localBusinessDate === 'function' ? localBusinessDate() : null;
    const eroeffnungHeuteVorhanden = typeof safeArray === 'function' && heute
      ? safeArray('kc_cash_movements').some((m) => m.type === 'opening' && m.registerId === aktuelleKasse(payload) && (m.effectiveDate === heute))
      : false;
    const art = payload.type==='topup'||eroeffnungHeuteVorhanden ? 'Nachfüllung' : 'Anfangsbestand';

    const overlay = document.createElement('div');
    overlay.id = 'kcFinanceTransferOverlay';
    overlay.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;inset:0;background:rgba(15,23,42,.75);z-index:999998;display:flex;align-items:center;justify-content:center;padding:20px;font-family:system-ui,sans-serif;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:14px;padding:28px;max-width:400px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3);">
        <div style="font-size:2.6rem;">💶</div>
        <h2 style="margin:10px 0 6px;font-size:1.3rem;">Neue Kassenfüllung vom PC Manager</h2>
        <p style="color:#475569;margin:0 0 4px;">${art}: <strong>${geld(betragFuerKasse(payload, global.state?.master?.registerId || payload.registerId))}</strong></p>
        <p style="color:#475569;margin:0 0 4px;">Für: <strong>${payload.registerId || aktuelleKasse(payload) || ''}</strong></p>
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
      const knoepfe=overlay.querySelectorAll('button');
      knoepfe.forEach(b=>b.disabled=true);
      try{
        await uebernehmeUndBestaetige(transferId, payload, eroeffnungHeuteVorhanden);
        overlay.remove();
      }catch(err){
        if(verarbeiteteIds().includes(transferId)||bewegung(transferId,payload)){
          overlay.remove();wartendeUebergabe=null;
          if(typeof setSystemHint==='function')setSystemHint('Geld ist gebucht. Die Empfangsbestätigung wird automatisch erneut versucht.','info');
        }else{
          knoepfe.forEach(b=>b.disabled=false);
          if(typeof setSystemHint==='function')setSystemHint('Kassenfüllung nicht übernommen: '+(err?.message||String(err)),'error');
        }
      }
    });
  }

  // Bucht den Betrag in denselben Speicher wie jede andere Bargeldübergabe (kc_cash_movements) -
  // OHNE die QR-Prüfsummen-/Stückelungs-Logik von applyCashPayload(), die hier nicht passt (die
  // Finance Bridge liefert nur einen Gesamtbetrag, keine Schein-/Münz-Stückelung). Danach die
  // Kasse ueber den bewaehrten Meldeweg zurückmelden UND beim Companion als erledigt bestätigen.
  async function uebernehmeUndBestaetige(transferId, payload, warBereitsEroeffnet) {
    const heute = typeof localBusinessDate === 'function' ? localBusinessDate() : new Date().toISOString().slice(0, 10);
    const registerId = pruefeZielDatum(payload);
    const betrag=betragFuerKasse(payload, registerId);
    if(!Number.isFinite(betrag)||betrag<=0)throw new Error('Betrag für diese Kasse ist ungültig oder die Kassenaufteilung ist beschädigt.');
    const effectiveDate=datumFuerKasse(payload, heute);
    let confirmedAt=new Date().toISOString();

    const vorhanden=bewegung(transferId,payload);
    if(vorhanden&&(Math.abs(Number(vorhanden.total)-betrag)>.009||vorhanden.effectiveDate!==effectiveDate))throw new Error("Übergabe-ID wurde bereits mit anderem Betrag oder Datum verwendet.");
    if(!verarbeiteteIds().includes(transferId)&&!vorhanden){
      // Vollständige Money-Butler-Pakete nehmen denselben geprüften Weg wie QR und Direktübergabe.
      if(payload.format==='KC_CASH_TRANSFER'&&payload.breakdown&&typeof applyCashPayload==='function'){
        const text='KCASH1:'+btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        applyCashPayload(text,'finance-bridge');
      }else{
        // Kompatibilität für ältere Finance-Bridge-Pakete ohne Stückelung.
        const bewegungen=JSON.parse(localStorage.getItem('kc_cash_movements')||'[]');
        const opening=bewegungen.some(m=>m.type==='opening'&&m.registerId===registerId&&m.effectiveDate===effectiveDate);
        if(payload.type==='opening'&&opening)throw new Error('Anfangsbestand bereits vorhanden. Weiteres Geld bitte als Nachfüllung senden.');
        bewegungen.push({type:payload.type|| (opening?'topup':'opening'),registerId,total:betrag,effectiveDate,
          transferId:buchungsId(transferId,payload),importSource:'finance-bridge',importedAt:confirmedAt});
        localStorage.setItem('kc_cash_movements',JSON.stringify(bewegungen));
      }
    }else if(vorhanden?.importedAt)confirmedAt=vorhanden.importedAt;
    merkeVerarbeitet(transferId);
    // Gemeinsamer Duplikatschutz auch dann, wenn anschließend derselbe QR-Code gescannt wird.
    const used=JSON.parse(localStorage.getItem('kc_cash_used_transfers')||'[]'),key=buchungsId(transferId,payload);
    if(!used.includes(key)){used.push(key);localStorage.setItem('kc_cash_used_transfers',JSON.stringify(used));}

    // Lokale Buchung und Rueckmeldung sind absichtlich getrennte Zustände:
    // Ist das Geld schon gebucht, aber der Meldeweg war kurz nicht erreichbar, wird NUR die
    // Bestaetigung erneut versucht. So gibt es weder Doppelbuchungen noch verlorene Quittungen.
    if (!bestaetigteIds().includes(transferId)) {
      if(typeof global.KCMeldeweg?.ueberCompanion!=='function')throw new Error('Meldeweg für die Empfangsbestätigung ist nicht verfügbar.');
      await global.KCMeldeweg.ueberCompanion('cash_transfer_confirmed', {
        transferId,
        registerId,
        amount: betrag,
        businessDate: effectiveDate,
        confirmedAt,
        confirmationRequested: payload.confirmationRequested === true
      });
      merkeBestaetigt(transferId);
    }
    // ERST NACHDEM lokal gespeichert wurde (oder schon vorher gespeichert war, z.B. bei einem
    // zweiten Versuch nach einem Absturz) wird beim Companion bestaetigt - sonst koennte ein
    // Abbruch dazwischen die Uebergabe unwiderruflich verschwinden lassen, ohne dass sie
    // irgendwo gebucht wurde.
    try {
      await fetch(global.KCSyncConnection.buildUrl('/kc-sync-finance-transfer-ack'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transferId }), signal: AbortSignal.timeout(4000),
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
      pruefeZielDatum(payload);
      if (verarbeiteteIds().includes(transferId)) {
        // Bereits lokal gebucht (z.B. Seite neu geladen, bevor die Bestaetigung ankam) - nur
        // noch die Bestaetigung nachholen, keine zweite Buchung.
        await uebernehmeUndBestaetige(transferId, payload, true);
        return;
      }
      if(beschaeftigt())return;
      wartendeUebergabe = { transferId, payload };
      zeigeMeldung(transferId, payload);
    } catch (e) { /* Companion gerade nicht erreichbar - beim naechsten Takt erneut versuchen */ }
    finally { pruefeGeradeSchon = false; }
  }

  setInterval(pruefeAufUebergabe, 20000);
  setTimeout(pruefeAufUebergabe, 5000);
  global.KCFinanceTransferKasse = { pruefeAufUebergabe };
})(window);
