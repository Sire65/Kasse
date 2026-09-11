/* KC Oberflächen — das Übergabeformat zwischen Baukasten und Kasse.   03.09.2026
 *
 * ANLASS (Betreiber): "Wenn das alles fertig ist, muss die Übergabe an das Kassensystem gebaut
 * werden, und so flexibel, dass jederzeit weitere dazukommen können." Und davor: "Dann können
 * wir auf unserer Kasse mehrere hinterlegen, die man per Umschalten auswählen kann."
 *
 * WARUM DIESE DATEI IN shared/ LIEGT
 * Sie wird von BEIDEN Seiten gebraucht - vom Baukasten beim Ausgeben und von der Kasse beim
 * Einlesen. Läge das Format zweimal vor, einmal hier und einmal dort, hätten wir genau die
 * Sorte zweiter Quelle, die in dieser Woche mehrfach die Ursache eines stillen Fehlers war.
 * Eine Datei, beide lesen sie.
 *
 * WAS IM FORMAT STEHT - UND WAS NICHT
 * Drin: welche Bausteine, an welchem RASTERPLATZ, wie beschriftet, wie eingestellt.
 * Nicht drin: Pixel (die rechnet die Kasse aus ihrer eigenen Bildschirmgröße), und kein
 * einziger Artikel. Artikel, Preise und Bilder stehen in den Stammdaten und gehören dem
 * Verein - eine Oberfläche beschreibt nur, WO die Artikelfläche sitzt.
 *
 * MEHRERE OBERFLÄCHEN
 * Eine Datei trägt eine LISTE. Neue kommen dazu, ohne dass etwas umgebaut werden muss; jede
 * hat ihre eigene Kennung, ihr Gerät und ihr Raster. Die Kasse zeigt die Liste und schaltet um.
 */
