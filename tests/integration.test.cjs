// Runs settings-ui.js (settings UI) and keys.js (key handling) together on a fixture page,
// driving them with real Chromium key events. chrome.storage is mocked with localStorage.
// This verifies the DOM bridge between the two scripts; it does not reproduce Claude's real
// editor, real IME event order, or Electron's extension storage.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const read = name => fs.readFileSync(path.join(__dirname, '..', 'extension', name), 'utf8');
const fixture = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;display:flex">
<aside data-testid="sidebar" style="width:280px;height:100vh;display:flex;flex-direction:column">
  <div style="flex:1">sidebar fixture</div>
  <div class="df-bottom-tray"><div class="df-footer-row" style="display:flex">
    <div style="flex:1"><button data-testid="user-menu-button">Profile</button></div></div></div>
</aside>
<main style="flex:1;padding:20px">
  <div id="editor" class="tiptap ProseMirror" contenteditable="true" style="border:1px solid #888;min-height:60px"></div>
  <button data-testid="chat-input-send" type="button">Send</button>
  <div id="menu" role="menu" hidden><div role="menuitem">item</div></div>
</main>
<section style="width:300px;padding:20px">
  <!-- A second editor (e.g. editing an earlier message) with no send button of its own. -->
  <div id="other" class="tiptap ProseMirror" contenteditable="true" style="border:1px solid #888;min-height:60px"></div>
</section>
<script>
  window.log = [];
  const el = document.getElementById('editor');
  // Stand-in for Claude's tiptap editor API and its own Enter-to-send handler.
  // Slash menu stand-in: plugin state + a role=menu popup, toggled by window.openMenu(bool).
  window.suggestion = { active: false };
  el.editor = { commands: { setHardBreak: () => { log.push('newline'); return true; } }, view: {},
    state: { plugins: [{ key: 'slash-command-suggestion$', getState: () => window.suggestion }] } };
  window.openMenu = open => { window.suggestion.active = open; document.getElementById('menu').hidden = !open; };
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) { e.preventDefault(); log.push('app-send'); }
  });
  document.getElementById('other').editor = { commands: { setHardBreak: () => { log.push('other-newline'); return true; } }, view: {} };
  document.querySelector('[data-testid="chat-input-send"]').addEventListener('click', () => log.push('click-send'));
