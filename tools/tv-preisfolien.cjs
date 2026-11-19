/* TV-Präsentation Weihnachtsmarkt 2026 – Preisfolien als Speisekarte (Betreiber 19.11.2026: „die Preislisten gefallen mir nicht,
 * alles zu klein geschrieben. Allergene in Zahlen und Buchstaben dahinter (klein, in Klammern), unten nur eine kleine Legende.
 * Spaltenbreiten: erste Spalte breiter, dann weiter zum Preis hin rücken, evtl. kleine Punkte …… zum Preis.“)
 *
 * Statt Tabelle (gleich breite Spalten) und Allergenkasten: je Folie eine Tafel – Name groß, Kennzeichnung klein in Klammern,
 * Beschreibung klein darunter, Pünktchen bis zum Preis, unten eine kleine Legende (nur die Kennzeichen dieser Folie) und Pfand/Außer Haus.
 * Kennzeichnung wie auf den gedruckten Preislisten (LMIV-Buchstaben, Zusatzstoff-Ziffern).
 */
'use strict';

// Reihenfolge wie auf den gedruckten Preislisten: erst Allergene (Buchstaben), dann Zusatzstoffe (Ziffern)
const LEGENDE = [['A', 'Gluten'], ['C', 'Ei'], ['D', 'Fisch'], ['G', 'Milch'], ['H', 'Schalenfrüchte'], ['I', 'Sellerie'], ['J', 'Senf'], ['L', 'Sulfite'],
  ['2', 'mit Konservierungsstoff'], ['3', 'mit Antioxidationsmittel']];
const KENNZEICHEN = {
  'Roter Winzerglühwein': 'L, 2, 3', 'Weißer Winzerglühwein': 'L, 2, 3', 'Eierlikörpunsch': 'C, G, L', 'Feuerzangenbowle': 'L',
  'Grünkohl a la Köcheclub': 'A, I, J, 2, 3', 'Grünkohl a la Köcheclub mit Mettendchen': 'A, I, J, 2, 3',
  'Sauerkrauteintopf': 'A, I, 2, 3', 'Sauerkrauteintopf mit Mettendchen': 'A, I, J, 2, 3', 'Mettendchen': 'J, 2, 3',
  'Kartoffeln mit Kartoffelcreme': 'C, G, J, 2', 'Kartoffeln mit Heringsstipp': 'C, D, G, J',
};
const PFAND = 'Pfand: 2,00 € je Glas · Feuerzangenbowle zusätzlich 2,00 € für die Feuerzange';
const AUSSER_HAUS = 'Außer Haus: Thermobecher für Speisen zum Mitnehmen 1,00 €';

// zeilen: tableData der Preisfolie (Kopfzeile + Artikel), schon bereinigt (Komma, Mettendchen …)
function tafelDaten(folienName, zeilen) {
  const kopf = zeilen[0] || [], artikel = zeilen.slice(1).filter((r) => r && r[0] && (r[0].text || '').trim() && (r[2] && (r[2].text || '').trim()));
  // Original-Folien heißen noch „mit Mettwurst“ (Betreiber 16.11.2026: überall „Mettendchen“)
  const sauber = (t) => String(t || '').replace(/\s+/g, ' ').trim().replace(/Mettwurst/g, 'Mettendchen');
  const posten = artikel.map((r) => ({ name: sauber(r[0].text), info: sauber(r[1] && r[1].text),
    preis: r[2].text.trim().replace(/\s*€$/, '') + ' €', kz: KENNZEICHEN[sauber(r[0].text)] || '' }));
  const benutzt = new Set(posten.flatMap((p) => p.kz.split(',').map((x) => x.trim()).filter(Boolean)));
  const legende = LEGENDE.filter(([k]) => benutzt.has(k)).map(([k, t]) => `${k} ${t}`).join(' · ');
  const getraenke = /Getränke/.test(folienName);
  return { abschnitt: (kopf[0] && kopf[0].text) || (getraenke ? 'Getränke' : 'Speisen'), posten, legende,
    fuss: [(getraenke ? PFAND : AUSSER_HAUS) + ' · Spuren und weitere Angaben: Allergen-Aushang am Stand'] };
}

// Folie umbauen: Tabelle und Allergenkasten raus, eine Tafel rein
function folieUmbauen(folie, zeilen, log) {
  const daten = tafelDaten(folie.name, zeilen);
  const vorlage = folie.items.find((i) => i.type === 'table');
  folie.items = folie.items.filter((i) => i.type !== 'table' && i.originalRole !== 'allergenHinweis');
  const titel = folie.items.find((i) => i.originalRole === 'title');
  folie.items.splice(folie.items.indexOf(titel) + 1, 0, { ...vorlage, id: `${folie.id}-preise`, name: 'Preistafel', type: 'text', originalRole: 'kcPreise',
    text: '@@PL@@' + JSON.stringify(daten), x: 70, y: 140, w: 1140, h: 515, font: 24, color: '#fff8e8', bg: 'transparent', align: 'left', bold: false,
    radius: 0, stroke: 'transparent', strokeWidth: 0, textScaleMode: 'fixed', opacity: 100, rotation: 0, shadowEnabled: false,
    tableData: undefined, tableRows: undefined, tableCols: undefined });
  log.push(`„${folie.name}“: Speisekarten-Tafel (${daten.posten.length} Posten, Legende ${daten.legende || '–'})`);
  return daten;
}

