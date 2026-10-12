// KC Schulungsvideos – INHALTE (Themen und kleine Videos)                     KC-KASSE-SCHULUNGSVIDEOS-INHALT 0.3.1 · 12.10.2026
//
// Getrennt vom Abspieler (kc-schulungsvideos.js): hier stehen nur Texte und Fingerwege. Ein neues Video = ein neuer
// Eintrag in VIDEOS; eine Ueberarbeitung zaehlt "stand" hoch (die Bewertung zaehlt dann neu).
//
// Regeln fuer jedes Video (Betreiber: "kleine Videos, immer ein Thema, wie in der Club-App"):
// * ein Gedanke je Schritt, kurzer Satz, genau dabei tippt der Finger (tipp) – gesagt wird nur, was zu sehen ist
// * erwaehnte Knoepfe pulsieren (zeig)
// * NIE etwas buchen: BAR, STIMMT SO, Speichern, Bestaetigen beim Bon-Verwerfen werden nur gezeigt, nicht getippt
// * "uebung" verweist auf die passende Aufgabe der Uebungsliste
//
// Station: { wer: 'laura'|'marc', x: Text, tipp?: Waehler | [Waehler…], zeig?: [Waehler…], tafel?: HTML,
//            vor?: async () => vorbereiten (ohne Finger), tun?: async F => besondere Vorfuehrung }
(function (global) {
  'use strict';
  global.KCSchulungsvideoInhalt = function (H) {
    const {tafel, el, warte, alleFensterZu, artikel, gruppe, variante, info, lege} = H;

    const THEMEN = [
      {id: 'oberflaeche', sym: '🖥️', t: 'Oberfläche'},
      {id: 'verkaufen', sym: '🛒', t: 'Verkaufen'},
      {id: 'rueckgeld', sym: '💶', t: 'Rückgeld & Bezahlen'},
      {id: 'entnahmen', sym: '💸', t: 'Entnahmen'}
    ];

    const VIDEOS = [
      // ===================================== 🖥️ OBERFLÄCHE =====================================
      {id: 'o-kopfzeile', stand: '1', thema: 'oberflaeche', sym: '🔝', t: 'Kopfzeile und Lampen', u: 'Was oben steht und was die Lampen sagen (ca. 1 Min.)',
        st: [
          {wer: 'laura', x: 'Hallo, ich bin Laura. Ich zeige dir die Kopfzeile der Kasse.', zeig: ['.app-header']},
          {wer: 'laura', x: 'Oben links wählst du die Warengruppen: Getränke, Speisen, Pfand und mehr.', zeig: ['#categories']},
          {wer: 'marc', x: 'Die drei Lampen zeigen: Gerät, Sicherung und Online. Grün heißt: alles in Ordnung.', zeig: ['#kcLedBlock']},
          {wer: 'marc', x: 'Ist eine Lampe nicht grün, kassierst du trotzdem weiter. Die Kasse speichert alles auf dem Gerät.', zeig: ['#kcLedBlock']},
          {wer: 'laura', x: 'Rechts findest du die Uhr zum Kommen und Gehen, die Sperre und das Menü.', zeig: ['#timeClockBtn', '#screenLockBtn', '#menuBtn']}
        ]},
      {id: 'o-warengruppen', stand: '1', thema: 'oberflaeche', sym: '🗂️', t: 'Warengruppen', u: 'Zwischen Getränken, Speisen und Kombis wechseln (ca. 1 Min.)', uebung: 'Aufgabe 2 und 8',
        st: [
          {wer: 'marc', x: 'Die Artikel sind nach Warengruppen sortiert. Die Zahl zeigt, wie viele Artikel darin sind.', zeig: ['#categories']},
          {wer: 'marc', x: 'Tippe auf Speisen.', tipp: gruppe('Speisen')},
          {wer: 'laura', x: 'Jetzt siehst du Grünkohl, Eintopf, Kartoffeln und Mettwurst.', zeig: ['#productGrid']},
          {wer: 'laura', x: 'Unter Favoriten stehen die Artikel, die am meisten verkauft werden.', tipp: gruppe('Favoriten')},
          {wer: 'marc', x: 'Und zurück zu den Getränken.', tipp: gruppe('Getränke')}
        ]},
      {id: 'o-kacheln', stand: '1', thema: 'oberflaeche', sym: '🟦', t: 'Artikelkacheln lesen', u: 'Preis, i für Infos und das blaue Plus (ca. 1 Min.)', uebung: 'Aufgabe 46',
        vor: async () => H.gruppeWaehlen('Getränke'),
        st: [
          {wer: 'laura', x: 'Jede Kachel ist ein Artikel. Unten links steht der Preis.', zeig: [artikel('Glühwein rot')]},
          {wer: 'laura', x: 'Das kleine i zeigt Infos und Allergene.', tipp: info('Glühwein rot')},
          {wer: 'marc', x: 'Hier stehen Zutaten und Allergene. Damit beantwortest du Fragen der Gäste.', zeig: ['#productInfoDialog .dialog-card', 'dialog[open] .dialog-card']},
          {wer: 'marc', x: 'Das blaue Plus öffnet die Varianten, zum Beispiel einen Schuss Rum.', vor: async () => alleFensterZu(), zeig: [variante('Glühwein rot')]},
          {wer: 'laura', x: 'Ein Tipp auf die Kachel selbst legt den Artikel in den Warenkorb.', zeig: [artikel('Glühwein rot')]}
        ]},
      {id: 'o-warenkorb', stand: '1', thema: 'oberflaeche', sym: '🧺', t: 'Der Warenkorb', u: 'Zeilen, Menge und Gesamtbetrag (ca. 1 Min.)',
        st: [
          {wer: 'marc', x: 'Rechts ist der Warenkorb. Tippe auf Glühwein rot.', tipp: artikel('Glühwein rot')},
          {wer: 'marc', x: 'Der Glühwein steht jetzt im Warenkorb. Das Glaspfand kommt von selbst dazu.', zeig: ['.cart-row']},
          {wer: 'laura', x: 'In jeder Zeile: halbe Portion, Minus, Plus und der rote Papierkorb.', zeig: ['.cart-row [data-a="half"]', '.cart-row [data-a="minus"]', '.cart-row [data-a="plus"]', '.cart-row [data-a="delete"]']},
          {wer: 'laura', x: 'Oben die Mengenknöpfe von eins bis sechs.', zeig: ['#cartQuantityBar']},
          {wer: 'marc', x: 'Unten steht, was der Gast bezahlen muss.', zeig: ['#grandTotal']}
        ]},
      {id: 'o-bar-rueckgeld', stand: '1', thema: 'oberflaeche', sym: '💶', t: 'BAR und RÜCKGELD', u: 'Die beiden Wege zum Bezahlen (ca. 1 Min.)', uebung: 'Aufgabe 1 und 18',
        vor: async () => lege('Glühwein rot'),
        st: [
          {wer: 'laura', x: 'Zum Bezahlen gibt es zwei Wege.', zeig: ['#payBtn', '#kcZahlenTaste']},
          {wer: 'laura', x: 'Gibt der Gast passend, tippst du auf BAR. Das schließt den Bon ab.', zeig: ['#payBtn']},
          {wer: 'marc', x: 'Gibt der Gast mehr, tippst du auf RÜCKGELD.', tipp: '#kcZahlenTaste'},
          {wer: 'marc', x: 'Hier tippst du die Scheine und Münzen an. Die Kasse rechnet das Rückgeld aus.', zeig: ['#banknotes', '#coins']},
          {wer: 'laura', x: 'Mit dem Pfeil unten links geht es zurück zur Kasse.', tipp: '#kcZahlenZurueckTaste'}
        ]},
      {id: 'o-mehr', stand: '1', thema: 'oberflaeche', sym: '•••', t: 'MEHR und Menü', u: 'Wo die weiteren Funktionen sind (ca. 1 Min.)',
        st: [
          {wer: 'marc', x: 'Was nicht auf der Hauptseite ist, findest du unter Mehr.', tipp: '#moreBtn'},
          {wer: 'marc', x: 'Oben die Geld-Sachen: Entnahme, Trinkgeld, Pfand, Gutschein und Helfer.', zeig: ['#moreDialog [data-action="withdraw"]', '#moreDialog [data-action="tip"]', '#moreDialog [data-action="gutschein"]', '#moreDialog [data-action="helfer"]']},
          {wer: 'laura', x: 'Darunter die Kasse: Eröffnung, Tagesabschluss und Bargeldübergabe.', zeig: ['#moreDialog [data-action="opening"]', '#moreDialog [data-action="closing"]', '#moreDialog [data-action="cashdeposit"]']},
          {wer: 'laura', x: 'Und ganz unten diese Schulungsvideos.', zeig: ['#kcSvMehrBtn']},
          {wer: 'marc', x: 'Mit Schließen geht es zurück zur Kasse.', tipp: '#moreDialog button[value="close"]'}
        ]},

      // ===================================== 🛒 VERKAUFEN =====================================
      {id: 'v-ein-artikel', stand: '1', thema: 'verkaufen', sym: '🍷', t: 'Einen Artikel verkaufen', u: 'Antippen, BAR – fertig (ca. 1 Min.)', uebung: 'Aufgabe 1 und 2',
        st: [
          {wer: 'laura', tafel: tafel('frage', '🗣️ Der Gast sagt', ['„Einen roten Glühwein, bitte.“']), x: 'Der Gast sagt: Einen roten Glühwein, bitte.'},
          {wer: 'laura', x: 'Tippe auf Glühwein rot.', tipp: artikel('Glühwein rot')},
          {wer: 'marc', x: 'Im Warenkorb: fünf Euro fünfzig. Darin sind zwei Euro Glaspfand.', zeig: ['.cart-row', '#grandTotal']},
          {wer: 'marc', x: 'Gibt der Gast passend, tippst du auf BAR. Fertig. Hier im Video schließe ich nicht ab.', zeig: ['#payBtn']}
        ]},
      {id: 'v-warengruppen', stand: '1', thema: 'verkaufen', sym: '🍲', t: 'Getränk und Essen', u: 'Artikel aus zwei Warengruppen (ca. 1 Min.)', uebung: 'Aufgabe 8',
        st: [
          {wer: 'laura', tafel: tafel('frage', '🗣️ Der Gast sagt', ['„Einen roten Glühwein und einen Grünkohl.“']), x: 'Der Gast möchte einen roten Glühwein und einen Grünkohl.'},
          {wer: 'laura', x: 'Erst Glühwein rot.', tipp: artikel('Glühwein rot')},
          {wer: 'marc', x: 'Dann oben auf Speisen.', tipp: gruppe('Speisen')},
          {wer: 'marc', x: 'Und auf Grünkohl.', tipp: artikel('Grünkohl')},
          {wer: 'laura', x: 'Beide stehen untereinander im Warenkorb: elf Euro.', zeig: ['#cartList', '#grandTotal']},
          {wer: 'laura', x: 'Danach wie immer: BAR oder RÜCKGELD.', zeig: ['#payBtn', '#kcZahlenTaste'], tun: async () => H.gruppeWaehlen('Getränke')}
        ]},
      {id: 'v-menge', stand: '1', thema: 'verkaufen', sym: '🔢', t: 'Menge ändern', u: 'Mengenknöpfe, Plus und Minus (ca. 1 Min.)', uebung: 'Aufgabe 3 und 17',
        st: [
          {wer: 'marc', tafel: tafel('frage', '🗣️ Der Gast sagt', ['„Drei rote Glühwein, bitte.“']), x: 'Der Gast möchte drei rote Glühwein.'},
          {wer: 'marc', x: 'Erst den Artikel antippen.', tipp: artikel('Glühwein rot')},
          {wer: 'laura', x: 'Dann oben die Drei.', tipp: '[data-cart-qty="3"]'},
          {wer: 'laura', x: 'Jetzt stehen drei Glühwein im Warenkorb.', zeig: ['.cart-row']},
          {wer: 'marc', x: 'Einer mehr? Dann in der Zeile auf Plus.', tipp: '.cart-row [data-a="plus"]'},
          {wer: 'marc', x: 'Einer weniger? Auf Minus.', tipp: '.cart-row [data-a="minus"]'},
          {wer: 'laura', x: 'Für große Mengen gibt es die drei Punkte. Dort tippst du jede Zahl ein.', zeig: ['#moreQuantityBtn']}
        ]},
      {id: 'v-halbe-portion', stand: '1', thema: 'verkaufen', sym: '½', t: 'Halbe Portion', u: 'Ein ganzer und ein halber Glühwein (ca. 1 Min.)', uebung: 'Aufgabe 11 bis 14',
        st: [
          {wer: 'laura', tafel: tafel('frage', '🗣️ Der Gast sagt', ['„Einen ganzen und einen halben roten Glühwein.“']), x: 'Der Gast möchte einen ganzen und einen halben roten Glühwein.'},
          {wer: 'laura', x: 'Tippe zweimal auf Glühwein rot.', tipp: [artikel('Glühwein rot'), artikel('Glühwein rot')]},
          {wer: 'marc', x: 'Dann in der Zeile auf das Halb-Zeichen.', tipp: '.cart-row [data-a="half"]'},
          {wer: 'marc', x: 'Eine Zeile wandert als halbe Portion darunter. Zusammen neun Euro fünfundzwanzig.', zeig: ['#cartList', '#grandTotal']},
          {wer: 'laura', tafel: tafel('merke', '💡 Merke', ['Das Pfand wird <b>nie</b> halbiert.']), x: 'Merke: Das Pfand wird nie halbiert.'}
        ]},
      {id: 'v-variante', stand: '1', thema: 'verkaufen', sym: '➕', t: 'Variante über das Plus', u: 'Glühwein mit Schuss Rum (ca. 1 Min.)', uebung: 'Aufgabe 4 und 5',
        st: [
          {wer: 'marc', tafel: tafel('frage', '🗣️ Der Gast sagt', ['„Einen roten Glühwein mit Schuss Rum.“']), x: 'Der Gast möchte einen roten Glühwein mit Schuss Rum.'},
          {wer: 'marc', x: 'Tippe auf der Kachel auf das blaue Plus.', tipp: variante('Glühwein rot')},
          {wer: 'laura', x: 'Jetzt wählst du den Schuss: Schuss Rum.', tipp: '#optionDialog [data-option="rum"]'},
          {wer: 'laura', x: 'Im Warenkorb steht: plus Schuss Rum. Zusammen sechs Euro fünfzig.', zeig: ['.cart-row', '#grandTotal']}
        ]},
      {id: 'v-kombi', stand: '1', thema: 'verkaufen', sym: '🍽️', t: 'Kombi und Favoriten', u: 'Essen und Getränk mit einem Tipp (ca. 1 Min.)', uebung: 'Aufgabe 6 und 7',
        st: [
          {wer: 'laura', tafel: tafel('frage', '🗣️ Der Gast sagt', ['„Einmal Grünkohl und einen roten Glühwein.“']), x: 'Der Gast möchte Grünkohl und einen roten Glühwein.'},
          {wer: 'laura', x: 'Das geht mit einem Tipp. Oben auf Kombi.', tipp: gruppe('Kombi')},
          {wer: 'marc', x: 'Und auf Grünkohl plus Glühwein rot.', tipp: artikel('Grünkohl + Glühwein rot')},
          {wer: 'marc', x: 'Der Preis ist derselbe wie einzeln: elf Euro.', zeig: ['#cartList', '#grandTotal']},
          {wer: 'laura', x: 'Unter Favoriten findest du die meistverkauften Artikel.', tipp: gruppe('Favoriten'), tun: async () => { await warte(900); H.gruppeWaehlen('Getränke'); }}
        ]},
      {id: 'v-loeschen', stand: '1', thema: 'verkaufen', sym: '🗑️', t: 'Artikel oder Bon löschen', u: 'Eine Zeile löschen oder den ganzen Bon verwerfen (ca. 1 Min.)', uebung: 'Aufgabe 9 und 10',
        st: [
          {wer: 'marc', tafel: tafel('frage', '🗣️ Der Gast sagt', ['„Glühwein weiß und Feuerzangenbowle … ach nein, doch keine Feuerzangenbowle.“']), x: 'Der Gast bestellt Glühwein weiß und Feuerzangenbowle. Dann doch keine Feuerzangenbowle.'},
          {wer: 'marc', x: 'Tippe Glühwein weiß und Feuerzangenbowle.', tipp: [artikel('Glühwein weiß'), artikel('Feuerzangenbowle')]},
          {wer: 'laura', x: 'In der Zeile Feuerzangenbowle tippst du auf den roten Papierkorb.', tipp: '.cart-row[data-cart-index="1"] [data-a="delete"]'},
          {wer: 'laura', x: 'Die Kasse fragt nach. Tippe auf Bestätigen.', tipp: '#confirmAction'},
          {wer: 'marc', x: 'Die Feuerzangenbowle ist weg. Nur der Glühwein bleibt.', zeig: ['#cartList']},
          {wer: 'marc', x: 'Will der Gast gar nichts mehr, verwirfst du den ganzen Bon mit dem Papierkorb oben.', tipp: '#voidBonBtn'},
          {wer: 'laura', x: 'Mit Bestätigen ist der Bon weg. Hier im Video tippe ich auf Abbrechen.', zeig: ['#confirmAction'],
            tun: async F => { await warte(1200); await F.click('#confirmDialog button[value="cancel"]', {after: 600}); }}
        ]},

      // ===================================== 💶 RÜCKGELD & BEZAHLEN =====================================
      {id: 'r-passend', stand: '1', thema: 'rueckgeld', sym: '✅', t: 'BAR – der Gast zahlt passend', u: 'Der schnellste Weg (ca. ½ Min.)', uebung: 'Aufgabe 1',
        st: [
          {wer: 'laura', x: 'Ein roter Glühwein kostet mit Pfand fünf Euro fünfzig.', tipp: artikel('Glühwein rot')},
          {wer: 'laura', tafel: tafel('frage', '🗣️ Der Gast gibt', ['genau 5,50 €']), x: 'Der Gast gibt genau fünf Euro fünfzig.'},
          {wer: 'marc', x: 'Dann tippst du direkt auf BAR. Der Bon ist abgeschlossen. Im Video tippe ich nicht.', zeig: ['#payBtn']}
        ]},
      {id: 'r-schein', stand: '1', thema: 'rueckgeld', sym: '💶', t: 'Rückgeld mit Schein', u: 'Schein antippen, Rückgeld ablesen (ca. 1 Min.)', uebung: 'Aufgabe 18',
        vor: async () => lege('Glühwein rot'),
        st: [
          {wer: 'marc', tafel: tafel('frage', '🗣️ Der Gast gibt', ['einen 10-€-Schein für 5,50 €']), x: 'Der Gast gibt für fünf Euro fünfzig einen Zehner.'},
          {wer: 'marc', x: 'Tippe auf RÜCKGELD.', tipp: '#kcZahlenTaste'},
          {wer: 'laura', x: 'Dann auf den Zehn-Euro-Schein.', tipp: '#banknotes [data-value="10"]'},
          {wer: 'laura', x: 'Die Kasse zeigt: vier Euro fünfzig zurück.', zeig: ['.change-card']},
          {wer: 'marc', x: 'Rückgeld geben, dann auf BAR. Im Video schließe ich nicht ab.', zeig: ['#payBtn']}
        ]},
      {id: 'r-stimmt-so', stand: '1', thema: 'rueckgeld', sym: '💝', t: '„Stimmt so“ und Aufrunden', u: 'Wenn der Gast Trinkgeld gibt (ca. 1 Min.)', uebung: 'Aufgabe 19 und 21',
        vor: async () => lege('Glühwein rot'),
        st: [
          {wer: 'laura', tafel: tafel('frage', '🗣️ Der Gast sagt', ['„Hier sind zehn Euro, stimmt so.“']), x: 'Der Gast gibt zehn Euro und sagt: Stimmt so.'},
          {wer: 'laura', x: 'Tippe auf RÜCKGELD und auf den Zehner.', tipp: ['#kcZahlenTaste', '#banknotes [data-value="10"]']},
          {wer: 'marc', x: 'Jetzt auf Stimmt so. Der Rest wird als Trinkgeld gebucht, und der Bon ist fertig. Im Video tippe ich nicht.', zeig: ['#exactCashBtn']},
          {wer: 'marc', x: 'Sagt der Gast: Mach zehn draus, nimmst du Aufrunden.', tipp: '#roundUpBtn'},
          {wer: 'laura', x: 'Hier wählst du den Betrag. Darunter steht, wie viel Trinkgeld das ist.', zeig: ['#roundUpDialog .dialog-card'],
            tun: async () => { await warte(1800); el('roundUpDialog')?.close(); }}
        ]},
      {id: 'r-zu-wenig', stand: '1', thema: 'rueckgeld', sym: '⚠️', t: 'Zu wenig gegeben', u: 'Wenn noch Geld fehlt (ca. 1 Min.)', uebung: 'Aufgabe 25',
        vor: async () => lege('Glühwein rot'),
        st: [
          {wer: 'marc', tafel: tafel('frage', '🗣️ Der Gast gibt', ['nur 5 € für 5,50 €']), x: 'Der Gast gibt nur fünf Euro. Es kostet aber fünf Euro fünfzig.'},
          {wer: 'marc', x: 'RÜCKGELD und den Fünfer antippen.', tipp: ['#kcZahlenTaste', '#banknotes [data-value="5"]']},
          {wer: 'laura', x: 'Die Kasse wird rot: noch fünfzig Cent fehlen.', zeig: ['.change-card']},
          {wer: 'laura', x: 'Gibt der Gast noch fünfzig Cent, tippst du die Münze dazu.', tipp: '#coins [data-value="0.5"]'},
          {wer: 'marc', x: 'Jetzt passt es. Dann auf BAR.', zeig: ['.change-card', '#payBtn']}
        ]},
      {id: 'r-korrigieren', stand: '1', thema: 'rueckgeld', sym: '↶', t: 'Vertippt? Korrigieren', u: 'Letzte Eingabe zurück oder alles löschen (ca. 1 Min.)', uebung: 'Aufgabe 20',
        vor: async () => lege('Feuerzangenbowle'),
        st: [
          {wer: 'laura', tafel: tafel('frage', '🗣️ Der Gast sagt', ['„Hier sind 100 Euro … ach, ich hab’s passender: 2 × 50 Euro.“']), x: 'Der Gast gibt erst hundert Euro. Dann hat er es doch passender.'},
          {wer: 'laura', x: 'Tippe auf RÜCKGELD und auf den Hunderter.', tipp: ['#kcZahlenTaste', '#banknotes [data-value="100"]']},
          {wer: 'marc', x: 'Mit Zurück nimmst du die letzte Eingabe zurück.', tipp: '#undoCashBtn'},
          {wer: 'marc', x: 'Dann zweimal den Fünfziger.', tipp: ['#banknotes [data-value="50"]', '#banknotes [data-value="50"]']},
          {wer: 'laura', x: 'Alles falsch? Mit Löschen ist alles Gegebene weg, und du fängst neu an.', zeig: ['#kcGegebenLoeschen']}
        ]},

      // ===================================== 💸 ENTNAHMEN =====================================
      {id: 'entnahme-zeitpunkt', stand: '2', thema: 'entnahmen', sym: '🛒', t: 'Erst einkaufen, dann entnehmen',
        u: 'Warum die Entnahme erst nach dem Einkauf gebucht wird (ca. 1½ Min.)', uebung: 'Aufgabe 56 und 57',
        st: [
          {wer: 'laura', tafel: tafel('frage', '🛒 Schnell etwas einkaufen', ['Jemand vom Team kauft im Supermarkt ein.', 'Das Geld kommt aus der Kasse.']),
            x: 'Hallo, ich bin Laura. Heute zeigen Marc und ich dir die Entnahme. Jemand vom Team kauft im Supermarkt ein. Das Geld kommt aus der Kasse.'},
          {wer: 'marc', tafel: tafel('falsch', '❌ So bitte nicht', ['50 € nehmen und <b>sofort</b> 50 € buchen']),
            x: 'So bitte nicht: fünfzig Euro nehmen und sofort fünfzig Euro buchen.'},
          {wer: 'marc', tafel: tafel('falsch', '❌ So bitte nicht', ['50 € nehmen und <b>sofort</b> 50 € buchen', 'Einkauf kostet nur 38,40 €', '11,60 € kommen zurück → <b>zweite Buchung</b>']),
            x: 'Der Einkauf kostet aber nur achtunddreißig Euro vierzig. Elf Euro sechzig kommen zurück. Dann brauchst du eine zweite Buchung.'},
          {wer: 'laura', tafel: tafel('richtig', '✅ So ist es richtig', ['<b>Erst einkaufen</b> – Geld mitgeben, noch nichts buchen']),
            x: 'Richtig ist: Erst einkaufen. Du gibst das Geld mit, buchst aber noch nichts.'},
          {wer: 'laura', tafel: tafel('richtig', '✅ So ist es richtig', ['<b>Erst einkaufen</b> – Geld mitgeben, noch nichts buchen', 'Rückgeld zurück in die Kasse', '<b>Einmal</b> den Betrag vom Bon buchen']),
            x: 'Kommt der Einkauf zurück, legst du das Rückgeld in die Kasse. Dann buchst du einmal den Betrag vom Bon.'},
          {wer: 'marc', x: 'So geht es an der Kasse. Tippe unten auf Mehr.', tipp: '#moreBtn'},
          {wer: 'marc', x: 'Dann auf Entnahme.', tipp: '#moreDialog [data-action="withdraw"]'},
          {wer: 'laura', x: 'Wähle den Grund: Einkauf Lebensmittel.', tipp: '[data-withdraw-reason="Einkauf Lebensmittel"]'},
          {wer: 'marc', x: 'Auf dem Bon stehen achtunddreißig Euro vierzig. Tippe auf Anderer Betrag.', tipp: '[data-geld-anders]'},
          {wer: 'marc', x: 'Drei, acht, Komma, vier, null. Und OK.', tun: H.ziffern('38,40')},
          {wer: 'laura', x: 'Jetzt steht oben der Betrag vom Bon.', zeig: ['#kcGeldSumme']},
          {wer: 'laura', x: 'Schreib kurz dazu, wo eingekauft wurde.', tun: H.notiz('Supermarkt')},
          {wer: 'marc', x: 'Der Bon ist da. Dann muss Bon oder Quittung vorhanden angehakt sein. Den Bon legst du zur Kasse.', zeig: ['#withdrawReceiptToggle'], tun: H.bonHaken(true)},
          {wer: 'marc', x: 'Zum Schluss: Entnahme speichern. Hier im Video speichere ich nichts.', zeig: ['#saveWithdrawal']},
          {wer: 'laura', tafel: tafel('merke', '💡 Merke', ['Erst einkaufen.', 'Dann <b>einmal</b> den Betrag vom Bon buchen.'], 'Üben: Übungsliste Aufgabe 56 und 57'),
            x: 'Merke: Erst einkaufen. Dann einmal den Betrag vom Bon buchen. Üben kannst du das mit Aufgabe sechsundfünfzig und siebenundfünfzig.',
            vor: async () => alleFensterZu()}
        ]},
      {id: 'e-mit-bon', stand: '1', thema: 'entnahmen', sym: '🧾', t: 'Entnahme mit Bon', u: 'Bier für das Team, Bon ist da (ca. 1 Min.)', uebung: 'Aufgabe 56',
        st: [
          {wer: 'marc', tafel: tafel('frage', '🍺 Die Lage', ['Ein Kollege hat Bier für das Team geholt.', '20 € – der Bon ist da.']), x: 'Ein Kollege hat für zwanzig Euro Bier für das Team geholt. Der Bon ist da.'},
          {wer: 'marc', x: 'Mehr, dann Entnahme.', tipp: ['#moreBtn', '#moreDialog [data-action="withdraw"]']},
          {wer: 'laura', x: 'Grund: Getränke Personal.', tipp: '[data-withdraw-reason="Getränke Personal"]'},
          {wer: 'laura', x: 'Den Zwanzig-Euro-Schein antippen.', tipp: '#kcBetragBlock [data-geld="20"]'},
          {wer: 'marc', x: 'Notiz dazu, zum Beispiel: Bier.', tun: H.notiz('Bier')},
          {wer: 'marc', x: 'Bon oder Quittung vorhanden muss angehakt sein.', zeig: ['#withdrawReceiptToggle'], tun: H.bonHaken(true)},
          {wer: 'laura', x: 'Speichern ist jetzt grün. Hier im Video speichere ich nicht.', zeig: ['#saveWithdrawal']}
        ]},
      {id: 'e-ohne-bon', stand: '1', thema: 'entnahmen', sym: '❔', t: 'Entnahme ohne Bon', u: 'Der Bon ist weg – so buchst du trotzdem richtig (ca. 1 Min.)', uebung: 'Aufgabe 57',
        st: [
          {wer: 'laura', tafel: tafel('frage', '🛍️ Die Lage', ['Getränke fürs Personal gekauft: 12,80 €.', 'Der Bon ist weg.']), x: 'Für das Personal wurden Getränke für zwölf Euro achtzig gekauft. Der Bon ist weg.'},
          {wer: 'laura', x: 'Mehr, dann Entnahme.', tipp: ['#moreBtn', '#moreDialog [data-action="withdraw"]']},
          {wer: 'marc', x: 'Grund: Getränke Personal.', tipp: '[data-withdraw-reason="Getränke Personal"]'},
          {wer: 'marc', x: 'Anderer Betrag: eins, zwei, Komma, acht, null und OK.', tipp: '[data-geld-anders]', tun: H.ziffern('12,80')},
          {wer: 'laura', x: 'Schreib dazu, wo eingekauft wurde.', tun: H.notiz('Getränkemarkt, Bon fehlt')},
          {wer: 'laura', x: 'Ohne Bon tippst du auf Kein Bon. Der Haken bei Bon vorhanden bleibt leer.', zeig: ['#kcKeinBonKnopf'], tun: H.bonHaken(false)},
          {wer: 'marc', x: 'Dann speichern. Hier im Video speichere ich nicht.', zeig: ['#saveWithdrawal']}
        ]},
      {id: 'e-korrigieren', stand: '1', thema: 'entnahmen', sym: '↶', t: 'Betrag korrigieren', u: 'Letzte zurück und Leeren in der Entnahme (ca. 1 Min.)',
        st: [
          {wer: 'marc', x: 'Mehr, dann Entnahme.', tipp: ['#moreBtn', '#moreDialog [data-action="withdraw"]']},
          {wer: 'laura', x: 'Zuerst immer der Grund – vorher ist alles andere grau. Hier: Essen Personal.', tipp: '[data-withdraw-reason="Essen Personal"]'},
          {wer: 'marc', x: 'Jedes Antippen zählt dazu: zwei Fünfer sind zehn Euro.', tipp: ['#kcBetragBlock [data-geld="5"]', '#kcBetragBlock [data-geld="5"]']},
          {wer: 'laura', x: 'Ein Fünfer zu viel? Letzte zurück.', tipp: '#kcBetragBlock [data-geld-zurueck]'},
          {wer: 'laura', x: 'Ganz neu anfangen? Leeren.', tipp: '#kcBetragBlock [data-geld-leeren]'},
          {wer: 'marc', x: 'Erst Grund, dann Betrag, dann Bon ja oder nein. Vorher bleibt Speichern grau. So kann nichts Falsches gebucht werden.', zeig: ['#saveWithdrawal']}
        ]}
    ];
    return {THEMEN, VIDEOS};
  };
})(window);
