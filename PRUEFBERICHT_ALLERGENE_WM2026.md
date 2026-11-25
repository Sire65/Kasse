# Prüfbericht Allergen-Nachtrag Weihnachtsmarkt 2026

Stand: 16.11.2026 · Status: **Candidate** bis zur praktischen Sichtprüfung am Gerät

## Anlass

Betreiber (16.11.2026): „Trage auch alles in die Kasse ein und in PC Manager, damit schon mal alles stimmt und drin ist.“
Grundlage sind die Etiketten (Kaub, Luana/Weihnachtsmarkt-Glühwein) und die Betreiberangaben zu den Rezepturen.

## Änderung

Einmaliger Nachtrag je Gerät (Merkzeichen `kcm_artikelinfo_wm2026_v1` im PC-Manager, `kc_artikelinfo_wm2026_v1` in der Kasse),
jeweils auch in `schulung/`. Gesetzt werden nur die genannten Allergene sowie Zutaten/Zusatzstoffe, wo belegt; alle
anderen Angaben des Artikels bleiben. Danach gilt wieder ausschließlich die Pflege im PC-Manager (einzige Pflegestelle).

| Artikel | Allergene | Quelle |
|---|---|---|
| Roter Feger, Apfelpunsch | alle 14 „nicht enthalten“ (**keine Sulfite**) | Kaub-Etikett; ersetzt die Händlerangabe Getränke Volz vom 13.10. |
| Glühwein rot / weiß | Sulfite; Zusatzstoffe Sulfite, Kaliumsorbat | Etikett |
| Eierlikörpunsch | Ei, Milch, Sulfite | Rezeptur (unverändert) |
| Feuerzangenbowle | Sulfite | bisherige Angabe, jetzt strukturiert |
| Grünkohl | Gluten (Haferflocken) enthalten; Senf, Sellerie Spuren | Betreiber |
| Grünkohl + Mettwurst | Gluten, Senf enthalten; Sellerie Spuren | Betreiber |
| Sauerkraut | Senf, Sellerie Spuren | bisherige Angabe, jetzt strukturiert |
| Sauerkraut + Mettwurst | Senf enthalten; Sellerie, Gluten Spuren | Betreiber |
| Kartoffel mit Kartoffelcreme | Milch Spuren | bisherige Angabe, jetzt strukturiert |
| Kartoffel mit Hering (Heringsstip) | Fisch, Ei, Milch, Senf | Betreiber |
| Mettwurst (geräucherte Mettendchen) | Senf enthalten; Sellerie Spuren | Betreiber |

Nicht geändert: Artikelnamen, Preise, Rum/Amaretto (Supabase-Weg), Bilder.

Reihenfolge im PC-Manager: nach den Blöcken `kcm_kaub_angaben_v1` und `kcm_eierpunsch_angaben_v1`, damit auf einem frischen
Gerät die Etikettangabe (keine Sulfite) nicht von der älteren Händlerangabe überschrieben wird.
Kasse: Verdorbene Daten (`[object Object]`) werden vorher wie in `sanitizeProduct` aus der Grundausstattung wiederhergestellt.

Build: Kasse `app.js?build=0.31.3.6-r68-allergene` (index.html und service-worker.js gleich → neuer Cache, kein Mischstand),
PC-Manager `app.js?build=bilder-v12-allergene`. `etiketten/artikel.json` neu erzeugt (`werkzeuge/etiketten/artikel-export.cjs`).

## Tests

- Neu: `tests/allergene-weihnachtsmarkt-2026.test.cjs` – Kasse, Schulungskasse, PC-Manager, Schulungs-PC-Manager; frisch und
  mit altem Stand; einmalig (spätere Pflege bleibt); Info-Fenster; keine JS-Fehler: **PASS**.
- Angepasst an die Betreiberentscheidung vom 16.11.2026 (Etikett statt Händlerangabe, Grünkohl mit Gluten):
  `artikelinfo-allergene`, `artikelinfo-kette`, `kaub-artikelinfo`: **PASS**.
- `artikelinfo-supabase`, `nebenbefunde-13-10`, `kasse-pruefung-08-10`, `altbrowser-regeln`, `market-start-reset`,
  `pfand-rueckgabe-getraenke`, `kassenbaukasten`: **PASS**.
