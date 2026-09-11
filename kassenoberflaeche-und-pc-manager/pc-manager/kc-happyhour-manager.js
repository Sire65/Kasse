// Happy Hour im PC-Manager: Zeitplan für den Weihnachtsmarkt und Preis je Artikel.
//
// WAS HIER GESTEUERT WIRD
//   Artikelseite  - welcher Artikel nimmt teil und zu welchem Preis (Felder hhAktiv/hhPreis)
//   Diese Ansicht - an welchen Tagen und zu welchen Uhrzeiten die Happy Hour gilt
//
// Vorher gab es die Happy Hour nur als Beispielaktion im Servicebereich der KASSE; der
// PC-Manager kannte sie überhaupt nicht. Jetzt ist der Manager die Pflegestelle - wie bei
// Artikeln und Warengruppen auch.
//
// DER WEG ZUR KASSE
// Der Zeitplan liegt bewusst in den Einstellungen (settings.happyHour). Dadurch fährt er beim
// normalen Stammdaten-Abgleich mit, ohne dass am Manager-Dienst oder an der Datenbank etwas
// geändert werden musste. Die Preise je Artikel reisen ohnehin mit den Artikeln.
//
// GERECHNET WIRD NICHT HIER, sondern in shared/kc-happyhour.js - dieselbe Stelle, die auch die
// Kasse fragt. Sonst gäbe es zwei Rechnungen, die auseinanderlaufen können, und die Kasse
// nähme 5,00 €, während im Manager 4,50 € steht.
(function (global) {
  'use strict';

  const VERSION = '0.1.0';
  const el = (id) => document.getElementById(id);
  const HH = () => global.KCHappyHour;
  const geld = (n) => new Intl.NumberFormat('de-DE', {style: 'currency', currency: 'EUR'}).format(Number(n) || 0);
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

  // Der Plan lebt in den Einstellungen des Managers - dort, wo ihn der Abgleich mitnimmt.
  function planLesen() {
    const roh = (global.settings && global.settings.happyHour) || null;
    return HH().normalisiere(roh || HH().leererPlan());
  }
  function planSchreiben(plan) {
    if (!global.settings || typeof global.settings !== 'object') return false;
    global.settings.happyHour = plan;
    if (typeof global.saveAll === 'function') global.saveAll();
    return true;
  }

  // ===================== Teil 1: die zwei Felder am Artikel =====================
  function artikelfelderVerdrahten() {
    if (!el('aHappyHour') || !el('aHappyHourPrice')) return;

    // Beim Laden eines Artikels die beiden Felder mitfüllen.
    const ladenVorher = global.loadArticle;
    if (typeof ladenVorher === 'function') {
      global.loadArticle = function (i) {
        ladenVorher(i);
        const a = (global.articles || [])[i] || {};
        el('aHappyHour').checked = a.hhAktiv === true;
        el('aHappyHourPrice').value = Number.isFinite(Number(a.hhPreis)) && Number(a.hhPreis) > 0 ? a.hhPreis : '';
        hinweisSchreiben();
      };
    }
    // Beim Lesen des Formulars die beiden Felder mitnehmen - UND hier die eigentliche Sperre.
    //
    // WARUM DIE PRUEFUNG HIER SITZT (beim Ausprobieren gelernt): zuerst hing sie nur am
    // Speicherknopf. Das war nicht verlaesslich - der Knopf traegt bereits einen onclick aus
    // app.js, und je nach Reihenfolge kam der eigene Zuschauer gar nicht zum Zug. readArticle
    // dagegen wird bei JEDEM Speichern durchlaufen, egal ueber welchen Weg. Ein Haekchen ohne
    // brauchbaren Preis wird deshalb hier hart entfernt: der Artikel wird gespeichert, aber
    // ohne die Happy-Hour-Kennzeichnung, und der Benutzer erfaehrt im Klartext warum.
    // Am Markttag zum vollen Preis zu verkaufen, weil ein Preis fehlte, waere das Schlimmste.
    const lesenVorher = global.readArticle;
    if (typeof lesenVorher === 'function') {
      global.readArticle = function () {
        const a = lesenVorher();
        const problem = pruefeArtikelEingabe();
        if (problem) {
          a.hhAktiv = false;
          a.hhPreis = null;
          if (el('aHappyHour').checked) {
            el('aHappyHour').checked = false;
            hinweisSchreiben();
            alert(problem + '\n\nDer Artikel wurde OHNE Happy-Hour-Kennzeichnung gespeichert.');
          }
          return a;
        }
        a.hhAktiv = el('aHappyHour').checked === true;
        const preis = Number(String(el('aHappyHourPrice').value).replace(',', '.'));
        a.hhPreis = Number.isFinite(preis) && preis > 0 ? Math.round(preis * 100) / 100 : null;
        return a;
      };
    }

    el('aHappyHour').addEventListener('change', hinweisSchreiben);
    el('aHappyHourPrice').addEventListener('input', hinweisSchreiben);

    // Zusätzlich am Speicherknopf: hält den Vorgang ganz an, wo es klappt. Die
    // verlässliche Sperre sitzt aber in readArticle (siehe oben) - dieser Zuschauer ist nur
    // die Bequemlichkeit, damit gar nicht erst gespeichert wird.
    const speichern = document.querySelector('#articleToolbar [data-cmd="save"]');
    if (speichern) {
      speichern.addEventListener('click', (ereignis) => {
        const problem = pruefeArtikelEingabe();
        if (!problem) return;
        ereignis.preventDefault();
        ereignis.stopImmediatePropagation();
        hinweisSchreiben();
        alert(problem);
      }, true);
    }
  }

  // Liefert einen Klartext, wenn etwas nicht stimmt - sonst nichts.
  function pruefeArtikelEingabe() {
    if (!el('aHappyHour') || !el('aHappyHour').checked) return '';
    const roh = String(el('aHappyHourPrice').value).replace(',', '.').trim();
    const hh = Number(roh);
    const normal = Number(String(el('aPrice').value).replace(',', '.'));
    if (!roh) return 'Der Artikel nimmt an der Happy Hour teil, hat aber keinen Happy-Hour-Preis.\n\nBitte den Preis eintragen, der während der Happy Hour gelten soll - oder das Häkchen wieder entfernen.';
    if (!Number.isFinite(hh) || hh <= 0) return 'Der Happy-Hour-Preis muss eine Zahl größer als null sein.';
    if (Number.isFinite(normal) && hh >= normal) {
      return `Der Happy-Hour-Preis (${geld(hh)}) ist nicht günstiger als der normale Preis (${geld(normal)}).\n\nEine Happy Hour, die nichts spart, verwirrt am Stand nur. Bitte den Preis nach unten korrigieren.`;
    }
    return '';
  }

  function hinweisSchreiben() {
    const feld = el('aHappyHourHinweis');
    if (!feld) return;
    if (!el('aHappyHour').checked) { feld.textContent = 'Ohne Häkchen bleibt der Artikel immer beim normalen Preis.'; feld.className = 'hh-hinweis'; return; }
    const problem = pruefeArtikelEingabe();
    if (problem) { feld.textContent = problem.split('\n')[0]; feld.className = 'hh-hinweis hh-fehler'; return; }
    const hh = Number(String(el('aHappyHourPrice').value).replace(',', '.'));
    const normal = Number(String(el('aPrice').value).replace(',', '.'));
    const ersparnis = Number.isFinite(normal) ? normal - hh : 0;
    feld.textContent = `Während der Happy Hour ${geld(hh)} statt ${geld(normal)} - das sind ${geld(ersparnis)} weniger.`;
    feld.className = 'hh-hinweis hh-gut';
  }

  // Die Spalte HH in der Artikelliste mitzeichnen.
  function tabellenspalteVerdrahten() {
    const vorher = global.renderArticles;
    if (typeof vorher !== 'function') return;
    global.renderArticles = function () {
      vorher();
      const koerper = el('articleBody');
      if (!koerper) return;
      [...koerper.querySelectorAll('tr')].forEach((zeile) => {
        const a = (global.articles || [])[Number(zeile.dataset.i)];
        if (!a) return;
        const zelle = document.createElement('td');
        if (a.hhAktiv && Number(a.hhPreis) > 0) {
          zelle.innerHTML = `<b class="hh-preis">${esc(geld(a.hhPreis))}</b>`;
          zelle.title = `Happy-Hour-Preis statt ${geld(a.price)}`;
        } else {
          zelle.innerHTML = '<span class="hh-leer">–</span>';
          zelle.title = 'Nimmt nicht an der Happy Hour teil';
        }
        // vor die letzte Spalte (Preisliste) setzen, passend zur Kopfzeile
        zeile.insertBefore(zelle, zeile.lastElementChild);
      });
    };
  }

  // ===================== Teil 2: die Ansicht mit dem Zeitplan =====================
  function zeitfelder(fenster, art, index) {
    const reihen = [];
    for (let i = 0; i < HH().MAX_FENSTER; i++) {
      const f = fenster[i] || {von: '', bis: ''};
      reihen.push(`<span class="hh-fenster">
        <input type="time" value="${esc(f.von)}" data-hh="${art}" data-nr="${i}" data-teil="von" aria-label="${i + 1}. Zeitbereich von"${index != null ? ` data-tag="${index}"` : ''}>
        <span>bis</span>
        <input type="time" value="${esc(f.bis)}" data-hh="${art}" data-nr="${i}" data-teil="bis" aria-label="${i + 1}. Zeitbereich bis"${index != null ? ` data-tag="${index}"` : ''}>
      </span>`);
    }
    return reihen.join('');
  }

  function zeichne() {
    const koerper = el('kcHappyHourBody');
    if (!koerper) return;
    const plan = planLesen();
    const artikel = global.articles || [];
    const teilnehmer = HH().teilnehmer(artikel);
    const angehakt = artikel.filter((a) => a && a.hhAktiv === true);
    const jetzt = HH().laeuftGerade(plan, new Date());
    const heute = HH().fensterFuerTag(plan, new Date());
    const pruefung = HH().pruefePlan(plan);

    koerper.innerHTML = `
      <div class="hh-jetzt ${jetzt.aktiv ? 'hh-jetzt-an' : ''}">
        <b>${jetzt.aktiv
          ? `Die Happy Hour läuft gerade – bis ${esc(jetzt.fenster.bis)} Uhr.`
          : (plan.aktiv ? 'Die Happy Hour läuft gerade nicht.' : 'Die Happy Hour ist ausgeschaltet.')}</b>
        <span>Heute gilt: ${esc(HH().fensterText(heute))}${jetzt.naechstes ? ` · nächstes Fenster ab ${esc(jetzt.naechstes.von)} Uhr` : ''}</span>
      </div>

      <div class="card">
        <h2>Grundeinstellung</h2>
        <label class="hh-schalter"><input type="checkbox" id="hhAktiv" ${plan.aktiv ? 'checked' : ''}> <b>Happy Hour einschalten</b></label>
        <p class="hh-erklaerung">Solange der Schalter aus ist, verkauft jede Kasse durchgehend zum normalen Preis – unabhängig davon, was unten eingetragen ist.</p>
        <div class="form-grid">
          <label>Weihnachtsmarkt von<input type="date" id="hhVon" value="${esc(plan.zeitraum.von)}"></label>
          <label>Weihnachtsmarkt bis<input type="date" id="hhBis" value="${esc(plan.zeitraum.bis)}"></label>
        </div>
      </div>

      <div class="card">
        <h2>Standardzeiten</h2>
        <p class="hh-erklaerung">Diese Zeiten gelten an <b>jedem</b> Markttag. Bis zu ${HH().MAX_FENSTER} Zeitbereiche am Tag.
          Nicht benötigte Bereiche einfach leer lassen. Einzelne Tage regelst du weiter unten.</p>
        <div class="hh-fensterliste">${zeitfelder(plan.standard, 'standard')}</div>
      </div>

      <div class="card">
        <h2>Einzelne Tage abweichend</h2>
        <p class="hh-erklaerung">Für Tage, an denen es anders sein soll: entweder <b>keine Happy Hour</b> an dem Tag,
          oder eigene Uhrzeiten, die die Standardzeiten für diesen einen Tag ersetzen.</p>
        <div id="hhAusnahmen">${
          plan.ausnahmen.length
            ? plan.ausnahmen.map((a, i) => `
              <div class="hh-ausnahme">
                <input type="date" value="${esc(a.datum)}" data-hh="ausnahmeDatum" data-tag="${i}" aria-label="Datum der Ausnahme">
                <label class="hh-aus"><input type="checkbox" data-hh="ausnahmeAus" data-tag="${i}" ${a.aus ? 'checked' : ''}> keine Happy Hour an dem Tag</label>
                <span class="hh-fensterliste ${a.aus ? 'hh-verblasst' : ''}">${zeitfelder(a.aus ? [] : (a.fenster || []), 'ausnahme', i)}</span>
                <button type="button" class="ghost" data-hh="ausnahmeWeg" data-tag="${i}">Zeile entfernen</button>
              </div>`).join('')
            : '<p class="hh-leer">Noch keine Ausnahme eingetragen – überall gelten die Standardzeiten.</p>'
        }</div>
        <button type="button" id="hhAusnahmeNeu" class="ghost">+ Tag hinzufügen</button>
      </div>

      ${pruefung.fehler.length ? `<div class="hh-meldung hh-fehler-kasten"><b>Bitte noch prüfen:</b><ul>${pruefung.fehler.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>` : ''}
      ${pruefung.hinweise.length ? `<div class="hh-meldung hh-hinweis-kasten"><b>Hinweis:</b><ul>${pruefung.hinweise.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>` : ''}

      <div class="card">
        <h2>Welche Artikel sind dabei?</h2>
        <p class="hh-erklaerung">Der Preis wird am Artikel gepflegt (Artikelseite, Reiter „Verkauf“).
          Hier siehst du nur, was daraus folgt.</p>
        ${teilnehmer.length ? `<div class="table-card"><table class="hh-tabelle"><thead><tr>
            <th>Artikel</th><th>Normalpreis</th><th>Happy-Hour-Preis</th><th>Ersparnis</th></tr></thead><tbody>
            ${teilnehmer.map((a) => `<tr><td>${esc(a.name)}</td><td>${esc(geld(a.price))}</td>
              <td><b class="hh-preis">${esc(geld(a.hhPreis))}</b></td>
              <td>${esc(geld(Number(a.price) - Number(a.hhPreis)))}</td></tr>`).join('')}
          </tbody></table></div>`
          : '<p class="hh-leer">Kein Artikel nimmt bisher teil. Auf der Artikelseite das Häkchen „Happy Hour“ setzen und einen Preis eintragen.</p>'}
        ${angehakt.length !== teilnehmer.length
          ? `<p class="hh-meldung hh-fehler-kasten">${angehakt.length - teilnehmer.length} Artikel ${angehakt.length - teilnehmer.length === 1 ? 'ist' : 'sind'} angehakt, ${angehakt.length - teilnehmer.length === 1 ? 'hat' : 'haben'} aber keinen brauchbaren Happy-Hour-Preis und ${angehakt.length - teilnehmer.length === 1 ? 'bleibt' : 'bleiben'} deshalb beim normalen Preis.</p>`
          : ''}
      </div>

      <div class="hh-fuss">
        <button type="button" id="hhSpeichern" class="primary">Zeitplan speichern</button>
        <span id="hhStand" class="hh-stand"></span>
      </div>
      <p class="hh-erklaerung">Nach dem Speichern den Stammdaten-Abgleich ausführen (Artikelseite, Knopf „An Kassen senden“),
        damit die Kassen den neuen Plan bekommen. Ein Artikel, der schon im Bon liegt, behält seinen Preis –
        die Kasse friert ihn beim Antippen ein.</p>
    `;

    // --- Bedienung ---
    const sammleFenster = (art, tag) => {
      const raus = [];
      for (let i = 0; i < HH().MAX_FENSTER; i++) {
        const wahl = (teil) => koerper.querySelector(`[data-hh="${art}"][data-nr="${i}"][data-teil="${teil}"]${tag != null ? `[data-tag="${tag}"]` : ''}`);
        const von = wahl('von'), bis = wahl('bis');
        if (von && bis && (von.value || bis.value)) raus.push({von: von.value, bis: bis.value});
      }
      return raus;
    };
    const ausFormular = () => {
      const ausnahmen = [...koerper.querySelectorAll('[data-hh="ausnahmeDatum"]')].map((feld) => {
        const nr = feld.dataset.tag;
        const aus = koerper.querySelector(`[data-hh="ausnahmeAus"][data-tag="${nr}"]`)?.checked === true;
        return aus ? {datum: feld.value, aus: true} : {datum: feld.value, fenster: sammleFenster('ausnahme', nr)};
      }).filter((a) => a.datum);
      return {
        aktiv: el('hhAktiv').checked,
        zeitraum: {von: el('hhVon').value, bis: el('hhBis').value},
        standard: sammleFenster('standard'),
        ausnahmen,
      };
    };

    el('hhSpeichern').onclick = () => {
      const entwurf = ausFormular();
      const pruef = HH().pruefePlan(entwurf);
      if (!pruef.ok) { alert('Der Zeitplan wurde NICHT gespeichert:\n\n' + pruef.fehler.join('\n')); return; }
      if (!planSchreiben(HH().normalisiere(entwurf))) { alert('Der Zeitplan konnte nicht gespeichert werden.'); return; }
      zeichne();
      const stand = el('hhStand');
      if (stand) stand.textContent = 'Gespeichert um ' + new Date().toLocaleTimeString('de-DE') + ' – bitte noch an die Kassen senden.';
    };
    el('hhAusnahmeNeu').onclick = () => {
      const entwurf = ausFormular();
      entwurf.ausnahmen.push({datum: el('hhVon').value || HH().alsDatum(new Date()), fenster: []});
      planSchreiben(HH().normalisiere({...entwurf, ausnahmen: entwurf.ausnahmen.map((a) => (a.fenster && !a.fenster.length && !a.aus ? {...a, aus: true} : a))}));
      zeichne();
    };
    koerper.querySelectorAll('[data-hh="ausnahmeWeg"]').forEach((knopf) => {
      knopf.onclick = () => {
        const entwurf = ausFormular();
        entwurf.ausnahmen.splice(Number(knopf.dataset.tag), 1);
        planSchreiben(HH().normalisiere(entwurf));
        zeichne();
      };
    });
    koerper.querySelectorAll('[data-hh="ausnahmeAus"]').forEach((box) => {
      box.onchange = () => {
        const geschwister = box.closest('.hh-ausnahme')?.querySelector('.hh-fensterliste');
        if (geschwister) geschwister.classList.toggle('hh-verblasst', box.checked);
      };
    });
  }

  // ===================== Aufbau der Ansicht =====================
  function ansichtAnlegen() {
    if (document.querySelector('[data-view-panel="happyhour"]')) return;
    const nav = document.querySelector('.nav-submenu');
    if (!nav) return;
    const knopf = document.createElement('button');
    knopf.className = 'nav'; knopf.type = 'button'; knopf.dataset.view = 'happyhour';
    knopf.textContent = 'Happy Hour';
    // direkt hinter die Artikel stellen - dort wird der Preis gepflegt
    const artikelKnopf = document.querySelector('[data-view="articles"]');
    if (artikelKnopf && artikelKnopf.parentNode === nav) nav.insertBefore(knopf, artikelKnopf.nextSibling);
    else nav.appendChild(knopf);

    const bereich = document.createElement('section');
    bereich.className = 'view'; bereich.dataset.viewPanel = 'happyhour'; bereich.hidden = true;
    bereich.innerHTML = `
      <div class="page-head"><div><h1>Happy Hour</h1>
        <p>Wann die Happy Hour gilt. Der Preis je Artikel steht auf der Artikelseite.</p></div></div>
      <div id="kcHappyHourBody"></div>`;
    document.querySelector('.content')?.appendChild(bereich);

    knopf.onclick = () => {
      document.querySelectorAll('.nav').forEach((x) => x.classList.toggle('active', x === knopf));
      document.querySelectorAll('.view').forEach((x) => {
        const an = x.dataset.viewPanel === 'happyhour';
        x.classList.toggle('active', an); x.hidden = !an;
      });
      zeichne();
    };
    // Die Anzeige "läuft gerade" soll stimmen, ohne dass man neu lädt.
    setInterval(() => { if (!bereich.hidden) zeichne(); }, 30000);
  }

  function start() {
    if (!global.KCHappyHour) return;   // gemeinsames Modul fehlt - dann lieber gar nichts
    artikelfelderVerdrahten();
    tabellenspalteVerdrahten();
    ansichtAnlegen();
    if (typeof global.renderArticles === 'function') global.renderArticles();
    global.KCHappyHourManager = {version: VERSION, zeichne, planLesen, planSchreiben, pruefeArtikelEingabe};
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window);
