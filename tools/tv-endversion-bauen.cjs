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
 * Am 18.11.2026 (Rohprogramm): Öffnungszeiten, „Auf der Bühne“ (heute/morgen) und Bühnenprogramm 2026 (zwei Folien) aus
 *   shared/kc-wm2026-programm.js – siehe tools/tv-programm-folien.cjs. „Musik vom Band“ wird nicht ausgewiesen.
 *
 * Aufruf: node tools/tv-endversion-bauen.cjs <index.html WM-Pr-s. (Original)> <Hintergrundbild .jpg> <Ziel.html>
 */
'use strict';
const fs = require('fs');
const path = require('path');
const PROGRAMM = require('./tv-programm-folien.cjs');

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
// Allergene/Zusatzstoffe unter den Preislisten (Betreiber 18.11.2026: „kleiner und besser ausgerichtet“):
// je Zeile [Artikel, Angabe]; „fuss“ steht abgesetzt darunter. Darstellung als kleines Raster (HINWEIS_RASTER).
const FRAGEN = 'Fragen? Gerne an die Standbesetzung';
const PFAND_GETRAENKE = 'Pfand: 2,00 € je Glas · Feuerzangenbowle zusätzlich 2,00 € für die Feuerzange · Pfand zurück bei Rückgabe am Stand';
const AUSSER_HAUS = 'Außer Haus: Thermobecher für Speisen zum Mitnehmen 1,00 €';
const HINWEISE = {
  'Preisliste Getränke · alkoholisch': { zeilen: [
    ['Winzerglühwein rot und weiß', 'Sulfite · Konservierungsstoffe: Sulfite, Kaliumsorbat'],
    ['Eierlikörpunsch', 'Ei, Milch, Sulfite'],
    ['Feuerzangenbowle', 'Sulfite'],
    ['Apfelpunsch, Roter Feger', 'keine deklarationspflichtigen Allergene'],
    ['Schuss Rum oder Amaretto', 'Auskunft am Stand'],
  ], fuss: [PFAND_GETRAENKE] },
  'Preisliste Getränke · alkoholfrei': { zeilen: [
    ['Roter Feger', 'keine deklarationspflichtigen Allergene · mit Säuerungsmittel Citronensäure'],
    ['Apfelpunsch', 'keine deklarationspflichtigen Allergene · ohne Farb- und Konservierungsstoffe'],
  ], fuss: [PFAND_GETRAENKE] },
  'Preisliste Speisen · Teil 1': { zeilen: [
    ['Grünkohl (auch mit Mettendchen)', 'Gluten (Hafer), Sellerie, Senf · Spuren: Ei, Soja, Milch'],
    ['Sauerkrauteintopf', 'Gluten, Sellerie · Spuren: Senf, Ei, Soja, Milch · mit Mettendchen zusätzlich Senf'],
    ['Mettendchen', 'Senf · Spuren: Sellerie'],
  ], fuss: ['Grünkohl, Sauerkrauteintopf und Mettendchen: mit Konservierungsstoff und Antioxidationsmittel', AUSSER_HAUS] },
  'Preisliste Speisen · Teil 2': { zeilen: [
    ['Kartoffeln mit Kartoffelcreme', 'Milch, Ei, Senf · Konservierungsstoffe: Kaliumsorbat, Natriumbenzoat'],
    ['Kartoffeln mit Heringsstipp', 'Fisch, Ei, Milch, Senf · Spuren: Sulfite'],
  ], fuss: [AUSSER_HAUS] },
};
// Text der Hinweisbox: Kopfzeile, dann „Artikel⇥Angabe“, Fußzeilen mit „» “ – das Raster-Skript setzt daraus die Tabelle,
// ohne Skript bleibt es lesbarer Text.
const hinweisText = (h) => ['Allergene und Zusatzstoffe\t' + FRAGEN, ...h.zeilen.map((z) => z.join('\t')), ...h.fuss.map((z) => '» ' + z)].join('\n');
const hinweisHoehe = (h) => 18 + 26 + h.zeilen.length * 21 + (h.fuss.length ? 8 + h.fuss.length * 18 : 0);

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

// ---- Wetter als Effekt: siehe bearbeite() (18.11.2026: auf allen Folien nur Schnee, Regen oder Sonne, Schlussfolie Feuerwerk) ----
// Wetterkacheln: welcher Tag gehört zu welcher Kachel
const KACHEL_ROLLE = { 'weather-today': 'wetter-today', 'weather-tomorrow': 'wetter-tomorrow',
  'forecast-1': 'wetter-day2', 'forecast-2': 'wetter-day3', 'forecast-3': 'wetter-day4' };

