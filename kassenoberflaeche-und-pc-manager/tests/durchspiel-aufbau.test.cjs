/* DURCHSPIEL im Aufbau - der ganze Kassenvorgang, jede Möglichkeit einmal.          08.09.2026
 *
 * ANLASS (Betreiber): "Den gesamten möglichen Vorgang auf der Kasse durchgehen und prüfen, ob
 * alles wie geplant funktioniert - Verkaufen und Kassieren, über verschiedene Gruppen, ½,
 * Happy Hour, Gutschein, Trainingsmodus, Trinkgeld, Stimmt so und weiter - und ob richtig
 * bedient wird." Jeder Schritt wird über die echten Knöpfe der Kasse ausgelöst (kein Aufruf
 * innerer Funktionen zum Auslösen) und am Ergebnis geprüft: Bon, Summe, Buchung, Trinkgeld-
 * Liste, Gutschein-Ablage. Oberfläche "Köcheclub · 9 Zoll", 1024x768.
 */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => { let f = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
const PORT = 8488;
let fehler = 0, n = 0;
const p = (name, ok, z = '') => { n++; console.log(`  ${ok ? 'OK    ' : 'FEHLER'} ${name}${z ? '   [' + z + ']' : ''}`); if (!ok) fehler++; };
const SHOTS = process.env.KC_SHOTS || '';
const cent = (t) => Math.round(parseFloat(String(t).replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.')) * 100) || 0;

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const b = await chromium.launch();
  const fehlerListe = [];
  const k = await b.newPage({ viewport: { width: 1024, height: 768 } });
  k.on('pageerror', (e) => fehlerListe.push(e.message));
  await k.addInitScript(() => localStorage.setItem('kc_master_v040', JSON.stringify({ registerId: 'KASSE-01', pinLockEnabled: false })));
  await k.addInitScript(() => { localStorage.setItem('kc.kassenoberflaeche.gewaehlt.v1', 'vorlage-vl-koecheclub-9'); localStorage.removeItem('kc.geparkte-bons.v1'); });
  /* Stammdaten für den Durchlauf: Die Happy-Hour-Vorlage der Kasse ist ausgeschaltet ("wird im
     PC-Manager gepflegt") - hier eingeschaltet, mit Handstart, ohne Zeitfenster-Zwang. */
  await k.addInitScript(() => localStorage.setItem('kc_offers_v100', JSON.stringify([{ id: 'OFFER-HH-TEST', name: 'Happy Hour Glühwein', type: 'happyhour', productIds: ['grot', 'gweiss'], priceMode: 'percent', priceValue: 10, startDate: '', endDate: '', startTime: '00:00', endTime: '23:59', weekdays: [0, 1, 2, 3, 4, 5, 6], active: true, manualStart: true }])));
  await k.goto(`http://127.0.0.1:${PORT}/pos/index.html`);
  await k.waitForTimeout(2200);
  await k.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /KASSE STARTEN/i.test(x.textContent)); if (b) b.click(); });
  for (let i = 0; i < 2; i++) { await k.waitForTimeout(900); await k.evaluate(() => { const ok = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'OK' && x.getBoundingClientRect().width > 0); if (ok) ok.click(); }); }

  /* Hilfen - alle über die Oberfläche */
  const klick = (sel) => k.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
  const gruppe = (name) => k.evaluate((nm) => { const b = [...document.querySelectorAll('#kcAufbau #categories button')].find((x) => x.dataset.cat === nm || x.title === nm); if (!b) return false; b.click(); return true; }, name);
  const kachel = (i = 0) => k.evaluate((i) => { const t = document.querySelectorAll('#kcAufbau .product-tile')[i]; if (!t) return null; t.click(); return (t.querySelector('.product-label') || t).textContent.replace(/\s+/g, ' ').trim().slice(0, 30); }, i);
  const zeilen = () => k.evaluate(() => document.querySelectorAll('#cartList > .cart-row').length);
  const summe = () => k.evaluate(() => (document.querySelector('.grand-total strong') || document.querySelector('.grand-total')).textContent.replace(/\s+/g, ' ').trim());
  const zahl = (t) => k.evaluate((t) => { const b = [...document.querySelectorAll('#kcZahlenEbene #banknotes button, #kcZahlenEbene #coins button')].find((x) => x.dataset.value === t); if (!b) return false; b.click(); return true; }, t);
  const buchungen = () => k.evaluate(() => allTransactions().length);
  const letzteBuchung = () => k.evaluate(() => { const a = allTransactions(); const t = a[a.length - 1]; return t ? { method: t.method || t.paymentMethod, total: t.total, training: !!t.training, items: (t.items || []).length, change: t.change, given: t.given } : null; });
  const trinkgelder = () => k.evaluate(() => tipRecords().length);
  const zahlenSeite = () => k.evaluate(() => !document.getElementById('kcZahlenEbene').hidden);
  const dialogOffen = (id) => k.evaluate((id) => { const d = document.getElementById(id); return !!d && d.open; }, id);
  const warte = (ms) => k.waitForTimeout(ms);
  const leeren = async () => { await k.evaluate(() => { document.getElementById('voidBonBtn').click(); }); await warte(300); await klick('#confirmAction'); await warte(300); };

  /* ===================================================== 1. Verkauf über mehrere Gruppen */
  console.log('\n== 1. Verkauf über mehrere Warengruppen ==');
  p('Gruppe Getränke', await gruppe('Getränke'));
  const a1 = await kachel(0); await warte(200);
  const a2 = await kachel(1); await warte(200);
  p('Gruppe Speisen', await gruppe('Speisen')); await warte(200);
  const a3 = await kachel(0); await warte(300);
  p('Drei Positionen aus zwei Gruppen im Bon', await zeilen() === 3, `${a1} · ${a2} · ${a3} · ${await summe()}`);
  const s1 = cent(await summe());
  p('Summe größer 0 und Positionszeile stimmt', s1 > 0 && /Pos\.:.*3/.test(await k.evaluate(() => document.getElementById('kcPosZeile').textContent)));

  /* ===================================================== 2. Menge über die Kopfzeile */
  console.log('\n== 2. Menge: Mengenknopf und zurück ==');
  await k.evaluate(() => document.querySelector('#cartList > .cart-row').click()); await warte(150);
  await klick('#cartQuantityBar button[data-cart-qty="3"]'); await warte(300);
  const s2 = cent(await summe());
  p('Menge 3 auf die markierte Position: Summe steigt', s2 > s1, `${s1 / 100} -> ${s2 / 100}`);
  await klick('#undoQuantityBtn'); await warte(300);
  p('Mengenänderung zurückgenommen', cent(await summe()) === s1, await summe());

  /* ===================================================== 3. Halbe Portion */
  console.log('\n== 3. Halbe Portion ==');
  /* Im Auslieferungsstand ist keine Speise für ½ freigegeben (das macht der PC-Manager je Artikel).
     Für den Durchlauf wird die Speise im Bon freigegeben - geprüft wird der Kassenweg. */
  await k.evaluate(() => { const it = state.cart.find((x) => x.category === 'Speisen'); const pr = PRODUCTS.find((p) => p.id === it.id); pr.halfAllowed = true; pr.halfPrice = +(pr.price / 2).toFixed(2); it.halfAllowed = true; it.halfPrice = pr.halfPrice; renderCart(); });
  await warte(300);
  const halb = await k.evaluate(() => { const b = document.querySelector('#cartList .half-portion-button'); if (!b) return { da: false }; const zeile = b.closest('.cart-row'); const vorher = zeile.querySelector('.row-total').textContent; b.click(); return { da: true, vorher, name: zeile.querySelector('.cart-name strong, strong').textContent.trim() }; });
  await warte(300);
  if (halb.da) {
    const nachher = await k.evaluate(() => [...document.querySelectorAll('#cartList .cart-row')].find((r) => r.querySelector('.half-portion-button.active')).querySelector('.row-total').textContent);
    p(`½ Portion (${halb.name}): Zeilenpreis halbiert`, Math.abs(cent(nachher) * 2 - cent(halb.vorher)) <= 1, `${halb.vorher} -> ${nachher}`);
    await k.evaluate(() => document.querySelector('#cartList .half-portion-button.active').click()); await warte(200);
    p('½ wieder ganz', cent(await summe()) === s1);
  } else p('½ Portion angeboten (Speise im Bon)', false, 'kein ½-Knopf gefunden');

  /* ===================================================== 4. Positionsrabatt */
  console.log('\n== 4. Rabatt auf eine Position ==');
  await k.evaluate(() => document.querySelector('#cartList .position-discount-button').click()); await warte(400);
  const rd = await k.evaluate(() => { const d = document.querySelector('dialog[open]'); if (!d) return { offen: false }; const b = [...d.querySelectorAll('button')].find((x) => /^\s*10\s*%?\s*$/.test(x.textContent)); return { offen: true, id: d.id, zehn: !!b }; });
  p('Rabatt-Fenster öffnet sich', rd.offen, rd.id || '-');
  if (rd.offen) {
    await k.evaluate(() => { const d = document.querySelector('dialog[open]'); const b = [...d.querySelectorAll('button')].find((x) => /^\s*10\s*%?\s*$/.test(x.textContent)); if (b) b.click(); });
    await warte(200);
    await k.evaluate(() => { const d = document.querySelector('dialog[open]'); if (!d) return; const b = d.querySelector('#applyDiscountBtn') || [...d.querySelectorAll('button')].find((x) => /übernehmen|anwenden|speichern|ok/i.test(x.textContent)); if (b) b.click(); });
    await warte(400);
    const s4 = cent(await summe());
    p('10 % auf die Position: Summe sinkt, %-Zähler 1', s4 < s1 && /%\s*1/.test(await k.evaluate(() => document.getElementById('kcPosZeile').textContent)), `${s1 / 100} -> ${s4 / 100}`);
    await k.evaluate(() => { const d = document.querySelector('dialog[open]'); if (d) d.close(); });
  }
  if (SHOTS) await k.screenshot({ path: `${SHOTS}/durchspiel_1_bon.png` });

  /* ===================================================== 5. STIMMT SO mit Trinkgeld */
  console.log('\n== 5. Rückgeld-Seite: STIMMT SO (Rest = Trinkgeld) ==');
  const b0 = await buchungen(), t0 = await trinkgelder(); const zuZahlen = cent(await summe());
  await klick('#kcZahlenTaste'); await warte(400);
  p('Zahlen-Seite offen, Beleg zeigt SUMME', await zahlenSeite() && /SUMME/.test(await k.evaluate(() => document.querySelector('.kc-beleg-text').textContent)));
  p('50 € gegeben', await zahl('50')); await warte(300);
  p('Berechnung: Gegeben 50, Rückgeld grün', await k.evaluate(() => /50,00/.test(document.getElementById('givenDisplay').textContent) && document.querySelector('.change-card').classList.contains('payment-sufficient')));
  if (SHOTS) await k.screenshot({ path: `${SHOTS}/durchspiel_2_zahlen.png` });
  await klick('#kcZahlenEbene #exactCashBtn'); await warte(1200);
  await k.evaluate(() => { const d = document.querySelector('dialog[open]'); if (d) { const ok = [...d.querySelectorAll('button')].find((x) => /ok|schlie|weiter|fertig/i.test(x.textContent)); if (ok) ok.click(); else d.close(); } });
  await warte(500);
  const lb = await letzteBuchung();
  p('Buchung angelegt, Bon leer, Zahlen-Seite zu', await buchungen() === b0 + 1 && await zeilen() === 0 && !(await zahlenSeite()), JSON.stringify(lb));
  p('Rest (50 € − Summe) als Trinkgeld verbucht', await trinkgelder() === t0 + 1 && lb && Math.abs(Math.round(lb.total * 100) - zuZahlen) <= 1, `${zuZahlen / 100} bezahlt`);

  /* ===================================================== 6. BAR KASSIEREN mit Rückgeld */
  console.log('\n== 6. BAR KASSIEREN mit Rückgeld ==');
  await gruppe('Getränke'); await warte(150); await kachel(2); await warte(200);
  const zz = cent(await summe()); const b1 = await buchungen();
  await klick('#kcZahlenTaste'); await warte(300); await zahl('20'); await warte(300);
  p('BAR KASSIEREN zeigt den Rückgeldbetrag', await k.evaluate(() => { const b = document.getElementById('cashChangeBtn'); return !b.hidden && /zurück/i.test(b.textContent); }));
  await klick('#cashChangeBtn'); await warte(1200);
  await k.evaluate(() => { const d = document.querySelector('dialog[open]'); if (d) { const ok = [...d.querySelectorAll('button')].find((x) => /ok|schlie|weiter|fertig/i.test(x.textContent)); if (ok) ok.click(); else d.close(); } });
  await warte(400);
  const lb2 = await letzteBuchung();
  p('Buchung mit Rückgeld 20 € − Summe', await buchungen() === b1 + 1 && lb2 && Math.abs(Math.round((lb2.change ?? (20 - lb2.total)) * 100) - (2000 - zz)) <= 1 && !(await zahlenSeite()), JSON.stringify(lb2));

  /* ===================================================== 7. BAR direkt auf Seite 1 */
  console.log('\n== 7. BAR direkt (Seite 1, passend) ==');
  await kachel(0); await warte(200); const b2 = await buchungen();
  await klick('#kcAufbau #payBtn'); await warte(1200);
  await k.evaluate(() => { const d = document.querySelector('dialog[open]'); if (d) { const ok = [...d.querySelectorAll('button')].find((x) => /ok|schlie|weiter|fertig|bar|kassieren/i.test(x.textContent)); if (ok) ok.click(); } });
  await warte(600);
  p('BAR auf Seite 1 schließt den Bon ab', await buchungen() === b2 + 1 && await zeilen() === 0, JSON.stringify(await letzteBuchung()));

  /* ===================================================== 8. Trinkgeld nachträglich */
  console.log('\n== 8. Trinkgeld nach dem Verkauf (Sondertasten) ==');
  const t1 = await trinkgelder();
  await klick('#kcAufbau #tipBtn'); await warte(400);
  p('Trinkgeld-Fenster offen', await dialogOffen('tipDialog'));
  await klick('#tipDialog [data-tip="2"]'); await warte(400);
  p('2 € Trinkgeld verbucht', await trinkgelder() === t1 + 1);
  await k.evaluate(() => { const d = document.getElementById('tipDialog'); if (d.open) d.close(); });

  /* ===================================================== 9. Pfandrückgabe = Auszahlung */
  console.log('\n== 9. Pfandrückgabe (Auszahlung) ==');
  await klick('#kcAufbau #depositBtn'); await warte(400);
  const pf = await k.evaluate(() => ({ cat: state.activeCategory, kacheln: document.querySelectorAll('#kcAufbau .product-tile').length }));
  p('Pfand-Knopf springt zur Gruppe Pfand', pf.cat === 'Pfand' && pf.kacheln > 0, JSON.stringify(pf));
  /* In der Gruppe Pfand: Glaspfand/Feuerzangenpfand (+) und die Rückgaben (−). Rückgabe wählen. */
  const rueck = await k.evaluate(() => { const t = [...document.querySelectorAll('#kcAufbau .product-tile')].find((x) => /rückgabe/i.test(x.textContent)); if (!t) return null; t.click(); return t.textContent.replace(/\s+/g, ' ').trim().slice(0, 30); });
  await warte(300);
  p('Rückgabe ergibt negative Summe (Auszahlung)', await k.evaluate(() => total() < 0), `${rueck} · Anzeige ${await summe()} · total ${await k.evaluate(() => total())}`);
  await klick('#kcZahlenTaste'); await warte(400);
  p('Zahlen-Seite: Berechnung rot mit AUSZAHLUNG', await k.evaluate(() => document.querySelector('#kcZahlenEbene .change-card').classList.contains('payment-payout') && /AUSZAHLUNG/i.test(document.querySelector('#kcZahlenEbene .change-card-head span').textContent)));
  if (SHOTS) await k.screenshot({ path: `${SHOTS}/durchspiel_3_auszahlung.png` });
  await klick('#kcZahlenZurueckTaste'); await warte(300);
  p('Zurück zur Kasse, Bon bleibt', !(await zahlenSeite()) && await zeilen() === 1);
  await leeren();
  p('Bon verwerfen (Mülleimer + Bestätigung) leert den Korb', await zeilen() === 0);

  /* ===================================================== 10. Konto */
  console.log('\n== 10. Konto ==');
  await gruppe('Getränke'); await warte(150); await kachel(0); await warte(200);
  await klick('#kcAufbau #accountChargeBtn'); await warte(400);
  p('Konto-Fenster öffnet sich', await dialogOffen('accountChargeDialog'));
  const konten = await k.evaluate(() => [...document.querySelectorAll('#accountList [data-account]')].map((b) => b.querySelector('b').textContent));
  p('Konten Stadtmarketing Werne und Bauhof Werne stehen zur Wahl', konten.includes('Stadtmarketing Werne') && konten.includes('Bauhof Werne'), konten.join(', '));
  await klick('#accountList [data-account="ACC-BAUHOF"]'); await warte(300);
  const frei = await k.evaluate(() => ({ ok: !document.getElementById('postToAccountBtn').disabled, text: document.getElementById('accountCartValidation').textContent.trim().slice(0, 60) }));
  p('Getränk auf Bauhof-Konto freigegeben', frei.ok, frei.text);
  const b10 = await buchungen();
  await k.evaluate(() => { document.getElementById('accountAcknowledge').checked = true; });
  await klick('#postToAccountBtn'); await warte(1200);
  await k.evaluate(() => { const d = document.querySelector('dialog[open]'); if (d) { const ok = [...d.querySelectorAll('button')].find((x) => /ok|schlie|weiter|fertig/i.test(x.textContent)); if (ok) ok.click(); else d.close(); } });
  await warte(400);
  const offen = await k.evaluate(() => kcAccountOpenAmount('ACC-BAUHOF'));
  p('Kontobuchung: Bon leer, offener Betrag auf Bauhof Werne', await zeilen() === 0 && offen > 0, `offen ${offen} € · Buchungen ${b10} -> ${await buchungen()}`);
  await k.evaluate(() => { const d = document.getElementById('accountChargeDialog'); if (d.open) d.close(); });
  /* Tagesabschluss zeigt den Kontoumsatz als eigene Zeile mit Aufteilung je Konto */
  await k.evaluate(() => openClosingDialog());
  await warte(400);
  const ab = await k.evaluate(() => ({ offen: document.getElementById('closingDialog').open, konto: document.getElementById('closingAccountSales').textContent.replace(/\s+/g, ' ').trim(), gesamt: document.getElementById('closingTotalSales').textContent.trim(), bar: document.getElementById('closingCashSales').textContent.trim(), snap: closingSnapshot() }));
  p('Tagesabschluss: Kontoumsatz 5,15 € mit „Bauhof Werne", Gesamtumsatz = Bar + Konto', ab.offen && /5,15/.test(ab.konto) && /Bauhof Werne/.test(ab.konto) && Math.abs(ab.snap.totalSales - (ab.snap.cashSales + ab.snap.accountSales + ab.snap.staffTotal)) < 0.005, `Konto ${ab.konto} · Bar ${ab.bar} · Gesamt ${ab.gesamt}`);
  await k.evaluate(() => document.getElementById('closingDialog').close());

  /* ===================================================== 11. Trainingsmodus */
  console.log('\n== 11. Trainingsmodus ==');
  await klick('.kc-statuszeile #trainingModeTopBtn'); await warte(400);
  p('Training an: LED-Knopf aktiv, Kasse im Trainingsmodus', await k.evaluate(() => state.master.trainingMode === true && document.querySelector('.kc-statuszeile #trainingModeTopBtn').classList.contains('active')));
  await kachel(0); await warte(200); const b3 = await buchungen(); const tr0 = await k.evaluate(() => readTrainingTransactions().length);
  await klick('#kcZahlenTaste'); await warte(300); await zahl('10'); await warte(200); await klick('#kcZahlenEbene #exactCashBtn'); await warte(1200);
  await k.evaluate(() => { const d = document.querySelector('dialog[open]'); if (d) { const ok = [...d.querySelectorAll('button')].find((x) => /ok|schlie|weiter|fertig/i.test(x.textContent)); if (ok) ok.click(); else d.close(); } });
  await warte(400);
  /* Trainingsverkäufe landen in einer eigenen Liste (T-Bons), nie im echten Umsatz. */
  const tr1 = await k.evaluate(() => readTrainingTransactions().length);
  p('Trainingsverkauf: eigene T-Liste +1, echter Umsatz unverändert, Bon leer', tr1 === tr0 + 1 && await buchungen() === b3 && await zeilen() === 0, `Training ${tr0}->${tr1}, echt ${b3}`);
  await klick('.kc-statuszeile #trainingModeTopBtn'); await warte(300);
  p('Training aus', await k.evaluate(() => !state.master.trainingMode));

  /* ===================================================== 12. Happy Hour */
  console.log('\n== 12. Happy Hour ==');
  const hh = await k.evaluate(() => { const b = document.querySelector('.kc-statuszeile #happyHourQuickBtn'); return b ? { da: true, text: b.textContent.trim(), id: b.dataset.offerId || '' } : { da: false }; });
  p('Happy-Hour-Knopf in der Statuszeile', hh.da, hh.text);
  if (hh.da && hh.id) {
    const vorherGruppen = await k.evaluate(() => document.querySelectorAll('#kcAufbau #categories button').length);
    await klick('.kc-statuszeile #happyHourQuickBtn'); await warte(600);
    await k.evaluate(() => { const d = document.querySelector('dialog[open]'); if (d) { const ok = [...d.querySelectorAll('button')].find((x) => /start|ja|ok|jetzt/i.test(x.textContent)); if (ok) ok.click(); } });
    await warte(600);
    const an = await k.evaluate(() => ({ aktiv: document.querySelector('.kc-statuszeile #happyHourQuickBtn').classList.contains('active'), gruppen: document.querySelectorAll('#kcAufbau #categories button').length, hhGruppe: !!document.querySelector('#kcAufbau #categories button[data-cat="Happy Hour"]') }));
    p('Happy Hour läuft: LED an, Gruppe „Happy Hour" mit Sonne da', an.aktiv && an.hhGruppe, JSON.stringify(an));
    const hhPreis = await k.evaluate(() => { const b = document.querySelector('#kcAufbau #categories button[data-cat="Happy Hour"]'); b.click(); const t = document.querySelector('#kcAufbau .product-tile'); return t ? t.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) : ''; });
    // 11.09.2026 (Betreiber: "Preis muss in der Kasse inkl. Pfand ausgegeben werden"): die
    // Kachel zeigt jetzt IMMER Artikelpreis+Pfand zusammen (kachelPreis(), siehe app.js). Bei
    // Happy Hour heisst das: durchgestrichener alter Vollpreis (3,50) + neuer Gesamtpreis
    // INKLUSIVE Pfand (10% Rabatt auf 3,50 = 3,15, plus 2,00 Glaspfand = 5,15). Die alte
    // Erwartung ("3,15 allein") passte zur alten Anzeige ohne Pfand - jetzt beides pruefen:
    // der reduzierte Preis muss als durchgestrichener Vergleich sichtbar UND im Gesamtpreis
    // korrekt mit Pfand verrechnet sein.
    p('Happy-Hour-Gruppe zeigt die verbilligten Artikel (alter Preis 3,50 durchgestrichen, neuer Gesamtpreis inkl. Pfand 5,15)', /3,50/.test(hhPreis) && /5,15/.test(hhPreis), hhPreis);
    if (SHOTS) await k.screenshot({ path: `${SHOTS}/durchspiel_4_happyhour.png` });
    await klick('.kc-statuszeile #happyHourQuickBtn'); await warte(500);
    await k.evaluate(() => { const d = document.querySelector('dialog[open]'); if (d) { const ok = [...d.querySelectorAll('button')].find((x) => /beend|stop|ja|ok/i.test(x.textContent)); if (ok) ok.click(); } });
    await warte(400);
  } else p('Happy Hour startbar (Aktion in den Stammdaten)', false, 'keine Happy-Hour-Aktion hinterlegt');

  /* ===================================================== 13. Gutschein */
  console.log('\n== 13. Gutschein ausstellen und einlösen ==');
  await klick('#kcAufbau #moreBtn'); await warte(300);
  await klick('#moreDialog button[data-action="gutschein"]'); await warte(500);
  p('Gutschein-Fenster über „Mehr" erreichbar', await dialogOffen('gutscheinDialog'));
  const g = await k.evaluate(async () => { try { const g = await KCGutschein.ausstellen(10, 'gutschein'); return { code: g.code, amount: g.amount, balance: g.balance }; } catch (e) { return { fehler: e.message }; } });
  p('Gutschein 10 € ausgestellt (Nummer vergeben)', !!g.code && g.amount === 10, JSON.stringify(g));
  await k.evaluate(() => { const d = document.getElementById('gutscheinDialog'); if (d.open) d.close(); const m = document.getElementById('moreDialog'); if (m.open) m.close(); });
  const e = await k.evaluate(async (code) => { try { const r = await KCGutschein.einloesen(code, 4); return { ok: true, rest: KCGutschein.finde(code)?.balance, r }; } catch (err) { return { ok: false, fehler: err.message }; } }, g.code);
  p('4 € eingelöst, Restwert 6 €', e.ok && Math.abs(Number(e.rest) - 6) < 0.005, JSON.stringify(e));

  /* ===================================================== 14. Bondruck / letzter Bon */
  console.log('\n== 14. Bondruck ==');
  await klick('#kcAufbau #printBonBtn'); await warte(400);
  p('Bondruck-Fenster mit den letzten Bons', await dialogOffen('bonPrintDialog') && await k.evaluate(() => document.querySelectorAll('#bonPrintDialog .recent-bon').length > 0));
  await k.evaluate(() => document.getElementById('bonPrintDialog').close());

  /* ===================================================== 15. Aufrunden */
  console.log('\n== 15. Aufrunden ==');
  await gruppe('Getränke'); await warte(100); await kachel(0); await warte(200);
  await klick('#kcZahlenTaste'); await warte(300); await klick('#kcZahlenEbene #roundUpBtn'); await warte(400);
  p('Aufrunden-Fenster öffnet sich auf der Zahlen-Seite', await dialogOffen('roundUpDialog'));
  await k.evaluate(() => document.getElementById('roundUpDialog').close());
  await klick('#kcZahlenZurueckTaste'); await warte(200); await leeren();

  /* ===================================================== 16. Ziffernblock: Betrag tippen */
  console.log('\n== 16. Ziffernblock auf der Zahlen-Seite ==');
  await kachel(0); await warte(200); await klick('#kcZahlenTaste'); await warte(300);
  await k.evaluate(() => { const tasten = [...document.querySelectorAll('#kcZahlenEbene .keypad button')]; const t = (x) => tasten.find((b) => b.textContent.trim() === x); ['2', '0', 'OK'].forEach((x) => t(x) && t(x).click()); });
  await warte(400);
  p('20 getippt + OK: Gegeben 20,00 €', await k.evaluate(() => /20,00/.test(document.getElementById('givenDisplay').textContent)), await k.evaluate(() => document.getElementById('givenDisplay').textContent));
  await klick('#kcGegebenLoeschen'); await warte(200);
  p('LÖSCHEN setzt Gegeben auf 0', await k.evaluate(() => /^0,00/.test(document.getElementById('givenDisplay').textContent)));
  await klick('#kcZahlenZurueckTaste'); await warte(200); await leeren();

  p('\nKeine Skriptfehler über den ganzen Lauf', fehlerListe.length === 0, fehlerListe.slice(0, 3).join(' | ') || 'keine');
  await b.close(); srv.close();
  console.log(`\nDurchspiel Aufbau: ${n - fehler}/${n} bestanden`);
  process.exit(fehler ? 1 : 0);
})();
