/* HAPPY HOUR: vom Zeitplan im PC-Manager bis zum Preis im Bon.

   Die vier Forderungen des Betreibers, jede einzeln geprueft:
     1. Die Happy Hour wird im PC-Manager gesteuert - Zeitraumtabelle fuer den Weihnachtsmarkt.
     2. Bis zu drei Zeitbereiche je Tag.
     3. Ist die Zeit abgelaufen, gilt wieder der alte Preis.
     4. Artikel, die in dem Moment im Warenkorb liegen, behalten den Happy-Hour-Preis.

   Punkt 3 und 4 sind das Herzstueck und werden mit echten Klicks an der Kasse geprueft,
   nicht am Quelltext. */
try { require.resolve('playwright'); } catch (e) { console.log('  ueberspringen: Playwright nicht installiert'); process.exit(0); }
const {chromium} = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const WURZEL = path.join(__dirname, '..');
const TYPEN = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml'};
const server = http.createServer((q, r) => {
  const p = path.join(WURZEL, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p, (e, d) => {
    if (e) { r.writeHead(404); return r.end('weg'); }
    r.writeHead(200, {'Content-Type': TYPEN[path.extname(p)] || 'application/octet-stream'});
    r.end(d);
  });
});
let fehler = 0;
const pruefe = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) fehler++; };
const geldZahl = (t) => Number(String(t).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));

// Ein Zeitplan, der JETZT gilt - damit der Test zu jeder Tageszeit dasselbe misst.
function planFuerJetzt(minutenNochGueltig) {
  const jetzt = new Date();
  const hh = (d) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  const tag = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    aktiv: true,
    zeitraum: {von: tag(new Date(jetzt.getTime() - 86400000)), bis: tag(new Date(jetzt.getTime() + 86400000))},
    standard: [{von: hh(new Date(jetzt.getTime() - 30 * 60000)), bis: hh(new Date(jetzt.getTime() + minutenNochGueltig * 60000))}],
    ausnahmen: [],
  };
}