- Gesamtlauf aller Tests: siehe Pull Request.

## Nach dem Einspielen

Im PC-Manager einmal **„An Kassen senden“** (Stammdaten-Abgleich), damit alle Tablets den Stand sofort erhalten.

## Zweiter Nachtrag (18.11.2026)

Betreiber: „Alles muss soweit auf den neuesten Stand gebracht werden, wie Daten bekannt sind.“ Einmalig je Gerät
(Merkzeichen `kcm_artikelinfo_wm2026_v2` / `kc_artikelinfo_wm2026_v2`), Kasse, PC-Manager und beide Schulungsfassungen.

| Artikel | Allergene | Zusatzstoffe | Quelle |
|---|---|---|---|
| Grünkohl (+ Mettwurst) | Gluten, Sellerie, Senf enthalten; Ei, Soja, Milch Spuren | Konservierungsstoff, Antioxidationsmittel (Kassler/Speck, übliche Angabe) | Rezept Supabase, CHEF Gemüsefond, Betreiber („Senf definitiv drin“) |
| Sauerkraut | Gluten, Sellerie enthalten; Ei, Soja, Milch, Senf Spuren | wie oben | Rezept Supabase, CHEF Gemüsefond |
| Sauerkraut + Mettwurst | Gluten, Sellerie, Senf enthalten; Ei, Soja, Milch Spuren | wie oben + Mettendchen | wie oben |
| Kartoffel mit Hering (Heringsstipp) | Fisch, Ei, Milch, Senf enthalten; Sulfite Spuren; Rest nicht enthalten | offen (Etiketten Hering/Mayonnaise/Gurken) | Betreiber-Rezept |

Zutaten jetzt wie in den Supabase-Rezepten. Build: Kasse `0.31.3.6-r70-rezepte`, PC-Manager `bilder-v14-rezepte` (nach Zusammenführung mit dem parallelen Stand „-marktbetrieb“ von main).
`etiketten/artikel.json` neu erzeugt (Club-App-Preisetiketten).
Tests: `allergene-weihnachtsmarkt-2026` erweitert (Gegenprobe: ohne Nachtrag rot), `artikelinfo-allergene` angepasst; Gesamtlauf wie zuvor –
nur die bekannten, schon auf `main` roten Tests (gutschein-teilzahlung, kassen-start-einheit, reklamation-mehrere-artikel, schulungsvideos,
tv-vorfuehrung-original, verbindungsdiagnose).

## TV-Präsentation am Stand (18.11.2026)

Die Allergen-Hinweise der TV-Präsentation („Version A“, `tools/tv-endversion-bauen.cjs` → `tv-player/weihnachtsmarkt-2026-version-a.html`)
hatten noch den Stand vor dem zweiten Nachtrag. Jetzt wie Kasse/PC-Manager: Grünkohl Gluten (Hafer), Sellerie, Senf · Spuren Ei, Soja, Milch;
Sauerkrauteintopf Gluten, Sellerie · Spuren Senf, Ei, Soja, Milch (mit Mettendchen zusätzlich Senf); Heringsstipp zusätzlich Spuren von Sulfiten;
Konservierungsstoff/Antioxidationsmittel bei Grünkohl, Sauerkraut und Mettendchen. Auf Preisfolien und Laufschrift „Mettendchen“ statt „Mettwurst“.
Test `fernseher`: 32/32.

## Eierlikörpunsch: Vanillezucker 150 g (18.11.2026)

Betreiber: „150 Gramm“ (vorher in der Notiz „3 EL“). PC-Manager und Schulungs-PC-Manager: Notiz für neue Geräte berichtigt,
auf Geräten mit altem Stand einmalig (Merkzeichen `kcm_eierpunsch_vanille_v1`); Build `bilder-v15-vanille`. Supabase-Rezept `eier`
(150 g) war schon so angelegt. Test `allergene-weihnachtsmarkt-2026` um die Notiz erweitert: PASS (frisch und alter Stand, beide
PC-Manager); die 4 Info-Fenster-Prüfungen der Kasse sind wie auf `main` rot (Start-PIN, siehe oben).

