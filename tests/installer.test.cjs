// Exercises scripts/claude-keys.ps1 (and through it the claude-desktop-webext loader) in -Sandbox mode:
// every path (Claude userData, loader store/state, ClaudeKeys state, legacy state) and the REACT_PROFILE
// user/machine values are redirected into a temp folder, so the real registry and %APPDATA% are never
// touched. -FailAt injects a failure inside the loader to test rollback.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const repo = path.join(__dirname, '..');
const script = path.join(repo, 'scripts', 'claude-keys.ps1');
const loaderScript = path.join(repo, 'vendor', 'claude-desktop-webext', 'bin', 'webext.ps1');
if (!fs.existsSync(loaderScript)) { console.error('FAIL: loader submodule missing. Run: git submodule update --init'); process.exit(1); }
const id = 'fmkadmapgofadopljbjfkapdkoienihi';
const sources = fs.readdirSync(path.join(repo, 'extension'));

const roots = [];
process.on('exit', () => { for (const r of roots) fs.rmSync(r, { recursive: true, force: true }); });
function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-keys-test-'));
  roots.push(root);
  fs.mkdirSync(path.join(root, 'AppData', 'Roaming', 'Claude'), { recursive: true });
  // The loader reads the (fake) MSIX package from here in sandbox mode.
  fs.writeFileSync(path.join(root, 'claude-package.json'), JSON.stringify({ Version: '2.31226.0.0', PackageFamilyName: 'Claude_pzs8sxrjxfjjc' }));
  const local = path.join(root, 'AppData', 'Local');
  return {
    root,
    target: path.join(root, 'AppData', 'Roaming', 'Claude', 'extensions', id),
    extDir: path.join(root, 'AppData', 'Roaming', 'Claude', 'extensions'),
    store: path.join(local, 'ClaudeDesktopWebExt', 'web-extensions'),
    loaderState: path.join(local, 'ClaudeDesktopWebExt', 'state.json'),
    loaderBackups: path.join(local, 'ClaudeDesktopWebExt', 'backups'),
    state: path.join(local, 'ClaudeKeys', 'state.json'),
    legacyState: path.join(local, 'ClaudePatchLab', 'enter-probe-state', 'state.json'),
    env: scope => path.join(root, `env-${scope}.json`)
  };
}
function run(p, action, extra = []) {
  const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script,
    '-Action', action, '-Yes', '-Sandbox', p.root, ...extra], { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
function runLoader(p, args) {
  const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', loaderScript, ...args, '-Yes', '-Sandbox', p.root], { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
const json = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
const exists = file => fs.existsSync(file);
const userEnv = p => exists(p.env('User')) ? json(p.env('User')).Value : null;
const setEnv = (p, scope, Value) => fs.writeFileSync(p.env(scope), JSON.stringify({ Value, Kind: 'String' }));
const loaderBackupDirs = p => exists(p.loaderBackups) ? fs.readdirSync(p.loaderBackups).map(d => path.join(p.loaderBackups, d)) : [];
const strays = p => exists(p.extDir) ? fs.readdirSync(p.extDir).filter(n => n !== id) : [];
const scripts = p => json(path.join(p.target, 'manifest.json')).content_scripts.map(c => c.js[0]);
const ours = p => scripts(p).filter(s => s.startsWith('ext/claude-ctrl-enter/'));
const check = (r, code) => assert.equal(r.code, code, r.out);
// 0.3.x layout: the extension files directly in the slot, plus the claude-keys owner marker and state.
function placeFlat(p, envSetByUs, content = 'old keys') {
  fs.mkdirSync(p.target, { recursive: true });
  fs.writeFileSync(path.join(p.target, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'Claude Ctrl+Enter', version: '0.3.0' }));
  fs.writeFileSync(path.join(p.target, 'keys.js'), content);
  fs.writeFileSync(path.join(p.target, 'claude-keys.owner.json'), JSON.stringify({ tool: 'claude-keys', schema: 1, version: '0.3.0' }));
  fs.mkdirSync(path.dirname(p.state), { recursive: true });
  fs.writeFileSync(p.state, JSON.stringify({ schema: 1, status: 'installed', version: '0.3.0', envSetByUs, installedAt: '2026-10-09T00:00:00Z' }));
}
function placeLegacy(p) {
  fs.mkdirSync(p.target, { recursive: true });
  fs.writeFileSync(path.join(p.target, 'manifest.json'), JSON.stringify({ name: 'Claude Enter Patch - Load Probe', version: '0.2.0' }));
  fs.writeFileSync(path.join(p.target, 'main-probe.js'), 'legacy');
}
// Another tool on the same loader (e.g. claude-split-ui).
function otherTool(p) {
  const src = path.join(p.root, 'other-src');
  fs.mkdirSync(path.join(src, 'cs'), { recursive: true });
  fs.writeFileSync(path.join(src, 'cs', 'hook.js'), 'void 0;');
  fs.writeFileSync(path.join(src, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'Other', version: '1.0.0',
    content_scripts: [{ matches: ['https://claude.ai/*'], js: ['cs/hook.js'], run_at: 'document_start', world: 'MAIN' }] }));
  check(runLoader(p, ['-Action', 'install', '-Id', 'other-tool', '-Source', src, '-Order', '10']), 0);
}

