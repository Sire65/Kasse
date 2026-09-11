# KC Sync – Autostart-Einrichtung für den Kassen-Companion (device-companion).
#
# WICHTIG (grundlegende Korrektur nach echtem Windows-Testlauf, siehe install-manager-service.ps1
# für die ausführliche Begründung): ein normales Node.js-Programm ist technisch KEIN Windows-
# Dienst - Windows erwartet von einem Dienst ein spezielles Rückmeldeprotokoll, das node.exe
# nicht spricht. Statt eines Windows-Diensts wird deshalb eine GEPLANTE AUFGABE eingerichtet,
# die bei Anmeldung des Benutzers einen ganz normalen Hintergrundprozess startet - unter dessen
# eigenem Konto, nicht SYSTEM (SYSTEM sieht keine benutzereigenen Netzlaufwerkszuordnungen).
#
# Verwendung (als Administrator ausführen):
#   .\install-kasse-service.ps1 -DatabasePath "C:\ProgramData\KCSync\kasse.sqlite"

param(
  [string]$DatabasePath = "$PSScriptRoot\kasse.sqlite",
  [string]$TaskName = "KCSyncKasse",
  [int]$StatusPort = 47391
)

$ErrorActionPreference = "Stop"
$nodeExe = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $nodeExe) { throw "node.exe wurde nicht im PATH gefunden - Node.js muss vor der Einrichtung installiert sein." }

$scriptDir = $PSScriptRoot
$runnerPath = Join-Path (Split-Path $scriptDir -Parent) "run-device-companion.js"
if (-not (Test-Path $runnerPath)) { throw "run-device-companion.js wurde nicht im Projektverzeichnis gefunden: $runnerPath" }

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Write-Host "Geplante Aufgabe '$TaskName' existiert bereits - wird zunaechst entfernt (kontrolliertes Update)."
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$taskArgs = "`"$runnerPath`" --db `"$DatabasePath`" --status-port $StatusPort"

# Befund (echter Windows-Test, User-Beobachtung): siehe install-manager-service.ps1 für die
# ausführliche Begründung - node.exe direkt zeigt ein sichtbares Konsolenfenster, ein kleiner
# VBS-Startwrapper startet es stattdessen unsichtbar.
$vbsLauncherPath = Join-Path $scriptDir "run-kasse-hidden.vbs"
$vbsCommand = "`"$nodeExe`" $taskArgs"
@"
Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = "$scriptDir"
objShell.Run "$($vbsCommand -replace '"','""')", 0, True
"@ | Out-File -FilePath $vbsLauncherPath -Encoding ASCII

$wscriptExe = Join-Path $env:SystemRoot "System32\wscript.exe"
$action = New-ScheduledTaskAction -Execute $wscriptExe -Argument "`"$vbsLauncherPath`"" -WorkingDirectory $scriptDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$currentUser = "$env:USERDOMAIN\$env:USERNAME"
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)

try {
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "KC Sync Kassen-Companion - lokaler Synchronisationsdienst dieser Kasse. Kein TUEV-/TSE-/BSI-Freigabestatus." -ErrorAction Stop | Out-Null
} catch {
  throw "Geplante Aufgabe '$TaskName' konnte nicht angelegt werden: $($_.Exception.Message)"
}

if (-not (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue)) {
  throw "Geplante Aufgabe '$TaskName' wurde angelegt, ist aber unmittelbar danach nicht mehr auffindbar - unerwarteter Zustand."
}

Write-Host "Geplante Aufgabe '$TaskName' eingerichtet und verifiziert."
Write-Host "Startet automatisch bei jeder Anmeldung dieses Benutzerkontos. Zum sofortigen Testen jetzt manuell starten mit:"
Write-Host "  Start-ScheduledTask -TaskName $TaskName"
Write-Host "Status pruefen mit:"
Write-Host "  Get-ScheduledTask -TaskName $TaskName"
Write-Host "  Get-ScheduledTaskInfo -TaskName $TaskName"
Write-Host "Status danach abfragbar unter: http://127.0.0.1:$StatusPort/kc-sync-status"
Write-Host "WICHTIG: Auf diesem Weg noch NICHT auf echtem Windows verifiziert - vor dem Praxiseinsatz testen."
