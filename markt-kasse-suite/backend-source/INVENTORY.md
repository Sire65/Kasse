# KC Sync / Installation / Backend – Paket-Inventar

Quelle: `KC_MarktKasse_MoneyButler_Farben.zip`, Teilordner `kc-sync-installation-und-backend/`.

Dieser Bereich gehört zur KC MarktKasse Suite. Der vorhandene produktive Kassenstand an der Repository-Wurzel wird dadurch nicht ersetzt.

## Enthaltene Quell-/Konfigurationsdateien

- `convert-kng-members.js`
- `markttag-start.js` (nur im Originalpaket, nie im Repository; seit 13.11.2026 ersetzt durch `kassen-start.js`, eingebunden in `run-manager-service.js` – siehe TABLET_UND_MANAGER_KOPPELN.md)
- `KC_Markttag_Start.cmd`
- `markttag-kassen.json`
- `backup.js`
- `gate-b-gegenprobe-audit.cjs`
- `serve-frontend.js`
- `pair-manually.js`
- `run-device-companion.js`
- `run-manager-service.js`
- `markttag-markt-fernzugriff.js`
- `KC_Sync_Einrichtung_starten.ps1`
- `package.json`
- `package-lock.json`

### Manager Companion
- `manager-companion/identity.js`
- `manager-companion/secure-file.js`
- `manager-companion/db.js`
- `manager-companion/index.js`

### Device Companion
- `device-companion/db.js`
- `device-companion/index.js`

### Installation
- `install/install-kasse-service.ps1`
- `install/install-manager-service.ps1`

### Tests
- `tests/stage1-integration.test.cjs`

### Dokumentation
- `README.md`
- `MARKTTAG_ANLEITUNG.md`
- `FERNZUGRIFF_ANLEITUNG.md`
- `docs/STATE_MACHINES.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/THREAT_MODEL.md`
- `docs/SECURITY_REVIEW_FIXES.md`
- `docs/BAUSTUFE_3_UEBERSICHT.md`

## Importstatus

Der Quellbestand wurde aus dem vom Nutzer bereitgestellten Paket inventarisiert. Dateien werden unter `markt-kasse-suite/backend-source/` gesichert. Eine Aktivierung oder Installation auf einem laufenden System erfolgt durch diesen Import ausdrücklich nicht.
