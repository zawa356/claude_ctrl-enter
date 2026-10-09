#!/usr/bin/env bash
# Claude Desktop キー設定拡張 — 導入・更新・解除・診断（Linux 版）
# Windows 版 scripts/claude-keys.ps1 と同じ考え方で動く。root 権限・外部ダウンロードは使わない。
#
#   claude-keys.sh diagnose          読み取りだけの診断（既定）
#   claude-keys.sh install           導入。既に導入済みなら更新
#   claude-keys.sh uninstall         解除。拡張フォルダーはバックアップへ移し、削除はしない
#   --yes                            確認の質問を省略
#   --sandbox DIR / --fail-at STEP   テスト専用。HOME を DIR に差し替え、指定した段階で故意に失敗させる
#
# 環境変数 REACT_PROFILE=1 は ~/.config/environment.d/90-claude-ctrl-enter.conf の1ファイルだけで設定する
# （systemd のユーザー環境。ログインし直すと反映）。~/.profile などの既存ファイルは書き換えない。
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
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
SOURCE_DIR=$(cd "$SCRIPT_DIR/.." && pwd)/extension

if [ -n "$SANDBOX" ]; then
    HOME_DIR=$SANDBOX; CONFIG=$SANDBOX/.config; STATE_HOME=$SANDBOX/.local/state; ETC=$SANDBOX/etc
else
    HOME_DIR=$HOME; CONFIG=${XDG_CONFIG_HOME:-$HOME/.config}; STATE_HOME=${XDG_STATE_HOME:-$HOME/.local/state}; ETC=/etc
fi
USER_DATA=$CONFIG/Claude
TARGET=$USER_DATA/extensions/$EXTENSION_ID
STATE_ROOT=$STATE_HOME/claude-keys
STATE_FILE=$STATE_ROOT/state.json
ENV_FILE=$CONFIG/environment.d/90-claude-ctrl-enter.conf

if [ -t 1 ]; then C_OK=$'\e[32m'; C_WARN=$'\e[33m'; C_NG=$'\e[31m'; C_OFF=$'\e[0m'; else C_OK=''; C_WARN=''; C_NG=''; C_OFF=''; fi
NG_COUNT=0
say() { # level item detail
    local color=''
    case "$1" in OK) color=$C_OK ;; WARN) color=$C_WARN ;; NG) color=$C_NG; NG_COUNT=$((NG_COUNT + 1)) ;; esac
    printf '%s[%-4s] %s: %s%s\n' "$color" "$1" "$2" "$3" "$C_OFF"
}
step() { [ "$FAIL_AT" = "$1" ] && { echo "テスト用の故意の失敗: $1" >&2; return 1; }; return 0; }
now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
json_get() { # file key -> string value or true/false
    [ -f "$1" ] || return 0
    sed -n "s/.*\"$2\"[[:space:]]*:[[:space:]]*\"\{0,1\}\([^\",}]*\)\"\{0,1\}.*/\1/p" "$1" | head -n 1
}

# 拡張フォルダーの持ち主: none / ours / legacy-probe / react-devtools / unknown
target_owner() {
    local dir=$1 name
    [ -e "$dir" ] || { echo none; return; }
    [ -f "$dir/$MARKER" ] && { echo ours; return; }
    name=$(json_get "$dir/manifest.json" name)
    if [ "$name" = "$LEGACY_NAME" ]; then echo legacy-probe
    elif printf '%s' "$name" | grep -q 'React Developer Tools'; then echo react-devtools
    else echo unknown; fi
}

