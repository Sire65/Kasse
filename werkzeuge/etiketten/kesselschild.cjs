// Kesselschild-Etiketten 8 x 8 cm erzeugen: node werkzeuge/etiketten/kesselschild.cjs [artikel-id ...] [--probe]
// KC-ETIKETT-KESSELSCHILD (13.10.2026, Betreiber: "Artikeletiketten 8 x 8 mit abgerundetem Rahmen, gut lesbarer
// QR-Code, Foto, Preis inkl. Pfand, Allergene, Zusatzstoffe ... spaeter mit Schnittmarken, A4 gut ausnutzen ...
// wasserfeste Etiketten ... auf Metallschilder 9 x 11 cm geklebt, oben 3 Loecher, am Gluehweinkessel").
//
// Daten kommen aus derselben Quelle wie Kasse und Etikettendruck im PC-Manager: Artikelstamm der Kasse
// (pos/app.js -> PRODUCTS, inkl. Pfandbestandteile und Artikelinformation), Allergen-Texte aus
// shared/kc-allergene.js, QR mit pc-manager/vendor/qrcode-generator.js. Der QR enthaelt GENAU die
// Artikelnummer (Regel aus ARTIKELNUMMERN_UND_QR_LIESMICH.md) - der Scanner tippt sie, die Kasse versteht sie.
// Fehlende Pflichtangaben (z. B. Zusatzstoffe "Keine Angaben") werden NIE als "keine" gedruckt, sondern auf der
// Probe rot markiert (UNKNOWN darf nie als OK erscheinen).
//
// --probe: ein Etikett in Originalgroesse auf A4 mit Schnittmarken und 5-cm-Messbalken (zum Pruefen der Druckgroesse).
// ohne --probe: Bogen A4 mit 2 x 3 Etiketten (8 x 8 cm passt nur zweimal nebeneinander) und Schnittmarken.
const fs = require('fs'), path = require('path'), http = require('http'); const pw = require('playwright');
const exaktA4 = require('../uebungsliste/a4.cjs'); const {artikelstammLesen} = require('./artikelstamm.cjs'); // 29.10.2026: Chromium-A4 ist etwas zu gross -> exakt A4 (sonst ggf. kein Duplex/Fehlermeldung am Drucker)
const W = path.join(__dirname, '..', '..');
const ZIEL = path.join(__dirname, 'ausgabe'); fs.mkdirSync(ZIEL, {recursive: true});
const args = process.argv.slice(2); const PROBE = args.includes('--probe');
// 09.11.2026 (Betreiber: "Etikett muss kleiner werden – 7 x 7 cm, oben links das Bild, nicht zu gross, rechts daneben der Preis inkl. Pfand
// ohne Euro-Zeichen, darunter der QR-Code; links neben dem QR-Code Allergene und Zusatzstoffe – der QR-Code ist das Wichtigste"): --7x7
const IDS = args.filter((a) => !a.startsWith('--'));
// 09.11.2026 (Betreiber: "mach 6 x 6 cm"): --6x6 = dasselbe Etikett wie 7 x 7, alle Masse mal 60/70 (Schrift und QR-Code werden mit
// kleiner, die Aufteilung bleibt); Bogen 3 x 4 = 12 je A4
const SECHS = args.includes('--6x6'), KLEIN = SECHS || args.includes('--7x7'), K = SECHS ? 60 : KLEIN ? 70 : 80; // Etikettgroesse in mm
const MM = 8, ABSTAND = 0; // Etikett 80 mm; Bogen: Etiketten stossen aneinander -> nur ein Schnitt dazwischen
const T = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'};
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const euro = (b) => (Math.round(b * 100) / 100).toFixed(2).replace('.', ',') + ' €';
const b64 = (f) => `data:${f.endsWith('.png') ? 'image/png' : f.endsWith('.webp') ? 'image/webp' : 'image/jpeg'};base64,` + fs.readFileSync(f).toString('base64');

