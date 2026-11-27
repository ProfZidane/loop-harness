import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from './diagram.mjs';
import { findEmoji } from '../gates/src/emoji.js';

const example = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'skills', 'docs-writer', 'c2-example.json'), 'utf8'));

test('renders every node, edge and a legend', () => {
  const svg = render(example);
  assert.ok(svg.startsWith('<svg'));
  example.nodes.forEach((node) => assert.ok(svg.includes(`>${node.title}<`), node.title));
  assert.equal((svg.match(/<line /g) ?? []).length, example.edges.length);
  assert.ok(svg.includes('stroke-dasharray="5 4"'), 'async edge is dashed');
  assert.ok(svg.includes('>Container<'), 'legend lists kinds');
  assert.deepEqual(findEmoji(svg), []);
});

test('escapes text and rejects unknown kinds and nodes', () => {
  const svg = render({ title: 'A & B <C>', subtitle: '', nodes: [{ id: 'a', kind: 'container', title: 'x', x: 0, y: 0 }] });
  assert.ok(svg.includes('A &amp; B &lt;C&gt;'));
  assert.throws(() => render({ nodes: [{ id: 'a', kind: 'blob', x: 0, y: 0 }] }), /Unknown kind/);
  assert.throws(() => render({ nodes: [{ id: 'a', kind: 'container', x: 0, y: 0 }], edges: [{ from: 'a', to: 'z' }] }), /unknown node/);
});
