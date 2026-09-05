// Preisliste zum Aushang am Verkaufsstand.
//
// ZWECK: Zu jedem Artikel stehen die Preise fuer 1 bis 10 Stueck nebeneinander. Das ist keine
// Mengenstaffel, sondern eine Rechenhilfe - drei Punsch, ein Blick, 13,50 kassieren.
// Der Aushang ist ausdruecklich NUR fuer Mitarbeiter, nicht fuer Kunden.
//
// ALLES AUS DEN ARTIKELDATEN: nichts wird von Hand gepflegt. Wird ein Preis in den Stammdaten
// geaendert, ist die naechste gedruckte Liste automatisch richtig. Genau der Fehler, der sonst
// passiert: der Aushang sagt 5,00 und die Kasse sagt 5,50.
(function (global) {
  'use strict';

  const el = (id) => document.getElementById(id);
  const geld = (v) => Number(v || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  // Die Artikel- und Gruppendaten liegen im Manager als globale Listen vor.
  const artikelListe = () => (Array.isArray(global.articles) ? global.articles : []);
  const gruppenListe = () => (Array.isArray(global.groups) ? global.groups : []);

  // Pfandbetrag eines Artikels. Der Manager fuehrt Pfand als eigene Artikel geführt
  // (Glaspfand, Feuerzange); hier wird der Aufschlag herangezogen, der beim Verkauf
  // automatisch dazukommt.
  function pfandBetrag(artikel) {
    if (!artikel || artikel.category === 'Pfand') return 0;
    const regel = artikel.depositRule;
    if (regel === 'none') return 0;
    const pfandartikel = artikelListe().filter((a) => a.category === 'Pfand' && Number(a.price) > 0);
    if (!pfandartikel.length) return 0;
    // Feuerzangenbowle traegt Glas UND Zange, alle anderen Getraenke nur das Glas.
    const name = String(artikel.name || '').toLowerCase();
    if (/feuerzange|zange/.test(name)) return pfandartikel.reduce((s, a) => s + Number(a.price), 0);
    if (artikel.category === 'Getränke') {
      const glas = pfandartikel.find((a) => /glas/i.test(a.name));
      return glas ? Number(glas.price) : 0;
    }
    return 0;
  }

  function ausgewaehlteGruppen() {
    return [...document.querySelectorAll('#plGruppen input[type=checkbox]:checked')].map((b) => b.value);
  }

  function gruppenAuswahlZeichnen() {
    const feld = el('plGruppen');
    if (!feld) return;
    const vorhandene = [...new Set(artikelListe().map((a) => a.category).filter(Boolean))];
    feld.innerHTML = '<span class="pl-gruppen-titel">Warengruppen:</span>' + vorhandene.map((g) =>
      `<label class="check">${esc(g)}<input type="checkbox" value="${esc(g)}" checked></label>`).join('');
    feld.querySelectorAll('input').forEach((b) => b.addEventListener('change', zeichnen));
  }

  // Aus einem Artikel werden bis zu zwei Zeilen: der Artikel selbst und - wenn gewuenscht und
  // Pfand anfaellt - eine zweite Zeile mit Pfand. So steht der Betrag da, den der Kunde
  // wirklich zahlt, ohne dass jemand im Kopf addieren muss.
  function zeilenFuer(artikel, mitPfand) {
    const zeilen = [{name: artikel.name, preis: Number(artikel.price) || 0, pfandzeile: false}];
    const pfand = mitPfand ? pfandBetrag(artikel) : 0;
    if (pfand > 0) {
      zeilen.push({name: `${artikel.name} + Pfand`, preis: (Number(artikel.price) || 0) + pfand, pfandzeile: true});
    }
    return zeilen;
  }

  function zeichnen() {
    const ziel = el('plVorschau');
    if (!ziel) return;
    const gruppen = ausgewaehlteGruppen();
    const mitPfand = el('plPfand')?.checked !== false;
    const mitAusverkauft = el('plAusverkauft')?.checked !== false;
    const titel = el('plTitel')?.value.trim() || 'Preisliste';
    const jahr = el('plJahr')?.value || new Date().getFullYear();

    const passend = artikelListe().filter((a) =>
      a && a.active !== false
      && a.priceListVisible !== false          // der vorhandene Haken "PL - Preisliste"
      && Number(a.price) > 0                    // Rueckgaben und Abzuege gehoeren nicht auf den Aushang
      && gruppen.includes(a.category)
      && (mitAusverkauft || !a.soldOut));

    if (!passend.length) {
      ziel.innerHTML = '<p class="pl-leer">Keine Artikel ausgewählt. Bitte Warengruppen anhaken oder in den Stammdaten den Haken „PL · Preisliste“ setzen.</p>';
      el('plMeldung').textContent = '';
      return;
    }

    // Nach Warengruppe sortiert, innerhalb der Gruppe in der Reihenfolge der Stammdaten.
    const reihenfolge = gruppenListe().reduce((m, g) => (m[g.name] = g.sortOrder ?? 999, m), {});
    const nachGruppe = {};
    passend.forEach((a) => { (nachGruppe[a.category] = nachGruppe[a.category] || []).push(a); });
    const sortiert = Object.keys(nachGruppe).sort((a, b) => (reihenfolge[a] ?? 999) - (reihenfolge[b] ?? 999));

    const kopfSpalten = Array.from({length: 10}, (_, i) => `<th>${i + 1}</th>`).join('');
    let zeilenZahl = 0;
    const abschnitte = sortiert.map((gruppe) => {
      const farbe = gruppenListe().find((g) => g.name === gruppe)?.color || '#334155';
      const zeilen = nachGruppe[gruppe].flatMap((a) => zeilenFuer(a, mitPfand));
      zeilenZahl += zeilen.length;
      return `<tr class="pl-gruppenzeile" style="--pl-farbe:${esc(farbe)}"><th colspan="11">${esc(gruppe)}</th></tr>`
        + zeilen.map((z) => `<tr class="${z.pfandzeile ? 'pl-pfand' : ''}">
            <td class="pl-name">${esc(z.name)}</td>
            ${Array.from({length: 10}, (_, i) => `<td>${geld(z.preis * (i + 1))}</td>`).join('')}
          </tr>`).join('');
    }).join('');

    ziel.innerHTML = `
      <div class="pl-blatt" id="plBlatt" data-tablecore="off">
        <header class="pl-kopf">
          <h2>${esc(titel)} ${esc(jahr)}</h2>
          <span class="pl-nurintern">Nur für Mitarbeiter · nicht für Kunden</span>
        </header>
        <table class="pl-tabelle">
          <thead><tr><th class="pl-name">Artikel</th>${kopfSpalten}</tr></thead>
          <tbody>${abschnitte}</tbody>
        </table>
        <footer class="pl-fuss">
          <span>${new Date().toLocaleDateString('de-DE')}</span>
          <span>Köcheclub Werne</span>
          <span class="pl-seite">Seite 1</span>
        </footer>
      </div>`;
    el('plMeldung').textContent = `${passend.length} Artikel, ${zeilenZahl} Zeilen in ${sortiert.length} Warengruppe(n).`;
  }

  function drucken() {
    if (!el('plBlatt')) zeichnen();
    if (!el('plBlatt')) return;
    // Nur das Blatt drucken - die Bedienoberflaeche des Managers bleibt aussen vor.
    document.body.classList.add('print-pricelist');
    const aufraeumen = () => document.body.classList.remove('print-pricelist');
    global.addEventListener('afterprint', aufraeumen, {once: true});
    setTimeout(aufraeumen, 3000);   // Sicherheitsnetz, falls afterprint ausbleibt
    global.print();
  }

  function starten() {
    if (!el('plVorschau')) return;
    if (el('plJahr') && !el('plJahr').value) el('plJahr').value = new Date().getFullYear();
    gruppenAuswahlZeichnen();
    zeichnen();
    el('plAktualisieren')?.addEventListener('click', () => { gruppenAuswahlZeichnen(); zeichnen(); });
    el('plDrucken')?.addEventListener('click', drucken);
    ['plTitel', 'plJahr', 'plPfand', 'plAusverkauft'].forEach((id) =>
      el(id)?.addEventListener('change', zeichnen));
  }

  // Beim Aufruf der Seite neu aufbauen, damit Preisaenderungen sofort sichtbar sind.
  document.querySelectorAll('[data-view="pricelist"]').forEach((b) =>
    b.addEventListener('click', () => setTimeout(starten, 60)));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', starten);
  else starten();

  global.KCPreisliste = {zeichnen, drucken, pfandBetrag, zeilenFuer};
})(window);
