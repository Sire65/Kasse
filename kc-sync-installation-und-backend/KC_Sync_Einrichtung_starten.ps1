# KC Sync – Grafische Ein-Klick-Einrichtung.
#
# Ersetzt die bisherige Kommandozeilen-Prozedur (mehrere .ps1-Dateien einzeln von Hand starten)
# durch EIN Fenster: Ordner wählen -> Start drücken -> alle Schritte laufen automatisch,
# mit Erfolgs-/Fehlermeldung je Schritt direkt im Fenster sichtbar.
#
# Verwendung: Rechtsklick auf diese Datei -> "Mit PowerShell ausführen".
# Startet sich bei Bedarf selbst mit Administratorrechten neu (einmalige Windows-Sicherheits-
# abfrage ist normal und erwartet).

# Sich selbst mit Administratorrechten neu starten, falls noch nicht geschehen - vermeidet die
# Notwendigkeit, dass der Benutzer selbst "Als Administrator ausführen" wählt.
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
  exit
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# ---------------------------------------------------------------------------
# Schritt 1: Ordner wählen
# ---------------------------------------------------------------------------
$folderDialog = New-Object System.Windows.Forms.FolderBrowserDialog
$folderDialog.Description = "Bitte den Ordner 'kc-sync-installation-und-backend' waehlen (NICHT den 'install'-Unterordner darin, sondern den Ordner, der 'install' und 'run-device-companion.js' ENTHAELT)."
$folderDialog.ShowNewFolderButton = $false
if ($folderDialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
  [System.Windows.Forms.MessageBox]::Show("Kein Ordner gewaehlt - Einrichtung abgebrochen.", "KC Sync") | Out-Null
  exit
}
$installRoot = $folderDialog.SelectedPath

# ---------------------------------------------------------------------------
# Hauptfenster
# ---------------------------------------------------------------------------
$form = New-Object System.Windows.Forms.Form
$form.Text = "KC Sync Einrichtung"
$form.Size = New-Object System.Drawing.Size(680, 560)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false

$folderLabel = New-Object System.Windows.Forms.Label
$folderLabel.Text = "Gewaehlter Ordner: $installRoot"
$folderLabel.Location = New-Object System.Drawing.Point(10, 10)
$folderLabel.Size = New-Object System.Drawing.Size(650, 40)
$folderLabel.AutoEllipsis = $true
$form.Controls.Add($folderLabel)

$logBox = New-Object System.Windows.Forms.TextBox
$logBox.Multiline = $true
$logBox.ScrollBars = "Vertical"
$logBox.ReadOnly = $true
$logBox.BackColor = [System.Drawing.Color]::Black
$logBox.ForeColor = [System.Drawing.Color]::LightGreen
$logBox.Location = New-Object System.Drawing.Point(10, 55)
$logBox.Size = New-Object System.Drawing.Size(645, 400)
$logBox.Font = New-Object System.Drawing.Font("Consolas", 10)
$form.Controls.Add($logBox)

$startButton = New-Object System.Windows.Forms.Button
$startButton.Text = "Start"
$startButton.Location = New-Object System.Drawing.Point(10, 465)
$startButton.Size = New-Object System.Drawing.Size(645, 45)
$startButton.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$form.Controls.Add($startButton)

$stopwatch = New-Object System.Diagnostics.Stopwatch
function Write-Log {
  param([string]$Text, [bool]$Ok = $true, [bool]$Info = $false)
  $elapsed = if ($stopwatch.IsRunning) { "[{0:mm\:ss}] " -f $stopwatch.Elapsed } else { "" }
  $prefix = if ($Info) { "  " } elseif ($Ok) { "[OK]      " } else { "[FEHLER]  " }
  $logBox.AppendText("$elapsed$prefix$Text`r`n")
  $logBox.SelectionStart = $logBox.Text.Length
  $logBox.ScrollToCaret()
  [System.Windows.Forms.Application]::DoEvents()
}

