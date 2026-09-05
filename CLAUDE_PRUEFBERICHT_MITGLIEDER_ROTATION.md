# Prüfbericht – Mitglieder-Rotation
**Basis:** V0.31.3.6 Repair 69 "Selbstbau-Test: alle Funde behoben"
**Ergebnis:** V0.31.3.6 Repair 70 "Mitglieder-Rotation Candidate"
**Tests:** 46/46 PASS (45 bestehende + 1 neuer)

## Anlass
Die echte Präsentation zeigt 18 Mitglieder-Folien direkt hintereinander – bei einem
Marktbesucher, der kurz hinschaut, dauert es dadurch über zwei Minuten, bis überhaupt etwas
anderes (Preise, Öffnungszeiten) erscheint. Wunsch: pro Durchlauf nur eine wechselnde Auswahl
zeigen (z. B. 2 von 18), nicht immer alle auf einmal.

## Wie es funktioniert
Die Auswahl wechselt **zeitbasiert**, nicht anhand einer mitgezählten Durchlaufnummer – das ist
robuster (funktioniert auch nach einem Neustart des Fire-TV-Sticks ohne gespeicherten Zustand)
und braucht keinen zusätzlichen Speicher. Voreinstellung: alle 3 Minuten wechselt die Auswahl zur
nächsten Zweiergruppe, bis alle 18 einmal dran waren, dann von vorn. Bei einer typischen
Foliendauer ergibt das ungefähr eine neue Zweiergruppe pro Durchlauf.

**Einstellbar im Manager** (Zeitsteuerung-Seite, neuer Bereich "Mitglieder-Rotation"):
- Rotation ein/aus
- Mitglieder pro Durchlauf (Vorgabe: 2)
- Wechsel alle X Minuten (Vorgabe: 3)

Ohne aktivierte Rotation ändert sich nichts – alle Mitglieder erscheinen wie bisher.

## Umsetzung
Zwei neue, rein ergänzende Dateien, keine bestehende Datei verändert:
- `pc-manager/member-rotation-settings.js` – die drei Einstellfelder im Manager
- `tv-player/member-rotation.js` – die eigentliche Filterung, hängt sich an die bestehende
  `active()`-Funktion des Players (gleiches, bereits etabliertes Verkettungs-Muster wie an
  mehreren anderen Stellen im Projekt), ändert deren übriges Verhalten nicht

## Ein Fehler unterwegs gefunden und behoben
Beim ersten Testlauf speicherte die Einstellung trotz Klick nicht dauerhaft – ein zu früh
festgehaltener Objektverweis wurde durch spätere Initialisierung ungültig. Behoben: jede
Änderung greift jetzt frisch auf die aktuell gültige Einstellung zu. Live mit allen drei Feldern
bestätigt.

## Prüfung
46 automatisierte Tests, alle grün. Die Rotationslogik selbst wird im neuen Test tatsächlich
ausgeführt (nicht nur auf Vorhandensein geprüft): mit 18 Testmitgliedern liefert sie korrekt
genau 2 pro Durchlauf, andere Folientypen bleiben unverändert, Abschalten zeigt wieder alle 18.
Die drei Einstellfelder wurden zusätzlich live im Manager angeklickt und das Speichern bestätigt.

## Offen / nicht Teil dieser Lieferung
Die inhaltliche Neuordnung der echten Präsentation (Preise früher zeigen, Abschlussfolie mit
Mitgliedschafts-Einladung/QR-Code, Platzhalter-Texte füllen) ist ein separates, noch offenes
Thema – das machen wir als nächstes gemeinsam.
