# Prüfbericht Repair 41

## Ergebnis

Die in Repair 40 enthaltenen neuen Mitgliedsbilder und Aussagen werden jetzt
auch in einer bereits im Browser gespeicherten älteren Weihnachtsmarkt-
Präsentation sichtbar.

## Verhalten beim ersten Start

1. Der Manager erkennt einen älteren Mitglieder-Inhaltsstand.
2. Soweit der Browser-Speicher ausreicht, wird eine Sicherung angelegt.
3. Die Gruppenfolie und 18 Mitgliedsfolien werden durch den Vorlagenstand
   `1.0.6` ersetzt.
4. Alle anderen Folien und Managerdaten bleiben erhalten.
5. Die Migration wird gespeichert und beim nächsten Start nicht wiederholt.

## Manueller Weg

In der Vorlagenauswahl steht zusätzlich „Mitgliederfolien aktualisieren“ zur
Verfügung. Nach Bestätigung werden ausschließlich die 19 betreffenden Folien
erneut auf den aktuellen Stand gesetzt.

## Verifikation

- 19 von 19 Testdateien bestanden.
- 99 JavaScript-Dateien ohne Syntaxfehler.
- Automatische Einmalmigration geprüft.
- Schutz späterer eigener Änderungen geprüft.
- Manuell bestätigte Wiederholung geprüft.
- Sicherungsschlüssel geprüft.
- Neues `.kctv`-Paket aus derselben Vorlage erzeugt.

## Status

Candidate; praktische Sichtprüfung im PC-Manager bleibt erforderlich.
