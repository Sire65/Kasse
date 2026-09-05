# Prüfbericht Repair 57: Kompakter Umsatzspeicher

## Gefundener Fehler

Der Browser verweigerte `localStorage.setItem("kcm_sales", …)`, weil der gemeinsame Speicherbereich bereits durch Managerdaten, Präsentation und die unkomprimierte Umsatzliste belegt war. Die englische Browsermeldung war für Anwender ungeeignet.

## Reparatur

- `SalesImportCore 0.2.0` speichert Umsätze im Format `KC_SALES_COMPACT_V1`.
- Wiederkehrende Artikel-, Kassen-, Bediener-, Zahlarten- und Typtexte werden nur einmal in Wörterbüchern gespeichert.
- Buchungen werden platzsparend als Datenzeilen abgelegt und beim Laden vollständig rekonstruiert.
- Alte JSON-Umsatzlisten werden weiterhin gelesen und beim nächsten Speichern automatisch migriert.
- Dashboard, Bestand und Simulation verwenden denselben zentralen Leseweg.
- Quota-, Passwort-, Entschlüsselungs-, JSON- und Formatfehler erscheinen in verständlichem Deutsch.

## Belastungstest

- 8.200 Bons
- 18.270 Positionen
- 21.182 verkaufte Einheiten
- Umsatz 85.266,00 €
- Kompakter Umsatzspeicher: 866.091 Bytes
- Anteil am angenommenen 5-MB-Limit: 16,5 %
- Vorher Repair 56: 3.093.241 Bytes beziehungsweise 59,0 %

Der praktische Vier-Dateien-Import erreichte 100 %, erkannte alle 8.200 bereits vorhandenen Vorgänge und endete ohne Quota- oder Browserfehler.
