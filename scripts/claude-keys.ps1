# Claude Desktop キー設定拡張 — 導入・更新・解除・診断スクリプト（Windows）
# Windows PowerShell 5.1 以降。管理者権限・外部ダウンロード・実行ポリシーの恒久変更は行わない。
# このファイルは UTF-8 (BOM付き)・CRLF で保存すること。BOMが無いと PowerShell 5.1 で日本語が化ける。
#
# 0.4.0 から、Claude が読み込む拡張フォルダーの管理は共通ローダー claude-desktop-webext
# （https://github.com/zawa356/claude-desktop-webext）に任せる。同じローダーを使う他のツール
# （claude-split-ui など）と共存できる。このスクリプトは 0.3.x 以前からの移行判断と案内だけを行う。
#
#   -Action diagnose   読み取りだけの診断（既定）
#   -Action install    導入。既に導入済みなら更新。0.3.x 以前の導入はここで新方式へ移行する
#   -Action uninstall  解除。拡張フォルダーはバックアップへ移し、削除はしない
#   -Yes               確認の質問を省略
#   -Sandbox / -FailAt テスト専用。ローダーにそのまま渡す
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
# PowerShell 7 から起動された Windows PowerShell 5.1 は 7 用の PSModulePath を引き継ぐため、この実行に限り戻す。
if ($PSVersionTable.PSVersion.Major -le 5) {
    $env:PSModulePath = (@([Environment]::GetEnvironmentVariable('PSModulePath', 'User'), [Environment]::GetEnvironmentVariable('PSModulePath', 'Machine')) | Where-Object { $_ }) -join ';'
}

# ---- 固定値（変更すると既存利用者の設定・解除互換が失われる。docs/AISTATE.md DEC-04 参照）----
$ExtensionId = 'fmkadmapgofadopljbjfkapdkoienihi'   # Claude が REACT_PROFILE=1 で読み込むフォルダー名
$LegacyName  = 'Claude Enter Patch - Load Probe'    # 0.2.0 までの manifest name
$MarkerFile  = 'claude-keys.owner.json'             # 0.3.x までが拡張フォルダーに置いた印

$Root   = Split-Path -Parent $PSScriptRoot
$Config = Join-Path $Root 'desktop-webext.json'
# 配布 ZIP では claude-desktop-webext\、開発用チェックアウトでは vendor\claude-desktop-webext\（git submodule）
$Loader = @((Join-Path $Root 'claude-desktop-webext\bin\webext.ps1'), (Join-Path $Root 'vendor\claude-desktop-webext\bin\webext.ps1')) |
    Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

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

function Read-Json([string]$Path) {
    if (!(Test-Path -LiteralPath $Path)) { return $null }
    try { Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json } catch { $null }
}
function Get-Prop($Object, [string]$Name) {
    if ($null -ne $Object -and $Object.PSObject.Properties[$Name]) { $Object.$Name } else { $null }
}

# 0.3.x 以前の方式（このツールが拡張フォルダーを直接持つ）で導入されているか: flat / legacy-probe / $null
function Get-OldInstall {
    if (!(Test-Path -LiteralPath $Target)) { return $null }
    if (Test-Path -LiteralPath (Join-Path $Target $MarkerFile)) { return 'flat' }
    if ((Get-Prop (Read-Json (Join-Path $Target 'manifest.json')) 'name') -eq $LegacyName) { return 'legacy-probe' }
    $null
}

# 旧方式で REACT_PROFILE をこのツールが設定したか。設定していれば、移行時にローダーへ引き継ぐ（-AdoptEnv）。
function Get-OldEnvSetByUs {
    $state = Read-Json $StateFile
    if ($state -and (Get-Prop $state 'status') -eq 'installed' -and !(Get-Prop $state 'manager')) { return [bool](Get-Prop $state 'envSetByUs') }
    $legacy = Read-Json (Join-Path $LegacyStateRoot 'state.json')
    if ($legacy -and (Get-Prop $legacy 'hadValue') -eq $false -and (Get-Prop $legacy 'status') -eq 'installed') { return $true }
    $false
}

