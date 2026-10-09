#!/usr/bin/env bash
# Claude Desktop キー設定拡張 — 導入・更新・解除・診断（Linux 版）
# Windows 版 scripts/claude-keys.ps1 と同じ考え方で動く。root 権限・外部ダウンロードは使わない。
#
# 0.4.0 から、Claude が読み込む拡張フォルダーの管理は共通ローダー claude-desktop-webext
# （https://github.com/zawa356/claude-desktop-webext、python3 が必要）に任せる。同じローダーを使う
# 他のツール（claude-split-ui など）と共存できる。このスクリプトは 0.3.x からの移行判断と案内だけを行う。
#
#   claude-keys.sh diagnose          読み取りだけの診断（既定）
#   claude-keys.sh install           導入。既に導入済みなら更新。0.3.x の導入はここで新方式へ移行する
#   claude-keys.sh uninstall         解除。拡張フォルダーはバックアップへ移し、削除はしない
#   --yes                            確認の質問を省略
#   --sandbox DIR / --fail-at STEP   テスト専用。ローダーにそのまま渡す
set -u

ACTION=diagnose; YES=0; SANDBOX=''; FAIL_AT=''
while [ $# -gt 0 ]; do
    case "$1" in
        diagnose|install|uninstall) ACTION=$1 ;;
        --yes|-y) YES=1 ;;
        --sandbox) SANDBOX=$2; shift ;;
        --fail-at) FAIL_AT=$2; shift ;;
        *) echo "不明な引数: $1" >&2; exit 64 ;;
    esac
    shift
done

# ---- 固定値（変更すると既存利用者の設定・解除互換が失われる。docs/AISTATE.md DEC-04 参照）----
EXTENSION_ID=fmkadmapgofadopljbjfkapdkoienihi
LEGACY_NAME='Claude Enter Patch - Load Probe'
MARKER=claude-keys.owner.json
ROOT=$(cd "$(dirname "$0")/.." && pwd)
CONFIG_JSON=$ROOT/desktop-webext.json
LOADER=''
for f in "$ROOT/claude-desktop-webext/bin/webext.sh" "$ROOT/vendor/claude-desktop-webext/bin/webext.sh"; do
    [ -f "$f" ] && { LOADER=$f; break; }
done

if [ -n "$SANDBOX" ]; then
    CONFIG=$SANDBOX/.config; STATE_HOME=$SANDBOX/.local/state
else
    CONFIG=${XDG_CONFIG_HOME:-$HOME/.config}; STATE_HOME=${XDG_STATE_HOME:-$HOME/.local/state}
fi
TARGET=$CONFIG/Claude/extensions/$EXTENSION_ID
STATE_ROOT=$STATE_HOME/claude-keys
STATE_FILE=$STATE_ROOT/state.json
OLD_ENV_FILE=$CONFIG/environment.d/90-claude-ctrl-enter.conf   # 0.3.x が置いた REACT_PROFILE の設定

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
json_get() { # file key -> string value or true/false
    [ -f "$1" ] || return 0
    sed -n "s/.*\"$2\"[[:space:]]*:[[:space:]]*\"\{0,1\}\([^\",}]*\)\"\{0,1\}.*/\1/p" "$1" | head -n 1
}

# 0.3.x 以前の方式（このツールが拡張フォルダーを直接持つ）で導入されているか: flat / legacy-probe / 空
old_install() {
    [ -e "$TARGET" ] || return 0
    if [ -f "$TARGET/$MARKER" ]; then echo flat
    elif [ "$(json_get "$TARGET/manifest.json" name)" = "$LEGACY_NAME" ]; then echo legacy-probe; fi
}

# 旧方式で REACT_PROFILE をこのツールが設定したか（記録が無ければ、旧方式の設定ファイルの有無で判断）
old_env_set_by_us() {
    if [ -f "$STATE_FILE" ] && [ -z "$(json_get "$STATE_FILE" manager)" ] && [ "$(json_get "$STATE_FILE" status)" = installed ]; then
        [ "$(json_get "$STATE_FILE" envSetByUs)" = true ]; return
    fi
    [ -f "$OLD_ENV_FILE" ]
}

