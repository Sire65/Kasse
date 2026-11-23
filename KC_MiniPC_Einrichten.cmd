@echo off
rem KC MarktKasse - Mini-PC am Stand einmalig einrichten (KS-05). Keine Adminrechte noetig.
rem Windows-Hintergrund = Rathaus-Bild der Praesentation (KC-TV-HINTERGRUND, tools\kc-tv-hintergrund.ps1).
rem Bildschirm und PC gehen nie in den Ruhezustand, keine Benachrichtigungen/Bildschirmschoner
rem ueber der Praesentation. Rueckgaengig: siehe TABLET_UND_MANAGER_KOPPELN.md, Abschnitt G.
title KC MarktKasse - Mini-PC einrichten
echo.
echo ==============================================================
echo  KC MARKTKASSE - MINI-PC AM STAND EINRICHTEN
echo ==============================================================
echo.
set "KC_FEHLER=0"
powercfg /change monitor-timeout-ac 0 || set "KC_FEHLER=1"
powercfg /change standby-timeout-ac 0 || set "KC_FEHLER=1"
powercfg /change hibernate-timeout-ac 0 || set "KC_FEHLER=1"
echo [1/4] Bildschirm und Standby: nie ausschalten (am Netzteil).
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\PushNotifications" /v ToastEnabled /t REG_DWORD /d 0 /f >nul || set "KC_FEHLER=1"
echo [2/4] Windows-Benachrichtigungen: aus.
reg add "HKCU\Control Panel\Desktop" /v ScreenSaveActive /t REG_SZ /d 0 /f >nul || set "KC_FEHLER=1"
echo [3/4] Bildschirmschoner: aus.
set "KC_HG=%~dp0programm\aktuell\tools\kc-tv-hintergrund.ps1"
if not exist "%KC_HG%" set "KC_HG=%~dp0tools\kc-tv-hintergrund.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "%KC_HG%" || set "KC_FEHLER=1"
echo [4/4] Windows-Hintergrund: Rathaus Werne im Weihnachtsmarkt-Licht (wie in der Praesentation).
echo.
if "%KC_FEHLER%"=="1" (
  echo ACHTUNG: Nicht alles konnte eingestellt werden.
  echo Loesung: Einstellungen - System - Bildschirm und Energie von Hand auf "Nie" stellen,
  echo          Einstellungen - Personalisierung - Hintergrund: Bild aus media\backgrounds waehlen,
  echo          Einstellungen - System - Benachrichtigungen ausschalten.
) else (
  echo Fertig.
)
echo.
echo Noch von Hand (einmalig):
echo  - Windows-Taste + P: "Erweitern", wenn ein zweiter Monitor angeschlossen ist.
echo  - Einstellungen - System - Bildschirm: den MONITOR als Hauptanzeige festlegen,
echo    dann laeuft die Praesentation automatisch auf dem Fernseher.
echo  - Einstellungen - Windows Update - Nutzungszeit: 8 bis 23 Uhr (kein Neustart am Markttag).
echo  - Autostart: legt KC_Manager_Start.cmd beim ersten Start selbst an (Verknuepfung).
echo.
pause
