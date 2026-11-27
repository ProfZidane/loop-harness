import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git, parseAddedLines, addedLines, commitMessages } from '../src/git.js';
import { validateCommitMessage } from '../src/check-commit.js';
import { validateBranch } from '../src/check-branch.js';
import { checkEmoji } from '../src/check-emoji.js';

const ROCKET = String.fromCodePoint(0x1f680);

const repo = () => {
  const dir = mkdtempSync(join(tmpdir(), 'gates-'));
  ['init -q -b main', 'config user.email t@t', 'config user.name t', 'config commit.gpgsign false']
    .forEach((cmd) => git(cmd.split(' '), dir));
  return dir;
};

const commit = (dir, file, content, message) => {
  writeFileSync(join(dir, file), content);
  git(['add', '-A'], dir);
  git(['commit', '-q', '-m', message], dir);
};

test('commit message: valid format passes', () => {
  assert.deepEqual(validateCommitMessage('feat(expense): add pagination to list'), []);
  assert.deepEqual(validateCommitMessage('fix(auth)!: reject expired refresh tokens'), []);
  assert.deepEqual(validateCommitMessage('chore(main): release 1.2.0'), []);
});

test('commit message: violations are reported', () => {
  const cases = {
    'feat: add pagination': 'type(scope)',
    'Feat(expense): Add pagination': 'type(scope)',
    'feat(expense): add pagination.': 'type(scope)',
    'feat(expense): add pagination\n\nCo-Authored-By: Bot <b@b>': 'single line',
    [`feat(expense): add pagination ${ROCKET}`]: 'emoji',
    [`feat(expense): ${'a'.repeat(80)}`]: 'at most',
  };
  Object.entries(cases).forEach(([message, expected]) => {
    const reasons = validateCommitMessage(message);
    assert.ok(reasons.some((reason) => reason.includes(expected)), `${message} -> ${reasons.join(', ')}`);
  });
});

test('commit message: git comment lines are ignored', () => {
  assert.deepEqual(validateCommitMessage('docs(readme): fix typo\n# Please enter the commit message'), []);
});

test('branch names', () => {
  assert.deepEqual(validateBranch('feat/expenses-pagination'), []);
  assert.deepEqual(validateBranch('main'), []);
  assert.deepEqual(validateBranch('release-please--branches--main'), []);
  assert.equal(validateBranch('my_branch').length, 1);
  assert.equal(validateBranch('feat/Expenses').length, 1);
});

test('diff parser keeps file and line of added lines', () => {
  const diff = ['+++ b/src/a.ts', '@@ -1,0 +3,2 @@', '+one', '+two', '+++ b/src/b.ts', '@@ -5 +5 @@', '-old', '+new'].join('\n');
  assert.deepEqual(parseAddedLines(diff), [
    { file: 'src/a.ts', line: 3, text: 'one' },
    { file: 'src/a.ts', line: 4, text: 'two' },
    { file: 'src/b.ts', line: 5, text: 'new' },
  ]);
});

test('range: emoji in added lines and in commit messages are found', () => {
  const dir = repo();
  commit(dir, 'a.txt', 'clean\n', 'chore(repo): init');
  commit(dir, 'a.txt', `clean\nlaunch ${ROCKET}\n`, `feat(app): launch ${ROCKET}`);
  const lines = addedLines({ range: 'HEAD~1..HEAD', cwd: dir });
  assert.deepEqual(lines, [{ file: 'a.txt', line: 2, text: `launch ${ROCKET}` }]);
  const messages = commitMessages({ range: 'HEAD~1..HEAD', cwd: dir });
  assert.equal(messages.length, 1);
  assert.ok(messages[0].message.includes(ROCKET));
});

test('text source flags emoji and passes clean text', () => {
  assert.equal(checkEmoji({ text: `Release ${ROCKET}` }).length, 1);
  assert.deepEqual(checkEmoji({ text: 'Release notes' }), []);
});

test('text source flags emoji shortcodes but not urls or times', () => {
  assert.equal(checkEmoji({ text: ':robot: I have created a release' }).length, 1);
  assert.deepEqual(checkEmoji({ text: 'See https://example.com:443/a and 10:30:00' }), []);
});
