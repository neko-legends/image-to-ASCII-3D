$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent $PSScriptRoot
$cargoBin = Join-Path $HOME '.cargo\bin'
$env:Path = "$cargoBin;$env:Path"
$tauri = Join-Path $rootDir 'node_modules\.bin\tauri.cmd'
$bundleDir = Join-Path $rootDir 'src-tauri\target\release\bundle\nsis'
$installerDir = Join-Path $rootDir 'release\installer'
$installer = Join-Path $installerDir 'image-to-ascii-3d-setup.exe'

& $tauri build --bundles nsis
if ($LASTEXITCODE -ne 0) {
  throw "NSIS installer build failed with exit code $LASTEXITCODE."
}

$source = Get-ChildItem -LiteralPath $bundleDir -Filter '*-setup.exe' -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if (-not $source) {
  throw "NSIS build did not create an installer in $bundleDir."
}

New-Item -ItemType Directory -Force -Path $installerDir | Out-Null
Copy-Item -LiteralPath $source.FullName -Destination $installer -Force

Write-Host "NSIS installer created: $installer"
