# Plume: download the wallpapers once into Plume\img\walls, so they're packed into the app
# (they change at once and work without internet). install.bat runs this; photos already here are skipped.
# The list is walls.txt: id <TAB> photo <TAB> preview. A photo that can't be downloaded loads from the internet instead.
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$list = Join-Path $root 'walls.txt'
$dir = Join-Path $root 'Plume\img\walls'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
if (-not (Test-Path $list)) { Write-Host '    walls.txt is missing: wallpapers will load from the internet'; exit 0 }

function Get-Photo([string]$url, [string]$file, [int]$min) {
  if ((Test-Path $file) -and ((Get-Item $file).Length -ge $min)) { return $true }
  $urls = @($url)
  if ($url -match '/free-photo-of-[^/?]+') { $urls += ($url -replace '/free-photo-of-[^/?]+', '') }   # Pexels' plain address
  foreach ($u in $urls) {
    try {
      Invoke-WebRequest -Uri $u -OutFile $file -UseBasicParsing -TimeoutSec 60 -Headers @{ 'User-Agent' = 'Mozilla/5.0 (Plume wallpapers)' }
      $b = [IO.File]::ReadAllBytes($file)
      if ($b.Length -ge $min -and $b[0] -eq 0xFF -and $b[1] -eq 0xD8) { return $true }   # a JPEG
    } catch {}
    Remove-Item -Force -ErrorAction SilentlyContinue $file
  }
  return $false
}

$ok = @(); $bad = @()
foreach ($line in Get-Content $list) {
  if (-not $line.Trim() -or $line.StartsWith('#')) { continue }
  $p = $line -split "`t"
  if ($p.Count -lt 3) { continue }
  $id = $p[0]
  $big = Join-Path $dir "$id.jpg"; $small = Join-Path $dir "$id-s.jpg"
  if ((Get-Photo $p[1] $big 40000) -and (Get-Photo $p[2] $small 4000)) { $ok += $id }
  else { $bad += $id; Remove-Item -Force -ErrorAction SilentlyContinue $big, $small }
}
$js = 'P.WALLS_LOCAL = {' + (($ok | ForEach-Object { "'" + $_ + "': 1" }) -join ', ') + '};'
Set-Content -Path (Join-Path $dir 'list.js') -Value $js -Encoding ASCII
Write-Host ("    Wallpapers packed into Plume: " + $ok.Count)
if ($bad.Count) { Write-Host ("    Couldn't download: " + ($bad -join ', ') + " (they'll load from the internet, or show the Rockies)") }
exit 0
