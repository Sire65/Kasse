# Stechuhr und gemeinsames Stempelbuch

Stand 18.11.2026, KC-DP-STEMPEL-KASSE-V1.

## Bedienung am Stand

Der PC-Manager bleibt gestartet und bei Supabase angemeldet. Das Konto braucht eine aktive DP2-Planer- oder Administratorrolle für KC_WERNE. Die aktuellen Stechuhr-Zugänge werden einmal an die Kassen verteilt.

Mitglieder öffnen die Uhr, scannen den Mitgliedsausweis oder geben den Geburtstag als TTMMJJ ein. Sie sehen Pseudonym, Richtung und Uhrzeit und bestätigen Kommen oder Gehen. Die Buchung wird zuerst auf dem Tablet gespeichert und anschließend über den gekoppelten Kassen-Companion an den Manager übertragen.

Der Manager hält die Rohbuchung in SQLite. Solange sein Fenster mit gültiger Anmeldung geöffnet ist, stößt es alle 30 Sekunden den zentralen Abgleich an. Die Anmeldung wird nur für den jeweiligen Aufruf verwendet. Ein Neustart verliert die offenen Buchungen nicht. Ohne gültige Anmeldung bleiben sie offen.

Unter Zeiterfassung zeigt der PC-Manager offene Buchungen und fehlende zentrale Bestätigung. Fehlende Mitgliedsnummern bleiben zur Prüfung offen. Andere eindeutig zugeordnete Buchungen können weiter übertragen werden.

Der gemeinsame Anmeldestand reist bei Änderungen mit den Kassenpaketen zurück zum Tablet. Deshalb wird beispielsweise nach einer App-Anmeldung Gehen angeboten, sobald dieser Stand das Tablet erreicht hat. Bei Verbindungsunterbrechungen steht der zuletzt übertragene Stand zur Verfügung.

## DP2

Build 313 liest zusätzlich die Zeitpaare des gemeinsamen Stempelbuchs. Fehlendes Kommen oder Gehen bleibt als unvollständige Zeile sichtbar. Eine später eingetroffene Gehen-Buchung vervollständigt das Paar beim erneuten Abruf. Spontane Einsätze werden ausdrücklich zur Prüfung angeboten.

Die Übernahme in den Istplan erfolgt nach Prüfung durch den Planer. Erst die bestätigte Speicherung des Arbeitsstands erlaubt eine Quittierung. Bereits übernommene identische Zeiten werden erkannt. Änderungen an einem schon übernommenen Paar bleiben ein erneuter Prüffall.

## Bereitstellung

1. Die beiden additiven Migrationen 20261118080204 und 20261118080742 liegen im Repository und sind in Supabase eingespielt. Sie verwenden die vorhandenen Tabellen. Die Rechte- und Zeitpaarproben liefen in einer vollständig zurückgerollten Transaktion.
2. Den geprüften Kassen-/Manager-Stand einschließlich Manager-Companion übernehmen und den Manager-Dienst neu starten. Der bisherige zentrale Kassenzugang wird für diesen neuen Weg nicht benötigt.
3. DP2 Build 313 bereitstellen. Die eingebettete Twinkey-Kopie in der Club-App wird separat nach deren Übernahmeverfahren aktualisiert.
4. Mit einem vorgesehenen Kassen-Tablet prüfen: QR, Geburtstag, offline erfassen, wiederverbinden und genau ein vollständiges Zeitpaar in Supabase sowie nach Prüfung in DP2. Testdaten vorab als Schulungsdaten behandeln.
5. Bei Problemen bleiben die Rohbuchungen für den bestehenden Datei-Export im PC-Manager verfügbar.

## Prüfungen

- tests/time-clock-cloud-queue.test.cjs prüft SQLite, Neustart, Parallelaufrufe, Storno, fehlende Zuordnung und unzulässige alte Quittungen.
- tests/time-clock-auth-relay.test.cjs prüft das feste Projekt, die aktuelle Anmeldung und Fehler bei abgelaufenen Sitzungen.
- tests/time-clock-booking-browser.test.cjs prüft QR und Geburtstag auf 390 Pixeln, Wiederanlauf, App-Anmeldestand und vollen Speicher.
- DP2 tools/test-common-stamp-inbox.mjs prüft unvollständige/später vollständige Paare, gemischte Quellen, Wiederholungen, geänderte Zeiten und Speichern vor Quittieren.
- rollback-test.sql ist für psql vorgesehen. Es schließt die Probe mit ROLLBACK ab.

Die automatische Übertragung benötigt den gestarteten Manager-Dienst und ein angemeldetes PC-Manager-Fenster. Die Abnahme auf der tatsächlich eingesetzten Hardware steht noch aus.
