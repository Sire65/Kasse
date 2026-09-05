# Einbindung Framework Studio V1.38.39

## Ergebnis

Die zentrale Release-Überwachung aus Framework Studio V1.38.39 wird für den
KC-MarktKasse-/PC-Manager ab Repair 48 verbindlich verwendet. Sie ersetzt weder
das zentrale KC-Release-Manifest noch die Studio-/TÜV-Komponentenregistrierung,
sondern überwacht deren Freigabeprozess.

## Verbindliche Regeln

- Jede Bearbeitung beginnt mit einer unveränderlichen Baseline-ZIP samt SHA-256.
- Der erlaubte Änderungsumfang und geschützte Bereiche werden vorab festgelegt.
- Technische Nachweise gelten nur für die exakt passende Candidate-SHA.
- Ändert sich die Candidate-SHA, verfallen Nachweise und persönliche Abnahme.
- Für KC MarktKasse sind Desktop, Tablet, Mobil und TV/Vollbild zu prüfen.
- Technisch grün ist noch keine persönliche Freigabe.
- Gold/Dunkelgrün ist erst nach technischer Prüfung und praktischer Abnahme erlaubt.

## Repair-48-Baseline

- Datei: `KC_MarktKasse_V0_31_3_6_Repair_47_Baseline.zip`
- SHA-256: `6ac6fd677971a7ce90150760955f3160c2a37bd84cfaffd4aa288983be1c3afa`
- WorkOrder: `WO-KC-20260724-001`
- Aktueller Monitorzustand: Blau – Candidate noch nicht erzeugt.

## Schutzwirkung

TV-Editor, Renderer, Player, Navigation, Wetter, Zeiterfassung, Meldungswesen und
die bestehende Combobox-Stabilisierung liegen außerhalb des aktuellen
Änderungsumfangs. Abweichungen dort sperren den Candidate.
