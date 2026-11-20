# KC-TV-HINTERGRUND (Wunsch Hansi 20.11.2026): Windows-Hintergrund des Mini-PCs am Stand = Rathaus Werne
# im Weihnachtsmarkt-Licht (dasselbe Bild wie in der Praesentation), statt des Windows-Standardbilds.
# Keine Adminrechte noetig, nur fuer den angemeldeten Benutzer. Das Bild wird nach %LOCALAPPDATA%\KC-MarktKasse
# kopiert, damit der Hintergrund auch nach dem Austausch des Kassen-Ordners (neue ZIP) erhalten bleibt.
# Rueckgaengig: Einstellungen - Personalisierung - Hintergrund.
param([string]$Bild)
$ErrorActionPreference = 'Stop'
if (-not $Bild) { $Bild = Join-Path (Split-Path -Parent $PSScriptRoot) 'media\backgrounds\rathaus-werne-weihnachtsmarkt-v2.jpg' }
if (-not (Test-Path -LiteralPath $Bild)) { Write-Host "Bild nicht gefunden: $Bild"; exit 1 }
$ziel = Join-Path $env:LOCALAPPDATA 'KC-MarktKasse'
New-Item -ItemType Directory -Force -Path $ziel | Out-Null
$datei = Join-Path $ziel 'tv-hintergrund-rathaus.jpg'
Copy-Item -LiteralPath $Bild -Destination $datei -Force
# 10 = Ausfuellen (fuellt den Fernseher ohne schwarze Raender), nicht kacheln
Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name WallpaperStyle -Value '10'
Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name TileWallpaper -Value '0'
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public static class KcHintergrund {
  [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern int SystemParametersInfo(int aktion, int wert, string datei, int flags);
}
'@
# 20 = SPI_SETDESKWALLPAPER, 3 = dauerhaft speichern + allen Fenstern melden
if ([KcHintergrund]::SystemParametersInfo(20, 0, $datei, 3) -eq 0) { Write-Host 'Windows hat den Hintergrund nicht uebernommen.'; exit 1 }
exit 0