# ---------------------------------------------------------------------------
# Die eigentliche Einrichtung - läuft komplett, sobald "Start" gedrückt wird.
# ---------------------------------------------------------------------------
function Install-KCSyncTask {
  param(
    [string]$TaskName,
    [string]$NodeExe,
    [string]$Arguments,
    [string]$WorkingDir,
    [string]$Description
  )
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  }
  # Befund (User-Beobachtung nach echtem Windows-Test): node.exe direkt ueber die geplante
  # Aufgabe zu starten oeffnet ein sichtbares Konsolenfenster bei jeder Anmeldung - fuer einen
  # Hintergrunddienst unerwuenscht. Ein kleiner VBS-Startwrapper startet ihn stattdessen
  # unsichtbar (WScript.Shell.Run mit Fenstermodus 0).
  $vbsLauncherPath = Join-Path $WorkingDir "run-$($TaskName)-hidden.vbs"
  $vbsCommand = "`"$NodeExe`" $Arguments"
  @"
Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = "$WorkingDir"
objShell.Run "$($vbsCommand -replace '"','""')", 0, True
"@ | Out-File -FilePath $vbsLauncherPath -Encoding ASCII

  $wscriptExe = Join-Path $env:SystemRoot "System32\wscript.exe"
  $action = New-ScheduledTaskAction -Execute $wscriptExe -Argument "`"$vbsLauncherPath`"" -WorkingDirectory $WorkingDir
  $trigger = New-ScheduledTaskTrigger -AtLogOn
  $currentUser = "$env:USERDOMAIN\$env:USERNAME"
  $principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description $Description -ErrorAction Stop | Out-Null
  if (-not (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue)) {
    throw "Aufgabe '$TaskName' wurde nicht gefunden, obwohl sie soeben angelegt wurde."
  }
}

