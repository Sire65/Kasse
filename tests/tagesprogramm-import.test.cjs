/* KS-06 – Bühnenprogramm als PDF einlesen (Prospektimport im PC-Manager) und Menü „📅 Programm“.
 *
 * Aus dem echten Programm 2025 (pc-manager/daten/werne-programm-2025.json) werden drei typische
 * Prospekt-PDFs erzeugt (Tagesüberschriften + Zeilen, Tabelle, zweispaltig) und über den PC-Manager
 * eingelesen - echte PDFs, gelesen mit pdf.js. Geprüft: Erkennungsquote, Prüftabelle, Übernehmen ins
 * Tagesprogramm (keine Doppelten, anderes Jahr bleibt beim Ersetzen), Übergabe an den TV-Designer,
 * verständliche Meldung bei eingescanntem PDF, Menü „Programm“ führt wieder zu den Karten.
 */
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const WURZEL = path.join(__dirname, '..');
const T = require(path.join(WURZEL, 'pc-manager', 'kc-tagesprogramm.js'));
let ok = 0, rot = 0;
const p = (n, b, z = '') => { b ? ok++ : rot++; console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z !== '' ? '   [' + String(z).slice(0, 200) + ']' : ''}`); };
const ORIGINAL = JSON.parse(fs.readFileSync(path.join(WURZEL, 'pc-manager', 'daten', 'werne-programm-2025.json'), 'utf8')).programm;
const schluessel = (x) => `${x.date}|${x.time}|${x.endTime}|${String(x.title).trim().toLowerCase()}`;
const quote = (liste) => { const soll = new Set(ORIGINAL.map(schluessel)); return liste.filter((x) => soll.has(schluessel(x))).length / ORIGINAL.length; };

// ---------- Bausteine ----------
console.log('-- Bausteine --');
const fall = (zeilen) => T.erkenne(zeilen, { jahr: 2026 }).programm;
p('Datum „Freitag, 5. Dezember 2025“', T.findeDatum('Freitag, 5. Dezember 2025', 2026).datum === '2025-12-05');
p('Datum „Sa., 06.12.“ mit Jahr aus dem Dokument', T.findeDatum('Sa., 06.12.', 2026).datum === '2026-12-06');
p('Datum „13.12.25“', T.findeDatum('13.12.25', 2026).datum === '2025-12-13');
p('Zeit „15:15 – 17:15 Uhr“', JSON.stringify(T.findeZeit('15:15 - 17:15 Uhr x')) .includes('"von":"15:15","bis":"17:15"'));
p('Zeit „15.15 Uhr“ und „19 Uhr“ und „ab 19 Uhr“', T.findeZeit('15.15 Uhr x').von === '15:15' && T.findeZeit('19 Uhr Band').von === '19:00' && T.findeZeit('ab 19 Uhr Party').von === '19:00');
p('keine Zeit in „Preis 5.50 €“ oder Datum „05.12.“', !T.findeZeit('Preis 5.50 €') && !T.findeZeit('05.12.'));
const f1 = fall(['Freitag, 05.12.2026', '18:00 - 18:15 Uhr Theater für Alle - Frau Holle (Lichterwald)']);
p('Titel / Beschreibung / Ort aus „… - … (Lichterwald)“', f1[0] && f1[0].title === 'Theater für Alle' && f1[0].description === 'Frau Holle' && f1[0].place === 'Lichterwald', JSON.stringify(f1[0]));
const f2 = fall(['06.12.2026', '12:30 Uhr Trompetenkinder', 'Leitung Matthias Beckmann']);
p('umbrochene Zeile wird zur Beschreibung', f2[0] && f2[0].description === 'Leitung Matthias Beckmann');
const f3 = fall(['19:00 Uhr Band ohne Datum']);
p('fehlendes Datum wird zum Prüfen markiert', f3[0] && f3[0].hinweis === 'Datum fehlt');

// ---------- echte PDFs über den PC-Manager ----------
(async () => {
  let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('  (PDF-Teil übersprungen: Playwright fehlt)'); }
  if (chromium) {
    const typ = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mjs': 'text/javascript' };
    const server = http.createServer((q, r) => { if (q.url.startsWith('/__pdf/') && global.__pdfs) { r.writeHead(200, { 'Content-Type': 'application/pdf' }); return r.end(fs.readFileSync(global.__pdfs[q.url.slice(7)])); } const f = path.join(WURZEL, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
    await new Promise((r) => server.listen(8979, '127.0.0.1', r));
    const browser = await chromium.launch();
    const ARBEIT = fs.mkdtempSync(path.join(os.tmpdir(), 'kc-programm-'));
    try {
      // drei Prospekt-Aufmachungen als echtes PDF erzeugen
      const tage = [...new Set(ORIGINAL.map((x) => x.date))];
      const wt = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const esc = (t) => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const kopf = '<meta charset="utf-8"><style>body{font:11pt Arial;margin:0}h1{font-size:20pt}h2{font-size:13pt;margin:14px 0 4px}p{margin:2px 0}td{padding:3px 6px;vertical-align:top}</style>';
      const layoutA = `${kopf}<h1>Weihnachtsmarkt Werne 2025 – Bühnenprogramm</h1>` + tage.map((d) => `<h2>${wt(d)}</h2>` + ORIGINAL.filter((x) => x.date === d).map((x) => `<p>${x.time.replace(':', '.')}${x.endTime ? ` – ${x.endTime.replace(':', '.')}` : ''} Uhr&nbsp;&nbsp;<b>${esc(x.title)}</b>${x.description ? ` – ${esc(x.description)}` : ''} (${esc(x.place)})</p>`).join('')).join('') + '<p>Änderungen vorbehalten</p>';
      const layoutB = `${kopf}<h1>Programm 2025</h1><table style="width:100%;table-layout:fixed;border-collapse:collapse"><colgroup><col style="width:14%"><col style="width:22%"><col style="width:44%"><col style="width:20%"></colgroup>`
        + '<tr><th>Datum</th><th>Uhrzeit</th><th>Programm</th><th>Ort</th></tr>'
        + ORIGINAL.map((x) => `<tr><td>${x.date.slice(8)}.${x.date.slice(5, 7)}.2025</td><td style="white-space:nowrap">${x.time}${x.endTime ? ` - ${x.endTime}` : ''} Uhr</td><td><b>${esc(x.title)}</b>${x.description ? `<br>${esc(x.description)}` : ''}</td><td>${esc(x.place)}</td></tr>`).join('') + '</table>';
      const halb = Math.ceil(tage.length / 2);
      const spalte = (ds) => ds.map((d) => `<h2>${wt(d)}</h2>` + ORIGINAL.filter((x) => x.date === d).map((x) => `<p>${x.time}${x.endTime ? ` - ${x.endTime}` : ''} Uhr <b>${esc(x.title)}</b></p>${x.description ? `<p>${esc(x.description)}</p>` : ''}`).join('')).join('');
      const layoutC = `${kopf}<div style="display:flex;gap:60px;padding:20px"><div style="width:44%">${spalte(tage.slice(0, halb))}</div><div style="width:44%">${spalte(tage.slice(halb))}</div></div>`;
      const pdfs = {}; global.__pdfs = pdfs;
      const pdfSeite = await browser.newPage();
      for (const [name, html] of Object.entries({ A: layoutA, B: layoutB, C: layoutC })) {
        await pdfSeite.setContent(html); pdfs[name] = path.join(ARBEIT, `programm-${name}.pdf`);
        await pdfSeite.pdf({ path: pdfs[name], format: 'A4', printBackground: false, margin: { top: '15mm', bottom: '15mm', left: '12mm', right: '12mm' } });
      }
      // „eingescanntes“ PDF ohne Text
      await pdfSeite.setContent('<div style="width:600px;height:800px;background:repeating-linear-gradient(45deg,#ccc,#ccc 10px,#eee 10px,#eee 20px)"></div>');
      pdfs.scan = path.join(ARBEIT, 'scan.pdf'); await pdfSeite.pdf({ path: pdfs.scan, format: 'A4', printBackground: true });

      const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
      await ctx.addInitScript(() => { localStorage.setItem('kcm_settings', JSON.stringify({ eventProgram: [{ id: 'alt-2024', date: '2024-12-01', time: '10:00', title: 'Programm 2024', active: true }] })); });
      const pc = await ctx.newPage();
      const fehler = []; pc.on('pageerror', (e) => fehler.push(e.message));
      pc.on('dialog', (d) => d.accept());
      await pc.goto('http://127.0.0.1:8979/pc-manager/index.html');
      await pc.waitForFunction(() => window.KCTagesprogramm && document.getElementById('kcProgramImport') && window.pdfjsLib, null, { timeout: 30000 });
      p('Karten „Tagesprogramm“ und „Prospektimport“ sind wieder da', (await pc.locator('#kcProgramPanel').count()) === 1 && (await pc.locator('#kcProgramImport').count()) === 1);
      // wie ein Mensch: Manager offen, Menü „📅 Programm → Prospektimport“
      await pc.evaluate(() => { try { managerUnlocked = true; } catch (e) { /* */ } document.body.classList.remove('manager-locked'); document.querySelectorAll('dialog[open]').forEach((d) => { try { d.close(); } catch (e) { /* */ } }); document.querySelector('[data-program-target="import"]').click(); });
      await pc.waitForFunction(() => { const r = document.getElementById('kcProgramImport').getBoundingClientRect(); return r.height > 0; }, null, { timeout: 10000 }).catch(() => {});
      p('Menü „📅 Programm → Prospektimport“ öffnet die Karte', await pc.locator('#kcProgramImport').isVisible());

      for (const name of ['A', 'B', 'C']) {
        await pc.setInputFiles('#kcProgramDatei', pdfs[name]);
        await pc.waitForFunction(() => window.KCTagesprogramm.entwurf().length > 0 || /nicht möglich/.test(document.getElementById('kcProgramImportState').textContent), null, { timeout: 20000 });
        const e = await pc.evaluate(() => window.KCTagesprogramm.entwurf());
        if (process.env.KC_DEBUG) { const z = await pc.evaluate(async (n) => { const r = await fetch(n); window.__kcProgrammDebug = []; await window.KCTagesprogramm.pdfZeilen(new Uint8Array(await r.arrayBuffer())); return window.__kcProgrammDebug; }, `/__pdf/${name}`); console.log(`--- Zeilen ${name}:\n` + z.slice(0, 14).join('\n')); }
        const q = quote(e);
        const fehlend = ORIGINAL.filter((x) => !e.some((y) => schluessel(y) === schluessel(x))).map((x) => `${x.date} ${x.time} ${x.title}`);
        p(`PDF Aufmachung ${name} (${{ A: 'Tagesüberschriften', B: 'Tabelle', C: 'zweispaltig' }[name]}): ≥ 95 % der Termine exakt erkannt`, q >= 0.95, `${Math.round(q * 100)} % · ${e.length} erkannt / ${ORIGINAL.length} Soll${fehlend.length ? ' · abweichend: ' + fehlend.join('; ') : ''}`);
        if (name === 'A') {
          const mitOrt = e.filter((x) => x.place).length, mitBeschr = e.filter((x) => x.description).length;
          p('A: Orte und Beschreibungen werden mit erkannt', mitOrt >= ORIGINAL.length * 0.9 && mitBeschr >= ORIGINAL.filter((x) => x.description).length * 0.9, `${mitOrt} Orte, ${mitBeschr} Beschreibungen`);
          p('A: Prüftabelle mit änderbaren Feldern wird angezeigt', (await pc.locator('#kcProgramImportTabelle input[data-k="title"]').count()) === e.length);
          await pc.locator('#kcProgramImportTabelle input[data-k="title"]').first().fill('Bläsercorps Werne (korrigiert)');
          await pc.click('#kcProgramUebernehmen');
          const prog = await pc.evaluate(() => settings.eventProgram);
          p('Übernehmen: Programm steht im Tagesprogramm (2024er Eintrag bleibt)', prog.length === e.length + 1 && prog.some((x) => x.title === 'Bläsercorps Werne (korrigiert)') && prog.some((x) => x.id === 'alt-2024'), `${prog.length}`);
          p('… und ist gespeichert (übersteht Neuladen)', JSON.parse(await pc.evaluate(() => localStorage.getItem('kcm_settings'))).eventProgram.length === e.length + 1);
          p('Tagesprogramm-Liste zeigt die Tage', /Freitag, 05\.12\.2025/.test(await pc.locator('#kcProgramList').innerText()));
        }
        if (name === 'B') {
          await pc.click('#kcProgramUebernehmen');
          const st = await pc.locator('#kcProgramImportState').innerText();
          p('Gleiches Programm noch einmal: keine Doppelten („waren schon vorhanden“)', /schon vorhanden/.test(st) && (await pc.evaluate(() => settings.eventProgram.length)) <= ORIGINAL.length + 2, st);
        }
        if (name === 'C') {
          await pc.click('#kcProgramErsetzen');
          const prog = await pc.evaluate(() => settings.eventProgram);
          p('„Programm dieses Jahres ersetzen“: 2025 neu, 2024 bleibt erhalten', prog.some((x) => x.id === 'alt-2024') && prog.filter((x) => x.date.startsWith('2025')).length === e.filter((x) => x.date && x.time && x.title).length, `${prog.length}`);
        }
      }
      await pc.setInputFiles('#kcProgramDatei', pdfs.scan);
      await pc.waitForFunction(() => /nicht möglich/.test(document.getElementById('kcProgramImportState').textContent), null, { timeout: 20000 });
      p('Eingescanntes PDF ohne Text: klare Meldung mit Lösung', /kein lesbarer Text.*Lösung/.test(await pc.locator('#kcProgramImportState').innerText()));

      // Übergabe an den TV-Designer (wie „Präsentation bearbeiten“)
      // Ein Termin für morgen über „von Hand ergänzen“ - der Designer zeigt heute/morgen/später
      const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      await pc.evaluate((d) => { document.getElementById('kcProgramDate').value = d; document.getElementById('kcProgramTime').value = '17:00'; document.getElementById('kcProgramTitle').value = 'Köcheclub-Showkochen'; document.getElementById('kcProgramAdd').click(); }, morgen);
      p('Programmpunkt von Hand ergänzt', await pc.evaluate(() => settings.eventProgram.some((x) => x.title === 'Köcheclub-Showkochen')));
      const [designer] = await Promise.all([ctx.waitForEvent('page'), pc.evaluate(() => document.getElementById('tvDashEdit').click())]);
      await designer.waitForFunction(() => typeof project !== 'undefined' && project.pcManagerData && project.pcManagerData.program && /Showkochen/.test(project.pcManagerData.program.tomorrow || ''), null, { timeout: 20000 }).catch(() => {});
      const morgenText = await designer.evaluate(() => (typeof project !== 'undefined' && project.pcManagerData && project.pcManagerData.program && project.pcManagerData.program.tomorrow) || '');
      p('TV-Designer übernimmt das Programm beim Öffnen („morgen: 17:00 Köcheclub-Showkochen“)', /17:00/.test(morgenText) && /Köcheclub-Showkochen/.test(morgenText), morgenText);
      p('keine Skriptfehler im PC-Manager', !fehler.length, fehler.slice(0, 2).join(' | ') || 'keine');
    } catch (e) { rot++; console.log('FEHLER  Abbruch: ' + (e && e.stack || e)); }
    finally { await browser.close(); server.close(); fs.rmSync(ARBEIT, { recursive: true, force: true }); }
  }
  console.log(`\nProspektimport Bühnenprogramm (KS-06): ${ok}/${ok + rot} bestanden`);
  process.exit(rot ? 1 : 0);
})();
