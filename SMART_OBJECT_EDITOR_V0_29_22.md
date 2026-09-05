# SmartObjectEditor V0.29.22

## Ziel
Die Bearbeitung im PC-Vorschaufenster wurde zu einer einheitlichen, direkten Objektbearbeitung zusammengeführt. Bestehende Präsentations-, Import-, Export-, TÜV- und Wiedergabefunktionen bleiben erhalten.

## Bedienung
- Objekt anklicken: auswählen
- Objekt ziehen: verschieben
- acht sichtbare Anfasser: Breite/Höhe beziehungsweise proportionale Größe ändern
- gelber Drehpunkt: Objekt drehen
- Text doppelt anklicken: direkt schreiben, löschen oder ersetzen
- Pfeiltasten: ausgewähltes Objekt fein verschieben; mit Umschalt fünf Schritte
- rechte Eigenschaftenleiste: Größe, Breite, Drehung, Deckkraft und Feinausrichtung

## Weihnachtsmarktsymbole
- Das sichtbare Symbol selbst wird skaliert, nicht nur sein Rahmen.
- Symbolabstand ist einstellbar.
- Farbe/Tönung, Drehung und Deckkraft sind einstellbar.
- Mehrere Symbole werden als einzelne sichtbare Glyphen gerendert, bleiben aber gemeinsam als Symbolgruppe bedienbar.

## Technische Konsolidierung
Der neue SmartObjectEditor fängt konkurrierende alte Pointer-Ereignisse im Vorschaufenster ab und führt Verschieben, Skalieren, Drehen, Auswählen und Textbearbeitung in einem Controller zusammen. Aktualisierungen werden per requestAnimationFrame gebündelt und erst am Ende einer Bewegung dauerhaft gespeichert.
