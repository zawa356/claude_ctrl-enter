# Claude Desktop キー設定拡張 — AI向け完全引き継ぎ書

作成日: 2026-10-08（Asia/Tokyo）  
引き継ぐ実装: 拡張manifest version **0.2.0**  
対象実機: **Windows版Claude Desktop 2.26454.2（MSIXパッケージ2.26454.2.0）**

## 1. この資料の位置づけ

この資料は、ChatGPT/Codex側で段階的に実験・実装した成果を、VS Code上のAIに引き継ぐための技術記録である。会話の逐語録ではなく、意思決定・実装根拠・成功と失敗・未検証事項を再構成したもの。実装の最終的な事実は同梱ソースを優先し、ユーザーの実機確認とAIの模擬テストを混同しないこと。

ユーザーの直近の依頼は「ここでいったん整理し、ファイル一式と、経緯をできるだけ詳しく記載したAI向け指示書を受け取り、VS Codeへ移りたい」である。このパッケージを作る段階では新機能を追加せず、導入済み拡張にも変更を入れていない。GitHub公開は将来目標であり、まだリポジトリ作成・push・公開・ライセンス選定はしていない。

元の開発用フォルダー名は `claude-enter-probe`。初期の読み込み試験から発展したため、ファイル名や拡張名には `probe` が残っている。無計画な改名は解除スクリプトの所有判定を壊すので注意。

## 2. ユーザーの目的・好み・非交渉条件

主目的は **日本語IME確定と競合しないEnter改行・Ctrl+Enter送信**。その後、割り当て変更、有効／無効、再起動後の保存も追加した。

ユーザーは、専用ランチャーを使う案を明確に嫌った。理由はMSIXのアイコン・タスクバー・既存起動体系を保ちたいから。最終的に「通常のClaudeアイコンで起動すると自動で機能が有効」「導入はPowerShellやbat等で簡単に」「将来的にGitHubで公開」「ある程度の更新に追従」を望む。

守ること:

- WindowsApps配下の所有権／ACLを変更しない。
- 元のMSIX、署名、claude.exe、app.asarを改変しない。
- バックアップを維持する。既存設定・他の拡張を上書きしない。
- 専用ショートカットや別ランチャーへの置き換えを前提にしない。
- ユーザーの操作は1ステップずつ。大量のコマンドを一度に渡してはいけない。
- 必要な読取調査や通常の可逆的開発は進めてよいが、実機の再起動・送信操作は勝手に行わない。
- Claudeのユーザー設定・会話・認証情報を成果物に含めない。

設定UIの理想は左上の「ファイル・編集…」と同じネイティブメニューへの専用項目だった。しかし現在の拡張の権限では到達できる経路が見つからず、ユーザーは **左サイドバーのプロフィール欄の上に独自の「キー設定」を設置する案**を了承した。右下に固定した緑色バッジはモデル選択等に重なるため却下され、0.2.0で撤去した。そこへ戻さないこと。

## 3. 現時点の成果と未達事項

### ユーザーが実機で確認したこと

1. `REACT_PROFILE=1` とユーザーフォルダー内の拡張だけで、通常のアイコンから拡張を自動読み込みできた。
2. 拡張のMAIN worldからチャットのエディターAPIへアクセスできた。
3. IMEでの日本語変換確定、全角や句読点等の記号の確定が正常だった。
4. Enterで送信されず改行できた。
5. Ctrl+Enterで送信できた。
6. 別チャットへ移動してもキー変更は続いた。
7. サイドバーの「キー設定」が表示された。
8. 送信・改行キーの割り当て変更ができた。
9. 有効／無効を切り替えられた。
10. 変更した設定はClaudeを終了・通常再起動しても保持された。

### 未検証または未完成

- 別のClaudeバージョン／自動更新後／別PC。
- Windowsの再起動、サインアウト、別ユーザー、管理された組織環境。
- 全IME、全候補メニュー、スラッシュコマンド、メンション、箇条書き、コードブロック、複数エディター、複数ウィンドウ。
- Cowork等の別モード全体。
- 公開向けの更新・修復・再インストール・トランザクション型ロールバック。
- 実機でのアンインストール往復検証。
- 配布先、正式名称、ライセンス、npm依存定義とlockfile、CI、Release ZIP生成。
- ネイティブアプリメニューへの項目追加。

