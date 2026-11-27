#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { findEmoji } from './emoji.js';
import { addedLines, commitMessages } from './git.js';
import { parseArgs, report } from './args.js';

const describe = (where, text) => findEmoji(text).map(({ char }) => `${where}: emoji "${char}"`);

const fromLines = (lines) => lines.flatMap(({ file, line, text }) => describe(`${file}:${String(line)}`, text));

const fromCommits = (commits) => commits.flatMap(({ sha, message }) => describe(`commit ${sha.slice(0, 7)}`, message));

const sources = {
  staged: () => fromLines(addedLines({ staged: true })),
  range: (args) => [...fromLines(addedLines({ range: args.range })), ...fromCommits(commitMessages({ range: args.range }))],
  'commit-msg': (args) => describe('commit message', readFileSync(args['commit-msg'], 'utf8')),
  text: (args) => describe('text', args.text),
};

export const checkEmoji = (args) => Object.keys(sources).filter((key) => args[key]).flatMap((key) => sources[key](args));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = report('No emoji allowed', checkEmoji(parseArgs(process.argv.slice(2))));
}
