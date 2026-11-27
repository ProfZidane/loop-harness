import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';

const read = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null);

const write = (path, content, mode) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  if (mode) chmodSync(path, mode);
};

export const writeManaged = ({ path, content, mode }) => {
  const current = read(path);
  if (current === content) return { path, status: 'unchanged' };
  write(path, content, mode);
  return { path, status: current === null ? 'created' : 'updated' };
};

export const writeIfAbsent = ({ path, content, mode }) => {
  if (read(path) !== null) return { path, status: 'kept' };
  write(path, content, mode);
  return { path, status: 'created' };
};

const START = '<!-- loop-harness:start -->';
const END = '<!-- loop-harness:end -->';

export const writeBlock = ({ path, block, fallback }) => {
  const current = read(path) ?? fallback;
  const wrapped = `${START}\n${block.trim()}\n${END}`;
  const hasBlock = current.includes(START) && current.includes(END);
  const next = hasBlock
    ? `${current.slice(0, current.indexOf(START))}${wrapped}${current.slice(current.indexOf(END) + END.length)}`
    : `${current.trimEnd()}\n\n${wrapped}\n`;
  return writeManaged({ path, content: next });
};

const union = (a = [], b = []) => [...new Set([...a, ...b])];

export const mergeSettings = ({ path, template }) => {
  const current = JSON.parse(read(path) ?? '{}');
  const merged = {
    ...current,
    attribution: { ...current.attribution, ...template.attribution },
    permissions: {
      ...current.permissions,
      deny: union(current.permissions?.deny, template.permissions.deny),
    },
  };
  return writeManaged({ path, content: `${JSON.stringify(merged, null, 2)}\n` });
};
