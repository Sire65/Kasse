# KC MarktKasse – Tiefenprüfung, Konsolidierung und Präsentations-TÜV

Version: V0.29.15 Candidate

## Prüfbereich
- PC-Manager Presentation Studio
- KC Mobil TV
- TV-Player
- DesignCore Presentation Extension
- Excel-/Tabellenobjekte
- Masterfolie und Vorlagen
- Vollbildvorführung
- Exportzentrum und KC-Dateiformate

## Konsolidierung
Der PresentationTÜVCore ist eine zentrale read-only Prüfinstanz. Er führt keine parallele Präsentationsverwaltung ein. PC, Mobil und TV-Player verwenden denselben Prüfkatalog und dieselben Freigabe-Gates.

## Freigabe-Gates
CORE, DATA, CONTENT, DESIGN, LAYOUT, MEDIA, PLAYBACK, TV, EXPORT, SYSTEM.

## Prüfstatus
- PASS: keine Sperren oder Warnungen
- CONDITIONAL: keine Sperre, aber Hinweise vor Produktivbetrieb
- BLOCKED: mindestens ein freigabesperrender Fehler

## Überwachte Risiken
- fehlende oder doppelte Folien-IDs
- keine aktive Folie
- leere Folien
- unlesbare Laufzeiten
- unbekannte Effekte oder Übergänge
- Effektparameter außerhalb der Grenzen
- Objekte außerhalb der 16:9-Fläche
- zu große Tabellen
- temporäre blob:-Medien
- zu lange Texte und Überschriften
- fehlende Masterfolie
- fehlende TV-Auflösung
- fehlender lokaler Speicher
- fehlende Vollbild-, MediaRecorder- oder DesignCore-Unterstützung

## Laufzeitüberwachung
PC und Mobil prüfen automatisch beim Start und anschließend alle 15 Sekunden. Der TV-Player prüft alle 30 Sekunden. Im TV-Player zeigt F8 den Laufzeitstatus an.

## Release-Hinweis
Candidate bleibt bestehen, bis ein realer Endgerätetest mit dem vorgesehenen TV/Browser, ein Dauerlauf und ein Export-/Reimporttest abgeschlossen sind.
