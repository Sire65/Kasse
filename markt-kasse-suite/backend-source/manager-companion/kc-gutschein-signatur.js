// Gutscheinnummern: Vergabe und Prüfsignatur.
//
// ANLASS: Die Nummer war bisher GS-<Jahr>-<lfd>-<Prüfzeichen>, wobei das Prüfzeichen die
// Quersumme der Zeichen modulo 97 war. Das schützt gegen Vertipper, aber gegen nichts sonst:
// wer das Muster einmal sieht, rechnet sich zu jeder Wunschnummer die passende Endung selbst
// aus und druckt sich einen Gutschein. Ausserdem zaehlte die Kasse die laufende Nummer aus
// ihrem eigenen localStorage - zwei Kassen am Stand vergeben so dieselbe Nummer.
//
// JETZT: Die Nummer kommt vom Manager (fortlaufend, ueber alle Kassen hinweg eindeutig) und
// traegt eine Signatur, die nur mit dem Geheimnis des Managers zu bilden ist.
//
// WAS SIGNIERT WIRD - und was bewusst NICHT:
// Signiert wird ausschliesslich "KCG1|<Nummer>|<Schluesselgeneration>". Betrag, Guthaben und
// Ablaufdatum stehen NICHT im Code. Sie muessen beim Einloesen ohnehin aus dem Gutschein-
// Datensatz kommen - der Restwert aendert sich ja bei jeder Teileinloesung. Stuende der Betrag
// mit im Code, muesste die Nummer erst beim Verkauf signiert werden; dann braeuchte die Kasse
// entweder das Geheimnis (dann kann sie faelschen) oder eine Verbindung zum Manager im Moment
// des Verkaufs (dann steht der Stand still, sobald das WLAN hakt).
// So dagegen kann der Manager Nummern auf VORRAT signieren, die Kasse zieht am Stand offline
// daraus - und das Geheimnis bleibt trotzdem im Manager.
//
// WAS DIE SIGNATUR LEISTET: eine erfundene Nummer faellt sofort auf. Wer KC-2027-0001 auf
// einen Zettel schreibt, hat keine gueltige Signatur dazu.
// WAS SIE NICHT LEISTET: eine Fotokopie eines echten Gutscheins. Dagegen hilft nur das
// Guthabenkonto - der zweite Einloeseversuch findet kein Guthaben mehr vor. Die Signatur
// kommt VOR dieser Pruefung, sie ersetzt sie nicht.
'use strict';
const crypto = require('crypto');

// Crockford-Base32 ohne I, L, O, U - wer die Nummer von Hand abtippt, kann 0/O und 1/I/L
// nicht verwechseln, weil die verwechselbaren Zeichen gar nicht erst vorkommen.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const NUMMER_MUSTER = /^KC-\d{4}-\d{4}$/;

