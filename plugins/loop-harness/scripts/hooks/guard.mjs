#!/usr/bin/env node
// PreToolUse guard for loop-harness. Exit 2 blocks the tool call; stderr is the reason given to Claude.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { findEmoji } from '../gates/src/emoji.js';
import { getValue } from '../init/yaml-lite.js';

const PROTECTED = [/^\.loop\//, /^\.claude\//, /^\.github\/workflows\//, /^\.githooks\//, /^\.env(\..*)?$/];
const GATE_KEYS = ['lint', 'typecheck', 'test'];
const OUTPUT_TAIL = 2000;

const writtenText = (input) =>
  [input.content, input.new_string, input.new_source, ...(input.edits ?? []).map((edit) => edit.new_string)]
    .filter((value) => typeof value === 'string')
    .join('\n');

const checkWrite = ({ cwd, tool_input: input }) => {
  const target = input.file_path ?? input.notebook_path ?? '';
  const path = relative(cwd, resolve(cwd, target));
  if (PROTECTED.some((pattern) => pattern.test(path))) {
    return `${path} is protected: it is managed by loop-harness or by the owner. Change it through a pull request written by a human, or through loop-init.`;
  }
  const emoji = findEmoji(writtenText(input));
  return emoji.length > 0 ? `Emoji are forbidden everywhere (rules/core.md, section 2). Remove: ${emoji.map((e) => e.char).join(' ')}` : null;
};

const runGates = (cwd) => {
  const configPath = join(cwd, '.loop', 'config.yml');
  if (!existsSync(configPath)) return null;
  const config = readFileSync(configPath, 'utf8');
  const failed = GATE_KEYS.map((key) => getValue(config, `commands.${key}`))
    .filter((command) => typeof command === 'string' && command.length > 0)
    .map((command) => {
      try {
        execSync(command, { cwd, stdio: 'pipe', encoding: 'utf8' });
        return null;
      } catch (error) {
        return `$ ${command}\n${`${error.stdout ?? ''}${error.stderr ?? ''}`.slice(-OUTPUT_TAIL)}`;
      }
    })
    .filter(Boolean);
  return failed.length > 0 ? `Local gates failed, fix before committing:\n${failed.join('\n')}` : null;
};

const BASH_RULES = [
  [/\bgit\b[^|;&]*\s--no-verify\b|\bgit\s+commit\b[^|;&]*\s-n\b/, () => 'Bypassing git hooks (--no-verify) is forbidden.'],
  [/\bgit\s+push\b[^|;&]*(\s--force\b|\s-f\b|\s--force-with-lease\b)/, () => 'Force push is forbidden.'],
  [/\bgit\s+commit\b/, (event) => runGates(event.cwd)],
];

const checkBash = (event) => {
  const command = event.tool_input.command ?? '';
  return BASH_RULES.filter(([pattern]) => pattern.test(command))
    .map(([, check]) => check(event))
    .find(Boolean) ?? null;
};

const CHECKS = { Write: checkWrite, Edit: checkWrite, MultiEdit: checkWrite, NotebookEdit: checkWrite, Bash: checkBash };

const event = JSON.parse(readFileSync(0, 'utf8'));
const isLoopProject = existsSync(join(event.cwd, '.loop', 'config.yml'));
const reason = isLoopProject ? CHECKS[event.tool_name]?.(event) ?? null : null;
if (reason) {
  process.stderr.write(`${reason}\n`);
  process.exit(2);
}
