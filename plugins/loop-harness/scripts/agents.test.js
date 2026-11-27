import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findEmoji } from './gates/src/emoji.js';

const pluginRoot = join(import.meta.dirname, '..');
const agentsDir = join(pluginRoot, 'agents');
const READ_ONLY = new Set(['code-reviewer', 'spec-reviewer', 'security-reviewer', 'plan-reviewer']);
const EXPECTED = ['builder', 'code-reviewer', 'plan-reviewer', 'planner', 'security-reviewer', 'spec-reviewer'];

const frontmatter = (text) => {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  return Object.fromEntries(
    (match ? match[1] : '').split('\n').map((line) => line.split(/:\s(.*)/s).slice(0, 2)),
  );
};

const agents = readdirSync(agentsDir).map((file) => {
  const text = readFileSync(join(agentsDir, file), 'utf8');
  return { file, text, meta: frontmatter(text) };
});

test('all six agents exist', () => {
  assert.deepEqual(agents.map(({ meta }) => meta.name).sort(), EXPECTED);
});

test('agents declare name, description and tools, and match the output contract', () => {
  agents.forEach(({ file, text, meta }) => {
    assert.ok(meta.name && meta.description && meta.tools, file);
    assert.ok(text.includes('.loop/rules/loop.md'), `${file} must point to the output contract`);
    assert.ok(/no emoji/i.test(text), `${file} must forbid emoji`);
    assert.deepEqual(findEmoji(text), [], file);
  });
});

test('reviewers cannot write', () => {
  agents
    .filter(({ meta }) => READ_ONLY.has(meta.name))
    .forEach(({ meta }) => assert.ok(!/\b(Write|Edit)\b/.test(meta.tools), `${meta.name} tools: ${meta.tools}`));
});
