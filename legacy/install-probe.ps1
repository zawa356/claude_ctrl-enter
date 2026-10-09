$ErrorActionPreference = 'Stop'
$extensionId = 'fmkadmapgofadopljbjfkapdkoienihi'
$dataRoot = Join-Path $env:APPDATA 'Claude'
$target = Join-Path $dataRoot "extensions\$extensionId"
$stateRoot = Join-Path $env:LOCALAPPDATA 'ClaudePatchLab\enter-probe-state'
$stateFile = Join-Path $stateRoot 'state.json'
if (!(Test-Path -LiteralPath (Join-Path $dataRoot 'developer_settings.json'))) {
    throw 'Expected Claude user-data folder not found. No changes made.'
}
if ((Test-Path -LiteralPath $target) -or (Test-Path -LiteralPath $stateRoot)) {
    throw 'Existing extension or probe state found. Refusing to overwrite.'
}
$envKey = Get-Item -LiteralPath 'HKCU:\Environment'
$hadValue = $envKey.GetValueNames() -contains 'REACT_PROFILE'
$oldValue = if ($hadValue) { $envKey.GetValue('REACT_PROFILE', $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) } else { $null }
$oldKind = if ($hadValue) { $envKey.GetValueKind('REACT_PROFILE').ToString() } else { $null }
if ($hadValue -or [Environment]::GetEnvironmentVariable('REACT_PROFILE', 'Machine')) {
    throw 'REACT_PROFILE is already configured. Refusing to alter existing settings.'
}
New-Item -ItemType Directory -Path $stateRoot | Out-Null
$state = [ordered]@{ version=1; target=$target; hadValue=$hadValue; oldValue=$oldValue; oldKind=$oldKind; installedAt=[DateTime]::UtcNow.ToString('o'); status='prepared' }
$state | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'uninstall-probe.ps1') -Destination $stateRoot
New-Item -ItemType Directory -Path $target -Force | Out-Null
foreach ($name in @('manifest.json', 'main-probe.js', 'badge.js')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "extension\$name") -Destination $target
}
[Environment]::SetEnvironmentVariable('REACT_PROFILE', '1', 'User')
$state.status = 'installed'
$state | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
Write-Output "Probe installed: $target"
Write-Output "Rollback: $(Join-Path $stateRoot 'uninstall-probe.ps1')"
Write-Output 'Restart Claude yourself using its normal icon. No app was closed by this script.'
