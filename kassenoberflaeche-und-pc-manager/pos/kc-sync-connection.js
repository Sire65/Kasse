// KC Sync – Verbindungs-Konfiguration für den Mehrgeräte-Betrieb (mehrere Tablets als
// eigenständige Kassen am Marktstand).
//
// Funktionsweise: beim ALLERERSTEN Öffnen eines neuen Tablets wird die Adresse mit angehängten
// Parametern aufgerufen, z. B.:
//   http://192.168.1.5:8080/pos/index.html?kcPort=47393&kcToken=AbC123...&kcRegisterId=KASSE-02
// Diese Angaben werden einmalig im Browser gespeichert (localStorage) - bei jedem weiteren
// Öffnen reicht die einfache Adresse ohne Parameter, das Tablet erinnert sich.
//
// Die Kassen-ID (kcRegisterId) ist der entscheidende Teil für Übersichtlichkeit: sie ist
// dieselbe ID, die auch in der Kassenverwaltung im PC Manager verwendet wird (z.B. "KASSE-01")
// - dadurch ist eindeutig nachvollziehbar, welches Tablet zu welcher Kassen-Karte gehört, statt
// sich nur zufällig über die Position in einer Liste zuzuordnen.
//
// Ohne jede Angabe (der bisherige, unveränderte Fall: Windows-Rechner mit lokal laufendem
// Kassen-Companion) verhält sich alles genau wie vorher - Verbindung zu 127.0.0.1, kein
// Zugangs-Schlüssel nötig.
(function (global) {
  'use strict';
  const STORAGE_KEY = 'kc_sync_connection_v1';

  function readConfig() {
    const params = new URLSearchParams(location.search);
    const fromUrl = {
      host: params.get('kcHost') || null,
      port: params.get('kcPort') ? Number(params.get('kcPort')) : null,
      token: params.get('kcToken') || null,
      registerId: params.get('kcRegisterId') || null,
    };
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { /* ignorieren, mit leerem Stand weitermachen */ }

    // Angaben in der URL überschreiben und ergänzen einen bereits gespeicherten Stand (so kann
    // ein Tablet auch später auf eine andere Kasse umgestellt werden, indem einfach eine neue
    // Adresse mit anderen Parametern geöffnet wird).
    const merged = {
      host: fromUrl.host || stored.host || location.hostname || '127.0.0.1',
      port: fromUrl.port || stored.port || 47391,
      token: fromUrl.token || stored.token || null,
      registerId: fromUrl.registerId || stored.registerId || null,
    };
    if (fromUrl.host || fromUrl.port || fromUrl.token || fromUrl.registerId) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch (e) { /* Speicher evtl. voll/deaktiviert - Verbindung funktioniert trotzdem für diese Sitzung */ }
    }
    return merged;
  }

  const config = readConfig();

  // Mehrgeräte-Erkennung: eine dauerhafte, geräteeigene Kennung (nicht personenbezogen) - wird
  // einmalig erzeugt und lokal gespeichert, identifiziert dieses physische Gerät gegenüber
  // seiner Kassen-Instanz, damit ein ZWEITES Gerät mit derselben Adresse erkannt werden kann.
  const SESSION_KEY = 'kc_sync_device_session_id';
  let deviceSessionId = null;
  try {
    deviceSessionId = localStorage.getItem(SESSION_KEY);
    if (!deviceSessionId) {
      deviceSessionId = (crypto.randomUUID ? crypto.randomUUID() : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(SESSION_KEY, deviceSessionId);
    }
  } catch (e) { deviceSessionId = `dev-${Date.now()}`; } // Speicher evtl. deaktiviert - Sitzung gilt dann nur fuer diesen Aufruf

  function buildUrl(path) {
    const url = new URL(`http://${config.host}:${config.port}${path}`);
    if (config.token) url.searchParams.set('token', config.token);
    if (deviceSessionId) url.searchParams.set('sessionId', deviceSessionId);
    return url.toString();
  }

  global.KCSyncConnection = { config, buildUrl, deviceSessionId };
})(window);
