const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;font-family:Arial"><aside data-testid="sidebar" style="width:280px;height:100vh;display:flex;flex-direction:column;background:#f7f7f5"><div style="flex:1;padding:20px">Claude — sidebar fixture</div><div class="df-bottom-tray"><div class="df-footer-row" style="display:flex"><div style="flex:1"><button data-testid="user-menu-button">Profile</button></div><button>Other</button></div></div></aside></body></html>' }));
    await page.goto('https://claude.ai/new');
    await page.evaluate(() => {
      window.chrome.storage = {
        local: {
          get: async key => ({ [key]: JSON.parse(localStorage.getItem(key) || 'null') }),
          set: async value => { for (const [key,v] of Object.entries(value)) localStorage.setItem(key,JSON.stringify(v)); }
        }, onChanged: { addListener() {} }
      };
    });
    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname,'..','extension','settings-ui.js'),'utf8') });
    await page.getByRole('button', { name: /キー設定/ }).click();
    await page.getByLabel('キー設定を有効にする').uncheck();
    await page.getByLabel('送信キー').selectOption('Enter');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await page.getByText('送信と改行には別のキーを選んでください。').waitFor();
    await page.getByLabel('改行キー').selectOption('Shift+Enter');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('claudeEnterSettingsV1')));
    assert.deepEqual(stored, { enabled:false, send:'Enter', newline:'Shift+Enter' });
    assert.equal(await page.locator('dialog').evaluate(el => el.open), false);
    await page.getByRole('button', { name: /キー設定/ }).click();
    assert.equal(await page.getByLabel('キー設定を有効にする').isChecked(), false);
    await page.screenshot({path:path.join(__dirname,'..','settings-preview.png')});
    await page.getByRole('button', { name: '初期値', exact: true }).click();
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('claudeEnterSettingsV1'))),stored);
    console.log('PASS: sidebar placement, dialog, duplicate validation, save, reopen, unsaved reset/cancel');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
