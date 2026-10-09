<!--
AISTATE: machine-oriented knowledge store for AI agents. NOT for humans. Density > readability.
RULES FOR THIS FILE:
- Read fully at session start, before AI_HANDOFF_JA.md and code.
- Update in the same work unit as any code/doc/env change (before or with the commit).
- LOG is append-only (newest last). Never delete history; mark superseded facts with [SUPERSEDED by Lnn/date] instead.
- Keep every fact tagged with evidence: [USER_REAL]=user verified on real Claude, [AI_SIM]=AI mock/headless test,
  [AI_READ]=AI read code/files/registry read-only, [HANDOFF]=claimed by ChatGPT-era handoff (not re-verified), [GUESS]=unverified inference.
- IDs: ISSUE-nn (open problems), DEC-nn (decisions), ENV-xx (machines). Reuse IDs; never renumber.
- Language: mixed JA/EN ok. Paths repo-relative unless absolute needed.
-->

# AISTATE v1

## 0. QUICK
project=Claude Desktop (Windows MSIX) key-binding extension: Enter=newline, Ctrl+Enter=send, IME-safe, sidebar settings UI.
goal=GitHub公開品質 + 一般ユーザーが簡単に導入/更新/解除. ※公開許可・公開先・ライセンスは未確定(ISSUE-14).
current_ext_version=manifest 0.2.0 (+ unreleased fixes in repo, see LOG). target Claude=2.26454.2 (MSIX 2.26454.2.0).
start_here: AGENTS.md(rules) → this file → docs/AI_HANDOFF_JA.md(deep background, 2026-10-08 snapshot) → extension/*.
test: `npm test` (PowerShell; see TOOLING). all 3 suites must PASS before commit.
user_lang=Japanese (always reply JA). user dislikes multi-step instructions: ask ONE real-machine action at a time.

## 1. HARD CONSTRAINTS (from user; non-negotiable)
- no dedicated launcher / shortcut replacement; keep normal MSIX icon launch.
- never modify WindowsApps ACL/owner, MSIX, signature, claude.exe, app.asar. fuses read-only only.
- never auto-quit/kill/restart Claude. send tests: tell user a real message WILL be sent; user performs it.
- never overwrite existing React DevTools folder / REACT_PROFILE / user files without consent; backup before updating an install.
- don't lose existing users' extension ID / chrome.storage settings (see DEC-04).
- don't commit: Claude binaries, asar copies, profiles, credentials, chat logs, user screenshots.
- distinguish [AI_SIM] vs [USER_REAL]; never claim other-version/all-IME support by guess.
- "Electron supports X" ≠ "this Claude build allows X" (Claude rejects remote-debugging args itself).
- commit only with user consent (so far user approves per batch). push/publish: NOT authorized.

## 2. ENVIRONMENTS
ENV-ORIG: ChatGPT-Work era PC. has 0.2.0 installed & running [USER_REAL]. state: %LOCALAPPDATA%\ClaudePatchLab\enter-probe-state\{state.json,uninstall-probe.ps1,backup-*}. NOT accessible from current sessions. do not re-run installer there.
ENV-VM: current dev machine (VS Code + Claude Code). Hyper-V VM, user takes checkpoints → safe for install/uninstall trials (still ask first + ask user to checkpoint).
  2026-10-09 baseline [AI_READ]: Claude MSIX 2.26454.2.0 installed; %APPDATA%\Claude exists (no extensions\, no developer_settings.json); REACT_PROFILE unset (User & Machine); no ClaudePatchLab dir; PS 5.1.26100; Edge present; winget 1.29.
  user checkpoint "clean-before-node"-like taken 2026-10-09 before Node install (name chosen by user; I suggested clean-before-node).
  Node v24.20.0 installed via winget 2026-10-09 (machine-wide MSI).

## 3. TOOLING / GOTCHAS
- Bash tool PATH lacks node; PowerShell tool needs PATH refresh after install:
  `$env:Path=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')`
- fallback node: `ELECTRON_RUN_AS_NODE=1 "%LOCALAPPDATA%\Programs\Microsoft VS Code\Code.exe" script.cjs` (Node 24 / Electron 43).
- python NOT installed (store alias only). use node/PowerShell/Edit tool.
- Playwright 1.64.0 (devDep, exact). uses channel 'msedge' (system Edge); browsers not downloaded (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 at install).
- SHA256SUMS.txt is CRLF → `tr -d '\r' < SHA256SUMS.txt | sha256sum -c -`. It is a 2026-10-08 handoff artifact; README.md/.gitignore entries mismatch (repo scaffold versions replaced handoff ones). extension/* matched at 2026-10-09 start. Will drift as code changes (expected).
- line endings: .gitattributes `* text=auto eol=lf`; index LF. extension files in worktree were CRLF/mixed at handoff (functionally irrelevant).
- test-settings-ui.cjs writes settings-preview.png to repo root (gitignored).
- docs/00_work_hikitsugi == docs/AI_HANDOFF_JA.md byte-identical (user's import copy). docs/01_shijisho empty. src/.gitkeep unused scaffold.

## 4. ARCHITECTURE (facts)
load path [USER_REAL on ENV-ORIG]: user env REACT_PROFILE=1 → Claude main bundle (index.chunk-CJN9s-60.js) calls loadReactDevTools → if folder app.getPath('userData')/extensions/fmkadmapgofadopljbjfkapdkoienihi exists and !forceDownload → session.loadExtension(folder). our MV3 ext sits in that folder with own name. unofficial; may break on Claude update.
userData on ENV-ORIG = %APPDATA%\Claude [HANDOFF]; same on ENV-VM [AI_READ]. not LocalCache\Roaming.
manifest: MV3, name "Claude Enter Patch - Load Probe" (uninstall ownership check depends on it), matches https://claude.ai/* , document_idle, all_frames false, permissions [storage].
  main-probe.js world MAIN (needs el.editor = tiptap Editor on `.tiptap.ProseMirror[contenteditable=true]`).
  badge.js isolated world (chrome.storage.local key `claudeEnterSettingsV1`, default {enabled:true,send:'Ctrl+Enter',newline:'Enter'}).
bridge: badge → documentElement attr `data-claude-enter-settings` (JSON) + document event `claude-enter-settings-changed`; MAIN status → attr `data-claude-enter-probe-main` ∈ active|disabled|waiting|unsupported|send-unavailable|newline-unavailable. not a security boundary.
key logic: window capture keydown. IME: composing flag(WeakMap per editor)/isComposing/keyCode229/view.composing → stopImmediatePropagation only. 100ms after compositionend → swallow Enter. keys allowed: Enter,Ctrl+Enter,Shift+Enter,Alt+Enter. unassigned Enter & Ctrl+Enter swallowed; other combos pass through. newline=editor.commands.setHardBreak(); send=click send button `button[data-testid="chat-input-send"]` (not disabled/aria-disabled).
UI: shadow host #claude-enter-settings-entry inserted tray.insertBefore(host,row) where row=profile.closest('.df-footer-row'), tray=.df-bottom-tray inside [data-testid=sidebar]; profile=button[data-testid=user-menu-button]. MutationObserver+rAF remount; ResizeObserver hides <160px. native <dialog>.showModal. right-bottom badge was REJECTED by user (overlaps model picker) — never reintroduce, never overlay composer.
installer install-probe.ps1: requires %APPDATA%\Claude\developer_settings.json exists; refuses if target or stateRoot exists or REACT_PROFILE set; writes state.json(prepared) → copies → sets env → installed. uninstall-probe.ps1: state-driven, moves ext folder to stateRoot\removed-extension, restores env.
extension ID: no manifest key → Chromium unpacked ID derived from absolute path [GUESS, general Chromium behavior; unverified in Claude]. chrome.storage is per real ID.

## 5. DECISIONS
DEC-01 load via REACT_PROFILE devtools cache path (only path found that works from normal icon). rejected: launcher+CDP (user dislike + Claude rejects debug args), NODE_OPTIONS (fuse disabled), asar patch (constraint), Claude "install extension" menu (MCP/DXT only).
DEC-02 send by clicking existing send button (not internal command / synthetic Enter).
DEC-03 settings UI in sidebar above profile (native menu unreachable from extension).
DEC-04 keep install folder path & ID folder name forever; do NOT add manifest "key" (would change ID → settings lost) [GUESS-based, keep until verified]. renaming manifest name requires changing uninstall ownership check to a marker file first.
DEC-05 (2026-10-09) send button resolved per editor: walk ancestors from editor; first ancestor with ≥1 visible send button must have exactly 1 and contain no other editor, else no send (status send-unavailable).
DEC-06 (2026-10-09) knowledge store = docs/AISTATE.md (this), updated every work unit; AGENTS.md points here.

## 6. ISSUES (from 2026-10-09 review; status: OPEN|FIXED|WONTFIX)
ISSUE-01 FIXED(repo, [AI_SIM] only; [USER_REAL] pending) send button was global → Ctrl+Enter in other editor could send main composer draft. reproduced in test-integration with old code. fix=DEC-05.
ISSUE-02 OPEN unassigned multi-modifier Enter (Ctrl+Shift, Ctrl+Alt, Meta) passes to Claude [AI_SIM]; unknown if Claude sends on them. need real check or swallow all non-assigned Enter combos except Shift/Alt?
ISSUE-03 OPEN Enter in slash-command/mention suggestion menus is intercepted as newline [GUESS from code]; need detect open menu → defer to Claude.
ISSUE-04 OPEN before settings load MAIN uses defaults(enabled) [AI_SIM]; before document_idle no patch at all (Claude default Enter=send). options: run_at document_start; safe pending state.
ISSUE-05 FIXED(L07, [AI_SIM]) badge.js: chrome.storage missing → sync TypeError at get() → no UI (badge.js:~73). corrupted stored value silently → defaults. onChanged with removed value ignored. dialog open + external change → stale form overwrites.
ISSUE-06 OPEN ID/settings migration: see DEC-04. need marker-file ownership, never move folder.
ISSUE-07 OPEN installer: no rollback; leftover prepared state blocks rerun; after uninstall can't reinstall (stateRoot remains); no update/repair path. plan: single script with install/update/repair/uninstall/diagnose + backup+hash verify+rollback.
ISSUE-08 OPEN React DevTools coexistence: install refuses if folder exists (good) but after install real React DevTools never downloads; REACT_PROFILE is user-global (affects other Electron/React apps). document + diagnose.
ISSUE-09 OPEN developer_settings.json requirement unverified (ENV-VM lacks it → current installer refuses). verify whether loading works without dev mode.
ISSUE-10 PARTIAL(L07: sidebar label+dialog reflect MAIN status, [AI_SIM]; installer version check still OPEN) UI showed only enabled/disabled label; MAIN status (unsupported/send-unavailable) invisible. compat detection: runtime only; installer has no Claude-version check (plan: warn on untested version, don't block).
ISSUE-11 OPEN sidebar remount judged by host.isConnected only; multiple sidebars/rail/overlay unverified; rail (<160px) hides entry → settings unreachable.
ISSUE-12 PARTIAL integration test added (L04, extended L07) (test-integration.cjs) but runs both scripts in page world (not MAIN/isolated split), mock editor, no real IME.
ISSUE-13 OPEN repo hygiene: README describes old plan (src/, macOS Cmd+Enter, browser support) ≠ implementation; duplicate docs/00_work_hikitsugi; empty docs/01_shijisho; CONTRIBUTING mentions src/manifest.json; PRIVACY permissions table TODO.
ISSUE-14 OPEN LICENSE file = MIT (Copyright 2026 zawa356) from user's initial commit 784476a, but handoff says license undecided → ask user before relying on it.
ISSUE-15 OPEN newline on key repeat suppressed (holding Enter gives 1 newline) — minor UX diff.
ISSUE-16 OPEN real-machine verification of ISSUE-01 fix requires install on ENV-VM (needs installer work or one-off manual install with checkpoint).

## 7. FILE MAP
extension/{manifest.json,main-probe.js,badge.js} = shipped ext. install-probe.ps1/uninstall-probe.ps1 = prototype scripts (not public-grade).
test-keyboard.cjs (node vm mock of main-probe), test-settings-ui.cjs (Playwright+Edge, badge only), test-integration.cjs (Playwright+Edge, badge+main, real key events, storage mock with failure injection & onChanged).
docs/AI_HANDOFF_JA.md = ChatGPT-era full handoff (frozen 2026-10-08). docs/PROTOTYPE_README_SNAPSHOT.md = old prototype README. docs/HANDOFF_VALIDATION.md. CONTINUE_PROMPT.md = initial prompt to VS Code AI.
memory (Claude Code, per-user, outside repo): dev-machine-is-hyperv-vm, reply-in-japanese.

## 8. LOG (append-only)
L01 2026-10-08 [HANDOFF] ChatGPT/Codex built 0.0.1 load probe → 0.1.0 keys → 0.2.0 sidebar UI+storage on ENV-ORIG. user verified items 1-10 in AI_HANDOFF_JA §3.
L02 2026-10-09 user commits: 784476a scaffold (README/LICENSE MIT/CHANGELOG/CONTRIBUTING/PRIVACY/.gitignore/.editorconfig/.gitattributes), 2ef8bf8 handoff doc copy, 678dc05 "firest" (handoff files incl. extension 0.2.0, scripts, tests).
L03 2026-10-09 Claude Code session start on ENV-VM. read all files; hash check (extension OK); test-keyboard PASS via VS Code electron-as-node; discovered ENV-VM has no install (≠ENV-ORIG). produced review → ISSUE-01..16. user confirmed ENV-VM is separate Hyper-V VM with checkpoints.
L04 2026-10-09 user checkpoint taken. installed Node 24.20.0 (winget). added package.json (scripts test/test:keyboard/test:ui), playwright 1.64.0 exact, package-lock.json, test-integration.cjs, charset fix in test-settings-ui fixture, .gitignore settings-preview.png. all PASS. commit 9d4c530 (user approved).
L05 2026-10-09 ISSUE-01 fix in main-probe.js (sendButtonFor, DEC-05). tests updated: test-keyboard mock gives editor.parentElement composer; new ambiguous-editor case; test-integration adds #other editor. verified new code PASS, old code FAIL on new assertions. CHANGELOG Unreleased updated. manifest version NOT bumped (still 0.2.0). committed c6a4977 (user approved 2026-10-09).
L06 2026-10-09 user rule: create docs/AISTATE (this file, chose .md ext), AGENTS.md updated with maintenance protocol.
L07 2026-10-09 badge.js: ISSUE-10 status label (MutationObserver on data-claude-enter-probe-main; labels 読込中/無効/有効/非対応/送信不可/改行不可; red .warn; dialog .status explanation) + ISSUE-05 storage robustness (canStore guard → no crash, save disabled; corrupted stored → message; onChanged removal → defaults; external change while dialog open → refill + notice; storageError cleared on successful save/change). test-integration extended (status labels, unsupported, external change, remove, corrupted, no-storage context). verified: new PASS, old badge.js FAIL (label stayed 有効). CHANGELOG Changed/Fixed. NOTE: unsupported state still swallows assigned keys (deliberate, prototype behavior; label tells user to disable). README still old scaffold (ISSUE-13) so not updated.

## 9. NEXT (proposed order; user picks)
N1 DONE (c6a4977 fix, 83c9fa9 docs).
N2 DONE in worktree (L07); commit pending user OK.
N3 ISSUE-04 / ISSUE-02 / ISSUE-03 key-logic design (needs real-machine observation; one step at a time).
N4 ISSUE-07/08/09 unified installer (diagnose first), trial on ENV-VM with checkpoint → enables ISSUE-16 real check.
N5 ISSUE-13/14 repo/README/license cleanup with user decisions.
