// KC POS – IndexedDB-Speicherschicht für Umsatzdaten (Verkäufe/Trainingsbuchungen).
//
// Ersetzt localStorage als DAUERHAFTEN Speicherort für Kassenvorgänge (localStorage bleibt für
// reine Einstellungen weiterhin in Verwendung - siehe Konzeptabstimmung mit dem Betreiber).
//
// Architektur-Entscheidung, bewusst so gewählt: IndexedDB ist von Natur aus asynchron
// (Promise-basiert), die bestehende Kassenoberfläche (app.js) nutzt readTransactions()/
// saveTransactions() aber an 21 Stellen SYNCHRON, mitten in Render-/Filterlogik. Eine direkte
// Umstellung dieser Funktionen auf async hätte an all diesen Stellen Folgeänderungen nötig
// gemacht - hohes Risiko für eine bereits funktionierende, zentrale Kassenfunktion.
//
// Lösung: ein synchroner Arbeitsspeicher-Zwischenspeicher bleibt die von app.js gesehene
// Schnittstelle (unverändert schnell, unverändert synchron), IndexedDB übernimmt im Hintergrund
// die tatsächliche dauerhafte Speicherung. Die eigentliche Buchung (Bon-Freigabe) wartet NICHT
// auf den IndexedDB-Schreibvorgang - genau wie es das Konzept ausdrücklich verlangt
// ("Netzwerk-/Speicherübertragung darf die Kasse nicht blockieren").
(function (global) {
  'use strict';
  const DB_NAME = 'kc_pos_transactions_v1';
  const DB_VERSION = 1;
  const STORE_SALES = 'transactions';
  const STORE_TRAINING = 'trainingTransactions';

  let dbPromise = null;
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in global)) { reject(new Error('Speicherung auf diesem Gerät nicht möglich')); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_SALES)) db.createObjectStore(STORE_SALES, { keyPath: 'transactionId' });
        if (!db.objectStoreNames.contains(STORE_TRAINING)) db.createObjectStore(STORE_TRAINING, { keyPath: 'transactionId' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  // ---- Verschlüsselung der Verkaufsablage ------------------------------------------------
  //
  // BEFUND, der zu diesem Umbau geführt hat: Der Schlüssel wurde bisher aus der vier- bis
  // achtstelligen PIN mit EINEM einzigen SHA-256-Durchgang gebildet - ohne Salz. Genau das
  // machen die üblichen Werkzeuge angreifbar: Eine sechsstellige PIN hat eine Million
  // Möglichkeiten, ein normaler PC probiert die in unter einer Sekunde durch. Bei einem
  // verlorenen oder gestohlenen Tablet war die Verschlüsselung damit praktisch wirkungslos.
  //
  // Jetzt kommt der Schlüssel von der Security Card: 32 Zeichen aus dem Zufallsgenerator,
  // nie von einem Menschen getippt. Durchprobieren scheidet damit aus - nicht weil es lange
  // dauert, sondern weil es aussichtslos ist.
  //
  // ALTE DATENSÄTZE BLEIBEN LESBAR. Das ist kein Nebenaspekt: ein Umbau, der die Verkäufe der
  // Vortage unlesbar macht, wäre schlimmer als das Problem. Deshalb merkt sich jeder Datensatz,
  // WOMIT er verschlüsselt wurde - mit der Kartenausgabe (kcGen) oder noch mit der alten PIN.
  // Beim Lesen wird der passende Weg gewählt.
  const schluesselZwischenspeicher = new Map();

  async function aesSchluessel(geheimnis, verwendung) {
    const merkmal = geheimnis + '|' + verwendung;
    if (schluesselZwischenspeicher.has(merkmal)) return schluesselZwischenspeicher.get(merkmal);
    // Der Kartenschlüssel ist bereits Zufall in voller Länge - ein einzelner Digest genügt, um
    // daraus 256 Bit zu machen. Eine Streckung wie bei Passwörtern (PBKDF2) bringt hier nichts:
    // sie schützt gegen Erraten, und erraten lässt sich hier nichts.
    const roh = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('kc-pos-store|' + geheimnis));
    const key = await crypto.subtle.importKey('raw', roh, 'AES-GCM', false, ['encrypt', 'decrypt']);
    schluesselZwischenspeicher.set(merkmal, key);
    return key;
  }

  // Der aktuell gültige Schlüssel von der Security Card.
  const kartenSchluessel = () => global.KCSecurityCardPos?.schluessel?.() || null;
  const kartenAusgabe = () => global.KCSecurityCardPos?.ausgabe?.() || null;

  // Schlüssel einer FRÜHEREN Ausgabe nachrechnen - dafür ist die Ableitung gemacht.
  async function schluesselFuerAusgabe(ausgabe) {
    if (!ausgabe || ausgabe === kartenAusgabe()) return kartenSchluessel();
    const geraeteschluessel = localStorage.getItem('kc_kartenschluessel_v1');
    if (!geraeteschluessel || !global.KCSecurityCard?.leiteDatenschluesselAb) return null;
    return global.KCSecurityCard.leiteDatenschluesselAb(geraeteschluessel, ausgabe);
  }

  async function verschluesseleZeile(row) {
    const geheimnis = kartenSchluessel();
    if (!geheimnis) {
      // Kein Schlüssel da (Gerät noch nicht eingerichtet). Bewusst unverschlüsselt speichern
      // statt den Verkauf zu verweigern: am Stand ist eine Kasse, die nicht kassiert, der
      // größere Schaden. Die Startklar-Prüfung weist diesen Zustand aus.
      return row;
    }
    const key = await aesSchluessel(geheimnis, 'v2');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(row));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    return { transactionId: row.transactionId, kcEnc: true, kcV: 2, kcGen: kartenAusgabe(),
      iv: Array.from(iv), data: Array.from(new Uint8Array(cipher)) };
  }

  async function entschluesseleZeile(row) {
    if (!row?.kcEnc) return row; // unverschlüsselt gespeichert - unverändert zurückgeben
    const iv = new Uint8Array(row.iv);
    const data = new Uint8Array(row.data);

    if (row.kcV === 2) {
      const geheimnis = await schluesselFuerAusgabe(row.kcGen);
      if (!geheimnis) throw new Error('Dieser Verkauf ist verschlüsselt - bitte zuerst die Startkarte einlesen.');
      const key = await aesSchluessel(geheimnis, 'v2');
      const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
      return JSON.parse(new TextDecoder().decode(plaintext));
    }

    // Altbestand aus der Zeit der PIN-Ableitung: weiterhin lesbar, damit nichts verlorengeht.
    const keyBytes = global.KCPinLock?.getEncryptionKeyBytes?.();
    if (!keyBytes) throw new Error('Datensatz ist verschlüsselt, aber kein Schlüssel verfügbar (Kasse noch gesperrt?)');
    const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return JSON.parse(new TextDecoder().decode(plaintext));
  }

  function getAll(storeName) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    })).then((rows) => Promise.all(rows.map(entschluesseleZeile)));
  }

  // Ersetzt den GESAMTEN Inhalt eines Speichers - entspricht exakt dem bisherigen Verhalten von
  // localStorage.setItem(key, JSON.stringify(rows)) (die aufrufenden Stellen übergeben immer
  // das vollständige, bereits aktualisierte Array), nur dauerhaft und transaktional statt als
  // einzelner Blob.
  async function performReplaceAll(storeName, rows) {
    const verschluesselt = await Promise.all(rows.map(verschluesseleZeile));
    return openDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      verschluesselt.forEach((row) => store.put(row));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Speichervorgang abgebrochen'));
    }));
  }

  // Schreib-Warteschlange pro Speicherbereich: verhindert, dass zwei schnell aufeinanderfolgende
  // Speichervorgänge (z. B. ein Verkauf und kurz danach ein Storno) sich gegenseitig überholen -
  // ein älterer, noch laufender Schreibvorgang könnte sonst theoretisch NACH einem neueren
  // fertig werden und dessen Stand überschreiben. Jeder Aufruf wartet jetzt auf den Abschluss
  // des vorherigen, bevor er selbst startet - die Bon-Freigabe selbst wartet weiterhin auf
  // nichts davon, das betrifft nur die Reihenfolge der Hintergrund-Schreibvorgänge untereinander.
  const writeQueues = new Map();
  function replaceAll(storeName, rows) {
    const previous = writeQueues.get(storeName) || Promise.resolve();
    const next = previous.catch(() => {}).then(() => performReplaceAll(storeName, rows));
    writeQueues.set(storeName, next);
    const cleanup = () => { if (writeQueues.get(storeName) === next) writeQueues.delete(storeName); };
    next.then(cleanup, cleanup);
    return next;
  }

  // Führt den IndexedDB-Bestand mit dem aktuell im Arbeitsspeicher vorhandenen Bestand
  // zusammen - stellt Datensätze wieder her, die zwar in IndexedDB liegen, aber (z. B. durch
  // einen vorherigen fehlgeschlagenen Ladevorgang) gerade nicht im Zwischenspeicher sind. Bei
  // gleicher Vorgangs-ID gewinnt die im Arbeitsspeicher vorhandene Version (sie ist die zuletzt
  // durch die Kasse selbst bestätigte), Reihenfolge bleibt stabil.
  function mergeRows(databaseRows, localRows) {
    const merged = new Map();
    (Array.isArray(databaseRows) ? databaseRows : []).forEach((row, index) => merged.set(rowIdentity(row, index), row));
    (Array.isArray(localRows) ? localRows : []).forEach((row, index) => merged.set(rowIdentity(row, index), row));
    return [...merged.values()];
  }
  function rowIdentity(row, index = 0) {
    if (row?.transactionId) return String(row.transactionId);
    const register = row?.registerId || 'legacy', bon = row?.bon ?? row?.bonNumber ?? '?', time = row?.endTime || row?.time || index;
    return `${register}:${bon}:${time}`;
  }

  // Beim Kassenstart aufgerufen: liest den IndexedDB-Bestand, führt ihn mit dem übergebenen
  // aktuellen Bestand zusammen, schreibt das zusammengeführte Ergebnis zurück. Liefert auch
  // zurück, ob dabei tatsächlich etwas wiederhergestellt wurde (für einen sichtbaren Hinweis).
  async function reconcile(storeName, localRows) {
    const databaseRows = await getAll(storeName);
    const merged = mergeRows(databaseRows, localRows);
    await replaceAll(storeName, merged);
    const localCount = Array.isArray(localRows) ? localRows.length : 0;
    return { rows: merged, databaseCount: databaseRows.length, localCount, recovered: merged.length > localCount };
  }

  // Bittet den Browser, den Speicher als dauerhaft geschützt einzustufen (nicht als beliebig
  // löschbaren Zwischenspeicher unter Speicherdruck). Meldet den tatsächlich erreichten Zustand
  // zurück, statt nur "angefragt" zu behaupten - wird nicht auf allen Plattformen zuverlässig
  // gewährt (siehe Betreiber-Abstimmung zu iPad/Safari).
  async function requestPersistence() {
    const status = { supported: !!global.navigator?.storage, persistent: false, usage: null, quota: null };
    if (!status.supported) return status;
    try {
      if (navigator.storage.persisted) status.persistent = await navigator.storage.persisted();
      if (!status.persistent && navigator.storage.persist) status.persistent = await navigator.storage.persist();
      if (navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        status.usage = Number.isFinite(estimate.usage) ? estimate.usage : null;
        status.quota = Number.isFinite(estimate.quota) ? estimate.quota : null;
      }
    } catch (err) { status.error = String(err?.message || err); }
    return status;
  }

  global.KCTransactionStore = { openDb, getAll, replaceAll, mergeRows, reconcile, requestPersistence, STORE_SALES, STORE_TRAINING };
})(window);
