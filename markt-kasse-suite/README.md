# KC MarktKasse Suite – Paketimport 24.08.2026

Quelle: `KC_MarktKasse_MoneyButler_Farben.zip`.

Dieser Bereich wurde bewusst getrennt vom bestehenden veröffentlichten Kassenstand angelegt, damit der laufende Root-Stand im Repository nicht überschrieben wird.

Aktueller Importstand:

- `money-butler/` – KC Money Butler V0.21.5 als normal lesbarer Quellcode
- `pc-manager-source/` – KC MarktKasse PC-Manager / Verwaltungsoberfläche als rekonstruierbarer Quellstand einschließlich zusätzlicher Supportmodule
- `shared/` – bereits übernommene gemeinsame Runtime-/Core-Dateien
- `pc-manager-source/RESTORE.md` – Wiederherstellungsanleitung und Modul-Inventar
- `pc-manager-source/restore-pc-manager.mjs` – automatischer Restore mit Base64 → gzip → HTML, HTML-Prüfung und SHA-256-Report
- `backend-source/` – KC Sync / Installation / Backend mit Paketbeschreibung, Start-/Registerkonfiguration, Service-Runnern, Pairing-Tool und Frontend-Server
- `backend-source/kicc-runtime-telemetry.js` – gemeinsamer Heartbeat-/Flow-Sender für Suite-Dienste; Secrets nur per Umgebungsvariable
- `backend-source/kicc-readiness-check.js` – automatischer Check für Companion-Quellen, Endpoint/Auth und Versionswerte
- `PACKAGE_INVENTORY.md` – verifiziertes Gesamtinventar mit Original-ZIP-SHA-256
- `backend-source/BUNDLE_MANIFEST.md` – Integritätsdaten des zusätzlich erzeugten Backend-Wiederherstellungsbundles

Das Originalpaket enthält 614 ZIP-Einträge bzw. 528 Dateien. Der PC-Manager gehört zu diesem MarktKasse-Paket und ist kein eigenständiger zweiter PC-Manager des Failover-Gateways.

## Aktuell bekannte Restore-Lücke

Die Runner `backend-source/run-device-companion.js` und `backend-source/run-manager-service.js` sind vorhanden und bereits für KICC-Telemetrie vorbereitet. Die von ihnen benötigten Quellmodule `device-companion.js` und `manager-companion.js` sind im aktuell entpackten Repository-Bestand jedoch nicht als normale Dateien vorhanden und wurden auch in der verfügbaren Commit-Historie nicht gefunden. Solange diese beiden Module nicht aus dem Originalpaket bzw. Wiederherstellungsbundle restauriert sind, darf der Suite-Backend-Status nicht als READY/produktiv bewertet werden.

Der automatische Check lautet:

```bash
node backend-source/kicc-readiness-check.js
```

Ergebnisregeln:

- `READY` – Companion-Quellen, Heartbeat/Flow-Endpoint und Auth vorhanden.
- `PREPARED` – Quellen vorhanden, aber Laufzeitkonfiguration noch unvollständig.
- `BLOCKED` – notwendige Companion-Quelldateien fehlen.

## KICC-Telemetrie

Bilderkasse und PC-Manager sind als getrennte Programme vorgesehen (`kc-bilderkasse`, `kc-pc-manager`). Die Runner senden Heartbeats nur, wenn ein HTTPS-Endpoint und eine Authorization per Umgebungsvariable gesetzt sind. Der Bilderkassen-Runner sendet zusätzlich nur nach einem tatsächlich erfolgreichen Sync mit `synced > 0` einen technischen `SYNC`-Flow `program:kc-bilderkasse → db-supabase-core`; es werden keine Kassen-/Bon-/Personendaten an KICC übertragen.

Importregel: Bestehende Dateien an der Repository-Wurzel werden durch diesen Paketimport nicht ersetzt. Erst nach Prüfung/Regression kann entschieden werden, welche Suite-Komponenten produktiv geschaltet werden. Produktive Geheimnisse werden nicht in Git abgelegt.

Noch nicht als produktiver Root aktiviert: PC-Manager, Money Butler, KC-Sync-Backend und weitere Suite-Komponenten. Sie sind bewusst getrennt gesichert, damit der bisherige laufende Kassenstand nicht unbeabsichtigt verändert wird.