(async () => {
  await new Promise((r) => server.listen(8481, r));
  const browser = await chromium.launch();

  // ================= Teil 1: die Rechnung im gemeinsamen Modul =================
  console.log('\n--- Zeitplan: Standardzeiten, Ausnahmen, drei Zeitbereiche ---');
  const rechnung = await (async () => {
    const s = await browser.newPage();
    await s.goto(`http://127.0.0.1:8481/pos/index.html`);
    await s.waitForTimeout(1500);
    const r = await s.evaluate(() => {
      const H = window.KCHappyHour;
      if (!H) return {kein: true};
      const plan = {aktiv: true, zeitraum: {von: '2026-11-27', bis: '2026-12-23'},
        standard: [{von: '11:00', bis: '12:00'}, {von: '17:00', bis: '18:00'}, {von: '20:00', bis: '21:00'}],
        ausnahmen: [{datum: '2026-12-06', aus: true}, {datum: '2026-12-11', fenster: [{von: '19:00', bis: '19:30'}]}]};
      const artikel = [
        {id: 'grot', name: 'Glühwein rot', price: 5.5, hhAktiv: true, hhPreis: 5.0},
        {id: 'gweiss', name: 'Glühwein weiß', price: 5.5, hhAktiv: true},              // angehakt, kein Preis
        {id: 'feuer', name: 'Feuerzangenbowle', price: 5.0, hhAktiv: true, hhPreis: 6.0}, // teurer -> ungültig
        {id: 'apfel', name: 'Apfelpunsch', price: 4.5, hhAktiv: false, hhPreis: 4.0}];
      return {
        normalerTag: H.fensterFuerTag(plan, '2026-12-01').length,
        ausgeschaltet: H.fensterFuerTag(plan, '2026-12-06').length,
        ausnahmeTag: H.fensterText(H.fensterFuerTag(plan, '2026-12-11')),
        vorDemMarkt: H.fensterFuerTag(plan, '2026-11-01').length,
        teilnehmer: H.teilnehmer(artikel).map((a) => a.id),
        angebote: H.alsAngebote(plan, artikel, '2026-12-01').map((o) => ({p: o.priceValue, von: o.startTime, bis: o.endTime, mode: o.priceMode, id: o.productIds[0]})),
        maxFenster: H.MAX_FENSTER,
        zuVieleFenster: H.fensterFuerTag({...plan, standard: [{von: '08:00', bis: '09:00'}, {von: '10:00', bis: '11:00'}, {von: '12:00', bis: '13:00'}, {von: '14:00', bis: '15:00'}]}, '2026-12-01').length,
        ueberschneidung: H.pruefePlan({aktiv: true, zeitraum: {von: '2026-11-27', bis: '2026-12-23'}, standard: [{von: '17:00', bis: '19:00'}, {von: '18:00', bis: '20:00'}]}).fehler.length,
      };
    });
    await s.close();
    return r;
  })();
  pruefe('Das gemeinsame Modul ist an der Kasse geladen', !rechnung.kein);
  pruefe('Drei Zeitbereiche am Tag sind möglich', rechnung.maxFenster === 3 && rechnung.normalerTag === 3, `${rechnung.normalerTag} Bereiche`);
  pruefe('Mehr als drei Bereiche werden nicht übernommen', rechnung.zuVieleFenster === 3, `${rechnung.zuVieleFenster}`);
  pruefe('Ein Tag lässt sich ganz abschalten', rechnung.ausgeschaltet === 0);
  pruefe('Ein Tag lässt sich mit eigenen Zeiten versehen', rechnung.ausnahmeTag === '19:00–19:30', rechnung.ausnahmeTag);
  pruefe('Außerhalb des Marktzeitraums gilt nichts', rechnung.vorDemMarkt === 0);
  pruefe('Überschneidende Zeitbereiche werden beanstandet', rechnung.ueberschneidung > 0, `${rechnung.ueberschneidung} Meldung(en)`);
  pruefe('Nur Artikel mit gültigem, günstigerem Preis nehmen teil',
    JSON.stringify(rechnung.teilnehmer) === JSON.stringify(['grot']), JSON.stringify(rechnung.teilnehmer));
  pruefe('Je Artikel und Zeitbereich entsteht ein Angebot mit FESTEM Preis',
    rechnung.angebote.length === 3 && rechnung.angebote.every((o) => o.mode === 'fixed' && o.p === 5), JSON.stringify(rechnung.angebote[0]));

  // ================= Teil 2: die Kasse holt sich den Zeitplan =================
  console.log('\n--- Die Kasse übernimmt den Zeitplan aus den Stammdaten ---');
  const plan = planFuerJetzt(60);
  const kasse = await browser.newPage({viewport: {width: 1900, height: 1030}});
  const seitenfehler = [];
  kasse.on('pageerror', (e) => seitenfehler.push(e.message));
  await kasse.addInitScript((p) => {
    // So kommt der Plan im Betrieb an: der Manager schickt ihn beim Stammdaten-Abgleich
    // in den Einstellungen mit, die Kasse legt ihn in kc_master_v040 ab.
    localStorage.setItem('kc_master_v040', JSON.stringify({registerId: 'KASSE-01', pinLockEnabled: false, happyHour: p}));
    const artikel = JSON.parse(localStorage.getItem('kc_products_v050') || 'null');
    if (!artikel) localStorage.removeItem('kc_products_v050');
  }, plan);
  await kasse.goto('http://127.0.0.1:8481/pos/index.html');
  await kasse.waitForTimeout(2000);
  // Artikel mit Happy-Hour-Preis versehen, so wie der Manager sie schickt
  await kasse.evaluate(() => {
    const artikel = JSON.parse(localStorage.getItem('kc_products_v050') || '[]');
    const liste = artikel.length ? artikel : PRODUCTS;
    // Der Happy-Hour-Preis wird AUS dem Normalpreis abgeleitet, nicht fest eingetippt.
    // GRUND (03.09.2026): Hier stand fest 5,00 - guenstig, solange der Gluehwein 5,50 kostete.
    // Nach der Preiskorrektur auf 3,50 war die "Ermaessigung" teurer als der Normalpreis, die
    // Kasse hat sie zu Recht abgelehnt, und der Test meldete einen Fehler, den es nicht gab.
    liste.forEach((a) => { if (a.id === 'grot') { a.hhAktiv = true; a.hhPreis = Math.round((a.price - 0.5) * 100) / 100; } });
    localStorage.setItem('kc_products_v050', JSON.stringify(liste));
    window.__hhNormal = (liste.find((a) => a.id === 'grot') || {}).price;
  });
  const normalPreis = await kasse.evaluate(() => window.__hhNormal);
  const alsText = (n) => n.toFixed(2).replace('.', ',');
  const HH = alsText(Math.round((normalPreis - 0.5) * 100) / 100);
  const NORMAL = alsText(normalPreis);
  await kasse.reload();
  await kasse.waitForTimeout(2200);
  await kasse.evaluate(() => { const k = [...document.querySelectorAll('button')].find((x) => /KASSE STARTEN/i.test(x.textContent)); if (k) k.click(); });
  await kasse.waitForTimeout(900);
  await kasse.evaluate(() => document.body.classList.remove('kc-layout-neu'));

  const uebernahme = await kasse.evaluate(() => window.KCHappyHourKasse ? window.KCHappyHourKasse.uebernehmen('Test') : {kein: true});
  pruefe('Die Kasse hat den Zeitplan in Angebote übersetzt',
    uebernahme && (uebernahme.gesetzt > 0 || uebernahme.unveraendert), JSON.stringify(uebernahme));
  const laufend = await kasse.evaluate(() => activeOffers().map((o) => ({name: o.name, preis: o.priceValue, ausPlan: o.ausZeitplan === true})));
  pruefe('Die Happy Hour läuft jetzt', laufend.length > 0 && laufend.every((o) => o.ausPlan), JSON.stringify(laufend.slice(0, 2)));

  // Preis auf der Kachel
  const kachel = await kasse.evaluate(() => {
    const t = document.querySelector('.product-tile[data-id="grot"]');
    return t ? t.innerText.replace(/\s+/g, ' ') : 'keine Kachel';
  });
  pruefe(`Die Kachel zeigt den Happy-Hour-Preis (${HH} €)`, kachel.includes(HH), kachel.slice(0, 60));

  // ================= Teil 3: der Preis im Bon bleibt eingefroren =================
  console.log('\n--- Ist die Zeit abgelaufen, gilt wieder der alte Preis ---');
  await kasse.evaluate(() => document.querySelector('.product-tile[data-id="grot"]').click());
  await kasse.waitForTimeout(500);
  const imBon = await kasse.evaluate(() => ({
    zeile: document.querySelector('#cartList .cart-row').innerText.replace(/\s+/g, ' '),
    gesamt: document.getElementById('grandTotal').innerText,
  }));
  pruefe('Während der Happy Hour wandert der ermäßigte Preis in den Bon',
    new RegExp(HH.replace(',', '[.,]') + '\\s*€\\s*/\\s*Stk').test(imBon.zeile), imBon.zeile.slice(0, 70));

  // Jetzt die Happy Hour beenden - so, wie es um Punkt 18 Uhr von selbst passiert.
  await kasse.evaluate(() => {
    const master = JSON.parse(localStorage.getItem('kc_master_v040') || '{}');
    const jetzt = new Date();
    const hh = (d) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    master.happyHour.standard = [{von: hh(new Date(jetzt.getTime() - 120 * 60000)), bis: hh(new Date(jetzt.getTime() - 60 * 60000))}];
    localStorage.setItem('kc_master_v040', JSON.stringify(master));
    window.KCHappyHourKasse.uebernehmen('Zeit abgelaufen');
  });
  await kasse.waitForTimeout(900);
  const nachher = await kasse.evaluate(() => ({
    zeile: document.querySelector('#cartList .cart-row').innerText.replace(/\s+/g, ' '),
    gesamt: document.getElementById('grandTotal').innerText,
    kachel: document.querySelector('.product-tile[data-id="grot"]').innerText.replace(/\s+/g, ' '),
    laufend: activeOffers().length,
  }));
  pruefe('Die Happy Hour ist beendet', nachher.laufend === 0, `${nachher.laufend} laufende Angebote`);
  pruefe('DER ARTIKEL IM BON BEHÄLT SEINEN HAPPY-HOUR-PREIS',
    new RegExp(HH.replace(',', '[.,]') + '\\s*€\\s*/\\s*Stk').test(nachher.zeile), nachher.zeile.slice(0, 70));
  pruefe('Die Bonsumme ändert sich dadurch nicht', nachher.gesamt === imBon.gesamt, `vorher ${imBon.gesamt}, nachher ${nachher.gesamt}`);
  pruefe('Ein NEU angetippter Artikel bekommt wieder den alten Preis', nachher.kachel.includes(NORMAL), nachher.kachel.slice(0, 60));

  await kasse.evaluate(() => document.querySelector('.product-tile[data-id="grot"]').click());
  await kasse.waitForTimeout(500);
  const gemischt = await kasse.evaluate(() => [...document.querySelectorAll('#cartList .cart-row')].map((z) => z.innerText.replace(/\s+/g, ' ')));
  pruefe('Beide Preise stehen sauber nebeneinander im selben Bon',
    gemischt.length === 2 && gemischt.some((z) => z.includes(HH)) && gemischt.some((z) => z.includes(NORMAL)),
    gemischt.map((z) => z.slice(0, 40)).join(' || '));

  pruefe('Keine JavaScript-Fehler an der Kasse', seitenfehler.length === 0, seitenfehler.slice(0, 2).join(' | '));
  await kasse.close();

  // ================= Teil 4: Bedienung im PC-Manager =================
  console.log('\n--- Die Bedienung im PC-Manager ---');
  const mgr = await browser.newPage({viewport: {width: 1600, height: 1000}});
  const mgrFehler = [];
  mgr.on('pageerror', (e) => mgrFehler.push(e.message));
  // WICHTIG: der PC-Manager ersetzt window.alert durch eine eigene Meldung im Fenster
  // (manager-message-integration-v010.js, Balken .kc-manager-message). Ein Test, der auf
  // Browserdialoge lauscht, sieht davon NICHTS - deshalb wird hier der echte Weg abgehört.
  const meldungen = [];
  mgr.on('dialog', (d) => { meldungen.push(d.message()); d.accept().catch(() => {}); });
  await mgr.exposeFunction('kcTestMeldung', (t) => { meldungen.push(t); });
  await mgr.addInitScript(() => {
    const einhaengen = () => {
      const alt = window.alert;
      window.alert = function (text) { try { window.kcTestMeldung(String(text)); } catch (e) {} return alt.apply(this, arguments); };
    };
    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => setTimeout(einhaengen, 1200));
    else setTimeout(einhaengen, 1200);
  });
  await mgr.goto('http://127.0.0.1:8481/pc-manager/index.html');
  await mgr.waitForTimeout(2200);
  await mgr.evaluate(() => { managerUnlocked = true; document.body.classList.remove('manager-locked'); document.querySelectorAll('dialog[open]').forEach((d) => { try { d.close(); } catch (e) { d.remove(); } }); });

  const menue = await mgr.evaluate(() => !!document.querySelector('[data-view="happyhour"]'));
  pruefe('Der PC-Manager hat einen Menüpunkt "Happy Hour"', menue);
  await mgr.evaluate(() => document.querySelector('[data-view="happyhour"]').click());
  await mgr.waitForTimeout(900);
  const ansicht = await mgr.evaluate(() => {
    const p = document.querySelector('[data-view-panel="happyhour"]');
    return {sichtbar: !!p && !p.hidden, text: (p ? p.innerText : '').replace(/\s+/g, ' ').slice(0, 200),
      zeitfelder: document.querySelectorAll('[data-hh="standard"]').length,
      schalter: !!document.getElementById('hhAktiv'),
      speichern: !!document.getElementById('hhSpeichern')};
  });
  pruefe('Die Ansicht baut sich auf', ansicht.sichtbar && ansicht.schalter && ansicht.speichern, ansicht.text.slice(0, 90));
  pruefe('Es gibt drei Zeitbereiche zum Ausfüllen (je von und bis)', ansicht.zeitfelder === 6, `${ansicht.zeitfelder} Felder`);

  // Zeitplan im Manager eintragen und speichern
  const gespeichert = await mgr.evaluate(() => {
    document.getElementById('hhAktiv').checked = true;
    document.getElementById('hhVon').value = '2026-11-27';
    document.getElementById('hhBis').value = '2026-12-23';
    const setz = (nr, von, bis) => {
      document.querySelector(`[data-hh="standard"][data-nr="${nr}"][data-teil="von"]`).value = von;
      document.querySelector(`[data-hh="standard"][data-nr="${nr}"][data-teil="bis"]`).value = bis;
    };
    setz(0, '11:00', '12:00'); setz(1, '17:00', '18:00'); setz(2, '20:00', '21:00');
    document.getElementById('hhSpeichern').click();
    return window.KCHappyHourManager.planLesen();
  });
  pruefe('Der Zeitplan wird gespeichert', gespeichert.aktiv === true && gespeichert.standard.length === 3,
    JSON.stringify(gespeichert.standard));
  pruefe('Er liegt in den Einstellungen und fährt damit beim Abgleich mit',
    await mgr.evaluate(() => !!(settings && settings.happyHour && settings.happyHour.standard.length === 3)));

  // Ein Häkchen ohne Preis darf NICHT gespeichert werden
  console.log('\n--- Häkchen ohne Preis wird abgelehnt ---');
  await mgr.evaluate(() => document.querySelector('[data-view="articles"]').click());
  await mgr.waitForTimeout(700);
  const vorherAnzahl = await mgr.evaluate(() => articles.length);
  meldungen.length = 0;
  const abgelehnt = await mgr.evaluate(() => {
    loadArticle(0);
    document.getElementById('aHappyHour').checked = true;
    document.getElementById('aHappyHourPrice').value = '';
    document.querySelector('#articleToolbar [data-cmd="save"]').click();
    return {hhAktiv: articles[0].hhAktiv === true, hhPreis: articles[0].hhPreis};
  });
  await mgr.waitForTimeout(400);
  pruefe('Ohne Preis wird der Artikel NICHT mit Häkchen gespeichert', !abgelehnt.hhAktiv, JSON.stringify(abgelehnt));
  pruefe('Und der Grund wird im Klartext genannt',
    meldungen.some((m) => /keinen Happy-Hour-Preis/i.test(m)), (meldungen[0] || '(keine Meldung)').slice(0, 80));

  // Ein zu hoher Preis wird ebenfalls abgelehnt
  meldungen.length = 0;
  await mgr.evaluate(() => {
    document.getElementById('aHappyHour').checked = true;
    document.getElementById('aHappyHourPrice').value = String(Number(document.getElementById('aPrice').value) + 1);
    document.querySelector('#articleToolbar [data-cmd="save"]').click();
  });
  await mgr.waitForTimeout(400);
  pruefe('Ein Happy-Hour-Preis über dem Normalpreis wird abgelehnt',
    meldungen.some((m) => /nicht günstiger/i.test(m)), (meldungen[0] || '(keine Meldung)').slice(0, 80));

  // Mit gültigem Preis geht es durch
  meldungen.length = 0;
  const angenommen = await mgr.evaluate(() => {
    const normal = Number(document.getElementById('aPrice').value);
    document.getElementById('aHappyHour').checked = true;
    document.getElementById('aHappyHourPrice').value = String(Math.max(0.5, Math.round((normal - 0.5) * 100) / 100));
    document.querySelector('#articleToolbar [data-cmd="save"]').click();
    return {hhAktiv: articles[0].hhAktiv, hhPreis: articles[0].hhPreis, normal};
  });
  await mgr.waitForTimeout(500);
  pruefe('Mit gültigem Preis wird gespeichert',
    angenommen.hhAktiv === true && angenommen.hhPreis > 0 && angenommen.hhPreis < angenommen.normal, JSON.stringify(angenommen));
  pruefe('Es sind keine Artikel verloren gegangen',
    (await mgr.evaluate(() => articles.length)) === vorherAnzahl, `${vorherAnzahl}`);
  const spalte = await mgr.evaluate(() => {
    const kopf = [...document.querySelectorAll('.article-table th')].map((t) => t.textContent.trim());
    const zeile = document.querySelector('#articleBody tr');
    return {kopf, zellen: zeile ? [...zeile.children].map((z) => z.textContent.trim()) : []};
  });
  pruefe('Die Artikelliste hat eine Spalte HH', spalte.kopf.some((t) => t.startsWith('HH')), spalte.kopf.join(' | '));
  pruefe('Und die Spalte trägt den Happy-Hour-Preis',
    spalte.zellen.length === spalte.kopf.length && /\d/.test(spalte.zellen[spalte.zellen.length - 2] || ''),
    spalte.zellen.join(' | '));
  pruefe('Keine JavaScript-Fehler im Manager', mgrFehler.length === 0, mgrFehler.slice(0, 2).join(' | '));
  await mgr.close();

  // ================= Teil 5: die Beispielaktion läuft nicht mehr von selbst =================
  console.log('\n--- Die alte Beispielaktion ---');
  const frisch = await browser.newPage({viewport: {width: 1400, height: 900}});
  await frisch.goto('http://127.0.0.1:8481/pos/index.html');
  await frisch.waitForTimeout(1800);
  const beispiel = await frisch.evaluate(() => {
    const o = OFFERS.find((x) => x.id === 'OFFER-HH-GLUEHWEIN');
    return {da: !!o, aktiv: o ? o.active !== false : null, laufend: activeOffers().length};
  });
  pruefe('Die Beispielaktion ist noch als Vorlage vorhanden', beispiel.da);
  pruefe('Sie läuft aber nicht mehr von selbst', beispiel.aktiv === false && beispiel.laufend === 0,
    JSON.stringify(beispiel));
  await frisch.close();

  await browser.close();
  server.close();
  console.log(fehler ? `\n${fehler} FEHLER` : '\nAlles grün.');
  process.exit(fehler ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
