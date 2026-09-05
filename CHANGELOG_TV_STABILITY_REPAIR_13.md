# Changelog – Repair 13 TV-Stabilität

Stand: 21.07.2026

- Wetter, KC Mobil TV und alle übrigen TV-Reiter erhalten eine additive, delegierte Fallbacksteuerung.
- Die Einklapppfeile wurden aus der oberen Werkzeugleiste entfernt und auf die linke beziehungsweise rechte Trennlinie im oberen Drittel gesetzt.
- Die Pfeile erscheinen nur im Folienarbeitsplatz und wandern beim Einklappen an den Bildschirmrand.
- Die kleine TV-Vorschau überspringt deaktivierte Folien und setzt ihren Timer auch nach einem Renderfehler fort.
- Bei nur einer aktiven Folie zeigt die Statuszeile diesen Zustand ausdrücklich an.
- Der Vollbild-TV-Modus plant den Folienwechsel in einem `finally`-Pfad. Eine beschädigte Einzelfolie kann den Gesamtablauf damit nicht mehr dauerhaft stoppen.
- Nach Rückkehr aus einem Hintergrundfenster wird die Restlaufzeit neu geplant.
- Manager-Version V0.31.2.3, TV-Präsentation V0.29.36, zentrale Suite V0.31.3.6 Repair 13.

## Prüfergebnis

- JavaScript-Syntax: bestanden.
- Zentrales Release-Manifest: JSON lesbar und neue Stabilitätskomponente registriert.
- Wetter- und KC-Mobil-Reiter: im Browser vor der Reparatur als grundsätzlich erreichbar bestätigt; die neue Fallbacksteuerung sichert die spätere Bedienung gegen überschreibende Erweiterungen ab.
- Ein erneuter Browser-Reload wurde von der lokalen Browser-Sicherheitsrichtlinie blockiert. Deshalb bleibt der Stand bis zum kurzen Sichttest auf dem Zielsystem Technical Preview.
