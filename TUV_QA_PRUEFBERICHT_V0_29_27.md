# TÜV-/QA-Prüfbericht V0.29.27

## Umbau
- Design- und Textbearbeitung auf einen einzigen UnifiedEditor konsolidiert.
- konkurrierende Laufzeiterweiterungen `tv-context-effect-fix`, `tv-live-editor-fix` und `presentation-professional-guard` aus dem Manager-Start entfernt.
- Symbol-, Text-, Preis-, Bild-, Tabellen- und Lauftextbearbeitung laufen über SelectionCore, PropertyCore und UnifiedEditor.
- Beobachter gegen eigene DOM-Aktualisierungen verriegelt; Vorschau-Beobachtung nur noch auf echten Folien-Neuaufbau begrenzt.

## Absturzüberwachung
Der neue RuntimeStabilityCore protokolliert:
- JavaScript-Fehler
- unbehandelte Promise-Fehler
- Long Tasks
- blockierte Ereignisschleife
- Mutation-Stürme

Die Ereignisse werden im lokalen Diagnoseprotokoll gespeichert und durch den Präsentations-TÜV als `RUN-001` oder `RUN-002` bewertet.

## Weitere Reparaturen
- Register `Design & Dekoration` entfernt; Funktionen sind im rechten Kontexteditor verfügbar.
- Mini-Folienkarten verbreitert und Textbereich gegen den Löschbutton abgegrenzt.
- Löschbutton vertikal zentriert.
- Lauftext-Rahmen und Objektgriffe bewegen sich nicht mehr mit dem animierten Text.
- LED-Laufschrifteditor erweitert: Laufen, Stehend, Blinken, Pendeln, Buchstaben-Aufbau, Richtung, Geschwindigkeit, Leuchtrahmen, Pixeloptik, Pause.

## Freigabestatus
Candidate. Browser-Praxistest für Symbolbearbeitung, Lauftext und absichtliche Fehlerauslösung erforderlich.
