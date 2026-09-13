/* KC Kopfzeile im Aufbau: Reihenfolge, Uhr, Heartbeat-Herz, Verbindungsübersicht.    08.09.2026
 *
 * ANLASS (Betreiber, Sitzungsende): "Rechts mit der Tür losgehen, daneben Hamburger-Menü, dann
 * Ansicht wechseln, Uhr, Lautsprecher, Schloss, Programm abrufen, die drei LED-Blöcke, ein
 * kleines rotes Herz für den Heartbeat - Tipp darauf: Liste der letzten 20 Heartbeats. Tipp auf
 * die LEDs: Zusammenfassung der Verbindungen, Testknopf, Rundinstrumente für Geschwindigkeit
 * und ob alle Systeme richtig laufen."
 *
 * Gilt NUR im Aufbau (body.kc-aufbau). Die Reihenfolge macht CSS (order), die Uhr, das Herz und
 * die Übersicht baut diese Datei. Der Heartbeat misst denselben Status-Endpunkt wie die LEDs
 * (device-companion, nur 127.0.0.1) - ist kein KC-Sync-Dienst da, schlägt das Herz grau und
 * die Übersicht sagt es so; die Kasse selbst wird davon nie gestört.
 */
'use strict';
(function (global) {
  const VERSION = '0.1.0';
  const $ = (s, r) => (r || document).querySelector(s);
  const STATUS_URL = global.KC_SYNC_STATUS_URL || (global.KCSyncConnection && global.KCSyncConnection.buildUrl && global.KCSyncConnection.buildUrl('/kc-sync-status')) || 'http://127.0.0.1:47391/kc-sync-status';
  /* 08.09.2026 (Betreiber, vor dem Live-Test mit zwei iPads): Das Herz schlägt gegen den MANAGER
     (Port 47392, /health - die HTTPS-API nimmt ein Tablet-Browser nicht an) - der ist vom Tablet aus über das Netz erreichbar. Der
     Companion-Status (127.0.0.1) wird zusätzlich abgefragt, wenn die Kasse auf dem PC läuft. */
  /* Adresse des Managers: die gekoppelte Verbindung, sonst der Rechner, von dem die Kasse
     geladen wurde (Markttag-Start liefert sie über Port 8090 aus - derselbe PC wie der Manager). */
  const MANAGER_HOST = () => {
    const h = global.KCSyncConnection && global.KCSyncConnection.config && global.KCSyncConnection.config.host;
    if (h && h !== '127.0.0.1' && h !== 'localhost') return h;
    if (location.hostname && location.hostname !== 'localhost' && location.protocol !== 'file:') return location.hostname;
    return h || '127.0.0.1';
  };
  const MANAGER_URL = () => `http://${MANAGER_HOST()}:47392/health`;   /* Klartext-Sammelstelle des Managers */
  const TAKT_MS = 5000, LAGER = 'kc.heartbeat.v1', MAX = 20;
  let liste = [];
  try { liste = JSON.parse(localStorage.getItem(LAGER) || '[]') || []; } catch (e) { liste = []; }
  let letzterStatus = null, letzterManager = null, uhrenAbstandMs = null, timer = null, companion = { ok: false, ms: 0 }, manager = { ok: false, ms: 0 };

  function messen(url, mitJson) {
    const t0 = performance.now();
    const c = new AbortController(); const stop = setTimeout(() => c.abort(), 2500);
    const p = mitJson
      ? fetch(url, { signal: c.signal, cache: 'no-store' }).then((r) => r.ok ? r.json().catch(() => ({})) : Promise.reject(new Error('HTTP ' + r.status)))
      : fetch(url, { signal: c.signal, cache: 'no-store', mode: 'no-cors' }).then(() => ({}));
    return p.then((j) => ({ ok: true, ms: Math.round(performance.now() - t0), json: j }))
      .catch((e) => ({ ok: false, ms: Math.round(performance.now() - t0), grund: e && e.name === 'AbortError' ? 'Zeitüberschreitung' : 'nicht erreichbar' }))
      .finally(() => clearTimeout(stop));
  }
  /* Ein Herzschlag = eine Messung gegen den KASSEN-DIENST (Companion), so wie die LEDs es tun:
     den erreicht auch ein Tablet, weil die Kopplung genau über ihn läuft. Der Manager-Klartext-
     Port 47392 lauscht nur auf 127.0.0.1 - vom Tablet aus ist er NICHT erreichbar (08.09.,
     zweiter Anlauf; vorher schlug das Herz auf dem Tablet deshalb grau). Der Manager wird
     zusätzlich gemessen und erscheint als eigene Zeile, wenn er antwortet. */
  function schlag() {
    return messen(STATUS_URL, true).then((erg) => {
      if (erg.ok && erg.json) letzterStatus = erg.json;
      companion = erg;
      const eintrag = { zeit: new Date().toISOString(), ok: erg.ok, ms: erg.ms, grund: erg.grund };
      liste.push(eintrag); while (liste.length > MAX) liste.shift();
      try { localStorage.setItem(LAGER, JSON.stringify(liste)); } catch (e) { /* voll */ }
      herzPflegen();
      /* Manager nur nebenbei - vom Tablet aus normalerweise nicht erreichbar, kein Fehler */
      messen(MANAGER_URL(), true).then((m) => { manager = m; if (m.ok && m.json) { letzterManager = m.json; if (m.json.serverTime) uhrenAbstandMs = Date.parse(m.json.serverTime) - Date.now(); } });
      return eintrag;
    });
  }
  function start() { if (timer) return; schlag(); timer = setInterval(() => { if (document.body.classList.contains('kc-aufbau')) schlag(); }, TAKT_MS); }

  /* ------------------------------------------------------------------ Kopfzeile bauen */
  function kopfBauen() {
    const status = $('.header-status'); if (!status) return;
    if (!$('#kcKopfUhr')) {
      const uhr = document.createElement('span'); uhr.id = 'kcKopfUhr'; uhr.className = 'kc-kopf-uhr'; status.appendChild(uhr);
      const tick = () => { uhr.textContent = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); };
      tick(); setInterval(tick, 15000);
    }
    if (!$('#kcHerz')) {
      const h = document.createElement('button'); h.type = 'button'; h.id = 'kcHerz'; h.className = 'kc-herz'; h.title = 'Heartbeat - Tipp: die letzten 20';
      h.innerHTML = '<span aria-hidden="true">♥</span>'; h.addEventListener('click', () => herzListe(true));
      /* Im kompakten Aufbau-Kopf gehört das Herz in die zweite Zeile neben Logo und LEDs */
      status.appendChild(h);
    }
    /* Die LED-Blöcke bekommen einen Tipp-Bereich (die Spans selbst haben keine Klickfunktion) */
    /* Runde 4: der Aufbau haengt die LED-Bloecke um, bevor dieser Anschluss dran war - deshalb
       jetzt eine Weiterleitung am Dokument, die immer greift. */
    if (!document.body.dataset.kcLedTipp) {
      document.body.dataset.kcLedTipp = '1';
      document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('#kcLedBlock')) uebersicht(true); });
    }
    document.querySelectorAll('#kcLedBlock').forEach((g) => { g.style.cursor = 'pointer'; g.dataset.kcTipp = '1'; });
    herzPflegen();
  }
  function herzPflegen() {
    const h = $('#kcHerz'); if (!h) return;
    const l = liste[liste.length - 1];
    h.classList.toggle('lebt', !!(l && l.ok)); h.classList.toggle('tot', !!(l && !l.ok)); h.classList.toggle('unbekannt', !l);
    h.title = l ? `Heartbeat ${l.ok ? 'ok · ' + l.ms + ' ms' : 'fehlt · ' + l.grund}` : 'Heartbeat - noch keine Messung';
  }

  /* ------------------------------------------------------------------ Herz-Liste */
  let herzEbene = null;
  function herzListe(auf) {
    if (!herzEbene) {
      herzEbene = document.createElement('div'); herzEbene.id = 'kcHerzEbene'; herzEbene.className = 'kc-ebene'; herzEbene.hidden = true;
      herzEbene.innerHTML = '<div class="kc-ebene-kopf"><strong>♥ Heartbeat - die letzten 20</strong><button type="button" class="kc-ebene-zu">↩ ZURÜCK</button></div><div class="kc-ebene-inhalt"></div>';
      document.body.appendChild(herzEbene); $('.kc-ebene-zu', herzEbene).addEventListener('click', () => herzListe(false));
    }
    herzEbene.hidden = !auf; if (!auf) return;
    const inhalt = $('.kc-ebene-inhalt', herzEbene);
    inhalt.innerHTML = liste.length ? '<table class="kc-herz-tabelle"><tr><th>Zeit</th><th>Stand</th><th>Antwort</th></tr>' + [...liste].reverse().map((l) => `<tr class="${l.ok ? 'ok' : 'weg'}"><td>${new Date(l.zeit).toLocaleTimeString('de-DE')}</td><td>${l.ok ? '● ok' : '● ' + (l.grund || 'fehlt')}</td><td>${l.ms} ms</td></tr>`).join('') + '</table>' : '<p>Noch keine Messung.</p>';
  }

  /* ------------------------------------------------------------------ Verbindungsübersicht */
  let ueb = null;
  function tacho(id, titel, wert, max, einheit, gut) {
    /* Halbkreis-Instrument: 0 links, max rechts; Zeiger nach Wert; Farbe nach gut/schlecht */
    const w = Math.max(0, Math.min(1, max ? wert / max : 0)); const winkel = -90 + w * 180; const farbe = gut === null ? '#9ca3af' : (gut ? '#16a34a' : '#dc2626');
    return `<div class="kc-tacho" id="${id}"><svg viewBox="0 0 120 70"><path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="#e5e7eb" stroke-width="10"/><path d="M10 60 A50 50 0 0 1 ${60 + 50 * Math.cos(Math.PI * (1 - w))} ${60 - 50 * Math.sin(Math.PI * (1 - w))}" fill="none" stroke="${farbe}" stroke-width="10"/><line x1="60" y1="60" x2="60" y2="18" stroke="#111" stroke-width="3" transform="rotate(${winkel} 60 60)"/><circle cx="60" cy="60" r="4" fill="#111"/></svg><div class="kc-tacho-wert">${wert}${einheit}</div><div class="kc-tacho-titel">${titel}</div></div>`;
  }
  function uebersicht(auf) {
    if (!ueb) {
      ueb = document.createElement('div'); ueb.id = 'kcVerbindungEbene'; ueb.className = 'kc-ebene'; ueb.hidden = true;
      ueb.innerHTML = '<div class="kc-ebene-kopf"><strong>Verbindungen</strong><span><button type="button" id="kcVerbTest" class="kc-ebene-test">▶ TEST (5 Messungen)</button> <button type="button" class="kc-ebene-zu">↩ ZURÜCK</button></span></div><div class="kc-ebene-inhalt"></div>';
      document.body.appendChild(ueb); $('.kc-ebene-zu', ueb).addEventListener('click', () => uebersicht(false));
      $('#kcVerbTest', ueb).addEventListener('click', async () => {
        const b = $('#kcVerbTest', ueb); b.disabled = true;
        try { for (let i = 0; i < 5; i++) { b.textContent = `… misst ${i + 1}/5`; try { await schlag(); } catch (e) { /* Messfehler zählt als Ausfall */ } zeichnen(); } }
        finally { b.disabled = false; b.textContent = '▶ TEST (5 Messungen)'; }
      });
    }
    ueb.hidden = !auf; if (auf) zeichnen();
  }
  function zeichnen() {
    if (!ueb || ueb.hidden) return;
    const letzte = liste.slice(-10); const ok = letzte.filter((l) => l.ok); const quote = letzte.length ? Math.round(ok.length / letzte.length * 100) : 0;
    const ms = ok.length ? Math.round(ok.reduce((n, l) => n + l.ms, 0) / ok.length) : 0;
    const s = letzterStatus || {};
    const zeileFn = (k, v, gut) => `<div class="kc-verb-zeile ${gut === true ? 'gut' : gut === false ? 'schlecht' : ''}"><span>${k}</span><b>${v}</b></div>`;
    const dienst = liste.length && liste[liste.length - 1].ok;
    const mgr = manager.ok;
    /* Ampel des Kassen-Dienstes: online = mit dem Manager synchron */
    const ampel = String(s.ampel || s.status || s.state || (s.online === true ? 'online' : '') || '').toLowerCase();
    const managerUeberDienst = /online|gr|sync/.test(ampel) ? true : (/offline|rot/.test(ampel) ? false : null);
    const rueckstau = Number(s.queue || s.rueckstau || s.pending || 0);
    const drift = uhrenAbstandMs === null ? null : Math.round(uhrenAbstandMs / 1000);
    $('.kc-ebene-inhalt', ueb).innerHTML =
      '<div class="kc-tachos">' + tacho('kcTachoMs', 'Antwortzeit Kassen-Dienst', ms, 1000, ' ms', ok.length ? ms < 400 : null) + tacho('kcTachoQuote', 'Heartbeat-Quote', quote, 100, ' %', liste.length ? quote >= 90 : null) + tacho('kcTachoStau', 'Rückstau', rueckstau, 50, '', dienst ? rueckstau === 0 : null) + '</div>' +
      '<div class="kc-verb-liste">' +
      zeileFn('Kassen-Dienst (Companion, ' + STATUS_URL.replace(/^https?:\/\//, '').split('/')[0] + ')', dienst ? 'erreichbar · ' + liste[liste.length - 1].ms + ' ms' : 'nicht erreichbar - Kopplung prüfen', !!dienst) +
      zeileFn('Manager laut Kassen-Dienst', dienst ? (managerUeberDienst === null ? (ampel || 'unbekannt') : (managerUeberDienst ? 'online' : 'offline - Kasse arbeitet weiter')) : '-', dienst ? managerUeberDienst : null) +
      zeileFn('PC-Manager direkt (' + MANAGER_HOST() + ':47392)', mgr ? 'erreichbar' + (letzterManager && letzterManager.managerId ? ' · ' + letzterManager.managerId : '') : 'nicht erreichbar (vom Tablet normal, lauscht nur am PC)', mgr ? true : null) +
      zeileFn('Uhren Kasse ↔ Manager', drift === null ? '-' : (Math.abs(drift) < 2 ? 'gleich' : (drift > 0 ? 'Manager ' + drift + ' s voraus' : 'Kasse ' + (-drift) + ' s voraus')), drift === null ? null : Math.abs(drift) < 60) +
      zeileFn('Letzter Heartbeat', liste.length ? new Date(liste[liste.length - 1].zeit).toLocaleTimeString('de-DE') + (liste[liste.length - 1].ok ? ' · ' + liste[liste.length - 1].ms + ' ms' : ' · ' + liste[liste.length - 1].grund) : '-', null) +
      zeileFn('Endpunkte', STATUS_URL.split('?')[0] + ' · ' + MANAGER_URL(), null) +
      (letzterStatus ? `<details><summary>Rohdaten des Dienstes</summary><pre>${JSON.stringify(letzterStatus, null, 1).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</pre></details>` : '') +
      '</div>';
  }

  function anlegen() {
    if (!document.body.classList.contains('kc-aufbau')) return;
    kopfBauen(); start();
  }
  /* Der Aufbau hängt die Kopfzeile um - danach neu ansetzen. */
  new MutationObserver(() => anlegen()).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', anlegen); else anlegen();

  global.KCKopfzeile = { version: VERSION, schlag, liste: () => liste.slice(), herzListe, uebersicht };
})(window);