// ---- Laufschrift: Themenblöcke mit Überschrift, je Folie wechselnd ----
const LAUFSCHRIFT_THEMEN = [
  'Preise Speisen: Grünkohl 5,50 € · Grünkohl mit Mettendchen 7,00 € · Sauerkrauteintopf 5,50 € · Sauerkrauteintopf mit Mettendchen 7,00 € · Mettendchen 1,50 €',
  'Wetter in Werne: {{weather.today.symbol}} {{weather.today.text}}, {{weather.today.temp}} · Morgen {{weather.tomorrow.symbol}} {{weather.tomorrow.minmax}}',
  'Preise Getränke: Winzerglühwein rot und weiß 3,50 € · Eierlikörpunsch 4,50 € · Feuerzangenbowle 5,00 € · Schuss Rum oder Amaretto 1,00 €',
  'Bei Fragen zu Allergenen und Zusatzstoffen wenden Sie sich gerne an die Standbesetzung',
  'Preise alkoholfreie Getränke: Roter Feger 2,50 € · Apfelpunsch 2,50 €',
  'Preise Kartoffelgerichte: Kartoffeln mit Kartoffelcreme 3,50 € · Kartoffeln mit Heringsstipp 4,50 €',
  'Pfand: 2,00 € je Glas · Feuerzangenbowle zusätzlich 2,00 € für die Feuerzange · Rückgabe am Stand',
  // 18.11.2026: Programm und Öffnungszeiten (shared/kc-wm2026-programm.js); {{programm.heute}} setzt die Präsentation täglich ein
  '{{programm.heute}}',
  'Öffnungszeiten: ' + PROGRAMM.DATEN.OEFFNUNG.map((o) => `${o.kurz} ${o.von}–${o.bis}`).join(' · ') + ' Uhr',
];
let laufschriftNr = 0;

function setze(item, werte) { Object.assign(item, werte); }