「動作確認済み試作」と「一般配布可能な完成品」は違う。次のAIはこの差を埋める。

## 4. 調査対象とローカル環境（個人パスは省略）

元の実行ファイル:

```text
C:\Program Files\WindowsApps\Claude_2.26454.2.0_x64__pzs8sxrjxfjjc\app\claude.exe
```

元app.asarはその `app\resources\app.asar`。解析用コピーは次にある（同梱していない）:

```text
%LOCALAPPDATA%\ClaudePatchLab\app.asar
```

解析用コピーのサイズは44,684,689 bytes。package.json:

```text
name: @ant/desktop
version: 2.26454.2
main: .vite/build/index.pre.js
engines.node: >=22.0.0
devDependencies.electron: catalog:
```

`engines.node` はClaude側package.jsonの値であり、この拡張の最低Node要件を意味しない。Electronの正確なバージョンは本作業では確定していない。

PowerShell `Get-AppxPackage -Name '*Claude*'` でName、Version、PackageFamilyName、InstallLocationが取得できることを確認した。PackageFamilyNameは `Claude_pzs8sxrjxfjjc`。

実際のユーザーデータは元PCでは `%APPDATA%\Claude` だった。MSIXだからといって `%LOCALAPPDATA%\Packages\...\LocalCache\Roaming\Claude` と決めつけない。後者はこのPCでは存在しなかった。

## 5. app.asar解析の進め方と結果

WindowsAppsやバックアップを書き換えず、PythonでASARヘッダーを解析し、対象エントリーだけメモリへ読んだ。ASAR内のコードは実行していない。通常のエントリーについて、先頭16 bytesを `<4I` として読み、JSON長を使ってファイルツリーを取得し、データ本体を `8 + headerSize + entry.offset` から読む方式だった。一般ツールにするならASAR形式、unpacked、サイズ、境界を厳密に検証すること。この簡易解析をそのまま公開インストーラーに流用しない。

調査結果:

- `.vite/build/index.pre.js`: 1,091,008 bytes。Sentry初期化、起動処理、制限等。末尾で `require('./index.js')`。
- `.vite/build/index.js`: 638 bytes。`index.chunk-DXZLTdFR.js` と `index.chunk-CJN9s-60.js` をrequireする入口。エントリーのSHA256とアーカイブ内integrity値が一致した。
- `.vite/build/index.chunk-DXZLTdFR.js`: 1,802 bytes、バンドル共通ヘルパー。
- `.vite/build/index.chunk-CJN9s-60.js`: 7,157,374 bytes、メイン処理の大きなバンドル。
- `.vite/build/mainView.js`: チャット側preload、164,300 bytes。
- `.vite/build/mainWindow.js`: 外枠側preload、88,218 bytes。

メインの外枠は `.vite/renderer/main_window/index.html` をloadFile。チャットは別のWebContentsViewでURLをloadURLする。通常のチャット表示先はclaude.ai。`mainView.js` はネイティブ機能との橋渡しであり、通常の送信Enterの実装そのものは見つからなかった。

最初は `loadExtension` を主要ファイルだけで探したため、MCP/DXTの `loadExtensionMetadata` しか見つからなかった。その後、ASAR内のJavaScript全体を検索して、本当のElectron拡張読み込み経路を別chunkで発見した。この経緯から「主要バンドルにない＝機能がない」と早合点しないこと。

## 6. 開発者モードとDOM調査の経緯

Claudeのメニューで「ヘルプ → トラブルシューティング → 開発者モードを有効化…」が存在することをユーザーの画面で確認。ユーザーが有効化した。その後、入力欄をクリックしてCtrl+Alt+IでDevToolsを開いた。

内部実装で `developer_settings.json` の `allowDevTools` を読み、DevToolsを許可する経路がある。現在のインストーラーはこのファイルの**存在だけ**を検査する。有効なJSONやallowDevTools=trueの検査ではないし、拡張の通常読み込みに開発者モードが本当に必須かも未検証。公開版で要件にするなら確認すること。

調査中、ConsoleのURLが `/artifacts/design` に切り替わっていて入力欄0件となった。新しいチャット `/new` に戻して入力欄1件を確認。今後も実行先のURL・フレームを確認する。`undefined` はConsole呼び出しの戻り値であり、エラーではない。

