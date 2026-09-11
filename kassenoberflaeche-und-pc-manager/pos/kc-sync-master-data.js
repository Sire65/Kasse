// KC Sync – Zentrale Stammdaten (Warengruppen/Artikel/Pakete) vom PC-Manager übernehmen.
//
// PC-Manager bleibt die einzige Pflegestelle für Warengruppen/Artikel/Preise/Pfand/Allergene/
// Bilder/Favoriten - die Kasse liest diese nur noch, bearbeitet sie nicht selbst (hatte ohnehin
// nie eine eigene Bearbeitungsoberfläche dafür). Dieses Skript läuft VOR app.js und schreibt den
// vom Manager-Companion abgerufenen Stand in genau die localStorage-Schlüssel, die app.js beim
// Start selbst schon liest ("kc_groups_v050"/"kc_products_v050") - dadurch ist an app.js selbst
// keine einzige Zeile Änderung nötig, die bestehende, bereits geprüfte Ladelogik bleibt unberührt.
//
// Bewusst mit kurzer Zeitgrenze und index.html wartet auf dieses Skript (siehe dort), bevor
// app.js überhaupt geladen wird - ein nicht erreichbarer Companion (z. B. ganz am Anfang, bevor
// je synchronisiert wurde) blockiert den Kassenstart dadurch nicht, es wird einfach mit dem
// bisherigen Stand (zuletzt zwischengespeichert oder die eingebauten Standardartikel) weitergemacht.
(function (global) {
  'use strict';
  const URL_STAMMDATEN = (global.KCSyncConnection?.buildUrl('/kc-sync-master-data')) || 'http://127.0.0.1:47391/kc-sync-master-data';

  async function holeUndUebernehmeStammdaten() {
    try {
      const antwort = await fetch(URL_STAMMDATEN, { signal: AbortSignal.timeout(2500) });
      if (!antwort.ok) return;
      const daten = await antwort.json();
      if (!daten.vorhanden) return; // Manager hat noch nie Stammdaten gesendet - bisheriger Stand bleibt
      if (Array.isArray(daten.groups) && daten.groups.length) localStorage.setItem('kc_groups_v050', JSON.stringify(daten.groups));
      let artikelNeu = false;
      if (Array.isArray(daten.articles) && daten.articles.length) {
        const neu = JSON.stringify(daten.articles);
        artikelNeu = localStorage.getItem('kc_products_v050') !== neu;
        localStorage.setItem('kc_products_v050', neu);
        // 08.09.2026 (Betreiber: "½ Portion im Manager eingeschaltet, an der Kasse nichts angekommen"):
        // PRODUCTS wurde nur beim Start gelesen - eine Änderung kam erst nach Neuladen an. Jetzt
        // werden die Artikel sofort übernommen und Kacheln + Bon neu gezeichnet.
        if (artikelNeu) {
          try { PRODUCTS = daten.articles; global.KCArtikelnummern?.eintragen(PRODUCTS); global.sortOrderNachtragen?.(PRODUCTS); } catch (e) { /* app.js noch nicht geladen - beim Start wird ohnehin gelesen */ }
          try { renderCategories(); renderProducts(); renderCart(); } catch (e) { /* noch nicht bereit */ }
          global.setSystemHint?.('Artikel vom Manager übernommen');
        }
      }
      if (Array.isArray(daten.packages)) localStorage.setItem('kc_packages_v100', JSON.stringify(daten.packages));

      // Darstellung übernehmen: Knopfgrößen, Bild oder Text, Farben, welche Sondertasten es
      // gibt, Vereinsname, Bedienerliste. Das entscheidet der Betreiber, nicht das Gerät.
      //
      // WAS AUSDRÜCKLICH NICHT ÜBERNOMMEN WIRD - der Manager-Dienst filtert es bereits, hier
      // steht die zweite Sperre, weil ein Fehler an dieser Stelle teuer wäre:
      //   registerId/registerName - sonst meldet sich das Tablet als eine andere Kasse
      //   neuesLayout/Spiegelung  - die Anordnung wählt der Bediener für SEINE Schicht;
      //                             am nächsten Morgen steht sie ohnehin wieder auf Normal
      //   nextBon, Betriebszustand - gehört dem einzelnen Gerät
      if (daten.settings && typeof daten.settings === 'object') {
        const NICHT_UEBERNEHMEN = new Set(['registerId', 'registerName', 'neuesLayout',
          'spiegelModus', 'nextBon', 'trainingMode', 'rushMode', 'superAdminAccess', 'pinLockEnabled']);
        try {
          const master = JSON.parse(localStorage.getItem('kc_master_v040') || '{}');
          let geaendert = false;
          for (const [schluessel, wert] of Object.entries(daten.settings)) {
            if (NICHT_UEBERNEHMEN.has(schluessel)) continue;
            if (JSON.stringify(master[schluessel]) === JSON.stringify(wert)) continue;
            master[schluessel] = wert;
            geaendert = true;
          }
          if (geaendert) {
            localStorage.setItem('kc_master_v040', JSON.stringify(master));
            // Die Kasse liest die Darstellung beim Start ein - damit die Änderung ohne
            // Neustart sichtbar wird, hier ausdrücklich anwenden lassen.
            global.applyMasterSettings?.();
            global.setSystemHint?.('Darstellung aktualisiert');
          }
        } catch (e) { /* Speicher gesperrt - beim nächsten Abgleich erneut */ }
      }
    } catch (e) { /* Companion nicht erreichbar (z. B. offline) - zuletzt bekannter Stand bleibt gültig, kein Fehler für die Kasse */ }
  }

  // Danach regelmäßig nachsehen (alle 60 s), nicht nur beim Start - der Manager schickt
  // Stammdaten, wann er will; das Tablet soll sie ohne Neuladen bekommen.
  const bereit = holeUndUebernehmeStammdaten();
  setInterval(holeUndUebernehmeStammdaten, 60000);
  global.KCMasterDataSync = { bereit, jetzt: holeUndUebernehmeStammdaten };
})(window);