function bearbeite(projekt, log, extras = {}) {
  laufschriftNr = 0;
  PROGRAMM.folienUmbauen(projekt, log);
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
      // Text vom Betreiber (18.11.2026); darüber die offizielle Kochmütze (KC-Logo\kc-kochmuetze-weiss.webp – Original, nie neu zeichnen)
      const logo = !!extras.logoWeiss;
      setze(foto, { type: 'text', name: 'seit 1991', originalRole: 'memberQuote', src: '', text: 'Seit 1991 in Werne\nseit 1995 auf dem Weihnachtsmarkt',
        x: 190, y: logo ? 280 : 200, w: 900, h: logo ? 210 : 250, font: 50, fontFamily: 'Cinzel Decorative', align: 'center', color: '#fff8e8',
        bg: 'rgba(28,58,44,.74)', radius: 18, textScaleMode: 'fit' });
      setze(zeile, { x: 190, y: logo ? 510 : 480, w: 900, h: 70, font: 36, text: 'Gemeinsam kochen, gemeinsam helfen' });
      if (logo) {
        folie.items.splice(folie.items.indexOf(titel) + 1, 0, { ...zeile, id: folie.id + '-logo', name: 'KC-Logo Kochmütze', type: 'image',
          originalRole: 'image', text: '', src: extras.logoWeiss, fit: 'contain', x: 550, y: 138, w: 180, h: 120, bg: 'transparent',
          radius: 0, stroke: 'transparent', strokeWidth: 0, shadowEnabled: false });
      }
      log.push('Mannschaftsfolie: Gruppenbild entfernt, Text „Köcheclub Werne – seit 1991 in Werne“');
    }

    // Rezeptfolie: Foto vom Eierlikörpunsch aus der Kasse (pos/assets/eierpunsch_version_3.png, zugeschnitten
    // auf media/eierlikoerpunsch-tv.jpg), Rezept rechts daneben.
    // Seit 18.11.2026 als Freisteller (media/eierlikoerpunsch-freisteller.png, Hintergrund transparent): ohne Rahmen,
    // der Becher steht direkt vor dem Rathaus-Bild.
    if (folie.name === 'Rezept vom Köcheclub' && extras.eierpunschFoto) {
      const titel = folie.items.find((i) => i.originalRole === 'title');
      const name = folie.items.find((i) => i.name === 'Rezeptname');
      const rezept = folie.items.find((i) => i.name === 'Zubereitung');
      setze(name, { x: 560, y: 175, w: 620, h: 70, text: 'Eierlikörpunsch' });
      setze(rezept, { x: 560, y: 265, w: 620, h: 340 });
      const frei = !!extras.eierpunschFreisteller;
      folie.items.splice(folie.items.indexOf(titel) + 1, 0, { ...rezept, id: folie.id + '-foto', name: 'Foto Eierlikörpunsch',
        type: 'image', originalRole: 'image', text: '', src: extras.eierpunschFoto, fit: frei ? 'contain' : 'cover',
        x: frei ? 70 : 100, y: frei ? 150 : 165, w: frei ? 470 : 420, h: frei ? 480 : 440, bg: 'transparent', shadowEnabled: false,
        ...(frei ? { radius: 0, stroke: 'transparent', strokeWidth: 0 } : { radius: 18, stroke: '#d8b25a', strokeWidth: 3, strokeStyle: 'solid' }) });
      log.push('Rezeptfolie: Foto vom Eierlikörpunsch aus der Kasse');
    }

    // Wetterfolien: an die eingebaute Wetterabfrage (Open-Meteo, Werne) anschließen statt Platzhaltertext
    if (WETTER[folie.name]) {
      for (const item of folie.items) {
        if (WETTER[folie.name][item.name]) item.text = WETTER[folie.name][item.name];
        if (item.name === 'weather-placeholder-note') item.text = 'Wetter für Werne · wird alle 30 Minuten aktualisiert · Daten: Open-Meteo.com';
      }
      // jede Kachel bekommt das Wetter ihres Tages als Bewegung (Regen, Schnee, Sonne …) – siehe KACHEL_WETTER
      for (const item of folie.items) if (KACHEL_ROLLE[item.name]) item.originalRole = KACHEL_ROLLE[item.name];
      log.push(`„${folie.name}“: zeigt jetzt das aktuelle Wetter`);
    }

    // Wettereffekte (Betreiber 18.11.2026: „keine verschiedenen Effekte, nur Schnee, Regen, Sonne – außer die letzte Folie
    // mit Feuerwerk“): alle Folien zeigen nur das aktuelle Wetter in Werne (Schnee, Regen oder Sonne; bei Wolken/Nebel
    // nichts). Kein Glitzer, keine Sternschnuppen, kein Goldstaub. Nur die Schlussfolie behält Feuerwerk und Lasershow.
    const schluss = folie.id === projekt.slides[projekt.slides.length - 1].id;
    // Wetterfolien (Kacheln): Wetter NUR in den Kacheln, nicht über die ganze Folie (Betreiber 18.11.2026 nachmittags)
    const kachelFolie = !!WETTER[folie.name];
    if (!schluss) folie.effectLayer = { ...(folie.effectLayer || {}), weatherAuto: !kachelFolie, type: 'none', type2: 'none', type3: 'none', opacity: 85 };

    // QR-Folien: klarer sagen, wohin der Code führt (Betreiber 18.11.2026)
    for (const item of folie.items) {
      if (item.name === 'official-qr-label') item.text = 'QR-Code scannen\nfür das Gesamtprogramm\nim Internet';
      if (item.name === 'join-copy') item.text = 'QR-Code scannen\nund dem Clubsprecher\neine E-Mail senden';
    }

    // Rückblick: die Fotos sind vom Weihnachtsmarkt 2025
    if (/^Rückblick 2024/.test(folie.name)) {
      folie.name = folie.name.replace('2024', '2025');
      for (const item of folie.items) if (item.text) item.text = item.text.replace(/2024/g, '2025');
      log.push(`„${folie.name}“: Jahr 2025`);
    }
    // Impressionen ohne Foto vorerst ausblenden (nicht gelöscht)
    if (/^Impressionen \d/.test(folie.name) && !folie.items.some((i) => i.type === 'image' && i.src && !ZIER[i.name])) {
      folie.rotation = { ...(folie.rotation || {}), enabled: false };
      log.push(`„${folie.name}“: ausgeblendet (noch kein Foto)`);
    }

    // Laufschrift: je Folie andere Themen, jedes mit Überschrift; Blöcke werden mit Abstand getrennt (CODE_ERSETZUNGEN)
    const laufschrift = folie.items.find((i) => i.type === 'ticker');
    if (laufschrift) {
      const n = laufschriftNr++;
      const bloecke = [0, 1, 2].map((k) => LAUFSCHRIFT_THEMEN[(n + k) % LAUFSCHRIFT_THEMEN.length]);
      if (folie.id === projekt.slides[0].id) bloecke.unshift('Der Köcheclub Werne begrüßt Sie herzlich auf dem Weihnachtsmarkt 2026');
      const text = bloecke.join(' • ');
      setze(laufschrift, { text, tickerOwn: text, tickerWeather: false, tickerProgram: false });
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
      // Pfand- und Außer-Haus-Zeile stehen jetzt vollständig in den Hinweisen (Fußzeilen)
      for (const muster of [/^Alle Preise zzgl\./, /^Aufpreis außer Haus/]) {
        const z = zeilen.findIndex((r) => muster.test(r[0] && r[0].text || ''));
        if (z < 0) continue;
        const proZeile = tabelle.h / zeilen.length;
        zeilen.splice(z, 1); tabelle.tableRows = zeilen.length; tabelle.h = Math.round(proZeile * zeilen.length);
      }
      const hinweis = HINWEISE[folie.name];
      const text = hinweisText(hinweis);
      const alt = folie.items.find((i) => /Allergenen und Zusatzstoffen siehe Aushang/.test(i.text || ''));
      // direkt unter der Tabelle, gleiche Breite und linke Kante wie die Preisliste, unten bündig über der Laufschrift
      const h = hinweisHoehe(hinweis);
      const y = UNTEN - h; // unten direkt über der Laufschrift (Betreiber 18.11.2026), nicht direkt unter der Preistabelle
      const box = { name: 'Allergene und Pfand', type: 'text', text, x: tabelle.x, y, w: tabelle.w, h,
        font: 15, fontFamily: 'Arial', color: '#fff8e8', bg: 'rgba(10,5,4,.80)', align: 'left', bold: false, radius: 12,
        stroke: 'rgba(217,170,58,.55)', strokeWidth: 1, strokeStyle: 'solid', textScaleMode: 'fixed', originalRole: 'allergenHinweis' };
      // Eierlikörpunsch wie in Kasse/PC-Manager (Betreiber 18.11.2026: Vanillezucker, Sprühsahne, Backkakao als Deko)
      for (const zeile of zeilen) if (/^Eierlikörpunsch/.test((zeile[0] && zeile[0].text) || '') && zeile[1]) zeile[1].text = 'Weißwein, Eierlikör, Vanillezucker, Sahnehaube mit Kakao';
      // Preise einheitlich mit Komma (Original hatte „1.50“ beim Mettendchen)
      for (const zeile of zeilen) for (const zelle of zeile) if (/^\d+\.\d\d$/.test(zelle.text || '')) zelle.text = zelle.text.replace('.', ',');
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
        setze(nameItem, { x: 190, y: 200, w: 900, h: 90, font: 48, align: 'center' }); // so breit wie der Spruch
        setze(spruch, { x: 190, y: 310, w: 900, h: 290, font: 40, align: 'center' });
      }
      folie.memberMeta = { ...folie.memberMeta, anzeige: m.name, mitFoto: !!(m.foto && foto) };
      log.push(`Mitglied ${name}: „${m.name}“, ${m.foto && foto ? 'mit' : 'ohne'} Foto, Spruch aus der Auswahl`);
    }
  }
  return projekt;
}