# このツール以外で REACT_PROFILE を定義している場所の値（1行に1つ）
foreign_env_values() {
    local f
    for f in "$CONFIG"/environment.d/*.conf "$HOME_DIR/.profile" "$HOME_DIR/.bash_profile" "$HOME_DIR/.bashrc" "$HOME_DIR/.zshenv" "$HOME_DIR/.pam_environment"; do
        [ -f "$f" ] && [ "$f" != "$ENV_FILE" ] || continue
        sed -n 's/^[[:space:]]*\(export[[:space:]]\{1,\}\)\{0,1\}REACT_PROFILE[[:space:]]*=[[:space:]]*["'"'"']\{0,1\}\([^"'"'"' ]*\).*/\2/p' "$f"
    done
    if [ -z "$SANDBOX" ] && [ -n "${REACT_PROFILE+x}" ] && [ ! -f "$ENV_FILE" ]; then printf '%s\n' "$REACT_PROFILE"; fi
}
system_env_values() {
    local f
    for f in "$ETC/environment" "$ETC"/environment.d/*.conf; do
        [ -f "$f" ] && sed -n 's/^[[:space:]]*REACT_PROFILE[[:space:]]*=[[:space:]]*["'"'"']\{0,1\}\([^"'"'"' ]*\).*/\1/p' "$f"
    done
}

find_app_asar() {
    [ -n "$SANDBOX" ] && { ls "$SANDBOX"/app/resources/app.asar 2>/dev/null | head -n 1; return; }
    ls /usr/lib/*[Cc]laude*/resources/app.asar /opt/*[Cc]laude*/resources/app.asar /usr/share/*[Cc]laude*/resources/app.asar 2>/dev/null | head -n 1
}

diagnose() {
    NG_COUNT=0
    say INFO 'シェル' "bash $BASH_VERSION"
    local pkg asar
    pkg=$(command -v dpkg-query >/dev/null 2>&1 && dpkg-query -W -f='${Package} ${Version}\n' 2>/dev/null | grep -i '^claude' | head -n 1)
    if [ -n "$pkg" ]; then say INFO 'Claude' "$pkg（Linux 版は実機未確認）"; else say WARN 'Claude' 'パッケージを特定できませんでした（Linux 版は実機未確認）'; fi
    asar=$(find_app_asar)
    if [ -z "$asar" ]; then say INFO '読み込み経路' 'app.asar が見つからないため確認できません'
    elif grep -a -q 'REACT_PROFILE' "$asar"; then say OK '読み込み経路' "あり（$asar）"
    else say NG '読み込み経路' "見つかりません（$asar）。この版では動作しません。"; fi

    if [ -d "$USER_DATA" ]; then say OK '設定フォルダー' "$USER_DATA"
    else say NG '設定フォルダー' "$USER_DATA がありません。Claudeを一度起動してください。"; fi

    case $(target_owner "$TARGET") in
        none) say OK '拡張フォルダー' '未導入' ;;
        ours) say OK '拡張フォルダー' "導入済み（$(json_get "$TARGET/manifest.json" version)）" ;;
        legacy-probe) say OK '拡張フォルダー' '導入済み（試作版 0.2.0 以前）' ;;
        react-devtools) say NG '拡張フォルダー' '本物の React DevTools があります。上書きしないため導入できません。' ;;
        *) say NG '拡張フォルダー' '持ち主の分からないフォルダーがあります。上書きしないため導入できません。' ;;
    esac

    local sys foreign v
    sys=$(system_env_values)
    [ -n "$sys" ] && say NG 'REACT_PROFILE（システム全体）' "値: '$(printf '%s' "$sys" | head -n 1)'。システムの設定は変更しません。"
    foreign=$(foreign_env_values)
    if [ -f "$ENV_FILE" ]; then say OK 'REACT_PROFILE' "このツールの設定あり（$ENV_FILE）"; fi
    if [ -n "$foreign" ]; then
        while IFS= read -r v; do
            if [ "$v" = 1 ]; then say OK 'REACT_PROFILE（既存の設定）' '1'
            else say NG 'REACT_PROFILE（既存の設定）' "値: '$v'。別の用途で使われているため変更しません。"; fi
        done <<EOF
$foreign
EOF
    elif [ ! -f "$ENV_FILE" ]; then say OK 'REACT_PROFILE' '未設定'; fi

    if [ -z "$SANDBOX" ] && pgrep -i -x 'claude(-desktop)?' >/dev/null 2>&1; then say INFO 'Claudeの起動' '起動中。導入・解除後はログインし直してから起動してください。'; fi
    echo
}

