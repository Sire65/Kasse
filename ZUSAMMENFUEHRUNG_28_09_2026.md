# Zusammenführung 28.09.2026 – Änderungen 26.09. + TSE-Relay (Entwicklung)

Dieser Stand gilt für Live (`pos/`, `pc-manager/`) **und** Schulung (`schulung/pos/`, `schulung/pc-manager/`).
Die Build-Kennung ist in beiden gleich: `app.js?build=0.31.3.6-r37`, `kc-ausverkauft.js?build=1.0.2`
und im PC-Manager `app.js?build=bilder-v5`.

## Enthalten
1. **Änderungen vom 26.09.2026** (siehe `CHANGELOG_CLAUDE_26-09-2026.txt`):
   * neuer Rabatt-Dialog mit Rundung auf 20 Cent
   * digitaler Bon (Standard AUS)
   * Knopf „Verkaufszeiten“ im Info-Dialog
   * neue Pfandbilder
   * App-Höhe und Layout-Core in ES5
   * Ausverkauft-Verknüpfung Glühwein rot → Feuerzangenbowle
2. **TSE-Relay (Entwicklung, Standard AUS)** – siehe `TSE_RELAY_KASSE_ENTWICKLUNG.md`.

## Vorgehen
Das ZIP vom 26.09. basierte auf dem GitHub-Stand vom 23.09. (Commit `80935e4`). Es fehlten ihm also
die Funktionen vom 23./24.09.:

* X-Bericht
* Helfer-Verpflegung
* Trinkgeld-Zahlenfeld
* Bediener auf dem Bon
* Grünkohl-Kombis
* Verkaufskurve

Deshalb wurde **drei-Wege-zusammengeführt** (Basis `80935e4`) statt überschrieben. Alle neueren
Funktionen sind erhalten, `tests/aenderungen-26-09.test.cjs` prüft das.

## Bewusste Abweichungen vom ZIP
* `AdaptiveLayoutCore.init()` bleibt aufgerufen. Das ZIP hatte den Aufruf entfernt, der Kommentar dort
  nahm aber an, er habe nie existiert. Auf GitHub ist er seit 05.09. drin.
* `pos/service-worker.js` aus dem ZIP wurde **nicht** übernommen, weil es veraltete Build-Kennungen
  enthielt (z. B. `kc-oberflaechen-anwenden.css?build=0.9.2` statt `0.9.15`). Stattdessen wurden nur
  die drei neuen Bilder in die aktuelle Liste eingetragen.
* Der digitale Bon wird in `completeSale()` per try/catch abgesichert. Ein QR-Fehler darf einen bereits
  gespeicherten Verkauf nicht als fehlgeschlagen melden.
* Schulung: Die dortigen Eigenheiten (Warengruppen-Reihenfolge, Becher-Bild, eigene Offline-Liste)
  bleiben erhalten. Übertragen wurden nur die neuen Inhalte.

## Offene Hinweise
* Das QR-Fenster des digitalen Bons liegt links unten und verdeckt für bis zu 20 s den RÜCKGELD-Knopf.
  Solange der Schalter aus ist (Standard), betrifft das niemanden.
* „MARKTBESCHICKER“ ist im Rabatt-Dialog knapp abgeschnitten.
* Die Signaturliste des TSE-Relays liegt im localStorage. Vor dem Echtbetrieb sollte sie in die
  IndexedDB umziehen.
* In der Schulung sollte der TSE-Schalter aus bleiben, damit keine Übungsbons an eine echte TSE gehen.

## Prüfung
* Komplette Test-Suite (74 Tests) vorher/nachher: keine Abweichung bei Exit-Codes und Fehlerbildern.
  Die schon vorher roten Tests sind unverändert rot.
* Neu: `tests/tse-relay.test.cjs` (39 Prüfpunkte) und `tests/aenderungen-26-09.test.cjs` (Live + Schulung).
