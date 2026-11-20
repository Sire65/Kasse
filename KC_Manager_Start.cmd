@echo off
setlocal EnableExtensions
title KC MarktKasse - PC Manager
cd /d "%~dp0"

rem WICHTIG: Pfade (%~dp0, %KC_ROOT% ...) nie innerhalb von ( ... )-Bloecken verwenden.
rem Enthaelt der Ordnername eine Klammer, z. B. "Kasse-main (1)", bricht cmd sonst sofort ab.

for %%I in ("%~dp0.") do set "KC_ROOT=%%~fI"
set "KC_BACKEND=%KC_ROOT%\markt-kasse-suite\backend-source"
set "KC_NODE=%KC_ROOT%\runtime\node.exe"

if not exist "%KC_BACKEND%\run-manager-service.js" goto DATEIEN_FEHLEN
if not exist "%KC_NODE%" goto EINRICHTEN
if not exist "%KC_BACKEND%\node_modules\ws" goto EINRICHTEN
if not exist "%KC_BACKEND%\node_modules\bonjour-service" goto EINRICHTEN
if not exist "%KC_BACKEND%\node_modules\selfsigned" goto EINRICHTEN
goto STARTEN

:DATEIEN_FEHLEN
echo.
echo FEHLER: Die Manager-Startdateien fehlen.
echo Erwartet: "%KC_BACKEND%\run-manager-service.js"
echo Bitte die ZIP erneut vollstaendig entpacken (Rechtsklick - "Alle extrahieren...").
echo.
echo "%~dp0" | findstr /i /c:"Startup" /c:"Autostart" >nul
if errorlevel 1 goto DATEIEN_FEHLEN_ENDE
echo HINWEIS: Diese Datei liegt im Autostart-Ordner als KOPIE. Dort muss eine VERKNUEPFUNG liegen.
echo Loesung: 1. Windows-Taste + R, shell:startup, Enter - die Datei KC_Manager_Start.cmd dort loeschen.
echo          2. Im KC-Ordner Rechtsklick auf KC_Manager_Start.cmd - Senden an - Desktop (Verknuepfung erstellen).
echo          3. Die Verknuepfung mit dem kleinen Pfeil in den Autostart-Ordner verschieben.
echo.
:DATEIEN_FEHLEN_ENDE
pause
exit /b 1

:EINRICHTEN
echo.
echo Die KC-Laufzeit wird beim ersten Start einmalig eingerichtet.
echo Dafuer wird jetzt eine Internetverbindung benoetigt.
echo Danach bleibt alles im entpackten KC-Ordner gespeichert.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%KC_ROOT%\KC_Einrichtung.ps1"
if not errorlevel 1 goto STARTEN
echo.
echo Die Einrichtung war nicht erfolgreich. Ursache steht oben in roter Schrift.
echo Bitte Internetverbindung pruefen und KC_Manager_Start.cmd erneut starten.
echo.
pause
exit /b 1

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

"%KC_NODE%" run-manager-service.js --open-manager %*
set "KC_RC=%ERRORLEVEL%"

echo.
if not "%KC_RC%"=="0" echo Start wurde mit Fehlercode %KC_RC% beendet. Ursache und Loesung stehen oben im Kasten mit den Ausrufezeichen.
echo Zum Schliessen Taste druecken.
pause >nul
exit /b %KC_RC%
