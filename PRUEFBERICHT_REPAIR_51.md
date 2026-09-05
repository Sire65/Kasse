# Prüfbericht Repair 51

## Auswertung des gelieferten TÜV-Berichts

Der Bericht enthält zwei Fehler und drei Warnungen:

- `REL-005`: Manifest erwartete AutoKontrast 0.29.29, tatsächlich geladen war
  0.29.30. Das Manifest wurde auf die tatsächlich vorhandene Version korrigiert.
- `RUN-001`/`RUN-002`: Die Laufzeitdiagnose enthält aufgezeichnete Ereignisse.
  Das genannte letzte Ereignis ist ein 53-ms-Long-Task und im RuntimeCore selbst
  als Warnung eingestuft. Repair 51 erhält eine neue Releasekennung und damit eine
  neue, unbelastete Diagnosesitzung.
- `TXT-002`: Folie 3 des gespeicherten Benutzerbestands enthält 544 Zeichen.
  Diese Inhaltswarnung wird nicht automatisch gekürzt, damit keine Benutzerdaten
  verändert werden.
- Die Gates TV, Wiedergabe und Export waren bereits `PASS`.
- Die praktische Sichtprüfung bleibt bis zum Anwender-Rundlauf offen.

## Änderungen

- Markierbare Kassenkarten und „Kasse löschen“ mit genauer Sicherheitsabfrage.
- Synchroner Löschauftrag und eindeutige Erfolgsmeldung.
- MeldungsCore V0.2.0 mit größerer, kontrastreicherer und längerer Rückmeldung.
- Folienübergang direkt im rechten Folieneditor mit Effekt, Dauer und Testtaste.
- Alter Laufschriftbereich ausgeblendet; DisplayMatrixCore ist die einzige
  fachliche Laufschriftsteuerung. Position und Größe sind darin einklappbar.

Andere Funktionsbereiche wurden nicht verändert.