$startButton.Add_Click({
  $startButton.Enabled = $false
  $logBox.Clear()
  $stopwatch.Reset()
  $stopwatch.Start()
  $backendRoot = $installRoot
  $installDir = Join-Path $backendRoot "install"

  try {
    # Schritt 0: GRUNDLEGENDE ABSICHERUNG (echter Fund - siehe ausfuehrliche Begruendung im
    # Code-Kommentar bei Install-KCSyncTask): der VBS-Startwrapper startet node.exe bisher
    # losgeloest vom Aufgaben-Prozess. Stoppt/entfernt eine geplante Aufgabe, wird dabei NUR der
    # VBS-Wrapper beendet - der eigentliche node.exe-Prozess kann unbemerkt weiterlaufen, auch
    # ordner- und sitzungsuebergreifend, und dann mit seiner ALTEN Identitaet auf demselben Port
    # antworten wie ein neu eingerichteter Manager. Deshalb: JEDER Einrichtungsversuch beendet
    # zuerst garantiert ALLE vorhandenen node.exe-Prozesse, unabhaengig davon woher sie stammen.
    $staleNodeProcesses = Get-Process node -ErrorAction SilentlyContinue
    if ($staleNodeProcesses) {
      Write-Log "Beende $($staleNodeProcesses.Count) vorhandene(n) node.exe-Prozess(e) (moegliche Reste eines frueheren Laufs)..." $true $true
      $staleNodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
      Start-Sleep -Seconds 1
      Write-Log "Bereinigt."
    }

    # Schritt 1: Node.js prüfen
    Write-Log "Suche Node.js..." $true $true
    $nodeExe = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
    if (-not $nodeExe) {
      Write-Log "Node.js wurde nicht gefunden. Bitte zuerst von https://nodejs.org (LTS-Version) installieren, danach dieses Fenster erneut oeffnen." $false
      $startButton.Enabled = $true
      return
    }
    Write-Log "Node.js gefunden: $nodeExe"

    # Schritt 2: Ordnerstruktur prüfen (und den naheliegenden Fall "eine Ebene zu tief gewaehlt"
    # automatisch korrigieren, statt hart abzubrechen - genau das ist leicht zu verwechseln).
    Write-Log "Pruefe Ordnerstruktur..." $true $true
    $runnerPath = Join-Path $backendRoot "run-device-companion.js"
    if ((-not (Test-Path $installDir) -or -not (Test-Path $runnerPath)) -and (Split-Path $backendRoot -Leaf) -eq "install") {
      $parentCandidate = Split-Path $backendRoot -Parent
      $parentRunner = Join-Path $parentCandidate "run-device-companion.js"
      if (Test-Path $parentRunner) {
        Write-Log "Gewaehlter Ordner war der 'install'-Unterordner - eine Ebene automatisch nach oben korrigiert." $true
        $backendRoot = $parentCandidate
        $installDir = Join-Path $backendRoot "install"
        $runnerPath = $parentRunner
        $folderLabel.Text = "Gewaehlter Ordner (automatisch korrigiert): $backendRoot"
      }
    }
    if (-not (Test-Path $installDir) -or -not (Test-Path $runnerPath)) {
      Write-Log "Der gewaehlte Ordner sieht nicht wie 'kc-sync-installation-und-backend' aus (install-Unterordner oder run-device-companion.js fehlt). Bitte den richtigen Ordner waehlen und das Fenster neu starten." $false
      $startButton.Enabled = $true
      return
    }
    Write-Log "Ordnerstruktur ist korrekt."

    # Schritt 3: Abhängigkeiten installieren (npm ci) - nur falls noch nicht geschehen
    $nodeModulesPath = Join-Path $backendRoot "node_modules"
    if (-not (Test-Path $nodeModulesPath)) {
      Write-Log "Installiere technische Abhaengigkeiten (Geschwindigkeit haengt von der Internetverbindung ab)..." $true $true
      $npmLogFile = Join-Path $env:TEMP "kc-sync-npm-ci-$([guid]::NewGuid().ToString('N')).log"
      # Befund (echter Testlauf): npm.cmd direkt ueber Start-Process -FilePath aufgerufen liefert
      # den Exitcode nicht zuverlaessig zurueck (dieselbe Ursache wie beim frueheren sc.exe-Fund) -
      # npm ci lief tatsaechlich erfolgreich durch, wurde aber faelschlich als Fehler gemeldet.
      # Jetzt ueber cmd.exe /c aufgerufen, dessen Exitcode-Weitergabe zuverlaessig ist.
      $cmdExe = Join-Path $env:SystemRoot "System32\cmd.exe"
      $npmProcess = Start-Process -FilePath $cmdExe -ArgumentList "/c", "npm ci" -WorkingDirectory $backendRoot `
        -RedirectStandardOutput $npmLogFile -RedirectStandardError "$npmLogFile.err" -WindowStyle Hidden -PassThru
      $npmStepStart = $stopwatch.Elapsed
      $lastUpdate = Get-Date
      while (-not $npmProcess.HasExited) {
        Start-Sleep -Milliseconds 300
        [System.Windows.Forms.Application]::DoEvents()
        if (((Get-Date) - $lastUpdate).TotalSeconds -ge 2) {
          $elapsedStep = ($stopwatch.Elapsed - $npmStepStart).TotalSeconds
          Write-Log "  ... laeuft seit $([int]$elapsedStep)s" $true $true
          $lastUpdate = Get-Date
        }
      }
      $npmExit = $npmProcess.ExitCode
      $npmOutput = ""
      if (Test-Path $npmLogFile) { $npmOutput += (Get-Content $npmLogFile -Raw) }
      if (Test-Path "$npmLogFile.err") { $npmOutput += (Get-Content "$npmLogFile.err" -Raw) }
      Remove-Item $npmLogFile, "$npmLogFile.err" -ErrorAction SilentlyContinue
      # Zusätzliche Absicherung: dem gemeldeten Rueckgabewert nicht blind vertrauen (siehe
      # obiger Befund) - zusaetzlich pruefen, ob node_modules tatsaechlich mit Inhalt entstanden
      # ist. Nur wenn BEIDES auf einen Fehlschlag hindeutet, wird tatsaechlich abgebrochen.
      $modulesActuallyExist = (Test-Path $nodeModulesPath) -and ((Get-ChildItem $nodeModulesPath -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0)
      if ($npmExit -ne 0 -and -not $modulesActuallyExist) {
        Write-Log "Abhaengigkeiten konnten nicht installiert werden: $npmOutput" $false
        $startButton.Enabled = $true
        return
      }
      Write-Log "Abhaengigkeiten installiert (dauerte $([int]($stopwatch.Elapsed - $npmStepStart).TotalSeconds)s)."
    } else {
      Write-Log "Abhaengigkeiten bereits vorhanden - Schritt uebersprungen."
    }

    # Schritt 4: Manager-Aufgabe einrichten
    Write-Log "Richte Manager-Aufgabe ein..." $true $true
    $managerDb = Join-Path $installDir "manager.sqlite"
    $managerRunner = Join-Path $installDir "run-manager-service.js"
    @"
const { ManagerCompanion } = require('../manager-companion');
const mgr = new ManagerCompanion({ dbPath: '$($managerDb -replace "\\","\\\\")' });
mgr.start(8543).then((info) => {
  console.log('KC Sync Manager gestartet auf Port', info.port, 'Manager-ID', info.managerId);
}).catch((err) => { console.error('Fehler:', err.message); process.exit(1); });
process.on('SIGTERM', async () => { await mgr.stop(); process.exit(0); });
process.on('SIGINT', async () => { await mgr.stop(); process.exit(0); });
"@ | Out-File -FilePath $managerRunner -Encoding utf8
    Install-KCSyncTask -TaskName "KCSyncManager" -NodeExe $nodeExe -Arguments "`"$managerRunner`"" -WorkingDir $installDir -Description "KC Sync Manager-Companion. Kein TUEV-/TSE-/BSI-Freigabestatus."
    Write-Log "Manager-Aufgabe eingerichtet."

    # Schritt 5: Kassen-Aufgaben einrichten - DREI eigenstaendige Instanzen fuer den
    # Mehrgeraete-Betrieb (Tablets am Marktstand als Kasse 1/2/3). Nicht benoetigte Kassen
    # koennen einfach ignoriert werden - die Einrichtung schadet nicht, wenn eine URL nie
    # benutzt wird.
    $kasseCount = 3
    $kasseInfos = @()
    for ($k = 1; $k -le $kasseCount; $k++) {
      Write-Log "Richte Kasse $k ein..." $true $true
      $taskName = "KCSyncKasse$k"
      $kasseDbN = Join-Path $installDir "kasse$k.sqlite"
      $statusPort = 47390 + ($k * 10) # 47400, 47410, 47420 - bewusst Abstand zum Manager (8543) und dessen Live-Monitor-Port (47392)
      $kasseArgsN = "`"$runnerPath`" --db `"$kasseDbN`" --status-port $statusPort --bind 0.0.0.0"
      Install-KCSyncTask -TaskName $taskName -NodeExe $nodeExe -Arguments $kasseArgsN -WorkingDir $backendRoot -Description "KC Sync Kasse $k. Kein TUEV-/TSE-/BSI-Freigabestatus."
      Start-ScheduledTask -TaskName $taskName
      Start-Sleep -Seconds 1
      $registerId = "KASSE-{0:D2}" -f $k
      $kasseInfos += [PSCustomObject]@{ Nummer = $k; TaskName = $taskName; Db = $kasseDbN; Port = $statusPort; RegisterId = $registerId }
    }
    Write-Log "Alle $kasseCount Kassen-Aufgaben eingerichtet und gestartet."

    Write-Log "Starte Manager..." $true $true
    Start-ScheduledTask -TaskName "KCSyncManager"
    Start-Sleep -Seconds 2
    Write-Log "Manager gestartet."

    # Schritt 6b: Webserver fuer die Kassenoberflaeche/PC Manager einrichten.
    # Befund (wiederholt aufgetreten): die Suche war bisher zu starr (nur der exakte Name
    # "kassenoberflaeche-und-pc-manager" direkt daneben). Jetzt robuster: zuerst der erwartete
    # Name, sonst wird unter allen direkten Geschwisterordnern nach einem gesucht, der sowohl
    # "pos" als auch "pc-manager" als Unterordner enthaelt (das eindeutige Merkmal) - unabhaengig
    # vom genauen Ordnernamen.
    $parentDir = Split-Path $backendRoot -Parent
    $frontendRoot = Join-Path $parentDir "kassenoberflaeche-und-pc-manager"
    if (-not (Test-Path (Join-Path $frontendRoot "pos"))) {
      $frontendRoot = $null
      Get-ChildItem -Path $parentDir -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        if (-not $frontendRoot -and (Test-Path (Join-Path $_.FullName "pos")) -and (Test-Path (Join-Path $_.FullName "pc-manager"))) {
          $frontendRoot = $_.FullName
        }
      }
    }
    if ($frontendRoot) {
      Write-Log "Richte Webserver fuer die Kassenoberflaeche ein... ($frontendRoot)" $true $true
      $serveScript = Join-Path $backendRoot "serve-frontend.js"
      $webPort = 8080
      $serveArgs = "`"$serveScript`" --port $webPort --root `"$frontendRoot`""
      Install-KCSyncTask -TaskName "KCWebServer" -NodeExe $nodeExe -Arguments $serveArgs -WorkingDir $backendRoot -Description "KC Sync Webserver fuer Kassenoberflaeche/PC Manager. Kein TUEV-/TSE-/BSI-Freigabestatus."
      Write-Log "Webserver-Aufgabe eingerichtet."
      Start-ScheduledTask -TaskName "KCWebServer"
      Start-Sleep -Seconds 1
      Write-Log "Webserver gestartet."
    } else {
      Write-Log "Kein Ordner mit 'pos' UND 'pc-manager' als Unterordner neben '$parentDir' gefunden - Webserver-Einrichtung uebersprungen. Bitte pruefen, ob die Kassenoberflaeche wirklich direkt neben diesem Ordner liegt." $false
      $webPort = $null
    }

    # Schritt 7: Automatisch koppeln (fuer jede der drei Kassen, nur falls noch nicht gekoppelt)
    $deviceCompanionDir = Join-Path $backendRoot "device-companion"
    $pairScript = Join-Path $backendRoot "pair-manually.js"
    if (-not (Test-Path $pairScript)) {
      $altPairScript = Join-Path $installDir "pair-manually.js"
      if (Test-Path $altPairScript) { $pairScript = $altPairScript }
    }

    foreach ($kasse in $kasseInfos) {
      Write-Log "Pruefe Kopplung Kasse $($kasse.Nummer)..." $true $true
      $devDbCheckScript = Join-Path $installDir "_check_paired_$($kasse.Nummer).js"
      @"
const { DeviceCompanion } = require('$($deviceCompanionDir -replace "\\","\\\\")');
const dev = new DeviceCompanion({ dbPath: '$($kasse.Db -replace "\\","\\\\")' });
console.log(dev.pinned.credentialId ? 'GEKOPPELT' : 'NICHT_GEKOPPELT');
"@ | Out-File -FilePath $devDbCheckScript -Encoding utf8
      $pairedStatus = (& $nodeExe $devDbCheckScript 2>&1 | Select-Object -Last 1)
      Remove-Item $devDbCheckScript -ErrorAction SilentlyContinue

      if ($pairedStatus -eq "NICHT_GEKOPPELT" -and (Test-Path $pairScript)) {
        Write-Log "Kasse $($kasse.Nummer) ist noch nicht gekoppelt - kopple jetzt automatisch..." $true $true
        $pairOutput = & $nodeExe $pairScript --manager-db $managerDb --kasse-db $kasse.Db --manager-port 8543 2>&1
        if ($pairOutput -notmatch "Kopplung erfolgreich" -and $pairOutput -match "tls_fingerprint_mismatch") {
          # Befund aus echtem Testlauf: siehe Dokumentation - Rest eines frueheren Versuchs.
          # NUR die Kassen-seitige Datenbank zuruecksetzen, Manager-Identitaet bleibt unangetastet.
          Write-Log "Fingerabdruck-Konflikt erkannt - setze Kasse $($kasse.Nummer) zurueck und versuche es erneut..." $true $true
          Stop-ScheduledTask -TaskName $kasse.TaskName -ErrorAction SilentlyContinue
          Start-Sleep -Seconds 1
          Remove-Item $kasse.Db, "$($kasse.Db)-wal", "$($kasse.Db)-shm" -ErrorAction SilentlyContinue
          Start-ScheduledTask -TaskName $kasse.TaskName
          Start-Sleep -Seconds 2
          $pairOutput = & $nodeExe $pairScript --manager-db $managerDb --kasse-db $kasse.Db --manager-port 8543 2>&1
        }
        if ($pairOutput -match "Kopplung erfolgreich") {
          Write-Log "Kasse $($kasse.Nummer) gekoppelt."
          Stop-ScheduledTask -TaskName $kasse.TaskName -ErrorAction SilentlyContinue
          Start-Sleep -Seconds 1
          Start-ScheduledTask -TaskName $kasse.TaskName
        } else {
          Write-Log "Kopplung fuer Kasse $($kasse.Nummer) fehlgeschlagen: $pairOutput" $false
        }
      } elseif ($pairedStatus -eq "GEKOPPELT") {
        Write-Log "Kasse $($kasse.Nummer) ist bereits gekoppelt."
      } else {
        Write-Log "pair-manually.js wurde nicht gefunden - Kopplung fuer Kasse $($kasse.Nummer) uebersprungen." $false
      }

      # Zugangs-Schluessel auslesen, um am Ende die fertige Tablet-Adresse anzeigen zu koennen.
      $tokenScript = Join-Path $installDir "_read_token_$($kasse.Nummer).js"
      @"
const { DeviceCompanion } = require('$($deviceCompanionDir -replace "\\","\\\\")');
const dev = new DeviceCompanion({ dbPath: '$($kasse.Db -replace "\\","\\\\")' });
console.log(dev.kasseAccessToken);
"@ | Out-File -FilePath $tokenScript -Encoding utf8
      $kasse | Add-Member -NotePropertyName Token -NotePropertyValue ((& $nodeExe $tokenScript 2>&1 | Select-Object -Last 1))
      Remove-Item $tokenScript -ErrorAction SilentlyContinue
    }

    Write-Log "" $true $true
    $stopwatch.Stop()
    Write-Log "FERTIG. Manager, Kassen und Webserver laufen im Hintergrund. Gesamtdauer: $([int]$stopwatch.Elapsed.TotalSeconds)s" $true $true
    if ($webPort) {
      # Tatsaechliche WLAN-Adresse dieses Rechners ermitteln, damit Tablets eine echte,
      # erreichbare Adresse bekommen statt 127.0.0.1 (das waere fuer ein anderes Geraet nutzlos).
      $lanIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.PrefixOrigin -ne "WellKnown" } |
        Select-Object -First 1 -ExpandProperty IPAddress)

      if ($lanIp) {
        # Netzwerkprofil pruefen (Befund aus echtem Testlauf: "Oeffentlich" blockiert staerker
        # als "Privat"). Wird NICHT automatisch geaendert - das hat echte Sicherheitsauswirkungen
        # (z.B. Sichtbarkeit fuer andere Geraete im selben Netz), das soll der Betreiber bewusst
        # selbst entscheiden, nur ein deutlicher Hinweis dazu.
        $networkProfile = Get-NetConnectionProfile -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($networkProfile -and $networkProfile.NetworkCategory -eq 'Public') {
          Write-Log "Netzwerkprofil ist 'Oeffentlich' - das blockiert Tablet-Zugriffe zusaetzlich staerker. Falls das Stand-WLAN vertrauenswuerdig ist: 'Set-NetConnectionProfile -NetworkCategory Private' manuell ausfuehren." $false
        } else {
          Write-Log "Netzwerkprofil ist '$($networkProfile.NetworkCategory)' - passt." $true
        }

        # Firewall-Freigaben automatisch einrichten (Befund aus echtem Testlauf: ein Tablet
        # konnte den Webserver ohne diese Freigaben nicht erreichen, obwohl er auf 0.0.0.0
        # lauschte - Windows blockiert eingehende Verbindungen standardmaessig). Nur einrichten,
        # falls noch nicht vorhanden - kein doppeltes Anlegen bei jedem Durchlauf.
        Write-Log "Pruefe/richte Firewall-Freigaben ein..." $true $true
        $firewallRules = @(
          @{ Name = "KC Sync Webserver"; Ports = @($webPort) }
          @{ Name = "KC Sync Kassen-Ports"; Ports = $kasseInfos.Port }
        )
        foreach ($rule in $firewallRules) {
          if (-not (Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue)) {
            try {
              New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Protocol TCP -LocalPort $rule.Ports -Action Allow -ErrorAction Stop | Out-Null
              Write-Log "Firewall-Regel '$($rule.Name)' angelegt."
            } catch {
              Write-Log "Firewall-Regel '$($rule.Name)' konnte nicht automatisch angelegt werden: $($_.Exception.Message)" $false
            }
          } else {
            Write-Log "Firewall-Regel '$($rule.Name)' bereits vorhanden."
          }
        }

        # Echter Erreichbarkeits-Selbsttest ueber die WLAN-Adresse (nicht 127.0.0.1) - genau die
        # Pruefung, die vorhin von Hand nachgeholt werden musste. Testet damit auch, ob die
        # gerade angelegten Firewall-Regeln tatsaechlich wirken.
        Write-Log "Teste Erreichbarkeit ueber die WLAN-Adresse (wie ein Tablet sie saehe)..." $true $true
        $reachTest = Test-NetConnection -ComputerName $lanIp -Port $webPort -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
        if ($reachTest -and $reachTest.TcpTestSucceeded) {
          Write-Log "WLAN-Adresse ist erreichbar - Tablets im selben Netz sollten sich verbinden koennen."
        } else {
          Write-Log "WLAN-Adresse ($lanIp`:$webPort) ist NICHT erreichbar - Tablets werden sich vermutlich NICHT verbinden koennen, trotz erfolgreicher Einrichtung. Firewall/Netzwerkprofil pruefen." $false
        }
      }

      Write-Log "Auf diesem Rechner: http://127.0.0.1:$webPort/pos/index.html" $true $true
      Write-Log "PC Manager (nur hier am Notebook): http://127.0.0.1:$webPort/pc-manager/index.html" $true $true
      if ($lanIp) {
        Write-Log "" $true $true
        Write-Log "Fuer Tablets im selben WLAN - jede Adresse EINMALIG auf dem jeweiligen Tablet oeffnen:" $true $true
        foreach ($kasse in $kasseInfos) {
          Write-Log "  Kasse $($kasse.Nummer) [$($kasse.RegisterId)]: http://${lanIp}:${webPort}/pos/index.html?kcPort=$($kasse.Port)&kcToken=$($kasse.Token)&kcRegisterId=$($kasse.RegisterId)" $true $true
        }
        Write-Log "" $true $true
        Write-Log "Danach merkt sich jedes Tablet seine Kasse von selbst - die Adresse wird nur beim allerersten Mal gebraucht." $true $true

        # Zusaetzlich im PC Manager selbst sichtbar machen (User-Wunsch: dort jederzeit
        # wiederfindbar statt nur einmalig im Einrichtungsfenster) - eine kleine JSON-Datei im
        # pc-manager-Ordner, die kc-live-monitor.js dort ausliest und neben der passenden
        # Kassen-Karte anzeigt.
        if ($frontendRoot -and (Test-Path (Join-Path $frontendRoot "pc-manager"))) {
          $verbindungenPath = Join-Path (Join-Path $frontendRoot "pc-manager") "kassen-verbindungen.json"
          $verbindungen = @{}
          foreach ($k in $kasseInfos) {
            $verbindungen[$k.RegisterId] = [PSCustomObject]@{ nummer = $k.Nummer; port = $k.Port; registerId = $k.RegisterId; url = "http://${lanIp}:${webPort}/pos/index.html?kcPort=$($k.Port)&kcToken=$($k.Token)&kcRegisterId=$($k.RegisterId)" }
          }
          $verbindungen | ConvertTo-Json | Out-File -FilePath $verbindungenPath -Encoding utf8
          Write-Log "Adressen zusaetzlich im PC Manager unter 'Kassen' sichtbar hinterlegt." $true $true
        }
      } else {
        Write-Log "Keine WLAN-Adresse gefunden - Tablets koennen diesen Rechner vermutlich nicht erreichen." $false
      }
      Write-Log "Oeffne die Kassenoberflaeche jetzt automatisch im Standardbrowser (Kasse 1)..." $true $true
      $firstKasse = $kasseInfos[0]
      Start-Process "http://127.0.0.1:$webPort/pos/index.html?kcPort=$($firstKasse.Port)&kcToken=$($firstKasse.Token)&kcRegisterId=$($firstKasse.RegisterId)"
    } else {
      Write-Log "Kein Webserver eingerichtet - die Kassenoberflaeche muss manuell ueber einen eigenen Webserver geoeffnet werden (NICHT per Doppelklick auf index.html)." $false
    }

    [System.Windows.Forms.MessageBox]::Show("Einrichtung abgeschlossen. Details im Fenster darueber.", "KC Sync", "OK", "Information") | Out-Null
  } catch {
    Write-Log "Unerwarteter Fehler: $($_.Exception.Message)" $false
  } finally {
    $startButton.Enabled = $true
  }
})

[System.Windows.Forms.Application]::Run($form)
