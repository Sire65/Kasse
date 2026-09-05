# RELEASE-BEREINIGUNG V0.29.15

Status: Candidate / optimierter Laufzeitstand

## Durchgeführte Maßnahmen

- Doppelte `publish/`-Kopie vollständig entfernt; die Paketwurzel ist jetzt die einzige Laufzeitquelle.
- Veraltete README- und Zwischenversionsberichte entfernt.
- 37 Laufzeitbilder nach WebP konvertiert und sämtliche internen Verweise angepasst.
- QR-Code bewusst als PNG belassen, da die sehr kleine verlustfreie Datei für scharfe Kanten optimal ist.
- Keine Bildabmessungen verändert; UI- und Avatar-Geometrie bleibt unverändert.
- Dateimanifest und Prüfsummen vollständig neu erzeugt.

## Bildoptimierung

- Vorher: 4.89 MiB
- Nachher: 0.48 MiB
- Reduktion: 4.41 MiB (90.2 %)

## Sicherheitsentscheidung

Nicht automatisch entfernt wurden funktionale Module, Cores, Videos, Sounds oder Bibliotheken, deren Laufzeitnutzung nicht zweifelsfrei ausgeschlossen werden konnte. Funktionssicherheit hat Vorrang vor aggressivem Tree-Shaking.
