#!/usr/bin/env node
/* Weihnachtsmarkt 2026 – TV-Präsentation „Version A“ → Endversion
 *
 * Grundlage: index.html aus Sire65/WM-Pr-s. (Sieger der Mitglieder-Umfrage, 7 von 12 Stimmen).
 * Der Betreiber hat am 17.11.2026 festgelegt:
 *   • neues Rathaus-Bild (rathaus-werne-weihnachtsmarkt-v2.jpg) als Hintergrund aller Folien
 *   • einheitliche Überschriften, Abstände und Zierelemente
 *   • Preislisten mit den Preisen der Kasse, darunter Allergene/Zusatzstoffe je Artikel und die Pfandregeln
 *   • Mitgliederfolien genau so, wie es jedes Mitglied in der Spruch-Auswahl gewählt hat
 *     (Supabase kc_wm_spruch_zuordnung): Name, Spruch, mit/ohne Foto. Wer abgelehnt oder nicht
 *     geantwortet hat, wird ausgeblendet (nicht gelöscht – im Designer wieder einschaltbar).
 *   • keine Umfrage mehr: kein „Fertig – zur Umfrage“-Knopf, kein Anhalten auf der Schlussfolie
 * Am 18.11.2026 (keine aktuellen Fotos bekommen): Standard ist jetzt OHNE Fotos –
 *   • Mannschaftsfolie nur Text („Köcheclub Werne – seit 1991 in Werne“), kein Gruppenbild
 *   • Mitgliederfolien nur Vorname und gewählter Spruch, kein Foto
 *   Die Fassung mit Fotos (17.11.2026) entsteht weiter mit KC_TV_MIT_FOTOS=1 (Tags mit-fotos-2026-11-17).
 * Öffnungszeiten und Gesamtprogramm bleiben vorerst unverändert (Angaben fehlen noch).
 *
 * Aufruf: node tools/tv-endversion-bauen.cjs <index.html WM-Pr-s. (Original)> <Hintergrundbild .jpg> <Ziel.html>
 */
'use strict';
const fs = require('fs');
const path = require('path');

const MIT_FOTOS = process.env.KC_TV_MIT_FOTOS === '1';
const STAND = MIT_FOTOS ? '2026-11-17' : '2026-11-18';
const VERSION = `Endversion · ${STAND}`;

// ---- Mitglieder laut Spruch-Auswahl (Supabase kc_wm_spruch_zuordnung, Stand 25.09.2026) ----
// foto: true = Foto zeigen (nur in der Fassung mit Fotos). Nicht aufgeführt = ausblenden.
// Ohne Fotos wird immer nur der Vorname gezeigt.
const MITGLIEDER = {
  'Hans-Joachim Koch': { vorname: 'Hans-Joachim', name: 'Hans-Joachim Koch', foto: true, spruch: 'Zu unseren Treffen komme ich gerne, weil der Austausch unter Kollegen einfach wertvoll ist.' },
  'Dieter Zander': { vorname: 'Dieter', name: 'Dieter Zander', foto: true, spruch: 'Ich bringe mich gerne ein, weil mir Gemeinschaft und soziales Engagement wichtig sind.' },
  'Manfred Schoppmann': { vorname: 'Manfred', name: 'Manfred Schoppmann', foto: true, spruch: 'Ich helfe gerne mit, wenn wir gemeinsam etwas für andere Menschen erreichen können.' },
  'Andrea Spahn': { vorname: 'Andrea', name: 'Andrea', foto: true, spruch: 'Ich schätze besonders den Zusammenhalt und die vielen schönen gemeinsamen Erlebnisse.' },
  'Anne Reinkober': { vorname: 'Anne', name: 'Anne', foto: true, spruch: 'Ich helfe gerne aus beim Köcheclub Werne, denn helfende Hände werden immer gebraucht.' },
  'Thomas Hess': { vorname: 'Thomas', name: 'Thomas Hess', foto: false, spruch: 'Ich bin gerne dabei, weil wir hier mit Herz und Hand für andere kochen.' },
  'Christina Brösel': { vorname: 'Christina', name: 'Christina', foto: false, spruch: 'Ich engagiere mich gerne, weil unsere Arbeit nicht nur Freude macht, sondern auch einem guten Zweck dient.' },
  'Leon Wördemann': { vorname: 'Leon', name: 'Leon', foto: false, spruch: 'Besonders der Weihnachtsmarkt zeigt, was wir als Mannschaft gemeinsam leisten können.' },
  'Wilfried Wittwer': { vorname: 'Wilfried', name: 'Wilfried', foto: false, spruch: 'Für mich ist der Köcheclub ein Ort, an dem aus Berufskollegen echte Freunde geworden sind.' },
};

