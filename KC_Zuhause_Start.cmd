@echo off
rem KC MarktKasse - PC-Manager ZU HAUSE: kein Manager-Dienst, keine Kassen.
rem Der PC-Manager liest den Stand ueber Supabase (Fernmodus).
if exist "%~dp0KC_Manager_Start.cmd" goto START
echo.
echo FEHLER: KC_Manager_Start.cmd wurde neben dieser Datei nicht gefunden.
echo Ordner: %~dp0
echo.
echo Ursache: Meist wurde direkt aus der ZIP-Datei gestartet oder nur diese eine Datei kopiert.
echo Loesung: 1. Rechtsklick auf die ZIP-Datei - "Alle extrahieren..." - Ziel C:\KC-Kasse
echo          2. Im entpackten Ordner (dort liegen KC_Manager_Start.cmd und markt-kasse-suite)
echo             KC_Zuhause_Start.cmd doppelklicken.
echo.
pause
exit /b 1
:START
call "%~dp0KC_Manager_Start.cmd" --zuhause
