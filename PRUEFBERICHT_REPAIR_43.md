# Prüfbericht Repair 43 – RecipeCalculationCore

## Ergebnis

Der Rezepturkern ist programmneutral umgesetzt und im PC-Manager als eigener
Artikelreiter integriert. Rezepturen bleiben unabhängig von Artikel-Grunddaten
versioniert erhalten und können später vom Köcheclub-Verwaltungs-, Einkaufs- und
Bestellmodul verwendet werden.

## Rechenfunktionen

- Fertigausbeute geteilt durch Portionsgröße
- Zutatenbedarf pro Portion
- Hoch-/Herunterskalierung auf gewünschte Portionen
- optionale Sicherheitsreserve
- Rückwärtsrechnung aus verfügbarer Bezugszutat
- Gar-/Putzverlust als separater Wert
- optionale interne Kosten

## Kassen-Sicherheitsgrenze

Automatischer Negativtest bestätigt: Das Kassenpaket enthält keine Rezeptmengen,
Portionswerte, Verluste, Kosten, Lieferanten, Einkaufspreise oder Produktionswerte.
Es enthält nur Artikelkennung/Version/Status sowie Inhaltsstoffe, Zusatzstoffe,
Allergene, Nährwerte und Hinweise.

## Konsolidierung

- Studio-Katalogeintrag und TÜV-Regelsatz vorhanden
- zentrales Release-Manifest und Runtime-Relay erweitert
- bestehende Kassen-, TV-, ComboBox- und Zeiterfassungslogik nicht geändert
- Gold bleibt bis zur fachlichen Ausbeute-/Allergen-/Nährwertprüfung gesperrt
