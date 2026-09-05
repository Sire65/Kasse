# Repair 29 · TV-Renderparität

- Der neue Hintergrund `weihnachtsmarkt-werne-fensterlicht-v2.png` ist Standard für neue Weihnachtsmarktfolien.
- Bestehende Folien der Vorlagenversion vor 1.0.2 werden einmalig vom alten Marktbild auf das neue Fensterlichtbild migriert. Eigene Bilder und bewusst gewählte andere Presets bleiben unangetastet.
- Entwurf und gestartete Vorführung verwenden denselben `KCTVSharedRenderer` V0.29.47.
- Die vollständige DisplayMatrix-Konfiguration wird in beiden Ansichten angewendet: Preset, Oberfläche, Renderer, Palette, Schriftprofil, Helligkeit, Leuchten, Kontrast, LED-Größe, Matrixgröße, Richtung, Effekt und Geschwindigkeit.
- Die Größen-CSS des Matrixelements gilt nicht mehr nur für die Vorschau, sondern auch für die Vorführungsfläche.
- Schriftfamilie, Farben, Gewicht, Stil und Größenfaktoren werden aus demselben Typografie-Datensatz übernommen.

Statischer Test: PASS. Praktischer Vollbildvergleich bleibt vor Gold-Freigabe erforderlich.
