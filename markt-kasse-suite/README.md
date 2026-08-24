# KC MarktKasse Suite – Paketimport 24.08.2026

Quelle: `KC_MarktKasse_MoneyButler_Farben.zip`.

Dieser Bereich wurde bewusst getrennt vom bestehenden veröffentlichten Kassenstand angelegt, damit der laufende Root-Stand im Repository nicht überschrieben wird.

Aktueller Importstand:

- `money-butler/` – KC Money Butler V0.21.5 als normal lesbarer Quellcode
- `pc-manager-source/` – KC MarktKasse PC-Manager / Verwaltungsoberfläche als rekonstruierbarer Quellstand einschließlich der zusätzlichen 44 Supportmodule
- `shared/` – bereits übernommene gemeinsame Runtime-/Core-Dateien
- `pc-manager-source/RESTORE.md` – Wiederherstellungsanleitung und Modul-Inventar
- `backend-source/` – KC Sync / Installation / Backend; Inventar, Paketbeschreibung, Start-/Registerkonfiguration und weitere Quellteile werden aus dem Originalpaket übernommen

Das hochgeladene Paket enthält insgesamt 614 ZIP-Einträge. Der PC-Manager gehört zu diesem MarktKasse-Paket und ist kein eigenständiger zweiter PC-Manager des Failover-Gateways.

Importregel: Bestehende Dateien an der Repository-Wurzel werden durch diesen Paketimport nicht ersetzt. Erst nach Prüfung/Regression kann entschieden werden, welche Suite-Komponenten produktiv geschaltet werden.

Noch nicht als produktiver Root aktiviert: PC-Manager, Money Butler, KC-Sync-Backend und weitere Suite-Komponenten. Sie sind bewusst getrennt gesichert, damit der bisherige laufende Kassenstand nicht unbeabsichtigt verändert wird.
