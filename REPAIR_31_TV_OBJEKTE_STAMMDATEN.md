# Repair 31 · TV-Objekte und Stammdatenbedienung

- Die gestartete TV-Vorführung stellt eine sichtbare Laufschrift bei Bedarf wieder her und übergibt sie anschließend an denselben SharedRenderer wie die Vorschau.
- Banner und Formen werden als echte Folienobjekte registriert und erhalten Auswahlrahmen, acht Greifer, Kontextmenü, Verschieben, Skalieren und Löschen.
- Die Werne-Hintergrundauswahl arbeitet über eine zentrale Funktion. `Einzeln` ändert die aktive Folie; `für alle` übernimmt Preset und Deckkraft in alle Folien und speichert sofort.
- Warengruppenfarben erscheinen während der Auswahl live im Vorschaumuster und in der ausgewählten Tabellenzeile. `Farbe übernehmen` verwendet den vorhandenen Speichernweg.
- Die Artikel-Etikett-Combobox wird beim Start, beim Öffnen der Etikettenseite und nach Artikeländerungen neu aus dem aktuellen Artikelbestand gefüllt.
- Die bisher unverdrahteten Importbuttons für Warengruppen und Artikel lesen JSON-Listen ein. Neu, Speichern, Löschen, Bild, Export und Drucken bleiben an den vorhandenen Fachfunktionen.
- Ein Laufzeitaudit prüft, ob alle erwarteten Toolbarbefehle vorhanden sind.

Statischer TÜV und Regressionstest: PASS. Praktischer Vollbild- und Maus-Rundlauf bleibt vor Gold erforderlich.
