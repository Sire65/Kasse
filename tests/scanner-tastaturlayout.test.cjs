/* Die Kasse muss auch dann arbeiten, wenn der Scanner falsch eingestellt ist.
 *
 * BELEG VOM 01.09.2026, 22:25 UHR (Bildschirmfoto des Betreibers): "Gelesen wurde: ß??".
 * Rechts neben der Null liegt auf der amerikanischen Tastatur das Minuszeichen, auf der
 * deutschen das ß - aus "-" wird "ß", aus "_" wird "?". Der Scanner (HW0010) ist ab Werk
 * amerikanisch, das iPad ist deutsch.
 *
 * Das erklaert das "teilweise" aus der Meldung des Betreibers: Artikelnummern sind reine
 * Ziffern und liegen auf beiden Layouts gleich - die kamen an. Ausweiscodes enthalten
 * "-", "_", ":" und "|" - die kamen als Buchstabensalat an.
 *
 * ZWEITER BEFUND desselben Abends: gescannt wurde "KCOPE1::team" - mit ZWEI Doppelpunkten;
 * erlaubt war genau eines. An einem Trennzeichen mehr darf eine Anmeldung nicht scheitern.
 *
 * Gescannt wird hier wie am Stand: Zeichen fuer Zeichen mit Enter, keine Funktionsaufrufe.
 */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const WURZEL = path.resolve(__dirname, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
let ok = 0, rot = 0;
const p = (n, b, z = '') => { b ? ok++ : rot++; console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '   [' + z + ']' : ''}`); };

const frei = async (pg) => pg.evaluate(() => { ['fullscreenGate', 'kcStartupSummary', 'kcPinLockOverlay'].forEach((id) => { const e = document.getElementById(id); if (e) e.style.display = 'none'; }); document.querySelectorAll('[data-kc-sperrend]').forEach((e) => { e.style.display = 'none'; }); });
// Ein Scanner tippt wie eine Tastatur. Playwright kann ueber die Standardbelegung aber keine
// deutschen Sonderzeichen "druecken" (ß, Ö) - es schiebt sie dann als Text ein, ohne
// Tastendruck, und die Kasse sieht nichts. Deshalb hier echte keydown-Ereignisse mit genau dem
// Zeichen, das ein deutsches Geraet vom amerikanisch eingestellten Scanner bekaeme.
async function scanne(pg, code) {
  await pg.evaluate((c) => {
    if (document.activeElement) document.activeElement.blur();
    for (const zeichen of c) document.dispatchEvent(new KeyboardEvent('keydown', { key: zeichen, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }, code);
  await pg.waitForTimeout(700);
}
const lage = (pg) => pg.evaluate(() => {
  const d = document.getElementById('messageDialog');
  return {
    meldung: d && d.open ? d.innerText.replace(/\s+/g, ' ').trim() : '',
    bediener: (document.getElementById('operatorBtn') || {}).innerText || '',
    korb: [...document.querySelectorAll('#cartList .cart-row, #cartList li, #cartList > *')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()).join(' | '),
    hinweis: [...document.querySelectorAll('#notificationBar, .kc-message, .kc-message-text, [data-kc-message]')]
      .map((e) => e.innerText).join(' ') || (document.body.innerText.match(/Scanner steht auf amerikanischer[^\n]*/) || [''])[0],
  };
});
const zu = (pg) => pg.evaluate(() => { const d = document.getElementById('messageDialog'); if (d && d.open) { try { d.close(); } catch (e) {} } });

(async () => {
  const s = http.createServer((q, r) => { const f = path.join(WURZEL, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end('x'); } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
  await new Promise((r) => s.listen(8751, '127.0.0.1', r));
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1700, height: 1050 } });
  const fehler = []; pg.on('pageerror', (e) => fehler.push(e.message)); pg.on('dialog', (d) => d.accept().catch(() => {}));
  await pg.goto('http://127.0.0.1:8751/pos/index.html'); await pg.waitForTimeout(7000); await frei(pg);
  p('die Kasse startet ohne Skriptfehler', fehler.length === 0, fehler[0] || 'keine');

  // ---------------------------------------------------------------- die Tabelle selbst
  console.log('\n== Die Ruecktabelle stimmt mit dem Beleg ueberein ==');
  const t = await pg.evaluate(() => ({
    vorhanden: !!window.KCTastaturlayout,
    ausSS: window.KCTastaturlayout.uebersetze('ß??', window.KCTastaturlayout.DE_NACH_US),
    ausweis: window.KCTastaturlayout.uebersetze('KCOPE1Ökcß0003', window.KCTastaturlayout.DE_NACH_US),
    ziffern: window.KCTastaturlayout.uebersetze('01001', window.KCTastaturlayout.DE_NACH_US),
    riecht: window.KCTastaturlayout.riechtNachLayout('ß??'),
    riechtNicht: window.KCTastaturlayout.riechtNachLayout('01001'),
  }));
  p('das Modul ist geladen', t.vorhanden);
  p('"ß??" vom Bildschirmfoto wird zu "-__" zurueckgerechnet', t.ausSS === '-__', t.ausSS);
  p('ein verstuemmelter Bedienerausweis wird wieder lesbar', t.ausweis === 'KCOPE1:kc-0003', t.ausweis);
  p('reine Ziffern bleiben unangetastet - sie waren nie betroffen', t.ziffern === '01001', t.ziffern);
  p('Buchstabensalat wird als layoutverdaechtig erkannt', t.riecht === true);
  p('eine saubere Nummer NICHT - kein Fehlalarm', t.riechtNicht === false);

  // ---------------------------------------------------------------- am lebenden Objekt
  console.log('\n== Gescannt wie am Stand, mit falsch eingestelltem Scanner ==');
  await zu(pg);
  await scanne(pg, 'KCOPE1Ökcß0003');        // "KCOPE1:kc-0003", amerikanisch getippt
  let l = await lage(pg);
  p('der verstuemmelte Bedienerausweis meldet den Bediener trotzdem an',
    /Puhbär|Puhb/i.test(l.bediener) && !/nicht bekannt/i.test(l.meldung), `${l.bediener} / ${l.meldung}`);
  p('und die Kasse sagt, dass am Scanner etwas einzustellen ist',
    /amerikanisch/i.test(l.hinweis) && /Seite 12/.test(l.hinweis), l.hinweis.slice(0, 100));

  await zu(pg);
  await scanne(pg, 'KCOPE1::team');           // der zweite Befund des Abends
  l = await lage(pg);
  p('"KCOPE1::team" mit zwei Doppelpunkten meldet wieder das Team an',
    /Team/i.test(l.bediener) && !/nicht bekannt/i.test(l.meldung), `${l.bediener} / ${l.meldung}`);

  await zu(pg);
  const vorher = (await lage(pg)).korb;
  await scanne(pg, '01001');                  // Ziffern - der Weg, der immer ging
  l = await lage(pg);
  p('eine Artikelnummer legt den Artikel weiterhin sofort in den Bon',
    l.korb !== vorher && /Glühwein rot/i.test(l.korb), l.korb.slice(0, 80));

  // ---------------------------------------------------------------- kein Blindflug
  console.log('\n== Was WIRKLICH nicht existiert, bleibt unbekannt ==');
  await zu(pg);
  await scanne(pg, 'ßßß999xyz');
  l = await lage(pg);
  p('ein wirklich unbekannter Code wird NICHT stillschweigend gebucht',
    /nicht erkannt/i.test(l.meldung), l.meldung.slice(0, 90));
  p('und die Meldung nennt bei solchen Zeichen ausdruecklich das Tastaturlayout und Seite 12',
    /Tastaturlayout/i.test(l.meldung) && /Seite 12/.test(l.meldung), l.meldung.slice(0, 160));

  await zu(pg);
  await scanne(pg, '09999');
  l = await lage(pg);
  p('eine unbekannte, aber saubere Nummer bekommt NICHT den Layout-Satz',
    /nicht erkannt/i.test(l.meldung) && !/Seite 12/.test(l.meldung), l.meldung.slice(0, 120));

  p('keine Skriptfehler ueber den ganzen Lauf', fehler.length === 0, fehler.slice(0, 2).join(' | ') || 'keine');
  await b.close();
  try { s.closeAllConnections && s.closeAllConnections(); } catch (e) {}
  s.close();
  console.log(`\nScanner-Tastaturlayout: ${ok}/${ok + rot} bestanden`);
  process.exit(rot ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
