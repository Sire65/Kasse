# Kontexteditor-Bereinigung V0.29.31

## Ursache

Drei Editor-Generationen arbeiteten gleichzeitig auf Vorschau und Eigenschaftenbereich. Alte Klick-, Pointer- und MutationObserver-Handler überschrieben die Auswahl des Unified Editors.

## Lösung

- `SelectionCore 0.2.0` ist die einzige Auswahlquelle.
- `PropertyCore 0.2.0` ordnet Objekttypen ihren Werkzeuggruppen zu, ohne alte Tabs anzuklicken.
- `Unified Editor 0.29.31` baut den rechten Bereich bei jeder Auswahl vollständig neu auf.
- Alte Direktmanipulation und alte Eigenschaften-Observer sind deaktiviert.
- Die verbleibende Legacy-Renderlogik synchronisiert ihren Auswahlwert mit dem Unified Editor und kann ihn nicht mehr zurücksetzen.
- Folienobjekte sind per Maus, Touch, Tastatur und sichtbarer Auswahlmarkierung erreichbar.

## Unterstützte Kontexte

- Folie
- Überschrift
- Textbox
- Preis
- Laufschrift
- Symbole
- Wetterkarten
- Banner
- Form
- Bild und Tabelle: Geometrie und Anordnung

## Prüfstatus

Der praktische Browsertest bestätigte den automatischen Kontextwechsel für Symbole einschließlich Inhalt, Farbe, Abstand, Position, Größe, Drehung, Deckkraft und Ebenenreihenfolge. Die übrigen Text- und Ticker-Kontexte verwenden denselben Auswahl- und Renderpfad und werden zusätzlich strukturell getestet.
