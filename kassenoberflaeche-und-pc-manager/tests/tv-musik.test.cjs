/* Läuft die Weihnachtsmusik wirklich?   03.09.2026
 *
 * Es genügt nicht, dass die Datei da ist und der Pfad stimmt - das war bei dieser Anlage
 * schon zweimal der Fall, und trotzdem kam nichts an. Diese Prüfung öffnet die
 * TV-Vorführung in einem echten Browser, bedient sie wie ein Mensch und fragt danach das
 * Tonelement: Spielst du? Wie weit bist du? Welche Datei?
 *
 * Aufruf:  node tests/tv-musik.test.cjs
 */
'use strict';
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const PORT = 8492;
let gruen = 0; const rot = [];
const p = (name, ok, zusatz) => { if (ok) { gruen++; console.log('  OK    ' + name + (zusatz ? '   [' + zusatz + ']' : '')); } else { rot.push(name); console.log('FEHLER  ' + name + (zusatz ? '   [' + zusatz + ']' : '')); } };

const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.bin': 'image/webp' };

(async () => {
  const server = http.createServer((req, res) => {
    const datei = path.join(WURZEL, decodeURIComponent(req.url.split('?')[0]));
    if (!datei.startsWith(WURZEL) || !fs.existsSync(datei) || fs.statSync(datei).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(datei).pipe(res);
  }).listen(PORT);

  const browser = await chromium.launch({ args: ['--autoplay-policy=document-user-activation-required'] });
  const seite = await browser.newPage();
  const fehler = [];
  seite.on('pageerror', (e) => fehler.push(String(e).slice(0, 120)));

  const netz = [];
  seite.on('response', (r) => { if (/\.mp3/.test(r.url())) netz.push({ url: r.url().split('/').pop(), status: r.status() }); });

  await seite.goto(`http://127.0.0.1:${PORT}/pc-manager/tv-designer/KC_TV_START.html`);
  await seite.waitForTimeout(2500);

  /* 1. Ist der Baustein überhaupt da? */
  const bausteine = await seite.evaluate(() => ({
    kern: typeof window.KCAudioPresentationCore === 'object',
    musik: typeof window.KCTVMusik === 'object',
    einstellung: window.KCTVMusik ? window.KCTVMusik.einstellung() : null,
  }));
  p('Der Audio-Baustein ist eingebunden', bausteine.kern);
  p('Der Musikstart ist eingebunden', bausteine.musik);
  p('Die Präsentation trägt eine Musikeinstellung', !!bausteine.einstellung, JSON.stringify(bausteine.einstellung));
  p('Die Musik ist eingeschaltet', !!(bausteine.einstellung && bausteine.einstellung.enabled));
  p('Sie läuft in Schleife', !!(bausteine.einstellung && bausteine.einstellung.loop !== false));

  /* 2. Ohne Bedienung darf der Browser blocken - dann MUSS der Hinweis stehen. */
  const vorher = await seite.evaluate(() => {
    const a = (window.KCTVMusik && window.KCTVMusik.spieler) || null;
    const h = document.getElementById('kcMusikHinweis');
    return { hatElement: !!a, laeuftSchon: a ? !a.paused : false, hinweisSichtbar: !!(h && !h.hidden), hinweisText: h ? h.textContent : '' };
  });
  p('Vor der Bedienung ist entweder Ton oder ein Hinweis da - nie beides still',
    vorher.laeuftSchon || vorher.hinweisSichtbar, JSON.stringify(vorher).slice(0, 130));

  /* 3. Jetzt wie ein Mensch: einmal auf den Bildschirm. */
  await seite.mouse.click(640, 360);
  await seite.waitForTimeout(1800);

  // Nachgesehen wird am Spieler selbst, NICHT im Seitenbaum: Der Audio-Baustein legt ihn mit
  // "new Audio()" an, das Element haengt nirgends in der Seite. Wer hier document.querySelector
  // benutzt, findet nichts und meldet "kein Ton", obwohl die Musik laeuft. (Genau so beim
  // ersten Lauf am 03.09.2026 passiert.)
  const nachher = await seite.evaluate(() => {
    const a = window.KCTVMusik && window.KCTVMusik.spieler;
    return a ? { da: true, laeuft: !a.paused, zeit: a.currentTime, quelle: a.currentSrc.split('/').pop(), lautstaerke: a.volume, schleife: a.loop } : { da: false };
  });
  p('Nach dem Antippen gibt es ein Tonelement', nachher.da);
  p('Die Musik LÄUFT', nachher.da && nachher.laeuft === true, JSON.stringify(nachher));
  p('Und sie ist wirklich vorangekommen (nicht nur "nicht pausiert")', nachher.da && nachher.zeit > 0.2, 'gespielt: ' + (nachher.zeit || 0).toFixed(2) + ' s');
  p('Es ist die hinterlegte Datei', nachher.quelle === 'weihnachten-nastelbom.mp3', nachher.quelle);
  p('Die Lautstärke ist gedämpft (Ansprache muss darüber hörbar bleiben)', nachher.lautstaerke > 0 && nachher.lautstaerke <= 0.5, String(nachher.lautstaerke));
  p('Der Hinweis ist wieder verschwunden', await seite.evaluate(() => { const h = document.getElementById('kcMusikHinweis'); return !h || h.hidden; }));

  /* 4. Der Server hat die Datei wirklich ausgeliefert - nicht nur der Browser sie angefragt. */
  p('Die MP3 wurde vom Server geliefert (HTTP 200)', netz.some((n) => n.status === 200), JSON.stringify(netz.slice(0, 2)));

  p('Keine Skriptfehler auf der Vorführung', fehler.length === 0, fehler.slice(0, 2).join(' | '));

  /* 5. Gegenprobe: Musik abschalten - dann darf nichts spielen. */
  await seite.evaluate(() => { window.KCAudioPresentationCore.stop(); });
  await seite.waitForTimeout(400);
  const gestoppt = await seite.evaluate(() => { const a = window.KCTVMusik && window.KCTVMusik.spieler; return !a || a.paused || !a.src; });
  p('GEGENPROBE: nach dem Stoppen läuft nichts mehr', gestoppt);

  await browser.close();
  server.close();

  console.log('\nTV-Musik: ' + gruen + ' bestanden, ' + rot.length + ' Beanstandungen');
  if (rot.length) { rot.forEach((r) => console.log('   ✗ ' + r)); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
