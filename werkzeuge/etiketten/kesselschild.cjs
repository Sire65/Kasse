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
const exaktA4 = require('../uebungsliste/a4.cjs'); // 29.10.2026: Chromium-A4 ist etwas zu gross -> exakt A4 (sonst ggf. kein Duplex/Fehlermeldung am Drucker)
const W = path.join(__dirname, '..', '..');
const ZIEL = path.join(__dirname, 'ausgabe'); fs.mkdirSync(ZIEL, {recursive: true});
const args = process.argv.slice(2); const PROBE = args.includes('--probe');
// 09.11.2026 (Betreiber: "Etikett muss kleiner werden – 7 x 7 cm, oben links das Bild, nicht zu gross, rechts daneben der Preis inkl. Pfand
// ohne Euro-Zeichen, darunter der QR-Code; links neben dem QR-Code Allergene und Zusatzstoffe – der QR-Code ist das Wichtigste"): --7x7
const IDS = args.filter((a) => !a.startsWith('--'));
// 09.11.2026 (Betreiber: "mach 6 x 6 cm"): --6x6 = dasselbe Etikett wie 7 x 7, gleichmaessig auf 60 mm verkleinert (Schrift und QR-Code
// werden mit kleiner, die Aufteilung bleibt); Bogen 3 x 4 = 12 je A4
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
    // 1. Artikelstamm aus der Kasse lesen (wie er am Stand gilt)
    const ctx = await b.newContext({serviceWorkers: 'block'}); const p = await ctx.newPage();
    await p.addInitScript(() => localStorage.setItem('kc_master_v040', JSON.stringify({registerId: 'ETIKETT', pinLockEnabled: false})));
    await p.goto(`http://127.0.0.1:${PORT}/pos/index.html`); await p.waitForFunction(() => typeof PRODUCTS !== 'undefined' && PRODUCTS.length && window.KCAllergene, null, {timeout: 20000});
    const artikel = await p.evaluate((ids) => PRODUCTS.filter((x) => x.active !== false && Number(x.price) > 0 && /^0[12]/.test(String(x.barcode || '')) && (!ids.length || ids.includes(x.id)))
      .map((x) => {
        const pfand = (x.depositComponents || []).filter((k) => Number(k?.price) > 0).map((k) => ({name: k.name || 'Pfand', betrag: Number(k.price)}));
        const info = x.info || {};
        const zusatz = String(info.additives || '').trim();
        return {id: x.id, name: x.name, preis: Number(x.price), pfand, nummer: String(x.barcode), bild: x.image, farbe: x.color || '#173765',
          allergene: window.KCAllergene.alsText(info.allergens) || String(info.legacyAllergens || '').trim(),
          allergeneGeprueft: info.status === 'approved',
          zusatz: /^(keine angaben?|unbekannt|-)?$/i.test(zusatz) ? null : zusatz,
          // 29.10.2026: „Alkoholfrei (0 % vol)“ / „Alkoholfreier …“ ist KEIN Alkohol (vorher stand beim Apfelpunsch „Enthält Alkohol“)
          alkohol: /alkohol(?!fre)/i.test(String(info.important || '') + ' ' + String(info.shortDescription || ''))};
      }), IDS);
    await ctx.close();
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
    // Original (1254 px, 2,4 MB) in einem 2-cm-Feld lassen manche Handy-Betrachter und Drucker weg. Ausserdem 6 x 6 per zoom statt transform.
    if (KLEIN) {
      const kp = await (await b.newContext()).newPage();
      for (const a of artikel) {
        const f = path.join(W, 'pos', a.bild || '');
        if (!a.bild || !fs.existsSync(f)) continue;
        a.bildKlein = await kp.evaluate(async (src) => { const img = new Image(); img.src = src; await img.decode();
          const m = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
          c.width = Math.round(img.naturalWidth * m); c.height = Math.round(img.naturalHeight * m);
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
          return c.toDataURL('image/jpeg', 0.88); }, b64(f));
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
        <div class="k7-oben">
          <div class="foto">${bild ? `<img src="${bild}" alt=""${/_version_3\.png$/.test(a.bild) ? ' class="v3"' : ''}>` : fehlt('Foto fehlt')}</div>
          <div class="k7-preis"><div class="betrag">${zahl(gesamt)}</div>${pfandSumme > 0 ? `<div class="inkl">inkl. ${zahl(pfandSumme)} Pfand</div>` : ''}</div>
        </div>
        <div class="k7-unten">
          <div class="angaben">
            <p><b>Allergene:</b> ${a.allergene ? esc(a.allergene) : fehlt('nicht erfasst')}</p>
            <p><b>Zusatzstoffe:</b> ${a.zusatz ? esc(a.zusatz) : fehlt('nicht erfasst')}</p>
            ${a.alkohol ? '<p class="alk">Enthält Alkohol</p>' : ''}
          </div>
          <div class="qr"><div class="code" data-qr="${esc(a.nummer)}"></div><small>${esc(a.nummer)}</small></div>
        </div>
      </div>`;
    };
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
      .zelle.k7z, .etikett.k7 { width: 70mm; height: 70mm; }
      .zelle.k6z { width: 60mm; height: 60mm; overflow: hidden; } .zelle.k6z > .etikett { zoom: ${60 / 70}; }
      .etikett.k7 { padding: 2mm 2.6mm 1.8mm; border-width: 0.8mm; border-radius: 5mm; }
      .k7 > * { flex-shrink: 0; }
      .k7 h1 { font-size: 4.8mm; line-height: 1.05; margin: 0 0 0.8mm; }
      .k7-oben { display: flex; gap: 2.5mm; align-items: center; height: 21mm; }
      .k7 .foto { width: 21mm; height: 21mm; border-radius: 2.5mm; }
      .k7-preis { flex: 1 1 auto; text-align: center; }
      .k7 .betrag { font-size: 12mm; }
      .k7 .inkl { font-size: 3.2mm; margin-top: 0.6mm; }
      .k7-unten { display: flex; gap: 2mm; margin-top: auto; align-items: flex-end; }
      .k7 .angaben { font-size: 2.55mm; line-height: 1.25; align-self: stretch; display: flex; flex-direction: column; }
      .k7 .angaben p + p { margin-top: 0.7mm; }
      .k7 .k7-verein { margin-top: auto; display: flex; align-items: center; gap: 1mm; font-size: 2.4mm; font-weight: 700; color: #173765; }
      .k7 .k7-verein img { height: 3.2mm; }
      .k7 .qr .code { width: 34mm; height: 34mm; }
      .k7 .qr small { font-size: 2.5mm; margin-top: 0; }`;
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
      seiten = `<div class="blatt"><div class="zelle${SECHS ? ' k6z' : KLEIN ? ' k7z' : ''}" style="left:${x}mm;top:${y}mm">${(KLEIN ? etikettKlein : etikett)(artikel[0])}</div>${marken(x, y, K, K)}
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
        artikel.slice(i, i + JE).forEach((a, k) => { const x = x0 + (k % SP) * (K + ABSTAND), y = y0 + Math.floor(k / SP) * (K + ABSTAND); zellen += `<div class="zelle${SECHS ? ' k6z' : KLEIN ? ' k7z' : ''}" style="left:${x}mm;top:${y}mm">${(KLEIN ? etikettKlein : etikett)(a)}</div>`; });
        seiten += `<div class="blatt">${zellen}${marken(x0, y0, SP * K + ABSTAND, ZE * K + (ZE - 1) * ABSTAND)}</div>`;
      }
    }
    const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>${stil}</style><script>${qrQuelle}</script></head><body>${seiten}
      <script>document.querySelectorAll('[data-qr]').forEach((n) => { const q = qrcode(0, 'M'); q.addData(n.dataset.qr); q.make(); const c = q.getModuleCount(), r = 4, g = c + 2 * r;
        let d = ''; for (let y = 0; y < c; y++) for (let x = 0; x < c; x++) if (q.isDark(y, x)) d += 'M' + (x + r) + ' ' + (y + r) + 'h1v1h-1z';
        n.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + g + ' ' + g + '" shape-rendering="crispEdges"><rect width="' + g + '" height="' + g + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>'; });</script></body></html>`;
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
    const e = await seite.$(SECHS ? '.zelle' : '.etikett'); await e.screenshot({path: path.join(ZIEL, name + '_Vorschau.png'), scale: 'device'});
    const fehlend = artikel.filter((a) => !a.zusatz || !a.allergene).map((a) => `${a.nummer} ${a.name}: ${[!a.allergene && 'Allergene', !a.zusatz && 'Zusatzstoffe'].filter(Boolean).join(', ')}`);
    console.log(`fertig: ${artikel.length} Etikett(en) -> ${path.join(ZIEL, name + '.pdf')}`);
    if (fehlend.length) console.log('Fehlende Angaben im Artikelstamm:\n  ' + fehlend.join('\n  '));
  } finally { await b.close(); s.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
