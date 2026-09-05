# Stabilitätsbericht V0.29.30

## Ziel

Reine Stabilisierung der TV-Präsentation im PC-Manager. In dieser Version wurden keine neuen Fachfunktionen ergänzt.

## Behobene Sperren

1. **REL-001 / Offline-Manifest**  
   Das zentrale Release-Manifest wird als lokales Skript geladen und benötigt beim Start per Doppelklick kein `fetch()` und keinen Webserver.

2. **RUN-001 / alte Diagnoseereignisse**  
   Das SYSTEM-Gate bewertet nur echte Fehler der aktuellen Browser-Sitzung und des aktuellen Releases. Performanceereignisse bleiben Warnungen. Im TÜV kann die aktuelle Diagnose zurückgesetzt werden.

3. **LAY-001 / Layout-Guard nicht aktiv**  
   Der vorhandene Professional Guard wird vor dem Präsentations-TÜV geladen und greift über eine definierte Schnittstelle auf das aktuelle TV-Projekt zu.

## Automatisierte Prüfung

- Zentralmanifest ohne Netzwerkzugriff geladen: PASS
- Erwartete Komponentenstände registriert: PASS
- Versionsabweichung führt zu BLOCKED: PASS
- 323-ms-Long-Task bleibt Warnung: PASS
- JavaScript-Fehler führt zu SYSTEM-Sperre: PASS
- Diagnoserücksetzung aktuelle Sitzung: PASS
- Layoutobjekte in TV-Sicherheitsbereich korrigiert: PASS
- JavaScript-Syntaxprüfung aller nicht minimierten Dateien: PASS
- Lokale HTML-Dateiverweise: PASS
- SHA-256-Dateimanifest: wird beim Paketbau neu erzeugt

## Bewusst offenes Gate

`REL-006 – Praktische Sichtprüfung offen` bleibt bis zum realen Rundlauf im Browser bestehen. Dadurch ist der Candidate-Status `CONDITIONAL` statt einer unberechtigten Vollfreigabe.

## Praktischer Rundlauf

1. `pc-manager/index.html` per Doppelklick öffnen.
2. TV-Präsentation öffnen und TÜV starten.
3. „TV-Fläche automatisch korrigieren“ ausführen.
4. Falls alte Anzeigen sichtbar sind: „Aktuelle Diagnose zurücksetzen“ und „Neu prüfen“.
5. Folien, Editor, Wetter, Kontrast, Vorschau, Vollbild, Speichern, Export und Import testen.
6. Neuen TÜV-Bericht exportieren.