// 1. Fresh install: the extension lands in the loader store, the slot is generated, env is set.
let p = sandbox();
check(run(p, 'install'), 0);
for (const name of sources) assert.ok(exists(path.join(p.store, 'claude-ctrl-enter', name)), name);
assert.ok(exists(path.join(p.target, '.claude-desktop-webext.json')), 'slot managed by the loader');
assert.deepEqual(ours(p), ['ext/claude-ctrl-enter/keys.js', 'ext/claude-ctrl-enter/settings-ui.js']);
assert.deepEqual(json(path.join(p.target, 'manifest.json')).permissions, ['storage']);
assert.ok(!exists(path.join(p.target, 'claude-keys.owner.json')), 'old marker not used any more');
assert.equal(userEnv(p), '1');
assert.equal(json(p.loaderState).envSetByUs, true);
assert.equal(json(p.state).manager, 'claude-desktop-webext');
assert.deepEqual(strays(p), [], 'no staging folder left behind');
check(run(p, 'diagnose'), 0);

// 2. Re-run = update: still exactly one copy, env untouched.
check(run(p, 'install'), 0);
assert.deepEqual(ours(p), ['ext/claude-ctrl-enter/keys.js', 'ext/claude-ctrl-enter/settings-ui.js']);
assert.equal(json(p.loaderState).generation, 2);

// 3. Uninstall: slot and env removed, files moved (not deleted), reinstall possible afterwards.
check(run(p, 'uninstall'), 0);
assert.ok(!exists(p.target));
assert.equal(userEnv(p), null);
assert.equal(json(p.state).status, 'removed');
assert.ok(loaderBackupDirs(p).some(d => exists(path.join(d, 'store-removed-claude-ctrl-enter', 'manifest.json'))));
check(run(p, 'uninstall'), 0); // idempotent: nothing to do
check(run(p, 'install'), 0);
assert.equal(userEnv(p), '1');

// 4. Migration from 0.3.x (flat slot, env set by claude-keys): old slot backed up, env adopted.
p = sandbox();
placeFlat(p, true, 'keep-me');
setEnv(p, 'User', '1');
let r = run(p, 'diagnose');
check(r, 0);
assert.match(r.out, /previous standalone install/); // Japanese output depends on the console code page
check(run(p, 'uninstall'), 1); // must migrate first; nothing changed
assert.equal(fs.readFileSync(path.join(p.target, 'keys.js'), 'utf8'), 'keep-me');
check(run(p, 'install'), 0);
assert.ok(exists(path.join(p.target, '.claude-desktop-webext.json')));
assert.ok(loaderBackupDirs(p).some(d => exists(path.join(d, 'slot-previous', 'keys.js')) &&
  fs.readFileSync(path.join(d, 'slot-previous', 'keys.js'), 'utf8') === 'keep-me'), 'old slot kept in backups');
assert.equal(json(p.loaderState).envSetByUs, true, 'REACT_PROFILE ownership handed to the loader');
assert.equal(json(p.state).migratedFrom, 'flat');
check(run(p, 'uninstall'), 0);
assert.equal(userEnv(p), null);

