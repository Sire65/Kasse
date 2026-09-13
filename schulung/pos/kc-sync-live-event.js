// KC Sync Live-Monitor – gemeinsamer, bewusst "fire and forget" arbeitender Sender.
//
// Wird von app.js (Verkäufe/Stornos/Auszahlungen) und time-clock-pos.js (Kommen/Gehen)
// aufgerufen. Sendet an den lokal laufenden Kassen-Companion, der es an den Manager und von
// dort an alle offenen PC-Manager-Live-Monitor-Fenster weiterreicht - rein zur Anzeige, KEIN
// Archiv, die eigentliche Buchung läuft komplett unabhängig über den bestehenden, zuverlässigen
// Sync-Kanal.
//
// Absichtlich denkbar einfach gehalten: kein Warten auf die Antwort, kein Wiederholungsversuch,
// jeder Fehler wird stillschweigend verworfen. Ein fehlendes Live-Anzeige-Ereignis ist
// hinnehmbar, eine spürbar verzögerte Kassenbedienung wäre es nicht.
(function (global) {
  'use strict';
  const LIVE_EVENT_URL = (global.KC_SYNC_LIVE_EVENT_URL) || (global.KCSyncConnection?.buildUrl('/kc-sync-live-event')) || 'http://127.0.0.1:47391/kc-sync-live-event';

  // Echte Kopplung an tatsächlichen Datenverkehr (Befund: die LED zeigte bisher nur ein festes
  // Animationsmuster, keinen echten Zusammenhang zum Netzwerkverkehr). Wird an jeder Stelle
  // aufgerufen, an der TATSÄCHLICH eine Anfrage das Gerät verlässt - die LED blitzt dadurch
  // genau dann auf, wenn wirklich etwas gesendet wird, nicht nach einem festen Rhythmus. Die
  // anschließende poll()-Aktualisierung gleicht den Zählerstand sofort ab, damit dasselbe
  // Ereignis nicht Sekunden später bei der regulären Abfrage noch ein zweites Mal als "neue"
  // Aktivität erkannt und doppelt angezeigt wird.
  function markRealActivity() {
    global.KCSyncStatusLeds?.flickerActivityLed();
    setTimeout(() => { global.KCSyncStatusLeds?.poll({ silent: true }); }, 900);
  }

  // ---- Lebenszeichen ---------------------------------------------------------------------
  // BEFUND aus dem Betrieb: der Manager erfuhr nur dann von einer Kasse, wenn diese ein
  // Ereignis meldete - also praktisch erst nach dem ersten Verkauf. Bis dahin stand dort
  // "Noch nie verbunden", obwohl die Kasse laengst offen und angemeldet war. Eine
  // Verbindungsanzeige, die in Wahrheit den letzten Umsatz zeigt, ist irrefuehrend: am
  // Markttag steht jemand davor und weiss nicht, ob die Kasse angebunden ist.
  //
  // Deshalb meldet sich eine geoeffnete Kasse jetzt von sich aus alle 30 Sekunden. Das
  // Lebenszeichen ist als eigene Art gekennzeichnet, damit es im Live-Monitor nicht die
  // echten Verkaeufe ueberdeckt - es dient nur der Verbindungsanzeige.
  function sendeLebenszeichen() {
    try {
      sendLiveEvent('heartbeat', {
        registerId: global.KCSyncConnection?.config?.registerId || null,
        registerName: document.getElementById('registerName')?.textContent?.trim() || null,
        // KC System Check / Leitstand: nur technische Betriebsdaten, keine Bon-/Artikeldaten.
        programId: 'kc-marktkasse',
        version: global.__kcVersion || null,
        queueDepth: global.KCSyncNachreichen?.offene?.() ?? (() => {
          try { return JSON.parse(localStorage.getItem('kc_sync_offene_buchungen_v1') || '[]').length; }
          catch (e) { return null; }
        })(),
        offenSeit: startZeit,
      });
    } catch (e) { /* wie alle Live-Ereignisse: Fehler sind hinnehmbar */ }
  }
  const startZeit = new Date().toISOString();
  setTimeout(sendeLebenszeichen, 3000);      // gleich nach dem Start, damit man nicht 30s wartet
  setInterval(sendeLebenszeichen, 30000);

  function sendLiveEvent(type, payload) {
    try {
      markRealActivity();
      fetch(LIVE_EVENT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payload }),
        keepalive: true, // Anfrage darf auch überleben, falls die Seite direkt danach etwas anderes tut
      }).catch(() => { /* KC Sync nicht eingerichtet/nicht erreichbar - bewusst kein Fehler für die Kasse */ });
    } catch (e) { /* dito - niemals eine Ausnahme nach außen durchreichen */ }
  }

  global.KCSyncLiveEvent = { send: sendLiveEvent };

  // Zuverlässige Aufzeichnung über den echten KC-Sync-Kanal (Outbox, Wiederholung,
  // Duplikatschutz - alles bereits im Companion vorhanden). Anders als sendLiveEvent() oben
  // wird ein Fehlschlag hier NICHT stillschweigend verworfen: bei mehrfachem Scheitern bekommt
  // die Bedienperson eine sichtbare Warnung, da hier die eigentliche Buchung betroffen ist.
  const RECORD_EVENT_URL = (global.KC_SYNC_RECORD_EVENT_URL) || (global.KCSyncConnection?.buildUrl('/kc-sync-record-event')) || 'http://127.0.0.1:47391/kc-sync-record-event';
  // Sicherheitsebene 2: Nachrichtenverschlüsselung für den lokalen Tablet<->Kasse-Kanal - nur
  // aktiv, wenn ein Zugangs-Schlüssel vorhanden ist (WLAN-Mehrgeräte-Fall, wo tatsächlich ein
  // Netzwerk-Hop mit Mitlese-Risiko existiert). Im reinen Loopback-Fall (Windows-Rechner selbst)
  // bleibt es unverändert unverschlüsselt - dort gibt es kein Netzwerk, das mitlesen könnte.
  async function encryptPayload(payload, token) {
    const keyMaterial = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const key = await crypto.subtle.importKey('raw', keyMaterial, 'AES-GCM', false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify({ ts: Date.now(), payload }));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
    return { encrypted: true, iv: toB64(iv), data: toB64(cipher) };
  }

  // Warteschlange fuer noch nicht gesicherte Buchungen.
  //
  // BEFUND (Tiefenpruefung): frueher wurde dreimal binnen drei Sekunden versucht und dann
  // ENDGUELTIG aufgegeben. Der Verkauf blieb zwar auf dem Geraet - die Kassensumme stimmte -,
  // aber im Manager fehlte er fuer immer. Ein WLAN-Aussetzer von zehn Sekunden am Stand
  // reichte dafuer. Zeitbuchungen, Gutscheine und Abschluesse merken sich laengst, was noch
  // nicht angekommen ist; ausgerechnet die Verkaeufe taten es nicht.
  //
  // Jetzt wandert jede nicht bestaetigte Buchung in diese Warteschlange und wird weiter
  // nachgereicht, bis der Companion sie ausdruecklich bestaetigt. Der Companion erkennt
  // Dubletten an der Ereigniskennung, mehrfaches Melden ist also ungefaehrlich.
  const WARTESCHLANGE_KEY = 'kc_sync_offene_buchungen_v1';
  const liesWarteschlange = () => { try { return JSON.parse(localStorage.getItem(WARTESCHLANGE_KEY) || '[]'); } catch (e) { return []; } };
  const schreibWarteschlange = (liste) => {
    // Aeltestes zuerst verwerfen, falls der Speicher wirklich voll laufen sollte - dann lieber
    // die aeltesten Buchungen als gar keine neuen mehr annehmen.
    try { localStorage.setItem(WARTESCHLANGE_KEY, JSON.stringify(liste.slice(-500))); } catch (e) { /* Speicher voll */ }
  };
  function merkeOffen(type, payload) {
    const liste = liesWarteschlange();
    const kennung = payload?.id || payload?.bonNumber || payload?.bon || JSON.stringify(payload).slice(0, 60);
    if (liste.some((x) => x.kennung === kennung && x.type === type)) return;
    liste.push({ kennung, type, payload, seit: new Date().toISOString() });
    schreibWarteschlange(liste);
  }
  function hakeAb(type, payload) {
    const kennung = payload?.id || payload?.bonNumber || payload?.bon || JSON.stringify(payload).slice(0, 60);
    const liste = liesWarteschlange().filter((x) => !(x.kennung === kennung && x.type === type));
    schreibWarteschlange(liste);
  }
  // Regelmaessig nachreichen. Bewusst leise: am Stand soll niemand ein Fenster wegklicken
  // muessen, waehrend die Schlange wartet - sichtbar wird es nur ueber die Statuszeile und
  // die Startklar-Pruefung, die die offenen Buchungen ausweist.
  async function reicheNach() {
    const liste = liesWarteschlange();
    if (!liste.length) return 0;
    let erfolgreich = 0;
    for (const eintrag of liste.slice(0, 20)) {
      const ok = await sendeEinmal(eintrag.type, eintrag.payload);
      if (!ok) break;                       // Verbindung weiterhin weg - spaeter erneut
      hakeAb(eintrag.type, eintrag.payload);
      erfolgreich += 1;
    }
    if (erfolgreich && typeof window.setSystemHint === 'function') {
      window.setSystemHint(`${erfolgreich} nachgereichte Buchung(en) gesichert`);
    }
    return erfolgreich;
  }
  setInterval(reicheNach, 30000);
  setTimeout(reicheNach, 8000);
  global.KCSyncNachreichen = { reicheNach, offene: () => liesWarteschlange().length };

  // Ein einzelner Sendeversuch. Gibt true zurueck, wenn der Companion die Uebernahme
  // ausdruecklich bestaetigt hat - alles andere gilt als nicht angekommen.
  async function sendeEinmal(type, payload) {
    const token = global.KCSyncConnection?.config?.token;
    let body;
    try {
      body = token ? JSON.stringify(await encryptPayload({ type, payload }, token)) : JSON.stringify({ type, payload });
    } catch (e) {
      body = JSON.stringify({ type, payload });
    }
    try {
      const antwort = await fetch(RECORD_EVENT_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
        signal: AbortSignal.timeout(5000),
      });
      const ergebnis = await antwort.json().catch(() => null);
      return ergebnis?.recorded === true;
    } catch (e) { return false; }
  }

  async function recordReliableEvent(type, payload, attempt = 1) {
    // Kein separates markRealActivity() hier: sendLiveEvent() (siehe completeSale()-Aufrufe)
    // feuert für denselben Vorgang bereits und würde sonst ein zweites, dicht aufeinander
    // folgendes Aufblitzen erzeugen - für den Bediener nicht als zwei unterschiedliche
    // Ereignisse erkennbar, wirkt dann wieder wie ein künstliches Doppel-Blinken.
    const token = global.KCSyncConnection?.config?.token;
    let body;
    try {
      body = token ? JSON.stringify(await encryptPayload({ type, payload }, token)) : JSON.stringify({ type, payload });
    } catch (e) {
      body = JSON.stringify({ type, payload }); // Verschlüsselung fehlgeschlagen - lieber unverschlüsselt senden als die Buchung ganz zu verlieren
    }
    // Sofort in die Warteschlange, DANN senden. Reihenfolge ist wichtig: bricht der Browser
    // mitten im Senden ab (Tablet gesperrt, Seite neu geladen), ist die Buchung trotzdem
    // vorgemerkt und wird nachgereicht.
    merkeOffen(type, payload);
    if (await sendeEinmal(type, payload)) { hakeAb(type, payload); return; }

    // Zwei schnelle Wiederholungen fuer den haeufigen Fall einer kurzen Stoerung.
    for (const wartezeit of [1000, 2000]) {
      await new Promise((f) => setTimeout(f, wartezeit));
      if (await sendeEinmal(type, payload)) { hakeAb(type, payload); return; }
    }

    // Weiterhin nicht durchgekommen: die Buchung BLEIBT in der Warteschlange und wird alle
    // 30 Sekunden erneut versucht. Frueher war an dieser Stelle Schluss und der Vorgang fuer
    // den Manager verloren.
    const offen = liesWarteschlange().length;
    if (typeof window.setSystemHint === 'function') {
      window.setSystemHint(`Sicherung gerade nicht erreichbar - ${offen} Buchung(en) werden automatisch nachgereicht`, 'warn');
    }
    if (typeof window.notify === 'function') {
      window.notify('warn', `Sicherung nicht erreichbar - ${offen} Buchung(en) warten und werden automatisch nachgereicht`, 'kc-sync-record-warteschlange', 12000);
    }
  }
  global.KCSyncLiveEvent.recordReliable = recordReliableEvent;

  // Leichtes Herzschlag-Signal für die Verbindungs-Ampel im PC Manager: zeigt "verbunden", auch
  // wenn gerade keine Verkäufe stattfinden - unabhängig vom eigentlichen Umsatzverkehr.
  //
  // Befund (User-Screenshot: LED-Gruppen im PC Manager blieben dauerhaft grau): hier wurde
  // bisher die sichtbare ANZEIGEBEZEICHNUNG ("Kasse 1") aus dem Kopfzeilentext gelesen - echte
  // Verkaufsereignisse senden aber die TECHNISCHE ID ("KASSE-01", state.master.registerId), die
  // auch als data-register-id an den LED-Gruppen hinterlegt ist. Beide passten nie zusammen,
  // der Herzschlag lief dadurch ins Leere.
  function registerIdFromHeader() {
    if (typeof state !== 'undefined' && state?.master?.registerId) return state.master.registerId;
    return document.getElementById('registerName')?.textContent?.trim() || null; // Rückfallweg, falls state (noch) nicht verfügbar ist
  }
  function erkenneGeraeteart() {
    const ua = navigator.userAgent || '';
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/Android/.test(ua)) return 'Android-Gerät';
    if (/Windows/.test(ua)) return 'Windows-Rechner';
    if (/Macintosh/.test(ua)) return 'Mac';
    return 'Unbekanntes Gerät';
  }
  function heartbeat() {
    const registerId = registerIdFromHeader();
    if (registerId) sendLiveEvent('heartbeat', { registerId, geraeteart: erkenneGeraeteart(), operator: (typeof state !== 'undefined' ? state?.master?.operatorName : null) || null });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { heartbeat(); setInterval(heartbeat, 15000); });
  } else {
    heartbeat(); setInterval(heartbeat, 15000);
  }
})(window);
