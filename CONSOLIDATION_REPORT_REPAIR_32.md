# Repair 32 – Konsolidierungsbericht

## Ergebnis

Der PC-Manager besitzt jetzt ein zentrales Laufzeit-Relais zwischen Release-Manifest, Framework-Studio-Katalog und Präsentations-TÜV. Alle im Manager erforderlichen Komponenten werden nach vollständiger Script-Ladung erneut registriert. Externe Übergabeziele wie Kassen-Programmstatus und GitHub-Präsentationsprüfung bleiben im Katalog, blockieren den Manager aber nicht mehr fälschlich.

## Geprüfte Ebenen

1. **Version und Governance:** `latest-release-manifest.js` und `.json` stimmen auf Repair 32 überein. Die vollständige Zuordnung steht in `cores/STUDIO_TUV_COMPONENT_REGISTRY_V1.json`.
2. **Syntax und Ladefolge:** Eigene JavaScript-Dateien werden mit `node --check` geprüft. Script-Quellen und HTML-IDs dürfen nicht doppelt vorkommen. Das zentrale Manifest wird vor `app.js` geladen; der gemeinsame TV-Renderer bleibt die abschließende Render-Schicht.
3. **Konkurrierende Funktionen:** Alte TV-Editoren bleiben über `KC_DISABLE_LEGACY_TV_EDITORS` deaktiviert. Die fachlichen Erweiterungen bleiben getrennte Schichten; die finale Darstellung läuft über `KCTVSharedRenderer`.
4. **Foliennummer:** Die Nummer sitzt oben links in der Rahmenrundung. Ein reservierter 35-Pixel-Bereich verhindert Überdeckung von Vorschaubild und Text. Die aktive Folie erhält eine eigene blaue Kennzeichnung.

## Freigabegrenze

Automatisierte Prüfungen können `Candidate` bestätigen. `Gold` bleibt bis zur praktischen Sichtprüfung auf realem PC-/TV-Bildschirm gesperrt (`practicalVisualCheck: PENDING`).
