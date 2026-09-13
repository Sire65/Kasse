// KC Krypto – SHA-256, das auch auf dem Tablet funktioniert.
//
// BEFUND 01.09.2026, am echten iPad gefunden: Auf der PIN-Sperre vier Ziffern eingegeben, auf
// den grünen Knopf getippt - und es passierte NICHTS. Keine Meldung, kein Fehler, nichts.
//
// URSACHE: Browser geben `crypto.subtle` (die eingebaute Verschlüsselung) nur in einem
// "sicheren Kontext" frei - also über https ODER über localhost. Das Tablet ruft die Kasse
// aber über die WLAN-Adresse auf, z. B. http://192.168.178.79:8090. Das ist KEIN sicherer
// Kontext: dort ist `crypto.subtle` schlicht `undefined`.
//
// Gemessen mit demselben Programm, nur über zwei Adressen:
//   http://127.0.0.1:8090   -> isSecureContext true,  crypto.subtle vorhanden
//   http://192.0.2.2:8090   -> isSecureContext false, crypto.subtle UNDEFINED
//
// Am PC lief deshalb alles, am Tablet nicht - und weil der Fehler in einer async-Funktion
// hochkam, an die niemand ein catch gehängt hatte, blieb er unsichtbar. Genau das Muster,
// das hier schon öfter Zeit gekostet hat: eine Anzeige, die schweigt statt zu melden.
//
// DIESE DATEI liefert SHA-256 auf beiden Wegen und mit IDENTISCHEM Ergebnis:
//   - ist crypto.subtle da, wird es benutzt (schnell, vom Browser geprüft)
//   - sonst rechnet die eingebaute Fassung unten dasselbe in JavaScript
// Identisch ist wichtig: eine PIN, die am PC gesetzt wurde, muss am Tablet aufschließen.
//
// WAS DAS NICHT LÖST: AES-Verschlüsselung (Bons, Live-Kanal, Security Card) braucht
// crypto.subtle wirklich und ist auf dem Tablet über http nicht verfügbar. Die betroffenen
// Stellen arbeiten dort bewusst unverschlüsselt weiter, statt das Kassieren zu verweigern -
// am Stand ist eine Kasse, die nicht kassiert, der größere Schaden. Wer die Verschlüsselung
// auch auf dem Tablet will, muss die Kasse über https ausliefern.
(function (global) {
  'use strict';

  // ---- SHA-256 in reinem JavaScript (nach FIPS 180-4) --------------------------------
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);

  function rechneSha256(bytes) {
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const laenge = bytes.length;
    const bitLaenge = laenge * 8;
    // Auffuellen: eine 1-Bit, dann Nullen, dann die Laenge als 64-Bit-Zahl.
    const gesamt = (((laenge + 9) >> 6) + 1) << 6;
    const m = new Uint8Array(gesamt);
    m.set(bytes);
    m[laenge] = 0x80;
    const sicht = new DataView(m.buffer);
    sicht.setUint32(gesamt - 8, Math.floor(bitLaenge / 4294967296));
    sicht.setUint32(gesamt - 4, bitLaenge >>> 0);

    const w = new Uint32Array(64);
    const dreh = (x, n) => (x >>> n) | (x << (32 - n));
    for (let block = 0; block < gesamt; block += 64) {
      for (let i = 0; i < 16; i++) w[i] = sicht.getUint32(block + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = dreh(w[i - 15], 7) ^ dreh(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = dreh(w[i - 2], 17) ^ dreh(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = dreh(e, 6) ^ dreh(e, 11) ^ dreh(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        const S0 = dreh(a, 2) ^ dreh(a, 13) ^ dreh(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    const raus = new Uint8Array(32);
    new DataView(raus.buffer).setUint32(0, H[0]);
    for (let i = 0; i < 8; i++) new DataView(raus.buffer).setUint32(i * 4, H[i]);
    return raus;
  }

  function alsBytes(text) {
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(String(text));
    const s = unescape(encodeURIComponent(String(text)));
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }
  const alsHex = (bytes) => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

  const echtVorhanden = () => !!(global.crypto && global.crypto.subtle && typeof global.crypto.subtle.digest === 'function');

  // Liefert die 32 Rohbytes. Ueber crypto.subtle, wenn verfuegbar - sonst gerechnet.
  async function sha256Bytes(text) {
    if (echtVorhanden()) {
      try { return new Uint8Array(await global.crypto.subtle.digest('SHA-256', alsBytes(text))); }
      catch (e) { /* faellt unten auf die gerechnete Fassung zurueck */ }
    }
    return rechneSha256(alsBytes(text));
  }
  async function sha256Hex(text) { return alsHex(await sha256Bytes(text)); }

  // Zufallsbytes: crypto.getRandomValues gibt es AUCH im unsicheren Kontext - nur subtle nicht.
  function zufall(anzahl) {
    const b = new Uint8Array(anzahl);
    if (global.crypto && typeof global.crypto.getRandomValues === 'function') global.crypto.getRandomValues(b);
    else for (let i = 0; i < anzahl; i++) b[i] = Math.floor(Math.random() * 256);
    return b;
  }

  global.KCKrypto = {
    sha256Hex,
    sha256Bytes,
    zufall,
    // Fuer Startpruefung und Diagnose: laeuft dieses Geraet in einem sicheren Kontext?
    sichererKontext: () => global.isSecureContext === true,
    echteVerschluesselungVerfuegbar: echtVorhanden,
    // ausdruecklich fuer den Selbsttest: erzwingt die gerechnete Fassung
    _gerechnet: (text) => alsHex(rechneSha256(alsBytes(text))),
  };
})(window);
