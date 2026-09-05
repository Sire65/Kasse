# Repair 18 – Architektur-, Pflichtenheft- und TÜV-Abgleich

## Verbindliche Bedienregel

Die Auswahl auf der Folie ist die alleinige Quelle für den rechten Eigenschaftenbereich. Nicht zum ausgewählten Objekt gehörende Werkzeuggruppen bleiben verborgen. Einheitliche Register verwenden Symbol, Tooltip, Textalternative, Farben, Maße und Abstände aus demselben InspectorCore.

## Architektur

- `KCUnifiedEditor` bleibt Eigentümer von Auswahl, Geometrie und Datenspeicherung.
- `KCContextInspectorCore` V0.29.42 strukturiert ausschließlich die Oberfläche und dupliziert keine Fachdaten.
- Fachmodule wie DisplayMatrix, Wetter und Tagesprogramm liefern Eigenschaften, erzeugen aber keinen zweiten konkurrierenden Editor.
- `KCPresentationTUV` V1.3.0 prüft nur tatsächlich sichtbare Objekte.
- Das zentrale Release-Manifest bleibt Versionsquelle und Release-Gate.

## Pflichtprüfungen

- Keine Layoutmeldung für leere, gelöschte oder typfremde Platzhalter.
- Keine Änderung an vorhandenen 27 Folien durch die Migration.
- Bedienung bleibt per Maus, Tastatur und Tooltip verständlich.
- Laufzeitdiagnose ist Release- und Sitzungsspezifisch und speichert Datei, Zeile, Spalte und Stack, sofern der Browser diese liefert.
- Praktischer Browser- und TV-Rundlauf bleibt vor Gold-Freigabe erforderlich.

## Studio-Übergabe

Neue Komponenten sind im zentralen Relais registriert. Der Inspector ist additiv und kann vom Framework Studio über seine Versionskennung erkannt werden. Alte Einzelmodule dürfen nach vollständiger Übernahme schrittweise aus der Darstellung entfernt werden; ihre Datenadapter bleiben zunächst erhalten.
