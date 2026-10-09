/* KC REKLAMATION - schneller, eigenstaendiger Ablauf.                                09.09.2026
 * ANLASS (Betreiber): "Button drücken, Grund antippen und wählen. Ersatz oder Auszahlung oder
 * nix. Der Ablauf soll einfach, bedienerfreundlich und schnell sein - keine Rückfrage zu
 * Bonnummer, jetzt muss nur noch der Artikel schnell angewählt werden." Drei Schritte, alles
 * Antippen, kein Pflichttext. Rührt den laufenden Warenkorb NIE an - jedes Ergebnis bucht
 * sofort und für sich (siehe kcReklamationBuchenPosten in app.js).
 * Läuft überall (Standard-Ansicht UND Aufbau), eigene, einfache CSS-Klassen.
 *
 * 0.2.0 (09.10.2026, Betreiber: "unter Reklamation die Warengruppen wie auf der Kassenseite und
 * darunter jeweils die Bilder der Artikel mit einer Anzahl. Z. B. reklamiert ein Kunde 3 kalte
 * Glühwein ... Auf die Bildgröße achten, dass alles sauber drauf passt und die Bilder gut zu
 * erkennen sind. Schuss Rum und Amaretto muss berücksichtigt werden. Alles übersichtlich."):
 * Schritt 1 zeigt Bildkacheln wie die Kasse. Jedes Antippen zählt 1 Stück (Zahl auf der Kachel),
 * bei Artikeln mit Schuss gibt es darunter "+ Rum" / "+ Amaretto". Rechts steht, was reklamiert
 * wird, mit − / + und Summe; "Weiter" führt zu Grund und Ergebnis. Mehrere Artikel in einem
 * Vorgang. Pfand-Rückgaben, Pfand und freie Beträge erscheinen hier nicht.
 */
