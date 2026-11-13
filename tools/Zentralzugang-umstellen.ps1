Add-Type -AssemblyName System.Windows.Forms
$taskPicker = New-Object System.Windows.Forms.OpenFileDialog
$taskPicker.Title = 'Neue KC-Zugangsdatei auswählen'
$taskPicker.Filter = 'KC-Zugangsdatei (*.json)|*.json'
if ($taskPicker.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit }
$taskNode = Get-Command node -ErrorAction SilentlyContinue
if (-not $taskNode) { [System.Windows.Forms.MessageBox]::Show('Node aus der Manager-Installation fehlt. Der bisherige Zugang bleibt erhalten.'); exit 1 }
& $taskNode.Source (Join-Path $PSScriptRoot 'zentral-zugang-umstellen.cjs') $taskPicker.FileName
if ($LASTEXITCODE -eq 0) { [System.Windows.Forms.MessageBox]::Show('Bitte die Meldung prüfen, danach den Manager-Companion neu starten und einen normalen Abgleich prüfen. Die zentrale Übersicht muss diesen PC bestätigen.') }
else { [System.Windows.Forms.MessageBox]::Show('Nicht bestätigt. Bitte Verbindung und Zugangsdatei prüfen. Keinen Schlüssel ins Chatfenster kopieren.') }
