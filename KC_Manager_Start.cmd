@echo off
setlocal EnableExtensions
title KC MarktKasse - PC Manager
cd /d "%~dp0"

for %%I in ("%~dp0.") do set "KC_ROOT=%%~fI"
set "KC_BACKEND=%KC_ROOT%\markt-kasse-suite\backend-source"
set "KC_NODE=%KC_ROOT%\runtime\node.exe"

if not exist "%KC_BACKEND%\run-manager-service.js" (
  echo.
  echo FEHLER: Die Manager-Startdateien fehlen.
  echo Erwartet: %KC_BACKEND%\run-manager-service.js
  echo Bitte die ZIP erneut vollstaendig entpacken.
  echo.
  pause
  exit /b 1
)

if not exist "%KC_NODE%" goto EINRICHTEN
if not exist "%KC_BACKEND%\node_modules\ws" goto EINRICHTEN
if not exist "%KC_BACKEND%\node_modules\bonjour-service" goto EINRICHTEN
if not exist "%KC_BACKEND%\node_modules\selfsigned" goto EINRICHTEN
goto STARTEN

:EINRICHTEN
echo.
echo Die KC-Laufzeit wird beim ersten Start einmalig eingerichtet.
echo Dafuer wird jetzt eine Internetverbindung benoetigt.
echo Danach bleibt alles im entpackten KC-Ordner gespeichert.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%KC_ROOT%\KC_Einrichtung.ps1"
if errorlevel 1 (
  echo.
  echo Die Einrichtung war nicht erfolgreich.
  echo Bitte Internetverbindung pruefen und KC_Manager_Start.cmd erneut starten.
  echo.
  pause
  exit /b 1
)

:STARTEN
cd /d "%KC_BACKEND%"

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
