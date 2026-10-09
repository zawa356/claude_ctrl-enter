# 引き継ぎパッケージ検証

検証日: 2026-10-08（Asia/Tokyo）

## ソースの由来

- extensionの3ファイルは、ユーザーが実機動作と設定保持を確認した0.2.0からコピー。
- コピー元と現在のClaude導入先のSHA256が一致することを確認。
- インストール・解除スクリプトと2つのテストもコピー元と同じもの。
- 移行作業では拡張の動作コードを修正せず、稼働中の導入先も変更していない。
- README、AGENTS、開始プロンプト、引き継ぎ書、gitignore、ハッシュ一覧は移行用に追加した。
- 元READMEは履歴資料としてdocsにそのまま保存した。最新の検証状況は新READMEとAI_HANDOFF_JAを参照。

## コピー先で実行した検証

| 検証 | 結果 |
|---|---|
| test-keyboard.cjs | PASS |
| test-settings-ui.cjs（Playwright + headless Edge） | PASS |
| main-probe.js / badge.jsのNode構文検査 | PASS |
| install-probe.ps1 / uninstall-probe.ps1のPowerShell構文解析 | PASS |

PowerShellの検証は構文解析のみであり、移行時に再導入・解除は実行していない。
UI試験は模擬ページと模擬保存APIを使用し、個人プロファイルを使用していない。
試験で生成された画像は配布フォルダーの外へ移し、ZIPには入れていない。

## 成果物への混入を避けたもの

- app.asar / claude.exe / MSIX / 他者の拡張コード。
- ユーザー名や組織名、ユーザー固有の絶対パス、会話・認証情報。
- 実機スクリーンショット、ユーザーデータ、ローカル導入state.json、バックアップ実体。
- node_modules、Playwright本体、個人ブラウザープロファイル、.git。

## ハッシュ

SHA256SUMS.txtは同梱ファイルのSHA256一覧。ハッシュ一覧自身は対象外。
これは移行時の一致確認用で、署名や第三者認証ではない。
開発を進めてファイルを変更したらハッシュが変わることは正常。
