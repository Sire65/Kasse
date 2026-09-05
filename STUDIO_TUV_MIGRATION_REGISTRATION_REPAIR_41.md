# Studio-/TÜV-Registrierung Repair 41

## Fehlerursache

Der PC-Manager bevorzugt beim Start die im Browser gespeicherte Präsentation.
Die in Repair 40 aktualisierte Weihnachtsmarktvorlage war deshalb vorhanden,
ersetzte aber einen bereits gespeicherten älteren Foliensatz nicht.

## Reparatur

- Vorlagenstand auf `1.0.6` erhöht.
- Einmalige Inhaltsmigration für vorhandene Weihnachtsmarkt-Präsentationen.
- Ersetzt werden ausschließlich die Folien `wm26-002` bis `wm26-020`:
  eine Gruppenfolie und 18 Mitgliedsfolien.
- Alle übrigen Folien, Kassen-, Wetter-, Programm- und Managerdaten bleiben
  unverändert.
- Vor dem Austausch wird unter
  `kcm_tv_backup_before_members_1_0_6` eine Sicherung angelegt, sofern der
  Browser-Speicher dies zulässt.
- Die erfolgreiche Migration wird als `memberContentVersion: 1.0.6`
  gespeichert und dadurch nicht bei jedem Start wiederholt.
- Eine bewusste Wiederholung ist über den neuen Vorlagenknopf
  „Mitgliederfolien aktualisieren“ möglich.
- „Platzhalter wiederherstellen“ lädt jetzt ebenfalls das richtige neue
  Gruppen- oder Mitgliedsfoto aus der zentralen Vorlage.

## TÜV-Regeln

- Die Migration darf keine Folien außerhalb des festgelegten ID-Bereichs
  ersetzen.
- Spätere Benutzeränderungen dürfen nach erfolgreicher Migration nicht beim
  Neustart überschrieben werden.
- Eine manuell bestätigte Wiederholung darf die 19 Zielfolien erneut ersetzen.
- Neue, direkt geladene Vorlagen tragen den Migrationsstand bereits und werden
  nicht unnötig erneut verarbeitet.

## Status

Candidate. Praktische Sichtprüfung im PC-Manager bleibt vor Gold erforderlich.
