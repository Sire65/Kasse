# Prüfbericht Repair 42 – Zeiterfassung

## Ergebnis

Der TimeClockCore ist als eigenständiger Candidate umgesetzt und vom laufenden
Kassenverkauf, der TV-Präsentation und dem Dienstplan entkoppelt.

## Enthalten

- PC-Manager: Freigabeschalter, Mitglied/Aushilfe, befristete Zugänge, Deltaimport,
  Anwesenheitsübersicht und Dienstplan-Ist-Export
- Kasse: optionale Uhrtaste, Scanner-/Codeeingabe, automatisches Kommen/Gehen,
  aktuelle Uhrzeit als Standard, begründete Korrektur und Tagesdelta
- Core: append-only Ereignisse, Alternierungsprüfung, Gültigkeitsprüfung,
  idempotente Zusammenführung und Stundensummen
- Dienstplan: versionierter Vertrag `KC_DUTY_ROSTER_ACTUALS_V1`
- Studio/TÜV: zentraler Release-Relay, Komponentenregistry, Studio-Katalogeintrag,
  Regelsatz, Schema und Pflichtenheft

## Tiefenkonsolidierung

- keine Änderung an Präsentations-, Artikel-, ComboBox- oder Verkaufslogik
- neue Skripte je Oberfläche genau einmal geladen
- 103 JavaScript-Dateien ohne Syntaxfehler
- 20/20 automatisierte Tests grün
- zentrale Runtime-Registry und Manifest-Relay vollständig
- lokaler Browser-Verbindungstest war in der Prüfoberfläche technisch nicht
  erreichbar; DOM-, Ladefolge- und Vertragsprüfungen sind automatisiert abgedeckt

## Vor Gold offen

1. Praxistest mit dem tatsächlich vorgesehenen Bluetooth-/USB-Scanner
2. Test mit mindestens zwei Kassen und anschließendem Deltaimport
3. Festlegung von Rollen, Aufbewahrung/Löschung und arbeitsrechtliche Freigabe
4. Sichtprüfung der Dialoge auf dem eingesetzten Kassendisplay

Status: **Candidate**, nicht Gold.