function base32(buf) {
  let bits = 0, wert = 0, aus = '';
  for (const b of buf) {
    wert = (wert << 8) | b; bits += 8;
    while (bits >= 5) { aus += ALPHABET[(wert >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) aus += ALPHABET[(wert << (5 - bits)) & 31];
  return aus;
}

const datenzeile = (nummer, generation) => ['KCG1', nummer, generation].join('|');

function signiere(geheimnisBase64, nummer, generation) {
  const roh = crypto.createHmac('sha256', Buffer.from(geheimnisBase64, 'base64'))
    .update(datenzeile(nummer, generation), 'utf8').digest();
  return base32(roh.subarray(0, 15)); // 120 Bit -> 24 Zeichen
}

const qrText = (geheimnisBase64, nummer, generation) =>
  ['KCG1', nummer, generation, signiere(geheimnisBase64, nummer, generation)].join(':');

// Aktuelles Geheimnis holen, beim ersten Aufruf erzeugen. Es liegt in der Manager-Datenbank
// und wandert damit automatisch in die bestehende Sicherung mit - ginge es verloren, waeren
// alle im Umlauf befindlichen Gutscheine nicht mehr pruefbar.
function aktuellesGeheimnis(db) {
  // BEFUND aus dem Test: sortiert wurde nach created_at. Werden zwei Generationen innerhalb
  // derselben Millisekunde angelegt (im Test der Normalfall, in der Praxis beim Einspielen
  // eines vorbereiteten Schluessels denkbar), ist die Reihenfolge nicht bestimmt - der Manager
  // signierte dann weiter mit dem ALTEN Schluessel, ohne dass es jemandem auffaellt.
  // Sortiert wird deshalb nach der Nummer der Generation, nicht nach der Uhrzeit. Als Zahl,
  // nicht als Text: sonst stuende S9 hinter S10.
  const vorhanden = db.prepare(
    'SELECT generation, secret FROM voucher_secrets ORDER BY CAST(substr(generation, 2) AS INTEGER) DESC LIMIT 1').get();
  if (vorhanden) return { generation: vorhanden.generation, secret: vorhanden.secret };
  const neu = { generation: 'S1', secret: crypto.randomBytes(32).toString('base64') };
  db.prepare('INSERT INTO voucher_secrets (generation, secret, created_at) VALUES (?, ?, ?)')
    .run(neu.generation, neu.secret, new Date().toISOString());
  return neu;
}

// Beim Schluesselwechsel bleiben alle frueheren Generationen pruefbar - sonst waeren die
// Gutscheine, die noch drei Jahre gelten, ab dem Wechsel wertlos.
function geheimnisFuer(db, generation) {
  return db.prepare('SELECT secret FROM voucher_secrets WHERE generation = ?').get(generation)?.secret || null;
}

function pruefe(db, text) {
  const teile = String(text || '').trim().split(':');
  if (teile.length !== 4 || teile[0] !== 'KCG1') return { gueltig: false, grund: 'format' };
  const [, nummer, generation, signatur] = teile;
  if (!NUMMER_MUSTER.test(nummer)) return { gueltig: false, grund: 'nummer' };
  const geheimnis = geheimnisFuer(db, generation);
  if (!geheimnis) return { gueltig: false, grund: 'generation_unbekannt' };
  const soll = Buffer.from(signiere(geheimnis, nummer, generation));
  const ist = Buffer.from(signatur);
  if (soll.length !== ist.length || !crypto.timingSafeEqual(soll, ist)) {
    return { gueltig: false, grund: 'signatur' };
  }
  return { gueltig: true, nummer, generation };
}

// Aus einem gescannten QR-Code oder einer abgetippten Nummer die reine Nummer holen.
// Beides muss funktionieren: der Scanner liefert den vollen Code, der Bediener tippt nur
// KC-2026-0042 ab, wenn der Bon zerknittert ist.
function nummerAus(text) {
  const roh = String(text || '').trim().toUpperCase();
  if (roh.startsWith('KCG1:')) {
    const nummer = roh.split(':')[1] || '';
    return NUMMER_MUSTER.test(nummer) ? nummer : null;
  }
  return NUMMER_MUSTER.test(roh) ? roh : null;
}

// Naechste freie Nummern reservieren. Der Zaehler laeuft je Jahr und liegt in der
// Manager-Datenbank - nicht auf der Kasse, sonst vergeben zwei Kassen dieselbe Nummer.
function nummernVergeben(db, anzahl, kasse) {
  const menge = Math.max(1, Math.min(200, Number(anzahl) || 1));
  const jahr = new Date().getFullYear();
  const jetzt = new Date().toISOString();
  const { generation, secret } = aktuellesGeheimnis(db);

  const hoechste = db.prepare(
    "SELECT code FROM voucher_numbers WHERE code LIKE ? ORDER BY code DESC LIMIT 1").get(`KC-${jahr}-%`);
  let lfd = hoechste ? Number(hoechste.code.slice(-4)) : 0;

  const einfuegen = db.prepare(
    'INSERT INTO voucher_numbers (code, generation, issued_to_register, issued_at, used) VALUES (?, ?, ?, ?, 0)');
  const ausgabe = [];
  db.exec('BEGIN IMMEDIATE');
  try {
    for (let i = 0; i < menge; i++) {
      lfd += 1;
      if (lfd > 9999) break; // vierstellig - mehr als 9999 Gutscheine im Jahr waere ein anderes Problem
      const code = `KC-${jahr}-${String(lfd).padStart(4, '0')}`;
      einfuegen.run(code, generation, kasse || null, jetzt);
      ausgabe.push({ nummer: code, qr: qrText(secret, code, generation) });
    }
    db.exec('COMMIT');
  } catch (fehler) {
    try { db.exec('ROLLBACK'); } catch (e) { /* nichts zu retten */ }
    throw fehler;
  }
  return ausgabe;
}

module.exports = {
  base32, signiere, qrText, pruefe, nummerAus, nummernVergeben,
  aktuellesGeheimnis, geheimnisFuer, NUMMER_MUSTER,
};
