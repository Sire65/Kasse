# Studio-Übernahmeprotokoll – V0.29.24 Candidate

## Antrag
Konsolidierung der Vorschau-Bearbeitung nach den verbindlichen Framework- und Studio-Regeln.

## Übernommene Bausteine
- SelectionCore V0.1.0 Candidate
- PropertyCore V0.1.0 Candidate
- SmartLayoutCore V0.1.0 Candidate
- PC-Manager Integration `tv-unified-editor.js`

## Single Source of Truth
Die Präsentationsdaten verbleiben ausschließlich im bestehenden Manager-Datenmodell (`currentTvSlide`, `slide.layout`, DesignCore). Die neuen Cores führen keine parallele Projekt- oder Artikelverwaltung ein.

## Migrationsentscheidung
Die bisherigen Skripte `tv-smart-object-editor.js` und dessen CSS bleiben als nachvollziehbarer Rückfallstand im Candidate-Paket, werden im PC-Manager jedoch nicht mehr geladen. `tv-context-effect-fix.js` bleibt für die stabilisierte Effektsteuerung aktiv.

## Nicht verändert
- Artikel- und Kassendaten
- Exportzentrum
- TV Player
- Importzentrum
- Masterfolien
- Präsentations-TÜV
- Mobil-Auftragsaustausch

## Freigabestatus
Candidate. Freigabe erst nach Sicht- und Interaktionstest auf PC, Tablet und TV-Auflösung.
