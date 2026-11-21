/* Kasse – Knopf „📅 Programm“ in der Kopfzeile (Tagesprogramm am Stand).
 * 0.3.0 (18.11.2026, Betreiber: „auf der Kasse gibt es oben einen Button Programm, dort müsste eigentlich das Programm abrufbar sein“):
 *   - ohne geladene Programmdatei: eingebautes Rahmenprogramm Weihnachtsmarkt 2026 (shared/kc-wm2026-programm.js – dieselbe Quelle
 *     wie TV-Präsentation, PC-Manager, DP2); eine per Hand geladene, NEUERE Programmdatei (.kcprogram) hat Vorrang
 *   - kein Programm heute: nächster Programmtag statt „kein Programm“; „Ganzes Programm“ zeigt alle Tage; Öffnungszeiten heute
 *   - Datum/Uhrzeit nach deutscher Zeit (vorher UTC-Datum: kurz nach Mitternacht falscher Tag)
 *   - ohne Bewertung (Rahmenprogramm) keine „mittel“-Anzeige */
(function () {
  'use strict';
  const VERSION = '0.4.0', KEY = 'kc_event_program_package_v1', core = window.KCEventProgramExchangeCore;
  let pkg = null, hold = 0, long = false, gewaehlt = null; // gewaehlt: angezeigter Programmtag (Blättern)
  const $ = (id) => document.getElementById(id);
  const safe = (v) => String(v || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const heute = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  const jetzt = () => new Date().toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hour12: false });
  const datum = (iso) => { const p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); };
  const lang = (iso) => datum(iso).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  function gespeichert() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
  // eingebautes Rahmenprogramm als Programmpaket (ohne Bewertung)
  function eingebaut() {
    const P = window.KC_WM2026_PROGRAMM; if (!P || !core) return null;
    const p = core.create({ program: P.PROGRAMM.map((x) => ({ id: x.id, date: x.datum, time: x.von, endTime: x.bis, title: x.titel, place: x.ort, active: true })) },
      { program: true, rating: false, weather: false, staffing: false });
    p.kcEingebaut = P.PROGRAMM_STAND; return p;
  }
  function waehlen() {
    const s = gespeichert(), e = eingebaut();
    if (s && (!e || String(s.createdAt || '') >= '2026-11-18')) return s;   // neuere Programmdatei von Hand hat Vorrang
    return e || s;
  }
  const bewertet = () => pkg?.selection?.rating !== false && !pkg?.kcEingebaut;
  const alle = () => (pkg?.program || []).filter((x) => x.active !== false).sort((a, b) => ((a.date || '') + (a.time || '')).localeCompare((b.date || '') + (b.time || '')));
  const tage = () => [...new Set(alle().map((x) => x.date).filter(Boolean))].sort();
  function anzeigeTag() { const h = heute(), t = tage(); if (alle().some((x) => !x.date || x.date === h)) return h; return t.find((d) => d > h) || null; }
  function zeilenFuer(tag) { return alle().filter((x) => (!x.date && tag === heute()) || x.date === tag); }
  function aktiv() {
    const h = heute(), now = jetzt(), rows = zeilenFuer(h);
    return rows.find((x) => (x.time || '00:00') <= now && (!x.endTime || now < x.endTime)) || rows.find((x) => (x.time || '') >= now) || null;
  }
  function oeffnungHeute() {
    const P = window.KC_WM2026_PROGRAMM, h = heute(); if (!P || h < P.ZEITRAUM.von || h > P.ZEITRAUM.bis) return '';
    const o = P.OEFFNUNG.find((x) => x.wochentage.includes(datum(h).getDay())); return o ? `Weihnachtsmarkt heute offiziell ${o.von} – ${o.bis} Uhr (Stand-Zeiten: DP2)` : '';
  }
  function updateButton() {
    const b = $('kcProgramStatusBtn'); if (!b) return;
    const row = aktiv(), impact = row?.impact || 'normal';
    b.dataset.impact = bewertet() && row ? core.color(impact) : 'none';
    b.innerHTML = `📅<small>${row ? (bewertet() ? core.label(impact) : safe(row.time)) : 'Programm'}</small>`;
    b.title = row ? `${row.time}${row.endTime ? '–' + row.endTime : ''} ${row.title}${bewertet() ? ' (' + core.label(impact) + ')' : ''}` : 'Programm ansehen';
  }
  function zeile(x, markiert) {
    return `<div class="kc-program-row ${markiert ? 'active' : ''}" data-impact="${bewertet() ? core.color(x.impact) : 'none'}"><time>${safe(x.time)}${x.endTime ? '–' + safe(x.endTime) : ''}</time><strong>${safe(x.title)}</strong>${bewertet() ? `<b>${safe(core.label(x.impact))}</b>` : '<b></b>'}<small>${safe(x.place)}</small></div>`;
  }
  // 0.4.0 (21.11.2026, Betreiber: „es fehlen Blätterpfeile … genau wie beim Dienstplan“): Tagesleiste wie im
  // Dienstplan - erster/voriger/nächster/letzter Programmtag und „Heute“. Geblättert wird über die Tage mit Programm.
  function zielTag(art, von) {
    const t = tage(), g = von || anzeigeTag() || heute();
    if (!t.length) return null;
    if (art === 'erst') return t[0];
    if (art === 'letzt') return t[t.length - 1];
    if (art === 'vor') return [...t].reverse().find((d) => d < g) || null;
    if (art === 'nach') return t.find((d) => d > g) || null;
    if (art === 'heute') return anzeigeTag();
    return null;
  }
  function leisteSetzen(tag, modus) {
    const text = $('kcProgramTagText');
    if (text) text.textContent = modus === 'alle' ? 'Alle Tage' : (tag ? `${tag === heute() ? 'Heute · ' : ''}${lang(tag)}` : '–');
    const bezug = modus === 'alle' ? null : tag;
    document.querySelectorAll('#kcProgramDialog [data-tag]').forEach((b) => {
      const z = zielTag(b.dataset.tag, bezug || undefined);
      b.disabled = b.dataset.tag === 'heute' ? (!z || modus === false) : (!z || (modus !== 'alle' && z === tag));
    });
  }
  function zeigeTag(tag) {
    gewaehlt = tag; const h = heute(), akt = aktiv(), list = zeilenFuer(tag);
    $('kcProgramDialogTitle').textContent = 'Tagesprogramm';
    const oe = tag === h ? oeffnungHeute() : '';
    $('kcPosProgramList').innerHTML = (oe ? `<p class="kc-program-open">${safe(oe)}</p>` : '') + (list.map((x) => zeile(x, x === akt)).join('') || '<p>Für diesen Tag ist kein Programm hinterlegt.</p>');
    leisteSetzen(tag, true);
    if (!$('kcProgramDialog').open) $('kcProgramDialog').showModal();
  }
  function show(modus) {
    // modus: false = aktuell + danach, true = Tag mit Bewertung (langer Druck), 'alle' = ganzes Programm
    const tag = anzeigeTag(), h = heute(), akt = aktiv();
    let titel, html;
    if (modus === 'alle') {
      titel = 'Ganzes Programm';
      html = tage().map((d) => `<h3 class="kc-program-day${d === h ? ' heute' : ''}">${safe(lang(d))}${d === h ? ' · heute' : ''}</h3>` + zeilenFuer(d).map((x) => zeile(x, x === akt)).join('')).join('') || '<p>Kein Programm hinterlegt.</p>';
    } else if (!tag) {
      titel = 'Programm'; html = '<p>Kein weiteres Programm hinterlegt.</p>';
    } else {
      const list = zeilenFuer(tag), now = jetzt(), start = tag === h ? Math.max(0, list.findIndex((x) => (x.endTime || x.time) >= now)) : 0;
      const shown = modus === true || tag !== h ? list : list.slice(start, start + 2);
      titel = tag === h ? (modus === true ? 'Tagesprogramm' : 'Aktuell und anschließend') : `Nächster Programmtag: ${lang(tag)}`;
      html = shown.map((x) => zeile(x, x === akt)).join('') || '<p>Für heute ist kein Programm hinterlegt.</p>';
    }
    const oe = oeffnungHeute();
    $('kcProgramDialogTitle').textContent = titel;
    $('kcPosProgramList').innerHTML = (oe ? `<p class="kc-program-open">${safe(oe)}</p>` : '') + html;
    $('kcProgramSource').textContent = pkg?.kcEingebaut ? 'Rahmenprogramm Weihnachtsmarkt 2026 (eingebaut)' : (pkg ? 'Programmdatei vom ' + new Date(pkg.createdAt).toLocaleDateString('de-DE') : '');
    gewaehlt = modus === 'alle' ? null : tag; leisteSetzen(tag, modus);
    if (!$('kcProgramDialog').open) $('kcProgramDialog').showModal();
    if (modus === 'alle') { const t = document.querySelector('#kcPosProgramList .kc-program-day.heute'); if (t) t.scrollIntoView({ block: 'start' }); }
  }
  async function load(file) {
    try {
      const value = JSON.parse(await file.text()), check = core.verify(value); if (!check.ok) throw Error(check.error);
      localStorage.setItem(KEY, JSON.stringify(check.package)); pkg = waehlen(); updateButton(); show(true);
    } catch (e) { alert('Programmdatei nicht übernommen: ' + e.message); } finally { $('kcProgramFile').value = ''; }
  }
  function init() {
    pkg = waehlen();
    const header = document.querySelector('.header-status');
    if (!header || $('kcProgramStatusBtn')) return;
    const button = document.createElement('button');
    button.id = 'kcProgramStatusBtn'; button.className = 'header-tool-button kc-program-status'; button.type = 'button';
    button.innerHTML = '📅<small>Programm</small>'; header.prepend(button);
    const dialog = document.createElement('dialog'); dialog.id = 'kcProgramDialog'; dialog.className = 'kc-program-dialog';
    // Schließen-Knopf mit Klasse icon-close: sonst setzt kc-oberflaechen-anwenden.js ein ZWEITES Kreuz darüber
    // (Betreiber 21.11.2026: „ganz rechts überlappen sich 2 Buttons“).
    dialog.innerHTML = '<div class="kc-program-head"><h2 id="kcProgramDialogTitle">Tagesprogramm</h2><button type="button" class="icon-close" data-close aria-label="Schließen">×</button></div>'
      + '<div class="kc-tagnav kc-program-nav">'
      + '<button type="button" data-tag="erst" aria-label="Erster Programmtag" title="Erster Programmtag">⏮</button>'
      + '<button type="button" data-tag="vor" aria-label="Voriger Programmtag" title="Voriger Programmtag">‹</button>'
      + '<div class="kc-tagnav-mitte"><b id="kcProgramTagText">–</b><button type="button" data-tag="heute">Heute</button></div>'
      + '<button type="button" data-tag="nach" aria-label="Nächster Programmtag" title="Nächster Programmtag">›</button>'
      + '<button type="button" data-tag="letzt" aria-label="Letzter Programmtag" title="Letzter Programmtag">⏭</button></div>'
      + '<div id="kcPosProgramList"></div><div class="kc-program-import"><button id="kcProgramAll" type="button">Ganzes Programm</button>'
      + '<input id="kcProgramFile" type="file" accept=".kcprogram,application/json"><button id="kcProgramLoad" type="button">Programmdatei laden</button>'
      + '<small id="kcProgramSource"></small></div>';
    document.body.append(dialog);
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    $('kcProgramAll').onclick = () => show('alle');
    dialog.querySelectorAll('[data-tag]').forEach((b) => { b.onclick = () => { const z = b.dataset.tag === 'heute' ? anzeigeTag() : zielTag(b.dataset.tag, gewaehlt || undefined); if (!z) return; if (b.dataset.tag === 'heute') show(false); else zeigeTag(z); }; });
    $('kcProgramLoad').onclick = () => $('kcProgramFile').click();
    $('kcProgramFile').onchange = (e) => e.target.files[0] && load(e.target.files[0]);
    button.onpointerdown = () => { long = false; hold = setTimeout(() => { long = true; show(true); }, 650); };
    button.onpointerup = () => { clearTimeout(hold); if (!long) show(false); };
    button.onpointercancel = () => clearTimeout(hold);
    updateButton(); setInterval(updateButton, 60000);
    window.addEventListener('storage', (e) => { if (e.key === KEY) { pkg = waehlen(); updateButton(); } });
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
  window.KCPOSEventProgram = { version: VERSION, read: () => pkg, render: updateButton, show, zeigeTag };
})();
