import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detect } from './detect.js';
import { apply } from '../loop-init.mjs';
import { missingPacks, readDeclaredStack } from './packs.js';

const pluginRoot = join(import.meta.dirname, '..', '..');

const project = (files) => {
  const dir = mkdtempSync(join(tmpdir(), 'loop-init-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  Object.entries(files).forEach(([file, content]) => writeFileSync(join(dir, file), content));
  return dir;
};

const nodeProject = () => project({
  'package.json': JSON.stringify({ dependencies: { express: '5', mongoose: '8' }, devDependencies: { typescript: '6' } }),
  'tsconfig.json': '{}',
});

test('detect: typescript express mongo project without tests', () => {
  assert.deepEqual(detect(nodeProject()), {
    languages: ['typescript'], stacks: ['express', 'mongo'], hasTests: false, hasCi: false, hasLoopConfig: false,
  });
});

test('detect: python fastapi project', () => {
  const dir = project({ 'pyproject.toml': '[project]\ndependencies = ["fastapi", "asyncpg"]\n', 'test_app.py': '' });
  const result = detect(dir);
  assert.deepEqual(result.languages, ['python']);
  assert.deepEqual(result.stacks, ['fastapi', 'postgres']);
  assert.equal(result.hasTests, true);
});

test('packs: missing packs are reported', () => {
  assert.deepEqual(missingPacks(pluginRoot, { languages: ['python'], stacks: ['fastapi'] }), ['language:python', 'stack:fastapi']);
  assert.deepEqual(missingPacks(pluginRoot, { languages: ['typescript'], stacks: ['express'] }), []);
});

test('apply: sets up a project and is idempotent', () => {
  const dir = nodeProject();
  const declared = { languages: ['typescript'], stacks: ['express', 'mongo'] };
  const first = apply(dir, declared);
  assert.ok(first.every(({ status }) => ['created', 'set'].includes(status)), JSON.stringify(first));
  const second = apply(dir, declared);
  assert.ok(second.every(({ status }) => ['unchanged', 'kept', 'set'].includes(status)), JSON.stringify(second));

  assert.deepEqual(readDeclaredStack(dir), declared);
  const claude = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
  assert.ok(claude.includes('@.loop/rules/stacks/mongo.md'));
  assert.ok(claude.includes('Never write an emoji'));
  assert.ok(existsSync(join(dir, '.loop', 'gates', 'check-commit.js')));
  assert.ok(statSync(join(dir, '.githooks', 'commit-msg')).mode & 0o100);
  assert.equal(execFileSync('git', ['config', 'core.hooksPath'], { cwd: dir, encoding: 'utf8' }).trim(), '.githooks');
  const settings = JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8'));
  assert.equal(settings.attribution.commit, '');
  assert.match(readFileSync(join(dir, 'release-please-config.json'), 'utf8'), /"release-type": "node"/);
});

test('apply: keeps existing CLAUDE.md content and settings', () => {
  const dir = nodeProject();
  writeFileSync(join(dir, 'CLAUDE.md'), '# My project\n\nKeep this line.\n');
  execFileSync('mkdir', ['-p', join(dir, '.claude')]);
  writeFileSync(join(dir, '.claude', 'settings.json'), JSON.stringify({ model: 'x', permissions: { deny: ['Read(./secret)'] } }));
  apply(dir, { languages: ['typescript'], stacks: ['express'] });
  const claude = readFileSync(join(dir, 'CLAUDE.md'), 'utf8');
  assert.ok(claude.startsWith('# My project\n\nKeep this line.'));
  assert.ok(claude.includes('loop-harness:start'));
  const settings = JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8'));
  assert.equal(settings.model, 'x');
  assert.ok(settings.permissions.deny.includes('Read(./secret)'));
  assert.ok(settings.permissions.deny.includes('Edit(./.loop/**)'));
});

test('hooks: commit-msg rejects a bad message in a set-up project', () => {
  const dir = nodeProject();
  apply(dir, { languages: ['typescript'], stacks: ['express'] });
  ['config user.email t@t', 'config user.name t', 'add -A'].forEach((cmd) => execFileSync('git', cmd.split(' '), { cwd: dir }));
  assert.throws(() => execFileSync('git', ['commit', '-q', '-m', 'Added stuff'], { cwd: dir, stdio: 'pipe' }));
  execFileSync('git', ['commit', '-q', '-m', 'chore(loop): set up loop-harness'], { cwd: dir, stdio: 'pipe' });
});