# このツール自身の記録。導入先と REACT_PROFILE の管理はローダーの記録（%LOCALAPPDATA%\ClaudeDesktopWebExt）が正。
function Write-State([string]$Status, [string]$MigratedFrom) {
    New-Item -ItemType Directory -Force -Path $StateRoot | Out-Null
    $old = Read-Json $StateFile
    $version = Get-Prop (Read-Json (Join-Path $Root 'extension\manifest.json')) 'version'
    [pscustomobject]@{
        schema = 2; status = $Status; manager = 'claude-desktop-webext'; version = $version
        migratedFrom = $(if ($MigratedFrom) { $MigratedFrom } else { Get-Prop $old 'migratedFrom' })
        migratedFromLegacy = [bool](Get-Prop $old 'migratedFromLegacy') -or ($MigratedFrom -eq 'legacy-probe')
        installedAt = $(if (Get-Prop $old 'installedAt') { Get-Prop $old 'installedAt' } else { [DateTime]::UtcNow.ToString('o') })
        updatedAt = [DateTime]::UtcNow.ToString('o')
    } | ConvertTo-Json | Set-Content -LiteralPath $StateFile -Encoding UTF8
}

# 共通ローダーを同じプロセスで呼ぶ（実行ポリシーは呼び出し元の Bypass がそのまま効く）。終了コードを返す。
function Invoke-Loader([string]$LoaderAction, [bool]$AdoptEnv = $false) {
    $params = @{ Action = $LoaderAction; Config = $Config }
    if ($Yes) { $params.Yes = $true }
    if ($AdoptEnv) { $params.AdoptEnv = $true }
    if ($Sandbox) { $params.Sandbox = $Sandbox }
    if ($FailAt) { $params.FailAt = $FailAt }
    $global:LASTEXITCODE = 0
    try { & $Loader @params | Out-Host } catch { Write-Host "失敗しました: $($_.Exception.Message)" -ForegroundColor Red; return 1 }
    [int]$global:LASTEXITCODE
}

Write-Host 'Claude Ctrl+Enter（共通ローダー claude-desktop-webext 経由）' -ForegroundColor Cyan
if (!$Loader) {
    Write-Host '共通ローダーが見つかりません。配布 ZIP を展開し直すか、開発用なら git submodule update --init を実行してください。' -ForegroundColor Red
    exit 1
}
$old = Get-OldInstall

switch ($Action) {
    'diagnose' {
        if ($old) { Write-Host '[INFO] 旧方式（0.3.x 以前）で導入されています。install.bat を実行すると新方式へ移行します（キー設定は引き継がれます）。' }
        $rc = Invoke-Loader 'diagnose'
        Write-Host '（上はローダーの英語表示です。NG が無ければ問題ありません。診断は読み取りだけで、何も変更していません）'
        exit $rc
    }
    'install' {
        $adopt = [bool]$old -and (Get-OldEnvSetByUs)
        if ($old) { Write-Host '旧方式（0.3.x 以前）の導入を新方式へ移行します。以前の拡張フォルダーはバックアップへ移し、キー設定は引き継がれます。' }
        $rc = Invoke-Loader 'install' $adopt
        if ($rc -ne 0) { Write-Host "導入は完了していません（終了コード $rc）。上の表示を確認してください。" -ForegroundColor Yellow; exit $rc }
        Write-State 'installed' $old
        Write-Host '導入しました。Claude を完全に終了してから（タスクトレイのアイコンを右クリック →「終了」）、いつものアイコンで起動し直してください。' -ForegroundColor Green
        Write-Host 'このスクリプトは Claude を終了しません。'
    }
    'uninstall' {
        if ($old) {
            Write-Host '旧方式（0.3.x 以前）の導入が残っています。先に install.bat で新方式へ移行してから、uninstall.bat を実行してください。何も変更していません。' -ForegroundColor Yellow
            exit 1
        }
        $rc = Invoke-Loader 'uninstall'
        if ($rc -ne 0) { Write-Host "解除は完了していません（終了コード $rc）。上の表示を確認してください。" -ForegroundColor Yellow; exit $rc }
        if (Test-Path -LiteralPath $StateFile) { Write-State 'removed' $null }
        Write-Host '解除しました。Claude を完全に終了して起動し直すと反映されます。キー設定の保存内容は Claude 側に残り、再導入すると引き継がれます。' -ForegroundColor Green
    }
}