確認した入力欄:

```text
tag: DIV
role: textbox
contenteditable: true
class: tiptap ProseMirror
```

```js
const el = document.querySelector('.tiptap.ProseMirror');
// 実機で確認:
!!el.editor                                  // true
typeof el.editor.commands.setHardBreak       // 'function'
typeof el.editor.commands.keyboardShortcut   // 'function'
!!el.pmViewDesc?.view                        // false
```

エディターの拡張やプラグインからEnter送信処理を追う調査もした:

- addKeyboardShortcutsにはShift-Enter/Alt-Enterなどが出たが、送信処理の本体は見えなかった。
- editor.view.props.handleKeyDown / handleDOMEvents.keydownは空。
- editor.state.pluginsのpropsの関数文字列はbind済みのため `[native code]` ばかりだった。
- p.spec.propsを読むと共通のキーマップ振り分け処理は見えたが、closure内のキー対応表や送信処理を確定できなかった。

そこで内部送信コマンドを追いかける方針をやめ、既存送信ボタンを使う方針に切り替えた。確認したボタン:

```text
type: button
aria-label: メッセージを送信
data-testid: chat-input-send
disabled: true（空の入力欄だった時点）
```

翻訳されたラベルではなく `data-testid` を使う。フォームのsubmitや推測した内部APIを呼ばない。

## 7. Console試作からキー処理へ

最初はConsoleでwindowのcaptureリスナーを登録する一時パッチを試した。Enter単独では `editor.commands.setHardBreak()`、Ctrl+Enterでは一意な可視送信ボタンのclickを使った。IME中はアプリの送信ハンドラーへの伝播を止めるが、ブラウザー側の変換確定動作を残すためpreventDefaultしない。compositionend直後100msは追加のEnterを抑止した。

ユーザーは段階的にIME確定、Enter改行、Ctrl+Enter送信を確認した。一時パッチは再読み込みで消えるため、次に永続化を検討した。

当時利用可能と確認した `keyboardShortcut` は現在の実装では使っていない。合成Enterを発火して送信させる方式も採用していない。

## 8. 永続化案の比較と重要な訂正

### 採用しなかったもの

**専用ランチャー + CDP起動オプション**:
Electron一般にはremote-debugging-portがあるため一時候補になった。しかしユーザーは専用ランチャーを望まなかった。さらに後のindex.pre.js解析で、Claude自身が `remote-debugging-port` / `remote-debugging-pipe` 等の引数を検知し、通常は起動を拒否することが判明。Electronの一般仕様だけから、このClaudeで動くと判断してはいけない。開発用の署名付き認可の仕組みも見つかったが、それを取得・偽造・回避する作業はしていない。

**NODE_OPTIONSによる起動フック**:
実行ファイルのElectron fuseを読み取った結果、この個体ではNODE_OPTIONS機能とNode CLI inspect引数が無効。読み取りのみでfuseは変更していない。ASAR整合性検証・ASAR限定ロードは有効だった。公式のfuse列挙順を参照して確認した。NODE_OPTIONSをユーザー環境へ追加しても解決する見通しはなかった。

**app.asarの直接改造**:
ユーザーの制約に反するため行っていない。整合性・署名を壊して成立させる方針ではない。

**メニューの「拡張機能をインストール」**:
ユーザーがDevTools有効化後に発見したが、Claude用のMCP/DXT系拡張の経路であり、任意のChrome content-script拡張を読み込むと確認できたものではない。今回の拡張はそこからインストールしていない。

### 採用した非公式な読み込み経路

Claudeのメインバンドルに、起動時に `process.env.REACT_PROFILE === '1'` を見てReact DevToolsを読み込む分岐を発見した。対象ビルドではメイン画面の生成前に実行される。

- 呼び出し側: `index.chunk-CJN9s-60.js`
- loader: `index.chunk-CyhXezGH.js` のloadReactDevTools
- 同梱installer: `index.chunk-PxSko8Uk.js`
- 指定されるReact DevTools ID: `fmkadmapgofadopljbjfkapdkoienihi`
- キャッシュ場所: `app.getPath('userData')/extensions/<ID>`

installerはそのフォルダーが存在しforceDownloadでなければ、再ダウンロードせず既存フォルダーをloadExtensionする。この経路を利用し、フォルダー名は指定ID、manifestのnameは独自名にした確認用拡張を置いた。React DevTools本体を同梱・転載したわけではない。IDに対応する公開鍵を生成・借用したわけでもない。

