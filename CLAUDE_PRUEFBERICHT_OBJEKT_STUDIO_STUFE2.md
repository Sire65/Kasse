# Prüfbericht – Objekt-Studio Baustufe 2
**Basis:** V0.31.3.6 Repair 65 "Objekt-Studio Fehlerbehebung Candidate"
**Ergebnis:** V0.31.3.6 Repair 66 "Objekt-Studio Baustufe 2 Candidate"
**Tests:** 42/42 PASS (41 bestehende + 1 neuer Test für Baustufe 2)

## Umgesetzt

**Mehrfachauswahl & Ausrichten**
Umschalt+Klick fügt Objekte zur Auswahl hinzu/entfernt sie. Ab zwei ausgewählten Objekten
erscheint eine eigene Werkzeugleiste: Ausrichten (links/zentriert/rechts/oben/mittig/unten
relativ zur Auswahl), gemeinsame Deckkraft, gemeinsam nach vorne/hinten, Auswahl löschen.
Ziehen eines ausgewählten Objekts bewegt alle ausgewählten Objekte gemeinsam mit gleichem
Versatz. Escape hebt die Mehrfachauswahl auf.
*Bewusste Vereinfachung:* Es handelt sich um eine Sitzungs-Mehrfachauswahl mit Stapel-Aktionen,
keine dauerhaft gespeicherte "Gruppe", die man später als Einheit wieder anklicken kann – das
wäre eine größere Datenmodell-Änderung und war nicht Teil der Baustufen-Abstimmung.

**Ausrichtungshilfen (Smart Guides)**
Beim Verschieben eines einzelnen Objekts erscheinen dünne Führungslinien, sobald die Mitte des
Objekts mit der Foliennmitte oder der Mitte eines anderen Objekts auf der Folie übereinstimmt,
und das Objekt rastet leicht ein. Gilt für Verschieben, nicht für Größenänderung über die
Eckpunkte (Ränder/Kanten-Fluchtlinien wären ein zusätzlicher Schritt, aktuell nur Mittelpunkte).

**Ebenen-Übersicht**
Neuer Baustein oben in den Folien-Werkzeugen: Liste aller sichtbaren Objekte der aktuellen
Folie in ihrer Stapelreihenfolge, anklickbar zur Auswahl, mit ▲/▼ zum Vertauschen mit dem
Nachbarn in der Ebenenfolge.

## Nicht verändert
Baustufe 1 (kontextbezogener Werkzeugkasten, Rahmen-Aufziehen, Laufschrift-Core usw.) und die
Fehlerbehebungen aus Repair 65 bleiben unangetastet. Kein anderer Programmteil berührt.

## Prüfung
42 automatisierte Tests, alle grün. Syntax aller geänderten Dateien geprüft.

## Offene Praxisprüfung
Bitte testen: Umschalt+Klick auf zwei/drei Objekte, gemeinsames Verschieben, Ausrichten-Knöpfe,
Andocken beim Ziehen einzelner Objekte an Foliermitte/andere Objekte, Ebenen-Liste anklicken
und mit den Pfeilen umsortieren.

## Ausblick Baustufe 3 (noch offen)
Objekt-Animationen beim Erscheinen, Text-Auto-Fit, Gestaltungs-Vorlagen/Themes.
