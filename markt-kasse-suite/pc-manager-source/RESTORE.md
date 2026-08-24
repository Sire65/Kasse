# KC PC-Manager – Wiederherstellung des importierten Quellstands

Quelle: `KC_MarktKasse_MoneyButler_Farben.zip` (Import 24.08.2026).

Der bestehende produktive Kassenstand an der Repository-Wurzel wurde durch diesen Import bewusst nicht überschrieben.

## PC-Manager-Kern

Unter `pc-manager-source/` liegen die bereits gesicherten `core.part001.b64` bis `core.part009.b64` aus dem ersten Importabschnitt.

## PC-Manager-Supportmodule

Die weiteren 44 JavaScript-/CSS-Module des PC-Managers sind als gzip-komprimiertes TAR-Archiv gespeichert. Zur Wiederherstellung werden diese Dateien in exakt dieser Reihenfolge verkettet:

1. `core.part010.b64`
2. `core.part011.b64`
3. `support.tail.b64`

### Linux / macOS / Git Bash

```bash
cat core.part010.b64 core.part011.b64 support.tail.b64 > pc-manager-support.tar.gz.b64
base64 -d pc-manager-support.tar.gz.b64 > pc-manager-support.tar.gz
tar -xzf pc-manager-support.tar.gz
```

### PowerShell

```powershell
$content = (Get-Content core.part010.b64 -Raw) + (Get-Content core.part011.b64 -Raw) + (Get-Content support.tail.b64 -Raw)
[IO.File]::WriteAllBytes('pc-manager-support.tar.gz',[Convert]::FromBase64String($content))
tar -xzf pc-manager-support.tar.gz
```

Die entpackten Dateien gehören in den ursprünglichen Ordner `kassenoberflaeche-und-pc-manager/pc-manager/`.

## Enthaltene Supportmodule

- audio-presentation-integration.js
- design-core-presentation-integration.js
- dev-quick-access.css / .js
- dynamic-content-resolver.js
- event-program-export-v010.css
- kc-admin-center.js
- kc-fernverkehr-dashboard.js
- kc-live-monitor.css / .js
- kc-manager-supabase-status.js
- kc-supabase-dashboard.js
- manager-event-simulation-adapter.js
- manager-import-progress-core.css / .js
- manager-masterdata-health-v02949.js
- manager-message-integration-v010.js
- manager-navigation-adapter-v010.css / .js
- manager-navigation-extras-v011.css / .js
- manager-sales-inventory-dashboard.css / .js
- manager-select-health-v02946.js
- manager-table-core.css / .js
- member-rotation-settings.js
- mobile-job-activation-fix-v02963.js
- pos-ui-profile-details-v012.css
- pos-ui-profile-manager.css / .js
- presentation-professional-guard.js
- presentation-save-open.js
- presentation-tuv-integration.js
- program-import-core-v010.css
- recipe-manager.css / .js
- release-manifest-integration.js
- time-clock-manager.css / .js
- tv-dashboard-live.js
- tv-designer-launcher.js
- weather-mobile-exchange-integration.css / .js

Money Butler liegt getrennt unter `markt-kasse-suite/money-butler/` als normal lesbarer Quellcode.
