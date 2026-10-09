// Exercises scripts/claude-keys.sh (Linux) with --sandbox: HOME, /etc and app.asar lookups are redirected
// into a temp folder. Runs with bash on Linux/macOS and Git Bash on Windows. --fail-at injects failures.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe';
const bash = process.platform === 'win32' ? gitBash : 'bash';
if (process.platform === 'win32' && !fs.existsSync(gitBash)) { console.log('SKIP: Git Bash not found'); process.exit(0); }
const toBash = p => process.platform === 'win32' ? p.replace(/^([A-Za-z]):/, (_, d) => '/' + d.toLowerCase()).replace(/\\/g, '/') : p;

const script = toBash(path.join(__dirname, '..', 'scripts', 'claude-keys.sh'));
const id = 'fmkadmapgofadopljbjfkapdkoienihi';
const sources = fs.readdirSync(path.join(__dirname, '..', 'extension'));
const roots = [];
process.on('exit', () => { for (const r of roots) fs.rmSync(r, { recursive: true, force: true }); });

function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-keys-sh-test-'));
  roots.push(root);
  fs.mkdirSync(path.join(root, '.config', 'Claude'), { recursive: true });
  return {
    root,
    target: path.join(root, '.config', 'Claude', 'extensions', id),
    extDir: path.join(root, '.config', 'Claude', 'extensions'),
    envFile: path.join(root, '.config', 'environment.d', '90-claude-ctrl-enter.conf'),
    state: path.join(root, '.local', 'state', 'claude-keys', 'state.json'),
    backups: path.join(root, '.local', 'state', 'claude-keys', 'backups')
  };
}
function run(p, action, extra = []) {
  const r = spawnSync(bash, [script, action, '--yes', '--sandbox', toBash(p.root), ...extra], { encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
const exists = f => fs.existsSync(f);
const json = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const check = (r, code) => assert.equal(r.code, code, r.out);
const backupDirs = p => exists(p.backups) ? fs.readdirSync(p.backups).map(d => path.join(p.backups, d)) : [];
const strays = p => exists(p.extDir) ? fs.readdirSync(p.extDir).filter(n => n !== id) : [];
const write = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const placeLegacy = (p, content = 'legacy') => {
  write(path.join(p.target, 'manifest.json'), JSON.stringify({ name: 'Claude Enter Patch - Load Probe', version: '0.2.0' }));
  write(path.join(p.target, 'main-probe.js'), content);
};

// 1. Fresh install: files + marker, dedicated environment.d file, state says env is ours.
let p = sandbox();
check(run(p, 'install'), 0);
for (const name of [...sources, 'claude-keys.owner.json']) assert.ok(exists(path.join(p.target, name)), name);
assert.match(fs.readFileSync(p.envFile, 'utf8'), /^REACT_PROFILE=1$/m);
assert.equal(json(p.state).envSetByUs, true);
assert.deepEqual(strays(p), []);
check(run(p, 'diagnose'), 0);

// 2. Update keeps env file, moves previous copy to backups.
check(run(p, 'install'), 0);
assert.equal(backupDirs(p).length, 1);
assert.ok(exists(path.join(backupDirs(p)[0], 'previous', 'claude-keys.owner.json')));
assert.ok(exists(p.envFile));

// 3. Uninstall moves folder and env file aside; idempotent; reinstall works.
check(run(p, 'uninstall'), 0);
assert.ok(!exists(p.target)); assert.ok(!exists(p.envFile));
assert.equal(json(p.state).status, 'removed');
check(run(p, 'uninstall'), 0);
check(run(p, 'install'), 0);
assert.ok(exists(p.envFile));

// 4. REACT_PROFILE=1 already in ~/.profile: no env file written, uninstall leaves .profile alone.
p = sandbox();
write(path.join(p.root, '.profile'), 'export REACT_PROFILE=1\n');
check(run(p, 'install'), 0);
assert.ok(!exists(p.envFile));
assert.equal(json(p.state).envSetByUs, false);
check(run(p, 'uninstall'), 0);
assert.equal(fs.readFileSync(path.join(p.root, '.profile'), 'utf8'), 'export REACT_PROFILE=1\n');

// 5. Legacy prototype folder is updated in place.
p = sandbox();
placeLegacy(p);
write(path.join(p.root, '.profile'), 'export REACT_PROFILE=1\n');
check(run(p, 'install'), 0);
assert.ok(exists(path.join(p.target, 'claude-keys.owner.json')));
assert.equal(fs.readFileSync(path.join(backupDirs(p)[0], 'previous', 'main-probe.js'), 'utf8'), 'legacy');
assert.equal(json(p.state).migratedFromLegacy, true);

// 6. Rollback on a fresh install at every step.
p = sandbox();
for (const step of ['copy', 'swap', 'env', 'state']) {
  check(run(p, 'install', ['--fail-at', step]), 1);
  assert.ok(!exists(p.target), step); assert.ok(!exists(p.envFile), step); assert.ok(!exists(p.state), step);
  assert.deepEqual(strays(p), [], step);
}

// 7. Rollback during an update restores the previous version.
p = sandbox();
placeLegacy(p, 'keep-me');
write(path.join(p.root, '.profile'), 'export REACT_PROFILE=1\n');
for (const step of ['swap', 'env', 'state']) {
  check(run(p, 'install', ['--fail-at', step]), 1);
  assert.equal(fs.readFileSync(path.join(p.target, 'main-probe.js'), 'utf8'), 'keep-me', step);
  assert.deepEqual(strays(p), [], step);
}

// 8. Refusals leave everything untouched.
p = sandbox();
write(path.join(p.target, 'manifest.json'), JSON.stringify({ name: 'React Developer Tools', version: '6.0.0' }));
check(run(p, 'install'), 1); check(run(p, 'uninstall'), 1);
assert.equal(json(path.join(p.target, 'manifest.json')).name, 'React Developer Tools'); assert.ok(!exists(p.envFile));
p = sandbox(); write(path.join(p.root, '.profile'), 'export REACT_PROFILE="0"\n');
check(run(p, 'install'), 1); assert.ok(!exists(p.target)); assert.ok(!exists(p.envFile));
p = sandbox(); write(path.join(p.root, 'etc', 'environment'), 'REACT_PROFILE=1\n');
check(run(p, 'install'), 1); assert.ok(!exists(p.target));
p = sandbox(); fs.rmSync(path.join(p.root, '.config', 'Claude'), { recursive: true });
check(run(p, 'install'), 1);

// 9. app.asar capability check: loader string missing → refuse; present → OK.
p = sandbox();
write(path.join(p.root, 'app', 'resources', 'app.asar'), 'no loader here');
check(run(p, 'install'), 1); assert.ok(!exists(p.target));
write(path.join(p.root, 'app', 'resources', 'app.asar'), 'xx process.env.REACT_PROFILE==="1" xx');
check(run(p, 'install'), 0);

console.log('PASS (sh): install, update, uninstall (idempotent, reinstall), pre-set env in ~/.profile, legacy migration, rollback at copy/swap/env/state (fresh & update), refusals (React DevTools, foreign env, system env, no userData), app.asar loader check');