(function (global) {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const GRUENDE = [
    ['Kalt ausgegeben', '🥶'], ['Verbrannt', '🔥'], ['Verdorben', '🤢'], ['Hat nicht geschmeckt', '👎'],
    ['Zu kleine Menge', '📉'], ['Falscher Artikel', '❌'], ['Beschädigt oder verschüttet', '💥'], ['Sonstiges', '⋯'],
  ];
  let schritt = 1, grund = null, ebene = null, gruppe = null;
  const auswahl = new Map();   // "artikelId|optionId" -> Menge

  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  function geld(v) { try { return money(v); } catch (e) { return Number(v || 0).toFixed(2).replace('.', ',') + ' €'; } }
  function produkte() { try { return PRODUCTS; } catch (e) { return []; } }
  function optionen(p) { try { return p && p.optionGroup ? ((OPTIONS[p.optionGroup] || {}).choices || []).filter((c) => Number(c.price || 0) > 0) : []; } catch (e) { return []; } }
  // Nur, was man wirklich reklamieren kann: kein Pfand, keine Rückgaben, keine freien Beträge.
  function reklamierbar(p) {
    return p && Number(p.price || 0) > 0 && !p.isFreieZahlung && p.category !== 'Pfand'
      && !/pfand|wertmarke/i.test(`${p.id} ${p.name}`);
  }
  function artikelDerGruppe(g) {
    let st; try { st = state; } catch (e) { return []; }
    const alt = st.activeCategory; st.activeCategory = g;
    let l = []; try { l = allProductsForCategory(); } catch (e) { l = []; }
    st.activeCategory = alt; return l.filter(reklamierbar);
  }
  function kategorien() {
    let g = []; try { g = categories(); } catch (e) { g = []; }
    return g.filter((x) => artikelDerGruppe(x).length);
  }
  function posten() {
    return [...auswahl.entries()].filter(([, n]) => n > 0).map(([k, qty]) => {
      const [id, optionId] = k.split('|');
      const p = produkte().find((x) => x.id === id);
      const opt = optionen(p).find((c) => c.id === optionId) || null;
      const preis = Number(p ? p.price : 0) + Number(opt ? opt.price : 0);
      return {key: k, id, optionId: opt ? opt.id : '', qty, preis, name: p ? (opt ? `${p.name} + ${opt.name}` : p.name) : id};
    });
  }
  const stueck = () => posten().reduce((s, x) => s + x.qty, 0);
  const summe = () => posten().reduce((s, x) => s + x.preis * x.qty, 0);
  const kurz = (c) => '+ ' + String(c.name).replace(/^Schuss\s+/i, '');
  function bild(p) { return (p && (p.image || (p.kombiBilder && p.kombiBilder.oben))) || 'assets/logo.webp'; }

  function stil() {
    if (document.getElementById('kcRekStil')) return;
    const s = document.createElement('style'); s.id = 'kcRekStil';
    s.textContent = `
.kc-rek-s1{display:flex;flex-direction:column;gap:12px;height:100%;min-height:0}
.kc-rek-s1-haupt{flex:1;display:flex;gap:14px;min-height:0}
.kc-rek-kacheln{flex:1;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:12px;align-content:start;padding:2px}
.kc-rek-kachel{position:relative;display:flex;flex-direction:column;background:#fff;border:2px solid #334155;border-radius:14px;overflow:hidden}
.kc-rek-kachel.gewaehlt{border-color:#b91c1c;box-shadow:0 0 0 3px rgba(185,28,28,.25)}
.kc-rek-k-haupt{display:flex;flex-direction:column;align-items:stretch;gap:0;padding:0;border:0;background:none;cursor:pointer;text-align:center;font:inherit;color:#0f172a;touch-action:manipulation}
.kc-rek-k-bild{display:block;aspect-ratio:1/1;background:#f1f5f9;padding:6px}
.kc-rek-k-bild img{width:100%;height:100%;object-fit:contain;display:block}
.kc-rek-k-text{display:flex;flex-direction:column;gap:2px;padding:7px 8px 9px;min-height:58px;justify-content:center}
.kc-rek-k-name{font-weight:800;font-size:15px;line-height:1.15;hyphens:auto;-webkit-hyphens:auto;overflow-wrap:break-word}
.kc-rek-k-preis{font-size:14px;color:#475569;font-weight:700}
.kc-rek-k-zahl{position:absolute;top:6px;right:6px;min-width:40px;height:40px;padding:0 8px;border-radius:20px;background:#b91c1c;color:#fff;font-size:22px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.35);pointer-events:none}
.kc-rek-k-opt{display:flex;border-top:2px solid #e2e8f0}
.kc-rek-k-opt button{flex:1;min-width:0;min-height:44px;padding:0 2px;border:0;background:#e0f2fe;color:#0c4a6e;font-weight:800;font-size:13px;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;touch-action:manipulation}
.kc-rek-k-opt button+button{border-left:2px solid #fff}
.kc-rek-k-opt button.hat{background:#0369a1;color:#fff}
.kc-rek-auswahl{width:300px;flex:0 0 300px;display:flex;flex-direction:column;gap:8px;background:#fff;border:2px solid #334155;border-radius:14px;padding:12px;min-height:0}
.kc-rek-auswahl h3{margin:0;font-size:17px;color:#0c1726}
.kc-rek-zeilen{flex:1;overflow:auto;display:flex;flex-direction:column;gap:6px}
.kc-rek-zeile{display:grid;grid-template-columns:1fr auto;gap:4px 8px;align-items:center;padding:7px 8px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0}
.kc-rek-zeile b{font-size:15px}
.kc-rek-zeile small{grid-column:1;color:#475569;font-size:13px}
.kc-rek-zeile .kc-rek-pm{grid-row:1 / span 2;grid-column:2;display:flex;gap:6px}
.kc-rek-pm button{width:44px;height:44px;border-radius:10px;border:2px solid #334155;background:#fff;font-size:22px;font-weight:900;cursor:pointer}
.kc-rek-hinweis{color:#64748b;font-size:14px;line-height:1.35}
.kc-rek-summe{display:flex;justify-content:space-between;font-size:18px;font-weight:900;border-top:2px solid #e2e8f0;padding-top:8px}
.kc-rek-weiter{min-height:56px;border:0;border-radius:12px;background:#b91c1c;color:#fff;font-size:18px;font-weight:900;cursor:pointer}
.kc-rek-weiter:disabled{background:#cbd5e1;color:#64748b;cursor:not-allowed}
.kc-rek-liste{background:#fff;border:2px solid #334155;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:16px}
.kc-rek-liste div{display:flex;justify-content:space-between;gap:10px;padding:3px 0}
.kc-rek-liste .gesamt{border-top:2px solid #e2e8f0;margin-top:4px;padding-top:6px;font-weight:900}
@media (max-width:820px){.kc-rek-k-name{font-size:14px}.kc-rek-s1-haupt{flex-direction:column}.kc-rek-auswahl{width:auto;flex:0 0 auto;max-height:42vh}.kc-rek-kacheln{grid-template-columns:repeat(auto-fill,minmax(128px,1fr))}}`;
    document.head.appendChild(s);
  }

  function bauen() {
    if (ebene) return ebene;
    stil();
    ebene = document.createElement('div'); ebene.id = 'kcReklamationEbene'; ebene.className = 'kc-reklamation-ebene'; ebene.hidden = true; ebene.lang = 'de';   // fuer saubere Silbentrennung langer Artikelnamen
    // Betreiber-Wunsch (22.09.2026): ein klar beschrifteter Abbrechen-Weg, nicht nur ein
    // kleines Symbol - man muss auf einen Blick sehen koennen, wie man eine begonnene
    // Reklamation wieder verlaesst, ohne etwas zu buchen.
    ebene.innerHTML = '<div class="kc-rek-kopf"><button type="button" class="kc-rek-zurueck" data-rek="zurueck" aria-label="Zurück"><span>←</span> Zurück</button><strong class="kc-rek-titel"></strong><button type="button" class="kc-rek-schliessen" data-rek="schliessen" aria-label="Reklamation abbrechen"><span>✕</span> Abbrechen</button></div><div class="kc-rek-inhalt"></div>';
    document.body.appendChild(ebene);
    ebene.addEventListener('click', (ev) => {
      const g = ev.target.closest('[data-rek-gruppe]'); if (g) { gruppe = g.dataset.rekGruppe; zeichneSchritt1(true); return; }
      const plus = ev.target.closest('[data-rek-plus]'); if (plus) { aendern(plus.dataset.rekPlus, +1); return; }
      const minus = ev.target.closest('[data-rek-minus]'); if (minus) { aendern(minus.dataset.rekMinus, -1); return; }
      if (ev.target.closest('[data-rek-weiter]')) { if (stueck() > 0) { schritt = 2; zeichnen(); } return; }
      const gr = ev.target.closest('[data-rek-grund]'); if (gr) { grund = gr.dataset.rekGrund; schritt = 3; zeichnen(); return; }
      const erg = ev.target.closest('[data-rek-ergebnis]'); if (erg) { ergebnisWaehlen(erg.dataset.rekErgebnis); return; }
      const f = ev.target.closest('[data-rek]'); if (!f) return;
      if (f.dataset.rek === 'schliessen') schliessen();
      else if (f.dataset.rek === 'zurueck') { if (schritt > 1) { schritt -= 1; zeichnen(); } else schliessen(); }
    });
    return ebene;
  }
  function aendern(key, d) {
    const n = Math.max(0, (auswahl.get(key) || 0) + d);
    if (n) auswahl.set(key, Math.min(n, 99)); else auswahl.delete(key);
    zeichneSchritt1(false);
  }
  function oeffnen() {
    bauen(); schritt = 1; grund = null; auswahl.clear();
    const gr = kategorien(); gruppe = gr[0] || null;
    ebene.hidden = false; zeichnen();
  }
  function schliessen() { if (ebene) ebene.hidden = true; }

  function zeichnen() { schritt === 1 ? zeichneSchritt1(true) : schritt === 2 ? zeichneSchritt2() : zeichneSchritt3(); }

  function kachel(p) {
    const opts = optionen(p);
    const ohne = auswahl.get(`${p.id}|`) || 0;
    const gesamt = ohne + opts.reduce((s, c) => s + (auswahl.get(`${p.id}|${c.id}`) || 0), 0);
    return `<div class="kc-rek-kachel${gesamt ? ' gewaehlt' : ''}">
      <button type="button" class="kc-rek-k-haupt" data-rek-plus="${esc(p.id)}|" aria-label="${esc(p.name)} reklamieren, bisher ${gesamt}">
        <span class="kc-rek-k-bild"><img src="${esc(bild(p))}" alt="" loading="lazy" draggable="false"></span>
        <span class="kc-rek-k-text"><span class="kc-rek-k-name">${esc(p.name)}</span><span class="kc-rek-k-preis">${geld(p.price)}</span></span>
      </button>
      ${gesamt ? `<span class="kc-rek-k-zahl" aria-hidden="true">${gesamt}</span>` : ''}
      ${opts.length ? `<div class="kc-rek-k-opt">${opts.map((c) => { const n = auswahl.get(`${p.id}|${c.id}`) || 0; return `<button type="button" class="${n ? 'hat' : ''}" data-rek-plus="${esc(p.id)}|${esc(c.id)}" aria-label="${esc(p.name)} mit ${esc(c.name)}">${esc(kurz(c))}${n ? ` · ${n}` : ''}</button>`; }).join('')}</div>` : ''}
    </div>`;
  }
  function seitenleiste() {
    const l = posten();
    return `<h3>Reklamiert</h3>
      <div class="kc-rek-zeilen">${l.length ? l.map((x) => `<div class="kc-rek-zeile"><b>${x.qty} × ${esc(x.name)}</b><small>${geld(x.preis)} je Stück · ${geld(x.preis * x.qty)}</small><span class="kc-rek-pm"><button type="button" data-rek-minus="${esc(x.key)}" aria-label="eins weniger">−</button><button type="button" data-rek-plus="${esc(x.key)}" aria-label="eins mehr">+</button></span></div>`).join('')
        : '<p class="kc-rek-hinweis">Artikel antippen – jedes Antippen zählt 1 Stück.<br>Glühwein mit Schuss: unter dem Bild „+ Rum“ oder „+ Amaretto“.</p>'}</div>
      <div class="kc-rek-summe"><span>${stueck()} Stück</span><span>${geld(summe())}</span></div>
      <button type="button" class="kc-rek-weiter" data-rek-weiter ${stueck() ? '' : 'disabled'}>Weiter → Grund</button>`;
  }
  function zeichneSchritt1(neu) {
    $('.kc-rek-titel', ebene).textContent = 'Reklamation · Schritt 1 von 3 – Welche Artikel? (antippen = 1 Stück)';
    // Betreiber: "oben rechts 2x Schließkreuz, das irritiert" - auf Schritt 1 kein Zurück.
    $('.kc-rek-zurueck', ebene).hidden = true;
    const alt = $('.kc-rek-kacheln', ebene), scroll = alt && !neu ? alt.scrollTop : 0;
    const gruppen = kategorien();
    if (!gruppen.includes(gruppe)) gruppe = gruppen[0] || null;
    const liste = gruppe ? artikelDerGruppe(gruppe) : [];
    $('.kc-rek-inhalt', ebene).innerHTML =
      '<div class="kc-rek-s1"><div class="kc-rek-gruppen">' +
      gruppen.map((g) => `<button type="button" data-rek-gruppe="${esc(g)}" class="${g === gruppe ? 'aktiv' : ''}">${esc(g)}</button>`).join('') +
      '</div><div class="kc-rek-s1-haupt"><div class="kc-rek-kacheln">' +
      (liste.map(kachel).join('') || '<p class="kc-rek-leer">Keine Artikel in dieser Gruppe.</p>') +
      `</div><aside class="kc-rek-auswahl">${seitenleiste()}</aside></div></div>`;
    const neuK = $('.kc-rek-kacheln', ebene); if (neuK) neuK.scrollTop = scroll;
  }
  function listeHtml(mitPreis) {
    return '<div class="kc-rek-liste">' + posten().map((x) => `<div><span>${x.qty} × ${esc(x.name)}</span>${mitPreis ? `<span>${geld(x.preis * x.qty)}</span>` : ''}</div>`).join('') +
      (mitPreis ? `<div class="gesamt"><span>Zusammen</span><span>${geld(summe())}</span></div>` : '') + '</div>';
  }
  function zeichneSchritt2() {
    $('.kc-rek-titel', ebene).textContent = `Reklamation · Schritt 2 von 3 – Warum? (${stueck()} Stück)`;
    $('.kc-rek-zurueck', ebene).hidden = false; $('.kc-rek-zurueck', ebene).dataset.rek = 'zurueck';
    $('.kc-rek-inhalt', ebene).innerHTML = listeHtml(false) + '<div class="kc-rek-gruende">' +
      GRUENDE.map(([g, i]) => `<button type="button" data-rek-grund="${g}"><span class="kc-rek-grund-icon">${i}</span><span>${g}</span></button>`).join('') + '</div>';
  }
  function zeichneSchritt3() {
    const n = stueck();
    $('.kc-rek-titel', ebene).textContent = `Reklamation · Schritt 3 von 3 – Was bekommt der Kunde? (${grund})`;
    $('.kc-rek-zurueck', ebene).hidden = false; $('.kc-rek-zurueck', ebene).dataset.rek = 'zurueck';
    $('.kc-rek-inhalt', ebene).innerHTML = listeHtml(true) +
      '<div class="kc-rek-ergebnisse">' +
      `<button type="button" data-rek-ergebnis="ersatz"><span class="kc-rek-erg-icon">🔄</span><b>ERSATZ</b><small>${n === 1 ? 'Neuer Artikel' : `${n} neue Artikel`}, kostenlos</small></button>` +
      `<button type="button" data-rek-ergebnis="auszahlung"><span class="kc-rek-erg-icon">💶</span><b>AUSZAHLUNG</b><small>${geld(summe())} zurück</small></button>` +
      '<button type="button" data-rek-ergebnis="nichts"><span class="kc-rek-erg-icon">✔️</span><b>NICHTS</b><small>Kunde ist zufrieden</small></button>' +
      '</div>' +
      '<label class="kc-rek-bonfeld">Bonnummer (optional)<input type="text" id="kcRekBon" maxlength="40" placeholder="nicht nötig"></label>';
  }

  async function ergebnisWaehlen(ergebnis) {
    const buttons = $$('.kc-rek-ergebnisse button', ebene); buttons.forEach((b) => { b.disabled = true; });
    const l = posten(), betrag = summe(), n = stueck();
    try {
      const ref = ($('#kcRekBon', ebene) || {}).value || '';
      await kcReklamationBuchenPosten(l.map((x) => ({id: x.id, optionId: x.optionId, qty: x.qty})), grund, ergebnis, ref);
      const was = l.length === 1 ? `${l[0].qty} × ${l[0].name}` : `${n} Artikel`;
      const text = ergebnis === 'ersatz' ? `✔ ${was} als Ersatz gebucht - kostenlos.`
        : ergebnis === 'auszahlung' ? `✔ ${geld(betrag)} liegt im Warenkorb bereit - jetzt auszahlen.`
        : '✔ Reklamation ohne Ausgleich vermerkt.';
      // Betreiber-Wunsch: eine kurze, klar sichtbare Bestaetigung nach der Wahl - besonders bei
      // Auszahlung wichtig, damit klar ist, dass die Kasse noch einen Schritt (auszahlen)
      // erwartet und nichts von selbst schon abgeschlossen wurde.
      try { setSystemHint(text, 'ok'); } catch (e) { /* egal */ }
      try { notify('success', text, 'reklamation', 5000); } catch (e) { /* egal */ }
    } catch (err) {
      try { setSystemHint(err.message || 'Reklamation konnte nicht gespeichert werden', 'error'); } catch (e) { /* egal */ }
      buttons.forEach((b) => { b.disabled = false; });
      return;
    }
    schliessen();
  }

  global.KCReklamation = { version: '0.2.0', oeffnen, schliessen };
})(window);
