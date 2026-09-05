// KC Sync Baustufe 4 – Status-/Aktivitäts-LEDs neben dem Hamburger-Menü.
//
// Fragt periodisch den lokalen, NUR auf 127.0.0.1 lauschenden Status-Server des
// device-companion-Prozesses ab (siehe device-companion/index.js, startLocalStatusServer) und
// zeigt zwei LEDs: die erste die Ampel (grün=online/synchronisiert, rot=Offlinebetrieb,
// gelb=Problem/Rückstau), die zweite blitzt kurz auf, wenn seit der letzten Abfrage lokal
// gespeichert oder über das Netzwerk gesendet wurde.
//
// Bewusst so gebaut, dass ein nicht laufender oder noch nicht eingerichteter KC-Sync-Dienst die
// Kasse NICHT beeinträchtigt: schlägt die Abfrage fehl (Dienst nicht gestartet, KC Sync noch
// nicht eingerichtet), wird das dezent als "kein KC-Sync-Dienst erreichbar" angezeigt (graue
// LED), niemals als Fehler, der die übrige Kassenbedienung stört.
(function (global) {
  'use strict';
  const VERSION = '0.2.0';
  const STATUS_URL = (global.KC_SYNC_STATUS_URL) || (global.KCSyncConnection?.buildUrl('/kc-sync-status')) || 'http://127.0.0.1:47391/kc-sync-status';
  const POLL_INTERVAL_MS = 4000;
  const RECONNECT_INTERVAL_MS = 1200;
  const FETCH_TIMEOUT_MS = 2500;

  let wrap = null, statusLed = null, activityLed = null, pollTimer = null, letzterVersuchErfolgreich = false;
  // Befund B4-M01 (Baustufe-4-LED-Prüfbericht): vorher ein kurzlebiger 2-Sekunden-Boolean, der
  // eine Aktivität verpassen konnte, die vollständig zwischen zwei Abfragen (alle 4 Sekunden)
  // begann und endete. Jetzt werden monotone Zähler verglichen - jede Änderung seit der letzten
  // Abfrage wird erkannt, unabhängig davon, wie kurz das zugrunde liegende Ereignis war.
  let lastSeenCounts = { localStorageWriteCount: 0, networkActivityCount: 0 };
  let firstPoll = true;

  function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
  }

  function setStatusLed(color, title) {
    if (!statusLed) return;
    statusLed.classList.remove('kc-led-gruen', 'kc-led-gelb', 'kc-led-rot');
    if (color) statusLed.classList.add('kc-led-' + color);
    statusLed.title = title || '';
  }

  function flickerActivityLed() {
    if (!activityLed) return;
    // Klasse kurz neu setzen, damit die CSS-Animation bei jedem Ereignis erneut abspielt
    // (dieselbe Klasse doppelt anzuwenden würde die Animation sonst nicht neu starten).
    activityLed.classList.remove('kc-led-aktiv');
    void activityLed.offsetWidth; // erzwingt Reflow, damit die entfernte Klasse wirklich "ankommt"
    activityLed.classList.add('kc-led-aktiv');
  }

  // Befund B4-M03: aktualisiert den für Hilfstechnologien zugänglichen Statustext auf dem
  // Container (role="status"), unabhängig von der rein visuellen Farbe der LEDs.
  function setAccessibleLabel(text) {
    if (wrap) wrap.setAttribute('aria-label', 'Sicherung: ' + text);
  }

  async function poll(options = {}) {
    try {
      const res = await fetchWithTimeout(STATUS_URL, FETCH_TIMEOUT_MS);
      if (!res.ok) throw new Error('status_' + res.status);
      const data = await res.json();
      const conn = data.connection || {};
      const colorMap = { gruen: 'gruen', gelb: 'gelb', rot: 'rot' };
      const text = beschreibung(conn);
      setStatusLed(colorMap[conn.color] || 'gelb', text);
      setAccessibleLabel(text);

      const conflictBanner = document.getElementById('kcSyncConflictBanner');
      if (conflictBanner) conflictBanner.style.display = data.multiDeviceConflict ? 'block' : 'none';

      const act = data.activity || {};
      const counts = {
        localStorageWriteCount: act.localStorageWriteCount || 0,
        networkActivityCount: act.networkActivityCount || 0,
      };
      if (!firstPoll && !options.silent) {
        const changed = counts.localStorageWriteCount !== lastSeenCounts.localStorageWriteCount
          || counts.networkActivityCount !== lastSeenCounts.networkActivityCount;
        if (changed) flickerActivityLed();
      }
      lastSeenCounts = counts;
      firstPoll = false;
      letzterVersuchErfolgreich = true; // egal ob grün/gelb - eine gültige Antwort kam an, kein Grund mehr für schnelle Wiederholungen
    } catch (err) {
      letzterVersuchErfolgreich = false;
      // KC Sync ist (noch) nicht eingerichtet oder der lokale Dienst läuft gerade nicht - das
      // ist ein normaler, erwartbarer Zustand (z.B. auf einer Kasse ohne KC Sync), keine Störung
      // der übrigen Kassenbedienung. Graue LED statt Rot, um "kein Dienst" von "Dienst läuft,
      // aber offline" zu unterscheiden.
      if (statusLed) {
        statusLed.classList.remove('kc-led-gruen', 'kc-led-gelb', 'kc-led-rot');
        statusLed.title = 'Datensicherung nicht erreichbar';
      }
      setAccessibleLabel('nicht erreichbar (Dienst läuft nicht oder ist nicht eingerichtet)');
    }
  }

  function beschreibung(conn) {
    const texte = {
      online_synchronisiert: 'Online und synchronisiert',
      status_veraltet: 'Status seit einiger Zeit nicht bestätigt',
      rueckstau: 'Rückstau: mehrere Ereignisse warten auf Übertragung',
      dead_letter_ereignisse_vorhanden: 'Es liegen dauerhaft ungültige Ereignisse vor, die Aufmerksamkeit brauchen',
      noch_kein_sync_versuch: 'Noch keine Synchronisation versucht',
      offline: 'Offlinebetrieb',
      unreachable: 'Datensicherung zurzeit unterbrochen',
      network_error: 'Offlinebetrieb: Netzwerkfehler',
      not_paired: 'Datensicherung noch nicht eingerichtet',
      credential_revoked: 'Zugang wurde vom Betreiber widerrufen - erneute Kopplung nötig',
    };
    // Ein technischer, nicht übersetzter Grund (z.B. eine seltene, konkrete Fehlermeldung) wird
    // NICHT roh angezeigt - stattdessen ein allgemein verständlicher Text mit demselben Sinn.
    return texte[conn.reason] || 'Offlinebetrieb';
  }

  function mount() {
    const header = document.querySelector('.header-status');
    const menuBtn = document.getElementById('menuBtn');
    if (!header || !menuBtn || document.getElementById('kcSyncStatusLeds')) return;

    // Mehrgeräte-Erkennung: gut sichtbares Warnbanner, falls ein anderes Gerät gerade auch
    // diese Kassen-Adresse nutzt - initial versteckt, wird bei Bedarf ein-/ausgeblendet.
    // WICHTIG: im normalen Seitenfluss (nicht "position:fixed"), damit es nichts anderes
    // überdeckt und dadurch blockiert - liegt als erstes Element ganz oben, schiebt den Rest
    // der Seite nach unten, statt darüber zu schweben.
    const conflictBanner = document.createElement('div');
    conflictBanner.id = 'kcSyncConflictBanner';
    conflictBanner.setAttribute('role', 'alert');
    conflictBanner.style.cssText = 'display:none;background:#b91c1c;color:#fff;padding:10px 16px;font-weight:700;text-align:center;';
    conflictBanner.innerHTML = 'Achtung: Diese Kasse wird gerade auch von einem anderen Gerät verwendet! <button type="button" id="kcSyncReleaseSession" style="margin-left:10px;padding:4px 10px;font-weight:700;">Dieses Gerät abmelden</button>';
    document.body.insertBefore(conflictBanner, document.body.firstChild);
    document.getElementById('kcSyncReleaseSession').addEventListener('click', async () => {
      const releaseUrl = (global.KC_SYNC_RELEASE_URL) || (global.KCSyncConnection?.buildUrl('/kc-sync-release-session')) || 'http://127.0.0.1:47391/kc-sync-release-session';
      try { await fetch(releaseUrl, { method: 'POST' }); } catch (e) { /* egal - Banner blendet sich beim naechsten eigenen Poll ohnehin wieder aus */ }
      conflictBanner.style.display = 'none';
    });

    wrap = document.createElement('div');
    wrap.id = 'kcSyncStatusLeds';
    wrap.className = 'kc-sync-status-leds';
    // Befund B4-M03 (Baustufe-4-LED-Prüfbericht): vorher komplett aria-hidden - der Status war
    // nur über Farbe und Maus-Tooltip erreichbar, für Touchbedienung und Screenreader nicht
    // zugänglich. role="status" mit laufend aktualisiertem aria-label macht den Zustand jetzt
    // zugänglich, ohne dass sich am optischen Erscheinungsbild der LEDs etwas ändert - die
    // beiden Kreise selbst bleiben aria-hidden (rein dekorativ), der Text sitzt auf dem
    // umschließenden Container.
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-live', 'polite');
    wrap.setAttribute('aria-label', 'Sicherung: Status wird geladen');

    statusLed = document.createElement('span');
    statusLed.className = 'kc-sync-led kc-sync-led-status';
    statusLed.setAttribute('aria-hidden', 'true');
    statusLed.title = 'Sicherung: Status wird geladen …';

    activityLed = document.createElement('span');
    activityLed.className = 'kc-sync-led kc-sync-led-activity';
    activityLed.setAttribute('aria-hidden', 'true');
    activityLed.title = 'Speicherung und Sicherung';

    wrap.appendChild(statusLed);
    wrap.appendChild(activityLed);
    header.insertBefore(wrap, menuBtn);

    // Ganz ohne Entwicklerwerkzeuge nutzbare Rücksetzen-Funktion: Antippen der Ampel-LED bietet
    // - aber NUR solange sie nicht grün ist, um versehentliches Zurücksetzen bei funktionierender
    // Verbindung zu vermeiden - eine einfache Bestätigung an, um einen möglicherweise veralteten
    // gespeicherten Verbindungsstand zurückzusetzen und die Seite neu zu laden.
    statusLed.style.cursor = 'pointer';
    statusLed.setAttribute('role', 'button');
    statusLed.setAttribute('tabindex', '0');
    const resetVerbindung = () => {
      if (statusLed.classList.contains('kc-led-gruen')) return; // funktioniert bereits, kein Grund zurückzusetzen
      if (!confirm('KC-Sync-Verbindung zurücksetzen und Seite neu laden?\n\nHilft, wenn die Kasse trotz gültiger Adresse "nicht erreichbar" meldet - z. B. nach einer neuen Einrichtung.')) return;
      try { localStorage.removeItem('kc_sync_connection_v1'); } catch (e) { /* Speicher evtl. deaktiviert - Neuladen hilft trotzdem nichts, aber schadet nicht */ }
      location.reload();
    };
    statusLed.addEventListener('click', resetVerbindung);
    statusLed.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); resetVerbindung(); } });

    poll();
    scheduleNextPoll();
  }

  // Solange keine Verbindung besteht, schneller erneut versuchen (1,2s) statt den vollen
  // 4-Sekunden-Rhythmus abzuwarten - macht einen Wiederverbindungsversuch spürbar schneller.
  // Sobald verbunden (grün), auf den ruhigeren Standardrhythmus zurückschalten.
  function scheduleNextPoll() {
    if (pollTimer) clearTimeout(pollTimer);
    const delay = letzterVersuchErfolgreich ? POLL_INTERVAL_MS : RECONNECT_INTERVAL_MS;
    pollTimer = setTimeout(async () => { await poll(); scheduleNextPoll(); }, delay);
  }

  function stop() {
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  global.KCSyncStatusLeds = { version: VERSION, poll, stop, flickerActivityLed };
})(window);
