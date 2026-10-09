# legacy — 試作版 0.2.0

ChatGPT/Codex 上で開発し、実機で動作を確認した試作版 0.2.0 と、その導入・解除スクリプトです。
**一般の利用者は使わないでください。** 通常はリポジトリ直下の `install.bat` / `uninstall.bat` を使います。

残している理由:

- 試作版を導入済みの環境から、新しいインストーラーで正しく更新できるかを検証するため。
- 実機で検証された元のソースを保存するため。

| ファイル | 内容 |
| --- | --- |
| `extension/` | 試作版 0.2.0 の拡張（`manifest.json` の name は `Claude Enter Patch - Load Probe`） |
| `install-probe.ps1` | 試作版の導入スクリプト。既存の拡張フォルダー・記録・`REACT_PROFILE` があると中止する |
| `uninstall-probe.ps1` | 試作版の解除スクリプト。`%LOCALAPPDATA%\ClaudePatchLab\enter-probe-state\state.json` を使う |

注意:

- `extension/` の内容は、試作版を実機で確認したときのファイルと同一です。ただし Git の改行コード正規化（LF）のため、当時の SHA256 値とは一致しません。
- `install-probe.ps1` は `developer_settings.json` が存在しないと中止します（新しいインストーラーでは不要と確認済み）。
- 新しい `install.bat` は試作版を「更新」として扱い、拡張フォルダーの場所を保ったまま置き換えます。キーの設定は引き継がれます。
