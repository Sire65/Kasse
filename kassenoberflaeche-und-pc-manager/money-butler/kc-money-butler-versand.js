// KC Money Butler - zwei neue Versandwege zusätzlich zum bestehenden QR-Code/Datei-Weg (der
// bleibt unverändert):
// 1. "An PC Manager senden (Datenbank)" - schreibt direkt in die zentrale Finance Bridge
//    (Supabase), der PC Manager holt es von dort ab. Für den Fall "Kassenwart zuhause, kein
//    gemeinsames Netz mit dem Marktstand".
// 2. "Per E-Mail informieren" - schickt nur eine informative Nachricht über KC Communication,
//    OHNE etwas in die Finance Bridge zu schreiben - für den Fall, dass der Admin nur schnell
//    Bescheid wissen soll (Rückfall, falls Weg 1 gerade nicht genutzt werden kann oder soll).
//
// Beide lesen ihre Daten aus dem bereits erzeugten Übergabecode (currentPayload aus app.js) -
// keine eigene, zweite Dateneingabe, kein Risiko dass Datenbank-Eintrag und QR-Code
// auseinanderlaufen.
(function (global) {
  'use strict';
  const el = (id) => document.getElementById(id);
  const geld = (n) => Number(n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  function client() {
    if (!global.KCCommunicationClient) return null;
    return new global.KCCommunicationClient({
      sourceProgram: 'kc-money-butler',
      getAccessToken: async () => global.KCMoneyButlerSupabase?.holeZugriffsToken?.() || null,
    });
  }

  // Liest die STRUKTURIERTEN Daten aus dem bereits erzeugten Übergabecode (currentPayload,
  // Format "KCASH1:<Base64-JSON>") - derselbe Code, der auch im QR-Code steckt. Kein eigenes,
  // zweites Ablesen der Formularfelder, damit Datenbank/E-Mail und QR-Code niemals
  // auseinanderlaufen koennen.
  function aktuellePayloadDaten() {
    // WICHTIG: currentPayload ist in app.js mit "let" am Datei-Anfang deklariert - das macht
    // es NICHT zu einer window-Eigenschaft (anders als "var" das taete), ist aber trotzdem als
    // einfacher Bezeichner erreichbar, solange dieses Skript NACH app.js geladen wird (beide
    // sind klassische <script>-Tags, teilen sich denselben globalen Gueltigkeitsbereich fuer
    // "let"/"const"). Deshalb bewusst "currentPayload" direkt, NICHT "global.currentPayload".
    const roh = typeof currentPayload !== 'undefined' ? currentPayload : '';
    const trenner = roh.indexOf(':');
    if (trenner < 0) return null;
    try { return JSON.parse(decodeURIComponent(escape(atob(roh.slice(trenner + 1))))); } catch (e) { return null; }
  }

  function meldung(text, art = 'info') {
    const feld = el('mbVersandMeldung');
    if (feld) { feld.textContent = text; feld.className = `hint mb-versand-${art}`; }
  }

  el('mbSendeDatenbank')?.addEventListener('click', async () => {
    const daten = aktuellePayloadDaten();
    if (!daten) return meldung('Zuerst oben den Übergabecode erzeugen.', 'fehler');
    if (daten.registerId === 'KASSETTE' || !daten.registerId) {
      // Die Finance Bridge braucht GENAU eine Zielkasse - die Geldkassette (beide Laden auf
      // einmal) passt in dieses einfache, eine-Kasse-Modell nicht. Fuer diesen Fall bleibt der
      // bestehende QR-Code/Datei-Weg die richtige Wahl.
      return meldung('Für die Geldkassette (beide Kassen zusammen) bitte weiterhin den QR-Code/die Datei verwenden - die Datenbank kennt nur eine Zielkasse je Übergabe.', 'warnung');
    }
    const kc = client();
    if (!kc || !global.KCMoneyButlerSupabase?.istAngemeldet?.()) return meldung('Bitte zuerst oben anmelden.', 'fehler');
    const fb = global.createKCFinanceBridge?.(kc);
    if (!fb) return meldung('KC-Communication-Bausteine nicht geladen.', 'fehler');
    try {
      const antwort = await fb.createCashTransfer({
        registerId: daten.registerId, amount: daten.total, businessDate: daten.effectiveDate,
        variables: { type: daten.type, note: daten.note || '' },
        correlationId: `money-${daten.transferId}`,
        orgId: 'KC_WERNE',
      });
      if (!antwort?.ok) throw new Error(antwort?.error || 'Unbekannter Fehler');
      meldung(`${geld(daten.total)} für ${daten.registerId} an den PC Manager gesendet (Datenbank).`, 'ok');
    } catch (err) {
      meldung(`Konnte nicht gesendet werden: ${err.message}`, 'fehler');
    }
  });

  el('mbSendeEmail')?.addEventListener('click', async () => {
    const daten = aktuellePayloadDaten();
    if (!daten) return meldung('Zuerst oben den Übergabecode erzeugen.', 'fehler');
    const kc = client();
    if (!kc || !global.KCMoneyButlerSupabase?.istAngemeldet?.()) return meldung('Bitte zuerst oben anmelden.', 'fehler');
    const adapter = global.createKCCommunicationAdapter?.(kc);
    if (!adapter) return meldung('KC-Communication-Bausteine nicht geladen.', 'fehler');
    try {
      // Bewusst NUR eine Benachrichtigung (cash_transfer_ready), KEIN Eintrag in der Finance
      // Bridge - der PC Manager muesste diese Uebergabe bei diesem Weg weiterhin von Hand
      // (QR-Code/Datei) uebernehmen. Die E-Mail ist eine reine Information.
      await adapter.emit('cash_transfer_ready', {
        registerId: daten.registerId, amount: daten.total,
        emailText: `Geldübergabe (nur Information, kein automatischer Eintrag): ${daten.type === 'opening' ? 'Anfangsbestand' : 'Nachfüllung'} ${geld(daten.total)} für ${daten.registerId}, gültig ab ${daten.effectiveDate}.${daten.note ? ` Notiz: ${daten.note}` : ''}`,
      }, { testOnly: false, correlationId: `mail-${daten.transferId}` });
      meldung('Informations-E-Mail verschickt.', 'ok');
    } catch (err) {
      meldung(err.code === 'EVENT_NOT_DEFINED' || err.code === 'SOURCE_PROGRAM_NOT_ENABLED'
        ? 'Noch nicht verschickt: diese Benachrichtigung ist zentral noch nicht freigeschaltet.'
        : `Konnte nicht verschickt werden: ${err.message}`, 'fehler');
    }
  });
})(window);
