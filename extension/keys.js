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
  // Until settings-ui.js delivers the stored settings, run on defaults but never send: the stored layout
  // may differ (e.g. disabled, or another send key). If nothing arrives, fall back to defaults.
  let ready = false;
  const readyTimer = setTimeout(() => { ready = true; }, 3000);
  const readSettings = () => {
    try {
      const value = JSON.parse(document.documentElement.getAttribute('data-claude-enter-settings'));
      const keys = ['Enter', 'Ctrl+Enter', 'Shift+Enter', 'Alt+Enter'];
      if (value && typeof value.enabled === 'boolean' && keys.includes(value.send) && keys.includes(value.newline) && value.send !== value.newline) {
        settings = value; ready = true; clearTimeout(readyTimer);
      }
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
  // Slash-command / mention menus are tiptap suggestion plugins whose state has active:true while open
  // (observed on Claude 2.31226: slash-command-suggestion$, mention$). Plain Enter must reach Claude
  // there to pick the item. Also require a visible menu, so an empty suggestion never falls through
  // to Claude's Enter-to-send. Any doubt -> false -> normal handling (newline), never an unexpected send.
  const menuOpen = editor => {
    try {
      const active = editor.state.plugins.some(p => /suggestion|mention/i.test(p.key) && p.getState(editor.state)?.active === true);
      return active && [...document.querySelectorAll('[role="menu"],[role="listbox"]')].some(m => m.getClientRects().length > 0);
    } catch { return false; }
  };
  // Find the send button that belongs to this editor: the nearest ancestor holding exactly one
  // visible send button, and no other editor. Anything ambiguous returns null (no send).
  const sendButtonFor = el => {
    for (let node = el.parentElement; node; node = node.parentElement) {
      const buttons = [...node.querySelectorAll('button[data-testid="chat-input-send"]')]
        .filter(b => b.getClientRects().length > 0);
      if (!buttons.length) continue;
      if (buttons.length > 1 || [...node.querySelectorAll(selector)].some(other => other !== el)) return null;
      return buttons[0];
    }
    return null;
  };
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
    if (key === 'Enter' && editor && menuOpen(editor)) return;
    const action = key === settings.send ? 'send' : key === settings.newline ? 'newline' : null;
    if (!action) {
      if (key === 'Enter' || key === 'Ctrl+Enter') { e.preventDefault(); e.stopImmediatePropagation(); }
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat || (action === 'send' && !ready)) return;
    if (!compatible(el)) { status('unsupported'); return; }
    try {
      if (action === 'send') {
        const button = sendButtonFor(el);
        if (!button) { status('send-unavailable'); return; }
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
  controller.signal.addEventListener('abort', () => { clearTimeout(timer); clearTimeout(readyTimer); }, { once: true });
  document.addEventListener('claude-enter-settings-changed', () => { readSettings(); clearTimeout(timer); check(); }, { signal: controller.signal });
  check();
})();
