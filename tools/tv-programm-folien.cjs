/* TV-Präsentation Weihnachtsmarkt 2026 – Folien „Öffnungszeiten“, „Auf der Bühne (heute/morgen)“ und „Bühnenprogramm 2026“
 * (Betreiber 18.11.2026: „super ordentlich, gut lesbar … groß, leserlich, chronologisch, guter Hintergrund, klarer Kontrast“).
 * Daten: shared/kc-wm2026-programm.js (eine Quelle für TV, PC-Manager, DP2).
 *
 * In der Präsentation steht je Folie ein Platzhalter (@@oeffnung@@, @@heute@@, @@morgen@@, @@gesamt:1@@, @@gesamt:2@@);
 * das Skript unten setzt beim Anzeigen die Tafel ein – mit dem aktuellen Datum (Europe/Berlin):
 *   heute  = heutiger Markttag, sonst der nächste; laufender Auftritt hervorgehoben, vergangene abgeblendet
 *   morgen = der darauf folgende Markttag
 * Video-Fassung (?aufnahme=1): „heute/morgen“-Folien entfallen (das Video läuft an allen Tagen), Gesamtprogramm bleibt.
 */
'use strict';
const DATEN = require('../shared/kc-wm2026-programm.js');

const FOLIEN = { 'Öffnungszeiten 2026': 'oeffnung', 'Bühnenprogramm heute': 'heute', 'Bühnenprogramm morgen': 'morgen', 'Gesamtprogramm 2026': 'gesamt:1' };
const TITEL = { oeffnung: 'Öffnungszeiten', heute: 'Auf der Bühne', morgen: 'Auf der Bühne', 'gesamt:1': 'Bühnenprogramm 2026', 'gesamt:2': 'Bühnenprogramm 2026' };
const DAUER = { oeffnung: 10, heute: 12, morgen: 10, 'gesamt:1': 15, 'gesamt:2': 15 };

// Folien umbauen (im Projekt der Präsentation, vor allen übrigen Anpassungen)
function folienUmbauen(projekt, log) {
  const slides = projekt.slides;
  const gesamt = slides.find((s) => s.name === 'Gesamtprogramm 2026');
  if (gesamt && !slides.some((s) => s.name === 'Gesamtprogramm 2026 · Teil 2')) {
    const kopie = JSON.parse(JSON.stringify(gesamt));
    kopie.id = `${gesamt.id}-teil2`; kopie.name = 'Gesamtprogramm 2026 · Teil 2';
    kopie.items.forEach((i, n) => { i.id = `${i.id || 'item'}-t2-${n}`; });
    slides.splice(slides.indexOf(gesamt) + 1, 0, kopie);
  }
  for (const folie of slides) {
    const art = FOLIEN[folie.name] || (folie.name === 'Gesamtprogramm 2026 · Teil 2' ? 'gesamt:2' : null);
    if (!art) continue;
    const titel = folie.items.find((i) => i.originalRole === 'title');
    if (titel) titel.text = TITEL[art];
    const tabelle = folie.items.find((i) => i.type === 'table');
    const vorlage = tabelle || titel;
    // alte Tabelle (Beispieldaten) und Unterzeile „Programm · Datum“ entfernen
    folie.items = folie.items.filter((i) => i.type !== 'table' && i.name !== 'Textfeld 2');
    folie.items.splice(folie.items.indexOf(titel) + 1, 0, { ...vorlage, id: `${folie.id}-programm`, name: 'Programmtafel', type: 'text',
      originalRole: 'kcProgramm', text: `@@${art}@@`, x: 70, y: 138, w: 1140, h: 512, font: 24, color: '#fff8e8', bg: 'transparent', align: 'left',
      bold: false, radius: 0, stroke: 'transparent', strokeWidth: 0, textScaleMode: 'fixed', opacity: 100, rotation: 0, shadowEnabled: false,
      tableData: undefined, tableRows: undefined, tableCols: undefined });
    folie.duration = DAUER[art];
    if (art === 'heute' || art === 'morgen') folie.kcNurLive = true;
    folie.rotation = { ...(folie.rotation || {}), enabled: true };
    log.push(`„${folie.name}“: Programmtafel ${art}`);
  }
}

