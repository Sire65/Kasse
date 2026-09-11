# KC Sync – Autostart-Einrichtung für den Manager-Companion (bei Windows-Anmeldung/-Start).
#
# WICHTIG (grundlegende Korrektur nach echtem Windows-Testlauf): die vorherigen Fassungen dieses
# Skripts versuchten, den Manager als echten WINDOWS-DIENST einzutragen (sc.exe create bzw.
# New-Service). Das ANLEGEN klappte zuletzt, das STARTEN aber nicht - mit einem generischen
# "kann nicht gestartet werden". Grund, der sich erst beim echten Testlauf zeigte: ein normales
# Node.js-Programm ist technisch KEIN Windows-Dienst. Windows erwartet von einem Dienst ein
# spezielles Rückmeldeprotokoll (den Dienststeuerungs-Handshake über die Win32-Dienst-API) -
# node.exe spricht dieses Protokoll nicht, egal wie korrekt es eingetragen ist. Windows wartet
# dann vergeblich auf diese Rückmeldung und meldet einen Startfehler.
#
# Die korrekte, weiterhin ohne Fremdsoftware auskommende Lösung: eine GEPLANTE AUFGABE
# (Task Scheduler), die bei Anmeldung des Benutzers einen ganz normalen Hintergrundprozess
# startet - keine
# Dienststeuerungs-Rückmeldung nötig, Windows startet den Prozess einfach und überwacht ihn.
#
# Zweiter Befund aus demselben Testlauf: die Aufgabe darf NICHT unter dem SYSTEM-Konto laufen,
# wenn der Installationsordner auf einem für den angemeldeten Benutzer eingerichteten
# Netzlaufwerk liegt (z. B. L:\) - SYSTEM sieht solche Laufwerkszuordnungen grundsätzlich nicht,
# der Prozess würde sofort mit einem Pfadfehler abbrechen. Die Aufgabe läuft deshalb unter dem
# tatsächlich installierenden Benutzerkonto und startet bei dessen Anmeldung.
#
# Verwendung (als Administrator ausführen):
#   .\install-manager-service.ps1 -DatabasePath "C:\ProgramData\KCSync\manager.sqlite"

param(
  [string]$DatabasePath = "$PSScriptRoot\manager.sqlite",
  [string]$TaskName = "KCSyncManager",
  [int]$Port = 8543
)

$ErrorActionPreference = "Stop"
$nodeExe = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $nodeExe) { throw "node.exe wurde nicht im PATH gefunden - Node.js muss vor der Einrichtung installiert sein." }

$scriptDir = $PSScriptRoot
$runnerPath = Join-Path $scriptDir "run-manager-service.js"

@"
const { ManagerCompanion } = require('../manager-companion');
const mgr = new ManagerCompanion({ dbPath: '$($DatabasePath -replace "\\","\\\\")' });
mgr.start($Port).then((info) => {
  console.log('KC Sync Manager gestartet auf Port', info.port, 'Manager-ID', info.managerId);
}).catch((err) => {
  console.error('KC Sync Manager konnte nicht gestartet werden:', err.message);
  process.exit(1);
});
process.on('SIGTERM', async () => { await mgr.stop(); process.exit(0); });
process.on('SIGINT', async () => { await mgr.stop(); process.exit(0); });
"@ | Out-File -FilePath $runnerPath -Encoding utf8

# Befund (echter Windows-Test, User-Beobachtung nach automatischem Start bei Anmeldung): node.exe
# direkt über die geplante Aufgabe zu starten öffnet ein sichtbares Konsolenfenster - für einen
# Hintergrunddienst unerwünscht. Ein kleiner VBS-Startwrapper (WScript.Shell.Run mit Fenstermodus
# 0 = unsichtbar) ist das seit Jahren übliche, zuverlässige Windows-Verfahren dafür - deutlich
# robuster als PowerShell-eigene "-WindowStyle Hidden"-Versuche, die node.exe als Konsolen-
# anwendung nicht zuverlässig unterdrücken.
$vbsLauncherPath = Join-Path $scriptDir "run-manager-hidden.vbs"
$vbsCommand = "`"$nodeExe`" `"$runnerPath`""
@"
Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = "$scriptDir"
objShell.Run "$($vbsCommand -replace '"','""')", 0, True
"@ | Out-File -FilePath $vbsLauncherPath -Encoding ASCII

# Vorhandene gleichnamige Aufgabe entfernen (kontrolliertes Update), falls bereits eingerichtet.
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Write-Host "Geplante Aufgabe '$TaskName' existiert bereits - wird zunaechst entfernt (kontrolliertes Update)."
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Register-ScheduledTask ist wie New-Service ein eingebauter PowerShell-Befehl, kein externes
# Programm - $runnerPath wird als normaler Parameterwert uebergeben, keine
# Kommandozeilen-Rekonstruktion, keine Anfuehrungszeichen-Probleme.
$wscriptExe = Join-Path $env:SystemRoot "System32\wscript.exe"
$action = New-ScheduledTaskAction -Execute $wscriptExe -Argument "`"$vbsLauncherPath`"" -WorkingDirectory $scriptDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$currentUser = "$env:USERDOMAIN\$env:USERNAME"
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)

try {
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "KC Sync Manager-Companion - lokaler Synchronisationsdienst fuer die Kassen. Kein TUEV-/TSE-/BSI-Freigabestatus." -ErrorAction Stop | Out-Null
} catch {
  throw "Geplante Aufgabe '$TaskName' konnte nicht angelegt werden: $($_.Exception.Message)"
}

# Fail-closed statt stillem Fehlschlag: tatsaechlich pruefen, ob die Aufgabe jetzt existiert.
if (-not (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue)) {
  throw "Geplante Aufgabe '$TaskName' wurde angelegt, ist aber unmittelbar danach nicht mehr auffindbar - unerwarteter Zustand."
}

Write-Host "Geplante Aufgabe '$TaskName' eingerichtet und verifiziert."
Write-Host "Startet automatisch bei jeder Anmeldung dieses Benutzerkontos. Zum sofortigen Testen jetzt manuell starten mit:"
Write-Host "  Start-ScheduledTask -TaskName $TaskName"
Write-Host "Status pruefen mit:"
Write-Host "  Get-ScheduledTask -TaskName $TaskName"
Write-Host "  Get-ScheduledTaskInfo -TaskName $TaskName"
Write-Host "WICHTIG: Auf diesem Weg noch NICHT auf echtem Windows verifiziert - vor dem Praxiseinsatz testen."
