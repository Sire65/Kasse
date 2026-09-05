# SoundCore V1.1.0

Gemeinsamer Framework-Core für kurze, nicht blockierende Anwendungstöne.

## POS-Integration

- Kassenton nur nach erfolgreich gespeicherter Buchung
- Schalter in der Kassenkopfzeile
- Zustand lokal gespeichert
- echter MP3-Kassenton aus `pos/sounds/kassenton.mp3`
- synthetischer Ersatzton, falls die MP3 auf dem Zielgerät nicht geladen werden kann
- Fehler in der Audiowiedergabe dürfen den Verkauf niemals blockieren

## Performance-Budget

Die Klangerzeugung wird erst nach der Buchung angestoßen. Es gibt keine Timer, Polling-Schleifen oder Hintergrundprüfungen.
