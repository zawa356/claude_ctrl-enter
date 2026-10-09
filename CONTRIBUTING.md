# コントリビューションガイド / Contributing

## 開発環境

- Windows 10 / 11、Windows PowerShell 5.1
- Node.js 20 以上（テスト用）。`npm install` で Playwright を取得します。ブラウザーは Windows 標準の Microsoft Edge を使います。
- エディターは `.editorconfig` 対応のものを推奨します。
  - `*.ps1` は **UTF-8（BOM付き）・CRLF**。BOM が無いと PowerShell 5.1 で日本語が化けます。
  - `*.bat` は CRLF。
  - それ以外は UTF-8・LF。

## 開発の流れ

1. `main` から作業ブランチを作成します（例: `feature/xxx`, `fix/xxx`）。
2. 変更を加え、`npm test` がすべて成功することを確認します。キー処理を変えたら `tests/` にテストを追加してください。
3. 実際の Claude で確認する場合は、リポジトリの `install.bat` で導入し、Claude を完全に終了して起動し直します。
4. 利用者に影響する変更は [CHANGELOG.md](CHANGELOG.md) の `Unreleased` に追記します。
5. Pull Request を作成します。模擬テストでの確認か、実際の Claude での確認かを区別して書いてください。

## 守ること

- Claude 本体（`claude.exe`、`app.asar`、`C:\Program Files\WindowsApps` 配下）や署名・権限を変更しないこと。
- インストーラーは bat と ps1 だけで完結させること。exe 化、コード署名の必須化、外部からのダウンロード、管理者権限、実行ポリシーの恒久変更は行わないこと。
- 拡張の導入先フォルダー（`extensions\fmkadmapgofadopljbjfkapdkoienihi`）を変えないこと。拡張 ID はこのフォルダーのパスから計算されるため、変えると利用者の設定が失われます。`manifest.json` に `key` を追加することも同じ理由で禁止です。
- 権限は最小限に。外部通信やリモートコードの読み込みはしないこと。データの扱いを変える場合は [PRIVACY.md](PRIVACY.md) も更新すること。
- キー処理では、IME 変換中の Enter と、誤送信につながる動作に特に注意すること。判断に迷う場合は「送信しない」側に倒すこと。

## コミットメッセージ

[Conventional Commits](https://www.conventionalcommits.org/ja/v1.0.0/) 形式を推奨します。

## リリース手順

1. `extension/manifest.json` と `package.json` の `version` を更新します。
2. `CHANGELOG.md` の `Unreleased` を `## [x.y.z] - YYYY-MM-DD` に変更します。
3. コミットしてタグを作成し、push します（例: `git tag v0.3.0 && git push origin v0.3.0`）。
   GitHub Actions がテストを実行し、配布用 ZIP と `SHA256SUMS.txt` を Release に添付します。
4. 手元で作る場合は `scripts\build-release.ps1` を実行します（`dist\` に出力）。

---

## English summary

Requirements: Windows, PowerShell 5.1, Node.js 20+ for tests (`npm install`, `npm test`). Keep `*.ps1` as UTF-8 with BOM and CRLF.
Never modify Claude's own files, never change the extension install folder or add a manifest `key` (it would change the extension ID and lose users' settings), keep the installer as plain .bat + .ps1, and when in doubt make key handling *not* send.
Release: bump versions in `extension/manifest.json` and `package.json`, date the CHANGELOG section, then push a `vX.Y.Z` tag; CI builds the ZIP and attaches it to the GitHub Release.
