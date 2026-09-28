/* KC TSE-Relay (Entwicklung / experimentell) - Kassenseite.                       27.09.2026
 *
 * ANLASS: Ab 2028 (ggf. frueher) muss jeder Verkauf von einer TSE signiert werden. Die TSE
 * (Swissbit-USB-Stick) steckt an einem Windows-Mini-PC am Stand; dort laeuft ein eigener Dienst
 * (NICHT Teil dieses Repos), der im WLAN Signieranfragen annimmt. Diese Datei ist NUR die
 * Kassenseite.
 *
 * WICHTIGSTE REGEL (Betreiber, woertlich): "Es darf unsere jetzige Kasse in keiner Weise
 * unbrauchbar machen." Deshalb:
 *   - Solange state.master.tseEntwicklungAktiv nicht === true ist, tut diese Datei NICHTS:
 *     kein Zeitgeber, keine Netzabfrage, kein Element im Kopfbereich.
 *   - Der Verkauf wartet nie auf den Mini-PC. signiereVorgang() startet die Anfrage und kehrt
 *     sofort zurueck; jeder fetch bricht nach 2 Sekunden ab.
 *   - Kein Fehler dieser Datei darf nach aussen durchschlagen (alles in try/catch).
 *
 * WARUM DIE SIGNATUR NICHT AM BON STEHT (mit dem Betreiber abgestimmt): Jeder Bon traegt eine
 * Pruefsumme ueber den GANZEN Datensatz (canonicalTransaction -> recordHash), die Ledger-Pruefung
 * rechnet sie nach. Ein nachtraeglich angehaengtes rec.tse wuerde dort als Manipulation gemeldet.
 * Die TSE-Ergebnisse liegen deshalb in einer eigenen Liste, zugeordnet ueber die transactionId.
 *
 * Speicher (localStorage, uebersteht Neustart):
 *   kc_tse_signaturen_v1  { [transactionId]: {status:"signiert", signatur, ...} | {status:"ausstehend", ...} }
 *   kc_tse_offen_v1       [ {transaktionId, kasseId, vorgangsart, startzeit, endzeit, betragCent, seit, versuche, letzterFehler} ]
 *   kc_tse_relay_token_v1 Passwort (Bearer-Token) fuer den Mini-PC - bewusst NICHT in state.master,
 *                         damit es nicht in Einstellungs-Exporte, Sync oder Backups wandert.
 *
 * Schnittstelle des Mini-PC-Dienstes (fest abgestimmt):
 *   GET  /health                          -> {ok, tseVerfuegbar, warteschlangeLaenge}
 *   POST /signieren (Bearer)              -> 200 {ok:true, signatur, signaturzaehler, transaktionsnummer, tseSeriennummer}
 *                                            503 {ok:false, grund:"tse_nicht_erreichbar", inWarteschlangeGestellt:true}
 *   GET  /warteschlange (Bearer)          -> {ok:true, offen:[uuid,...]}
 *   POST /warteschlange/verarbeiten (Bearer) -> {ok:true, verarbeitet, weiterhinOffen}
 */
