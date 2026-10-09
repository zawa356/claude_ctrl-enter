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

## 動作環境

| 項目 | 内容 |
| --- | --- |
| OS | Windows 10 / 11、Linux（Claude Desktop ベータが動く Debian / Ubuntu。実機未確認） |
| Claude | Windows: Claude Desktop（MSIX パッケージ版）。Linux: Claude Desktop ベータ |
| 動作確認済みの版 | Windows 版 2.26454.2、2.31226.0 |
| 必要なもの | Windows: Windows PowerShell 5.1（標準搭載）。Linux: bash と coreutils。どちらも管理者権限は不要 |

macOS には対応していません（確認できる環境がないため）。

確認していない版でも、診断で警告が出るだけで導入はできます。動作しない場合は解除してください。

## 仕組みと影響範囲

Claude Desktop には、ユーザー環境変数 `REACT_PROFILE=1` が設定されていると、開発者向けの React DevTools 拡張を Claude の設定フォルダーから読み込む仕組みがあります。
このツールは、その読み込み先にキー操作用の小さな拡張を置きます。

導入で変更されるのは次の 3 つだけです。

| 変更 | Windows | Linux |
| --- | --- | --- |
| 拡張のファイル | `%APPDATA%\Claude\extensions\fmkadmapgofadopljbjfkapdkoienihi\` | `~/.config/Claude/extensions/fmkadmapgofadopljbjfkapdkoienihi/` |
| 環境変数 `REACT_PROFILE=1` | ユーザー環境変数 | `~/.config/environment.d/90-claude-ctrl-enter.conf`（このツール専用のファイル。既存の `~/.profile` などは書き換えない） |
| 導入記録とバックアップ | `%LOCALAPPDATA%\ClaudeKeys\` | `~/.local/state/claude-keys/` |

注意点:

- `REACT_PROFILE` はユーザー全体の環境変数です。この名前を使う他の開発ツールがある場合は影響することがあります。
- Claude で本物の React DevTools を使っている場合、または `REACT_PROFILE` が別の値で設定されている場合、インストーラーは何も変更せずに中止します。
- 拡張が扱うのはキー操作と、キー割り当ての設定（有効/無効と2つのキー）だけです。入力内容を読み取ったり、外部に送信したりはしません。詳しくは [PRIVACY.md](PRIVACY.md) を参照してください。

## 更新・解除

- **更新**: 新しい版の ZIP を展開し、`install.bat` を実行します。以前のファイルは削除せず `%LOCALAPPDATA%\ClaudeKeys\backups\` に移します。キーの設定は引き継がれます。
- **解除**: `uninstall.bat` を実行します。拡張のフォルダーはバックアップへ移し、このツールが設定した `REACT_PROFILE` を削除します。キーの設定は Claude 側に残るので、再導入すると元の設定に戻ります。
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

**キー設定が表示されない**
Claude を「完全に」終了したか確認してください。ウィンドウを閉じただけでは、タスクトレイで動き続けていることがあります。

## 既知の制限

- Claude の非公式な仕組みを利用しています。Claude の更新で動かなくなる可能性があります。
- 日本語入力は 1 種類の IME でのみ確認しています。
- 過去のメッセージの編集欄では、送信キーで送信できない場合があります（誤送信を避けるため、どの送信ボタンか特定できないときは送信しません）。
- `Enter` を押し続けても改行は 1 回だけです。
- `%APPDATA%\Claude` フォルダーが存在しない環境では導入を中止します。

## 開発者向け

```powershell
npm install        # テスト用の Playwright を取得（ブラウザーは Windows 標準の Edge を使用）
npm test           # キー処理・インストーラー・設定画面・連携のテスト
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-release.ps1   # dist\ に配布用 ZIP を作成
```

- 構成: `extension/`（拡張本体）、`scripts/claude-keys.ps1` / `scripts/claude-keys.sh`（Windows / Linux の導入・更新・解除・診断）、`tests/`、`legacy/`（試作版 0.2.0 とその導入スクリプト。互換性の検証用）。
- 開発の経緯・設計判断・検証記録は [docs/AISTATE.md](docs/AISTATE.md)（AI エージェント向けの記録）と [docs/AI_HANDOFF_JA.md](docs/AI_HANDOFF_JA.md) にあります。AI エージェントで開発する場合は [AGENTS.md](AGENTS.md) を参照してください。
- 貢献の方法は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス

[MIT License](LICENSE)

「Claude」は Anthropic の商標です。このプロジェクトは Anthropic とは関係ありません。
