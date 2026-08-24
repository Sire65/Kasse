# KC MarktKasse Suite – Paketimport 24.08.2026

Quelle: `KC_MarktKasse_MoneyButler_Farben.zip`.

Dieser Bereich wurde bewusst getrennt vom bestehenden veröffentlichten Kassenstand angelegt, damit der laufende Root-Stand im Repository nicht überschrieben wird.

Aktueller Importstand:

- `money-butler/` – KC Money Butler V0.21.5 als normal lesbarer Quellcode
- `pc-manager-source/` – KC MarktKasse PC-Manager / Verwaltungsoberfläche als rekonstruierbarer Quellstand einschließlich zusätzlicher Supportmodule
- `shared/` – bereits übernommene gemeinsame Runtime-/Core-Dateien
- `pc-manager-source/RESTORE.md` – Wiederherstellungsanleitung und Modul-Inventar
- `backend-source/` – KC Sync / Installation / Backend mit Paketbeschreibung, Start-/Registerkonfiguration, Service-Runnern, Pairing-Tool und Frontend-Server
- `PACKAGE_INVENTORY.md` – verifiziertes Gesamtinventar mit Original-ZIP-SHA-256
- `backend-source/BUNDLE_MANIFEST.md` – Integritätsdaten des zusätzlich erzeugten Backend-Wiederherstellungsbundles

Das Originalpaket enthält 614 ZIP-Einträge bzw. 528 Dateien. Der PC-Manager gehört zu diesem MarktKasse-Paket und ist kein eigenständiger zweiter PC-Manager des Failover-Gateways.

Importregel: Bestehende Dateien an der Repository-Wurzel werden durch diesen Paketimport nicht ersetzt. Erst nach Prüfung/Regression kann entschieden werden, welche Suite-Komponenten produktiv geschaltet werden. Produktive Geheimnisse werden nicht in Git abgelegt.

Noch nicht als produktiver Root aktiviert: PC-Manager, Money Butler, KC-Sync-Backend und weitere Suite-Komponenten. Sie sind bewusst getrennt gesichert, damit der bisherige laufende Kassenstand nicht unbeabsichtigt verändert wird.
