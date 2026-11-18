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
