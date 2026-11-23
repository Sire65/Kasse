@echo off
rem KC MarktKasse - PC-Manager ZU HAUSE: kein Manager-Dienst, keine Kassen.
rem Der PC-Manager liest den Stand ueber Supabase (Fernmodus).
rem Installiert sich beim ersten Mal nach C:\KC-Kasse (wie am Stand) und holt Updates
rem beim Start - zu Hause gilt keine Marktsperre.
if exist "%~dp0KC_Manager_Start.cmd" goto START
if exist "C:\KC-Kasse\KC_Manager_Start.cmd" goto START_INSTALLIERT
echo.
echo FEHLER: KC_Manager_Start.cmd wurde neben dieser Datei nicht gefunden.
echo Ordner: %~dp0
echo.
echo Ursache: Meist wurde direkt aus der ZIP-Datei gestartet oder nur diese eine Datei kopiert.
echo Loesung: 1. Rechtsklick auf die ZIP-Datei - "Alle extrahieren..."
echo          2. Im entpackten Ordner KC_Zuhause_Start.cmd doppelklicken.
echo.
pause
exit /b 1
:START
call "%~dp0KC_Manager_Start.cmd" --zuhause %* & exit /b
:START_INSTALLIERT
call "C:\KC-Kasse\KC_Manager_Start.cmd" --zuhause %* & exit /b