**フォルダー名のIDと、実際にChromiumが割り当てる拡張IDは同一だと確認していない。** manifestにkeyは指定していない。再起動後の保存は実機で確認できたが、移設・ロードパス変更・拡張の改名時に設定が失われないかは別途確認が必要。

fallbackとしてChromeのReact DevToolsを探すコードもあり、そのパスはmacOS型だった。今回成功したのはキャッシュ読み込み側であり、そのfallbackに依存していない。

この方式は、非公式な「開発ツール用キャッシュから自前の拡張を読む」利用である。正式な任意拡張登録機能として説明しない。読み込み経路の削除、キャッシュ検査強化、アップデート時の変更で動かなくなる可能性がある。

## 9. 導入に加えた変更と元PCの状態

変更した場所は次の2種類:

1. ユーザー環境変数 `REACT_PROFILE=1`。
2. `%APPDATA%\Claude\extensions\fmkadmapgofadopljbjfkapdkoienihi` 内の自作拡張3ファイル。

導入前は対象拡張フォルダーが存在せず、ユーザー・マシンのREACT_PROFILEも競合する設定がなかった。だから既存React DevToolsを置き換えずに試せた。他ユーザーでも同じとは限らない。

状態記録と解除スクリプト:

```text
%LOCALAPPDATA%\ClaudePatchLab\enter-probe-state\state.json
%LOCALAPPDATA%\ClaudePatchLab\enter-probe-state\uninstall-probe.ps1
```

過去版のバックアップ:

```text
%LOCALAPPDATA%\ClaudePatchLab\enter-probe-state\backup-load-probe-20261008-171515
%LOCALAPPDATA%\ClaudePatchLab\enter-probe-state\backup-keyboard-20261008-215258
```

これらは個別PCの状態であり、ZIPへ同梱していない。移行後に見当たらない場合は推測で再作成・削除せず確認すること。現在のソース3ファイルと導入先3ファイルのSHA256が一致することをパッケージ作成時に確認した。

ユーザー環境変数はClaude専用ではなく、新しく起動する他のプロセスにも継承され得る。REACT_PROFILEを使用する別の開発環境への影響があり得るので、公開版では説明と原状復帰が必要。通常アイコンでの再起動時に継承されたことはこのPCで確認済みだが、全起動経路・OS再起動を保証しない。スクリプトは.NETのSetEnvironmentVariableを使っており、独自のWM_SETTINGCHANGEブロードキャスト処理は追加していない。

## 10. リリースに至っていない3段階の試作

### 0.0.1 — 読み込み確認

manifest v3のcontent_scriptsを2本置いた。1本はMAIN worldでエディターAPIの存在のみ確認し、もう1本は通常のcontent-script worldで緑色の表示を作った。「読込OK・入力欄API OK（キー変更なし）」をユーザーが通常起動後に確認した。テキスト内容は取得せず、送信もしていない。

### 0.1.0 — 永続化されたキー操作

Consoleで成功したキー操作をMAIN worldのスクリプトへ移植。AbortController、入力欄ごとのIME状態、送信ボタン一意性検査、無効ボタン検査、API不在時の停止を追加した。緑色表示は「Enter改行・Ctrl+Enter送信：有効（試験版）」となった。

ユーザーは通常起動、IME／記号、改行、送信、チャット切り替えを確認した。

### 0.2.0 — 設定UIと保存

右下表示がモデル選択等に重なるため撤去。サイドバーに「キー設定」を置き、専用dialogから有効／無効とキー割り当てを変更する。chrome.storage.localで保存。通常起動後の再読込まで実機で確認できた。これが今回引き継ぐ版。

## 11. 現行manifestと2つのworld

`manifest.json` はManifest V3。nameは解除スクリプト互換のため `Claude Enter Patch - Load Probe` のまま。versionは0.2.0。

- 対象URL: `https://claude.ai/*` のみ。
- all_frames: false。
- run_at: document_idle。
- main-probe.js: world MAIN。
- badge.js: 通常のisolated world。
- permission: storageのみ。
- service worker、background、外部サーバー、nativeMessaging、CDP接続、外部送信はない。

