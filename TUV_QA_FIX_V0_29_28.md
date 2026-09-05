# TÜV-/QA-Nachprüfung V0.29.28

## Behobene Fehler

### WET-028-01 – Wetter-Tagesauswahl
- Auswahl enthält 0, 1, 2, 3, 5, 7, 10 und 14 Tage.
- Der gewählte Wert wird unmittelbar im Präsentationsmodell gespeichert.
- Die Auswahl wird nach dem Wetterabruf nicht mehr auf einen Tag zurückgesetzt.
- Automatisches Laden beim Start wurde entfernt; dadurch blockiert der Wetterdienst den Dialog nicht mehr beim Öffnen.

### MOB-028-01 – KC-Mobil-Rechte
- Freigabemodus ist fest im Managerformular vorhanden.
- Standard ist „Ansehen und bearbeiten“.
- Unterstützt: ansehen, kommentieren, bearbeiten.
- Der gewählte Modus wird im Auftrag als `permissions.mode` sowie als explizite Boolesche Rechte gespeichert.
- KC Mobil normalisiert auch ältere Aufträge mit `permissions.editor=true` korrekt auf Bearbeitungsmodus.

## Prüfgates
- JavaScript-Syntax: PASS
- Rechte-Migration V1/V2: PASS (statische Prüfung)
- Wetter-Auswahlliste: PASS (statische Prüfung)
- ZIP-Integrität: PASS

Status: Candidate – praktischer Browser-Rundlauf empfohlen.
