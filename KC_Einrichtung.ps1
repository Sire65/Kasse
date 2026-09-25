$ErrorActionPreference = 'Stop'
$Root = Split-Path -LiteralPath $MyInvocation.MyCommand.Path -Parent
$Root = [System.IO.Path]::GetFullPath($Root)
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$NodeVersion = 'v22.22.3'
$Backend = Join-Path $Root 'markt-kasse-suite\backend-source'
$Runtime = Join-Path $Root 'runtime'
$NodeExe = Join-Path $Runtime 'node.exe'
$NpmCmd = Join-Path $Runtime 'npm.cmd'

function Fail([string]$Message) {
  Write-Host ''
  Write-Host ('FEHLER: ' + $Message) -ForegroundColor Red
  exit 1
}

Write-Host '==============================================================' -ForegroundColor Cyan
Write-Host ' KC MARKTKASSE - EINMALIGE EINRICHTUNG' -ForegroundColor Cyan
Write-Host '==============================================================' -ForegroundColor Cyan

if (-not (Test-Path -LiteralPath $Backend)) {
  Fail "Backend-Ordner fehlt: $Backend"
}

if (-not (Test-Path -LiteralPath $NodeExe)) {
  $arch = if ($env:PROCESSOR_ARCHITECTURE -match 'ARM64') { 'win-arm64' } else { 'win-x64' }
  $archiveName = "node-$NodeVersion-$arch.zip"
  $baseUrl = "https://nodejs.org/dist/$NodeVersion"
  $temp = Join-Path $env:TEMP ("kc-node-" + [guid]::NewGuid().ToString('N'))
  $zip = Join-Path $temp $archiveName
  $sums = Join-Path $temp 'SHASUMS256.txt'

  New-Item -ItemType Directory -Force -Path $temp | Out-Null
  try {
    Write-Host "Lade portable Node.js $NodeVersion ($arch) ..." -ForegroundColor Yellow
    Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/$archiveName" -OutFile $zip
    Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/SHASUMS256.txt" -OutFile $sums

    $line = (Select-String -Path $sums -Pattern ([regex]::Escape($archiveName) + '$') | Select-Object -First 1).Line
    if (-not $line) { Fail 'SHA-256-Prüfsumme für Node-Paket nicht gefunden.' }
    $expected = ($line -split '\s+')[0].Trim().ToLowerInvariant()
    $actual = (Get-FileHash -Algorithm SHA256 -Path $zip).Hash.ToLowerInvariant()
    if ($expected -ne $actual) { Fail 'SHA-256-Prüfung des Node-Pakets fehlgeschlagen.' }

    $extract = Join-Path $temp 'extract'
    Expand-Archive -Path $zip -DestinationPath $extract -Force
    $source = Get-ChildItem -Path $extract -Directory | Select-Object -First 1
    if (-not $source) { Fail 'Entpackte Node-Laufzeit wurde nicht gefunden.' }

    if (Test-Path -LiteralPath $Runtime) { Remove-Item -Recurse -Force $Runtime }
    New-Item -ItemType Directory -Force -Path $Runtime | Out-Null
    Copy-Item -Path (Join-Path $source.FullName '*') -Destination $Runtime -Recurse -Force
    Write-Host 'Portable Node.js wurde eingerichtet.' -ForegroundColor Green
  }
  finally {
    Remove-Item -Recurse -Force $temp -ErrorAction SilentlyContinue
  }
}

if (-not (Test-Path -LiteralPath $NodeExe)) {
  Fail 'Portable node.exe fehlt nach der Einrichtung.'
}
if (-not (Test-Path -LiteralPath $NpmCmd)) {
  Fail 'Portable npm.cmd fehlt nach der Einrichtung.'
}

$needsModules =
  -not (Test-Path (Join-Path $Backend 'node_modules\ws')) -or
  -not (Test-Path (Join-Path $Backend 'node_modules\bonjour-service')) -or
  -not (Test-Path (Join-Path $Backend 'node_modules\selfsigned'))

if ($needsModules) {
  Write-Host 'Installiere KC-Laufzeitmodule ...' -ForegroundColor Yellow
  Push-Location $Backend
  try {
    & $NpmCmd install --omit=dev --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Fail "npm install wurde mit Code $LASTEXITCODE beendet." }
  }
  finally {
    Pop-Location
  }
}

foreach ($required in @('ws','bonjour-service','selfsigned')) {
  if (-not (Test-Path (Join-Path $Backend ("node_modules\" + $required)))) {
    Fail "Laufzeitmodul fehlt: $required"
  }
}

@"
KC MarktKasse Einrichtung erfolgreich
Node: $NodeVersion
Zeit: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
"@ | Set-Content -Encoding UTF8 (Join-Path $Root '.kc_setup_ok')

Write-Host ''
Write-Host 'Einrichtung vollständig. Die KC MarktKasse kann jetzt gestartet werden.' -ForegroundColor Green
exit 0
