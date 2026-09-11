@echo off
title KC Sync - Marktag-Start
cd /d "%~dp0"

:: 10.09.2026 (Betreiber: "immer mit Adminrechten starten, nicht erst bei Bedarf nachfragen") -
:: bisher lief das Fenster zuerst OHNE Adminrechte und wechselte erst automatisch hoch, wenn ein
:: Port-Beenden-Versuch fehlschlug (siehe PORT_VERSUCH weiter unten) - das kostete bei jedem
:: Start Zeit UND ein zusaetzliches Windows-Bestaetigungsfenster mittendrin. Jetzt: sofort ganz
:: am Anfang pruefen und noetigenfalls gleich mit Adminrechten neu starten, bevor ueberhaupt
:: etwas anderes laeuft. Die spaetere Notfall-Weiche bleibt als Rueckfall bestehen (schadet
:: nicht, sollte ab jetzt aber praktisch nie mehr noetig sein).
net session >nul 2>nul
if errorlevel 1 (
  echo Starte mit Administratorrechten neu ...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs -WorkingDirectory '%~dp0'"
  exit /b 0
)

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

:: --------------------------------------------------------------------------------------
:: PORTS FREIRAEUMEN - robuster gemacht (09.09.2026, Betreiber: "wenn ich am Marktag nur
:: sowas nicht ans Laufen kriege, blamiere ich mich"). Ein einzelner Versuch mit fester
:: 3-Sekunden-Wartezeit reichte nicht, wenn Windows laenger braucht ODER der Prozess unter
:: einem anderen Benutzerkonto/mit anderen Rechten lief (taskkill ohne Adminrechte schlaegt
:: dann lautlos fehl, weil die Fehlerausgabe unterdrueckt wurde - genau das ist dem Betreiber
:: live passiert: derselbe Prozess blieb nach dem "erledigt" gemeldeten Versuch unveraendert
:: am Leben). Jetzt: bis zu 3 Versuche mit steigender Wartezeit, und bei einem hartnaeckigen
:: Fall wird automatisch angezeigt, WELCHES Programm aus WELCHEM Ordner den Port haelt
:: (spart das manuelle Nachschlagen), und bei fehlenden Rechten startet sich dieses Fenster
:: von selbst mit Administratorrechten neu, statt nur eine Anleitung zum Selbermachen zu zeigen.
:: Ports: 8090 Webserver, 8543 Manager (HTTPS), 47392 Manager-Live-Kanal, 47500-47509 Kassen.
:: --------------------------------------------------------------------------------------
setlocal EnableDelayedExpansion
set "PORTS=8090 8543 47392 47500 47501 47502 47503 47504 47505 47506 47507 47508 47509"
set "PFLICHTPORTS=8090 8543 47392"
set "UEBERSPRUNGEN="

:: Laeuft dieses Fenster schon mit Administratorrechten? (fuer den Notfall-Neustart weiter unten)
set "IST_ADMIN=0"
net session >nul 2>nul
if not errorlevel 1 set "IST_ADMIN=1"

set "VERSUCH=0"
:PORT_VERSUCH
set /a VERSUCH+=1
set "BEENDET=0"
for %%P in (%PORTS%) do (
  for /f "tokens=5" %%I in ('netstat -ano ^| findstr /R /C:":%%P  *0.0.0.0:0 " /C:":%%P  *\[::\]:0 "') do (
    if not "%%I"=="0" (
      for /f "tokens=1" %%N in ('tasklist /FI "PID eq %%I" /NH 2^>nul ^| findstr /V /B /C:"INFO"') do (
        set "NAME=%%N"
        if /I "!NAME!"=="node.exe" (
          echo.
          echo Port %%P wird von node.exe ^(PID %%I^) gehalten. Programmzeile:
          for /f "delims=" %%L in ('powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \"ProcessId=%%I\").CommandLine" 2^>nul') do echo   %%L
          choice /C JN /N /T 20 /D J /M "Automatisch beenden, damit die Kassen laufen koennen? (empfohlen: Ja - meist ein alter, nicht mehr gebrauchter KC-Prozess) [J/N], antwortet niemand: automatisch Ja nach 20s: "
          if errorlevel 2 (
            echo Auf Wunsch NICHT beendet - dieser Port bleibt belegt.
            set "UEBERSPRUNGEN=1"
          ) else (
            taskkill /PID %%I /F >nul 2>nul
            set "BEENDET=1"
          )
        ) else (
          echo ACHTUNG: Port %%P wird von !NAME! ^(PID %%I^) gehalten - kein node.exe, wird NICHT beendet.
        )
      )
    )
  )
)
if "!BEENDET!"=="1" (
  set /a WARTEZEIT=VERSUCH*3
  echo Alte KC-Prozesse beendet - warte !WARTEZEIT! Sekunden, bis Windows die Ports freigibt ...
  timeout /t !WARTEZEIT! /nobreak >nul
)
:: Nachpruefung: sind die Pflicht-Ports jetzt frei?
set "BELEGT="
for %%P in (%PFLICHTPORTS%) do (
  netstat -ano | findstr /R /C:":%%P  *0.0.0.0:0 " /C:":%%P  *\[::\]:0 " >nul 2>nul
  if not errorlevel 1 set "BELEGT=!BELEGT! %%P"
)
if not "!BELEGT!"=="" if "!UEBERSPRUNGEN!"=="" if !VERSUCH! lss 3 (
  echo Noch belegt:!BELEGT! - naechster Versuch ...
  goto PORT_VERSUCH
)
if not "!BELEGT!"=="" if not "!UEBERSPRUNGEN!"=="" (
  echo.
  echo Auf deinen Wunsch nicht beendet - diese Ports bleiben belegt:!BELEGT!
  echo Die Kassenfunktionen, die diesen Port brauchen, stehen dadurch nicht zur Verfuegung.
  echo Neu versuchen: dieses Fenster einfach nochmal starten.
  echo.
  pause
  exit /b 1
)
if not "!BELEGT!"=="" (
  echo.
  echo FEHLER: Diese Ports sind nach drei Versuchen weiterhin belegt:!BELEGT!
  echo.
  echo Das haelt jeweils folgendes Programm ^(automatisch nachgesehen^):
  for %%P in (!BELEGT!) do (
    for /f "tokens=5" %%I in ('netstat -ano ^| findstr /R /C:":%%P  *0.0.0.0:0 " /C:":%%P  *\[::\]:0 "') do (
      if not "%%I"=="0" (
        echo   Port %%P, PID %%I:
        powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=%%I').CommandLine" 2>nul
      )
    )
  )
  echo.
  if "!IST_ADMIN!"=="0" (
    echo Dieses Fenster laeuft OHNE Administratorrechte - das ist die haeufigste Ursache, wenn
    echo ein Beenden-Versuch nichts bewirkt. Es startet sich jetzt automatisch mit Administrator-
    echo rechten neu ^(Windows fragt kurz nach Bestaetigung^) und versucht es damit erneut.
    echo.
    pause
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b 0
  )
  echo Auch mit Administratorrechten liess sich der Port nicht freiraeumen. Vermutlich ein
  echo Programm aus einer ANDEREN, alten Installation ^(siehe Programmzeile oben - meist ein
  echo vergessener, im Hintergrund weiterlaufender Marktag-Start aus einem frueheren Ordner^).
  echo Von Hand beenden mit:   taskkill /PID ZAHL /F
  echo Hilft auch das nicht: den Rechner einmal neu starten - das raeumt jeden Port sicher auf.
  echo.
  pause
  exit /b 1
)
echo Ports frei: 8090, 8543, 47392 und Kassen-Ports.
endlocal

echo.
echo Starte KC Sync fuer den Markttag ...
echo Dieses Fenster bitte waehrend des gesamten Marktbetriebs GEOEFFNET lassen.
echo Zum Beenden: dieses Fenster schliessen oder Strg+C druecken.
echo.

node markttag-start.js

pause
