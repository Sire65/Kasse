// Happy Hour - Zeitplan und Preisfindung, gemeinsam für PC-Manager und Kasse.
//
// WARUM EIN GEMEINSAMES MODUL
// Der Manager legt fest, WANN die Happy Hour gilt und WELCHER Preis dann greift; die Kasse
// muss zur selben Sekunde zum selben Ergebnis kommen. Zwei getrennte Rechnungen wären der
// sichere Weg zu einer Kasse, die 5,00 € nimmt, während im Manager 4,50 € steht. Deshalb
// rechnet hier EINE Stelle, und beide Programme fragen sie.
//
// DAS MODELL
//   {
//     aktiv:    true,
//     zeitraum: {von:'2026-11-27', bis:'2026-12-23'},   // der Weihnachtsmarkt
//     standard: [{von:'17:00', bis:'18:00'}],            // gilt an JEDEM Markttag, bis zu 3
//     ausnahmen:[
//       {datum:'2026-12-06', aus:true},                             // an dem Tag keine Happy Hour
//       {datum:'2026-12-24', fenster:[{von:'11:00', bis:'12:00'}]}  // an dem Tag andere Zeiten
//     ]
//   }
//
// Der PREIS steht nicht hier, sondern am Artikel (Felder hhAktiv und hhPreis). Das ist
// Absicht: ein Prozentsatz macht krumme Beträge - 10 % auf 5,50 € sind 4,95 €. Am Stand
// zählt jemand Wechselgeld ab; da will man 5,00 €. Jeder teilnehmende Artikel trägt deshalb
// seinen eigenen, runden Happy-Hour-Preis.
//
// WICHTIG ZUM VERHALTEN AN DER KASSE (gemessen, nicht angenommen): der Preis wird in dem
// Moment eingefroren, in dem der Artikel in den Bon wandert. Läuft die Happy Hour eine
// Sekunde später aus, behält die Zeile ihren Happy-Hour-Preis; der nächste Artikel bekommt
// wieder den regulären. Dieses Verhalten steckt in der Kasse selbst und wird hier nur
// mit Zeitfenstern versorgt.
(function (global) {
  'use strict';

  const MAX_FENSTER = 3;          // bis zu drei Zeitbereiche je Tag
  const ZEIT = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const DATUM = /^\d{4}-\d{2}-\d{2}$/;

  const leererPlan = () => ({aktiv: false, zeitraum: {von: '', bis: ''}, standard: [], ausnahmen: []});

  const minuten = (zeit) => { const t = ZEIT.exec(String(zeit || '')); return t ? Number(t[1]) * 60 + Number(t[2]) : null; };
  const alsDatum = (d) => {
    if (d instanceof Date) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return String(d || '');
  };

  // Einen Plan in eine saubere Form bringen - alles, was nicht passt, fliegt still heraus.
  // Geprüft (mit Meldungen für den Benutzer) wird in pruefePlan.
  function normalisiere(roh) {
    const plan = leererPlan();
    if (!roh || typeof roh !== 'object') return plan;
    plan.aktiv = roh.aktiv === true;
    plan.zeitraum = {
      von: DATUM.test(roh.zeitraum?.von || '') ? roh.zeitraum.von : '',
      bis: DATUM.test(roh.zeitraum?.bis || '') ? roh.zeitraum.bis : '',
    };
    const fenster = (liste) => (Array.isArray(liste) ? liste : [])
      .map((f) => ({von: String(f?.von || ''), bis: String(f?.bis || '')}))
      .filter((f) => ZEIT.test(f.von) && ZEIT.test(f.bis) && minuten(f.bis) > minuten(f.von))
      .slice(0, MAX_FENSTER);
    plan.standard = fenster(roh.standard);
    plan.ausnahmen = (Array.isArray(roh.ausnahmen) ? roh.ausnahmen : [])
      .filter((a) => a && DATUM.test(a.datum))
      .map((a) => (a.aus === true ? {datum: a.datum, aus: true} : {datum: a.datum, fenster: fenster(a.fenster)}))
      .filter((a) => a.aus === true || a.fenster.length > 0);
    return plan;
  }

  // Verständliche Prüfung für die Eingabe im Manager.
  function pruefePlan(roh) {
    const fehler = [], hinweise = [];
    const p = roh && typeof roh === 'object' ? roh : {};
    if (p.aktiv) {
      if (!DATUM.test(p.zeitraum?.von || '') || !DATUM.test(p.zeitraum?.bis || '')) {
        fehler.push('Bitte den Zeitraum des Weihnachtsmarkts mit Anfangs- und Enddatum eintragen.');
      } else if (p.zeitraum.bis < p.zeitraum.von) {
        fehler.push('Das Enddatum des Weihnachtsmarkts liegt vor dem Anfangsdatum.');
      }
      const standard = Array.isArray(p.standard) ? p.standard.filter((f) => f && (f.von || f.bis)) : [];
      if (!standard.length && !(Array.isArray(p.ausnahmen) && p.ausnahmen.some((a) => a && !a.aus && Array.isArray(a.fenster) && a.fenster.length))) {
        fehler.push('Es ist kein einziges Zeitfenster eingetragen - so würde die Happy Hour nie greifen.');
      }
      fehler.push(...pruefeFenster(standard, 'Standardzeiten'));
      (Array.isArray(p.ausnahmen) ? p.ausnahmen : []).forEach((a) => {
        if (!a) return;
        // Ein Ausnahmetag außerhalb des Marktzeitraums gilt trotzdem (er wurde ja ausdrücklich
        // eingetragen) - aber der Benutzer soll es merken, falls er sich vertippt hat.
        if (DATUM.test(a.datum) && DATUM.test(p.zeitraum?.von || '') && DATUM.test(p.zeitraum?.bis || '')
            && (a.datum < p.zeitraum.von || a.datum > p.zeitraum.bis)) {
          hinweise.push(`Der Ausnahmetag ${a.datum} liegt außerhalb des Marktzeitraums (${p.zeitraum.von} bis ${p.zeitraum.bis}) - er gilt trotzdem. Bitte prüfen, ob das Datum stimmt.`);
        }
        if (a.aus) return;
        fehler.push(...pruefeFenster((a.fenster || []).filter((f) => f && (f.von || f.bis)), `Ausnahme am ${a.datum}`));
      });
    }
    return {ok: fehler.length === 0, fehler, hinweise};
  }

  function pruefeFenster(liste, wo) {
    const fehler = [];
    if (liste.length > MAX_FENSTER) fehler.push(`${wo}: mehr als ${MAX_FENSTER} Zeitbereiche sind nicht vorgesehen.`);
    const gueltig = [];
    liste.forEach((f, i) => {
      const nr = `${wo}, ${i + 1}. Zeitbereich`;
      if (!ZEIT.test(f.von) || !ZEIT.test(f.bis)) { fehler.push(`${nr}: bitte Uhrzeiten als Stunde:Minute eintragen, zum Beispiel 17:00.`); return; }
      if (minuten(f.bis) <= minuten(f.von)) { fehler.push(`${nr}: das Ende (${f.bis}) liegt nicht nach dem Anfang (${f.von}).`); return; }
      gueltig.push(f);
    });
    // Überschneidungen: sonst gilt zweimal derselbe Preis und niemand weiß, welcher.
    const sortiert = gueltig.slice().sort((a, b) => minuten(a.von) - minuten(b.von));
    for (let i = 1; i < sortiert.length; i++) {
      if (minuten(sortiert[i].von) < minuten(sortiert[i - 1].bis)) {
        fehler.push(`${wo}: die Zeitbereiche ${sortiert[i - 1].von}–${sortiert[i - 1].bis} und ${sortiert[i].von}–${sortiert[i].bis} überschneiden sich.`);
      }
    }
    return fehler;
  }

  // Welche Zeitfenster gelten an einem bestimmten Tag?
  // Reihenfolge: eine ausdrücklich eingetragene Ausnahme schlägt alles, danach entscheidet
  // der Marktzeitraum über die Standardzeiten.
  //
  // WARUM DIE AUSNAHME VORGEHT (beim Ausprobieren aufgefallen): zuerst wurde der Zeitraum
  // geprüft - ein Ausnahmetag einen Tag nach Marktende fiel damit stillschweigend unter den
  // Tisch, obwohl jemand ihn ausdrücklich mit Uhrzeiten eingetragen hatte. Wer ein Datum
  // hinschreibt, meint es. Liegt es außerhalb des Zeitraums, sagt der Manager das deutlich
  // (siehe pruefePlan), statt die Eingabe wortlos zu verschlucken.
  function fensterFuerTag(rohPlan, tag) {
    const plan = normalisiere(rohPlan);
    const datum = alsDatum(tag || new Date());
    if (!plan.aktiv) return [];
    const ausnahme = plan.ausnahmen.find((a) => a.datum === datum);
    if (ausnahme) return ausnahme.aus ? [] : ausnahme.fenster.slice();
    if (plan.zeitraum.von && datum < plan.zeitraum.von) return [];
    if (plan.zeitraum.bis && datum > plan.zeitraum.bis) return [];
    return plan.standard.slice();
  }

  // Läuft die Happy Hour gerade, und wenn ja bis wann?
  function laeuftGerade(rohPlan, jetzt = new Date()) {
    const fenster = fensterFuerTag(rohPlan, jetzt);
    const min = jetzt.getHours() * 60 + jetzt.getMinutes();
    const treffer = fenster.find((f) => min >= minuten(f.von) && min < minuten(f.bis));
    const naechstes = fenster.filter((f) => minuten(f.von) > min).sort((a, b) => minuten(a.von) - minuten(b.von))[0] || null;
    return {aktiv: !!treffer, fenster: treffer || null, naechstes, alleHeute: fenster};
  }

  // Teilnehmende Artikel: angehakt UND mit gültigem, günstigerem Preis.
  // Die Regel "angehakt ohne Preis" wird im Manager schon beim Speichern verhindert; hier
  // steht die zweite Sperre, damit ein alter Datenbestand nicht plötzlich zum Nulltarif verkauft.
  function teilnehmer(artikel) {
    return (Array.isArray(artikel) ? artikel : []).filter((a) => {
      if (!a || a.hhAktiv !== true) return false;
      const hh = Number(a.hhPreis), normal = Number(a.price);
      return Number.isFinite(hh) && hh > 0 && Number.isFinite(normal) && hh < normal;
    });
  }

  // Den Plan in die Angebotsform übersetzen, die die Kasse ohnehin schon versteht.
  // BEWUSST SO: dadurch bleibt die geprüfte Preis- und Bonlogik der Kasse unangetastet -
  // je Artikel und Zeitfenster ein Angebot mit festem Preis, gültig nur an diesem einen Tag.
  function alsAngebote(rohPlan, artikel, tag) {
    const datum = alsDatum(tag || new Date());
    const fenster = fensterFuerTag(rohPlan, datum);
    if (!fenster.length) return [];
    const liste = teilnehmer(artikel);
    if (!liste.length) return [];
    const angebote = [];
    fenster.forEach((f, i) => {
      liste.forEach((a) => {
        angebote.push({
          id: `HH-${datum}-${i + 1}-${a.id}`,
          name: `Happy Hour ${f.von}–${f.bis} · ${a.name}`,
          type: 'happyhour',
          productIds: [a.id],
          priceMode: 'fixed',
          priceValue: Number(a.hhPreis),
          startDate: datum, endDate: datum,
          startTime: f.von, endTime: f.bis,
          weekdays: [0, 1, 2, 3, 4, 5, 6],
          active: true, manualStart: false,
          note: 'Automatisch aus dem Happy-Hour-Zeitplan des PC-Managers erzeugt.',
          ausZeitplan: true,
        });
      });
    });
    return angebote;
  }

  // Kurzfassung für die Anzeige, z. B. "17:00–18:00 und 20:00–21:00".
  function fensterText(fenster) {
    const teile = (fenster || []).map((f) => `${f.von}–${f.bis}`);
    if (!teile.length) return 'keine';
    if (teile.length === 1) return teile[0];
    return teile.slice(0, -1).join(', ') + ' und ' + teile[teile.length - 1];
  }

  global.KCHappyHour = {
    MAX_FENSTER, leererPlan, normalisiere, pruefePlan, fensterFuerTag,
    laeuftGerade, teilnehmer, alsAngebote, fensterText, minuten, alsDatum,
  };
})(typeof window !== 'undefined' ? window : globalThis);