MAIN worldを使う理由は、ページのDOM要素にClaudeが付けた `el.editor` へアクセスするため。isolated worldからそのページ固有オブジェクトがそのまま見えるとは限らない。逆に設定保存用Chrome APIはisolated側で扱う。

2つのworld間はDOM attribute/eventで連携:

```text
attribute: data-claude-enter-settings
event: claude-enter-settings-changed
status attribute: data-claude-enter-probe-main
```

isolated側が検証したJSONをattributeに入れ、Eventをdispatch。MAIN側がJSONを読み、enabledの型、キーの許可リスト、重複しないことを確認する。起動順序の差に対応するため、MAIN開始時もattributeを読む。

このDOMブリッジは認証境界ではない。同一ページのスクリプトは値やイベントを変更し得る。扱うのはキー設定だけで、秘密情報を入れない。将来APIを増やす際に、任意コード実行・任意ファイル操作をこのブリッジに足してはいけない。

## 12. main-probe.jsの詳細

起動時にtop frameとoriginを確認。`window.__claudeEnterPatch?.abort()` で既存の同パッチのリスナーを解除し、新しいAbortControllerを保存する。二重登録防止用である。

入力欄セレクター:

```css
.tiptap.ProseMirror[contenteditable="true"]
```

keydown等はwindowのcaptureリスナーで受け、event.target.closestで入力欄を特定する。エディターDOMを最初の1個に固定しないため、チャット切り替え後の新しい入力欄にも対応できた。

IME状態は入力欄ごとのWeakMap:

```js
{ composing: false, endedAt: -Infinity }
```

- compositionstartでcomposing=true。
- compositionendでfalseとperformance.now()を記録。
- focusoutでcomposing=falseにする。
- event.isComposing、keyCode=229、editor.view.composingも併用。
- IME中のEnterはstopImmediatePropagationのみ。preventDefaultしない。
- compositionend後100ms未満のEnterはpreventDefaultとstopImmediatePropagationで抑止。
- 無効設定時はキー処理の入口でreturnし、Claudeの元の操作とIME処理に任せる。

設定可能キーは Enter / Ctrl+Enter / Shift+Enter / Alt+Enter。任意文字キーや複数修飾キーの自由な記録UIではない。metaKey付きは対象外。送信・改行の一致を拒否。

割り当てたキーを処理する前にpreventDefaultとstopImmediatePropagation。repeatなら実処理しない。setHardBreakが関数として存在しない場合は処理停止。改行はそのコマンドがtrueを返す場合のみ成功扱い。

送信は `button[data-testid="chat-input-send"]` をqueryし、getClientRects().lengthがあるものが1個だけの場合に限る。disabledとaria-disabledを調べてclick。これは「本当に1つの入力欄に対応するか」まで証明するものではなく、複数エディター画面は未検証。

未割当のEnterとCtrl+Enterは抑止する。未割当のShift+Enter/Alt+Enter、その他の組合せはClaude側へ通す。以前のREADMEの「Shift/Alt/Metaはそのまま」は初期版説明であり、0.2.0ではShift/Altを割り当てるとパッチが処理する。

ステータスはactive/disabled/waiting/unsupported/send-unavailable/newline-unavailableをDOM属性に書く。0.2.0のUIはこのステータスを表示しておらず、有効／無効ラベルは設定値だけである。API非対応をユーザーが見落とす余地があるので公開前改善候補。

## 13. badge.js（現・設定UI）の詳細

歴史的ファイル名であり、今は右下バッジではない。通常のisolated worldからchrome.storage.localを利用する。

保存キー:

```text
claudeEnterSettingsV1
```

既定値:

```json
{ "enabled": true, "send": "Ctrl+Enter", "newline": "Enter" }
```

保存内容はこの3項目だけ。会話本文、アカウント情報、送信内容、認証情報は保存していない。拡張自身にnetwork呼び出しはない。

UIは独自hostにShadow DOMをattach。現在modeはopen。CSSを局所化し、既存のReact設定画面を改変しない。設定はnative HTML dialogのshowModalで表示するため、サイドバーのoverflowに閉じ込められずページ中央に出る。開いている間はmodalとしてページ操作を遮る。

項目:

