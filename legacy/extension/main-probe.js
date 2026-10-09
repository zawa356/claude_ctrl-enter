(() => {
  'use strict';
  if (window !== window.top || location.origin !== 'https://claude.ai') return;
  window.__claudeEnterPatch?.abort();
  const controller = new AbortController();
  window.__claudeEnterPatch = controller;
  const options = { capture: true, signal: controller.signal };
  const selector = '.tiptap.ProseMirror[contenteditable="true"]';
  const states = new WeakMap();
  const defaults = { enabled: true, send: 'Ctrl+Enter', newline: 'Enter' };
  let settings = defaults;
  const readSettings = () => {
    try {
      const value = JSON.parse(document.documentElement.getAttribute('data-claude-enter-settings'));
      const keys = ['Enter', 'Ctrl+Enter', 'Shift+Enter', 'Alt+Enter'];
      if (value && typeof value.enabled === 'boolean' && keys.includes(value.send) && keys.includes(value.newline) && value.send !== value.newline) settings = value;
    } catch {}
  };
  readSettings();
  const status = value => document.documentElement.setAttribute('data-claude-enter-probe-main', value);
  const input = e => e.target instanceof Element ? e.target.closest(selector) : null;
  const stateFor = el => {
    if (!states.has(el)) states.set(el, { composing: false, endedAt: -Infinity });
    return states.get(el);
  };
  const compatible = el => typeof el?.editor?.commands?.setHardBreak === 'function';
  window.addEventListener('compositionstart', e => {
    const el = input(e);
    if (el) stateFor(el).composing = true;
  }, options);
  window.addEventListener('compositionend', e => {
    const el = input(e);
    if (el) Object.assign(stateFor(el), { composing: false, endedAt: performance.now() });
  }, options);
  window.addEventListener('focusout', e => {
    const el = input(e);
    if (el) stateFor(el).composing = false;
  }, options);
  window.addEventListener('focusin', e => {
    const el = input(e);
    if (el) status(!settings.enabled ? 'disabled' : compatible(el) ? 'active' : 'unsupported');
  }, options);
  window.addEventListener('keydown', e => {
    const el = input(e);
    if (!el || e.key !== 'Enter' || !settings.enabled) return;
    const state = stateFor(el);
    const editor = el.editor;
    if (state.composing || e.isComposing || e.keyCode === 229 || editor?.view?.composing) {
      // Preserve IME default behavior, but stop application send handlers.
      e.stopImmediatePropagation();
      return;
    }
    if (performance.now() - state.endedAt < 100) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (e.metaKey) return;
    const key = [e.ctrlKey && 'Ctrl', e.shiftKey && 'Shift', e.altKey && 'Alt', 'Enter'].filter(Boolean).join('+');
    const action = key === settings.send ? 'send' : key === settings.newline ? 'newline' : null;
    if (!action) {
      if (key === 'Enter' || key === 'Ctrl+Enter') { e.preventDefault(); e.stopImmediatePropagation(); }
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    if (!compatible(el)) { status('unsupported'); return; }
    try {
      if (action === 'send') {
        const buttons = [...document.querySelectorAll('button[data-testid="chat-input-send"]')]
          .filter(b => b.getClientRects().length > 0);
        if (buttons.length !== 1) { status('send-unavailable'); return; }
        const button = buttons[0];
        if (button.disabled || button.getAttribute('aria-disabled') === 'true') return;
        button.click();
      } else if (editor.commands.setHardBreak() !== true) {
        status('newline-unavailable');
        return;
      }
      status('active');
    } catch {
      status('unsupported');
    }
  }, options);
  let attempts = 0;
  let timer;
  const check = () => {
    const el = document.querySelector(selector);
    status(!settings.enabled ? 'disabled' : el ? (compatible(el) ? 'active' : 'unsupported') : 'waiting');
    if (!el && ++attempts < 240) timer = setTimeout(check, 500);
  };
  controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  document.addEventListener('claude-enter-settings-changed', () => { readSettings(); clearTimeout(timer); check(); }, { signal: controller.signal });
  check();
})();
