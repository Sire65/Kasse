/* Geldübergabe (Netzweg) und Notfallzugang zur Geheimweg-PIN.                      08.09.2026
 *
 * ANLASS (Betreiber): "Prüfe die Geldübergabe, denn wir haben sie in den versteckten Bereich
 * verlegt. Und es muss einen Notfallzugang geben, wenn der vierstellige Code weg ist - über
 * den PC-Manager oder den Admin-Bereich der Kasse."
 *
 * Der Companion (device-companion, 127.0.0.1:47391) wird hier NACHGESTELLT: ein kleiner
 * Server, der genau die zwei Routen liefert, die die Kasse abfragt (/kc-sync-cash-transfer,
 * /kc-sync-pending-command) und die Bestätigung annimmt. Der Nutzinhalt der Übergabe wird mit
 * der Prüfsumme der Kasse selbst gebaut - also derselbe Weg wie vom Money Butler.
 */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => { let f = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
const PORT = 8487;
let fehler = 0, n = 0;
const p = (name, ok, z = '') => { n++; console.log(`  ${ok ? 'OK    ' : 'FEHLER'} ${name}${z ? '   [' + z + ']' : ''}`); if (!ok) fehler++; };

/* ---- nachgestellter Companion ---- */
const comp = { pending: null, acks: [], befehl: null, abgeholt: 0 };
const compSrv = http.createServer((q, r) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const u = new URL(q.url, 'http://x');
  if (q.method === 'OPTIONS') { r.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST' }); return r.end(); }
  if (u.pathname === '/kc-sync-cash-transfer') { r.writeHead(200, cors); return r.end(JSON.stringify({ ok: true, pending: comp.pending })); }
  if (u.pathname === '/kc-sync-cash-transfer-ack') { let b = ''; q.on('data', (c) => b += c); q.on('end', () => { try { comp.acks.push(JSON.parse(b).transferId); } catch (e) { /* egal */ } comp.pending = null; r.writeHead(200, cors); r.end('{"ok":true}'); }); return; }
  if (u.pathname === '/kc-sync-pending-command') { const b = comp.befehl; if (b) comp.abgeholt++; comp.befehl = null; r.writeHead(200, cors); return r.end(JSON.stringify(b ? { befehl: b } : {})); }
  if (u.pathname === '/kc-sync-master-data') { r.writeHead(200, cors); return r.end(JSON.stringify(comp.stammdaten || { vorhanden: false })); }
  if (u.pathname === '/kc-sync-status') { r.writeHead(200, cors); return r.end(JSON.stringify({ status: 'ok', online: true, queue: 0 })); }
  r.writeHead(404, cors); r.end('{}');
});

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  await new Promise((r) => compSrv.listen(47391, '127.0.0.1', r));
  const b = await chromium.launch();
  const fehlerListe = [];
  const k = await b.newPage({ viewport: { width: 1024, height: 768 } });
  k.on('pageerror', (e) => fehlerListe.push(e.message));
  await k.addInitScript(() => localStorage.setItem('kc_master_v040', JSON.stringify({ registerId: 'KASSE-01', pinLockEnabled: false })));
  await k.addInitScript(() => { localStorage.setItem('kc_offers_v100', '[]'); localStorage.setItem('kc.kassenoberflaeche.gewaehlt.v1', 'vorlage-vl-koecheclub-9'); localStorage.removeItem('kc.kassenfunktionen.pin.v1'); localStorage.removeItem('kc_cash_movements_v1'); localStorage.setItem('kc_sync_connection_v1', JSON.stringify({ host: '127.0.0.1', port: 47391 })); });
  await k.goto(`http://127.0.0.1:${PORT}/pos/index.html`);
  await k.waitForTimeout(2200);
  await k.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /KASSE STARTEN/i.test(x.textContent)); if (b) b.click(); });
  for (let i = 0; i < 2; i++) { await k.waitForTimeout(900); await k.evaluate(() => { const ok = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'OK' && x.getBoundingClientRect().width > 0); if (ok) ok.click(); }); }

  console.log('\n== Geldübergabe über das Netz (Money Butler -> Companion -> Kasse) ==');
  p('Kasse fragt den Companion unter 127.0.0.1:47391', await k.evaluate(() => window.KCSyncConnection && window.KCSyncConnection.buildUrl('/x').startsWith('http://127.0.0.1:47391/')));
  const vorher = await k.evaluate(() => closingSnapshot().cashIn);
  /* Übergabe im Format des Money Butler (Version 4), Prüfsumme mit der Kassenfunktion */
  const payload = await k.evaluate(() => {
    const p = { format: 'KC_CASH_TRANSFER', version: 4, transferId: 'test-' + Date.now(), registerId: 'KASSE-01', type: 'opening', time: new Date().toISOString(), effectiveDate: localBusinessDate(), breakdown: { 50: 1, 20: 2, 10: 3, 5: 4, 2: 5, 1: 10 }, looseBreakdown: { 50: 1, 20: 2, 10: 3, 5: 4, 2: 5, 1: 10 }, coinRolls: {}, looseTotal: 160, rollTotal: 0, total: 160, note: 'Testübergabe' };
    p.checksum = checksumObject(p); return p;
  });
  comp.pending = { transferId: payload.transferId, payload };
  await k.waitForTimeout(16500);   /* die Kasse fragt alle 15 s */
  const nachher = await k.evaluate(() => ({ cashIn: closingSnapshot().cashIn, hinweis: (document.getElementById('notificationBar') || document.querySelector('.system-hint') || {}).textContent || '' }));
  p('Übergabe kam an: Anfangsbestand 160 € im Abschluss', Math.abs(nachher.cashIn - vorher - 160) < 0.005, `cashIn ${vorher} -> ${nachher.cashIn}`);
  p('Kasse hat die Übergabe beim Companion bestätigt (kein zweites Ausliefern)', comp.acks.includes(payload.transferId), comp.acks.join(','));
  /* dieselbe Übergabe noch einmal -> Duplikat, nichts doppelt gebucht */
  comp.pending = { transferId: payload.transferId, payload };
  await k.waitForTimeout(16000);
  const dup = await k.evaluate(() => closingSnapshot().cashIn);
  p('Dieselbe Übergabe ein zweites Mal: nicht doppelt gebucht', Math.abs(dup - nachher.cashIn) < 0.005, `cashIn ${dup}`);
  p('Versteckte Kassenfunktionen spielen dabei keine Rolle (Netzweg braucht keinen Knopf)', await k.evaluate(() => !document.body.classList.contains('kc-kassenfunktionen-offen')));
  /* Manuelle Übergabe (QR/Kurzcode) bleibt hinter dem Geheimweg erreichbar */
  await k.evaluate(() => { window.KCAufbau.pinSeite(true); });
  const tippe = async (z) => { for (const c of z) { await k.evaluate((c) => document.querySelector(`#kcPinEbene button[data-pin="${c}"]`).click(), c); await k.waitForTimeout(50); } };
  await tippe('1357'); await tippe('1357'); await k.waitForTimeout(400);
  const sichtbar = await k.evaluate(() => { const e = document.getElementById('kcFunktionenEbene'); return !!e && !e.hidden && !!e.querySelector('button[data-funk="cashdeposit"]'); });
  p('Nach PIN: „Bargeldübergabe" (QR/Kurzcode) auf der Kassenfunktionen-Seite', sichtbar);
  await k.evaluate(() => window.KCAufbau.funktionenSeite(false));

  console.log('\n== Stammdaten vom Manager: ½ Portion kommt ohne Neuladen an ==');
  const artikel = await k.evaluate(() => JSON.parse(JSON.stringify(PRODUCTS)));
  const gw = artikel.find((a) => a.id === 'grot'); gw.halfAllowed = true; gw.halfPrice = 2.0;
  comp.stammdaten = { vorhanden: true, groups: [], articles: artikel, packages: [], settings: {} };
  await k.evaluate(() => window.KCMasterDataSync.jetzt());
  await k.waitForTimeout(800);
  p('Artikel live übernommen: Glühwein rot jetzt mit ½ (2,00 €)', await k.evaluate(() => { const p = PRODUCTS.find((x) => x.id === 'grot'); return !!(p && p.halfAllowed && p.halfPrice === 2); }));
  await k.evaluate(() => { document.querySelector('#kcAufbau .product-tile[data-id="grot"]').click(); });
  await k.waitForTimeout(400);
  p('Im Bon erscheint der ½-Knopf ohne Neuladen', await k.evaluate(() => !!document.querySelector('#cartList .half-portion-button')));
  await k.evaluate(() => { document.getElementById('voidBonBtn').click(); }); await k.waitForTimeout(200); await k.evaluate(() => { const c = document.getElementById('confirmAction'); if (c) c.click(); }); await k.waitForTimeout(200);

  console.log('\n== Notfallzugang: Kassen-PIN zurücksetzen ==');
  p('PIN ist gesetzt', await k.evaluate(() => !!localStorage.getItem('kc.kassenfunktionen.pin.v1')));
  /* 1. Admin-Bereich der Kasse */
  const knopf = await k.evaluate(() => { const b = document.getElementById('kcKassenPinReset'); return b ? { da: true, inAdmin: !!b.closest('#adminHomeDialog') } : { da: false }; });
  p('Knopf „Kassen-PIN zurücksetzen" im Admin-Bereich', knopf.da && knopf.inAdmin);
  await k.evaluate(() => document.getElementById('kcKassenPinReset').click());
  await k.waitForTimeout(300);
  p('Admin-Knopf löscht die PIN, versteckter Bereich wieder zu', await k.evaluate(() => !localStorage.getItem('kc.kassenfunktionen.pin.v1') && !document.body.classList.contains('kc-kassenfunktionen-offen')));
  await k.evaluate(() => window.KCAufbau.pinSeite(true));
  p('Geheimweg fragt danach wieder nach einer NEUEN PIN', await k.evaluate(() => /Neue PIN/.test(document.querySelector('#kcPinEbene .kc-pin-titel').textContent)));
  await tippe('2468'); await tippe('2468'); await k.waitForTimeout(300);
  await k.evaluate(() => window.KCAufbau.funktionenSeite(false));
  p('Neue PIN gesetzt', await k.evaluate(() => !!localStorage.getItem('kc.kassenfunktionen.pin.v1')));
  /* 2. Fernbefehl vom PC-Manager (Admin-Center -> Companion -> Kasse) */
  comp.befehl = 'kassen_pin_zuruecksetzen';
  await k.waitForTimeout(26000);   /* Befehle werden alle 15 s abgeholt - großzügig warten */
  p('Fernbefehl abgeholt', comp.abgeholt >= 1);
  p('Fernbefehl löscht die PIN', await k.evaluate(() => !localStorage.getItem('kc.kassenfunktionen.pin.v1')));
  p('Kasse läuft danach weiter (kein Neuladen nötig, Aufbau steht)', await k.evaluate(() => document.body.classList.contains('kc-aufbau') && !!window.KCAufbau));

  p('Keine Skriptfehler über den ganzen Lauf', fehlerListe.length === 0, fehlerListe.slice(0, 3).join(' | ') || 'keine');
  await b.close(); srv.close(); compSrv.close();
  console.log(`\nGeldübergabe + Notfallzugang: ${n - fehler}/${n} bestanden`);
  process.exit(fehler ? 1 : 0);
})();
