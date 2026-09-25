@echo off
setlocal EnableExtensions
title KC MarktKasse - PC Manager
cd /d "%~dp0"

set "KC_ROOT=%~dp0"
set "KC_BACKEND=%KC_ROOT%markt-kasse-suite\backend-source"
set "KC_NODE="

if exist "%KC_ROOT%runtime\node.exe" set "KC_NODE=%KC_ROOT%runtime\node.exe"
if not defined KC_NODE (
  where node >nul 2>nul
  if not errorlevel 1 set "KC_NODE=node"
)

if not defined KC_NODE (
  echo.
  echo FEHLER: Node.js wurde nicht gefunden.
  echo Diese Komplettversion sollte runtime\node.exe enthalten.
  echo Falls der Ordner runtime fehlt, bitte die ZIP erneut vollstaendig entpacken.
  echo.
  pause
  exit /b 1
)

if not exist "%KC_BACKEND%\run-manager-service.js" (
  echo.
  echo FEHLER: Die Manager-Startdateien fehlen.
  echo Erwartet: %KC_BACKEND%\run-manager-service.js
  echo Bitte die ZIP erneut vollstaendig entpacken.
  echo.
  pause
  exit /b 1
)

cd /d "%KC_BACKEND%"

if not exist "node_modules\ws" (
  echo.
  echo Laufzeitmodule fehlen. Versuche einmalige Installation ...
  where npm >nul 2>nul
  if errorlevel 1 (
    echo FEHLER: node_modules fehlen und npm ist nicht verfuegbar.
    echo Bitte die vollstaendige KC-Komplett-ZIP verwenden.
    pause
    exit /b 1
  )
  call npm install --omit=dev --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo FEHLER: Laufzeitmodule konnten nicht installiert werden.
    echo Bitte die vollstaendige KC-Komplett-ZIP verwenden.
    pause
    exit /b 1
  )
)

echo.
echo ==============================================================
echo  KC MARKTKASSE - START
echo ==============================================================
echo  PC-Manager, lokaler Manager-Dienst und Webserver werden
echo  gemeinsam gestartet. Dieses Fenster OFFEN lassen.
echo ==============================================================
echo.

"%KC_NODE%" run-manager-service.js --open-manager
set "KC_RC=%ERRORLEVEL%"

echo.
if not "%KC_RC%"=="0" echo Start wurde mit Fehlercode %KC_RC% beendet.
echo Zum Schliessen Taste druecken.
pause >nul
exit /b %KC_RC%
