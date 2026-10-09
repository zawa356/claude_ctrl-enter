# Changelog

このプロジェクトの主な変更点を記録します。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に、
バージョン番号は [Semantic Versioning](https://semver.org/lang/ja/) に従います。
`extension/manifest.json` と `package.json` の `version` と一致させてください。

## [Unreleased]

## [0.4.0] - 2026-10-09

Claude Desktop が読み込める拡張は1つだけです。そのため 0.3.0 までは、同じ仕組みを使う他のツール（例：[claude-split-ui](https://github.com/zawa356/claude-split-ui)）と同時に使えませんでした。0.4.0 では、拡張フォルダーの管理を共通ローダー [claude-desktop-webext](https://github.com/zawa356/claude-desktop-webext) に任せ、他のツールと共存できるようにしました。

### Changed

- 導入・更新・解除・診断の中身を共通ローダーに移しました。`install.bat` などの使い方は変わりません。
  - 拡張の本体は `%LOCALAPPDATA%\ClaudeDesktopWebExt\web-extensions\claude-ctrl-enter\` に置きます。Claude が読み込むフォルダー（`%APPDATA%\Claude\extensions\fmkadmapgofadopljbjfkapdkoienihi`）は、ローダーが入っている全ツールから毎回作り直します。
  - フォルダーの場所は変わらないため、拡張のIDと保存済みのキー設定はそのまま引き継がれます。
  - `REACT_PROFILE` の管理と導入の記録はローダー側（`%LOCALAPPDATA%\ClaudeDesktopWebExt`）に移ります。最後のツールを解除したときだけ、ローダーが設定した `REACT_PROFILE` を削除します。
  - 診断と導入の画面にはローダーの英語表示が混ざります。
- 0.3.x と試作版 0.2.0 からは `install.bat` で自動的に移行します。以前の拡張フォルダーはバックアップへ移し、0.3.x が設定した `REACT_PROFILE` は引き継ぎます。
- Linux 版も同じ方式にしました。ローダーには **python3（3.8 以上）が必要**です（Ubuntu / Debian のデスクトップには標準で入っています）。`REACT_PROFILE` の設定ファイルは `~/.config/environment.d/90-claude-desktop-webext.conf` に変わり、0.3.x の `90-claude-ctrl-enter.conf` は移行時にバックアップへ移します。
- 動作確認済みの Claude の版は `desktop-webext.json` に記載しています。

### Notes

- 移行した後は、0.3.x の `uninstall.bat` / `uninstall.sh` は「持ち主の分からないフォルダー」として何もせず中止します。解除には 0.4.0 以降を使ってください。
- 開発用チェックアウトでは `git submodule update --init` が必要です（ローダーを `vendor/claude-desktop-webext` に置いています）。

## [0.3.0] - 2026-10-09

最初の公開版です。

### Added

- bat + ps1 だけで完結する導入・更新・解除・診断（`install.bat` / `uninstall.bat` / `diagnose.bat`、`scripts/claude-keys.ps1`）。
  - 管理者権限・外部ダウンロード・実行ポリシーの恒久変更なし。
  - 導入前に診断し、本物の React DevTools や別用途の `REACT_PROFILE` があれば何も変更せず中止。
  - 途中で失敗した場合は元の状態に戻す。更新・解除時の旧ファイルは削除せずバックアップへ移す。
  - 試作版 0.2.0 からの更新に対応。拡張フォルダーの場所を変えないため、保存済みのキー設定は引き継がれる。
  - 試作版と違い、`developer_settings.json`（開発者モード）を必須にしない（開発者モード無しで読み込まれることを実機で確認）。
  - MSIX の仮想化で Claude の設定が `%LOCALAPPDATA%\Packages\Claude_…\LocalCache\Roaming\Claude` に置かれている環境も診断する。そこに同じIDの拡張（本物の React DevTools など）があれば導入しない。
- Linux 版（`install.sh` / `uninstall.sh` / `diagnose.sh`、`scripts/claude-keys.sh`）。Claude Desktop ベータ（Debian / Ubuntu）向け。**実機未確認**（自動テストのみ）。
- 配布用 ZIP と SHA256 を作る `scripts/build-release.ps1`。
- テスト（キー処理・インストーラー・設定画面・連携）と GitHub Actions。
- 日本語・英語の README。

### Changed

- 拡張の名前を「Claude Ctrl+Enter」に変更。スクリプト名を `keys.js` / `settings-ui.js` に変更（設定は引き継がれる）。
- サイドバーの「キー設定」の状態表示に、実際の動作状態を反映。
  入力欄が想定と違う場合は「非対応」、送信ボタンを特定できない場合は「送信不可」、改行に失敗した場合は「改行不可」と赤字で表示し、ダイアログに理由を表示する。
- 動作確認済みの版に Claude 2.31226.0 を追加。

### Fixed

- 送信キーで押す送信ボタンを、入力中の欄に属するものに限定。
  別の入力欄（過去メッセージの編集欄など）で送信キーを押しても、メイン入力欄の内容は送信されない。対応関係があいまいな場合は送信しない。
- スラッシュコマンドやメンションの候補メニューで、Enter で候補を選べず改行になっていた問題を修正。
  メニューが表示されている間の Enter は Claude 側に任せる。
- ページの読み込み直後に、拡張が動く前の Enter で送信されてしまう隙間を縮小（スクリプトを `document_start` で開始）。
  保存済み設定が届くまでは送信キーで送信せず、設定が届かない場合は3秒後に初期値で動作する。
- 保存機能（chrome.storage）が使えない環境で、設定ボタン自体が表示されなかった問題を修正。初期値で動作し、保存ボタンは無効になる。
- 保存済み設定が壊れている場合に、黙って初期値に戻っていた問題を修正。理由をダイアログに表示する。
- 保存済み設定が削除されたときに、古い設定のまま動いていた問題を修正。初期値に戻る。
- ダイアログを開いている間に別の画面で設定が変わると、古い内容で上書き保存できてしまう問題を修正。表示を更新して知らせる。

## [0.2.0] - 2026-10-08

試作版（非公開）。`legacy/` に保存。

- サイドバーの「キー設定」から有効/無効と送信・改行キーを変更し、再起動後も保持。

## [0.1.0] - 2026-10-08

試作版（非公開）。Enter 改行・Ctrl+Enter 送信・IME 保護。

## [0.0.1] - 2026-10-08

試作版（非公開）。Claude Desktop に拡張を読み込ませられるかの確認。
