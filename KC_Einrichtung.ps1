param([string]$Ziel)
$ErrorActionPreference = 'Stop'
# KC MarktKasse - einmalige Einrichtung: portable Node.js nach <Ziel>\runtime, Zusatzmodule nach <Ziel>\node_modules.
# Beides bleibt bei Programm-Updates liegen (Updates tauschen nur <Ziel>\programm). Aufruf durch KC_Manager_Start.cmd.
# Windows PowerShell 5.1 (Windows 10): $PSScriptRoot statt Split-Path -LiteralPath; Meldungen nur ASCII.
$Hier = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$Hier = [System.IO.Path]::GetFullPath($Hier)
if (-not $Ziel) { $Ziel = $Hier }
$Ziel = [System.IO.Path]::GetFullPath($Ziel)
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

$NodeVersion = 'v22.22.3'
$Module = [ordered]@{ 'ws' = '8.21.1'; 'bonjour-service' = '1.4.3'; 'selfsigned' = '5.5.0' }
$Runtime = Join-Path $Ziel 'runtime'
$NodeExe = Join-Path $Runtime 'node.exe'
$NpmCmd = Join-Path $Runtime 'npm.cmd'
$ZielModule = Join-Path $Ziel 'node_modules'

function Fail([string]$Message) {
  Write-Host ''
  Write-Host ('FEHLER: ' + $Message) -ForegroundColor Red
  exit 1
}
function ModuleDa([string]$Ordner) {
  foreach ($m in $Module.Keys) { if (-not (Test-Path -LiteralPath (Join-Path $Ordner ($m + '\package.json')))) { return $false } }
  return $true
}

Write-Host '==============================================================' -ForegroundColor Cyan
Write-Host ' KC MARKTKASSE - EINMALIGE EINRICHTUNG' -ForegroundColor Cyan
Write-Host '==============================================================' -ForegroundColor Cyan
Write-Host ('Ordner: ' + $Ziel)

try { New-Item -ItemType Directory -Force -Path $Ziel | Out-Null } catch { Fail ('Ordner kann nicht angelegt werden: ' + $Ziel + ' (' + $_.Exception.Message + ')') }
# Schreibtest - ohne Schreibrecht nuetzt alles Weitere nichts
try { $t = Join-Path $Ziel '.kc_schreibtest'; Set-Content -LiteralPath $t -Value 'ok'; Remove-Item -LiteralPath $t -Force }
catch { Fail ('Keine Schreibrechte im Ordner ' + $Ziel + '. Loesung: als KC_Admin anmelden und dem Benutzer Vollzugriff auf den Ordner geben.') }