// Wetterkacheln: Regen/Schnee/Sonne/Wolken/Gewitter des jeweiligen Tages als Bewegung hinter dem Text.
// Abstand zwischen den Laufschrift-Blöcken (kcTickerPause).
const KACHEL_WETTER = '<style>'
  + '.kcTickerPause{display:inline-block;width:150px;text-align:center;color:#d8b25a}'
  + '.tvFx.heavy-snow i,.tvFx.storm i{zoom:1.7}.tvFx.heavy-snow i{opacity:.95}' // Schnee gut sichtbar
  // Regen dezent (Betreiber 18.11.2026: „es regnet zu doll“): nur jeder dritte Tropfen, schwach und fein
  + '.tvFx.rain{opacity:.32!important}.tvFx.rain i:not(:nth-child(3n)){display:none}'
  + '.kcKw i{opacity:.5!important}.kcKw i:nth-child(2n){display:none}'
  + '.tvItem[data-original-role^="wetter-"]{isolation:isolate}'
  + '.kcKw{position:absolute;inset:0;z-index:-1;pointer-events:none;overflow:hidden;border-radius:inherit}'
  + '.kcKw i{position:absolute;top:-20%;width:2px;height:30px;background:linear-gradient(transparent,#a8e0ff);opacity:.85;animation:kcRegen 1.1s linear infinite}'
  + '@keyframes kcRegen{to{transform:translate(-30px,560px)}}'
  + '.kcKw b{position:absolute;top:-12%;color:#fff;font-weight:400;opacity:.9;animation:kcSchnee 7s linear infinite}'
  + '@keyframes kcSchnee{to{transform:translate(28px,560px) rotate(200deg)}}'
  + '.kcKw.sun:before{content:"";position:absolute;right:-70px;top:-70px;width:240px;height:240px;border-radius:50%;background:radial-gradient(rgba(255,210,80,.8),rgba(255,210,80,0) 70%);animation:kcSonne 4s ease-in-out infinite alternate}'
  + '@keyframes kcSonne{to{transform:scale(1.18)}}'
  + '.kcKw.cloud:before,.kcKw.fog:before{content:"";position:absolute;left:-60%;top:6%;width:90%;height:45%;border-radius:50%;background:radial-gradient(rgba(225,232,242,.5),rgba(225,232,242,0) 70%);animation:kcWolke 14s linear infinite}'
  + '@keyframes kcWolke{to{transform:translateX(180%)}}'
  + '.kcKw.storm{background:rgba(10,15,30,.25)}.kcKw.storm:after{content:"";position:absolute;inset:0;background:#fff;opacity:0;animation:kcBlitz 5s infinite}'
  + '@keyframes kcBlitz{0%,92%,100%{opacity:0}93%{opacity:.5}95%{opacity:0}96%{opacity:.35}}'
  + '</style><script>(function(){var stage=document.getElementById("tvStage");if(!stage)return;'
  + 'function teile(k){var h="",n;if(k==="rain"||k==="storm"){for(n=0;n<26;n++)h+=\'<i style="left:\'+(n*37%100)+\'%;animation-delay:\'+(-(n%9)*0.13)+\'s"></i>\'}'
  + 'else if(k==="snow"){for(n=0;n<18;n++)h+=\'<b style="left:\'+(n*41%100)+\'%;font-size:\'+(14+n%4*5)+\'px;animation-delay:\'+(-(n%7))+\'s">❄</b>\'}return h}'
  + 'function fuellen(){stage.querySelectorAll(\'.tvItem[data-original-role^="wetter-"]\').forEach(function(el){var tag=el.getAttribute("data-original-role").slice(7),w=window.KC_WETTER&&window.KC_WETTER[tag],k=(w&&w.kind)||"",alt=el.querySelector(".kcKw");'
  + 'if(alt&&alt.getAttribute("data-k")===k)return;if(alt)alt.remove();if(!k)return;var d=document.createElement("div");d.className="kcKw "+k;d.setAttribute("data-k",k);d.innerHTML=teile(k);el.appendChild(d)})}'
  + 'new MutationObserver(function(){setTimeout(fuellen,0)}).observe(stage,{childList:true});setInterval(fuellen,5000);fuellen()})();</script>';

