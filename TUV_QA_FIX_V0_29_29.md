# TÜV-/QA-Korrektur V0.29.29

## Behobene Punkte
- Kontrastfehler im zentralen UnifiedEditor: alle Beschriftungen und Werte im dunklen Eigenschaftsblock sind nun hell und lesbar.
- Automatische Vordergrundwahl anhand der Hintergrundhelligkeit: dunkler Hintergrund erhält helle Schrift, heller Hintergrund erhält dunkle Schrift.
- Wetterkarten in Präsentation und TV-Player wurden vergrößert, kontraststark und TV-lesbar gestaltet.
- Helle, nicht erkennbare Wetterkarten auf hellen Folien werden automatisch dunkel beschriftet; auf dunklen Folien erhalten sie eine dunkle halbtransparente Kartenfläche mit heller Schrift.

## Prüfpunkte
- AUTO-CONTRAST-001: Hintergrundhelligkeit wird bei jedem Folienwechsel neu bewertet.
- WEATHER-READABILITY-001: Wetterkarten verwenden adaptive Farben und Mindestgrößen.
- PROPERTY-READABILITY-001: UnifiedEditor besitzt keine dunkel-auf-dunkel-Beschriftungen mehr.

Status: Candidate – praktische Sichtprüfung auf hellem und dunklem Hintergrund erforderlich.