# --- 1) Node.js ------------------------------------------------------------
if (-not (Test-Path -LiteralPath $NodeExe)) {
  # Liegt schon eine Laufzeit im entpackten Ordner (alte Anordnung)? Dann kopieren statt laden.
  $vorhanden = Join-Path $Hier 'runtime\node.exe'
  if (($Hier -ne $Ziel) -and (Test-Path -LiteralPath $vorhanden)) {
    Write-Host 'Uebernehme vorhandene Node.js-Laufzeit ...' -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $Runtime | Out-Null
    Copy-Item -Path (Join-Path $Hier 'runtime\*') -Destination $Runtime -Recurse -Force
  }
}
if (-not (Test-Path -LiteralPath $NodeExe)) {
  # 64-Bit-Windows -> win-x64, ARM -> win-arm64, 32-Bit-Windows -> win-x86 (Node 22 gibt es noch fuer 32 Bit)
  $echteArch = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
  $arch = if ($echteArch -match 'ARM64') { 'win-arm64' } elseif ($echteArch -match 'AMD64|x64') { 'win-x64' } else { 'win-x86' }
  if ($arch -eq 'win-x86') {
    Write-Host 'Hinweis: 32-Bit-Windows erkannt. Die Kasse laeuft, aber Windows nutzt nur ca. 3,5 GB Arbeitsspeicher.' -ForegroundColor Yellow
  }
  $archiveName = "node-$NodeVersion-$arch.zip"
  $baseUrl = "https://nodejs.org/dist/$NodeVersion"
  $temp = Join-Path $env:TEMP ('kc-node-' + [guid]::NewGuid().ToString('N'))
  $zip = Join-Path $temp $archiveName
  $sums = Join-Path $temp 'SHASUMS256.txt'
  New-Item -ItemType Directory -Force -Path $temp | Out-Null
  try {
    Write-Host "Lade portable Node.js $NodeVersion ($arch, ca. 30 MB) ..." -ForegroundColor Yellow
    try {
      Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/$archiveName" -OutFile $zip
      Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/SHASUMS256.txt" -OutFile $sums
    } catch { Fail ('Download von nodejs.org nicht moeglich: ' + $_.Exception.Message + ' - Internetverbindung pruefen.') }
    $line = (Select-String -Path $sums -Pattern ([regex]::Escape($archiveName) + '$') | Select-Object -First 1).Line
    if (-not $line) { Fail 'SHA-256-Pruefsumme fuer Node-Paket nicht gefunden.' }
    $expected = ($line -split '\s+')[0].Trim().ToLowerInvariant()
    $actual = (Get-FileHash -Algorithm SHA256 -Path $zip).Hash.ToLowerInvariant()
    if ($expected -ne $actual) { Fail 'SHA-256-Pruefung des Node-Pakets fehlgeschlagen (Download beschaedigt) - bitte erneut starten.' }
    $extract = Join-Path $temp 'extract'
    Expand-Archive -Path $zip -DestinationPath $extract -Force
    $source = Get-ChildItem -Path $extract -Directory | Select-Object -First 1
    if (-not $source) { Fail 'Entpackte Node-Laufzeit wurde nicht gefunden.' }
    if (Test-Path -LiteralPath $Runtime) { Remove-Item -LiteralPath $Runtime -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $Runtime | Out-Null
    Copy-Item -Path (Join-Path $source.FullName '*') -Destination $Runtime -Recurse -Force
    Write-Host 'Portable Node.js wurde eingerichtet.' -ForegroundColor Green
  }
  finally { Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue }
}
if (-not (Test-Path -LiteralPath $NodeExe)) { Fail 'Portable node.exe fehlt nach der Einrichtung.' }

# --- 2) Zusatzmodule -----------------------------------------------------------
if (-not (ModuleDa $ZielModule)) {
  # Aus einer alten Installation uebernehmen (spart den Download)
  foreach ($alt in @((Join-Path $Hier 'markt-kasse-suite\backend-source\node_modules'), (Join-Path $Ziel 'markt-kasse-suite\backend-source\node_modules'))) {
    if ((-not (ModuleDa $ZielModule)) -and (ModuleDa $alt)) {
      Write-Host 'Uebernehme vorhandene Zusatzmodule ...' -ForegroundColor Yellow
      New-Item -ItemType Directory -Force -Path $ZielModule | Out-Null
      Copy-Item -Path (Join-Path $alt '*') -Destination $ZielModule -Recurse -Force
    }
  }
}
if (-not (ModuleDa $ZielModule)) {
  if (-not (Test-Path -LiteralPath $NpmCmd)) { Fail 'Portable npm.cmd fehlt - Ordner runtime loeschen und erneut starten.' }
  Write-Host 'Installiere KC-Zusatzmodule ...' -ForegroundColor Yellow
  $deps = ($Module.Keys | ForEach-Object { '"' + $_ + '": "' + $Module[$_] + '"' }) -join ', '
  $pkg = '{ "name": "kc-kasse-laufzeit", "private": true, "dependencies": { ' + $deps + ' } }'
  [System.IO.File]::WriteAllText((Join-Path $Ziel 'package.json'), $pkg)
  Push-Location -LiteralPath $Ziel
  try {
    $env:Path = $Runtime + ';' + $env:Path
    & $NpmCmd install --omit=dev --no-audit --no-fund --loglevel=error
    if ($LASTEXITCODE -ne 0) { Fail "npm install wurde mit Code $LASTEXITCODE beendet - Internetverbindung pruefen und erneut starten." }
  }
  finally { Pop-Location }
}
foreach ($m in $Module.Keys) {
  if (-not (Test-Path -LiteralPath (Join-Path $ZielModule ($m + '\package.json')))) { Fail "Laufzeitmodul fehlt: $m" }
}

$ok = "KC MarktKasse Einrichtung erfolgreich`r`nNode: $NodeVersion`r`nZeit: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`r`n"
[System.IO.File]::WriteAllText((Join-Path $Ziel '.kc_setup_ok'), $ok)
Write-Host ''
Write-Host 'Einrichtung vollstaendig.' -ForegroundColor Green
exit 0
