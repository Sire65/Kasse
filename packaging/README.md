# Auslieferungs-Pakete

Dieses Repo enthaelt die komplette MarktKasse. Einzelne Programmteile lassen
sich daraus als eigenstaendiges Paket herausloesen, ohne dass sie ein eigenes
Repository brauchen.

## Money Butler

    python packaging/pack_money_butler.py

Erzeugt `dist/money-butler-<datum>.zip`. Das Skript nimmt den Ordner
`money-butler/` und ergaenzt automatisch die Dateien, die er aus `shared/`
und `pc-manager/vendor/` benutzt. Die Ordnerstruktur bleibt erhalten, damit
die relativen Verweise im Code unveraendert funktionieren.

Mit eigener Versionsnummer:

    python packaging/pack_money_butler.py --version 1.2.0

## Warum kein eigenes Repository je Programmteil?

Die Programmteile teilen sich Code (`shared/`, `cores/`). Bei getrennten
Repositories muesste dieser Code mehrfach existieren und jede Korrektur
mehrfach gemacht werden. Ein Repository haelt den Quellcode zusammen; was
ausgeliefert wird, entscheidet das Pack-Skript.