// ---- Laufzeit in der Präsentation ----
function preisLaufzeit() {
  var stage = document.getElementById('tvStage'); if (!stage) return;
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function tafel(d) {
    var t = el('div', 'kcPl');
    var k = el('div', 'kcPlKopf'); k.appendChild(el('span', '', d.abschnitt)); k.appendChild(el('span', '', 'Preis')); t.appendChild(k);
    var liste = el('div', 'kcPlListe');
    d.posten.forEach(function (p) {
      var z = el('div', 'kcPlZeile'), oben = el('div', 'kcPlOben'), n = el('span', 'kcPlName', p.name);
      if (p.kz) n.appendChild(el('small', 'kcPlKz', ' (' + p.kz + ')'));
      oben.appendChild(n); oben.appendChild(el('span', 'kcPlPunkte')); oben.appendChild(el('span', 'kcPlPreis', p.preis));
      z.appendChild(oben); if (p.info) z.appendChild(el('div', 'kcPlInfo', p.info)); liste.appendChild(z);
    });
    t.appendChild(liste);
    var f = el('div', 'kcPlFuss');
    if (d.legende) f.appendChild(el('div', 'kcPlLeg', d.legende));
    d.fuss.forEach(function (x) { f.appendChild(el('div', '', x)); });
    t.appendChild(f);
    return t;
  }
  // passt alles? sonst Schrift schrittweise kleiner (bleibt groß bei wenigen Posten)
  function einpassen(e, t) {
    for (var s = 1; s > 0.62; s -= 0.04) { t.style.setProperty('--s', s.toFixed(2)); if (t.scrollHeight <= e.clientHeight + 1 && t.scrollWidth <= e.clientWidth + 1) return; }
  }
  function setzen() {
    stage.querySelectorAll('.tvItem[data-original-role=kcPreise]:not([data-kc-pl])').forEach(function (e) {
      var roh = e.textContent || '', i = roh.indexOf('@@PL@@'); if (i < 0) return;
      var d; try { d = JSON.parse(roh.slice(i + 6)); } catch (x) { return; }
      e.textContent = ''; e.style.fontSize = ''; var t = tafel(d); e.appendChild(t); e.setAttribute('data-kc-pl', '1'); einpassen(e, t);
    });
  }
  new MutationObserver(setzen).observe(stage, { childList: true }); setzen();
}

const STIL = '<style>'
  + '.tvItem[data-original-role=kcPreise]{display:block!important;padding:0!important;white-space:normal!important;text-shadow:none!important;overflow:hidden!important}'
  + '.kcPl{--s:1;height:100%;box-sizing:border-box;background:rgba(14,9,7,.86);border:2px solid rgba(217,170,58,.7);border-radius:20px;padding:calc(16px*var(--s)) 34px calc(12px*var(--s));display:flex;flex-direction:column;box-shadow:0 10px 34px rgba(0,0,0,.55)}'
  + '.kcPlKopf{display:flex;justify-content:space-between;color:#ffd76a;font-size:calc(22px*var(--s));font-weight:700;letter-spacing:1.5px;text-transform:uppercase;border-bottom:2px solid rgba(217,170,58,.55);padding-bottom:6px}'
  + '.kcPlListe{flex:1;display:flex;flex-direction:column;justify-content:space-evenly;gap:calc(6px*var(--s));padding:calc(6px*var(--s)) 0}'
  + '.kcPlOben{display:flex;align-items:baseline;gap:12px}'
  + '.kcPlName{color:#fff8e8;font-size:calc(42px*var(--s));font-weight:700;line-height:1.1;flex:0 1 auto}'
  + '.kcPlKz{color:#e9c46a;font-size:calc(22px*var(--s));font-weight:600;white-space:nowrap}'
  + '.kcPlPunkte{flex:1 1 40px;min-width:40px;border-bottom:4px dotted rgba(233,196,106,.65);transform:translateY(-8px)}'
  + '.kcPlPreis{color:#ffd76a;font-size:calc(44px*var(--s));font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums}'
  + '.kcPlInfo{color:#f3e9dc;font-size:calc(22px*var(--s));opacity:.88;margin-top:2px;line-height:1.2}'
  + '.kcPlFuss{border-top:1px solid rgba(217,170,58,.45);padding-top:calc(6px*var(--s));color:#f3e9dc;font-size:calc(16px*var(--s));line-height:1.35}'
  + '.kcPlLeg{color:#e9c46a}'
  + '</style>';

function laufzeitHtml() { return STIL + `<script>(${preisLaufzeit.toString()})();</script>`; }

module.exports = { folieUmbauen, tafelDaten, laufzeitHtml, KENNZEICHEN, LEGENDE };
