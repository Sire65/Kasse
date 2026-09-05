/* Der Kassenbaukasten im Designer - im echten Browser, mit echter Maus.
 *
 * ANLASS 02.09.2026 (Betreiber): Baukasten im Designer, Gerätewahl oben, Bibliothek wechselt
 * auf Kassenoberfläche, nur erlaubte Bausteine je Seite, zweite Seite mit den Zahlfunktionen,
 * clevere Objekte, Textfeld zum freien Beschriften - und: "Alle Objekte müssen sich durch
 * Zieh- und Schiebe-Anfasser kleiner/größer ziehen lassen und auch komplett verschieben
 * lassen. Und in der Objektbibliothek müssen auch schon fertige Blöcke liegen wie
 * Warengruppen-Blöcke, Warenkorb-Blöcke, Tastenblöcke, Rückgeld-Blöcke klein und groß."
 *
 * Warum mit echter Maus statt mit Funktionsaufrufen: Das Ziehen war nachweislich kaputt,
 * OHNE dass ein Fehler erschien - mein eigenes CSS (overflow:hidden) hatte die Anfasser
 * abgeschnitten. Ein Test, der nur Funktionen aufruft, hätte das nie gesehen. Deshalb hier
 * echte pointerdown/move/up-Wege über die Maus des Browsers.
 */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const WURZEL = process.env.KC_WURZEL || path.resolve(__dirname, '..');
const PORT = 8804;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.kctv': 'application/json', '.txt': 'text/plain' };

let ok = 0; const fehler = [];
const p = (name, bedingung, detail = '') => {
  if (bedingung) { ok++; console.log(`  OK    ${name}${detail ? '   [' + detail + ']' : ''}`); }
  else { fehler.push(name); console.log(`  FEHLER ${name}${detail ? '   [' + detail + ']' : ''}`); }
};

