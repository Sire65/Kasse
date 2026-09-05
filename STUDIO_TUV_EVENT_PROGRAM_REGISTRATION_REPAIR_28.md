# Repair 28 · Studio- und TÜV-Registrierung der Programmübergabe

## Architekturabgleich

`EventProgramExchangeCore` ist die einzige Verhaltensquelle für das Format `KC_EVENT_PROGRAM_PACKAGE_V1`. Der PC-Manager erzeugt Pakete über diesen Core; die Kasse prüft sie vor der Speicherung über denselben Core. Es entsteht kein zweiter Programm- oder Kasseneditor.

## Studio-Anmeldung

Der Core ist unter `cores/event-program-exchange-core/studio-catalog-entry.json` mit Studio-ID, Runtime-ID, Version, Fähigkeiten, Verbrauchern und gesperrten Fachbereichen eingetragen. Das zentrale Release-Manifest verlangt Core V0.1.1, Studio-Katalog V1.0.0 und TÜV-Regelsatz V1.0.0.

## TÜV-Abgleich

Der Regelsatz `cores/event-program-exchange-core/tuv-rules.json` führt neun Prüfungen. Statisch geprüft sind Schema, Prüfsumme, Bewertungswerte, Pflichtbereich Programm und die Trennung von Kassendaten. Pakete mit Artikeln, Preisen, Bons, Transaktionen, Kassenstatus, Benutzern oder Rechten werden verworfen.

Die Personalangabe bleibt ein Hinweis. Sie darf keine automatische Personaleinsatzentscheidung auslösen.

## Freigabestatus

- Automatischer/statischer TÜV: PASS
- Praktischer Import-, Kurz-/Langdruck- und Sichttest auf echter Kasse: PENDING
- Gesamtstatus: CONDITIONAL / Candidate

Eine Gold-Freigabe erfolgt erst nach protokolliertem Test auf dem Kassengerät.
