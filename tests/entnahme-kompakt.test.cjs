/* ENTNAHME KOMPAKT (24.09.2026)
   Betreiber: "Entnahme zu unuebersichtlich - Tasten enger, bei freiem Betrag fest ein
   Ziffernfenster, muss aufs Tablet passen, nicht so ueberladen. 0,50 EUR fuer WC-Geld dazu."
   Geprueft in Live-Kasse UND Schulung, Standard- und kompakter Ansicht, auf 1024x600 und
   1280x800: kein eingebauter Ziffernblock mehr, 0,50 EUR als Schnellbetrag, "Freier Betrag"
   oeffnet das gemeinsame Zahlenfenster, Speichertaste erst aktiv mit Grund + Betrag und nennt
   beides, Fenster passt ohne Scrollen, Buchung landet unveraendert im Entnahme-Protokoll. */
try { require.resolve('playwright'); } catch (e) { console.log('  ueberspringen: Playwright nicht installiert'); process.exit(0); }
const {chromium} = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const WURZEL = path.join(__dirname, '..');
const TYPEN = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml'};
const server = http.createServer((q, r) => {
  const p = path.join(WURZEL, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, {'Content-Type': TYPEN[path.extname(p)] || 'application/octet-stream'}); r.end(d); });
});
let fehler = 0;
const pruefe = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) fehler++; };

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? {executablePath: process.env.PW_CHROMIUM} : {});
  for (const app of ['pos', 'schulung/pos']) for (const [w, h] of [[1024, 600], [1280, 800]]) for (const neu of [false, true]) {
    const name = `${app} ${w}x${h} ${neu ? 'kompakt' : 'standard'}`;
    const seite = await browser.newPage({viewport: {width: w, height: h}});
    const fehlerSkript = []; seite.on('pageerror', (e) => fehlerSkript.push(e.message));
    await seite.goto(`http://127.0.0.1:${port}/${app}/index.html`);
    await seite.waitForTimeout(3500);
    await seite.evaluate((n) => { document.body.classList.toggle('kc-layout-neu', n); document.querySelectorAll('dialog[open]').forEach((d) => d.close()); openWithdrawal(); window.KCErfassungGetrennt?.modusSetzen('entnahme'); }, neu);
    await seite.waitForTimeout(300);
    const start = await seite.evaluate(() => ({ab: saveWithdrawal.disabled, block: !!document.getElementById('kcBetragBlock'), fuenfzig: !!document.querySelector('[data-withdraw-amount="0.5"]')}));
    pruefe(`${name}: kein eingebauter Ziffernblock im Fenster`, !start.block);
    pruefe(`${name}: Schnellbetrag 0,50 EUR vorhanden`, start.fuenfzig);
    pruefe(`${name}: Speichertaste ohne Grund/Betrag gesperrt`, start.ab);
    await seite.click('[data-withdraw-reason="WC-Geld"]');
    await seite.click('[data-withdraw-amount="0.5"]');
    pruefe(`${name}: Taste nennt 0,50 EUR und WC-Geld`, /0,50\s€ entnehmen · WC-Geld/.test(await seite.evaluate(() => saveWithdrawal.textContent)));
    await seite.click('#withdrawAmountAnders');
    pruefe(`${name}: Freier Betrag oeffnet das Zahlenfenster`, await seite.evaluate(() => zahlenfeldDialog.open));
    for (const k of ['1', '2', ',', '5']) await seite.click(`#zahlenfeldDialog [data-zf="${k}"]`);
    await seite.click('#zahlenfeldOk');
    const nach = await seite.evaluate(() => { const sc = document.querySelector('#withdrawDialog .withdraw-scroll'), a = document.querySelector('#withdrawDialog .dialog-actions').getBoundingClientRect(); return {knopf: saveWithdrawal.textContent, scrollt: sc.scrollHeight > sc.clientHeight + 1, unten: a.bottom <= innerHeight}; });
    pruefe(`${name}: freier Betrag 12,50 EUR uebernommen`, /12,50\s€ entnehmen/.test(nach.knopf), nach.knopf);
    pruefe(`${name}: Fenster passt ohne Scrollen, Knopfleiste sichtbar`, !nach.scrollt && nach.unten);
    await seite.click('#saveWithdrawal');
    await seite.waitForTimeout(300);
    const gebucht = await seite.evaluate(() => { const zeilen = Object.keys(localStorage).filter((k) => /withdraw/i.test(k)).flatMap((k) => { try { return JSON.parse(localStorage[k]); } catch (e) { return []; } }); const l = zeilen[zeilen.length - 1]; return {offen: withdrawDialog.open, betrag: l?.amount, grund: l?.reason}; });
    pruefe(`${name}: Entnahme gebucht (12,50 EUR, WC-Geld)`, !gebucht.offen && gebucht.betrag === 12.5 && gebucht.grund === 'WC-Geld', JSON.stringify(gebucht));
    pruefe(`${name}: keine Skriptfehler`, fehlerSkript.length === 0, fehlerSkript[0] || '');
    await seite.close();
  }
  await browser.close(); server.close();
  console.log(fehler ? `\n${fehler} FEHLER` : '\nAlle Pruefungen bestanden');
  process.exit(fehler ? 1 : 0);
})();
