/* Kasse: Knopf „📅 Programm“ zeigt das Rahmenprogramm Weihnachtsmarkt 2026 (Betreiber 18.11.2026: „auf der Kasse gibt es oben
   einen Button Programm, dort müsste eigentlich das Programm abrufbar sein“). Kasse und Schulungskasse, ohne echten Server:
   - 09.12. 17:10: Knopf zeigt 16:30, Fenster „Aktuell und anschließend“ mit Simon Gerundt (markiert) und Smooth Invaders,
     „Heute geöffnet 15:00 – 21:00 Uhr“, keine „mittel“-Bewertung
   - 18.11.: „Nächster Programmtag: Freitag, 4. Dezember“ mit Eröffnung + Bläsercorps
   - „Ganzes Programm“: 10 Tage, 28 Punkte
   - alte Programmdatei (vor dem Rahmenprogramm) wird nicht genommen, eine neuere hat Vorrang */
const pw = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
const OHNE_ECHTSERVER = ['--no-proxy-server', '--host-resolver-rules=MAP *.supabase.co 0.0.0.0, MAP *.supabase.com 0.0.0.0, MAP *.workers.dev 0.0.0.0, MAP speed.cloudflare.com 0.0.0.0, MAP api.github.com 0.0.0.0'];
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const s = http.createServer((q, r) => { const p = path.join(W, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
let f = 0; const pr = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) f++; };

(async () => {
  const PORT = Number(process.env.P || 8988); await new Promise((r) => s.listen(PORT, r));
  const b = await pw.chromium.launch({ args: OHNE_ECHTSERVER });
  const oeffnen = async (seite, zeit, paket) => {
    const c = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
    await c.route('**/*', (r) => (r.request().url().startsWith(`http://127.0.0.1:${PORT}/`) ? r.continue() : r.abort()));
    await c.routeWebSocket(/.*/, (ws) => ws.close());
    const p = await c.newPage(); const js = []; p.on('pageerror', (e) => js.push(e.message));
    await p.clock.install({ time: new Date(zeit) }); await p.clock.pauseAt(new Date(new Date(zeit).getTime() + 10));
    await p.addInitScript((paket) => { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', '1');
      localStorage.setItem('kc_master_v040', JSON.stringify({ registerId: 'KASSE-01', pinLockEnabled: false }));
      if (paket) localStorage.setItem('kc_event_program_package_v1', paket); }, paket || null);
    await p.goto(`http://127.0.0.1:${PORT}/${seite}/index.html`); await p.clock.runFor(3000);
    return { c, p, js };
  };
  const lesen = (p, modus) => p.evaluate((modus) => { window.KCPOSEventProgram.show(modus); const d = document.getElementById('kcProgramDialog');
    return { titel: document.getElementById('kcProgramDialogTitle').textContent, text: document.getElementById('kcPosProgramList').innerText.replace(/\s+/g, ' '),
      aktiv: (document.querySelector('#kcPosProgramList .kc-program-row.active strong') || {}).textContent || '', zeilen: document.querySelectorAll('#kcPosProgramList .kc-program-row').length,
      tage: document.querySelectorAll('#kcPosProgramList .kc-program-day').length, knopf: document.getElementById('kcProgramStatusBtn').innerText.replace(/\s+/g, ' '), offen: d.open,
      quelle: document.getElementById('kcProgramSource').textContent }; }, modus);
  try {
    for (const seite of ['pos', 'schulung/pos']) {
      let { c, p, js } = await oeffnen(seite, '2026-12-09T17:10:00+01:00');
      let e = await lesen(p, false);
      pr(`${seite} 09.12. 17:10: Knopf zeigt 16:30, keine Bewertung`, /16:30/.test(e.knopf) && !/mittel/.test(e.knopf), e.knopf);
      pr(`${seite} 09.12. 17:10: aktuell Simon Gerundt, danach Smooth Invaders`, e.titel === 'Aktuell und anschließend' && e.aktiv === 'Simon Gerundt' && /Smooth Invaders/.test(e.text) && e.zeilen === 2, e.text.slice(0, 140));
      pr(`${seite} 09.12.: Öffnungszeiten heute`, /Heute geöffnet 15:00 – 21:00 Uhr/.test(e.text) && /eingebaut/.test(e.quelle));
      e = await lesen(p, 'alle');
      pr(`${seite}: Ganzes Programm mit 10 Tagen und 28 Punkten, heute markiert`, e.tage === 10 && e.zeilen === 28 && /Mittwoch, 9\. Dezember · heute/.test(e.text), `${e.tage} Tage, ${e.zeilen} Punkte`);
      pr(`${seite}: keine JS-Fehler`, !js.filter((x) => !/Failed to fetch|Load failed|access control|net::ERR|kc-sync/.test(x)).length, js.join('|').slice(0, 200));
      await c.close();
      ({ c, p, js } = await oeffnen(seite, '2026-11-18T15:00:00+01:00'));
      e = await lesen(p, false);
      pr(`${seite} 18.11.: nächster Programmtag Freitag, 4. Dezember`, e.titel === 'Nächster Programmtag: Freitag, 4. Dezember' && /Eröffnung \+ Bläsercorps/.test(e.text) && /Motherfunkers/.test(e.text), e.titel);
      // alte und neue Programmdatei
      const pakete = await p.evaluate(() => { const core = window.KCEventProgramExchangeCore, mk = (createdAt, title) => { const x = core.create({ program: [{ id: 'x', date: '2026-11-18', time: '16:00', title, impact: 'high' }] }); const body = { ...x, createdAt }; delete body.checksum; return JSON.stringify({ ...body, checksum: core.checksum(body) }); };
        return { alt: mk('2026-10-01T10:00:00.000Z', 'Altes Testprogramm'), neu: mk('2026-11-20T10:00:00.000Z', 'Neue Programmdatei') }; });
      await c.close();
      ({ c, p, js } = await oeffnen(seite, '2026-11-18T15:00:00+01:00', pakete.alt));
      e = await lesen(p, 'alle');
      pr(`${seite}: alte Programmdatei wird nicht genommen (Rahmenprogramm gilt)`, e.zeilen === 28 && !/Altes Testprogramm/.test(e.text), `${e.zeilen}`);
      await c.close();
      ({ c, p, js } = await oeffnen(seite, '2026-11-18T15:00:00+01:00', pakete.neu));
      e = await lesen(p, false);
      pr(`${seite}: neuere Programmdatei hat Vorrang (mit Bewertung)`, /Neue Programmdatei/.test(e.text) && /gut/.test(e.text), e.text.slice(0, 100));
      await c.close();
    }
  } catch (e) { console.log('ABBRUCH:', e && e.stack || e); f++; }
  await b.close(); s.close(); console.log(f ? `\n${f} FEHLER` : '\nAlles OK'); process.exit(f ? 1 : 0);
})();
