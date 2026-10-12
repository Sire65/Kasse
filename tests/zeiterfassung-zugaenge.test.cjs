/* KC-ZEITERFASSUNG-ZUGAENGE (12.10.2026, Betreiber: "Richte jetzt für alle ein, dass sie sich mit ihren Ausweisen und
   Geburtstag einloggen können bei der Zeiterfassung").
   Manager:  Zugänge aus der Mitgliederverwaltung (kc_zeiterfassung_zugaenge) übernehmen -> Kassenpaket enthält
             Mitgliedsnummer + Geburtstagscode, aber nur Pseudonyme; mit dem Stammdaten-Abgleich an die Kassen.
   Kasse:    Paket aus /kc-sync-master-data -> Stechuhr eingeschaltet; Anmeldung mit Ausweis-QR (KNG|…|KC-0007|…)
             und mit Geburtstag TTMMJJ; wer schon eingestempelt ist, bleibt es; nichts davon in den Kasseneinstellungen.
   Kasse und Schulung gleich. Testdaten frei erfunden. */
const pw = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const s = http.createServer((q, r) => { const p = path.join(W, decodeURIComponent(q.url.split('?')[0]).replace(/^\/Kasse/, '')); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
let f = 0; const pr = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) f++; };
const VERWALTUNG = [
  { mitgliedsnummer: 'KC-0007', pseudonym: 'Einhorn', mitgliedsart: 'regular', geburtstagscode: '030561' },
  { mitgliedsnummer: 'KC-0010', pseudonym: 'Pumuckl', mitgliedsart: 'regular', geburtstagscode: '241248' },
  { mitgliedsnummer: 'KC-0019', pseudonym: 'Nemo2', mitgliedsart: 'guest', geburtstagscode: null },
];
(async () => {
  const PORT = Number(process.env.P || 8977); await new Promise((r) => s.listen(PORT, r)); const b = await pw.chromium.launch();
  try {
    // ---------- Manager ----------
    let paket = null;
    for (const seite of ['pc-manager', 'schulung/pc-manager']) {
      const ctx = await b.newContext({ serviceWorkers: 'block' }); const p = await ctx.newPage();
      const js = []; p.on('pageerror', (e) => js.push(e.message));
      let gesendet = null;
      // Reihenfolge wichtig: die zuletzt angemeldete Regel gewinnt
      await ctx.route(/127\.0\.0\.1:4739[12]/, (r) => r.abort());
      await ctx.route(/127\.0\.0\.1:47392\/master-data\/push/, (route) => { gesendet = JSON.parse(route.request().postData() || '{}'); route.fulfill({ status: 200, contentType: 'application/json', body: '{"received":true,"revision":7}' }); });
      await p.goto(`http://127.0.0.1:${PORT}/Kasse/${seite}/index.html`);
      await p.waitForFunction(() => !!window.KCTimeClockManager?.zugaengeEinrichten, null, { timeout: 15000 }); await p.waitForTimeout(500);
      const ohne = await p.evaluate(async () => { window.KCSupabase = { istAngemeldet: () => false }; return window.KCTimeClockManager.zugaengeEinrichten({ still: true }); });
      pr(`${seite}: ohne Supabase-Anmeldung passiert nichts`, ohne === false);
      const r = await p.evaluate(async (liste) => {
        window.KCSupabase = { istAngemeldet: () => true, rufeFunktionAuf: async (name) => (name === 'kc_zeiterfassung_zugaenge' ? liste : null) };
        localStorage.setItem('kcm_time_clock_people_v1', '[]');
        const ok = await window.KCTimeClockManager.zugaengeEinrichten();
        return { ok, paket: window.KCTimeClockManager.kassenPaket(), stand: document.getElementById('tcZugaengeStand')?.textContent || '' };
      }, VERWALTUNG);
      const leute = r.paket.people || [];
      const e7 = leute.find((x) => x.credential === 'KC-0007');
      pr(`${seite}: alle 3 übernommen, Zeiterfassung und Geburtstagscode eingeschaltet`, r.ok && leute.length === 3 && r.paket.config.enabled && r.paket.config.allowBirthCode, JSON.stringify(r.paket.config));
      pr(`${seite}: Ausweisnummer + Geburtstagscode im Paket, Gast als Aushilfe ohne Code`, e7 && e7.birthCode === '030561' && leute.find((x) => x.credential === 'KC-0019')?.type === 'helper' && !leute.find((x) => x.credential === 'KC-0019')?.birthCode);
      pr(`${seite}: an der Kasse nur Pseudonyme`, leute.every((x) => ['Einhorn', 'Pumuckl', 'Nemo2'].includes(x.displayName)), leute.map((x) => x.displayName).join(','));
      pr(`${seite}: Hinweis nennt fehlende Geburtstage`, /Geburtstag für 2/.test(r.stand) && /bei 1 /.test(r.stand), r.stand);
      if (seite === 'pc-manager') pr('Manager: Hinweis "an die Kassen gesendet"', /An die Kassen gesendet/.test(r.stand));
      if (seite === 'pc-manager') {
        pr('Manager: mit dem Stammdaten-Abgleich gesendet (Artikel dabei, Paket in settings.zeiterfassung)', !!gesendet && gesendet.articles?.length > 0 && gesendet.settings?.zeiterfassung?.people?.length === 3);
        paket = gesendet && gesendet.settings.zeiterfassung;
        // zweites Holen verdoppelt nichts
        const zweimal = await p.evaluate(async () => { await window.KCTimeClockManager.zugaengeEinrichten(); return window.KCTimeClockManager.kassenPaket().people.length; });
        pr('Manager: erneutes Holen legt niemanden doppelt an', zweimal === 3, String(zweimal));
      }
      pr(`${seite}: keine JS-Fehler`, !js.filter((x) => !/fetch|Failed|4739|supabase/i.test(x)).length, js.join(' | ').slice(0, 200));
      await ctx.close();
    }

    // ---------- Kasse ----------
    for (const seite of ['pos', 'schulung/pos']) {
      const ctx = await b.newContext({ viewport: { width: 1024, height: 768 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
      const js = []; p.on('pageerror', (e) => js.push(e.message));
      let mitPaket = false;
      await ctx.route(/\/kc-sync-master-data(\?|$)/, (route) => route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(mitPaket ? { vorhanden: true, groups: [], articles: [], packages: [], accounts: [], settings: { zeiterfassung: paket }, revision: 7 } : { vorhanden: false }) }));
      await p.addInitScript(() => { if (!localStorage.getItem('kc_master_v040')) localStorage.setItem('kc_master_v040', JSON.stringify({ registerId: 'KASSE-01', pinLockEnabled: false })); });
      await p.goto(`http://127.0.0.1:${PORT}/Kasse/${seite}/index.html`); await p.waitForTimeout(3000);
      await p.evaluate(() => { const g = document.getElementById('fullscreenGate'); if (g) g.hidden = true; document.querySelectorAll('dialog[open]').forEach((d) => d.close()); });
      // Einhorn ist schon eingestempelt (alte Standardliste, Kennung kc-0007)
      const vorher = await p.evaluate(() => { const ev = [{ id: 'TE1', personId: 'kc-0007', kind: 'in', effectiveAt: new Date().toISOString(), recordedAt: new Date().toISOString(), registerId: 'KASSE-01', source: 'qr' }];
        localStorage.setItem('kc_time_clock_events_v1', JSON.stringify(ev)); return window.KCTimeClockPOS.personen().find((x) => x.credential === 'KC-0007')?.id; });
      mitPaket = true;
      await p.reload(); await p.waitForTimeout(3500);
      await p.evaluate(() => { const g = document.getElementById('fullscreenGate'); if (g) g.hidden = true; document.querySelectorAll('dialog[open]').forEach((d) => d.close()); });
      const st = await p.evaluate(() => ({ leute: window.KCTimeClockPOS.personen(), knopf: !document.getElementById('timeClockBtn')?.hidden,
        master: JSON.parse(localStorage.getItem('kc_master_v040') || '{}') }));
      const e7 = st.leute.find((x) => x.credential === 'KC-0007');
      pr(`${seite}: Zugänge vom Manager übernommen, Uhr-Knopf sichtbar`, st.leute.length === 3 && st.knopf, st.leute.map((x) => x.credential + ':' + (x.birthCode ? 'Code' : '-')).join(' '));
      pr(`${seite}: eingestempelte Person behält ihre Kennung`, vorher === 'kc-0007' && e7?.id === 'kc-0007', `${vorher} → ${e7?.id}`);
      pr(`${seite}: Zugänge NICHT in den Kasseneinstellungen`, !('zeiterfassung' in st.master));
      // Anmelden: Geburtstag
      const anmelden = async (eingabe) => {
        await p.evaluate(() => document.getElementById('timeClockBtn').click()); await p.waitForTimeout(300);
        await p.evaluate(() => document.getElementById('tcPosZurueck')?.click()); await p.waitForTimeout(100);
        await p.fill('#tcPosCredential', eingabe); await p.click('#tcPosIdentify'); await p.waitForTimeout(300);
        const r = await p.evaluate(() => ({ name: document.getElementById('tcPosPseudonym')?.textContent || '', schritt2: !document.getElementById('tcPosSchritt2').hidden,
          richtung: document.getElementById('tcPosRichtung')?.textContent || '', meldung: document.getElementById('tcPosMessage')?.textContent || '' }));
        await p.evaluate(() => document.getElementById('timeClockDialog')?.close());
        return r;
      };
      const geb = await anmelden('241248');
      pr(`${seite}: Anmeldung mit Geburtstag (TTMMJJ) → Pumuckl`, geb.schritt2 && /Pumuckl/.test(geb.name), JSON.stringify(geb));
      const qr = await anmelden('KNG|Koecheclub Werne|KC-0007|m_kc_0007');
      pr(`${seite}: Anmeldung mit Ausweis-QR → Einhorn, wird als GEHEN erkannt (war eingestempelt)`, qr.schritt2 && /Einhorn/.test(qr.name) && /geh/i.test(qr.richtung), JSON.stringify(qr));
      const falsch = await anmelden('010101');
      pr(`${seite}: unbekannter Geburtstag wird abgewiesen`, !falsch.schritt2, falsch.meldung);
      pr(`${seite}: keine JS-Fehler`, !js.filter((x) => !/fetch|Failed|47391|47392|kc-sync/.test(x)).length, js.join(' | ').slice(0, 200));
      await ctx.close();
    }
    // Quelle: keine echten Geburtstage im Repository
    const quellen = ['pos/time-clock-pos.js', 'pc-manager/time-clock-manager.js', 'pos/kc-sync-master-data.js'].map((x) => fs.readFileSync(path.join(W, x), 'utf8')).join('\n');
    pr('keine Geburtstagscodes im Programmcode', !/birthCode\s*:\s*['"]\d{6}['"]/.test(quellen));
  } finally { await b.close(); s.close(); }
  console.log(f ? `\n${f} FEHLER` : '\nAlles OK'); process.exit(f ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
