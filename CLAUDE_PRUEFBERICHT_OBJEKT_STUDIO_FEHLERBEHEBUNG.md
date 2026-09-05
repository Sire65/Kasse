# Prüfbericht – Objekt-Studio Fehlerbehebung
**Basis:** V0.31.3.6 Repair 64 "Objekt-Studio Baustufe 1 Candidate" + TÜV-Bericht 2026-07-24 (BLOCKED)
**Ergebnis:** V0.31.3.6 Repair 65 "Objekt-Studio Fehlerbehebung Candidate"
**Tests:** 41/41 PASS
**Vorgabe eingehalten:** nur die gemeldeten Probleme behoben, keine laufenden/anderen Bereiche angefasst.

## Kritischster Fund: fehlende `renderProperties`-Methode
Der TÜV-Bericht zeigte 80 protokollierte Laufzeitfehler ("Script error") und mehrere Komponenten,
die angeblich "nicht registriert" waren. Ursache: `app.js` ruft an über einem Dutzend Stellen
`window.KCUnifiedEditor.renderProperties()` auf – bei jedem Folienwechsel, neuer Folie,
Duplizieren, Löschen, Verschieben, Vorlage anwenden, Import, Undo/Redo, jedem Schritt im
automatischen Testlauf. Mein neues Modul hatte diese Methode aber `render` genannt, nicht
`renderProperties` – **jede dieser Aktionen warf einen Fehler.** Das erklärt sehr wahrscheinlich
einen Großteil der gemeldeten Symptome (u.a. die Laufschrift, die nur als "Mini-Fenster" ohne
Steuerung erschien). Behoben durch einen Alias auf dieselbe Funktion.

## Die 6 gemeldeten Probleme im Einzelnen

**1. Laufschrift zeigt nur Mini-Fenster ohne Steuerung**
Direkte Folge des obigen Fehlers – der Werkzeugkasten wurde durch den Absturz nie vollständig
aufgebaut. Mit der `renderProperties`-Reparatur sollte das komplette Laufschrift-Core wieder
erscheinen (Inhaltsquelle, Lauf-Verhalten, Schrift & Optik, Rahmen & Hintergrund).

**2. Überschrift im Bau-Monitor gold, auf dem TV weiterhin weiß**
Änderungen an Schriftfarbe/-stil, Rahmen und Fläche wurden nur auf der Editor-eigenen
Vorschau angewendet, aber nicht an die eigentliche TV-Bühne weitergemeldet. Jetzt lösen
Text-, Rahmen-, Flächen- und Laufschrift-Änderungen zusätzlich `renderTvPreview()` aus.

**3. "Transparent" eingestellt, Hintergrund bleibt Glas**
Echter Bug gefunden: das Auswahlfeld für die Textflächen-Darstellung (und drei weitere:
Rahmen-Linienart, Bildausschnitt, Wetterkarten-Fläche) wurden beim Aufbau nie mit dem
tatsächlich gespeicherten Wert markiert – sie zeigten immer nur die erste Option der Liste,
unabhängig vom echten Zustand. Alle vier jetzt korrekt mit dem gespeicherten Wert synchronisiert.

**4. Rahmen bearbeiten (verschieben, größer machen) hakelt**
Gefunden: beim Ziehen wurde bei jeder einzelnen Mausbewegung zusätzlich zur Position auch
Rahmen und Fläche neu berechnet – das erzwingt bei `border`/`padding`/`background` ein
Browser-Neu-Layout auf jedem Bewegungsschritt. Jetzt wird während des Ziehens nur noch die
leichte Geometrie (Position/Größe/Drehung als CSS-Transform) aktualisiert; Rahmen/Fläche werden
einmal am Ende der Bewegung sauber nachgezogen.

**5. "Alle Objekte sollen sich mit Del-Taste komplett löschen lassen" / Objekt per Kontextmenü gelöscht, aber noch da**
Gefunden: zwei unabhängige Delete-Tasten-Behandlungen liefen gleichzeitig (eine im
Editor-Workflow, eine im Kontextmenü), und keine der beiden setzte die Auswahl im Objekt-Studio
zurück – der Werkzeugkasten zeigte das "gelöschte" Objekt danach weiter als bearbeitbar an,
obwohl es auf der Folie unsichtbar war. Doppelte Behandlung entfernt, das Kontextmenü ist jetzt
die einzige Stelle dafür und setzt die Auswahl nach dem Löschen korrekt auf die Folie zurück –
Tastatur, Rechtsklick-Menü und der Werkzeugkasten-Knopf "Objekt löschen" verhalten sich jetzt
konsistent.

**6. TÜV-Bericht BLOCKED (SYSTEM/RELEASE)**
Die zentrale Freigabe-Datei erwartete noch exakte alte Versionsnummern der neun abgelösten
Dateien aus Baustufe 1. Sechs davon (Laufschrift-Konsolidierung, Objektbibliothek, beide
Zeichenwerkzeuge, Kontext-Inspector, Objektflächen) sind jetzt als "abgelöst, in Objekt-Studio
aufgegangen" markiert statt als fehlend gemeldet zu werden; der Unified-Editor-Eintrag erwartet
jetzt korrekt die Version des neuen Moduls; ein eigener Eintrag für `kcObjectStudio` wurde
ergänzt. Betrifft nur die zentrale Manifest-/Registry-Buchhaltung, keine Verhaltensänderung.

## Nicht angefasst
Wie gewünscht keine der laufenden Baustufe-2/3-Themen begonnen und keine anderen Programmteile
(Kasse, Zeiterfassung, Rezepte, Tabellen, Import, Player) verändert.

## Prüfung
41 automatisierte Tests (40 bestehende + 1 neuer Test für diese Fehlerbehebungsrunde), alle
grün. Alle geänderten Dateien syntaktisch geprüft.

## Offene Praxisprüfung
Bitte insbesondere erneut testen: Laufschrift-Panel vollständig sichtbar, Farbe/Rahmen auf
TV-Bühne sichtbar, Textflächen-Dropdown zeigt korrekten Wert, Ziehen fühlt sich flüssig an,
Löschen (Taste, Rechtsklick, Knopf) entfernt das Objekt zuverlässig und der Werkzeugkasten
springt danach auf "Folie bearbeiten" zurück.