// Durchgehendes Laufband (Betreiber 18.11.2026: „wird immer kurz ausgeblendet, wenn eine neue Folie erscheint“).
// Die Laufschrift der Folien wird bei jedem Wechsel neu aufgebaut und blendet ein – das flackert. Stattdessen
// liegt EIN Laufband über allen Folien, läuft ohne Unterbrechung weiter und zeigt nacheinander alle Themen.
// Es wird nur neu aufgebaut, wenn sich das Wetter ändert; auf Folien ohne Laufschrift (Schlussfolie) ist es aus.
const LAUFBAND = '<style>#tvStage .tvItem.ticker{visibility:hidden!important}'
  + '#kcLaufband{position:absolute;left:0;top:0;transform-origin:top left;pointer-events:none;z-index:50;overflow:hidden}'
  + '#kcLaufband .tvItem.ticker{visibility:visible!important;font-size:24px!important;justify-content:flex-start!important}</style>'
  + '<script>(function(){var stage=document.getElementById("tvStage");if(!stage)return;'
  + 'var band=document.createElement("div");band.id="kcLaufband";stage.parentNode.appendChild(band);var inhalt="";'
  + 'function text(){var W=window.KC_WETTER||{};return (window.KC_LAUFSCHRIFT||[]).map(function(b){if(b.indexOf("{{programm.heute}}")>=0)return window.KC_PROGRAMM_LAUFSCHRIFT?window.KC_PROGRAMM_LAUFSCHRIFT():"";return b.replace(/\\{\\{\\s*weather\\.(\\w+)\\.(\\w+)\\s*\\}\\}/g,function(_,d,k){return (W[d]&&W[d][k])||"…"})}).filter(Boolean).join(" • ")}'
  + 'function bauen(el,t){var lauf=document.createElement("span");lauf.className="tvTickerLauf";var st=document.createElement("span");st.className="tvTickerStueck";'
  + 't.split(/\\s*•\\s*/).forEach(function(b){var s=document.createElement("span");s.textContent=b;st.appendChild(s);var p=document.createElement("span");p.className="kcTickerPause";p.textContent="✦";st.appendChild(p)});'
  + 'lauf.appendChild(st);el.textContent="";el.appendChild(lauf);var e=st.offsetWidth;if(!e)return;for(var n=0;n<Math.ceil(el.clientWidth/e)+1;n++)lauf.appendChild(st.cloneNode(true));'
  + 'lauf.style.setProperty("--strecke",e+"px");lauf.style.setProperty("--dauer",(e/30).toFixed(2)+"s")}'
  + 'function abgleich(){band.style.width=stage.style.width;band.style.height=stage.style.height;band.style.transform=stage.style.transform;'
  + 'var vorlage=stage.querySelector(".tvItem.ticker");band.style.visibility=vorlage?"visible":"hidden";if(!vorlage)return;var t=text();if(t===inhalt&&band.firstChild)return;inhalt=t;'
  + 'var el=document.createElement("div");el.className="tvItem ticker";el.setAttribute("style",vorlage.getAttribute("style")||"");el.setAttribute("data-tv-ticker-mounted","1");band.innerHTML="";band.appendChild(el);bauen(el,t)}'
  + 'new MutationObserver(function(){setTimeout(abgleich,0)}).observe(stage,{childList:true,attributes:true,attributeFilter:["style"]});addEventListener("resize",function(){setTimeout(abgleich,0)});setInterval(abgleich,60000);abgleich()})();</script>';

