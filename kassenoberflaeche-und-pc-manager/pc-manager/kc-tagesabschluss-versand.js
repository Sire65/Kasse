// KC Tagesabschluss-Versand an den Kassenwart - siehe STAND.txt fuer den vollen Hintergrund.
//
// ABLAUF (Betreiber): Kasse erstellt abends den Tagesabschluss (das gibt es schon, meldet sich
// zuverlaessig ueber KCMeldeweg beim Companion). Der Manager holt sich diese Abschluesse ab und
// verschickt sie ueber KC Communication an den Kassenwart - per E-Mail mit den Zahlen im
// Text UND als echter Datei-Anhang (zum Wieder-Einlesen).
//
// 10.09.2026 AKTUALISIERT: der zentrale Anhang-Weg ist jetzt bestaetigt und bekannt
// (uploadAttachment -> kc-communication-attachments -> Anhang-ID -> emitEvent mit
// attachmentIds). Die fruehere, selbst ausgedachte Loesung (Base64 direkt im Ereignis-Feld
// "attachments") war eine Vermutung und ist jetzt durch den echten Weg ersetzt:
// adapter.emitWithFiles() laedt die Datei zuerst hoch und haengt sie danach am Ereignis an.
// Erlaubte Dateiarten laut Betreiber: PDF, CSV, TXT/JSON, JPG/PNG, Excel, Word - hier bewusst
// eine einfache, garantiert lesbare TXT-Datei (kein zusaetzlicher Aufwand fuer PDF-Erzeugung
// noetig, und fuer "wieder einlesen" reicht Klartext).
//
// WEITERHIN OFFEN: "closing_report_ready" (und cash_transfer_ready bei Money Butler) sind nur
// LOKAL in kc-communication-adapters.js hinterlegt. Ob sie zentral (Freigabe, Vorlage,
// Empfaengerregel) schon eingerichtet sind, ist von hier aus nicht zu sehen - ein
// Versandversuch kann daher weiterhin mit EVENT_NOT_DEFINED oder SOURCE_PROGRAM_NOT_ENABLED
// fehlschlagen. Deshalb weiterhin eine klare, verstaendliche Fehlermeldung statt eines
// kryptischen Codes.
(function (global) {
  'use strict';
  const el = (id) => document.getElementById(id);
  const geld = (n) => Number(n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  const KC_LETZTER_ABSCHLUSSABRUF_KEY = 'kcm_letzter_abschlussabruf_v1';
  const KC_VERSENDETE_ABSCHLUESSE_KEY = 'kcm_versendete_abschluesse_v1';

  function client() {
    if (!global.KCCommunicationClient) return null;
    return new global.KCCommunicationClient({
      sourceProgram: 'kc-bilderrechner',
      getAccessToken: async () => global.KCSupabase?.holeZugriffsToken?.() || null,
    });
  }

  function bereitsVersendet() {
    try { return JSON.parse(localStorage.getItem(KC_VERSENDETE_ABSCHLUESSE_KEY) || '[]'); } catch (e) { return []; }
  }
  function merkeVersendet(closingId) {
    const liste = bereitsVersendet();
    if (!liste.includes(closingId)) { liste.push(closingId); localStorage.setItem(KC_VERSENDETE_ABSCHLUESSE_KEY, JSON.stringify(liste.slice(-500))); }
  }

  // Baut den E-Mail-Text mit allen Zahlen aus - steht sowohl in den Ereignis-Variablen (fuer
  // die zentrale Vorlage) als auch wortgleich in der angehaengten TXT-Datei.
  function abschlussAlsText(a) {
    return [
      `Tagesabschluss ${a.registerName || a.registerId} - ${new Date(a.createdAt).toLocaleString('de-DE')}`,
      '',
      `Bareinnahme (Verkauf): ${geld(a.cashSales)}`,
      `Trinkgeld (bar): ${geld(a.cashTips)}`,
      `Auszahlungen: ${geld(a.cashOut)}`,
      `Erwarteter Kassenbestand: ${geld(a.expectedCash)}`,
      `Kontoverkäufe: ${geld(a.accountSales)}`,
      `Gesamtumsatz: ${geld(a.totalSales)}`,
      `Personalverbrauch: ${geld(a.staffTotal)} (${a.staffCount} Vorgänge)`,
      `Anzahl Vorgänge: ${a.transactionCount}`,
      a.note ? `Notiz: ${a.note}` : null,
    ].filter(Boolean).join('\n');
  }

  async function tagesabschluesseHolenUndVersenden(manuell = false) {
    const knopf = el('sendClosingReports'), ergebnisFeld = el('closingSendResult');
    if (knopf) knopf.disabled = true;
    try {
      const kc = client();
      if (!kc) throw new Error('KC-Communication-Bausteine nicht geladen');
      const seit = localStorage.getItem(KC_LETZTER_ABSCHLUSSABRUF_KEY) || '';
      // 10.09.2026, KORRIGIERT: hier zunaechst versehentlich einen eigenen, neuen Endpunkt
      // gebaut - dann gefunden, dass /abschluesse/liste (mit eigener "closings"-Tabelle,
      // sauberer als die rohen received_events) bereits existiert und von
      // kc-abschluesse-manager.js schon produktiv genutzt wird. Diesen bestehenden Weg
      // wiederverwendet statt eines zweiten, redundanten Endpunkts.
      const antwort = await fetch(`http://127.0.0.1:47392/abschluesse/liste`);
      if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
      const daten = await antwort.json();
      const abschluesse = (Array.isArray(daten.abschluesse) ? daten.abschluesse : [])
        .filter((a) => a.status === 'fertig' && !bereitsVersendet().includes(a.closingId))
        // /abschluesse/liste kennt kein "seit" - hier stattdessen nach dem Meldezeitpunkt
        // gefiltert, damit ein wiederholter Aufruf nicht laengst Verschicktes erneut anfasst
        // (die eigentliche Dopplungs-Sperre ist ohnehin bereitsVersendet(), das hier ist nur
        // zusaetzlich sparsam).
        .filter((a) => !seit || (a.receivedAt || a.createdAt) > seit);
      localStorage.setItem(KC_LETZTER_ABSCHLUSSABRUF_KEY, new Date().toISOString());

      if (!abschluesse.length) {
        if (ergebnisFeld) ergebnisFeld.textContent = 'Keine neuen Tagesabschlüsse seit dem letzten Abruf.';
        return;
      }

      const adapter = global.createKCCommunicationAdapter(kc);
      let versendet = 0, fehler = null;
      for (const a of abschluesse) {
        try {
          const text = abschlussAlsText(a);
          const datei = new File(
            [text], `Tagesabschluss_${a.registerId}_${a.createdAt.slice(0, 10)}.txt`,
            { type: 'text/plain' }
          );
          // Echter Weg: adapter.emitWithFiles() laedt die Datei zuerst ueber
          // kc-communication-attachments hoch (Anhang-ID) und haengt sie dann am Ereignis an -
          // genau der vom Betreiber bestaetigte, produktive Ablauf.
          await adapter.emitWithFiles('closing_report_ready', {
            registerId: a.registerId,
            registerName: a.registerName,
            expectedCash: a.expectedCash,
            totalSales: a.totalSales,
            emailText: text,
          }, [datei], { testOnly: false, correlationId: `closing-${a.closingId}` });
          merkeVersendet(a.closingId);
          versendet++;
        } catch (err) {
          fehler = err;
          // Ein einzelner fehlgeschlagener Abschluss darf die anderen nicht blockieren -
          // weiter mit dem naechsten, aber die Fehlermeldung am Ende zeigen.
        }
      }
      if (ergebnisFeld) {
        if (fehler && !versendet) {
          ergebnisFeld.textContent = (fehler.code === 'EVENT_NOT_DEFINED' || fehler.code === 'SOURCE_PROGRAM_NOT_ENABLED')
            ? 'Noch nicht versendet: "closing_report_ready" ist zentral noch nicht freigeschaltet (Ereignis nur lokal vorbereitet).'
            : `Versand fehlgeschlagen: ${fehler.message}`;
        } else if (fehler) {
          ergebnisFeld.textContent = `${versendet} von ${abschluesse.length} Tagesabschlüssen verschickt, ${abschluesse.length - versendet} fehlgeschlagen.`;
        } else {
          ergebnisFeld.textContent = `${versendet} Tagesabschluss/-schlüsse mit Anhang an den Kassenwart verschickt.`;
        }
      }
      if (manuell) window.KCManagerMessages?.[fehler && !versendet ? 'warn' : 'success']?.(ergebnisFeld?.textContent || '');
    } catch (err) {
      const text = 'Manager-Dienst gerade nicht erreichbar (läuft das schwarze Fenster?).';
      if (ergebnisFeld) ergebnisFeld.textContent = text;
      if (manuell) window.KCManagerMessages?.warn?.(text);
    } finally {
      if (knopf) knopf.disabled = false;
    }
  }

  el('sendClosingReports')?.addEventListener('click', () => tagesabschluesseHolenUndVersenden(true));
  global.KCTagesabschlussVersand = { tagesabschluesseHolenUndVersenden };
})(window);
