// Exercises scripts/claude-keys.ps1 in -Sandbox mode: every path (userData, state, legacy state)
// and the REACT_PROFILE user/machine values are redirected into a temp folder, so the real
// registry and %APPDATA% are never touched. -FailAt injects a failure to test rollback.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const script = path.join(__dirname, 'scripts', 'claude-keys.ps1');
const id = 'fmkadmapgofadopljbjfkapdkoienihi';
const sources = fs.readdirSync(path.join(__dirname, 'extension'));

const roots = [];
process.on('exit', () => { for (const r of roots) fs.rmSync(r, { recursive: true, force: true }); });
function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-keys-test-'));
  roots.push(root);
  fs.mkdirSync(path.join(root, 'AppData', 'Roaming', 'Claude'), { recursive: true });
  const p = {
    root,
    target: path.join(root, 'AppData', 'Roaming', 'Claude', 'extensions', id),
    extDir: path.join(root, 'AppData', 'Roaming', 'Claude', 'extensions'),
    state: path.join(root, 'AppData', 'Local', 'ClaudeKeys', 'state.json'),
    backups: path.join(root, 'AppData', 'Local', 'ClaudeKeys', 'backups'),
    legacyState: path.join(root, 'AppData', 'Local', 'ClaudePatchLab', 'enter-probe-state', 'state.json'),
    env: scope => path.join(root, `env-${scope}.json`)
  };
  return p;
}
function run(p, action, extra = []) {
  const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script,
    '-Action', action, '-Yes', '-Sandbox', p.root, ...extra], { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
const json = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
const exists = file => fs.existsSync(file);
const userEnv = p => exists(p.env('User')) ? json(p.env('User')).Value : null;
const setEnv = (p, scope, Value) => fs.writeFileSync(p.env(scope), JSON.stringify({ Value, Kind: 'String' }));
const backupDirs = p => exists(p.backups) ? fs.readdirSync(p.backups).map(d => path.join(p.backups, d)) : [];
const strays = p => fs.readdirSync(p.extDir).filter(n => n !== id);
const placeLegacy = (p, content = 'legacy') => {
  fs.mkdirSync(p.target, { recursive: true });
  fs.writeFileSync(path.join(p.target, 'manifest.json'), JSON.stringify({ name: 'Claude Enter Patch - Load Probe', version: '0.2.0' }));
  fs.writeFileSync(path.join(p.target, 'main-probe.js'), content);
};
const check = (r, code) => assert.equal(r.code, code, r.out);

// 1. Fresh install: files + marker placed, env set, state records env as ours.
let p = sandbox();
check(run(p, 'install'), 0);
for (const name of [...sources, 'claude-keys.owner.json']) assert.ok(exists(path.join(p.target, name)), name);
assert.equal(userEnv(p), '1');
assert.equal(json(p.state).envSetByUs, true);
assert.deepEqual(strays(p), [], 'no staging folder left behind');
check(run(p, 'diagnose'), 0);

// 2. Re-run = update: previous copy goes to backups, env untouched, still owned by us.
check(run(p, 'install'), 0);
assert.equal(backupDirs(p).length, 1);
assert.ok(exists(path.join(backupDirs(p)[0], 'previous', 'claude-keys.owner.json')));
assert.equal(json(p.state).envSetByUs, true);

// 3. Uninstall: folder moved (not deleted), env removed, reinstall possible afterwards.
check(run(p, 'uninstall'), 0);
assert.ok(!exists(p.target));
assert.equal(userEnv(p), null);
assert.equal(json(p.state).status, 'removed');
assert.ok(backupDirs(p).some(d => exists(path.join(d, 'removed', 'manifest.json'))));
check(run(p, 'uninstall'), 0); // idempotent: nothing to do
check(run(p, 'install'), 0);
assert.equal(userEnv(p), '1');

// 4. Update from the 0.2.0 prototype (legacy name, legacy state says env was unset before).
p = sandbox();
placeLegacy(p);
fs.mkdirSync(path.dirname(p.legacyState), { recursive: true });
fs.writeFileSync(p.legacyState, JSON.stringify({ version: 1, hadValue: false, status: 'installed' }));
setEnv(p, 'User', '1');
check(run(p, 'install'), 0);
assert.ok(exists(path.join(p.target, 'claude-keys.owner.json')));
assert.equal(fs.readFileSync(path.join(backupDirs(p)[0], 'previous', 'main-probe.js'), 'utf8'), 'legacy');
assert.equal(json(p.state).envSetByUs, true, 'legacy installer set REACT_PROFILE, so uninstall may remove it');
assert.equal(json(p.state).migratedFromLegacy, true);
assert.equal(json(p.legacyState).status, 'installed', 'legacy state file is left untouched');
check(run(p, 'uninstall'), 0);
assert.equal(userEnv(p), null);

// 5. REACT_PROFILE=1 already set by the user: install keeps it, uninstall leaves it.
p = sandbox();
setEnv(p, 'User', '1');
check(run(p, 'install'), 0);
assert.equal(json(p.state).envSetByUs, false);
check(run(p, 'uninstall'), 0);
assert.equal(userEnv(p), '1');

// 6. Failure after placing files (fresh install): everything rolled back.
p = sandbox();
let r = run(p, 'install', ['-FailAt', 'state']);
check(r, 1);
assert.ok(!exists(p.target)); assert.equal(userEnv(p), null); assert.ok(!exists(p.state));
assert.deepEqual(strays(p), []);
for (const step of ['copy', 'swap', 'env']) { check(run(p, 'install', ['-FailAt', step]), 1); assert.ok(!exists(p.target), step); assert.equal(userEnv(p), null, step); }

// 7. Failure during an update: the previous version is put back in place.
p = sandbox();
placeLegacy(p, 'keep-me');
setEnv(p, 'User', '1');
for (const step of ['swap', 'env', 'state']) {
  check(run(p, 'install', ['-FailAt', step]), 1);
  assert.equal(fs.readFileSync(path.join(p.target, 'main-probe.js'), 'utf8'), 'keep-me', step);
  assert.equal(userEnv(p), '1', step);
  assert.deepEqual(strays(p), [], step);
}

// 8. Refusals: nothing is changed.
p = sandbox();
fs.mkdirSync(p.target, { recursive: true });
fs.writeFileSync(path.join(p.target, 'manifest.json'), JSON.stringify({ name: 'React Developer Tools', version: '6.0.0' }));
check(run(p, 'install'), 1);
check(run(p, 'uninstall'), 1);
assert.equal(json(path.join(p.target, 'manifest.json')).name, 'React Developer Tools');
assert.equal(userEnv(p), null);
p = sandbox(); setEnv(p, 'User', '0');
check(run(p, 'install'), 1); assert.equal(userEnv(p), '0'); assert.ok(!exists(p.target));
p = sandbox(); setEnv(p, 'Machine', '1');
check(run(p, 'install'), 1); assert.ok(!exists(p.target));

// 9. User changed REACT_PROFILE after install: uninstall leaves the new value alone.
p = sandbox();
check(run(p, 'install'), 0);
setEnv(p, 'User', '2');
check(run(p, 'uninstall'), 0);
assert.equal(userEnv(p), '2');

console.log('PASS: install, update, uninstall (idempotent, reinstall), legacy 0.2.0 migration, pre-set env kept, rollback at copy/swap/env/state (fresh & update), refusals (React DevTools, foreign env, machine env), env changed after install');
