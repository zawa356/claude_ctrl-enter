# コントリビューションガイド

## 開発環境

- Chromium 系ブラウザ（Chrome / Edge など）の最新安定版
- エディタは `.editorconfig` に対応したものを推奨（UTF-8 / LF / インデント 2 スペース）

## 開発の流れ

1. `main` から作業ブランチを作成します（例: `feature/xxx`, `fix/xxx`）。
2. 変更を加え、[README.md](README.md) の手順で拡張機能を読み込み動作確認します。
3. ユーザーに影響する変更は [CHANGELOG.md](CHANGELOG.md) の `Unreleased` に追記します。
4. Pull Request を作成します。

## コミットメッセージ

[Conventional Commits](https://www.conventionalcommits.org/ja/v1.0.0/) 形式を推奨します。

```
feat: Ctrl+Enter で送信する機能を追加
fix: IME 変換中の Enter で送信されてしまう問題を修正
docs: README にインストール手順を追記
```

## 実装上の注意

- **Manifest V3** を前提とします。
- **権限は最小限に。** `permissions` / `host_permissions` は必要なものだけを宣言し、追加する場合は PR で理由を説明してください。
- リモートコード（外部 CDN のスクリプト等）は読み込まないでください（Chrome Web Store のポリシー違反になります）。
- キー入力を扱う場合は IME 変換中（`event.isComposing`）の考慮を忘れないでください。
- ユーザーデータを収集・送信する変更を加える場合は [PRIVACY.md](PRIVACY.md) も更新してください。

## リリース手順

1. `src/manifest.json` の `version` を更新します。
2. `CHANGELOG.md` の `Unreleased` をバージョン番号付きの見出しに変更します。
3. タグを作成します（例: `git tag v0.1.0`）。
4. zip を作成し、Chrome Web Store / Edge アドオンに提出します。
