// Fragt regelmäßig beim lokalen Companion nach, ob Money Butler eine Bargeldübergabe für DIESE
// Kasse abgelegt hat (nur im selben WLAN, siehe kc-sync-cash-transfer-Route im Companion).
// Läuft durch dieselbe geprüfte applyCashPayload()-Funktion wie der QR-Scan/Kurzcode-Weg -
// keine zweite, eigene Annahme-Logik, dieselbe Prüfsummen- und Duplikat-Sicherheit.
(function () {
  'use strict';
  if (!window.KCSyncConnection) return; // kein Companion konfiguriert - Funktion bleibt einfach inaktiv

  let pruefeGeradeSchon = false;

  async function pruefeAufBargeldUebergabe() {
    if (pruefeGeradeSchon) return;
    pruefeGeradeSchon = true;
    try {
      const antwort = await fetch(window.KCSyncConnection.buildUrl('/kc-sync-cash-transfer'));
      const daten = await antwort.json();
      if (!daten?.ok || !daten.pending) return;

      const { transferId, payload } = daten.pending;
      const codeText = 'KCASH1:' + btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      let ergebnis;
      try {
        ergebnis = applyCashPayload(codeText, 'manager-direct');
      } catch (e) {
        // Bereits bekannt (Duplikat) oder ungültig - trotzdem bestätigen, damit der Eintrag
        // beim Companion nicht endlos erneut ausgeliefert wird.
        await fetch(window.KCSyncConnection.buildUrl('/kc-sync-cash-transfer-ack'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transferId }),
        }).catch(() => {});
        return;
      }

      await fetch(window.KCSyncConnection.buildUrl('/kc-sync-cash-transfer-ack'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transferId }),
      }).catch(() => {});

      if (typeof setSystemHint === 'function') {
        setSystemHint(`Bargeldübergabe vom Manager eingegangen: ${ergebnis.type === 'opening' ? 'Anfangsbestand' : 'Nachfüllung'} über ${ergebnis.total.toFixed(2).replace('.', ',')} € automatisch übernommen.`, 'ok');
      }
    } catch (e) { /* Companion gerade nicht erreichbar - beim nächsten Takt erneut versuchen */ }
    finally { pruefeGeradeSchon = false; }
  }

  setInterval(pruefeAufBargeldUebergabe, 15000);
  setTimeout(pruefeAufBargeldUebergabe, 3000); // einmal kurz nach dem Start auch schon prüfen
})();