// Allergen-Hinweise als kleines, ausgerichtetes Raster (Artikel | Angabe), Fußzeilen abgesetzt
const HINWEIS_RASTER = '<style>.tvItem[data-original-role=allergenHinweis]{display:block!important;padding:8px 14px!important;white-space:normal!important;line-height:1.3}'
  + '.kcAh{display:grid;grid-template-columns:max-content 1fr;column-gap:22px;row-gap:2px;font-size:15px}'
  + '.kcAh .k{grid-column:1/-1;display:flex;justify-content:space-between;color:#e9c46a;font-weight:700;font-size:13px;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid rgba(217,170,58,.45);padding-bottom:3px;margin-bottom:4px}'
  + '.kcAh .k span:last-child{text-transform:none;letter-spacing:0;font-weight:400;font-style:italic;color:#f3e9dc}'
  + '.kcAh .n{color:#ffd76a;font-weight:700}.kcAh .f{grid-column:1/-1;font-size:13px;color:#f3e9dc;border-top:1px solid rgba(217,170,58,.3);margin-top:4px;padding-top:3px}'
  + '.kcAh .f+.f{border-top:0;margin-top:0;padding-top:0}'
  // passt die Box nicht unter die Preisliste, wird nur diese Tabelle etwas enger (Beschreibung kleiner, weniger Innenabstand)
  + '.tvItem.kcEng th,.tvItem.kcEng td{padding:2px 12px!important}.tvItem.kcEng tr:not(:first-child)>td:nth-child(2):nth-last-child(2){font-size:16px!important;line-height:1.08}</style>'
  + '<script>(function(){var stage=document.getElementById("tvStage");if(!stage)return;function e(t){var d=document.createElement("span");d.textContent=t;return d}'
  + 'function setzen(){stage.querySelectorAll(\'.tvItem[data-original-role=allergenHinweis]:not([data-kc-ah])\').forEach(function(el){var g=document.createElement("div");g.className="kcAh";'
  + 'el.textContent.split("\\n").forEach(function(z,n){z=z.trim();if(!z)return;var t=z.split("\\t");if(n===0){var k=document.createElement("div");k.className="k";k.appendChild(e(t[0]));if(t[1])k.appendChild(e(t[1]));g.appendChild(k)}'
  + 'else if(z.indexOf("» ")===0){var f=e(z.slice(2));f.className="f";g.appendChild(f)}else{var a=e(t[0]);a.className="n";g.appendChild(a);g.appendChild(e(t[1]||""))}});'
  + 'el.textContent="";el.appendChild(g);el.setAttribute("data-kc-ah","1");'
  // unten bündig direkt über der Laufschrift (Betreiber 18.11.2026); reicht der Platz nicht, wird die Preistabelle etwas enger
  + 'var tab=stage.querySelector(".tvItem.table table"),item=tab&&tab.parentNode;if(!item)return;var h=Math.max(el.offsetHeight,g.offsetHeight+18);'
  + 'if(item.offsetTop+tab.offsetHeight+16+h>' + UNTEN + ')item.classList.add("kcEng");'
  + 'el.style.height=h+"px";el.style.top=(' + UNTEN + '-h)+"px"})}'
  + 'new MutationObserver(setzen).observe(stage,{childList:true});setzen()})();</script>';

