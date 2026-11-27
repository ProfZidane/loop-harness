#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detect } from './init/detect.js';
import { missingPacks, readDeclaredStack } from './init/packs.js';
import { writeBlock, writeIfAbsent, writeManaged, mergeSettings } from './init/files.js';
import { claudeBlock, configFor, managedFiles, releaseConfig, seedFiles } from './init/plan.js';

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const template = (...parts) => readFileSync(join(PLUGIN_ROOT, 'templates', ...parts), 'utf8');

const writeConfig = (projectDir, declared) => {
  const path = join(projectDir, '.loop', 'config.yml');
  return existsSync(path) ? { path, status: 'kept' } : writeIfAbsent({ path, content: configFor(template('loop.config.yml'), declared) });
};

const setHooksPath = (projectDir) => {
  const isRepo = existsSync(join(projectDir, '.git'));
  if (isRepo) execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: projectDir });
  return { path: 'git config core.hooksPath', status: isRepo ? 'set' : 'skipped (not a git repository)' };
};

export const apply = (projectDir, declared) => {
  const at = (relative) => join(projectDir, relative);
  return [
    writeConfig(projectDir, declared),
    ...managedFiles(PLUGIN_ROOT, declared).map(({ to, content, mode }) => writeManaged({ path: at(to), content, mode })),
    ...seedFiles(PLUGIN_ROOT, declared).map(({ to, content }) => writeIfAbsent({ path: at(to), content })),
    writeIfAbsent({ path: at('release-please-config.json'), content: releaseConfig(PLUGIN_ROOT, declared) }),
    writeBlock({ path: at('CLAUDE.md'), block: claudeBlock(PLUGIN_ROOT, declared), fallback: template('claude', 'CLAUDE.md') }),
    mergeSettings({ path: at('.claude/settings.json'), template: JSON.parse(template('claude', 'settings.json')) }),
    setHooksPath(projectDir),
  ].map(({ path, status }) => ({ path: path.replace(`${projectDir}/`, ''), status }));
};

const list = (value) => (value ? value.split(',').map((item) => item.trim()).filter(Boolean) : []);

const option = (argv, name) => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? undefined : argv[index + 1];
};

const commands = {
  detect: (dir) => detect(dir),
  check: (dir) => ({ missing: missingPacks(PLUGIN_ROOT, readDeclaredStack(dir)) }),
  apply: (dir, argv) => {
    const declared = { languages: list(option(argv, 'languages')), stacks: list(option(argv, 'stacks')) };
    const missing = missingPacks(PLUGIN_ROOT, declared);
    return missing.length > 0 ? { error: 'missing rule packs', missing } : { files: apply(dir, declared) };
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, dir = '.', ...rest] = process.argv.slice(2);
  const run = commands[command];
  if (!run) {
    console.error('Usage: loop-init.mjs <detect|check|apply> [projectDir] [--languages a,b] [--stacks x,y]');
    process.exit(2);
  }
  const result = run(resolve(dir), rest);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.error || result.missing?.length ? 1 : 0;
}
