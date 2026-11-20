// KC Finance Bridge - Verwaltung eingehender Geldübergaben im PC Manager.
(function (global) {
  'use strict';
  const el = (id) => document.getElementById(id);
  const geld = (n) => Number(n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  const FREIGEGEBEN_KEY = 'kcm_finance_transfers_freigegeben_v1';
  const LETZTE_BESTAETIGUNG_KEY = 'kcm_finance_letzte_bestaetigung_v1';
  function freigegebeneIds() { try { return JSON.parse(localStorage.getItem(FREIGEGEBEN_KEY) || '{}'); } catch (e) { return {}; } }
  function merkeFreigegeben(id) { const karte = freigegebeneIds(); karte[id] = new Date().toISOString(); localStorage.setItem(FREIGEGEBEN_KEY, JSON.stringify(karte)); }
  function client() { if (!global.KCCommunicationClient) return null; return new global.KCCommunicationClient({ sourceProgram: 'kc-money-butler', getAccessToken: async () => global.KCSupabase?.holeZugriffsToken?.() || null }); }
  function bridge() { const kc = client(); return kc && global.createKCFinanceBridge ? global.createKCFinanceBridge(kc) : null; }
  function meldung(text, art = 'info') { const feld = el('ftMeldung'); if (feld) { feld.textContent = text; feld.className = `tc-status tc-status-${art}`; } }
  function zeichneListe(transfers) {
    const ziel = el('ftListe'); if (!ziel) return;
    if (!transfers.length) { ziel.innerHTML = '<p class="hint">Keine offenen Geldübergaben.</p>'; return; }
    const freigegeben = freigegebeneIds();
    // 20.11.2026: Weitergabe an die Kasse laeuft automatisch (kc-money-butler-cloud-intake.js). Hier nur
    // der Stand - ein Knopf erscheint nur noch als Notweg, wenn eine Uebergabe laenger als 5 Minuten haengt.
    const haengt = (t) => Date.now() - new Date(t.manager_received_at || t.created_at || Date.now()).getTime() > 5 * 60000;
    ziel.innerHTML = `<div class="table-card"><table><thead><tr><th>Datum</th><th>Kasse</th><th>Betrag</th><th>Status</th><th></th></tr></thead><tbody>${transfers.map((t) => {
      let statusText = '', aktion = '';
      if (t.status === 'pending_manager') statusText = '⏳ Neu – wird automatisch an die Kasse gegeben';
      else if (t.status === 'manager_received' && !freigegeben[t.id]) {
        statusText = '⏳ Wird an die Kasse gegeben …';
        if (haengt(t)) aktion = `<button type="button" data-ft-freigeben="${t.id}" title="Nur nötig, wenn die automatische Weitergabe hängt">Erneut senden</button>`;
      } else if (t.status === 'manager_received' && freigegeben[t.id]) statusText = '📨 An der Kasse – wartet auf Bestätigung';
      else if (t.status === 'handed_to_register') statusText = '✅ Von der Kasse bestätigt';
      return `<tr><td>${t.business_date || '–'}</td><td>${t.register_id}</td><td>${geld(t.amount)}</td><td>${statusText}</td><td>${aktion}</td></tr>`;
    }).join('')}</tbody></table></div>`;
    ziel.querySelectorAll('[data-ft-uebernehmen]').forEach((btn) => btn.addEventListener('click', () => uebernehmen(btn.dataset.ftUebernehmen)));
    ziel.querySelectorAll('[data-ft-freigeben]').forEach((btn) => btn.addEventListener('click', () => freigeben(btn.dataset.ftFreigeben, transfers.find((t) => t.id === btn.dataset.ftFreigeben))));
  }
  async function listeLaden(manuell = false) { const fb = bridge(); if (!fb) return meldung('KC-Communication-Bausteine nicht geladen.', 'fehler'); try { const antwort = await fb.listCashTransfers({ statuses: ['pending_manager', 'manager_received', 'handed_to_register'], limit: 100 }); if (!antwort?.ok) throw new Error(antwort?.error || 'Unbekannter Fehler'); zeichneListe(antwort.items || []); if (manuell) meldung(`${(antwort.items || []).length} Geldübergabe(n) geladen.`, 'ok'); await bestaetigungenAbholenUndMelden(); } catch (err) { const m = String(err?.message || err); meldung(/401|unauth/i.test(m) ? 'Bitte oben rechts bei Supabase anmelden – sonst können Geldübergaben nicht angezeigt und weitergegeben werden.' : `Konnte nicht geladen werden: ${m}`, 'fehler'); } }
  async function uebernehmen(id) { const fb = bridge(); try { const antwort = await fb.markCashTransfer(id, 'manager_received'); if (!antwort?.ok) throw new Error(antwort?.error || 'Unbekannter Fehler'); meldung('Übergabe übernommen.', 'ok'); await listeLaden(); } catch (err) { meldung(`Konnte nicht übernommen werden: ${err.message}`, 'fehler'); } }
  async function freigeben(id, transfer) { if (!transfer) return; try { const antwort = await fetch('http://127.0.0.1:47392/api/v1/finance-transfer/queue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ registerLabel: transfer.register_id, transferId: transfer.correlation_id || `finance-${transfer.id}`, payload: { registerId: transfer.register_id, amount: transfer.amount, businessDate: transfer.business_date, financeTransferId: transfer.id } }) }); if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`); merkeFreigegeben(id); meldung(`An ${transfer.register_id} freigegeben.`, 'ok'); await listeLaden(); } catch (err) { meldung(`Manager-Dienst gerade nicht erreichbar (läuft das schwarze Fenster?): ${err.message}`, 'fehler'); } }
  async function bestaetigungenAbholenUndMelden() { const fb = bridge(); if (!fb) return; try { const seit = localStorage.getItem(LETZTE_BESTAETIGUNG_KEY) || ''; const antwort = await fetch(`http://127.0.0.1:47392/gelduebergaben-bestaetigungen-abholen${seit ? `?seit=${encodeURIComponent(seit)}` : ''}`); if (!antwort.ok) return; const daten = await antwort.json(); localStorage.setItem(LETZTE_BESTAETIGUNG_KEY, daten.abgefragtUm || new Date().toISOString()); const bestaetigungen = Array.isArray(daten.bestaetigungen) ? daten.bestaetigungen : []; for (const b of bestaetigungen) { const antwortListe = await fb.listCashTransfers({ statuses: ['manager_received'], limit: 100 }).catch(() => null); const passend = antwortListe?.items?.find((t) => (t.correlation_id || `finance-${t.id}`) === String(b.transferId || '').split('#')[0]); if (passend) await fb.markCashTransfer(passend.id, 'handed_to_register').catch(() => {}); } } catch (e) {} }
  el('ftAktualisieren')?.addEventListener('click', () => listeLaden(true));
  document.querySelectorAll('[data-view="cashprep"]').forEach((b) => b.addEventListener('click', () => setTimeout(() => listeLaden(false), 150)));
  // KC-RT-PROGRAMME (11.10.2026): Steht die direkte Leitung, meldet jede neue Übergabe sich selbst
  // (kc-direkte-leitung-manager.js lädt die Liste dann sofort). Dann nur alle 2 Minuten zur Sicherheit statt alle 30 s.
  let zuletztGeladen = 0;
  const laden = (manuell) => { zuletztGeladen = Date.now(); return listeLaden(manuell); };
  setInterval(() => { if (global.KCDirekteLeitungManager?.steht?.() && Date.now() - zuletztGeladen < 120000) return; laden(false); }, 30000);
  global.KCFinanceUebergaben = { listeLaden: laden };
})(window);
