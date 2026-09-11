/* Schutz der Präsentation - die Befunde vom 31.08.2026 dürfen nicht zurückkommen.
 *
 * Geprüft wird mit echten Klicks im Browser, nicht durch Quelltextlesen:
 *  1. Ein KLICK in die Vorschau verändert die Präsentation NICHT.
 *  2. Ein echtes VERSCHIEBEN korrigiert weiterhin, aber nur sichtbare Objekte.
 *  3. Der TÜV meldet MST-001 höchstens einmal und nur ohne aktiven Master.
 *  4. Der TÜV meldet keine fehlende Zielauflösung, wenn page 1920x1080 gesetzt ist.
 *  5. Der TÜV meldet keine "Leere Folie" für Folien nach dem layout-Modell.
 *  6. Der TÜV findet die Präsentation auch, wenn nur der TV-Bereich gefüllt ist.
 */
const path = require('path');
const WURZEL = path.resolve(__dirname, '..');
let chromium; try { ({chromium} = require('playwright')); } catch { console.log('Playwright fehlt - Prüfung übersprungen.'); process.exit(0); }
const http = require('http'), fs = require('fs');
const TYPEN = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.kctv':'application/json','.txt':'text/plain'};
const PORT = 8592;

let ok = 0, rot = 0;
const pruefe = (name, bedingung, zusatz = '') => { const gut = !!bedingung; gut ? ok++ : rot++; console.log(`${gut ? '  OK  ' : 'FEHLER'}  ${name}${zusatz ? '  [' + zusatz + ']' : ''}`); };

