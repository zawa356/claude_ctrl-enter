# Changelog

このプロジェクトの主な変更点を記録します。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に、
バージョン番号は [Semantic Versioning](https://semver.org/lang/ja/) に従います。
`manifest.json` の `version` と一致させてください。

## [Unreleased]

### Added

- リポジトリの初期構成（README, .gitignore など）
- テスト環境（package.json、Playwright）と、設定UIとキー処理の連携テスト

### Fixed

- 送信キーで押す送信ボタンを、入力中の欄に属するものに限定。
  別の入力欄（過去メッセージの編集欄など）で送信キーを押しても、メイン入力欄の内容は送信されない。
  対応関係があいまいな場合は送信しない（模擬テストで確認、実機未確認）。
