# Prüfbericht – Objekt-Studio Baustufe 1
**Von:** Claude (unabhängige Prüfung und Neubau)
**Basis:** V0.31.3.6 Repair 63 "Symbole/Aktivierungscode Candidate"
**Ergebnis:** V0.31.3.6 Repair 64 "Objekt-Studio Baustufe 1 Candidate"
**Tests:** 40/40 PASS (39 bestehende + 1 neuer Regressionstest)

## Ausgangsproblem
Im TV-Bildschirm-Editor (pc-manager) öffnete sich beim Anklicken eines Objekts (Hintergrund,
Textfeld, Laufschrift, Symbole) nicht mehr zuverlässig nur der dazu passende Werkzeugkasten.

## Root Cause
Mindestens fünf unabhängige `MutationObserver` schrieben unkoordiniert in denselben Bereich
(`#tvContextEditor`), dazu zwei komplett unangebundene Legacy-Renderer in `app.js`:
- `tv-weihnachtsmarkt-presentation.js` fügte seine Hintergrund-Karte unabhängig vom gewählten
  Objekttyp bei jeder Änderung wieder oben ein (der ursprünglich gemeldete Fehler)
- `app.js` enthielt zusätzlich ein zweites, bislang unentdecktes "Position und Größe"-Werkzeug,
  das ganz ohne Rücksicht auf das neue/alte Auswahlsystem in dieselbe Fläche schrieb
- `app.js` enthielt eine dritte Legacy-Karte ("Professionelle Typografie"), abschaltbar über
  `window.KC_DISABLE_LEGACY_TV_EDITORS`, aber praktisch inert (setzt auf nicht mehr vorhandene
  Marker) – deren Existenz-Check wurde dennoch korrekt verdrahtet
- Zwei Dateien registrierten je ein eigenes Rechtsklick-Kontextmenü auf denselben Objekten
- `tv-context-effect-fix.js` enthielt als einzige tatsächlich funktionierende Stelle die
  Steuerung für Schnee/Glitzer/Goldregen – wurde nicht einfach gelöscht, sondern sauber in das
  neue Modul übernommen

## Neubau
Ein neues Modul **`pc-manager/kc-object-studio.js`** übernimmt jetzt vollständig: Auswahl,
Werkzeugkasten-Rendering pro Objekttyp, Rahmen-Aufziehen per Maus (auch für mehrere freie
Textfelder), Objekt einsetzen/wiederherstellen, Animation & Sondereffekte, Folienübergänge.

**Ersetzt (aus `index.html` entfernt):**
`tv-unified-editor.js`, `tv-content-object-core-v02940.js`, `tv-context-inspector-v02942.js`,
`tv-repair60-consolidation.js`, `tv-context-effect-fix.js`, `tv-object-productivity-v02941.js`,
`tv-object-library-v02945.js`, `tv-draw-textbox-v02948.js`, `tv-draw-ticker-v02957.js`

**Angepasst statt ersetzt** (Funktionalität außerhalb des Werkzeugkastens bleibt erhalten):
- `app.js`: zwei zusätzlich gefundene Legacy-Renderer sicher abgeschaltet (dynamische Prüfung
  des Abschalt-Flags, nicht nur bei Registrierung – wichtig wegen Ladereihenfolge);
  Partikel-Renderer um den neuen Regen-Effekt ergänzt
- `tv-editor-workflow.js`: doppeltes Kontextmenü entfernt, Rückgängig/Wiederholen und
  Tastenkürzel bleiben
- `tv-weihnachtsmarkt-presentation.js`: Hintergrund-Karte jetzt an die Folien-Auswahl gebunden
- `tv-custom-text-editor-v02954.js`: Klick auf ein freies Textfeld öffnet jetzt auch den
  Werkzeugkasten
- `tv-object-context-menu-v02944.js`: unverändert, ist jetzt das einzige Kontextmenü

**Unangetastet:** Kasse, Umsatzimport, Bestand, Navigation, Zeiterfassung, Rezepte, TV-Player,
sowie alle Dateien, die nicht den Werkzeugkasten betreffen (Ebenenreihenfolge in der Folienliste,
Anzeigematrix, Tabellen-Editor, Import, geteilter Renderer für Bühne/Player-Parität usw.)

## Umgesetzter Funktionsumfang (Baustufe 1)
- Kontextbezogener Werkzeugkasten je Objekttyp, logisch gruppiert (Inhalt → Schrift →
  Ausrichtung → Fläche/Rahmen → Position)
- Vollständiges Laufschrift-Core an einer Stelle: Inhaltsquelle, Lauf-Verhalten, Schrift & Optik,
  Rahmen & Hintergrund
- Rahmen-Aufziehen per Maus für Text/Grafik/Laufschrift/Preis/Banner/Sonderelement + beliebig
  viele freie Textfelder
- Bild-Objekt (Upload, Zuschnitt, Rahmen) – bisher nicht vorhanden
- Rahmen-Presets (Gold, Silber, Eisblau, Rustikal-Holz, Neon) zusätzlich zu freien Reglern
- Erweiterte Schriftarten inkl. Schreibschrift, Handschrift, Plakativ
- Verlaufs-Hintergrund mit Winkel
- 11 Folienübergänge (9 vorhandene + Unschärfe, Schwenk aktiviert)
- Animation & Sondereffekte inkl. neuem Regen-Effekt, aus der bisher einzig funktionierenden
  Stelle sauber übernommen

## Bewusst zurückgestellt (Baustufe 2/3, wie besprochen)
Mehrfachauswahl & Gruppieren, Ausrichtungshilfen/Smart Guides, Ebenen-Übersicht,
Objekt-Animationen beim Erscheinen, Text-Auto-Fit, Gestaltungs-Vorlagen/Themes.

## Prüfung
- 39 bestehende Tests aktualisiert, wo sie Dateinamen der abgelösten Skripte direkt prüften
  (jetzt gegen `kc-object-studio.js` geprüft), alle weiterhin grün
- 1 neuer Test (`kc-object-studio-consolidation.test.cjs`) sichert den ursprünglichen Fehler und
  alle zusätzlich gefundenen Altlast-Konflikte dauerhaft gegen Regression ab
- Alle JS-Dateien syntaktisch geprüft (`node -c`)

## Offene Praxisprüfung
Automatisiert geprüft, wie immer bei "Candidate"-Status noch keine Bedienprüfung am echten
Bildschirm. Bitte insbesondere testen: Rahmen-Aufziehen für alle Typen, freies Textfeld per
Maus, Laufschrift-Komplettpanel, Regen-Effekt, Gold-Rahmen-Preset.
