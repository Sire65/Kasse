/* Das Scanner-Testblatt und die Kasse muessen dasselbe wissen.
 *
 * BEFUND 02.09.2026 (Betreiber): "Du hast mir ein Testblatt gegeben mit Artikel- und
 * Mitarbeitercodes, die kennt er nicht." Das Blatt trug fest eingetippte Beispielcodes aus der
 * Standardliste. Eine Kasse, die vom PC-Manager echte Bediener bekommen hat, kennt die nicht -
 * das Blatt prueft dann nicht den Scanner, sondern erzeugt Zweifel an einer heilen Kasse.
 *
 * Dieser Test nimmt JEDEN Code, der auf dem Blatt steht, und scannt ihn in die laufende Kasse -
 * Zeichen fuer Zeichen mit Enter, wie es ein Ringscanner tut. Kein Code darf "nicht erkannt"
 * ausloesen. Zusaetzlich wird der Fall geprueft, der den Fehler ueberhaupt erst moeglich machte:
 * eine Kasse mit EIGENER Bedienerliste - das Blatt muss dann deren Codes drucken, nicht meine.
 */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const WURZEL = path.resolve(__dirname, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
let ok = 0, rot = 0;
const p = (n, b, z = '') => { b ? ok++ : rot++; console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '   [' + z + ']' : ''}`); };

const frei = async (pg) => pg.evaluate(() => { ['fullscreenGate', 'kcStartupSummary', 'kcPinLockOverlay'].forEach((id) => { const e = document.getElementById(id); if (e) e.style.display = 'none'; }); document.querySelectorAll('[data-kc-sperrend]').forEach((e) => { e.style.display = 'none'; }); });
async function scanne(pg, code) {
  await pg.evaluate(() => document.activeElement && document.activeElement.blur());
  await pg.keyboard.type(code, { delay: 8 }); await pg.keyboard.press('Enter'); await pg.waitForTimeout(650);
}
// Was steht gerade als Meldung auf dem Schirm?
const meldung = (pg) => pg.evaluate(() => {
  const d = document.getElementById('messageDialog');
  return d && d.open ? d.innerText.replace(/\s+/g, ' ').trim() : '';
});
const meldungWeg = (pg) => pg.evaluate(() => { const d = document.getElementById('messageDialog'); if (d && d.open) { try { d.close(); } catch (e) {} } });

(async () => {
  const s = http.createServer((q, r) => { const f = path.join(WURZEL, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end('x'); } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
  await new Promise((r) => s.listen(8756, '127.0.0.1', r));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1700, height: 1050 } });
  const pg = await ctx.newPage();
  const fehler = []; pg.on('pageerror', (e) => fehler.push(e.message)); pg.on('dialog', (d) => d.accept().catch(() => {}));

  // Kasse einmal oeffnen - erst dadurch liegen Artikel und Bediener im Speicher.
  await pg.goto('http://127.0.0.1:8756/pos/index.html'); await pg.waitForTimeout(7000); await frei(pg);
  p('die Kasse startet ohne Skriptfehler', fehler.length === 0, fehler[0] || 'keine');

  // ---------- Das Blatt im selben Ursprung oeffnen: es sieht denselben Speicher ----------
  const blatt = await ctx.newPage();
  const blattFehler = []; blatt.on('pageerror', (e) => blattFehler.push(e.message));
  await blatt.goto('http://127.0.0.1:8756/werkzeuge/scanner-testblatt.html');
  await blatt.waitForTimeout(2500);
  const codes = await blatt.evaluate(() => window.KCTestblattCodes || []);
  const herkunft = await blatt.evaluate(() => document.getElementById('herkunft').innerText.replace(/\s+/g, ' ').trim());

  p('das Blatt erzeugt sich ohne Skriptfehler', blattFehler.length === 0, blattFehler[0] || 'keine');
  p('es stehen ueberhaupt Codes darauf', codes.length >= 5, `${codes.length}: ${codes.join('  ')}`);
  p('es sagt oben, WOHER die Codes stammen', /Woher die Codes stammen/.test(herkunft) && /Bedienerliste dieser Kasse|Artikelliste dieser Kasse/.test(herkunft), herkunft.slice(0, 120));
  p('es nennt den Zeitpunkt und die Kasse, aus der es erzeugt wurde',
    /\d{1,2}\.\d{1,2}\.\d{4}/.test(herkunft), herkunft.slice(0, 90));

  // ---------- DER KERN: jeder Code vom Blatt muss an der Kasse ankommen ----------
  console.log('\n== Jeder Code vom Blatt, gescannt wie am Stand ==');
  for (const code of codes) {
    await pg.bringToFront();
    await meldungWeg(pg);
    await scanne(pg, code);
    const m = await meldung(pg);
    const unbekannt = /nicht erkannt|nicht bekannt|Ausweis nicht/i.test(m);
    p(`Code "${code}" wird von der Kasse erkannt`, !unbekannt, unbekannt ? m.slice(0, 110) : 'ohne Beanstandung');
    await meldungWeg(pg);
  }

  // ---------- Der Fall, der den Fehler moeglich machte ----------
  // Eine Kasse mit EIGENER Bedienerliste (so, wie sie nach "An alle Kassen senden" aussieht).
  // Das Blatt muss dann DEREN Codes drucken - nicht die eingebauten Pseudonyme.
  console.log('\n== Kasse mit eigener Bedienerliste ==');
  await pg.bringToFront();
  await pg.evaluate(() => {
    const m = JSON.parse(localStorage.getItem('kc_master_v040') || '{}');
    m.operatorProfiles = [
      { id: 'team', name: 'Team', code: 'KCOPE1:team' },
      { id: 'h-schulte', name: 'H. Schulte', code: 'KCOPE1:h-schulte', memberNo: 'KC-0042' },
    ];
    m.operators = ['Team', 'H. Schulte'];
    localStorage.setItem('kc_master_v040', JSON.stringify(m));
  });
  await blatt.bringToFront();
  await blatt.reload(); await blatt.waitForTimeout(2000);
  const codes2 = await blatt.evaluate(() => window.KCTestblattCodes || []);
  const herkunft2 = await blatt.evaluate(() => document.getElementById('herkunft').innerText.replace(/\s+/g, ' ').trim());
  p('das Blatt druckt jetzt den Bediener DIESER Kasse', codes2.includes('KCOPE1:h-schulte'), codes2.join('  '));
  p('und nicht mehr die eingebauten Pseudonyme', !codes2.some((c) => /kc-000\d/.test(c)), codes2.join('  '));
  p('der Mitgliedsausweis traegt die Nummer aus derselben Liste',
    codes2.some((c) => c.includes('KC-0042')), codes2.find((c) => /^KNG/.test(c)) || 'keiner');
  p('die Herkunft nennt die gedruckten Namen', /Schulte/.test(herkunft2), herkunft2.slice(0, 140));

  // ---------- Und der ehrliche Fall: gar keine Bediener da ----------
  console.log('\n== Geraet ohne Bediener: lieber nichts drucken als Falsches ==');
  await pg.bringToFront();
  await pg.evaluate(() => {
    const m = JSON.parse(localStorage.getItem('kc_master_v040') || '{}');
    delete m.operatorProfiles; delete m.operators;
    localStorage.setItem('kc_master_v040', JSON.stringify(m));
  });
  await blatt.bringToFront();
  await blatt.reload(); await blatt.waitForTimeout(2000);
  const codes3 = await blatt.evaluate(() => window.KCTestblattCodes || []);
  const herkunft3 = await blatt.evaluate(() => document.getElementById('herkunft').innerText.replace(/\s+/g, ' ').trim());
  p('ohne Bedienerliste werden KEINE Ausweiscodes erfunden',
    !codes3.some((c) => /^KCOPE1/.test(c)), codes3.join('  ') || 'keine');
  p('stattdessen steht da, was fehlt und was zu tun ist',
    /KEINE gefunden/.test(herkunft3) && /Zu tun/.test(herkunft3), herkunft3.slice(-160));
  p('die Artikelcodes bleiben trotzdem stehen - die sind geraeteunabhaengig',
    codes3.some((c) => /^\d{5}$/.test(c)), codes3.join('  '));

  p('keine Skriptfehler ueber den ganzen Lauf', fehler.length === 0 && blattFehler.length === 0,
    [...fehler, ...blattFehler].slice(0, 2).join(' | ') || 'keine');

  await b.close();
  try { s.closeAllConnections && s.closeAllConnections(); } catch (e) {}
  s.close();
  console.log(`\nTestblatt gegen die Kasse: ${ok}/${ok + rot} bestanden`);
  process.exit(rot ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