write_state() { # status migratedFrom
    local installed migrated_from version
    mkdir -p "$STATE_ROOT" || return 1
    installed=$(json_get "$STATE_FILE" installedAt); [ -n "$installed" ] || installed=$(now)
    migrated_from=${2:-$(json_get "$STATE_FILE" migratedFrom)}
    version=$(json_get "$ROOT/extension/manifest.json" version)
    printf '{\n  "schema": 2,\n  "status": "%s",\n  "manager": "claude-desktop-webext",\n  "version": "%s",\n  "migratedFrom": "%s",\n  "installedAt": "%s",\n  "updatedAt": "%s"\n}\n' \
        "$1" "$version" "$migrated_from" "$installed" "$(now)" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
}

loader() { # action [extra args...]
    local args=("$1" --config "$CONFIG_JSON"); shift
    [ "$YES" = 1 ] && args+=(--yes)
    [ -n "$SANDBOX" ] && args+=(--sandbox "$SANDBOX")
    [ -n "$FAIL_AT" ] && args+=(--fail-at "$FAIL_AT")
    bash "$LOADER" "${args[@]}" "$@"
}

echo 'Claude Ctrl+Enter（共通ローダー claude-desktop-webext 経由）'
if [ -z "$LOADER" ]; then
    echo '共通ローダーが見つかりません。配布 ZIP を展開し直すか、開発用なら git submodule update --init を実行してください。' >&2
    exit 1
fi
OLD=$(old_install)

case "$ACTION" in
    diagnose)
        [ -n "$OLD" ] && echo '[INFO] 旧方式（0.3.x 以前）で導入されています。install.sh を実行すると新方式へ移行します（キー設定は引き継がれます）。'
        loader diagnose; rc=$?
        echo '（上はローダーの英語表示です。NG が無ければ問題ありません。診断は読み取りだけで、何も変更していません）'
        exit $rc ;;
    install)
        adopt=0
        if [ -n "$OLD" ]; then
            echo '旧方式（0.3.x 以前）の導入を新方式へ移行します。以前の拡張フォルダーはバックアップへ移し、キー設定は引き継がれます。'
            old_env_set_by_us && adopt=1
        fi
        if [ "$adopt" = 1 ]; then loader install --adopt-env; else loader install; fi
        rc=$?
        if [ "$rc" != 0 ]; then echo "導入は完了していません（終了コード $rc）。上の表示を確認してください。"; exit "$rc"; fi
        # ローダーが自分の設定ファイルで REACT_PROFILE を引き継いだので、旧方式の設定ファイルはバックアップへ移す。
        if [ "$adopt" = 1 ] && [ -f "$OLD_ENV_FILE" ]; then
            backup=$STATE_ROOT/backups/$(date +%Y%m%d-%H%M%S)-$$
            mkdir -p "$backup" && mv "$OLD_ENV_FILE" "$backup/" && echo "旧方式の環境変数ファイルを移動しました: $backup/$(basename "$OLD_ENV_FILE")"
        fi
        write_state installed "$OLD"
        echo '導入しました。初めて導入した場合はログアウトしてログインし直してから、Claude を起動してください。'
        echo 'このスクリプトは Claude を終了しません。' ;;
    uninstall)
        if [ -n "$OLD" ]; then
            echo '旧方式（0.3.x 以前）の導入が残っています。先に install.sh で新方式へ移行してから、uninstall.sh を実行してください。何も変更していません。'
            exit 1
        fi
        loader uninstall; rc=$?
        if [ "$rc" != 0 ]; then echo "解除は完了していません（終了コード $rc）。上の表示を確認してください。"; exit "$rc"; fi
        [ -f "$STATE_FILE" ] && write_state removed ''
        echo '解除しました。ログアウトしてログインし直し、Claude を起動すると反映されます。キー設定の保存内容は Claude 側に残り、再導入すると引き継がれます。' ;;
esac
