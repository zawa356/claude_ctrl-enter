# Claude Desktop キー設定拡張 — 導入・更新・解除・診断スクリプト
# Windows PowerShell 5.1 以降。管理者権限・外部ダウンロード・実行ポリシーの恒久変更は行わない。
# このファイルは UTF-8 (BOM付き)・CRLF で保存すること。BOMが無いと PowerShell 5.1 で日本語が化ける。
#
#   -Action diagnose   読み取りだけの診断（既定）
#   -Action install    導入。既に導入済み（試作版0.2.0を含む）なら更新
#   -Action uninstall  解除。拡張フォルダーはバックアップへ移し、削除はしない
#   -Yes               確認の質問を省略
#   -Sandbox / -FailAt テスト専用。保存先を一時フォルダーに差し替え、指定した段階で故意に失敗させる
[CmdletBinding()]
param(
    [ValidateSet('diagnose', 'install', 'uninstall')]
    [string]$Action = 'diagnose',
    [switch]$Yes,
    [string]$Sandbox,
    [string]$FailAt
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

# ---- 固定値（変更すると既存利用者の設定・解除互換が失われる。docs/AISTATE.md DEC-04 参照）----
$ExtensionId    = 'fmkadmapgofadopljbjfkapdkoienihi'   # Claude が REACT_PROFILE=1 で読み込むフォルダー名
$LegacyName     = 'Claude Enter Patch - Load Probe'    # 0.2.0 までの manifest name
$MarkerFile     = 'claude-keys.owner.json'             # このツールが置いたことを示す印
$TestedVersions = @('2.26454.2.0', '2.31226.0.0')
$SourceDir      = Join-Path (Split-Path -Parent $PSScriptRoot) 'extension'

if ($Sandbox) {
    $UserData        = Join-Path $Sandbox 'AppData\Roaming\Claude'
    $StateRoot       = Join-Path $Sandbox 'AppData\Local\ClaudeKeys'
    $LegacyStateRoot = Join-Path $Sandbox 'AppData\Local\ClaudePatchLab\enter-probe-state'
} else {
    $UserData        = Join-Path $env:APPDATA 'Claude'
    $StateRoot       = Join-Path $env:LOCALAPPDATA 'ClaudeKeys'
    $LegacyStateRoot = Join-Path $env:LOCALAPPDATA 'ClaudePatchLab\enter-probe-state'
}
$Target    = Join-Path $UserData "extensions\$ExtensionId"
$StateFile = Join-Path $StateRoot 'state.json'

# MSIX のファイル仮想化先。Claude が新しく作る設定の多くはここに入り、実際の %APPDATA%\Claude と
# 重ねて見える（docs/AISTATE.md ISSUE-20）。拡張はこれまで通り実際の場所へ置き、ここは確認だけする。
function Get-VirtualUserData($Package) {
    if (!$Package -or !$Package.PSObject.Properties['PackageFamilyName'] -or !$Package.PackageFamilyName) { return $null }
    $local = if ($Sandbox) { Join-Path $Sandbox 'AppData\Local' } else { $env:LOCALAPPDATA }
    Join-Path $local "Packages\$($Package.PackageFamilyName)\LocalCache\Roaming\Claude"
}

function Step([string]$Name) { if ($FailAt -eq $Name) { throw "テスト用の故意の失敗: $Name" } }

function Read-Json([string]$Path) {
    if (!(Test-Path -LiteralPath $Path)) { return $null }
    try { Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json } catch { $null }
}
function Write-Json([string]$Path, $Value) {
    $Value | ConvertTo-Json | Set-Content -LiteralPath $Path -Encoding UTF8
}
function Get-Prop($Object, [string]$Name) {
    if ($null -ne $Object -and $Object.PSObject.Properties[$Name]) { $Object.$Name } else { $null }
}

function Get-ClaudePackage {
    if ($Sandbox) { return [pscustomobject]@{ Version = $TestedVersions[0]; PackageFamilyName = 'Claude_pzs8sxrjxfjjc' } }
    try { Get-AppxPackage -Name 'Claude' -ErrorAction Stop | Select-Object -First 1 } catch { $null }
}

# REACT_PROFILE はレジストリの生の値を読む（展開しない）。Sandbox ではファイルで代用する。
function Get-ReactProfile([string]$Scope) {
    if ($Sandbox) { return Read-Json (Join-Path $Sandbox "env-$Scope.json") }
    $path = if ($Scope -eq 'User') { 'HKCU:\Environment' } else { 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment' }
    $key = Get-Item -LiteralPath $path
    if ($key.GetValueNames() -notcontains 'REACT_PROFILE') { return $null }
    [pscustomobject]@{
        Value = [string]$key.GetValue('REACT_PROFILE', $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
        Kind  = $key.GetValueKind('REACT_PROFILE').ToString()
    }
}
# ユーザー環境変数だけを変更する。$Previous を渡すと元の値と種類で戻す（$null なら削除）。
function Set-UserReactProfile($Previous, [switch]$Restore) {
    if ($Sandbox) {
        $file = Join-Path $Sandbox 'env-User.json'
        if ($Restore -and !$Previous) { Remove-Item -LiteralPath $file -ErrorAction SilentlyContinue }
        elseif ($Restore) { Write-Json $file $Previous }
        else { Write-Json $file ([pscustomobject]@{ Value = '1'; Kind = 'String' }) }
        return
    }
    if (!$Restore) { [Environment]::SetEnvironmentVariable('REACT_PROFILE', '1', 'User'); return }
    if (!$Previous) { [Environment]::SetEnvironmentVariable('REACT_PROFILE', $null, 'User'); return }
    $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true)
    try { $key.SetValue('REACT_PROFILE', $Previous.Value, [Enum]::Parse([Microsoft.Win32.RegistryValueKind], $Previous.Kind)) } finally { $key.Dispose() }
}

# 拡張フォルダーの持ち主: none / ours / legacy-probe / react-devtools / unknown
function Get-TargetOwner([string]$Path = $Target) {
    if (!(Test-Path -LiteralPath $Path)) { return 'none' }
    if (Test-Path -LiteralPath (Join-Path $Path $MarkerFile)) { return 'ours' }
    $manifest = Read-Json (Join-Path $Path 'manifest.json')
    $name = Get-Prop $manifest 'name'
    if ($name -eq $LegacyName) { return 'legacy-probe' }
    if ($name -match 'React Developer Tools') { return 'react-devtools' }
    'unknown'
}

function Get-Findings {
    $list = New-Object System.Collections.Generic.List[object]
    $add = { param($Level, $Item, $Detail) $list.Add([pscustomobject]@{ Level = $Level; Item = $Item; Detail = $Detail }) }

    & $add 'INFO' 'PowerShell' $PSVersionTable.PSVersion.ToString()

    $pkg = Get-ClaudePackage
    if (!$pkg) { & $add 'NG' 'Claude' 'MSIX版Claudeが見つかりません。' }
    elseif ($TestedVersions -contains $pkg.Version) { & $add 'OK' 'Claude' "$($pkg.Version)（動作確認済みの版）" }
    else { & $add 'WARN' 'Claude' "$($pkg.Version)（未確認の版。動かない可能性があります）" }

    $virtual = Get-VirtualUserData $pkg
    $hasVirtual = $virtual -and (Test-Path -LiteralPath $virtual)
    if (Test-Path -LiteralPath $UserData) { & $add 'OK' '設定フォルダー' $UserData }
    else { & $add 'NG' '設定フォルダー' "$UserData がありません。Claudeを一度起動してください。" }
    if ($hasVirtual) { & $add 'INFO' '設定フォルダー（パッケージ専用）' $virtual }

    $devFiles = @($UserData, $(if ($hasVirtual) { $virtual })) | Where-Object { $_ } | ForEach-Object { Join-Path $_ 'developer_settings.json' }
    if (@($devFiles | Where-Object { Test-Path -LiteralPath $_ }).Count) { & $add 'INFO' '開発者モード設定' 'developer_settings.json あり（導入には不要）' }
    else { & $add 'INFO' '開発者モード設定' 'developer_settings.json なし（導入には不要）' }

    switch (Get-TargetOwner) {
        'none'           { & $add 'OK' '拡張フォルダー' '未導入' }
        'ours'           { & $add 'OK' '拡張フォルダー' "導入済み（$((Get-Prop (Read-Json (Join-Path $Target 'manifest.json')) 'version'))）" }
        'legacy-probe'   { & $add 'OK' '拡張フォルダー' '導入済み（試作版 0.2.0 以前）' }
        'react-devtools' { & $add 'NG' '拡張フォルダー' '本物の React DevTools があります。上書きしないため導入できません。' }
        default          { & $add 'NG' '拡張フォルダー' '持ち主の分からないフォルダーがあります。上書きしないため導入できません。' }
    }
    if ($hasVirtual) {
        $virtualOwner = Get-TargetOwner (Join-Path $virtual "extensions\$ExtensionId")
        if ($virtualOwner -eq 'react-devtools') { & $add 'NG' '拡張フォルダー（パッケージ専用）' '本物の React DevTools があります。こちらが優先される可能性があるため導入しません。' }
        elseif ($virtualOwner -ne 'none') { & $add 'NG' '拡張フォルダー（パッケージ専用）' "同じIDのフォルダーがあります（$virtualOwner）。こちらが優先される可能性があるため導入しません。" }
    }

    $user = Get-ReactProfile 'User'; $machine = Get-ReactProfile 'Machine'
    if ($machine) { & $add 'NG' 'REACT_PROFILE（PC全体）' "値: '$($machine.Value)'。PC全体の設定は変更しません。" }
    if (!$user) { & $add 'OK' 'REACT_PROFILE（ユーザー）' '未設定' }
    elseif ($user.Value -eq '1') { & $add 'OK' 'REACT_PROFILE（ユーザー）' "1（$($user.Kind)）" }
    else { & $add 'NG' 'REACT_PROFILE（ユーザー）' "値: '$($user.Value)'。別の用途で使われているため変更しません。" }

    $legacy = Join-Path $LegacyStateRoot 'state.json'
    if (Test-Path -LiteralPath $legacy) {
        $s = Read-Json $legacy
        if ($s) { & $add 'INFO' '試作版の記録' "status=$(Get-Prop $s 'status')" } else { & $add 'WARN' '試作版の記録' 'state.json を読めません。' }
    }

    if (!$Sandbox) {
        $running = @(Get-Process -Name 'claude' -ErrorAction SilentlyContinue).Count
        & $add 'INFO' 'Claudeの起動' $(if ($running) { "起動中（$running プロセス）。導入・解除後は手動で再起動が必要です。" } else { '起動していません' })
    }
    , $list
}

function Show-Findings($Findings) {
    $colors = @{ OK = 'Green'; INFO = 'Gray'; WARN = 'Yellow'; NG = 'Red' }
    foreach ($f in $Findings) { Write-Host ('[{0,-4}] {1}: {2}' -f $f.Level, $f.Item, $f.Detail) -ForegroundColor $colors[$f.Level] }
    Write-Host ''
    @($Findings | Where-Object Level -eq 'NG').Count
}

function Confirm-Action([string]$Message) {
    if ($Yes) { return }
    $answer = Read-Host "$Message 続行しますか？ (Y/N)"
    if ($answer -notmatch '^[Yy]') { Write-Host '中止しました。何も変更していません。'; exit 2 }
}

# 環境変数を「このツールが設定した」と言えるか。言えない場合、解除時に環境変数を残す（安全側）。
function Get-EnvSetByUs {
    $state = Read-Json $StateFile
    if ($state) { return [bool](Get-Prop $state 'envSetByUs') }
    $legacy = Read-Json (Join-Path $LegacyStateRoot 'state.json')
    if ($legacy -and (Get-Prop $legacy 'hadValue') -eq $false -and (Get-Prop $legacy 'status') -eq 'installed') { return $true }
    $false
}

function Invoke-Diagnose {
    $ng = Show-Findings (Get-Findings)
    if ($ng) { Write-Host "結果: 問題が $ng 件あります。上の NG を確認してください。" -ForegroundColor Yellow }
    else { Write-Host '結果: 問題は見つかりませんでした。' -ForegroundColor Green }
    Write-Host 'この診断は読み取りだけで、何も変更していません。'
    if ($ng) { exit 1 }
}

function Invoke-Install {
    $ng = Show-Findings (Get-Findings)
    if ($ng) { Write-Host "問題が $ng 件あるため中止しました。何も変更していません。" -ForegroundColor Yellow; exit 1 }
    $manifest = Read-Json (Join-Path $SourceDir 'manifest.json')
    if (!$manifest) { throw "導入するファイルが見つかりません: $SourceDir" }
    $files = @(Get-ChildItem -LiteralPath $SourceDir -File)
    $owner = Get-TargetOwner
    $mode = if ($owner -eq 'none') { '導入' } else { '更新' }
    Confirm-Action "キー設定拡張 $($manifest.version) を$($mode)します。"

    $stamp     = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    $extDir    = Split-Path -Parent $Target
    $staging   = Join-Path $extDir ".$ExtensionId.staging-$stamp"
    $backup    = Join-Path $StateRoot "backups\$stamp"
    $previous  = Join-Path $backup 'previous'
    $envBefore = Get-ReactProfile 'User'
    $envSetByUs = if ($owner -eq 'none') { !$envBefore } else { Get-EnvSetByUs }
    $moved = $false; $placed = $false; $envChanged = $false
    try {
        New-Item -ItemType Directory -Force -Path $extDir, $StateRoot | Out-Null
        # 同じフォルダー内で準備してから名前変更で置くので、途中で失敗しても中途半端な拡張は残らない。
        New-Item -ItemType Directory -Path $staging | Out-Null
        foreach ($file in $files) {
            $dest = Join-Path $staging $file.Name
            Copy-Item -LiteralPath $file.FullName -Destination $dest
            if ((Get-FileHash -LiteralPath $dest).Hash -ne (Get-FileHash -LiteralPath $file.FullName).Hash) { throw "コピーの検証に失敗: $($file.Name)" }
        }
        Write-Json (Join-Path $staging $MarkerFile) ([pscustomobject]@{ tool = 'claude-keys'; schema = 1; version = $manifest.version; installedAt = [DateTime]::UtcNow.ToString('o') })
        Step 'copy'
        if ($owner -ne 'none') {
            New-Item -ItemType Directory -Force -Path $backup | Out-Null
            Move-Item -LiteralPath $Target -Destination $previous
            $moved = $true
        }
        Step 'swap'
        Move-Item -LiteralPath $staging -Destination $Target
        $placed = $true
        Step 'env'
        if (!$envBefore -or $envBefore.Value -ne '1') { Set-UserReactProfile; $envChanged = $true }
        Step 'state'
        $old = Read-Json $StateFile
        Write-Json $StateFile ([pscustomobject]@{
            schema = 1; status = 'installed'; version = $manifest.version; target = $Target
            envSetByUs = [bool]$envSetByUs; previousEnv = $(if ($envSetByUs) { $null } else { $envBefore })
            installedAt = $(if ($old -and $owner -ne 'none') { Get-Prop $old 'installedAt' } else { [DateTime]::UtcNow.ToString('o') })
            updatedAt = [DateTime]::UtcNow.ToString('o'); migratedFromLegacy = ($owner -eq 'legacy-probe') -or [bool](Get-Prop $old 'migratedFromLegacy')
        })
    } catch {
        Write-Host "失敗しました: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host '元の状態に戻しています…'
        $rollbackFailed = $false
        try { if ($envChanged) { Set-UserReactProfile $envBefore -Restore } } catch { $rollbackFailed = $true; Write-Host "環境変数を戻せませんでした: $($_.Exception.Message)" -ForegroundColor Red }
        try {
            if ($placed -or (Test-Path -LiteralPath $staging)) {
                New-Item -ItemType Directory -Force -Path $backup | Out-Null
                if ($placed) { Move-Item -LiteralPath $Target -Destination (Join-Path $backup 'failed') }
                else { Move-Item -LiteralPath $staging -Destination (Join-Path $backup 'failed') }
            }
            if ($moved) { Move-Item -LiteralPath $previous -Destination $Target }
        } catch { $rollbackFailed = $true; Write-Host "フォルダーを戻せませんでした: $($_.Exception.Message)" -ForegroundColor Red }
        if ($rollbackFailed) { Write-Host "手動での確認が必要です。バックアップ: $backup" -ForegroundColor Red; exit 3 }
        Write-Host '元の状態に戻しました。' -ForegroundColor Yellow
        exit 1
    }
    Write-Host "$($mode)しました: $Target" -ForegroundColor Green
    if ($moved) { Write-Host "以前のファイル: $previous" }
    Write-Host 'Claudeを完全に終了してから、いつものアイコンで起動し直してください。（このスクリプトはClaudeを終了しません）'
}

function Invoke-Uninstall {
    $owner = Get-TargetOwner
    if ($owner -eq 'react-devtools' -or $owner -eq 'unknown') { Write-Host '拡張フォルダーがこのツールのものではないため、何も変更しません。' -ForegroundColor Yellow; exit 1 }
    $envSetByUs = Get-EnvSetByUs
    $user = Get-ReactProfile 'User'
    if ($owner -eq 'none' -and !($envSetByUs -and $user)) { Write-Host '導入されていません。何も変更していません。'; return }
    Confirm-Action 'キー設定拡張を解除します。'

    $backup = Join-Path $StateRoot ("backups\" + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
    if ($owner -ne 'none') {
        New-Item -ItemType Directory -Force -Path $backup | Out-Null
        Move-Item -LiteralPath $Target -Destination (Join-Path $backup 'removed')
        Write-Host "拡張フォルダーを移動しました（削除はしていません）: $(Join-Path $backup 'removed')"
    }
    if (!$envSetByUs) { Write-Host 'REACT_PROFILE はこのツールが設定したものではないため、そのままにしました。' }
    elseif (!$user) { }
    elseif ($user.Value -eq '1') { Set-UserReactProfile $null -Restore; Write-Host 'REACT_PROFILE を削除しました。' }
    else { Write-Host "REACT_PROFILE が導入後に '$($user.Value)' へ変更されているため、そのままにしました。" -ForegroundColor Yellow }

    New-Item -ItemType Directory -Force -Path $StateRoot | Out-Null
    $old = Read-Json $StateFile
    Write-Json $StateFile ([pscustomobject]@{
        schema = 1; status = 'removed'; version = (Get-Prop $old 'version'); target = $Target; envSetByUs = $false
        installedAt = (Get-Prop $old 'installedAt'); removedAt = [DateTime]::UtcNow.ToString('o'); migratedFromLegacy = [bool](Get-Prop $old 'migratedFromLegacy')
    })
    Write-Host '解除しました。Claudeを完全に終了して起動し直すと、拡張は読み込まれなくなります。' -ForegroundColor Green
    Write-Host 'キー設定の保存内容はClaude側に残ります。同じ場所へ再導入すると引き継がれます。'
}

switch ($Action) {
    'diagnose'  { Invoke-Diagnose }
    'install'   { Invoke-Install }
    'uninstall' { Invoke-Uninstall }
}
