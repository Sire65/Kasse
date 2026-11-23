@echo off
title KC MarktKasse - Router pruefen
cd /d "%~dp0"
set "KC_NODE=%~dp0runtime\node.exe"
set "KC_SKRIPT=%~dp0programm\aktuell\markt-kasse-suite\backend-source\router-pruefen.js"
if not exist "%KC_SKRIPT%" set "KC_SKRIPT=%~dp0markt-kasse-suite\backend-source\router-pruefen.js"
if not exist "%KC_NODE%" goto OHNE_NODE
if not exist "%KC_SKRIPT%" goto OHNE_NODE
set "NODE_PATH=%~dp0node_modules"
"%KC_NODE%" "%KC_SKRIPT%"
echo.
pause
exit /b 0
:OHNE_NODE
echo FEHLER: Die KC-Laufzeit fehlt. Bitte zuerst einmal KC_Manager_Start.cmd starten.
pause
exit /b 1
