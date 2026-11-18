#!/usr/bin/env node
/* Weihnachtsmarkt 2026 – TV-Präsentation als MP4 (Betreiber 18.11.2026: „wenn die Präsentation endgültig fertig ist,
 * muss dazu auch eine MP4-Version gemacht werden, die immer wieder startet – falls der Rechner ausfällt, kann der TV
 * die selber abspielen“; „bei MP4 muss der Hinweis rein, dass die Wetterdaten nicht ganz aktuell sind“).
 *
 * Nimmt GENAU EINEN Durchlauf aller sichtbaren Folien auf (Wiederholen stellt man am Fernseher ein).
 * - Seite läuft mit ?fernseher=1&aufnahme=1: keine Bedienleiste; Wetterfolien und Wetter-Laufschrift nennen den
 *   Stand der Wetterdaten („im Video nicht ganz aktuell“).
 * - Gesteuerte Uhr: Zeitgeber (Folienwechsel) und CSS-Animationen (Laufband, Schnee, Feuerwerk) werden Bild für Bild
 *   weitergestellt – das Video ruckelt nicht, egal wie langsam der Rechner Bildschirmfotos macht.
 * - Abgeschirmt: der Browser erreicht nur die eigene Seite; die Wetterdaten holt das Werkzeug selbst (Open-Meteo)
 *   und reicht sie durch. Alles andere wird abgebrochen.
 *
 * - Musik: ist in der Präsentation Musik eingeschaltet, kommt sie in Dauerschleife mit ihrer Lautstärke ins Video,
 *   am Anfang ein- und am Ende ausgeblendet (sauberer Übergang, wenn der Fernseher das Video wiederholt).
 *
 * Aufruf: node tools/tv-mp4-aufnehmen.cjs [Präsentation.html] [Ziel.mp4]
 *   Standard: tv-player/weihnachtsmarkt-2026-version-a.html → weihnachtsmarkt-2026-tv.mp4
 *   Umgebung: KC_FPS (25), KC_BREITE (1920), KC_HOEHE (1080), KC_MAX_SEKUNDEN (zum Ausprobieren, z. B. 20)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');
const os = require('os');

// Ersatz-Wetterdaten: Deutscher Wetterdienst über Bright Sky (api.brightsky.dev), umgesetzt in das Open-Meteo-Format,
// das die Präsentation liest (current.temperature_2m/weather_code, daily.time/weather_code/temperature_2m_max/min/
// precipitation_probability_max). Grund: Open-Meteo sperrt Cloud-Adressen häufig mit HTTP 429.
const WMO = { 'clear-day': 0, 'clear-night': 0, 'partly-cloudy-day': 2, 'partly-cloudy-night': 2, cloudy: 3, wind: 3, fog: 45,
  rain: 63, sleet: 67, snow: 73, hail: 77, thunderstorm: 95 };
const RANG = [0, 2, 3, 45, 63, 67, 73, 77, 95]; // was am Tag „gewinnt“
function brightSkyAlsOpenMeteo(lat, lon, tage = 6, jetzt = new Date()) {
  const tag = (d) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  const bis = new Date(jetzt.getTime() + tage * 86400000);
  const url = `https://api.brightsky.dev/weather?lat=${lat}&lon=${lon}&date=${tag(jetzt)}&last_date=${tag(bis)}&tz=Europe/Berlin`;
  const daten = JSON.parse(execFileSync('curl', ['-sS', '-m', '30', '--fail', url], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  const stunden = (daten.weather || []).map((w) => ({ t: new Date(w.timestamp), tag: tag(new Date(w.timestamp)), temp: w.temperature,
    code: WMO[w.icon] ?? WMO[w.condition] ?? 3, regen: w.precipitation_probability }));
  if (!stunden.length) throw new Error('Bright Sky lieferte keine Werte');
  const naechste = stunden.reduce((a, b) => (Math.abs(b.t - jetzt) < Math.abs(a.t - jetzt) ? b : a));
  const daily = { time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [], precipitation_probability_max: [] };
  for (let n = 0; n < tage; n++) {
    const t = tag(new Date(jetzt.getTime() + n * 86400000)), h = stunden.filter((x) => x.tag === t);
    if (!h.length) break;
    const tags = h.filter((x) => { const s = Number(x.t.toLocaleString('de-DE', { hour: 'numeric', timeZone: 'Europe/Berlin' })); return s >= 8 && s <= 20; });
    const quelle = tags.length ? tags : h;
    daily.time.push(t);
    daily.weather_code.push(quelle.map((x) => x.code).reduce((a, b) => (RANG.indexOf(b) > RANG.indexOf(a) ? b : a), 0));
    daily.temperature_2m_max.push(Math.max(...h.map((x) => x.temp)));
    daily.temperature_2m_min.push(Math.min(...h.map((x) => x.temp)));
    daily.precipitation_probability_max.push(Math.max(0, ...h.map((x) => x.regen ?? 0)));
  }
  return { current: { time: naechste.t.toISOString(), temperature_2m: naechste.temp, weather_code: naechste.code }, daily };
}

// Musik der Präsentation (project.audio, als data:-Adresse in der Datei)
function musik(html) {
  const anfang = 'window.KC_DESIGNER_MARKET_PRESENTATION=';
  const a = html.indexOf(anfang); const e = html.indexOf('};', a);
  if (a < 0 || e < 0) return null;
  const projekt = JSON.parse(html.slice(a + anfang.length, e + 1).replace(/\bB\[(\d+)\]/g, '0'));
  const au = projekt.audio;
  const m = au && au.enabled && /^data:audio\/(mpeg|mp3|ogg|wav|aac|mp4);base64,/.exec(au.src || '');
  if (!m) return null;
  return { daten: Buffer.from(au.src.slice(au.src.indexOf(',') + 1), 'base64'), endung: m[1] === 'mpeg' ? 'mp3' : m[1], lautstaerke: Number(au.volume ?? 1) };
}

// Netzsperre wie bei allen Browser-Läufen: nur die eigene Seite (127.0.0.1)
const OHNE_NETZ = ['--no-proxy-server', '--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1'];

async function aufnehmen({ quelle, ziel, fps = 25, breite = 1920, hoehe = 1080, maxSekunden = 0, melden = console.log }) {
  const { chromium } = require('playwright');
  const html = fs.readFileSync(quelle);
  const ton = musik(html.toString('utf8'));
  const bildspur = ton ? path.join(os.tmpdir(), `kc-tv-bild-${process.pid}.mp4`) : ziel;
  const server = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(html); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const adresse = `http://127.0.0.1:${server.address().port}/praesentation.html?fernseher=1&aufnahme=1`;

  const browser = await chromium.launch({ args: OHNE_NETZ });
  const seite = await browser.newPage({ viewport: { width: breite, height: hoehe } });
  let wetterGeholt = 0, quelleGenutzt = '';
  // Ersatzdaten vorab holen (nicht während die Seite lädt)
  let ersatz = null;
  try { ersatz = brightSkyAlsOpenMeteo(51.6645, 7.6342); } catch (e) { melden('  Bright Sky nicht erreichbar: ' + String(e.stderr || e.message).trim().split('\n')[0]); }
  // Quelle im Hinweis der Wetterfolien: Open-Meteo, wenn es antwortet, sonst DWD
  let omOk = false;
  try { execFileSync('curl', ['-sS', '-m', '10', '--fail', '-o', '/dev/null', 'https://api.open-meteo.com/v1/forecast?latitude=51.6645&longitude=7.6342&current=weather_code'], { stdio: 'ignore' }); omOk = true; } catch (e) { /* Ersatz */ }
  await seite.addInitScript((q) => { window.KC_AUFNAHME_QUELLE = q; }, omOk || !ersatz ? 'Open-Meteo.com' : 'Deutscher Wetterdienst (Bright Sky)');
  await seite.route('**/*', async (r) => {
    const url = r.request().url();
    if (url.startsWith(adresse.split('/praesentation.html')[0] + '/')) return r.continue();
    if (url.startsWith('https://api.open-meteo.com/')) {
      try {
        const antwort = execFileSync('curl', ['-sS', '-m', '10', '--fail', url], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        wetterGeholt++; quelleGenutzt = quelleGenutzt || 'Open-Meteo.com';
        return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: antwort });
      } catch (e) {
        if (!ersatz) { melden('  Open-Meteo nicht erreichbar (' + String(e.stderr || e.message).trim().split('\n')[0] + ') – Ersatz: Deutscher Wetterdienst (Bright Sky)'); return r.abort(); }
        wetterGeholt++; quelleGenutzt = 'Deutscher Wetterdienst (Bright Sky)';
        return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(ersatz) });
      }
    }
    return r.abort();
  });
  // Seitenuhr steht ab dem Start still und läuft nur, wenn das Werkzeug sie weiterstellt
  const beginn = Date.now();
  await seite.clock.install({ time: beginn });
  await seite.clock.pauseAt(beginn + 10);
  await seite.goto(adresse);
  // auf die Wetterdaten warten (echte Zeit, die Seitenuhr steht)
  for (let n = 0; n < 120 && !(await seite.evaluate(() => window.KC_WETTER_ART !== undefined)); n++) await new Promise((r) => setTimeout(r, 250));
  const wetter = await seite.evaluate(() => ({ art: window.KC_WETTER_ART, stand: window.KC_AUFNAHME_STAND }));
  if (!wetter.art && !process.env.KC_OHNE_WETTER) throw new Error('Keine Wetterdaten – Video nicht erzeugt (mit KC_OHNE_WETTER=1 trotzdem).');
  melden(`Wetter: ${wetter.art || 'keine Daten'} · Stand ${wetter.stand} · Quelle ${quelleGenutzt || '–'} (${wetterGeholt} Abfragen)`);
  // erste Folie mit Wettereffekt neu zeigen (sie wurde vor dem Eintreffen der Wetterdaten aufgebaut)
  await seite.evaluate(() => { document.getElementById('tvNext').click(); document.getElementById('tvPrev').click(); });
  await seite.clock.runFor(50);

  const ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p', '-preset', 'slow', '-crf', '20',
    '-movflags', '+faststart', bildspur], { stdio: ['pipe', 'inherit', 'inherit'] });
  const fertig = new Promise((r, f) => ffmpeg.on('close', (c) => (c === 0 ? r() : f(new Error('ffmpeg-Fehler ' + c)))));

  const schritt = 1000 / fps;
  let zeit = 0, bilder = 0, letzteFolie = '';
  const folgen = [];
  for (;;) {
    const zaehler = await seite.evaluate(() => document.getElementById('tvCounter')?.textContent || '');
    if (/Durchlauf 2/.test(zaehler)) break; // genau ein Durchlauf
    if (maxSekunden && zeit >= maxSekunden * 1000) break;
    if (zeit > 20 * 60 * 1000) throw new Error('Durchlauf endet nicht (über 20 Minuten).');
    const folie = zaehler.replace(/ - Durchlauf.*/, '');
    if (folie !== letzteFolie) { folgen.push(folie); letzteFolie = folie; if (folgen.length % 5 === 1) melden(`  ${folie} · ${(zeit / 1000).toFixed(0)} s`); }
    // CSS-Animationen auf die Seitenzeit stellen (jede ab ihrem ersten Auftauchen)
    await seite.evaluate((t) => {
      const start = window.__kcAnimStart || (window.__kcAnimStart = new WeakMap());
      for (const a of document.getAnimations()) { if (!start.has(a)) start.set(a, t); a.pause(); a.currentTime = t - start.get(a); }
    }, zeit);
    const bild = await seite.screenshot({ type: 'jpeg', quality: 92 });
    if (!ffmpeg.stdin.write(bild)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
    bilder++;
    await seite.clock.runFor(schritt);
    zeit += schritt;
  }
  ffmpeg.stdin.end();
  await fertig;
  await browser.close(); server.close();
  if (ton) { // Musik in Dauerschleife darunterlegen, ein- und ausblenden
    const sek = bilder / fps, tondatei = path.join(os.tmpdir(), `kc-tv-ton-${process.pid}.${ton.endung}`);
    fs.writeFileSync(tondatei, ton.daten);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', bildspur, '-stream_loop', '-1', '-i', tondatei, '-map', '0:v', '-map', '1:a',
      '-c:v', 'copy', '-af', `volume=${ton.lautstaerke},afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, sek - 2.5).toFixed(2)}:d=2.5`,
      '-c:a', 'aac', '-b:a', '160k', '-t', sek.toFixed(2), '-movflags', '+faststart', ziel], { stdio: 'inherit' });
    fs.unlinkSync(tondatei); fs.unlinkSync(bildspur);
    melden(`Musik darunter (Lautstärke ${Math.round(ton.lautstaerke * 100)} %, Dauerschleife, ein-/ausgeblendet)`);
  }
  return { bilder, sekunden: zeit / 1000, folien: folgen.length, wetter, musik: !!ton };
}

if (require.main === module) {
  const wurzel = path.join(__dirname, '..');
  const quelle = process.argv[2] || path.join(wurzel, 'tv-player', 'weihnachtsmarkt-2026-version-a.html');
  const ziel = process.argv[3] || path.join(process.cwd(), 'weihnachtsmarkt-2026-tv.mp4');
  const zahl = (n, d) => Number(process.env[n] || d);
  aufnehmen({ quelle, ziel, fps: zahl('KC_FPS', 25), breite: zahl('KC_BREITE', 1920), hoehe: zahl('KC_HOEHE', 1080), maxSekunden: zahl('KC_MAX_SEKUNDEN', 0) })
    .then((e) => console.log(`MP4 geschrieben: ${ziel} · ${e.folien} Folien · ${e.sekunden.toFixed(0)} s · ${e.bilder} Bilder · ${(fs.statSync(ziel).size / 1048576).toFixed(1)} MB`))
    .catch((e) => { console.error('Abbruch:', e.message); process.exit(1); });
}

module.exports = { aufnehmen, musik, brightSkyAlsOpenMeteo, OHNE_NETZ };
