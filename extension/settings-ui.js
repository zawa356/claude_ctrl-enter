(() => {
  'use strict';
  if (window !== window.top || location.origin !== 'https://claude.ai') return;
  const defaults = { enabled: true, send: 'Ctrl+Enter', newline: 'Enter' };
  const keys = ['Enter', 'Ctrl+Enter', 'Shift+Enter', 'Alt+Enter'];
  const storageKey = 'claudeEnterSettingsV1';
  const valid = v => v && typeof v.enabled === 'boolean' && keys.includes(v.send) && keys.includes(v.newline) && v.send !== v.newline;
  let settings = { ...defaults };
  let loaded = false;
  let storageError = '';
  const publish = () => {
    document.documentElement.setAttribute('data-claude-enter-settings', JSON.stringify(settings));
    document.dispatchEvent(new Event('claude-enter-settings-changed'));
  };
  const host = document.createElement('div');
  host.id = 'claude-enter-settings-entry';
  host.style.cssText = 'display:block;flex:0 0 auto;min-width:0;width:100%;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { color:inherit; font:13px/1.5 system-ui,sans-serif; }
      button,select { font:inherit; }
      .entry { display:flex; align-items:center; gap:9px; box-sizing:border-box; width:calc(100% - 16px); margin:4px 8px; padding:9px 12px; border:0; border-radius:7px; background:transparent; color:inherit; cursor:pointer; text-align:left; }
      .entry:hover { background:rgba(128,128,128,.15); }
      .state { margin-left:auto; font-size:11px; opacity:.65; }
      .state.warn { color:#c34b36; opacity:1; }
      .status { color:#c34b36; opacity:1; }
      .status:empty { display:none; }
      dialog { color-scheme:light dark; color:CanvasText; background:Canvas; border:1px solid #8885; border-radius:14px; padding:24px; width:min(360px,calc(100vw - 72px)); box-shadow:0 20px 80px #0005; }
      dialog::backdrop { background:#0005; }
      h2 { margin:0 0 18px; font-size:18px; }
      label { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:18px 0; }
      select { padding:6px 8px; border:1px solid #8888; border-radius:6px; background:Canvas; color:CanvasText; }
      p { font-size:12px; opacity:.8; }
      .actions { display:flex; gap:8px; justify-content:flex-end; margin-top:22px; }
      .actions button { padding:7px 12px; cursor:pointer; border:1px solid #8887; border-radius:7px; background:Canvas; color:CanvasText; }
      .actions .save { background:#255c42; color:#fff; }
      .error { color:#c34b36; min-height:1.5em; opacity:1; }
      button:focus-visible,select:focus-visible { outline:2px solid #799fce; outline-offset:2px; }
    </style>
    <button class="entry" type="button"><span aria-hidden="true">⌨</span><span>キー設定</span><span class="state"></span></button>
    <dialog aria-labelledby="key-title">
      <h2 id="key-title">キー設定</h2>
      <label><span>キー設定を有効にする</span><input class="enabled" type="checkbox"></label>
      <label><span>送信</span><select class="send" aria-label="送信キー"></select></label>
      <label><span>改行</span><select class="newline" aria-label="改行キー"></select></label>
      <p>日本語の変換確定は保護します。無効にするとClaude標準の操作に戻ります。</p>
      <p>未割当のEnter／Ctrl+Enterは動作しません。設定はこの拡張に保存します。</p>
      <p class="status"></p>
      <p class="error" role="status" aria-live="polite"></p>
      <div class="actions"><button class="reset" type="button">初期値</button><button class="cancel" type="button">閉じる</button><button class="save" type="button">保存</button></div>
    </dialog>`;
  const $ = s => shadow.querySelector(s);
  for (const selector of ['.send', '.newline']) for (const key of keys) {
    const option = document.createElement('option'); option.value = key; option.textContent = key; $(selector).append(option);
  }
  const dialog = $('dialog');
  const storage = globalThis.chrome?.storage;
  const canStore = typeof storage?.local?.get === 'function' && typeof storage?.local?.set === 'function';
  // Problems reported by keys.js; shown so an "enabled" label never hides a non-working patch.
  const statusAttr = 'data-claude-enter-probe-main';
  const problems = {
    unsupported: ['非対応', '入力欄の仕様が想定と違うため、割り当てたキーが動作しません。キー設定を無効にするとClaude標準の操作に戻ります。'],
    'send-unavailable': ['送信不可', '送信ボタンを特定できなかったため、送信しませんでした。'],
    'newline-unavailable': ['改行不可', '改行を入れられませんでした。']
  };
  const refresh = () => {
    const problem = loaded && settings.enabled && problems[document.documentElement.getAttribute(statusAttr)];
    $('.state').textContent = !loaded ? '読込中' : !settings.enabled ? '無効' : problem ? problem[0] : '有効';
    $('.state').classList.toggle('warn', !!problem || !!storageError);
    $('.status').textContent = problem ? problem[1] : '';
  };
  new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: [statusAttr] });
  const fill = value => { $('.enabled').checked = value.enabled; $('.send').value = value.send; $('.newline').value = value.newline; };
  const formValue = () => ({ enabled: $('.enabled').checked, send: $('.send').value, newline: $('.newline').value });
  $('.entry').addEventListener('click', () => {
    fill(settings); $('.error').textContent = storageError || (!loaded ? '設定を読み込んでいます。' : '');
    $('.save').disabled = !loaded || !canStore;
    dialog.showModal();
  });
  $('.cancel').addEventListener('click', () => dialog.close());
  $('.reset').addEventListener('click', () => { fill(defaults); $('.error').textContent = '初期値に戻しました。「保存」で反映します。'; });
  $('.save').addEventListener('click', async () => {
    const value = formValue();
    if (!valid(value)) { $('.error').textContent = '送信と改行には別のキーを選んでください。'; return; }
    $('.save').disabled = true;
    try {
      await storage.local.set({ [storageKey]: value });
      settings = value; storageError = ''; publish(); refresh(); dialog.close();
    } catch { $('.error').textContent = '保存できませんでした。設定は変更していません。'; }
    finally { $('.save').disabled = false; }
  });
  const finishLoad = () => { loaded = true; publish(); refresh(); };
  if (!canStore) {
    storageError = '設定の保存機能を使えません。初期値で動作しており、変更は保存できません。';
    finishLoad();
  } else {
    storage.local.get(storageKey).then(result => {
      const stored = result?.[storageKey];
      if (valid(stored)) settings = stored;
      else if (stored !== undefined && stored !== null) storageError = '保存済み設定が壊れていたため、初期値で動作しています。保存し直すと直ります。';
      finishLoad();
    }).catch(() => {
      storageError = '保存済み設定を読めませんでした。初期値で動作しています。';
      finishLoad();
    });
    storage.onChanged?.addListener?.((changes, area) => {
      const change = area === 'local' ? changes[storageKey] : null;
      if (!change) return;
      // A removed value means "back to defaults"; an invalid value is ignored.
      const next = change.newValue === undefined ? { ...defaults } : valid(change.newValue) ? change.newValue : null;
      if (!next) return;
      settings = next; storageError = ''; publish(); refresh();
      const form = formValue();
      if (dialog.open && (form.enabled !== next.enabled || form.send !== next.send || form.newline !== next.newline)) {
        fill(next); $('.error').textContent = '別の画面で設定が変更されたため、表示を更新しました。';
      }
    });
  }
  // Only mount above a verified sidebar profile control; never overlay the composer.
  const sizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) host.hidden = entry.contentRect.width < 160;
    host.style.display = host.hidden ? 'none' : 'block';
  });
  const mount = () => {
    if (host.isConnected) return;
    const profile = document.querySelector('button[data-testid="user-menu-button"]');
    if (!profile) return;
    const sidebar = profile.closest('[data-testid="sidebar"]');
    const row = profile.closest('.df-footer-row');
    const tray = row?.parentElement;
    if (!sidebar || !row || !tray?.classList.contains('df-bottom-tray') || !sidebar.contains(tray)) return;
    tray.insertBefore(host, row);
    sizeObserver.disconnect();
    sizeObserver.observe(sidebar);
  };
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(() => { scheduled = false; mount(); }); }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  refresh(); mount();
})();

