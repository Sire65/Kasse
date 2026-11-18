/* Rahmenprogramm Weihnachtsmarkt 2026 (Betreiber 18.11.2026: Rohprogramm – Bühnenauftritte und Öffnungszeiten in TV, PC-Manager, DP2).
   Eine Quelle: shared/kc-wm2026-programm.js. Geprüft (ohne echten Server, Netzsperre):
   - Daten: 28 Programmpunkte 04.–13.12., keine „Musik vom Band“, Öffnungszeiten Mo–Do 15–21, Fr 15–22:30, Sa 12–22:30, So 12–20
   - PC-Manager + Schulung: Programm einmalig in settings.eventProgram, alte Punkte im Zeitraum nur ausgeschaltet, zweiter Start ändert nichts,
     DP2-Übergabe (KCDP2ProgramPublication.normalize) nimmt alle 28 an
   - TV: Folien Öffnungszeiten / Auf der Bühne (heute, morgen) / Bühnenprogramm 1+2 mit den echten Daten; am 09.12. 17:10 ist
     „Simon Gerundt“ als JETZT markiert; im Video (?aufnahme=1) entfallen heute/morgen; keine Beispieldaten mehr („Kleine Löwen“) */
const pw = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..');
const OHNE_ECHTSERVER = ['--no-proxy-server', '--host-resolver-rules=MAP *.supabase.co 0.0.0.0, MAP *.supabase.com 0.0.0.0, MAP *.workers.dev 0.0.0.0, MAP speed.cloudflare.com 0.0.0.0, MAP api.github.com 0.0.0.0, MAP api.open-meteo.com 0.0.0.0'];
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const s = http.createServer((q, r) => { const p = path.join(W, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
let f = 0; const pr = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) f++; };

const D = require(path.join(W, 'shared', 'kc-wm2026-programm.js'));
pr('Daten: 28 Programmpunkte 04.–13.12., ohne „Musik vom Band“', D.PROGRAMM.length === 28 && D.PROGRAMM.every((p) => p.datum >= '2026-12-04' && p.datum <= '2026-12-13') && !D.PROGRAMM.some((p) => /band\b/i.test(p.titel) && /musik/i.test(p.titel)));
pr('Daten: Öffnungszeiten laut Rohprogramm', JSON.stringify(D.OEFFNUNG.map((o) => [o.kurz, o.von, o.bis])) === JSON.stringify([['Mo.–Do.', '15:00', '21:00'], ['Fr.', '15:00', '22:30'], ['Sa.', '12:00', '22:30'], ['So.', '12:00', '20:00']]));
pr('Daten: Schulungskopie gleich', fs.readFileSync(path.join(W, 'shared', 'kc-wm2026-programm.js'), 'utf8') === fs.readFileSync(path.join(W, 'schulung', 'shared', 'kc-wm2026-programm.js'), 'utf8'));
pr('Daten: Ende nach Beginn, keine Überschneidung je Tag', D.PROGRAMM.every((p) => p.bis > p.von) && D.PROGRAMM.every((p) => !D.PROGRAMM.some((q) => q !== p && q.datum === p.datum && q.von < p.bis && p.von < q.bis)));

(async () => {
  const PORT = Number(process.env.P || 8989); await new Promise((r) => s.listen(PORT, r));
  const b = await pw.chromium.launch({ args: OHNE_ECHTSERVER });
  const seite = async (url, init, zeit) => {
    const c = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
    await c.route('**/*', (r) => (r.request().url().startsWith(`http://127.0.0.1:${PORT}/`) ? r.continue() : r.abort()));
    await c.routeWebSocket(/.*/, (ws) => ws.close());
    const p = await c.newPage(); const js = []; p.on('pageerror', (e) => js.push(e.message));
    if (zeit) { await p.clock.install({ time: new Date(zeit) }); await p.clock.pauseAt(new Date(new Date(zeit).getTime() + 10)); }
    if (init) await p.addInitScript(init);
    await p.goto(url); if (zeit) await p.clock.runFor(800); else await p.waitForTimeout(2500);
    return { c, p, js };
  };
  try {
    for (const pfad of ['pc-manager', 'schulung/pc-manager']) for (const alt of [false, true]) {
      const { c, p, js } = await seite(`http://127.0.0.1:${PORT}/${pfad}/index.html`, alt ? () => { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x', '1');
        localStorage.setItem('kcm_settings', JSON.stringify({ clubName: 'Köcheclub Werne', eventProgram: [{ id: 'alt-1', date: '2026-12-05', time: '15:00', title: 'Kindergarten „Kleine Löwen“', active: true }, { id: 'alt-2', date: '2025-12-05', time: '15:00', title: 'Archiv 2025', active: true }] })); } : null);
      const n = `${pfad} ${alt ? 'alter Stand' : 'frisch'}`;
      // DP2-Übergabe wird als letztes Skript geladen – darauf warten statt feste Zeit
      await p.waitForFunction(() => !!window.KCDP2ProgramPublication, null, { timeout: 15000 }).catch(() => {});
      const e = await p.evaluate(() => { const l = (settings.eventProgram || []); return { aktiv: l.filter((x) => x.active !== false && x.date >= '2026-12-04' && x.date <= '2026-12-13').length,
        alt1: (l.find((x) => x.id === 'alt-1') || {}).active, alt2: (l.find((x) => x.id === 'alt-2') || {}).active, oe: settings.marketOpeningHours,
        dp2: window.KCDP2ProgramPublication ? window.KCDP2ProgramPublication.normalize(l).length : -1 }; });
      pr(`${n}: 28 Programmpunkte im Tagesprogramm, Öffnungszeiten hinterlegt`, e.aktiv === 28 && e.oe && e.oe.hours.length === 4, `${e.aktiv}`);
      pr(`${n}: DP2-Übergabe nimmt alle 28 Punkte an`, e.dp2 === 28, String(e.dp2));
      if (alt) pr(`${n}: alter Punkt im Zeitraum ausgeschaltet (nicht gelöscht), Archiv 2025 unberührt`, e.alt1 === false && e.alt2 === true);
      await p.reload(); await p.waitForTimeout(1500);
      const zweimal = await p.evaluate(() => (settings.eventProgram || []).filter((x) => x.date >= '2026-12-04' && x.date <= '2026-12-13').length);
      pr(`${n}: zweiter Start legt nichts doppelt an`, zweimal === (alt ? 29 : 28), String(zweimal));
      pr(`${n}: keine JS-Fehler`, !js.filter((x) => !/Failed to fetch|Load failed|access control|net::ERR|4739/.test(x)).length, js.join('|').slice(0, 200));
      await c.close();
    }
    // TV
    const tv = `http://127.0.0.1:${PORT}/tv-player/weihnachtsmarkt-2026-version-a.html?fernseher=1`;
    const html = fs.readFileSync(path.join(W, 'tv-player', 'weihnachtsmarkt-2026-version-a.html'), 'utf8');
    pr('TV: keine Beispieldaten mehr', !/Kleine Löwen|Kindervorstellung/.test(html));
    for (const [zeit, video] of [['2026-12-09T17:10:00+01:00', false], ['2026-11-18T12:00:00+01:00', true]]) {
      const { c, p, js } = await seite(tv + (video ? '&aufnahme=1' : ''), null, zeit);
      const tafeln = {};
      for (let n = 0; n < 50; n++) {
        const e = await p.evaluate(() => { const k = document.querySelector('#tvStage [data-kc-p]'); return { k: k && k.getAttribute('data-kc-p'), t: k && k.innerText.replace(/\s+/g, ' '), z: document.getElementById('tvCounter').textContent }; });
        if (/Durchlauf 2/.test(e.z)) break; if (e.k) tafeln[e.k] = e.t;
        await p.evaluate(() => document.getElementById('tvNext').click()); await p.clock.runFor(100);
      }
      const n = video ? 'TV-Video' : 'TV 09.12. 17:10';
      if (!video) {
        pr(`${n}: alle fünf Tafeln`, ['oeffnung', 'heute', 'morgen', 'gesamt:1', 'gesamt:2'].every((k) => tafeln[k]), Object.keys(tafeln).join(','));
        pr(`${n}: heute = Mittwoch, Simon Gerundt läuft (JETZT), danach Smooth Invaders`, /Heute · Mittwoch, 9\. Dezember/.test(tafeln.heute) && /Simon Gerundt jetzt/i.test(tafeln.heute) && /Smooth Invaders/.test(tafeln.heute), (tafeln.heute || '').slice(0, 120));
        pr(`${n}: morgen = Donnerstag mit Shanty Chor und Fragile Matt`, /Morgen · Donnerstag, 10\. Dezember/.test(tafeln.morgen) && /Shanty Chor/.test(tafeln.morgen) && /Fragile Matt/.test(tafeln.morgen));
        pr(`${n}: Öffnungszeiten, heute Mo–Do markiert`, /Montag – Donnerstag 15:00 – 21:00 Uhr heute/i.test(tafeln.oeffnung) && /Sonntag 12:00 – 20:00 Uhr/.test(tafeln.oeffnung), (tafeln.oeffnung || '').slice(0, 140));
        const alle = (tafeln['gesamt:1'] || '') + ' ' + (tafeln['gesamt:2'] || '');
        pr(`${n}: Bühnenprogramm 1+2 enthält alle 28 Punkte chronologisch`, D.PROGRAMM.every((x) => alle.includes(x.von + ' ' + x.titel)) && alle.indexOf('Motherfunkers') < alle.indexOf('Weihnachtsquiz'));
        pr(`${n}: Laufschrift kündigt das heutige Programm an`, await p.evaluate(() => /Heute auf der Bühne: 16:30 Simon Gerundt · 19:00 Smooth Invaders/.test(window.KC_PROGRAMM_LAUFSCHRIFT())));
      } else {
        pr(`${n}: heute/morgen entfallen, Öffnungszeiten und Bühnenprogramm bleiben`, !tafeln.heute && !tafeln.morgen && tafeln.oeffnung && tafeln['gesamt:1'] && tafeln['gesamt:2'], Object.keys(tafeln).join(','));
        pr(`${n}: keine „heute“-Markierung`, !/heute/i.test(tafeln.oeffnung || ''));
      }
      pr(`${n}: keine JS-Fehler`, !js.filter((x) => !/Failed to fetch|Load failed|access control|net::ERR/.test(x)).length, js.join('|').slice(0, 200));
      await c.close();
    }
  } catch (e) { console.log('ABBRUCH:', e && e.stack || e); f++; }
  await b.close(); s.close(); console.log(f ? `\n${f} FEHLER` : '\nAlles OK'); process.exit(f ? 1 : 0);
})();