## Dritter Nachtrag: Kartoffel mit Kartoffelcreme (18.11.2026)

Betreiber schickt das Etikett „Kartoffelcreme frisch“ (FEINKOST Popp, 3-kg-Eimer, Art.-Nr. 392858) und nennt die Kartoffeln
„Peka Garkartoffeln“. Bisher stand nur „Spuren von Milch“ – laut Etikett **enthalten**: Milch (Speisequark, Joghurterzeugnis),
Ei (Eigelb), Senf (Senfsaaten); Konservierungsstoffe Kaliumsorbat, Natriumbenzoat; Säuerungsmittel, Verdickungsmittel Guarkernmehl.
Peka Original Garkartoffeln laut Hersteller/Großhandelsdatenblatt: Kartoffeln, Wasser, Salz, Festigungsmittel Calciumchlorid
(keine Allergene, kein Sulfit).

Einmalig je Gerät (`kc_artikelinfo_wm2026_v3` / `kcm_artikelinfo_wm2026_v3`), Kasse, PC-Manager und beide Schulungsfassungen;
Nährwerte der Kartoffelcreme je 100 g als Notiz (nicht als Nährwerte des Gerichts). Builds `0.31.3.6-r71-kartoffelcreme`,
`bilder-v16-kartoffelcreme`; `etiketten/artikel.json` neu (Club-App: „Eier, Milch, Senf“, mit Konservierungsstoff).
TV-Präsentation: Allergen-Box „Kartoffeln mit Kartoffelcreme: Milch, Ei, Senf · Konservierungsstoffe“.
Supabase: Rezept `knirpsecreme` (Peka Garkartoffeln, Öl, Gewürze, Kartoffelcreme Popp), Serviette bei allen Speisen,
Feuerzangenbowle (Glühwein 0,2 l, 3 Würfelzucker, 2 cl Rum 54 %), Schuss Rum/Amaretto 2 cl.
Tests: `allergene-weihnachtsmarkt-2026` erweitert (Kartoffelcreme in allen vier Fassungen, frisch und alter Stand: PASS;
die 4 Info-Fenster-Prüfungen wie auf `main` rot – Start-PIN), `fernseher` 36/36.

## Vierter Nachtrag: Feuerzangenbowle (25.11.2026)

Betreiber: „Die Feuerzangenbowle besteht aus dem gleichen Glühwein.“ Sie wird aus dem Glühwein rot (Kaub „Luana Glühwein“)
gemacht und trägt deshalb dieselben Zusatzstoffe: Konservierungsstoff und Antioxidationsmittel Sulfite, Konservierungsstoff
Kaliumsorbat. Bisher stand bei ihr nur „Enthält Sulfite“.

Der Nachtrag läuft einmalig je Gerät (`kc_artikelinfo_wm2026_v4` / `kcm_artikelinfo_wm2026_v4`) in Kasse, PC-Manager und beiden
Schulungsfassungen. Builds: Kasse und Schulungskasse `0.31.3.6-r73-feuerzange` (index.html und service-worker.js gleich, also
neuer Cache und kein Mischstand), PC-Manager `bilder-v18-feuerzange`. `etiketten/artikel.json` ist neu erzeugt.
TV-Präsentation: Feuerzangenbowle (L, 2, 3).

Eierlikörpunsch: Der Weißwein ist laut Betreiber ein Rebenschoppen von Aldi (stand schon in der Rezeptur-Notiz:
„Rebenschoppen halbtrocken“). Die Sulfite sind bereits gekennzeichnet (L). Weitere Zusatzstoffe sind nicht belegt, deshalb
keine Änderung.

Heringsstipp: Der Betreiber prüft die Etiketten noch (Hering, Mayonnaise, Gurken).

Tests: `allergene-weihnachtsmarkt-2026` um die Feuerzangenbowle erweitert. Sie besteht in allen vier Fassungen, frisch
und mit altem Stand. Die 4 Info-Fenster-Prüfungen sind wie bisher rot. `tv-allergene-abgleich` 31/31, `fernseher` 56/56,
`artikelinfo-kette` und `kaub-artikelinfo` OK.
