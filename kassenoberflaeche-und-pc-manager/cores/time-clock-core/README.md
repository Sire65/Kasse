# TimeClockCore V0.1.0

Eigenständiger, oberflächenneutraler Kern für Kommen-/Gehen-Ereignisse.

- append-only Ereignisse mit eindeutiger ID
- idempotenter Delta-Abgleich mehrerer Kassen
- QR/ID sowie optional sechsstelliger Geburtstagscode
- zeitlich begrenzte Aushilfen und optionale Stundenvergütung
- Trennung von Erfassungszeit und wirksamer Zeit samt Korrekturgrund
- Ist-Zeit-Zusammenfassung für den späteren Dienstplanabgleich

Der Core führt keine Lohnabrechnung durch. Stundensatz und ermittelte Stunden sind
nur Planungs-/Prüfdaten; eine Freigabe bleibt im Manager erforderlich.
