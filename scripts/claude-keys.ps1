# Claude Desktop キー設定拡張 — 導入・解除・診断スクリプト
# Windows PowerShell 5.1 以降。管理者権限・外部ダウンロード・実行ポリシーの恒久変更は行わない。
# このファイルは UTF-8 (BOM付き) で保存すること。BOMが無いと PowerShell 5.1 で日本語が化ける。
[CmdletBinding()]
param(
    [ValidateSet('diagnose')]
    [string]$Action = 'diagnose'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

# ---- 固定値（変更すると既存利用者の設定・解除互換が失われる。docs/AISTATE.md DEC-04 参照）----
$ExtensionId      = 'fmkadmapgofadopljbjfkapdkoienihi'   # Claude が REACT_PROFILE=1 で読み込むフォルダー名
$LegacyName       = 'Claude Enter Patch - Load Probe'    # 0.2.0 までの manifest name
$MarkerFile       = 'claude-keys.owner.json'             # 将来の所有判定用（未導入）
$TestedVersions   = @('2.26454.2.0')
$UserData         = Join-Path $env:APPDATA 'Claude'
$Target           = Join-Path $UserData "extensions\$ExtensionId"
$LegacyStateRoot  = Join-Path $env:LOCALAPPDATA 'ClaudePatchLab\enter-probe-state'

function Get-ClaudePackage {
    try { Get-AppxPackage -Name 'Claude' -ErrorAction Stop | Select-Object -First 1 } catch { $null }
}

function Get-RegistryEnv([string]$Scope) {
    $path = if ($Scope -eq 'User') { 'HKCU:\Environment' } else { 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment' }
    $key = Get-Item -LiteralPath $path
    if ($key.GetValueNames() -notcontains 'REACT_PROFILE') { return $null }
    [pscustomobject]@{
        Value = $key.GetValue('REACT_PROFILE', $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
        Kind  = $key.GetValueKind('REACT_PROFILE').ToString()
    }
}

# 拡張フォルダーの持ち主: none / ours / legacy-probe / react-devtools / unknown
function Get-TargetOwner {
    if (!(Test-Path -LiteralPath $Target)) { return 'none' }
    if (Test-Path -LiteralPath (Join-Path $Target $MarkerFile)) { return 'ours' }
    $manifestPath = Join-Path $Target 'manifest.json'
    if (!(Test-Path -LiteralPath $manifestPath)) { return 'unknown' }
    try { $name = (Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json).name } catch { return 'unknown' }
    if ($name -eq $LegacyName) { return 'legacy-probe' }
    if ($name -match 'React Developer Tools') { return 'react-devtools' }
    'unknown'
}

function Invoke-Diagnose {
    $findings = New-Object System.Collections.Generic.List[object]
    function Add([string]$Level, [string]$Item, [string]$Detail) { $findings.Add([pscustomobject]@{ Level = $Level; Item = $Item; Detail = $Detail }) }

    Add 'INFO' 'PowerShell' $PSVersionTable.PSVersion.ToString()

    $pkg = Get-ClaudePackage
    if (!$pkg) { Add 'NG' 'Claude' 'MSIX版Claudeが見つかりません。' }
    elseif ($TestedVersions -contains $pkg.Version) { Add 'OK' 'Claude' "$($pkg.Version)（動作確認済みの版）" }
    else { Add 'WARN' 'Claude' "$($pkg.Version)（未確認の版。動かない可能性があります）" }

    if (Test-Path -LiteralPath $UserData) { Add 'OK' '設定フォルダー' $UserData }
    else { Add 'NG' '設定フォルダー' "$UserData がありません。Claudeを一度起動してください。" }

    $dev = Join-Path $UserData 'developer_settings.json'
    if (Test-Path -LiteralPath $dev) { Add 'INFO' '開発者モード設定' 'developer_settings.json あり' }
    else { Add 'INFO' '開発者モード設定' 'developer_settings.json なし（必須かどうかは未確認）' }

    switch (Get-TargetOwner) {
        'none'           { Add 'OK'   '拡張フォルダー' '未導入' }
        'ours'           { Add 'OK'   '拡張フォルダー' '導入済み（このツール）' }
        'legacy-probe'   { Add 'OK'   '拡張フォルダー' '導入済み（試作版 0.2.0 以前）' }
        'react-devtools' { Add 'NG'   '拡張フォルダー' '本物の React DevTools があります。上書きしないため導入できません。' }
        default          { Add 'NG'   '拡張フォルダー' '持ち主の分からないフォルダーがあります。上書きしないため導入できません。' }
    }

    $user = Get-RegistryEnv 'User'; $machine = Get-RegistryEnv 'Machine'
    if ($machine) { Add 'NG' 'REACT_PROFILE（PC全体）' "値: '$($machine.Value)'。PC全体の設定は変更しません。" }
    if (!$user) { Add 'OK' 'REACT_PROFILE（ユーザー）' '未設定' }
    elseif ($user.Value -eq '1') { Add 'OK' 'REACT_PROFILE（ユーザー）' "1（$($user.Kind)）" }
    else { Add 'NG' 'REACT_PROFILE（ユーザー）' "値: '$($user.Value)'。別の用途で使われているため変更しません。" }

    $legacyState = Join-Path $LegacyStateRoot 'state.json'
    if (Test-Path -LiteralPath $legacyState) {
        try { $s = Get-Content -LiteralPath $legacyState -Raw | ConvertFrom-Json; Add 'INFO' '試作版の記録' "status=$($s.status)" }
        catch { Add 'WARN' '試作版の記録' 'state.json を読めません。' }
    }

    $running = @(Get-Process -Name 'claude' -ErrorAction SilentlyContinue).Count
    Add 'INFO' 'Claudeの起動' $(if ($running) { "起動中（$running プロセス）。導入・解除後は手動で再起動が必要です。" } else { '起動していません' })

    $colors = @{ OK = 'Green'; INFO = 'Gray'; WARN = 'Yellow'; NG = 'Red' }
    foreach ($f in $findings) { Write-Host ('[{0,-4}] {1}: {2}' -f $f.Level, $f.Item, $f.Detail) -ForegroundColor $colors[$f.Level] }
    Write-Host ''
    $ng = @($findings | Where-Object Level -eq 'NG').Count
    if ($ng) { Write-Host "結果: 問題が $ng 件あります。上の NG を確認してください。" -ForegroundColor Yellow }
    else { Write-Host '結果: 問題は見つかりませんでした。' -ForegroundColor Green }
    Write-Host 'この診断は読み取りだけで、何も変更していません。'
    if ($ng) { exit 1 }
}

switch ($Action) {
    'diagnose' { Invoke-Diagnose }
}
