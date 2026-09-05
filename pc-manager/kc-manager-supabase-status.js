// KC PC-Manager – Supabase-Verbindungsanzeige in der Kopfzeile, im selben Stil wie die
// bestehenden Kassen-LEDs (Status+Aktivität-Paar) aus kc-live-monitor.js. Eigene Datei, damit
// die bestehende, bereits mehrfach geprüfte Live-Monitor-Logik unangetastet bleibt.
(function (global) {
  'use strict';

  const SUPABASE_URL = 'https://ptblnpiroqftcvlsrhac.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_SqXIeGN-clcZ4gjmpLdSww_4DLfyy24';
  const ORG_ID = 'KC_WERNE';
  const PROJECT_ID = 'KC_MANAGER';
  const STORAGE_KEY = 'kc_manager_supabase_session_v1';

  let session = null;
  try { session = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { /* ignorieren */ }
  let letzterVerbindungsStatus = 'unbekannt'; // 'ok' | 'kein-login' | 'nicht-erreichbar' | 'unbekannt'

  function accessToken() { return session?.access_token || null; }

  // Ruft eine Postgres-Funktion über die normale Supabase-REST-Schnittstelle auf (kein
  // zusätzliches supabase-js nötig, passt zum bestehenden Stil des restlichen PC-Managers,
  // der überall mit einfachem fetch() arbeitet statt mit einer zusätzlichen Bibliothek).
  async function tokenErneuern() {
    if (!session?.refresh_token) throw new Error('kein_refresh_token');
    const antwort = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    const daten = await antwort.json();
    if (!antwort.ok) throw new Error(daten?.error_description || daten?.msg || 'Erneuerung fehlgeschlagen');
    session = daten;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch (e) { /* Speicher evtl. voll */ }
  }

  async function rufeFunktionAuf(name, argumente) {
    const versuch = async () => {
      const kopf = { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY };
      kopf.Authorization = 'Bearer ' + (accessToken() || SUPABASE_ANON_KEY);
      const antwort = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
        method: 'POST', headers: kopf, body: JSON.stringify(argumente),
      });
      const daten = await antwort.json().catch(() => null);
      if (!antwort.ok) { const fehler = new Error(daten?.message || `Fehler ${antwort.status}`); fehler.istAbgelaufen = /jwt expired|invalid jwt/i.test(daten?.message || ''); throw fehler; }
      return daten;
    };
    try {
      return await versuch();
    } catch (e) {
      // Zugangs-Token abgelaufen (normal nach einer Weile) - einmal automatisch erneuern und
      // erneut versuchen, statt die Person zur erneuten Anmeldung zu zwingen.
      if (e.istAbgelaufen && session?.refresh_token) {
        await tokenErneuern();
        return await versuch();
      }
      throw e;
    }
  }

  async function anmelden(email, passwort) {
    const antwort = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password: passwort }),
    });
    const daten = await antwort.json();
    if (!antwort.ok) throw new Error(daten?.error_description || daten?.msg || 'Anmeldung fehlgeschlagen');
    session = daten;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch (e) { /* Speicher evtl. voll */ }
    return daten;
  }

  function abmelden() {
    session = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignorieren */ }
    aktualisiereStatusLed();
  }

  // --- LED-Gruppe in der Kopfzeile, im selben .header-meta-Bereich wie die Kassen-LEDs ---
  function ledGruppeContainer() {
    let el = document.getElementById('kcSupabaseLedGroup');
    if (!el) {
      const meta = document.querySelector('.header-meta');
      if (!meta) return null;
      el = document.createElement('div');
      el.id = 'kcSupabaseLedGroup';
      el.className = 'kc-live-led-group';
      el.style.cursor = 'pointer';
      el.setAttribute('aria-live', 'polite');
      el.innerHTML = '<span class="kc-live-led-group-label">Supabase</span><span class="kc-live-led-pair"><span class="kc-live-led kc-live-led-status" id="kcSupabaseStatusLed"></span><span class="kc-live-led kc-live-led-activity" id="kcSupabaseActivityLed"></span></span>';
      el.addEventListener('click', zeigeSupabaseInfo);
      meta.appendChild(el);
    }
    return el;
  }

  function aktualisiereStatusLed() {
    const led = document.getElementById('kcSupabaseStatusLed');
    if (!led) return;
    led.classList.remove('kc-live-gruen', 'kc-live-gelb', 'kc-live-rot');
    if (letzterVerbindungsStatus === 'ok') { led.classList.add('kc-live-gruen'); led.title = 'Verbunden und angemeldet'; }
    else if (letzterVerbindungsStatus === 'kein-login') { led.classList.add('kc-live-gelb'); led.title = 'Erreichbar, aber nicht angemeldet'; }
    else if (letzterVerbindungsStatus === 'nicht-erreichbar') { led.classList.add('kc-live-rot'); led.title = 'Nicht erreichbar'; }
    else { led.title = 'Verbindung noch nicht geprüft'; }
  }

  function blitzeAktivitaetsLed() {
    const led = document.getElementById('kcSupabaseActivityLed');
    if (!led) return;
    led.classList.remove('kc-live-aktiv'); void led.offsetWidth; led.classList.add('kc-live-aktiv');
  }

  // Leiser Verbindungscheck im Hintergrund - ruft die einfache connection_probe-Funktion auf,
  // schreibt/löscht nichts, dient nur der Ampel.
  async function pruefeVerbindungLeise() {
    if (!accessToken()) { letzterVerbindungsStatus = 'kein-login'; aktualisiereStatusLed(); return; }
    try {
      await rufeFunktionAuf('kc_manager_connection_probe', { p_org_id: ORG_ID, p_project_id: PROJECT_ID });
      letzterVerbindungsStatus = 'ok';
      blitzeAktivitaetsLed();
    } catch (e) {
      letzterVerbindungsStatus = 'nicht-erreichbar';
    }
    aktualisiereStatusLed();
  }

  // --- Info-Fenster, im selben Stil wie zeigeKasseninfo() ---
  function escLabel(s) { return String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
  const zeile = (label, wert) => `<div style="display:flex;justify-content:space-between;gap:16px;padding:5px 0;border-bottom:1px solid #eee;"><span style="color:#666;">${label}</span><span style="font-weight:700;text-align:right;">${wert}</span></div>`;

  // Rundinstrument im selben Stil wie die bereits bewährte Verkehrsanzeige im Live-Monitor -
  // zeigt eine Millisekunden-Antwortzeit als Nadelausschlag (0-500ms Skala, grün/gelb/rot).
  function zeichneRundinstrument(titel, millisekunden, fehler) {
    const anteil = fehler ? 1 : Math.min(1, millisekunden / 500);
    const winkel = -90 + anteil * 180;
    const farbe = fehler ? '#b91c1c' : millisekunden < 100 ? '#166534' : millisekunden < 300 ? '#b45309' : '#b91c1c';
    return `
      <div style="text-align:center;">
        <svg viewBox="0 0 140 84" width="140" height="84">
          <path d="M 14 70 A 56 56 0 0 1 126 70" fill="none" stroke="#e2e8f0" stroke-width="10" stroke-linecap="round"/>
          <path d="M 14 70 A 56 56 0 0 1 126 70" fill="none" stroke="${farbe}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${anteil * 175.9} 175.9"/>
          <line x1="70" y1="70" x2="${70 + 44 * Math.sin(winkel * Math.PI / 180)}" y2="${70 - 44 * Math.cos(winkel * Math.PI / 180)}" stroke="#1c2430" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="70" cy="70" r="4" fill="#1c2430"/>
        </svg>
        <div style="font-size:.82rem;color:#666;">${titel}</div>
        <div style="font-weight:800;color:${farbe};">${fehler ? 'Fehler' : millisekunden + ' ms'}</div>
      </div>`;
  }

  // Echter Schreib-Lese-Löschen-Test des lokalen Speichers (PC-Manager nutzt technisch
  // localStorage, nicht IndexedDB - erfüllt hier aber denselben Zweck: "funktioniert der
  // lokale Gerätespeicher gerade normal schnell").
  function testeLokalenSpeicher() {
    const start = performance.now();
    try {
      const schluessel = '__kc_speichertest__';
      localStorage.setItem(schluessel, 'x'.repeat(1000));
      const wert = localStorage.getItem(schluessel);
      localStorage.removeItem(schluessel);
      if (wert?.length !== 1000) throw new Error('unerwarteter Wert');
      return { fehler: false, ms: Math.max(1, Math.round(performance.now() - start)) };
    } catch (e) { return { fehler: true, ms: 0 }; }
  }

  function zeigeSupabaseInfo() {
    const alter = document.getElementById('kcSupabaseInfoOverlay');
    if (alter) alter.remove();
    const overlay = document.createElement('div');
    overlay.id = 'kcSupabaseInfoOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(7,17,31,.6);z-index:99996;display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:12px;padding:22px 26px;min-width:340px;max-width:90vw;box-shadow:0 10px 40px rgba(0,0,0,.3);';
    box.innerHTML = `
      <div style="font-size:1.2rem;font-weight:900;margin-bottom:12px;">Supabase-Anbindung</div>
      ${zeile('Projekt', escLabel(SUPABASE_URL.replace('https://', '').replace('.supabase.co', '')))}
      ${zeile('Bereich', 'KC PC-Manager (kc_manager_*)')}
      ${zeile('Angemeldet als', session?.user?.email ? escLabel(session.user.email) : '<span style="color:#b91c1c;">Nicht angemeldet</span>')}
      <div id="kcSupabaseLoginBereich" style="margin-top:10px;"></div>
      <div style="margin-top:14px;padding-top:10px;border-top:2px solid #eee;">
        <button type="button" id="kcSupabaseTestBtn" style="width:100%;padding:10px;font-weight:900;border-radius:8px;border:none;background:#1677b8;color:#fff;">Verbindung jetzt testen</button>
        <div id="kcSupabaseTestErgebnis" style="margin-top:10px;font-size:.95rem;"></div>
        <div id="kcSupabaseGaugeRow" style="display:flex;gap:14px;justify-content:center;margin-top:14px;"></div>
      </div>
      <button type="button" id="kcSupabaseInfoClose" style="margin-top:14px;width:100%;padding:10px;font-weight:900;border-radius:8px;border:none;background:#166534;color:#fff;">Schließen</button>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    document.getElementById('kcSupabaseInfoClose').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const loginBereich = document.getElementById('kcSupabaseLoginBereich');
    if (!session?.user) {
      loginBereich.innerHTML = `
        <label style="display:block;margin-bottom:6px;">E-Mail<input type="email" id="kcSupabaseEmail" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;"></label>
        <label style="display:block;margin-bottom:6px;">Passwort<input type="password" id="kcSupabasePasswort" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;"></label>
        <button type="button" id="kcSupabaseLoginBtn" style="width:100%;padding:8px;font-weight:700;border-radius:6px;border:1px solid #1677b8;background:#fff;color:#1677b8;">Anmelden</button>
        <div id="kcSupabaseLoginFehler" style="color:#b91c1c;margin-top:6px;font-size:.9rem;"></div>
      `;
      document.getElementById('kcSupabaseLoginBtn').addEventListener('click', async () => {
        const email = document.getElementById('kcSupabaseEmail').value.trim();
        const passwort = document.getElementById('kcSupabasePasswort').value;
        const fehlerFeld = document.getElementById('kcSupabaseLoginFehler');
        fehlerFeld.textContent = 'Wird angemeldet …';
        try { await anmelden(email, passwort); zeigeSupabaseInfo(); }
        catch (e) { fehlerFeld.textContent = e.message; }
      });
    } else {
      loginBereich.innerHTML = '<button type="button" id="kcSupabaseLogoutBtn" style="width:100%;padding:8px;font-weight:700;border-radius:6px;border:1px solid #b91c1c;background:#fff;color:#b91c1c;">Abmelden</button>';
      document.getElementById('kcSupabaseLogoutBtn').addEventListener('click', () => { abmelden(); zeigeSupabaseInfo(); });
    }

    document.getElementById('kcSupabaseTestBtn').addEventListener('click', async () => {
      const ergebnisFeld = document.getElementById('kcSupabaseTestErgebnis');
      const gaugeZiel = document.getElementById('kcSupabaseGaugeRow');
      ergebnisFeld.textContent = 'Prüfe Verbindung …';
      const speicherErgebnis = testeLokalenSpeicher();
      if (!accessToken()) {
        ergebnisFeld.innerHTML = '<span style="color:#b91c1c;">Bitte zuerst anmelden.</span>';
        gaugeZiel.innerHTML = zeichneRundinstrument('Supabase', 0, true) + zeichneRundinstrument('Lokaler Speicher', speicherErgebnis.ms, speicherErgebnis.fehler);
        return;
      }
      try {
        const nonce = 'test-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        const ergebnis = await rufeFunktionAuf('kc_manager_diagnostic_roundtrip', { p_org_id: ORG_ID, p_project_id: PROJECT_ID, p_nonce: nonce });
        const zeile = Array.isArray(ergebnis) ? ergebnis[0] : ergebnis;
        if (zeile?.ok) {
          ergebnisFeld.innerHTML = `<span style="color:#166534;">✓ ${escLabel(zeile.message)} (${zeile.latency_ms} ms)</span>`;
          letzterVerbindungsStatus = 'ok'; blitzeAktivitaetsLed(); aktualisiereStatusLed();
          gaugeZiel.innerHTML = zeichneRundinstrument('Supabase', Math.round(zeile.latency_ms), false) + zeichneRundinstrument('Lokaler Speicher', speicherErgebnis.ms, speicherErgebnis.fehler);
        } else {
          ergebnisFeld.innerHTML = `<span style="color:#b91c1c;">✗ ${escLabel(zeile?.message || 'Unerwartetes Ergebnis')}</span>`;
          gaugeZiel.innerHTML = zeichneRundinstrument('Supabase', 0, true) + zeichneRundinstrument('Lokaler Speicher', speicherErgebnis.ms, speicherErgebnis.fehler);
        }
      } catch (e) {
        ergebnisFeld.innerHTML = `<span style="color:#b91c1c;">✗ ${escLabel(e.message)}</span>`;
        letzterVerbindungsStatus = 'nicht-erreichbar'; aktualisiereStatusLed();
        gaugeZiel.innerHTML = zeichneRundinstrument('Supabase', 0, true) + zeichneRundinstrument('Lokaler Speicher', speicherErgebnis.ms, speicherErgebnis.fehler);
      }
    });
  }

  function init() {
    if (!ledGruppeContainer()) { setTimeout(init, 500); return; }
    aktualisiereStatusLed();
    pruefeVerbindungLeise();
    setInterval(pruefeVerbindungLeise, 30000);
  }

  global.KCSupabase = { rufeFunktionAuf, istAngemeldet: () => !!accessToken() };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