</script></body></html>`;

const storageMock = () => {
  const listeners = [];
  window.__failNextSet = false;
  window.chrome = window.chrome || {};
  window.chrome.storage = {
    local: {
      get: async key => (localStorage.getItem(key) === null ? {} : { [key]: JSON.parse(localStorage.getItem(key)) }),
      remove: async key => {
        const oldValue = JSON.parse(localStorage.getItem(key) || 'null');
        localStorage.removeItem(key);
        for (const fn of listeners) fn({ [key]: { oldValue } }, 'local');
      },
      set: async value => {
        if (window.__failNextSet) { window.__failNextSet = false; throw new Error('mock failure'); }
        for (const [key, v] of Object.entries(value)) {
          const oldValue = JSON.parse(localStorage.getItem(key) || 'null');
          localStorage.setItem(key, JSON.stringify(v));
          for (const fn of listeners) fn({ [key]: { oldValue, newValue: v } }, 'local');
        }
      }
    },
    onChanged: { addListener: fn => listeners.push(fn) }
  };
};

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1100, height: 760 } });
    await context.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: fixture }));
    await context.addInitScript(storageMock);
    const page = await context.newPage();

    const load = async () => {
      await page.goto('https://claude.ai/new');
      await page.addScriptTag({ content: read('keys.js') });
      await page.addScriptTag({ content: read('settings-ui.js') });
      await page.waitForFunction(() => document.documentElement.hasAttribute('data-claude-enter-settings'));
    };
    const press = async (key, target = '#editor') => {
      await page.evaluate(() => { window.log = []; });
      await page.locator(target).focus();
      await page.keyboard.press(key);
      return page.evaluate(() => window.log);
    };
    const save = async ({ enabled, send, newline }) => {
      await page.getByRole('button', { name: /キー設定/ }).click();
      await page.getByLabel('キー設定を有効にする').setChecked(enabled);
      // Change newline first so that an intermediate duplicate never blocks saving.
      await page.getByLabel('改行キー').selectOption(newline);
      await page.getByLabel('送信キー').selectOption(send);
      await page.getByRole('button', { name: '保存', exact: true }).click();
    };
    const dialogOpen = () => page.locator('dialog').evaluate(el => el.open);
    const label = () => page.locator('#claude-enter-settings-entry .state').textContent();

    // Defaults: Enter -> newline, Ctrl+Enter -> click send, Claude's own handler never runs.
    await load();
    assert.deepEqual(await press('Enter'), ['newline']);
    assert.deepEqual(await press('Control+Enter'), ['click-send']);
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-claude-enter-probe-main')), 'active');
    // Ctrl+Enter in another editor must not press the main composer's send button.
    assert.deepEqual(await press('Control+Enter', '#other'), []);
    assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-claude-enter-probe-main')), 'send-unavailable');
    assert.equal(await label(), '送信不可', 'sidebar must surface the main-world problem');
    assert.deepEqual(await press('Enter', '#other'), ['other-newline']);
    assert.equal(await label(), '有効');
    // Missing editor API: keys do nothing and the sidebar says so instead of "有効".
    await page.evaluate(() => { window.__hb = editor.editor.commands.setHardBreak; delete editor.editor.commands.setHardBreak; });
    assert.deepEqual(await press('Enter'), []);
    assert.equal(await label(), '非対応');
    await page.getByRole('button', { name: /キー設定/ }).click();
    await page.getByText('入力欄の仕様が想定と違うため').waitFor();
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    await page.evaluate(() => { editor.editor.commands.setHardBreak = window.__hb; });
    assert.deepEqual(await press('Enter'), ['newline']);
    assert.equal(await label(), '有効');

    // Slash menu open: plain Enter reaches Claude's own handler (which picks the item in the real app).
    await page.evaluate(() => openMenu(true));
    assert.deepEqual(await press('Enter'), ['app-send'], 'Enter must pass through to Claude while the menu is open');
    await page.evaluate(() => { window.suggestion.active = true; document.getElementById('menu').hidden = true; });
    assert.deepEqual(await press('Enter'), ['newline'], 'suggestion active but no visible menu: keep newline');
    await page.evaluate(() => openMenu(false));
    assert.deepEqual(await press('Enter'), ['newline']);

    // Disable from the UI: Claude's default behavior comes back immediately.
    await save({ enabled: false, send: 'Ctrl+Enter', newline: 'Enter' });
    assert.equal(await dialogOpen(), false);
    assert.deepEqual(await press('Enter'), ['app-send']);

    // Re-enable with a swapped layout.
    await save({ enabled: true, send: 'Enter', newline: 'Shift+Enter' });
    assert.deepEqual(await press('Enter'), ['click-send']);
    assert.deepEqual(await press('Shift+Enter'), ['newline']);
    assert.deepEqual(await press('Control+Enter'), [], 'unassigned Ctrl+Enter must be swallowed');

    // Reload: the saved layout is restored from storage and reaches the key handler.
    await load();
    assert.deepEqual(await press('Enter'), ['click-send']);

    // A failed save keeps the dialog open, shows an error, and leaves key handling unchanged.
    await page.evaluate(() => { window.__failNextSet = true; });
    await save({ enabled: true, send: 'Ctrl+Enter', newline: 'Enter' });
    await page.getByText('保存できませんでした。設定は変更していません。').waitFor();
    assert.equal(await dialogOpen(), true);
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    assert.deepEqual(await press('Enter'), ['click-send']);

    // A change made elsewhere while the dialog is open refreshes the form and the key handler.
    await page.getByRole('button', { name: /キー設定/ }).click();
    await page.evaluate(() => chrome.storage.local.set({ claudeEnterSettingsV1: { enabled: false, send: 'Ctrl+Enter', newline: 'Enter' } }));
    await page.getByText('別の画面で設定が変更されたため、表示を更新しました。').waitFor();
    assert.equal(await page.getByLabel('キー設定を有効にする').isChecked(), false);
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    assert.equal(await label(), '無効');
    assert.deepEqual(await press('Enter'), ['app-send']);

    // Removing the stored value returns to defaults.
    await page.evaluate(() => chrome.storage.local.remove('claudeEnterSettingsV1'));
    assert.equal(await label(), '有効');
    assert.deepEqual(await press('Enter'), ['newline']);

    // Corrupted stored value: defaults apply and the dialog explains why.
    await page.evaluate(() => localStorage.setItem('claudeEnterSettingsV1', JSON.stringify({ enabled: 'yes', send: 'X' })));
    await load();
    assert.deepEqual(await press('Enter'), ['newline']);
    await page.getByRole('button', { name: /キー設定/ }).click();
    await page.getByText('保存済み設定が壊れていたため').waitFor();
    await page.getByRole('button', { name: '閉じる', exact: true }).click();

    // No chrome.storage at all: UI still mounts, keys run on defaults, saving is disabled.
    const bare = await browser.newContext();
    await bare.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: fixture }));
    const barePage = await bare.newPage();
    await barePage.goto('https://claude.ai/new');
    await barePage.evaluate(() => { if (window.chrome) delete window.chrome.storage; });
    await barePage.addScriptTag({ content: read('keys.js') });
    await barePage.addScriptTag({ content: read('settings-ui.js') });
    await barePage.getByRole('button', { name: /キー設定/ }).click();
    await barePage.getByText('設定の保存機能を使えません').waitFor();
    assert.equal(await barePage.getByRole('button', { name: '保存', exact: true }).isDisabled(), true);
    await barePage.getByRole('button', { name: '閉じる', exact: true }).click();
    await barePage.locator('#editor').focus();
    await barePage.keyboard.press('Enter');
    assert.deepEqual(await barePage.evaluate(() => window.log), ['newline']);
    await bare.close();

    console.log('PASS: UI<->key bridge, send scoped to its editor, slash menu passthrough, status label (send-unavailable/unsupported), disable/enable, remap, unassigned swallow, reload restore, save failure, external change while open, removal->defaults, corrupted value, no storage API');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
