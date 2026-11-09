# Händlerausweise an Bilderrechner und Schulung

Stand 29.10.2026. Ergänzung auf Basis von main, Commit 194e19b.

## Bedienung

Ausweis scannen, auch vor dem ersten Artikel. Die Kasse zeigt die Ausweisnummer und setzt
10 % als Gesamtrabatt auf Speisen, Getränke und Kombis. Pfand bleibt vollständig erhalten.
Über RABATT bleibt der Prozentsatz änderbar, auch bei noch leerem Einkaufswagen. Erneutes
Scannen desselben Ausweises überschreibt eine manuelle Änderung nicht. Der Bon erhält eine
Gesamtrabattzeile mit der Ausweisnummer. Abschluss, Bon-Abbruch, Trainingswechsel und
Trainingsreset löschen den Rabatt. Beim Parken gehört er zum geparkten Bon.

## Ausweisliste

Die Club-App-Migration `20261029_kc_club_haendlerausweise.sql` muss separat eingespielt sein.
Diese Änderung führt keine Datenbankmigration und keine Club-App-Veröffentlichung aus.
Für die bereits gedruckten Ausweise 001–050 muss die Clubleitung danach einmal die
Ausgabeliste 2026 für 1–50 öffnen. Ausweise müssen nicht neu gedruckt werden.

Der PC-Manager liest mit seiner bestehenden Anmeldung ausschließlich
`jahr,nr,code,gesperrt` aus `kc_club_haendlerausweise`, gefiltert auf `org_id=KC_WERNE`
und das Marktjahr im Veranstaltungsnamen (sonst Kalenderjahr). Er lädt in Seiten zu 100
Ausweisen. Die komplette Liste kommt als `settings.haendlerausweise` mit Schema
`KC_HAENDLERAUSWEISE_V1` über den vorhandenen Stammdatenweg zur Kasse.
Es werden keine Namen, Firmen oder geheimen Server-Schlüssel übertragen.

Der Manager liest nach der Anmeldung, alle fünf Minuten und vor „Stammdaten senden“.
Geänderte Listen sendet er automatisch über den vorhandenen Manager-Companion.
Die Kasse fragt ihren Companion jede Minute ab. Beide Programme behalten bei einem
Verbindungsfehler den zuletzt erfolgreich geladenen Stand. Eine erfolgreich gelesene
leere Liste wird ausdrücklich übernommen und entfernt frühere Freigaben.
Eine offline betriebene Kasse kann neu gesetzte Sperren erst nach dem Abgleich kennen.
Bei Abschluss wird der vorgemerkte Ausweis nochmals gegen die lokale Liste geprüft.

## Prüfung

Unverändertes QR-Format:
`Koecheclub Werne Haendler-Ausweis 2026 Nr 007 Code ABCD`

Jahr, Nummer und Code müssen übereinstimmen und `gesperrt` muss `false` sein.
Fehlende Liste, unbekannte Ausweise, falsche Codes und andere Marktjahre geben keinen Rabatt.
`000 / MSTR` ist nur im Trainingsmodus des passenden Marktjahrs gültig.
Der gleiche Baustein ist in beiden Kassen und beiden PC-Managern eingebunden.

`tests/haendlerausweis.test.cjs` prüft Listenabruf, Paginierung, Fehlererhalt und beide echten
Kassenoberflächen mit simulierten Tastatur-Scans. Der Datenbankzugriff wird im Test ersetzt;
die noch ausstehende Club-App-Migration und physische Scanner sind damit nicht live geprüft.
Der Schulungsbereich enthält außerdem ein neues Erklärthema „Händler-Ausweis und Gesamtrabatt“.