'use strict';
(function (global) {
  const VERSION = '0.1.0';
  const LAGER_SIGNATUREN = 'kc_tse_signaturen_v1';
  const LAGER_OFFEN = 'kc_tse_offen_v1';
  const LAGER_TOKEN = 'kc_tse_relay_token_v1';
  const VORGANGSART = 'Kassenbeleg-V1';
  const TIMEOUT_MS = 2000;
  const TAKT_MS = 30000;
  const MAX_PRO_RUNDE = 20;

  let takt = null, laeuft = false, letzteRunde = null;

  // state ist in app.js eine globale const (klassisches Skript) - kein window-Eintrag, aber
  // aus anderen klassischen Skripten ueber den gemeinsamen globalen Namensraum erreichbar.
  function master() { try { return (typeof state !== 'undefined' && state && state.master) || null; } catch (e) { return null; } }
  function aktiv() { const m = master(); return !!m && m.tseEntwicklungAktiv === true; }
  function basisAdresse(ersatz) { const m = master(); return String((ersatz != null ? ersatz : m && m.tseRelayAdresse) || '').trim().replace(/\/+$/, ''); }

  function lesen(schluessel, ersatz) { try { const w = JSON.parse(localStorage.getItem(schluessel) || 'null'); return w == null ? ersatz : w; } catch (e) { return ersatz; } }
  function schreiben(schluessel, wert) { try { localStorage.setItem(schluessel, JSON.stringify(wert)); } catch (e) { console.warn('TSE-Relay: lokale Speicherung fehlgeschlagen', e); } }
  function token() { try { return localStorage.getItem(LAGER_TOKEN) || ''; } catch (e) { return ''; } }
  function setzeToken(wert) { try { const t = String(wert || '').trim(); if (t) localStorage.setItem(LAGER_TOKEN, t); else localStorage.removeItem(LAGER_TOKEN); } catch (e) { /* ohne Speicher kein Token */ } }

  function signaturen() { const s = lesen(LAGER_SIGNATUREN, {}); return s && typeof s === 'object' && !Array.isArray(s) ? s : {}; }
  function offene() { const o = lesen(LAGER_OFFEN, []); return Array.isArray(o) ? o : []; }
  function status(transaktionId) { return signaturen()[transaktionId] || null; }

  // fetch mit hartem Zeitlimit. Ein haengender Mini-PC darf die Kasse nie aufhalten.
  function anfrage(pfad, { methode = 'GET', body = null, mitToken = true, adresse = null } = {}) {
    const basis = basisAdresse(adresse);
    if (!basis) return Promise.reject(new Error('keine Relay-Adresse eingestellt'));
    const c = new AbortController();
    const uhr = setTimeout(() => c.abort(), TIMEOUT_MS);
    const kopf = { 'Accept': 'application/json' };
    if (body) kopf['Content-Type'] = 'application/json';
    if (mitToken) kopf['Authorization'] = 'Bearer ' + token();
    return fetch(basis + pfad, { method: methode, headers: kopf, body: body ? JSON.stringify(body) : undefined, signal: c.signal, cache: 'no-store' })
      .then((r) => r.json().catch(() => ({})).then((daten) => ({ http: r.status, daten: daten || {} })))
      .finally(() => clearTimeout(uhr));
  }

  function alsSigniert(id, daten) {
    const s = signaturen();
    s[id] = { status: 'signiert', signatur: daten.signatur, signaturzaehler: daten.signaturzaehler, transaktionsnummer: daten.transaktionsnummer, tseSeriennummer: daten.tseSeriennummer, signiertAm: new Date().toISOString() };
    schreiben(LAGER_SIGNATUREN, s);
    schreiben(LAGER_OFFEN, offene().filter((e) => e.transaktionId !== id));
  }
  const LAEUFT = 'Anfrage läuft';
  // Erstversuch direkt nach dem Verkauf: zaehlt noch nicht als offen (kein Aufblinken des
  // Hinweises bei jedem erfolgreichen Verkauf) und wird vom Takt nicht doppelt geschickt.
  function inArbeit(e) { return e.letzterFehler === LAEUFT && Date.now() - Date.parse(e.letzterVersuch || 0) < TIMEOUT_MS + 3000; }
  function alsAusstehend(anfrageDaten, grund, inRelayWarteschlange) {
    const id = anfrageDaten.transaktionId;
    const liste = offene();
    let eintrag = liste.find((e) => e.transaktionId === id);
    if (!eintrag) { eintrag = { ...anfrageDaten, seit: new Date().toISOString(), versuche: 0 }; liste.push(eintrag); }
    if (grund !== LAEUFT) eintrag.versuche = (eintrag.versuche || 0) + 1;
    eintrag.letzterFehler = String(grund || 'unbekannt').slice(0, 120);
    eintrag.letzterVersuch = new Date().toISOString();
    if (inRelayWarteschlange) eintrag.inRelayWarteschlange = true;
    schreiben(LAGER_OFFEN, liste);
    const s = signaturen();
    if (!s[id] || s[id].status !== 'signiert') { s[id] = { status: 'ausstehend', seit: eintrag.seit }; schreiben(LAGER_SIGNATUREN, s); }
  }

  // Eine /signieren-Anfrage. Liefert immer ein Promise, das NIE rejected.
  function signieren(anfrageDaten) {
    return anfrage('/signieren', { methode: 'POST', body: anfrageDaten }).then(({ http, daten }) => {
      if (http === 200 && daten.ok === true && daten.signatur) { alsSigniert(anfrageDaten.transaktionId, daten); return true; }
      alsAusstehend(anfrageDaten, daten.grund || ('HTTP ' + http), daten.inWarteschlangeGestellt === true);
      return false;
    }).catch((err) => {
      alsAusstehend(anfrageDaten, err && err.name === 'AbortError' ? 'Zeitüberschreitung' : (err && err.message) || 'nicht erreichbar', false);
      return false;
    }).then((ok) => { hinweisAktualisieren(); return ok; });
  }

  // Aufruf aus completeSale() - NACH dem vollstaendigen Abschluss, nicht awaited.
  function signiereVorgang(rec) {
    try {
      if (!aktiv() || !rec || !rec.transactionId || rec.training) return;
      const anfrageDaten = {
        transaktionId: rec.transactionId,
        kasseId: rec.registerId || (master() && master().registerId) || '',
        vorgangsart: VORGANGSART,
        startzeit: rec.startTime || rec.time,
        endzeit: rec.endTime || rec.time,
        betragCent: Number.isFinite(Number(rec.dueCents)) ? Number(rec.dueCents) : Math.round(Number(rec.due || 0) * 100)
      };
      // Sofort als "ausstehend" merken - geht die Kasse waehrend der Anfrage aus, ist der
      // Vorgang trotzdem auf der Nachtrage-Liste.
      alsAusstehend(anfrageDaten, LAEUFT, false);
      signieren(anfrageDaten);
    } catch (e) { console.warn('TSE-Relay: Vorgang konnte nicht angestossen werden', e); }
  }

  // Automatisches Nachtragen. Reihenfolge: Mini-PC erreichbar? -> dessen Warteschlange
  // verarbeiten lassen -> fuer jeden lokal offenen Vorgang /signieren erneut (die Signatur
  // selbst liefert nur /signieren). Vorgaenge, die der Dienst selbst noch als offen fuehrt,
  // werden in dieser Runde uebersprungen (TSE ist dann offensichtlich noch nicht bereit).
  async function nachtragen() {
    if (laeuft || !aktiv()) return letzteRunde;
    const liste = offene().filter((e) => !inArbeit(e));
    if (!liste.length) { hinweisAktualisieren(); return letzteRunde; }
    laeuft = true;
    const runde = { zeit: new Date().toISOString(), erreichbar: false, signiert: 0, offen: liste.length };
    try {
      const gesund = await anfrage('/health', { mitToken: false }).catch(() => null);
      runde.erreichbar = !!(gesund && gesund.daten && gesund.daten.ok === true);
      runde.tseVerfuegbar = !!(gesund && gesund.daten && gesund.daten.tseVerfuegbar === true);
      if (!runde.erreichbar || !runde.tseVerfuegbar) return runde;
      await anfrage('/warteschlange/verarbeiten', { methode: 'POST' }).catch(() => null);
      const ws = await anfrage('/warteschlange').catch(() => null);
      const nochImRelay = new Set(ws && ws.daten && Array.isArray(ws.daten.offen) ? ws.daten.offen : []);
      for (const eintrag of liste.slice(0, MAX_PRO_RUNDE)) {
        if (!aktiv()) break;
        if (nochImRelay.has(eintrag.transaktionId)) continue;
        const { seit, versuche, letzterFehler, letzterVersuch, inRelayWarteschlange, ...anfrageDaten } = eintrag;
        if (await signieren(anfrageDaten)) runde.signiert++;
      }
    } catch (e) {
      console.warn('TSE-Relay: Nachtragen fehlgeschlagen', e);
    } finally {
      laeuft = false;
      runde.offen = offene().length;
      letzteRunde = runde;
      hinweisAktualisieren();
    }
    return runde;
  }

  // Unaufdringlicher Hinweis im Kopfbereich - nur wenn eingeschaltet UND etwas offen ist.
  // Fest positioniert (styles.css), damit sich an der Anordnung der Kopfzeile nichts verschiebt.
  function hinweisAktualisieren() {
    try {
      const anzahl = aktiv() ? offene().filter((e) => !inArbeit(e)).length : 0;
      let knoten = document.getElementById('kcTseHinweis');
      if (!anzahl) { if (knoten) knoten.remove(); return; }
      if (!knoten) {
        const kopf = document.querySelector('.app-header');
        if (!kopf) return;
        knoten = document.createElement('span');
        knoten.id = 'kcTseHinweis';
        knoten.className = 'kc-tse-hinweis';
        knoten.setAttribute('role', 'status');
        kopf.appendChild(knoten);
        lageMitfuehren();
      }
      knoten.textContent = 'TSE ⏳ ' + anzahl;
      // Die Kopfzeile liegt je nach Layout an verschiedenen Stellen (klassisch oben ueber die
      // ganze Breite, im neuen Layout rechts oben). Der Hinweis haengt deshalb an ihrer
      // tatsaechlichen Lage: links unten in der Kopfzeile, ueber dem Rand des Logos.
      const r = kopfRechteck();
      if (r) { knoten.style.left = Math.round(r.left + 2) + 'px'; knoten.style.top = Math.round(r.bottom - knoten.offsetHeight - 1) + 'px'; }
      knoten.title = anzahl + ' Vorgang/Vorgänge noch ohne TSE-Signatur - wird automatisch nachgetragen (Entwicklung).';
    } catch (e) { /* reiner Hinweis */ }
  }

  function kopfRechteck() {
    const k = document.querySelector('.app-header');
    const r = k && k.getBoundingClientRect();
    return r && r.width > 0 && r.height > 0 ? r : null;
  }
  let lageBeobachter = false;
  function lageMitfuehren() {
    if (lageBeobachter) return; lageBeobachter = true;
    global.addEventListener('resize', () => { if (document.getElementById('kcTseHinweis')) hinweisAktualisieren(); });
  }

  // Zeitgeber nur, solange eingeschaltet. Wird beim Start und nach dem Speichern der
  // Einstellungen aufgerufen.
  function einstellungenGeaendert() {
    try {
      if (aktiv()) {
        if (!takt) takt = setInterval(nachtragen, TAKT_MS);
        setTimeout(nachtragen, 1500);
      } else if (takt) { clearInterval(takt); takt = null; }
      hinweisAktualisieren();
    } catch (e) { /* nie nach aussen */ }
  }

  // Nur fuer den Entwicklungsbereich in den Einstellungen.
  async function verbindungTesten(adresse) {
    try {
      const r = await anfrage('/health', { mitToken: false, adresse: adresse == null ? null : adresse });
      return { ok: r.daten.ok === true, http: r.http, tseVerfuegbar: r.daten.tseVerfuegbar === true, warteschlangeLaenge: r.daten.warteschlangeLaenge };
    } catch (e) {
      return { ok: false, fehler: e && e.name === 'AbortError' ? 'Zeitüberschreitung (2 s)' : (e && e.message) || 'nicht erreichbar' };
    }
  }

  // Knoepfe im Einstellungsbereich "TSE (Entwicklung)". Fehlen die Elemente, passiert nichts.
  function statusText() {
    const o = offene().length, s = signaturen(), signiert = Object.values(s).filter((e) => e && e.status === 'signiert').length;
    const r = letzteRunde ? ` · letzte Nachtrage-Runde ${new Date(letzteRunde.zeit).toLocaleTimeString('de-DE')}: ${letzteRunde.erreichbar ? (letzteRunde.tseVerfuegbar ? letzteRunde.signiert + ' nachgetragen' : 'TSE nicht verfügbar') : 'Mini-PC nicht erreichbar'}` : '';
    return `Signiert: ${signiert} · offen: ${o} · Passwort ${token() ? 'hinterlegt' : 'FEHLT'}${r}`;
  }
  function knoepfeVerdrahten() {
    const $ = (id) => document.getElementById(id);
    const test = $('tseRelayTestBtn'), nach = $('tseRelayNachtragenBtn'), aus = $('tseRelayStatus');
    if (!test || !nach || !aus) return;
    const zeigen = (text) => { aus.textContent = text; };
    test.onclick = async () => {
      zeigen('Teste Verbindung …');
      const eingabe = $('tseRelayAdresseSetting') ? $('tseRelayAdresseSetting').value : null;
      const r = await verbindungTesten(eingabe);
      zeigen((r.ok ? `✓ Mini-PC erreichbar · TSE ${r.tseVerfuegbar ? 'verfügbar' : 'NICHT verfügbar'} · Warteschlange ${r.warteschlangeLaenge ?? '?'}` : `✗ Nicht erreichbar (${r.fehler || 'HTTP ' + r.http})`) + ' · ' + statusText());
    };
    nach.onclick = async () => {
      if (!aktiv()) { zeigen('Schalter ist aus (bzw. noch nicht gespeichert) - es wird nichts nachgetragen. ' + statusText()); return; }
      zeigen('Trage nach …');
      await nachtragen();
      zeigen(statusText());
    };
    const tab = document.querySelector('[data-settings-tab="tse-entwicklung"]');
    if (tab) tab.addEventListener('click', () => zeigen(statusText()));
  }

  global.KCTseRelay = { VERSION, signiereVorgang, nachtragen, einstellungenGeaendert, verbindungTesten, offene, status, signaturen, setzeToken, hatToken: () => !!token(), letzteRunde: () => letzteRunde };
  try { knoepfeVerdrahten(); } catch (e) { /* nur Einstellungsbereich */ }
  einstellungenGeaendert();
})(window);