// ---- Laufzeit in der Präsentation (wird als Text eingebaut) ----
function programmLaufzeit(D) {
  var stage = document.getElementById('tvStage'); if (!stage) return;
  var AUF = /[?&]aufnahme=1(&|$)/.test(location.search);
  var MARKTTAGE = []; D.PROGRAMM.forEach(function (p) { if (MARKTTAGE.indexOf(p.datum) < 0) MARKTTAGE.push(p.datum); }); MARKTTAGE.sort();
  function heute() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }); }
  function jetzt() { var t = new Date().toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hour12: false }).split(':'); return (+t[0]) * 60 + (+t[1]); }
  function min(hhmm) { var t = hhmm.split(':'); return (+t[0]) * 60 + (+t[1]); }
  function datum(iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function lang(iso) { return datum(iso).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }); }
  function kurz(iso) { var d = datum(iso); return { wt: d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', ''), dm: d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }).replace(/\.?$/, '.') }; }
  function plusTag(iso) { var d = datum(iso); d.setDate(d.getDate() + 1); return d.toLocaleDateString('sv-SE'); }
  function punkte(iso) { return D.PROGRAMM.filter(function (p) { return p.datum === iso; }).sort(function (a, b) { return min(a.von) - min(b.von); }); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function naechster(ab) { for (var i = 0; i < MARKTTAGE.length; i++) if (MARKTTAGE[i] >= ab) return MARKTTAGE[i]; return null; }
  // heute/morgen: welcher Tag, mit welcher Überschrift
  function tagFuer(art) {
    var h = heute(), erster = naechster(h);
    if (!erster) return null;
    if (art === 'heute') return { iso: erster, kopf: erster === h ? 'Heute' : (erster === plusTag(h) ? 'Morgen' : 'Ab'), live: erster === h };
    var zweiter = naechster(plusTag(erster)); if (!zweiter) return null;
    return { iso: zweiter, kopf: zweiter === plusTag(h) ? 'Morgen' : (erster === h ? 'Danach' : 'Danach'), live: false };
  }
  function tafel(art) {
    var t = el('div', 'kcPt' + (art.indexOf('gesamt') === 0 ? '' : ' kcPkurz'));
    if (art === 'oeffnung') {
      var kopf = el('div', 'kcPkopf'); kopf.appendChild(el('span', 'kcPdatum', D.ZEITRAUM.text)); t.appendChild(kopf);
      var h = heute(), wt = datum(h).getDay(), offen = h >= D.ZEITRAUM.von && h <= D.ZEITRAUM.bis;
      D.OEFFNUNG.forEach(function (o) {
        var z = el('div', 'kcPzeile kcPoe' + (offen && o.wochentage.indexOf(wt) >= 0 ? ' kcPjetzt' : ''));
        z.appendChild(el('span', 'kcPtag', o.tage)); z.appendChild(el('span', 'kcPzeit', o.von + ' – ' + o.bis + ' Uhr'));
        if (offen && o.wochentage.indexOf(wt) >= 0 && !AUF) z.appendChild(el('span', 'kcPmarke', 'heute'));
        t.appendChild(z);
      });
      return t;
    }
    if (art === 'heute' || art === 'morgen') {
      var tag = tagFuer(art);
      if (!tag) { t.appendChild(el('div', 'kcPleer', MARKTTAGE.indexOf(heute()) >= 0 ? 'Heute ist der letzte Tag des Weihnachtsmarkts – vielen Dank für Ihren Besuch!' : 'Das Bühnenprogramm 2026 ist vorbei – vielen Dank für Ihren Besuch!')); return t; }
      var k = el('div', 'kcPkopf'); k.appendChild(el('span', 'kcPdatum', (tag.kopf === 'Ab' ? 'Ab ' : tag.kopf + ' · ') + lang(tag.iso))); t.appendChild(k);
      var jetztMin = jetzt();
      punkte(tag.iso).forEach(function (p) {
        var laeuft = tag.live && jetztMin >= min(p.von) && jetztMin < min(p.bis), vorbei = tag.live && jetztMin >= min(p.bis);
        var z = el('div', 'kcPzeile' + (laeuft ? ' kcPjetzt' : '') + (vorbei ? ' kcPvorbei' : ''));
        z.appendChild(el('span', 'kcPzeit', p.von + ' – ' + p.bis));
        var n = el('span', 'kcPname', p.titel); if (p.ort === 'Kirche' && !/Kirche/.test(p.titel)) n.appendChild(el('small', '', ' · in der Kirche')); z.appendChild(n);
        if (laeuft) z.appendChild(el('span', 'kcPmarke', 'jetzt'));
        t.appendChild(z);
      });
      return t;
    }
    // Gesamtprogramm, Teil 1 (erste Hälfte der Tage) / Teil 2
    var teil = art === 'gesamt:2' ? 2 : 1, haelfte = Math.ceil(MARKTTAGE.length / 2);
    var tage = teil === 1 ? MARKTTAGE.slice(0, haelfte) : MARKTTAGE.slice(haelfte);
    var hd = heute();
    t.classList.add('kcPgesamt');
    tage.forEach(function (iso) {
      var z = el('div', 'kcPtagzeile' + (iso === hd && !AUF ? ' kcPjetzt' : '')), kz = kurz(iso), links = el('div', 'kcPtaglinks');
      links.appendChild(el('b', '', kz.wt)); links.appendChild(el('span', '', kz.dm)); z.appendChild(links);
      // drei feste Spalten (Betreiber 18.11.2026: „ruhiger – Zeiten untereinander“): links der erste Programmpunkt,
      // Mitte die weiteren am Tag, rechts das Abendprogramm (ab 18:00). Mehrere Punkte einer Spalte stehen untereinander.
      var ps = punkte(iso), abend = ps.filter(function (p) { return min(p.von) >= 18 * 60; }), tags = ps.filter(function (p) { return min(p.von) < 18 * 60; });
      [tags.slice(0, 1), tags.slice(1), abend].forEach(function (liste) {
        var sp = el('div', 'kcPspalte');
        liste.forEach(function (p) { var s = el('div', 'kcPpunkt'); s.appendChild(el('i', '', p.von)); s.appendChild(el('span', '', p.titel)); sp.appendChild(s); });
        z.appendChild(sp);
      });
      t.appendChild(z);
    });
    return t;
  }
  function setzen() {
    stage.querySelectorAll('.tvItem[data-original-role=kcProgramm]:not([data-kc-p])').forEach(function (e) {
      var m = /@@([a-z:0-9]+)@@/.exec(e.textContent || ''); if (!m) return;
      e.textContent = ''; e.appendChild(tafel(m[1])); e.setAttribute('data-kc-p', m[1]);
    });
  }
  // Laufschrift: „Heute auf der Bühne …“ (nur am Fernseher, nicht im Video)
  window.KC_PROGRAMM_LAUFSCHRIFT = function () {
    var h = heute(), tag = naechster(h); if (!tag) return '';
    var liste = punkte(tag).map(function (p) { return p.von + ' ' + p.titel; }).join(' · ');
    return (tag === h ? 'Heute auf der Bühne: ' : 'Bühnenprogramm ab ' + lang(tag) + ': ') + liste;
  };
  new MutationObserver(setzen).observe(stage, { childList: true }); setzen();
}

const STIL = '<style>'
  + '.tvItem[data-original-role=kcProgramm]{display:block!important;padding:0!important;white-space:normal!important;text-shadow:none!important;overflow:visible!important}'
  + '.kcPt{height:100%;box-sizing:border-box;background:rgba(14,9,7,.88);border:2px solid rgba(217,170,58,.7);border-radius:20px;padding:22px 34px;display:flex;flex-direction:column;gap:10px;box-shadow:0 10px 34px rgba(0,0,0,.55)}'
  + '.kcPkurz{height:auto;max-height:100%;gap:12px;padding:22px 34px 26px}'
  + '.kcPkopf{display:flex;justify-content:center;margin-bottom:6px}'
  + '.kcPdatum{color:#ffd76a;font-size:34px;font-weight:700;letter-spacing:.5px;border-bottom:2px solid rgba(217,170,58,.55);padding:0 18px 6px}'
  + '.kcPzeile{display:grid;grid-template-columns:270px 1fr auto;align-items:center;gap:22px;padding:16px 20px;border-radius:12px;background:rgba(255,248,232,.06)}'
  + '.kcPoe{grid-template-columns:1fr auto auto;padding:14px 22px}'
  + '.kcPzeit{color:#ffd76a;font-size:40px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}'
  + '.kcPtag,.kcPname{color:#fff8e8;font-size:42px;font-weight:700;line-height:1.1}'
  + '.kcPname small{font-size:28px;font-weight:400;color:#f3e9dc}'
  + '.kcPjetzt{background:rgba(217,170,58,.30);outline:3px solid #ffd76a}'
  + '.kcPvorbei{opacity:.42}'
  + '.kcPmarke{background:#741521;color:#fff;font-size:24px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:6px 14px;border-radius:999px}'
  + '.kcPfuss{margin-top:8px;text-align:center;color:#f3e9dc;font-size:24px;font-style:italic}'
  + '.kcPleer{margin:auto;color:#fff8e8;font-size:40px;text-align:center}'
  + '.kcPgesamt{padding:16px 26px;gap:8px}'
  + '.kcPtagzeile{flex:1;display:grid;grid-template-columns:76px 1.05fr 1.2fr 1fr;align-items:center;column-gap:18px;padding:6px 14px;border-radius:12px;background:rgba(255,248,232,.06)}'
  + '.kcPtaglinks{display:flex;flex-direction:column;line-height:1.05}.kcPtaglinks b{color:#ffd76a;font-size:32px}.kcPtaglinks span{color:#f3e9dc;font-size:22px}'
  + '.kcPspalte{display:flex;flex-direction:column;justify-content:center;gap:4px;color:#fff8e8;font-size:24px;font-weight:600;line-height:1.15}'
  + '.kcPpunkt{display:grid;grid-template-columns:70px 1fr;align-items:baseline}'
  + '.kcPpunkt i{font-style:normal;color:#ffd76a;font-variant-numeric:tabular-nums}'
  + '</style>';

function laufzeitHtml() {
  const daten = JSON.stringify({ PROGRAMM: DATEN.PROGRAMM, OEFFNUNG: DATEN.OEFFNUNG, ZEITRAUM: DATEN.ZEITRAUM }).replace(/</g, '\\u003c');
  return STIL + `<script>(${programmLaufzeit.toString()})(${daten});</script>`;
}

// Video (?aufnahme=1): „heute/morgen“-Folien sofort beim Laden ausblenden (vor dem ersten Durchlauf)
const NUR_LIVE_AUSBLENDEN = ';if(/[?&]aufnahme=1(&|$)/.test(location.search))window.KC_DESIGNER_MARKET_PRESENTATION.slides.forEach(function(s){if(s.kcNurLive)s.rotation=Object.assign({},s.rotation,{enabled:false})});';

module.exports = { folienUmbauen, laufzeitHtml, programmLaufzeit, NUR_LIVE_AUSBLENDEN, DATEN };
