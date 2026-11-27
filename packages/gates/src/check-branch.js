#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { git } from './git.js';
import { parseArgs, report } from './args.js';

const TYPES = 'feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|hotfix';
const FORMAT = new RegExp(`^(${TYPES})/[a-z0-9]+(-[a-z0-9]+)*$`);
const ALLOWED = [/^main$/, /^release-please--/];

export const validateBranch = (name) =>
  ALLOWED.some((pattern) => pattern.test(name)) || FORMAT.test(name)
    ? []
    : [`branch "${name}" must match "type/kebab-description" (e.g. feat/expenses-pagination)`];

const currentBranch = () => git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  process.exitCode = report('Branch convention', validateBranch(args.name ?? currentBranch()));
}
