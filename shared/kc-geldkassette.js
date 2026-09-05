// Geldkassette: eine Erfassung, zwei Geldladen.
//
// ZWECK (User): Der Kassenwart bringt morgens EINE Geldkassette. An der Kasse gibt es keine
// Schublade, sondern unten im Schrank je Kasse eine Geldlade - das Kassettengeld wird auf beide
// verteilt. Erfasst wird der Inhalt genau einmal, nicht zweimal getrennt.
//
// EIN Modul für BEIDE Stellen (eigenständiger Money Butler und PC-Manager). Ausdrücklicher
// Wunsch: "es soll gleich sein" - fällt der Kassenwart aus, macht der PC-Manager dieselbe
// Aufgabe. Deshalb liegen Bedienoberfläche UND Rechnung hier an einer Stelle; zwei Nachbauten
// würden über kurz oder lang auseinanderlaufen, und dann rechnet eine Seite anders als die andere.
//
// GRUNDREGEL der Aufteilung: eingetragen wird nur der Anteil der ERSTEN Kasse, die zweite ist
// immer der Rest. Dadurch kann die Summe technisch gar nicht auseinanderlaufen.
(function (global) {
  'use strict';

  const KASSEN = ['KASSE-01', 'KASSE-02'];
  const geld = (v) => Number(v || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' €';
  const schluessel = (art, wert) => `${art}-${wert}`;

  // Erzeugt einen Aufteilungsbereich in einem vorhandenen Container.
  //   container    Element, in das gezeichnet wird
  //   sortenLesen  Funktion, die die aktuell erfassten Sorten liefert:
  //                [{art:'lose'|'rolle', wert, anzahl, coinsPerRoll?, label}]
  //   gesamtLesen  Funktion, die den Gesamtbetrag der Kassette liefert
  //   beiAenderung wird nach jeder Änderung der Aufteilung gerufen
  function erstelle({container, sortenLesen, gesamtLesen, beiAenderung, kassen}) {
    const beteiligte = kassen && kassen.length === 2 ? kassen.slice() : KASSEN.slice();
    const gemerkt = {};   // schluessel -> Stückzahl für die erste Kasse

    container.innerHTML = `
      <p class="kckass-hinweis">Eingetragen wird nur der Anteil für ${beteiligte[0]} – der Rest geht automatisch an ${beteiligte[1]}. Vorschlag ist jeweils die Hälfte.</p>
      <div class="kckass-aktionen">
        <button type="button" data-kckass="halb">Vorschlag: halbe/halbe</button>
        <button type="button" data-kckass="k1">Alles an ${beteiligte[0]}</button>
        <button type="button" data-kckass="k2">Alles an ${beteiligte[1]}</button>
      </div>
      <div class="kckass-kopf" aria-hidden="true"><span>Sorte</span><span>In der Kassette</span><span>${beteiligte[0]}</span><span>${beteiligte[1]}</span></div>
      <div class="kckass-liste"></div>
      <div class="kckass-summe">
        <span>${beteiligte[0]} <b data-kckass-summe="1">${geld(0)}</b></span>
        <span>${beteiligte[1]} <b data-kckass-summe="2">${geld(0)}</b></span>
        <span>Kassette gesamt <strong data-kckass-summe="gesamt">${geld(0)}</strong></span>
      </div>
      <p class="kckass-warnung" data-kckass-warnung></p>`;

    const liste = container.querySelector('.kckass-liste');
    const feld = (was) => container.querySelector(`[data-kckass-summe="${was}"]`);
    const warnung = container.querySelector('[data-kckass-warnung]');

    const anteilFuer = (sorte) => {
      const wert = gemerkt[schluessel(sorte.art, sorte.wert)];
      if (!Number.isFinite(wert)) return Math.floor(sorte.anzahl / 2);
      return Math.min(Math.max(0, wert), sorte.anzahl);
    };

    // Beide Anteile als vollständige Datensätze - genau so, wie sie eine Einzelübergabe hätte.
    function anteile() {
      const leer = () => ({looseBreakdown: {}, breakdown: {}, coinRolls: {}, looseTotal: 0, rollTotal: 0});
      const teile = {}; beteiligte.forEach((k) => (teile[k] = leer()));
      sortenLesen().forEach((sorte) => {
        const erste = anteilFuer(sorte);
        const verteilung = {[beteiligte[0]]: erste, [beteiligte[1]]: sorte.anzahl - erste};
        beteiligte.forEach((kasse) => {
          const anzahl = verteilung[kasse], ziel = teile[kasse];
          if (sorte.art === 'lose') {
            ziel.looseBreakdown[sorte.wert] = anzahl;
            ziel.breakdown[sorte.wert] = (ziel.breakdown[sorte.wert] || 0) + anzahl;
            ziel.looseTotal += anzahl * sorte.wert;
          } else {
            const muenzen = anzahl * sorte.coinsPerRoll, wertJeRolle = sorte.wert * sorte.coinsPerRoll;
            ziel.coinRolls[sorte.wert] = {rolls: anzahl, coinsPerRoll: sorte.coinsPerRoll, coinCount: muenzen,
              valuePerRoll: +wertJeRolle.toFixed(2), total: +(anzahl * wertJeRolle).toFixed(2)};
            ziel.breakdown[sorte.wert] = (ziel.breakdown[sorte.wert] || 0) + muenzen;
            ziel.rollTotal += anzahl * wertJeRolle;
          }
        });
      });
      beteiligte.forEach((kasse) => {
        const ziel = teile[kasse];
        ziel.looseTotal = +ziel.looseTotal.toFixed(2);
        ziel.rollTotal = +ziel.rollTotal.toFixed(2);
        ziel.total = +(ziel.looseTotal + ziel.rollTotal).toFixed(2);
      });
      return teile;
    }

    // Nur der Anteil der ersten Kasse wandert in den Code - die zweite ergibt sich als Rest aus
    // der ohnehin mitgelieferten Kassetten-Stückelung. Beide Anteile vollständig mitzuschicken
    // hat den QR-Code im Test gesprengt ("code length overflow").
    function kompakt() {
      const raus = {ersteKasse: beteiligte[0], lose: {}, rollen: {}};
      sortenLesen().forEach((sorte) => {
        const erste = anteilFuer(sorte);
        if (erste > 0) raus[sorte.art === 'lose' ? 'lose' : 'rollen'][sorte.wert] = erste;
      });
      return raus;
    }

    function summenAktualisieren() {
      const teile = anteile(), gesamt = Number(gesamtLesen() || 0);
      feld('1').textContent = geld(teile[beteiligte[0]].total);
      feld('2').textContent = geld(teile[beteiligte[1]].total);
      feld('gesamt').textContent = geld(gesamt);
      const summe = +(teile[beteiligte[0]].total + teile[beteiligte[1]].total).toFixed(2);
      warnung.textContent = Math.abs(summe - gesamt) < 0.005 ? ''
        : `Achtung: die Anteile ergeben ${geld(summe)}, die Kassette enthält aber ${geld(gesamt)}.`;
    }

    function zeichnen() {
      const sorten = sortenLesen();
      if (!sorten.length) {
        liste.innerHTML = '<p class="kckass-leer">Noch nichts eingetragen - bitte oben den Inhalt der Kassette erfassen.</p>';
        feld('1').textContent = geld(0); feld('2').textContent = geld(0); feld('gesamt').textContent = geld(0);
        warnung.textContent = '';
        return;
      }
      liste.innerHTML = sorten.map((sorte) => {
        const erste = anteilFuer(sorte);
        return `<label class="kckass-zeile" data-art="${sorte.art}" data-wert="${sorte.wert}">
          <strong>${sorte.label}</strong>
          <span class="kckass-gesamt">${sorte.anzahl}</span>
          <span class="kckass-eingabe"><input type="number" min="0" max="${sorte.anzahl}" step="1" value="${erste}" inputmode="numeric" data-kckass-art="${sorte.art}" data-kckass-wert="${sorte.wert}" aria-label="Anteil ${beteiligte[0]} - ${sorte.label}"></span>
          <span class="kckass-rest" data-rest-art="${sorte.art}" data-rest-wert="${sorte.wert}">${sorte.anzahl - erste}</span>
        </label>`;
      }).join('');
      liste.querySelectorAll('[data-kckass-art]').forEach((eingabe) => {
        eingabe.oninput = () => {
          const art = eingabe.dataset.kckassArt, wert = parseFloat(eingabe.dataset.kckassWert), grenze = parseInt(eingabe.max, 10);
          let anzahl = parseInt(eingabe.value, 10);
          if (!Number.isFinite(anzahl)) anzahl = 0;
          anzahl = Math.min(Math.max(0, anzahl), grenze);
          eingabe.value = anzahl;
          gemerkt[schluessel(art, wert)] = anzahl;
          container.querySelector(`[data-rest-art="${art}"][data-rest-wert="${wert}"]`).textContent = grenze - anzahl;
          summenAktualisieren();
          if (beiAenderung) beiAenderung();
        };
      });
      summenAktualisieren();
    }

    container.querySelectorAll('[data-kckass]').forEach((knopf) => {
      knopf.addEventListener('click', () => {
        const modus = knopf.dataset.kckass;
        sortenLesen().forEach((sorte) => {
          gemerkt[schluessel(sorte.art, sorte.wert)] = modus === 'k1' ? sorte.anzahl : modus === 'k2' ? 0 : Math.floor(sorte.anzahl / 2);
        });
        zeichnen();
        if (beiAenderung) beiAenderung();
      });
    });

    // Ergänzt eine fertige Einzelübergabe um alles, was aus ihr eine Kassettenübergabe macht.
    // Gibt einen Fehlertext zurück, wenn die Aufteilung nicht abgeschickt werden darf.
    function anPayload(payload, pruefsumme) {
      const teile = anteile();
      const leer = beteiligte.filter((k) => teile[k].total <= 0);
      if (leer.length) {
        const andere = beteiligte.find((k) => !leer.includes(k));
        return {fehler: `${leer.join(' und ')} bekommt nichts aus dieser Kassette.\n\nWenn das Geld komplett an ${andere} gehen soll, oben als Ziel direkt diese Kasse auswählen.`};
      }
      const summe = +beteiligte.reduce((s, k) => s + teile[k].total, 0).toFixed(2);
      if (Math.abs(summe - Number(payload.total)) > 0.005) {
        return {fehler: `Die Anteile ergeben ${geld(summe)}, die Kassette enthält aber ${geld(payload.total)}. Bitte die Aufteilung prüfen.`};
      }
      payload.version = 5;
      payload.scope = 'split';
      payload.poolId = `KASSETTE-${payload.effectiveDate}-${pruefsumme(beteiligte.join('|') + payload.transferId)}`;
      payload.poolName = 'Geldkassette';
      payload.registerIds = beteiligte.slice();
      payload.split = kompakt();
      delete payload.registerId;
      return {teile};
    }

    return {zeichnen, anteile, kompakt, anPayload, kassen: beteiligte};
  }

  global.KCGeldkassette = {erstelle, KASSEN, ZIEL: 'KASSETTE'};
})(window);
