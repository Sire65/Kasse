#!/usr/bin/env bash
# Alle Freisteller für die TV-Speisenfolien neu erzeugen (tools/tv-speisenfolien.cjs → media/speisen/*.webp).
# Je Foto die Einstellungen, die sichtbar den saubersten Umriss ergeben (Betreiber 25.11.2026: Schüsseln gleich,
# Ränder rund). Aufruf aus dem Repository-Wurzelverzeichnis: bash tools/tv-speisenfotos-alle.sh
set -euo pipefail
f() { python3 tools/tv-speisenfotos-freistellen.py "$1" "media/speisen/$2.webp" "${@:3}"; }
f pos/assets/gruenkohl_version_3.png         gruenkohl                 --schale --glatt --bis-balken
f pos/assets/gruenkohl_wurst_version_3.png   gruenkohl-mettendchen     --schale --glatt --bis-balken
f pos/assets/sauerkraut_version_3.png        sauerkraut                --schale --glatt
f pos/assets/sauerkraut_wurst_version_3.png  sauerkraut-mettendchen    --schale --glatt --bis-balken
f pos/assets/creme_kartoffeln_version_3.png  kartoffeln-kartoffelcreme --schale --glatt --bis-balken
f media/speisen/quelle/kartoffeln-heringsstipp.png kartoffeln-heringsstipp --ohne-kassenrahmen --schale --glatt