(async () => {
  const web = http.createServer((q, r) => {
    const f = path.join(WURZEL, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(f, (e, d) => {
      if (e) { r.writeHead(404); return r.end('x'); }
      r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' });
      r.end(d);
    });
  });
  await new Promise((r) => web.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1720, height: 1060 } });
  const pg = await ctx.newPage();
  const skriptfehler = [];
  pg.on('pageerror', (e) => skriptfehler.push(e.message.slice(0, 140)));
  pg.on('dialog', (d) => d.accept());

  await pg.goto(`http://127.0.0.1:${PORT}/pc-manager/tv-designer/index.html`);
  await pg.waitForTimeout(4000);

  // ---------------------------------------------------------------- Modus und Fläche
  console.log('== Arbeitsmodus und Gerätewahl ==');
  p('Der Designer bringt den Baukasten mit', await pg.evaluate(() => Boolean(window.KCKassenbaukasten)));
  const modi = await pg.evaluate(() => [...document.querySelectorAll('#modeSelect option')].map((o) => o.value));
  p('Der Arbeitsmodus „Kassenoberfläche“ steht in der Combobox', modi.includes('kasse'), modi.join(', '));
  await pg.evaluate(() => { const m = document.getElementById('modeSelect'); m.value = 'kasse'; m.dispatchEvent(new Event('change', { bubbles: true })); });
  await pg.waitForTimeout(800);
  const geraete = await pg.evaluate(() => ({
    sichtbar: !document.getElementById('kcGeraetHuelle')?.hidden,
    liste: [...document.querySelectorAll('#kcGeraetWahl option')].map((o) => o.textContent),
    flaeche: `${project.page.width}×${project.page.height}`,
    raster: Boolean(document.querySelector('.kc-raster')),
  }));
  p('Die Gerätewahl erscheint nur in diesem Modus', geraete.sichtbar);
  p('Beide iPad-Größen stehen zur Wahl', geraete.liste.length >= 4, geraete.liste.join(' · '));
  p('Die Fläche stellt sich auf echte Gerätemaße', /^\d{3,4}×\d{3,4}$/.test(geraete.flaeche), geraete.flaeche);
  p('Das Bereichsraster ist sichtbar', geraete.raster);

  await pg.click('#kcNeuerAufbau');
  await pg.waitForTimeout(1100);
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '100%'); if (b) b.click(); });
  await pg.waitForTimeout(500);

  // ---------------------------------------------------------------- Seiten
  console.log('\n== Die zwei Seiten ==');
  const seiten = await pg.evaluate(() => project.slides.map((s) => ({ name: s.name, art: s.kcSeite, teile: (s.items || []).length })));
  p('Es gibt genau zwei Seiten', seiten.length === 2, seiten.map((s) => s.name).join(' · '));
  p('Die zweite Seite ist die Zahlen-Seite', seiten[1]?.art === 'zahlen');
  p('Die Zahlen-Seite ist nicht leer', (seiten[1]?.teile || 0) >= 4, `${seiten[1]?.teile} Bausteine`);

  // ---------------------------------------------------------------- Bibliothek
  console.log('\n== Objektbibliothek ==');
  const bib = await pg.evaluate(() => [...document.querySelectorAll('#toolbox .toolGroup')].filter((g) => !g.hidden)
    .map((g) => ({ titel: g.querySelector('h3').textContent, n: [...g.querySelectorAll('.tool')].filter((x) => !x.hidden).length })));
  p('Die Baugruppen stehen ganz oben', /Baugruppen/.test(bib[0]?.titel || ''), bib.map((x) => x.titel).join(' · '));
  p('Es gibt mehrere fertige Baugruppen', (bib[0]?.n || 0) >= 6, `${bib[0]?.n} Stück`);
  const frei = await pg.evaluate(() => [...document.querySelectorAll('#toolbox .tool')].filter((x) => !x.hidden).map((x) => x.dataset.type));
  p('Ein freies Textfeld ist dabei', frei.includes('text'));
  p('Eine freie Fläche zum Aufziehen ist dabei', frei.includes('rounded-rectangle'));
  /* GEÄNDERT 03.09.2026: Hier stand "auf der Kassenseite wird kein Ziffernblock angeboten".
     Die Behauptung war falsch - die laufende Kasse hat einen Ziffernblock samt Reiterzeile auf
     der Hauptseite (.keypad, 255 x 197, gemessen am 03.09.). Die Prüfung hat also eine Regel
     bewacht, die es in der Kasse gar nicht gibt. Jetzt wird geprüft, was wirklich gilt:
     Der Ziffernblock ist auf beiden Seiten erlaubt, Scheine und Münzen nur auf der Zahlseite. */
  p('Der Ziffernblock ist auch auf der Kassenseite erlaubt – wie in der echten Kasse',
    frei.includes('kc-zahlen-block'));
  p('Scheine und Münzen gehören nur auf die Zahlen-Seite', !frei.includes('kc-zahlen-scheine'));

  await pg.evaluate(() => { const k = [...document.querySelectorAll('.slideCard')]; if (k[1]) k[1].click(); });
  await pg.waitForTimeout(800);
  const aufZahl = await pg.evaluate(() => [...document.querySelectorAll('#toolbox .tool')].filter((x) => !x.hidden).map((x) => x.dataset.type));
  p('Auf der Zahlen-Seite gibt es den Ziffernblock', aufZahl.includes('kc-zahlen-block'));
  p('Auf der Zahlen-Seite gibt es keine Artikelkacheln', !aufZahl.some((t) => t.startsWith('kc-artikel')));
  p('Der Rückgeld-Block groß wird nur hier angeboten', aufZahl.includes('bg-rueckgeld-gross'));

  // ---------------------------------------------------------------- Baugruppen
  console.log('\n== Fertige Baugruppen ==');
  await pg.evaluate(() => { const k = [...document.querySelectorAll('.slideCard')]; if (k[0]) k[0].click(); });
  await pg.waitForTimeout(700);
  await pg.evaluate(() => { currentSlide().items = []; render(); addItem('bg-warenkorb-klein', 0, 0); });
  await pg.waitForTimeout(800);
  const bg = await pg.evaluate(() => currentItems().map((i) => ({ typ: i.type, sp: i.kc.spalte, z: i.kc.zeile, g: i.groupId, id: i.id })));
  p('Eine Baugruppe setzt mehrere Bausteine auf einmal', bg.length >= 2, `${bg.length} Bausteine`);
  p('Die Teile einer Baugruppe sind zusammengebunden', new Set(bg.map((x) => x.g)).size === 1 && bg[0].g);
  p('Die Teile stehen an unterschiedlichen Plätzen', new Set(bg.map((x) => `${x.sp}/${x.z}`)).size === bg.length);

  // ---------------------------------------------------------------- Schieben (echte Maus)
  console.log('\n== Schieben und Ziehen mit der Maus ==');
  const vorZug = bg.map((x) => ({ sp: x.sp, z: x.z }));
  let kasten = await pg.evaluate((id) => { const r = document.querySelector(`[data-id="${id}"]`).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 25 }; }, bg[0].id);
  await pg.mouse.move(kasten.x, kasten.y); await pg.mouse.down();
  await pg.mouse.move(kasten.x + 260, kasten.y + 90, { steps: 14 }); await pg.mouse.up();
  await pg.waitForTimeout(800);
  const nachZug = await pg.evaluate(() => currentItems().map((i) => ({ sp: i.kc.spalte, z: i.kc.zeile })));
  const dSp = nachZug.map((n, i) => n.sp - vorZug[i].sp), dZ = nachZug.map((n, i) => n.z - vorZug[i].z);
  p('Ein Baustein lässt sich mit der Maus verschieben', dSp[0] !== 0 || dZ[0] !== 0, `${dSp[0]} Spalten, ${dZ[0]} Zeilen`);
  p('Die ganze Baugruppe wandert gleich weit mit',
    new Set(dSp).size === 1 && new Set(dZ).size === 1, `Spalten ${dSp.join('/')}, Zeilen ${dZ.join('/')}`);
  p('Verschobenes rastet ins Bereichsraster ein',
    await pg.evaluate(() => currentItems().every((i) => Number.isInteger(i.kc.spalte) && Number.isInteger(i.kc.zeile))));

  // ---------------------------------------------------------------- Größe an den Anfassern
  const vorGroesse = await pg.evaluate(() => { const i = currentItems()[0]; return { spalten: i.kc.spalten, id: i.id }; });
  const griff = await pg.evaluate((id) => {
    const h = document.querySelector(`[data-id="${id}"] .resize-handle.e`);
    if (!h) return null;
    const r = h.getBoundingClientRect();
    const obenauf = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, erreichbar: obenauf === h };
  }, vorGroesse.id);
  p('Der Anfasser am rechten Rand ist da', Boolean(griff));
  /* Diese Prüfung ist der Kern: Der Anfasser war schon einmal VORHANDEN, aber von meinem
     eigenen CSS abgeschnitten und damit nicht anklickbar. Sichtbar allein genügt nicht. */
  p('Der Anfasser ist auch wirklich anklickbar, nicht überdeckt oder abgeschnitten', griff?.erreichbar);
  if (griff) {
    await pg.mouse.move(griff.x, griff.y); await pg.mouse.down();
    await pg.mouse.move(griff.x + 130, griff.y, { steps: 12 }); await pg.mouse.up();
    await pg.waitForTimeout(800);
  }
  const nachGroesse = await pg.evaluate(() => currentItems()[0].kc.spalten);
  p('Ziehen am Anfasser macht den Baustein breiter',
    nachGroesse > vorGroesse.spalten, `${vorGroesse.spalten} → ${nachGroesse} Spalten`);

  // ---------------------------------------------------------------- Verhalten
  console.log('\n== Verhalten der Bausteine ==');
  await pg.evaluate(() => { selected = currentItems()[0].id; render(); });
  await pg.waitForTimeout(500);
  p('Das Verhaltensfeld erscheint bei ausgewähltem Baustein',
    await pg.evaluate(() => !document.getElementById('kcCleverPanel')?.hidden));
  await pg.evaluate(() => {
    ['kcKlappbar', 'kcDrehen', 'kcZoom'].forEach((n) => {
      const k = document.querySelector(`[data-kc-clever="${n}"]`);
      if (k) { k.checked = true; k.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  });
  await pg.waitForTimeout(600);
  const verhalten = await pg.evaluate(() => window.KCKassenbaukasten.aufbauAlsText().seiten[0].bausteine[0]);
  p('Einklappbar wird gespeichert', verhalten.klappbar === true);
  p('Wegdrehen wird gespeichert', verhalten.drehen === true);
  p('Beim Antippen vergrößern wird gespeichert', verhalten.zoom === true);

  // ---------------------------------------------------------------- Gerätewechsel
  console.log('\n== Derselbe Aufbau auf einer anderen Größe ==');
  const vorher = await pg.evaluate(() => JSON.stringify(window.KCKassenbaukasten.aufbauAlsText().seiten[0].bausteine));
  await pg.evaluate(() => { const g = document.getElementById('kcGeraetWahl'); g.value = 'ipad-gross-quer'; g.dispatchEvent(new Event('change', { bubbles: true })); });
  await pg.waitForTimeout(800);
  const nachher = await pg.evaluate(() => ({
    aufbau: JSON.stringify(window.KCKassenbaukasten.aufbauAlsText().seiten[0].bausteine),
    flaeche: `${project.page.width}×${project.page.height}`,
    breiter: currentItems()[0].w,
  }));
  p('Die Fläche wechselt auf das andere Gerät', nachher.flaeche === '1366×1024', nachher.flaeche);
  /* DAS ist der Zweck des ganzen Rasters: Der Aufbau bleibt, die Pixel wachsen mit. */
  p('Der Aufbau bleibt in Rasterangaben unverändert', nachher.aufbau === vorher);
  p('Die Bausteine werden dabei in Pixeln größer', nachher.breiter > 0, `${nachher.breiter} px`);

  /* ================================================================= Teil 2
   * ANLASS 02.09.2026 (Betreiber): "Rechte Maustaste auf jedem Einzelteil und kontextsensitives
   * Menü mit Größe, Verschieben, Duplizieren, Farbe ändern, Beschriftung ändern, Rahmenstärke,
   * Krümmung einstellen ... und eine Button-Bibliothek für die kleinen Buttons wie Tür, Uhr,
   * LED-Blöcke ... eine Icon-Bibliothek, damit man das Icon auf einen Button ziehen kann ...
   * und eine Rastereinstellung von ohne, fein, grob."
   *
   * Gemessen wird am Ergebnis auf dem Bildschirm, nicht am Quelltext: Die Krümmung wird als
   * berechneter border-radius abgelesen, der Rahmen als berechnete Rahmenstärke. Der Rechtsklick
   * geht über die echte Maus - genau daran ist es zuerst gescheitert (siehe unten). */
  console.log('\n== Knopf-Bibliothek aus der echten Kasse ==');
  p('Teil 2 ist geladen', await pg.evaluate(() => Boolean(window.KCKassenteile)),
    await pg.evaluate(() => window.KCKassenteile?.version || '-'));

  const knoepfe = await pg.evaluate(() => {
    const flach = [];
    window.KCKassenteile.KNOEPFE.forEach(([gruppe, liste]) =>
      liste.forEach(([typ, text, meta]) => flach.push({ gruppe, typ, text, echt: meta.echt, mass: meta.mass })));
    return flach;
  });
  p('Die Knopf-Bibliothek ist gefüllt', knoepfe.length >= 30, `${knoepfe.length} Knöpfe`);
  /* Der Sinn der Inventur: Jeder Knopf im Baukasten zeigt auf ein Teil, das es in der Kasse
     wirklich gibt. Ein Knopf ohne echte Entsprechung wäre eine Erfindung. */
  p('Jeder Knopf nennt sein echtes Gegenstück in der Kasse',
    knoepfe.every((k) => k.echt && /^[#.]/.test(k.echt)));
  p('Jeder Knopf bringt sein echtes Maß mit',
    knoepfe.every((k) => /^\d+×\d+$/.test(k.mass || '')));
  const suche = (s) => knoepfe.find((k) => k.echt === s);
  p('Tür / Programm verlassen ist dabei', Boolean(suche('#headerExitBtn')), suche('#headerExitBtn')?.mass);
  p('Uhr / Zeiterfassung ist dabei', Boolean(suche('#timeClockBtn')), suche('#timeClockBtn')?.mass);
  p('Der LED-Block ist dabei', Boolean(suche('#kcLedBlock')), suche('#kcLedBlock')?.mass);
  const kopfGruppe = knoepfe.filter((k) => /Kopfzeile/.test(k.gruppe));
  p('Die Kopfzeilen-Knöpfe stehen als eigene Gruppe zur Wahl', kopfGruppe.length >= 8, `${kopfGruppe.length} Stück`);
  const bibTitel = await pg.evaluate(() => [...document.querySelectorAll('#toolbox .toolGroup')]
    .filter((g) => !g.hidden).map((g) => g.querySelector('h3').textContent));
  p('Die Knopf-Gruppen erscheinen wirklich in der Bibliothek',
    bibTitel.some((t) => /Kopfzeile/.test(t)) && bibTitel.some((t) => /Symbole/.test(t)), bibTitel.join(' · '));

  /* --------------------------------------------------------------- Geplante Bauteile
   * ANLASS 03.09.2026 (Betreiber): "Bon parken" - vorerst nur als Bauteil im Baukasten,
   * damit sich im Layout ansehen lässt, wo die Taste hin soll. An der Kasse selbst nichts.
   *
   * Worauf es hier ankommt: Geplantes darf sich NICHT unter die abgelesenen Teile mischen.
   * Alles in der Inventur trägt eine echte Kennung aus der laufenden Kasse; ein geplantes
   * Teil hat keine. Stünden beide in einem Topf, wüsste nach ein paar Wochen niemand mehr,
   * was gebaut ist und was gewünscht - dieselbe Vermischung, die diese Woche schon zweimal
   * die Ursache eines Fehlers war. */
  console.log('\n== Geplante Bauteile, getrennt von der Inventur ==');
  const geplant = await pg.evaluate(() => window.KCKassenteile.GEPLANT.map(([t, b, m]) => ({ t, b, m })));
  p('Es gibt geplante Bauteile', geplant.length >= 2, geplant.map((g) => g.b).join(' · '));
  p('„Bon parken“ ist als Taste vorgesehen', geplant.some((g) => g.t === 'pl-parken'));
  p('Der Streifen der geparkten Bons ist vorgesehen', geplant.some((g) => g.t === 'pl-parkstreifen'));
  p('Jedes geplante Teil sagt, wozu es da ist',
    geplant.every((g) => (g.m.zweck || '').length > 30));
  /* Die Trennung selbst - der eigentliche Zweck dieses Abschnitts. */
  p('Kein geplantes Teil steht in der Inventur der echten Bauteile',
    !knoepfe.some((k) => String(k.typ || '').startsWith('pl-') || /⧗/.test(k.text || '')));
  p('Kein geplantes Teil täuscht eine Kennung aus der Kasse vor',
    geplant.every((g) => !g.m.echt));
  const geplantBib = await pg.evaluate(() => {
    const g = [...document.querySelectorAll('#toolbox .toolGroup')]
      .find((x) => /^Geplant/.test(x.querySelector('h3')?.textContent || ''));
    return g ? { titel: g.querySelector('h3').textContent,
      teile: [...g.querySelectorAll('.tool')].map((b) => b.textContent),
      hinweis: g.querySelector('.tool')?.title || '' } : null;
  });
  p('Geplantes steht in einer eigenen Gruppe der Bibliothek', Boolean(geplantBib),
    geplantBib?.titel);
  p('Schon der Name der Gruppe sagt es', /noch nicht in der Kasse/.test(geplantBib?.titel || ''));
  p('Jedes geplante Teil ist mit ⧗ gekennzeichnet',
    (geplantBib?.teile || []).every((t) => /⧗/.test(t)));
  p('Der Hinweis am Teil warnt ebenfalls', /GEPLANT/.test(geplantBib?.hinweis || ''),
    (geplantBib?.hinweis || '').slice(0, 54));

  // Und auf der Fläche: gestrichelt statt durchgezogen.
  await pg.evaluate(() => { currentSlide().items = []; render(); addItem('pl-parken', 0, 0); });
  await pg.waitForTimeout(600);
  const aufFlaeche = await pg.evaluate(() => {
    const i = currentItems()[0];
    const el = document.querySelector(`[data-id="${i.id}"]`);
    return { typ: i.type, stil: getComputedStyle(el).outlineStyle, farbe: getComputedStyle(el).outlineColor };
  });
  /* Wer einen Aufbau ausdruckt und herumzeigt, soll nicht erklären müssen, was es davon
     schon gibt - deshalb wird der Unterschied am Bildschirm gemessen, nicht im Datensatz. */
  p('Ein geplantes Teil ist auch auf der Fläche als solches zu erkennen',
    aufFlaeche.stil === 'dashed', `${aufFlaeche.stil}, ${aufFlaeche.farbe}`);

  console.log('\n== Symbol-Bibliothek ==');
  const symbole = await pg.evaluate(() => window.KCKassenteile.SYMBOLE.length);
  p('Es gibt reichlich Symbole zur Auswahl', symbole >= 24, `${symbole} Symbole`);
  p('Die Symbole sind in der Bibliothek anklickbar',
    await pg.evaluate(() => [...document.querySelectorAll('#toolbox .tool[data-type^="sym-"]')].filter((x) => !x.hidden).length >= 24));

  // Einen Knopf einsetzen und ein Symbol darauf ziehen - echtes drop-Ereignis.
  await pg.evaluate(() => { currentSlide().items = []; render(); addItem('kn-tuer', 0, 0); });
  await pg.waitForTimeout(600);
  const knopfDa = await pg.evaluate(() => currentItems()[0] || null);
  p('Ein Knopf aus der Bibliothek landet auf der Fläche', knopfDa?.type === 'kn-tuer');
  const ziel = await pg.evaluate((id) => {
    const r = document.querySelector(`[data-id="${id}"]`).getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  }, knopfDa.id);
  await pg.evaluate(({ x, y }) => {
    const dt = new DataTransfer(); dt.setData('text/plain', 'sym-🔒');
    document.getElementById('stage').dispatchEvent(
      new DragEvent('drop', { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt }));
  }, ziel);
  await pg.waitForTimeout(500);
  const nachSymbol = await pg.evaluate(() => currentItems()[0]);
  /* Wichtig: Das Symbol darf KEINEN neuen Baustein erzeugen, sondern muss den vorhandenen
     Knopf beschriften. Sonst hätte man nach drei Symbolen drei Kästen statt drei Aufschriften. */
  p('Ein Symbol beschriftet den Knopf, statt einen neuen Baustein zu erzeugen',
    (await pg.evaluate(() => currentItems().length)) === 1);
  p('Das gezogene Symbol steht auf dem Knopf', nachSymbol.kcSymbol === '🔒' && /^🔒/.test(nachSymbol.text || ''),
    nachSymbol.text);

  console.log('\n== Rastereinstellung ohne / grob / normal / fein ==');
  const stufen = await pg.evaluate(() => [...document.querySelectorAll('#kcRasterWahl option')].map((o) => o.value));
  p('Die Rasterwahl steht neben der Gerätewahl', stufen.length >= 3, stufen.join(' · '));
  p('Ohne, grob und fein sind wählbar',
    ['ohne', 'grob', 'fein'].every((s) => stufen.includes(s)));
  const stufeSetzen = async (wert) => {
    await pg.evaluate((w) => { const s = document.getElementById('kcRasterWahl'); s.value = w; s.dispatchEvent(new Event('change', { bubbles: true })); }, wert);
    await pg.waitForTimeout(500);
    return pg.evaluate(() => {
      const r = window.KCKassenbaukasten.raster();
      const netz = document.querySelector('.kc-raster');
      return { ...r, netzVersteckt: !netz || netz.hidden || getComputedStyle(netz).display === 'none' };
    });
  };
  const fein = await stufeSetzen('fein');
  p('„fein“ macht das Raster feiner', fein.spalten === 24 && fein.zeilen === 16, `${fein.spalten} × ${fein.zeilen}`);
  const grob = await stufeSetzen('grob');
  p('„grob“ macht das Raster gröber', grob.spalten === 6 && grob.zeilen === 4, `${grob.spalten} × ${grob.zeilen}`);
  const ohne = await stufeSetzen('ohne');
  p('„ohne“ blendet das Netz aus und lässt frei bauen', ohne.netzVersteckt, ohne.stufe);
  const normal = await stufeSetzen('normal');
  p('Zurück auf „normal“ gilt wieder 12 × 8', normal.spalten === 12 && normal.zeilen === 8);

  console.log('\n== Rechtsklick-Menü auf einem Einzelteil ==');
  const stelle = await pg.evaluate(() => {
    const r = document.querySelector('.designer-item').getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  /* Mit der ECHTEN rechten Maustaste. Beim Bauen ging das Menü nie auf, ohne jede Meldung:
     Der Designer hat ein eigenes Rechtsklick-Menü an der Fläche, das vorher läuft und dabei
     neu zeichnet. Ein Test, der nur menueZeigen() aufruft, hätte grün gemeldet. */
  await pg.mouse.click(stelle.x, stelle.y, { button: 'right' });
  await pg.waitForTimeout(500);
  const menue = await pg.evaluate(() => {
    const m = document.getElementById('kcKontextMenue');
    if (!m || m.hidden) return { offen: false };
    return {
      offen: true,
      kopf: m.querySelector('.kc-kontext-kopf')?.textContent.replace(/\s+/g, ' ').trim(),
      felder: [...m.querySelectorAll('[data-kc]')].map((e) => e.dataset.kc),
      aktionen: [...m.querySelectorAll('[data-kc-tun]')].map((e) => e.dataset.kcTun),
      pfeile: m.querySelectorAll('[data-kc-move]').length,
    };
  });
  p('Die rechte Maustaste öffnet das Menü am Einzelteil', menue.offen);
  p('Das Menü nennt das echte Gegenstück in der Kasse', /#headerExitBtn/.test(menue.kopf || ''), menue.kopf);
  for (const [name, feld] of [['Größe', 'spalten'], ['Größe (Zeilen)', 'zeilen'], ['Verschieben', 'spalte'],
    ['Farbe ändern', 'bg'], ['Rahmenstärke', 'strokeWidth'], ['Krümmung der Ecken', 'radius'],
    ['Beschriftung ändern', 'text']]) {
    p(`Das Menü hat „${name}“`, (menue.felder || []).includes(feld));
  }
  p('Verschieben geht auch mit den vier Pfeilen', (menue.pfeile || 0) === 4);
  p('Duplizieren steht im Menü', (menue.aktionen || []).includes('duplizieren'));

  // Die Einstellungen wirken - am Bildschirm gemessen, nicht im Datensatz.
  const stellen = async (feld, wert) => {
    await pg.evaluate(({ f, w }) => {
      const e = document.querySelector(`#kcKontextMenue [data-kc="${f}"]`);
      e.value = w; e.dispatchEvent(new Event('input', { bubbles: true }));
    }, { f: feld, w: wert });
    await pg.waitForTimeout(350);
  };
  await stellen('radius', '30');
  await stellen('strokeWidth', '5');
  await stellen('text', 'Programm verlassen');
  await stellen('bg', '#c0392b');
  const gemessen = await pg.evaluate(() => {
    const i = currentItems()[0];
    const el = document.querySelector(`[data-id="${i.id}"]`);
    const s = getComputedStyle(el);
    return { radius: parseFloat(s.borderTopLeftRadius), rahmen: parseFloat(s.borderTopWidth),
      text: i.text, bg: i.bg };
  });
  p('Die eingestellte Krümmung ist am Baustein zu sehen', gemessen.radius >= 25, `${gemessen.radius} px`);
  p('Die eingestellte Rahmenstärke ist am Baustein zu sehen', gemessen.rahmen >= 4, `${gemessen.rahmen} px`);
  p('Die geänderte Beschriftung steht am Baustein', gemessen.text === 'Programm verlassen', gemessen.text);
  p('Die geänderte Farbe wird übernommen', gemessen.bg === '#c0392b', gemessen.bg);

  /* Größe und Verschieben im Menü. Diese vier Felder sahen richtig aus und taten NICHTS:
     Ich hatte nach dem Setzen den gespeicherten Pixelstand geleert, und das Raster liest ein
     leeres Feld als "die Maus hat es bewegt" und rechnet den Rasterplatz aus den ALTEN Pixeln
     zurück. Der eingestellte Wert war im selben Atemzug wieder weg, ohne Meldung. Deshalb wird
     hier nicht nur der Datensatz, sondern die Breite am Bildschirm nachgemessen. */
  const vorMenue = await pg.evaluate(() => {
    const i = currentItems()[0];
    return { spalten: i.kc.spalten, spalte: i.kc.spalte, breite: i.w };
  });
  await stellen('spalten', String(vorMenue.spalten + 3));
  const nachBreite = await pg.evaluate(() => {
    const i = currentItems()[0];
    const r = document.querySelector(`[data-id="${i.id}"]`).getBoundingClientRect();
    return { spalten: i.kc.spalten, px: i.w, sichtbar: Math.round(r.width) };
  });
  p('„Größe“ im Menü macht den Baustein wirklich breiter',
    nachBreite.spalten === vorMenue.spalten + 3, `${vorMenue.spalten} → ${nachBreite.spalten} Spalten`);
  p('Die neue Breite steht auch in Pixeln auf der Fläche',
    nachBreite.px > vorMenue.breite && nachBreite.sichtbar > 0, `${vorMenue.breite} → ${nachBreite.px} px`);
  await pg.evaluate(() => document.querySelector('#kcKontextMenue [data-kc-move="1,0"]').click());
  await pg.waitForTimeout(400);
  p('Der Pfeil nach rechts schiebt um genau eine Spalte',
    (await pg.evaluate(() => currentItems()[0].kc.spalte)) === vorMenue.spalte + 1);

  await pg.evaluate(() => document.querySelector('#kcKontextMenue [data-kc-tun="duplizieren"]').click());
  await pg.waitForTimeout(500);
  const nachDup = await pg.evaluate(() => currentItems().map((i) => ({ sp: i.kc.spalte, g: i.groupId })));
  p('Duplizieren legt eine zweite Kopie an', nachDup.length === 2);
  p('Die Kopie steht daneben, nicht übereinander', nachDup[0].sp !== nachDup[1].sp,
    nachDup.map((x) => `Sp ${x.sp + 1}`).join(' / '));

  await pg.mouse.click(stelle.x, stelle.y, { button: 'right' });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => document.querySelector('#kcKontextMenue [data-kc-tun="loeschen"]').click());
  await pg.waitForTimeout(400);
  p('Löschen entfernt genau ein Teil', (await pg.evaluate(() => currentItems().length)) === 1);

  /* ================================================================= Teil 3
   * ANLASS 02.09.2026 (Betreiber): "Bauteile müssen sich zu Baugruppen zusammenfassen lassen,
   * also gruppieren."
   *
   * Zwei Dinge gehören dazu: mehrere Bauteile zu einer Einheit binden (und wieder lösen), und
   * diese Einheit unter eigenem Namen in die Bibliothek legen, damit man sie beim nächsten
   * Aufbau wieder herausziehen kann. Beides wird hier am Ergebnis gemessen: Das Zusammenfassen
   * daran, dass sich die Teile gemeinsam schieben; das Speichern daran, dass die eigene
   * Baugruppe an anderer Stelle mit denselben Abständen wieder erscheint. */
  console.log('\n== Bauteile zu einer Baugruppe zusammenfassen ==');
  p('Teil 3 ist geladen', await pg.evaluate(() => Boolean(window.KCKassenGruppen)),
    await pg.evaluate(() => window.KCKassenGruppen?.version || '-'));

  await pg.evaluate(() => {
    localStorage.removeItem('kc.kassenbaukasten.baugruppen.v1');
    currentSlide().items = []; render();
    const K = window.KCKassenbaukasten;
    /* Bewusst zwei richtige Kassenbausteine und dazwischen ein Knopf: Die Bausteine tragen
       im Kassenmodus einen eigenen Bereichsumriss, der die Auswahlmarkierung überdecken
       kann - genau der Fall, den die Prüfung unten misst. */
    K.einsetzen('kc-kopf-voll', 0, 0, [4, 1]);
    K.einsetzen('kn-uhr', 5, 0, [1, 1]);
    K.einsetzen('kc-gruppen-leiste', 0, 2, [4, 1]);
    render();
  });
  await pg.waitForTimeout(600);
  /* Gibt es das Bauteil nicht, wird ein Punkt neben der Fläche zurückgegeben statt zu
     stürzen: Eine gestürzte Prüfung nennt keine Stelle, eine rote Zeile schon. */
  const mitte = async (n) => pg.evaluate((k) => {
    const e = document.querySelectorAll('.designer-item')[k];
    if (!e) return { x: 5, y: 5 };
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  }, n);
  const eins = await mitte(0), drei = await mitte(2);
  await pg.mouse.click(eins.x, eins.y);
  await pg.waitForTimeout(200);
  await pg.keyboard.down('Shift');
  await pg.mouse.click(drei.x, drei.y);
  await pg.keyboard.up('Shift');
  await pg.waitForTimeout(400);
  const mehrfach = await pg.evaluate(() => ({
    anzahl: window.KCKassenGruppen.auswahl().length,
    markiert: [...document.querySelectorAll('.designer-item.multi-selected')].length,
    umriss: (() => {
      const e = document.querySelector('.designer-item.multi-selected[data-type^="kc-"]');
      if (!e) return '';
      const s = getComputedStyle(e);
      return `${s.outlineColor} ${s.outlineWidth} Abstand ${s.outlineOffset}`;
    })(),
  }));
  p('Umschalt-Klick wählt mehrere Bauteile aus', mehrfach.anzahl === 2, `${mehrfach.anzahl} ausgewählt`);
  /* Gemessen wird an einem KASSENBAUSTEIN, nicht an einem Knopf. Die Bausteine tragen im
     Kassenmodus einen farbigen Bereichsumriss mit derselben Gewichtung wie die
     Auswahlmarkierung aus styles.css - ohne eigene Regel gewinnt die zuletzt geladene Datei,
     und die Auswahl ist an genau den Teilen nicht mehr zu erkennen, um die es beim Bauen
     hauptsächlich geht. */
  p('Die Mehrfachauswahl ist auch zu sehen',
    mehrfach.markiert === 2 && /139/.test(mehrfach.umriss) && /3px Abstand 2px/.test(mehrfach.umriss),
    mehrfach.umriss);

  await pg.mouse.click(drei.x, drei.y, { button: 'right' });
  await pg.waitForTimeout(500);
  const gruppenBlock = await pg.evaluate(() => {
    const m = document.getElementById('kcKontextMenue');
    return {
      da: Boolean(m.querySelector('.kc-kontext-gruppe')),
      knoepfe: [...m.querySelectorAll('[data-kc-gruppe]')].map((b) => `${b.textContent}${b.disabled ? ' (aus)' : ''}`),
      namensfeld: Boolean(m.querySelector('[data-kc-gruppe-name]')),
    };
  });
  p('Das Rechtsklick-Menü bietet „Gruppieren“ an', gruppenBlock.da, gruppenBlock.knoepfe.join(' · '));
  p('„Gruppe lösen“ ist ohne Gruppe ausgegraut',
    (gruppenBlock.knoepfe.find((k) => /lösen/.test(k)) || '').includes('(aus)'));
  p('Ein Namensfeld für die eigene Baugruppe ist da', gruppenBlock.namensfeld);

  await pg.evaluate(() => document.querySelector('[data-kc-gruppe="binden"]').click());
  await pg.waitForTimeout(500);
  const nachBinden = await pg.evaluate(() => currentItems().map((i) => ({ t: i.type, g: i.groupId || null })));
  p('Zwei Bauteile werden zu einer Baugruppe zusammengefasst',
    nachBinden[0].g && nachBinden[0].g === nachBinden[2].g);
  p('Das nicht ausgewählte Bauteil bleibt ungebunden', nachBinden[1].g === null);

  const vorSchub = await pg.evaluate(() => currentItems().map((i) => ({ sp: i.kc.spalte, z: i.kc.zeile })));
  const griffPunkt = await mitte(0);
  await pg.mouse.move(griffPunkt.x, griffPunkt.y); await pg.mouse.down();
  await pg.mouse.move(griffPunkt.x + 220, griffPunkt.y + 150, { steps: 12 }); await pg.mouse.up();
  await pg.waitForTimeout(600);
  const nachSchub = await pg.evaluate(() => currentItems().map((i) => ({ sp: i.kc.spalte, z: i.kc.zeile })));
  const weg = (n) => `${nachSchub[n].sp - vorSchub[n].sp}/${nachSchub[n].z - vorSchub[n].z}`;
  /* Das ist der eigentliche Zweck des Gruppierens - und der einzige Weg, es zu prüfen: nicht
     ob ein Kennzeichen gesetzt ist, sondern ob sich die Teile gemeinsam bewegen. */
  p('Die zusammengefassten Bauteile schieben sich gemeinsam',
    weg(0) === weg(2) && weg(0) !== '0/0', `${weg(0)} und ${weg(2)} Felder`);
  p('Das ungebundene Bauteil bleibt liegen', weg(1) === '0/0');

  /* NACH DEM RECHTSKLICK darf nichts mehr an der Maus kleben.
     GEFUNDEN 02.09.2026: Das Menü öffnet sich unter dem Zeiger; das Loslassen der rechten
     Taste landete deshalb auf dem Menü und nicht auf der Fläche. Der Designer beendet das
     Ziehen aber nur beim Loslassen auf der Fläche - er blieb im Zustand "wird gezogen".
     Danach genügte es, die Maus über die Fläche zu bewegen, ohne gedrückte Taste, und die
     Bauteile wanderten mit, teils mit einem Sprung auf veraltete Startwerte.
     EHRLICHERWEISE: Aufgefallen ist das oben an „schieben sich gemeinsam“ - das ist die
     Prüfung, die den Fehler tatsächlich fängt. Die beiden Zeilen hier sprechen die Regel
     dahinter direkt aus, damit sie beim nächsten Umbau nicht wieder verlorengeht. */
  await pg.mouse.click((await mitte(1)).x, (await mitte(1)).y, { button: 'right' });
  await pg.waitForTimeout(400);
  /* Über einen Knopf im Menü hinausgehen, wie man es beim Arbeiten tut - dabei landet auch
     dieses Loslassen auf dem Menü und nicht auf der Fläche. */
  await pg.click('#kcKontextMenue [data-kc-tun="vorn"]');
  await pg.waitForTimeout(300);
  const nochAmZiehen = await pg.evaluate(() => (typeof drag !== 'undefined' && drag) ? 'ja' : 'nein');
  p('Der Designer bleibt nach dem Menü nicht im Zustand „wird gezogen“', nochAmZiehen === 'nein', nochAmZiehen);
  const ruheVor = await pg.evaluate(() => currentItems().map((i) => `${i.x}/${i.y}`).join(' '));
  await pg.mouse.move(400, 300, { steps: 8 });
  await pg.mouse.move(760, 560, { steps: 8 });
  await pg.waitForTimeout(400);
  const ruheNach = await pg.evaluate(() => currentItems().map((i) => `${i.x}/${i.y}`).join(' '));
  p('Nach dem Rechtsklick klebt nichts an der Maus', ruheVor === ruheNach,
    ruheVor === ruheNach ? 'alles liegt still' : `${ruheVor}  ->  ${ruheNach}`);

  console.log('\n== Eigene Baugruppe in die Bibliothek ==');
  await pg.mouse.click((await mitte(0)).x, (await mitte(0)).y, { button: 'right' });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => {
    document.querySelector('[data-kc-gruppe-name]').value = 'Kopf klein';
    document.querySelector('[data-kc-gruppe="sichern"]').click();
  });
  await pg.waitForTimeout(700);
  const eigene = await pg.evaluate(() => window.KCKassenGruppen.eigene());
  p('Die Auswahl wird als eigene Baugruppe gesichert', eigene.length === 1, eigene[0]?.name);
  p('Gespeichert werden Rasterversätze, keine Pixel',
    eigene[0]?.teile.every((t) => Number.isInteger(t.sv) && Number.isInteger(t.zv) && t.x === undefined),
    eigene[0]?.teile.map((t) => `${t.typ}@${t.sv}/${t.zv}`).join(' · '));
  p('Das Aussehen der Teile wird mitgesichert',
    eigene[0]?.teile.every((t) => typeof t.text === 'string' && t.text.length > 0));
  const bibNach = await pg.evaluate(() => [...document.querySelectorAll('#toolbox .toolGroup')]
    .filter((g) => !g.hidden).map((g) => g.querySelector('h3').textContent));
  p('Die eigene Baugruppe steht in der Bibliothek',
    bibNach.some((t) => /^Eigene Baugruppen/.test(t)), bibNach.filter((t) => /Baugruppen/.test(t)).join(' · '));
  p('Es gibt einen Weg, eigene Baugruppen wieder zu löschen',
    await pg.evaluate(() => Boolean(document.querySelector('.kc-eigene-verwalten'))));

  // Wieder einsetzen - an anderer Stelle, mit denselben Abständen.
  /* In try/catch, weil genau hier ein Fehler beim Bauen aufgetreten ist (Teil 1 fing die
     eigene Baugruppe ab und stolperte über ihr Format). Ein Absturz der Prüfung sagt zwar
     auch "kaputt", nennt aber nicht die Stelle - eine rote Zeile schon. */
  let einsetzFehler = '';
  try {
    await pg.evaluate(() => {
      currentSlide().items = []; render();
      addItem(window.KCKassenGruppen.eigene()[0].id, 300, 200);
    });
  } catch (e) { einsetzFehler = String(e.message).slice(0, 90); }
  await pg.waitForTimeout(700);
  p('Das Einsetzen der eigenen Baugruppe läuft ohne Fehler', !einsetzFehler, einsetzFehler || 'ohne Fehler');
  const wieder = await pg.evaluate(() => currentItems().map((i) => ({
    t: i.type, sp: i.kc.spalte, z: i.kc.zeile, sn: i.kc.spalten, g: i.groupId || null, text: i.text })));
  p('Die eigene Baugruppe lässt sich wieder einsetzen', wieder.length === 2,
    `${wieder.length} Bauteile`);
  p('Dabei bleiben die Abstände der Teile erhalten',
    wieder.length === 2 && wieder[1].sp - wieder[0].sp === eigene[0].teile[1].sv - eigene[0].teile[0].sv,
    wieder.length === 2 ? `Versatz ${wieder[1].sp - wieder[0].sp} Spalten` : 'nicht eingesetzt');
  p('Sie steht dort, wo sie abgesetzt wurde, nicht in der Ecke',
    wieder.length === 2 && wieder[0].sp > 0 && wieder[0].z > 0,
    wieder.length === 2 ? `Spalte ${wieder[0].sp + 1}, Zeile ${wieder[0].z + 1}` : 'nicht eingesetzt');
  p('Die eingesetzten Teile sind gleich wieder zusammengebunden',
    wieder.length === 2 && wieder[0].g && wieder[0].g === wieder[1].g);
  p('Die Beschriftungen kommen mit zurück', /Kopfzeile/.test(wieder[0]?.text || ''), wieder[0]?.text || '-');

  await pg.evaluate(() => {
    const i = currentItems()[0];
    if (!i) return;
    selected = i.id; selectedIds = new Set([i.id]); render();
  });
  await pg.mouse.click((await mitte(0)).x, (await mitte(0)).y, { button: 'right' });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => document.querySelector('[data-kc-gruppe="loesen"]')?.click());
  await pg.waitForTimeout(500);
  p('„Gruppe lösen“ löst die Bindung wieder',
    await pg.evaluate(() => currentItems().length > 0 && currentItems().every((i) => !i.groupId)));

  /* ================================================================= Teil 4
   * ANLASS 03.09.2026 (Betreiber): "Die Artikeltasten sind in der Bauphase ja erst nur
   * Platzhalter. Wie können die Artikelbilder rein? Oder ein anderer Bauer möchte nur Farben
   * und Texte mit Preis. ... Idee: rechte Maustaste und Info-Dreieck einbauen. Dahinter muss
   * dann ein Infotext bzw. eine Infoseite liegen."
   *
   * Die wichtigste Prüfung dieses Abschnitts ist nicht, dass Bilder erscheinen, sondern dass
   * der AUFBAU KEINEN ARTIKEL ENTHÄLT. Der Baukasten liest die Stammdaten und speichert
   * nichts davon; sonst gäbe es eine zweite Artikelliste neben denen des Vereins. */
  console.log('\n== Echte Artikel in der Vorschau ==');
  await pg.evaluate(() => { const k = [...document.querySelectorAll('.slideCard')]; if (k[0]) k[0].click(); });
  await pg.waitForTimeout(700);
  p('Teil 4 ist geladen', await pg.evaluate(() => Boolean(window.KCKassenArtikel)),
    await pg.evaluate(() => window.KCKassenArtikel?.version || '-'));
  const sortiment = await pg.evaluate(() => ({
    anzahl: window.KCKassenArtikel.sortiment().length,
    herkunft: window.KCKassenArtikel.herkunft(),
    gruppen: window.KCKassenArtikel.warengruppen(),
    angezeigt: document.getElementById('kcSortimentHerkunft')?.textContent || '',
  }));
  p('Das echte Sortiment ist erreichbar', sortiment.anzahl >= 20, `${sortiment.anzahl} Artikel`);
  p('Die Warengruppen kommen mit', sortiment.gruppen.length >= 3, sortiment.gruppen.join(' · '));
  /* Eine Vorschau, die nicht sagt, woher sie kommt, ist eine Behauptung. */
  p('Der Baukasten sagt, woher das Sortiment stammt', /Kasse|Kassendatei/.test(sortiment.angezeigt),
    sortiment.angezeigt);

  await pg.evaluate(() => { currentSlide().items = []; render(); addItem('kc-artikel-bild', 0, 0); });
  await pg.waitForTimeout(900);
  const vorschau = await pg.evaluate(() => {
    const n = document.querySelector('.kc-artikelnetz');
    if (!n) return null;
    const k = n.children[0];
    return { kacheln: n.children.length, name: n.querySelector('.kc-ak-name')?.textContent,
      preis: n.querySelector('.kc-ak-preis')?.textContent,
      bild: /url\(/.test(getComputedStyle(k).backgroundImage) ? getComputedStyle(k).backgroundImage : '' };
  });
  p('Die Artikelfläche zeigt echte Artikel', (vorschau?.kacheln || 0) >= 4, `${vorschau?.kacheln} Kacheln`);
  p('Mit echtem Namen und Preis', /\w/.test(vorschau?.name || '') && /€/.test(vorschau?.preis || ''),
    `${vorschau?.name} · ${vorschau?.preis}`);
  /* Nicht nur "ein Bild ist eingetragen", sondern: die Datei kommt auch an. Der erste Anlauf
     sah richtig aus und lud nichts - der Pfad war am Anführungszeichen zerbrochen. */
  const bildAntwort = await pg.evaluate(async () => {
    const k = document.querySelector('.kc-ak');
    const m = /url\("?([^")]+)"?\)/.exec(getComputedStyle(k).backgroundImage || '');
    if (!m) return 'kein Bild';
    try { const r = await fetch(m[1]); return `${m[1].split('/').pop()} → ${r.status}`; }
    catch (e) { return 'nicht abrufbar'; }
  });
  p('Das Artikelbild wird auch wirklich geladen', /→ 200$/.test(bildAntwort), bildAntwort);

  console.log('\n== Darstellung und Info-Ecke über die rechte Maustaste ==');
  const artikelStelle = await pg.evaluate(() => {
    const e = document.querySelector('.designer-item[data-type^="kc-artikel"]');
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  await pg.mouse.click(artikelStelle.x, artikelStelle.y, { button: 'right' });
  await pg.waitForTimeout(500);
  const artMenue = await pg.evaluate(() => {
    const m = document.getElementById('kcKontextMenue');
    return { da: Boolean(m.querySelector('.kc-kontext-artikel')),
      felder: [...m.querySelectorAll('[data-kc-art]')].map((s) => s.dataset.kcArt),
      darstellungen: [...(m.querySelector('[data-kc-art="kcDarstellung"]')?.options || [])].map((o) => o.value),
      ecken: [...(m.querySelector('[data-kc-art="kcInfoEcke"]')?.options || [])].map((o) => o.value),
      infoseite: Boolean(m.querySelector('[data-kc-infoseite]')) };
  });
  p('Die Artikelfläche hat einen eigenen Menüblock', artMenue.da, artMenue.felder.join(' · '));
  /* Nicht auf eine Anzahl festnageln - am 03.09. kam "symbol" dazu, und die Prüfung schlug an,
     obwohl nichts kaputt war. Geprüft wird, dass die vier gemeinten Darstellungen da sind. */
  p('Die gemeinten Darstellungen stehen zur Wahl',
    ['bild', 'farbe', 'text-preis', 'text'].every((d) => artMenue.darstellungen.includes(d)),
    artMenue.darstellungen.join('/'));
  p('Die Info-Ecke ist wählbar – auch oben links', artMenue.ecken.includes('ol') && artMenue.ecken.includes('or'),
    artMenue.ecken.join('/'));
  p('Von hier führt ein Weg zur Info-Seite', artMenue.infoseite);

  const stelleAuf = async (feld, wert) => {
    await pg.evaluate(({ f, w }) => {
      const s = document.querySelector(`[data-kc-art="${f}"]`);
      s.value = w; s.dispatchEvent(new Event('change', { bubbles: true }));
    }, { f: feld, w: wert });
    await pg.waitForTimeout(400);
  };
  await stelleAuf('kcDarstellung', 'farbe');
  const farbig = await pg.evaluate(() => {
    const n = document.querySelector('.kc-artikelnetz');
    return { art: n.dataset.darstellung, bild: /url\(/.test(getComputedStyle(n.children[0]).backgroundImage),
      farbe: getComputedStyle(n.children[0]).backgroundColor,
      abgeleitet: n.querySelectorAll('.kc-ak.abgeleitet').length,
      fuss: document.querySelector('.kc-artikelfuss')?.textContent || '' };
  });
  p('„Farbe + Name + Preis“ zeigt Farbe statt Bild', farbig.art === 'farbe' && !farbig.bild, farbig.farbe);
  /* Der Betreiber hat entschieden: fehlende Farben aus der Warengruppe ableiten UND es
     kenntlich machen. Beides wird hier gemessen - eine abgeleitete Farbe, die aussieht wie
     eine hinterlegte, wäre eine stille Behauptung über die Stammdaten. */
  p('Fehlende Farben werden aus der Warengruppe abgeleitet', farbig.abgeleitet > 0,
    `${farbig.abgeleitet} Kacheln`);
  p('Und der Baukasten sagt, bei wie vielen', /Farbe abgeleitet bei \d/.test(farbig.fuss), farbig.fuss);

  await pg.mouse.click(artikelStelle.x, artikelStelle.y, { button: 'right' });
  await pg.waitForTimeout(400);
  await stelleAuf('kcInfoEcke', 'ol');
  const mitEcke = await pg.evaluate(() => ({
    ecken: document.querySelectorAll('.kc-ak-ecke.ol').length,
    leer: document.querySelectorAll('.kc-ak-ecke.leer').length,
    fuss: document.querySelector('.kc-artikelfuss')?.textContent || '',
  }));
  p('Die Info-Ecke sitzt an jeder Kachel', mitEcke.ecken > 0, `${mitEcke.ecken} Ecken`);
  /* 9 der 22 Artikel haben noch keinen Infotext. Die Kachel zeigt das - so ist die Vorschau
     zugleich die Liste dessen, was der Verein noch füllen muss. */
  p('Fehlende Infotexte sind an der Ecke zu sehen', mitEcke.leer > 0 && /Info fehlt bei \d/.test(mitEcke.fuss),
    mitEcke.fuss);

  await pg.mouse.click(artikelStelle.x, artikelStelle.y, { button: 'right' });
  await pg.waitForTimeout(400);
  await stelleAuf('kcWarengruppe', 'Speisen');
  const nurSpeisen = await pg.evaluate(() => [...document.querySelectorAll('.kc-ak-name')].map((e) => e.textContent));
  const alleSpeisen = await pg.evaluate(() => window.KCKassenArtikel.sortiment()
    .filter((a) => a.category === 'Speisen').map((a) => a.name));
  p('Die Warengruppe lässt sich für die Vorschau wählen',
    nurSpeisen.length > 0 && nurSpeisen.every((n) => alleSpeisen.includes(n)),
    nurSpeisen.slice(0, 3).join(' · '));

  console.log('\n== Die Info-Seite als dritte Seite ==');
  await pg.mouse.click(artikelStelle.x, artikelStelle.y, { button: 'right' });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => document.querySelector('[data-kc-infoseite]').click());
  await pg.waitForTimeout(1000);
  const infoSeite = await pg.evaluate(() => ({
    seiten: project.slides.map((s) => `${s.name}/${s.kcSeite}`),
    aktiv: currentSlide().kcSeite,
    teile: currentItems().map((i) => i.type),
    bibliothek: [...document.querySelectorAll('#toolbox .toolGroup')].filter((g) => !g.hidden)
      .map((g) => g.querySelector('h3').textContent),
  }));
  p('Es gibt jetzt eine dritte Seite „Info“', infoSeite.seiten.some((s) => /\/info$/.test(s)),
    infoSeite.seiten.join(' · '));
  p('Sie ist nicht leer', infoSeite.teile.length >= 6, `${infoSeite.teile.length} Bausteine`);
  p('Zutaten, Allergene und Nährwerte sind vorgesehen',
    ['kc-info-zutaten', 'kc-info-allergene', 'kc-info-naehrwerte'].every((t) => infoSeite.teile.includes(t)));
  p('Die Bibliothek wechselt auf die Info-Bausteine',
    infoSeite.bibliothek.some((t) => /^Info-Seite/.test(t)), infoSeite.bibliothek.join(' · '));
  /* Am 03.09. hier gefunden: "beide" hieß im Filter "auf jeder Seite". Als die Info-Seite
     dazukam, erbte sie stillschweigend alle Zahltasten - auf der Infoseite eines Glühweins
     wurden Geldscheine angeboten. */
  p('Auf der Info-Seite werden keine Zahltasten angeboten',
    !infoSeite.bibliothek.some((t) => /Zahlen|Sondertasten|Baugruppen/.test(t)));

  console.log('\n== Die drei Bauformen von QuickBon ==');
  await pg.evaluate(() => { const k = [...document.querySelectorAll('.slideCard')]; if (k[0]) k[0].click(); });
  await pg.waitForTimeout(700);
  const qbAngebot = await pg.evaluate(() => {
    const g = [...document.querySelectorAll('#toolbox .toolGroup')]
      .find((x) => /^Baugruppen/.test(x.querySelector('h3').textContent));
    return [...g.querySelectorAll('.tool')].filter((t) => !t.hidden).map((t) => t.textContent);
  });
  p('Die drei QuickBon-Bauformen liegen in der Bibliothek',
    qbAngebot.filter((t) => /QuickBon/.test(t)).length === 3,
    qbAngebot.filter((t) => /QuickBon/.test(t)).join(' · '));
  await pg.evaluate(() => { currentSlide().items = []; render(); addItem('bg-qb-komplett', 0, 0); });
  await pg.waitForTimeout(1000);
  const qb = await pg.evaluate(() => ({
    teile: currentItems().map((i) => i.type),
    gebunden: new Set(currentItems().map((i) => i.groupId)).size === 1,
    streifenHoch: currentItems().find((i) => i.type === 'kc-bon-streifen')?.kc.zeilen,
    artikelHoch: currentItems().find((i) => i.type === 'kc-artikel-bild')?.kc.zeilen,
    vorschau: document.querySelector('.kc-artikelnetz')?.children.length || 0,
  }));
  p('Die ganze QuickBon-Oberfläche kommt in einem Griff', qb.teile.length >= 5, `${qb.teile.length} Bausteine`);
  p('Und ist zusammengebunden', qb.gebunden);
  /* Der eigentliche Punkt der Bauform - deshalb wird das Verhältnis wirklich nachgerechnet
     und nicht nur "sieht anders aus" behauptet. */
  p('Der Bon ist nur ein schmaler Streifen, die Artikel bekommen den Platz',
    qb.streifenHoch === 1 && qb.artikelHoch >= 5, `Bon ${qb.streifenHoch} Zeile, Artikel ${qb.artikelHoch} Zeilen`);
  p('Auch darin stehen die echten Artikel', qb.vorschau > 0, `${qb.vorschau} Kacheln`);

  /* DIE REGEL, AUF DIE ES ANKOMMT.
     Geprüft wird das, was WIRKLICH GESPEICHERT WIRD - die Bausteine der Kassenseiten im
     Projekt -, nicht die Zusammenfassung aufbauAlsText().
     GRUND, aus der Gegenprobe von heute: Beim ersten Anlauf stand hier aufbauAlsText(). Ich
     habe zur Probe einen Artikelnamen an den Baustein gehängt - und die Prüfung blieb grün,
     weil die Zusammenfassung nur ausgewählte Felder ausgibt. Sie hätte also genau den Fehler
     durchgelassen, gegen den sie geschrieben ist. Eine Prüfung, die das falsche Stück ansieht,
     ist schlimmer als keine: Sie beruhigt. */
  const gespeichert = await pg.evaluate(() => JSON.stringify(
    project.slides.filter((s) => s.kcSeite).map((s) => s.items)));
  const artikelNamen = await pg.evaluate(() => window.KCKassenArtikel.sortiment().map((a) => a.name));
  const gefunden = artikelNamen.filter((n) => n && gespeichert.includes(n));
  p('Kein einziger Artikelname steht im gespeicherten Aufbau', gefunden.length === 0,
    gefunden.length ? gefunden.join(', ') : `${artikelNamen.length} Namen geprüft`);
  p('Auch kein Preis und kein Bildpfad', !/webp|"5\.5"|5,50/.test(gespeichert),
    `${gespeichert.length} Zeichen`);
  const zusammenfassung = await pg.evaluate(() => JSON.stringify(window.KCKassenbaukasten.aufbauAlsText()));
  p('Und in der Zusammenfassung ebenfalls nicht',
    !artikelNamen.some((n) => n && zusammenfassung.includes(n)));

  /* ================================================================= Teil 5
   * ANLASS 03.09.2026 (Betreiber): "Nochmal zwei Ansichten" - MagicPOS und speedy. Entschieden:
   * alle sechs Bauteile plus die zwei Bauformen.
   * Das speedy-Bild hat nebenbei die offene Frage beantwortet, wo die Taste "Bon parken"
   * hinsoll: unten in eine schmale Funktionsleiste, nicht zu den großen Sondertasten. */
  console.log('\n== Bauformen aus MagicPOS und speedy ==');
  p('Teil 5 ist geladen', await pg.evaluate(() => Boolean(window.KCKassenBauformen)),
    await pg.evaluate(() => window.KCKassenBauformen?.version || '-'));
  const fremdteile = await pg.evaluate(() => {
    const g = [...document.querySelectorAll('#toolbox .toolGroup')]
      .find((x) => /Aus anderen Kassen/.test(x.querySelector('h3')?.textContent || ''));
    return g ? [...g.querySelectorAll('.tool')].filter((t) => !t.hidden).map((t) => t.dataset.type) : [];
  });
  /* Ebenfalls nicht auf sechs festnageln - am selben Tag kamen zwei weitere dazu. */
  p('Die Bauteile aus fremden Kassen liegen in einer eigenen Gruppe', fremdteile.length >= 6,
    `${fremdteile.length} Bauteile`);
  p('Die Funktionsleiste für „Bon parken“ ist dabei', fremdteile.includes('kc-funktionsleiste'));
  p('Der Reiter zu den offenen Belegen ist dabei', fremdteile.includes('kc-belegreiter'));
  p('Der Bon als Kassierer-Tabelle ist dabei', fremdteile.includes('kc-bon-kassierer'));
  /* Jedes Bauteil muss sagen, aus welchem System es stammt - sonst weiß in vier Wochen
     niemand mehr, warum ein "Blättern im Bon" in einer Kassen-Bibliothek liegt. */
  const herkunftDa = await pg.evaluate(() => window.KCKassenBauformen.BAUTEILE
    .every(([, , , , hinweis]) => /MagicPOS|speedy|roc\.Kasse|Hypersoft/.test(hinweis || '')));
  p('Jedes Bauteil nennt, aus welcher Kasse es stammt', herkunftDa);

  for (const [id, name, teileMin] of [['bg-magicpos', 'MagicPOS', 6], ['bg-speedy', 'speedy', 6]]) {
    await pg.evaluate((i) => { currentSlide().items = []; render(); addItem(i, 0, 0); }, id);
    await pg.waitForTimeout(1000);
    const form = await pg.evaluate(() => ({
      teile: currentItems().map((i) => i.type),
      gebunden: new Set(currentItems().map((i) => i.groupId)).size === 1,
      vorschau: document.querySelector('.kc-artikelnetz')?.children.length || 0,
      breite: Math.max(...currentItems().map((i) => i.kc.spalte + i.kc.spalten)),
      hoehe: Math.max(...currentItems().map((i) => i.kc.zeile + i.kc.zeilen)),
    }));
    p(`Die Bauform „${name}“ kommt vollständig in einem Griff`, form.teile.length >= teileMin,
      `${form.teile.length} Bausteine`);
    p(`„${name}“ ist zusammengebunden`, form.gebunden);
    /* Geprüft wird die BESCHREIBUNG der Bauform, nicht das eingesetzte Ergebnis.
       GRUND, aus der Gegenprobe von heute: Zuerst stand hier die Lage der eingesetzten
       Bausteine - und die Prüfung blieb grün, als ich einen Baustein absichtlich zu breit
       machte. Das Bereichsraster beschneidet nämlich alles auf die Fläche. Die Prüfung konnte
       also gar nicht fehlschlagen. Eine solche Zeile ist schlimmer als keine: Sie beruhigt,
       ohne etwas zu wissen. */
    const masse = await pg.evaluate((i) => {
      const [, , meta] = window.KCKassenBauformen.BAUFORMEN.find(([id]) => id === i);
      return meta.teile.map(([t, sv, zv, sp, ze]) => ({ t, rechts: sv + sp, unten: zv + ze }))
        .filter((x) => x.rechts > meta.felder[0] || x.unten > meta.felder[1]);
    }, id);
    p(`„${name}“ ist so beschrieben, dass alles auf die Fläche passt`, masse.length === 0,
      masse.length ? masse.map((x) => `${x.t} bis ${x.rechts}/${x.unten}`).join(' · ') : 'alle Teile innerhalb');
    p(`Auch in „${name}“ stehen die echten Artikel`, form.vorschau > 0, `${form.vorschau} Kacheln`);
  }

  /* ================================================================= Teil 6
   * ANLASS 03.09.2026 (Betreiber): "Noch zwei Ansichten" - Hypersoft und roc.Kasse.
   * Entschieden: dunkles Bonfeld, Darstellung "Symbol + Name + Preis", Ecke "Untergruppe",
   * Mitgliedsfoto auf dem Bedienerfeld. */
  console.log('\n== Aus roc.Kasse und Hypersoft ==');
  await pg.evaluate(() => {
    currentSlide().items = []; render();
    const K = window.KCKassenbaukasten;
    K.einsetzen('kc-artikel-bild', 0, 0, [6, 5]);
    K.einsetzen('kc-bon-dunkel', 6, 0, [4, 5]);
    K.einsetzen('kc-bediener-foto', 6, 5, [3, 1]);
    render();
  });
  await pg.waitForTimeout(900);

  /* Das dunkle Bonfeld ist die Antwort auf einen GEMESSENEN Befund vom 02.09.: Bonschrift
     9,76 bis 10,88 px auf allen vier Formaten, Kontrast 4,4:1 - unter der Grenze von 4,5:1,
     und das ausgerechnet bei Geldangaben. Deshalb wird hier nicht geprüft, ob das Feld dunkel
     AUSSIEHT, sondern der Kontrast wirklich ausgerechnet. */
  const bonfeld = await pg.evaluate(() => {
    const el = document.querySelector('.designer-item[data-type="kc-bon-dunkel"] .kc-dunkelbon');
    if (!el) return null;
    const summe = el.querySelector('.kc-db-summe');
    const s = getComputedStyle(summe);
    const zahl = (c) => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const hell = (c) => { const [r, g, b] = zahl(c); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
    const a = hell(s.color), b = hell(getComputedStyle(el).backgroundColor);
    return { groesse: parseFloat(s.fontSize), text: summe.textContent,
      kontrast: Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 10) / 10 };
  });
  p('Das dunkle Bonfeld ist im Baukasten zu sehen', Boolean(bonfeld), bonfeld?.text);
  p('Die Summe ist groß gesetzt', (bonfeld?.groesse || 0) >= 20, `${bonfeld?.groesse} px`);
  /* Unsere heutige Bonschrift: 9,8-10,9 px bei 4,4:1. Das hier muss deutlich darüber liegen,
     sonst wäre der Vorschlag keiner. */
  p('Und ihr Kontrast liegt weit über der Grenze von 4,5:1',
    (bonfeld?.kontrast || 0) >= 7, `${bonfeld?.kontrast} : 1 (heute im Bon: 4,4 : 1)`);

  const bediener = await pg.evaluate(async () => {
    const el = document.querySelector('.designer-item[data-type="kc-bediener-foto"] .kc-bedienerfeld');
    if (!el) return 'FEHLT';
    const img = el.querySelector('img');
    if (!img) return 'kein Bild';
    try { const r = await fetch(img.src); return `${img.src.split('/').pop()} → ${r.status}`; }
    catch (e) { return 'nicht abrufbar'; }
  });
  p('Das Bedienerfeld zeigt ein echtes Mitgliedsbild', /→ 200$/.test(bediener), bediener);

  const artStelle = await pg.evaluate(() => {
    const e = document.querySelector('.designer-item[data-type="kc-artikel-bild"]');
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  await pg.mouse.click(artStelle.x, artStelle.y, { button: 'right' });
  await pg.waitForTimeout(500);
  const auswahlen = await pg.evaluate(() => [...document.querySelectorAll('#kcKontextMenue [data-kc-art]')]
    .map((s) => `${s.dataset.kcArt}:${[...s.options].length}`));
  p('Die Kachel-Einstellungen sind auf vier gewachsen', auswahlen.length === 4, auswahlen.join(' · '));
  await pg.evaluate(() => {
    const s = document.querySelector('[data-kc-art="kcDarstellung"]');
    s.value = 'symbol'; s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await pg.waitForTimeout(500);
  const mitSymbol = await pg.evaluate(() => ({
    zeichen: [...document.querySelectorAll('.kc-ak-symbol')].map((e) => e.textContent),
    fuss: document.querySelector('.kc-artikelfuss')?.textContent || '',
  }));
  p('„Symbol + Name + Preis“ setzt Zeichen auf die Kacheln', mitSymbol.zeichen.length > 0,
    mitSymbol.zeichen.slice(0, 6).join(' '));
  p('Verschiedene Warengruppen bekommen verschiedene Zeichen',
    new Set(mitSymbol.zeichen).size >= 2, `${new Set(mitSymbol.zeichen).size} verschiedene`);
  /* In den Stammdaten steht kein Symbol - jedes Zeichen ist abgeleitet. Das muss dranstehen,
     sonst hält man es für eine Angabe des Vereins. Dieselbe Regel wie bei den Farben. */
  p('Und es steht dran, dass die Zeichen abgeleitet sind',
    /Symbole abgeleitet/.test(mitSymbol.fuss), mitSymbol.fuss);

  await pg.mouse.click(artStelle.x, artStelle.y, { button: 'right' });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => {
    const s = document.querySelector('[data-kc-art="kcUnterEcke"]');
    s.value = 'or'; s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await pg.waitForTimeout(500);
  p('Die Ecke „Untergruppe“ sitzt an den Kacheln',
    (await pg.evaluate(() => document.querySelectorAll('.kc-ak-unter.or').length)) > 0);
  await pg.mouse.click(artStelle.x, artStelle.y, { button: 'right' });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => {
    const s = document.querySelector('[data-kc-art="kcInfoEcke"]');
    s.value = 'or'; s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await pg.waitForTimeout(500);
  /* Zwei Ecken an derselben Stelle überdecken sich - das sieht man im Kleinen kaum. */
  p('Sitzen beide Ecken auf derselben Seite, warnt der Baustein',
    /beide Ecken auf derselben Seite/.test(
      await pg.evaluate(() => document.querySelector('.kc-artikelfuss')?.textContent || '')));

  /* ================================================================= Teil 6
   * ANLASS 03.09.2026 (Betreiber): "Evtl. noch bei Objekten, so wie Hintergründe, fertige
   * Vorlagen ... dann wähle ich erst eine Vorlage und kann dann die vorgefertigten Felder
   * füllen." */
  console.log('\n== Vorlagen · fertige Oberflächen ==');
  p('Teil 6 ist geladen', await pg.evaluate(() => Boolean(window.KCKassenVorlagen)),
    await pg.evaluate(() => window.KCKassenVorlagen?.version || '-'));
  const regal = await pg.evaluate(() => {
    const r = document.getElementById('kcVorlagenRegal');
    if (!r) return null;
    return { sichtbar: !r.hidden,
      karten: [...r.querySelectorAll('.kc-vorlagenkarte')].map((k) => ({
        id: k.dataset.vorlage, name: k.querySelector('b')?.textContent,
        geraet: k.querySelector('em')?.textContent,
        felderImBild: k.querySelectorAll('.kc-vorlagenbild i').length })) };
  });
  p('Das Vorlagenregal steht über der Bibliothek', Boolean(regal) && regal.sichtbar);
  p('Es liegen mehrere fertige Oberflächen darin', (regal?.karten.length || 0) >= 5,
    `${regal?.karten.length} Vorlagen`);
  p('Jede Vorlage nennt ihr Gerät', (regal?.karten || []).every((k) => /×/.test(k.geraet || '')),
    regal?.karten[0]?.geraet);
  /* Man wählt eine Vorlage mit den Augen - deshalb muss jede ein Bild ihrer Aufteilung haben.
     Und zwar aus DENSELBEN Angaben gezeichnet, aus denen sie gebaut wird: Ein zweites,
     handgemaltes Vorschaubild wäre eine zweite Beschreibung, die veralten kann. */
  const bildStimmt = await pg.evaluate(() => window.KCKassenVorlagen.VORLAGEN.every(([id, , , , teile]) => {
    const k = document.querySelector(`[data-vorlage="${id}"]`);
    return k && k.querySelectorAll('.kc-vorlagenbild i').length === teile.length;
  }));
  p('Jedes Vorschaubild ist aus der Vorlage selbst gezeichnet', bildStimmt);

  /* Die erste Vorlage ist die AUSGEMESSENE Aufteilung der laufenden Kasse (03.09., 1366×1024).
     Wird sie später verändert, soll das auffallen und ein neues Nachmessen erzwingen -
     sonst hieße sie „unsere Oberfläche heute“ und wäre es nicht mehr. */
  const heute = await pg.evaluate(() => {
    const [, , , , teile] = window.KCKassenVorlagen.VORLAGEN.find(([id]) => id === 'vl-heute');
    return Object.fromEntries(teile.map(([t, sp, z, s2, z2]) => [t, `${sp}/${z} ${s2}x${z2}`]));
  });
  p('„Unsere Oberfläche heute“ trägt die gemessene Kopfzeile', heute['kc-kopf-voll'] === '0/0 12x1');
  p('… die gemessene Artikelfläche', heute['kc-artikel-mittel'] === '0/2 7x4', heute['kc-artikel-mittel']);
  p('… und den gemessenen Warenkorb', heute['kc-bon-ausfuehrlich'] === '7/1 5x5', heute['kc-bon-ausfuehrlich']);

  for (const [id, geraet, flaeche] of [['vl-heute', 'ipad-gross-quer', '1366×1024'],
    ['vl-9hoch', 'ipad-9-hoch', '768×1024']]) {
    await pg.evaluate((i) => { window.__kcVorlage = i; document.querySelector(`[data-vorlage="${i}"]`).click(); }, id);
    await pg.waitForTimeout(1300);
    const nach = await pg.evaluate(() => ({
      geraet: project.kasse.geraet, flaeche: `${project.page.width}×${project.page.height}`,
      seiten: project.slides.map((s) => s.kcSeite),
      kasse: project.slides[0].items.length, zahlen: project.slides[1].items.length,
      /* NICHT die eingesetzten Bausteine messen: Das Bereichsraster beschneidet sie auf die
         Fläche, dann kann diese Zeile gar nicht fehlschlagen. Heute schon zweimal in dieselbe
         Falle getappt - deshalb wird die BESCHREIBUNG der Vorlage nachgerechnet. */
      ausserhalb: (window.KCKassenVorlagen.VORLAGEN.find(([x]) => x === window.__kcVorlage) || [])[4]
        .filter(([, sp, z, s2, z2]) => sp + s2 > 12 || z + z2 > 8).length,
    }));
    p(`Die Vorlage „${id}“ stellt gleich das richtige Gerät ein`, nach.geraet === geraet,
      `${nach.geraet} · ${nach.flaeche}`);
    p(`„${id}“ legt Kassenseite und Zahlenseite an`,
      nach.seiten.join(',') === 'kasse,zahlen' && nach.kasse >= 5 && nach.zahlen >= 5,
      `${nach.kasse} + ${nach.zahlen} Felder`);
    p(`„${id}“ füllt die Fläche, ohne darüber hinauszuragen`, nach.ausserhalb === 0);
  }
  /* Die Vorlage muss auch wirklich mit Leben gefüllt sein - sonst hätte man nur Kästen. */
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '100%'); if (b) b.click(); });
  await pg.waitForTimeout(700);
  p('In der eingesetzten Vorlage stehen die echten Artikel',
    (await pg.evaluate(() => document.querySelector('.kc-artikelnetz')?.children.length || 0)) > 0);

  /* ================================================================= Teil 7
   * ANLASS 03.09.2026 (Betreiber): "Prüfe auch die Anordnung und Bedienung der
   * Objektbibliothek, ob alles per Drag and Drop auf die Fläche kommt." Und: "Evtl. noch
   * anbieten, einen Handy-Bildschirm zu designen." Und: nochmal konsolidieren. */
  console.log('\n== Bibliothek: Anordnung und Bedienung ==');
  await pg.evaluate(() => { try { localStorage.removeItem('kc.kassenbaukasten.gruppen.zu.v1'); } catch (e) {} });
  await pg.evaluate(() => document.querySelector('[data-vorlage="vl-heute"]').click());
  await pg.waitForTimeout(1300);
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '100%'); if (b) b.click(); });
  await pg.waitForTimeout(600);
  p('Teil 7 ist geladen', await pg.evaluate(() => Boolean(window.KCKassenBibliothek)),
    await pg.evaluate(() => window.KCKassenBibliothek?.version || '-'));
  /* GEMESSEN 03.09.2026: Der Designer macht aus der Bibliothek eine Ziehharmonika und klappt
     alle Gruppen außer der ersten zu. Bei vier TV-Gruppen ist das sinnvoll; bei 19 Gruppen mit
     137 Bauteilen heißt es, dass 18 Gruppen unerreichbar sind, bis man sie einzeln aufklappt.
     Genau daran ist mein erster Zieh-Versuch gescheitert - die Werkzeuge waren wirklich weg. */
  const zuKlapp = await pg.evaluate(() => {
    const alle = [...document.querySelectorAll('#toolbox .toolGroup')];
    return { gesamt: alle.length, zu: alle.filter((g) => g.classList.contains('collapsed')).length };
  });
  p('Im Kassenmodus sind die Gruppen offen, nicht zugeklappt', zuKlapp.zu === 0,
    `${zuKlapp.zu} von ${zuKlapp.gesamt} zu`);

  /* Die eigentliche Frage: Kommt ein Teil per Ziehen mit der echten Maus auf die Fläche?
     Der Designer hat das Datei-Ziehen abgeschaltet und durch Zeiger-Ziehen ersetzt (gut für
     Touch) - deshalb wird hier wirklich gedrückt, gezogen und losgelassen. */
  const ziehTest = async (typ) => {
    await pg.evaluate(() => { currentSlide().items = []; render(); });
    await pg.waitForTimeout(250);
    const punkt = await pg.evaluate(async (t) => {
      const w = document.querySelector(`#toolbox .tool[data-type="${t}"]`);
      if (!w || w.hidden) return null;
      w.scrollIntoView({ block: 'center' });
      await new Promise((r) => setTimeout(r, 220));
      const r = w.getBoundingClientRect(), st = document.getElementById('stage').getBoundingClientRect();
      const treffer = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      if (!treffer || treffer.closest('.tool') !== w) return null;
      return { vx: Math.round(r.x + r.width / 2), vy: Math.round(r.y + r.height / 2),
        zx: Math.round(st.x + st.width * 0.35), zy: Math.round(st.y + st.height * 0.35) };
    }, typ);
    if (!punkt) return -1;
    await pg.mouse.move(punkt.vx, punkt.vy); await pg.mouse.down();
    await pg.mouse.move(punkt.zx, punkt.zy, { steps: 12 }); await pg.mouse.up();
    await pg.waitForTimeout(550);
    return pg.evaluate(() => currentItems().length);
  };
  for (const [typ, was] of [['kc-kopf-voll', 'ein Baustein'], ['bg-warenkorb-klein', 'eine Baugruppe'],
    ['kn-tuer', 'ein Knopf'], ['kc-bon-dunkel', 'ein Teil aus einer fremden Kasse'],
    ['pl-parken', 'ein geplantes Teil'], ['text', 'das freie Textfeld']]) {
    const n = await ziehTest(typ);
    p(`Ziehen mit der Maus bringt ${was} auf die Fläche`, n > 0,
      n < 0 ? 'Werkzeug nicht erreichbar' : `${n} Teile`);
  }

  /* Ein Symbol muss auf dem Teil landen, auf das man es ZIEHT - nicht auf dem, das gerade
     ausgewählt ist. Vor dem 03.09. war genau das der Fall, und mit einem Funktionsaufruf
     hätte es immer richtig ausgesehen. */
  await pg.evaluate(() => {
    currentSlide().items = []; render();
    const K = window.KCKassenbaukasten;
    K.einsetzen('kn-tuer', 1, 1, [2, 2]); K.einsetzen('kn-uhr', 7, 4, [2, 2]);
    selected = currentItems()[0].id; render();
  });
  await pg.waitForTimeout(600);
  const symPunkt = await pg.evaluate(async () => {
    const w = document.querySelector('#toolbox .tool[data-type="sym-🔒"]');
    if (!w) return null;
    w.scrollIntoView({ block: 'center' });
    await new Promise((r) => setTimeout(r, 220));
    const r = w.getBoundingClientRect();
    const ziel = [...document.querySelectorAll('.designer-item')][1].getBoundingClientRect();
    return { vx: Math.round(r.x + r.width / 2), vy: Math.round(r.y + r.height / 2),
      zx: Math.round(ziel.x + ziel.width / 2), zy: Math.round(ziel.y + ziel.height / 2) };
  });
  if (symPunkt) {
    await pg.mouse.move(symPunkt.vx, symPunkt.vy); await pg.mouse.down();
    await pg.mouse.move(symPunkt.zx, symPunkt.zy, { steps: 12 }); await pg.mouse.up();
    await pg.waitForTimeout(600);
  }
  const symErgebnis = await pg.evaluate(() => currentItems().map((i) => i.kcSymbol || '-'));
  p('Ein gezogenes Symbol landet auf dem Teil unter der Maus, nicht auf dem ausgewählten',
    symErgebnis[0] === '-' && symErgebnis[1] === '🔒', symErgebnis.join(' / '));

  console.log('\n== Das Handy als weitere Oberfläche ==');
  const geraeteliste = await pg.evaluate(() => window.KCKassenbaukasten.GERAETE.map((g) => g.id));
  p('Handy hoch und quer stehen zur Wahl',
    geraeteliste.includes('handy-hoch') && geraeteliste.includes('handy-quer'), geraeteliste.join(' · '));
  /* Ein Handy ist kein kleines iPad: Auf 390 × 844 wäre ein Feld des 12×8-Rasters 32 px breit
     und 105 px hoch. Deshalb bringt jedes Gerät sein eigenes Grundraster mit. */
  const raster = await pg.evaluate(() => ({
    tablet: window.KCKassenbaukasten.GRUNDRASTER(window.KCKassenbaukasten.GERAETE.find((g) => g.id === 'ipad-9-quer')),
    handy: window.KCKassenbaukasten.GRUNDRASTER(window.KCKassenbaukasten.GERAETE.find((g) => g.id === 'handy-hoch')),
  }));
  p('Das Handy rechnet mit einem eigenen Grundraster',
    raster.handy.join('×') === '6×12' && raster.tablet.join('×') === '12×8',
    `Tablet ${raster.tablet.join(' × ')}, Handy ${raster.handy.join(' × ')}`);
  await pg.evaluate(() => document.querySelector('[data-vorlage="vl-handy"]').click());
  await pg.waitForTimeout(1300);
  const handy = await pg.evaluate(() => ({
    geraet: project.kasse.geraet, flaeche: `${project.page.width}×${project.page.height}`,
    raster: window.KCKassenbaukasten.raster(), teile: currentItems().length,
  }));
  p('Es gibt eine eigene Handy-Vorlage', handy.geraet === 'handy-hoch' && handy.teile >= 5,
    `${handy.flaeche} · ${handy.teile} Felder`);
  p('Und sie rechnet im Handyraster', handy.raster.spalten === 6 && handy.raster.zeilen === 12,
    `${handy.raster.spalten} × ${handy.raster.zeilen}`);

  console.log('\n== Konsolidierung des Baukastens ==');
  const konsolidiert = await pg.evaluate(() => {
    const K = window.KCKassenbaukasten;
    const typen = new Set([...K.bausteinListe().keys()]);
    const fehlend = [];
    const pruefe = (liste) => liste.forEach(([id, , meta]) => (meta.teile || []).forEach((t) => {
      const typ = Array.isArray(t) ? t[0] : t.typ;
      if (!typen.has(typ)) fehlend.push(`${id} → ${typ}`);
    }));
    pruefe(K.BAUGRUPPEN); pruefe(window.KCKassenBauformen.BAUFORMEN);
    window.KCKassenVorlagen.VORLAGEN.forEach(([id, , ger, , teile]) => {
      teile.forEach(([t]) => { if (!typen.has(t)) fehlend.push(`${id} → ${t}`); });
      if (!K.GERAETE.some((g) => g.id === ger)) fehlend.push(`${id} → Gerät ${ger}`);
    });
    window.KCKassenVorlagen.ZAHLENSEITE.forEach(([t]) => { if (!typen.has(t)) fehlend.push(`Zahlenseite → ${t}`); });
    const inBib = [...document.querySelectorAll('#toolbox .tool')].map((t) => t.dataset.type);
    return { fehlend, doppelt: [...new Set(inBib.filter((t, i) => inBib.indexOf(t) !== i))] };
  });
  p('Jede Baugruppe, Bauform und Vorlage verweist nur auf vorhandene Bauteile',
    konsolidiert.fehlend.length === 0, konsolidiert.fehlend.join(', ') || 'kein toter Verweis');
  /* GEFUNDEN 03.09.2026 durch genau diese Zeile: Meine Kachel-Variante hieß versehentlich
     genauso wie ein Baustein aus Teil 1 und hat ihn überschrieben - derselbe Typ stand mit
     zwei Bedeutungen in der Bibliothek. "Zwei Quellen für eine Sache", diesmal von mir. */
  p('Kein Bauteil steht doppelt in der Bibliothek', konsolidiert.doppelt.length === 0,
    konsolidiert.doppelt.join(', ') || 'keine Dopplung');

  const kontraste = await pg.evaluate(() => {
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const hell = (c) => { const [r, g, b] = (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
    const grund = (el) => { let e = el; while (e) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; e = e.parentElement; } return 'rgb(255,255,255)'; };
    return ['#kcGeraetMasse', '#kcSortimentHerkunft', '.kc-raster-wahl > span'].map((sel) => {
      const e = document.querySelector(sel);
      if (!e) return { sel, wert: 0 };
      const a = hell(getComputedStyle(e).color), b = hell(grund(e));
      return { sel, wert: Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 10) / 10 };
    });
  });
  /* Diese drei Beschriftungen lagen am 03.09. bei 1,5 bis 1,7 : 1 - ich hatte die Farbe nur am
     Rahmen gesetzt und mit opacity aufgehellt. Gefunden mit axe-core. */
  p('Die eigenen Beschriftungen des Baukastens sind lesbar',
    kontraste.every((k) => k.wert >= 4.5), kontraste.map((k) => `${k.sel} ${k.wert}:1`).join(' · '));

  /* ================================================================= Teil 9
   * ANLASS 03.09.2026 (Betreiber): "Bau noch eine Lupenfunktion mit ein, wenn nur Warenkorb
   * als Bon da ist. Dann Warenkorb vergrößern und bearbeiten."
   *
   * Der Zweck ist gemessen: Auf dem 9-Zoll-Gerät frisst der Warenkorb 17 bis 36 % der Fläche
   * und ist trotzdem unübersichtlich, die Bonschrift liegt bei 9,8 bis 10,9 px (02.09.). Die
   * Lupe vergrößert zum ARBEITEN - deshalb wird hier auch die Trefferfläche der Tasten in der
   * großen Ansicht nachgemessen, nicht nur ob sie aufgeht. */
  console.log('\n== Die Lupe am Warenkorb ==');
  await pg.evaluate(() => document.querySelector('[data-vorlage="vl-9quer"]').click());
  await pg.waitForTimeout(1300);
  await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '100%'); if (b) b.click(); });
  await pg.waitForTimeout(600);
  p('Teil 9 ist geladen', await pg.evaluate(() => Boolean(window.KCKassenLupe)),
    await pg.evaluate(() => window.KCKassenLupe?.version || '-'));

  await pg.evaluate(() => {
    const i = currentItems().find((x) => x.type.startsWith('kc-bon-'));
    selected = i.id; selectedIds = new Set([i.id]); render();
  });
  await pg.waitForTimeout(500);
  p('Am Warenkorb wird die Lupe angeboten',
    await pg.evaluate(() => { const l = document.querySelector('.kc-lupen-wahl'); return Boolean(l) && !l.hidden; }));
  await pg.evaluate(() => { const i = currentItems().find((x) => x.type.startsWith('kc-artikel')); selected = i.id; render(); });
  await pg.waitForTimeout(400);
  /* Eine Auswahl, die nichts tut, ist schlimmer als keine. */
  p('An der Artikelfläche wird sie nicht angeboten',
    await pg.evaluate(() => document.querySelector('.kc-lupen-wahl').hidden));

  await pg.evaluate(() => { const i = currentItems().find((x) => x.type.startsWith('kc-bon-')); selected = i.id; render(); });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => { const k = document.querySelector('[data-kc-clever="kcLupe"]'); k.checked = true; k.dispatchEvent(new Event('change', { bubbles: true })); });
  await pg.waitForTimeout(600);
  p('Die Lupe wird am Baustein gespeichert',
    await pg.evaluate(() => currentItems().find((x) => x.type.startsWith('kc-bon-')).kcLupe === true));
  p('Und der Griff erscheint auf der Fläche',
    (await pg.evaluate(() => document.querySelectorAll('.kc-lupen-griff').length)) === 1);

  /* Mit der echten Maus - beim ersten Bauen ging der Griff nicht auf, obwohl er nachweislich
     unter dem Zeiger lag: Mein eigenes preventDefault beim Drücken hatte den Klick
     unterdrückt. Ausgelöst wird jetzt beim Loslassen, wie es ein Finger auch tut. */
  const lupenPunkt = await pg.evaluate(() => {
    const e = document.querySelector('.kc-lupen-griff').getBoundingClientRect();
    return { x: Math.round(e.x + e.width / 2), y: Math.round(e.y + e.height / 2) };
  });
  await pg.mouse.click(lupenPunkt.x, lupenPunkt.y);
  await pg.waitForTimeout(700);
  const gross = await pg.evaluate(() => {
    const f = document.getElementById('kcLupenFenster');
    if (!f || f.hidden) return null;
    const t = f.querySelector('.kc-lupen-tasten i').getBoundingClientRect();
    return { zeilen: f.querySelectorAll('.kc-lupen-zeile').length,
      erster: f.querySelector('.kc-lupen-name')?.textContent,
      taste: Math.min(Math.round(t.width), Math.round(t.height)),
      summe: f.querySelector('.kc-lupen-fuss b')?.textContent };
  });
  p('Der Griff öffnet den vergrößerten Warenkorb', Boolean(gross), gross ? `${gross.zeilen} Zeilen` : 'ging nicht auf');
  p('Darin stehen die echten Artikel', /\w/.test(gross?.erster || ''), `${gross?.erster} · ${gross?.summe}`);
  /* Der Unterschied zum bloßen Vergrößern: Hier wird bearbeitet. Also müssen die Tasten auch
     zu treffen sein - 44 px ist Apples eigene Vorgabe, dieselbe Grenze wie in der iPad-Reihe. */
  p('Die Tasten zum Bearbeiten sind mindestens 44 px groß', (gross?.taste || 0) >= 44,
    `${gross?.taste} px`);
  await pg.evaluate(() => document.querySelector('[data-kc-lupe-zu]').click());
  await pg.waitForTimeout(400);
  p('Und lässt sich wieder schließen',
    await pg.evaluate(() => document.getElementById('kcLupenFenster').hidden));

  /* "Wenn nur Warenkorb als Bon da ist" - bei zwei Bonflächen wäre nicht bestimmt, welche
     sich vergrößert. Ein Bedienelement, bei dem man raten muss, ist keins. */
  await pg.evaluate(() => {
    window.KCKassenbaukasten.einsetzen('kc-bon-kompakt', 0, 0, [3, 3]);
    const i = currentItems().find((x) => x.type.startsWith('kc-bon-')); selected = i.id; render();
  });
  await pg.waitForTimeout(600);
  const warnung = await pg.evaluate(() => {
    const w = document.querySelector('.kc-lupen-warnung');
    return w && !w.hidden ? w.textContent : '';
  });
  p('Bei zwei Bonflächen warnt der Baukasten', /2 Bonflächen/.test(warnung), warnung.slice(0, 60));

  /* Eine Einstellung, die im Designer bleibt, wäre wertlos. */
  await pg.evaluate(() => { try { localStorage.removeItem('kc.kassenoberflaechen.v1'); } catch (e) {} });
  await pg.evaluate(() => document.querySelector('[data-kc-ueb="geben"]').click());
  await pg.waitForTimeout(900);
  const mitgereist = await pg.evaluate(() => window.KCKassenUebergabe.sammlung()
    .oberflaechen[0].seiten.flatMap((se) => se.bausteine).filter((b) => b.lupe).length);
  p('Die Lupe reist in der Übergabe an die Kasse mit', mitgereist > 0, `${mitgereist} Baustein`);

  p('Keine Skriptfehler über den ganzen Lauf', skriptfehler.length === 0,
    [...new Set(skriptfehler)].slice(0, 2).join(' | ') || 'keine');

  await pg.screenshot({ path: path.join(__dirname, 'kassenbaukasten.png') });
  await browser.close();
  try { web.closeAllConnections && web.closeAllConnections(); } catch (e) {}
  web.close();
  console.log(`\nKassenbaukasten: ${ok}/${ok + fehler.length} bestanden`);
  process.exit(fehler.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
