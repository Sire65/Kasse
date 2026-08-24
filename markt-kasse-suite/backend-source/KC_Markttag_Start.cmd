@echo off
title KC Sync - Marktag-Start
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo FEHLER: Node.js wurde nicht gefunden.
  echo Bitte zuerst Node.js installieren: https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Erstmalige Einrichtung - installiere benoetigte Pakete, bitte kurz warten ...
  call npm install --no-audit --no-fund
)

echo.
echo Starte KC Sync fuer den Markttag ...
echo Dieses Fenster bitte waehrend des gesamten Marktbetriebs GEOEFFNET lassen.
echo Zum Beenden: dieses Fenster schliessen oder Strg+C druecken.
echo.

node markttag-start.js

pause
