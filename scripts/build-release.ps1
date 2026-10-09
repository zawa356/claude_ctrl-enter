# Builds the end-user release ZIP and its SHA256 checksum (developer tool, not shipped in the ZIP).
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-release.ps1 [-AllowDirty]
# Output: dist\claude-ctrl-enter-<version>.zip and dist\SHA256SUMS.txt
# The ZIP holds one top-level folder with only what users need; entry names use '/' separators.
[CmdletBinding()]
param([switch]$AllowDirty)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$root = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content -LiteralPath (Join-Path $root 'extension\manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$package = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$version = $manifest.version
if ($package.version -ne $version) { throw "Version mismatch: manifest.json $version / package.json $($package.version)" }
$changelog = Get-Content -LiteralPath (Join-Path $root 'CHANGELOG.md') -Raw -Encoding UTF8
if ($changelog -notmatch "(?m)^## \[$([regex]::Escape($version))\]") { throw "CHANGELOG.md has no '## [$version]' section." }

$include = @('install.bat', 'uninstall.bat', 'diagnose.bat', 'scripts/claude-keys.ps1', 'install.sh', 'uninstall.sh', 'diagnose.sh', 'scripts/claude-keys.sh', 'README.md', 'README.en.md', 'LICENSE', 'CHANGELOG.md', 'PRIVACY.md') +
    @(Get-ChildItem -LiteralPath (Join-Path $root 'extension') -File | ForEach-Object { "extension/$($_.Name)" })

if (!$AllowDirty -and (Get-Command git -ErrorAction SilentlyContinue)) {
    Push-Location $root
    try { $dirty = @(git status --porcelain -- $include) } finally { Pop-Location }
    if ($dirty.Count) { throw "Uncommitted changes in release files (use -AllowDirty to override):`n$($dirty -join "`n")" }
}

$name = "claude-ctrl-enter-$version"
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$zipPath = Join-Path $dist "$name.zip"
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath }

Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$sums = New-Object System.Text.StringBuilder
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($rel in $include) {
        $file = Join-Path $root ($rel -replace '/', '\')
        if (!(Test-Path -LiteralPath $file)) { throw "Missing release file: $rel" }
        [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file, "$name/$rel", [System.IO.Compression.CompressionLevel]::Optimal)
        [void]$sums.AppendFormat("{0}  {1}`n", (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLower(), $rel)
    }
    # Per-file checksums inside the ZIP, so users can verify an extracted copy.
    $entry = $zip.CreateEntry("$name/SHA256SUMS.txt")
    $writer = New-Object System.IO.StreamWriter($entry.Open(), (New-Object System.Text.UTF8Encoding($false)))
    try { $writer.Write($sums.ToString()) } finally { $writer.Dispose() }
} finally { $zip.Dispose() }

$zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLower()
[IO.File]::WriteAllText((Join-Path $dist 'SHA256SUMS.txt'), "$zipHash  $name.zip`n", (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Built $zipPath"
Write-Host "SHA256 $zipHash"