(async () => {
  const s = http.createServer((q, r) => { const p = path.join(W, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, {'Content-Type': T[path.extname(p)] || 'application/octet-stream'}); r.end(d); }); });
  await new Promise((r) => s.listen(0, r)); const PORT = s.address().port;
  const b = await pw.chromium.launch();
  try {
    // 1. Artikelstamm aus der Kasse lesen (wie er am Stand gilt) – gemeinsamer Kern mit artikel-export.cjs (Club-App-Preisetiketten)
    const artikel = await artikelstammLesen(b, PORT, IDS);
    if (IDS.length) artikel.sort((x, y) => IDS.indexOf(x.id) - IDS.indexOf(y.id)); // 29.10.2026: Reihenfolge wie angegeben
    if (!artikel.length) throw new Error('Keine passenden Artikel gefunden: ' + IDS.join(', '));
    const qrQuelle = fs.readFileSync(path.join(W, 'pc-manager', 'vendor', 'qrcode-generator.js'), 'utf8');
    const hut = b64(path.join(W, 'werkzeuge', 'uebungsliste', 'hut.png'));

    // 2. Etikett-HTML
    const etikett = (a) => {
      const pfandSumme = a.pfand.reduce((s, k) => s + k.betrag, 0), gesamt = a.preis + pfandSumme;
      const bildDatei = path.join(W, 'pos', a.bild || '');
      const bild = a.bild && fs.existsSync(bildDatei) ? b64(bildDatei) : '';
      const fehlt = (t) => `<span class="fehlt">⚠ ${t}</span>`;
      return `<div class="etikett" style="--farbe:${esc(a.farbe)}">
        <div class="kopf"><img src="${hut}" alt=""><span>Köcheclub Werne</span><b>Art.-Nr. ${esc(a.nummer)}</b></div>
        <h1>${esc(a.name)}</h1>
        <div class="mitte">
          <div class="foto">${bild ? `<img src="${bild}" alt=""${/_version_3\.png$/.test(a.bild) ? ' class="v3"' : ''}>` : fehlt('Foto fehlt')}</div>
          <div class="preis">
            <div class="betrag">${euro(gesamt)}</div>
            ${pfandSumme > 0 ? `<div class="inkl">inkl. ${euro(pfandSumme)} Pfand</div>
            <div class="teile">${euro(a.preis)} ${esc(a.name.split(' ')[0])}<br>${a.pfand.map((k) => `+ ${euro(k.betrag)} ${esc(k.name)}`).join('<br>')}</div>
            <div class="zurueck">Pfand gibt es bei Rückgabe zurück.</div>` : '<div class="inkl">kein Pfand</div>'}
          </div>
        </div>
        <div class="unten">
          <div class="angaben">
            <p><b>Allergene:</b> ${a.allergene ? esc(a.allergene) : fehlt('nicht erfasst')}</p>
            <p><b>Zusatzstoffe:</b> ${a.zusatz ? esc(a.zusatz) : fehlt('nicht erfasst – im PC-Manager unter Artikelinformation pflegen')}</p>
            ${a.alkohol ? '<p class="alk">Enthält Alkohol</p>' : ''}
          </div>
          <div class="qr"><div class="code" data-qr="${esc(a.nummer)}"></div><small>${esc(a.nummer)}</small></div>
        </div>
      </div>`;
    };
    // 7 x 7 cm: QR-Code so gross wie moeglich (rechts unten, ca. 36 mm), Foto oben links 26 mm, Preis ohne €-Zeichen rechts neben dem Foto
    // 12.11.2026 (Betreiber: „auf dem 6 x 6 ist kein Foto“): Fotos fuer 7 x 7 / 6 x 6 vorher auf 600 px verkleinern (JPEG) – das
    // Original (1254 px, 2,4 MB) in einem 2-cm-Feld lassen manche Handy-Betrachter und Drucker weg. 6 x 6 in echten Massen (siehe m() beim Stil).
    if (KLEIN) {
      const kp = await (await b.newContext()).newPage();
      for (const a of artikel) {
        const f = path.join(W, 'pos', a.bild || '');
        if (!a.bild || !fs.existsSync(f)) continue;
        // 12.11.2026 (Bild Betreiber: nur graues Fotofeld): Ausschnitt (Kachelbilder _version_3: nur der Fototeil) und runde Ecken
        // werden HIER fest ins Bild gerechnet – im PDF steht dann ein schlichtes quadratisches Bild ohne Zuschnitt/Maske
        a.bildKlein = await kp.evaluate(async ([src, v3]) => { const img = new Image(); img.src = src; await img.decode();
          const W = img.naturalWidth, H = img.naturalHeight;
          // 12.11.2026 (Betreiber: „Bild wird abgeschnitten“): Kachelbilder (_version_3) in voller Breite, nur der Namensbalken unten
          // (ab 83 %) faellt weg; das i-Symbol oben links wird mit der Hintergrundfarbe drumherum uebermalt. Andere Bilder: quadratisch mittig.
          const [sx, sy, sw, sh] = v3 ? [0, 0, W, H * 0.83] : (() => { const k = Math.min(W, H); return [(W - k) / 2, (H - k) / 2, k, k]; })();
          const N = 600, NH = Math.round(N * sh / sw), R = N * 0.1, c = document.createElement('canvas'); c.width = N; c.height = NH;
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, N, NH);
          g.beginPath(); g.moveTo(R, 0); g.arcTo(N, 0, N, NH, R); g.arcTo(N, NH, 0, NH, R); g.arcTo(0, NH, 0, 0, R); g.arcTo(0, 0, N, 0, R); g.closePath(); g.clip();
          g.drawImage(img, sx, sy, sw, sh, 0, 0, N, NH);
          if (v3) { // i-Symbol (Mitte ca. 9,3 % / 9,3 %, Radius ca. 7 %): Farbe aus einem Ring knapp ausserhalb (Median), dann uebermalen
            const cx = N * 0.093, cy = N * 0.093, ri = N * 0.082, px = g.getImageData(0, 0, N, NH).data, f = [[], [], []];
            for (let w = 0; w < 360; w += 6) { const x = Math.round(cx + Math.cos(w * Math.PI / 180) * N * 0.1), y = Math.round(cy + Math.sin(w * Math.PI / 180) * N * 0.1);
              if (x < 0 || y < 0 || x >= N || y >= NH) continue; const o = (y * N + x) * 4; for (let k = 0; k < 3; k++) f[k].push(px[o + k]); }
            const med = (a) => a.sort((u, v) => u - v)[a.length >> 1];
            g.fillStyle = `rgb(${med(f[0])},${med(f[1])},${med(f[2])})`; g.beginPath(); g.arc(cx, cy, ri, 0, 7); g.fill();
          }
          return c.toDataURL('image/jpeg', 0.88); }, [b64(f), /_version_3\.png$/.test(a.bild)]);
      }
      await kp.close();
    }
    const etikettKlein = (a) => {
      const pfandSumme = a.pfand.reduce((s, k) => s + k.betrag, 0), gesamt = a.preis + pfandSumme;
      const zahl = (b) => (Math.round(b * 100) / 100).toFixed(2).replace('.', ',');
      const bildDatei = path.join(W, 'pos', a.bild || '');
      const bild = a.bildKlein || (a.bild && fs.existsSync(bildDatei) ? b64(bildDatei) : '');
      const fehlt = (t) => `<span class="fehlt">⚠ ${t}</span>`;
      return `<div class="etikett k7" style="--farbe:${esc(a.farbe)}">
        <h1>${esc(a.name)}</h1>
        <div class="k7-spalten">
          <div class="k7-links">
            <div class="foto">${bild ? `<img src="${bild}" alt=""${!a.bildKlein && /_version_3\.png$/.test(a.bild) ? ' class="v3"' : ''}>` : fehlt('Foto fehlt')}</div>
            <div class="angaben">
              <p><b>Allergene:</b> ${a.allergene ? esc(a.allergene) : fehlt('nicht erfasst')}</p>
              <p><b>Zusatzstoffe:</b> ${a.zusatz ? esc(a.zusatz) : fehlt('nicht erfasst')}</p>
              ${a.alkohol ? '<p class="alk">Enthält Alkohol</p>' : ''}
            </div>
          </div>
          <div class="k7-rechts">
            <div class="k7-preis"><div class="betrag">${zahl(gesamt)}</div>${pfandSumme > 0 ? `<div class="inkl">inkl. ${zahl(pfandSumme)} Pfand</div>` : ''}</div>
            <div class="qr"><div class="code" data-qr="${esc(a.nummer)}"></div><small>${esc(a.nummer)}</small></div>
          </div>
        </div>
      </div>`;
    };
    // 7 x 7 in mm; 6 x 6 = dieselben Masse mal 60/70 – als echte Masse ausgerechnet (kein zoom/transform, 12.11.2026)
    const m = (x) => (x * (SECHS ? 60 / 70 : 1)).toFixed(3) + 'mm';
    const stil = `
      @page { size: A4; margin: 0; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Carlito, Calibri, 'Liberation Sans', Arial, sans-serif; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .blatt { position: relative; width: 210mm; height: 297mm; page-break-after: always; overflow: hidden; }
      .zelle { position: absolute; width: 80mm; height: 80mm; }
      .etikett { width: 80mm; height: 80mm; padding: 2.6mm 3mm 2.4mm; border: 0.9mm solid var(--farbe); border-radius: 6mm; display: flex; flex-direction: column; background: #fff; }
      .kopf { display: flex; align-items: center; gap: 1.4mm; font-size: 2.9mm; color: #173765; font-weight: 700; height: 4.6mm; }
      .kopf img { height: 4.4mm; } .kopf b { margin-left: auto; font-size: 2.6mm; color: #5b6572; font-weight: 700; }
      h1 { font-size: 7.4mm; line-height: 1.05; font-weight: 900; color: var(--farbe); text-align: center; margin: 1.2mm 0 1.4mm; white-space: nowrap; overflow: hidden; }
      .mitte { display: flex; gap: 3mm; height: 31mm; }
      .foto { width: 31mm; height: 31mm; border-radius: 3mm; overflow: hidden; flex: 0 0 auto; background: #f1f5f9; display: flex; align-items: center; justify-content: center; }
      .foto { position: relative; } .foto img { width: 100%; height: 100%; object-fit: cover; }
      /* Kachelbilder der Kasse (_version_3) tragen unten den Namen und oben links das i-Symbol fest im Bild:
         nur den Fotoausschnitt zeigen (x 17-99 %, y 0-82 %). */
      .foto img.v3 { position: absolute; width: 121.5%; height: 121.5%; left: -20.6%; top: 0; object-fit: fill; }
      .preis { flex: 1 1 auto; display: flex; flex-direction: column; justify-content: center; }
      .betrag { font-size: 12.5mm; font-weight: 900; line-height: 1; color: #111; white-space: nowrap; }
      .inkl { font-size: 3.6mm; font-weight: 800; color: var(--farbe); margin-top: 1mm; }
      .teile { font-size: 2.9mm; color: #333; margin-top: 1mm; line-height: 1.25; }
      .zurueck { font-size: 2.6mm; color: #5b6572; margin-top: 0.8mm; }
      .unten { display: flex; gap: 2.5mm; margin-top: auto; align-items: flex-end; }
      .angaben { flex: 1 1 auto; font-size: 2.9mm; line-height: 1.28; }
      .angaben p + p { margin-top: 0.9mm; }
      .alk { font-weight: 800; }
      .fehlt { color: #b91c1c; font-weight: 800; border: 0.3mm dashed #b91c1c; padding: 0 0.6mm; border-radius: 0.8mm; }
      .qr { flex: 0 0 auto; text-align: center; }
      .qr .code { width: 23mm; height: 23mm; } .qr svg { width: 100%; height: 100%; display: block; }
      .qr small { display: block; font-size: 2.6mm; font-weight: 700; letter-spacing: .2mm; margin-top: 0.3mm; }
      .marke { position: absolute; background: #000; }
      .hinweis { position: absolute; left: 15mm; right: 15mm; font-size: 3.4mm; color: #333; line-height: 1.4; }
      .mass { position: absolute; height: 2mm; border: 0.25mm solid #000; border-top: 0; }
      .mass span { position: absolute; top: 2.4mm; left: 0; right: 0; text-align: center; font-size: 2.8mm; }
      .zelle.k7z, .etikett.k7 { width: ${m(70)}; height: ${m(70)}; }
      .etikett.k7 { padding: ${m(2)} ${m(3.2)} ${m(1.8)} ${m(3.6)}; border-width: ${m(0.8)}; border-radius: ${m(5)}; } /* 12.11.2026: links etwas mehr Abstand zum Rand */
      .k7 > * { flex-shrink: 0; }
      .k7 h1 { font-size: ${m(4.8)}; line-height: 1.05; margin: 0 0 ${m(0.8)}; }
      /* 12.11.2026 (Betreiber: „Platz besser ausnutzen – Foto größer, darunter die Schrift auch“): zwei Spalten statt Zeilen –
         links Foto über die ganze Spaltenbreite (27 mm), darunter Allergene/Zusatzstoffe in 3 mm Schrift (wird nur bei Platzmangel kleiner);
         rechts Preis und QR-Code (34 mm) */
      .k7-spalten { display: flex; gap: ${m(2)}; flex: 1 1 auto; min-height: 0; }
      .k7-links { width: ${m(26.5)}; flex: 0 0 auto; display: flex; flex-direction: column; gap: ${m(1.4)}; min-height: 0; }
      .k7 .foto { width: ${m(26.5)}; height: auto; border-radius: 0; overflow: visible; background: none; flex: 0 0 auto; }
      .k7 .foto img { position: static; width: 100%; height: auto; display: block; }
      .k7-rechts { flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: space-between; }
      .k7-preis { text-align: center; }
      .k7 .betrag { font-size: ${m(12)}; }
      .k7 .inkl { font-size: ${m(3.2)}; margin-top: ${m(0.6)}; }
      .k7 .angaben { font-size: ${m(3)}; line-height: 1.22; flex: 1 1 auto; min-height: 0; overflow: hidden; }
      .k7 .angaben p + p { margin-top: ${m(0.8)}; }
      .k7 .fehlt { border-width: ${m(0.3)}; padding: 0 ${m(0.6)}; }
      .k7 .qr .code { width: ${m(34)}; height: ${m(34)}; }
      .k7 .qr small { font-size: ${m(2.5)}; margin-top: 0; }`;
    // Schnittmarken: nur aussen, damit nichts davon auf einem Etikett landet (Etiketten stossen bei 0 mm Abstand aneinander)
    const marken = (x, y, w, h) => {
      const L = 6, A = 2, D = 0.25, m = [];
      [x, x + w].forEach((mx) => { m.push(`<div class="marke" style="left:${mx - D / 2}mm;top:${y - A - L}mm;width:${D}mm;height:${L}mm"></div>`, `<div class="marke" style="left:${mx - D / 2}mm;top:${y + h + A}mm;width:${D}mm;height:${L}mm"></div>`); });
      [y, y + h].forEach((my) => { m.push(`<div class="marke" style="top:${my - D / 2}mm;left:${x - A - L}mm;height:${D}mm;width:${L}mm"></div>`, `<div class="marke" style="top:${my - D / 2}mm;left:${x + w + A}mm;height:${D}mm;width:${L}mm"></div>`); });
      return m.join('');
    };
    let seiten = '';
    if (PROBE) {
      const x = (210 - K) / 2, y = 40;
      seiten = `<div class="blatt"><div class="zelle${KLEIN ? ' k7z' : ''}" style="left:${x}mm;top:${y}mm">${(KLEIN ? etikettKlein : etikett)(artikel[0])}</div>${marken(x, y, K, K)}
        <div class="mass" style="left:80mm;top:140mm;width:50mm"><span>Messbalken: muss genau 5 cm lang sein</span></div>
        <div class="hinweis" style="top:155mm"><b>Probe-Etikett ${esc(artikel[0].name)} – ${K / 10} × ${K / 10} cm</b><br>
        Drucken mit <b>Originalgröße / 100 %</b> (nicht „an Seite anpassen“). Messbalken nachmessen: 5,0 cm.<br>
        QR-Code mit dem Kassen-Scanner prüfen: Er muss „${esc(artikel[0].nummer)}“ tippen und den Artikel in den Bon legen.<br>
        Rot markierte Felder fehlen im Artikelstamm und werden vor der Endversion im PC-Manager gepflegt.<br>
        Später: Bogen A4 mit 2 × 3 Etiketten auf wasserfeste Folienetiketten, ausschneiden, auf Metallschild 9 × 11 cm
        (oben 3 cm frei für die 3 Löcher, seitlich je 5 mm Rand).</div></div>`;
    } else {
      // 8 x 8: 2 x 3 je A4 · 7 x 7: 2 x 4 je A4 (3 nebeneinander waeren 210 mm = ohne Rand)
      const SP = SECHS ? 3 : 2, ZE = KLEIN ? 4 : 3, JE = SP * ZE;
      const x0 = (210 - SP * K - ABSTAND) / 2, y0 = (297 - ZE * K - (ZE - 1) * ABSTAND) / 2;
      for (let i = 0; i < artikel.length; i += JE) {
        let zellen = '';
        artikel.slice(i, i + JE).forEach((a, k) => { const x = x0 + (k % SP) * (K + ABSTAND), y = y0 + Math.floor(k / SP) * (K + ABSTAND); zellen += `<div class="zelle${KLEIN ? ' k7z' : ''}" style="left:${x}mm;top:${y}mm">${(KLEIN ? etikettKlein : etikett)(a)}</div>`; });
        seiten += `<div class="blatt">${zellen}${marken(x0, y0, SP * K + ABSTAND, ZE * K + (ZE - 1) * ABSTAND)}</div>`;
      }
    }
    const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>${stil}</style><script>${qrQuelle}</script></head><body>${seiten}
      <script>document.querySelectorAll('[data-qr]').forEach((n) => { const q = qrcode(0, 'M'); q.addData(n.dataset.qr); q.make(); const c = q.getModuleCount(), r = 4, g = c + 2 * r;
        let d = ''; for (let y = 0; y < c; y++) for (let x = 0; x < c; x++) if (q.isDark(y, x)) d += 'M' + (x + r) + ' ' + (y + r) + 'h1v1h-1z';
        n.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + g + ' ' + g + '" shape-rendering="crispEdges"><rect width="' + g + '" height="' + g + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>'; });
      // 7 x 7 / 6 x 6: langer Allergen-Text → Schrift in kleinen Schritten verkleinern, bis alles hineinpasst (nie abschneiden)
      document.querySelectorAll('.k7 .angaben').forEach((n) => { let f = parseFloat(getComputedStyle(n).fontSize);
        while (n.scrollHeight > n.clientHeight + 1 && f > 6) { f -= 0.25; n.style.fontSize = f + 'px'; } });</script></body></html>`;
    const name = (PROBE ? `Kesselschild_Probe_${artikel[0].id}` : 'Kesselschilder_A4') + (SECHS ? '_6x6' : KLEIN ? '_7x7' : '');
    // Zwischenstand (HTML mit eingebettetem QR-Baustein) nur im Temp-Ordner - nicht im Projekt
    const zwischen = path.join(require('os').tmpdir(), 'kc-kesselschild'); fs.mkdirSync(zwischen, {recursive: true});
    fs.writeFileSync(path.join(zwischen, name + '.html'), html);
    const seite = await (await b.newContext({deviceScaleFactor: 4})).newPage();
    await seite.setContent(html, {waitUntil: 'load'}); await seite.waitForTimeout(300);
    await seite.pdf({path: path.join(ZIEL, name + '.pdf'), format: 'A4', printBackground: true, margin: {top: 0, right: 0, bottom: 0, left: 0}});
    exaktA4(path.join(ZIEL, name + '.pdf'));
    // Vorschau des ersten Etiketts in hoher Aufloesung
    await seite.setViewportSize({width: 900, height: 1300});
    const e = await seite.$('.etikett'); await e.screenshot({path: path.join(ZIEL, name + '_Vorschau.png'), scale: 'device'});
    const fehlend = artikel.filter((a) => !a.zusatz || !a.allergene).map((a) => `${a.nummer} ${a.name}: ${[!a.allergene && 'Allergene', !a.zusatz && 'Zusatzstoffe'].filter(Boolean).join(', ')}`);
    console.log(`fertig: ${artikel.length} Etikett(en) -> ${path.join(ZIEL, name + '.pdf')}`);
    if (fehlend.length) console.log('Fehlende Angaben im Artikelstamm:\n  ' + fehlend.join('\n  '));
  } finally { await b.close(); s.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
