@echo off
setlocal EnableExtensions DisableDelayedExpansion
title KC MarktKasse
rem ==========================================================================
rem  KC MarktKasse - Start am Stand (Mini-PC).  Zu Hause: KC_Zuhause_Start.cmd
rem  Installiert beim ersten Mal nach C:\KC-Kasse, holt danach bei jedem Start
rem  nur geaenderte Dateien (Node.js und Module bleiben liegen).
rem  REGELN fuer diese Datei: Pfade nie in ( ... )-Bloecken (Klammern im
rem  Ordnernamen), Programmaufrufe immer als EINE Zeile mit "& exit /b"
rem  (diese Datei kann waehrend des Laufs erneuert werden).
rem ==========================================================================
set "KC_MODUS=stand"
if /i "%~1"=="--zuhause" set "KC_MODUS=zuhause"
if /i "%~1"=="--zuhause" shift
for %%I in ("%~dp0.") do set "KC_HIER=%%~fI"
if not defined KC_ZIEL set "KC_ZIEL=C:\KC-Kasse"

rem --- 1) Aus der ZIP heraus oder aus einem Temp-Ordner gestartet? ---------
set "KC_T=%KC_HIER%\"
if not "%KC_T:.zip\=%"=="%KC_T%" goto AUS_ZIP
if not "%KC_HIER:\Temp1_=%"=="%KC_HIER%" goto AUS_ZIP
if not "%KC_HIER:\AppData\Local\Temp=%"=="%KC_HIER%" goto AUS_ZIP
rem --- 2) Kopie im Autostart-Ordner? ----------------------------------------
if not "%KC_HIER:\Start Menu\Programs\Startup=%"=="%KC_HIER%" goto AUTOSTART_KOPIE

rem --- 3) Installierter Ordner (C:\KC-Kasse mit programm\aktuell)? ----------
if exist "%KC_HIER%\programm\aktuell\markt-kasse-suite\backend-source\run-manager-service.js" goto INSTALLIERT
if exist "%KC_HIER%\programm\vorher\markt-kasse-suite\backend-source\run-manager-service.js" goto INSTALLIERT
rem --- 4) Entpackte ZIP (oder alte Anordnung) -> installieren ----------------
if exist "%KC_HIER%\markt-kasse-suite\backend-source\run-manager-service.js" goto AUS_QUELLE
rem --- 5) Kleine Installations-ZIP (nur Starter) -> Programm aus dem Internet laden
if exist "%KC_HIER%\starter\kc-starter.js" goto AUS_QUELLE
goto UNVOLLSTAENDIG

:INSTALLIERT
set "KC_ZIEL=%KC_HIER%"
if not exist "%KC_ZIEL%\runtime\node.exe" goto EINRICHTEN_INSTALLIERT
if not exist "%KC_ZIEL%\node_modules\ws\package.json" goto EINRICHTEN_INSTALLIERT
if not exist "%KC_ZIEL%\starter\kc-starter.js" goto STARTER_FEHLT
"%KC_ZIEL%\runtime\node.exe" "%KC_ZIEL%\starter\kc-starter.js" start --modus %KC_MODUS% %1 %2 %3 %4 & exit /b

:EINRICHTEN_INSTALLIERT
set "KC_PS1=%KC_ZIEL%\KC_Einrichtung.ps1"
if not exist "%KC_PS1%" set "KC_PS1=%KC_ZIEL%\programm\aktuell\KC_Einrichtung.ps1"
if not exist "%KC_PS1%" goto STARTER_FEHLT
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%KC_PS1%" -Ziel "%KC_ZIEL%"
if errorlevel 1 goto EINRICHTUNG_FEHLER
"%KC_ZIEL%\runtime\node.exe" "%KC_ZIEL%\starter\kc-starter.js" start --modus %KC_MODUS% %1 %2 %3 %4 & exit /b

:AUS_QUELLE
rem Ist dies selbst C:\KC-Kasse (alte Anordnung oder ZIP dorthin entpackt), wird an Ort und Stelle umgebaut.
if /i "%KC_HIER%"=="%KC_ZIEL%" goto QUELLE_PRUEFEN
echo.
echo ==============================================================
echo  KC MARKTKASSE - INSTALLATION
echo ==============================================================
echo  Das Programm wird nach %KC_ZIEL% installiert.
echo  Dafuer wird Internet gebraucht (ca. 80 MB, nur beim ersten Mal).
echo  Daten (Kassen, Buchungen, Einstellungen) bleiben erhalten.
echo  Danach diesen entpackten Ordner nicht mehr benutzen - immer
echo  ueber die Verknuepfung "KC Kasse starten" auf dem Desktop.
echo ==============================================================
:QUELLE_PRUEFEN
if not exist "%KC_HIER%\starter\kc-starter.js" goto UNVOLLSTAENDIG
if not exist "%KC_HIER%\KC_Einrichtung.ps1" goto UNVOLLSTAENDIG
if not exist "%KC_ZIEL%" mkdir "%KC_ZIEL%" 2>nul
if not exist "%KC_ZIEL%" goto ZIEL_FEHLER
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%KC_HIER%\KC_Einrichtung.ps1" -Ziel "%KC_ZIEL%"
if errorlevel 1 goto EINRICHTUNG_FEHLER
"%KC_ZIEL%\runtime\node.exe" "%KC_HIER%\starter\kc-starter.js" installieren --quelle "%KC_HIER%" --ziel "%KC_ZIEL%" --modus %KC_MODUS%
if errorlevel 1 goto INSTALL_FEHLER
"%KC_ZIEL%\runtime\node.exe" "%KC_ZIEL%\starter\kc-starter.js" start --modus %KC_MODUS% --ohne-update %1 %2 %3 %4 & exit /b

