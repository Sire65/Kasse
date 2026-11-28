// KC Kasse – Mengenfenster neben den Kacheln.                                                        Build 1.1.0
// 28.11.2026 (Betreiber: „wenn ich z. B. Kachel Eierpunsch anklicke, soll daneben ein großes Eingabefeld über dem Warenkorb
// aufgehen mit Buttons für die Menge, dass ich sofort 3 wählen kann. Wähle ich in der Zeit schon einen anderen Artikel, muss das
// Mengenfenster schon für den nächsten offen sein – das soll nicht irritieren, sondern die Bedienung einfacher und schneller
// machen. Mit rotem X jederzeit schließen, unten muss die BAR-Taste zu sehen sein. Blauer Info-Button größer und das
// Pluszeichen auch drin.“ Antworten: schließen mit X und nach 25 s; 1 bis 6 etwas größer, aber 2 × 5 muss 10 ergeben;
// abschaltbar unter „Mehr“.)
//
// Ablauf: Kachel/Scan → Artikel wie bisher mit Menge 1 in den Bon (nichts ändert sich an der Buchung) → Fenster zeigt diesen
// Artikel. Erste Mengentaste ersetzt die 1 („3“ → 3 Stück), jede weitere zählt dazu („5“, „5“ → 10). − / + korrigieren.
// Nächste Kachel → neuer Artikel, das Fenster wechselt an Ort und Stelle (gleiche Größe und Lage, kurzes Aufleuchten).
// 1.1.0 (Betreiber 28.11.2026: „anstatt eines roten X eine Ausgangstür wie oben zum Verlassen; die Auswahlzahl in einer anderen
// Farbe markieren – die 1 muss immer schön farbig markiert sein, drücke ich die 2, muss die 2 markiert sein“): Tür 🚪 wie in der
// Kopfzeile; die zuletzt gewählte Zahl ist grün gefüllt (beim Öffnen die 1).
// Zu: Tür 🚪, 25 s ohne Antippen, Bon leer/kassiert, Artikel aus dem Bon gelöscht. GESAMT/BAR/KONTO bleiben immer frei.
(function (global) {
  'use strict';
  if (global.KCMengenfenster) return;
  const LAGER = 'kc_mengenfenster_v1', ZU_NACH_MS = 25000;
  const doc = global.document;
  let offen = null;          // { key, id, basis, getippt }
  let zuTimer = null, lageTimer = null;

  const an = () => { try { return localStorage.getItem(LAGER) !== '0'; } catch (e) { return true; } };
  const S = () => (typeof state !== 'undefined' ? state : null); // eslint-disable-line no-undef
  const eu = (v) => (Math.round(v * 100) / 100).toFixed(2).replace('.', ',') + ' €';
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const STIL = `
#kcMenge{position:fixed;z-index:60;background:#fff;border:3px solid #1d4ed8;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.28);
  padding:10px 12px;display:flex;flex-direction:column;gap:8px;font-family:system-ui,Segoe UI,Arial,sans-serif;color:#0f172a;box-sizing:border-box}
#kcMenge[hidden]{display:none!important}
#kcMenge .km-kopf{display:flex;align-items:center;gap:10px}
#kcMenge .km-bild{width:64px;height:64px;flex:none;object-fit:cover;border-radius:12px;border:2px solid #cbd5e1;background:#f1f5f9}
#kcMenge .km-text{flex:1;min-width:0}
#kcMenge .km-name{font-size:22px;font-weight:900;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#kcMenge .km-preis{font-size:14px;font-weight:700;color:#475569}
#kcMenge .km-rund{flex:none;width:62px;height:62px;border:0;border-radius:50%;background:#0f3e75;color:#fff;font:900 34px Georgia,serif;cursor:pointer}
#kcMenge .km-plus{flex:none;width:62px;height:62px;border:0;border-radius:14px;background:#1d5fa8;color:#fff;font:900 38px system-ui;cursor:pointer}
#kcMenge .km-zu{flex:none;width:62px;height:62px;border:2px solid #ef9a9a;border-radius:14px;background:#7f1d1d;color:#fff;font:400 32px system-ui,'KC Emoji',sans-serif;cursor:pointer;line-height:1}
#kcMenge .km-zahlen{flex:1;min-height:0;display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:1fr;gap:10px}
#kcMenge .km-zahl{border:2px solid #cbd5e1;border-radius:16px;background:#f8fafc;color:#0f172a;font:900 46px system-ui;cursor:pointer;touch-action:manipulation;min-height:0}
#kcMenge .km-zahl:active{background:#dbeafe}
#kcMenge .km-zahl.km-gewaehlt{background:#16a34a;border:4px solid #14532d;color:#fff;box-shadow:0 0 0 3px #bbf7d0 inset}
#kcMenge .km-fuss{display:flex;align-items:center;gap:10px}
#kcMenge .km-pm{width:84px;height:54px;flex:none;border:2px solid #cbd5e1;border-radius:12px;background:#f1f5f9;font:900 30px system-ui;cursor:pointer;touch-action:manipulation}
#kcMenge .km-summe{flex:1;text-align:center;font-size:21px;font-weight:900;color:#15803d;line-height:1.15}
#kcMenge .km-summe small{display:block;font-size:12.5px;font-weight:600;color:#64748b}
#kcMenge button:disabled{opacity:.35;cursor:default}
#kcMenge.km-neu{animation:kmNeu .55s ease-out}
@keyframes kmNeu{0%{box-shadow:0 0 0 0 rgba(29,78,216,.75)}100%{box-shadow:0 0 0 16px rgba(29,78,216,0),0 10px 30px rgba(0,0,0,.28)}}
#kcMenge .km-zeit{height:4px;border-radius:2px;background:#e2e8f0;overflow:hidden}
#kcMenge .km-zeit i{display:block;height:100%;background:#93c5fd;width:100%}
`;
  function stil() {
    if (doc.getElementById('kcMengeStil')) return;
    const s = doc.createElement('style'); s.id = 'kcMengeStil'; s.textContent = STIL; (doc.head || doc.documentElement).appendChild(s);
  }

  function fenster() {
    let w = doc.getElementById('kcMenge');
    if (w) return w;
    stil();
    w = doc.createElement('div');
    w.id = 'kcMenge'; w.hidden = true; w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', 'Menge wählen');
    w.innerHTML = '<div class="km-kopf"><img class="km-bild" alt=""><div class="km-text"><div class="km-name"></div><div class="km-preis"></div></div>'
      + '<button type="button" class="km-rund" data-km="info" aria-label="Artikelinformationen">i</button>'
      + '<button type="button" class="km-plus" data-km="variante" aria-label="Varianten (z. B. Schuss)">+</button>'
      + '<button type="button" class="km-zu" data-km="zu" title="Mengenfenster verlassen" aria-label="Mengenfenster verlassen">🚪</button></div>'
      + '<div class="km-zahlen">' + [1, 2, 3, 4, 5, 6].map((z) => `<button type="button" class="km-zahl" data-km-zahl="${z}">${z}</button>`).join('') + '</div>'
      + '<div class="km-fuss"><button type="button" class="km-pm" data-km="minus" aria-label="eins weniger">−</button><div class="km-summe"></div>'
      + '<button type="button" class="km-pm" data-km="plus" aria-label="eins mehr">+</button></div><div class="km-zeit"><i></i></div>';
    doc.body.appendChild(w);
    w.addEventListener('click', klick);
    return w;
  }

  // Lage: über der Bon-Liste (samt Mengenreihe darüber), GESAMT/BAR/KONTO bleiben frei.
  function lage() {
    const w = doc.getElementById('kcMenge'); if (!w || w.hidden) return;
    const liste = doc.getElementById('cartList'); if (!liste) return;
    const r = liste.getBoundingClientRect();
    const reihe = doc.querySelector('.cart-area [data-qty]')?.closest('div');
    const oben = reihe && reihe.getBoundingClientRect().height ? Math.min(r.top, reihe.getBoundingClientRect().top) : r.top;
    const hoehe = Math.max(300, r.bottom - oben);
    w.style.left = Math.round(r.left + 4) + 'px';
    w.style.width = Math.round(r.width - 8) + 'px';
    w.style.top = Math.round(Math.min(oben, r.bottom - hoehe)) + 'px';
    w.style.height = Math.round(hoehe) + 'px';
  }

  function zeile() { const s = S(); return s && offen ? s.cart.find((x) => x.key === offen.key) : null; }
  function stueckpreis(x) {
    try {
      const unit = typeof global.lineUnit === 'function' ? global.lineUnit(x) : Number(x.price || 0);
      const s = S(), pfand = s && s.master.depositRule === 'automatic' ? (x.deposits || []).reduce((a, d) => a + Number(d.price || 0), 0) : 0;
      return unit + pfand;
    } catch (e) { return Number(x.price || 0); }
  }
  function gesperrt(x) {
    if (!x || x.lockedQuantity) return true;
    try { if (typeof global.istHalbeZeile === 'function' && global.istHalbeZeile(x)) return true; } catch (e) { /* */ }
    try { if (typeof global.gutscheinZeile === 'function' && global.gutscheinZeile(x)) return true; } catch (e) { /* */ }
    return false;
  }

  function zeichnen() {
    const w = fenster(), x = zeile();
    if (!x) { zu(); return; }
    w.querySelector('.km-bild').src = x.image || '';
    w.querySelector('.km-name').textContent = x.name + (x.option && x.option.id !== 'none' && x.option.id !== 'ohne' ? ` + ${x.option.name}` : '');
    const preis = stueckpreis(x);
    w.querySelector('.km-preis').textContent = `${eu(preis)} je Stück${(x.deposits || []).length ? ' (inkl. Pfand)' : ''} · Menge antippen`;
    const zu1 = gesperrt(x);
    w.querySelectorAll('[data-km-zahl],[data-km="minus"],[data-km="plus"]').forEach((b) => { b.disabled = zu1; });
    if (!zu1) w.querySelector('[data-km="minus"]').disabled = Number(x.qty) <= 1;
    const produkt = (typeof PRODUCTS !== 'undefined' ? PRODUCTS : []).find((p) => p.id === x.id); // eslint-disable-line no-undef
    w.querySelector('[data-km="variante"]').hidden = !(produkt && produkt.optionGroup);
    w.querySelector('[data-km="info"]').hidden = !produkt;
    w.querySelectorAll('[data-km-zahl]').forEach((b) => b.classList.toggle('km-gewaehlt', !zu1 && Number(b.dataset.kmZahl) === offen.gewaehlt));
    w.querySelector('.km-summe').innerHTML = `${esc(x.qty)} × ${esc(x.name)} = ${esc(eu(preis * x.qty))}`
      + `<small>${zu1 ? 'Menge steht fest' : offen.getippt ? 'Nochmal tippen zählt dazu (5 + 5 = 10)' : 'Nächsten Artikel antippen – das Fenster wechselt mit'}</small>`;
  }

  function zeitNeu() {
    clearTimeout(zuTimer); zuTimer = setTimeout(zu, ZU_NACH_MS);
    const balken = doc.querySelector('#kcMenge .km-zeit i');
    if (balken) { balken.style.transition = 'none'; balken.style.width = '100%'; void balken.offsetWidth; balken.style.transition = `width ${ZU_NACH_MS}ms linear`; balken.style.width = '0%'; }
  }

  function oeffnen(key, basis) {
    if (!an()) return;
    const s = S(); if (!s) return;
    const x = s.cart.find((y) => y.key === key); if (!x) return;
    const w = fenster();
    const wechsel = !w.hidden && offen && offen.key !== key;
    offen = { key, basis: Math.max(0, Number(basis) || 0), getippt: false, gewaehlt: 1 };
    w.hidden = false; lage(); zeichnen(); zeitNeu();
    if (wechsel || w.dataset.einmal !== '1') { w.classList.remove('km-neu'); void w.offsetWidth; w.classList.add('km-neu'); w.dataset.einmal = '1'; }
    clearInterval(lageTimer); lageTimer = setInterval(() => { lage(); if (!zeile()) zu(); }, 700);
  }
  function zu() {
    const w = doc.getElementById('kcMenge'); if (w) { w.hidden = true; w.dataset.einmal = ''; }
    offen = null; clearTimeout(zuTimer); clearInterval(lageTimer);
  }

  function mengeSetzen(n) {
    const s = S(), x = zeile(); if (!s || !x || gesperrt(x)) return;
    n = Math.max(1, Math.min(999, Math.round(n)));
    s.selectedCartKey = x.key;
    if (typeof global.applyQuantity === 'function') global.applyQuantity(n);
    else { x.qty = n; if (typeof global.renderCart === 'function') global.renderCart(); }
  }
  function klick(e) {
    const b = e.target.closest('button'); if (!b || b.disabled || !offen) return;
    e.preventDefault(); e.stopPropagation();
    const x = zeile(); if (!x) { zu(); return; }
    const z = Number(b.dataset.kmZahl);
    if (z) {
      // Erster Tipp ersetzt die automatisch gebuchte 1 (bzw. das +1 bei einem schon vorhandenen Artikel), jeder weitere zählt dazu.
      mengeSetzen(offen.getippt ? Number(x.qty) + z : offen.basis + z);
      offen.getippt = true; offen.gewaehlt = z;
    } else if (b.dataset.km === 'minus' || b.dataset.km === 'plus') {
      mengeSetzen(Number(x.qty) + (b.dataset.km === 'plus' ? 1 : -1)); offen.getippt = true;
      const neu = Number(zeile()?.qty) || 0; offen.gewaehlt = neu >= 1 && neu <= 6 ? neu : 0;   // − / +: markiert die Menge, solange es 1–6 ist
    }
    else if (b.dataset.km === 'zu') { zu(); return; }
    else if (b.dataset.km === 'info') { if (typeof global.openProductInfo === 'function') global.openProductInfo(x.id); }
    else if (b.dataset.km === 'variante') { if (typeof global.openProductVariants === 'function') global.openProductVariants(x.id); }
    zeichnen(); zeitNeu();
  }

  // Einhängen: jeder Artikel, der über Kachel, Scan oder Variante in den Bon kommt, läuft über addConfiguredProduct.
  function einhaengen() {
    if (typeof global.addConfiguredProduct !== 'function') return false;
    if (global.addConfiguredProduct.kcMenge) return true;
    const original = global.addConfiguredProduct;
    const neu = function (p, option) {
      const s = S();
      const vorher = new Map(s ? s.cart.map((x) => [x.key, Number(x.qty) || 0]) : []);
      const laengeVorher = s ? s.cart.length : 0, zuletztVorher = s ? s.lastAdded : null;
      const ergebnis = original.apply(this, arguments);
      try {
        const s2 = S();
        if (s2 && s2.lastAdded && (s2.cart.length !== laengeVorher || s2.lastAdded !== zuletztVorher || (vorher.get(s2.lastAdded) || 0) !== (s2.cart.find((x) => x.key === s2.lastAdded)?.qty || 0))) {
          const x = s2.cart.find((y) => y.key === s2.lastAdded);
          if (x) oeffnen(x.key, vorher.get(x.key) || 0);
        }
      } catch (e) { /* Anzeige darf das Buchen nie stören */ }
      return ergebnis;
    };
    neu.kcMenge = true;
    global.addConfiguredProduct = neu;
    // Kassieren: Fenster sofort zu
    if (typeof global.completeSale === 'function' && !global.completeSale.kcMenge) {
      const cs = global.completeSale;
      const csNeu = function () { zu(); return cs.apply(this, arguments); };
      csNeu.kcMenge = true; global.completeSale = csNeu;
    }
    return true;
  }

  // Schalter unter „Mehr“
  function schalter() {
    const grid = doc.querySelector('.more-grid'); if (!grid) return false;
    let k = doc.getElementById('kcMengeSchalter');
    if (!k) {
      k = doc.createElement('button'); k.type = 'button'; k.id = 'kcMengeSchalter'; k.className = 'kc-ansicht-schalter';
      k.title = 'Mengenfenster neben den Kacheln ein- oder ausschalten';
      k.innerHTML = '<span class="kc-ansicht-punkt" aria-hidden="true"></span><span class="kc-ansicht-text"></span>';
      const schliessen = grid.querySelector('button[value="close"]');
      grid.insertBefore(k, schliessen || null);
      k.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        try { localStorage.setItem(LAGER, an() ? '0' : '1'); } catch (err) { /* */ }
        if (!an()) zu();
        beschriften();
        if (typeof global.setSystemHint === 'function') global.setSystemHint(an() ? 'Mengenfenster eingeschaltet' : 'Mengenfenster ausgeschaltet', 'info');
      });
    }
    beschriften();
    return true;
  }
  function beschriften() {
    const k = doc.getElementById('kcMengeSchalter'); if (!k) return;
    k.classList.toggle('an', an());
    k.setAttribute('aria-pressed', String(an()));
    k.querySelector('.kc-ansicht-text').textContent = an() ? '🔢 Mengenfenster: AN' : '🔢 Mengenfenster: AUS';
  }

  function los() {
    let n = 0;
    const versuch = () => { const a = einhaengen(), b = schalter(); if ((a && b) || ++n > 60) return; setTimeout(versuch, 500); };
    versuch();
    global.addEventListener('resize', lage);
    global.addEventListener('adaptive-layout-change', lage);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', los); else los();
  global.KCMengenfenster = { oeffnen, zu, an, offen: () => (offen ? { ...offen } : null), version: '1.1.0' };
})(window);