- 有効チェック。
- 送信キーselect。
- 改行キーselect。
- 初期値（フォームの下書きのみ変更）。
- 閉じる（未保存内容を破棄）。
- 保存（重複検査→storage保存成功→MAINへ通知→UI更新→dialogを閉じる）。

chrome.storage.onChangedで他のページ側からの有効な変更も受けて更新する。これは設計として実装したもので、複数ウィンドウ同期そのものの実機確認はしていない。

読込失敗時は既定値で動作し、メッセージを保持する。書込失敗時はエラーを表示し、設定を反映しない。ただし保存APIの途中でonChangedが先行する場合などはさらに検証したい。

## 14. プロフィール欄の実測構造と配置

ユーザーにConsoleでDOM構造のみを取得してもらった。ボタンのouterHTMLにはプロフィールの情報も含まれたが、それらは同梱していない。配置に必要なのは以下だけ:

```text
BUTTON [data-testid="user-menu-button"]
  親: DIV .min-w-0.flex-1                         display:block
    親: DIV .df-footer-row ...                   display:flex; direction:row
      親: DIV .df-bottom-tray ...                display:block
        親: DIV [data-testid="sidebar"] ...     display:flex; direction:column
          親: ASIDE .dframe-sidebar ...          display:flex; direction:column
```

重要なのは、ボタン直前に同じ横並び階層で挿入するとプロフィール／他ボタンを押しのけてしまうこと。現在は `profile.closest('.df-footer-row')` の親が `.df-bottom-tray` であること、そのtrayが検出したsidebar内にあることを検証し、**tray.insertBefore(host, row)** している。footer-row自体の横並びは維持する。

- host ID: `claude-enter-settings-entry`。
- hostは通常フロー、幅100%、固定表示ではない。
- MutationObserverでページ再構築を監視し、hostが外れたとき再配置。
- requestAnimationFrameでmount呼び出しをまとめる。
- ResizeObserverでsidebarの幅が160px未満ならhostを非表示にする。
- 配置構造が一致しなければ挿入を諦め、入力欄への固定表示にフォールバックしない。

host.isConnectedだけで現在の配置の正当性を判定する箇所は改善余地がある。sidebarを丸ごと作り替えるケース、同時に複数のsidebarがDOM上にあるケース、railとoverlay表示は広く検証していない。

## 15. ネイティブメニューを採用しなかった理由

ElectronのMenuはmain process側のAPI。ClaudeのmainWindow preloadには `requestMainMenuPopup` があり、既存メニューを開くことはできるが、任意のMenuItemを登録するAPIは見つからなかった。メイン側にsetApplicationMenuとpopupの処理があることは確認した。

「Enable Main Process Debugger」の項目はnode inspectorを開く機能として存在したが、再起動ごとに任意のメニュー項目を永続追加する解決ではない。利用・有効化はしていない。

今回のChrome拡張からメインプロセスへ自由にアクセスできると思い込まない。UIの希望を満たすために、今ある安全な境界を破る本体パッチや隠れた権限追加を勝手に導入しない。

## 16. インストーラーと解除スクリプトの実際

### install-probe.ps1

公開用ではなく、初回試験用である。現行版では:

1. `%APPDATA%\Claude\developer_settings.json` の存在を確認。
2. 対象拡張フォルダーまたはstateRootがあれば停止。
3. REACT_PROFILEのユーザー既存値がある、またはマシンに値があれば停止。
4. stateRootを作り、status=preparedのstate.jsonと解除スクリプトを保存。
5. 拡張3ファイルをコピー。
6. ユーザー環境変数を1に設定。
7. status=installedへ更新。

問題: 途中失敗時の自動ロールバックがなく、preparedや部分フォルダーが残り得る。初回の不存在確認からコピーまでの競合も考慮していない。導入前のClaudeバージョンや内部フックの検査もない。存在検査だけでuserDataを決めている。

元PCには既にstateRootがあるので、このスクリプトを移行後すぐ実行しても更新はできない。これまでの0.1.0/0.2.0更新は、AIがmanifestの名前・バージョンを確認し、旧3ファイルをバックアップしてからコピーし、SHA256一致を確認する手順で行った。update.ps1はまだ存在しない。

### uninstall-probe.ps1

