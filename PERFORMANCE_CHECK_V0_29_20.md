# Performance-Check V0.29.20

Ursache der Trägheit waren mehrere globale MutationObserver auf dem gesamten Dokument sowie Speichern und vollständiges Neurendern der Folienliste bei jedem einzelnen eingegebenen Zeichen.

Korrekturen:
- globale DOM-Beobachter auf Vorschau und Folienliste begrenzt
- Aktualisierungen pro Animationsframe zusammengefasst
- Speichern während Texteingabe auf 220 ms entprellt
- Miniaturtitel direkt aktualisiert statt vollständige Liste je Zeichen neu aufzubauen
- Cursor-Hinweise für Verschieben, Bearbeiten und Größenänderung ergänzt
- vorhandene Funktionen nicht entfernt
