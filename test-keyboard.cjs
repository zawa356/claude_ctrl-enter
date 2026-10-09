const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const code = readFileSync(join(__dirname, 'extension/main-probe.js'), 'utf8');
let now = 1000, breaks = 0, sends = 0, status;
let savedSettings = null;
const docListeners = [];
class Element { closest() { return this.isEditor ? this : null; } }
const editor = new Element();
editor.isEditor = true;
editor.editor = { commands: { setHardBreak: () => { breaks++; return true; } }, view: {} };
const button = { disabled: false, getClientRects: () => [1], getAttribute: () => null, click: () => sends++ };
let buttons = [button];
const listeners = [];
const window = { addEventListener: (type, fn, options) => listeners.push({ type, fn, options }) };
window.top = window;
const context = vm.createContext({ window, Element, AbortController, performance: { now: () => now }, setTimeout, clearTimeout,
  location: { origin: 'https://claude.ai' }, document: {
    addEventListener: (type, fn, options) => docListeners.push({type, fn, options}),
    documentElement: { setAttribute: (_, value) => status = value, getAttribute: () => JSON.stringify(savedSettings) },
    querySelector: () => editor, querySelectorAll: () => buttons
  }
});
function event(type, extra = {}) {
  const e = { target: editor, key: 'Enter', preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra };
  for (const l of listeners) if (l.type === type && !l.options.signal.aborted) { l.fn(e); if (e.stopped) break; }
  return e;
}
vm.runInContext(code, context);
assert.equal(status, 'active');
event('keydown'); assert.equal(breaks, 1); assert.equal(sends, 0);
event('keydown', { ctrlKey: true }); assert.equal(sends, 1);
event('keydown', { repeat: true, ctrlKey: true }); assert.equal(sends, 1);
event('compositionstart');
assert.equal(event('keydown', { ctrlKey: true }).prevented, undefined);
assert.equal(sends, 1);
event('compositionend'); event('keydown'); assert.equal(breaks, 1);
now += 101; event('keydown'); assert.equal(breaks, 2);
assert.equal(event('keydown', { isComposing: true }).prevented, undefined);
assert.equal(event('keydown', { keyCode: 229 }).prevented, undefined);
assert.equal(event('keydown', { shiftKey: true }).stopped, undefined);
event('keydown', { target: new Element() }); assert.equal(breaks, 2);
button.disabled = true; event('keydown', { ctrlKey: true }); assert.equal(sends, 1);
button.disabled = false; buttons = [button, button]; event('keydown', { ctrlKey: true }); assert.equal(sends, 1);
assert.equal(status, 'send-unavailable');
buttons = [button];
vm.runInContext(code, context); event('keydown'); assert.equal(breaks, 3);
const command = editor.editor.commands.setHardBreak;
delete editor.editor.commands.setHardBreak;
assert.equal(event('keydown', { ctrlKey: true }).prevented, true);
assert.equal(sends, 1); assert.equal(status, 'unsupported');
editor.editor.commands.setHardBreak = command;
function configure(value) {
  savedSettings = value;
  for (const l of docListeners) if (!l.options.signal.aborted) l.fn();
}
configure({ enabled:false, send:'Ctrl+Enter', newline:'Enter' });
assert.equal(event('keydown').prevented, undefined); assert.equal(breaks, 3);
configure({ enabled:true, send:'Enter', newline:'Shift+Enter' });
event('keydown'); assert.equal(sends, 2);
event('keydown', { shiftKey:true }); assert.equal(breaks, 4);
configure({ enabled:true, send:'Ctrl+Enter', newline:'Shift+Enter' });
assert.equal(event('keydown').prevented, true); assert.equal(sends, 2);
configure({ enabled:true, send:'Enter', newline:'Enter' });
event('keydown'); assert.equal(sends, 2);
window.__claudeEnterPatch.abort(); event('keydown'); assert.equal(breaks, 4);
console.log('PASS: newline, send, repeat, IME, timing, modifiers, scope, disabled/ambiguous send, duplicate install, incompatible API, teardown');