// ---- Allergene und Zusatzstoffe laut Kasse (etiketten/artikel.json, Stand 16.11.2026) ----
const PFAND_GETRAENKE = 'Pfand: 2,00 € je Glas · Feuerzangenbowle zusätzlich 2,00 € für die Feuerzange · Pfand zurück bei Rückgabe am Stand';
const HINWEISE = {
  'Preisliste Getränke · alkoholisch': [
    'Allergene und Zusatzstoffe',
    'Winzerglühwein rot und weiß: Sulfite · mit Konservierungsstoffen (Sulfite, Kaliumsorbat)',
    'Eierlikörpunsch: Ei, Milch, Sulfite · Feuerzangenbowle: Sulfite',
    'Apfelpunsch, Roter Feger: keine deklarationspflichtigen Allergene · Schuss Rum/Amaretto: Auskunft am Stand',
    '',
    PFAND_GETRAENKE,
  ],
  'Preisliste Getränke · alkoholfrei': [
    'Allergene und Zusatzstoffe',
    'Roter Feger: keine deklarationspflichtigen Allergene · mit Säuerungsmittel Citronensäure',
    'Apfelpunsch: keine deklarationspflichtigen Allergene · ohne Farb- und Konservierungsstoffe',
    '',
    PFAND_GETRAENKE,
  ],
  'Preisliste Speisen · Teil 1': [
    'Allergene und Zusatzstoffe',
    'Grünkohl: Gluten (Hafer) · Spuren von Senf und Sellerie   |   mit Mettwurst: Gluten, Senf · Spuren von Sellerie',
    'Sauerkrauteintopf: Spuren von Senf und Sellerie   |   mit Mettwurst: Senf · Spuren von Sellerie und Gluten',
    'Mettendchen: Senf · Spuren von Sellerie',
    'Mettwurst und Mettendchen: mit Konservierungsstoff und Antioxidationsmittel',
  ],
  'Preisliste Speisen · Teil 2': [
    'Allergene und Zusatzstoffe',
    'Kartoffeln mit Kartoffelcreme: Spuren von Milch',
    'Kartoffeln mit Heringsstipp: Fisch, Ei, Milch, Senf',
  ],
};

// ---- Wetterfolien: Platzhalter der eingebauten Wetterabfrage (siehe CODE_ERSETZUNGEN) ----
const tag = (t) => `{{weather.${t}.day}}\n{{weather.${t}.symbol}}\n{{weather.${t}.minmax}}\n{{weather.${t}.text}}\n☔ {{weather.${t}.rain}}`;
const WETTER = {
  'Wetter heute und morgen': {
    'weather-today': 'HEUTE\n{{weather.today.symbol}} {{weather.today.temp}}\n{{weather.today.text}}\n{{weather.today.minmax}} · ☔ {{weather.today.rain}}',
    'weather-tomorrow': 'MORGEN\n{{weather.tomorrow.symbol}} {{weather.tomorrow.minmax}}\n{{weather.tomorrow.text}}\n☔ {{weather.tomorrow.rain}}',
  },
  'Wetteraussichten': { 'forecast-1': tag('day2'), 'forecast-2': tag('day3'), 'forecast-3': tag('day4') },
};

// ---- einheitliches Raster (Folie 1280×720) ----
const TITEL = { x: 80, y: 25, w: 1120, h: 120, font: 66 };
const ZIER = { 'Grafik 12': { x: 1155, y: 0, w: 71, h: 71 }, 'Grafik 14': { x: 1168, y: 90, w: 46, h: 46 } };
const FOTO = { x: 105, y: 165, w: 450, h: 470 };
const UNTEN = 655; // Oberkante Laufschrift (665) minus Abstand

function setze(item, werte) { Object.assign(item, werte); }