:AUS_ZIP
echo.
echo ==============================================================
echo  BITTE ZUERST ENTPACKEN
echo ==============================================================
echo  Diese Datei wurde direkt aus der ZIP-Datei (oder aus einem
echo  Temp-Ordner) gestartet. So fehlen alle anderen Programmdateien.
echo.
echo  Loesung:
echo   1. Dieses Fenster schliessen.
echo   2. Rechtsklick auf die ZIP-Datei - "Alle extrahieren..." - "Extrahieren".
echo   3. Im entpackten Ordner KC_Manager_Start.cmd doppelklicken.
echo      Das Programm installiert sich dann selbst nach C:\KC-Kasse.
echo ==============================================================
echo.
pause
exit /b 1

:AUTOSTART_KOPIE
rem Eine KOPIE dieser Datei liegt im Autostart. Ist das Programm installiert, einfach von dort starten -
rem der Starter ersetzt die Kopie dabei durch eine richtige Verknuepfung.
if exist "C:\KC-Kasse\KC_Manager_Start.cmd" if exist "C:\KC-Kasse\starter\kc-starter.js" call "C:\KC-Kasse\KC_Manager_Start.cmd" %1 %2 %3 %4 & exit /b
echo.
echo ==============================================================
echo  FALSCHE DATEI IM AUTOSTART
echo ==============================================================
echo  Im Autostart-Ordner liegt eine KOPIE von KC_Manager_Start.cmd.
echo  Dort muss eine VERKNUEPFUNG liegen.
echo.
echo  Loesung:
echo   1. Windows-Taste + R, shell:startup eingeben, Enter.
echo   2. Die Datei KC_Manager_Start (Typ: Windows-Befehlsskript) loeschen.
echo   3. Im entpackten KC-Ordner KC_Manager_Start.cmd doppelklicken -
echo      die Installation legt die Verknuepfung selbst richtig an.
echo ==============================================================
echo.
pause
exit /b 1

:UNVOLLSTAENDIG
echo.
echo ==============================================================
echo  PROGRAMMDATEIEN FEHLEN
echo ==============================================================
echo  Ordner: %KC_HIER%
echo  Hier fehlen Teile des Programms (markt-kasse-suite, starter).
echo.
echo  Loesung: Die ZIP-Datei neu herunterladen, mit Rechtsklick -
echo  "Alle extrahieren..." VOLLSTAENDIG entpacken und dort
echo  KC_Manager_Start.cmd doppelklicken.
echo ==============================================================
echo.
pause
exit /b 1

:STARTER_FEHLT
echo.
echo FEHLER: Im Ordner %KC_ZIEL% fehlt der Starter oder die Einrichtung.
echo Loesung: Die ZIP neu herunterladen, entpacken und dort KC_Manager_Start.cmd
echo          doppelklicken - die Installation repariert den Ordner (Daten bleiben).
echo.
pause
exit /b 1

:ZIEL_FEHLER
echo.
echo FEHLER: Der Ordner %KC_ZIEL% kann nicht angelegt werden.
echo Loesung: Einmal als Administrator (KC_Admin) anmelden, im Explorer C:\KC-Kasse
echo          anlegen und dem Benutzer KC-Team Vollzugriff geben. Dann erneut starten.
echo.
pause
exit /b 1

:EINRICHTUNG_FEHLER
echo.
echo Die Einrichtung (Node.js und Zusatzmodule) war nicht erfolgreich.
echo Die Ursache steht oben in roter Schrift.
echo Loesung: Internetverbindung pruefen und diese Datei erneut starten.
echo.
pause
exit /b 1

:INSTALL_FEHLER
echo.
echo Die Installation war nicht erfolgreich - Ursache steht oben im Kasten.
echo Loesung: Fenster schliessen, ZIP neu entpacken und erneut starten.
echo Bleibt der Fehler: Foto von diesem Fenster an den Betreuer schicken.
echo.
pause
exit /b 1
