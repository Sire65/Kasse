/* Money Butler an der direkten Leitung (KC-RT-PROGRAMME, 11.10.2026)                    Build 1.0.0
 *
 * Bisher erfuhr der Money Butler nach "Über KC Communicator senden" nie, ob der PC-Manager die Übergabe abgeholt hat.
 * Jetzt meldet die Datenbank über die direkte Leitung (nur Signal, nie Inhalt):
 *   geld, zaehlung  → der Money Butler sieht über den bisherigen, gesicherten Weg (kc-finance-bridge) nach, ob SEINE
 *                     zuletzt gesendete Übergabe/Zählung vom PC-Manager übernommen wurde, und zeigt "✓ übernommen".
 *   einstellungen   → gemeinsame Messwerte (Münzgewichte, Rollen) sofort neu laden.
 * Ohne Anmeldung/Berechtigung keine Leitung; der Money Butler arbeitet dann genau wie bisher.
 */
(function (global) {
  'use strict';
  if (!global.KCDirekteLeitung) return;
  const BASE_URL = 'https://ptblnpiroqftcvlsrhac.supabase.co';
  const SCHLUESSEL = 'sb_publishable_SqXIeGN-clcZ4gjmpLdSww_4DLfyy24';
  const el = (id) => document.getElementById(id);
  let gesendet = null; // { kind: 'transfer'|'count', id, betrag, zeit }
  let pruefTimer = null;

  // Was wurde zuletzt gesendet? (Der Datensatz steht nach dem Senden weiter im Feld "payload".)
  document.addEventListener('click', (ev) => {
    if (!ev.target || ev.target.id !== 'commSend') return;
    try {
      const { payload, kind } = global.KCMoneyButlerCommunicator.payloadLesen();
      gesendet = { kind, id: kind === 'count' ? payload.countId : payload.transferId, betrag: Number(payload.total), zeit: Date.now() };
      zeige('');
    } catch (e) { gesendet = null; }
  }, true);

  function zeige(text) {
    let z = el('commSendBestaetigt');
    if (!z) {
      const status = el('commSendStatus'); if (!status) return;
      z = document.createElement('p'); z.id = 'commSendBestaetigt'; z.className = 'hint';
      z.style.cssText = 'font-weight:700;color:#166534;margin-top:4px';
      status.insertAdjacentElement('afterend', z);
    }
    z.textContent = text; z.hidden = !text;
  }
  async function client() {
    if (typeof global.KCCommunicationClient !== 'function' || !global.KCMoneyButlerAuth?.getAccessToken) return null;
    return new global.KCCommunicationClient({ sourceProgram: 'kc-money-butler', getAccessToken: () => global.KCMoneyButlerAuth.getAccessToken(), defaultTestOnly: false });
  }
  async function bestaetigungPruefen() {
    if (!gesendet || Date.now() - gesendet.zeit > 7 * 86400000) return;
    const c = await client(); if (!c) return;
    const istZaehlung = gesendet.kind === 'count';
    const data = await c._request('kc-finance-bridge', istZaehlung
      ? { action: 'cash_count_list', statuses: ['manager_received'], limit: 100 }
      : { action: 'cash_transfer_list', statuses: ['manager_received', 'handed_to_register'], limit: 100 });
    const items = Array.isArray(data?.items) ? data.items : [];
    const treffer = items.find((r) => {
      const p = istZaehlung ? r?.payload : r?.payload?.cashPayload;
      return p && (istZaehlung ? p.countId : p.transferId) === gesendet.id;
    });
    if (!treffer) return;
    const uhr = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const betrag = gesendet.betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
    zeige(istZaehlung
      ? `✓ ${uhr}: Zählung über ${betrag} vom PC-Manager übernommen.`
      : treffer.status === 'handed_to_register'
        ? `✓ ${uhr}: ${betrag} vom PC-Manager übernommen und an die Kasse weitergegeben.`
        : `✓ ${uhr}: ${betrag} vom PC-Manager übernommen.`);
    if (treffer.status === 'handed_to_register' || istZaehlung) gesendet = null; // fertig – nicht weiter nachsehen
  }
  function spaeterPruefen(ms) { clearTimeout(pruefTimer); pruefTimer = setTimeout(() => { bestaetigungPruefen().catch(() => {}); }, ms); }

  const leitung = global.KCDirekteLeitung.starte({
    name: 'money-butler',
    async kanalHolen() {
      const token = await global.KCMoneyButlerAuth?.getAccessToken?.();
      if (!token) return null;
      const antwort = await fetch(`${BASE_URL}/rest/v1/rpc/kc_rt_programm_kanal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SCHLUESSEL, Authorization: 'Bearer ' + token },
        body: JSON.stringify({ p_bereich: 'money-butler' }), signal: AbortSignal.timeout(8000),
      });
      if (!antwort.ok) return null;
      const k = await antwort.json().catch(() => null);
      return typeof k === 'string' ? k : null;
    },
    beiSignal(art) {
      if (art === 'geld' || art === 'zaehlung') spaeterPruefen(800);
      else if (art === 'einstellungen' && typeof global.pullCashMeasureSettings === 'function') global.pullCashMeasureSettings();
    },
    nachholen() { spaeterPruefen(500); },
  });
  global.KCDirekteLeitungMoneyButler = { version: '1.0.0', steht: leitung.steht, zustand: leitung.zustand, bestaetigungPruefen };
})(window);
