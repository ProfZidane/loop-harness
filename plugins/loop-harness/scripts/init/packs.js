import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const inlineList = (text, key) => {
  const match = new RegExp(`^\\s*${key}:\\s*\\[([^\\]]*)\\]`, 'm').exec(text);
  return match ? match[1].split(',').map((item) => item.trim()).filter((item) => item.length > 0) : [];
};

export const readDeclaredStack = (projectDir) => {
  const text = readFileSync(join(projectDir, '.loop', 'config.yml'), 'utf8');
  return { languages: inlineList(text, 'languages'), stacks: inlineList(text, 'stacks') };
};

export const packPaths = (pluginRoot, { languages, stacks }) => [
  ...languages.map((language) => ({ kind: 'language', name: language, path: join(pluginRoot, 'rules', 'languages', `${language}.md`) })),
  ...stacks.map((stack) => ({ kind: 'stack', name: stack, path: join(pluginRoot, 'rules', 'stacks', `${stack}.md`) })),
];

export const missingPacks = (pluginRoot, declared) =>
  packPaths(pluginRoot, declared).filter(({ path }) => !existsSync(path)).map(({ kind, name }) => `${kind}:${name}`);
