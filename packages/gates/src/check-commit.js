#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { findEmoji } from '../../eslint-config/src/emoji.js';
import { commitMessages } from './git.js';
import { parseArgs, report } from './args.js';

const TYPES = 'feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert';
const FORMAT = new RegExp(`^(${TYPES})\\([a-z0-9][a-z0-9-]*\\)!?: [a-z0-9].*[^.]$`);
const MAX_LENGTH = 72;

const stripGitComments = (message) =>
  message.split('\n').filter((line) => !line.startsWith('#')).join('\n').trim();

const checks = [
  [(m) => m.includes('\n'), 'must be a single line (no body, no trailers such as Co-Authored-By)'],
  [(m) => !FORMAT.test(m), 'must match "type(scope): description" in lowercase, without a final period'],
  [(m) => m.length > MAX_LENGTH, `must be at most ${String(MAX_LENGTH)} characters`],
  [(m) => findEmoji(m).length > 0, 'must not contain emoji'],
];

export const validateCommitMessage = (raw) => {
  const message = stripGitComments(raw);
  return checks.filter(([fails]) => fails(message)).map(([, reason]) => reason);
};

const describe = (label, message) => validateCommitMessage(message).map((reason) => `${label}: ${reason}`);

const sources = {
  'commit-msg': (args) => describe('commit message', readFileSync(args['commit-msg'], 'utf8')),
  range: (args) => commitMessages({ range: args.range }).flatMap(({ sha, message }) => describe(`commit ${sha.slice(0, 7)}`, message)),
  text: (args) => describe('title', args.text),
};

export const checkCommits = (args) => Object.keys(sources).filter((key) => args[key]).flatMap((key) => sources[key](args));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = report('Commit convention', checkCommits(parseArgs(process.argv.slice(2))));
}
