# HealthCore V1.0.0

Nicht-blockierende technische Eigenüberwachung für Browser/PWA-Anwendungen. Überwacht ausschließlich Programmzustand, Laufzeitfehler, Speicher, Service Worker und Performance-Signale. Keine personenbezogenen Daten, keine Verkaufsinhalte und keine Benutzerüberwachung.

## Betriebsregeln
- Leerlaufplanung via `requestIdleCallback`
- hartes Zeitbudget
- Pause bei aktiver Bedienung, offenem Bon oder Zahlungsdialog
- Selbstabschaltung bei internem Fehler
- verschlüsselter Diagnoseexport: PBKDF2/SHA-256 + AES-256-GCM