(async () => {
  const server = http.createServer((q, r) => {
    const p = path.join(WURZEL, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end('x'); } r.writeHead(200, {'Content-Type': TYPEN[path.extname(p)] || 'application/octet-stream'}); r.end(d); });
  });
  await new Promise((res) => server.listen(PORT, res));
  const browser = await chromium.launch();

  // ---------- 1 + 2: der Wächter ----------
  {
    const p = await browser.newPage({viewport: {width: 1500, height: 950}});
    await p.goto(`http://127.0.0.1:${PORT}/pc-manager/index.html`);
    await p.waitForTimeout(2500);
    await p.evaluate(() => { document.body.classList.remove('manager-locked'); document.querySelectorAll('dialog[open]').forEach((d) => { try { d.close(); } catch (e) { d.remove(); } }); });

    const ergebnis = await p.evaluate(() => {
      const G = window.KCPresentationProfessional;
      if (!G) return {fehlt: true};
      // Eine Folie mit einem SICHTBAREN und einem ABGESCHALTETEN Objekt, beide zu weit aussen.
      const folie = {
        objectVisibility: {title: true, ticker: false},
        layout: {title: {x: 1, y: 1, w: 20, h: 10}, ticker: {x: 1, y: 99, w: 92, h: 6}},
      };
      const geaendert = G.fixSlide(folie);
      return {
        geaendert,
        titelVerschoben: folie.layout.title.x !== 1 || folie.layout.title.y !== 1,
        tickerUnberuehrt: folie.layout.ticker.x === 1 && folie.layout.ticker.y === 99 && folie.layout.ticker.w === 92,
        version: G.VERSION,
      };
    });
    pruefe('Wächter ist geladen', !ergebnis.fehlt, ergebnis.version || '');
    pruefe('sichtbares Objekt wird in den Sicherheitsbereich geholt', ergebnis.titelVerschoben);
    pruefe('abgeschaltetes Objekt bleibt unangetastet', ergebnis.tickerUnberuehrt,
      'früher wurden ALLE Platzhalter verschoben, auch die unsichtbaren');
    pruefe('nur ein Objekt gezählt', ergebnis.geaendert === 1, `gezählt: ${ergebnis.geaendert}`);

    // Ein reiner Klick darf nichts speichern.
    const klick = await p.evaluate(async () => {
      const buehne = document.createElement('div');
      buehne.id = 'preview'; buehne.style.cssText = 'width:400px;height:200px';
      document.body.appendChild(buehne);
      window.KCPresentationProfessional.refresh();
      let gespeichert = 0;
      window.saveTvPresentation = () => { gespeichert++; };
      // Der Waechter fragt zuerst KCGetTVPresentation - im Manager liefert das die echte
      // Praesentation. Fuer die Pruefung wird sie durch eine Folie mit einem Objekt
      // ausserhalb des Sicherheitsbereichs ersetzt.
      window.KCGetTVPresentation = () => ({slides: [{title: 'Probe', objectVisibility: {title: true}, layout: {title: {x: 1, y: 1, w: 20, h: 10}}}]});
      window.tvSlideIndex = 0;
      const feuer = (art, x, y) => buehne.dispatchEvent(new PointerEvent(art, {bubbles: true, clientX: x, clientY: y}));
      feuer('pointerdown', 100, 100); feuer('pointerup', 101, 100);      // reiner Klick
      await new Promise((r) => setTimeout(r, 60));
      const nachKlick = gespeichert;
      feuer('pointerdown', 100, 100); feuer('pointerup', 160, 140);      // echtes Ziehen
      await new Promise((r) => setTimeout(r, 60));
      return {nachKlick, nachZiehen: gespeichert};
    });
    pruefe('ein reiner Klick verändert die Präsentation nicht', klick.nachKlick === 0, `Speichervorgänge: ${klick.nachKlick}`);
    pruefe('ein echtes Verschieben korrigiert weiterhin', klick.nachZiehen > klick.nachKlick, `Speichervorgänge: ${klick.nachZiehen}`);
    await p.close();
  }

  // ---------- 3 bis 5: der TÜV-Kern ----------
  {
    const p = await browser.newPage();
    await p.goto(`http://127.0.0.1:${PORT}/pc-manager/index.html`);
    await p.waitForTimeout(2000);
    const b = await p.evaluate(() => {
      const T = window.KCPresentationTUV;
      if (!T) return {fehlt: true};
      const codes = (r) => r.issues.map((x) => x.code);
      const mitMaster = T.inspect({
        master: {enabled: true}, page: {width: 1920, height: 1080},
        slides: [{id: 'a', title: 'Herzlich willkommen', objectVisibility: {title: true}, layout: {title: {x: 50, y: 50, w: 40, h: 20}}, duration: 10}],
      }, {});
      const ohneMaster = T.inspect({page: {width: 1920, height: 1080}, slides: [{id: 'b', items: [{type: 'text', text: 'Hallo', font: 40}], duration: 10}]}, {});
      return {
        masterMitAktiv: codes(mitMaster).filter((c) => c === 'MST-001').length,
        masterOhne: codes(ohneMaster).filter((c) => c === 'MST-001').length,
        aufloesung: codes(mitMaster).includes('TV-001'),
        leereFolie: codes(mitMaster).includes('CNT-001'),
      };
    });
    pruefe('TÜV-Kern ist geladen', !b.fehlt);
    pruefe('kein "Keine aktive Masterfolie" bei aktivem Master', b.masterMitAktiv === 0, `gemeldet: ${b.masterMitAktiv}`);
    pruefe('die Meldung kommt bei fehlendem Master genau einmal', b.masterOhne === 1, `gemeldet: ${b.masterOhne}`);
    pruefe('keine Meldung "Zielauflösung fehlt" bei gesetzter Seitengröße', !b.aufloesung);
    pruefe('keine Meldung "Leere Folie" für Folien nach dem layout-Modell', !b.leereFolie);
    await p.close();
  }

  // ---------- 6: der TÜV findet auch die Präsentation des TV-Bereichs ----------
  {
    const p = await browser.newPage();
    await p.addInitScript(() => {
      localStorage.removeItem('fs3.visualDesigner.project');
      localStorage.setItem('kcm_tv_presentation_v2', JSON.stringify({
        page: {width: 1920, height: 1080}, master: {enabled: true},
        slides: [{id: 'tv1', title: 'Willkommen', objectVisibility: {title: true}, layout: {title: {x: 50, y: 40, w: 60, h: 20}}, duration: 10}],
      }));
    });
    await p.goto(`http://127.0.0.1:${PORT}/pc-manager/index.html`);
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => window.KCPresentationTUVRun?.() || null);
    pruefe('TÜV prüft die Präsentation des TV-Bereichs, wenn das Studio leer ist',
      !!r && r.slideCount === 1, `Folien laut TÜV: ${r ? r.slideCount : 'kein Bericht'}`);
    pruefe('und meldet dann NICHT "Keine Folien"',
      !!r && !r.issues.some((x) => x.code === 'PRS-001'));
    await p.close();
  }

  await browser.close(); server.close();
  console.log(`\nPräsentations-Schutz: ${ok}/${ok + rot} bestanden`);
  process.exit(rot ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
