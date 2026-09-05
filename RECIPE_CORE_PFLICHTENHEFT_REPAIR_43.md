# Pflichtenheft – RecipeCalculationCore Repair 43

## Zweck

Programmneutraler Rezepturbaustein für PC-Manager und die spätere
Köcheclub-Verwaltung mit Einkauf und Bestellung.

## Funktionen

- Grundrezept mit Fertigausbeute und Portionsgröße
- Zutaten als strukturierte Tabelle mit Menge, Einheit, Vorbereitung und Verlust
- Berechnung der Grundportionen
- Skalierung auf gewünschte Portionen inklusive Reserve
- Rückwärtsrechnung aus einer vorhandenen Bezugszutat
- optionale Kostenberechnung als interner Verwaltungswert
- versionierte Freigabe und Quellenangabe

## Harte Kassen-Grenze

`KC_PRODUCT_INFO_PACKAGE_V1` enthält ausschließlich:

- technische Artikel-ID, Version und Informationsstatus
- Inhaltsstoffe/Zutatenbezeichnungen
- Zusatzstoffe
- Allergene
- Nährwerte
- Hinweise

Ausgeschlossen sind Rezeptmengen, Portionskalkulation, Verluste, Kosten,
Lieferanten, Bezugsquellen, Bestände, Einkauf und Produktionsplanung.

## Noch vor Gold

- fachliche Prüfung der tatsächlichen Gar-/Putzverluste und Fertigausbeute
- Freigabe der Allergene und Nährwerte
- Praxistest der Bedienoberfläche mit einer vollständigen Grünkohlrezeptur
- späterer Vertragstest mit Einkaufs- und Bestellmodul