// Video-Fassung (?aufnahme=1, tools/tv-mp4-aufnehmen.cjs; Betreiber 18.11.2026: „bei MP4 muss der Hinweis rein, dass die
// Wetterdaten nicht ganz aktuell sind“): Wetterfolien und Wetter-Laufschrift nennen den Stand der Wetterdaten.
const AUFNAHME = '<style>.kcAufnahmeWetter{color:#ffd76a!important;font-weight:700!important}.kcAufnahme #kcMusikHinweis{display:none!important}</style>'
  + '<script>(function(){if(!/[?&]aufnahme=1(&|$)/.test(location.search))return;window.KC_AUFNAHME=true;document.documentElement.classList.add("kcAufnahme");'
  + 'var d=new Date(),stand=d.toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"Europe/Berlin"})+", "+d.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Berlin"})+" Uhr";'
  + 'window.KC_AUFNAHME_STAND=stand;'
  + 'window.KC_LAUFSCHRIFT=(window.KC_LAUFSCHRIFT||[]).filter(function(b){return b.indexOf("{{programm.heute}}")<0}).map(function(b){return b.indexOf("Wetter in Werne:")===0?b.replace("Wetter in Werne:","Wetter in Werne (Stand "+stand+", nicht ganz aktuell):"):b});'
  + 'var stage=document.getElementById("tvStage");if(!stage)return;function setzen(){stage.querySelectorAll(".tvItem.text").forEach(function(el){if(el.textContent.indexOf("wird alle 30 Minuten aktualisiert")<0)return;'
  + 'el.textContent="⚠ Wetterdaten vom "+stand+" – im Video nicht ganz aktuell · Daten: "+(window.KC_AUFNAHME_QUELLE||"Open-Meteo.com");el.classList.add("kcAufnahmeWetter")})}'
  + 'new MutationObserver(setzen).observe(stage,{childList:true});setzen()})();</script>';

// Kein Umfrage-Ende mehr: Schlussfolie läuft weiter, kein „Fertig – zur Umfrage“-Knopf.
const CODE_ERSETZUNGEN = [
  { name: 'Schlussfolie hält nicht mehr an', alt: 'if(isLast&&playing)tvTogglePause();', neu: '' },
  { name: 'kein Umfrage-Knopf', alt: "bigDone.onclick=()=>{location.href='https://sire65.github.io/WM-Pr-sentation/abstimmung.html?seen=A'}", neu: "bigDone.remove()" },
  { name: 'Versionshinweis', alt: '>Rathaus · Build 2026-09-22 19:29</div>', neu: `>${VERSION}</div>` },
  // Wetter: Regenwahrscheinlichkeit dazu, alle 30 Minuten neu laden, kurzer Ausfall löscht gute Daten nicht
  { name: 'Wetter: Regenwahrscheinlichkeit abfragen',
    alt: 'daily=weather_code,temperature_2m_max,temperature_2m_min&timezone',
    neu: 'daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone' },
  { name: 'Wetter: Regenwahrscheinlichkeit und Wetterart je Tag',
    alt: "°C`};weather[n===0?'today'",
    neu: "°C`,rain:`${Math.round(data.daily.precipitation_probability_max?.[n]??0)} %`,kind:kcKachelArt(data.daily.weather_code[n])};weather[n===0?'today'" },
  { name: 'Wetter: Wetterart für Effekte (mit ?wetter=schnee|regen|gewitter|sonne zum Ausprobieren)',
    alt: "const weather={ticker:'Wetter für Werne wird geladen …'};",
    neu: "const weather={ticker:'Wetter für Werne wird geladen …'};window.KC_WETTER=weather;"
      + "const kcArt=c=>c==null?'':c>=95?'storm':(c>=71&&c<=77)||c===85||c===86?(c===75||c===86?'heavy-snow':'snow'):(c>=51&&c<=67)||(c>=80&&c<=82)?'rain':c<=1?'sun':c<=3?'cloud':'fog';"
      + "const kcKachelArt=c=>{const a=kcArt(c);return a==='heavy-snow'?'snow':a};"
      + "const kcTestWetter=({schnee:'snow',regen:'rain',gewitter:'storm',sonne:'sun',wolken:'cloud'})[new URLSearchParams(location.search).get('wetter')]||'';" },
  { name: 'Wetter: aktuelle Wetterart setzen',
    alt: 'weather.today.temp=`${Math.round(data.current.temperature_2m)} °C`;',
    neu: 'weather.today.temp=`${Math.round(data.current.temperature_2m)} °C`;window.KC_WETTER_ART=kcArt(data.current.weather_code);'
      + "if(kcTestWetter){window.KC_WETTER_ART=kcTestWetter;for(const k of ['today','tomorrow','day2','day3','day4','day5'])if(weather[k])weather[k].kind=kcTestWetter}" },
  { name: 'Wettereffekt je Folie folgt dem echten Wetter',
    alt: 'function effect(slide){const fx=slide.effectLayer||{},opacity=(fx.opacity??62)/100;return[fx.type,fx.type2,fx.type3]',
    neu: "function kcWetterEffekt(){const a=window.KC_WETTER_ART||'';return a==='snow'||a==='heavy-snow'?'heavy-snow':a==='rain'||a==='storm'?'rain':a==='sun'?'sun':'none'}"
      + 'function effect(slide){const fx=slide.effectLayer||{},opacity=(fx.opacity??62)/100;return(fx.weatherAuto?[kcWetterEffekt()]:[fx.type,fx.type2,fx.type3])' },
  { name: 'alter Wetterschleier auf allen Folien abgeschaltet',
    alt: 'new MutationObserver(()=>setTimeout(mount,0)).observe(stage,{childList:true});update();setInterval(update,1800000);',
    neu: '/* ersetzt durch den Wettereffekt je Folie (weatherAuto) */' },
  { name: 'Laufschrift minimal langsamer', alt: 'const TEMPO=36;', neu: 'const TEMPO=30;' },
  { name: 'Laufschrift: Abstand zwischen den Themenblöcken',
    alt: "stueck.textContent=text+'   ·   ';",
    neu: "text.split(/\\s*•\\s*/).forEach(b=>{const t=document.createElement('span');t.textContent=b;stueck.appendChild(t);const p=document.createElement('span');p.className='kcTickerPause';p.textContent='✦';stueck.appendChild(p)});" },
  { name: 'Wetterkacheln mit eigenem Wetter je Tag; durchgehendes Laufband', alt: '</body></html>',
    neu: KACHEL_WETTER + HINWEIS_RASTER + '<script>window.KC_LAUFSCHRIFT=' + JSON.stringify(['Der Köcheclub Werne begrüßt Sie herzlich auf dem Weihnachtsmarkt 2026', ...LAUFSCHRIFT_THEMEN]).replace(/</g, '\\u003c') + ';</script>' + AUFNAHME + PROGRAMM.laufzeitHtml() + LAUFBAND + '</body></html>' },
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
  html = html.slice(0, a + anfang.length) + neu + PROGRAMM.NUR_LIVE_AUSBLENDEN + html.slice(e + 1);

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
  // Betreiber 16.11.2026: auf allen Preislisten „Mettendchen“ statt „Mettwurst“ (Artikelnamen der Original-Folien)
  for (const [alt, neu] of [['Grünkohl a la Köcheclub mit Mettwurst', 'Grünkohl a la Köcheclub mit Mettendchen'],
    ['Sauerkrauteintopf mit Mettwurst', 'Sauerkrauteintopf mit Mettendchen'], ['Kasslerwürfel, Mettwurst"', 'Kasslerwürfel, Mettendchen"']]) html = html.split(alt).join(neu);
  return { html, log, projekt };
}

