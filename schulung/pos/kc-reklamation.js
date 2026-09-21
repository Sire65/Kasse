/* KC REKLAMATION - schneller, eigenstaendiger Ablauf.                                09.09.2026
 * ANLASS (Betreiber): "Button drücken, Grund antippen und wählen. Ersatz oder Auszahlung oder
 * nix. Der Ablauf soll einfach, bedienerfreundlich und schnell sein - keine Rückfrage zu
 * Bonnummer, jetzt muss nur noch der Artikel schnell angewählt werden." Drei Schritte, alles
 * Antippen, kein Pflichttext. Rührt den laufenden Warenkorb NIE an - jedes Ergebnis bucht
 * sofort und für sich (siehe kcReklamationBuchen in app.js).
 * Läuft überall (Standard-Ansicht UND Aufbau), eigene, einfache CSS-Klassen.
 */
(function (global) {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const GRUENDE = [
    ['Kalt ausgegeben', '🥶'], ['Verbrannt', '🔥'], ['Verdorben', '🤢'], ['Hat nicht geschmeckt', '👎'],
    ['Zu kleine Menge', '📉'], ['Falscher Artikel', '❌'], ['Beschädigt oder verschüttet', '💥'], ['Sonstiges', '⋯'],
  ];
  let schritt = 1, artikel = null, grund = null, ebene = null, gruppe = null;

  function kategorien() { try { return categories(); } catch (e) { return []; } }
  function artikelDerGruppe(g) {
    let st; try { st = state; } catch (e) { return []; }
    const alt = st.activeCategory; st.activeCategory = g;
    let l = []; try { l = allProductsForCategory(); } catch (e) { l = []; }
    st.activeCategory = alt; return l;
  }
  function geld(v) { try { return money(v); } catch (e) { return v + ' €'; } }

  function bauen() {
    if (ebene) return ebene;
    ebene = document.createElement('div'); ebene.id = 'kcReklamationEbene'; ebene.className = 'kc-reklamation-ebene'; ebene.hidden = true;
    ebene.innerHTML = '<div class="kc-rek-kopf"><button type="button" class="kc-rek-zurueck" data-rek="zurueck" aria-label="Zurück">←</button><strong class="kc-rek-titel"></strong><button type="button" class="kc-rek-schliessen" data-rek="schliessen" aria-label="Abbrechen">✕</button></div><div class="kc-rek-inhalt"></div>';
    document.body.appendChild(ebene);
    ebene.addEventListener('click', (ev) => {
      const g = ev.target.closest('[data-rek-gruppe]'); if (g) { gruppe = g.dataset.rekGruppe; zeichneSchritt1(); return; }
      const a = ev.target.closest('[data-rek-artikel]'); if (a) { artikel = a.dataset.rekArtikel; schritt = 2; zeichnen(); return; }
      const gr = ev.target.closest('[data-rek-grund]'); if (gr) { grund = gr.dataset.rekGrund; schritt = 3; zeichnen(); return; }
      const erg = ev.target.closest('[data-rek-ergebnis]'); if (erg) { ergebnisWaehlen(erg.dataset.rekErgebnis); return; }
      const f = ev.target.closest('[data-rek]'); if (!f) return;
      if (f.dataset.rek === 'schliessen') schliessen();
      else if (f.dataset.rek === 'zurueck') { if (schritt > 1) { schritt -= 1; zeichnen(); } else schliessen(); }
    });
    return ebene;
  }
  function oeffnen() {
    bauen(); schritt = 1; artikel = null; grund = null; gruppe = (kategorien()[0]) || null;
    ebene.hidden = false; zeichnen();
  }
  function schliessen() { if (ebene) ebene.hidden = true; }

  function zeichnen() { schritt === 1 ? zeichneSchritt1() : schritt === 2 ? zeichneSchritt2() : zeichneSchritt3(); }

  function zeichneSchritt1() {
    $('.kc-rek-titel', ebene).textContent = 'Reklamation · Schritt 1 von 3 – Welcher Artikel?';
    // Betreiber: "oben rechts 2x Schließkreuz, das irritiert" - Schritt 1 hatte hier links
    // ein zweites, redundantes ✕ (dasselbe wie das echte Schließen-Kreuz rechts). "Zurück"
    // ergibt auf dem ersten Schritt ohnehin keinen Sinn, also blenden wir den Knopf hier
    // einfach aus, statt ihn zu einem zweiten Schliessen-Kreuz umzufunktionieren.
    $('.kc-rek-zurueck', ebene).hidden = true;
    const gruppen = kategorien();
    const liste = artikelDerGruppe(gruppe);
    $('.kc-rek-inhalt', ebene).innerHTML =
      '<div class="kc-rek-schritt1"><div class="kc-rek-gruppen">' +
      gruppen.map((g) => `<button type="button" data-rek-gruppe="${g}" class="${g === gruppe ? 'aktiv' : ''}">${g}</button>`).join('') +
      '</div><div class="kc-rek-artikel">' +
      (liste.map((p) => `<button type="button" data-rek-artikel="${p.id}"><span class="kc-rek-art-name">${p.name}</span><span class="kc-rek-art-preis">${geld(p.price)}</span></button>`).join('') || '<p class="kc-rek-leer">Keine Artikel in dieser Gruppe.</p>') +
      '</div></div>';
  }
  function zeichneSchritt2() {
    const p = PRODUCTS.find((x) => x.id === artikel);
    $('.kc-rek-titel', ebene).textContent = `Reklamation · Schritt 2 von 3 – Warum? (${p ? p.name : ''})`;
    $('.kc-rek-zurueck', ebene).hidden = false; $('.kc-rek-zurueck', ebene).textContent = '←'; $('.kc-rek-zurueck', ebene).dataset.rek = 'zurueck';
    $('.kc-rek-inhalt', ebene).innerHTML = '<div class="kc-rek-gruende">' +
      GRUENDE.map(([g, i]) => `<button type="button" data-rek-grund="${g}"><span class="kc-rek-grund-icon">${i}</span><span>${g}</span></button>`).join('') + '</div>';
  }
  function zeichneSchritt3() {
    const p = PRODUCTS.find((x) => x.id === artikel);
    $('.kc-rek-titel', ebene).textContent = `Reklamation · Schritt 3 von 3 – Was bekommt der Kunde?`;
    $('.kc-rek-zurueck', ebene).hidden = false; $('.kc-rek-zurueck', ebene).textContent = '←'; $('.kc-rek-zurueck', ebene).dataset.rek = 'zurueck';
    $('.kc-rek-inhalt', ebene).innerHTML =
      `<div class="kc-rek-zusammenfassung">${p ? p.name : ''} · ${grund}${p ? ' · ' + geld(p.price) : ''}</div>` +
      '<div class="kc-rek-ergebnisse">' +
      '<button type="button" data-rek-ergebnis="ersatz"><span class="kc-rek-erg-icon">🔄</span><b>ERSATZ</b><small>Neuer Artikel, kostenlos</small></button>' +
      `<button type="button" data-rek-ergebnis="auszahlung"><span class="kc-rek-erg-icon">💶</span><b>AUSZAHLUNG</b><small>${p ? geld(p.price) + ' zurück' : ''}</small></button>` +
      '<button type="button" data-rek-ergebnis="nichts"><span class="kc-rek-erg-icon">✔️</span><b>NICHTS</b><small>Kunde ist zufrieden</small></button>' +
      '</div>' +
      '<label class="kc-rek-bonfeld">Bonnummer (optional)<input type="text" id="kcRekBon" maxlength="40" placeholder="nicht nötig"></label>';
  }

  async function ergebnisWaehlen(ergebnis) {
    const buttons = $$('.kc-rek-ergebnisse button', ebene); buttons.forEach((b) => { b.disabled = true; });
    try {
      const ref = ($('#kcRekBon', ebene) || {}).value || '';
      await kcReklamationBuchen(artikel, grund, ergebnis, ref);
      const p = PRODUCTS.find((x) => x.id === artikel);
      const text = ergebnis === 'ersatz' ? `${p ? p.name : 'Artikel'} als Ersatz gebucht - kostenlos.`
        : ergebnis === 'auszahlung' ? `${geld(p ? p.price : 0)} als Reklamationsauszahlung gebucht.`
        : 'Reklamation ohne Ausgleich vermerkt.';
      try { setSystemHint(text, 'ok'); } catch (e) { /* egal */ }
      try { notify('success', 'Reklamation abgeschlossen', 'reklamation', 5000); } catch (e) { /* egal */ }
    } catch (err) {
      try { setSystemHint(err.message || 'Reklamation konnte nicht gespeichert werden', 'error'); } catch (e) { /* egal */ }
      buttons.forEach((b) => { b.disabled = false; });
      return;
    }
    schliessen();
  }

  global.KCReklamation = { version: '0.1.0', oeffnen, schliessen };
})(window);
