/* Aufbau Kasse - die Kasse baut sich nach dem Wunschaufbau um.                    07.09.2026
 *
 * Kette: Designer (Vorlage "Wunschaufbau") -> Übergabe -> Kasse liest die Sammlung -> baut um.
 * Geprüft auf BEIDEN iPads (großes 1366x1024, 9 Zoll 1024x768), Entscheidung des Betreibers:
 * "Beide gleich". Sichtbarkeit wird immer über BoundingRect/ComputedStyle gemessen, nie über
 * Attribute (Lehre vom 31.08.).
 */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const srv = http.createServer((q, r) => {
  let f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
const PORT = 8479;
let fehler = 0, n = 0;
const p = (name, ok, zusatz = '') => { n++; console.log(`  ${ok ? 'OK    ' : 'FEHLER'} ${name}${zusatz ? '   [' + zusatz + ']' : ''}`); if (!ok) fehler++; };
const sichtbar = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 2 && r.height > 2 && s.display !== 'none' && s.visibility !== 'hidden'; };
const SHOTS = process.env.KC_SHOTS || '';

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const b = await chromium.launch();
  const fehlerListe = [];

  /* ---------------------------------------------------- 1. Designer: Vorlage + Übergabe */
  console.log('\n== Designer: Wunschaufbau übergeben ==');
  const sammlungen = {};
  for (const [vorlage, geraet] of [['vl-wunsch-gross', 'ipad-gross-quer'], ['vl-wunsch-9', 'ipad-9-quer']]) {
    const d = await b.newPage({ viewport: { width: 1600, height: 1000 } });
    d.on('pageerror', (e) => fehlerListe.push('designer: ' + e.message));
    d.on('dialog', (dlg) => dlg.type() === 'prompt' ? dlg.accept('Wunsch ' + geraet) : dlg.accept());
    await d.goto(`http://127.0.0.1:${PORT}/pc-manager/tv-designer/index.html`);
    await d.waitForFunction(() => window.KCKassenVorlagen && window.KCKassenUebergabe && window.KCOberflaechenFormat);
    await d.evaluate(() => { localStorage.removeItem('kc.kassenoberflaechen.v1'); const m = document.getElementById('modeSelect'); m.value = 'kasse'; m.dispatchEvent(new Event('change', { bubbles: true })); });
    await d.waitForTimeout(400);
    const da = await d.evaluate((v) => !!document.querySelector(`[data-vorlage="${v}"]`), vorlage);
    p(`Vorlage ${vorlage} wird angeboten`, da);
    await d.evaluate((v) => document.querySelector(`[data-vorlage="${v}"]`).click(), vorlage);
    await d.waitForTimeout(500);
    const seiten = await d.evaluate(() => (project.slides || []).filter((s) => s.kcSeite).map((s) => s.kcSeite + ':' + s.items.filter((i) => i.kc).length));
    p('Zwei Seiten: Kasse mit 7 Bausteinen und Zahlen', seiten[0] === 'kasse:7' && seiten[1] && seiten[1].startsWith('zahlen:'), seiten.join(' · '));
    const of = await d.evaluate(() => window.KCKassenUebergabe.uebergeben());
    p('Übergabe angenommen (keine Mängel)', !!of && !!of.id, of ? of.geraet + ' · ' + of.flaeche.breite + 'x' + of.flaeche.hoehe : 'abgelehnt');
    sammlungen[geraet] = { s: await d.evaluate(() => JSON.parse(localStorage.getItem('kc.kassenoberflaechen.v1'))), id: of && of.id };
    await d.close();
  }

  /* ---------------------------------------------------- 2. Kasse baut sich um */
  for (const [geraet, vp] of [['ipad-gross-quer', { width: 1366, height: 1024 }], ['ipad-9-quer', { width: 1024, height: 768 }]]) {
    console.log(`\n== Kasse ${geraet} (${vp.width}x${vp.height}) ==`);
    const { s, id } = sammlungen[geraet];
    const k = await b.newPage({ viewport: vp });
    k.on('pageerror', (e) => fehlerListe.push('kasse ' + geraet + ': ' + e.message));
    await k.addInitScript(() => localStorage.setItem('kc_master_v040', JSON.stringify({ registerId: 'KASSE-01', pinLockEnabled: false })));
    await k.addInitScript(() => localStorage.setItem('kc_offers_v100', '[]'));
    await k.addInitScript(([sam, gid]) => { localStorage.setItem('kc.kassenoberflaechen.v1', JSON.stringify(sam)); localStorage.setItem('kc.kassenoberflaeche.gewaehlt.v1', gid); }, [s, id]);
    await k.goto(`http://127.0.0.1:${PORT}/pos/index.html`);
    await k.waitForTimeout(1800);
    await k.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /KASSE STARTEN/i.test(x.textContent)); if (b) b.click(); });
    await k.waitForTimeout(1200);
    /* Der Starthinweis schließt sich nach 7 s selbst - für die Bilder gleich wegklicken. */
    await k.evaluate(() => { const ok = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'OK' && x.getBoundingClientRect().width > 0); if (ok) ok.click(); });
    await k.waitForTimeout(300);
    p('Modul geladen und Aufbau aktiv', await k.evaluate(() => !!window.KCAufbau && document.body.classList.contains('kc-aufbau')),
      await k.evaluate(() => window.KCAufbau ? window.KCAufbau.aktive()?.name : 'kein Modul'));
    const lage = await k.evaluate(() => {
      const r = document.getElementById('kcAufbau').getBoundingClientRect();
      const q = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.right), b: Math.round(b.bottom) }; };
      return { raster: { w: Math.round(r.width), h: Math.round(r.height) },
        kopf: q('.kc-bereich.kopf'), gruppen: q('.kc-bereich.gruppen'), artikel: q('.kc-bereich.artikel'), bon: q('.kc-bereich.bon'),
        taste: q('.kc-bereich.taste'), sonder: q('.kc-bereich.sonder'), arten: q('.kc-bereich.arten'),
        platzhalter: [...document.querySelectorAll('#kcAufbau .kc-bereich.platzhalter')].map((e) => e.dataset.typ),
        kacheln: document.querySelectorAll('#kcAufbau .product-tile').length,
        gruppenKnoepfe: [...document.querySelectorAll('#kcAufbau #categories button')].filter((b) => b.getBoundingClientRect().width > 0).length };
    });
    p('Raster füllt den Bildschirm', lage.raster.w >= vp.width - 2 && lage.raster.h >= vp.height - 2, `${lage.raster.w}x${lage.raster.h}`);
    p('Kein Baustein blieb Platzhalter', lage.platzhalter.length === 0, lage.platzhalter.join(', ') || 'alle zugeordnet');
    p('Kopf rechts oben', lage.kopf && lage.kopf.y < 10 && lage.kopf.x > vp.width * 0.5, JSON.stringify(lage.kopf));
    p('Warengruppen links oben, links vom Kopf', lage.gruppen && lage.gruppen.y < 10 && lage.gruppen.x < 10 && lage.gruppen.r <= lage.kopf.x + 2, `${lage.gruppenKnoepfe} Knöpfe`);
    p('Artikel unter den Warengruppen', lage.artikel && lage.artikel.y >= lage.gruppen.b - 2 && lage.artikel.x < 10, `${lage.kacheln} Kacheln sichtbar`);
    p('Bon rechts, unter dem Kopf', lage.bon && lage.bon.x > vp.width * 0.5 && lage.bon.y >= lage.kopf.b - 2, JSON.stringify(lage.bon));
    p('Rückgeld-Taste links unten', lage.taste && lage.taste.x < 10 && lage.taste.b >= vp.height - 10, JSON.stringify(lage.taste));
    p('Sondertasten unten neben der Taste', lage.sonder && lage.sonder.x >= lage.taste.r - 2 && lage.sonder.b >= vp.height - 10, JSON.stringify(lage.sonder));
    p('Zahlungsarten unter dem Bon', lage.arten && lage.arten.y >= lage.bon.b - 2 && lage.arten.x > vp.width * 0.5, JSON.stringify(lage.arten));
    p('Artikelkacheln vorhanden', lage.kacheln > 0, String(lage.kacheln));

    /* Keine Überlappung, nichts über den Rand */
    const ueberlappung = await k.evaluate(() => {
      const rs = [...document.querySelectorAll('#kcAufbau > .kc-bereich')].map((e) => ({ t: e.dataset.typ, r: e.getBoundingClientRect() }));
      const ueber = [];
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i].r, b = rs[j].r;
        if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) ueber.push(rs[i].t + '×' + rs[j].t);
      }
      const raus = rs.filter(({ r }) => r.right > innerWidth + 1 || r.bottom > innerHeight + 1).map((x) => x.t);
      const kachelRaus = [...document.querySelectorAll('#kcAufbau .product-tile')].filter((t) => { const r = t.getBoundingClientRect(); const a = t.closest('.kc-bereich').getBoundingClientRect(); return r.bottom > a.bottom + 1 || r.right > a.right + 1; }).length;
      return { ueber, raus, kachelRaus };
    });
    p('Kein Bereich überlappt einen anderen', ueberlappung.ueber.length === 0, ueberlappung.ueber.join(', ') || 'keine');
    p('Kein Bereich ragt aus dem Bildschirm', ueberlappung.raus.length === 0, ueberlappung.raus.join(', ') || 'keiner');
    p('Keine Artikelkachel ragt aus ihrer Fläche', ueberlappung.kachelRaus === 0, String(ueberlappung.kachelRaus));
    if (SHOTS) await k.screenshot({ path: `${SHOTS}/kasse_${geraet}_seite1.png` });

    /* Verdrahtung: Kachel -> Bon */
    const zeilen = () => k.evaluate(() => document.querySelectorAll('#cartList > *:not(.cart-empty)').length);
    const summe = () => k.evaluate(() => String((document.querySelector('.grand-total') || {}).textContent || '').replace(/\s+/g, ' ').trim());
    const vorher = await zeilen();
    await k.evaluate(() => document.querySelector('#kcAufbau .product-tile').click());
    await k.waitForTimeout(400);
    const nachher = await zeilen();
    p('Kachel antippen legt in den Bon (im umgehängten Rahmen)', nachher === vorher + 1 && !/\b0,00/.test(await summe()), `${nachher} Position(en), ${await summe()}`);

    /* Rückgeld-Taste -> Seite 2 */
    await k.evaluate(() => document.getElementById('kcZahlenTaste').click());
    await k.waitForTimeout(400);
    const s2 = await k.evaluate(() => {
      const e = document.getElementById('kcZahlenEbene');
      const q = (sel) => { const el = document.querySelector('#kcZahlenEbene ' + sel); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
      return { offen: e && !e.hidden, scheine: q('#banknotes'), block: q('.keypad'), arten: q('#payBtn'), rueckgeld: q('.change-card'), zurueck: q('#kcZahlenZurueck') || q('#kcZahlenZurueckTaste'),
        platzhalter: [...document.querySelectorAll('#kcZahlenEbene .kc-bereich.platzhalter')].map((x) => x.dataset.typ) };
    });
    p('Rückgeld-Taste öffnet die Zahlen-Seite', s2.offen);
    p('Darauf: Scheine/Münzen, Ziffernblock, Zahlungsarten, Rückgeld-Anzeige', s2.scheine && s2.block && s2.arten && s2.rueckgeld, `Platzhalter: ${s2.platzhalter.join(', ') || 'keine'}`);
    p('Zurück-Knopf sichtbar', s2.zurueck);
    if (SHOTS) await k.screenshot({ path: `${SHOTS}/kasse_${geraet}_seite2.png` });

    /* 10 € geben, Bar kassieren -> Seite 2 schließt sich, Bon leer */
    await k.evaluate(() => { const z = [...document.querySelectorAll('#kcZahlenEbene #banknotes button')].find((x) => /50/.test(x.getAttribute('data-value') || x.textContent)); if (z) z.click(); });
    await k.waitForTimeout(300);
    const rueck = await k.evaluate(() => { const b = document.getElementById('cashChangeBtn'); const r = b.getBoundingClientRect(); return { sichtbar: r.width > 2 && r.height > 2 && !b.hidden, text: b.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) }; });
    p('BAR-Rückgeldknopf erscheint nach Geldwahl', rueck.sichtbar, rueck.text);
    await k.evaluate(() => document.getElementById('cashChangeBtn').click());
    await k.waitForTimeout(1200);
    await k.evaluate(() => { const d = document.querySelector('dialog[open]'); if (d) { const ok = [...d.querySelectorAll('button')].find((x) => /ok|schlie|fertig|weiter/i.test(x.textContent)); if (ok) ok.click(); else d.close(); } });
    await k.waitForTimeout(600);
    const danach = await k.evaluate(() => ({ zu: document.getElementById('kcZahlenEbene').hidden, zeilen: document.querySelectorAll('#cartList > *:not(.cart-empty)').length, aufbau: document.body.classList.contains('kc-aufbau'), kacheln: document.querySelectorAll('#kcAufbau .product-tile').length }));
    p('Nach dem Abschluss: Zahlen-Seite zu, Bon leer, Aufbau steht noch', danach.zu && danach.zeilen === 0 && danach.aufbau && danach.kacheln > 0, JSON.stringify(danach));

    /* Zurück auf Standard - ohne Neuladen */
    await k.evaluate(() => window.KCAufbau.zuruecksetzen());
    await k.waitForTimeout(400);
    const std = await k.evaluate(() => ({ aufbau: document.body.classList.contains('kc-aufbau'), header: (() => { const h = document.querySelector('.app-shell > header.app-header'); return !!h && h.getBoundingClientRect().height > 10; })(), grid: !!document.querySelector('.sales-area > #productGrid'), cart: !!document.querySelector('.cart-area > #cartList'), cash: !!document.querySelector('.app-shell > .bottom-layout .cash-card'), strip: !!document.querySelector('.app-shell > .mode-strip #notificationBar') }));
    p('"Standard" hängt alles zurück an die alte Stelle', !std.aufbau && std.header && std.grid && std.cart && std.cash && std.strip, JSON.stringify(std));
    await k.close();
  }


  /* ---------------------------------------------------- 3. Fließende Artikelfläche (08.09.2026)
     Betreiber: "max. 3 Kacheln nebeneinander, die nächsten darunter, Scrollbalken oder
     Scrollpfeil." Geprüft mit der Textkachel-Vorlage; die Höhe wird künstlich klein gemacht
     (1024x460), damit die 7 Speisen sicher nicht auf einmal ins Bild passen. */
  console.log('\n== Fließende Artikelfläche: max. 3 Spalten, scrollen statt blättern ==');
  {
    const d = await b.newPage({ viewport: { width: 1600, height: 1000 } });
    d.on('pageerror', (e) => fehlerListe.push('designer: ' + e.message));
    d.on('dialog', (dlg) => dlg.accept('Textkacheln'));
    await d.goto(`http://127.0.0.1:${PORT}/pc-manager/tv-designer/index.html`);
    await d.waitForFunction(() => window.KCKassenVorlagen && window.KCKassenUebergabe);
    await d.evaluate(() => { localStorage.removeItem('kc.kassenoberflaechen.v1'); const m = document.getElementById('modeSelect'); m.value = 'kasse'; m.dispatchEvent(new Event('change', { bubbles: true })); });
    await d.evaluate(() => document.querySelector('[data-vorlage="vl-wunsch-9-text"]').click());
    await d.waitForTimeout(300);
    const of = await d.evaluate(() => window.KCKassenUebergabe.uebergeben());
    const sam = await d.evaluate(() => JSON.parse(localStorage.getItem('kc.kassenoberflaechen.v1')));
    await d.close();
    const k = await b.newPage({ viewport: { width: 1024, height: 460 } });
    k.on('pageerror', (e) => fehlerListe.push('fliessend: ' + e.message));
    await k.addInitScript(() => localStorage.setItem('kc_master_v040', JSON.stringify({ registerId: 'KASSE-01', pinLockEnabled: false })));
    await k.addInitScript(() => localStorage.setItem('kc_offers_v100', '[]'));
    await k.addInitScript(([s, id]) => { localStorage.setItem('kc.kassenoberflaechen.v1', JSON.stringify(s)); localStorage.setItem('kc.kassenoberflaeche.gewaehlt.v1', id); }, [sam, of.id]);
    await k.goto(`http://127.0.0.1:${PORT}/pos/index.html`);
    await k.waitForTimeout(1800);
    await k.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /KASSE STARTEN/i.test(x.textContent)); if (b) b.click(); });
    for (let i = 0; i < 2; i++) { await k.waitForTimeout(900); await k.evaluate(() => { const ok = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'OK' && x.getBoundingClientRect().width > 0); if (ok) ok.click(); }); }
    /* auf die Warengruppe mit den meisten Artikeln wechseln */
    await k.evaluate(() => { const bs = [...document.querySelectorAll('#categories button')]; const best = bs.map((b) => ({ b, n: parseInt((b.textContent.match(/(\d+)\s*$/) || [0, 0])[1], 10) })).sort((a, c) => c.n - a.n)[0]; if (best) best.b.click(); });
    await k.waitForTimeout(500);
    const fl = await k.evaluate(() => {
      const r = document.querySelector('#kcAufbau .kc-bereich.artikel'); const g = document.getElementById('productGrid');
      const tiles = [...g.querySelectorAll('.product-tile-wrap')].map((t) => t.getBoundingClientRect());
      const zeilen = new Set(tiles.map((t) => Math.round(t.top))).size;
      const spalten = new Set(tiles.map((t) => Math.round(t.left))).size;
      const pfeil = r.querySelector('.kc-scrollpfeil'); const pr = pfeil ? pfeil.getBoundingClientRect() : null;
      const pager = r.querySelector('.pager');
      return { fliessend: r.classList.contains('fliessend'), kacheln: tiles.length, spalten, zeilen, ueberlauf: g.scrollHeight - g.clientHeight,
        pfeil: !!pfeil && !pfeil.hidden && pr.width > 0, pagerWeg: !pager || pager.getBoundingClientRect().height === 0, breite: Math.round(tiles[0] ? tiles[0].width : 0) };
    });
    p('Textkacheln fließen: höchstens 3 nebeneinander, weitere darunter', fl.fliessend && fl.spalten === 3 && fl.zeilen >= 3, `${fl.kacheln} Kacheln in ${fl.spalten} Spalten × ${fl.zeilen} Zeilen, ${fl.breite} px breit`);
    p('Keine Blätterleiste mehr, die Fläche scrollt', fl.pagerWeg && fl.ueberlauf > 0, `Überlauf ${fl.ueberlauf} px`);
    p('Scrollpfeil eingeblendet, solange unten mehr ist', fl.pfeil);
    if (SHOTS) await k.screenshot({ path: `${SHOTS}/kasse_fliessend_mit_pfeil.png` });
    await k.evaluate(() => document.querySelector('#kcAufbau .kc-scrollpfeil').click());
    await k.waitForTimeout(700);
    const nach = await k.evaluate(() => { const g = document.getElementById('productGrid'); const pf = document.querySelector('#kcAufbau .kc-scrollpfeil'); return { top: g.scrollTop, ende: g.scrollHeight - g.clientHeight - g.scrollTop <= 8, pfeil: !pf.hidden }; });
    p('Tipp auf den Pfeil scrollt weiter', nach.top > 0, `scrollTop ${nach.top}`);
    await k.evaluate(() => { const g = document.getElementById('productGrid'); g.scrollTop = g.scrollHeight; });
    await k.waitForTimeout(300);
    p('Am Ende verschwindet der Pfeil', await k.evaluate(() => document.querySelector('#kcAufbau .kc-scrollpfeil').hidden));
    await k.evaluate(() => { const t = document.querySelector('#kcAufbau .product-tile'); t.click(); });
    await k.waitForTimeout(300);
    p('Kachel in der fließenden Fläche legt in den Bon', await k.evaluate(() => document.querySelectorAll('#cartList > *:not(.cart-empty)').length) === 1);
    await k.close();
  }


  /* ---------------------------------------------------- 4. Zahlen-Seite v5 + Parken (08.09.2026) */
  console.log('\n== Zahlen-Seite v5 und Parken ==');
  {
    const d = await b.newPage({ viewport: { width: 1600, height: 1000 } });
    d.on('dialog', (dlg) => dlg.accept('Köcheclub'));
    await d.goto(`http://127.0.0.1:${PORT}/pc-manager/tv-designer/index.html`);
    await d.waitForFunction(() => window.KCKassenVorlagen && window.KCKassenUebergabe);
    await d.evaluate(() => { localStorage.removeItem('kc.kassenoberflaechen.v1'); const m = document.getElementById('modeSelect'); m.value = 'kasse'; m.dispatchEvent(new Event('change', { bubbles: true })); });
    await d.evaluate(() => document.querySelector('[data-vorlage="vl-koecheclub-9"]').click());
    await d.waitForTimeout(300);
    const of = await d.evaluate(() => window.KCKassenUebergabe.uebergeben());
    const sam = await d.evaluate(() => JSON.parse(localStorage.getItem('kc.kassenoberflaechen.v1')));
    await d.close();
    const k = await b.newPage({ viewport: { width: 1024, height: 768 } });
    k.on('pageerror', (e) => fehlerListe.push('v5/parken: ' + e.message));
    k.on('dialog', (dlg) => dlg.accept());
    await k.addInitScript(() => localStorage.setItem('kc_master_v040', JSON.stringify({ registerId: 'KASSE-01', pinLockEnabled: false })));
    await k.addInitScript(() => localStorage.setItem('kc_offers_v100', '[]'));
    await k.addInitScript(([s, id]) => { localStorage.setItem('kc.kassenoberflaechen.v1', JSON.stringify(s)); localStorage.setItem('kc.kassenoberflaeche.gewaehlt.v1', id); localStorage.removeItem('kc.geparkte-bons.v1'); }, [sam, of.id]);
    await k.goto(`http://127.0.0.1:${PORT}/pos/index.html`);
    await k.waitForTimeout(1800);
    await k.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /KASSE STARTEN/i.test(x.textContent)); if (b) b.click(); });
    for (let i = 0; i < 2; i++) { await k.waitForTimeout(900); await k.evaluate(() => { const ok = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'OK' && x.getBoundingClientRect().width > 0); if (ok) ok.click(); }); }
    const zeilen = () => k.evaluate(() => document.querySelectorAll('#cartList > *:not(.cart-empty)').length);
    await k.evaluate(() => { [...document.querySelectorAll('#kcAufbau .product-tile')].slice(0, 2).forEach((t) => t.click()); });
    await k.waitForTimeout(300);
    /* Parken */
    const p0 = await k.evaluate(() => { const k = document.getElementById('kcParkBtn'); return k ? { da: true, rot: k.classList.contains('mit-bons'), inKopf: !!k.closest('.cart-title') } : { da: false }; });
    p('P-Knopf sitzt in der Bon-Kopfzeile, blau (nichts geparkt)', p0.da && !p0.rot && p0.inKopf);
    await k.evaluate(() => document.getElementById('kcParkBtn').click());
    await k.waitForTimeout(400);
    const p1 = await k.evaluate(() => ({ zeilen: document.querySelectorAll('#cartList > *:not(.cart-empty)').length, rot: document.getElementById('kcParkBtn').classList.contains('mit-bons'), zahl: document.querySelector('#kcParkBtn .kc-park-zahl').textContent, gespeichert: JSON.parse(localStorage.getItem('kc.geparkte-bons.v1') || '[]').length }));
    p('Parken leert den Warenkorb, P wird rot mit Zahl 1, im Speicher', p1.zeilen === 0 && p1.rot && p1.zahl === '1' && p1.gespeichert === 1, JSON.stringify(p1));
    await k.evaluate(() => { [...document.querySelectorAll('#kcAufbau .product-tile')].slice(2, 3).forEach((t) => t.click()); });
    await k.waitForTimeout(200);
    await k.evaluate(() => document.getElementById('kcParkBtn').click());
    await k.waitForTimeout(300);
    p('Zweiter Bon geparkt: Zahl 2', await k.evaluate(() => document.querySelector('#kcParkBtn .kc-park-zahl').textContent) === '2');
    await k.evaluate(() => document.getElementById('kcParkBtn').click());   /* leerer Korb -> Seite öffnen */
    await k.waitForTimeout(300);
    const ps = await k.evaluate(() => { const e = document.getElementById('kcParkEbene'); return { offen: e && !e.hidden, karten: document.querySelectorAll('#kcParkEbene .kc-park-karte').length }; });
    p('Park-Seite zeigt beide Bons', ps.offen && ps.karten === 2, `${ps.karten} Karten`);
    if (SHOTS) await k.screenshot({ path: `${SHOTS}/parken_seite.png` });
    await k.evaluate(() => document.querySelector('#kcParkEbene .kc-park-holen').click());
    await k.waitForTimeout(400);
    const ph = await k.evaluate(() => ({ zu: document.getElementById('kcParkEbene').hidden, zeilen: document.querySelectorAll('#cartList > *:not(.cart-empty)').length, zahl: document.querySelector('#kcParkBtn .kc-park-zahl').textContent }));
    p('HOLEN bringt den ersten Bon zurück, Seite zu, Zahl 1', ph.zu && ph.zeilen === 2 && ph.zahl === '1', JSON.stringify(ph));
    if (SHOTS) await k.screenshot({ path: `${SHOTS}/kasse_mit_park.png` });
    /* Zahlen-Seite v5 */
    await k.evaluate(() => document.getElementById('kcZahlenTaste').click());
    await k.waitForTimeout(400);
    const v5 = await k.evaluate(() => {
      const noten = [...document.querySelectorAll('#kcZahlenEbene #banknotes button')].sort((a, c) => (a.getBoundingClientRect().top - c.getBoundingClientRect().top) || (a.getBoundingClientRect().left - c.getBoundingClientRect().left)).map((x) => x.dataset.value);
      const m = document.querySelector('#kcZahlenEbene #coins button'); const bild = m.querySelector('.coin-visual, .coin-foto, img'); const txt = [...m.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim()) || m.querySelector('span:not(.coin-visual):not(.coin-foto)');
      const kp = document.querySelector('#kcZahlenEbene .kc-bereich.block').getBoundingClientRect(); const ko = document.querySelector('#kcZahlenEbene .kc-bereich.korrektur').getBoundingClientRect(); const bon = document.querySelector('#kcZahlenEbene .kc-bereich.beleg').getBoundingClientRect();
      const r = m.getBoundingClientRect(); const br = bild ? bild.getBoundingClientRect() : r;
      return { noten, muenzeWertUnten: br.bottom <= r.bottom && br.top < r.top + r.height / 2, keypadLinks: kp.x < 10, korrekturHoehe: Math.abs(ko.height - kp.height) < 3 && Math.abs(ko.top - kp.top) < 3, bonBreite: Math.round(bon.width), s200: !!document.querySelector('#kcZahlenEbene #banknotes button[data-value="200"]') };
    });
    p('Scheine zweireihig: 50·100·200 oben, 5·10·20 unten', v5.noten.join(',') === '50,100,200,5,10,20', v5.noten.join(','));
    p('200-Euro-Schein vorhanden', v5.s200);
    p('Münzbild oben, Wert darunter', v5.muenzeWertUnten);
    p('Ziffernblock am linken Rand, Zurück/Löschen gleich hoch daneben', v5.keypadLinks && v5.korrekturHoehe);
    p('Bon rückt auf halbe Breite nach links', v5.bonBreite >= 480, `${v5.bonBreite} px`);
    await k.evaluate(() => { const z = [...document.querySelectorAll('#kcZahlenEbene #banknotes button')].find((x) => x.dataset.value === '50'); z.click(); });
    await k.waitForTimeout(300);
    if (SHOTS) await k.screenshot({ path: `${SHOTS}/zahlen_v5.png` });
    await k.evaluate(() => document.getElementById('undoCashBtn').click());
    await k.waitForTimeout(200);
    const ug = await k.evaluate(() => ({ given: document.getElementById('givenDisplay').textContent, sel: state.cashSelections.length, dis: document.getElementById('undoCashBtn').disabled, gate: !!document.querySelector('.fullscreen-gate:not([hidden])'), inKorr: !!document.querySelector('#kcZahlenEbene .kc-bereich.korrektur #undoCashBtn') }));
    p('ZURÜCK nimmt den Schein wieder weg', /^0,00/.test(ug.given) && ug.sel === 0, JSON.stringify(ug));
    await k.close();
  }


  /* ---------------------------------------------------- 5. Linkshänder: Spiegeln im Aufbau */
  console.log('\n== Spiegeln (Ansicht ändern) ==');
  {
    const k = await b.newPage({ viewport: { width: 1024, height: 768 } });
    k.on('pageerror', (e) => fehlerListe.push('spiegel: ' + e.message));
    await k.addInitScript(() => localStorage.setItem('kc_master_v040', JSON.stringify({ registerId: 'KASSE-01', pinLockEnabled: false })));
    await k.addInitScript(() => { localStorage.setItem('kc_offers_v100', '[]'); localStorage.setItem('kc.kassenoberflaeche.gewaehlt.v1', 'vorlage-vl-koecheclub-9'); localStorage.removeItem('kc_spiegel_modus_v1'); });
    await k.goto(`http://127.0.0.1:${PORT}/pos/index.html`);
    await k.waitForTimeout(2200);
    await k.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /KASSE STARTEN/i.test(x.textContent)); if (b) b.click(); });
    for (let i = 0; i < 2; i++) { await k.waitForTimeout(900); await k.evaluate(() => { const ok = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'OK' && x.getBoundingClientRect().width > 0); if (ok) ok.click(); }); }
    const lage = () => k.evaluate(() => ({ bon: Math.round(document.querySelector('#kcAufbau .kc-bereich.bon').getBoundingClientRect().x), artikel: Math.round(document.querySelector('#kcAufbau .kc-bereich.artikel').getBoundingClientRect().x), kacheln: document.querySelectorAll('#kcAufbau .product-tile').length, spiegel: document.body.classList.contains('kc-spiegel-modus') }));
    const vor = await lage();
    p('Normal: Artikel links, Bon rechts', vor.artikel < vor.bon, JSON.stringify(vor));
    await k.evaluate(() => document.body.classList.add('kc-spiegel-modus'));
    await k.waitForTimeout(500);
    const nach = await lage();
    p('Gespiegelt: Bon links, Artikel rechts, Kacheln noch da', nach.spiegel && nach.bon < nach.artikel && nach.kacheln > 0, JSON.stringify(nach));
    await k.evaluate(() => document.querySelector('#kcAufbau .product-tile').click());
    await k.waitForTimeout(300);
    p('Kachel im gespiegelten Aufbau legt in den Bon', await k.evaluate(() => document.querySelectorAll('#cartList > *:not(.cart-empty)').length) === 1);
    if (SHOTS) await k.screenshot({ path: `${SHOTS}/kasse_gespiegelt.png` });
    await k.evaluate(() => document.body.classList.remove('kc-spiegel-modus'));
    await k.waitForTimeout(400);
    const zur = await lage();
    p('Zurück auf Normal', !zur.spiegel && zur.artikel < zur.bon);
    await k.close();
  }


  /* ---------------------------------------------------- 6. Geheimweg + PIN, Happy-Hour-LED */
  console.log('\n== Geheimweg zu den Kassenfunktionen ==');
  {
    const k = await b.newPage({ viewport: { width: 1024, height: 768 } });
    k.on('pageerror', (e) => fehlerListe.push('geheim: ' + e.message));
    await k.addInitScript(() => localStorage.setItem('kc_master_v040', JSON.stringify({ registerId: 'KASSE-01', pinLockEnabled: false })));
    await k.addInitScript(() => { localStorage.setItem('kc_offers_v100', '[]'); localStorage.setItem('kc.kassenoberflaeche.gewaehlt.v1', 'vorlage-vl-koecheclub-9'); localStorage.removeItem('kc.kassenfunktionen.pin.v1'); });
    await k.goto(`http://127.0.0.1:${PORT}/pos/index.html`);
    await k.waitForTimeout(2200);
    await k.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /KASSE STARTEN/i.test(x.textContent)); if (b) b.click(); });
    for (let i = 0; i < 2; i++) { await k.waitForTimeout(900); await k.evaluate(() => { const ok = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'OK' && x.getBoundingClientRect().width > 0); if (ok) ok.click(); }); }
    const sichtbarImMehr = () => k.evaluate(() => { const d = document.getElementById('moreDialog'); d.showModal(); const r = [...d.querySelectorAll('.more-grid > button')].filter((b) => getComputedStyle(b).display !== 'none').map((b) => b.dataset.action); d.close(); return r; });
    const vorher = await sichtbarImMehr();
    p('Mehr-Fenster ohne PIN: Gutschein & Co. da, Tagesabschluss & Co. weg', vorher.includes('gutschein') && vorher.includes('currency') && !vorher.includes('closing') && !vorher.includes('opening') && !vorher.includes('withdraw'), vorher.join(','));
    p('Happy-Hour-Anzeige in der Statuszeile', await k.evaluate(() => !!document.querySelector('.kc-statuszeile > #happyHourQuickBtn')));
    /* 6 Sekunden Warenkorb halten */
    const sym = await k.$('.cart-title .cart-heading-icon');
    const box = await sym.boundingBox();
    await k.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await k.mouse.down();
    await k.waitForTimeout(2000);
    p('Nach 2 s noch keine PIN-Abfrage', await k.evaluate(() => !document.getElementById('kcPinEbene') || document.getElementById('kcPinEbene').hidden));
    await k.waitForTimeout(4300); await k.mouse.up();
    p('Nach 6 s: PIN-Abfrage (erstes Mal: neue PIN festlegen)', await k.evaluate(() => { const e = document.getElementById('kcPinEbene'); return e && !e.hidden && /Neue PIN/.test(e.querySelector('.kc-pin-titel').textContent); }));
    if (SHOTS) await k.screenshot({ path: `${SHOTS}/pin_abfrage.png` });
    const tippe = async (ziffern) => { for (const z of ziffern) { await k.evaluate((z) => document.querySelector(`#kcPinEbene button[data-pin="${z}"]`).click(), z); await k.waitForTimeout(60); } };
    await tippe('2468'); await tippe('2468'); await k.waitForTimeout(300);
    const nachher = await k.evaluate(() => { const e = document.getElementById('kcFunktionenEbene'); const r = e ? [...e.querySelectorAll('button[data-funk]')].map((b) => b.dataset.funk) : []; return { offen: !!e && !e.hidden, r, pin: !!localStorage.getItem('kc.kassenfunktionen.pin.v1'), frei: document.body.classList.contains('kc-kassenfunktionen-offen') }; });
    p('PIN gesetzt, Seite „Kassenfunktionen" offen mit Tagesabschluss & Co.', nachher.pin && nachher.frei && nachher.offen && nachher.r.includes('closing') && nachher.r.includes('opening'), nachher.r.join(','));
    if (SHOTS) await k.screenshot({ path: `${SHOTS}/kassenfunktionen_seite.png` });
    await k.evaluate(() => document.querySelector('#kcFunktionenEbene button[data-funk="closing"]').click());
    await k.waitForTimeout(500);
    p('Taste „Tagesabschluss" öffnet das Abschluss-Fenster', await k.evaluate(() => document.getElementById('closingDialog').open && document.getElementById('kcFunktionenEbene').hidden));
    await k.evaluate(() => document.getElementById('closingDialog').close());
    /* falsche PIN beim nächsten Mal */
    await k.evaluate(() => { document.body.classList.remove('kc-kassenfunktionen-offen'); window.KCAufbau.pinSeite(true); });
    await tippe('1111'); await k.waitForTimeout(200);
    p('Falsche PIN öffnet nichts', await k.evaluate(() => !document.body.classList.contains('kc-kassenfunktionen-offen') && document.getElementById('kcFunktionenEbene').hidden));
    await k.evaluate(() => window.KCAufbau.pinSeite(false));
    await k.close();
  }


  /* ---------------------------------------------------- 7. Sammelbestellung (08.09.2026) */
  console.log('\n== Sammelbestellung ==');
  {
    const k = await b.newPage({ viewport: { width: 1024, height: 768 } });
    k.on('pageerror', (e) => fehlerListe.push('sammel: ' + e.message));
    await k.addInitScript(() => localStorage.setItem('kc_master_v040', JSON.stringify({ registerId: 'KASSE-01', pinLockEnabled: false })));
    await k.addInitScript(() => { localStorage.setItem('kc_offers_v100', '[]'); localStorage.setItem('kc.kassenoberflaeche.gewaehlt.v1', 'vorlage-vl-koecheclub-9'); });
    await k.goto(`http://127.0.0.1:${PORT}/pos/index.html`);
    await k.waitForTimeout(2200);
    await k.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /KASSE STARTEN/i.test(x.textContent)); if (b) b.click(); });
    for (let i = 0; i < 2; i++) { await k.waitForTimeout(900); await k.evaluate(() => { const ok = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'OK' && x.getBoundingClientRect().width > 0); if (ok) ok.click(); }); }
    await k.evaluate(() => document.querySelector('.cart-title .cart-heading-icon').click());
    await k.waitForTimeout(400);
    const s0 = await k.evaluate(() => { const e = document.getElementById('kcSammelEbene'); return { offen: e && !e.hidden, gruppen: e.querySelectorAll('button[data-sammel-gruppe]').length, karten: e.querySelectorAll('[data-sammel-key]').length, breite: Math.round(e.getBoundingClientRect().width) }; });
    p('Tipp auf den Warenkorb öffnet die Sammelbestellung über die ganze Breite', s0.offen && s0.breite >= 1020 && s0.gruppen >= 4 && s0.karten > 0, JSON.stringify(s0));
    /* Glühwein rot hat Varianten -> Variantenkarten; 2x "Schuss Rum", 1x Feuerzangenbowle */
    await k.evaluate(() => { const g = document.querySelector('#kcSammelEbene button[data-sammel-gruppe="Getränke"]'); if (g) g.click(); });
    await k.waitForTimeout(200);
    const varianten = await k.evaluate(() => document.querySelectorAll('#kcSammelEbene [data-sammel-key^="grot|"]').length);
    p('Artikel mit Varianten zeigt jede Variante als eigene Karte', varianten >= 3, `${varianten} Varianten für Glühwein rot`);
    await k.evaluate(() => { document.querySelector('#kcSammelEbene [data-sammel-key="grot|rum"]').click(); });
    await k.waitForTimeout(100);
    await k.evaluate(() => { document.querySelector('#kcSammelEbene [data-sammel-key="grot|rum"]').click(); });
    await k.waitForTimeout(100);
    await k.evaluate(() => { document.querySelector('#kcSammelEbene [data-sammel-key="feuer|"]').click(); });
    await k.waitForTimeout(200);
    const s1 = await k.evaluate(() => ({ rum: (document.querySelector('#kcSammelEbene [data-sammel-key="grot|rum"] .kc-sammel-anzahl') || {}).textContent, gewaehlt: new Set([...document.querySelectorAll('#kcSammelEbene .kc-sammel-karte.gewaehlt')].map((e) => e.dataset.sammelKey)).size, stand: document.querySelector('.kc-sammel-stand').textContent }));
    p('Zweimal antippen = 2×, Markierung sichtbar', s1.rum === '2×' && s1.gewaehlt === 2 && /3 Artikel/.test(s1.stand), JSON.stringify(s1));
    /* Minus nimmt einen weg */
    await k.evaluate(() => document.querySelector('#kcSammelEbene button[data-sammel-minus="grot|rum"]').click());
    await k.waitForTimeout(150);
    p('− nimmt einen weg (1×)', await k.evaluate(() => (document.querySelector('#kcSammelEbene [data-sammel-key="grot|rum"] .kc-sammel-anzahl') || {}).textContent) === '1×');
    /* Zurück: Auswahl bleibt */
    await k.evaluate(() => document.querySelector('#kcSammelEbene button[data-sammel="zurueck"]').click());
    await k.waitForTimeout(150);
    await k.evaluate(() => document.querySelector('.cart-title .cart-heading-icon').click());
    await k.waitForTimeout(200);
    p('← Zurück schließt, Auswahl bleibt beim Wiederöffnen', await k.evaluate(() => new Set([...document.querySelectorAll('#kcSammelEbene .kc-sammel-karte.gewaehlt')].map((e) => e.dataset.sammelKey)).size) === 2);
    if (SHOTS) await k.screenshot({ path: `${SHOTS}/sammelbestellung.png` });
    /* Übernehmen */
    await k.evaluate(() => document.querySelector('#kcSammelEbene button[data-sammel="uebernehmen"]').click());
    await k.waitForTimeout(500);
    const s2 = await k.evaluate(() => ({ zu: document.getElementById('kcSammelEbene').hidden, zeilen: document.querySelectorAll('#cartList > .cart-row').length, cart: state.cart.map((x) => `${x.qty}×${x.name}${x.option ? '+' + x.option.name : ''}`) }));
    p('ALLE ÜBERNEHMEN: Glühwein rot mit Rum + Feuerzangenbowle im Bon, Seite zu', s2.zu && s2.zeilen === 2 && s2.cart.some((c) => /Rum/.test(c)), JSON.stringify(s2.cart));
    /* Abbruch verwirft */
    await k.evaluate(() => document.querySelector('.cart-title .cart-heading-icon').click());
    await k.waitForTimeout(200);
    await k.evaluate(() => { document.querySelector('#kcSammelEbene [data-sammel-key="feuer|"]').click(); });
    await k.evaluate(() => document.querySelector('#kcSammelEbene button[data-sammel="abbruch"]').click());
    await k.waitForTimeout(200);
    await k.evaluate(() => document.querySelector('.cart-title .cart-heading-icon').click());
    await k.waitForTimeout(200);
    p('ABBRUCH verwirft die Auswahl', await k.evaluate(() => document.querySelectorAll('#kcSammelEbene .kc-sammel-karte.gewaehlt').length) === 0);
    await k.evaluate(() => window.KCAufbau.sammelSeite(false));
    /* P grau ohne Bon, Rabatt grau; Sammel + RÜCKGELD */
    await k.evaluate(() => { document.getElementById('voidBonBtn').click(); }); await k.waitForTimeout(300); await k.evaluate(() => { const c = document.getElementById('confirmAction'); if (c) c.click(); }); await k.waitForTimeout(300);
    p('Leerer Bon: P grau, Rabatt ausgegraut', await k.evaluate(() => document.getElementById('kcParkBtn').classList.contains('leer') && getComputedStyle(document.querySelector('.cart-discount-button')).pointerEvents === 'none'));
    await k.evaluate(() => document.querySelector('.cart-title .cart-heading-icon').click()); await k.waitForTimeout(200);
    await k.evaluate(() => { document.querySelector('#kcSammelEbene [data-sammel-key="feuer|"]').click(); }); await k.waitForTimeout(100);
    await k.evaluate(() => document.querySelector('#kcSammelEbene button[data-sammel="rueckgeld"]').click()); await k.waitForTimeout(500);
    p('ÜBERNEHMEN + RÜCKGELD: Artikel im Bon und Zahlen-Seite offen', await k.evaluate(() => document.querySelectorAll('#cartList > .cart-row').length === 1 && !document.getElementById('kcZahlenEbene').hidden && !document.getElementById('kcParkBtn').classList.contains('leer')));
    await k.evaluate(() => document.getElementById('kcZahlenZurueckTaste').click()); await k.waitForTimeout(200);
    p('Vorgabe: Sauerkrauteintopf + Mettwurst als halbe Portion freigegeben', await k.evaluate(() => { const p = PRODUCTS.find((x) => x.id === 'sauerkrautmett'); return !!(p && p.halfAllowed && p.halfPrice > 0); }));
    /* BAR-Taste zeigt den Betrag */
    p('BAR-Taste zeigt den Betrag', await k.evaluate(() => /BAR .*€/.test(document.querySelector('#payBtn .pay-label').dataset.kcBetrag)), await k.evaluate(() => document.querySelector('#payBtn .pay-label').dataset.kcBetrag));
    await k.close();
  }

  /* ------------------------------------- 8. Laufpfeile GESAMT-Zeile (09.09.2026, Nachbau) */
  console.log('\n== Laufpfeile: eigenes Feld zwischen Wort und Betrag, ohne Überlappung ==');
  {
    const k = await b.newPage({ viewport: { width: 1024, height: 768 } });
    k.on('pageerror', (e) => fehlerListe.push('pfeile: ' + e.message));
    k.on('dialog', (dlg) => dlg.accept());
    await k.addInitScript(() => localStorage.setItem('kc_master_v040', JSON.stringify({ registerId: 'KASSE-01', pinLockEnabled: false })));
    await k.addInitScript(() => { localStorage.setItem('kc_offers_v100', '[]'); localStorage.setItem('kc.kassenoberflaeche.gewaehlt.v1', 'vorlage-vl-koecheclub-9'); });
    await k.goto(`http://127.0.0.1:${PORT}/pos/index.html`);
    await k.waitForTimeout(2200);
    await k.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /KASSE STARTEN/i.test(x.textContent)); if (b) b.click(); });
    for (let i = 0; i < 2; i++) { await k.waitForTimeout(900); await k.evaluate(() => { const ok = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'OK' && x.getBoundingClientRect().width > 0); if (ok) ok.click(); }); }
    const lage = async () => k.evaluate(() => {
      const gt = document.querySelector('.kc-bereich.bon .grand-total'); const lab = gt.querySelector('.grand-total-label'); const wert = gt.querySelector('strong'); const feld = gt.querySelector('.kc-pfeilfeld');
      const l = lab.getBoundingClientRect(), w = wert.getBoundingClientRect(), f = feld ? feld.getBoundingClientRect() : null;
      return { anzahl: feld ? feld.querySelectorAll('span').length : 0, pfeil: feld && feld.querySelector('span') ? feld.querySelector('span').textContent : null,
        ueberlapptLabel: f ? f.x < l.x + l.width - 1 : false, ueberlapptWert: f ? f.x + f.width > w.x + 1 : false,
        vertikalMitte: f ? Math.abs((f.y + f.height / 2) - (gt.getBoundingClientRect().y + gt.getBoundingClientRect().height / 2)) < 3 : true };
    });
    await k.evaluate(() => document.querySelector('#kcAufbau .product-tile').click()); await k.waitForTimeout(300);
    const normal = await lage();
    p('Pfeile laufen in einer echten Lücke, nicht über „GESAMT" oder dem Betrag', !normal.ueberlapptLabel && !normal.ueberlapptWert, JSON.stringify(normal));
    p('3-4 Pfeile im Normalfall, nach links (Einnahme), senkrecht mittig', normal.anzahl >= 3 && normal.pfeil === '◀' && normal.vertikalMitte, JSON.stringify(normal));
    /* Training an + sehr großer Betrag: enger Platz, Anzahl darf sinken, aber nie überlappen */
    await k.evaluate(() => document.getElementById('trainingModeTopBtn').click()); await k.waitForTimeout(400);
    await k.evaluate(() => { state.cart[0].qty = 400; renderCart(); }); await k.waitForTimeout(400);
    const eng = await lage();
    p('Bei wenig Platz (Training + 4-stelliger Betrag): weniger Pfeile, aber weiter keine Überlappung', !eng.ueberlapptLabel && !eng.ueberlapptWert && eng.anzahl <= normal.anzahl, JSON.stringify(eng));
    if (SHOTS) await k.screenshot({ path: `${SHOTS}/pfeile_training_eng.png`, clip: (await k.evaluate(() => { const r = document.querySelector('.kc-bereich.bon .grand-total').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })) });
    await k.evaluate(() => document.getElementById('trainingModeTopBtn').click()); await k.waitForTimeout(300);
    /* Auszahlung: Richtung dreht, weiterhin keine Überlappung */
    await k.evaluate(() => document.getElementById('voidBonBtn').click()); await k.waitForTimeout(200);
    await k.evaluate(() => { const c = document.getElementById('confirmAction'); if (c) c.click(); }); await k.waitForTimeout(300);
    await k.evaluate(() => document.getElementById('depositBtn').click()); await k.waitForTimeout(300);
    await k.evaluate(() => { const t = [...document.querySelectorAll('#kcAufbau .product-tile')].find((x) => /rückgabe/i.test(x.textContent)); if (t) t.click(); }); await k.waitForTimeout(400);
    const aus = await lage();
    p('Auszahlung: Pfeile drehen auf „nach rechts", keine Überlappung', aus.pfeil === '▶' && !aus.ueberlapptLabel && !aus.ueberlapptWert, JSON.stringify(aus));
    /* Trainingsknopf: Doktorhut statt Wortlaut, LED/Farbe unverändert */
    const knopf = await k.evaluate(() => { const b = document.getElementById('trainingModeTopBtn'); const t = b.querySelector('span:last-child');
      return { textVerborgen: parseFloat(getComputedStyle(t).fontSize) === 0, textFuerVorlesen: t.textContent.trim(), hutSichtbar: getComputedStyle(t, '::before').content.includes('🎓'),
        vorLED: !!b.querySelector('.mode-led'), breiteWieDieAnderen: Math.round(b.getBoundingClientRect().width) === Math.round(document.getElementById('rushModeBtn').getBoundingClientRect().width) }; });
    p('Trainings-Taste: Wortlaut visuell durch Doktorhut ersetzt (Text bleibt für Vorleseprogramme), LED da, gleiche Breite wie die anderen',
      knopf.textVerborgen && knopf.hutSichtbar && knopf.textFuerVorlesen === 'Trainingsmodus' && knopf.vorLED && knopf.breiteWieDieAnderen, JSON.stringify(knopf));
    await k.close();
  }

  /* ---------------------------- 9. Sammelbestellung: Ansichten, i-Ecke, Kollaps (09.09.2026) */
  console.log('\n== Sammelbestellung: Bild/Farbe/Text, i-Ecke, Ein-/Ausklappen ==');
  {
    const k = await b.newPage({ viewport: { width: 1024, height: 768 } });
    k.on('pageerror', (e) => fehlerListe.push('sammel-ansicht: ' + e.message));
    k.on('dialog', (dlg) => dlg.accept());
    await k.addInitScript(() => localStorage.setItem('kc_master_v040', JSON.stringify({ registerId: 'KASSE-01', pinLockEnabled: false })));
    await k.addInitScript(() => { localStorage.setItem('kc_offers_v100', '[]'); localStorage.setItem('kc.kassenoberflaeche.gewaehlt.v1', 'vorlage-vl-koecheclub-9'); localStorage.removeItem('kc.sammel.ansicht.v1'); });
    await k.goto(`http://127.0.0.1:${PORT}/pos/index.html`);
    await k.waitForTimeout(2200);
    await k.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /KASSE STARTEN/i.test(x.textContent)); if (b) b.click(); });
    for (let i = 0; i < 2; i++) { await k.waitForTimeout(900); await k.evaluate(() => { const ok = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'OK' && x.getBoundingClientRect().width > 0); if (ok) ok.click(); }); }
    await k.evaluate(() => document.querySelector('.cart-title .cart-heading-icon').click());
    await k.waitForTimeout(400);
    const start = await k.evaluate(() => ({ offen: !document.getElementById('kcSammelEbene').hidden, alteLeiste: document.body.classList.contains('kc-cart-expanded') }));
    p('Kurzer Tipp öffnet NUR die Sammelbestellung (nicht zusätzlich die alte "Warenkorb erweitern"-Leiste von app.js)', start.offen && !start.alteLeiste, JSON.stringify(start));
    const info = () => k.evaluate(() => ({ karten: document.querySelectorAll('.kc-sammel-karte').length, infoEcken: document.querySelectorAll('.kc-sammel-info').length }));
    const bild = await info(); p('Ansicht „Bild": jede Karte hat die i-Ecke', bild.karten > 0 && bild.karten === bild.infoEcken, JSON.stringify(bild));
    await k.evaluate(() => document.querySelector('button[data-sammel-ansicht="farbe"]').click()); await k.waitForTimeout(250);
    const farbe = await info();
    /* Glühwein rot hat immer Varianten (kein Wortlaut ohne Schuss-Wahl) - deshalb zwei
       verschiedene PRODUKTE vergleichen: eigene Artikelfarbe je Produkt, nicht überall dieselbe. */
    const kontrast = await k.evaluate(() => {
      const rot = [...document.querySelectorAll('.kc-sammel-karte.variante')].find((c) => c.dataset.sammelKey.startsWith('grot|'));
      const weiss = [...document.querySelectorAll('.kc-sammel-karte.variante')].find((c) => c.dataset.sammelKey.startsWith('gweiss|'));
      return { rot: rot ? getComputedStyle(rot).backgroundColor : null, weiss: weiss ? getComputedStyle(weiss).backgroundColor : null,
        unterschiedlich: rot && weiss ? getComputedStyle(rot).backgroundColor !== getComputedStyle(weiss).backgroundColor : false };
    });
    p('Ansicht „Farbe": i-Ecke bleibt, jedes Produkt (auch Varianten) in seiner EIGENEN Artikelfarbe', farbe.karten === farbe.infoEcken && kontrast.unterschiedlich, JSON.stringify({ farbe, kontrast }));
    await k.evaluate(() => document.querySelector('button[data-sammel-ansicht="text"]').click()); await k.waitForTimeout(250);
    const text = await info();
    const neutral = await k.evaluate(() => getComputedStyle(document.querySelector('.kc-sammel-karte')).backgroundColor);
    p('Ansicht „Text": i-Ecke bleibt, kein Bild, neutrale helle Fläche', text.karten === text.infoEcken && /255, 255, 255/.test(neutral), JSON.stringify({ text, neutral }));
    p('Gewählte Ansicht bleibt gemerkt (localStorage)', await k.evaluate(() => localStorage.getItem('kc.sammel.ansicht.v1')) === 'text');
    /* Ein-/Ausklappen: seitlich schrumpfen statt Jalousie, keine Überlappung während der Animation */
    await k.evaluate(() => document.querySelector('button[data-sammel-ansicht="bild"]').click()); await k.waitForTimeout(250);
    await k.evaluate(() => document.querySelector('[data-sammel-abschnitt="Speisen"]').scrollIntoView({ block: 'start' }));
    const vorher = await k.evaluate(() => document.querySelectorAll('[data-sammel-abschnitt="Speisen"] .kc-sammel-karte').length);
    await k.evaluate(() => document.querySelector('h3[data-sammel-kopf="Speisen"]').click());
    await k.waitForTimeout(110);
    const mitte = await k.evaluate(() => { const karten = [...document.querySelectorAll('[data-sammel-abschnitt="Speisen"] .kc-sammel-karte')]; return { amSchrumpfen: karten.every((k) => k.classList.contains('kc-schrumpfen')), schmaler: karten.every((k) => k.getBoundingClientRect().width < 140) }; });
    p('Beim Zuklappen schrumpfen die Karten seitlich (nicht als Jalousie untereinander)', mitte.amSchrumpfen && mitte.schmaler, JSON.stringify(mitte));
    await k.waitForTimeout(300);
    /* "zugeklappt" heißt: der Kartenbereich ist wirklich unsichtbar (display:none per CSS-Regel
       .zu > .kc-sammel-karten) - die Karten bleiben dabei im DOM (zählen also weiter bei
       querySelectorAll), das ist beabsichtigt und kein Fehler. Deshalb hier über die
       tatsächliche Sichtbarkeit prüfen, nicht über die Anzahl gefundener Elemente. */
    const nachZu = await k.evaluate(() => { const ab = document.querySelector('[data-sammel-abschnitt="Speisen"]'); const karten = ab.querySelector('.kc-sammel-karten'); return { zu: ab.classList.contains('zu'), unsichtbar: getComputedStyle(karten).display === 'none' }; });
    p('Danach ist der Abschnitt wirklich zugeklappt (Kartenbereich unsichtbar)', nachZu.zu && nachZu.unsichtbar, JSON.stringify(nachZu));
    await k.evaluate(() => document.querySelector('h3[data-sammel-kopf="Speisen"]').click());
    await k.waitForTimeout(450);
    const nachAuf = await k.evaluate(() => document.querySelectorAll('[data-sammel-abschnitt="Speisen"] .kc-sammel-karte').length);
    p('Wieder aufgeklappt: dieselbe Artikelzahl wie vorher', nachAuf === vorher, `${vorher} -> ${nachAuf}`);
    if (SHOTS) await k.screenshot({ path: `${SHOTS}/sammel_ansichten_final.png` });
    await k.evaluate(() => window.KCAufbau.sammelSeite(false));
    await k.close();
  }

  p('Keine Skriptfehler über den ganzen Lauf', fehlerListe.length === 0, fehlerListe.slice(0, 3).join(' | ') || 'keine');
  await b.close(); srv.close();
  console.log(`\nAufbau Kasse: ${n - fehler}/${n} bestanden`);
  process.exit(fehler ? 1 : 0);
})();
