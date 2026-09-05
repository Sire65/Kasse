# Prüfbericht Repair 47

## Textgröße bei Auswahl

Der Unified Editor setzte beim Anklicken eines Textobjekts erneut eine
`em`-Schriftgröße. Diese Inline-Regel gewann gegen den gemeinsamen Renderer.
Sie wurde durch dieselbe `cqw`-Berechnung ersetzt, die auch Bauansicht,
Präsentationsmonitor und Stick-Player verwenden.

## Effektregler

Die Regler für Tempo, Dichte, Größe und Deckkraft werden gegen die globalen
Objekt-Ziehhandler abgeschirmt. Der irreführende Verschiebe-Doppelpfeil wurde
durch einen normalen Bedienzeiger ersetzt.

## Rezept-Arbeitsstände

Für Grünkohl, Grünkohl mit Mettwurst, Sauerkrauteintopf und Sauerkrauteintopf
mit Mettwurst werden bekannte Zutaten einmalig und ergänzend angelegt:

- Speck, Zwiebeln und Zucker bei beiden Rezeptarten
- Lorbeerblätter, Nelken und Wacholderbeeren beim Sauerkraut
- Grünkohl als 10-kg-Karton beziehungsweise Sauerkraut als 10/1-Dose

Speck und Zwiebeln haben 0 % Verlust. Vorbereitung und Hinweis dokumentieren,
dass ausgelassenes Fett und Bratensatz vollständig verwendet werden.
Unbekannte Einsatzmengen bleiben ausdrücklich `0` und damit offen; es wurden
keine Mengen erfunden. Vorhandene Benutzerdaten werden nicht überschrieben.

## Verifikation

- 25 Tests erfolgreich
- 82 JavaScript-Dateien syntaktisch fehlerfrei
- Manifest-, Studio- und TÜV-Registrierung konsistent

Status: Candidate bis zur praktischen Sicht- und Bedienprüfung.
