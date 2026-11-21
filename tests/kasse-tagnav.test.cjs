/* Kasse: Programm und Dienstplan mit gleicher Tagesleiste (⏮ ‹ Datum/Heute › ⏭), nur EIN Schließen-Knopf (Betreiber 21.11.2026). */
const pw = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
const OHNE_ECHTSERVER = ['--no-proxy-server', '--host-resolver-rules=MAP *.supabase.co 0.0.0.0, MAP *.supabase.com 0.0.0.0, MAP *.workers.dev 0.0.0.0, MAP speed.cloudflare.com 0.0.0.0, MAP api.github.com 0.0.0.0'];
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const s = http.createServer((q, r) => { const p = path.join(W, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
let f = 0; const pr = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) f++; };

(async () => {
  const PORT = Number(process.env.P || 8991); await new Promise((r) => s.listen(PORT, r));
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
  for (const seite of ['pos', 'schulung/pos']) {
    const { c, p, js } = await oeffnen(seite, '2026-12-09T17:10:00+01:00');
    await p.evaluate(() => window.KCPOSEventProgram.show(false)); await p.clock.runFor(500);
    const kreuze = await p.$$eval('#kcProgramDialog .kc-dialog-x, #kcProgramDialog .icon-close, #kcProgramDialog [data-close]', (l) => [...new Set(l)].length);
    pr(`${seite} Programm: genau EIN Schließen-Knopf (kein doppeltes Kreuz)`, kreuze === 1, String(kreuze));
    const leiste = () => p.evaluate(() => ({ text: document.getElementById('kcProgramTagText').textContent, aus: [...document.querySelectorAll('#kcProgramDialog [data-tag]')].filter((b) => b.disabled).map((b) => b.dataset.tag) }));
    let l = await leiste(); pr(`${seite} Programm: Tagesleiste zeigt heute`, /Heute · Mittwoch, 9\. Dezember/.test(l.text), l.text);
    await p.click('#kcProgramDialog [data-tag="nach"]'); l = await leiste();
    pr(`${seite} Programm: › nächster Programmtag`, /Donnerstag, 10\. Dezember/.test(l.text) && /Uhr|:/.test(await p.textContent('#kcPosProgramList')), l.text);
    await p.click('#kcProgramDialog [data-tag="letzt"]'); l = await leiste();
    pr(`${seite} Programm: ⏭ letzter Tag, dann › und ⏭ ausgegraut`, l.aus.includes('nach') && l.aus.includes('letzt'), l.text + ' ' + l.aus);
    await p.click('#kcProgramDialog [data-tag="erst"]'); l = await leiste();
    pr(`${seite} Programm: ⏮ erster Tag (4. Dezember), dann ‹ und ⏮ ausgegraut`, /4\. Dezember/.test(l.text) && l.aus.includes('vor') && l.aus.includes('erst'), l.text + ' ' + l.aus);
    await p.click('#kcProgramDialog [data-tag="heute"]'); l = await leiste();
    pr(`${seite} Programm: „Heute“ springt zurück`, /Heute · /.test(l.text), l.text);
    if (seite === 'pos') await p.screenshot({ path: process.env.KC_SHOT || '/tmp/kc-programm.png' });
    await p.evaluate(() => document.getElementById('kcProgramDialog').close());
    // Dienstplan: gleiche Leiste (in der Schulungskasse mit Beispielplan)
    const hatDp = await p.$('#dienstplanErsterBtn') && await p.$('#dienstplanLetzterBtn');
    pr(`${seite} Dienstplan: ⏮ und ⏭ vorhanden`, !!hatDp);
    if (seite === 'schulung/pos') {
      await p.evaluate(() => window.KCDienstplanKasse.oeffnen()); await p.clock.runFor(800);
      const t0 = await p.textContent('#dienstplanDatumText');
      await p.click('#dienstplanLetzterBtn'); const t1 = await p.textContent('#dienstplanDatumText');
      const aus = await p.$eval('#dienstplanVorBtn', (b) => b.disabled);
      pr(`${seite} Dienstplan: ⏭ springt zum letzten Plantag, › dann ausgegraut`, t1 !== t0 && aus, `${t0} → ${t1}`);
    }
    pr(`${seite}: keine JS-Fehler`, js.length === 0, js.join(' | '));
    await c.close();
  }
  await b.close(); s.close();
  console.log(f ? `\n${f} FEHLER` : '\nAlles OK'); process.exit(f ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
