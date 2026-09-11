// KC Money Butler - Supabase-Anmeldung, damit der Kassenwart Geldübergaben direkt in die
// zentrale Finance Bridge schreiben oder eine informative E-Mail über KC Communication
// verschicken kann (siehe kc-money-butler-versand.js).
//
// BEWUSST EINFACHER als die Anmeldung im PC-Manager (kc-manager-supabase-status.js): kein
// LED-System, keine Verbindungsdiagnose - Money Butler ist eine kleine, eigenständige App,
// hier reicht ein schlichtes Anmeldeformular mit Status. Dieselbe Grundmechanik (Token
// speichern, bei Bedarf erneuern) ist unveraendert übernommen, damit sich beide Programme
// gegenüber Supabase gleich verhalten.
(function (global) {
  'use strict';
  const SUPABASE_URL = 'https://ptblnpiroqftcvlsrhac.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_SqXIeGN-clcZ4gjmpLdSww_4DLfyy24';
  const STORAGE_KEY = 'kc_money_butler_supabase_session_v1';
  const el = (id) => document.getElementById(id);

  let session = null;
  try { session = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { /* ignorieren */ }

  function accessToken() { return session?.access_token || null; }

  async function tokenErneuern() {
    if (!session?.refresh_token) throw new Error('kein_refresh_token');
    const antwort = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    const daten = await antwort.json();
    if (!antwort.ok) throw new Error(daten?.error_description || daten?.msg || 'Erneuerung fehlgeschlagen');
    session = daten;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch (e) { /* Speicher evtl. voll */ }
  }

  async function anmelden(email, passwort) {
    const antwort = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
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
    zeichneStatus();
  }

  function zeichneStatus() {
    const feld = el('mbSupabaseStatus');
    if (!feld) return;
    if (accessToken()) {
      feld.innerHTML = `<span class="mb-supabase-ok">✓ Angemeldet bei KC Communication</span> <button type="button" id="mbSupabaseAbmelden">Abmelden</button>`;
      el('mbSupabaseAbmelden')?.addEventListener('click', abmelden);
      if (el('mbSupabaseForm')) el('mbSupabaseForm').hidden = true;
    } else {
      feld.innerHTML = '';
      if (el('mbSupabaseForm')) el('mbSupabaseForm').hidden = false;
    }
  }

  function starten() {
    if (!el('mbSupabaseAnmelden')) return;
    zeichneStatus();
    el('mbSupabaseAnmelden').addEventListener('click', async () => {
      const email = el('mbSupabaseEmail')?.value.trim(), passwort = el('mbSupabasePasswort')?.value;
      const meldung = el('mbSupabaseMeldung');
      if (!email || !passwort) { if (meldung) meldung.textContent = 'Bitte E-Mail und Passwort eingeben.'; return; }
      try {
        await anmelden(email, passwort);
        if (meldung) meldung.textContent = '';
        zeichneStatus();
      } catch (err) {
        if (meldung) meldung.textContent = `Anmeldung fehlgeschlagen: ${err.message}`;
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', starten);
  else starten();

  // Dieselbe kleine Schnittstelle wie beim PC-Manager (KCSupabase), damit die
  // KC-Communication-Bausteine unveraendert bleiben und einfach getAccessToken darauf zeigen
  // koennen.
  global.KCMoneyButlerSupabase = {
    istAngemeldet: () => !!accessToken(),
    holeZugriffsToken: async () => {
      if (!accessToken()) return null;
      // Ablaufzeit grob pruefen (Supabase-Tokens sind JWTs mit exp-Feld) - lieber einmal zu
      // frueh erneuern als mit einem gerade abgelaufenen Token scheitern.
      try {
        const payload = JSON.parse(atob(session.access_token.split('.')[1]));
        if (payload.exp && payload.exp * 1000 < Date.now() + 30000) await tokenErneuern();
      } catch (e) { /* Token nicht lesbar - unveraendert versuchen, Fehler kommt dann vom Server */ }
      return accessToken();
    },
  };
  // 10.09.2026 (Betreiber: "beide sollen zu 100% gleich sein"): dieselbe Schnittstelle
  // zusaetzlich unter dem Namen, den kc-finance-uebergaben.js erwartet (dort "KCSupabase",
  // vom PC-Manager uebernommen) - so laesst sich diese Datei unveraendert auch hier verwenden,
  // statt eine zweite, eigene Fassung zu bauen.
  global.KCSupabase = global.KCMoneyButlerSupabase;
})(window);
