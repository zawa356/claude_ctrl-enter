$ErrorActionPreference = 'Stop'
$stateRoot = Join-Path $env:LOCALAPPDATA 'ClaudePatchLab\enter-probe-state'
$stateFile = Join-Path $stateRoot 'state.json'
$state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
if ($state.status -eq 'removed') { Write-Output 'Probe already removed.'; return }
$expected = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'Claude\extensions\fmkadmapgofadopljbjfkapdkoienihi'))
if ([IO.Path]::GetFullPath($state.target) -ne $expected) { throw 'Unexpected target in backup state.' }
$current = [Environment]::GetEnvironmentVariable('REACT_PROFILE', 'User')
if ($current -and $current -ne '1') { throw 'REACT_PROFILE changed since installation. No changes made.' }
$archive = [IO.Path]::GetFullPath((Join-Path $stateRoot 'removed-extension'))
if (!$archive.StartsWith([IO.Path]::GetFullPath($stateRoot) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected archive path.' }
if (Test-Path -LiteralPath $expected) {
    $manifest = Get-Content -LiteralPath (Join-Path $expected 'manifest.json') -Raw | ConvertFrom-Json
    if ($manifest.name -ne 'Claude Enter Patch - Load Probe') { throw 'Target belongs to another extension; stopping.' }
    if (Test-Path -LiteralPath $archive) { throw 'Archive already exists; stopping.' }
    Move-Item -LiteralPath $expected -Destination $archive
}
if ($state.hadValue) {
    $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true)
    try { $key.SetValue('REACT_PROFILE', $state.oldValue, [Enum]::Parse([Microsoft.Win32.RegistryValueKind], $state.oldKind)) } finally { $key.Dispose() }
} else {
    [Environment]::SetEnvironmentVariable('REACT_PROFILE', $null, 'User')
}
$state.status = 'removed'
$state | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
Write-Output 'Probe removed. Restart Claude normally to unload it. Backup files were preserved.'
