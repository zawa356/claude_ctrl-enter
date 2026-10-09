# Claude Ctrl+Enter

**日本語** | [English](README.en.md)

Claude Desktop（Windows・Linux）で **Enter を改行、Ctrl+Enter を送信** に変える非公式ツールです。
日本語入力（IME）の変換確定の Enter で誤送信しません。キーの割り当ては Claude の画面から変更できます。

> [!IMPORTANT]
> Anthropic 公式のツールではありません。Claude の内部の仕組みを利用しているため、Claude の更新で動かなくなることがあります。
> Claude 本体のファイル（`claude.exe`、`app.asar`、インストール先）は一切変更しません。

## クイックスタート

### Windows

1. [Releases](https://github.com/zawa356/claude_ctrl-enter/releases) から最新の `claude-ctrl-enter-<版>.zip` をダウンロードし、好きな場所に展開します。
2. 展開したフォルダーの **`install.bat`** をダブルクリックします。
   診断結果が表示されたあと「続行しますか？ (Y/N)」と聞かれるので `Y` を入力します。
3. Claude を**完全に終了**してから（メニューの「ファイル → 終了」、またはタスクトレイのアイコンを右クリックして「終了」）、いつものアイコンから起動し直します。
4. 左サイドバーのプロフィール欄の上に **「⌨ キー設定　有効」** と表示されれば完了です。

> [!NOTE]
> ダウンロードした ZIP から実行すると「開いているファイル - セキュリティの警告（発行元を確認できませんでした）」が表示されます。**「実行」** を押してください。詳しくは[よくある質問](#よくある質問)を参照してください。

元に戻すときは **`uninstall.bat`** をダブルクリックし、Claude を完全に終了して起動し直します。

### Linux（実機未確認）

> [!WARNING]
> Linux 版 Claude Desktop（ベータ）での動作は、まだ実機で確認していません。スクリプトの動作は自動テストでのみ確認しています。動作報告を歓迎します。

1. ZIP を展開し、そのフォルダーで `bash install.sh` を実行します。`y` を入力すると導入します。
2. **ログアウトしてログインし直し**、Claude を起動します（環境変数を反映するため）。
3. 左サイドバーに「⌨ キー設定　有効」と表示されれば完了です。

元に戻すときは `bash uninstall.sh` を実行し、ログインし直します。診断は `bash diagnose.sh` です。

## できること

| 操作 | 標準の Claude | このツール導入後（初期設定） |
| --- | --- | --- |
| `Enter` | 送信 | 改行 |
| `Ctrl` + `Enter` | — | 送信 |
| 日本語入力の変換確定の `Enter` | 確定 | 確定のみ。送信も改行もしない |
| `/` コマンドやメンションの候補で `Enter` | 候補を選択 | 候補を選択（Claude の標準動作のまま） |

- サイドバーの「キー設定」から、送信キーと改行キーを `Enter` / `Ctrl+Enter` / `Shift+Enter` / `Alt+Enter` の中から選べます。
- 「キー設定を有効にする」のチェックを外すと、Claude 標準の操作に戻ります（アンインストール不要）。
- 設定は Claude を再起動しても、更新・再導入しても保持されます。
- 同じ共通ローダーを使う他のツール（例：Chat / Cowork の切り替えを戻す [claude-split-ui](https://github.com/zawa356/claude-split-ui)）と同時に使えます（0.4.0 以降）。

## 動作環境

| 項目 | 内容 |
| --- | --- |
| OS | Windows 10 / 11、Linux（Claude Desktop ベータが動く Debian / Ubuntu。実機未確認） |
| Claude | Windows: Claude Desktop（MSIX パッケージ版）。Linux: Claude Desktop ベータ |
| 動作確認済みの版 | Windows 版 2.26454.2、2.31226.0（0.4.x は 2.31226.0 で確認） |
| 必要なもの | Windows: Windows PowerShell 5.1（標準搭載）。Linux: bash と python3（3.8 以上。Ubuntu / Debian のデスクトップには標準搭載）。どちらも管理者権限は不要 |

macOS には対応していません（確認できる環境がないため）。

確認していない版でも、診断で警告が出るだけで導入はできます。動作しない場合は解除してください。

## 仕組みと影響範囲

Claude Desktop には、ユーザー環境変数 `REACT_PROFILE=1` が設定されていると、開発者向けの React DevTools 拡張を Claude の設定フォルダーから読み込む仕組みがあります。
このツールは、その読み込み先にキー操作用の小さな拡張を置きます。

読み込める拡張は1つだけなので、0.4.0 からは共通ローダー [claude-desktop-webext](https://github.com/zawa356/claude-desktop-webext) を使います（配布 ZIP に同梱）。ローダーは、同じ仕組みを使う他のツール（例：[claude-split-ui](https://github.com/zawa356/claude-split-ui)）の拡張とまとめて、読み込み先のフォルダーを作ります。そのため、それらのツールと同時に使えます。

導入で変更されるのは次のものだけです。

| 変更 | Windows | Linux |
| --- | --- | --- |
| 拡張のファイル（本体） | `%LOCALAPPDATA%\ClaudeDesktopWebExt\web-extensions\claude-ctrl-enter\` | `~/.local/share/claude-desktop-webext/web-extensions/claude-ctrl-enter/` |
| Claude が読み込むフォルダー（ローダーが作る） | `%APPDATA%\Claude\extensions\fmkadmapgofadopljbjfkapdkoienihi\` | `~/.config/Claude/extensions/fmkadmapgofadopljbjfkapdkoienihi/` |
| 環境変数 `REACT_PROFILE=1` | ユーザー環境変数 | `~/.config/environment.d/90-claude-desktop-webext.conf`（ローダー専用のファイル。既存の `~/.profile` などは書き換えない） |
| ローダーの記録とバックアップ | `%LOCALAPPDATA%\ClaudeDesktopWebExt\` | `~/.local/share/claude-desktop-webext/` |
| このツールの記録 | `%LOCALAPPDATA%\ClaudeKeys\` | `~/.local/state/claude-keys/` |

0.3.x 以前から更新すると、`install.bat` / `install.sh` が新しい方式へ自動で移行します。以前のフォルダーはバックアップへ移し、キーの設定は引き継がれます。移行した後は、0.3.x の `uninstall` は使えません（何もせずに中止します）。

注意点:

- `REACT_PROFILE` はユーザー全体の環境変数です。この名前を使う他の開発ツールがある場合は影響することがあります。
- Claude で本物の React DevTools を使っている場合、または `REACT_PROFILE` が別の値で設定されている場合、インストーラーは何も変更せずに中止します。
- 拡張が扱うのはキー操作と、キー割り当ての設定（有効/無効と2つのキー）だけです。入力内容を読み取ったり、外部に送信したりはしません。詳しくは [PRIVACY.md](PRIVACY.md) を参照してください。

## 更新・解除

- **更新**: 新しい版の ZIP を展開し、`install.bat` を実行します。以前のファイルは削除せず `%LOCALAPPDATA%\ClaudeDesktopWebExt\backups\` に移します。キーの設定は引き継がれます。
- **解除**: `uninstall.bat` を実行します。拡張のファイルはバックアップへ移します。ローダーを使う他のツールが残っていなければ、ローダーが設定した `REACT_PROFILE` も削除します。キーの設定は Claude 側に残るので、再導入すると元の設定に戻ります。
- どちらも、Claude を完全に終了して起動し直すと反映されます。スクリプトが Claude を終了させることはありません。
- 途中で失敗した場合は、自動で元の状態に戻します。

## 診断とトラブルシューティング

`diagnose.bat` を実行すると、Claude の版、設定フォルダー、拡張の導入状態、`REACT_PROFILE` を表示します。読み取りだけで、何も変更しません。

サイドバーの「キー設定」の右側の表示:

| 表示 | 意味 |
| --- | --- |
| 有効 / 無効 | 正常。設定どおりに動作しています |
| 読込中 | 起動直後。設定を読み込んでいます |
| 非対応（赤） | Claude の更新などで入力欄の仕組みが変わり、割り当てたキーが動作しません。キー設定を無効にすると Claude 標準の操作に戻ります |
| 送信不可（赤） | 送信ボタンを特定できなかったため、送信しませんでした |
| 改行不可（赤） | 改行を入れられませんでした |

## よくある質問

**「開いているファイル - セキュリティの警告」が表示される**
ダウンロードした ZIP に含まれるファイルには、Windows が「インターネットから取得したファイル」の印を付けるため、bat の実行時に「発行元を確認できませんでした。このソフトウェアを実行しますか？」と表示されます。内容に問題がなければ **「実行」** を押してください。
毎回の表示を避けたい場合は、ZIP を展開する**前に** ZIP ファイルを右クリック →「プロパティ」→「許可する」にチェック →「OK」を押してから展開します。
スクリプトはすべてテキストファイルなので、実行前に内容を確認できます（署名はしていません）。

**Claude を更新したら「キー設定」が消えた／非対応になった**
Claude の内部の仕組みが変わった可能性があります。`diagnose.bat` の結果を添えて Issue で報告してください。当面は `uninstall.bat` で元に戻せます。

**他のツール（claude-split-ui など）と一緒に使えますか？**
はい。0.4.0 以降は共通ローダー [claude-desktop-webext](https://github.com/zawa356/claude-desktop-webext) を使うので、同じローダーを使うツールとは、どちらを先に入れても同時に使えます。Windows・Claude 2.31226 で claude-split-ui との併用を確認済みです。どちらかを解除しても、もう一方はそのまま動きます。

**診断や導入の画面に英語が出る**
0.4.0 から、導入の処理は共通ローダーが行います。ローダーの表示は英語です。`[NG  ]` の行が無ければ問題ありません。

**キー設定が表示されない**
Claude を「完全に」終了したか確認してください。ウィンドウを閉じただけでは、タスクトレイで動き続けていることがあります。
別のツールが Claude の読み込むフォルダーを書き換えた場合も表示されなくなります。そのときは `install.bat` をもう一度実行すると、フォルダーが作り直されます。

## 既知の制限

- Claude の非公式な仕組みを利用しています。Claude の更新で動かなくなる可能性があります。
- 日本語入力は 1 種類の IME でのみ確認しています。
- 過去のメッセージの編集欄では、送信キーで送信できない場合があります（誤送信を避けるため、どの送信ボタンか特定できないときは送信しません）。
- `Enter` を押し続けても改行は 1 回だけです。
- `%APPDATA%\Claude` フォルダーが存在しない環境では導入を中止します。
- 共通ローダーの表示は英語です（このツールの案内は日本語）。
- Linux 版の導入には python3（3.8 以上）が必要です。

## 開発者向け

```powershell
git submodule update --init   # 共通ローダー（vendor/claude-desktop-webext）を取得
npm install        # テスト用の Playwright を取得（ブラウザーは Windows 標準の Edge を使用）
npm test           # キー処理・インストーラー（Windows / Linux）・設定画面・連携のテスト。Linux 用は Git Bash と python3 で実行（無ければスキップ）
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-release.ps1   # dist\ に配布用 ZIP を作成
```

- 構成: `extension/`（拡張本体）、`desktop-webext.json`（共通ローダーの設定）、`vendor/claude-desktop-webext/`（共通ローダー。git submodule）、`scripts/claude-keys.ps1` / `scripts/claude-keys.sh`（Windows / Linux の導入・更新・解除・診断）、`tests/`、`legacy/`（試作版 0.2.0 とその導入スクリプト。互換性の検証用）。
- 開発の経緯・設計判断・検証記録は [docs/AISTATE.md](docs/AISTATE.md)（AI エージェント向けの記録）と [docs/AI_HANDOFF_JA.md](docs/AI_HANDOFF_JA.md) にあります。AI エージェントで開発する場合は [AGENTS.md](AGENTS.md) を参照してください。
- 共通ローダー本体の修正・機能追加は [claude-desktop-webext](https://github.com/zawa356/claude-desktop-webext) で行い、このリポジトリでは submodule の参照先を更新します。
- 貢献の方法は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス

[MIT License](LICENSE)

「Claude」は Anthropic の商標です。このプロジェクトは Anthropic とは関係ありません。

### インストール先の検出（開発版）

共通ローダーはMSIX登録情報、起動中のClaude、従来版のレジストリ登録と標準配置先を確認します。
複数候補があり対象を決められない場合は、例として `diagnose.bat -ClaudePath "D:\Apps\Claude\claude.exe"`
で対象を指定できます。導入・解除にも同じ指定が可能です。Linuxは `--claude-path` を使います。
本体の検出と、そのビルドでの拡張動作確認は別です。従来版の実機動作は未確認です。
MSIXの仮想化されたデータフォルダーだけがある環境でも導入できます。拡張の配置先は従来のパスを維持します。
独自のユーザーデータフォルダーへの切り替えは行いません。
