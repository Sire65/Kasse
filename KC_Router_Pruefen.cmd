@echo off
title KC MarktKasse - Router pruefen
cd /d "%~dp0"
if not exist "%~dp0runtime\node.exe" goto OHNE_NODE
"%~dp0runtime\node.exe" "%~dp0markt-kasse-suite\backend-source\router-pruefen.js"
echo.
pause
exit /b 0
:OHNE_NODE
echo FEHLER: Die KC-Laufzeit fehlt. Bitte zuerst einmal KC_Manager_Start.cmd starten.
pause
exit /b 1
