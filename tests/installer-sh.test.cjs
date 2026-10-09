// Exercises scripts/claude-keys.sh (Linux) and through it the claude-desktop-webext loader (webext.py)
// with --sandbox: HOME, /etc and app.asar lookups are redirected into a temp folder. Runs with bash on
// Linux/macOS and Git Bash on Windows; needs python3 on that bash's PATH (skipped otherwise).
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe';
const bash = process.platform === 'win32' ? gitBash : 'bash';
if (process.platform === 'win32' && !fs.existsSync(gitBash)) { console.log('SKIP: Git Bash not found'); process.exit(0); }
if (spawnSync(bash, ['-c', 'python3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)"']).status !== 0) {
  console.log('SKIP (sh): python3 >= 3.8 is not available to bash (the Linux loader needs it)');
  process.exit(0);
}
const toBash = p => process.platform === 'win32' ? p.replace(/^([A-Za-z]):/, (_, d) => '/' + d.toLowerCase()).replace(/\\/g, '/') : p;

const repo = path.join(__dirname, '..');
const script = toBash(path.join(repo, 'scripts', 'claude-keys.sh'));
const id = 'fmkadmapgofadopljbjfkapdkoienihi';
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
    loaderEnv: path.join(root, '.config', 'environment.d', '90-claude-desktop-webext.conf'),
    oldEnv: path.join(root, '.config', 'environment.d', '90-claude-ctrl-enter.conf'),
    loaderState: path.join(root, '.local', 'share', 'claude-desktop-webext', 'state.json'),
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
const write = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const strays = p => exists(p.extDir) ? fs.readdirSync(p.extDir).filter(n => n !== id) : [];
const scripts = p => json(path.join(p.target, 'manifest.json')).content_scripts.map(c => c.js[0]);
function placeFlat(p, content = 'keep-me') {
  write(path.join(p.target, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'Claude Ctrl+Enter', version: '0.3.0' }));
  write(path.join(p.target, 'keys.js'), content);
  write(path.join(p.target, 'claude-keys.owner.json'), '{"tool":"claude-keys"}');
  write(p.oldEnv, 'REACT_PROFILE=1\n');
  write(p.state, JSON.stringify({ schema: 1, status: 'installed', version: '0.3.0', envSetByUs: true }, null, 2));
}

// 1. Fresh install via the loader: slot generated, the loader's environment.d file written.
let p = sandbox();
check(run(p, 'install'), 0);
assert.ok(exists(path.join(p.target, '.claude-desktop-webext.json')));
assert.deepEqual(scripts(p), ['ext/claude-ctrl-enter/keys.js', 'ext/claude-ctrl-enter/settings-ui.js']);
assert.match(fs.readFileSync(p.loaderEnv, 'utf8'), /^REACT_PROFILE=1$/m);
assert.equal(json(p.loaderState).envSetByUs, true);
assert.equal(json(p.state).manager, 'claude-desktop-webext');
check(run(p, 'diagnose'), 0);

// 2. Uninstall removes slot and env file (moved to backups); reinstall works.
check(run(p, 'uninstall'), 0);
assert.ok(!exists(p.target)); assert.ok(!exists(p.loaderEnv));
assert.equal(json(p.state).status, 'removed');
check(run(p, 'install'), 0);
assert.ok(exists(p.loaderEnv));

// 3. Migration from 0.3.x: old slot backed up by the loader, env adopted, old env file moved aside.
p = sandbox();
placeFlat(p);
check(run(p, 'uninstall'), 1); // must migrate first
assert.ok(exists(p.oldEnv));
check(run(p, 'install'), 0);
assert.ok(exists(path.join(p.target, '.claude-desktop-webext.json')));
assert.ok(exists(p.loaderEnv), 'loader now owns REACT_PROFILE');
assert.ok(!exists(p.oldEnv), 'old env file moved to backups');
assert.ok(fs.readdirSync(p.backups).some(d => exists(path.join(p.backups, d, '90-claude-ctrl-enter.conf'))));
assert.equal(json(p.loaderState).envSetByUs, true);
assert.equal(json(p.state).migratedFrom, 'flat');
check(run(p, 'uninstall'), 0);
assert.ok(!exists(p.loaderEnv));

// 4. REACT_PROFILE=1 already in ~/.profile: nothing written, .profile untouched on uninstall.
p = sandbox();
write(path.join(p.root, '.profile'), 'export REACT_PROFILE=1\n');
check(run(p, 'install'), 0);
assert.ok(!exists(p.loaderEnv));
check(run(p, 'uninstall'), 0);
assert.equal(fs.readFileSync(path.join(p.root, '.profile'), 'utf8'), 'export REACT_PROFILE=1\n');

// 5. Rollback during migration leaves the 0.3.x install exactly as it was.
p = sandbox();
placeFlat(p);
for (const step of ['copy', 'slot-stage', 'slot-swap', 'env', 'state']) {
  check(run(p, 'install', ['--fail-at', step]), 1);
  assert.equal(fs.readFileSync(path.join(p.target, 'keys.js'), 'utf8'), 'keep-me', step);
  assert.ok(exists(p.oldEnv), step); assert.ok(!exists(p.loaderEnv), step);
  assert.equal(json(p.state).status, 'installed', step);
  assert.deepEqual(strays(p), [], step);
}

// 6. Refusals leave everything untouched.
p = sandbox();
write(path.join(p.target, 'manifest.json'), JSON.stringify({ name: 'React Developer Tools', version: '6.0.0' }));
check(run(p, 'install'), 1);
assert.equal(json(path.join(p.target, 'manifest.json')).name, 'React Developer Tools');
p = sandbox(); write(path.join(p.root, '.profile'), 'export REACT_PROFILE="0"\n');
check(run(p, 'install'), 1); assert.ok(!exists(p.target)); assert.ok(!exists(p.loaderEnv));
p = sandbox(); write(path.join(p.root, 'etc', 'environment'), 'REACT_PROFILE=1\n');
check(run(p, 'install'), 1); assert.ok(!exists(p.target));
p = sandbox(); fs.rmSync(path.join(p.root, '.config', 'Claude'), { recursive: true });
check(run(p, 'install'), 1);

// 7. app.asar capability check: loader string missing → refuse; present → OK.
p = sandbox();
write(path.join(p.root, 'opt', 'Claude', 'resources', 'app.asar'), 'no loader here');
check(run(p, 'install'), 1); assert.ok(!exists(p.target));
write(path.join(p.root, 'opt', 'Claude', 'resources', 'app.asar'), 'xx process.env.REACT_PROFILE==="1" xx');
check(run(p, 'install'), 0);

console.log('PASS (sh): install/uninstall via loader, 0.3.x migration (env file handed over), pre-set env in ~/.profile, rollback during migration, refusals (React DevTools, foreign env, system env, no userData), app.asar loader check');

// The explicit installation path is forwarded, rather than silently ignored.
p = sandbox();
check(run(p, 'install', ['--claude-path', toBash(path.join(p.root, 'missing'))]), 1);
assert.ok(!exists(p.target));
