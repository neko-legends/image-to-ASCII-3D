$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent $PSScriptRoot
$cargoBin = Join-Path $HOME '.cargo\bin'
$env:Path = "$cargoBin;$env:Path"
$tauri = Join-Path $rootDir 'node_modules\.bin\tauri.cmd'
$source = Join-Path $rootDir 'src-tauri\target\release\image-to-ascii-3d.exe'
$portableDir = Join-Path $rootDir 'release\portable'
$portable = Join-Path $portableDir 'image-to-ascii-3d.exe'

& $tauri build --no-bundle
if ($LASTEXITCODE -ne 0) {
  throw "Portable build failed with exit code $LASTEXITCODE."
}
if (-not (Test-Path -LiteralPath $source)) {
  throw "Portable build did not create $source."
}

New-Item -ItemType Directory -Force -Path $portableDir | Out-Null
Get-ChildItem -LiteralPath $portableDir -Filter 'image-to-ascii-3d-v*-portable.exe' -File |
  ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }
Copy-Item -LiteralPath $source -Destination $portable -Force

Write-Host "Portable app created: $portable"
