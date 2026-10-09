# プライバシー / Privacy

最終更新日 / Last updated: 2026-10-09

## 日本語

このツール（拡張とスクリプト）は、個人情報・会話・入力内容を**収集せず、外部へ送信しません**。ネットワーク通信を行うコードは含まれていません。

### 拡張が保存する情報

Claude Desktop 内の拡張用ストレージ（`chrome.storage.local`）に、次の 3 項目だけを保存します。

| 項目 | 例 |
| --- | --- |
| 有効 / 無効 | `true` |
| 送信キー | `Ctrl+Enter` |
| 改行キー | `Enter` |

### 権限

| 権限 | 用途 |
| --- | --- |
| `storage` | 上記のキー設定を保存するため |

拡張は `https://claude.ai/*` のページでのみ動作します。キー操作の判定のために入力欄の状態（日本語入力中かどうか等）を参照しますが、入力された文字を読み取ったり記録したりはしません。

### スクリプトが変更・保存するもの

- `%APPDATA%\Claude\extensions\fmkadmapgofadopljbjfkapdkoienihi\`（拡張のファイル）
- ユーザー環境変数 `REACT_PROFILE`
- `%LOCALAPPDATA%\ClaudeKeys\`（導入記録 `state.json` と、更新・解除時に移した旧ファイル）

## English

This tool (extension and scripts) does **not collect or transmit** personal data, conversations or anything you type. It contains no networking code.

The extension stores only three values in Claude Desktop's extension storage (`chrome.storage.local`): enabled/disabled, the send key and the newline key. Its only permission is `storage`, and it runs only on `https://claude.ai/*`. It inspects the input box state (for example, whether IME composition is in progress) to decide how to handle a key, but never reads or records the text.

The scripts change or create: the extension folder `%APPDATA%\Claude\extensions\fmkadmapgofadopljbjfkapdkoienihi\`, the user environment variable `REACT_PROFILE`, and `%LOCALAPPDATA%\ClaudeKeys\` (install record `state.json` and files moved aside on update/uninstall).

## お問い合わせ / Contact

[GitHub Issues](https://github.com/zawa356/claude_ctrl-enter/issues)