state.jsonから対象を読み、期待されるAPPDATAパスとの完全一致を確認する。REACT_PROFILEが導入後に別値へ変わっていたら停止。対象manifestのnameがprobeのものか確認し、フォルダーをstateRoot配下のremoved-extensionへmoveする。再帰削除はしない。環境変数は元値を復元する分岐があるが、現installは既存値を拒否するため、実際の状態は「元は未設定」である。最後にstatus=removedとする。

既知の限界:

- 解除の実機往復は未実施。
- state.jsonがない・壊れた・移されたときの復旧UIがない。
- 解除先archiveが既に存在すると停止する。
- status=removedでもstateRootが残るため、そのままinstallは再実行できない。
- manifest名で所有判定するため改名で解除できなくなる。
- 存在する空文字の環境変数など、レジストリ値の特殊ケースを十分検証していない。
- 実行中のClaudeに拡張がロード済みなら、ファイルを退避してもメモリ上では動き続け得る。ユーザーによる完全終了・再起動が必要。
- chrome.storage.localのデータ消去はしていない。完全消去／保存の選択は設計していない。

これらを理由に、今のps1をそのまま一般向けワンクリック導入として宣伝しない。

## 17. テストと証拠の範囲

### test-keyboard.cjs

Node vmの中でwindow/document/Element/時計/送信ボタンを模擬し、実際のmain-probe.jsを評価する。外部依存なし。

確認項目は改行、送信、長押しrepeat、IME中、compositionend直後100ms、keyCode229、isComposing、Shiftの未割当通過、対象外要素、disabled、複数ボタン、二重導入、API欠落、abort解除。0.2.0で無効、割り当て変更、未割当Enter抑止、不正重複設定の無視も追加。

これはブラウザーの実際のIMEイベント順序やProseMirrorの実際の挙動を再現するものではない。100msがすべての入力環境で適切だと証明するものでもない。

### test-settings-ui.cjs

PlaywrightでヘッドレスMicrosoft Edgeを起動。全リクエストを模擬HTMLに差し替え、模擬サイドバーへbadge.jsを挿入。chrome.storage.localはlocalStorageで模擬する。

設定dialogの表示、同じキーの拒否、保存、有効無効の保存値、再度開いたときの値、初期値ボタンを押して閉じた場合に未保存のままであることを確認。`settings-preview.png` を生成する。既存ユーザープロファイルは使用しない。

このテストはmain-probe.jsとのブリッジを同時実行する統合テストではない。Electronのchrome.storage実装、拡張の権限、再起動後の読込は実機確認が根拠。公開前に両worldを含めた統合試験と、エラー系の自動試験を追加するとよい。

パッケージ作成前までに上記テストは成功し、最終UIのスクリーンショットも確認した。ユーザーによる実機保存・再起動確認はその後に成功している。元README末尾の「次の再起動確認が必要」は古い記述として履歴用に残した。

## 18. 公開前に優先したい改善（提案、未実装）

### A. 導入・更新・解除の堅牢化

- 通常起動を維持し、対象Claudeと実際のuserDataを確認する診断を作る。
- インストール／更新／修復／解除の状態遷移を分ける。
- バックアップ、所有判定、失敗時復旧、重複実行防止、PowerShell 5.1と7、日本語・空白パスを検証する。
- React DevToolsの既存利用は勝手に置換しない。両立方法がなければ理由を説明して停止する。
- REACT_PROFILEが元々設定されている場合の扱いを決める。ユーザー全体に届く副作用を明示する。
- batラッパーを作るならスクリプトの失敗を隠さない。グローバルExecutionPolicy変更を自動で行わない。
- 動作中アプリを強制終了しない。未送信入力の破棄を避ける。

### B. 設定・キー処理の問題

- 現在、MAINは既定の有効状態から始まり、保存済み設定の非同期読み込み前に短い有効期間が生じ得る。保存が無効の場合の起動直後、Storage APIエラー時の挙動を設計する。
- disabled時にも設定項目は常に使える状態を保つ。
- API非対応やセレクター変更時の表示と実際の動作を一致させる。有効ラベルを過信させない。
- 100msのIMEガードを複数IMEで検証し、必要ならよりイベント駆動の設計へ改良する。
- 送信ボタンを対象入力欄の領域に結び付ける。複数表示画面で誤送信しないことを確認する。
- スラッシュメニュー等でEnter選択が必要な場合と、改行・送信をどう優先するか決める。
- Shift/Altの未割当キーを元のClaudeへ通す仕様を利用者に明確にする。任意キー拡張は競合検査も必要。
- APIコマンドの戻り値false、例外、入力欄破棄、IME中に設定変更を検証する。

