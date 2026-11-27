import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { packPaths } from './packs.js';

const HOOK_MODE = 0o755;
const CORE_RULES = ['core.md', 'docs.md', 'loop.md'];

const RELEASE_TYPES = { typescript: 'node', javascript: 'node', python: 'python', dart: 'dart' };

const HOOKS = {
  'pre-commit': 'node .loop/gates/check-emoji.js --staged',
  'commit-msg': 'node .loop/gates/check-commit.js --commit-msg "$1" && node .loop/gates/check-emoji.js --commit-msg "$1"',
  'pre-push': 'node .loop/gates/check-branch.js',
};

const text = (path) => readFileSync(path, 'utf8');

const releaseType = (languages) => RELEASE_TYPES[languages.find((language) => language in RELEASE_TYPES)] ?? 'simple';

export const configFor = (template, { languages, stacks }) =>
  template
    .replace(/^(\s*languages:\s*)\[[^\]]*\]/m, `$1[${languages.join(', ')}]`)
    .replace(/^(\s*stacks:\s*)\[[^\]]*\]/m, `$1[${stacks.join(', ')}]`)
    .replace(/^(\s*releaseType:\s*)\S+/m, `$1${releaseType(languages)}`);

export const claudeBlock = (pluginRoot, declared) => {
  const imports = [
    ...CORE_RULES.map((file) => `@.loop/rules/${file}`),
    ...packPaths(pluginRoot, declared).map(({ kind, name }) => `@.loop/rules/${kind === 'language' ? 'languages' : 'stacks'}/${name}.md`),
  ];
  return `${text(join(pluginRoot, 'templates', 'claude', 'hard-rules.md')).trim()}\n\n## Rules\n\n${imports.join('\n')}`;
};

const ruleFiles = (pluginRoot, declared) => [
  ...CORE_RULES.map((file) => ({ from: join(pluginRoot, 'rules', file), to: join('.loop', 'rules', file) })),
  ...packPaths(pluginRoot, declared).map(({ kind, name, path }) => ({
    from: path,
    to: join('.loop', 'rules', kind === 'language' ? 'languages' : 'stacks', `${name}.md`),
  })),
];

const gateFiles = (pluginRoot) => {
  const dir = join(pluginRoot, 'scripts', 'gates', 'src');
  return readdirSync(dir).map((file) => ({ from: join(dir, file), to: join('.loop', 'gates', file) }));
};

export const managedFiles = (pluginRoot, declared) => [
  ...[...ruleFiles(pluginRoot, declared), ...gateFiles(pluginRoot)].map(({ from, to }) => ({ to, content: text(from) })),
  ...Object.entries(HOOKS).map(([name, command]) => ({
    to: join('.githooks', name),
    content: `#!/bin/sh\n# Managed by loop-harness\n${command}\n`,
    mode: HOOK_MODE,
  })),
];

const MOBILE_STACKS = new Set(['flutter', 'ionic']);

export const seedFiles = (pluginRoot, declared) => {
  const t = (...parts) => join(pluginRoot, 'templates', ...parts);
  const seeds = [
    [t('github', 'ISSUE_TEMPLATE', 'loop-ticket.yml'), '.github/ISSUE_TEMPLATE/loop-ticket.yml'],
    [t('github', 'pull_request_template.md'), '.github/pull_request_template.md'],
    [t('github', 'workflows', 'loop-gates.yml'), '.github/workflows/loop-gates.yml'],
    [t('github', 'workflows', 'release.yml'), '.github/workflows/release.yml'],
    [t('release', '.release-please-manifest.json'), '.release-please-manifest.json'],
    [t('docs', 'architecture.md'), 'docs/architecture.md'],
    [t('docs', 'data-model.md'), 'docs/data-model.md'],
    [t('docs', 'adr', '0000-template.md'), 'docs/adr/0000-template.md'],
    [t('docs', 'coe', '0000-template.md'), 'docs/coe/0000-template.md'],
    ...(declared.stacks.some((stack) => MOBILE_STACKS.has(stack))
      ? [[t('github', 'workflows', 'mobile-build.yml'), '.github/workflows/mobile-build.yml']]
      : []),
  ];
  return seeds.map(([from, to]) => ({ to, content: text(from) }));
};

export const releaseConfig = (pluginRoot, declared) => {
  const config = JSON.parse(text(join(pluginRoot, 'templates', 'release', 'release-please-config.json')));
  return `${JSON.stringify({ ...config, 'release-type': releaseType(declared.languages) }, null, 2)}\n`;
};
