# claude_ctrl-enter

Claude Desktop のメッセージ送信キーを **`Ctrl + Enter`** に変更する、Chromium 拡張機能ベースの改造ツールです。

> **ステータス:** 開発初期（未実装）

## 概要

Claude Desktop は標準で `Enter` を押すとメッセージが送信されるため、長文を書いている途中で誤送信しがちです。
このツールはキー操作を次のように変更します。

| キー | 標準の動作 | 改造後 |
| --- | --- | --- |
| `Enter` | 送信 | 改行 |
| `Ctrl + Enter`（macOS は `Cmd + Enter`） | — | 送信 |
| `Shift + Enter` | 改行 | 改行 |

IME の変換確定のための `Enter` では送信も改行もしません。

## 対象

| 対象 | 対応状況 |
| --- | --- |
| Claude Desktop（Windows / macOS） | 対応予定 |
| claude.ai（Chrome / Edge などのブラウザ） | 対応予定 |

拡張機能は Manifest V3 で作ります。
Claude Desktop は Electron アプリのため、拡張機能をどうやって読み込ませるか（注入方法）は [docs/](docs/) で検討・記録します。

## ディレクトリ構成

```
.
├── src/            # 拡張機能本体（manifest.json, content script など）
├── docs/           # 設計メモ・補足ドキュメント
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── PRIVACY.md      # プライバシーポリシー（ストア公開時に必要）
└── LICENSE
```

## インストール（開発版・ブラウザで動作確認する場合）

1. このリポジトリをクローンします。
   ```bash
   git clone <repository-url>
   ```
2. Chrome で `chrome://extensions` を開きます（Edge は `edge://extensions`）。
3. 右上の **デベロッパー モード** をオンにします。
4. **パッケージ化されていない拡張機能を読み込む** をクリックし、`src/` ディレクトリを選択します。

コードを変更したら、拡張機能ページの再読み込みボタンを押し、対象ページもリロードしてください。

## 使い方

<!-- TODO: 実装後に記述 -->

## パッケージング

ストア提出用の zip は `src/` の中身をまとめて作成します。

```bash
cd src && zip -r ../claude_ctrl-enter.zip . -x '.*'
```

生成物（`*.zip` / `*.crx` / `*.pem`）は `.gitignore` で除外しています。
**`.pem`（署名鍵）は絶対にコミットしないでください。**

## 注意事項

- 本ツールは Anthropic 非公式のものです。
- Claude Desktop のアップデートで画面の構造が変わると、動作しなくなる場合があります。

## プライバシー

本拡張機能が扱うデータについては [PRIVACY.md](PRIVACY.md) を参照してください。

## コントリビュート

[CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス

[MIT License](LICENSE)
