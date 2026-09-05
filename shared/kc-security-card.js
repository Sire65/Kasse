// Security-Card - gemeinsamer Kern für Manager und Kasse.
//
// ZWECK: Am Marktmorgen soll niemand einen langen Schlüssel eintippen. Die Karte liefert ihn.
// Sie enthält NUR einen QR-Code und eine Notfall-PIN - keinen Vereinsnamen, keine Kassen-ID,
// keinen Hinweis auf ein Verwaltungsprogramm. Wer sie findet, sieht ein Stück Pappe mit einem
// Muster darauf.
//
// WARUM VERSCHLÜSSELT: Ein QR-Code ist offener Text. Jedes Handy liest ihn. Stünde der
// Datenschlüssel im Klartext darin, wäre die ganze Verschlüsselung der Kasse wertlos, sobald
// jemand die Karte fotografiert. Deshalb steht im QR nur ein Kennzeichen und ein
// verschlüsselter Block: ein gewöhnlicher QR-Leser zeigt "KCSEC1:" und danach Buchstabensalat.
//
// WIE DIE KASSE IHN TROTZDEM LESEN KANN: Jede Kasse bekommt bei der Einrichtung einen eigenen
// Kartenschlüssel mit ins Kassenpaket. Nur damit lässt sich IHRE Karte öffnen - die Karte von
// Kasse 2 ist für Kasse 1 unbrauchbar. Der Kartenschlüssel steht nirgends auf der Karte.
//
// ZWEITER WEG (Notfall-PIN): Derselbe Datenschlüssel liegt ein zweites Mal im Block, verpackt
// mit der achtstelligen PIN von der Kartenrückseite. Ist der Scanner leer oder defekt, tippt
// man die PIN ein. Dasselbe Muster wie in dp2 - dort wird der lange Schlüssel ebenfalls
// zweifach eingepackt (PIN und PUK), damit ihn niemand auswendig können muss.
(function (global) {
  'use strict';

  const KENNUNG = 'KCSEC1:';
  const DURCHGAENGE = 310000;     // wie in dp2 - Durchprobieren wird dadurch aussichtslos
  const enc = new TextEncoder(), dec = new TextDecoder();

  const b64 = (bytes) => { let s = ''; const a = new Uint8Array(bytes);
    for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000));
    return btoa(s); };
  const unb64 = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
  const zufall = (n) => crypto.getRandomValues(new Uint8Array(n));

  async function schluesselAus(geheimnis, salz) {
    const material = await crypto.subtle.importKey('raw', enc.encode(geheimnis), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name: 'PBKDF2', salt: salz, iterations: DURCHGAENGE, hash: 'SHA-256'},
      material, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
  }

  // Ein Päckchen: derselbe Inhalt, mit einem Geheimnis verschlossen.
  async function packe(inhalt, geheimnis, zusatz) {
    const salz = zufall(16), iv = zufall(12);
    const key = await schluesselAus(geheimnis, salz);
    const cipher = await crypto.subtle.encrypt(
      {name: 'AES-GCM', iv, additionalData: enc.encode(zusatz), tagLength: 128}, key, enc.encode(inhalt));
    return {s: b64(salz), i: b64(iv), c: b64(new Uint8Array(cipher))};
  }
  async function oeffne(paket, geheimnis, zusatz) {
    const key = await schluesselAus(geheimnis, unb64(paket.s));
    const plain = await crypto.subtle.decrypt(
      {name: 'AES-GCM', iv: unb64(paket.i), additionalData: enc.encode(zusatz), tagLength: 128},
      key, unb64(paket.c));
    return dec.decode(plain);
  }

  // Den Datenschlüssel aus dem Kartenschlüssel des Geräts und der Ausgabenummer ABLEITEN.
  //
  // BEFUND aus der Planung des Telefonwegs: vorher lag der Schlüssel ausschliesslich im QR.
  // Damit war die aufgedruckte Zahl wertlos, sobald die Karte selbst fehlte - genau der Fall,
  // fuer den sie gedacht war. Wer am Stand anruft, weil die Karte weg ist, haette nichts
  // eintippen koennen.
  //
  // Jetzt wird der Schluessel aus zwei Teilen berechnet: dem Kartenschluessel, der bei der
  // Einrichtung ins Geraet kam, und der laufenden Ausgabenummer. Beides zusammen ergibt immer
  // denselben Schluessel - das Geraet kann ihn also allein aus einer kurzen, telefonisch
  // durchsagbaren Zahl herstellen, ohne Netz und ohne Karte.
  //
  // WAS DAS BEDEUTET, offen gesagt: Die Sicherheit haengt am GERAET, nicht am Code. Wer das
  // eingerichtete Tablet hat, kommt ohnehin an den Schluessel - am Stand auch ueber das Netz.
  // Der Code schuetzt gegen Vertippen und gegen fremde Karten, nicht gegen jemanden, der das
  // Geraet in der Hand haelt. Deshalb: Karten und Tablets nicht zusammen liegen lassen.
  async function leiteDatenschluesselAb(kartenschluessel, ausgabe) {
    const salz = enc.encode('KCSEC1|ausgabe|' + Number(ausgabe));
    const material = await crypto.subtle.importKey('raw', enc.encode(kartenschluessel), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      {name: 'PBKDF2', salt: salz, iterations: DURCHGAENGE, hash: 'SHA-256'}, material, 256);
    return b64(new Uint8Array(bits)).replace(/[+/=]/g, '').slice(0, 32);
  }

  // Pruefzeichen gegen Vertippen - kein Geheimnis, nur eine Absicherung beim Durchsagen.
  async function pruefzeichen(kartenschluessel, kassenNummer, ausgabe) {
    const roh = await crypto.subtle.digest('SHA-256',
      enc.encode(`${kartenschluessel}|${kassenNummer}|${ausgabe}`));
    const ziffern = Array.from(new Uint8Array(roh)).slice(0, 4)
      .map((b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
    return ziffern;
  }

  // Der Code, der auf der Karte steht und am Telefon durchgesagt wird: 1-004-8F2K
  //   1    = welche Kasse (auf Wunsch sichtbar, damit Karten unterscheidbar sind)
  //   004  = wievielte Ausgabe (jede neue Karte zaehlt hoch)
  //   8F2K = Pruefzeichen gegen Vertippen
  async function baueCode(karte) {
    const pruef = await pruefzeichen(karte.kartenschluessel, karte.kassenNummer, karte.ausgabe);
    return `${karte.kassenNummer}-${String(karte.ausgabe).padStart(3, '0')}-${pruef}`;
  }

  // Neue Kartendaten für eine Kasse erzeugen.
  //
  // Der Datenschlüssel wird nie von einem Menschen getippt - genau das war der Auslöser: ein
  // 16-stelliger Schlüssel, den sich jemand merken muss, geht irgendwann verloren.
  async function neueKarte(registerId, kassenNummer, ausgabe, vorhandenerKartenschluessel) {
    const kartenschluessel = vorhandenerKartenschluessel
      || b64(zufall(24)).replace(/[+/=]/g, '').slice(0, 24);
    const nummer = Number(kassenNummer) || 1;
    const lauf = Number(ausgabe) || 1;
    const datenschluessel = await leiteDatenschluesselAb(kartenschluessel, lauf);
    const karte = {registerId, kassenNummer: nummer, ausgabe: lauf,
      datenschluessel, kartenschluessel, erstelltAm: new Date().toISOString()};
    karte.code = await baueCode(karte);
    return karte;
  }

  // Den QR-Inhalt bauen: zwei Päckchen mit demselben Datenschlüssel.
  async function baueQr(karte) {
    // Im QR steht nur noch die Ausgabenummer - verschluesselt, damit ein Handyscan auch die
    // nicht preisgibt. Der Schluessel selbst steht NICHT mehr darin: das Geraet rechnet ihn
    // sich aus seinem eigenen Kartenschluessel aus. Ein Foto der Karte ist damit noch weniger
    // wert als vorher.
    const zusatz = `KCSEC1|${karte.registerId}`;
    const paket = await packe(String(karte.ausgabe), karte.kartenschluessel, zusatz);
    return KENNUNG + b64(enc.encode(JSON.stringify({v: 2, a: paket})));
  }

  // Auf der Kasse: QR-Inhalt öffnen und daraus den Schlüssel berechnen.
  async function leseQr(text, registerId, kartenschluessel) {
    if (!text || !text.startsWith(KENNUNG)) throw new Error('Kein gültiger Startcode.');
    const paket = JSON.parse(dec.decode(unb64(text.slice(KENNUNG.length))));
    const ausgabe = await oeffne(paket.a || paket.k, kartenschluessel, `KCSEC1|${registerId}`);
    return {datenschluessel: await leiteDatenschluesselAb(kartenschluessel, ausgabe),
            ausgabe: Number(ausgabe)};
  }

  // Telefonweg: nur der aufgedruckte bzw. durchgesagte Code, ganz ohne Karte.
  //
  // Genau der Fall, für den es gedacht ist: Karte weg, kein Netz, jemand ruft an und sagt
  // "eins - null null vier - acht F zwei K" durch.
  async function leseCode(code, kartenschluessel) {
    const teile = String(code || '').trim().toUpperCase().split('-');
    if (teile.length < 3) throw new Error('Der Code hat nicht das erwartete Format.');
    const kassenNummer = Number(teile[0]);
    const ausgabe = Number(teile[1]);
    if (!kassenNummer || !ausgabe) throw new Error('Der Code hat nicht das erwartete Format.');
    const erwartet = await pruefzeichen(kartenschluessel, kassenNummer, ausgabe);
    if (teile[2] !== erwartet) throw new Error('Der Code passt nicht zu diesem Gerät.');
    return {datenschluessel: await leiteDatenschluesselAb(kartenschluessel, ausgabe), ausgabe};
  }

  global.KCSecurityCard = {KENNUNG, neueKarte, baueQr, baueCode, leseQr, leseCode,
    leiteDatenschluesselAb, pruefzeichen, packe, oeffne};
})(typeof window !== 'undefined' ? window : globalThis);
