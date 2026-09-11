@echo off
chcp 65001 >nul 2>nul
title KC Sync - Firewall-Freigabe fuer Node.js
setlocal

echo.
echo ===========================================================================
echo   KC Sync - Firewall-Freigabe fuer Node.js
echo ===========================================================================
echo.
echo   WAS DIESE DATEI TUT:
echo   Sie legt EINE Regel in der Windows-Firewall an. Damit duerfen Tablets im
echo   selben WLAN den Kassen-Webserver auf diesem Rechner erreichen.
echo.
echo   Regelname:   KC MarktKasse (Node.js)
echo   Richtung:    eingehend
echo   Gilt fuer:   nur das private Netzwerkprofil (Heimnetz)
echo   Programm:    node.exe
echo.
echo   WAS SIE NICHT TUT:
echo   Sie schaltet die Firewall nicht ab, aendert das Netzwerkprofil nicht und
echo   oeffnet nichts Richtung Internet. Rueckgaengig machen: in der Firewall die
echo   Regel "KC MarktKasse (Node.js)" loeschen.
echo.

net session >nul 2>nul
if errorlevel 1 (
  echo   ABBRUCH: Diese Datei braucht Administratorrechte.
  echo.
  echo   Bitte schliessen, dann RECHTSKLICK auf die Datei und
  echo   "Als Administrator ausfuehren" waehlen.
  echo.
  pause
  exit /b 1
)

set "NODEPFAD="
for /f "delims=" %%i in ('where node 2^>nul') do if not defined NODEPFAD set "NODEPFAD=%%i"
if not defined NODEPFAD if exist "%ProgramFiles%\nodejs\node.exe" set "NODEPFAD=%ProgramFiles%\nodejs\node.exe"

if not defined NODEPFAD (
  echo   ABBRUCH: node.exe wurde nicht gefunden.
  echo   Bitte zuerst Node.js installieren: https://nodejs.org
  echo.
  pause
  exit /b 1
)

echo   Gefunden: %NODEPFAD%
echo.
set /p WEITER="  Regel jetzt anlegen? (j/n): "
if /i not "%WEITER%"=="j" (
  echo.
  echo   Nichts geaendert.
  echo.
  pause
  exit /b 0
)

echo.
netsh advfirewall firewall delete rule name="KC MarktKasse (Node.js)" >nul 2>nul
netsh advfirewall firewall add rule name="KC MarktKasse (Node.js)" dir=in action=allow program="%NODEPFAD%" enable=yes profile=private
if errorlevel 1 (
  echo.
  echo   Die Regel konnte nicht angelegt werden.
  echo   Dann bitte von Hand: Windows-Taste+R, firewall.cpl, links
  echo   "Eine App ... zulassen", "Einstellungen aendern", "Andere App zulassen",
  echo   und dort %NODEPFAD% auswaehlen.
) else (
  echo.
  echo   FERTIG. Die Regel "KC MarktKasse (Node.js)" ist angelegt.
  echo   Jetzt KC_Markttag_Start.cmd starten und am Tablet den QR-Code scannen.
)
echo.
pause