'use strict';
(function (global) {
  const FORMAT = 'kc-kassenoberflaechen';
  const VERSION = 1;

  /* Die Merkmale, die ein Baustein mitnimmt. Bewusst eine feste, benannte Liste: Würde hier
     "alles kopieren" stehen, wanderten irgendwann interne Rechenwerte mit, die auf der
     Kassenseite nichts zu suchen haben - und niemand würde es merken. */
  const MERKMALE = [
    ['text', 'text'], ['bg', 'farbe'], ['stroke', 'rahmenfarbe'], ['strokeWidth', 'rahmen'],
    ['radius', 'radius'], ['kcSymbol', 'symbol'], ['kcDarstellung', 'darstellung'],
    ['kcInfoEcke', 'infoEcke'], ['kcUnterEcke', 'unterEcke'], ['kcWarengruppe', 'warengruppe'],
    ['klappbar', 'klappbar'], ['drehen', 'drehen'], ['zoom', 'zoom'],
    /* Die Lupe am Warenkorb (03.09.2026). Sie muss mitreisen, sonst wäre sie im Designer
       eingestellt und käme an der Kasse nie an - eine Einstellung, die niemand sieht. */
    ['kcLupe', 'lupe'],
  ];

  const leer = (v) => v === undefined || v === null || v === '';

  /* -------------------------------------------------------------- Aus dem Baukasten heraus */
  function ausProjekt(projekt, angaben) {
    const g = (angaben && angaben.geraet) || {};
    const seiten = (projekt.slides || []).filter((s) => s.kcSeite).map((s) => ({
      art: s.kcSeite,
      name: s.name || s.kcSeite,
      bausteine: (s.items || []).filter((i) => i.kc).map((i) => {
        const b = { typ: i.type, spalte: i.kc.spalte, zeile: i.kc.zeile,
          spalten: i.kc.spalten, zeilen: i.kc.zeilen };
        MERKMALE.forEach(([quelle, ziel]) => { if (!leer(i[quelle])) b[ziel] = i[quelle]; });
        if (i.groupId) b.gruppe = i.groupId;
        return b;
      }),
    }));
    return {
      id: (angaben && angaben.id) || 'of-' + Date.now().toString(36),
      name: (angaben && angaben.name) || 'Oberfläche',
      geraet: g.id || (projekt.kasse && projekt.kasse.geraet) || 'ipad-gross-quer',
      klasse: g.klasse || 'tablet',
      flaeche: { breite: projekt.page.width, hoehe: projekt.page.height },
      raster: (angaben && angaben.raster) || { spalten: 12, zeilen: 8, stufe: 'normal' },
      geaendert: new Date().toISOString(),
      seiten,
    };
  }

  const leereSammlung = () => ({ format: FORMAT, version: VERSION, oberflaechen: [] });

  /* Hinzufügen ODER ersetzen - nach Kennung. Damit kann jederzeit eine weitere dazukommen,
     und eine überarbeitete überschreibt ihre eigene alte Fassung statt sich daneben zu legen. */
  function einsortieren(sammlung, oberflaeche) {
    const s = pruefeSammlung(sammlung).sammlung || leereSammlung();
    const i = s.oberflaechen.findIndex((o) => o.id === oberflaeche.id);
    if (i >= 0) s.oberflaechen[i] = oberflaeche; else s.oberflaechen.push(oberflaeche);
    s.geaendert = new Date().toISOString();
    return s;
  }

  /* ------------------------------------------------------------------------- Nachprüfen
     Eine Sammlung, die falsch aussieht, wird NICHT stillschweigend zurechtgebogen. Die Kasse
     soll sagen können, was ihr nicht gefällt - eine Oberfläche, die halb ankommt, wäre der
     schlimmste Fall. */
  function pruefeSammlung(roh) {
    const maengel = [];
    let s = roh;
    if (typeof s === 'string') { try { s = JSON.parse(s); } catch (e) { return { maengel: ['Die Datei ist kein gültiges JSON.'] }; } }
    if (!s || typeof s !== 'object') return { maengel: ['Die Datei ist leer.'] };
    if (s.format !== FORMAT) maengel.push(`Fremdes Format: „${s.format || 'ohne Angabe'}“ statt „${FORMAT}“.`);
    if (Number(s.version) > VERSION) maengel.push(`Neuere Fassung ${s.version}; dieses Programm kennt ${VERSION}.`);
    if (!Array.isArray(s.oberflaechen)) maengel.push('Es fehlt die Liste der Oberflächen.');
    if (maengel.length) return { maengel };

    const kennungen = new Set();
    s.oberflaechen.forEach((o, n) => {
      const wo = `Oberfläche ${n + 1} (${o && o.name ? o.name : 'ohne Namen'})`;
      if (!o || !o.id) { maengel.push(`${wo}: ohne Kennung.`); return; }
      if (kennungen.has(o.id)) maengel.push(`${wo}: Kennung „${o.id}“ kommt zweimal vor.`);
      kennungen.add(o.id);
      if (!o.raster || !o.raster.spalten || !o.raster.zeilen) maengel.push(`${wo}: ohne Raster.`);
      if (!Array.isArray(o.seiten) || !o.seiten.length) { maengel.push(`${wo}: ohne Seiten.`); return; }
      o.seiten.forEach((se) => {
        (se.bausteine || []).forEach((b) => {
          if (!b.typ) maengel.push(`${wo}, Seite „${se.art}“: Baustein ohne Typ.`);
          ['spalte', 'zeile', 'spalten', 'zeilen'].forEach((f) => {
            if (!Number.isInteger(b[f])) maengel.push(`${wo}: „${b.typ}“ ohne ${f}.`);
          });
          if (o.raster && Number.isInteger(b.spalte)) {
            if (b.spalte + b.spalten > o.raster.spalten || b.zeile + b.zeilen > o.raster.zeilen) {
              maengel.push(`${wo}: „${b.typ}“ ragt über das Raster hinaus.`);
            }
          }
          /* Ein Artikelname im Aufbau wäre ein Rückfall in die zweite Quelle. */
          if (b.artikel || b.preis || b.bild) maengel.push(`${wo}: „${b.typ}“ trägt Artikeldaten – die gehören in die Stammdaten.`);
        });
      });
    });
    return { sammlung: s, maengel };
  }

  /* Was kann die Kasse davon schon? Sie sagt, welche Bausteine sie kennt; alles andere wird
     BENANNT statt übergangen. Eine Oberfläche, die stillschweigend halb erscheint, ist
     schlimmer als eine, die sich meldet. */
  function abgleichen(oberflaeche, bekannteTypen) {
    const bekannt = new Set(bekannteTypen || []);
    const fehlend = new Map();
    (oberflaeche.seiten || []).forEach((se) => (se.bausteine || []).forEach((b) => {
      if (!bekannt.has(b.typ)) fehlend.set(b.typ, (fehlend.get(b.typ) || 0) + 1);
    }));
    const gesamt = (oberflaeche.seiten || []).reduce((n, se) => n + (se.bausteine || []).length, 0);
    const unbekannt = [...fehlend.entries()].map(([typ, n]) => ({ typ, anzahl: n }));
    return {
      gesamt,
      darstellbar: gesamt - unbekannt.reduce((n, u) => n + u.anzahl, 0),
      unbekannt,
      vollstaendig: unbekannt.length === 0,
    };
  }

  const API = { FORMAT, VERSION, MERKMALE, ausProjekt, leereSammlung, einsortieren, pruefeSammlung, abgleichen };
  if (typeof module === 'object' && module.exports) module.exports = API;
  global.KCOberflaechenFormat = API;
})(typeof window !== 'undefined' ? window : globalThis);
