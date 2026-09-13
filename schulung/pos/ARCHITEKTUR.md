# POS-Architektur V0.20.2

## Oberfläche

- Verkaufsansicht: Artikelbilder, Kategorien, Warenkorb, Zahlungen und operative Funktionen.
- Öffentliche Einstellungen sind entfernt.
- Geschützter Bereich: Logo-Halten/Mehrfachberührung plus Superadmin-QR oder PIN.
- Tablet-Dialoge besitzen begrenzte responsive Breiten und interne Scrollbereiche.

## Cores

- CatalogCore: Gruppen, Artikel, Optionen, Pfand und Kassen-Sichtbarkeitsprofil.
- CartCore: Mengen, Zeilenkorrektur, offener Bon und rabattfähiger Warenkorbabzug ohne Pfand/Rückgaben.
- TransactionCore: Produktiv-/Trainingstrennung, Personal, Gegenbon-Storno, Rabattzeile und negativer Reklamationsvorgang.
- CashCore: Übergaben, Replay-Schutz, Entnahmen und verknüpfte Reklamationsauszahlung.
- ClosingCore: Sollabschluss, KCLOSE1 und QR.
- SuperadminAccessCore: PBKDF2-PIN, QR-Prüfsumme, Ablauf und Audit.
- PosChangeSyncCore: Vor-Ort-Änderungen und `.kcchanges`.
- BackupCore: vollständige Sicherung mit SHA-256-Prüfsumme.
- SelfTestCore: periodischer interner TÜV und `.kctuv`.

## Speicher

Siehe `../ARCHITEKTUR.md`. Produktiv- und Trainingsvorgänge sind getrennt. Neue Datensätze besitzen jeweils eine SHA-256-Prüfkette.

## Integrationsgrenzen

- Karte: externes Terminal, manuelle Erfolgsbestätigung.
- Druck: Browser-/Systemdruckdialog.
- TSE: interner Modusschalter, noch kein produktiver Adapter.
