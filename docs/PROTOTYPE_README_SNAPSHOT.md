# Claude Enter: experimental keyboard extension

Experimental, tested-build target: Windows MSIX Claude 2.26454.2.
Version 0.2.0 adds sidebar settings after the 0.1.0 keyboard behavior and 0.0.1 loading probe succeeded
from the normal Claude icon. This is not a finished or update-certified release.

The internal REACT_PROFILE=1 branch loads the cached React DevTools directory
under Claude's userData/extensions. This probe uses that directory but declares
its own name; it is not React DevTools and does not redistribute its code.
The installer refuses to overwrite an existing directory or environment setting.

By default the extension changes plain Enter to an editor hard break and Ctrl+Enter to a
click on the single visible, enabled chat send button. It leaves IME default
processing intact and suppresses send handlers during composition, with an
experimental 100ms post-composition guard. Shift/Alt/Meta+Enter are unchanged.
No message text is read or logged, and the extension makes no network requests.
MAIN-world access to the editor API was confirmed by the loading probe.
Missing editor APIs block handled Enter operations. If the
editor selector itself changes, the extension cannot recognize the input and
Claude's original keys apply. Slash menus, lists, code blocks, other Claude
modes, and different IMEs still need real-world validation.

Installation changes one current-user environment variable, REACT_PROFILE, and
adds three files under the Claude user-data extensions folder. This variable
can also be inherited by other applications. No executable, ASAR, MSIX, ACL,
shortcut, or developer settings file is changed. Normal Claude launch and
environment inheritance worked in the first normal-icon restart test.

Run install-probe.ps1 to install. It saves rollback state and a copy of
uninstall-probe.ps1 under LocalAppData/ClaudePatchLab/enter-probe-state.
Uninstall archives rather than deletes the extension files and restores the
environment. Restart Claude after either operation; the scripts do not kill it.

Internal startup hooks may change in future Claude releases. Do not treat this
probe as a supported extension-install mechanism or an update-compatible release.

Run `node test-keyboard.cjs` for simulated event checks. They do not replace
testing actual Windows IME behavior and actual Claude page navigation.
The manifest retains its probe name so the existing rollback script recognizes it.

## Sidebar settings (0.2.0)

The settings entry sits above the verified user-menu footer row, inside the
sidebar bottom tray; no fixed-position status badge remains. If the expected
sidebar structure is missing, no entry is inserted. Narrow sidebars hide it.
The dialog saves enabled/send/newline values in chrome.storage.local. Values
cross to the page world through a validated DOM attribute/event bridge. The
setting itself is not secret. No message content enters the storage.

Supported bindings: Enter, Ctrl+Enter, Shift+Enter, Alt+Enter. Sending and newline
cannot share a binding. Save applies changes; closing cancels unsaved changes.
Unassigned plain Enter and Ctrl+Enter are suppressed while enabled. Disable
restores Claude's own behavior, including its IME handling. The entry remains
available when disabled. Initial-values button only changes the draft until Save.

test-settings-ui.cjs checks the settings in a simulated sidebar with a mocked
extension storage API. Actual Electron storage and sidebar placement require
the next normal-icon restart check. The test requires Playwright and Edge.
