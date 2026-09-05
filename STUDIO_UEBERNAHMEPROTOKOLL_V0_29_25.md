# Studio-Übernahmeprotokoll V0.29.25

## Übernommene Bausteine
- WeatherCore V0.1.0 Candidate als allgemeiner Core ohne pflanzenspezifische Regeln.
- KC WeatherPresentationAdapter in `pc-manager/weather-mobile-exchange-integration.js`.
- MobilePresentationExchangeCore V0.1.0 Candidate.
- KC Mobil Adapter mit Rechten `view`, `comment`, `edit` und Änderungsprotokoll.

## Architekturentscheidung
Keine zweite Wetterverwaltung im KC. Bestehende Wetterfelder bleiben kompatibel und werden über den Adapter mit dem Core verbunden. Der Manager bleibt Single Source of Truth und Freigabeinstanz.

## Rückfall
Die bisherigen Wetterdaten und das bisherige `.kctva/.kctvr`-Verfahren bleiben lesbar. Neue Pakete verwenden `.kcmobile/.kcreturn`.