// 5. Migration from 0.3.x when REACT_PROFILE was set by the user: uninstall leaves it.
p = sandbox();
placeFlat(p, false);
setEnv(p, 'User', '1');
check(run(p, 'install'), 0);
assert.equal(json(p.loaderState).envSetByUs, false);
check(run(p, 'uninstall'), 0);
assert.equal(userEnv(p), '1');

// 6. Migration from the 0.2.0 prototype (legacy state says env was unset before).
p = sandbox();
placeLegacy(p);
fs.mkdirSync(path.dirname(p.legacyState), { recursive: true });
fs.writeFileSync(p.legacyState, JSON.stringify({ version: 1, hadValue: false, status: 'installed' }));
setEnv(p, 'User', '1');
check(run(p, 'install'), 0);
assert.equal(json(p.loaderState).envSetByUs, true);
assert.equal(json(p.state).migratedFromLegacy, true);
assert.equal(json(p.legacyState).status, 'installed', 'legacy state file is left untouched');
check(run(p, 'uninstall'), 0);
assert.equal(userEnv(p), null);

// 7. Coexistence: another loader-based tool keeps working through install and uninstall.
p = sandbox();
otherTool(p);
check(run(p, 'install'), 0);
assert.deepEqual(scripts(p), ['ext/other-tool/cs/hook.js', 'ext/claude-ctrl-enter/keys.js', 'ext/claude-ctrl-enter/settings-ui.js']);
check(run(p, 'uninstall'), 0);
assert.deepEqual(scripts(p), ['ext/other-tool/cs/hook.js']);
assert.equal(userEnv(p), '1', 'env stays while another tool needs it');

// 8. Failure during migration: the 0.3.x slot and state stay exactly as they were.
p = sandbox();
placeFlat(p, true, 'keep-me');
setEnv(p, 'User', '1');
const stateBefore = fs.readFileSync(p.state, 'utf8');
for (const step of ['copy', 'slot-stage', 'slot-swap', 'env', 'state']) {
  check(run(p, 'install', ['-FailAt', step]), 1);
  assert.equal(fs.readFileSync(path.join(p.target, 'keys.js'), 'utf8'), 'keep-me', step);
  assert.ok(exists(path.join(p.target, 'claude-keys.owner.json')), step);
  assert.equal(fs.readFileSync(p.state, 'utf8'), stateBefore, step);
  assert.equal(userEnv(p), '1', step);
  assert.deepEqual(strays(p), [], step);
}

// 9. Refusals: nothing is changed.
p = sandbox();
fs.mkdirSync(p.target, { recursive: true });
fs.writeFileSync(path.join(p.target, 'manifest.json'), JSON.stringify({ name: 'React Developer Tools', version: '6.0.0' }));
check(run(p, 'install'), 1);
assert.equal(json(path.join(p.target, 'manifest.json')).name, 'React Developer Tools');
assert.equal(userEnv(p), null);
p = sandbox(); setEnv(p, 'User', '0');
check(run(p, 'install'), 1); assert.equal(userEnv(p), '0'); assert.ok(!exists(p.target));
p = sandbox(); setEnv(p, 'Machine', '1');
check(run(p, 'install'), 1); assert.ok(!exists(p.target));

// 10. User changed REACT_PROFILE after install: uninstall leaves the new value alone.
p = sandbox();
check(run(p, 'install'), 0);
setEnv(p, 'User', '2');
check(run(p, 'uninstall'), 0);
assert.equal(userEnv(p), '2');

// 11. MSIX virtualized userData: a folder for the same ID there blocks install.
p = sandbox();
const virtualTarget = path.join(p.root, 'AppData', 'Local', 'Packages', 'Claude_pzs8sxrjxfjjc', 'LocalCache', 'Roaming', 'Claude', 'extensions', id);
fs.mkdirSync(virtualTarget, { recursive: true });
fs.writeFileSync(path.join(virtualTarget, 'manifest.json'), JSON.stringify({ name: 'React Developer Tools', version: '6.0.0' }));
check(run(p, 'install'), 1);
assert.ok(!exists(p.target), 'must not install when a virtualized copy could shadow it');
assert.equal(userEnv(p), null);

console.log('PASS: install/update/uninstall via loader, 0.3.x and 0.2.0 migration (env adopted or left), coexistence with another loader tool, rollback during migration, refusals (React DevTools, foreign env, machine env, virtualized copy), env changed after install');
