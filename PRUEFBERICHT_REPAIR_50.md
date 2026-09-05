# Prüfbericht Repair 50

## Eng begrenzter Umfang

- Aufzählungszeichen Punkt, Strich und kleiner Pfeil für Weihnachtsmarkt-Texte
- Bühnenprogramm als lesbare Aufzählung
- kompaktere Preislisten für Getränke, alkoholfreie Getränke und Speisen
- transparente Glasdarstellung im Baumonitor und im TV-Player
- Namenskorrektur auf „Steven Linley“
- Artikelspalte „PL“ zur Ein-/Ausblendung in Präsentations-Preislisten

Navigation, Kassenverkauf, Zeiterfassung, Rezepturkalkulation, Wetter, DisplayMatrix,
Combobox-Stabilisierung und gemeinsame Rendergeometrie wurden nicht verändert.

## PL-Verhalten

`priceListVisible` ist abwärtskompatibel: Bei alten Artikeln ohne dieses Feld gilt
die Anzeige als eingeschaltet. Nur ein ausdrücklich entferntes Häkchen blendet den
Artikel aus den dynamisch erzeugten TV-Preislisten aus. Kassenanzeige, Bestand und
Artikelstammdaten bleiben davon unberührt.

## Prüfungen

- JavaScript-Syntaxprüfung der drei geänderten Laufzeitdateien
- vollständige automatisierte Testsuite
- eigener Regressionstest für PL-Feld, Filter, Listenformat und Preislistengröße
- identische Glas-/Tabellenregeln in Manager und TV-Player
