# Claude Ctrl+Enter

[日本語](README.md) | **English**

An unofficial tool that makes **Enter insert a newline and Ctrl+Enter send** in Claude Desktop for Windows.
The Enter that confirms Japanese (and other) IME conversion never sends a message. Key bindings can be changed from inside Claude.

> [!IMPORTANT]
> This is not an official Anthropic tool. It relies on Claude's internal behavior and may stop working after a Claude update.
> It never modifies Claude's own files (`claude.exe`, `app.asar`, or the install folder).

## Quick start

1. Download the latest `claude-ctrl-enter-<version>.zip` from [Releases](https://github.com/zawa356/claude_ctrl-enter/releases) and extract it anywhere.
2. Double-click **`install.bat`** in the extracted folder.
   After the diagnostic output, it asks `続行しますか？ (Y/N)` ("Continue?"). Type `Y`.
3. **Fully quit** Claude (menu *File → Exit*, or right-click the tray icon and choose *Quit*), then start it again from its usual icon.
4. Done when **"⌨ キー設定　有効"** ("Key settings — enabled") appears above your profile in the left sidebar.

> [!NOTE]
> If Windows shows a warning such as "Windows protected your PC", see the [FAQ](#faq).

To revert, double-click **`uninstall.bat`**, then fully quit and restart Claude.

## Features

| Key | Claude default | With this tool (default settings) |
| --- | --- | --- |
| `Enter` | Send | Newline |
| `Ctrl` + `Enter` | — | Send |
| `Enter` that confirms IME conversion | Confirm | Confirm only — never sends or adds a newline |
| `Enter` in the `/` command or mention menu | Pick item | Pick item (Claude's own behavior is kept) |

- From "キー設定" (Key settings) in the sidebar, choose the send key and newline key from `Enter` / `Ctrl+Enter` / `Shift+Enter` / `Alt+Enter`.
- Uncheck "キー設定を有効にする" (Enable key settings) to get Claude's default keys back without uninstalling.
- Settings survive restarts, updates and reinstalls.

The UI and installer messages are currently in Japanese only.

## Requirements

| Item | Details |
| --- | --- |
| OS | Windows 10 / 11 |
| Claude | Claude Desktop for Windows (MSIX package) |
| Tested versions | 2.26454.2, 2.31226.0 |
| Needs | Windows PowerShell 5.1 (built into Windows). No administrator rights |

Untested versions only produce a warning in the diagnostics; installation still proceeds. Uninstall if it does not work.

## How it works and what it changes

When the user environment variable `REACT_PROFILE=1` is set, Claude Desktop loads the React DevTools developer extension from its settings folder.
This tool places a small key-handling extension at that location.

Installation changes exactly three things:

| Change | Location |
| --- | --- |
| Extension files | `%APPDATA%\Claude\extensions\fmkadmapgofadopljbjfkapdkoienihi\` |
| User environment variable | `REACT_PROFILE=1` |
| Install record and backups | `%LOCALAPPDATA%\ClaudeKeys\` |

Notes:

- `REACT_PROFILE` is a user-wide environment variable and may affect other developer tools that use the same name.
- If you use the real React DevTools in Claude, or `REACT_PROFILE` already has another value, the installer stops without changing anything.
- The extension only handles key presses and its own key settings (enabled/disabled and two keys). It does not read what you type or send anything anywhere. See [PRIVACY.md](PRIVACY.md).

## Update and uninstall

- **Update**: extract the new ZIP and run `install.bat`. Previous files are moved (not deleted) to `%LOCALAPPDATA%\ClaudeKeys\backups\`. Your key settings are kept.
- **Uninstall**: run `uninstall.bat`. The extension folder is moved to the backups, and `REACT_PROFILE` is removed if this tool set it. Key settings stay in Claude, so reinstalling restores them.
- Both take effect after fully quitting and restarting Claude. The scripts never close Claude for you.
- If anything fails midway, the previous state is restored automatically.

## Diagnostics and troubleshooting

`diagnose.bat` shows the Claude version, settings folders, install state and `REACT_PROFILE`. It only reads; nothing is changed.

Status shown next to "キー設定" in the sidebar:

| Label | Meaning |
| --- | --- |
| 有効 / 無効 | Enabled / disabled — working as configured |
| 読込中 | Loading settings right after start-up |
| 非対応 (red) | Unsupported — the input box changed (e.g. after a Claude update) and the assigned keys do nothing. Disable key settings to get Claude's default keys back |
| 送信不可 (red) | Could not identify the send button, so nothing was sent |
| 改行不可 (red) | Could not insert a newline |

## FAQ

**Windows shows a warning and blocks the script**
Windows marks files from a downloaded ZIP as coming from the internet. Before extracting, right-click the ZIP → *Properties* → check *Unblock* → *OK*, then extract again.
All scripts are plain text, so you can read them before running.

**After a Claude update, "キー設定" disappeared or shows 非対応**
Claude's internals may have changed. Please open an Issue with the output of `diagnose.bat`. Meanwhile, `uninstall.bat` restores the default behavior.

**"キー設定" does not appear**
Make sure Claude was *fully* quit. Closing the window may leave it running in the system tray.

## Known limitations

- Uses unofficial behavior of Claude; an update may break it.
- IME behavior has been verified with one Japanese IME only.
- In the editor for an earlier message, the send key may not send (when the matching send button cannot be identified, nothing is sent, to avoid sending the wrong text).
- Holding Enter inserts only one newline.
- Installation stops if the `%APPDATA%\Claude` folder does not exist.

## For developers

```powershell
npm install        # fetches Playwright for tests (uses the Edge installed with Windows)
npm test           # key handling, installer, settings UI and integration tests
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-release.ps1   # builds the release ZIP in dist\
```

- Layout: `extension/` (the extension), `scripts/claude-keys.ps1` (install/update/uninstall/diagnose), `tests/`, `legacy/` (prototype 0.2.0 and its scripts, kept for compatibility testing).
- History, design decisions and verification records are in [docs/AISTATE.md](docs/AISTATE.md) (a log written for AI agents) and [docs/AI_HANDOFF_JA.md](docs/AI_HANDOFF_JA.md) (Japanese). AI coding agents should read [AGENTS.md](AGENTS.md).
- See [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute.

## License

[MIT License](LICENSE)

"Claude" is a trademark of Anthropic. This project is not affiliated with Anthropic.
