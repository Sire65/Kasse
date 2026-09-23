// Übergabeprotokoll der Geldkassette: erzeugen, lesen, melden, laden.
//
// ZWECK: Die Geldkassette verlässt abends das Haus. Das Protokoll hält fest, wer sie mit
// welchem Inhalt gebracht und wer sie angenommen hat - auf Papier zum Gegenzeichnen, und
// zusätzlich als Datensatz im Manager, damit es nachher nicht nur den Zettel gibt.
//
// EIN Modul für BEIDE Seiten (Money Butler erzeugt, PC-Manager liest und archiviert). Die
// Prüfsummenformel und der Aufbau des Belegs stehen genau einmal hier - zwei Fassungen würden
// über kurz oder lang auseinanderlaufen, und dann gilt ein gültiger Beleg plötzlich als falsch.
//
// DIE WEGE (bewusst zwei, beide vollständig):
//   1. Automatisch: der Money Butler meldet jeden erzeugten Beleg an den Manager-Dienst
//      (Loopback 47392). Läuft der Dienst, steht der Beleg sofort im Archiv.
//   2. Von Hand: der Beleg-QR auf dem Papier trägt denselben Inhalt vollständig. War der
//      Dienst beim Erzeugen nicht erreichbar (Money Butler läuft auch ganz ohne Netz), wird
//      der Beleg im Manager nachgetragen - scannen oder Code einfügen, fertig.
// Beide Wege enden im selben Archiv, und beide prüfen dieselbe Prüfsumme.
(function (global) {
  'use strict';

  const DIENST_PORT = 47392;
  const PRAEFIX = 'KCPROT1:';
  const LOKAL_KEY = 'kc_uebergabeprotokolle_v1';

  // Dieselbe Formel wie bei allen anderen KC-Codes (FNV-1a, 8 Stellen hexadezimal).
  function pruefsumme(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
  const kodieren = (wert) => PRAEFIX + btoa(unescape(encodeURIComponent(JSON.stringify(wert))));
  const entkodieren = (text) => JSON.parse(decodeURIComponent(escape(atob(text.slice(PRAEFIX.length)))));

  // --- Erzeugen -------------------------------------------------------------------------
  // Kurze Schlüsselnamen und nur Sorten mit Stückzahl: der Beleg muss in einen QR-Code
  // passen, den ein Handy vom Papier liest. Mit ausgeschriebenen Namen und allen Nullwerten
  // wird der Code so gross, dass er nicht mehr sicher scannbar ist.
  function erzeugen(payload, gesamt) {
    const nurGefuellt = (objekt) => {
      const raus = {};
      for (const [schluessel, anzahl] of Object.entries(objekt || {})) if (Number(anzahl) > 0) raus[schluessel] = Number(anzahl);
      return raus;
    };
    const rollenZahlen = {};
    for (const [wert, rolle] of Object.entries(gesamt.coinRolls || {})) if (Number(rolle && rolle.rolls) > 0) rollenZahlen[wert] = Number(rolle.rolls);
    const beleg = {
      f: 'KC_UEBERGABE_PROTOKOLL', v: 1,
      id: (global.crypto && global.crypto.randomUUID) ? global.crypto.randomUUID() : String(Date.now()),
      tid: payload.transferId || null,
      typ: payload.type,
      datum: payload.effectiveDate,
      erstellt: new Date().toISOString(),
      art: payload.scope === 'split' ? 'kassette' : 'einzel',
      kassen: payload.scope === 'split' ? payload.registerIds : [payload.registerId],
      lose: nurGefuellt(gesamt.looseBreakdown),
      rollen: rollenZahlen,
      summe: payload.total,
      notiz: payload.note || '',
    };
    // Bei der Kassette zusätzlich der Anteil der ersten Kasse - daraus lässt sich die
    // Aufteilung vollständig nachrechnen, ohne beide Anteile doppelt zu speichern.
    if (payload.scope === 'split') beleg.k1 = {kasse: payload.split.ersteKasse, lose: payload.split.lose, rollen: payload.split.rollen};
    beleg.pruef = pruefsumme(JSON.stringify(beleg));
    return kodieren(beleg);
  }

  // --- Lesen ----------------------------------------------------------------------------
  // Wirft mit Klartext-Begründung statt still etwas Halbes zurückzugeben: ein Beleg, dessen
  // Prüfsumme nicht stimmt, darf nicht ins Archiv - genau dafür ist sie da.
  function lesen(text) {
    const roh = String(text || '').trim();
    if (!roh.startsWith(PRAEFIX)) throw new Error('Das ist kein Übergabeprotokoll (erwartet wird ein Code, der mit KCPROT1 beginnt).');
    let beleg;
    try { beleg = entkodieren(roh); } catch (e) { throw new Error('Der Code lässt sich nicht entschlüsseln - vermutlich unvollständig abgetippt oder abgeschnitten.'); }
    if (!beleg || beleg.f !== 'KC_UEBERGABE_PROTOKOLL') throw new Error('Der Code enthält kein Übergabeprotokoll.');
    const kopie = JSON.parse(JSON.stringify(beleg)); const mitgeliefert = kopie.pruef; delete kopie.pruef;
    if (!mitgeliefert || pruefsumme(JSON.stringify(kopie)) !== mitgeliefert) throw new Error('Prüfsumme falsch - Beleg beschädigt oder verändert.');
    if (!beleg.id) throw new Error('Dem Beleg fehlt die Belegnummer.');
    if (!Number.isFinite(Number(beleg.summe))) throw new Error('Dem Beleg fehlt ein gültiger Betrag.');
    return beleg;
  }

  // --- Lokaler Verlauf (Rückfallebene ohne Dienst) --------------------------------------
  function lokalLesen() {
    try { return JSON.parse(localStorage.getItem(LOKAL_KEY) || '[]'); } catch (e) { return []; }
  }
  function lokalMerken(beleg) {
    if (!beleg || !beleg.id) return;
    const liste = lokalLesen().filter((x) => x.id !== beleg.id);
    liste.unshift(beleg);
    try { localStorage.setItem(LOKAL_KEY, JSON.stringify(liste.slice(0, 300))); } catch (e) { /* Speicher voll - der QR-Code auf dem Papier bleibt der Weg */ }
  }

  // --- Melden und laden -----------------------------------------------------------------
  // Bewusst ohne await an der Aufrufstelle: das Drucken des Protokolls darf nicht davon
  // abhängen, ob der Manager-Dienst gerade läuft. Ist er aus, trägt der QR-Code den Beleg.
  async function melden(beleg, quelle) {
    lokalMerken(beleg);
    try {
      const antwort = await fetch(`http://127.0.0.1:${DIENST_PORT}/bargeld/protokoll`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({beleg, quelle: quelle || 'money-butler'}),
        signal: AbortSignal.timeout(3000),
      });
      return antwort.ok;
    } catch (e) { return false; }
  }
  async function laden() {
    try {
      const antwort = await fetch(`http://127.0.0.1:${DIENST_PORT}/bargeld/protokolle`, {signal: AbortSignal.timeout(4000), cache: 'no-store'});
      if (!antwort.ok) throw new Error(String(antwort.status));
      return {liste: (await antwort.json()).protokolle || [], quelle: 'dienst'};
    } catch (e) {
      return {liste: lokalLesen(), quelle: 'lokal'};
    }
  }

  // --- Aufbereitung für die Anzeige -----------------------------------------------------
  // Rechnet die gespeicherten Stückzahlen in lesbare Zeilen und in die beiden Anteile um.
  const ROLL_INHALT = {2: 25, 1: 25, 0.5: 40, 0.2: 40, 0.1: 40, 0.05: 50, 0.02: 50, 0.01: 50};
  function anteile(beleg) {
    if (beleg.art !== 'kassette' || !beleg.k1) return null;
    const zweite = (beleg.kassen || []).find((k) => k !== beleg.k1.kasse) || 'Kasse 2';
    const summe = (lose, rollen) => {
      let s = 0;
      for (const [wert, anzahl] of Object.entries(lose || {})) s += Number(wert) * Number(anzahl || 0);
      for (const [wert, anzahl] of Object.entries(rollen || {})) s += Number(wert) * (ROLL_INHALT[Number(wert)] || 0) * Number(anzahl || 0);
      return +s.toFixed(2);
    };
    const rest = (gesamt, teil) => {
      const raus = {};
      for (const [wert, anzahl] of Object.entries(gesamt || {})) raus[wert] = Number(anzahl || 0) - Number((teil || {})[wert] || 0);
      return raus;
    };
    const zweiteLose = rest(beleg.lose, beleg.k1.lose), zweiteRollen = rest(beleg.rollen, beleg.k1.rollen);
    return [
      {kasse: beleg.k1.kasse, lose: beleg.k1.lose || {}, rollen: beleg.k1.rollen || {}, summe: summe(beleg.k1.lose, beleg.k1.rollen)},
      {kasse: zweite, lose: zweiteLose, rollen: zweiteRollen, summe: summe(zweiteLose, zweiteRollen)},
    ];
  }

  global.KCUebergabeprotokoll = {erzeugen, lesen, melden, laden, lokalLesen, anteile, pruefsumme, ROLL_INHALT, PRAEFIX};
})(window);