function bearbeite(projekt, log, extras = {}) {
  projekt.name = `Köcheclub Werne · Weihnachtsmarkt 2026 · ${VERSION}`;
  for (const folie of projekt.slides) {
    // Hintergrund: neues Rathaus-Bild, Seitenverhältnis bleibt (nicht verzerrt)
    folie.backgroundFit = 'cover';
    for (const item of folie.items) {
      if (item.originalRole === 'title' && folie.id !== projekt.slides[0].id) setze(item, { ...TITEL, fontFamily: 'Cinzel Decorative', align: 'center' });
      if (ZIER[item.name]) setze(item, ZIER[item.name]);
    }

    // Mannschaftsfolie ohne Gruppenbild: nur Text
    if (!MIT_FOTOS && folie.name === 'Unsere Mannschaft') {
      const titel = folie.items.find((i) => i.originalRole === 'title');
      const foto = folie.items.find((i) => i.originalRole === 'photo');
      const zeile = folie.items.find((i) => i.name === 'group-caption');
      setze(titel, { text: 'Köcheclub Werne' });
      setze(foto, { type: 'text', name: 'seit 1991', originalRole: 'memberQuote', src: '', text: 'seit 1991 in Werne',
        x: 190, y: 220, w: 900, h: 230, font: 64, fontFamily: 'Cinzel Decorative', align: 'center', color: '#fff8e8',
        bg: 'rgba(28,58,44,.74)', radius: 18, textScaleMode: 'fit' });
      setze(zeile, { x: 190, y: 490, w: 900, h: 60, font: 32 });
      log.push('Mannschaftsfolie: Gruppenbild entfernt, Text „Köcheclub Werne – seit 1991 in Werne“');
    }

    // Rezeptfolie: Foto vom Eierlikörpunsch aus der Kasse (pos/assets/eierpunsch_version_3.png, zugeschnitten
    // auf media/eierlikoerpunsch-tv.jpg), Rezept rechts daneben
    if (folie.name === 'Rezept vom Köcheclub' && extras.eierpunschFoto) {
      const titel = folie.items.find((i) => i.originalRole === 'title');
      const name = folie.items.find((i) => i.name === 'Rezeptname');
      const rezept = folie.items.find((i) => i.name === 'Zubereitung');
      setze(name, { x: 560, y: 175, w: 620, h: 70, text: 'Eierlikörpunsch' });
      setze(rezept, { x: 560, y: 265, w: 620, h: 340 });
      folie.items.splice(folie.items.indexOf(titel) + 1, 0, { ...rezept, id: folie.id + '-foto', name: 'Foto Eierlikörpunsch',
        type: 'image', originalRole: 'image', text: '', src: extras.eierpunschFoto, fit: 'cover', x: 100, y: 165, w: 420, h: 440,
        radius: 18, bg: 'transparent', stroke: '#d8b25a', strokeWidth: 3, strokeStyle: 'solid' });
      log.push('Rezeptfolie: Foto vom Eierlikörpunsch aus der Kasse');
    }

    // Wetterfolien: an die eingebaute Wetterabfrage (Open-Meteo, Werne) anschließen statt Platzhaltertext
    if (WETTER[folie.name]) {
      for (const item of folie.items) {
        if (WETTER[folie.name][item.name]) item.text = WETTER[folie.name][item.name];
        if (item.name === 'weather-placeholder-note') item.text = 'Wetter für Werne · wird alle 30 Minuten aktualisiert · Daten: Open-Meteo.com';
      }
      // feste Sonne/fester Regen passt nicht immer – die eingebaute Wetterszene folgt dem echten Wetter
      if (folie.effectLayer) folie.effectLayer = { ...folie.effectLayer, type: 'none' };
      log.push(`„${folie.name}“: zeigt jetzt das aktuelle Wetter`);
    }

    // Spenden-Folien: Inhalt saß 80 px rechts der Mitte, Projektliste linksbündig
    if (folie.name === 'Projekte 2026' || folie.name === 'Projekte vergangener Jahre') {
      for (const item of folie.items) {
        if (item.originalRole === 'title' || ZIER[item.name] || item.type === 'ticker') continue;
        item.x -= 80;
        if (item.name === 'Textfeld 5') item.align = 'center';
      }
      log.push(`„${folie.name}“: Inhalt mittig ausgerichtet`);
    }

    // Preislisten
    if (HINWEISE[folie.name]) {
      const tabelle = folie.items.find((i) => i.type === 'table');
      const zeilen = tabelle.tableData;
      const pfandZeile = zeilen.findIndex((r) => /^Alle Preise zzgl\./.test(r[0] && r[0].text || ''));
      if (pfandZeile > -1) { // steht jetzt vollständig in den Hinweisen
        const proZeile = tabelle.h / zeilen.length;
        zeilen.splice(pfandZeile, 1); tabelle.tableRows = zeilen.length; tabelle.h = Math.round(proZeile * zeilen.length);
      }
      const text = HINWEISE[folie.name].join('\n');
      const alt = folie.items.find((i) => /Allergenen und Zusatzstoffen siehe Aushang/.test(i.text || ''));
      const zeilenAnzahl = HINWEISE[folie.name].length;
      const h = Math.min(UNTEN - (tabelle.y + tabelle.h + 12), 20 + zeilenAnzahl * 25);
      const y = UNTEN - h;
      const box = { name: 'Allergene und Pfand', type: 'text', text, x: tabelle.x, y, w: tabelle.w, h,
        font: 18, fontFamily: 'Arial', color: '#fff8e8', bg: 'rgba(10,5,4,.78)', align: 'left', bold: false, radius: 14,
        textScaleMode: 'fixed', originalRole: 'allergenHinweis' };
      if (alt) setze(alt, box); else folie.items.push({ ...alt, id: `${folie.id}-allergene`, opacity: 100, rotation: 0, ...box });
      log.push(`Preisliste „${folie.name}“: Allergene/Pfand eingetragen`);
    }

    // Mitgliederfolien
    if (folie.memberMeta) {
      const name = folie.memberMeta.name;
      const eintrag = MITGLIEDER[name];
      const m = eintrag && (MIT_FOTOS ? eintrag : { ...eintrag, name: eintrag.vorname, foto: false });
      folie.rotation = { ...(folie.rotation || {}), enabled: !!m };
      // ohne Fotos: Foto auch bei ausgeblendeten Mitgliedern entfernen (die Datei ist öffentlich)
      if (!MIT_FOTOS) folie.items = folie.items.filter((i) => i.originalRole !== 'photo');
      if (!m) { log.push(`Mitglied ${name}: ausgeblendet (keine Zustimmung in der Spruch-Auswahl)`); continue; }
      // „Wer wann da ist“ fällt weg (Umfrage-Kommentar), Platzhalter-Hinweis ebenso
      folie.items = folie.items.filter((i) => i.originalRole !== 'nextshift' && i.name !== 'reserve-note');
      const nameItem = folie.items.find((i) => i.originalRole === 'memberName');
      const spruch = folie.items.find((i) => i.originalRole === 'memberQuote');
      const foto = folie.items.find((i) => i.originalRole === 'photo');
      setze(nameItem, { text: m.name });
      setze(spruch, { text: `„${m.spruch}“` });
      if (m.foto && foto) {
        setze(foto, FOTO);
        setze(nameItem, { x: 625, y: 190, w: 540, h: 80, font: 42, align: 'center' });
        setze(spruch, { x: 625, y: 290, w: 540, h: 300, font: 34, align: 'center' });
      } else {
        folie.items = folie.items.filter((i) => i !== foto);
        setze(nameItem, { x: 140, y: 200, w: 1000, h: 90, font: 48, align: 'center' });
        setze(spruch, { x: 190, y: 310, w: 900, h: 290, font: 40, align: 'center' });
      }
      folie.memberMeta = { ...folie.memberMeta, anzeige: m.name, mitFoto: !!(m.foto && foto) };
      log.push(`Mitglied ${name}: „${m.name}“, ${m.foto && foto ? 'mit' : 'ohne'} Foto, Spruch aus der Auswahl`);
    }
  }
  return projekt;
}

