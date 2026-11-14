// KC PC-Manager – Tagesprogramm & Prospektimport (KS-06)
//
// Stellt die im Menü „📅 Programm“ verlinkten Karten wieder her (gingen bei einer früheren
// Zusammenführung verloren – Menü führte ins Leere):
//   • Tagesprogramm      (#kcProgramPanel)  – Programmpunkte ansehen, an/aus, löschen, von Hand ergänzen
//   • Prospektimport     (#kcProgramImport) – Bühnenprogramm der Stadt als PDF (oder TXT/CSV) einlesen:
//                          Text wird ECHT aus dem PDF gelesen (pdf.js, offline), Tage/Uhrzeiten/Programmpunkte
//                          werden erkannt, in einer Tabelle zum Prüfen und Korrigieren angezeigt, dann übernommen.
//   • Programmarchiv 2025 – Original-Prospekt 2025 zum Nachsehen (überschreibt nichts)
// Ziel ist immer settings.eventProgram – dieselbe Quelle, die der TV-Designer beim Öffnen übernimmt
// (danach „📺 An den Fernseher senden“).
(function (global) {
  'use strict';

  // ===================== Erkennung (ohne Browser testbar) =====================
  const MONATE = { januar: 1, jan: 1, februar: 2, feb: 2, maerz: 3, märz: 3, mrz: 3, april: 4, apr: 4, mai: 5, juni: 6, jun: 6, juli: 7, jul: 7,
    august: 8, aug: 8, september: 9, sep: 9, sept: 9, oktober: 10, okt: 10, november: 11, nov: 11, dezember: 12, dez: 12 };
  const WOCHENTAG = '(?:mo(?:ntag)?|di(?:enstag)?|mi(?:ttwoch)?|do(?:nnerstag)?|fr(?:eitag)?|sa(?:mstag)?|so(?:nntag)?)\\.?,?';
  const ORTE = /(sparkassenbühne|kinderbühne|hauptbühne|bühne|lichterwald|christophorus-?kirche|kirche|marktplatz|rathaus(?:platz)?|kirchplatz|stadtbücherei|zelt)/i;
  const RAUSCHEN = /^(seite \d+|\d+|programm|bühnenprogramm|änderungen vorbehalten.*|stand:?.*|www\..*|.*\.de\/?\S*)$/i;
  const zwei = (n) => String(n).padStart(2, '0');
  const VOLL = '\u200b'; // Zeile reichte bis an den Spaltenrand (Text läuft weiter)

  function normalisiere(z) {
    return String(z || '').replace(/ /g, ' ').replace(/[–—−]/g, '-').replace(/\s+/g, ' ').trim();
  }

  function findeDatum(zeile, jahr) {
    let m = zeile.match(new RegExp(`(?:^|\\s|\\|)(?:${WOCHENTAG}\\s*)?(\\d{1,2})\\.\\s*(\\d{1,2})\\.(?:\\s*(\\d{2,4}))?(?!\\d|:)`, 'i'));
    if (m) {
      let j = m[3] ? Number(m[3]) : jahr; if (j < 100) j += 2000;
      const t = Number(m[1]), mo = Number(m[2]);
      if (t >= 1 && t <= 31 && mo >= 1 && mo <= 12) return { datum: `${j}-${zwei(mo)}-${zwei(t)}`, treffer: m[0] };
    }
    m = zeile.match(new RegExp(`(?:^|\\s|\\|)(?:${WOCHENTAG}\\s*)?(\\d{1,2})\\.?\\s+(januar|jan|februar|feb|märz|maerz|mrz|april|apr|mai|juni|jun|juli|jul|august|aug|september|sept|sep|oktober|okt|november|nov|dezember|dez)\\.?(?:\\s+(\\d{4}))?`, 'i'));
    if (m) {
      const mo = MONATE[m[2].toLowerCase()]; const t = Number(m[1]);
      if (mo && t >= 1 && t <= 31) return { datum: `${m[3] ? Number(m[3]) : jahr}-${zwei(mo)}-${zwei(t)}`, treffer: m[0] };
    }
    return null;
  }

  function findeZeit(zeile) {
    const Z = '(\\d{1,2})(?:[:.](\\d{2}))?';
    let m = zeile.match(new RegExp(`(?:^|\\s|\\|)${Z}\\s*(?:uhr)?\\s*(?:-|bis)\\s*${Z}\\s*(?:uhr)?(?=\\s|\\||$|[,;]|[A-ZÄÖÜ])`, 'i'));
    // Zeiten mit Doppelpunkt immer; mit Punkt („15.15“) nur zusammen mit „Uhr“ – sonst wären Preise wie 5.50 Zeiten
    if (m && (/:/.test(m[0]) || /uhr/i.test(m[0]))) {
      const s = Number(m[1]), e = Number(m[3]);
      if (s <= 24 && e <= 24) return { von: `${zwei(s)}:${m[2] || '00'}`, bis: `${zwei(e)}:${m[4] || '00'}`, treffer: m[0] };
    }
    m = zeile.match(/(?:^|\s|\|)(?:ab\s+)?(\d{1,2}):(\d{2})\s*(?:uhr)?(?=\s|\||$|[,;])/i) || zeile.match(/(?:^|\s|\|)(?:ab\s+)?(\d{1,2})\.(\d{2})\s*uhr(?=\s|\||$|[,;])/i)
      || zeile.match(/(?:^|\s|\|)(?:ab\s+)?(\d{1,2})\s*uhr(?=\s|\||$|[,;])/i);
    if (m && Number(m[1]) <= 24) return { von: `${zwei(Number(m[1]))}:${m[2] || '00'}`, bis: '', treffer: m[0] };
    return null;
  }

  function teileText(rest) {
    let teile = rest.split(/\s*\|\s*/).map((x) => x.trim()).filter(Boolean);
    let ort = '';
    // Ort: eigener Teil, Klammer am Ende oder letztes Wort
    const klammer = rest.match(/\(([^)]*)\)\s*$/);
    if (klammer && ORTE.test(klammer[1])) { ort = klammer[1].trim(); teile = teile.map((t) => t.replace(/\s*\([^)]*\)\s*$/, '')).filter(Boolean); }
    if (!ort) { const i = teile.findIndex((t, n) => n > 0 && ORTE.test(t) && t.split(' ').length <= 4); if (i > 0) { ort = teile[i]; teile.splice(i, 1); } }
    if (teile.length === 1) {
      const m = teile[0].match(/^(.+?)\s+-\s+(.+)$/) || teile[0].match(/^(.+?):\s+(.+)$/);
      if (m) teile = [m[1], m[2]];
    }
    return { titel: (teile[0] || '').replace(/^[-:,\s]+|[-:,\s]+$/g, ''), beschreibung: teile.slice(1).join(' – '), ort };
  }

  function haeufigstesJahr(zeilen, ersatz) {
    const zaehler = {};
    for (const z of zeilen) for (const m of String(z).matchAll(/\b(20[2-3]\d)\b/g)) zaehler[m[1]] = (zaehler[m[1]] || 0) + 1;
    const best = Object.entries(zaehler).sort((a, b) => b[1] - a[1])[0];
    return best ? Number(best[0]) : ersatz;
  }

  // zeilen: Textzeilen (Spalten durch „|“ getrennt). Ergebnis: Programmpunkte mit Prüfhinweisen.
  function erkenne(zeilen, { jahr } = {}) {
    const j = haeufigstesJahr(zeilen, jahr || new Date().getFullYear());
    const aus = [];
    let datum = '', letzter = null, titelOffen = false;
    for (const roh of zeilen) {
      const voll = String(roh || '').endsWith(VOLL);
      const zeile = normalisiere(String(roh || '').replace(/\u200b/g, ''));
      if (!zeile || RAUSCHEN.test(zeile.replace(/\|/g, '').trim())) continue;
      const d = findeDatum(zeile, j);
      let rest = zeile;
      if (d) { datum = d.datum; rest = rest.replace(d.treffer, ' '); }
      const z = findeZeit(rest);
      if (!z) {
        // reine Datumszeile oder Fortsetzung der vorigen Beschreibung
        if (d) { letzter = null; titelOffen = false; continue; }
        if (letzter && !/^[A-ZÄÖÜ\s]{4,}$/.test(zeile)) {
          let t = zeile.replace(/\s*\|\s*/g, ' ').trim();
          const k = t.match(/\s*\(([^)]*)\)\s*$/);
          if (k && ORTE.test(k[1]) && !letzter.place) { letzter.place = k[1].trim(); t = t.slice(0, k.index).trim(); }
          if (!t) continue;
          if (!letzter.place && ORTE.test(t) && t.split(' ').length <= 3) letzter.place = t;
          else if (titelOffen && !letzter.description) letzter.title = `${letzter.title} ${t}`.trim();
          else letzter.description = letzter.description ? `${letzter.description} ${t}` : t;
          titelOffen = titelOffen && voll && !letzter.description;
        }
        continue;
      }
      rest = rest.replace(z.treffer, ' ').replace(/^\s*(uhr|\|)\s*/i, '');
      const { titel, beschreibung, ort } = teileText(rest.trim());
      const hinweise = [];
      if (!datum) hinweise.push('Datum fehlt');
      if (!titel) hinweise.push('Titel fehlt');
      letzter = { date: datum, time: z.von, endTime: z.bis, title: titel, description: beschreibung, place: ort, hinweis: hinweise.join(', ') };
      titelOffen = voll && !beschreibung;
      aus.push(letzter);
    }
    return { jahr: j, programm: aus };
  }

  const KCTagesprogramm = { erkenne, findeDatum, findeZeit, teileText };
  if (typeof module !== 'undefined' && module.exports) { module.exports = KCTagesprogramm; return; }

  // ===================== PDF lesen (pdf.js) =====================
  async function pdfZeilen(daten) {
    const lib = global.pdfjsLib;
    if (!lib) throw new Error('Der PDF-Leser ist nicht geladen. Lösung: Seite neu laden.');
    lib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
    const doc = await lib.getDocument({ data: daten }).promise;
    const alle = [];
    for (let s = 1; s <= doc.numPages; s++) {
      const seite = await doc.getPage(s);
      const breite = seite.getViewport({ scale: 1 }).width;
      const items = (await seite.getTextContent()).items.filter((i) => i.str && i.str.trim())
        .map((i) => ({ text: i.str, x: i.transform[4], y: i.transform[5], b: i.width || 0, h: Math.abs(i.transform[3]) || 10, schrift: i.fontName || '' }));
      // Zweispaltiger Prospekt? Dann erst linke, dann rechte Spalte lesen.
      const mitte = breite / 2;
      const ueberMitte = items.filter((i) => i.x < mitte - 4 && i.x + i.b > mitte + 4).length;
      const links = items.filter((i) => i.x + i.b <= mitte + 4), rechts = items.filter((i) => i.x >= mitte - 4);
      const spalten = (ueberMitte <= items.length * 0.03 && links.length > items.length * 0.25 && rechts.length > items.length * 0.25) ? [links, rechts] : [items];
      for (const spalte of spalten) alle.push(...zuZeilen(spalte));
    }
    return alle;
  }
  function zuZeilen(items) {
    const sortiert = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
    const zeilen = [];
    for (const i of sortiert) {
      const z = zeilen.find((l) => Math.abs(l.y - i.y) <= Math.max(2, i.h * 0.45));
      if (z) z.items.push(i); else zeilen.push({ y: i.y, items: [i] });
    }
    const fertig = zeilen.sort((a, b) => b.y - a.y).map((l) => {
      const its = l.items.sort((a, b) => a.x - b.x);
      let text = '', ende = null;
      for (const i of its) {
        if (ende !== null) {
          const luecke = i.x - ende;
          if (luecke > i.h * 0.9) text += ' | ';
          else if (!text.endsWith(' ') && (luecke > i.h * 0.15 || (/[a-zäöüß.)]$/.test(text) && /^[A-ZÄÖÜ(]/.test(i.text)))) text += ' ';
        }
        text += i.text; ende = i.x + i.b;
      }
      return { text, schriften: new Set(its.map((i) => i.schrift)), ersteSchrift: its[0].schrift };
    });
    // Läuft der Programmpunkt (Titel) in der nächsten Zeile weiter? Prospekte setzen den Titel fast
    // immer in eigener Schrift (fett), Uhrzeit/Datum und Beschreibung normal. Beginnt die nächste Zeile
    // in der Titelschrift (in dieser Zeile vorhanden, aber nicht die Schrift ihres Anfangs), läuft der
    // Titel weiter - markiert mit einem unsichtbaren Zeichen. Nur eine Schrift im PDF: im Zweifel Beschreibung.
    return fertig.map((l, n) => {
      const nf = fertig[n + 1] && fertig[n + 1].ersteSchrift;
      const weiter = !!nf && nf !== l.ersteSchrift && l.schriften.has(nf);
      return l.text + (weiter ? VOLL : '');
    });
  }
  function csvZeilen(text) {
    return text.split(/\r?\n/).map((z) => (z.includes(';') ? z.split(';') : z.split('\t').length > 1 ? z.split('\t') : [z]).map((x) => x.replace(/^"|"$/g, '').trim()).join(' | '));
  }

  // ===================== Oberfläche =====================
  const el = (id) => document.getElementById(id);
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const programm = () => { if (!global.settings) return []; if (!Array.isArray(global.settings.eventProgram)) global.settings.eventProgram = []; return global.settings.eventProgram; };
  const speichern = () => { try { global.saveAll && global.saveAll(); } catch (e) { /* */ } };
  const melde = (art, text) => { try { global.KCManagerMessages && global.KCManagerMessages[art] ? global.KCManagerMessages[art](text) : alert(text); } catch (e) { alert(text); } };
  const tagText = (d) => { try { return new Date(`${d}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }); } catch (e) { return d; } };
  let entwurf = [], quelle = '';

  function karten() {
    const ansicht = document.querySelector('[data-view-panel="tvscreen"]');
    if (!ansicht || el('kcProgramPanel')) return;
    const p = document.createElement('article');
    p.id = 'kcProgramPanel'; p.className = 'panel wide-panel kc-tagesprogramm';
    p.innerHTML = `<h3>📅 Tagesprogramm (Bühnenprogramm)</h3>
      <p class="muted">Quelle für den TV-Designer und den Fernseher. Neu: Bühnenprogramm der Stadt unten als PDF einlesen.</p>
      <div id="kcProgramList"></div>
      <details style="margin-top:10px"><summary>Programmpunkt von Hand ergänzen</summary>
        <div class="form-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin-top:8px">
          <label>Datum<input id="kcProgramDate" type="date"></label><label>Von<input id="kcProgramTime" type="time"></label><label>Bis<input id="kcProgramEnd" type="time"></label>
          <label>Programmpunkt<input id="kcProgramTitle"></label><label>Beschreibung<input id="kcProgramDesc"></label><label>Ort/Bühne<input id="kcProgramPlace"></label>
        </div><button type="button" id="kcProgramAdd" style="margin-top:8px">＋ Programmpunkt speichern</button></details>
      <details style="margin-top:10px"><summary>Programmarchiv 2025 (Original-Prospekt, nur ansehen)</summary><div id="kcProgramArchiv">wird geladen …</div></details>`;
    const i = document.createElement('article');
    i.id = 'kcProgramImport'; i.className = 'panel wide-panel kc-program-import';
    i.innerHTML = `<h3>Prospektimport – Bühnenprogramm als PDF einlesen</h3>
      <p class="muted">PDF der Stadt (oder TXT/CSV) hierher ziehen oder auswählen. Erkannte Termine erscheinen in der Tabelle – bitte prüfen, korrigieren, dann übernehmen.</p>
      <div class="kc-program-drop" tabindex="0" style="border:2px dashed #94a3b8;border-radius:10px;padding:18px;text-align:center;cursor:pointer">📄 PDF hier ablegen oder <u>Datei auswählen</u><input id="kcProgramDatei" type="file" accept=".pdf,.txt,.csv,application/pdf,text/plain,text/csv" hidden></div>
      <div id="kcProgramImportState" class="muted" style="margin:8px 0"></div>
      <div id="kcProgramImportTabelle"></div>`;
    ansicht.appendChild(p); ansicht.appendChild(i);
    const datei = el('kcProgramDatei'), drop = i.querySelector('.kc-program-drop');
    drop.onclick = () => datei.click();
    drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') datei.click(); };
    drop.ondragover = (e) => { e.preventDefault(); drop.style.background = '#eef6ff'; };
    drop.ondragleave = () => { drop.style.background = ''; };
    drop.ondrop = (e) => { e.preventDefault(); drop.style.background = ''; if (e.dataTransfer.files[0]) einlesen(e.dataTransfer.files[0]); };
    datei.onchange = () => { if (datei.files[0]) einlesen(datei.files[0]); datei.value = ''; };
    el('kcProgramAdd').onclick = vonHand;
    zeichneListe(); zeichneArchiv();
  }

  async function einlesen(datei) {
    const status = el('kcProgramImportState');
    status.textContent = `„${datei.name}“ wird gelesen …`;
    try {
      if (datei.size > 30 * 1024 * 1024) throw new Error('Die Datei ist größer als 30 MB.');
      const istPdf = /\.pdf$/i.test(datei.name) || datei.type === 'application/pdf';
      const zeilen = istPdf ? await pdfZeilen(new Uint8Array(await datei.arrayBuffer())) : csvZeilen(await datei.text());
      if (istPdf && zeilen.join('').trim().length < 20) throw new Error('Im PDF steht kein lesbarer Text – vermutlich ein eingescanntes Bild. Lösung: bei der Stadt nach der „online“-Fassung fragen oder die Termine unten von Hand eintragen.');
      const { programm: liste, jahr } = erkenne(zeilen, { jahr: new Date().getFullYear() });
      if (!liste.length) throw new Error('Im Dokument wurden keine Uhrzeiten gefunden. Lösung: prüfen, ob es das Bühnenprogramm ist; sonst Termine von Hand eintragen.');
      entwurf = liste.map((x) => ({ ...x, nehmen: true })); quelle = datei.name;
      const pruefen = liste.filter((x) => x.hinweis).length;
      status.textContent = `${liste.length} Programmpunkte erkannt (Jahr ${jahr}) aus „${datei.name}“.${pruefen ? ` ${pruefen} bitte prüfen (gelb markiert).` : ''} Bitte kontrollieren, dann übernehmen.`;
      zeichneEntwurf();
    } catch (e) {
      entwurf = []; zeichneEntwurf();
      status.textContent = `Einlesen nicht möglich: ${e.message}`;
      melde('error', `Prospektimport: ${e.message}`);
    }
  }

  function zeichneEntwurf() {
    const ziel = el('kcProgramImportTabelle');
    if (!entwurf.length) { ziel.innerHTML = ''; return; }
    const feld = (i, k, typ = 'text') => `<input data-i="${i}" data-k="${k}" type="${typ}" value="${esc(entwurf[i][k])}" style="width:100%">`;
    ziel.innerHTML = `<div style="overflow:auto;max-height:520px"><table class="kc-program-table" style="width:100%;border-collapse:collapse"><thead><tr>
      <th>✓</th><th>Datum</th><th>Von</th><th>Bis</th><th>Programmpunkt</th><th>Beschreibung</th><th>Ort</th></tr></thead><tbody>${entwurf.map((x, i) => `
      <tr style="${x.hinweis ? 'background:#fff4e5' : ''}" title="${esc(x.hinweis)}"><td><input type="checkbox" data-nehmen="${i}" ${x.nehmen ? 'checked' : ''}></td>
      <td>${feld(i, 'date', 'date')}</td><td>${feld(i, 'time', 'time')}</td><td>${feld(i, 'endTime', 'time')}</td><td>${feld(i, 'title')}</td><td>${feld(i, 'description')}</td><td>${feld(i, 'place')}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="toolbar" style="margin-top:8px"><button type="button" class="primary" id="kcProgramUebernehmen">✔ Ausgewählte übernehmen</button>
      <button type="button" id="kcProgramErsetzen">Programm dieses Jahres ersetzen …</button><button type="button" id="kcProgramVerwerfen">Verwerfen</button></div>`;
    ziel.querySelectorAll('[data-k]').forEach((f) => { f.oninput = () => { entwurf[+f.dataset.i][f.dataset.k] = f.value; }; });
    ziel.querySelectorAll('[data-nehmen]').forEach((f) => { f.onchange = () => { entwurf[+f.dataset.nehmen].nehmen = f.checked; }; });
    el('kcProgramUebernehmen').onclick = () => uebernehmen(false);
    el('kcProgramErsetzen').onclick = () => uebernehmen(true);
    el('kcProgramVerwerfen').onclick = () => { entwurf = []; zeichneEntwurf(); el('kcProgramImportState').textContent = 'Verworfen.'; };
  }

  function uebernehmen(ersetzen) {
    const gewaehlt = entwurf.filter((x) => x.nehmen && x.title && x.date && x.time);
    const ohne = entwurf.filter((x) => x.nehmen).length - gewaehlt.length;
    if (!gewaehlt.length) { melde('warning', 'Nichts zu übernehmen: es fehlen Datum, Uhrzeit oder Programmpunkt.'); return; }
    const jahre = [...new Set(gewaehlt.map((x) => x.date.slice(0, 4)))];
    if (ersetzen && !confirm(`Alle bisherigen Programmpunkte aus ${jahre.join(', ')} durch die ${gewaehlt.length} neuen ersetzen?\n\nProgrammpunkte anderer Jahre bleiben erhalten.`)) return;
    const liste = programm();
    if (ersetzen) global.settings.eventProgram = liste.filter((x) => !jahre.includes(String(x.date || '').slice(0, 4)));
    const vorhanden = new Set(programm().map((x) => `${x.date}|${x.time}|${String(x.title).toLowerCase()}`));
    let neu = 0, doppelt = 0;
    for (const x of gewaehlt) {
      const k = `${x.date}|${x.time}|${x.title.toLowerCase()}`;
      if (vorhanden.has(k)) { doppelt++; continue; }
      vorhanden.add(k);
      programm().push({ id: (global.crypto && crypto.randomUUID) ? crypto.randomUUID() : `p-${Date.now()}-${neu}`, date: x.date, time: x.time, endTime: x.endTime || '',
        title: x.title.trim(), description: (x.description || '').trim(), place: (x.place || '').trim(), active: true, source: quelle, importedAt: new Date().toISOString() });
      neu++;
    }
    programm().sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    speichern();
    entwurf = []; zeichneEntwurf(); zeichneListe();
    const text = `${neu} Programmpunkte übernommen${doppelt ? `, ${doppelt} waren schon vorhanden` : ''}${ohne ? `, ${ohne} ohne Datum/Uhrzeit/Titel übersprungen` : ''}. Der TV-Designer übernimmt sie beim nächsten Öffnen – danach „📺 An den Fernseher senden“.`;
    el('kcProgramImportState').textContent = text;
    melde('success', text);
  }

  function vonHand() {
    const titel = el('kcProgramTitle').value.trim();
    if (!titel || !el('kcProgramDate').value || !el('kcProgramTime').value) { melde('warning', 'Bitte Datum, Uhrzeit und Programmpunkt eintragen.'); return; }
    programm().push({ id: crypto.randomUUID(), date: el('kcProgramDate').value, time: el('kcProgramTime').value, endTime: el('kcProgramEnd').value, title: titel,
      description: el('kcProgramDesc').value.trim(), place: el('kcProgramPlace').value.trim(), active: true, source: 'von Hand' });
    programm().sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    speichern(); ['kcProgramTitle', 'kcProgramDesc'].forEach((id) => { el(id).value = ''; }); zeichneListe();
  }

  function zeichneListe() {
    const ziel = el('kcProgramList'); if (!ziel) return;
    const liste = programm();
    if (!liste.length) { ziel.innerHTML = '<p class="muted">Noch kein Programm eingetragen.</p>'; return; }
    const tage = {};
    liste.forEach((x, i) => { (tage[x.date] = tage[x.date] || []).push({ ...x, _i: i }); });
    ziel.innerHTML = Object.keys(tage).sort().map((d) => `<div style="margin:8px 0"><strong>${esc(tagText(d))}</strong>${tage[d].map((x) => `
      <div style="display:flex;gap:8px;align-items:center;padding:3px 0;${x.active === false ? 'opacity:.5' : ''}"><input type="checkbox" data-aktiv="${x._i}" ${x.active !== false ? 'checked' : ''} title="anzeigen">
      <span style="min-width:110px">${esc(x.time)}${x.endTime ? `–${esc(x.endTime)}` : ''}</span><span style="flex:1"><b>${esc(x.title)}</b>${x.description ? ` – ${esc(x.description)}` : ''}${x.place ? ` <i>(${esc(x.place)})</i>` : ''}</span>
      <button type="button" data-loeschen="${x._i}" title="löschen">🗑</button></div>`).join('')}</div>`).join('')
      + `<p class="muted">${liste.length} Programmpunkte · ${liste.filter((x) => x.active !== false).length} werden angezeigt.</p>`;
    ziel.querySelectorAll('[data-aktiv]').forEach((c) => { c.onchange = () => { programm()[+c.dataset.aktiv].active = c.checked; speichern(); zeichneListe(); }; });
    ziel.querySelectorAll('[data-loeschen]').forEach((b) => { b.onclick = () => { const x = programm()[+b.dataset.loeschen]; if (!confirm(`„${x.title}“ am ${tagText(x.date)} löschen?`)) return; programm().splice(+b.dataset.loeschen, 1); speichern(); zeichneListe(); }; });
  }

  async function zeichneArchiv() {
    const ziel = el('kcProgramArchiv'); if (!ziel) return;
    try {
      const d = await (await fetch('daten/werne-programm-2025.json', { cache: 'no-store' })).json();
      ziel.innerHTML = `<p class="muted">${esc(d.hinweis)} · Quelle: ${esc(d.quelle)} · <a href="${esc(d.offizielleSeite)}" target="_blank" rel="noopener">aktuelle Seite der Stadt</a></p>`
        + d.programm.map((x) => `<div>${esc(x.date)} ${esc(x.time)}–${esc(x.endTime)} · <b>${esc(x.title)}</b>${x.description ? ` – ${esc(x.description)}` : ''} <i>(${esc(x.place)})</i></div>`).join('');
    } catch (e) { ziel.textContent = 'Archiv nicht verfügbar.'; }
  }

  function init() { karten(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  global.KCTagesprogramm = { ...KCTagesprogramm, pdfZeilen, einlesen, zeichneListe, entwurf: () => entwurf };
})(typeof window !== 'undefined' ? window : globalThis);
