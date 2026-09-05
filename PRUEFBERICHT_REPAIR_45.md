# Prüfbericht Repair 45 – Erstellungsmonitor = Präsentation

## Behobene Ursachen

1. Das Werkzeug „Textfeld aufziehen“ schrieb jedes neue Feld in den einzigen
   Alt-Datensatz `slide.text`. Dadurch wurde ein vorhandener Text ersetzt.
2. Der Erstellungsmonitor und die Vorführung verwendeten unterschiedliche
   Schriftmaßstäbe (`em`, `vw` und editorbezogene Sonderregeln).
3. Der eigenständige Stick-Player besaß nochmals eigene Größenregeln.

## Reparatur

- Frei aufgezogene Textfelder werden als unabhängige Objekte mit stabiler ID,
  eigenem Inhalt, eigener Typografie und eigener Prozentgeometrie gespeichert.
- Die Objekte können einzeln verschoben, skaliert, direkt bearbeitet und über
  Del oder das Kontextmenü gelöscht werden.
- Erstellungsmonitor und Manager-Präsentationsmodus verwenden denselben Renderer.
- Schriftgrößen werden relativ zur Breite der 16:9-Folie (`cqw`) berechnet.
  Eine kleinere Vorschau ist damit nur eine maßstäblich kleinere Darstellung,
  nicht mehr ein anderes Layout.
- Der Stick-Player übernimmt denselben Objektvertrag für Position, Größe,
  Schrift und zusätzliche Textobjekte.

## Verifikation

- 23 Tests grün.
- Syntaxprüfung für 75 JavaScript-Dateien bestanden.
- Neuer Regressionstest verhindert erneut das Überschreiben von `slide.text`.
- Neuer Paritätstest verlangt gemeinsame Prozentgeometrie, `cqw`-Typografie und
  Mehrfachtext-Unterstützung in Manager und Stick-Player.

## Status

Candidate. Die praktische Sichtkontrolle auf dem tatsächlichen Ziel-TV bleibt
vor Leading/Gold verpflichtend.