// Kein Umfrage-Ende mehr: Schlussfolie läuft weiter, kein „Fertig – zur Umfrage“-Knopf.
const CODE_ERSETZUNGEN = [
  { name: 'Schlussfolie hält nicht mehr an', alt: 'if(isLast&&playing)tvTogglePause();', neu: '' },
  { name: 'kein Umfrage-Knopf', alt: "bigDone.onclick=()=>{location.href='https://sire65.github.io/WM-Pr-sentation/abstimmung.html?seen=A'}", neu: "bigDone.remove()" },
  { name: 'Versionshinweis', alt: '>Rathaus · Build 2026-09-22 19:29</div>', neu: `>${VERSION}</div>` },
  // Wetter: Regenwahrscheinlichkeit dazu, alle 30 Minuten neu laden, kurzer Ausfall löscht gute Daten nicht
  { name: 'Wetter: Regenwahrscheinlichkeit abfragen',
    alt: 'daily=weather_code,temperature_2m_max,temperature_2m_min&timezone',
    neu: 'daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone' },
  { name: 'Wetter: Regenwahrscheinlichkeit je Tag',
    alt: "°C`};weather[n===0?'today'",
    neu: "°C`,rain:`${Math.round(data.daily.precipitation_probability_max?.[n]??0)} %`};weather[n===0?'today'" },
  { name: 'Wetter: Ausfall behält letzte Daten',
    alt: "}catch{weather.today={symbol:'🌡️',text:'Wetterdaten derzeit nicht erreichbar'",
    neu: "}catch{if(weather.today&&weather.today.rain)return;weather.today={symbol:'🌡️',text:'Wetterdaten derzeit nicht erreichbar'" },
  { name: 'Wetter: alle 30 Minuten neu laden',
    alt: 'loadCycle(1);show();loadWeather();',
    neu: 'loadCycle(1);show();loadWeather();setInterval(loadWeather,1800000);' },
  { name: 'Seitentitel', alt: '<title>KC Weihnachtsmarkt 2026 · Vorführung (eine Datei)</title>', neu: '<title>KC Weihnachtsmarkt 2026 · TV-Präsentation</title>' },
];

