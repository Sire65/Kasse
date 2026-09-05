# Prüfbericht Repair 56: Sichtbarer Umsatzimport

## Ursache der scheinbaren Untätigkeit

Der gezeigte Import war erfolgreich. Die 2.050 Vorgänge der Hauptkasse befanden sich bereits im Manager und wurden deshalb vom Doppelimport-Schutz übersprungen. Die bisherige einzeilige Rückmeldung war technisch richtig, aber für den Benutzer zu unauffällig.

## Änderung

- Bis zu mehrere `.kcsales`-Dateien können gemeinsam ausgewählt werden.
- Jede Datei wird nacheinander mit Dateiname und laufender Nummer angezeigt.
- Das modale Importfenster zeigt Prozent, vergangene Zeit, voraussichtliche Restzeit und fünf Arbeitsschritte.
- Das Fenster kann während der Verarbeitung nicht versehentlich geschlossen werden.
- Nach Abschluss wird jede Kasse mit „neu“ und „bereits vorhanden“ einzeln aufgeführt.
- Sind alle Buchungen bekannt, lautet die Meldung ausdrücklich: „Keine neuen Vorgänge – bereits im Manager vorhanden.“

## Praktischer Test

Vier verschlüsselte Kassenexporte mit zusammen 8.200 Vorgängen wurden gleichzeitig ausgewählt und verarbeitet. Da der isolierte Testbestand bereits geladen war, wurden exakt 8.200 Duplikate erkannt:

- Hauptkasse: 0 neu, 2.050 vorhanden
- Getränkekasse: 0 neu, 2.050 vorhanden
- Speisenkasse: 0 neu, 2.050 vorhanden
- Mobile Kasse: 0 neu, 2.050 vorhanden

Das Fenster endete bei 100 %, zeigte die Gesamtdauer und alle fünf Schritte als erledigt. Die Browserkonsole enthielt keine Fehler.
