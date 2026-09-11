// KC Sync – Hash-Ketten für sicherheitsrelevante lokale Vorgänge (Sicherheitsebene 4).
//
// Prinzip: jeder neue Eintrag bekommt eine Prüfsumme, die aus der Prüfsumme des VORHERIGEN
// Eintrags UND dem eigenen Inhalt berechnet wird. Wird nachträglich ein Eintrag verändert oder
// entfernt, passt ab dieser Stelle die gesamte restliche Kette nicht mehr zusammen - erkennbar
// über verifyChain(). Das erkennt Manipulation zuverlässig, verhindert sie aber nicht - wer
// physischen Zugriff auf ein entsperrtes Gerät hat, kann grundsätzlich etwas verändern (siehe
// Sicherheitskonzept-Dokument, ehrliche Grenze).
(function (global) {
  'use strict';

  async function sha256Hex(text) {
    // Ueber shared/kc-krypto.js, damit die Hashkette auch auf dem Tablet arbeitet: dort wird
    // die Kasse ueber die WLAN-Adresse aufgerufen, und crypto.subtle gibt es dort nicht.
    if (global.KCKrypto) return global.KCKrypto.sha256Hex(text);
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fügt einen neuen Eintrag an eine bestehende, in localStorage gespeicherte Liste an - mit
  // Hash-Verkettung. Gibt die AKTUALISIERTE Liste zurück (der Aufrufer speichert sie selbst,
  // genau wie bisher - keine Änderung an bestehenden Speicherstellen nötig).
  async function appendChained(list, entry) {
    const previousHash = list.length ? list[list.length - 1].chainHash : 'GENESIS';
    const chainHash = await sha256Hex(previousHash + JSON.stringify(entry));
    list.push({ ...entry, previousHash, chainHash });
    return list;
  }

  // Prüft eine ganze Kette durch. Liefert {valid:true} oder {valid:false, brokenAtIndex:N} -
  // "brokenAtIndex" zeigt die erste Stelle, ab der etwas nicht mehr zusammenpasst (verändert,
  // entfernt, oder Reihenfolge vertauscht).
  async function verifyChain(list) {
    let expectedPrevious = 'GENESIS';
    for (let i = 0; i < list.length; i++) {
      const { previousHash, chainHash, ...rest } = list[i];
      if (previousHash !== expectedPrevious) return { valid: false, brokenAtIndex: i, reason: 'vorherige_pruefsumme_passt_nicht' };
      const recomputed = await sha256Hex(previousHash + JSON.stringify(rest));
      if (recomputed !== chainHash) return { valid: false, brokenAtIndex: i, reason: 'eintrag_veraendert' };
      expectedPrevious = chainHash;
    }
    return { valid: true };
  }

  global.KCHashChain = { appendChained, verifyChain };
})(window);