confirm() {
    [ "$YES" = 1 ] && return 0
    local answer
    printf '%s 続行しますか？ (y/N): ' "$1"
    read -r answer || answer=''
    case "$answer" in [Yy]*) return 0 ;; esac
    echo '中止しました。何も変更していません。'; exit 2
}

env_set_by_us() {
    # 解除済み（removed）の記録は、その後に入れ直された状態を表さないので使わない。
    if [ -f "$STATE_FILE" ] && [ "$(json_get "$STATE_FILE" status)" != removed ]; then [ "$(json_get "$STATE_FILE" envSetByUs)" = true ]; return; fi
    [ -f "$ENV_FILE" ]
}

write_state() { # status version envSetByUs installedAt migratedFromLegacy
    mkdir -p "$STATE_ROOT" || return 1
    printf '{\n  "schema": 1,\n  "status": "%s",\n  "version": "%s",\n  "target": "%s",\n  "envSetByUs": %s,\n  "envFile": "%s",\n  "installedAt": "%s",\n  "updatedAt": "%s",\n  "migratedFromLegacy": %s\n}\n' \
        "$1" "$2" "$TARGET" "$3" "$ENV_FILE" "$4" "$(now)" "$5" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
}

install() {
    diagnose
    if [ "$NG_COUNT" -gt 0 ]; then echo "問題が $NG_COUNT 件あるため中止しました。何も変更していません。"; exit 1; fi
    local version owner mode stamp ext_dir staging backup previous env_before_ours=0 env_set_by=false
    version=$(json_get "$SOURCE_DIR/manifest.json" version)
    [ -n "$version" ] || { echo "導入するファイルが見つかりません: $SOURCE_DIR" >&2; exit 1; }
    owner=$(target_owner "$TARGET")
    if [ "$owner" = none ]; then mode='導入'; else mode='更新'; fi
    confirm "キー設定拡張 $version を${mode}します。"

    stamp=$(date +%Y%m%d-%H%M%S)-$$
    ext_dir=$(dirname "$TARGET")
    staging=$ext_dir/.$EXTENSION_ID.staging-$stamp
    backup=$STATE_ROOT/backups/$stamp
    previous=$backup/previous
    [ -f "$ENV_FILE" ] && env_before_ours=1
    # 既に別の場所で REACT_PROFILE=1 なら、このツールは環境変数を設定しない（解除時も触らない）
    if [ "$owner" = none ]; then
        [ -z "$(foreign_env_values)" ] && env_set_by=true
    elif env_set_by_us; then env_set_by=true; fi
    local moved=0 placed=0 env_changed=0 old_installed migrated=false f
    old_installed=$(json_get "$STATE_FILE" installedAt)
    [ "$owner" = legacy-probe ] || [ "$(json_get "$STATE_FILE" migratedFromLegacy)" = true ] && migrated=true

    rollback() {
        echo "失敗しました。元の状態に戻しています…" >&2
        local bad=0
        if [ "$env_changed" = 1 ]; then rm -f "$ENV_FILE" || bad=1; fi
        mkdir -p "$backup" 2>/dev/null
        if [ "$placed" = 1 ]; then mv "$TARGET" "$backup/failed" || bad=1
        elif [ -e "$staging" ]; then mv "$staging" "$backup/failed" || bad=1; fi
        if [ "$moved" = 1 ]; then mv "$previous" "$TARGET" || bad=1; fi
        if [ "$bad" = 1 ]; then echo "手動での確認が必要です。バックアップ: $backup" >&2; exit 3; fi
        echo '元の状態に戻しました。' >&2; exit 1
    }

    mkdir -p "$ext_dir" "$STATE_ROOT" && mkdir "$staging" || rollback
    for f in "$SOURCE_DIR"/*; do
        [ -f "$f" ] || continue
        cp "$f" "$staging/" || rollback
        [ "$(sha256sum < "$f" | cut -d' ' -f1)" = "$(sha256sum < "$staging/$(basename "$f")" | cut -d' ' -f1)" ] || rollback
    done
    printf '{\n  "tool": "claude-keys",\n  "schema": 1,\n  "version": "%s",\n  "installedAt": "%s"\n}\n' "$version" "$(now)" > "$staging/$MARKER" || rollback
    step copy || rollback
    if [ "$owner" != none ]; then
        mkdir -p "$backup" && mv "$TARGET" "$previous" || rollback
        moved=1
    fi
    step swap || rollback
    mv "$staging" "$TARGET" || rollback
    placed=1
    step env || rollback
    if [ "$env_set_by" = true ] && [ "$env_before_ours" = 0 ]; then
        mkdir -p "$(dirname "$ENV_FILE")" && printf '# claude-ctrl-enter: Claude Desktop がキー設定拡張を読み込むための設定。uninstall.sh で削除されます。\nREACT_PROFILE=1\n' > "$ENV_FILE" || rollback
        env_changed=1
    fi
    step state || rollback
    if [ "$owner" = none ] || [ -z "$old_installed" ]; then old_installed=$(now); fi
    write_state installed "$version" "$env_set_by" "$old_installed" "$migrated" || rollback

    echo "${C_OK}${mode}しました: $TARGET${C_OFF}"
    [ "$moved" = 1 ] && echo "以前のファイル: $previous"
    if [ "$env_changed" = 1 ]; then echo "環境変数の設定: $ENV_FILE"; echo 'ログアウトしてログインし直してから、Claudeを起動してください。'
    else echo 'Claudeを完全に終了してから起動し直してください。（このスクリプトはClaudeを終了しません）'; fi
}

uninstall() {
    local owner backup by_us
    owner=$(target_owner "$TARGET")
    case "$owner" in react-devtools|unknown) echo '拡張フォルダーがこのツールのものではないため、何も変更しません。'; exit 1 ;; esac
    env_set_by_us && by_us=1 || by_us=0
    if [ "$owner" = none ] && ! { [ "$by_us" = 1 ] && [ -f "$ENV_FILE" ]; }; then echo '導入されていません。何も変更していません。'; return 0; fi
    confirm 'キー設定拡張を解除します。'
    backup=$STATE_ROOT/backups/$(date +%Y%m%d-%H%M%S)-$$
    if [ "$owner" != none ]; then
        mkdir -p "$backup" && mv "$TARGET" "$backup/removed" || { echo '拡張フォルダーを移動できませんでした。' >&2; exit 1; }
        echo "拡張フォルダーを移動しました（削除はしていません）: $backup/removed"
    fi
    if [ "$by_us" = 1 ] && [ -f "$ENV_FILE" ]; then
        mkdir -p "$backup" && mv "$ENV_FILE" "$backup/90-claude-ctrl-enter.conf" && echo "環境変数の設定を移動しました: $ENV_FILE"
    elif [ "$by_us" = 0 ]; then echo 'REACT_PROFILE はこのツールが設定したものではないため、そのままにしました。'; fi
    write_state removed "$(json_get "$STATE_FILE" version)" false "$(json_get "$STATE_FILE" installedAt)" "$( [ "$(json_get "$STATE_FILE" migratedFromLegacy)" = true ] && echo true || echo false)"
    echo "${C_OK}解除しました。ログアウトしてログインし直し、Claudeを起動すると拡張は読み込まれなくなります。${C_OFF}"
    echo 'キー設定の保存内容はClaude側に残ります。同じ場所へ再導入すると引き継がれます。'
}

case "$ACTION" in
    diagnose)
        diagnose
        if [ "$NG_COUNT" -gt 0 ]; then echo "結果: 問題が $NG_COUNT 件あります。上の NG を確認してください。"; echo 'この診断は読み取りだけで、何も変更していません。'; exit 1; fi
        echo '結果: 問題は見つかりませんでした。'; echo 'この診断は読み取りだけで、何も変更していません。' ;;
    install) install ;;
    uninstall) uninstall ;;
esac