function bauen(html, bildDatenUrl, extras = {}) {
  const log = [];
  // Projekt finden
  const anfang = 'window.KC_DESIGNER_MARKET_PRESENTATION=';
  const a = html.indexOf(anfang);
  const e = html.indexOf('};', a);
  if (a < 0 || e < 0 || html.indexOf(anfang, a + 1) > -1) throw new Error('Projektdaten nicht eindeutig gefunden.');
  const roh = html.slice(a + anfang.length, e + 1);
  const projekt = JSON.parse(roh.replace(/\bB\[(\d+)\]/g, '"@@B$1@@"'));
  bearbeite(projekt, log, extras);
  const neu = JSON.stringify(projekt).replace(/"@@B(\d+)@@"/g, 'B[$1]');
  html = html.slice(0, a + anfang.length) + neu + html.slice(e + 1);

  // Nicht mehr benutzte Bilder aus der Bildliste B leeren – sonst stecken entfernte Fotos unsichtbar in der Datei
  {
    const start = html.indexOf('const B=[');
    const ende = html.indexOf('];', start);
    const liste = JSON.parse(html.slice(start + 8, ende + 1));
    const benutzt = new Set([0, ...[...neu.matchAll(/\bB\[(\d+)\]/g)].map((t) => Number(t[1]))]);
    let geleert = 0;
    const neuListe = liste.map((bild, n) => { if (benutzt.has(n) || !bild) return bild; geleert++; return ''; });
    html = html.slice(0, start + 8) + JSON.stringify(neuListe) + html.slice(ende + 1);
    if (geleert) log.push(`${geleert} nicht mehr benutzte Bilder aus der Datei entfernt`);
  }

  // Hintergrund B[0] (alle Folien) durch das neue Rathaus-Bild ersetzen
  const bAnfang = html.indexOf('const B=["');
  const bEnde = html.indexOf('"', bAnfang + 10);
  if (bAnfang < 0) throw new Error('Bildliste B nicht gefunden.');
  html = html.slice(0, bAnfang + 10) + bildDatenUrl + html.slice(bEnde);
  log.push('Hintergrund aller Folien: rathaus-werne-weihnachtsmarkt-v2.jpg');

  for (const r of CODE_ERSETZUNGEN) {
    const n = html.split(r.alt).length - 1;
    if (n !== 1) throw new Error(`Stelle „${r.name}“ ${n}× statt 1× gefunden.`);
    html = html.replace(r.alt, () => r.neu);
    log.push(r.name);
  }
  return { html, log, projekt };
}

if (require.main === module) {
  const [quelle, bild, ziel] = process.argv.slice(2);
  if (!quelle || !bild || !ziel) { console.error('Aufruf: node tools/tv-endversion-bauen.cjs <index.html> <bild.jpg> <ziel.html>'); process.exit(1); }
  const typ = /\.png$/i.test(bild) ? 'image/png' : /\.webp$/i.test(bild) ? 'image/webp' : 'image/jpeg';
  const daten = `data:${typ};base64,${fs.readFileSync(bild).toString('base64')}`;
  const foto = path.join(__dirname, '..', 'media', 'eierlikoerpunsch-tv.jpg');
  const extras = fs.existsSync(foto) ? { eierpunschFoto: `data:image/jpeg;base64,${fs.readFileSync(foto).toString('base64')}` } : {};
  const { html, log } = bauen(fs.readFileSync(quelle, 'utf8'), daten, extras);
  fs.writeFileSync(ziel, html);
  log.forEach((z) => console.log('  ' + z));
  console.log(`Endversion geschrieben: ${path.resolve(ziel)} (${(html.length / 1048576).toFixed(1)} MB)`);
}

module.exports = { bauen, MITGLIEDER, HINWEISE };
