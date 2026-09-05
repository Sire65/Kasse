# Pflichtenheft und TÜV-Nachweis – TimeClockCore Repair 42

## Ziel

Schnelle, nachvollziehbare Erfassung von Kommen und Gehen an freigegebenen Kassen.
Die Erfassung ist vom Verkaufsvorgang getrennt und darf dessen Daten nicht verändern.

## Muss-Anforderungen

1. Die Uhrtaste ist nur sichtbar, wenn der PC-Manager die Funktion freigibt.
2. QR/ID ist der Normalweg; optional ist ein sechsstelliger Geburtstagscode TTMMJJ zulässig.
3. Nach Identifikation wird abhängig vom letzten Ereignis automatisch Kommen oder Gehen angeboten.
4. Standard ist die aktuelle Uhrzeit. Abweichungen von mehr als fünf Minuten benötigen einen Grund.
5. Ereignisse sind append-only, haben eine eindeutige ID und werden beim Kassenabgleich idempotent zusammengeführt.
6. Aushilfen benötigen einen zeitlich begrenzten Zugang. Abgelaufene Zugänge werden abgewiesen.
7. Stundenvergütung darf gekennzeichnet werden; eine Lohnabrechnung erfolgt ausdrücklich nicht.
8. Der Manager exportiert Ist-Zeiten im Schema `KC_DUTY_ROSTER_ACTUALS_V1`.
9. Der spätere Dienstplan darf Soll und Ist vergleichen, aber keine Kassen-Zeitereignisse unbemerkt überschreiben.

## Architektur

- `TimeClockCore`: reine Regeln, Identifikation, Ereignisse, Delta und Summen
- `time-clock-manager`: Freigabe, Personen/Aushilfen, Paketexport, Deltaimport, Auswertung
- `time-clock-pos`: schneller Scan-/Bestätigungsdialog an der Kasse
- `time-clock-duty-roster-adapter`: versionierte Soll-/Ist-Grenze

## Datenschutz- und Betriebsregeln

- Nur erforderliche Identifikations- und Zeitdaten werden in Übergabepakete aufgenommen.
- Der QR-Code enthält keine Klarnamen, sondern einen zufälligen Zugangswert.
- Geburtstagscode ist abschaltbar und nicht der bevorzugte Weg.
- Korrekturen bleiben durch Erfassungszeit, wirksame Zeit und Grund nachvollziehbar.
- Aufbewahrung, Löschung, Zugriffsrollen und arbeitsrechtliche Freigabe sind vor Gold-Betrieb organisatorisch festzulegen.

## TÜV-Gates

- automatischer Core-/Delta-/Gültigkeits-/Dubletten-Test
- Syntaxprüfung aller JavaScript-Dateien
- zentrale Manifest- und Studio-Registry-Prüfung
- manueller Praxistest mit echtem Bluetooth-/USB-Scanner
- manueller Mehrkassentest und Datenschutz-/Betriebsfreigabe vor Gold

Status: **Candidate**. Keine Gold-Freigabe ohne die drei manuellen Prüfungen.