### C. UI・保存の強化

- 正常時の控えめなサイドバー表示は保つ。入力欄に固定表示を戻さない。
- sidebar構造が変わった場合、初期化失敗・操作不能を診断できるようにする。
- 複数ウィンドウ、rail、狭幅、ダークモード、拡大縮小、キーボード操作、スクリーンリーダーを検証。
- パネルを開いている間に別ページから設定が変わるケース、保存エラー、保存API不存在、破損設定、設定削除に対応する。
- chrome.storageの拡張ID依存を調査し、公開用改名やパス変更で設定を失わない移行を設計する。
- 既存UI重複生成の防止やobserverの解除も確認する。

### D. GitHub公開準備

- まず新しい開発場所にローカルGitを作り、現在の検証済み状態を保存するのがよい。ただし移行パッケージ自身には.gitはない。
- 正式名称、manifest名、ディレクトリ名、状態保存先の変更は移行と解除互換を伴う。
- ライセンスはユーザーと決める。勝手にMIT等を付けない。
- 公開READMEは内部フック依存・対応確認版・制約・元に戻す方法を明記。
- npm依存、lockfile、テストコマンド、CI、Release ZIPとハッシュを整備。
- Claude本体／React DevToolsコードは配布しない。解析ログやユーザーの画面キャプチャも含めない。
- セレクターや内部chunk名に依存した互換性チェックは、未知の版を闇雲に許可しない一方、全バージョン固定で使えなくする過剰制限も避ける。対応版の記録と能力検査を分ける。
- 自動更新や外部コード取得は現段階で入っていない。追加する場合は公開範囲・信頼モデルを改めて設計する。

## 19. 次のAIが最初にやるとよいこと

1. この資料とコードを照合する。プロトタイプを「きれいにする」前に、なぜ現在の形なのか理解する。
2. 必要ならSHA256SUMSで移行時の一致を確認し、テストを実行する。
3. 元PCで継続するなら導入先と開発先を区別し、再installはしない。
4. 公開準備の改善を少数のまとまりに分け、ユーザーに優先順位を伝える。
5. 最初の実装変更は、動作維持とロールバックが確認できる小さな単位にする。

ユーザーは「説明だけで止まる」より実際の作業を望むが、実機操作を一度に多く頼まれることは嫌う。こちらでできる検証を進め、必要なときに1つだけ確認してもらう。

## 20. 公式資料・調査の参照先

- Electron Chrome extension support: https://www.electronjs.org/docs/latest/api/extensions
  - サポートはChrome全互換ではない。
  - loadExtensionの呼び出しをアプリ起動ごとに行う必要がある。
  - persistent sessionで読み込む。
- Electron Extensions API: https://www.electronjs.org/docs/latest/api/extensions-api
- Electron environment variables: https://www.electronjs.org/docs/latest/api/environment-variables
  - packaged appでのNODE_OPTIONS制限とfuseの影響。
- Electron fuses: https://www.electronjs.org/docs/latest/tutorial/fuses
- Fuseの列挙定義: https://github.com/electron/fuses/blob/main/src/config.ts
- Electron supported CLI switches: https://www.electronjs.org/docs/latest/api/command-line-switches
  - Electron一般の仕様であり、Claude独自の起動拒否より優先しない。
- Electron Menu: https://www.electronjs.org/docs/latest/api/menu
  - main process API。現在のChrome拡張から直接呼べるものではない。
- Windows環境変更通知: https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-settingchange

これらは調査時点の資料であり、将来バージョンの仕様は再確認すること。Claude内部の挙動の根拠は、対象2.26454.2のコピーを読み取った結果とユーザーの実機確認である。

## 21. 最後のユーザー確認の要約

ユーザーは0.2.0について「キー設定が出た」「キーバインドを変更できた」「有効・無効も切り替えられた」と報告し、その後「再起動しても生きている」と保存と復元を確認した。

次にユーザーはGitHub公開を見据え、Workでの継続よりVS Codeへの移行を希望した。したがって、これからは単に同じ実験を繰り返す段階ではなく、**成功した試作を守りながら、公開できる導入・更新・解除・診断・テストへ整える段階**である。
