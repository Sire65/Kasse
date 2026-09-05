# Changelog – Repair 14 Objekteditor

Stand: 22.07.2026

- Die vom Anwender ausgefüllte Weihnachtsmarkt-Präsentation mit 27 Folien bleibt vollständig erhalten.
- Alle Folien erhalten bereits vor dem ersten Rendern vollständige, getrennte Objektkoordinaten. Dadurch gibt es beim Programmstart keinen kurzen Stapel überlappender Textfelder mehr.
- Bestehende installierte Präsentationen werden additiv migriert: Nur fehlende Koordinaten werden ergänzt; vorhandene manuelle Positionen bleiben erhalten.
- Das Wetterlayout auf Folie 23 wurde korrigiert. Titel und Symbol liegen getrennt.
- Leere Titel-, Text-, Preis-, Symbol- und Laufschriftobjekte bleiben als gestrichelte, anklickbare Platzhalter erreichbar.
- Im Eigenschaftenbereich gibt es für jedes ausgewählte Objekt die sichtbare Aktion „Objekt löschen/leeren“.
- `Entf`, Kontextmenü und der neue Löschbutton verwenden denselben geschützten Objektworkflow.
- Bilder entfernen jetzt den zugehörigen Medieninhalt und nicht nur ein wirkungsloses Hilfsfeld.
- Die Folienliste besitzt eine dauerhaft sichtbare, breite Scrollleiste und nutzt die verfügbare Fensterhöhe.
- Beim Wechsel zu einer außerhalb des sichtbaren Bereichs liegenden Folie scrollt die Liste automatisch nur bis zur Auswahl.
- Die beiden Einklapppfeile werden außerhalb des TV-Folienarbeitsplatzes zuverlässig ausgeblendet.

## Versionen

- Suite: V0.31.3.6 Repair 14
- PC-Manager: V0.31.2.4
- TV-Präsentation: V0.29.38
- Unified Editor: V0.29.38
- Objektworkflow: V0.29.38
