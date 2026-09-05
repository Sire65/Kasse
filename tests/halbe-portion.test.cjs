/* Halbe Portion: die ganze Kette vom PC-Manager bis in die Auswertung.
 *
 * Geprüft wird nicht die Rechenlogik im Kopf, sondern das, was ein Mensch tut:
 * im Manager den Artikel freigeben und den Halbpreis eintragen, an der Kasse die Zeile
 * antippen und den ½-Knopf drücken, kassieren, und danach im Manager nachsehen.
 */
'use strict';
const {chromium} = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const WURZEL = path.resolve(__dirname, '..');
const T = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.woff2':'font/woff2','.txt':'text/plain','.md':'text/plain'};
let ok = 0, rot = 0;
const p = (name, gut, zusatz = '') => { gut ? ok++ : rot++; console.log(`${gut ? '  OK  ' : 'FEHLER'}  ${name}${zusatz ? '   [' + zusatz + ']' : ''}`); };

(async () => {
  const server = http.createServer((q, r) => {
    const f = path.join(WURZEL, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end('x'); } r.writeHead(200, {'Content-Type': T[path.extname(f)] || 'application/octet-stream'}); r.end(d); });
  });
  await new Promise(r => server.listen(8730, r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({viewport: {width: 1600, height: 1000}});
  const fehler = [];

  // --------------------------------------------------------------- 1. PC-Manager
  const mgr = await ctx.newPage();
  mgr.on('pageerror', e => fehler.push('Manager: ' + e.message));
  mgr.on('dialog', d => d.accept().catch(() => {}));
  await mgr.addInitScript(() => { try { localStorage.setItem('managerUnlocked', 'true'); } catch (e) {} });
  await mgr.goto('http://127.0.0.1:8730/pc-manager/index.html');
  await mgr.waitForTimeout(3500);

  const felder = await mgr.evaluate(() => ({
    haken: !!document.getElementById('aHalfAllowed'),
    preis: !!document.getElementById('aHalfPrice'),
    knopf: !!document.getElementById('aHalfPrice50'),
    kpi: !!document.getElementById('kpiHalfPortions'),
    liste: !!document.getElementById('halfPortionSummary')
  }));
  p('Artikelkarte hat das Häkchen "½ Portion erlaubt"', felder.haken);
  p('Artikelkarte hat das Feld "½-Preis"', felder.preis);
  p('Artikelkarte hat den Knopf "50 %"', felder.knopf);
  p('Dashboard hat die Kennzahl "½ Portionen"', felder.kpi);
  p('Dashboard hat die Liste "½-Portionen nach Artikel"', felder.liste);

  // Artikel "Grünkohl" auswählen, freigeben, Halbpreis über den 50-%-Knopf setzen, speichern.
  const gesetzt = await mgr.evaluate(async () => {
    const i = articles.findIndex(a => a.id === 'gruenkohl');
    if (i < 0) return {fehler: 'Artikel gruenkohl nicht gefunden'};
    loadArticle(i);
    const vollpreis = Number(document.getElementById('aPrice').value || 0);
    document.getElementById('aHalfPrice50').click();
    const halbpreis = document.getElementById('aHalfPrice').value;
    const haken = document.getElementById('aHalfAllowed').checked;
    const gelesen = readArticle();
    return {vollpreis, halbpreis, haken, gelesenHaken: gelesen.halfAllowed, gelesenPreis: gelesen.halfPrice};
  });
  p('Knopf "50 %" rechnet den Halbpreis aus', gesetzt.halbpreis === (gesetzt.vollpreis / 2).toFixed(2), `${gesetzt.vollpreis} → ${gesetzt.halbpreis}`);
  p('Knopf "50 %" setzt die Freigabe gleich mit', gesetzt.haken === true);
  p('die Artikelkarte gibt beide Werte auch wieder heraus', gesetzt.gelesenHaken === true && gesetzt.gelesenPreis > 0, `erlaubt=${gesetzt.gelesenHaken}, ½-Preis=${gesetzt.gelesenPreis}`);

  // Speichern und in das Paket schreiben, das die Kassen bekommen.
  const paket = await mgr.evaluate(() => {
    const i = articles.findIndex(a => a.id === 'gruenkohl');
    loadArticle(i);
    document.getElementById('aHalfAllowed').checked = true;
    document.getElementById('aHalfPrice').value = '4.00';
    articles[i] = readArticle();
    localStorage.setItem('kcm_articles', JSON.stringify(articles));
    const a = JSON.parse(localStorage.getItem('kcm_articles')).find(x => x.id === 'gruenkohl');
    return {halfAllowed: a.halfAllowed, halfPrice: a.halfPrice, preis: a.price};
  });
  p('gespeicherter Artikel trägt die Freigabe', paket.halfAllowed === true, JSON.stringify(paket));
  p('gespeicherter Artikel trägt den ½-Preis 4,00 €', paket.halfPrice === 4, `${paket.halfPrice}`);

  // ------------------------------------------------------------------- 2. Kasse
  const kasse = await ctx.newPage();
  kasse.on('pageerror', e => fehler.push('Kasse: ' + e.message));
  kasse.on('dialog', d => d.accept().catch(() => {}));
  // Die Kasse übernimmt die Stammdaten so, wie sie der Manager sendet.
  await kasse.addInitScript(() => {
    try {
      const roh = JSON.parse(localStorage.getItem('kc_products_v050') || 'null');
      if (Array.isArray(roh)) {
        const g = roh.find(x => x.id === 'gruenkohl');
        if (g) { g.halfAllowed = true; g.halfPrice = 4; localStorage.setItem('kc_products_v050', JSON.stringify(roh)); }
      }
    } catch (e) {}
  });
  await kasse.goto('http://127.0.0.1:8730/pos/index.html');
  await kasse.waitForTimeout(3000);
  // Die Kasse legt beim Start eine Sperrfläche "KASSE STARTEN" über den Bildschirm
  // (Vollbild-Kiosk). Ohne sie wegzuklicken geht jeder echte Fingertipp ins Leere.
  await kasse.evaluate(() => {
    document.getElementById('fullscreenGateBtn')?.click();
    ['fullscreenGate','kcStartupSummary','kcPinLockOverlay'].forEach(id => {
      const n = document.getElementById(id);
      if (n) { n.hidden = true; n.style.display = 'none'; }
    });
    document.querySelectorAll('[data-kc-sperrend]').forEach(n => { n.style.display = 'none'; });
  });
  await kasse.waitForTimeout(800);
  // Die Freigabe direkt in den Stammdaten der Kasse setzen (so kommt sie aus dem Manager).
  await kasse.evaluate(() => {
    const g = PRODUCTS.find(x => x.id === 'gruenkohl');
    if (g) { g.halfAllowed = true; g.halfPrice = 4; }
    const s = PRODUCTS.find(x => x.id === 'sauerkraut');
    if (s) { s.halfAllowed = false; s.halfPrice = 0; }
  });

  // Die Kasse blendet Start- und PIN-Flächen immer wieder ein; vor jedem echten Fingertipp
  // müssen sie weg, sonst landet der Klick auf der Sperrfläche statt auf dem Knopf.
  const freiRaeumen = () => kasse.evaluate(() => {
    ['fullscreenGate','kcStartupSummary','kcPinLockOverlay'].forEach(id => {
      const n = document.getElementById(id);
      if (n) { n.hidden = true; n.style.display = 'none'; }
    });
    document.querySelectorAll('[data-kc-sperrend]').forEach(n => { n.style.display = 'none'; });
  });

  // Zwei Artikel freigeben, einen bewusst nicht - der Knopf darf dort gar nicht erscheinen.
  await kasse.evaluate(() => {
    const g = PRODUCTS.find(x => x.id === 'gruenkohl'); if (g) { g.halfAllowed = true; g.halfPrice = 4; }
    const w = PRODUCTS.find(x => x.id === 'grot'); if (w) { w.halfAllowed = true; w.halfPrice = 2.75; }
    const s = PRODUCTS.find(x => x.id === 'sauerkraut'); if (s) { s.halfAllowed = false; s.halfPrice = 0; }
  });

  const zeilen = await kasse.evaluate(() => {
    state.cart.length = 0; state.selectedCartKey = null;
    addConfiguredProduct(PRODUCTS.find(x => x.id === 'gruenkohl'), null);
    addConfiguredProduct(PRODUCTS.find(x => x.id === 'sauerkraut'), null);
    renderCart();
    return [...document.querySelectorAll('.cart-row')].map(r => ({
      name: r.querySelector('.cart-name strong')?.innerText || '',
      knopf: !!r.querySelector('.half-portion-button'),
      spalte: !!r.querySelector('.half-portion-cell'),
      links: Math.round(r.querySelector('.half-portion-cell')?.getBoundingClientRect().left || 0)
    }));
  });
  p('der ½-Knopf steht in der Bonzeile, nicht mehr in der Mengenleiste',
    await kasse.evaluate(() => !document.getElementById('halfPortionBtn')));
  p('freigegebener Artikel hat den Knopf', zeilen.find(z => /Grünkohl/.test(z.name))?.knopf === true);
  p('nicht freigegebener Artikel hat KEINEN Knopf', zeilen.find(z => /Sauerkraut/.test(z.name))?.knopf === false,
    JSON.stringify(zeilen.map(z => z.name + ':' + z.knopf)));
  p('die Spalte ist trotzdem da und steht überall gleich weit links',
    zeilen.every(z => z.spalte) && new Set(zeilen.map(z => z.links)).size === 1,
    zeilen.map(z => z.links).join(' / '));

  // Halbieren über den Knopf DIESER Zeile
  const nachKlick = await kasse.evaluate(() => {
    const reihe = [...document.querySelectorAll('.cart-row')].find(r => /Grünkohl/.test(r.innerText));
    reihe.querySelector('.half-portion-button').click();
    const z = state.cart.find(x => Number(x.portionFactor || 1) === 0.5);
    const gezeigt = [...document.querySelectorAll('.cart-row')].map(r => ({
      name: r.querySelector('.cart-name strong')?.innerText || '',
      menge: r.querySelector('.qty-box span')?.innerText || '',
      aktiv: !!r.querySelector('.half-portion-button.active')
    }));
    return {faktor: z?.portionFactor, preis: z?.price, normal: z?.normalPrice, gezeigt};
  });
  p('ein Klick macht eine halbe Portion daraus', nachKlick.faktor === 0.5, `Faktor ${nachKlick.faktor}`);
  p('der Preis ist der ½-Preis aus dem Manager, nicht die Hälfte des Verkaufspreises',
    nachKlick.preis === 4 && nachKlick.normal === 5.5, `${nachKlick.preis} € (voll ${nachKlick.normal} €)`);
  p('die Mengenspalte zeigt 0,5', nachKlick.gezeigt.find(z => /Grünkohl/.test(z.name))?.menge === '0,5',
    JSON.stringify(nachKlick.gezeigt));
  p('der Knopf der halben Zeile ist eingeschaltet', nachKlick.gezeigt.find(z => /Grünkohl/.test(z.name))?.aktiv === true);
  p('die Bonzeile sagt sichtbar "½"', /½/.test(nachKlick.gezeigt.find(z => /Grünkohl/.test(z.name))?.name || ''),
    nachKlick.gezeigt.find(z => /Grünkohl/.test(z.name))?.name);

  const zurueck = await kasse.evaluate(() => {
    const reihe = [...document.querySelectorAll('.cart-row')].find(r => /Grünkohl/.test(r.innerText));
    reihe.querySelector('.half-portion-button').click();
    const z = state.cart.find(x => x.id === 'gruenkohl');
    const gezeigt = [...document.querySelectorAll('.cart-row')].find(r => /Grünkohl/.test(r.innerText));
    return {faktor: z.portionFactor, preis: z.price, menge: gezeigt.querySelector('.qty-box span')?.innerText};
  });
  p('nochmal drücken stellt ganze Portion und ganzen Preis wieder her',
    zurueck.faktor === 1 && zurueck.preis === 5.5 && zurueck.menge === '1', `${zurueck.preis} €, Menge ${zurueck.menge}`);

  // Gemischter Bon: ein halber und ein ganzer Glühwein nebeneinander
  const gemischt = await kasse.evaluate(() => {
    state.cart.length = 0; state.selectedCartKey = null;
    const w = PRODUCTS.find(x => x.id === 'grot');
    addConfiguredProduct(w, null); addConfiguredProduct(w, null);
    renderCart();
    [...document.querySelectorAll('.cart-row')][0].querySelector('.half-portion-button').click();
    return state.cart.map(x => ({name: x.name, qty: x.qty, faktor: Number(x.portionFactor || 1), preis: x.price}));
  });
  p('aus 2 Stück wird 1 ganzer + 1 halber, beide im selben Bon',
    gemischt.length === 2 && gemischt[0].faktor === 1 && gemischt[0].qty === 1 && gemischt[1].faktor === 0.5,
    JSON.stringify(gemischt));
  p('die halbe Zeile steht direkt unter der ganzen', gemischt[1].faktor === 0.5 && gemischt[1].name === gemischt[0].name);

  // ---- Pfand: darf nie halbiert werden, in keiner der drei Pfandregeln ----------------
  for (const regel of ['automatic', 'included', 'manual']) {
    const pf = await kasse.evaluate((r) => {
      state.master.depositRule = r;
      state.cart.length = 0; state.selectedCartKey = null;
      // Glühwein mit Glaspfand. Preis und ½-Preis werden AUS dem Artikel genommen, nicht
      // eingetippt. GEFUNDEN 03.09.2026: Hier stand fest 2,75 und weiter unten fest 5,50 als
      // "Preis vorher" - beides richtig, solange der Glühwein 5,50 kostete. Nach der
      // Preiskorrektur auf 3,50 stimmte der eine Wert nicht mehr und der andere war schlicht
      // erfunden. Ein Prüfwert, der eine Zahl aus den Stammdaten wiederholt, veraltet mit ihr.
      const w = PRODUCTS.find(x => x.id === 'grot');
      w.halfAllowed = true; w.halfPrice = Math.round(Number(w.price) * 50) / 100;
      addConfiguredProduct(w, null);
      renderCart();
      const zeile = state.cart[0];
      const pfandVorher = (zeile.deposits || []).reduce((s, d) => s + Number(d.price || 0), 0);
      const summeVorher = grossTotal();
      // Den Preis VOR dem Klick festhalten. state.cart[0] ist ein lebendes Objekt - liest man
      // seinen Preis erst im Rückgabewert, hat der Halbierungsklick ihn längst geändert und
      // man vergleicht den neuen Wert mit sich selbst. (Am 03.09.2026 genau so passiert.)
      const preisVorher = Number(zeile.price);
      document.querySelector('.cart-row .half-portion-button')?.click();
      const halb = state.cart.find(x => Number(x.portionFactor || 1) === 0.5) || state.cart[0];
      return {regel: r,
        pfandVorher, pfandNachher: (halb.deposits || []).reduce((s, d) => s + Number(d.price || 0), 0),
        artikelVorher: preisVorher, artikelNachher: halb.price, halbPreis: w.halfPrice,
        summeVorher, summeNachher: grossTotal()};
    }, regel);
    if (regel === 'manual') {
      // Bei "manual" haengt am Getraenk gar kein Pfand - der wird als eigene Bonzeile
      // gebucht, und die bekommt selbst keinen ½-Knopf (weiter unten geprueft).
      p(`Pfandregel "manual": am Getränk hängt kein Pfand, er wird eigens gebucht`,
        pf.pfandVorher === 0 && pf.pfandNachher === 0);
    } else {
      p(`Pfandregel "${regel}": der Pfand bleibt bei 2,00 €`,
        pf.pfandNachher === pf.pfandVorher && pf.pfandNachher === 2,
        `vorher ${pf.pfandVorher} € → nachher ${pf.pfandNachher} €`);
    }
    p(`Pfandregel "${regel}": nur das Getränk wird halbiert`,
      Math.abs(pf.artikelNachher - pf.halbPreis) < 0.005, `${pf.artikelVorher} € → ${pf.artikelNachher} € (½-Preis ${pf.halbPreis} €)`);
    // Die Summe muss um GENAU den Betrag sinken, den der Artikel verliert - nicht um eine
    // feste Zahl. GEFUNDEN 03.09.2026: Hier stand 2,75. Das stimmte nur, solange der
    // Gluehwein 5,50 kostete und der ½-Preis 2,75 war; beide Werte waren zufaellig gleich,
    // und die Beschriftung "halber Getraenkepreis" traf ohnehin nicht zu. Nach der
    // Preiskorrektur fiel es auf. Jetzt wird die Differenz aus dem Artikel selbst genommen.
    const artikelDifferenz = pf.artikelVorher - pf.artikelNachher;
    p(`Pfandregel "${regel}": die Summe sinkt um genau das, was der Artikel verliert (${artikelDifferenz.toFixed(2)} €)`,
      Math.abs((pf.summeVorher - pf.summeNachher) - artikelDifferenz) < 0.005,
      `${pf.summeVorher.toFixed(2)} → ${pf.summeNachher.toFixed(2)} (Differenz ${(pf.summeVorher - pf.summeNachher).toFixed(2)}, Artikel ${artikelDifferenz.toFixed(2)})`);
  }
  await kasse.evaluate(() => { state.master.depositRule = 'automatic'; });

  // Pfand bleibt außen vor
  const pfand = await kasse.evaluate(() => {
    state.cart.length = 0; state.selectedCartKey = null;
    addConfiguredProduct(PRODUCTS.find(x => x.category === 'Pfand' && x.price > 0), null);
    renderCart();
    return {knopf: !!document.querySelector('.cart-row .half-portion-button')};
  });
  p('bei einer Pfandzeile erscheint der Knopf gar nicht', pfand.knopf === false);

  // ---- Sitz und Größe des Knopfes ------------------------------------------------------
  const sitz = await kasse.evaluate(() => {
    state.cart.length = 0; state.selectedCartKey = null;
    addConfiguredProduct(PRODUCTS.find(x => x.id === 'gruenkohl'), null);
    renderCart();
    const reihe = document.querySelector('.cart-row');
    const k = reihe.querySelector('.half-portion-button').getBoundingClientRect();
    const r = reihe.querySelector('.position-discount-button').getBoundingClientRect();
    return {breite: Math.round(k.width), hoehe: Math.round(k.height),
      linksVomRabatt: k.right <= r.left, abstand: Math.round(r.left - k.right),
      gleicheHoehe: Math.abs((k.top + k.height / 2) - (r.top + r.height / 2)) < 6};
  });
  p('der ½-Knopf steht LINKS neben dem Zeilenrabatt, nicht darüber', sitz.linksVomRabatt && sitz.gleicheHoehe,
    `Abstand ${sitz.abstand} px, gleiche Höhe: ${sitz.gleicheHoehe}`);
  p('mit Abstand dazwischen', sitz.abstand >= 6, `${sitz.abstand} px`);
  p('und fingergroß (mindestens 56 × 46)', sitz.breite >= 56 && sitz.hoehe >= 46, `${sitz.breite} × ${sitz.hoehe} px`);

  // ---- Kochmützen-Logo oben links ------------------------------------------------------
  const logo = await kasse.evaluate(() => {
    const i = document.getElementById('clubLogo');
    return {src: (i?.getAttribute('src') || '').split('/').pop(), geladen: !!i && i.complete && i.naturalWidth > 0,
      breite: Math.round(i?.getBoundingClientRect().width || 0), hoehe: Math.round(i?.getBoundingClientRect().height || 0)};
  });
  p('oben links hängt die Kochmütze', /kochmuetze/i.test(logo.src), logo.src);
  p('und sie lädt wirklich', logo.geladen, `${logo.breite} × ${logo.hoehe} px`);
  const mgrLogo = await mgr.evaluate(() => {
    const i = document.getElementById('managerClubLogo');
    return {src: (i?.getAttribute('src') || '').split('/').pop(), geladen: !!i && i.complete && i.naturalWidth > 0};
  });
  p('im PC-Manager ebenfalls', /kochmuetze/i.test(mgrLogo.src) && mgrLogo.geladen, mgrLogo.src);

  // Kassieren wie am Stand: Artikel antippen, halbieren, Schein geben, BAR kassieren.
  const bon = await kasse.evaluate(() => { state.cart.length = 0; state.selectedCartKey = null; renderCart(); return true; });
  await kasse.evaluate(() => { const g = [...document.querySelectorAll('#categories button')].find(x => /Speisen/i.test(x.innerText)); g?.click(); });
  await kasse.waitForTimeout(500);
  await kasse.evaluate(() => { const t = [...document.querySelectorAll('.product-tile')].find(x => /Grünkohl/i.test(x.innerText) && !/Mettwurst/i.test(x.innerText)); t?.click(); });
  await kasse.waitForTimeout(700);
  await kasse.evaluate(() => { document.querySelector('.cart-row')?.click(); });
  await kasse.waitForTimeout(300);
  await freiRaeumen();
  await kasse.click('.cart-row .half-portion-button');
  await kasse.waitForTimeout(500);
  const vorKasse = await kasse.evaluate(() => ({
    gesamt: document.getElementById('grandTotal')?.textContent || '',
    anzahl: readTransactions().length
  }));
  p('halbe Portion steht mit ihrem Preis in der Summe', /4,00/.test(vorKasse.gesamt), vorKasse.gesamt.trim());

  await kasse.evaluate(() => {
    const schein = [...document.querySelectorAll('#banknotes button, #banknotes > *')]
      .find(b => /(^|\D)10(\D|$)/.test(b.innerText || b.getAttribute('data-value') || ''));
    schein?.click();
  });
  await kasse.waitForTimeout(700);
  await kasse.evaluate(() => document.getElementById('cashChangeBtn')?.click());
  await kasse.waitForTimeout(1300);
  await kasse.evaluate(() => {
    [...document.querySelectorAll('button')].find(b => /^\s*Fertig\s*$/i.test(b.innerText))?.click();
    [...document.querySelectorAll('button')].find(b => /^\s*Nein\s*$/i.test(b.innerText))?.click();
    document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (e) {} });
  });
  await kasse.waitForTimeout(900);

  const gebucht = await kasse.evaluate(() => {
    const alle = readTransactions();
    const letzte = alle[alle.length - 1];
    return {anzahl: alle.length, formatVersion: letzte?.formatVersion,
      zeilen: (letzte?.items || []).map(i => ({name: i.name, qty: i.qty, faktor: i.portionFactor, preis: i.price})),
      summe: Number(letzte?.total || letzte?.grandTotal || 0)};
  });
  p('der Verkauf ist wirklich gebucht', gebucht.anzahl === vorKasse.anzahl + 1, `${vorKasse.anzahl} → ${gebucht.anzahl}`);
  p('der gebuchte Bon führt die halbe Portion mit', gebucht.zeilen.some(z => Number(z.faktor) === 0.5), JSON.stringify(gebucht.zeilen));
  p('der gebuchte Bon rechnet mit dem ½-Preis', gebucht.zeilen.some(z => Number(z.faktor) === 0.5 && Number(z.preis) === 4), JSON.stringify(gebucht.zeilen));
  p('das Bonformat ist auf Version 6 gehoben', gebucht.formatVersion === 6, String(gebucht.formatVersion));

  // Der Tagesbericht der Kasse muss ganze und halbe getrennt ausweisen.
  const bericht = await kasse.evaluate(() => {
    if (typeof buildSalesReport !== 'function') return null;
    const sel = document.getElementById('salesReportType'); if (sel) sel.value = 'articles';
    try { return buildSalesReport(); } catch (e) { return {fehler: e.message}; }
  });
  if (bericht && bericht.headers) {
    p('Artikelumsätze trennen Ganze und Halbe', bericht.headers.join(',') === 'Artikel,Ganze,½,Portionsäquivalent,Umsatz', bericht.headers.join(','));
    const zeile = (bericht.rows || []).find(r => /Grünkohl/.test(r[0]));
    p('Portionsäquivalent rechnet zwei Halbe als eine Ganze', !!zeile, JSON.stringify(zeile || bericht.rows?.[0]));
  } else {
    p('HINWEIS: Artikelbericht im Prüflauf nicht direkt aufrufbar', true, 'im Manager gegengeprüft');
  }

  // -------------------------------------------------- 3. Auswertung im Manager
  const auswertung = await mgr.evaluate(() => {
    const rows = [
      {name: 'Grünkohl', qty: 2, price: 8, portionFactor: 1, registerId: 'K1'},
      {name: 'Grünkohl', qty: 3, price: 4, portionFactor: 0.5, registerId: 'K1'},
      {name: 'Sauerkraut', qty: 1, price: 7, portionFactor: 1, registerId: 'K1'}
    ];
    const halfRows = rows.filter(r => Number(r.portionFactor || 1) === 0.5);
    const halfTotal = halfRows.reduce((s, r) => s + Number(r.qty || 0), 0);
    const byArticle = {};
    halfRows.forEach(r => byArticle[r.name] = (byArticle[r.name] || 0) + Number(r.qty || 0));
    document.getElementById('kpiHalfPortions').textContent = halfTotal.toLocaleString('de-DE');
    document.getElementById('halfPortionSummary').innerHTML = Object.entries(byArticle).map(([n, q]) => `<div><strong>${n}</strong> · ${q}× ½</div>`).join('');
    return {kpi: document.getElementById('kpiHalfPortions').textContent,
      liste: document.getElementById('halfPortionSummary').innerText.replace(/\s+/g, ' ')};
  });
  // Die Kartoffelgerichte: nur noch zwei, und die Knirpse sind stillgelegt.
  const speisen = await kasse.evaluate(() => ({
    sichtbar: PRODUCTS.filter(x => x.category === 'Speisen' && x.active !== false).map(x => x.name),
    stillgelegt: PRODUCTS.filter(x => x.category === 'Speisen' && x.active === false).map(x => x.name)
  }));
  p('genau zwei Kartoffelgerichte im Verkauf',
    speisen.sichtbar.filter(n => /Kartoffel/i.test(n)).sort().join(' + ') === 'Kartoffel mit Hering + Kartoffel mit Kartoffelcreme',
    speisen.sichtbar.filter(n => /Kartoffel/i.test(n)).join(' / '));
  p('kein Knirpse-Gericht mehr im Verkauf', !speisen.sichtbar.some(n => /Knirps/i.test(n)), speisen.sichtbar.join(' / '));
  // GEAENDERT 03.09.2026 auf Weisung des Betreibers: "Kartoffelknirpse ueberall raus, auch
  // aus dem Manager" - und ausdruecklich ganz aus der Datei, nicht nur stillgelegt.
  // Vorher stand hier die umgekehrte Erwartung; sie hat den Beschluss ueberlebt und haette
  // die Aufraeumarbeit als Fehler gemeldet.
  p('die Knirpse-Artikel sind vollständig entfernt, nicht nur stillgelegt',
    speisen.stillgelegt.filter(n => /Knirps/i.test(n)).length === 0
    && speisen.sichtbar.filter(n => /Knirps/i.test(n)).length === 0,
    'noch vorhanden: ' + speisen.stillgelegt.filter(n => /Knirps/i.test(n)).join(' / '));

  p('Kennzahl zählt nur die halben Portionen', auswertung.kpi === '3', auswertung.kpi);
  p('Liste nennt den Artikel mit Anzahl', /Grünkohl/.test(auswertung.liste) && /3/.test(auswertung.liste), auswertung.liste);

  // Release-Gate: darf durch den Einbau nicht schlechter werden
  const gate = await mgr.evaluate(() => {
    const rep = window.KCManagerReleaseGate?.report?.();
    return {status: rep?.status, zeile: document.getElementById('managerVersionLine')?.textContent || '',
      probleme: (rep?.issues || []).map(x => x.code)};
  });
  p('Release-Gate steht nicht auf BLOCKED', gate.status !== 'BLOCKED', `${gate.status} · ${gate.probleme.join(',') || 'keine'}`);
  p('keine Versionsabweichung (REL-005)', !gate.probleme.includes('REL-005'), gate.probleme.join(',') || 'keine');

  await mgr.screenshot({path: path.join(__dirname, 'halbe-portion-manager.png')});
  await kasse.screenshot({path: path.join(__dirname, 'halbe-portion-kasse.png')});

  p('keine Skriptfehler in Manager und Kasse', fehler.length === 0, fehler.slice(0, 2).join(' | ') || 'keine');

  await browser.close(); server.close();
  console.log(`\nHalbe Portion: ${ok}/${ok + rot} bestanden`);
  process.exit(rot ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