if (require.main === module) {
  const [quelle, bild, ziel] = process.argv.slice(2);
  if (!quelle || !bild || !ziel) { console.error('Aufruf: node tools/tv-endversion-bauen.cjs <index.html> <bild.jpg> <ziel.html>'); process.exit(1); }
  const typ = /\.png$/i.test(bild) ? 'image/png' : /\.webp$/i.test(bild) ? 'image/webp' : 'image/jpeg';
  const daten = `data:${typ};base64,${fs.readFileSync(bild).toString('base64')}`;
  const logoDatei = path.join(__dirname, '..', 'media', 'kc-kochmuetze-weiss.webp');
  const freisteller = path.join(__dirname, '..', 'media', 'eierlikoerpunsch-freisteller.png');
  const foto = path.join(__dirname, '..', 'media', 'eierlikoerpunsch-tv.jpg');
  const extras = fs.existsSync(freisteller)
    ? { eierpunschFoto: `data:image/png;base64,${fs.readFileSync(freisteller).toString('base64')}`, eierpunschFreisteller: true }
    : fs.existsSync(foto) ? { eierpunschFoto: `data:image/jpeg;base64,${fs.readFileSync(foto).toString('base64')}` } : {};
  if (fs.existsSync(logoDatei)) extras.logoWeiss = `data:image/webp;base64,${fs.readFileSync(logoDatei).toString('base64')}`;
  const { html, log } = bauen(fs.readFileSync(quelle, 'utf8'), daten, extras);
  fs.writeFileSync(ziel, html);
  log.forEach((z) => console.log('  ' + z));
  console.log(`Endversion geschrieben: ${path.resolve(ziel)} (${(html.length / 1048576).toFixed(1)} MB)`);
}

module.exports = { bauen, MITGLIEDER, HINWEISE };
