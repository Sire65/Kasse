// Vorführdaten für die Präsentation.
//
// ZWECK: 6395 echte Buchungen über zwölf Markttage, damit Dashboard und Auswertungen etwas
// zu zeigen haben. Die Buchungen wurden von der Kasse selbst erzeugt (nicht nachgebaut), sonst
// würden die Summen beim Nachrechnen nicht aufgehen.
//
// BEWUSST NICHT AUTOMATISCH: Das Laden muss angestoßen werden. Ein Automatismus würde am
// echten Markttag Vorführdaten in die Auswertungen mischen - und das fiele erst beim
// Kassensturz auf. Deshalb zwei ausdrückliche Knöpfe: Laden und Entfernen.
(function (global) {
  'use strict';
  const el = (id) => document.getElementById(id);
  const MARKE = 'kcm_vorfuehrdaten_aktiv';

  async function laden() {
    const knopf = el('vfLaden');
    if (knopf) { knopf.disabled = true; knopf.textContent = 'Wird geladen …'; }
    try {
      const antwort = await fetch('vorfuehrung/daten.json', {cache: 'no-store'});
      const daten = await antwort.json();
      // Trinkgelder, Tagesabschlüsse und Bargeldbewegungen liegen daneben.
      //
      // BEFUND vor der Mitglieder-Präsentation: geladen wurden nur die Bons. In der
      // Auswertung stand deshalb "aktive Kassen: 1" (obwohl im Kopf "Kassen: 2" steht),
      // die Trinkgeld-Kennzahl blieb auf 0,00 € und der Kassenabschluss war leer.
      // Die Zusatzdaten sind aus denselben Bons abgeleitet - beim Nachrechnen geht es auf.
      let zusatz = {trinkgelder: [], abschluesse: [], bewegungen: []};
      try {
        const a2 = await fetch('vorfuehrung/zusatz.json', {cache: 'no-store'});
        if (a2.ok) zusatz = {...zusatz, ...(await a2.json())};
      } catch (e) { /* ohne Zusatzdaten funktioniert die Vorführung trotzdem */ }

      // Vorhandenen Bestand sichern, damit er beim Entfernen zurückkommt.
      if (!localStorage.getItem(MARKE)) {
        localStorage.setItem('kcm_sales_vor_vorfuehrung', localStorage.getItem('kcm_sales') || '[]');
        localStorage.setItem('kcm_tips_vor_vorfuehrung', localStorage.getItem('kcm_tips') || '[]');
        localStorage.setItem('kcm_closings_vor_vorfuehrung', localStorage.getItem('kcm_closings') || '[]');
        localStorage.setItem('kcm_cash_movements_vor_vorfuehrung', localStorage.getItem('kcm_cash_movements') || '[]');
      }
      localStorage.setItem('kcm_sales', JSON.stringify(daten));
      localStorage.setItem('kcm_tips', JSON.stringify(zusatz.trinkgelder || []));
      localStorage.setItem('kcm_closings', JSON.stringify(zusatz.abschluesse || []));
      localStorage.setItem('kcm_cash_movements', JSON.stringify(zusatz.bewegungen || []));
      localStorage.setItem(MARKE, new Date().toISOString());
      const kassen = new Set(daten.map((x) => x.registerId)).size;
      const tage = new Set(daten.map((x) => String(x.time || '').slice(0, 10))).size;
      melde(`${daten.length} Buchungen geladen: ${tage} Markttage, ${kassen} Kassen, `
        + `${(zusatz.trinkgelder || []).length} Trinkgelder, ${(zusatz.abschluesse || []).length} Tagesabschlüsse. `
        + 'Die Seite wird neu aufgebaut …', 'gut');
      setTimeout(() => location.reload(), 1200);
    } catch (fehler) {
      melde(`Konnte nicht geladen werden: ${fehler.message}`, 'warn');
      if (knopf) { knopf.disabled = false; knopf.textContent = 'Vorführdaten laden'; }
    }
  }

  function entfernen() {
    // Alle vier Bestände zurückholen - sonst bliebe nach dem Entfernen ein halber
    // Vorführstand stehen (Trinkgelder und Abschlüsse ohne die zugehörigen Bons).
    [['kcm_sales', 'kcm_sales_vor_vorfuehrung'],
     ['kcm_tips', 'kcm_tips_vor_vorfuehrung'],
     ['kcm_closings', 'kcm_closings_vor_vorfuehrung'],
     ['kcm_cash_movements', 'kcm_cash_movements_vor_vorfuehrung']].forEach(([ziel, sicherung]) => {
      localStorage.setItem(ziel, localStorage.getItem(sicherung) || '[]');
      localStorage.removeItem(sicherung);
    });
    localStorage.removeItem(MARKE);
    melde('Vorführdaten entfernt, vorheriger Stand wiederhergestellt. Die Seite wird neu aufgebaut …', 'gut');
    setTimeout(() => location.reload(), 1200);
  }

  function melde(text, art) {
    const feld = el('vfMeldung');
    if (feld) { feld.textContent = text; feld.className = `vf-meldung vf-${art}`; }
  }

  function starten() {
    if (!el('vfLaden')) return;
    el('vfLaden').onclick = laden;
    el('vfEntfernen').onclick = entfernen;
    const aktiv = localStorage.getItem(MARKE);
    // BEFUND: hier stand JSON.parse(localStorage 'kcm_sales').length - kcm_sales ist aber
    // KEINE einfache Liste, sondern eine gepackte Struktur. Die Anzeige lautete dadurch
    // wörtlich "Zurzeit undefined echte Buchungen im Manager." Gezählt wird jetzt über
    // dieselbe Stelle, die auch der Manager selbst benutzt.
    const anzahl = (() => {
      try {
        if (Array.isArray(global.sales)) return global.sales.length;
        const roh = localStorage.getItem('kcm_sales');
        const liste = global.KCSalesImportCore?.parseStorage?.(roh) || JSON.parse(roh || '[]');
        return Array.isArray(liste) ? liste.length : 0;
      } catch (e) { return 0; }
    })();
    melde(aktiv
      ? `Vorführdaten sind geladen (seit ${new Date(aktiv).toLocaleString('de-DE')}) – ${anzahl} Buchungen. Vor dem echten Markttag bitte entfernen.`
      : `Zurzeit ${anzahl} echte Buchungen im Manager.`, aktiv ? 'warn' : '');
    el('vfEntfernen').disabled = !aktiv;
  }

  document.querySelectorAll('[data-view="vorfuehrung"]').forEach((b) =>
    b.addEventListener('click', () => setTimeout(starten, 80)));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', starten);
  else starten();
})(window);
