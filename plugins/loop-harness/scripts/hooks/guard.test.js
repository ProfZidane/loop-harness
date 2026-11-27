import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getValue, setValue } from '../init/yaml-lite.js';
import { configure } from '../loop-init.mjs';

const guard = join(import.meta.dirname, 'guard.mjs');
const template = readFileSync(join(import.meta.dirname, '..', '..', 'templates', 'loop.config.yml'), 'utf8');
const ROCKET = String.fromCodePoint(0x1f680);

const loopProject = (commands = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'guard-'));
  mkdirSync(join(dir, '.loop'));
  const config = Object.entries(commands).reduce((text, [key, value]) => setValue(text, `commands.${key}`, value), template);
  writeFileSync(join(dir, '.loop', 'config.yml'), config);
  return dir;
};

const run = (cwd, tool_name, tool_input) =>
  spawnSync('node', [guard], { input: JSON.stringify({ cwd, tool_name, tool_input }), encoding: 'utf8' });

test('yaml-lite reads scalars, inline lists and block lists', () => {
  assert.equal(getValue(template, 'commands.lint'), 'npm run lint');
  assert.deepEqual(getValue(template, 'project.languages'), ['typescript']);
  assert.deepEqual(getValue(template, 'tests.criticalPaths'), ['login', 'create-sale']);
  assert.equal(getValue(template, 'loop.modes.window'), null);
  assert.equal(getValue(template, 'nope.key'), undefined);
});

test('yaml-lite writes values and keeps comments', () => {
  const updated = setValue(template, 'ui.language', 'en');
  assert.equal(getValue(updated, 'ui.language'), 'en');
  assert.match(updated, /language: en\s+# language of user-facing text/);
  assert.throws(() => setValue(template, 'nope.key', 'x'));
});

test('guard blocks protected paths and emoji, allows normal writes', () => {
  const dir = loopProject();
  assert.equal(run(dir, 'Edit', { file_path: join(dir, '.loop/config.yml'), new_string: 'x' }).status, 2);
  assert.equal(run(dir, 'Write', { file_path: '.github/workflows/ci.yml', content: 'x' }).status, 2);
  assert.equal(run(dir, 'Write', { file_path: '.env.local', content: 'x' }).status, 2);
  const emoji = run(dir, 'Write', { file_path: 'src/a.ts', content: `const a = '${ROCKET}';` });
  assert.equal(emoji.status, 2);
  assert.match(emoji.stderr, /Emoji are forbidden/);
  assert.equal(run(dir, 'MultiEdit', { file_path: 'src/a.ts', edits: [{ new_string: ROCKET }] }).status, 2);
  assert.equal(run(dir, 'Write', { file_path: 'src/a.ts', content: 'export const a = 1;' }).status, 0);
});

test('guard blocks hook bypass and force push', () => {
  const dir = loopProject();
  assert.equal(run(dir, 'Bash', { command: 'git commit --no-verify -m "x"' }).status, 2);
  assert.equal(run(dir, 'Bash', { command: 'git push --force origin main' }).status, 2);
  assert.equal(run(dir, 'Bash', { command: 'git status' }).status, 0);
});

test('guard runs local gates before git commit', () => {
  const failing = loopProject({ lint: 'echo lint-broken && exit 1', typecheck: '', test: '' });
  const blocked = run(failing, 'Bash', { command: 'git commit -m "feat(a): b"' });
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /lint-broken/);
  const passing = loopProject({ lint: 'true', typecheck: 'true', test: 'true' });
  assert.equal(run(passing, 'Bash', { command: 'git commit -m "feat(a): b"' }).status, 0);
});

test('guard does nothing outside loop projects', () => {
  const dir = mkdtempSync(join(tmpdir(), 'plain-'));
  assert.equal(run(dir, 'Write', { file_path: '.claude/settings.json', content: ROCKET }).status, 0);
});

test('configure sets config values deterministically', () => {
  const dir = loopProject();
  configure(dir, ['ui.language=en', 'tests.criticalPaths=[login, checkout]', 'notify.githubReviewer=ProfZidane']);
  const config = readFileSync(join(dir, '.loop', 'config.yml'), 'utf8');
  assert.equal(getValue(config, 'ui.language'), 'en');
  assert.deepEqual(getValue(config, 'tests.criticalPaths'), ['login', 'checkout']);
  assert.equal(getValue(config, 'notify.githubReviewer'), 'ProfZidane');
});
