/* Die Supabase-Uebersicht darf keine Datenbanksprache auf den Bildschirm schreiben.
 *
 * BEFUND 02.09.2026 (Betreiber): "Konnte nicht geladen werden: permission denied for schema
 * kc_private". Das ist die woertliche Antwort von Postgres - und beschreibt die Technik, nicht
 * die Lage. Die Lage war schlicht: niemand ist bei Supabase angemeldet.
 *
 * URSACHE: der Abschnitt "Takte der Hintergrundauftraege" fragte - anders als das Dashboard
 * darueber - nicht nach, ob jemand angemeldet ist. Ohne Anmeldung fragt der Browser als "anon"
 * an; die Datenbank laesst die Funktion zwar aufrufen, verweigert aber den internen Bereich
 * dahinter (in der Datenbank nachgemessen: als "anon" genau dieser Satz, als angemeldeter
 * Benutzer klaglos).
 *
 * Geprueft wird hier der Zustand, in dem der Betreiber war: Manager offen, NICHT angemeldet.
 */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const WURZEL = path.resolve(__dirname, '..');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };
let ok = 0, rot = 0;
const p = (n, b, z = '') => { b ? ok++ : rot++; console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '   [' + z + ']' : ''}`); };

(async () => {
  const web = http.createServer((q, r) => {
    const f = path.join(WURZEL, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end('x'); } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
  });
  await new Promise((r) => web.listen(8752, '127.0.0.1', r));

  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1400, height: 950 } });
  const fehler = []; pg.on('pageerror', (e) => fehler.push(e.message));
  await pg.goto('http://127.0.0.1:8752/pc-manager/index.html');
  await pg.waitForTimeout(9000);
  await pg.evaluate(() => { document.body.classList.remove('manager-locked'); document.querySelectorAll('dialog[open]').forEach((d) => { try { d.close(); } catch (e) {} }); });

  const s = await pg.evaluate(async () => {
    [...document.querySelectorAll('.nav')].find((x) => /Supabase-/.test(x.textContent))?.click();
    await new Promise((r) => setTimeout(r, 2500));
    return {
      angemeldet: !!window.KCSupabase?.istAngemeldet?.(),
      dashboard: (document.getElementById('kcSupabaseDashboardBody') || {}).innerText || '',
      takte: (document.getElementById('kcTakteBody') || {}).innerText || '',
    };
  });

  p('der Test laeuft im richtigen Zustand: nicht angemeldet', s.angemeldet === false);
  p('das Dashboard sagt, was zu tun ist', /anmelden/i.test(s.dashboard), s.dashboard);
  p('der Abschnitt "Takte" sagt dasselbe - das war die Stelle, die es nicht tat',
    /anmelden/i.test(s.takte), s.takte);

  const beide = `${s.dashboard} ${s.takte}`;
  p('NIRGENDS steht Datenbanksprache auf dem Bildschirm',
    !/permission denied|kc_private|schema|insufficient_privilege|PGRST/i.test(beide), beide);

  // Das Sicherheitsnetz: auch eine Absage aus einem anderen Grund (angemeldet, aber ohne
  // Adminrecht) darf nicht woertlich durchschlagen.
  const uebersetzt = await pg.evaluate(() => {
    // Dieselbe Uebersetzung, die die Seite benutzt - ueber eine echte Absage der Datenbank.
    const el = document.getElementById('kcTakteBody');
    const vorher = window.KCSupabase?.istAngemeldet;
    window.KCSupabase = window.KCSupabase || {};
    window.KCSupabase.istAngemeldet = () => true;
    window.KCSupabase.rufeFunktionAuf = async () => { throw new Error('permission denied for schema kc_private'); };
    return new Promise((fertig) => {
      document.getElementById('kcSupabaseDashRefresh').click();
      setTimeout(() => { const t = el.innerText; if (vorher) window.KCSupabase.istAngemeldet = vorher; fertig(t); }, 1500);
    });
  });
  p('eine Absage der Datenbank wird uebersetzt, nicht abgeschrieben',
    !/permission denied|kc_private/i.test(uebersetzt) && /verweigert|anmelden/i.test(uebersetzt), uebersetzt);
  p('und sie sagt dazu, dass Kassieren davon nicht betroffen ist',
    /Kassieren/i.test(uebersetzt), uebersetzt.slice(-90));

  p('keine Skriptfehler ueber den ganzen Lauf', fehler.length === 0, fehler.slice(0, 2).join(' | ') || 'keine');

  await b.close();
  try { web.closeAllConnections && web.closeAllConnections(); } catch (e) {}
  web.close();
  console.log(`\nSupabase-Uebersicht, Meldungen: ${ok}/${ok + rot} bestanden`);
  process.exit(rot ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
