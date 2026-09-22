// Anwesenheits-LED fuer die Bedienerliste (operatorList) - je Pseudonym eine Ampel.
//
// DATENWEG (bewusst wie die anderen echten Sync-Wege - Ausverkauft/Fernbefehle - und NICHT
// wie die bisherige Zeiterfassungs-Meldung, die noch ueber den reinen Loopback-Kanal 47392
// lief und deshalb von einem echten Tablet im WLAN nie ankam): die Kasse fragt ihren EIGENEN,
// lokalen Companion (kc-sync-connection.js, Port 47391), der wiederum ueber den angemeldeten,
// verschluesselten Kanal beim Manager nachfragt. Ist gar kein Companion erreichbar (kein
// Netz, oder Schulungsversion, die sich absichtlich nie koppelt), faellt die Ampel auf die
// EIGENEN, lokal gespeicherten Stempel-Ereignisse dieser einen Kasse zurueck - zeigt dann nur,
// was an DIESER Kasse gestempelt wurde, nicht kassenuebergreifend. Genau die vom Betreiber
// gewuenschte Abstufung ("ohne Netzwerk nur lokal, mit Netzwerk aus dem PC-Manager").
//
// AMPEL (bewusst nur drei Farben, wie vom Betreiber gewuenscht):
//   gruen - aktuell eingecheckt (offenes "Kommen", core.summarize().present)
//   gelb  - seit sehr langer Zeit eingecheckt (> GELB_STUNDEN), vermutlich vergessenes
//           Auschecken - der aus dem Dienstplan-Export bekannte "Luecke"-Fall
//   rot   - kein offenes "Kommen" (nie gestempelt oder schon wieder gegangen)
(function (global) {
  'use strict';
  const core = global.KCTimeClockCore;
  if (!core) return;
  const GELB_STUNDEN = 9; // laenger als ein normaler Markttag ohne Checkout = vermutlich vergessen
  const POLL_MS = 20000;
  const LOCAL_EVENTS_KEY = 'kc_time_clock_events_v1';

  let statusMap = new Map(); // personId -> {farbe, present, openSince}
  let quelle = 'lokal'; // 'zentral' | 'lokal'
  const listeners = [];

  const URL_TEAM_STATUS = (global.KCSyncConnection?.buildUrl('/kc-sync-team-status')) || 'http://127.0.0.1:47391/kc-sync-team-status';

  function localEvents() {
    try { return JSON.parse(localStorage.getItem(LOCAL_EVENTS_KEY) || '[]'); }
    catch (e) { return []; }
  }

  // Dieselbe Bedienerliste wie die Kasse (Pseudonyme, aus app.js) - eine eigene Personenliste
  // braucht die Ampel dafuer nicht, die Zuordnung laeuft ueber dieselbe id (kc-0007 usw.).
  function localPeople() {
    try { return typeof global.normalizeOperatorProfiles === 'function' ? global.normalizeOperatorProfiles() : []; }
    catch (e) { return []; }
  }

  function farbeFuer(row) {
    if (!row || !row.present) return 'rot';
    const stunden = (Date.now() - new Date(row.openSince).getTime()) / 3600000;
    return stunden > GELB_STUNDEN ? 'gelb' : 'gruen';
  }

  function baueStatus(events) {
    const summary = core.summarize(events || [], localPeople());
    const map = new Map();
    summary.forEach((row) => map.set(row.personId, { farbe: farbeFuer(row), present: row.present, openSince: row.openSince }));
    return map;
  }

  // Eigenes Ereignis STATT nur der listeners-Liste: dieses Skript laedt NACH app.js (siehe
  // index.html-Ladereihenfolge), ein direktes window.KCTeamPraesenz.onUpdate(...) in app.js
  // liefe zum Zeitpunkt seines Aufrufs also ins Leere. addEventListener kennt dieses Problem
  // nicht - es funktioniert unabhaengig davon, welches der beiden Skripte zuerst da war.
  function melde() {
    listeners.forEach((fn) => { try { fn(); } catch (e) { /* eine defekte Anzeige darf die anderen nicht mitreissen */ } });
    try { global.dispatchEvent(new CustomEvent('kc-team-praesenz-update')); } catch (e) { /* sehr alte Browser ohne CustomEvent - Ampel bleibt dann auf dem letzten Stand */ }
  }

  async function aktualisiere() {
    try {
      const res = await fetch(URL_TEAM_STATUS, { cache: 'no-store' });
      if (!res.ok) throw new Error('team-status-' + res.status);
      const daten = await res.json();
      const events = Array.isArray(daten?.ereignisse) ? daten.ereignisse : [];
      // Ein leeres Ergebnis ist nicht automatisch "kein Manager da" - kann auch bedeuten, dass
      // heute noch niemand gestempelt hat. Der eigene, lokale Companion antwortet in jedem Fall
      // mit 200; erst ein Netzwerkfehler (Companion selbst nicht erreichbar) loest den
      // Ruecksprung auf die rein lokalen Daten weiter unten aus.
      statusMap = baueStatus(events);
      quelle = 'zentral';
    } catch (e) {
      statusMap = baueStatus(localEvents());
      quelle = 'lokal';
    }
    melde();
  }

  global.KCTeamPraesenz = {
    farbe: (personId) => statusMap.get(personId)?.farbe || 'rot',
    quelle: () => quelle,
    aktualisieren: aktualisiere,
    onUpdate: (fn) => { if (typeof fn === 'function') listeners.push(fn); },
  };

  setTimeout(aktualisiere, 2000);
  setInterval(aktualisiere, POLL_MS);
})(window);
